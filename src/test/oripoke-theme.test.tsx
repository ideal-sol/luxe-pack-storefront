import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { PUBLIC_TOP_BANNERS_FIXTURE } from "@oripa/storefront-testkit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeAssist } from "@/components/catalog/home-assist";
import { HomeBannerCarousel, homeBannerAutoplayIntervalMs } from "@/components/catalog/home-banner-carousel";
import { HomeGuide, homeGuideContent } from "@/components/catalog/home-guide";
import { GachaCard, gachaPriceTier } from "@/components/catalog/gacha-card";
import { sortGachas } from "@/components/catalog/gacha-sort";
import { homeLiveBandEnabled } from "@/components/catalog/home-live-band";
import { StrictMode } from "react";
import { MotionEffects } from "@/components/common/motion-effects";
import { CountUp } from "@/components/common/count-up";
import { HomeLoginBonus, homeLoginBonusSampleItems } from "@/components/catalog/home-login-bonus";
import { PageTitle } from "@/components/common/page-title";
import { topPriceIndex } from "@/components/catalog/gacha-catalog";
import { brandIcons, brandManifestIcons, usesBrandIcons } from "@/lib/brand-icons";
import manifest from "@/app/manifest";
import { PUBLIC_CATALOG_FIXTURE } from "@oripa/storefront-testkit";
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

describe("オリポケ 作り込み (2026-09-30)", () => {
  const base = PUBLIC_CATALOG_FIXTURE.data;

  it("uses the gold frame for the featured card and the top-priced catalog card only", () => {
    const cheap = { ...base, id: "c", price_points: 50 };
    const view = render(<><GachaCard frame="gold" gacha={cheap} /><GachaCard frame="plain" gacha={{ ...base, id: "p", price_points: 9000 }} /><GachaCard gacha={{ ...base, id: "d", price_points: 9000 }} /></>);
    const tiers = Array.from(view.container.querySelectorAll(".gacha-card")).map((card) => card.getAttribute("data-price-tier"));
    expect(tiers).toEqual(["hi", "plain", "hi"]);
    expect(topPriceIndex([{ price_points: 500 }, { price_points: 9000 }, { price_points: 9000 }])).toBe(1);
    expect(topPriceIndex([])).toBe(-1);
  });

  it("keeps a single h1 when the page title band sits above a page with its own heading", () => {
    render(<><PageTitle headingAs="p" title="ガチャ詳細" /><h1>企画名</h1></>);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("ガチャ詳細")).toHaveClass("page-title__heading");
  });

  it("serves the delivered icon set only for the オリポケ site name", () => {
    expect(usesBrandIcons("オリポケ")).toBe(true);
    expect(usesBrandIcons("OripaZ")).toBe(false);
    expect(JSON.stringify(brandIcons)).toContain("/brand/icons/favicon.ico");
    expect(brandManifestIcons.map((icon) => icon.purpose)).toEqual(["any", "any", "maskable"]);
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "オリポケ");
    expect(manifest().icons).toHaveLength(3);
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "OripaZ");
    expect(manifest().icons).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("shows the login bonus section as presentation only", () => {
    render(<HomeLoginBonus />);
    const section = screen.getByRole("region", { name: "無料・ログインボーナス" });
    expect(within(section).getAllByRole("article")).toHaveLength(3);
    expect(within(section).getAllByText("無料")).toHaveLength(2);
    expect(within(section).getByText("1日1回")).toBeInTheDocument();
    // 遷移先が未設定のあいだはリンクにしない
    expect(within(section).queryAllByRole("link")).toHaveLength(0);
    expect(within(section).getByText(/現在はご利用いただけません/)).toBeInTheDocument();
    expect(within(section).getAllByText("準備中")).toHaveLength(3);
    expect(JSON.stringify(homeLoginBonusSampleItems)).not.toMatch(/ポイント|\dpt\b/);
  });

  it("links the login bonus card when a destination is given", () => {
    render(<HomeLoginBonus items={[{ ...homeLoginBonusSampleItems[1]!, href: "/gachas/daily-bonus" }]} />);
    expect(screen.getByRole("link", { name: "毎日1回ログボの詳細を見る" })).toHaveAttribute("href", "/gachas/daily-bonus");
  });

  it("keeps the live band hidden until real data exists", () => {
    expect(homeLiveBandEnabled).toBe(false);
    render(<HomeHero />);
    expect(screen.queryByRole("region", { name: "ただいまの状況" })).not.toBeInTheDocument();
  });

  it("sorts without changing the recommended order and keeps ties stable", () => {
    const a = { ...base, id: "a", price_points: 500, publish_start_at: "2026-09-01T00:00:00Z", remaining_count: 30, total_count: 100 };
    const b = { ...base, id: "b", price_points: 9000, publish_start_at: "2026-09-20T00:00:00Z", remaining_count: 5, total_count: 50 };
    const c = { ...base, id: "c", price_points: 500, publish_start_at: "2026-09-10T00:00:00Z", remaining_count: 80, total_count: 900 };
    const ids = (key: Parameters<typeof sortGachas>[1]) => sortGachas([a, b, c], key).map((gacha) => gacha.id);
    expect(ids("recommended")).toEqual(["a", "b", "c"]);
    expect(ids("price-desc")).toEqual(["b", "a", "c"]);
    expect(ids("remaining-asc")).toEqual(["b", "a", "c"]);
    expect(ids("newest")).toEqual(["b", "c", "a"]);
    expect(ids("total-desc")).toEqual(["c", "a", "b"]);
  });

  it("marks only running-low cards and renders final numbers before any motion", () => {
    const low = { ...base, id: "low", remaining_count: 30, total_count: 100 };
    const plenty = { ...base, id: "plenty", remaining_count: 90, total_count: 100 };
    const soldOut = { ...base, id: "sold", remaining_count: 0, total_count: 100 };
    const view = render(<><GachaCard gacha={low} /><GachaCard gacha={plenty} /><GachaCard gacha={soldOut} /></>);
    expect(view.getAllByText("残りわずか")).toHaveLength(1);
    expect(view.container.querySelectorAll(".count-up")[0]).toHaveTextContent(new Intl.NumberFormat("ja-JP").format(low.price_points));
  });

  it("decorates page titles without exposing decoration to assistive technology", () => {
    const view = render(<PageTitle description="説明" title="会員登録" />);
    expect(screen.getByRole("heading", { level: 1, name: "会員登録" })).toBeInTheDocument();
    view.container.querySelectorAll(".page-title__layer, .page-title__wave").forEach((layer) => expect(layer).toHaveAttribute("aria-hidden", "true"));
  });
});


