// Synthetic loopback Browser acceptance only; never Runtime/Production acceptance.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import * as fixtures from "@oripa/storefront-testkit";
const { chromium } = await import(process.env.RANK_BROWSER_PLAYWRIGHT ?? "playwright");
const origin = process.env.RANK_BROWSER_ORIGIN ?? "http://127.0.0.1:3294";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const browser = await chromium.launch({ executablePath: process.env.RANK_BROWSER_CHROMIUM, headless: true, args: ["--no-sandbox"] });
const results = [];
try {
  for (const width of [390, 1280]) {
    for (const scenario of ["cumulative", "empty", "pending", "beginner", "vip", "disabled", "anonymous", "error"]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const rank = structuredClone(fixtures.PUBLIC_MEMBER_RANK_FIXTURES[scenario === "beginner" || scenario === "vip" || scenario === "disabled" ? scenario : "silver"]);
      if (scenario === "cumulative") {
        rank.data.rank_points = rank.data.breakdown.total = 52000;
        rank.data.breakdown.recent = [
          { occurred_at: "2026-11-14T00:00:00Z", kind: "purchase", points: 2000, label: "コイン購入（2,000コイン）" },
          { occurred_at: "2026-11-09T00:00:00Z", kind: "purchase", points: 30000, label: "コイン購入（30,000コイン）" },
          { occurred_at: "2026-11-02T00:00:00Z", kind: "purchase", points: 10000, label: "コイン購入（10,000コイン）" },
        ];
      }
      if (scenario === "empty") rank.data.breakdown.recent = [];
      if (scenario === "pending") rank.data.next_rank.remaining = 0;
      let rankRequests = 0;
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (!url.pathname.startsWith("/api/v2/")) return route.continue();
        assert.equal(route.request().headers()["x-oripa-client-version"], "2.0.0-alpha.51");
        const path = url.pathname.slice("/api/v2".length);
        let body = { data: [], items: [], next_cursor: null };
        if (path === "/auth/session") body = scenario === "anonymous" ? { authenticated: false, user: null } : fixtures.PUBLIC_AUTH_FIXTURE.authenticated_session;
        if (path === "/me/wallet") body = fixtures.PUBLIC_POINT_BALANCE_FIXTURES.positive;
        if (path === "/me/sms-verification") body = { verified: true, phone: null, phone_masked: null, verified_at: null, challenge: null };
        if (path === "/member-ranks") body = fixtures.PUBLIC_MEMBER_RANK_LIST_FIXTURE;
        if (path === "/me/member-rank") {
          rankRequests++;
          if (scenario === "error") return route.fulfill({ status: 500, contentType: "application/problem+json", body: JSON.stringify({ status: 500, title: "Synthetic API error" }) });
          body = rank;
        }
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
      });
      await page.goto(`${origin}/mypage/member-rank`);
      console.log(`Browser scenario ${width}/${scenario}`);
      if (scenario === "disabled") await page.getByRole("heading", { name: "会員ランクは現在ご利用いただけません" }).waitFor();
      else if (scenario === "anonymous") {
        await page.getByText("ログインしてください", { exact: true }).waitFor();
        assert.equal(rankRequests, 0);
      } else if (scenario === "error") await page.getByText("情報を表示できませんでした", { exact: true }).waitFor();
      else {
        await page.getByText("累計ランクポイント", { exact: true }).waitFor();
        assert.equal(await page.locator(".mrank-ladder__step").count(), 7);
        assert.equal(await page.locator(".mrank-ladder__step").first().locator(".mrank-ladder__line").count(), 0);
        const text = await page.locator("body").innerText();
        for (const legacy of ["今月のランクポイント", "集計対象月", "次回リセット", "維持ライン", "降格判定の見送り"]) assert.ok(!text.includes(legacy));
        if (scenario === "cumulative") {
          assert.equal(await page.locator(".mrank-calc li").count(), 4);
          assert.match(await page.locator(".mrank-calc .is-sum").innerText(), /52,000/);
          assert.ok(text.includes("受領済みです。"));
        }
        if (scenario === "empty") { assert.ok(text.includes("コインの購入履歴はありません")); assert.match(await page.locator(".is-sum").innerText(), /42,000/); }
        if (scenario === "pending") { assert.ok(text.includes("条件到達・ランク反映待ち")); assert.equal(await page.locator(".mrank-card__name").innerText(), "シルバー"); }
        if (scenario === "beginner") assert.ok(text.includes("付与対象・今後の受領を保証するものではありません"));
        if (scenario === "vip") assert.ok(text.includes("いちばん上のランクです"));
      }
      assert.deepEqual(errors, []);
      results.push({ width, scenario, result: "PASS" });
      await context.close();
    }
  }
} finally { await browser.close(); }
writeFileSync(process.env.RANK_BROWSER_REPORT ?? "/tmp/SF-RANK-alpha49-browser.json", JSON.stringify({ synthetic: true, runtime_acceptance: false, results }, null, 2));
console.log(`member-rank browser: ${results.length} PASS`);
