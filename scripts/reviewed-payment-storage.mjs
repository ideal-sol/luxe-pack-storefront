import { createHash } from "node:crypto";

// Source-reviewed opaque Payment correlation and its two synthetic tests.
// Any byte change requires renewed review; this grants no directory exemption.
const reviewed = new Map([
  ["src/components/payment/payment-attempt.ts", "adb5879ecfb55c870d4a458f93b6f2d9dff377924bb8eccf60e4194d18cee3b6"],
  ["src/test/payment-provider-actions.test.ts", "7c3618cab4e2561d008048da8dac626f3061aa1702021eac8acabd03c96f0b76"],
  ["src/test/payment-provider-ui.test.tsx", "87aa58bafbef3d8bd9c9e3513b791cc90e31018e8d26123c6f136689c510adaf"],
]);

export function reviewedPaymentStorage(file, content) {
  const expected = reviewed.get(file);
  return expected === undefined ? null : createHash("sha256").update(content).digest("hex") === expected;
}
