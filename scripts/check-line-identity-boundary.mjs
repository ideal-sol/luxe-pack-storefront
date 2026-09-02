import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "--cached", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const sourceFiles = tracked.filter((file) => file.startsWith("src/") && /\.(?:ts|tsx|js|jsx)$/.test(file));
const platformPrefix = "src/lib/platform/";
const componentPrefix = "src/components/account/";
const directApi = "/api" + "/v2";
const forbiddenStorage = ["local" + "Storage", "session" + "Storage"];
const nonIdentityStorageFiles = new Set([
  "src/components/payment/card-registration-resume.ts",
  "src/lib/sms-registration-prompt.ts",
  "src/test/card-registration-resume.test.ts",
  "src/test/mypage-ui.test.tsx",
  "src/test/payment-purchase-ui.test.tsx",
]);
const browserProtocol = ["X-XSRF" + "-TOKEN", "__Host-" + "oripa_user"];
const callbackParsing = ["URLSearch" + "Params", "searchParams.get(\"code\")", "searchParams.get(\"state\")"];
const failures = [];

for (const file of sourceFiles) {
  const content = readFileSync(file, "utf8");
  if (!file.startsWith(platformPrefix) && content.includes(directApi)) failures.push(`${file}:direct-api`);
  if (!nonIdentityStorageFiles.has(file) && forbiddenStorage.some((marker) => content.includes(marker))) {
    failures.push(`${file}:identity-storage`);
  }
  if (!file.startsWith(platformPrefix) && browserProtocol.some((marker) => content.includes(marker))) {
    failures.push(`${file}:browser-protocol`);
  }
  if (file.startsWith(componentPrefix) && /\bfetch\s*\(/.test(content)) failures.push(`${file}:direct-fetch`);
  if (file.startsWith(componentPrefix) && callbackParsing.some((marker) => content.includes(marker))) {
    failures.push(`${file}:callback-parameter-duplication`);
  }
}

if (failures.length > 0) throw new Error(`LINE identity boundary violations: ${failures.join(", ")}`);
console.log("line-identity-boundary-check: passed");
