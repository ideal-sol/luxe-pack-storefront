// @vitest-environment node
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateBrandManifest, serializeBrandManifest, verifyBrandManifest, manifestPath } from "../../scripts/brand-assets.mjs";

it("checks all 27 paths, keys, MIME signatures, bytes and SHA-256 against retained files", () => {
  const text = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(text);
  verifyBrandManifest(manifest);
  expect(manifest.files).toHaveLength(27);
  expect(text).toBe(serializeBrandManifest(generateBrandManifest()));
  expect(text).toBe(serializeBrandManifest(generateBrandManifest()));
  expect(manifest.files.filter((file) => !file.relative_path.includes("/"))).toHaveLength(13);
  expect(manifest.files.filter((file) => file.relative_path.startsWith("icons/"))).toHaveLength(9);
  expect(manifest.files.filter((file) => file.relative_path.startsWith("login-bonus/"))).toHaveLength(3);
  expect(manifest.files.filter((file) => file.relative_path.startsWith("payments/"))).toHaveLength(2);
});
it.each(["relative_path", "object_key", "content_type", "byte_size", "sha256"])("rejects incorrect %s", (field) => {
  const manifest = generateBrandManifest();
  manifest.files[0][field] = manifest.files[1][field];
  if (field === "content_type") manifest.files[0][field] = "text/plain";
  expect(() => verifyBrandManifest(manifest)).toThrow();
});
it("preserves all prior immutable keys and rejects modified supplied logos or existing assets", () => {
  const root = mkdtempSync(join(tmpdir(), "brand-manifest-"));
  try {
    cpSync("public/brand", root, { recursive: true });
    const before = generateBrandManifest(root);
    const added = "sd_orika_touroku.webp";
    writeFileSync(join(root, added), Buffer.concat([readFileSync(join(root, added)), Buffer.from([0])]));
    expect(() => generateBrandManifest(root)).toThrow("Existing pre-registration Brand assets changed");
    expect(() => verifyBrandManifest(before, root)).toThrow();
    cpSync("public/brand/sd_orika_touroku.webp", join(root, added));
    const logo = "payments/paidy-logo.png";
    writeFileSync(join(root, logo), Buffer.concat([readFileSync(join(root, logo)), Buffer.from([0])]));
    expect(() => generateBrandManifest(root)).toThrow("Supplied Payment logo changed");
    cpSync(`public/brand/${logo}`, join(root, logo));
    writeFileSync(join(root, "mark.svg"), `${readFileSync(join(root, "mark.svg"), "utf8")}\n`);
    expect(() => generateBrandManifest(root)).toThrow("Existing Brand assets changed");
    writeFileSync(join(root, "extra.svg"), "<svg />");
    expect(() => generateBrandManifest(root)).toThrow("exactly 27");
    unlinkSync(join(root, "extra.svg"));
    writeFileSync(join(root, "mark.svg"), "wrong format");
    expect(() => generateBrandManifest(root)).toThrow("MIME");
    unlinkSync(join(root, "mark.svg"));
    expect(() => generateBrandManifest(root)).toThrow("exactly 27");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
