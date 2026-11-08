import {
  PAYMENT_UI_UNAVAILABLE,
  type FormPostAction,
  type PaidyCheckoutAction,
  type UiPayment,
  type UnivapayInlineAction,
  type UnivapayInlineForm,
} from "@/lib/platform/payment-ui-gateway";

export const UNIVAPAY_SCRIPT = "https://widget.univapay.com/client/checkout.js";
export const PAIDY_SCRIPT = "https://apps.paidy.com/";
export const TECHCOIN_POST = "https://secure.tc-site.com/access";
const fieldNames = ["clientip", "payment_code", "cookie", "price", "sendid", "email"];
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const only = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));
const calendarDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const fail = (): never => { throw new Error(PAYMENT_UI_UNAVAILABLE); };

export function validateInlineForm(value: UnivapayInlineForm) {
  if (!object(value) || value.provider !== "univapay" || value.script_url !== UNIVAPAY_SCRIPT ||
      !only(value, ["provider", "script_url", "options"]) || !object(value.options)) return fail();
  const o = value.options;
  if (!only(o, ["appId", "checkout", "amount", "currency", "tokenType", "capture", "inline", "locale", "email", "showCvv"]) ||
      !text(o.appId) || o.checkout !== "payment" || !positive(o.amount) || o.amount > 100_000 || o.currency !== "jpy" ||
      o.tokenType !== "one_time" || o.capture !== true || o.inline !== true || o.locale !== "ja" || !text(o.email) || o.showCvv !== true) return fail();
  return value;
}

export function paymentThanksRoute(id: string) {
  if (!id || id.length > 128 || /[\s/\\\0]/.test(id)) return fail();
  return `/points/purchase/thanks?pid=${encodeURIComponent(id)}`;
}

export function validateFormPost(action: unknown): FormPostAction {
  if (!object(action) || action.type !== "form_post" || action.url !== TECHCOIN_POST ||
      !only(action, ["type", "url", "fields"]) || !Array.isArray(action.fields) || action.fields.length !== 6) return fail();
  action.fields.forEach((field, index) => {
    if (!object(field) || !only(field, ["name", "value"]) || field.name !== fieldNames[index] ||
        typeof field.value !== "string" || field.value.length > 4096) return fail();
  });
  return action as unknown as FormPostAction;
}

export function postProviderForm(action: FormPostAction) {
  validateFormPost(action);
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action.url;
  form.target = "_self";
  form.hidden = true;
  for (const field of action.fields) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = field.name;
    input.value = field.value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  try { HTMLFormElement.prototype.submit.call(form); }
  finally { form.remove(); }
}

export function validateInlineAction(action: unknown, payment: UiPayment): UnivapayInlineAction {
  if (!object(action) || action.type !== "univapay_inline" || !positive(action.amount) ||
      !only(action, ["type", "amount", "update", "success_url"]) || !text(action.success_url) || !object(action.update)) return fail();
  const u = action.update;
  if (!only(u, ["metadata", "email", "phoneNumber"]) || !text(u.email) || !object(u.metadata) ||
      !only(u.metadata, ["oripa-payment-id", "oripa-member"]) || u.metadata["oripa-payment-id"] !== payment.id || !text(u.metadata["oripa-member"])) return fail();
  if (u.phoneNumber !== undefined && (!object(u.phoneNumber) || !only(u.phoneNumber, ["countryCode", "localNumber"]) ||
      u.phoneNumber.countryCode !== "+81" || typeof u.phoneNumber.localNumber !== "string" || !/^0[0-9]{9,10}$/.test(u.phoneNumber.localNumber))) return fail();
  let success: URL;
  try { success = new URL(action.success_url); } catch { return fail(); }
  if (success.origin !== window.location.origin || success.pathname !== "/points/purchase/thanks" || success.hash ||
      success.username || success.password || success.searchParams.get("pid") !== payment.id || [...success.searchParams].length !== 1) return fail();
  return action as unknown as UnivapayInlineAction;
}

