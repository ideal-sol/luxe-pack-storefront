import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles/globals.css", "utf8");

describe("visual and responsive convergence", () => {
  it("keeps the reading width and route grids within the agreed responsive structure", () => {
    expect(css).toContain("--content-reading: 800px");
    expect(css).toMatch(/\.gacha-grid \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
    expect(css).toMatch(/@media \(min-width: 720px\)[\s\S]*\.gacha-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).not.toMatch(/\.gacha-grid \{[^}]*repeat\((?:3|4),/);
  });

  it("contains wide content and preserves horizontal scrollers at their component boundary", () => {
    expect(css).toMatch(/html \{[^}]*overflow-x: clip/);
    expect(css).toMatch(/body \{[^}]*overflow-x: clip/);
    expect(css).toMatch(/\.home-banners__rail \{[^}]*overflow-x: auto/);
    expect(css).toMatch(/\.category-links \{[^}]*overflow-x: auto/);
    expect(css).toMatch(/\.catalog-tabs \{[^}]*overflow-x: auto/);
    expect(css).toMatch(/\.safe-content table \{[^}]*overflow-x: auto/);
  });

  it("keeps keyboard focus, touch targets, and mobile tray stacking explicit", () => {
    expect(css).toContain("--focus-ring: 3px solid");
    expect(css).toMatch(/button:focus-visible,[^{]+\{ outline: var\(--focus-ring\)/);
    expect(css).toMatch(/\.prize-modal__close \{[^}]*height: 44px[^}]*width: 44px/);
    expect(css).toMatch(/\.gacha-draw-tray \{[^}]*bottom: calc\(66px \+ env\(safe-area-inset-bottom\)\)/);
    expect(css).toMatch(/\.inventory-action-tray \{[^}]*bottom: calc\(66px \+ env\(safe-area-inset-bottom\)\)/);
  });

  it("contains variable rank labels and clears the fixed Draw tray from the Footer", () => {
    expect(css).toMatch(/\.prize-rank > header \{[^}]*flex-wrap: wrap/);
    expect(css).toMatch(/\.prize-rank > header > div \{[^}]*min-width: 0/);
    expect(css).toMatch(/\.prize-rank > header span \{[^}]*border-radius: 999px[^}]*display: inline-block[^}]*max-width: min\(12rem, 45vw\)[^}]*overflow-wrap: anywhere/);
    expect(css).toMatch(/\.prize-rank h3 \{[^}]*overflow-wrap: anywhere/);
    expect(css).toMatch(/body:has\(\.gacha-draw-tray\) \.site-footer \{[^}]*padding-bottom: calc\(370px \+ env\(safe-area-inset-bottom\)\)/);
    expect(css).toMatch(/@media \(min-width: 720px\)[\s\S]*body:has\(\.gacha-draw-tray\) \.site-footer \{[^}]*padding-bottom: 194px/);
  });
});
