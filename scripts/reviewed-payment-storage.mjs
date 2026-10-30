import { createHash } from "node:crypto";

// Source-reviewed opaque Payment correlation and its two synthetic tests.
// Any byte change requires renewed review; this grants no directory exemption.
const reviewed = new Map([
  ["src/components/payment/payment-attempt.ts", "5b906fbbb29da37fd26e39c982164b3d7a1e68d821a1015228288a1f99d28e3a"],
  ["src/test/payment-provider-actions.test.ts", "7c3618cab4e2561d008048da8dac626f3061aa1702021eac8acabd03c96f0b76"],
  ["src/test/payment-provider-ui.test.tsx", "318c340d2b2e633561ed179adcf7670ce8d80ce2019a5a5594e132e6c099d090"],
]);

export function reviewedPaymentStorage(file, content) {
  const expected = reviewed.get(file);
  return expected === undefined ? null : createHash("sha256").update(content).digest("hex") === expected;
}
