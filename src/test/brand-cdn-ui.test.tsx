import { cleanup, render } from "@testing-library/react";
import { HomeHero } from "@/components/catalog/home-hero";
import { HomeGuide } from "@/components/catalog/home-guide";
import { HomeAssist } from "@/components/catalog/home-assist";
import { HomeLoginBonus } from "@/components/catalog/home-login-bonus";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import { ToastProvider } from "@/components/common/toast-provider";
import { brandAssetUrl } from "@/lib/brand-assets";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_STATIC_ASSET_BASE_URL", "https://cdn.example.test/static-assets");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "オリポケ");
});
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/auth/session-provider", () => ({ useSession: () => ({ state: { status: "unauthenticated" } }) }));
vi.mock("@/components/points/point-client-provider", () => ({ usePointClient: () => ({ wallet: { status: "idle" } }) }));
afterEach(cleanup);
afterAll(() => vi.unstubAllEnvs());

it("renders versioned Logo, Mark, login bonus and character references in HTML", () => {
  const view = render(<PublicClientProvider client={null}><ToastProvider><SiteHeader /><SiteFooter /><HomeHero /><HomeGuide /><HomeAssist /><HomeLoginBonus /></ToastProvider></PublicClientProvider>);
  expect(view.container.querySelector(".wordmark__logo")).toHaveAttribute("src", brandAssetUrl("logo.webp"));
  expect(view.container.querySelector(".wordmark__mark")).toHaveAttribute("src", brandAssetUrl("mark.svg"));
  const sources = Array.from(view.container.querySelectorAll("img"), (img) => img.getAttribute("src"));
  for (const file of ["login-bonus/logbo-adokaku.webp", "login-bonus/logbo-mainichi.webp", "login-bonus/logbo-shokai.webp", "pokezou_sd.webp", "orika_sd.webp", "fukumaru_hashiru.webp", "sd_orika_egao.webp", "sd_pokezou_makasero.webp", "sd_fukumaru_osuwari.webp", "sd_orika_wink.webp"]) expect(sources).toContain(brandAssetUrl(file));
  expect(sources.every((src) => src?.startsWith("https://cdn.example.test/static-assets/brand/sha256-"))).toBe(true);
});
it("exports CloudFront favicon and Apple icon metadata from the root layout", async () => {
  const { metadata } = await import("@/app/layout");
  expect(JSON.stringify(metadata.icons)).toContain(brandAssetUrl("icons/favicon.ico"));
  expect(JSON.stringify(metadata.icons)).toContain(brandAssetUrl("icons/apple-touch-icon.png"));
});
