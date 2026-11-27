import { createHash } from "node:crypto";

// Source-reviewed opaque Payment correlation and its two synthetic tests.
// Any byte change requires renewed review; this grants no directory exemption.
const reviewed = new Map([
  ["src/components/payment/payment-attempt.ts", "ec7702bc1291ae9cf853b318bbf28bdb3bb78c6d9aea4bca1057d083bdc6d938"],
  ["src/test/payment-provider-actions.test.ts", "b07a0873695f60b006c7ae570d9d8b863b0885caf9605aa753024aeec39c1639"],
  ["src/test/payment-provider-ui.test.tsx", "628b052fb0ff8c9f64ab4f0d1c16d5971c390c52b3bfdb900f15c38bbb10388d"],
]);

export function reviewedPaymentStorage(file, content) {
  const expected = reviewed.get(file);
  return expected === undefined ? null : createHash("sha256").update(content).digest("hex") === expected;
}
