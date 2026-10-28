import { createHash } from "node:crypto";

// Source-reviewed opaque Payment correlation and its two synthetic tests.
// Any byte change requires renewed review; this grants no directory exemption.
const reviewed = new Map([
  ["src/components/payment/payment-attempt.ts", "5b447477003dc7d4e0188cb6d1ce09f64171ea429639b46910ec234f632fbaea"],
  ["src/test/payment-provider-actions.test.ts", "7c3618cab4e2561d008048da8dac626f3061aa1702021eac8acabd03c96f0b76"],
  ["src/test/payment-provider-ui.test.tsx", "db7a8afa0d0d155ca55150131aeb2dea90fb2879157f1ed1f91af5410af16f5b"],
]);

export function reviewedPaymentStorage(file, content) {
  const expected = reviewed.get(file);
  return expected === undefined ? null : createHash("sha256").update(content).digest("hex") === expected;
}
