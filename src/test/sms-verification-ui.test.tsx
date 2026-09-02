import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_SMS_VERIFICATION_FIXTURES } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SmsVerification } from "@/components/account/sms-verification";
import { SessionProvider } from "@/components/auth/session-provider";
import type { AuthClientAdapter, AuthSession, SmsVerificationStatus } from "@/lib/platform";
import { formatVerifiedPhone, normalizeJapaneseMobilePhone } from "@/lib/presentation/phone";

const metadata = { idempotency_replayed: false, status: 200 } as const;
const authenticated = PUBLIC_AUTH_FIXTURE.authenticated_session as AuthSession;

function response<T>(data: T, status = 200) {
  return { data, metadata: { ...metadata, status } };
}

function authClient(overrides: Partial<AuthClientAdapter> = {}): AuthClientAdapter {
  return {
    changeUserPassword: vi.fn(),
    completeEmailChange: vi.fn(),
    completeEmailVerification: vi.fn(),
    confirmPasswordReset: vi.fn(),
    createEmailChangeRequest: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue(response(authenticated)),
    getSmsVerificationStatus: vi.fn().mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.unverified)),
    login: vi.fn(),
    logout: vi.fn(),
    reauthenticateUserPassword: vi.fn(),
    register: vi.fn(),
    requestPasswordReset: vi.fn(),
    resendEmailVerification: vi.fn(),
    resendSmsVerification: vi.fn(),
    sendSmsVerification: vi.fn(),
    verifySmsCode: vi.fn(),
    ...overrides,
  } as AuthClientAdapter;
}

function renderSms(client: AuthClientAdapter, pollIntervalMs = 10) {
  return render(
    <SessionProvider client={client}>
      <SmsVerification pollIntervalMs={pollIntervalMs} />
    </SessionProvider>,
  );
}

function problem(code: string, status: number, retryAfterSeconds?: number) {
  return new ApiProblemError({
    code,
    request_id: `request-${code.toLowerCase()}`,
    retryable: status === 429,
    ...(retryAfterSeconds === undefined ? {} : { retry_after_seconds: retryAfterSeconds }),
    status,
    title: "SMS request rejected",
    type: `https://storefront.test/problems/${code.toLowerCase()}`,
  });
}

