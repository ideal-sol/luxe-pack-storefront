import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const vendor = path.join(root, "vendor/oripa/SHIPONLY-20260926");
const retainedVendor = path.join(root, "vendor/oripa/DRAW-20260925");
const schemaVendor = path.join(root, "vendor/oripa/MIG-063B");
const bundleVersion = "2.0.0-alpha.41";
const predecessorBundleVersion = "2.0.0-alpha.40";
const publicApiVersion = "2.0.0-alpha.37";
const siteSchemaVersion = "2.0.0-alpha.23";
const sourceCommit = "e2b30805704ed5b9c3fd54492fb86f8b8549bde5";
const expected = new Map([
  [
    "SHA256SUMS",
    "fd6601d8e73abda53188d198f5a1a200bc545ca9143b67510f8bdef37a817c81"
  ],
  [
    "artifact-manifest.json",
    "b3c7d2a28c0c8332eeea90ac43876245baf4a1e4ce6b7d4f646124212d99f7ee"
  ],
  [
    "oripa-storefront-client-2.0.0-alpha.41.tgz",
    "3565505ed851df91a1ee4b9eeef1a94caae706a6b47725ef1472e5d5048f6f72"
  ],
  [
    "oripa-storefront-testkit-2.0.0-alpha.41.tgz",
    "56892eafca206e8f504144937169a7ed2974da6f14082347616abafda013bd59"
  ],
  [
    "public.openapi.json",
    "2ef9d4d085ad29e4073f6e963d93b68b9e1ecfd8000dc84a330a8a016f30be4b"
  ]
]);
const retainedExpected = new Map([
  [
    "SHA256SUMS",
    "0388b497e2f5e559de599949996cb1b1f1a22fb35e8f39f8e5fbf7a9ecce398b"
  ],
  [
    "artifact-manifest.json",
    "5fba7399e21cff0226e9ae43a9a3fa73dc7c61a0716ce00787b0f4b931778a59"
  ],
  [
    "oripa-storefront-client-2.0.0-alpha.40.tgz",
    "724ff53616a5c05fd73a0570fd2c1455fc762a64bfa9936e61b73131ed5d2d99"
  ],
  [
    "oripa-storefront-testkit-2.0.0-alpha.40.tgz",
    "555705b61664116144da8b7ea3a87dca1ff0066e4b027bdbba87e2e7750b052e"
  ],
  [
    "public.openapi.json",
    "b469064b322d99b125995031aadfe765907651e014c003ccc82997a91843cd23"
  ]
]);
const publishedPackages = new Map([
  ["@oripa/storefront-client", {
    file: "oripa-storefront-client-2.0.0-alpha.41.tgz",
    version: bundleVersion,
  }],
  ["@oripa/storefront-testkit", {
    file: "oripa-storefront-testkit-2.0.0-alpha.41.tgz",
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
  if (sha256(path.join(retainedVendor, file)) !== digest) throw new Error(`Retained alpha.40 digest mismatch: ${file}`);
}
const retainedInventory = readdirSync(retainedVendor).sort();
const expectedRetainedInventory = [...retainedExpected.keys(), "PROVENANCE.md"].sort();
if (JSON.stringify(retainedInventory) !== JSON.stringify(expectedRetainedInventory)) {
  throw new Error("Retained alpha.40 inventory mismatch");
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
  "oripa-storefront-client-2.0.0-alpha.41.tgz",
  "oripa-storefront-testkit-2.0.0-alpha.41.tgz",
  "public.openapi.json",
]) {
  if (sums.get(file) !== expected.get(file)) throw new Error(`SHA256SUMS mismatch: ${file}`);
}
if (sums.size !== 3) throw new Error("SHA256SUMS entry set is invalid");

const manifest = JSON.parse(readFileSync(path.join(vendor, "artifact-manifest.json"), "utf8"));
if (manifest.task_id !== "SHIPONLY-20260926" || manifest.source_commit !== sourceCommit) {
  throw new Error("Artifact provenance mismatch");
}
if (manifest.bundle?.version !== bundleVersion || manifest.bundle?.predecessor !== predecessorBundleVersion ||
    manifest.bundle?.release_mode !== "contract-additive" || manifest.bundle?.immutable !== true) {
  throw new Error("Contract-breaking bundle declaration mismatch");
}
if (manifest.public_openapi?.file !== "public.openapi.json" ||
    manifest.public_openapi?.version !== publicApiVersion ||
    manifest.public_openapi?.sha256 !== expected.get("public.openapi.json") ||
    manifest.public_openapi?.operation_count !== 76 ||
    manifest.public_openapi?.breaking_change !== false) {
  throw new Error("Referenced Public OpenAPI manifest entry mismatch");
}
const manifestPackages = new Map((manifest.packages ?? []).map((entry) => [entry.name, entry]));
for (const [name, expectedPackage] of publishedPackages) {
  const entry = manifestPackages.get(name);
  if (entry?.disposition !== "published" || entry.browser_compatible !== true || entry.file !== expectedPackage.file ||
      entry.version !== expectedPackage.version || entry.sha256 !== expected.get(expectedPackage.file) ||
      name === "@oripa/storefront-client" && !entry.required_capabilities?.includes("identity.sms-phone-ownership.v2")) {
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
for (const value of [bundleVersion, publicApiVersion, siteSchemaVersion, sourceCommit, "SHIPONLY-20260926", "36223277643", "10900150259", "6d4cf321249d46145f22ce9551ba709a51dd59453ccbe0bd5004d0782d2dfb50", ...expected.values(), referencedSiteSchema.sha256]) {
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
const clientReadbackDirectory = mkdtempSync(path.join(tmpdir(), "site-alpha37-client-"));
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
  "UserPasswordReauthenticationRequest: {",
  "SmsVerificationSendRequest: {",
  "SmsVerificationConfirmRequest: {",
  "SmsVerificationChallenge: {",
  "SmsVerificationAccepted: {",
  "SmsVerificationStatus: {",
  'status: "pending" | "accepted" | "failed" | "expired";',
  'delivery_state?: "pending" | "accepted" | "failed";',
  "verified_at?: string | null;",
  'next_action: "login";',
  "initiating_session_preserved: boolean;",
  "session_rotated: boolean;",
  "GachaRankPresentation: {",
  "rank_id: components[\"schemas\"][\"OpaqueId\"];",
  "rank_name: string;",
  "lineup_image: components[\"schemas\"][\"PresentationAsset\"];",
  "show_total_stock: boolean;",
  "total_stock: number | null;",
  "display_order: number;",
  "current_video: components[\"schemas\"][\"PresentationAsset\"];",
  "DrawResult: {",
  "rank_name_snapshot: string | null;",
  "result_image_snapshot: components[\"schemas\"][\"NullablePresentationAsset\"];",
  "video_snapshot: components[\"schemas\"][\"NullablePresentationAsset\"];",
]) {
  if (!generatedTypes.includes(declaration)) throw new Error(`Retained Client type is missing: ${declaration}`);
}
for (const legacyDeclaration of ["RankDisplay: {", "presentation_assets:"]) {
  if (generatedTypes.includes(legacyDeclaration)) {
    throw new Error(`Legacy Rank Client type remains: ${legacyDeclaration}`);
  }
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
    !contactDeclarations.includes("options: BrowserContactSubmissionOptions") ||
    !contactDeclarations.includes("idempotency_key: string;") ||
    !contactRuntime.includes("idempotency_key: options.idempotency_key") ||
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
  "reauthenticateUserPassword",
  "validateAdvertisingCode",
  "getSmsVerificationStatus",
  "sendSmsVerification",
  "resendSmsVerification",
  "verifySmsCode",
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
  '"/me/password/reauthenticate"',
  '"/me/sms-verification"',
  '"/me/sms-verification/resend"',
  '"/me/sms-verification/verify"',
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
    testkitPackage.oripaCompatibility?.publicApiOperationCount !== 76) {
  throw new Error("Testkit mixed-version dependency declaration mismatch");
}
const testkitFixtures = archiveText(testkitArchive, "package/dist/fixtures.d.ts");
if (!testkitFixtures.includes("PUBLIC_ADVERTISING_ATTRIBUTION_FIXTURES")) {
  throw new Error("Advertising attribution fixtures missing");
}
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
for (const smsFixture of [
  "PUBLIC_SMS_VERIFICATION_FIXTURES",
  'readonly delivery_state: "pending";',
  'readonly delivery_state: "accepted";',
  'readonly delivery_state: "failed";',
  'readonly phone: "+819012345678";',
  'readonly code: "PHONE_NUMBER_UNAVAILABLE";',
  'readonly code: "INVALID_SMS_VERIFICATION";',
  'readonly code: "SMS_VERIFICATION_REQUIRED";',
  "readonly retry_after_seconds: 59;",
]) {
  if (!testkitFixtures.includes(smsFixture)) {
    throw new Error(`Canonical SMS Verification Testkit fixture is missing: ${smsFixture}`);
  }
}
for (const rankFixture of [
  "PUBLIC_CATALOG_FIXTURE",
  'readonly rank_name: "Sランク";',
  'readonly alt_text: "Sランク景品ラインナップ";',
  "readonly show_total_stock: true;",
  "readonly total_stock: 10;",
  "readonly display_order: 10;",
  'readonly media_type: "video";',
  'readonly alt_text: "Sランク抽選演出";',
]) {
  if (!testkitFixtures.includes(rankFixture)) {
    throw new Error(`Canonical Rank Testkit fixture is missing: ${rankFixture}`);
  }
}
const catalogFixtureDeclaration = testkitFixtures.slice(
  testkitFixtures.indexOf("readonly ranks:"),
  testkitFixtures.indexOf("readonly prizes:", testkitFixtures.indexOf("readonly ranks:")),
);
for (const legacyFixtureField of ["readonly code:", "readonly prizes:", "readonly presentation_assets:"]) {
  if (catalogFixtureDeclaration.includes(legacyFixtureField)) {
    throw new Error(`Legacy Rank Testkit fixture remains: ${legacyFixtureField}`);
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
const expectedAddedOperations = [];
const actualAddedOperations = [...currentOperations].filter((operation) => !predecessorOperations.has(operation)).sort();
if ([...predecessorOperations].some((operation) => !currentOperations.has(operation)) ||
    JSON.stringify(actualAddedOperations) !== JSON.stringify(expectedAddedOperations)) {
  throw new Error("Public OpenAPI operation set mismatch");
}
if (openApi.info?.version !== publicApiVersion || currentOperations.size !== 76 ||
    !openApi.paths?.["/catalog/presentation-assets/{asset_id}/content"]?.get ||
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
    !openApi.paths?.["/me/password"]?.put ||
    !openApi.paths?.["/me/password/reauthenticate"]?.post ||
    !openApi.paths?.["/me/sms-verification"]?.get ||
    !openApi.paths?.["/me/sms-verification"]?.post ||
    !openApi.paths?.["/me/sms-verification/resend"]?.post ||
    !openApi.paths?.["/me/sms-verification/verify"]?.post) {
  throw new Error("Canonical Public OpenAPI retained-operation contract mismatch");
}
const validation = openApi.paths?.["/advertising-code-validation"]?.get;
if (validation?.operationId !== "validateAdvertisingCode" ||
    !identityRuntime.includes('`/advertising-code-validation?')) {
  throw new Error("Advertising validation operation mismatch");
}
for (const name of ["UserRegistrationRequest", "ExternalIdentityStartRequest"]) {
  const schema = openApi.components?.schemas?.[name];
  if (schema?.properties?.advertising_code?.$ref !== "#/components/schemas/AdvertisingCodeCandidate" ||
      schema?.required?.includes("advertising_code")) {
    throw new Error(`Optional advertising candidate contract mismatch: ${name}`);
  }
}
const contactOperation = openApi.paths?.["/contact-inquiries"]?.post;
const contactInput = openApi.components?.schemas?.CreateContactInquiryRequest;
if (contactOperation?.["x-idempotency"] !== "required" ||
    JSON.stringify(contactOperation?.security) !== JSON.stringify([{ userSession: [] }]) ||
    !contactOperation?.parameters?.some((parameter) => parameter.$ref === "#/components/parameters/IdempotencyKey") ||
    contactInput?.properties?.inquiry_id?.$ref !== "#/components/schemas/OpaqueId" ||
    contactInput?.required?.includes("inquiry_id") ||
    contactOperation?.responses?.["202"]?.content?.["application/json"]?.schema?.$ref !== "#/components/schemas/ContactInquiryReceipt") {
  throw new Error("Canonical authenticated Contact follow-up contract mismatch");
}
const rankSchema = openApi.components?.schemas?.GachaRankPresentation;
const gachaDetailSchema = openApi.components?.schemas?.GachaDetail;
const rankReferenceSchema = openApi.components?.schemas?.RankReference;
const drawResultSchema = openApi.components?.schemas?.DrawResult;
if (rankSchema?.additionalProperties !== false ||
    JSON.stringify(rankSchema?.required) !== JSON.stringify([
      "rank_id", "rank_name", "lineup_image", "show_total_stock", "total_stock", "display_order", "current_video",
    ]) ||
    rankSchema?.properties?.total_stock?.type?.[1] !== "null" ||
    gachaDetailSchema?.properties?.ranks?.items?.$ref !== "#/components/schemas/GachaRankPresentation" ||
    rankReferenceSchema?.properties?.code !== undefined ||
    openApi.components?.schemas?.RankDisplay !== undefined ||
    drawResultSchema?.properties?.rank_name_snapshot === undefined ||
    drawResultSchema?.properties?.result_image_snapshot?.$ref !== "#/components/schemas/NullablePresentationAsset" ||
    drawResultSchema?.properties?.video_snapshot?.$ref !== "#/components/schemas/NullablePresentationAsset") {
  throw new Error("Canonical Rank and Draw snapshot schema mismatch");
}
const lineupPrizeSchema = openApi.components?.schemas?.GachaLineupPrize;
if (gachaDetailSchema?.properties?.prizes?.items?.$ref !== "#/components/schemas/GachaLineupPrize" ||
    JSON.stringify(lineupPrizeSchema?.required) !== JSON.stringify(["id", "name", "rank_id", "presentation_asset", "total_inventory", "display_order"]) ||
    lineupPrizeSchema?.properties?.total_inventory?.type !== "integer" ||
    lineupPrizeSchema?.properties?.total_inventory?.minimum !== 0 ||
    lineupPrizeSchema?.properties?.presentation_asset?.$ref !== "#/components/schemas/NullablePresentationAsset" ||
    drawResultSchema?.properties?.rank_lineup_image?.$ref !== "#/components/schemas/NullablePresentationAsset" ||
    openApi.components?.schemas?.DrawPrizeReference?.properties?.presentation_asset?.$ref !== "#/components/schemas/NullablePresentationAsset" ||
    !generatedTypes.includes('prizes?: components["schemas"]["GachaLineupPrize"][];') ||
    !generatedTypes.includes('rank_lineup_image?: components["schemas"]["NullablePresentationAsset"];')) {
  throw new Error("Canonical Prize image, quantity and Rank lineup contract mismatch");
}

for (const schemaName of ["GachaLineupPrize", "UserPrize"]) {
  const schema = openApi.components?.schemas?.[schemaName];
  if (schema?.properties?.shipping_only?.type !== "boolean") {
    throw new Error(`Shipping-only snapshot contract missing: ${schemaName}`);
  }
  const declaration = generatedTypes.split(`${schemaName}: {`)[1]?.split("\n        };")[0];
  if (!declaration?.includes("shipping_only?: boolean;")) {
    throw new Error(`Generated shipping-only field missing: ${schemaName}`);
  }
}
if (!openApi.components?.schemas?.UserPrizeActionUnavailableReason?.enum?.includes("shipping_only") ||
    !generatedTypes.includes('"exchange_points_unavailable" | "shipping_only"') ||
    !testkitFixtures.includes("PUBLIC_SHIPPING_ONLY_PRIZE_FIXTURE") ||
    !testkitFixtures.includes("readonly shipping_only: true;")) {
  throw new Error("Shipping-only action reason or Testkit fixture missing");
}

const drawResponseSchema = openApi.components?.schemas?.DrawResponse;
const drawPresentationSchema = openApi.components?.schemas?.DrawPresentation;
if (drawResponseSchema?.properties?.results?.maxItems !== 1000 ||
    drawResponseSchema?.properties?.high_rank_results?.maxItems !== 20 ||
    drawResponseSchema?.required?.includes("presentation") ||
    JSON.stringify(drawResponseSchema?.properties?.presentation?.oneOf) !== JSON.stringify([
      { $ref: "#/components/schemas/DrawPresentation" }, { type: "null" },
    ]) ||
    drawPresentationSchema?.properties?.rank?.$ref !== "#/components/schemas/RankReference" ||
    drawPresentationSchema?.properties?.video_snapshot?.$ref !== "#/components/schemas/PresentationAsset" ||
    !generatedTypes.includes('presentation?: components["schemas"]["DrawPresentation"] | null;') ||
    !generatedTypes.includes('results?: components["schemas"]["DrawResult"][];')) {
  throw new Error("Canonical Draw presentation/full-results contract mismatch");
}

const registrationSchema = openApi.components?.schemas?.PaymentCardRegistration;
const capacitySchema = openApi.components?.schemas?.PaymentCardCollection?.properties?.limits?.properties;
if (JSON.stringify(openApi.components?.schemas?.PaymentCardRegistrationStatus?.enum) !==
      JSON.stringify(["pending", "requires_action", "completed", "failed", "canceled", "expired"]) ||
    registrationSchema?.properties?.saved_card_id?.description?.includes("completed") !== true ||
    !capacitySchema?.registration_remaining || !capacitySchema?.next_capacity_at) {
  throw new Error("Canonical Card Registration schema mismatch");
}
const smsChallengeSchema = openApi.components?.schemas?.SmsVerificationChallenge;
const smsStatusSchema = openApi.components?.schemas?.SmsVerificationStatus;
if (JSON.stringify(smsChallengeSchema?.properties?.status?.enum) !==
      JSON.stringify(["pending", "accepted", "failed", "expired"]) ||
    JSON.stringify(smsChallengeSchema?.properties?.delivery_state?.enum) !==
      JSON.stringify(["pending", "accepted", "failed"]) ||
    !smsStatusSchema?.properties?.phone ||
    !smsStatusSchema?.properties?.verified_at ||
    !openApi.components?.schemas?.PublicAuthProblemCode?.enum?.includes("PHONE_NUMBER_UNAVAILABLE") ||
    !openApi.components?.schemas?.PublicAuthProblemCode?.enum?.includes("SMS_DELIVERY_UNAVAILABLE") ||
    !openApi.components?.schemas?.FulfillmentProblemCode?.enum?.includes("SMS_VERIFICATION_REQUIRED")) {
  throw new Error("Canonical SMS Verification contract mismatch");
}

const packageJsonText = readFileSync(path.join(root, "package.json"), "utf8");
const lockfileText = readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
for (const content of [packageJsonText, lockfileText]) {
  if (/file:(?:\/var\/|\/home\/|[A-Za-z]:\\)/.test(content)) {
    throw new Error("Server-specific file dependency");
  }
  for (const required of [
    "vendor/oripa/SHIPONLY-20260926/oripa-storefront-client-2.0.0-alpha.41.tgz",
    "vendor/oripa/SHIPONLY-20260926/oripa-storefront-testkit-2.0.0-alpha.41.tgz",
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
  "oripa-storefront-client-2.0.0-alpha.40.tgz",
  "oripa-storefront-testkit-2.0.0-alpha.40.tgz",
  "oripa-storefront-client-2.0.0-alpha.36.tgz",
  "oripa-storefront-testkit-2.0.0-alpha.36.tgz",
  "oripa-storefront-client-2.0.0-alpha.35.tgz",
  "oripa-storefront-testkit-2.0.0-alpha.35.tgz",
  "vendor/oripa/MIG-099/oripa-storefront-client-2.0.0-alpha.34.tgz",
  "vendor/oripa/MIG-099/oripa-storefront-testkit-2.0.0-alpha.34.tgz",
  "oripa-storefront-client-2.0.0-alpha.34.tgz",
  "oripa-storefront-testkit-2.0.0-alpha.34.tgz",
  "vendor/oripa/GOV-025/oripa-storefront-client-2.0.0-alpha.33.tgz",
  "vendor/oripa/GOV-025/oripa-storefront-testkit-2.0.0-alpha.33.tgz",
  "oripa-storefront-client-2.0.0-alpha.33.tgz",
  "oripa-storefront-testkit-2.0.0-alpha.33.tgz",
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
