// @vitest-environment node
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateBrandManifest, serializeBrandManifest, verifyBrandManifest, manifestPath } from "../../scripts/brand-assets.mjs";

it("checks all 23 paths, keys, MIME signatures, bytes and SHA-256 against retained files", () => {
  const text = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(text);
  verifyBrandManifest(manifest);
  expect(manifest.files).toHaveLength(23);
  expect(text).toBe(serializeBrandManifest(generateBrandManifest()));
  expect(text).toBe(serializeBrandManifest(generateBrandManifest()));
  expect(manifest.files.filter((file) => !file.relative_path.includes("/"))).toHaveLength(11);
  expect(manifest.files.filter((file) => file.relative_path.startsWith("icons/"))).toHaveLength(9);
  expect(manifest.files.filter((file) => file.relative_path.startsWith("login-bonus/"))).toHaveLength(3);
});
it.each(["relative_path", "object_key", "content_type", "byte_size", "sha256"])("rejects incorrect %s", (field) => {
  const manifest = generateBrandManifest();
  manifest.files[0][field] = manifest.files[1][field];
  if (field === "content_type") manifest.files[0][field] = "text/plain";
  expect(() => verifyBrandManifest(manifest)).toThrow();
});
it("rotates every immutable key after a content change and rejects missing/extra files and wrong MIME", () => {
  const root = mkdtempSync(join(tmpdir(), "brand-manifest-"));
  try {
    cpSync("public/brand", root, { recursive: true });
    const before = generateBrandManifest(root);
    writeFileSync(join(root, "mark.svg"), `${readFileSync(join(root, "mark.svg"), "utf8")}\n`);
    const after = generateBrandManifest(root);
    expect(after.version).not.toBe(before.version);
    expect(after.files.every((file, index) => file.object_key !== before.files[index].object_key)).toBe(true);
    expect(() => verifyBrandManifest(before, root)).toThrow();
    writeFileSync(join(root, "extra.svg"), "<svg />");
    expect(() => generateBrandManifest(root)).toThrow("exactly 23");
    unlinkSync(join(root, "extra.svg"));
    writeFileSync(join(root, "mark.svg"), "wrong format");
    expect(() => generateBrandManifest(root)).toThrow("MIME");
    unlinkSync(join(root, "mark.svg"));
    expect(() => generateBrandManifest(root)).toThrow("exactly 23");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
