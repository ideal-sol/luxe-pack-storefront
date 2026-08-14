import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const vendor = path.join(root, "vendor/oripa/MIG-062P");
const version = "2.0.0-alpha.14";
const sourceCommit = "4c4fe03ead4b4b1d2f7d82df430db0bb4b9cfb21";
const expected = new Map([
  ["artifact-manifest.json", "fc19acb126c5bc9a822b2de40ccccd365da24ceb0270cbe0f665de716bc6e475"],
  ["oripa-site-schema-2.0.0-alpha.14.tgz", "4b4539bdc199c0ef03e6cdf180f1d6c62e80b8827a92f64812b212b868e6a8bc"],
  ["oripa-storefront-client-2.0.0-alpha.14.tgz", "d76d1e03d0772e82d24b37a65b94e1550bd53a809f16fc3e60d1377fc3a284dd"],
  ["oripa-storefront-testkit-2.0.0-alpha.14.tgz", "4ac29fbc037ec711056ff58353e20a08726c7edcff4769fd84aa4f44cfac3176"],
  ["public.openapi.json", "cc50dbae2f0d55deca43afca7dd3457074a1edf9ae275c46f58f782b1790b393"],
]);
const packageNames = new Map([
  ["oripa-site-schema-2.0.0-alpha.14.tgz", "@oripa/site-schema"],
  ["oripa-storefront-client-2.0.0-alpha.14.tgz", "@oripa/storefront-client"],
  ["oripa-storefront-testkit-2.0.0-alpha.14.tgz", "@oripa/storefront-testkit"],
]);

function sha256(file) {
  return createHash("sha256").update(readFileSync(path.join(vendor, file))).digest("hex");
}

for (const [file, digest] of expected) {
  if (sha256(file) !== digest) throw new Error(`Artifact digest mismatch: ${file}`);
}
const sums = new Map(
  readFileSync(path.join(vendor, "SHA256SUMS"), "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const match = line.match(/^([0-9a-f]{64})  (.+)$/);
      if (!match) throw new Error("SHA256SUMS format is invalid");
      return [match[2], match[1]];
    }),
);
for (const [file, digest] of expected) {
  if (file !== "artifact-manifest.json" && sums.get(file) !== digest) {
    throw new Error(`SHA256SUMS mismatch: ${file}`);
  }
}
if (sums.size !== expected.size - 1) throw new Error("SHA256SUMS entry set is invalid");

const manifest = JSON.parse(readFileSync(path.join(vendor, "artifact-manifest.json"), "utf8"));
if (manifest.task_id !== "MIG-062P" || manifest.source_commit !== sourceCommit) {
  throw new Error("Artifact provenance mismatch");
}
if (manifest.public_openapi?.file !== "public.openapi.json" || manifest.public_openapi.sha256 !== expected.get("public.openapi.json")) {
  throw new Error("Public OpenAPI manifest entry mismatch");
}
for (const entry of manifest.packages ?? []) {
  if (entry.version !== version || packageNames.get(entry.file) !== entry.name || expected.get(entry.file) !== entry.sha256) {
    throw new Error(`Package manifest entry mismatch: ${entry.file ?? "unknown"}`);
  }
}
if (manifest.packages?.length !== packageNames.size) throw new Error("Package manifest is incomplete");

const sensitivePath = /(?:^|\/)(?:node_modules|\.env[^/]*|[^/]+\.(?:pem|key|p12|pfx))$/i;
for (const [archive, packageName] of packageNames) {
  const archivePath = path.join(vendor, archive);
  const entries = execFileSync("tar", ["-tzf", archivePath], { encoding: "utf8" })
    .trim()
    .split("\n");
  const verboseEntries = execFileSync("tar", ["-tvzf", archivePath], { encoding: "utf8" }).split("\n");
  if (verboseEntries.some((entry) => /^[lh]/.test(entry))) throw new Error(`Archive links are not allowed: ${archive}`);
  for (const entry of entries) {
    const parts = entry.split("/");
    if (!entry.startsWith("package/") || entry.startsWith("/") || parts.includes("..") || sensitivePath.test(entry)) {
      throw new Error(`Unsafe archive path: ${archive}`);
    }
    const content = execFileSync("tar", ["-xOf", archivePath, entry]);
    const text = content.toString("utf8");
    if (/\/(?:var\/(?:www|lib)|home)\//.test(text) ||
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) ||
        /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})/.test(text)) {
      throw new Error(`Unsafe archive content: ${archive}`);
    }
  }
  const packageJson = JSON.parse(execFileSync("tar", ["-xOf", archivePath, "package/package.json"], { encoding: "utf8" }));
  if (packageJson.name !== packageName || packageJson.version !== version) {
    throw new Error(`Package identity mismatch: ${archive}`);
  }
  for (const lifecycle of ["preinstall", "install", "postinstall", "prepare"]) {
    if (packageJson.scripts?.[lifecycle]) throw new Error(`Lifecycle script is not allowed: ${archive}`);
  }
}

for (const file of ["package.json", "pnpm-lock.yaml"]) {
  const content = readFileSync(path.join(root, file), "utf8");
  if (/file:(?:\/var\/|\/home\/|[A-Za-z]:\\)/.test(content)) {
    throw new Error(`Server-specific file dependency: ${file}`);
  }
}

console.log("artifact-check: passed");
