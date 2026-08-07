import {
  ApiProblemError,
  isAuthProblemError,
  StorefrontTransportError,
} from "@oripa/storefront-client";

export interface AuthProblemPresentation {
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly message: string;
  readonly sessionExpired: boolean;
}

export type PlatformProblemPresentation = AuthProblemPresentation;

export function isPlatformNotFound(error: unknown) {
  return error instanceof ApiProblemError && error.status === 404;
}

export function presentPlatformProblem(error: unknown): PlatformProblemPresentation {
  if (error instanceof ApiProblemError) {
    return {
      fieldErrors: error.errors ?? {},
      message: error.status === 429
        ? "アクセスが集中しています。時間をおいて、もう一度お試しください。"
        : "情報を取得できませんでした。時間をおいて、もう一度お試しください。",
      sessionExpired: isAuthProblemError(error, "SESSION_EXPIRED"),
    };
  }
  if (error instanceof StorefrontTransportError) {
    return {
      fieldErrors: {},
      message: "通信を完了できませんでした。接続を確認して、もう一度お試しください。",
      sessionExpired: false,
    };
  }
  return {
    fieldErrors: {},
    message: "予期しない問題が発生しました。時間をおいて、もう一度お試しください。",
    sessionExpired: false,
  };
}

export function presentAuthProblem(error: unknown): AuthProblemPresentation {
  if (error instanceof ApiProblemError) {
    let message = "処理を完了できませんでした。入力内容を確認して、もう一度お試しください。";

    if (isAuthProblemError(error, "INVALID_CREDENTIALS")) {
      message = "メールアドレスまたはパスワードを確認してください。";
    } else if (isAuthProblemError(error, "EMAIL_VERIFICATION_REQUIRED")) {
      message = "メールアドレスの認証を完了してください。";
    } else if (isAuthProblemError(error, "EMAIL_ALREADY_CLAIMED")) {
      message = "このメールアドレスでは登録できません。";
    } else if (isAuthProblemError(error, "INVALID_VERIFICATION_LINK")) {
      message = "認証リンクが無効です。認証メールを再送してください。";
    } else if (isAuthProblemError(error, "VERIFICATION_LINK_EXPIRED")) {
      message = "認証リンクの有効期限が切れています。認証メールを再送してください。";
    } else if (isAuthProblemError(error, "RATE_LIMITED")) {
      message = "操作回数が上限に達しました。時間をおいて再度お試しください。";
    } else if (isAuthProblemError(error, "CSRF_TOKEN_MISMATCH")) {
      message = "安全確認を完了できませんでした。ページを再読み込みしてお試しください。";
    } else if (isAuthProblemError(error, "AUTH_SERVICE_UNAVAILABLE")) {
      message = "現在、認証サービスを利用できません。時間をおいてお試しください。";
    }

    return {
      fieldErrors: error.errors ?? {},
      message,
      sessionExpired: isAuthProblemError(error, "SESSION_EXPIRED"),
    };
  }

  if (error instanceof StorefrontTransportError) {
    return {
      fieldErrors: {},
      message: "通信を完了できませんでした。接続を確認して、もう一度お試しください。",
      sessionExpired: false,
    };
  }

  return {
    fieldErrors: {},
    message: "予期しない問題が発生しました。時間をおいて、もう一度お試しください。",
    sessionExpired: false,
  };
}
