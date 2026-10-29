// Public Checkout callbacks verified against the official client/checkout.js.
// Payloads are deliberately not read: they can contain card/customer data.
export type UnivapayEvent =
  | "sdk_ready" | "update_started" | "update_complete" | "update_rejected"
  | "submit_started" | "submit_resolved" | "submit_rejected" | "submit_wait_elapsed"
  | "validation_error" | "charge_created" | "three_ds_started"
  | "three_ds_opened" | "three_ds_succeeded" | "three_ds_failed" | "closed";

export function observeUnivapay(active: () => boolean, notify?: (event: UnivapayEvent) => void) {
  const seen = new Set<UnivapayEvent>();
  const emit = (event: UnivapayEvent) => {
    if (!active() || seen.has(event)) return;
    seen.add(event);
    // Fixed event enums only. No IDs, callback arguments, exceptions or inputs.
    console.info("[UnivaPay]", event);
    notify?.(event);
  };
  return {
    emit,
    callbacks: {
      onValidationError: () => emit("validation_error"),
      onChargeCreated: () => emit("charge_created"),
      onThreeDsAuthorization: () => emit("three_ds_started"),
      onThreeDsAuthorizationModalOpened: () => emit("three_ds_opened"),
      onThreeDsAuthorizationSuccess: () => emit("three_ds_succeeded"),
      onThreeDsAuthorizationFailure: () => emit("three_ds_failed"),
      closed: () => emit("closed"),
    },
  };
}

export const UNIVAPAY_STATUS_PENDING = "お支払いの結果を確認中です。購入し直さず、決済状況を確認してください。";
export const univapayEventMessages: Partial<Record<UnivapayEvent, string>> = {
  validation_error: "入力内容に確認が必要です。カード入力欄の案内をご確認ください。購入し直さず、決済状況を確認してください。",
  charge_created: UNIVAPAY_STATUS_PENDING,
  three_ds_started: "カード会社の認証を進めてください。認証画面は閉じずにお待ちください。",
  three_ds_opened: "カード会社の認証を進めてください。認証画面は閉じずにお待ちください。",
  three_ds_succeeded: UNIVAPAY_STATUS_PENDING,
  three_ds_failed: "カード会社の認証結果を確認中です。購入し直さず、決済状況を確認してください。",
  closed: UNIVAPAY_STATUS_PENDING,
  submit_wait_elapsed: "確認に時間がかかっています。認証画面が開いている場合はそのまま続けてください。購入し直さず、完了後に決済状況を確認してください。",
  submit_rejected: "入力欄の案内をご確認ください。結果が不明のため、購入し直さず決済状況を確認してください。",
};
