import {
  ApiProblemError,
  isCardRegistrationProblemError,
  StorefrontTransportError,
} from "@oripa/storefront-client";
import type { PaymentMethod } from "./payment-client";

const KONBINI_UNPAID_LIMIT_CODE = "KONBINI_UNPAID_LIMIT_REACHED";
const KONBINI_UNPAID_LIMIT_MESSAGE = "コンビニ決済の未払いがあるため、コンビニ決済を使用できません";

export interface PaymentProblemPresentation {
  readonly message: string;
  readonly retryAfterSeconds: number | undefined;
  readonly sessionExpired: boolean;
}

export function paymentRetryAfterSeconds(error: unknown) {
  if (error instanceof ApiProblemError && error.status === 429) {
    return error.retry_after_seconds;
  }
  if (error instanceof StorefrontTransportError && error.metadata?.status === 429) {
    return error.metadata.retry_after_seconds;
  }
  return undefined;
}

export function isInvalidPaymentRead(error: unknown) {
  return error instanceof ApiProblemError && [401, 403, 404].includes(error.status);
}

export function isUncertainCardRegistrationProblem(error: unknown) {
  return error instanceof StorefrontTransportError ||
    isCardRegistrationProblemError(error, "CARD_REGISTRATION_UNAVAILABLE") ||
    isCardRegistrationProblemError(error, "CARD_REGISTRATION_CONFLICT");
}

export function isDefinitiveCardRegistrationProblem(error: unknown) {
  return isCardRegistrationProblemError(error) && !isUncertainCardRegistrationProblem(error);
}

export function presentCardRegistrationProblem(error: unknown): PaymentProblemPresentation {
  if (isUncertainCardRegistrationProblem(error)) {
    return {
      message: "通信結果を確認できませんでした。同じ操作を繰り返さず、時間をおいて状態をご確認ください。",
      retryAfterSeconds: paymentRetryAfterSeconds(error),
      sessionExpired: false,
    };
  }
  if (isCardRegistrationProblemError(error)) {
    return {
      message: error.status === 429
        ? "アクセスが集中しています。時間をおいて、もう一度お試しください。"
        : "エラーが発生しました。時間をおいて、もう一度お試しください。",
      retryAfterSeconds: paymentRetryAfterSeconds(error),
      sessionExpired: error.status === 401 || error.code === "AUTHENTICATION_REQUIRED",
    };
  }
  return presentPaymentProblem(error);
}

export function presentPaymentProblem(error: unknown, paymentMethod?: PaymentMethod): PaymentProblemPresentation {
  if (error instanceof ApiProblemError) {
    return {
      message: paymentMethod === "konbini" && error.code === KONBINI_UNPAID_LIMIT_CODE
        ? KONBINI_UNPAID_LIMIT_MESSAGE
        : error.status === 429
        ? "アクセスが集中しています。時間をおいて、もう一度お試しください。"
        : "決済処理を完了できませんでした。時間をおいて、もう一度お試しください。",
      retryAfterSeconds: paymentRetryAfterSeconds(error),
      sessionExpired: error.status === 401 || error.code === "SESSION_EXPIRED",
    };
  }
  if (error instanceof StorefrontTransportError) {
    return {
      message: "通信結果を確認できませんでした。同じ操作を繰り返さず、時間をおいて状態をご確認ください。",
      retryAfterSeconds: paymentRetryAfterSeconds(error),
      sessionExpired: false,
    };
  }
  return {
    message: "エラーが発生しました。時間をおいて、もう一度お試しください。",
    retryAfterSeconds: undefined,
    sessionExpired: false,
  };
}
