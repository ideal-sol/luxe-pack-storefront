import type { Payment, PaymentMethod } from "./payment-client";

/** Source-only contract intersection, checked against PAY2/PAY3/PAY4 Draft heads.
 * Not an alpha.47 artifact. Only the future canonical Client may implement I/O.
 */
export interface UnivapayInlineForm {
  provider: "univapay";
  script_url: "https://widget.univapay.com/client/checkout.js";
  options: {
    appId: string; checkout: "payment"; amount: number; currency: "jpy";
    tokenType: "one_time"; capture: true; inline: true; locale: "ja";
    email: string; showCvv: true;
  };
}

export interface PaymentMethodOption {
  method: string;
  label: string;
  available: boolean;
  unavailable_reason: null | "provider_unavailable" | "amount_too_large";
  saved_cards_enabled: boolean;
  flow: string;
  inline_form?: UnivapayInlineForm | null;
}

export interface UnivapayInlineAction {
  type: "univapay_inline";
  amount: number;
  update: {
    metadata: { "oripa-payment-id": string; "oripa-member": string };
    email: string;
    phoneNumber?: { countryCode: "+81"; localNumber: string };
  };
  success_url: string;
}

export interface FormPostAction {
  type: "form_post";
  url: string;
  fields: { name: string; value: string }[];
}

export interface PaidyCheckoutAction {
  type: "paidy_checkout";
  script_url: "https://apps.paidy.com/";
  public_key: string;
  payload: {
    amount: number; currency: "JPY"; store_name: string; description: "コイン購入";
    buyer: { email: string; phone: string; name1?: string };
    buyer_data: {
      user_id: string; age: number; ltv: number; order_count: number;
      last_order_amount?: number; last_order_at?: number;
      order_count_last3months: number; order_amount_last3months: number; number_of_points: number;
    };
    order: {
      order_ref: string; shipping: 0; tax: 0;
      items: { id: string; title: string; quantity: 1; unit_price: number }[];
    };
  };
}

export type UiPayment = Omit<Payment, "method" | "next_action"> & {
  method: string;
  method_label?: string;
  // Treat even typed server responses as untrusted at the action dispatcher.
  next_action: unknown;
};

export interface PaymentClientEvent {
  type: "redirect_started" | "inline_submitted" | "inline_result" | "paidy_checkout_opened" | "paidy_checkout_result" | "returned";
  detail?: {
    result?: "success" | "error" | "authorized" | "rejected" | "closed" | "complete" | "cancel" | "failure";
    charge_id?: string;
  };
}

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

export function isLegacyPaymentMethod(value: string): value is PaymentMethod {
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

/** Deliberately only for the pinned alpha.46 Client lacking listPaymentMethods. */
export const ALPHA46_PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { method: "credit_card", label: "クレジットカード", flow: "card_component", saved_cards_enabled: true, available: true, unavailable_reason: null },
  { method: "paypay", label: "PayPay", flow: "redirect", saved_cards_enabled: false, available: true, unavailable_reason: null },
  { method: "konbini", label: "コンビニ決済", flow: "redirect", saved_cards_enabled: false, available: true, unavailable_reason: null },
  { method: "virtual_account", label: "銀行振込", flow: "redirect", saved_cards_enabled: false, available: true, unavailable_reason: null },
];

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
