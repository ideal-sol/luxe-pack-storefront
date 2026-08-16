import { readFileSync } from "node:fs";

const panel = readFileSync("src/components/draw/gacha-draw-panel.tsx", "utf8");
const result = readFileSync("src/components/draw/draw-result.tsx", "utf8");
const history = readFileSync("src/components/draw/draw-history-page.tsx", "utf8");
const adapter = readFileSync("src/lib/platform/draw-client.ts", "utf8");
const combined = `${panel}\n${result}\n${history}`;
const directApi = "/api" + "/v2";
const violations = [];

const forbidden = new Map([
  ["direct-api", combined.includes(directApi)],
  ["direct-fetch", /\bfetch\s*\(/.test(combined)],
  ["manual-cookie", /\b(?:document\.cookie|USER_SESSION_COOKIE|USER_XSRF_COOKIE)\b/.test(combined)],
  ["manual-csrf", /\b(?:X-XSRF-TOKEN|XSRF_TOKEN_HEADER|csrf_token)\b/.test(combined)],
  ["persistent-key", /\b(?:localStorage|sessionStorage)\b/.test(combined)],
  ["key-in-url", /(?:href|router\.push)[^\n]*(?:idempotency|idempotencyKey)/i.test(combined)],
  ["fixed-draw-count-policy", /\[\s*1\s*,\s*5\s*,\s*10\s*,\s*100\s*,\s*1000\s*\]/.test(combined)],
  ["point-balance-precheck", /(?:balance|total_points)[^\n]*(?:<=|>=|<|>)[^\n]*(?:price|cost)/i.test(combined)],
  ["optimistic-wallet", /set[A-Za-z]*(?:Point|Wallet|Inventory|Prize)/.test(combined)],
  ["result-resubmits-draw", /\bcreateDraw\b/.test(result)],
  ["component-browser-client-factory", /createBrowserStorefrontDrawClient/.test(combined)],
  ["history-sorts", /\.sort\s*\(/.test(history)],
  ["history-current-gacha-read", /(?:getGacha|listGachas|getGachaPresentation)/.test(history)],
  ["history-count-comparison", /(?:requested_count|executed_count)[^\n]*(?:===|!==|<=|>=|<|>)[^\n]*(?:requested_count|executed_count)/.test(history)],
]);

for (const [name, present] of forbidden) {
  if (present) violations.push(name);
}

for (const required of [
  ["browser-draw-client", adapter.includes("createBrowserStorefrontDrawClient")],
  ["runtime-global-fetch", adapter.includes("fetch: overrides.fetch ?? callGlobalFetch")],
  ["canonical-key", panel.includes("createIdempotencyKey")],
  ["canonical-problem", panel.includes("presentDrawProblem")],
  ["backend-counts", panel.includes("allowed_draw_counts")],
  ["draw-mutation", panel.includes("client.createDraw")],
  ["result-recovery", result.includes("client.getDrawRequest")],
  ["history-read", history.includes("client.listDrawHistory")],
  ["history-presentation", history.includes("entry.gacha.presentation_asset")],
  ["history-status-label", history.includes("entry.status.label")],
  ["history-requested-count", history.includes("entry.requested_count")],
  ["history-executed-count", history.includes("entry.executed_count")],
]) {
  if (!required[1]) violations.push(`missing:${required[0]}`);
}

if (violations.length > 0) throw new Error(`Draw boundary violations: ${violations.join(", ")}`);
console.log("draw-boundary-check: passed");
