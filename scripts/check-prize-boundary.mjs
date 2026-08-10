import { readFileSync } from "node:fs";

const inventory = readFileSync("src/components/prizes/prize-inventory.tsx", "utf8");
const adapter = readFileSync("src/lib/platform/prize-client.ts", "utf8");
const combined = `${inventory}\n${adapter}`;

for (const forbidden of [
  ".display",
  "exchangePrizes",
  "createShippingRequest",
  "createShippingAddress",
  "updateShippingAddress",
  "deleteShippingAddress",
  "Date.now(",
  "new Date()",
  "localStorage",
  "sessionStorage",
]) {
  if (combined.includes(forbidden)) throw new Error(`Prize boundary violation: ${forbidden}`);
}

for (const required of [
  "allowed_actions?.selection.allowed",
  "allowed_actions?.[action].allowed",
  "presentation?.name",
  'Pick<StorefrontPrizeShippingClient, "getPrize" | "listPrizes">',
]) {
  if (!combined.includes(required)) throw new Error(`Prize boundary is missing canonical usage: ${required}`);
}

console.log("prize-boundary-check: passed");
