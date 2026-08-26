import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(child) : [child];
  });
}

const adapter = readFileSync("src/lib/platform/payment-client.ts", "utf8");
for (const required of [
  "createCsrfManagedStorefrontPaymentClient",
  "getPaymentCardUiBootstrap",
  "startPayment",
  "getPayment",
  "resumeUnpaidPayment",
  "listCards",
  "createCardRegistrationIntent",
  "deleteCard",
  "createIdempotencyKey",
]) {
  if (!adapter.includes(required)) throw new Error(`Canonical Payment Client boundary is missing: ${required}`);
}
for (const forbidden of ["listPayments", "completeCardRegistration", "fetch(", "/api" + "/v2"]) {
  if (adapter.includes(forbidden)) throw new Error(`Out-of-scope Payment operation entered the adapter: ${forbidden}`);
}

const applicationFiles = [
  ...filesUnder("src/components/payment"),
  "src/components/points/point-purchase-detail.tsx",
  "src/app/points/purchase/[productId]/page.tsx",
  "src/app/points/purchase/thanks/page.tsx",
];
for (const file of applicationFiles) {
  const source = readFileSync(file, "utf8");
  for (const forbidden of [
    "/api" + "/v2",
    "localStorage",
    "sessionStorage",
    "getFormData",
    "completePaymentCardRegistration",
    "completeCardRegistration",
    "listPayments",
    "provider_card_id:",
  ]) {
    if (source.includes(forbidden) && !(file.endsWith("point-purchase-detail.tsx") && forbidden === "provider_card_id:")) {
      throw new Error(`Payment UI crosses the Platform boundary (${forbidden}): ${file}`);
    }
  }
  if (/\bfetch\s*\(/.test(source)) throw new Error(`Payment UI performs raw fetch: ${file}`);
}

const cardFields = readFileSync("src/components/payment/fincode-card-fields.tsx", "utf8");
for (const required of ["initFincode", 'ui.create("payments"', "ui.mount(", "executePayment", "registerCard"]) {
  if (!cardFields.includes(required)) throw new Error(`Canonical fincode UI integration is missing: ${required}`);
}
for (const forbidden of ["getFormData", "addEventListener", ".on(", "PAN", "provider token", "secretKey"]) {
  if (cardFields.includes(forbidden)) throw new Error(`Sensitive or undocumented fincode integration detected: ${forbidden}`);
}

const purchase = readFileSync("src/components/points/point-purchase-detail.tsx", "utf8");
for (const required of [
  "getPaymentCardUiBootstrap()",
  "createCardRegistrationIntent",
  "startPayment(input",
  "deleteCard(cardId)",
  "cardMounted",
  "registration_intent_id",
  "provider_card_id",
  "source: \"saved\"",
  "source: \"new\"",
]) {
  if (!purchase.includes(required)) throw new Error(`Payment purchase invariant is missing: ${required}`);
}
if (!purchase.includes("payment.next_action.is_live_mode !== bootstrap.is_live_mode")) {
  throw new Error("fincode environment skew is not rejected");
}

const polling = readFileSync("src/components/payment/use-payment-polling.ts", "utf8");
for (const required of ["2_000", "30_000", "paymentRetryAfterSeconds", "clearTimeout(timer)", "terminalStatuses"]) {
  if (!polling.includes(required)) throw new Error(`Payment polling invariant is missing: ${required}`);
}

console.log("payment-boundary-check: passed");
