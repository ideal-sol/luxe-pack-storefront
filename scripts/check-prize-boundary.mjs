import { readFileSync } from "node:fs";

const inventory = readFileSync("src/components/prizes/prize-inventory.tsx", "utf8");
const adapter = readFileSync("src/lib/platform/prize-client.ts", "utf8");
const fulfillment = readFileSync("src/components/prizes/prize-fulfillment.tsx", "utf8");
const problem = readFileSync("src/lib/platform/fulfillment-problem.ts", "utf8");
const combined = `${inventory}\n${adapter}\n${fulfillment}\n${problem}`;

for (const forbidden of [
  ".display",
  "/api/v2",
  "document.cookie",
  "X-XSRF-TOKEN",
  "XSRF-TOKEN",
  "csrf_token",
  "localStorage",
  "sessionStorage",
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
]) {
  if (!combined.includes(required)) throw new Error(`Prize boundary is missing canonical usage: ${required}`);
}

console.log("prize-boundary-check: passed");
