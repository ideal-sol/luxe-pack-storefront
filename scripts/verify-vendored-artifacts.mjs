import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const vendor = path.join(root, "vendor/oripa/MIG-089");
const predecessorVendor = path.join(root, "vendor/oripa/MIG-063B");
const bundleVersion = "2.0.0-alpha.28";
const predecessorBundleVersion = "2.0.0-alpha.27";
const publicApiVersion = "2.0.0-alpha.27";
const siteSchemaVersion = "2.0.0-alpha.23";
const sourceCommit = "06681c689eaba3458adb935753de128a4d12d57d";
const expected = new Map([
  ["SHA256SUMS", "8e5d113274d4897d07c66ec613c6d1049e2b7fcdc5fa6b4441c69bda782d9349"],
  ["artifact-manifest.json", "2b9299baa5816a1ff65af147178bb76574411dbcaeda13d5242a32e38bfab6fa"],
  ["oripa-storefront-client-2.0.0-alpha.28.tgz", "7be14c543a1a1d69ad85af0549ddedce275ad86828c4e99dc90b6fc0af6a0a00"],
  ["oripa-storefront-testkit-2.0.0-alpha.28.tgz", "8bc1cd287d15a61c94694034b9ac5280f4b2e4f296d8a6de836ad64550bf0e94"],
  ["public.openapi.json", "41ebdddbd7c4edeedd36ad3810b2afa564495aa2d1c3e48a187f44c85deb85da"],
]);
const publishedPackages = new Map([
  ["@oripa/storefront-client", {
    file: "oripa-storefront-client-2.0.0-alpha.28.tgz",
    version: bundleVersion,
  }],
  ["@oripa/storefront-testkit", {
    file: "oripa-storefront-testkit-2.0.0-alpha.28.tgz",
    version: bundleVersion,
  }],
]);
const referencedSiteSchema = {
  file: "oripa-site-schema-2.0.0-alpha.23.tgz",
  name: "@oripa/site-schema",
  sha256: "b4ca0ddb0ec8a6f4bda6dfec40fb5f3f5098a837160310be64de97cab36740c2",
  version: siteSchemaVersion,
};

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function archiveText(archive, entry) {
  return execFileSync("tar", ["-xOf", archive, entry], { encoding: "utf8" });
}

function archiveJson(archive, entry = "package/package.json") {
  return JSON.parse(archiveText(archive, entry));
}

