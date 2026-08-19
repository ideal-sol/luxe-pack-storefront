import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const vendor = path.join(root, "vendor/oripa/MIG-063B");
const previousVendor = path.join(root, "vendor/oripa/MIG-062Z");
const version = "2.0.0-alpha.23";
const previousVersion = "2.0.0-alpha.21";
const sourceCommit = "633b41f347083c82028229d6e238842118635feb";
const expected = new Map([
  ["artifact-manifest.json", "556eaf59e9c5128cb9b93cf9000a5aee3ff4eb56f86ee8bc549c392d55bd77fe"],
  ["oripa-site-schema-2.0.0-alpha.23.tgz", "b4ca0ddb0ec8a6f4bda6dfec40fb5f3f5098a837160310be64de97cab36740c2"],
  ["oripa-storefront-client-2.0.0-alpha.23.tgz", "28a7b3558329eed9c608f828948befe2034e86c0add1511bd48db1ed437f58d9"],
  ["oripa-storefront-testkit-2.0.0-alpha.23.tgz", "dc0bf6c16af439bf5a364955e8add936e8842096ca295a136a0f15a86e4102b0"],
  ["public.openapi.json", "5c735fe26514d5bfb47b3515ead108bf473fd5e1f81e0936b7e1986290904043"],
]);
const packageNames = new Map([
  ["oripa-site-schema-2.0.0-alpha.23.tgz", "@oripa/site-schema"],
  ["oripa-storefront-client-2.0.0-alpha.23.tgz", "@oripa/storefront-client"],
  ["oripa-storefront-testkit-2.0.0-alpha.23.tgz", "@oripa/storefront-testkit"],
]);

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function archiveText(archive, entry) {
  return execFileSync("tar", ["-xOf", archive, entry], { encoding: "utf8" });
}

function archiveJson(archive, entry) {
  return JSON.parse(archiveText(archive, entry));
}

for (const [file, digest] of expected) {
  if (sha256(path.join(vendor, file)) !== digest) throw new Error(`Artifact digest mismatch: ${file}`);
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
if (manifest.task_id !== "MIG-063B" || manifest.source_commit !== sourceCommit) {
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

const provenance = readFileSync(path.join(vendor, "PROVENANCE.md"), "utf8");
for (const value of [version, sourceCommit, "MIG-063B", "SITE-032", ...expected.values()]) {
  if (!provenance.includes(value)) throw new Error(`Artifact provenance is incomplete: ${value}`);
}
if (/\/(?:var\/(?:www|lib)|home)\//.test(provenance)) {
  throw new Error("Artifact provenance contains a server-specific path");
}

const sensitivePath = /(?:^|\/)(?:node_modules|\.env[^/]*|[^/]+\.(?:pem|key|p12|pfx))$/i;
for (const [archive, packageName] of packageNames) {
  const archivePath = path.join(vendor, archive);
  const entries = execFileSync("tar", ["-tzf", archivePath], { encoding: "utf8" }).trim().split("\n");
  const verboseEntries = execFileSync("tar", ["-tvzf", archivePath], { encoding: "utf8" }).split("\n");
  if (verboseEntries.some((entry) => /^[lh]/.test(entry))) throw new Error(`Archive links are not allowed: ${archive}`);
  for (const entry of entries) {
    const parts = entry.split("/");
    if (!entry.startsWith("package/") || entry.startsWith("/") || parts.includes("..") || sensitivePath.test(entry)) {
      throw new Error(`Unsafe archive path: ${archive}`);
    }
    const text = execFileSync("tar", ["-xOf", archivePath, entry]).toString("utf8");
    if (/\/(?:var\/(?:www|lib)|home)\//.test(text) ||
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) ||
        /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})/.test(text)) {
      throw new Error(`Unsafe archive content: ${archive}`);
    }
  }
  const packageJson = archiveJson(archivePath, "package/package.json");
  if (packageJson.name !== packageName || packageJson.version !== version) {
    throw new Error(`Package identity mismatch: ${archive}`);
  }
  for (const lifecycle of ["preinstall", "install", "postinstall", "prepare"]) {
    if (packageJson.scripts?.[lifecycle]) throw new Error(`Lifecycle script is not allowed: ${archive}`);
  }
  if (packageName === "@oripa/storefront-testkit" &&
      (packageJson.dependencies?.["@oripa/storefront-client"] !== version || packageJson.dependencies?.["@oripa/site-schema"] !== version)) {
    throw new Error("Testkit dependency versions are not pinned to the handoff Artifact");
  }
}

const clientArchive = path.join(vendor, `oripa-storefront-client-${version}.tgz`);
const generatedTypes = archiveText(clientArchive, "package/dist/generated/public.d.ts");
for (const declaration of [
  'PointProductLimitedBonusState: "active" | "upcoming" | "inactive";',
  'label: "期間限定ボーナスコイン";',
  "amount_text: string | null;",
  'limited_bonus?: components["schemas"]["PointProductLimitedBonus"];',
]) {
  if (!generatedTypes.includes(declaration)) throw new Error(`Limited Bonus Client type is missing: ${declaration}`);
}
if (/limited_bonus\??:\s*[^;]*\|\s*null/.test(generatedTypes)) {
  throw new Error("Limited Bonus Client type must remain optional and non-nullable");
}
const constants = archiveText(clientArchive, "package/dist/constants.js");
if (!constants.includes(`STOREFRONT_CLIENT_VERSION = "${version}"`)) {
  throw new Error("Storefront Client runtime version mismatch");
}
const pointProductClient = archiveText(clientArchive, "package/dist/point-products.d.ts");
if (!pointProductClient.includes("createStorefrontPointProductClient") || !pointProductClient.includes("listPointProducts")) {
  throw new Error("Generated Point Product Client contract is incomplete");
}

