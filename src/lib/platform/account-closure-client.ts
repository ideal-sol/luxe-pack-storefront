import { ApiProblemError, createStorefrontIdentityClient, type PublicComponents, type StorefrontTransport } from "@oripa/storefront-client";
import { createBrowserPlatformTransport, type BrowserClientOverrides } from "./browser-client";
import type { PlatformRuntimeConfiguration } from "./runtime-configuration";

export interface ClosurePreview {
  pointBalance: number; unclaimedPrizeCount: number; shippingInProgressCount: number;
  canClose: boolean; verificationMethod: "password" | "email_code"; maskedEmail: string;
}
export interface ClosureActions {
  load(): Promise<ClosurePreview>;
  sendCode(): Promise<{ resendAvailableAt: number; expiresInMinutes: number; maskedEmail?: string }>;
  confirm(input: { confirmed: true; expectedPointBalance: number; expectedUnclaimedPrizeCount: number; password?: string; emailCode?: string; operationKey: string }): Promise<void>;
  complete(): void;
}
export class ClosureUiError extends Error {
  constructor(readonly kind: "stale" | "password" | "email_code" | "session" | "verification" | "blocked" | "retry", readonly retryAt?: number) { super(kind); }
}
function closureError(reason: unknown): ClosureUiError {
  if (reason instanceof ApiProblemError) {
    if (reason.status === 401 || ["SESSION_EXPIRED", "AUTHENTICATION_REQUIRED"].includes(reason.code)) return new ClosureUiError("session");
    const kinds = { INVALID_PASSWORD: "password", INVALID_EMAIL_CODE: "email_code", ACCOUNT_CLOSURE_STALE: "stale",
      ACCOUNT_CLOSURE_BLOCKED: "blocked", ACCOUNT_CLOSURE_VERIFICATION_REQUIRED: "verification",
      EMAIL_VERIFICATION_REQUIRED: "verification", SMS_VERIFICATION_REQUIRED: "verification" } as const;
    if (Object.hasOwn(kinds, reason.code)) return new ClosureUiError(kinds[reason.code as keyof typeof kinds]);
    if (reason.status === 429 && Number.isFinite(reason.retry_after_seconds) && reason.retry_after_seconds! >= 0) {
      return new ClosureUiError("retry", Date.now() + reason.retry_after_seconds! * 1000);
    }
  }
  return new ClosureUiError("retry");
}
function instant(value: string) {
  const result = typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
  if (!Number.isFinite(result)) throw new TypeError("Invalid closure timestamp");
  return result;
}
/** Maps only the published alpha.48 Identity Client; never implements HTTP or domain decisions. */
export function createAccountClosureClient(transport: StorefrontTransport): Omit<ClosureActions, "complete"> {
  const client = createStorefrontIdentityClient(transport);
  return {
    async load() {
      try {
        const response = await client.getAccountClosurePreview();
        const data = response.data.data;
        if (!data || ![data.point_balance, data.unclaimed_prize_count, data.shipping_in_progress_count].every(n => Number.isSafeInteger(n) && n >= 0) ||
            typeof data.can_close !== "boolean" || !["password", "email_code"].includes(data.verification_method) ||
            (data.can_close ? data.blocked_reason !== null : data.blocked_reason !== "payment_processing") ||
            (data.masked_email !== null && typeof data.masked_email !== "string") ||
            data.verification_method === "email_code" && !data.masked_email) throw new TypeError("Invalid closure preview");
        return { pointBalance: data.point_balance, unclaimedPrizeCount: data.unclaimed_prize_count, shippingInProgressCount: data.shipping_in_progress_count,
          canClose: data.can_close, verificationMethod: data.verification_method, maskedEmail: data.masked_email ?? "" };
      } catch (reason) { throw closureError(reason); }
    },
    async sendCode() {
      const startedAt = Date.now();
      try {
        const { data: response } = await client.sendAccountClosureEmailCode({});
        const data = response.data;
        if (!data || typeof data.masked_email !== "string" || !data.masked_email) throw new TypeError("Invalid closure email response");
        const resendAvailableAt = instant(data.resend_available_at);
        const expiresAt = instant(data.expires_at);
        if (expiresAt <= startedAt || expiresAt < resendAvailableAt) throw new TypeError("Invalid closure code expiry");
        return { resendAvailableAt, expiresInMinutes: Math.max(1, Math.round((expiresAt - startedAt) / 60000)), maskedEmail: data.masked_email };
      } catch (reason) { throw closureError(reason); }
    },
    async confirm(input) {
      try {
        let verification: Pick<PublicComponents["schemas"]["AccountClosureRequest"], "password" | "email_code">;
        if (typeof input.password === "string" && input.emailCode === undefined) verification = { password: input.password };
        else if (typeof input.emailCode === "string" && input.password === undefined) verification = { email_code: input.emailCode };
        else throw new TypeError("Exactly one verification value is required");
        const request: PublicComponents["schemas"]["AccountClosureRequest"] = {
          confirmed: true, expected_point_balance: input.expectedPointBalance, expected_unclaimed_prize_count: input.expectedUnclaimedPrizeCount,
          ...verification,
        };
        const response = await client.closeAccount(request, { idempotency_key: input.operationKey });
        if (response.metadata.status !== 200 || !response.data?.data) throw new TypeError("Invalid closure completion");
        instant(response.data.data.closed_at);
      } catch (reason) { throw closureError(reason); }
    },
  };
}
export function createBrowserAccountClosureClient(configuration?: PlatformRuntimeConfiguration, overrides: BrowserClientOverrides = {}) {
  return createAccountClosureClient(createBrowserPlatformTransport(configuration, overrides));
}