for (const [file, digest] of expected) {
  if (sha256(path.join(vendor, file)) !== digest) throw new Error(`Artifact digest mismatch: ${file}`);
}
const inventory = readdirSync(vendor).sort();
const expectedInventory = [...expected.keys(), "PROVENANCE.md"].sort();
if (JSON.stringify(inventory) !== JSON.stringify(expectedInventory)) {
  throw new Error("Artifact inventory mismatch");
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
for (const file of [
  "oripa-storefront-client-2.0.0-alpha.28.tgz",
  "oripa-storefront-testkit-2.0.0-alpha.28.tgz",
  "public.openapi.json",
]) {
  if (sums.get(file) !== expected.get(file)) throw new Error(`SHA256SUMS mismatch: ${file}`);
}
if (sums.size !== 3) throw new Error("SHA256SUMS entry set is invalid");

const manifest = JSON.parse(readFileSync(path.join(vendor, "artifact-manifest.json"), "utf8"));
if (manifest.task_id !== "MIG-089" || manifest.source_commit !== sourceCommit) {
  throw new Error("Artifact provenance mismatch");
}
if (manifest.bundle?.version !== bundleVersion || manifest.bundle?.predecessor !== predecessorBundleVersion ||
    manifest.bundle?.release_mode !== "contract-additive" || manifest.bundle?.immutable !== true) {
  throw new Error("Contract-additive bundle declaration mismatch");
}
if (manifest.public_openapi?.file !== "public.openapi.json" ||
    manifest.public_openapi?.version !== publicApiVersion ||
    manifest.public_openapi?.sha256 !== expected.get("public.openapi.json") ||
    manifest.public_openapi?.breaking_change !== false) {
  throw new Error("Referenced Public OpenAPI manifest entry mismatch");
}
const manifestPackages = new Map((manifest.packages ?? []).map((entry) => [entry.name, entry]));
for (const [name, expectedPackage] of publishedPackages) {
  const entry = manifestPackages.get(name);
  if (entry?.disposition !== "published" || entry.file !== expectedPackage.file ||
      entry.version !== expectedPackage.version || entry.sha256 !== expected.get(expectedPackage.file)) {
    throw new Error(`Published package manifest entry mismatch: ${name}`);
  }
}
const schemaEntry = manifestPackages.get(referencedSiteSchema.name);
if (schemaEntry?.disposition !== "referenced" || schemaEntry.file !== undefined ||
    schemaEntry.version !== referencedSiteSchema.version ||
    schemaEntry.source_bundle_version !== siteSchemaVersion ||
    schemaEntry.sha256 !== referencedSiteSchema.sha256) {
  throw new Error("Referenced Site Schema manifest entry mismatch");
}
if (manifestPackages.size !== 3 || manifest.packages?.length !== 3) throw new Error("Package manifest is incomplete");

const provenance = readFileSync(path.join(vendor, "PROVENANCE.md"), "utf8");
for (const value of [bundleVersion, publicApiVersion, siteSchemaVersion, sourceCommit, "MIG-089", ...expected.values(), referencedSiteSchema.sha256]) {
  if (!provenance.includes(value)) throw new Error(`Artifact provenance is incomplete: ${value}`);
}
if (/\/(?:var\/(?:www|lib)|home)\//.test(provenance)) {
  throw new Error("Artifact provenance contains a server-specific path");
}

const sensitivePath = /(?:^|\/)(?:node_modules|\.env[^/]*|[^/]+\.(?:pem|key|p12|pfx))$/i;
for (const [packageName, { file, version }] of publishedPackages) {
  const archivePath = path.join(vendor, file);
  const entries = execFileSync("tar", ["-tzf", archivePath], { encoding: "utf8" }).trim().split("\n");
  const verboseEntries = execFileSync("tar", ["-tvzf", archivePath], { encoding: "utf8" }).split("\n");
  if (verboseEntries.some((entry) => /^[lh]/.test(entry))) throw new Error(`Archive links are not allowed: ${file}`);
  for (const entry of entries) {
    const parts = entry.split("/");
    if (!entry.startsWith("package/") || entry.startsWith("/") || parts.includes("..") || sensitivePath.test(entry)) {
      throw new Error(`Unsafe archive path: ${file}`);
    }
    const text = execFileSync("tar", ["-xOf", archivePath, entry]).toString("utf8");
    if (/\/(?:var\/(?:www|lib)|home)\//.test(text) ||
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) ||
        /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})/.test(text)) {
      throw new Error(`Unsafe archive content: ${file}`);
    }
  }
  const packageJson = archiveJson(archivePath);
  if (packageJson.name !== packageName || packageJson.version !== version) {
    throw new Error(`Package identity mismatch: ${file}`);
  }
  for (const lifecycle of ["preinstall", "install", "postinstall", "prepare"]) {
    if (packageJson.scripts?.[lifecycle]) throw new Error(`Lifecycle script is not allowed: ${file}`);
  }
}

