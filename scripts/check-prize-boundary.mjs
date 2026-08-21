import { readFileSync } from "node:fs";

const inventory = readFileSync("src/components/prizes/prize-inventory.tsx", "utf8");
const adapter = readFileSync("src/lib/platform/prize-client.ts", "utf8");
const addressFields = readFileSync("src/components/address/shipping-address-fields.tsx", "utf8");
const addressManager = readFileSync("src/components/address/shipping-address-manager.tsx", "utf8");
const fulfillment = readFileSync("src/components/prizes/prize-fulfillment.tsx", "utf8");
const problem = readFileSync("src/lib/platform/fulfillment-problem.ts", "utf8");
const terminology = readFileSync("src/lib/presentation/coin-terminology.ts", "utf8");
const combined = `${inventory}\n${adapter}\n${addressFields}\n${addressManager}\n${fulfillment}\n${problem}`;

for (const forbidden of [
  ".display",
  "/api/v2",
  "document.cookie",
  "X-XSRF-TOKEN",
  "XSRF-TOKEN",
  "csrf_token",
  "localStorage",
  "sessionStorage",
  "console.",
  "URLSearchParams",
  "searchParams",
  "window.location",
]) {
  if (combined.includes(forbidden)) throw new Error(`Prize boundary violation: ${forbidden}`);
}

for (const required of [
  "allowed_actions?.selection.allowed",
  "allowed_actions?.[action].allowed",
  "presentation?.name",
  "createBrowserStorefrontPrizeShippingClient",
  "createFulfillmentIdempotencyKey",
  "isFulfillmentProblemError",
  "getShippingAddress",
  "listShippingAddresses",
  "createShippingAddress",
  "updateShippingAddress",
  "deleteShippingAddress",
]) {
  if (!combined.includes(required)) throw new Error(`Prize boundary is missing canonical usage: ${required}`);
}

if (!inventory.includes("presentCoinTerminology(presentation?.name")) {
  throw new Error("Prize presentation does not convert Backend currency terminology at render time");
}
if (!terminology.includes('value.split("ポイント").join("コイン")')) {
  throw new Error("Coin terminology helper must preserve the canonical input and derive display text only");
}
const userFacingSource = `${inventory}\n${fulfillment}\n${problem}`;
if (/ポイント|\bPOINTS?\b|\d\s*pt\b/i.test(userFacingSource)) {
  throw new Error("Legacy user-facing Point terminology remains in Prize presentation");
}

console.log("prize-boundary-check: passed");
