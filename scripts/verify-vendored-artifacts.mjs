import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const vendor = path.join(root, "vendor/oripa/MIG-062V");
const version = "2.0.0-alpha.19";
const sourceCommit = "2b58e308693fa6e642023e2778274e789da75c09";
const expected = new Map([
  ["artifact-manifest.json", "7014f84ec38c742d2586a148700489bbdad069c78a02173ae4cf80bb11fd3448"],
  ["oripa-site-schema-2.0.0-alpha.19.tgz", "963b8f65f5ed296bf7e5eba9901e282f8400e40643ef73b36fb0b160d753ad43"],
  ["oripa-storefront-client-2.0.0-alpha.19.tgz", "25cffd3e571eaa3df8e6cc19b50d591605c8dbb8783cca03ee83b0d82c79fe95"],
  ["oripa-storefront-testkit-2.0.0-alpha.19.tgz", "cb7f19df5802f56fdc692ad8bead5c8f5e2638961b00fe2c85250b08f4978a36"],
  ["public.openapi.json", "2b6883e8e51eebe6414f401553e866112b56d6e400b34ca17436433666fa0211"],
]);
const packageNames = new Map([
  ["oripa-site-schema-2.0.0-alpha.19.tgz", "@oripa/site-schema"],
  ["oripa-storefront-client-2.0.0-alpha.19.tgz", "@oripa/storefront-client"],
  ["oripa-storefront-testkit-2.0.0-alpha.19.tgz", "@oripa/storefront-testkit"],
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
if (manifest.task_id !== "MIG-062V" || manifest.source_commit !== sourceCommit) {
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
if (manifest.public_openapi?.breaking_change !== false || manifest.packages.some((entry) => entry.change !== "non-breaking additive" && entry.name !== "@oripa/site-schema")) {
  throw new Error("Artifact compatibility declaration mismatch");
}

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

const clientArchive = path.join(vendor, "oripa-storefront-client-2.0.0-alpha.19.tgz");
const previousClientArchive = path.join(root, "vendor/oripa/MIG-062U/oripa-storefront-client-2.0.0-alpha.18.tgz");
const productContract = execFileSync("tar", ["-xOf", clientArchive, "package/dist/point-products.d.ts"], { encoding: "utf8" });
const currentUserPointContract = execFileSync("tar", ["-xOf", clientArchive, "package/dist/points.d.ts"], { encoding: "utf8" });
if (!productContract.includes("createStorefrontPointProductClient") ||
    !productContract.includes("listPointProducts") ||
    !currentUserPointContract.includes("createStorefrontCurrentUserPointClient") ||
    !currentUserPointContract.includes("getWallet") ||
    !currentUserPointContract.includes("listPointLedgerEntries")) {
  throw new Error("Generated Point Client contract is incomplete");
}
for (const contractFile of ["points.d.ts", "points.js", "point-products.d.ts", "point-products.js"]) {
  const previous = execFileSync("tar", ["-xOf", previousClientArchive, `package/dist/${contractFile}`]);
  const current = execFileSync("tar", ["-xOf", clientArchive, `package/dist/${contractFile}`]);
  if (!previous.equals(current)) throw new Error(`alpha.18 Point contract changed: ${contractFile}`);
}
const drawContract = execFileSync("tar", ["-xOf", clientArchive, "package/dist/draw.d.ts"], { encoding: "utf8" });
for (const declaration of ["listDrawHistory", "DrawHistoryQuery", "DrawHistoryReadProblemCode"]) {
  if (!drawContract.includes(declaration)) throw new Error(`Draw History Client contract is missing: ${declaration}`);
}
const testkitArchive = path.join(vendor, "oripa-storefront-testkit-2.0.0-alpha.19.tgz");
const testkitFixtures = execFileSync("tar", ["-xOf", testkitArchive, "package/dist/fixtures.d.ts"], { encoding: "utf8" });
for (const fixture of [
  "PUBLIC_POINT_PRODUCT_FIXTURES",
  "PUBLIC_POINT_BALANCE_FIXTURES",
  "PUBLIC_POINT_HISTORY_FIXTURES",
  "PUBLIC_POINT_READ_PROBLEM_FIXTURES",
  "PUBLIC_DRAW_HISTORY_FIXTURES",
  "PUBLIC_DRAW_HISTORY_PROBLEM_FIXTURES",
]) {
  if (!testkitFixtures.includes(fixture)) throw new Error(`Required Testkit fixture is missing: ${fixture}`);
}

for (const file of ["package.json", "pnpm-lock.yaml"]) {
  const content = readFileSync(path.join(root, file), "utf8");
  if (/file:(?:\/var\/|\/home\/|[A-Za-z]:\\)/.test(content)) {
    throw new Error(`Server-specific file dependency: ${file}`);
  }
  if (!content.includes("vendor/oripa/MIG-062V") || content.includes("file:vendor/oripa/MIG-062U")) {
    throw new Error(`Production Artifact dependency is not pinned to MIG-062V: ${file}`);
  }
}

console.log("artifact-check: passed");
