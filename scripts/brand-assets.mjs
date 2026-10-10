import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const manifestPath = "src/lib/brand-assets.manifest.json";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const types = { ".webp": "image/webp", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

function filesIn(root, prefix = "") {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return filesIn(root, path);
    if (!entry.isFile()) throw new Error(`Not a regular Brand file: ${path}`);
    return [path];
  }).sort();
}

function contentType(path, bytes) {
  const extension = extname(path);
  const valid = {
    ".png": bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    ".ico": bytes.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0])),
    ".webp": bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP",
    ".svg": /<svg[\s>]/.test(bytes.toString("utf8")),
  };
  if (!types[extension] || !valid[extension]) throw new Error(`Invalid Brand MIME: ${path}`);
  return types[extension];
}

export function generateBrandManifest(root = "public/brand") {
  const paths = filesIn(root);
  if (paths.length !== 23) throw new Error(`Expected exactly 23 Brand files, got ${paths.length}`);
  const entries = paths.map((relative_path) => {
    if (!relative_path.split("/").every((part) => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part))) throw new Error(`Unsafe Brand path: ${relative_path}`);
    const bytes = readFileSync(join(root, relative_path));
    return { relative_path, content_type: contentType(relative_path, bytes), byte_size: bytes.length, sha256: digest(bytes) };
  });
  // Sorted UTF-8 JSON records, no timestamps/environment/bucket inputs.
  const version = `sha256-${digest(JSON.stringify(entries))}`;
  return {
    schema_version: 1,
    version,
    files: entries.map((entry) => ({ ...entry, object_key: `static-assets/brand/${version}/${entry.relative_path}` })),
  };
}

export function serializeBrandManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function verifyBrandManifest(manifest, root = "public/brand") {
  if (manifest.files?.length !== 23) throw new Error("Expected 23 manifest entries");
  for (const field of ["relative_path", "object_key"]) {
    if (new Set(manifest.files.map((entry) => entry[field])).size !== 23) throw new Error(`Duplicate ${field}`);
  }
  if (serializeBrandManifest(manifest) !== serializeBrandManifest(generateBrandManifest(root))) {
    throw new Error("Brand manifest differs from source (path, key, version, MIME, size or SHA-256)");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === "--write") writeFileSync(manifestPath, serializeBrandManifest(generateBrandManifest()));
  else if (mode !== "--check") throw new Error("Usage: node scripts/brand-assets.mjs --write|--check");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  verifyBrandManifest(manifest);
  if (readFileSync(manifestPath, "utf8") !== serializeBrandManifest(manifest)) throw new Error("Non-canonical manifest serialization");
  console.log(`Brand manifest: PASS (${manifest.files.length} files; ${manifest.version})`);
}
