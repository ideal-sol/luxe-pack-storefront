import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const vendor = path.join(root, "vendor/oripa/MIG-062Z");
const version = "2.0.0-alpha.21";
const sourceCommit = "1a53ba630264258291cb72e84707e488782cbc08";
const expected = new Map([
  ["artifact-manifest.json", "ac5f051c6171d40f5ed1a0039b7103a8e5917dd90da871fead91b9f8b1aed115"],
  ["oripa-site-schema-2.0.0-alpha.21.tgz", "03f78cd1d090e1cc99ae8af9d8b9c381b720c0eab27b8beee34c5567dcc8018b"],
  ["oripa-storefront-client-2.0.0-alpha.21.tgz", "39622cdfaea2c80f72595396359e67aac7f1de34582ae23ef2de2831d31b594d"],
  ["oripa-storefront-testkit-2.0.0-alpha.21.tgz", "170d2fbb3b9f12cc4e906120c3d23714d612104c544b44498c81641563376263"],
  ["public.openapi.json", "103b8d8ccb1312fecf3013a531102faf5d73cdeb667a7f8d705d6aaf581a1299"],
]);
const packageNames = new Map([
  ["oripa-site-schema-2.0.0-alpha.21.tgz", "@oripa/site-schema"],
  ["oripa-storefront-client-2.0.0-alpha.21.tgz", "@oripa/storefront-client"],
  ["oripa-storefront-testkit-2.0.0-alpha.21.tgz", "@oripa/storefront-testkit"],
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
if (manifest.task_id !== "MIG-062Z" || manifest.source_commit !== sourceCommit) {
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

const clientArchive = path.join(vendor, "oripa-storefront-client-2.0.0-alpha.21.tgz");
const previousClientArchive = path.join(root, "vendor/oripa/MIG-062W/oripa-storefront-client-2.0.0-alpha.20.tgz");
const productContract = execFileSync("tar", ["-xOf", clientArchive, "package/dist/point-products.d.ts"], { encoding: "utf8" });
const currentUserPointContract = execFileSync("tar", ["-xOf", clientArchive, "package/dist/points.d.ts"], { encoding: "utf8" });
if (!productContract.includes("createStorefrontPointProductClient") ||
    !productContract.includes("listPointProducts") ||
    !currentUserPointContract.includes("createStorefrontCurrentUserPointClient") ||
    !currentUserPointContract.includes('StorefrontWalletBalance = Schemas["CurrentUserWalletBalance"]') ||
    !currentUserPointContract.includes("getWallet") ||
    !currentUserPointContract.includes("listPointLedgerEntries")) {
  throw new Error("Generated Point Client contract is incomplete");
}
for (const contractFile of [
  "browser.d.ts", "browser.js",
  "catalog.d.ts", "catalog.js",
  "content-contact.d.ts", "content-contact.js",
  "draw.d.ts", "draw.js",
  "errors.d.ts", "errors.js",
  "identity.d.ts", "identity.js",
  "point-products.d.ts", "point-products.js",
  "points.js",
  "prize-shipping.d.ts", "prize-shipping.js",
  "server.d.ts", "server.js",
  "transport.d.ts", "transport.js",
  "types.d.ts", "types.js",
]) {
  const previous = execFileSync("tar", ["-xOf", previousClientArchive, `package/dist/${contractFile}`]);
  const current = execFileSync("tar", ["-xOf", clientArchive, `package/dist/${contractFile}`]);
  if (!previous.equals(current)) throw new Error(`alpha.20 Client contract changed: ${contractFile}`);
}
const previousPointContract = execFileSync("tar", ["-xOf", previousClientArchive, "package/dist/points.d.ts"], { encoding: "utf8" });
const normalizedPointContract = currentUserPointContract
  .replace('export type StorefrontWalletBalance = Schemas["CurrentUserWalletBalance"];\n', "")
  .replace("Promise<StorefrontResponse<StorefrontWalletBalance>>", 'Promise<StorefrontResponse<Schemas["WalletBalance"]>>');
if (normalizedPointContract !== previousPointContract) {
  throw new Error("alpha.21 Point Client change is not the declared additive Wallet presentation");
}
const constants = execFileSync("tar", ["-xOf", clientArchive, "package/dist/constants.js"], { encoding: "utf8" });
if (!constants.includes(`STOREFRONT_CLIENT_VERSION = "${version}"`)) {
  throw new Error("Storefront Client runtime version mismatch");
}
const drawContract = execFileSync("tar", ["-xOf", clientArchive, "package/dist/draw.d.ts"], { encoding: "utf8" });
for (const declaration of ["listDrawHistory", "DrawHistoryQuery", "DrawHistoryReadProblemCode"]) {
  if (!drawContract.includes(declaration)) throw new Error(`Draw History Client contract is missing: ${declaration}`);
}
const identityContract = execFileSync("tar", ["-xOf", clientArchive, "package/dist/identity.d.ts"], { encoding: "utf8" });
for (const declaration of ["listExternalIdentities", "getLineFriendState", "startLineIdentityLink"]) {
  if (!identityContract.includes(declaration)) throw new Error(`Identity Client contract is missing: ${declaration}`);
}

const previousOpenApi = JSON.parse(readFileSync(path.join(root, "vendor/oripa/MIG-062W/public.openapi.json"), "utf8"));
const currentOpenApi = JSON.parse(readFileSync(path.join(vendor, "public.openapi.json"), "utf8"));
for (const [section, previousEntries, currentEntries] of [
  ["paths", previousOpenApi.paths, currentOpenApi.paths],
  ...Object.keys(previousOpenApi.components ?? {}).map((section) => [
    `components.${section}`,
    previousOpenApi.components?.[section],
    currentOpenApi.components?.[section],
  ]),
  ]) {
  for (const [key, value] of Object.entries(previousEntries ?? {})) {
    if (section === "paths" && key === "/me/wallet") continue;
    if (JSON.stringify(currentEntries?.[key]) !== JSON.stringify(value)) {
      throw new Error(`alpha.20 OpenAPI ${section} entry changed or was removed: ${key}`);
    }
  }
}
const walletOperation = structuredClone(previousOpenApi.paths?.["/me/wallet"]);
walletOperation.get.responses["200"].content["application/json"].schema.$ref = "#/components/schemas/CurrentUserWalletBalance";
if (JSON.stringify(currentOpenApi.paths?.["/me/wallet"]) !== JSON.stringify(walletOperation)) {
  throw new Error("getWallet OpenAPI change is not limited to its canonical response schema");
}
const newSchemaNames = Object.keys(currentOpenApi.components?.schemas ?? {})
  .filter((name) => previousOpenApi.components?.schemas?.[name] === undefined)
  .sort();
if (JSON.stringify(newSchemaNames) !== JSON.stringify(["CurrentUserWalletBalance", "WalletExpiryBucket"])) {
  throw new Error("alpha.21 OpenAPI contains unexpected schema additions");
}
const walletSchema = currentOpenApi.components.schemas.CurrentUserWalletBalance;
const expirySchema = currentOpenApi.components.schemas.WalletExpiryBucket;
if (JSON.stringify(walletSchema.required) !== JSON.stringify(["paid_points", "free_points", "total_points", "as_of", "expiring_within_7_days"]) ||
    walletSchema.properties?.expiring_within_7_days?.type !== "array" ||
    walletSchema.properties?.expiring_within_7_days?.items?.$ref !== "#/components/schemas/WalletExpiryBucket" ||
    JSON.stringify(expirySchema.required) !== JSON.stringify(["expires_at", "amount"]) ||
    expirySchema.properties?.expires_at?.format !== "date-time" ||
    expirySchema.properties?.amount?.type !== "integer") {
  throw new Error("Canonical Wallet expiry schema mismatch");
}

const testkitArchive = path.join(vendor, "oripa-storefront-testkit-2.0.0-alpha.21.tgz");
const previousTestkitArchive = path.join(root, "vendor/oripa/MIG-062W/oripa-storefront-testkit-2.0.0-alpha.20.tgz");
for (const contractFile of [
  "assertions.d.ts", "assertions.js",
  "errors.d.ts", "errors.js",
  "mock.d.ts", "mock.js",
]) {
  const previous = execFileSync("tar", ["-xOf", previousTestkitArchive, `package/dist/${contractFile}`]);
  const current = execFileSync("tar", ["-xOf", testkitArchive, `package/dist/${contractFile}`]);
  if (!previous.equals(current)) throw new Error(`alpha.20 Testkit contract changed: ${contractFile}`);
}
const testkitFixtures = execFileSync("tar", ["-xOf", testkitArchive, "package/dist/fixtures.d.ts"], { encoding: "utf8" });
for (const fixture of [
  "PUBLIC_POINT_PRODUCT_FIXTURES",
  "PUBLIC_POINT_BALANCE_FIXTURES",
  "PUBLIC_POINT_HISTORY_FIXTURES",
  "PUBLIC_POINT_READ_PROBLEM_FIXTURES",
  "PUBLIC_DRAW_HISTORY_FIXTURES",
  "PUBLIC_DRAW_HISTORY_PROBLEM_FIXTURES",
  "PUBLIC_LINE_FRIEND_STATE_FIXTURES",
  "PUBLIC_LINE_FRIEND_STATE_PROBLEM_FIXTURES",
]) {
  if (!testkitFixtures.includes(fixture)) throw new Error(`Required Testkit fixture is missing: ${fixture}`);
}
for (const fixture of ["canonical_expiry", "seven_day_boundary", "timestamp_separation", "zero"]) {
  if (!testkitFixtures.includes(`readonly ${fixture}:`)) throw new Error(`Wallet expiry Testkit fixture is missing: ${fixture}`);
}
if (!testkitFixtures.includes("readonly expiring_within_7_days: []") ||
    !testkitFixtures.includes('readonly expires_at: "2026-08-21T00:00:00Z"') ||
    !testkitFixtures.includes("readonly amount: 60")) {
  throw new Error("Wallet expiry Testkit shape is incomplete");
}

const siteSchemaArchive = path.join(vendor, "oripa-site-schema-2.0.0-alpha.21.tgz");
const previousSiteSchemaArchive = path.join(root, "vendor/oripa/MIG-062W/oripa-site-schema-2.0.0-alpha.20.tgz");
const siteSchemaEntries = execFileSync("tar", ["-tzf", previousSiteSchemaArchive], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter((entry) => entry !== "package/package.json" && entry !== "package/README.md");
for (const entry of siteSchemaEntries) {
  const previous = execFileSync("tar", ["-xOf", previousSiteSchemaArchive, entry]);
  const current = execFileSync("tar", ["-xOf", siteSchemaArchive, entry]);
  if (!previous.equals(current)) throw new Error(`alpha.20 Site Schema contract changed: ${entry}`);
}

for (const file of ["package.json", "pnpm-lock.yaml"]) {
  const content = readFileSync(path.join(root, file), "utf8");
  if (/file:(?:\/var\/|\/home\/|[A-Za-z]:\\)/.test(content)) {
    throw new Error(`Server-specific file dependency: ${file}`);
  }
  if (!content.includes("vendor/oripa/MIG-062Z") || content.includes("file:vendor/oripa/MIG-062W")) {
    throw new Error(`Production Artifact dependency is not pinned to MIG-062Z: ${file}`);
  }
}

console.log("artifact-check: passed");
