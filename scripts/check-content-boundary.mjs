import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "--cached", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const contentFiles = tracked.filter((file) =>
  (file.startsWith("src/components/content/") || file.startsWith("src/components/contact/")) && /\.tsx?$/.test(file));
const directApi = "/api" + "/v2";
const protocolDetails = ["csrf_token", "X-XSRF-TOKEN", "XSRF-TOKEN", "localStorage", "sessionStorage"];
const failures = [];

for (const file of contentFiles) {
  const content = readFileSync(file, "utf8");
  if (content.includes(directApi)) failures.push(`${file}:direct-api`);
  if (/\bfetch\s*\(/.test(content)) failures.push(`${file}:direct-fetch`);
  if (protocolDetails.some((marker) => content.includes(marker))) failures.push(`${file}:protocol-or-storage`);
  if (content.includes("dangerouslySetInnerHTML") && file !== "src/components/content/safe-content.tsx") {
    failures.push(`${file}:unsafe-html-boundary`);
  }
}

const contactAdapter = "src/lib/platform/contact-client.ts";
if (tracked.includes(contactAdapter)) {
  const content = readFileSync(contactAdapter, "utf8");
  if (!content.includes("createBrowserStorefrontContentContactClient") ||
      content.includes("createStorefrontContentContactClient") ||
      content.includes("createIdempotencyKey") ||
      content.includes(directApi)) {
    failures.push(`${contactAdapter}:browser-contact-boundary`);
  }
}

const safeContent = "src/components/content/safe-content.tsx";
if (tracked.includes(safeContent)) {
  const content = readFileSync(safeContent, "utf8");
  if (!content.includes("sanitizeCanonicalContent") || !content.includes("sanitizeHtml")) {
    failures.push(`${safeContent}:sanitizer-required`);
  }
}

if (failures.length > 0) throw new Error(`Content boundary violations: ${failures.join(", ")}`);
console.log("content-boundary-check: passed");
