import { dispatchProviderAction, safePaymentRedirect, validateFormPost, validateInlineForm } from "@/components/payment/provider-payment-actions";
import { beginPaymentAttempt, finishPaymentAttempt, identifyPaymentAttempt, readPaymentAttempt } from "@/components/payment/payment-attempt";
import type { UiPayment, UnivapayInlineForm } from "@/lib/platform/payment-ui-gateway";

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
