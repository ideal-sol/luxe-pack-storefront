import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { PUBLIC_TOP_BANNERS_FIXTURE } from "@oripa/storefront-testkit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeAssist } from "@/components/catalog/home-assist";
import { HomeBannerCarousel, homeBannerAutoplayIntervalMs } from "@/components/catalog/home-banner-carousel";
import { HomeGuide, homeGuideContent } from "@/components/catalog/home-guide";
import { gachaPriceTier } from "@/components/catalog/gacha-card";
import { HomeHero, homeHeroRibbonMessages } from "@/components/catalog/home-hero";

const theme = readFileSync("src/styles/theme-oripoke.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const fontFaces = readFileSync("src/styles/font-noto-sans-jp.css", "utf8");

describe("オリポケ brand theme", () => {
  it("loads the brand theme after the structural stylesheet", () => {
    expect(layout.indexOf('import "@/styles/globals.css";')).toBeGreaterThan(-1);
    expect(layout.indexOf('import "@/styles/theme-oripoke.css";')).toBeGreaterThan(layout.indexOf('import "@/styles/globals.css";'));
    expect(layout.indexOf('import "@/styles/font-noto-sans-jp.css";')).toBeGreaterThan(-1);
    expect(layout.indexOf('import "@/styles/font-noto-sans-jp.css";')).toBeLessThan(layout.indexOf('import "@/styles/globals.css";'));
  });

  it("serves Noto Sans JP from the site itself instead of an external font host", () => {
    expect(theme).toMatch(/--font-sans: "Noto Sans JP", "Hiragino Sans"/);
    expect(fontFaces).toContain("font-family: 'Noto Sans JP'");
    expect(fontFaces).toContain("font-weight: 100 900");
    expect(fontFaces).toMatch(/url\(\/fonts\/noto-sans-jp\/[^)]+\.woff2\)/);
    expect(fontFaces).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(layout).not.toContain("next/font/google");
  });

  it("keeps the delivered design tokens and accessible focus", () => {
    expect(theme).toContain("--teal: #00beb1");
    expect(theme).toContain("--yellow: #ffca37");
    expect(theme).toContain("--ink: #173a3c");
    expect(theme).toMatch(/--focus-ring: 3px solid/);
    expect(theme).toMatch(/@media \(min-width: 601px\)[\s\S]*\.gacha-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(theme).toMatch(/@media \(min-width: 981px\)[\s\S]*\.gacha-grid \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(theme).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.home-hero__ribbon-track \{[^}]*animation: none/);
  });

  it("does not reintroduce serif display type", () => {
    expect(theme).not.toMatch(/font-family:[^;]*Georgia/);
  });
});

describe("HomeHero", () => {
  it("renders one page heading, catalog and guide actions, and decorative characters", () => {
    const view = render(<HomeHero />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("最高の一枚を、あなたに！");
    expect(screen.getByRole("link", { name: "ガチャ一覧を見る" })).toHaveAttribute("href", "/gachas");
    expect(screen.getByRole("link", { name: "はじめての方へ" })).toHaveAttribute("href", "/pages/guide");
    view.container.querySelectorAll("img").forEach((image) => expect(image).toHaveAttribute("alt", ""));
  });

  it("announces the ribbon messages once and hides the marquee duplicate", () => {
    render(<HomeHero />);
    const list = screen.getByRole("list", { name: "サービスの特長" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(homeHeroRibbonMessages.length);
  });
});

describe("オリポケ animations", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function stubReducedMotion(matches: boolean) {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches,
      removeEventListener: vi.fn(),
    }));
  }

  function banners() {
    const first = PUBLIC_TOP_BANNERS_FIXTURE.response.items[0];
    return [
      first,
      { ...first, id: "0198a001-0000-7000-8000-000000000391", title: "二枚目" },
      { ...first, id: "0198a001-0000-7000-8000-000000000392", title: "三枚目" },
    ];
  }

  it("ports every design motion and stops it for reduced motion", () => {
    for (const name of ["shine", "floaty", "bob", "bob2", "twinkle", "wobble", "pulse", "rise", "sweep", "walk", "breathe", "marquee"]) {
      expect(theme).toContain(`@keyframes oripoke-${name} `);
    }
    const reduced = theme.split("@media (prefers-reduced-motion: reduce)").slice(1).join("\n");
    for (const selector of [".home-hero__sparks", ".home-hero__lightsweep", ".gacha-card::after", ".home-hero__character .home-hero__pokezou", ".home-walk img"]) {
      expect(reduced).toContain(selector);
    }
  });

  it("keeps hero decoration hidden from assistive technology", () => {
    const view = render(<HomeHero />);
    expect(view.container.querySelectorAll(".home-hero__spark")).toHaveLength(16);
    expect(view.container.querySelector(".home-hero__sparks")).toHaveAttribute("aria-hidden", "true");
    expect(view.container.querySelector(".home-hero__lightsweep")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("ポケモンカード専門のオンラインオリパ").querySelectorAll("b[aria-hidden='true']")).toHaveLength(2);
  });

  it("advances the banner carousel automatically, loops, and can be paused", () => {
    stubReducedMotion(false);
    vi.useFakeTimers();
    render(<HomeBannerCarousel banners={banners()} />);
    expect(screen.getByRole("button", { name: "1件目のバナーを表示" })).toHaveAttribute("aria-current", "true");
    act(() => { vi.advanceTimersByTime(homeBannerAutoplayIntervalMs); });
    expect(screen.getByRole("button", { name: "2件目のバナーを表示" })).toHaveAttribute("aria-current", "true");
    act(() => { vi.advanceTimersByTime(homeBannerAutoplayIntervalMs * 2); });
    expect(screen.getByRole("button", { name: "1件目のバナーを表示" })).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "自動再生を停止" }));
    act(() => { vi.advanceTimersByTime(homeBannerAutoplayIntervalMs * 3); });
    expect(screen.getByRole("button", { name: "1件目のバナーを表示" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "自動再生を開始" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not autoplay the carousel when the visitor prefers reduced motion", () => {
    stubReducedMotion(true);
    vi.useFakeTimers();
    render(<HomeBannerCarousel banners={banners()} />);
    act(() => { vi.advanceTimersByTime(homeBannerAutoplayIntervalMs * 2); });
    expect(screen.getByRole("button", { name: "1件目のバナーを表示" })).toHaveAttribute("aria-current", "true");
    expect(screen.queryByRole("button", { name: "自動再生を停止" })).not.toBeInTheDocument();
  });

  it("wraps the manual carousel controls at both ends", () => {
    render(<HomeBannerCarousel banners={banners()} />);
    fireEvent.click(screen.getByRole("button", { name: "前のバナー" }));
    expect(screen.getByRole("button", { name: "3件目のバナーを表示" })).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "次のバナー" }));
    expect(screen.getByRole("button", { name: "1件目のバナーを表示" })).toHaveAttribute("aria-current", "true");
  });

  it("keeps autoplay paused while either keyboard focus or pointer hover remains", () => {
    stubReducedMotion(false);
    vi.useFakeTimers();
    render(<HomeBannerCarousel banners={banners()} />);
    const carousel = screen.getByRole("region", { name: "トップバナー" });
    const first = screen.getByRole("button", { name: "1件目のバナーを表示" });
    fireEvent.focus(first);
    fireEvent.pointerEnter(carousel);
    fireEvent.pointerLeave(carousel);
    act(() => { vi.advanceTimersByTime(homeBannerAutoplayIntervalMs); });
    expect(first).toHaveAttribute("aria-current", "true");
    fireEvent.pointerEnter(carousel);
    fireEvent.blur(first, { relatedTarget: document.body });
    act(() => { vi.advanceTimersByTime(homeBannerAutoplayIntervalMs); });
    expect(first).toHaveAttribute("aria-current", "true");
    fireEvent.pointerLeave(carousel);
    act(() => { vi.advanceTimersByTime(homeBannerAutoplayIntervalMs); });
    expect(screen.getByRole("button", { name: "2件目のバナーを表示" })).toHaveAttribute("aria-current", "true");
  });

  it("uses instant manual scrolling when the visitor prefers reduced motion", () => {
    stubReducedMotion(true);
    const view = render(<HomeBannerCarousel banners={banners()} />);
    const rail = view.container.querySelector<HTMLDivElement>(".home-banners__rail")!;
    rail.scrollTo = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "次のバナー" }));
    expect(rail.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "instant" }));
  });

  it("shows the guide assistant until the visitor closes it", () => {
    render(<HomeAssist />);
    expect(screen.getByRole("link", { name: "はじめての方へ" })).toHaveAttribute("href", "/pages/guide");
    fireEvent.click(screen.getByRole("button", { name: "ご案内を閉じる" }));
    expect(screen.queryByRole("complementary", { name: "ご案内" })).not.toBeInTheDocument();
  });

  it("derives the card frame tier from the unit price only", () => {
    expect(gachaPriceTier(9000)).toBe("hi");
    expect(gachaPriceTier(1000)).toBe("hi");
    expect(gachaPriceTier(500)).toBe("mid");
    expect(gachaPriceTier(300)).toBe("mid");
    expect(gachaPriceTier(150)).toBe("lo");
    expect(gachaPriceTier(0)).toBe("lo");
  });
});

describe("HomeGuide", () => {
  it("shows the fixed coin purchase, payment, flow and assurance sections from the design", () => {
    render(<HomeGuide />);
    for (const name of ["コインの購入", "ご利用の流れ", "安心してご利用いただくために"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    const buyLinks = screen.getAllByRole("link", { name: "コイン購入画面へ" });
    expect(buyLinks).toHaveLength(3);
    buyLinks.forEach((link) => expect(link).toHaveAttribute("href", "/points"));
    expect(screen.getByRole("heading", { level: 3, name: "購入前の確認事項" })).toBeInTheDocument();
    expect(screen.getAllByText(/^STEP \d$/)).toHaveLength(4);
  });

  it("keeps site-wide Coin terminology in the fixed copy", () => {
    expect(JSON.stringify(homeGuideContent)).not.toMatch(/ポイント|\dpt\b/);
  });
});
