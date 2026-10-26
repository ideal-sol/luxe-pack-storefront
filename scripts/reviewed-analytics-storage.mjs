import { createHash } from "node:crypto";

// Human-authorized non-authentication markers, pinned to entire reviewed bytes.
// Any helper/test edit needs renewed review. No directory-wide storage exemption.
const reviewed = new Map([
  ["src/lib/analytics/gtm.ts", "f8f9beb8da3cbb8d07c28cf7ac087da3d4ff6bf94a4e4d55645155075b5bfa09"],
  ["src/test/analytics-gtm.test.tsx", "a087a14e353018fd36babcc86c51becf3fc1d2a7da843d9b3aecdbd421f4b8e6"],
  ["src/test/sms-verification-ui.test.tsx", "33ee28a8a6e06d910a99f32548a0f36419cf2466a24bb12bc633bb5bc7a145fe"],
]);

export function reviewedAnalyticsStorage(file, content) {
  const digest = reviewed.get(file);
  return digest === undefined ? null : createHash("sha256").update(content).digest("hex") === digest;
}
