import type { PublicComponents } from "@oripa/storefront-client";
import type { Payment, PaymentMethod } from "./payment-client";

/** UI projections of the formal integrated alpha.47 contract.
 * The canonical CSRF-managed Client is the only implementation of I/O.
 */
type Schemas = PublicComponents["schemas"];
export type UnivapayInlineForm = Schemas["PaymentUnivapayInlineForm"];
export type UnivapayInlineAction = Schemas["PaymentUnivapayInlineAction"];
export type FormPostAction = Schemas["PaymentFormPostAction"];
export type PaidyCheckoutAction = Schemas["PaymentPaidyCheckoutAction"];
// Retain unknown method/flow strings at the UI boundary so unsupported future
// responses can be rendered unavailable without starting a payment.
export type PaymentMethodOption = Omit<Schemas["PaymentMethodOption"], "method" | "flow"> & {
  method: string;
  flow: string;
};

export type UiPayment = Omit<Payment, "method" | "next_action"> & {
  method: string;
  method_label?: string;
  // Treat even typed server responses as untrusted at the action dispatcher.
  next_action: unknown;
};

export type PaymentClientEvent = Schemas["PaymentClientEvent"];

type Response<T> = Promise<{ data: T }>;
type MutationOptions = { idempotency_key: string; signal?: AbortSignal; timeout_ms?: number };

export interface PaymentUiGateway {
  listPaymentMethods(pointProductId?: string): Response<{ data: PaymentMethodOption[] }>;
  startPayment(input: { point_product_id: string; payment_method: "credit_card" | "netridecash" | "paidy" }, options: MutationOptions): Response<UiPayment>;
  getPayment(paymentId: string): Response<UiPayment>;
  reportUnivapayCharge(paymentId: string, input: { charge_id: string }, options?: { signal?: AbortSignal; timeout_ms?: number }): Response<UiPayment>;
  confirmPaidyAuthorization(paymentId: string, input: { paidy_payment_id: string }, options: MutationOptions): Response<UiPayment>;
  recordPaymentClientEvent(paymentId: string, input: PaymentClientEvent, options: { signal?: AbortSignal; timeout_ms?: number }): Response<void>;
}

export const PAYMENT_UI_UNAVAILABLE = "この決済方法は現在ご利用いただけません";
export const PAYMENT_UI_PENDING = "お支払いを確認しています。購入履歴から確認してください。";

export function isLegacyPaymentMethod(value: string): value is Extract<PaymentMethod, "credit_card" | "paypay" | "konbini" | "virtual_account"> {
  return ["credit_card", "paypay", "konbini", "virtual_account"].includes(value);
}

export function isProviderMethod(option: PaymentMethodOption | undefined) {
  return option?.method === "netridecash" || option?.method === "paidy" || option?.flow === "inline_card_form";
}

export function supportedPaymentMethod(option: PaymentMethodOption) {
  return option.method === "credit_card" ? ["card_component", "inline_card_form"].includes(option.flow)
    : option.method === "paidy" ? option.flow === "paidy_checkout"
      : ["netridecash", "paypay", "konbini", "virtual_account"].includes(option.method) && option.flow === "redirect";
}

export async function recordUiEvent(gateway: PaymentUiGateway, id: string, event: PaymentClientEvent) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Do not rely on a transport/fake honoring its timeout to unblock navigation.
    await Promise.race([
      gateway.recordPaymentClientEvent(id, event, { signal: controller.signal, timeout_ms: 350 }),
      new Promise<void>((resolve) => { timer = setTimeout(() => { controller.abort(); resolve(); }, 350); }),
    ]);
  } catch { /* Progress is advisory; never financial authority. */ }
  finally { clearTimeout(timer); }
}
