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
  "listPayments",
  "createCardRegistrationIntent",
  "deleteCard",
  "createIdempotencyKey",
]) {
  if (!adapter.includes(required)) throw new Error(`Canonical Payment Client boundary is missing: ${required}`);
}
for (const forbidden of ["completeCardRegistration", "fetch(", "/api" + "/v2"]) {
  if (adapter.includes(forbidden)) throw new Error(`Out-of-scope Payment operation entered the adapter: ${forbidden}`);
}

const applicationFiles = [
  ...filesUnder("src/components/payment"),
  "src/components/points/point-purchase-detail.tsx",
  "src/app/points/purchase/[productId]/page.tsx",
  "src/app/points/purchase/thanks/page.tsx",
  "src/app/mypage/purchases/page.tsx",
  "src/app/mypage/purchases/[paymentId]/page.tsx",
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
    "provider_card_id:",
  ]) {
    if (source.includes(forbidden) && !(file.endsWith("point-purchase-detail.tsx") && forbidden === "provider_card_id:")) {
      throw new Error(`Payment UI crosses the Platform boundary (${forbidden}): ${file}`);
    }
  }
  if (/\bfetch\s*\(/.test(source)) throw new Error(`Payment UI performs raw fetch: ${file}`);
}

const cardFields = readFileSync("src/components/payment/fincode-card-fields.tsx", "utf8");
for (const required of [
  'import("@fincode/js")',
  "https://js.test.fincode.jp/v1/fincode.js",
  "https://js.fincode.jp/v1/fincode.js",
  "initFincode",
  'ui.create("payments"',
  "target?.isConnected",
  "ui.mount(",
  "providerMountWidth(target)",
  'querySelector("iframe")',
  '`${mountId}-form`',
  "executePayment",
  "registerCard",
  '"sdk_load"',
  '"init"',
  '"ui_create"',
  '"ui_mount"',
  '"ui_render"',
]) {
  if (!cardFields.includes(required)) throw new Error(`Canonical fincode UI integration is missing: ${required}`);
}
if (/ui\.mount\([^\n]+["']100%["']/.test(cardFields)) {
  throw new Error("fincode UI mount width must use the official numeric contract");
}
for (const forbidden of [
  "getFormData",
  ".on(",
  "postMessage",
  'addEventListener("message"',
  "onmessage",
  "PAN",
  "provider token",
  "secretKey",
  "console.",
]) {
  if (cardFields.includes(forbidden)) throw new Error(`Sensitive or undocumented fincode integration detected: ${forbidden}`);
}
for (const match of cardFields.matchAll(/(?:add|remove)EventListener\(\s*["']([^"']+)["']/g)) {
  if (!new Set(["load", "error"]).has(match[1])) {
    throw new Error(`Undocumented fincode event integration detected: ${match[1]}`);
  }
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
if (purchase.includes("listPayments")) throw new Error("Purchase flow must not load Payment history");
const unpaidThanks = purchase.indexOf('if (method === "konbini" || method === "virtual_account")');
const providerRedirect = purchase.indexOf("window.location.assign(payment.next_action.url)");
if (unpaidThanks < 0 || providerRedirect < 0 || unpaidThanks > providerRedirect ||
    !purchase.includes("/points/purchase/thanks?pid=")) {
  throw new Error("Konbini and Virtual Account must retain Purchase to Thanks before unpaid resume");
}

const paymentProblem = readFileSync("src/lib/platform/payment-problem.ts", "utf8");
for (const required of [
  'paymentMethod === "konbini"',
  'error.code === KONBINI_UNPAID_LIMIT_CODE',
  'KONBINI_UNPAID_LIMIT_REACHED',
  'コンビニ決済の未払いがあるため、コンビニ決済を使用できません',
]) {
  if (!paymentProblem.includes(required)) throw new Error(`Canonical Konbini problem mapping is missing: ${required}`);
}
for (const forbidden of ["error.title", "error.detail", "error.message"]) {
  if (paymentProblem.includes(forbidden)) throw new Error(`Konbini problem mapping uses forbidden text matching: ${forbidden}`);
}

const history = readFileSync("src/components/payment/payment-history-page.tsx", "utf8");
for (const required of ["listPayments", 'view: "succeeded"', 'view: "unpaid"', "pagination.next_cursor"]) {
  if (!history.includes(required)) throw new Error(`Canonical Payment history invariant is missing: ${required}`);
}
for (const forbidden of ["startPayment", "next_action.url", "Date.now("]) {
  if (history.includes(forbidden)) throw new Error(`Payment history crosses its read-only boundary: ${forbidden}`);
}

const polling = readFileSync("src/components/payment/use-payment-polling.ts", "utf8");
for (const required of ["2_000", "30_000", "paymentRetryAfterSeconds", "clearTimeout(timer)", "terminalStatuses"]) {
  if (!polling.includes(required)) throw new Error(`Payment polling invariant is missing: ${required}`);
}

console.log("payment-boundary-check: passed");