describe("CountUp accessibility", () => {
  it("keeps the final value readable and stops when reduced motion is enabled", () => {
    let intersect: (entries: { isIntersecting: boolean }[]) => void = () => undefined;
    let changed = () => undefined;
    const motion = { matches: false, addEventListener: vi.fn((_event, callback) => { changed = callback; }), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", vi.fn(() => motion));
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: typeof intersect) { intersect = callback; }
      observe = vi.fn();
      disconnect = vi.fn();
    });
    try {
      const view = render(<CountUp value={1234} />);
      act(() => intersect([{ isIntersecting: false }]));
      expect(view.container.querySelector(".count-up__accessible")).toHaveTextContent("1,234");
      expect(view.container.querySelector(".count-up__visual")).toHaveAttribute("aria-hidden", "true");
      expect(view.container.querySelector(".count-up__visual")).toHaveAttribute("data-count", "0");
      act(() => { motion.matches = true; changed(); });
      expect(view.container.querySelector(".count-up__visual")).toHaveAttribute("data-count", "1,234");
      view.unmount();
      expect(motion.removeEventListener).toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});


it("re-observes reveal targets after Strict Mode effect replay", () => {
  const observers: { observe: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal("IntersectionObserver", class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    constructor() { observers.push(this); }
  });
  try {
    const view = render(<StrictMode><MotionEffects /><article className="gacha-card">企画</article></StrictMode>);
    expect(observers.length).toBeGreaterThan(1);
    expect(observers.at(-1)!.observe).toHaveBeenCalledWith(view.container.querySelector(".gacha-card"));
    view.unmount();
  } finally { vi.unstubAllGlobals(); }
});

it("reveals server-rendered panels without mutating hydration attributes and respects focus/reduced motion", () => {
  let intersect: (entries: { isIntersecting: boolean; target: HTMLElement }[]) => void = () => undefined;
  let changed = () => undefined;
  const motion = { matches: false, addEventListener: vi.fn((_event, callback) => { changed = callback; }), removeEventListener: vi.fn() };
  const animations: { cancel: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal("matchMedia", vi.fn(() => motion));
  vi.stubGlobal("IntersectionObserver", class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    constructor(callback: typeof intersect) { intersect = callback; }
  });
  try {
    const view = render(<><MotionEffects /><form className="auth-form"><input aria-label="test field" /></form><section className="contact-panel" /></>);
    const panels = Array.from(view.container.querySelectorAll<HTMLElement>(".auth-form, .contact-panel"));
    for (const panel of panels) {
      const animation = { cancel: vi.fn() };
      animations.push(animation);
      panel.animate = vi.fn(() => animation as unknown as Animation);
      expect(panel).not.toHaveAttribute("style");
      expect(panel).not.toHaveAttribute("data-reveal");
    }
    act(() => intersect(panels.map((target) => ({ target, isIntersecting: true }))));
    expect(panels[0]!.animate).toHaveBeenCalledOnce();
    fireEvent.focusIn(screen.getByLabelText("test field"));
    expect(animations[0]!.cancel).toHaveBeenCalledOnce();
    act(() => { motion.matches = true; changed(); });
    expect(animations[1]!.cancel).toHaveBeenCalledOnce();
    for (const panel of panels) {
      expect(panel).not.toHaveAttribute("style");
      expect(panel).not.toHaveAttribute("data-reveal");
    }
    view.unmount();
  } finally { vi.unstubAllGlobals(); }
});