export function validatePaidyAction(action: unknown, payment: UiPayment): PaidyCheckoutAction {
  if (!object(action) || action.type !== "paidy_checkout" || action.script_url !== PAIDY_SCRIPT ||
      !only(action, ["type", "script_url", "public_key", "payload"]) || typeof action.public_key !== "string" ||
      !/^pk_[A-Za-z0-9_-]+$/.test(action.public_key) || !object(action.payload)) return fail();
  const p = action.payload;
  if (!only(p, ["amount", "currency", "store_name", "description", "buyer", "buyer_data", "order"]) ||
      !positive(p.amount) || p.amount !== payment.amount.amount || p.currency !== "JPY" || !text(p.store_name) || p.description !== "コイン購入" ||
      !object(p.buyer) || !only(p.buyer, ["email", "phone", "name1"]) || !text(p.buyer.email) ||
      typeof p.buyer.phone !== "string" || !/^0[789]0[0-9]{8}$/.test(p.buyer.phone) ||
      p.buyer.name1 !== undefined && !text(p.buyer.name1) || !object(p.buyer_data) || !object(p.order)) return fail();
  const b = p.buyer_data;
  const required = ["age", "ltv", "order_count", "order_count_last3months", "order_amount_last3months", "number_of_points"];
  if (!text(b.user_id) || !only(b, ["user_id", ...required, "last_order_amount", "last_order_at", "account_registration_date", "delivery_locn_type", "days_since_first_transaction", "previous_payment_methods", "order_item_categories"]) ||
      required.some(key => !Number.isSafeInteger(b[key]) || Number(b[key]) < 0) ||
      ["last_order_amount", "last_order_at"].some(key => b[key] !== undefined && (!Number.isSafeInteger(b[key]) || Number(b[key]) < 0))) return fail();
  // Published Public alpha.47 / Client alpha.51 contract; keep runtime payload validation.
  if (!calendarDate(b.account_registration_date) || !object(b.previous_payment_methods)) return fail();
  const methods = b.previous_payment_methods;
  if (!only(methods, ["credit_card_used", "convenience_store_prepayment_used", "bank_transfer_used"]) ||
      typeof methods.credit_card_used !== "boolean" ||
      ["convenience_store_prepayment_used", "bank_transfer_used"].some(key => key in methods && typeof methods[key] !== "boolean") ||
      "delivery_locn_type" in b && !text(b.delivery_locn_type) ||
      "days_since_first_transaction" in b && (!Number.isSafeInteger(b.days_since_first_transaction) || Number(b.days_since_first_transaction) < 0) ||
      "order_item_categories" in b && (!Array.isArray(b.order_item_categories) || b.order_item_categories.length === 0 || !b.order_item_categories.every(text))) return fail();
  const o = p.order;
  if (!only(o, ["items", "order_ref", "shipping", "tax"]) || o.order_ref !== payment.id || o.shipping !== 0 || o.tax !== 0 ||
      !Array.isArray(o.items) || o.items.length !== 1) return fail();
  const item = o.items[0];
  if (!object(item) || !only(item, ["id", "title", "quantity", "unit_price"]) || !text(item.id) || !text(item.title) ||
      item.quantity !== 1 || item.unit_price !== p.amount) return fail();
  return action as unknown as PaidyCheckoutAction;
}

export type ProviderAction =
  | { type: "form_post"; action: FormPostAction }
  | { type: "univapay_inline"; action: UnivapayInlineAction }
  | { type: "paidy_checkout"; action: PaidyCheckoutAction }
  | { type: "redirect"; url: string };

export function dispatchProviderAction(payment: UiPayment, flow: string): ProviderAction {
  const action = payment.next_action;
  if (!object(action)) return fail();
  switch (action.type) {
    case "form_post":
      if (payment.method !== "netridecash" || flow !== "redirect") return fail();
      return { type: "form_post", action: validateFormPost(action) };
    case "univapay_inline":
      if (payment.method !== "credit_card" || flow !== "inline_card_form") return fail();
      return { type: "univapay_inline", action: validateInlineAction(action, payment) };
    case "paidy_checkout":
      if (payment.method !== "paidy" || flow !== "paidy_checkout") return fail();
      return { type: "paidy_checkout", action: validatePaidyAction(action, payment) };
    // Only the existing fincode redirect methods have an approved GET flow.
    case "redirect":
    case "three_d_secure":
      if (!["credit_card", "paypay"].includes(payment.method) || flow === "inline_card_form" || !text(action.url)) return fail();
      return { type: "redirect", url: safePaymentRedirect(action.url) };
    default: return fail();
  }
}

export function safePaymentRedirect(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { return fail(); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || /[\s\\]/.test(value)) return fail();
  return value;
}