const previousOpenApi = JSON.parse(readFileSync(path.join(previousVendor, "public.openapi.json"), "utf8"));
const currentOpenApi = JSON.parse(readFileSync(path.join(vendor, "public.openapi.json"), "utf8"));
if (currentOpenApi.info?.version !== version) throw new Error("Public OpenAPI version mismatch");
const schemas = currentOpenApi.components?.schemas ?? {};
const pointProduct = schemas.PointProduct;
const limitedBonus = schemas.PointProductLimitedBonus;
const limitedBonusPresentation = schemas.PointProductLimitedBonusPresentation;
if (pointProduct?.required?.includes("limited_bonus") ||
    JSON.stringify(pointProduct?.properties?.limited_bonus) !== JSON.stringify({ $ref: "#/components/schemas/PointProductLimitedBonus" })) {
  throw new Error("Point Product limited_bonus must remain optional and non-nullable");
}
if (JSON.stringify(schemas.PointProductLimitedBonusState?.enum) !== JSON.stringify(["active", "upcoming", "inactive"]) ||
    JSON.stringify(limitedBonus?.required) !== JSON.stringify(["amount", "starts_at", "ends_at", "state", "as_of", "presentation"]) ||
    limitedBonus?.properties?.starts_at?.format !== "date-time" ||
    limitedBonus?.properties?.ends_at?.format !== "date-time" ||
    limitedBonus?.properties?.presentation?.$ref !== "#/components/schemas/PointProductLimitedBonusPresentation") {
  throw new Error("Canonical Limited Bonus schema is incomplete");
}
if (JSON.stringify(limitedBonusPresentation?.required) !== JSON.stringify(["is_visible", "label", "amount_text"]) ||
    limitedBonusPresentation?.properties?.is_visible?.type !== "boolean" ||
    limitedBonusPresentation?.properties?.label?.const !== "期間限定ボーナスコイン" ||
    JSON.stringify(limitedBonusPresentation?.properties?.amount_text?.type) !== JSON.stringify(["string", "null"])) {
  throw new Error("Canonical Limited Bonus presentation schema is incomplete");
}

const normalizedOpenApi = structuredClone(currentOpenApi);
normalizedOpenApi.info.version = previousOpenApi.info.version;
delete normalizedOpenApi.components.schemas.PointProductLimitedBonusState;
delete normalizedOpenApi.components.schemas.PointProductLimitedBonusPresentation;
delete normalizedOpenApi.components.schemas.PointProductLimitedBonus;
delete normalizedOpenApi.components.schemas.PointProduct.properties.limited_bonus;
if (JSON.stringify(normalizedOpenApi) !== JSON.stringify(previousOpenApi)) {
  throw new Error(`Public OpenAPI change is not the declared additive Limited Bonus contract from ${previousVersion}`);
}

const testkitArchive = path.join(vendor, `oripa-storefront-testkit-${version}.tgz`);
const testkitFixtures = archiveText(testkitArchive, "package/dist/fixtures.d.ts");
for (const fixture of [
  "PUBLIC_POINT_PRODUCT_FIXTURES",
  'readonly state: "active";',
  'readonly state: "upcoming";',
  'readonly state: "inactive";',
  "readonly is_visible: true;",
  "readonly is_visible: false;",
  'readonly label: "期間限定ボーナスコイン";',
  "readonly amount_text: null;",
]) {
  if (!testkitFixtures.includes(fixture)) throw new Error(`Canonical Limited Bonus Testkit fixture is missing: ${fixture}`);
}
if (testkitFixtures.includes("readonly limited_bonus: null")) {
  throw new Error("Testkit must not publish a non-canonical null Limited Bonus fixture");
}

const siteSchemaArchive = path.join(vendor, `oripa-site-schema-${version}.tgz`);
const previousSiteSchemaArchive = path.join(previousVendor, `oripa-site-schema-${previousVersion}.tgz`);
const previousSiteSchemaEntries = execFileSync("tar", ["-tzf", previousSiteSchemaArchive], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter((entry) => entry !== "package/package.json" && entry !== "package/README.md");
for (const entry of previousSiteSchemaEntries) {
  const previous = execFileSync("tar", ["-xOf", previousSiteSchemaArchive, entry]);
  const current = execFileSync("tar", ["-xOf", siteSchemaArchive, entry]);
  if (!previous.equals(current)) throw new Error(`Site Schema contract changed unexpectedly: ${entry}`);
}

for (const file of ["package.json", "pnpm-lock.yaml"]) {
  const content = readFileSync(path.join(root, file), "utf8");
  if (/file:(?:\/var\/|\/home\/|[A-Za-z]:\\)/.test(content)) {
    throw new Error(`Server-specific file dependency: ${file}`);
  }
  if (!content.includes("vendor/oripa/MIG-063B") || content.includes("file:vendor/oripa/MIG-062Z") || content.includes("2.0.0-alpha.22")) {
    throw new Error(`Production Artifact dependency is not pinned exclusively to MIG-063B alpha.23: ${file}`);
  }
}

console.log("artifact-check: passed");
