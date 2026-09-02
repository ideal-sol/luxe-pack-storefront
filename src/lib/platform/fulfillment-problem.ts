import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import { isFulfillmentProblemError } from "./prize-client";

export interface FulfillmentProblemPresentation {
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly message: string;
  readonly retryable: boolean;
  readonly smsVerificationRequired: boolean;
  readonly uncertain: boolean;
}

export function presentFulfillmentProblem(error: unknown): FulfillmentProblemPresentation {
  let message: string | null = null;

  if (isFulfillmentProblemError(error, "PRIZE_ON_PAYMENT_HOLD")) {
    message = "お支払い状況の確認中のため、この景品を操作できません。";
  } else if (isFulfillmentProblemError(error, "PRIZE_NOT_EXCHANGEABLE")) {
    message = "選択した景品はコイン交換できません。最新の景品状態を確認してください。";
  } else if (isFulfillmentProblemError(error, "PRIZE_NOT_SHIPPABLE")) {
    message = "選択した景品は発送できません。最新の景品状態を確認してください。";
  } else if (isFulfillmentProblemError(error, "INVALID_PRIZE_SELECTION")) {
    message = "景品の選択状態が更新されています。最新の景品一覧を確認してください。";
  } else if (isFulfillmentProblemError(error, "CONCURRENT_OPERATION_RETRY_EXHAUSTED")) {
    message = "景品の状態が同時に更新されました。最新の状態を確認してください。";
  } else if (isFulfillmentProblemError(error, "IDEMPOTENCY_REQUEST_IN_PROGRESS")) {
    message = "同じ操作を確認中です。少し待って、同じ操作のまま再試行してください。";
  } else if (isFulfillmentProblemError(error, "IDEMPOTENCY_KEY_REUSED")) {
    message = "この操作情報は別の処理に使用済みです。最新状態からやり直してください。";
  } else if (isFulfillmentProblemError(error, "IDEMPOTENCY_FAILURE")) {
    message = "操作結果を確認できません。同じ操作のまま再試行してください。";
  } else if (isFulfillmentProblemError(error, "INVALID_IDEMPOTENCY_KEY")) {
    message = "操作を安全に開始できませんでした。最新状態からやり直してください。";
  } else if (isFulfillmentProblemError(error, "INVALID_SHIPPING_ADDRESS")) {
    message = "お届け先の入力内容を確認してください。";
  } else if (isFulfillmentProblemError(error, "SHIPPING_ADDRESS_NOT_FOUND")) {
    message = "選択したお届け先を確認できません。お届け先一覧を更新してください。";
  } else if (isFulfillmentProblemError(error, "INVALID_SHIPPING_REQUEST")) {
    message = "発送内容を確認できません。最新の景品とお届け先を確認してください。";
  } else if (isFulfillmentProblemError(error, "AUTHENTICATION_REQUIRED") || isFulfillmentProblemError(error, "SESSION_EXPIRED")) {
    message = "セッションを確認できません。ログインしてから、もう一度お試しください。";
  } else if (isFulfillmentProblemError(error, "CSRF_TOKEN_MISMATCH")) {
    message = "安全確認を完了できませんでした。同じ操作のまま再試行してください。";
  } else if (isFulfillmentProblemError(error, "RATE_LIMITED")) {
    message = "操作回数が上限に達しました。時間をおいて再度お試しください。";
  } else if (isFulfillmentProblemError(error, "PII_PROTECTION_UNAVAILABLE")) {
    message = "お届け先情報を安全に処理できません。時間をおいて再度お試しください。";
  }

  if (error instanceof ApiProblemError) {
    return {
      fieldErrors: error.errors ?? {},
      message: message ?? "操作を完了できませんでした。最新の状態を確認して、もう一度お試しください。",
      retryable: error.retryable,
      smsVerificationRequired: isFulfillmentProblemError(error, "SMS_VERIFICATION_REQUIRED"),
      uncertain: false,
    };
  }
  if (error instanceof StorefrontTransportError) {
    return {
      fieldErrors: {},
      message: "通信結果を確認できませんでした。同じ操作のまま、もう一度お試しください。",
      retryable: true,
      smsVerificationRequired: false,
      uncertain: true,
    };
  }
  return {
    fieldErrors: {},
    message: "予期しない問題が発生しました。時間をおいて、もう一度お試しください。",
    retryable: false,
    smsVerificationRequired: false,
    uncertain: false,
  };
}
