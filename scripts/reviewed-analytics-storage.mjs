import { createHash } from "node:crypto";

// Human-authorized non-authentication markers, pinned to entire reviewed bytes.
// Any helper/test edit needs renewed review. No directory-wide storage exemption.
const reviewed = new Map([
  ["src/lib/analytics/gtm.ts", "4954f8c5118a6a3cfec98295b4dad5fa726cb4f94682d75ae07d23df65b00fc2"],
  ["src/test/analytics-gtm.test.tsx", "31e196e2a9240d492fa1e53a3e7587971fc3ff7a9b121ffde839eee815a1937e"],
  ["src/test/sms-verification-ui.test.tsx", "957f87910a829b487f08bac4885e26863b6e94906d83aec0108c5dc4ad958353"],
]);

export function reviewedAnalyticsStorage(file, content) {
  const digest = reviewed.get(file);
  return digest === undefined ? null : createHash("sha256").update(content).digest("hex") === digest;
}
