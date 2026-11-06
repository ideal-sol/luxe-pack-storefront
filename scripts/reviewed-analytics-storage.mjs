import { createHash } from "node:crypto";

// Human-authorized non-authentication markers, pinned to entire reviewed bytes.
// Any helper/test edit needs renewed review. No directory-wide storage exemption.
const reviewed = new Map([
  ["src/lib/analytics/gtm.ts", "ec7e637667673808fe3a7a0197ab26496491bc161a328086d19b3f30fa49fe89"],
  ["src/test/analytics-gtm.test.tsx", "24512ed2cdba42156b91aab6e8dd137f585a17777ebd39c30cb47265ac9c7f2b"],
  ["src/test/sms-verification-ui.test.tsx", "957f87910a829b487f08bac4885e26863b6e94906d83aec0108c5dc4ad958353"],
]);

export function reviewedAnalyticsStorage(file, content) {
  const digest = reviewed.get(file);
  return digest === undefined ? null : createHash("sha256").update(content).digest("hex") === digest;
}