const clientArchive = path.join(vendor, publishedPackages.get("@oripa/storefront-client").file);
const clientPackage = archiveJson(clientArchive);
if (clientPackage.oripaCompatibility?.minimumPublicApiContract !== publicApiVersion) {
  throw new Error("Storefront Client Public API compatibility mismatch");
}
const constants = archiveText(clientArchive, "package/dist/constants.js");
if (!constants.includes(`STOREFRONT_CLIENT_VERSION = "${bundleVersion}"`)) {
  throw new Error("Storefront Client runtime version mismatch");
}
const generatedTypes = archiveText(clientArchive, "package/dist/generated/public.d.ts");
for (const declaration of [
  'PointProductLimitedBonusState: "active" | "upcoming" | "inactive";',
  'label: "期間限定ボーナスコイン";',
  "amount_text: string | null;",
  'limited_bonus?: components["schemas"]["PointProductLimitedBonus"];',
  'PaymentCardUiBootstrap: {',
  'provider: "fincode";',
  "is_live_mode: boolean;",
  "limited_bonus_points: number;",
  "total_points: number;",
]) {
  if (!generatedTypes.includes(declaration)) throw new Error(`Retained Client type is missing: ${declaration}`);
}
if (/limited_bonus\??:\s*[^;]*\|\s*null/.test(generatedTypes)) {
  throw new Error("Limited Bonus Client type must remain optional and non-nullable");
}
const pointProductClient = archiveText(clientArchive, "package/dist/point-products.d.ts");
if (!pointProductClient.includes("createStorefrontPointProductClient") ||
    !pointProductClient.includes("listPointProducts")) {
  throw new Error("Retained Point Product Client contract is incomplete");
}
const paymentClient = archiveText(clientArchive, "package/dist/payments.d.ts");
if (!paymentClient.includes("getPaymentCardUiBootstrap()") ||
    !paymentClient.includes("startPayment(") ||
    !paymentClient.includes("resumeUnpaidPayment(") ||
    !paymentClient.includes("listCards()")) {
  throw new Error("Canonical Payment Client contract is incomplete");
}
const browserDeclarations = archiveText(clientArchive, "package/dist/browser.d.ts");
const contactDeclarations = archiveText(clientArchive, "package/dist/content-contact.d.ts");
const contactRuntime = archiveText(clientArchive, "package/dist/content-contact.js");
if (!browserDeclarations.includes("createBrowserStorefrontContentContactClient") ||
    !contactDeclarations.includes("BrowserStorefrontContentContactClient") ||
    !contactDeclarations.includes("options?: BrowserContactSubmissionOptions") ||
    !contactRuntime.includes('path: "/contact-inquiries"') ||
    !contactRuntime.includes('csrf: "required"') ||
    !contactRuntime.includes("retry: false")) {
  throw new Error("Browser-safe Contact Client contract is incomplete");
}

const testkitArchive = path.join(vendor, publishedPackages.get("@oripa/storefront-testkit").file);
const testkitPackage = archiveJson(testkitArchive);
if (testkitPackage.dependencies?.["@oripa/storefront-client"] !== bundleVersion ||
    testkitPackage.dependencies?.["@oripa/site-schema"] !== siteSchemaVersion ||
    testkitPackage.oripaCompatibility?.storefrontClientVersion !== bundleVersion ||
    testkitPackage.oripaCompatibility?.siteSchemaVersion !== siteSchemaVersion ||
    testkitPackage.oripaCompatibility?.publicApiOperationCount !== 65) {
  throw new Error("Testkit mixed-version dependency declaration mismatch");
}
const testkitFixtures = archiveText(testkitArchive, "package/dist/fixtures.d.ts");
for (const fixture of [
  "PUBLIC_CONTACT_FIXTURE",
  "PUBLIC_CONTACT_PROBLEM_FIXTURES",
  'readonly website: "";',
  'readonly status: "accepted";',
  'readonly status: 422;',
  'readonly status: 429;',
]) {
  if (!testkitFixtures.includes(fixture)) throw new Error(`Canonical Contact Testkit fixture is missing: ${fixture}`);
}
for (const retainedFixture of [
  "PUBLIC_POINT_PRODUCT_FIXTURES",
  'readonly state: "active";',
  'readonly state: "upcoming";',
  'readonly state: "inactive";',
  'readonly label: "期間限定ボーナスコイン";',
  "readonly amount_text: null;",
]) {
  if (!testkitFixtures.includes(retainedFixture)) {
    throw new Error(`Retained Testkit fixture is missing: ${retainedFixture}`);
  }
}
if (testkitFixtures.includes("readonly limited_bonus: null")) {
  throw new Error("Testkit must not publish a non-canonical null Limited Bonus fixture");
}
for (const paymentFixture of [
  "PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES",
  'readonly provider: "fincode";',
  "readonly is_live_mode: false;",
  "PUBLIC_PAYMENT_GRANT_FIXTURES",
  "readonly limited_bonus_points: 2000;",
  "readonly total_points: 13000;",
]) {
  if (!testkitFixtures.includes(paymentFixture)) {
    throw new Error(`Canonical Payment Testkit fixture is missing: ${paymentFixture}`);
  }
}

