import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "--cached", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const componentFiles = tracked.filter((file) => file.startsWith("src/components/catalog/") && /\.tsx?$/.test(file));
const directApi = "/api" + "/v2";
const inferredState = [
  /remaining_count\s*(?:===|!==|<=|>=|<|>)/,
  /publish_(?:start|end)_at\s*(?:===|!==|<=|>=|<|>)/,
  /\b(?:isSoldOut|soldOut|isEligible|firstUser|lineUser|dailyLimit)\b/,
];
const failures = [];

for (const file of componentFiles) {
  const content = readFileSync(file, "utf8");
  if (content.includes(directApi)) failures.push(`${file}:direct-api`);
  if (/\bfetch\s*\(/.test(content)) failures.push(`${file}:direct-fetch`);
  if (inferredState.some((pattern) => pattern.test(content))) failures.push(`${file}:inferred-business-state`);
}

if (failures.length > 0) throw new Error(`Catalog boundary violations: ${failures.join(", ")}`);
console.log("catalog-boundary-check: passed");
