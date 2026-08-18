import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import { isDrawProblemError } from "./draw-client";

export interface DrawProblemPresentation {
  readonly message: string;
  readonly retryable: boolean;
}

export function presentDrawProblem(error: unknown): DrawProblemPresentation {
  let message: string | null = null;

  if (isDrawProblemError(error, "INSUFFICIENT_POINTS")) {
    message = "コインが不足しているため抽選できません。";
  } else if (isDrawProblemError(error, "AUTHENTICATION_REQUIRED")) {
    message = "セッションを確認できません。ログインしてから、もう一度お試しください。";
  } else if (isDrawProblemError(error, "DAILY_DRAW_LIMIT_EXCEEDED")) {
    message = "本日の抽選上限に達しています。";
  } else if (isDrawProblemError(error, "GACHA_AUDIENCE_NOT_ELIGIBLE")) {
    message = "このガチャの対象条件を満たしていません。";
  } else if (isDrawProblemError(error, "GACHA_NOT_DRAWABLE")) {
    message = "このガチャは現在抽選できません。";
  } else if (isDrawProblemError(error, "GACHA_SALES_PAUSED")) {
    message = "このガチャは現在販売を停止しています。";
  } else if (isDrawProblemError(error, "DRAW_COUNT_INSUFFICIENT")) {
    message = "選択した回数では抽選できません。最新の抽選条件を確認してください。";
  } else if (isDrawProblemError(error, "INVALID_DRAW_REQUEST")) {
    message = "抽選内容を確認できませんでした。最新の抽選条件を確認してください。";
  } else if (isDrawProblemError(error, "IDEMPOTENCY_KEY_REUSED")) {
    message = "この操作は別の抽選に使用済みです。画面を更新してやり直してください。";
  } else if (isDrawProblemError(error, "IDEMPOTENCY_REQUEST_IN_PROGRESS")) {
    message = "抽選処理を確認しています。同じ操作のまま、少し待って再試行してください。";
  } else if (isDrawProblemError(error, "CSRF_TOKEN_MISMATCH")) {
    message = "安全確認を完了できませんでした。同じ操作のまま、もう一度お試しください。";
  } else if (isDrawProblemError(error, "RATE_LIMITED")) {
    message = "操作回数が上限に達しました。時間をおいて再度お試しください。";
  }

  if (message && error instanceof ApiProblemError) {
    return { message, retryable: error.retryable };
  }
  if (error instanceof ApiProblemError) {
    return {
      message: "抽選を完了できませんでした。時間をおいて、もう一度お試しください。",
      retryable: error.retryable,
    };
  }
  if (error instanceof StorefrontTransportError) {
    return {
      message: "通信結果を確認できませんでした。同じ操作のまま、もう一度お試しください。",
      retryable: true,
    };
  }
  return {
    message: "予期しない問題が発生しました。時間をおいて、もう一度お試しください。",
    retryable: false,
  };
}
