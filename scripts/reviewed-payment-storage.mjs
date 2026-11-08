import { createHash } from "node:crypto";

// Source-reviewed opaque Payment correlation and its two synthetic tests.
// Any byte change requires renewed review; this grants no directory exemption.
const reviewed = new Map([
  ["src/components/payment/payment-attempt.ts", "adb5879ecfb55c870d4a458f93b6f2d9dff377924bb8eccf60e4194d18cee3b6"],
  ["src/test/payment-provider-actions.test.ts", "b07a0873695f60b006c7ae570d9d8b863b0885caf9605aa753024aeec39c1639"],
  ["src/test/payment-provider-ui.test.tsx", "88720c979d0e1364ff54400de36a15773b347edde71fe42de9bd5634612020c8"],
]);

export function reviewedPaymentStorage(file, content) {
  const expected = reviewed.get(file);
  return expected === undefined ? null : createHash("sha256").update(content).digest("hex") === expected;
}