const schemaArchive = path.join(predecessorVendor, referencedSiteSchema.file);
if (sha256(schemaArchive) !== referencedSiteSchema.sha256) throw new Error("Referenced Site Schema digest mismatch");
const schemaPackage = archiveJson(schemaArchive);
if (schemaPackage.name !== referencedSiteSchema.name || schemaPackage.version !== siteSchemaVersion) {
  throw new Error("Referenced Site Schema identity mismatch");
}
const currentOpenApi = readFileSync(path.join(vendor, "public.openapi.json"));
const openApi = JSON.parse(currentOpenApi.toString("utf8"));
if (openApi.info?.version !== publicApiVersion ||
    !openApi.paths?.["/me/payment-card-ui-bootstrap"]?.get ||
    !openApi.paths?.["/payments"]?.post ||
    !openApi.paths?.["/payments/{payment_id}"]?.get) {
  throw new Error("Canonical Public OpenAPI Payment contract mismatch");
}

const packageJsonText = readFileSync(path.join(root, "package.json"), "utf8");
const lockfileText = readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
for (const content of [packageJsonText, lockfileText]) {
  if (/file:(?:\/var\/|\/home\/|[A-Za-z]:\\)/.test(content)) {
    throw new Error("Server-specific file dependency");
  }
  for (const required of [
    "vendor/oripa/MIG-089/oripa-storefront-client-2.0.0-alpha.28.tgz",
    "vendor/oripa/MIG-089/oripa-storefront-testkit-2.0.0-alpha.28.tgz",
    "vendor/oripa/MIG-063B/oripa-site-schema-2.0.0-alpha.23.tgz",
  ]) {
    if (!content.includes(required)) throw new Error(`Canonical package pin is missing: ${required}`);
  }
}
if (JSON.parse(packageJsonText).dependencies?.["@fincode/js"] !== "1.1.0" ||
    !lockfileText.includes("'@fincode/js@1.1.0':") ||
    !lockfileText.includes("sha512-0TjeUFmj1eTAyHzoCqTNrLsBkw+q14AhrWvkNrBgOG2HNTUd2VCFYHgeRyNPTPpScl8YaDm6IpYXlnlyb1CEnQ==")) {
  throw new Error("Canonical fincode SDK dependency is not exactly pinned");
}
for (const obsolete of [
  "vendor/oripa/STORE-SITE-034/oripa-storefront-client-2.0.0-alpha.24.tgz",
  "vendor/oripa/STORE-SITE-034/oripa-storefront-testkit-2.0.0-alpha.24.tgz",
  "vendor/oripa/MIG-063B/oripa-storefront-client-2.0.0-alpha.23.tgz",
  "vendor/oripa/MIG-063B/oripa-storefront-testkit-2.0.0-alpha.23.tgz",
]) {
if (packageJsonText.includes(obsolete) || lockfileText.includes(obsolete)) {
    throw new Error(`Obsolete Production package pin remains: ${obsolete}`);
  }
}

console.log("artifact-check: passed");
