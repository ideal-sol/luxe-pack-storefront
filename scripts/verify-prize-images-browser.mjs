// Run against an existing Preview/dev process with Playwright installed separately.
// Every API call is intercepted; this never performs a real draw or signs in a user.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_CATALOG_FIXTURE, PUBLIC_DRAW_FIXTURE, PUBLIC_GACHA_PRESENTATION_FIXTURE } from "@oripa/storefront-testkit";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const origin = process.env.BROWSER_TEST_ORIGIN ?? "http://127.0.0.1:3000";
const output = process.env.BROWSER_TEST_OUTPUT ?? ".local/browser";
mkdirSync(output, { recursive: true });
const detail = structuredClone(PUBLIC_CATALOG_FIXTURE.data);
const asset = (name) => ({ ...detail.ranks[0].lineup_image, path: `/fixture-images/${name}.svg`, alt_text: name });
detail.ranks[0].lineup_image = asset("rank-landscape");
detail.ranks[1].lineup_image = asset("rank-portrait");
detail.prizes[0].presentation_asset = asset("prize-portrait");
detail.prizes[1].presentation_asset = asset("prize-landscape");
detail.prizes[2].presentation_asset = asset("prize-square");
const draw = structuredClone(PUBLIC_DRAW_FIXTURE);
draw.results = detail.prizes.slice(0, 2).map((prize, index) => ({
  id: `result-${index}`, sequence_number: index + 1, result_type: "prize",
  rank: { id: detail.ranks[0].rank_id, name: detail.ranks[0].rank_name },
  rank_name_snapshot: detail.ranks[0].rank_name,
  rank_lineup_image: detail.ranks[0].lineup_image,
  result_image_snapshot: asset("unused-result-image"), video_snapshot: null,
  prize: { id: prize.id, name: prize.name, presentation_asset: prize.presentation_asset }, point_back: null,
}));
draw.prize_counts = draw.results.map((result) => ({ prize: result.prize, rank: result.rank, count: 1 }));
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const evidence = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(120000);
    const mutations = [];
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let fallback = false;
    await page.route("**/api/v2/**", async (route) => {
      const request = route.request();
      if (request.method() !== "GET") mutations.push(request.method());
      const path = new URL(request.url()).pathname;
      let body = { items: [], next_cursor: null };
      if (path.endsWith("/auth/session")) body = PUBLIC_AUTH_FIXTURE.authenticated_session;
      else if (path.includes("/gachas/by-slug/")) {
        body = { data: structuredClone(detail) };
        if (fallback) body.data.ranks[0].lineup_image.path = "";
      } else if (path.includes("/gacha-presentations/")) body = PUBLIC_GACHA_PRESENTATION_FIXTURE;
      else if (path.includes("/draw-requests/")) {
        body = structuredClone(draw);
        if (fallback) {
          body.results[0].rank_lineup_image = null;
          body.results[0].prize.presentation_asset = null;
        }
      } else if (path.endsWith("/me/wallet")) body = PUBLIC_DRAW_FIXTURE.wallet_after;
      await route.fulfill({ json: body });
    });
    await page.route("**/fixture-images/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const [width, height] = path.includes("portrait") ? [160, 400] : path.includes("landscape") ? [600, 140] : [300, 300];
      await route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#e7d4b0"/><text x="8" y="28" font-size="14">${path.split("/").pop()}</text></svg>` });
    });
    const checkLayout = async (name) => {
      await page.locator(".rank-lineup-image img").first().waitFor();
      await page.locator("img").evaluateAll((images) => images.forEach((image) => { image.loading = "eager"; }));
      await page.waitForFunction(() => [...document.querySelectorAll('.rank-lineup-image img, .prize-rank__prize img, .draw-snapshot-card__image img')].every((image) => image.complete && image.naturalWidth > 0));
      const result = await page.evaluate(() => {
        const rect = (node) => { const { left, right, top, bottom, height, width } = node.getBoundingClientRect(); return { left, right, top, bottom, height, width }; };
        const tiles = [...document.querySelectorAll(".prize-rank__prize, .draw-snapshot-card")];
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          headers: [...document.querySelectorAll(".rank-lineup-image")].map(rect),
          images: [...document.querySelectorAll(".rank-lineup-image img, .prize-rank__prize img, .draw-snapshot-card__image img, .draw-result-card__image img")].map((node) => ({ fit: getComputedStyle(node).objectFit, ...rect(node) })),
          tiles: tiles.map(rect),
          badges: [...document.querySelectorAll(".prize-rank__stock")].map((node) => ({ badge: rect(node), parent: rect(node.parentElement) })),
        };
      });
      assert.equal(result.overflow, false);
      for (const header of result.headers) assert.ok(header.height <= 96 && header.width <= 320);
      for (const image of result.images) assert.ok(image.fit === "contain" && image.width > 0 && image.height > 0);
      for (const { badge, parent } of result.badges) assert.ok(badge.right <= parent.right && badge.bottom <= parent.bottom && badge.left >= parent.left && badge.top >= parent.top);
      for (let i = 0; i < result.tiles.length; i++) for (let j = i + 1; j < result.tiles.length; j++) {
        const a = result.tiles[i], b = result.tiles[j];
        assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
      }
      await page.screenshot({ path: `${output}/${name}-${viewport.width}.png`, fullPage: true });
      evidence.push({ page: name, viewport, ...result });
    };
    await page.goto(`${origin}/gachas/${detail.slug}`);
    await page.locator(".prize-rank__prize").last().waitFor();
    assert.equal(await page.locator(".prize-rank__prize").count(), 4);
    assert.deepEqual(await page.locator(".prize-rank__stock").allTextContents(), ["3点", "5点", "2点"]);
    assert.equal(await page.getByText(/設定総数/).count(), 0);
    assert.equal(await page.locator(".prize-rank").nth(1).locator(".prize-rank__stock").count(), 0);
    await checkLayout("gacha");
    await page.goto(`${origin}/draws/${draw.id}/result`);
    await page.locator(".draw-snapshot-card").last().waitFor();
    assert.deepEqual(await page.locator(".draw-snapshot-card__image img").evaluateAll((nodes) => nodes.map((node) => new URL(node.getAttribute("src"), location.origin).pathname)), draw.results.map((item) => item.prize.presentation_asset.path));
    assert.deepEqual(await page.locator(".draw-snapshot-card .rank-lineup-image img").evaluateAll((nodes) => nodes.map((node) => new URL(node.getAttribute("src"), location.origin).pathname)), draw.results.map((item) => item.rank_lineup_image.path));
    assert.equal(await page.locator(".prize-rank__stock").count(), 0);
    assert.equal(await page.getByText("× 1", { exact: true }).count(), 2);
    await checkLayout("draw");
    fallback = true;
    await page.reload();
    await page.locator(".draw-snapshot-card").first().getByText(detail.ranks[0].rank_name, { exact: true }).waitFor();
    assert.equal(await page.locator(".draw-snapshot-card").first().getByText("PRIZE IMAGE", { exact: true }).count(), 1);
    await page.goto(`${origin}/gachas/${detail.slug}`);
    await page.locator(".prize-rank h3").first().getByText(detail.ranks[0].rank_name, { exact: true }).waitFor();
    assert.deepEqual(mutations, []);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(JSON.stringify({ status: "PASS", scenarios: evidence }, null, 2));
} finally {
  await browser.close();
}
