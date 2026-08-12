import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const vendor = path.join(root, "vendor/oripa/MIG-062G");
const version = "2.0.0-alpha.9";
const sourceCommit = "36220b5c08820741b4763363a7e86c18274b9688";
const expected = new Map([
  ["artifact-manifest.json", "b1ecfc891070045bc9729421a88562fc0d8fafbb86c4b9add60eb99cc6341ee2"],
  ["oripa-site-schema-2.0.0-alpha.9.tgz", "2c2dea7ca10a884550c47e96a4c43c2f3634d1a843d84023f2446cd1c93e1477"],
  ["oripa-storefront-client-2.0.0-alpha.9.tgz", "8ff4ed2be8c5ce6905cde05c2b414d14bb74b4c1f853c623606eb401b60ef515"],
  ["oripa-storefront-testkit-2.0.0-alpha.9.tgz", "8d71703cf90353ac0f53f371b93cdf345c6eaac77189fa06e4f0c36e3a2de582"],
  ["public.openapi.json", "737c6e174f9e47a0543a6b39a0e778fb46c50b24c20564dd7a8636439010e702"],
]);
const packageNames = new Map([
  ["oripa-site-schema-2.0.0-alpha.9.tgz", "@oripa/site-schema"],
  ["oripa-storefront-client-2.0.0-alpha.9.tgz", "@oripa/storefront-client"],
  ["oripa-storefront-testkit-2.0.0-alpha.9.tgz", "@oripa/storefront-testkit"],
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
if (manifest.task_id !== "MIG-062G" || manifest.source_commit !== sourceCommit) {
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
