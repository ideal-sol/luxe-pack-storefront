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
if (!history.includes("entry.reason.label") || history.includes("ledger_code") || history.includes("database_id")) {
  throw new Error("Point history does not use the canonical Backend reason label");
}
if (/\.sort\s*\(|\.reverse\s*\(/.test(history)) {
  throw new Error("Point history changes Backend ordering");
}

console.log("point-boundary-check: passed");
