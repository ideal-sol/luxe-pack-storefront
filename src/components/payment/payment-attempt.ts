// Only opaque correlation. Never persist provider inputs or results.
export const PAYMENT_STATUS_CHECK_EVENT = "luxe-pack:payment-status-check";
export interface PaymentAttempt {
  productId: string;
  idempotencyKey: string;
  paymentId: string | null;
}
const prefix = "luxe-pack:payment-attempt:v1:";
const opaque = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128 && !/[\s/\\\0]/.test(value);
function storageKey(subject: string) {
  if (!opaque(subject)) throw new Error("Payment correlation unavailable");
  return `${prefix}${subject}`;
}
export function readPaymentAttempt(subject: string): PaymentAttempt | null {
  const value = window.sessionStorage.getItem(storageKey(subject));
  if (!value) return null;
  const attempt: unknown = JSON.parse(value);
  if (!attempt || typeof attempt !== "object" || Array.isArray(attempt)) throw new Error("Payment correlation unavailable");
  const a = attempt as Record<string, unknown>;
  if (Object.keys(a).sort().join(",") !== "idempotencyKey,paymentId,productId" || !opaque(a.productId) || !opaque(a.idempotencyKey) ||
      a.paymentId !== null && !opaque(a.paymentId)) throw new Error("Payment correlation unavailable");
  return a as unknown as PaymentAttempt;
}
export function beginPaymentAttempt(subject: string, attempt: PaymentAttempt) {
  if (readPaymentAttempt(subject)) throw new Error("Payment already in progress");
  window.sessionStorage.setItem(storageKey(subject), JSON.stringify(attempt));
  if (readPaymentAttempt(subject)?.idempotencyKey !== attempt.idempotencyKey) throw new Error("Payment correlation unavailable");
}
export function identifyPaymentAttempt(subject: string, key: string, paymentId: string) {
  const attempt = readPaymentAttempt(subject);
  if (attempt?.idempotencyKey !== key || !opaque(paymentId)) throw new Error("Payment correlation unavailable");
  window.sessionStorage.setItem(storageKey(subject), JSON.stringify({ ...attempt, paymentId }));
}
export function finishPaymentAttempt(subject: string, key: string) {
  if (readPaymentAttempt(subject)?.idempotencyKey === key) window.sessionStorage.removeItem(storageKey(subject));
}
