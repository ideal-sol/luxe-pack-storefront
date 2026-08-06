import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "--cached", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((path) => path !== "pnpm-lock.yaml");

const sensitivePaths = tracked.filter((path) =>
  (path !== ".env.example" && /(?:^|\/)(?:\.env[^/]*|id_rsa[^/]*)$/i.test(path)) ||
  /\.(?:pem|key|p12|pfx)$/i.test(path)
);
if (sensitivePaths.length > 0) {
  throw new Error(`Sensitive tracked paths: ${sensitivePaths.join(", ")}`);
}

const patterns = [
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /Bearer [A-Za-z0-9._-]{20,}/,
];

const findings = [];
for (const path of tracked) {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  if (patterns.some((pattern) => pattern.test(content))) findings.push(path);
}

if (findings.length > 0) {
  throw new Error(`High-confidence secret candidate in: ${findings.join(", ")}`);
}

console.log("secret-check: passed");
