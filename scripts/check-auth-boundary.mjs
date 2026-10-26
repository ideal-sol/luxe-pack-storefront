import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "--cached", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const sourceFiles = tracked.filter((file) => file.startsWith("src/") && /\.(?:ts|tsx|js|jsx)$/.test(file));
const platformPrefix = "src/lib/platform/";
const authUiPrefixes = ["src/components/auth/", "src/components/account-security/"];
const directApi = "/api" + "/v2";
const forbiddenBrowserStorage = ["local" + "Storage", "session" + "Storage"];
const nonAuthStorageFiles = new Set([
  "src/components/payment/card-registration-resume.ts",
  "src/lib/sms-registration-prompt.ts",
  "src/test/card-registration-resume.test.ts",
  "src/test/mypage-ui.test.tsx",
  "src/test/payment-purchase-ui.test.tsx",
]);
// Human-authorized analytics markers only, not authentication persistence.
// Pin the entire reviewed helper/test contents: changing a storage operation or
// adding credentials requires a new explicit review, not a blanket path exemption.
const reviewedAnalyticsStorage = new Map([
  ["src/lib/analytics/gtm.ts", "f8f9beb8da3cbb8d07c28cf7ac087da3d4ff6bf94a4e4d55645155075b5bfa09"],
  ["src/test/analytics-gtm.test.tsx", "a087a14e353018fd36babcc86c51becf3fc1d2a7da843d9b3aecdbd421f4b8e6"],
  ["src/test/sms-verification-ui.test.tsx", "33ee28a8a6e06d910a99f32548a0f36419cf2466a24bb12bc633bb5bc7a145fe"],
]);
const browserProtocolDetails = ["X-XSRF" + "-TOKEN", "__Host-" + "oripa_user"];
const failures = [];

for (const file of sourceFiles) {
  const content = readFileSync(file, "utf8");
  const analyticsDigest = reviewedAnalyticsStorage.get(file);
  const reviewedAnalytics = analyticsDigest !== undefined
    && createHash("sha256").update(content).digest("hex") === analyticsDigest;
  if (analyticsDigest !== undefined && !reviewedAnalytics) failures.push(`${file}:analytics-storage-review`);
  if (!file.startsWith(platformPrefix) && content.includes(directApi)) failures.push(`${file}:direct-api`);
  if (!file.startsWith(platformPrefix) && browserProtocolDetails.some((marker) => content.includes(marker))) {
    failures.push(`${file}:browser-protocol`);
  }
  if (!nonAuthStorageFiles.has(file) && !reviewedAnalytics && forbiddenBrowserStorage.some((marker) => content.includes(marker))) {
    failures.push(`${file}:auth-storage`);
  }
  if ((file === "src/proxy.ts" || authUiPrefixes.some((prefix) => file.startsWith(prefix)))
    && /console\.(?:debug|info|log|warn|error)\s*\(/.test(content)) {
    failures.push(`${file}:auth-logging`);
  }
}

if (failures.length > 0) throw new Error(`Authentication boundary violations: ${failures.join(", ")}`);
console.log("auth-boundary-check: passed");
