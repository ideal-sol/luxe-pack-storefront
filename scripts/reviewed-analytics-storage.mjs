import { createHash } from "node:crypto";

// Human-authorized non-authentication markers, pinned to entire reviewed bytes.
// Any helper/test edit needs renewed review. No directory-wide storage exemption.
const reviewed = new Map([
  ["src/test/purchase-reliability.test.tsx", "3de693df00d5b4cc03f2867496111ef1da499d06df585d44c93a0e3091f20f03"],
  ["src/lib/analytics/purchase-recovery.ts", "880f591f3b10294722d5e2f82d1ff4c11df9ddc9b95a844b187c49167a703b4f"],
  ["src/lib/analytics/gtm.ts", "5b289d86b77d3b000ad032a961a3f92a7e396c82d87b14e36fd0f01bb4c7e47c"],
  ["src/test/analytics-gtm.test.tsx", "31e196e2a9240d492fa1e53a3e7587971fc3ff7a9b121ffde839eee815a1937e"],
  ["src/test/sms-verification-ui.test.tsx", "957f87910a829b487f08bac4885e26863b6e94906d83aec0108c5dc4ad958353"],
]);

export function reviewedAnalyticsStorage(file, content) {
  const digest = reviewed.get(file);
  return digest === undefined ? null : createHash("sha256").update(content).digest("hex") === digest;
}
