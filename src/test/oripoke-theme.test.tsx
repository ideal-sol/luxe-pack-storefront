import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
