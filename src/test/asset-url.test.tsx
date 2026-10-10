import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { resolveAssetUrl } from "@/lib/asset-url";
import { CatalogAsset } from "@/components/catalog/catalog-asset";
import { RankLineupImage } from "@/components/catalog/rank-lineup-image";

const invalidPaths = [null, undefined, "", "/admin-assets/a.png", "/admin/a.png", "/fixture/a.png", "/unknown/a.png", "/api" + "/v2/a", "//evil.example/a", "https://evil.example/a", "data:image/png;base64,AA", "/gacha/../a.png", "/gacha/./a.png", "/gacha/%2e%2e/a.png", "/gacha/a%20b.png", "/gacha/a b.png", "/gacha/a?x=1", "/gacha/a#b", "/gacha/a\\b", "/gacha/a\nb", "/gacha/画像.png", "/gacha/", "/gacha//a.png"];
const invalidBases = ["http://cdn.example.test", "//cdn.example.test", "https://cdn.example.test/", "https://cdn.example.test/path", "https://user:pass@cdn.example.test", "https://cdn.example.test?x", "https://cdn.example.test#x", " https://cdn.example.test", "https://cdn.example.test\n", "https://cdn.example.test:443", "https://cdn.example.test/%2e%2e", "https://bad..example.test", "https://bad_.example.test", "garbage"];

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

it.each(["gacha", "top-banner", "rank-masters", "rank-effects"])("preserves %s filename bytes across OLD / NEW", (prefix) => {
  const path = `/${prefix}/2026/10/AbC-d_E.01.webp`;
  for (const env of ["old", "new"]) expect(resolveAssetUrl(path, `https://${env}.example.test`)).toBe(`https://${env}.example.test${path}`);
});
it.each(invalidPaths)("does not generate or render a CDN request for %s", (path) => {
  vi.stubEnv("NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL", "https://cdn.example.test");
  expect(resolveAssetUrl(path)).toBeNull();
  render(<CatalogAsset {...(path === undefined ? {} : { src: path })} />);
  expect(document.querySelector("img")).toBeNull();
  expect(screen.getByText("IMAGE PREPARING")).toBeInTheDocument();
});
it.each(invalidBases)("fails closed for malformed CDN base %s", (base) => {
  expect(resolveAssetUrl("/gacha/image.webp", base)).toBeNull();
});
it("retains legacy local relative images and videos when unset", () => {
  vi.stubEnv("NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL", undefined);
  for (const path of ["/fixtures/prize.png", "/gacha/image.webp", "/rank-effects/video.mp4", "/api" + "/v2/catalog/asset/content"]) expect(resolveAssetUrl(path)).toBe(path);
});
it("keeps Next Image unoptimized and recovers failed images only for a different asset", () => {
  vi.stubEnv("NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL", "https://cdn.example.test");
  const view = render(<CatalogAsset src="/gacha/prize.webp" alt="Prize" />);
  const image = screen.getByRole("img", { name: "Prize" });
  expect(image).toHaveAttribute("src", "https://cdn.example.test/gacha/prize.webp");
  expect(image).not.toHaveAttribute("srcset");
  fireEvent.error(image);
  expect(document.querySelector("img")).toBeNull();
  view.rerender(<CatalogAsset src="/gacha/next.webp" alt="Next" />);
  expect(screen.getByRole("img", { name: "Next" })).toHaveAttribute("src", "https://cdn.example.test/gacha/next.webp");
});
it("resolves rank images and retains the rank name after a CDN failure", () => {
  vi.stubEnv("NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL", "https://cdn.example.test");
  render(<RankLineupImage name="Rank A" image={{ id: "rank", media_type: "image", path: "/rank-masters/Rank_A.png", mime_type: "image/png", checksum_sha256: "0".repeat(64), alt_text: "Rank" }} />);
  const image = screen.getByRole("img", { name: "Rank" });
  expect(image).toHaveAttribute("src", "https://cdn.example.test/rank-masters/Rank_A.png");
  fireEvent.error(image);
  expect(screen.getByText("Rank A")).toBeInTheDocument();
  expect(document.querySelector("img")).toBeNull();
});
