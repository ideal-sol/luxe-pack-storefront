import { brandAssetUrl, brandAssetVersion } from "@/lib/brand-assets";
import manifest from "@/lib/brand-assets.manifest.json";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it("generates all 23 local and immutable CloudFront references from one version", () => {
  for (const file of manifest.files) {
    expect(brandAssetUrl(file.relative_path, "")).toBe(`/brand/${file.relative_path}`);
    for (const env of ["old", "new"]) {
      expect(brandAssetUrl(file.relative_path, `https://${env}.example.test/static-assets`)).toBe(`https://${env}.example.test/${file.object_key}`);
      expect(file.object_key).toBe(`static-assets/brand/${brandAssetVersion}/${file.relative_path}`);
    }
  }
});
it.each(["http://cdn.example.test/static-assets", "https://cdn.example.test", "https://evil.test@cdn.example.test/static-assets", "https://cdn.example.test/static-assets/../admin"])("keeps retained local Brand for malformed base %s", (base) => {
  expect(brandAssetUrl("logo.webp", base)).toBe("/brand/logo.webp");
});
it("rejects paths not present in the manifest", () => {
  expect(() => brandAssetUrl("../logo.webp")).toThrow();
  expect(() => brandAssetUrl("https://evil.example/logo.webp")).toThrow();
});
it("switches favicon, Apple and PWA icons while preserving the app-name condition", async () => {
  vi.stubEnv("NEXT_PUBLIC_STATIC_ASSET_BASE_URL", "https://cdn.example.test/static-assets");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "オリポケ");
  vi.resetModules();
  const { brandIcons, usesBrandIcons } = await import("@/lib/brand-icons");
  const { default: pwa } = await import("@/app/manifest");
  expect(JSON.stringify(brandIcons)).toContain(brandAssetUrl("icons/favicon.ico"));
  expect(JSON.stringify(brandIcons)).toContain(brandAssetUrl("icons/apple-touch-icon.png"));
  expect(pwa().icons).toHaveLength(3);
  for (const icon of pwa().icons!) expect(icon.src).toMatch(/^https:\/\/cdn.example.test\/static-assets\/brand\/sha256-/);
  expect(usesBrandIcons("オリポケ")).toBe(true);
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Other");
  expect(pwa().icons).toBeUndefined();
});
