import { readFileSync } from "node:fs";

const file = "src/components/catalog/gacha-detail.tsx";
const content = readFileSync(file, "utf8");
const directApi = "/api" + "/v2";
const violations = [];

const forbidden = new Map([
  ["direct-api", content.includes(directApi)],
  ["direct-fetch", /\bfetch\s*\(/.test(content)],
  ["session-derived-eligibility", /\buseSession\b/.test(content)],
  ["draw-mutation", /\bcreateDraw\b/.test(content)],
  ["auth-storage", /\b(?:localStorage|sessionStorage)\b/.test(content)],
  ["remaining-derived-state", /remaining_count\s*(?:===|!==|<=|>=|<|>)/.test(content)],
  ["date-derived-state", /publish_(?:start|end)_at\s*(?:===|!==|<=|>=|<|>)/.test(content) || /\bDate\.now\s*\(/.test(content)],
  ["fixed-draw-count-policy", /\[\s*1\s*,\s*5\s*,\s*10\s*,\s*100\s*,\s*1000\s*\]/.test(content)],
  ["point-insufficiency-rule", /(?:point|balance)[^\n]*(?:<=|>=|<|>)[^\n]*(?:price|cost)/i.test(content)],
]);

for (const [name, present] of forbidden) {
  if (present) violations.push(name);
}

for (const required of ["getGachaPresentation", "allowed_draw_counts", "daily_limit", "ineligible_reason", "cta.state"]) {
  if (!content.includes(required)) violations.push(`missing-canonical-field:${required}`);
}

if (violations.length > 0) throw new Error(`Gacha detail boundary violations: ${violations.join(", ")}`);
console.log("gacha-detail-boundary-check: passed");
