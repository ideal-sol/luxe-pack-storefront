import { dispatchProviderAction, safePaymentRedirect, validateFormPost, validateInlineForm } from "@/components/payment/provider-payment-actions";
import { beginPaymentAttempt, finishPaymentAttempt, identifyPaymentAttempt, readPaymentAttempt } from "@/components/payment/payment-attempt";
import type { UiPayment, UnivapayInlineForm } from "@/lib/platform/payment-ui-gateway";
import { paidyV23Action } from "./fixtures/paidy-v23";
import { PAYMENT_FOUNDATION_FIXTURES } from "@oripa/storefront-testkit";

it("accepts the unmodified formal alpha.51 first-purchase fixture", () => {
  const action = structuredClone(PAYMENT_FOUNDATION_FIXTURES.paidy_checkout);
  const result = dispatchProviderAction({ id: action.payload.order.order_ref, method: "paidy",
    amount: { amount: action.payload.amount, currency: "JPY" }, next_action: action } as UiPayment, "paidy_checkout");
  expect(result.type).toBe("paidy_checkout");
  if (result.type !== "paidy_checkout") throw new Error("wrong action");
  expect(result.action.payload).toBe(action.payload);
  expect(action.payload.buyer_data).not.toHaveProperty("last_order_at");
  expect(action.payload.buyer_data).not.toHaveProperty("last_order_amount");
});

function dispatchPaidy(action = paidyV23Action()) {
  return dispatchProviderAction({ id: action.payload.order.order_ref, method: "paidy", amount: { amount: 1000, currency: "JPY" }, next_action: action } as UiPayment, "paidy_checkout");
}
it("accepts all five v2.3 fields without changing the action or payload", () => {
  const action = paidyV23Action(); const original = structuredClone(action);
  const result = dispatchPaidy(action);
  expect(result.type).toBe("paidy_checkout");
  if (result.type !== "paidy_checkout") throw new Error("wrong action");
  expect(result.action).toBe(action);
  expect(result.action.payload).toBe(action.payload);
  expect(action).toEqual(original);
});
it("accepts omitted optional fields and first-purchase history", () => {
  const action = paidyV23Action();
  const buyer: Record<string, unknown> = action.payload.buyer_data;
  for (const key of ["delivery_locn_type", "days_since_first_transaction", "order_item_categories"]) delete buyer[key];
  buyer.previous_payment_methods = { credit_card_used: false };
  expect(dispatchPaidy(action).type).toBe("paidy_checkout");
});
it("accepts repeat history, leap dates and every defined payment flag", () => {
  const action = paidyV23Action();
  Object.assign(action.payload.buyer_data, { account_registration_date: "2024-02-29", last_order_at: 0, last_order_amount: 1000, days_since_first_transaction: 10,
    previous_payment_methods: { credit_card_used: true, convenience_store_prepayment_used: true, bank_transfer_used: true } });
  expect(dispatchPaidy(action).type).toBe("paidy_checkout");
});
it.each([
  ["account_registration_date", undefined], ["account_registration_date", null], ["account_registration_date", 20261106],
  ["account_registration_date", "2026-2-01"], ["account_registration_date", "2026-02-29"], ["account_registration_date", "1900-02-29"],
  ["account_registration_date", "2026-04-31"], ["account_registration_date", "2026-00-01"], ["account_registration_date", "2026-13-01"],
  ["account_registration_date", "2026-01-00"], ["account_registration_date", "0000-01-01"],
  ["account_registration_date", "2026-11-06T00:00:00Z"],
  ["previous_payment_methods", undefined], ["previous_payment_methods", null], ["previous_payment_methods", []],
  ["previous_payment_methods", {}], ["previous_payment_methods", { credit_card_used: "false" }],
  ["previous_payment_methods", { credit_card_used: false, bank_transfer_used: 0 }],
  ["previous_payment_methods", { credit_card_used: false, convenience_store_prepayment_used: null }],
  ["previous_payment_methods", { credit_card_used: false, unknown: true }],
  ["delivery_locn_type", ""], ["delivery_locn_type", null], ["delivery_locn_type", 1], ["delivery_locn_type", undefined],
  ["days_since_first_transaction", -1], ["days_since_first_transaction", 0.5], ["days_since_first_transaction", "0"],
  ["days_since_first_transaction", null], ["days_since_first_transaction", Number.MAX_SAFE_INTEGER + 1],
  ["order_item_categories", []], ["order_item_categories", [""]], ["order_item_categories", ["コイン", 1]],
  ["order_item_categories", "コイン"], ["order_item_categories", null],
  ["unknown", true], ["user_id", ""], ["age", -1], ["ltv", 1.5], ["order_count", "0"],
  ["order_count_last3months", -1], ["order_amount_last3months", null], ["number_of_points", -1],
  ["last_order_at", -1], ["last_order_amount", "1000"],
])("rejects malformed or unknown buyer_data %s=%j", (key, value) => {
  const action = paidyV23Action();
  Object.assign(action.payload.buyer_data, { [key as string]: value });
  expect(() => dispatchPaidy(action)).toThrow();
});
it.each(["account_registration_date", "previous_payment_methods", "age", "ltv", "order_count", "order_count_last3months", "order_amount_last3months", "number_of_points", "user_id"])("rejects missing required buyer field %s", key => {
  const action = paidyV23Action();
  delete (action.payload.buyer_data as Record<string, unknown>)[key];
  expect(() => dispatchPaidy(action)).toThrow();
});
it.each(["amount", "order_ref", "unit_price", "quantity", "extra"])("retains strict amount/order/item validation for %s", key => {
  const action = paidyV23Action();
  if (key === "amount") action.payload.amount = 2000;
  else if (key === "order_ref") action.payload.order.order_ref = "wrong-order";
  else Object.assign(action.payload.order.items[0]!, { [key]: key === "extra" ? true : 2 });
  expect(() => dispatchProviderAction({ id: "00000000-0000-4000-8000-000000000002", method: "paidy", amount: { amount: 1000, currency: "JPY" }, next_action: action } as UiPayment, "paidy_checkout")).toThrow();
});

