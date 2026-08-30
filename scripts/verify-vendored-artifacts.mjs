import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const vendor = path.join(root, "vendor/oripa/GOV-025");
const retainedVendor = path.join(root, "vendor/oripa/MIG-098");
const schemaVendor = path.join(root, "vendor/oripa/MIG-063B");
const bundleVersion = "2.0.0-alpha.33";
const predecessorBundleVersion = "2.0.0-alpha.32";
const publicApiVersion = "2.0.0-alpha.29";
const siteSchemaVersion = "2.0.0-alpha.23";
const sourceCommit = "9867c1ea50140efd1eff7a652d3da5bd36665e1d";
const expected = new Map([
  ["SHA256SUMS", "10252bf2cb15f80e2c26fd329c15092517d667267a9cc105ab74b9f5c3649328"],
  ["artifact-manifest.json", "b6522d16230734ea7f4604be59a2585c29bcf03a2b447269e824e712759d893c"],
  ["oripa-storefront-client-2.0.0-alpha.33.tgz", "846b0e036ebf76dd46ab1a2c9d6b67b786f9d2dfe5672d8b3a0eb31b7ad675a2"],
  ["oripa-storefront-testkit-2.0.0-alpha.33.tgz", "720d8cc6a0b1c786267de34af0f1fddefc5a517d5d064491f4a78af2e492df4d"],
  ["public.openapi.json", "9670bc769080da605c97cb9849b61f342cf0111bc39e91c09dbbf62fc4bcc720"],
]);
const retainedExpected = new Map([
  ["SHA256SUMS", "1a0a4295106e8e7bc951b9caf907c9cf844a913bf820e896312889ca3749a127"],
  ["artifact-manifest.json", "c11894fbfadaf3dd4e00c7f94973ede1bb00f580ece5e109d0118c74c3b69f74"],
  ["oripa-storefront-client-2.0.0-alpha.31.tgz", "0caf5e8ac829a1f13d1790298ba4a2fef3c50fe6ae11cad63329ab327cea40cf"],
  ["oripa-storefront-testkit-2.0.0-alpha.31.tgz", "932cc4cc6560aa595e01bb5d929320f8d2f70dda32d5a8dd70ec91e84acb8716"],
  ["public.openapi.json", "60a14073f7ee52d91b919c69fbc7444bf6afe391a887121bb4af5e45fbb85626"],
]);
const publishedPackages = new Map([
  ["@oripa/storefront-client", {
    file: "oripa-storefront-client-2.0.0-alpha.33.tgz",
    version: bundleVersion,
  }],
  ["@oripa/storefront-testkit", {
    file: "oripa-storefront-testkit-2.0.0-alpha.33.tgz",
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
for (const [file, digest] of retainedExpected) {
  if (sha256(path.join(retainedVendor, file)) !== digest) throw new Error(`Retained alpha.31 digest mismatch: ${file}`);
}
const retainedInventory = readdirSync(retainedVendor).sort();
const expectedRetainedInventory = [...retainedExpected.keys(), "PROVENANCE.md"].sort();
if (JSON.stringify(retainedInventory) !== JSON.stringify(expectedRetainedInventory)) {
  throw new Error("Retained alpha.31 inventory mismatch");
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
  "oripa-storefront-client-2.0.0-alpha.33.tgz",
  "oripa-storefront-testkit-2.0.0-alpha.33.tgz",
  "public.openapi.json",
]) {
  if (sums.get(file) !== expected.get(file)) throw new Error(`SHA256SUMS mismatch: ${file}`);
}
if (sums.size !== 3) throw new Error("SHA256SUMS entry set is invalid");

const manifest = JSON.parse(readFileSync(path.join(vendor, "artifact-manifest.json"), "utf8"));
if (manifest.task_id !== "GOV-025" || manifest.source_commit !== sourceCommit) {
  throw new Error("Artifact provenance mismatch");
}
if (manifest.bundle?.version !== bundleVersion || manifest.bundle?.predecessor !== predecessorBundleVersion ||
    manifest.bundle?.release_mode !== "package-only" || manifest.bundle?.immutable !== true) {
  throw new Error("Package-only bundle declaration mismatch");
}
if (manifest.public_openapi?.file !== "public.openapi.json" ||
    manifest.public_openapi?.version !== publicApiVersion ||
    manifest.public_openapi?.sha256 !== expected.get("public.openapi.json") ||
    manifest.public_openapi?.operation_count !== 74 ||
    manifest.public_openapi?.breaking_change !== false) {
  throw new Error("Referenced Public OpenAPI manifest entry mismatch");
}
const manifestPackages = new Map((manifest.packages ?? []).map((entry) => [entry.name, entry]));
for (const [name, expectedPackage] of publishedPackages) {
  const entry = manifestPackages.get(name);
  if (entry?.disposition !== "published" || entry.browser_compatible !== true || entry.file !== expectedPackage.file ||
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
for (const value of [bundleVersion, publicApiVersion, siteSchemaVersion, sourceCommit, "GOV-025", "33318307918", "9734141503", ...expected.values(), referencedSiteSchema.sha256]) {
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
const clientReadbackDirectory = mkdtempSync(path.join(tmpdir(), "site-alpha33-client-"));
try {
  execFileSync("tar", ["-xzf", clientArchive, "-C", clientReadbackDirectory]);
  const extractedPackage = path.join(clientReadbackDirectory, "package");
  const browserModule = await import(pathToFileURL(path.join(extractedPackage, "dist/browser.js")).href);
  const constantsModule = await import(pathToFileURL(path.join(extractedPackage, "dist/constants.js")).href);
  let actualHeaderVersion = null;
  const transport = browserModule.createBrowserStorefrontClient({
    base_url: "/api/v2",
    default_timeout_ms: 500,
    fetch: async (_url, init) => {
      actualHeaderVersion = init.headers.get("X-Oripa-Client-Version");
      return new Response(JSON.stringify({ data: "ok" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    },
    site_version: "1.0.0",
  });
  await transport.request({ path: "/artifact-version-readback", retry: false });
  if (constantsModule.STOREFRONT_CLIENT_VERSION !== bundleVersion || actualHeaderVersion !== bundleVersion) {
    throw new Error("Storefront Client runtime/header version mismatch");
  }
} finally {
  rmSync(clientReadbackDirectory, { force: true, recursive: true });
}
const generatedTypes = archiveText(clientArchive, "package/dist/generated/public.d.ts");
for (const declaration of [
  'PointProductLimitedBonusState: "active" | "upcoming" | "inactive";',
  'label: "期間限定ボーナスコイン";',
  "amount_text: string | null;",
  'limited_bonus?: components["schemas"]["PointProductLimitedBonus"];',
  'PaymentCardUiBootstrap: {',
  'PaymentCardComponentAction: {',
  'verification_status: "verified" | "unverified";',
  "registration_remaining?: number;",
  "next_capacity_at?: string | null;",
  'PaymentCardRegistrationStatus: "pending" | "requires_action" | "completed" | "failed" | "canceled" | "expired";',
  'type: "three_d_secure";',
  'saved_card_id: null | components["schemas"]["OpaqueId"];',
]) {
  if (!generatedTypes.includes(declaration)) throw new Error(`Retained Client type is missing: ${declaration}`);
}
for (const declaration of [
  "return_url: string;",
  "failure_url: string;",
  'provider: "fincode";',
  "is_live_mode: boolean;",
  "limited_bonus_points: number;",
  "total_points: number;",
  "PasswordResetConfirmRequest: {",
  "EmailChangeCompleted: {",
  "UserPasswordChangeRequest: {",
  'next_action: "login";',
  "initiating_session_preserved: boolean;",
  "session_rotated: boolean;",
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
    !paymentClient.includes("listCards()") ||
    !paymentClient.includes("startCardRegistration(") ||
    !paymentClient.includes("getCardRegistration(") ||
    !paymentClient.includes("reconcileCardRegistration(") ||
    !paymentClient.includes("cancelCardRegistration(")) {
  throw new Error("Canonical Payment Client contract is incomplete");
}
const paymentRuntime = archiveText(clientArchive, "package/dist/payments.js");
const resumeImplementations = paymentRuntime.split("resumeUnpaidPayment:").slice(1);
if (resumeImplementations.length !== 2 || resumeImplementations.some((implementation) => {
  const request = implementation.slice(0, implementation.indexOf("}),") + 3);
  return !request.includes('method: "POST"') || !request.includes("body: {}") ||
    !request.includes('csrf: "required"') || !request.includes("retry: false");
})) {
  throw new Error("Canonical Payment resume JSON request contract is incomplete");
}
const registrationStartImplementations = paymentRuntime.split("startCardRegistration:").slice(1);
if (registrationStartImplementations.length !== 2 || registrationStartImplementations.some((implementation) => {
  const request = implementation.slice(0, implementation.indexOf("}),") + 3);
  return !request.includes('path: "/me/payment-card-registrations"') ||
    !request.includes('method: "POST"') || !request.includes("body: input") ||
    !request.includes("idempotency_key: options.idempotency_key") ||
    !request.includes('csrf: "required"');
})) {
  throw new Error("Canonical Card Registration start request contract is incomplete");
}
for (const operation of ["reconcileCardRegistration:", "cancelCardRegistration:"]) {
  const implementations = paymentRuntime.split(operation).slice(1);
  if (implementations.length !== 2 || implementations.some((implementation) => {
    const request = implementation.slice(0, implementation.indexOf("}),") + 3);
    return !request.includes("/me/payment-card-registrations/") ||
      !request.includes('method: "POST"') || !request.includes("body: {}") ||
      !request.includes('csrf: "required"') || !request.includes("retry: false");
  })) {
    throw new Error(`Canonical Card Registration mutation contract is incomplete: ${operation}`);
  }
}
const registrationReads = paymentRuntime.split("getCardRegistration:").slice(1);
if (registrationReads.length !== 2 || registrationReads.some((implementation) =>
  !implementation.slice(0, implementation.indexOf("}),") + 3)
    .includes("/me/payment-card-registrations/"))) {
  throw new Error("Canonical Card Registration read contract is incomplete");
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
const identityDeclarations = archiveText(clientArchive, "package/dist/identity.d.ts");
const identityRuntime = archiveText(clientArchive, "package/dist/identity.js");
for (const operation of [
  "requestPasswordReset",
  "confirmPasswordReset",
  "createEmailChangeRequest",
  "completeEmailChange",
  "changeUserPassword",
]) {
  if (!identityDeclarations.includes(operation) || !identityRuntime.includes(operation)) {
    throw new Error(`Canonical Account Security Client operation is missing: ${operation}`);
  }
}
for (const route of [
  '"/auth/password/forgot"',
  '"/auth/password/reset"',
  '"/me/email-change-requests"',
  '"/me/password"',
]) {
  if (!identityRuntime.includes(route)) throw new Error(`Canonical Account Security route is missing: ${route}`);
}
if (!identityRuntime.includes("/me/email-change-requests/${encodeURIComponent(request_id)}/complete") ||
    !identityRuntime.includes('method: "PUT"') ||
    !identityRuntime.includes('csrf: "required"')) {
  throw new Error("Canonical Account Security mutation contract is incomplete");
}

const testkitArchive = path.join(vendor, publishedPackages.get("@oripa/storefront-testkit").file);
const testkitPackage = archiveJson(testkitArchive);
if (testkitPackage.dependencies?.["@oripa/storefront-client"] !== bundleVersion ||
    testkitPackage.dependencies?.["@oripa/site-schema"] !== siteSchemaVersion ||
    testkitPackage.oripaCompatibility?.storefrontClientVersion !== bundleVersion ||
    testkitPackage.oripaCompatibility?.siteSchemaVersion !== siteSchemaVersion ||
    testkitPackage.oripaCompatibility?.publicApiOperationCount !== 74) {
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
  "PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES",
  "PUBLIC_PAYMENT_CARD_CAPACITY_FIXTURES",
  "PUBLIC_PAYMENT_CARD_REGISTRATION_PROBLEM_FIXTURES",
  'readonly provider: "fincode";',
  "readonly is_live_mode: false;",
  'readonly status: "requires_action";',
  'readonly status: "completed";',
  'readonly saved_card_id: "0198a001-0000-7000-8000-000000009802";',
  "readonly registration_remaining: 0;",
  'readonly next_capacity_at: "2026-08-29T12:15:00Z";',
  "PUBLIC_PAYMENT_GRANT_FIXTURES",
  "readonly limited_bonus_points: 2000;",
  "readonly total_points: 13000;",
]) {
  if (!testkitFixtures.includes(paymentFixture)) {
    throw new Error(`Canonical Payment Testkit fixture is missing: ${paymentFixture}`);
  }
}
for (const accountSecurityFixture of [
  "PUBLIC_ACCOUNT_SECURITY_FIXTURE",
  "PUBLIC_ACCOUNT_SECURITY_PROBLEM_FIXTURES",
  "readonly authenticated: false;",
  "readonly initiating_session_preserved: true;",
  "readonly session_rotated: true;",
  'readonly code: "INVALID_PASSWORD_RESET";',
  'readonly code: "PASSWORD_POLICY_VIOLATION";',
  'readonly code: "EMAIL_UNCHANGED";',
  'readonly code: "EMAIL_ALREADY_CLAIMED";',
  'readonly code: "INVALID_EMAIL_CHANGE_REQUEST";',
  'readonly code: "PASSWORD_UNCHANGED";',
  'readonly code: "INVALID_REAUTHENTICATION";',
]) {
  if (!testkitFixtures.includes(accountSecurityFixture)) {
    throw new Error(`Canonical Account Security Testkit fixture is missing: ${accountSecurityFixture}`);
  }
}

const schemaArchive = path.join(schemaVendor, referencedSiteSchema.file);
if (sha256(schemaArchive) !== referencedSiteSchema.sha256) throw new Error("Referenced Site Schema digest mismatch");
const schemaPackage = archiveJson(schemaArchive);
if (schemaPackage.name !== referencedSiteSchema.name || schemaPackage.version !== siteSchemaVersion) {
  throw new Error("Referenced Site Schema identity mismatch");
}
const currentOpenApi = readFileSync(path.join(vendor, "public.openapi.json"));
const retainedOpenApi = readFileSync(path.join(retainedVendor, "public.openapi.json"));
const openApi = JSON.parse(currentOpenApi.toString("utf8"));
const predecessorOpenApi = JSON.parse(retainedOpenApi.toString("utf8"));
const operationIds = (document) => new Set(Object.values(document.paths ?? {}).flatMap((pathItem) =>
  Object.values(pathItem).flatMap((operation) => operation?.operationId ? [operation.operationId] : [])));
const currentOperations = operationIds(openApi);
const predecessorOperations = operationIds(predecessorOpenApi);
const expectedAddedOperations = [
  "changeUserPassword",
  "completeEmailChange",
  "createEmailChangeRequest",
];
const actualAddedOperations = [...currentOperations].filter((operation) => !predecessorOperations.has(operation)).sort();
if ([...predecessorOperations].some((operation) => !currentOperations.has(operation)) ||
    JSON.stringify(actualAddedOperations) !== JSON.stringify(expectedAddedOperations)) {
  throw new Error("Public OpenAPI additive operation set mismatch");
}
if (openApi.info?.version !== publicApiVersion || currentOperations.size !== 74 ||
    !openApi.paths?.["/me/payment-card-ui-bootstrap"]?.get ||
    !openApi.paths?.["/payments"]?.post ||
    !openApi.paths?.["/payments/{payment_id}"]?.get ||
    !openApi.paths?.["/me/payment-card-registrations"]?.post ||
    !openApi.paths?.["/me/payment-card-registrations/{registration_id}"]?.get ||
    !openApi.paths?.["/me/payment-card-registrations/{registration_id}/reconcile"]?.post ||
    !openApi.paths?.["/me/payment-card-registrations/{registration_id}/cancel"]?.post ||
    !openApi.paths?.["/payment-card-registration-returns/fincode/normal"]?.post ||
    !openApi.paths?.["/payment-card-registration-returns/fincode/failure"]?.post ||
    !openApi.paths?.["/auth/password/forgot"]?.post ||
    !openApi.paths?.["/auth/password/reset"]?.post ||
    !openApi.paths?.["/me/email-change-requests"]?.post ||
    !openApi.paths?.["/me/email-change-requests/{email_change_request_id}/complete"]?.post ||
    !openApi.paths?.["/me/password"]?.put) {
  throw new Error("Canonical Public OpenAPI Payment contract mismatch");
}
const registrationSchema = openApi.components?.schemas?.PaymentCardRegistration;
const capacitySchema = openApi.components?.schemas?.PaymentCardCollection?.properties?.limits?.properties;
if (JSON.stringify(openApi.components?.schemas?.PaymentCardRegistrationStatus?.enum) !==
      JSON.stringify(["pending", "requires_action", "completed", "failed", "canceled", "expired"]) ||
    registrationSchema?.properties?.saved_card_id?.description?.includes("completed") !== true ||
    !capacitySchema?.registration_remaining || !capacitySchema?.next_capacity_at) {
  throw new Error("Canonical Card Registration schema mismatch");
}

const packageJsonText = readFileSync(path.join(root, "package.json"), "utf8");
const lockfileText = readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
for (const content of [packageJsonText, lockfileText]) {
  if (/file:(?:\/var\/|\/home\/|[A-Za-z]:\\)/.test(content)) {
    throw new Error("Server-specific file dependency");
  }
  for (const required of [
    "vendor/oripa/GOV-025/oripa-storefront-client-2.0.0-alpha.33.tgz",
    "vendor/oripa/GOV-025/oripa-storefront-testkit-2.0.0-alpha.33.tgz",
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
  "vendor/oripa/GOV-023/oripa-storefront-client-2.0.0-alpha.32.tgz",
  "vendor/oripa/GOV-023/oripa-storefront-testkit-2.0.0-alpha.32.tgz",
  "oripa-storefront-client-2.0.0-alpha.32.tgz",
  "oripa-storefront-testkit-2.0.0-alpha.32.tgz",
  "vendor/oripa/MIG-098/oripa-storefront-client-2.0.0-alpha.31.tgz",
  "vendor/oripa/MIG-098/oripa-storefront-testkit-2.0.0-alpha.31.tgz",
  "vendor/oripa/MIG-096/oripa-storefront-client-2.0.0-alpha.30.tgz",
  "vendor/oripa/MIG-096/oripa-storefront-testkit-2.0.0-alpha.30.tgz",
  "vendor/oripa/MIG-094/oripa-storefront-client-2.0.0-alpha.29.tgz",
  "vendor/oripa/MIG-094/oripa-storefront-testkit-2.0.0-alpha.29.tgz",
  "vendor/oripa/MIG-089/oripa-storefront-client-2.0.0-alpha.28.tgz",
  "vendor/oripa/MIG-089/oripa-storefront-testkit-2.0.0-alpha.28.tgz",
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
