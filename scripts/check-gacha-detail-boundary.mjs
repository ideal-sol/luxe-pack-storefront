import { readFileSync } from "node:fs";

const files = [
  "src/components/catalog/gacha-detail.tsx",
  "src/components/draw/gacha-draw-panel.tsx",
];
const content = files.map((file) => readFileSync(file, "utf8")).join("\n");
const detail = readFileSync("src/components/catalog/gacha-detail.tsx", "utf8");
const directApi = "/api" + "/v2";
const violations = [];

const forbidden = new Map([
  ["direct-api", content.includes(directApi)],
  ["direct-fetch", /\bfetch\s*\(/.test(content)],
  ["session-derived-eligibility", /\buseSession\b/.test(content)],
  ["auth-storage", /\b(?:localStorage|sessionStorage)\b/.test(content)],
  ["remaining-derived-state", /remaining_count\s*(?:===|!==|<=|>=|<|>)/.test(content)],
  ["date-derived-state", /publish_(?:start|end)_at\s*(?:===|!==|<=|>=|<|>)/.test(content) || /\bDate\.now\s*\(/.test(content)],
  ["fixed-draw-count-policy", /\[\s*1\s*,\s*5\s*,\s*10\s*,\s*100\s*,\s*1000\s*\]/.test(content)],
  ["point-insufficiency-rule", /(?:point|balance)[^\n]*(?:<=|>=|<|>)[^\n]*(?:price|cost)/i.test(content)],
  ["legacy-rank-code", /\brank\.code\b/.test(detail)],
  ["legacy-rank-assets", /presentation_assets/.test(detail)],
  ["legacy-nested-rank-prizes", /\brank\.prizes\b/.test(detail)],
  ["detail-current-video-playback", /\brank\.current_video\b/.test(detail)],
]);

for (const [name, present] of forbidden) {
  if (present) violations.push(name);
}

for (const required of [
  "getGachaPresentation",
  "allowed_draw_counts",
  "daily_limit",
  "ineligible_reason",
  "cta.state",
  "rank.rank_name",
  "rank.lineup_image",
  "rank.show_total_stock === true",
  "rank.total_stock !== null",
  "left.display_order - right.display_order",
]) {
  if (!content.includes(required)) violations.push(`missing-canonical-field:${required}`);
}

if (violations.length > 0) throw new Error(`Gacha detail boundary violations: ${violations.join(", ")}`);
console.log("gacha-detail-boundary-check: passed");