const form = { type: "form_post", url: "https://secure.tc-site.com/access", fields: ["clientip", "payment_code", "cookie", "price", "sendid", "email"].map(name => ({ name, value: "fixture" })) };
it.each([
  { ...form, url: "http://secure.tc-site.com/access" },
  { ...form, url: "https://secure.tc-site.com/access?redirect=evil" },
  { ...form, url: "https://secure.tc-site.com.evil.test/access" },
  { ...form, fields: form.fields.slice(1) },
  { ...form, fields: [...form.fields, { name: "extra", value: "x" }] },
  { ...form, fields: form.fields.map((f, i) => i === 1 ? { ...f, name: "clientip" } : f) },
  { ...form, fields: form.fields.map((f, i) => i === 0 ? { ...f, value: ["bad"] } : f) },
  { ...form, fields: [...form.fields].reverse() },
])("rejects malformed/duplicate/unknown POST fields and destinations (%j)", value => {
  expect(() => validateFormPost(value)).toThrow("この決済方法は現在ご利用いただけません");
});
it.each([null, {}, { type: "unknown", url: "https://example.test" }, { type: "redirect", url: "javascript:alert(1)" }, { type: "fincode_card_component" }])("fails closed for unexpected new-provider actions %j", action => {
  const payment = { method: "netridecash", next_action: action } as UiPayment;
  expect(() => dispatchProviderAction(payment, "redirect")).toThrow();
});
it.each(["javascript:alert(1)", "//evil.test", "https://user:pass@example.test/x", "https://example.test:444", "https://example.test/\\evil"])("rejects unsafe legacy redirects %s", url => {
  expect(() => safePaymentRedirect(url)).toThrow();
});
const inline: UnivapayInlineForm = { provider: "univapay", script_url: "https://widget.univapay.com/client/checkout.js", options: { appId: "fixture", checkout: "payment", amount: 1000, currency: "jpy", tokenType: "one_time", capture: true, inline: true, locale: "ja", email: "member@example.test", showCvv: true } };
it.each([
  { ...inline, script_url: "https://evil.test/client/checkout.js" },
  { ...inline, options: { ...inline.options, tokenType: "recurring" } },
  { ...inline, options: { ...inline.options, secret: "fixture-not-a-secret" } },
  { ...inline, options: { ...inline.options, univapayCustomerId: "fixture" } },
  { ...inline, options: { ...inline.options, amount: 1.1 } },
  { ...inline, options: { ...inline.options, capture: false } },
])("rejects inline protection skew %j", value => {
  expect(() => validateInlineForm(value as UnivapayInlineForm)).toThrow();
});
it("keeps opaque attempts scoped by member and immutable until explicit resolution", () => {
  window.sessionStorage.clear();
  beginPaymentAttempt("member-a", { productId: "product-a", idempotencyKey: "key-a", paymentId: null });
  expect(() => beginPaymentAttempt("member-a", { productId: "product-b", idempotencyKey: "key-b", paymentId: null })).toThrow();
  expect(readPaymentAttempt("member-b")).toBeNull();
  identifyPaymentAttempt("member-a", "key-a", "payment-a");
  finishPaymentAttempt("member-a", "wrong-key");
  expect(readPaymentAttempt("member-a")?.paymentId).toBe("payment-a");
  finishPaymentAttempt("member-a", "key-a");
  expect(readPaymentAttempt("member-a")).toBeNull();
});
it("rejects corrupt or extended opaque correlations", () => {
  window.sessionStorage.setItem("luxe-pack:payment-attempt:v1:member-a", JSON.stringify({ productId: "product", idempotencyKey: "key", paymentId: null, payload: "sensitive" }));
  expect(() => readPaymentAttempt("member-a")).toThrow();
  window.sessionStorage.clear();
});
