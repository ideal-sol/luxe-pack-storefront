import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "--cached", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const sourceFiles = tracked.filter((file) => file.startsWith("src/") && /\.(?:ts|tsx|js|jsx)$/.test(file));
const platformPrefix = "src/lib/platform/";
const directApi = "/api" + "/v2";
const forbiddenBrowserStorage = ["local" + "Storage", "session" + "Storage"];
const nonAuthStorageFiles = new Set([
  "src/components/payment/card-registration-resume.ts",
  "src/test/card-registration-resume.test.ts",
  "src/test/payment-purchase-ui.test.tsx",
]);
const browserProtocolDetails = ["X-XSRF" + "-TOKEN", "__Host-" + "oripa_user"];
const failures = [];

for (const file of sourceFiles) {
  const content = readFileSync(file, "utf8");
  if (!file.startsWith(platformPrefix) && content.includes(directApi)) failures.push(`${file}:direct-api`);
  if (!file.startsWith(platformPrefix) && browserProtocolDetails.some((marker) => content.includes(marker))) {
    failures.push(`${file}:browser-protocol`);
  }
  if (!nonAuthStorageFiles.has(file) && forbiddenBrowserStorage.some((marker) => content.includes(marker))) {
    failures.push(`${file}:auth-storage`);
  }
  if (file.startsWith("src/components/auth/") && /console\.(?:debug|info|log|warn|error)\s*\(/.test(content)) {
    failures.push(`${file}:auth-logging`);
  }
}

if (failures.length > 0) throw new Error(`Authentication boundary violations: ${failures.join(", ")}`);
console.log("auth-boundary-check: passed");