describe("SMS phone ownership verification UI", () => {
  it.each([
    ["07012345678", "07012345678"],
    ["080-1234-5678", "08012345678"],
    ["09012345678", "09012345678"],
    ["05012345678", null],
    ["0312345678", null],
    ["+819012345678", null],
  ])("normalizes supported JP mobile input %s", (input, expected) => {
    expect(normalizeJapaneseMobilePhone(input)).toBe(expected);
  });

  it("completes initial verification only after provider acceptance", async () => {
    const accepted = {
      ...PUBLIC_SMS_VERIFICATION_FIXTURES.accepted,
      challenge: {
        ...PUBLIC_SMS_VERIFICATION_FIXTURES.accepted.challenge,
        id: PUBLIC_SMS_VERIFICATION_FIXTURES.send_pending.challenge_id,
      },
    } satisfies SmsVerificationStatus;
    const getSmsVerificationStatus = vi.fn()
      .mockResolvedValueOnce(response(PUBLIC_SMS_VERIFICATION_FIXTURES.unverified))
      .mockResolvedValueOnce(response(accepted))
      .mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.verified));
    const sendSmsVerification = vi.fn().mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.send_pending, 202));
    const verifySmsCode = vi.fn().mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.verified));
    renderSms(authClient({ getSmsVerificationStatus, sendSmsVerification, verifySmsCode }));

    fireEvent.change(await screen.findByLabelText(/携帯電話番号/), { target: { value: "090-1234-5678" } });
    fireEvent.submit(screen.getByRole("button", { name: "認証コードを送信" }).closest("form")!);
    expect(await screen.findByText("認証コードを送信しています。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SMS認証を完了" })).toBeDisabled();
    expect(sendSmsVerification).toHaveBeenCalledWith({ phone: "09012345678" }, {});

    expect(await screen.findByText("認証コードを送信しました。")).toBeInTheDocument();
    const code = screen.getByLabelText(/認証コード/);
    expect(code).toHaveAttribute("inputmode", "numeric");
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    fireEvent.change(code, { target: { value: "12a34 56" } });
    expect(code).toHaveValue("123456");
    fireEvent.submit(screen.getByRole("button", { name: "SMS認証を完了" }).closest("form")!);

    expect(await screen.findByRole("heading", { name: "SMS認証済み" })).toBeInTheDocument();
    expect(screen.getByText("090-1234-5678")).toBeInTheDocument();
    expect(verifySmsCode).toHaveBeenCalledWith({ challenge_id: accepted.challenge.id, code: "123456" }, {});
  });

  it("shows safe delivery failure without claiming the SMS was sent", async () => {
    renderSms(authClient({
      getSmsVerificationStatus: vi.fn().mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.failed)),
    }));
    expect(await screen.findByText(/認証コードを送信できませんでした/)).toBeInTheDocument();
    expect(screen.queryByText("認証コードを送信しました。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SMS認証を完了" })).toBeDisabled();
  });

  it("starts the 60-second resend countdown and applies server retry timing", async () => {
    const sendSmsVerification = vi.fn().mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.send_pending, 202));
    const first = renderSms(authClient({ sendSmsVerification }), 60_000);
    fireEvent.change(await screen.findByLabelText(/携帯電話番号/), { target: { value: "08012345678" } });
    fireEvent.submit(screen.getByRole("button", { name: "認証コードを送信" }).closest("form")!);
    expect(await screen.findByRole("button", { name: "再送信（60秒）" })).toBeDisabled();
    first.unmount();

    const resendSmsVerification = vi.fn().mockRejectedValue(problem("RATE_LIMITED", 429, 59));
    renderSms(authClient({
      getSmsVerificationStatus: vi.fn().mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.accepted)),
      resendSmsVerification,
    }));
    fireEvent.click(await screen.findByRole("button", { name: "認証コードを再送信" }));
    expect(await screen.findByText("しばらく時間をおいてから再度お試しください。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再送信（59秒）" })).toBeDisabled();
  });

  it("uses the generic duplicate-phone error and never exposes account details", async () => {
    const verifySmsCode = vi.fn().mockRejectedValue(problem("PHONE_NUMBER_UNAVAILABLE", 409));
    renderSms(authClient({
      getSmsVerificationStatus: vi.fn().mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.accepted)),
      verifySmsCode,
    }));
    fireEvent.change(await screen.findByLabelText(/認証コード/), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "SMS認証を完了" }));
    expect(await screen.findByText("この電話番号は利用できません。別の電話番号を入力してください。")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/user|account|suspended|PHONE_NUMBER_UNAVAILABLE/i);
  });

  it("shows the canonical full verified phone and no delete action", async () => {
    renderSms(authClient({
      getSmsVerificationStatus: vi.fn().mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.verified)),
    }));
    expect(await screen.findByText(formatVerifiedPhone(PUBLIC_SMS_VERIFICATION_FIXTURES.verified.phone))).toHaveTextContent("090-1234-5678");
    expect(screen.getByRole("heading", { name: "SMS認証済み" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "電話番号を変更する" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /削除/ })).not.toBeInTheDocument();
  });

  it("requires Fresh Reauthentication for phone change and refreshes the rotated session", async () => {
    const accepted = {
      ...PUBLIC_SMS_VERIFICATION_FIXTURES.accepted,
      challenge: {
        ...PUBLIC_SMS_VERIFICATION_FIXTURES.accepted.challenge,
        id: PUBLIC_SMS_VERIFICATION_FIXTURES.send_pending.challenge_id,
      },
      phone: PUBLIC_SMS_VERIFICATION_FIXTURES.verified.phone,
      phone_masked: PUBLIC_SMS_VERIFICATION_FIXTURES.verified.phone_masked,
      verified: true,
      verified_at: PUBLIC_SMS_VERIFICATION_FIXTURES.verified.verified_at,
    } satisfies SmsVerificationStatus;
    const getSmsVerificationStatus = vi.fn()
      .mockResolvedValueOnce(response(PUBLIC_SMS_VERIFICATION_FIXTURES.verified))
      .mockResolvedValueOnce(response(accepted))
      .mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.phone_change));
    const getCurrentSession = vi.fn().mockResolvedValue(response(authenticated));
    const reauthenticateUserPassword = vi.fn().mockResolvedValue(response({ method: "password", reauthenticated: true }));
    const sendSmsVerification = vi.fn().mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.send_pending, 202));
    const verifySmsCode = vi.fn().mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.phone_change));
    renderSms(authClient({
      getCurrentSession,
      getSmsVerificationStatus,
      reauthenticateUserPassword,
      sendSmsVerification,
      verifySmsCode,
    }));

    fireEvent.click(await screen.findByRole("button", { name: "電話番号を変更する" }));
    fireEvent.change(screen.getByLabelText("現在のパスワード"), { target: { value: "fixture-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "本人確認する" }).closest("form")!);
    await waitFor(() => expect(reauthenticateUserPassword).toHaveBeenCalledWith({ password: "fixture-password" }, {}));

    fireEvent.change(await screen.findByLabelText(/携帯電話番号/), { target: { value: "080-1234-5678" } });
    fireEvent.submit(screen.getByRole("button", { name: "認証コードを送信" }).closest("form")!);
    expect(await screen.findByText("認証コードを送信しました。")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/認証コード/), { target: { value: "654321" } });
    fireEvent.submit(screen.getByRole("button", { name: "SMS認証を完了" }).closest("form")!);

    await waitFor(() => expect(getCurrentSession).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("080-1234-5678")).toBeInTheDocument();
    expect(screen.getByText("電話番号を変更しました。")).toBeInTheDocument();
    expect(verifySmsCode).toHaveBeenCalledWith({ challenge_id: accepted.challenge.id, code: "654321" }, {});
  });

  it("prevents OTP submission until all six digits are present", async () => {
    renderSms(authClient({
      getSmsVerificationStatus: vi.fn().mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.accepted)),
    }));
    const submit = await screen.findByRole("button", { name: "SMS認証を完了" });
    fireEvent.change(screen.getByLabelText(/認証コード/), { target: { value: "12345" } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/認証コード/), { target: { value: "123456" } });
    expect(submit).toBeEnabled();
  });

  afterEach(async () => {
    await act(async () => undefined);
    vi.useRealTimers();
  });
});
