import {
  ApiProblemError,
  isAuthProblemError,
  StorefrontTransportError,
} from "@oripa/storefront-client";

export interface SmsProblemPresentation {
  readonly deliveryPending: boolean;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly message: string;
  readonly phoneUnavailable: boolean;
  readonly reauthenticationRequired: boolean;
  readonly retryAfterSeconds: number | null;
  readonly sessionExpired: boolean;
}

export function presentSmsProblem(error: unknown): SmsProblemPresentation {
  if (error instanceof ApiProblemError) {
    let message = "SMS認証を完了できませんでした。時間をおいて、もう一度お試しください。";

    if (isAuthProblemError(error, "PHONE_NUMBER_UNAVAILABLE")) {
      message = "この電話番号は利用できません。別の電話番号を入力してください。";
    } else if (isAuthProblemError(error, "RATE_LIMITED")) {
      message = "しばらく時間をおいてから再度お試しください。";
    } else if (isAuthProblemError(error, "INVALID_SMS_VERIFICATION")) {
      message = "認証コードが正しくないか、有効期限または入力回数の上限に達しています。もう一度SMSを送信してください。";
    } else if (isAuthProblemError(error, "SMS_DELIVERY_PENDING")) {
      message = "認証コードを送信しています。送信完了後にもう一度お試しください。";
    } else if (isAuthProblemError(error, "SMS_DELIVERY_UNAVAILABLE")) {
      message = "認証コードを送信できませんでした。しばらくしてから再度お試しください。";
    } else if (isAuthProblemError(error, "FRESH_AUTHENTICATION_REQUIRED")) {
      message = "電話番号を変更するには、もう一度本人確認を行ってください。";
    } else if (isAuthProblemError(error, "INVALID_REAUTHENTICATION")) {
      message = "現在のパスワードを確認してください。";
    } else if (isAuthProblemError(error, "SESSION_EXPIRED") || isAuthProblemError(error, "AUTHENTICATION_REQUIRED")) {
      message = "ログインの有効期限が切れました。もう一度ログインしてください。";
    } else if (isAuthProblemError(error, "INVALID_REQUEST")) {
      message = "入力内容を確認して、もう一度お試しください。";
    } else if (isAuthProblemError(error, "PHONE_ALREADY_VERIFIED")) {
      message = "電話番号はすでにSMS認証済みです。最新の状態を確認してください。";
    } else if (isAuthProblemError(error, "CSRF_TOKEN_MISMATCH")) {
      message = "安全確認を完了できませんでした。ページを再読み込みしてお試しください。";
    } else if (isAuthProblemError(error, "AUTH_SERVICE_UNAVAILABLE")) {
      message = "現在、SMS認証を利用できません。時間をおいてお試しください。";
    }

    return {
      deliveryPending: isAuthProblemError(error, "SMS_DELIVERY_PENDING"),
      fieldErrors: error.errors ?? {},
      message,
      phoneUnavailable: isAuthProblemError(error, "PHONE_NUMBER_UNAVAILABLE"),
      reauthenticationRequired: isAuthProblemError(error, "FRESH_AUTHENTICATION_REQUIRED"),
      retryAfterSeconds: typeof error.retry_after_seconds === "number"
        ? Math.max(0, Math.ceil(error.retry_after_seconds))
        : null,
      sessionExpired: isAuthProblemError(error, "SESSION_EXPIRED") || isAuthProblemError(error, "AUTHENTICATION_REQUIRED"),
    };
  }

  return {
    deliveryPending: false,
    fieldErrors: {},
    message: error instanceof StorefrontTransportError
      ? "通信を完了できませんでした。接続を確認して、もう一度お試しください。"
      : "予期しない問題が発生しました。時間をおいて、もう一度お試しください。",
    phoneUnavailable: false,
    reauthenticationRequired: false,
    retryAfterSeconds: null,
    sessionExpired: false,
  };
}
