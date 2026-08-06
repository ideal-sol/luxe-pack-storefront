import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "--cached", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const forbidden = tracked.filter((path) =>
  path === "node_modules" ||
  path.startsWith("node_modules/") ||
  path === ".next" ||
  path.startsWith(".next/") ||
  path.startsWith("coverage/") ||
  (/^\.env(?:\.|$)/.test(path) && path !== ".env.example")
);

if (forbidden.length > 0) {
  throw new Error(`Forbidden tracked paths: ${forbidden.join(", ")}`);
}

const directApiMarker = "/api" + "/v2";
const boundaryViolations = tracked
  .filter((path) => path.startsWith("src/") && path !== "src/lib/platform/README.md")
  .filter((path) => {
    try {
      return readFileSync(path, "utf8").includes(directApiMarker);
    } catch {
      return false;
    }
  });

if (boundaryViolations.length > 0) {
  throw new Error(`Direct Platform API reference: ${boundaryViolations.join(", ")}`);
}

execFileSync("git", ["diff", "--check"], { stdio: "inherit" });
execFileSync("git", ["diff", "--cached", "--check"], { stdio: "inherit" });
try {
  execFileSync("git", ["rev-parse", "--verify", "origin/main"], { stdio: "ignore" });
  execFileSync("git", ["diff", "--check", "origin/main...HEAD"], { stdio: "inherit" });
} catch {
  console.log("policy-check: origin/main comparison unavailable before first commit");
}
console.log("policy-check: passed");
