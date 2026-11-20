import { createHash } from "node:crypto";

// Human-authorized non-authentication markers, pinned to entire reviewed bytes.
// Any helper/test edit needs renewed review. No directory-wide storage exemption.
const reviewed = new Map([
  ["src/test/purchase-reliability.test.tsx", "70c496d2a8a43fe7b31352e188d0bf3c071c9530511b9fe054d36e176cb8cf70"],
  ["src/lib/analytics/purchase-recovery.ts", "78e4adda210edbd18e0ef657cd416a1bc232358898c86845c2ede5eb4163a64a"],
  ["src/lib/analytics/gtm.ts", "5b289d86b77d3b000ad032a961a3f92a7e396c82d87b14e36fd0f01bb4c7e47c"],
  ["src/test/analytics-gtm.test.tsx", "31e196e2a9240d492fa1e53a3e7587971fc3ff7a9b121ffde839eee815a1937e"],
  ["src/test/sms-verification-ui.test.tsx", "957f87910a829b487f08bac4885e26863b6e94906d83aec0108c5dc4ad958353"],
]);

export function reviewedAnalyticsStorage(file, content) {
  const digest = reviewed.get(file);
  return digest === undefined ? null : createHash("sha256").update(content).digest("hex") === digest;
}
