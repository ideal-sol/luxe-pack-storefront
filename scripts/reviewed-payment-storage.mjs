import { createHash } from "node:crypto";

// Source-reviewed opaque Payment correlation and its two synthetic tests.
// Any byte change requires renewed review; this grants no directory exemption.
const reviewed = new Map([
  ["src/components/payment/payment-attempt.ts", "adb5879ecfb55c870d4a458f93b6f2d9dff377924bb8eccf60e4194d18cee3b6"],
  ["src/test/payment-provider-actions.test.ts", "1368d4ff26a5842da4cfa6abc9ec16f04dc9a0d4c15fffba810b6f815c568fb3"],
  ["src/test/payment-provider-ui.test.tsx", "492acc649ce72bfccf969cda35b8265bc771d70201f03bf349b7f3cf07e11f71"],
]);

export function reviewedPaymentStorage(file, content) {
  const expected = reviewed.get(file);
  return expected === undefined ? null : createHash("sha256").update(content).digest("hex") === expected;
}
