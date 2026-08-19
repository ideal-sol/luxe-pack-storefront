import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(child) : [child];
  });
}

const adapter = readFileSync("src/lib/platform/point-client.ts", "utf8");
for (const required of [
  "createStorefrontCurrentUserPointClient",
  "createStorefrontPointProductClient",
  "getWallet",
  "listPointLedgerEntries",
  "listPointProducts",
  "StorefrontWalletBalance",
]) {
  if (!adapter.includes(required)) throw new Error(`Generated Point read boundary is missing: ${required}`);
}
for (const forbidden of [
  "createPointPurchase",
  "createPayment",
  "grantPoints",
  "debitPoints",
  "exchangePoints",
]) {
  if (adapter.includes(forbidden)) throw new Error(`Point mutation entered the read adapter: ${forbidden}`);
}

const applicationFiles = [
  ...filesUnder("src/components/points"),
  "src/components/layout/site-header.tsx",
  "src/app/points/page.tsx",
  "src/app/mypage/points/page.tsx",
];
for (const file of applicationFiles) {
  const source = readFileSync(file, "utf8");
  if (source.includes("/api" + "/v2") || /\bfetch\s*\(/.test(source)) {
    throw new Error(`Point UI bypasses the generated Client: ${file}`);
  }
  if (/localStorage|sessionStorage/.test(source)) {
    throw new Error(`Point UI persists non-canonical state: ${file}`);
  }
}

const history = readFileSync("src/components/points/point-history-page.tsx", "utf8");
if (!history.includes("presentCoinTerminology(entry.reason.label)") || history.includes("ledger_code") || history.includes("database_id")) {
  throw new Error("Point history does not use the canonical Backend reason label");
}
if (/\.sort\s*\(|\.reverse\s*\(/.test(history)) {
  throw new Error("Point history changes Backend ordering");
}

const purchase = readFileSync("src/components/points/point-purchase-page.tsx", "utf8");
if (!purchase.includes("wallet.balance.total_points") || !purchase.includes("product.grant.total_points")) {
  throw new Error("Coin presentation does not use canonical Wallet/Product totals");
}
if (purchase.includes("product.grant.paid_points") || purchase.includes("product.grant.bonus_points")) {
  throw new Error("Point Product paid/bonus breakdown entered user presentation");
}
for (const required of [
  "product.limited_bonus",
  "limitedBonus?.presentation.is_visible",
  "limitedBonus.presentation.label",
  "limitedBonus.presentation.amount_text",
  "limitedBonus.state",
  "limitedBonus.starts_at",
  "limitedBonus.ends_at",
  "data-limited-bonus-state",
]) {
  if (!purchase.includes(required)) throw new Error(`Canonical Limited Bonus presentation is missing: ${required}`);
}
for (const forbidden of [
  "limitedBonus.amount",
  "limitedBonus.as_of",
  "limitedBonus.state ===",
  "switch (limitedBonus.state)",
  "product.grant.total_points +",
  "+ product.grant.total_points",
]) {
  if (purchase.includes(forbidden)) throw new Error(`Frontend Limited Bonus decision or calculation detected: ${forbidden}`);
}
for (const forbidden of [
  "Date.now(",
  ".getTime(",
  "setDate(",
  "setUTCDate(",
  "expiring_within_7_days.filter",
  "expiring_within_7_days.reduce",
  "expiring_within_7_days.sort",
]) {
  if (purchase.includes(forbidden)) throw new Error(`Frontend expiry decision detected: ${forbidden}`);
}
if (!purchase.includes("wallet.balance.expiring_within_7_days.map") ||
    !purchase.includes("bucket.amount") ||
    !purchase.includes("bucket.expires_at") ||
    !purchase.includes('timeZone: "Asia/Tokyo"')) {
  throw new Error("Canonical Wallet expiry presentation is incomplete");
}

const header = readFileSync("src/components/layout/site-header.tsx", "utf8");
if (!header.includes("wallet.balance.total_points") || header.includes("expiring_within_7_days")) {
  throw new Error("Header must show only the canonical total Coin balance");
}

const terminologyFiles = [
  "src/app/points/page.tsx",
  "src/app/mypage/points/page.tsx",
  "src/components/layout/site-header.tsx",
  "src/lib/routes/navigation.ts",
  "src/components/points/point-purchase-page.tsx",
  "src/components/points/point-history-page.tsx",
  "src/components/catalog/gacha-card.tsx",
  "src/components/catalog/gacha-detail.tsx",
  "src/components/draw/gacha-draw-panel.tsx",
  "src/components/draw/draw-result.tsx",
  "src/lib/platform/draw-problem.ts",
];
for (const file of terminologyFiles) {
  const source = readFileSync(file, "utf8");
  const presentationSource = source
    .replace('split("ポイント")', 'split("")')
    .replaceAll("price_points", "")
    .replaceAll("total_points", "")
    .replaceAll("paid_points", "")
    .replaceAll("bonus_points", "")
    .replaceAll("point_cost_total", "")
    .replaceAll("point_back_total", "")
    .replaceAll("point-balance", "")
    .replaceAll("point-product", "")
    .replaceAll("point-history", "")
    .replaceAll("point-category", "")
    .replaceAll("POINT_PRODUCT", "");
  const userFacingSource = presentationSource.replaceAll("INSUFFICIENT_POINTS", "");
  if (/ポイント|POINTS?\b|\d\s*pt\b/.test(userFacingSource)) {
    throw new Error(`Legacy user-facing Point terminology remains: ${file}`);
  }
}

console.log("point-boundary-check: passed");
