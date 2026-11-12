import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function verifyRuntime({ executable, actualExecutable, nodeVersion, packageJson, nvmrc, versions, manifest }) {
  if (!isAbsolute(executable) || executable !== actualExecutable) throw new Error("node_executable_mismatch");
  if (nodeVersion !== "v22.23.5" || packageJson.engines.node !== "22.23.5" || nvmrc.trim() !== "22.23.5") {
    throw new Error("node_version_mismatch");
  }
  if (packageJson.packageManager !== "pnpm@10.12.1" || packageJson.engines.pnpm !== "10.12.1"
      || versions.next !== "16.4.2" || versions.client !== "2.0.0-alpha.52" || versions.testkit !== "2.0.0-alpha.52") {
    throw new Error("dependency_version_mismatch");
  }
  if (manifest && (manifest.target !== "old-test" || manifest.node_version !== nodeVersion
      || manifest.pnpm_version !== "10.12.1" || manifest.next_version !== versions.next
      || manifest.client_version !== versions.client || manifest.testkit_version !== versions.testkit
      || manifest.gtm_enabled !== false || manifest.gtm_id !== null)) throw new Error("manifest_toolchain_mismatch");
  return { node_version: nodeVersion, versions, manifest_verified: Boolean(manifest) };
}

async function main() {
  const [binary, manifestPath] = process.argv.slice(2);
  if (!binary || !isAbsolute(binary)) throw new Error("absolute_node_binary_required");
  const require = createRequire(resolve("package.json"));
  const read = (path) => JSON.parse(readFileSync(path, "utf8"));
  const versions = { next: require("next/package.json").version,
    client: read("node_modules/@oripa/storefront-client/package.json").version,
    testkit: read("node_modules/@oripa/storefront-testkit/package.json").version };
  const result = verifyRuntime({ executable: realpathSync(binary), actualExecutable: realpathSync(process.execPath),
    nodeVersion: process.version, packageJson: read("package.json"), nvmrc: readFileSync(".nvmrc", "utf8"), versions,
    manifest: manifestPath ? read(manifestPath) : undefined });
  const nextRequire = createRequire(require.resolve("next/package.json"));
  await nextRequire("next/dist/build/swc").loadBindings();
  const sharp = nextRequire("sharp");
  await sharp({ create: { width: 1, height: 1, channels: 4, background: "white" } }).png().toBuffer();
  console.log(JSON.stringify({ ...result, native_modules: "PASS" }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
