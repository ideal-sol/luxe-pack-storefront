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
  "startCardRegistration",
  "getCardRegistration",
  "reconcileCardRegistration",
  "cancelCardRegistration",
  "deleteCard",
  "createIdempotencyKey",
]) {
  if (!adapter.includes(required)) throw new Error(`Canonical Payment Client boundary is missing: ${required}`);
}
for (const forbidden of ["createCardRegistrationIntent", "completeCardRegistration", "fetch(", "/api" + "/v2"]) {
  if (adapter.includes(forbidden)) throw new Error(`Out-of-scope Payment operation entered the adapter: ${forbidden}`);
}

const applicationFiles = [
  ...filesUnder("src/components/payment"),
  "src/components/points/point-purchase-detail.tsx",
  "src/app/page.tsx",
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
    "getFormData",
    "createCardRegistrationIntent",
    "completePaymentCardRegistration",
    "completeCardRegistration",
    "provider_card_id",
    "customer_id",
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`Payment UI crosses the Platform boundary (${forbidden}): ${file}`);
    }
  }
  if (source.includes("sessionStorage") && !file.endsWith("card-registration-resume.ts")) {
    throw new Error(`Payment UI persists state outside the opaque Return correlation boundary: ${file}`);
  }
  if (/\bfetch\s*\(/.test(source)) throw new Error(`Payment UI performs raw fetch: ${file}`);
}

const registrationResume = readFileSync("src/components/payment/card-registration-resume.ts", "utf8");
for (const required of [
  '"luxe-pack:card-registration-resume:v1"',
  '"awaiting_return"',
  '"return_processing"',
  '"payment_starting"',
  "paymentIdempotencyKey",
  "productId",
  "registrationId",
]) {
  if (!registrationResume.includes(required)) throw new Error(`Registration Return correlation is incomplete: ${required}`);
}
for (const forbidden of ["card_token", "cardToken", "provider_card", "customer", "CVC", "security_code", "last4"]) {
  if (registrationResume.includes(forbidden)) {
    throw new Error(`Registration Return correlation persists forbidden Card data: ${forbidden}`);
  }
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
  "getCardToken",
  "tokenize",
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
  "registerCard",
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
  "getCardRegistration(registrationId)",
  "reconcileCardRegistration(registrationId)",
  'registration.status !== "completed"',
  "registration.saved_card_id",
  "registration_remaining",
  "next_capacity_at",
  "beginCardRegistrationReturn",
  "markCardRegistrationPaymentStarting",
  "startPayment(input",
  "deleteCard(cardId)",
  "cardMounted",
  "source: \"saved\"",
  "source: \"new\"",
  "save: false",
]) {
  if (!purchase.includes(required)) throw new Error(`Payment purchase invariant is missing: ${required}`);
}
for (const forbidden of ["startCardRegistration(", "saveCardRegistrationResume(", ".tokenize()"]) {
  if (purchase.includes(forbidden)) throw new Error(`Disabled Save Card purchase path remains executable: ${forbidden}`);
}
if (!purchase.includes("payment.next_action.is_live_mode !== bootstrap.is_live_mode")) {
  throw new Error("fincode environment skew is not rejected");
}
for (const forbidden of [
  "createCardRegistrationIntent",
  "completeCardRegistration",
  "registerCard",
  "provider_card_id",
  "registration_intent_id",
  "setCardToken",
  "setPan",
  "setCvc",
  "console.",
]) {
  if (purchase.includes(forbidden)) throw new Error(`Legacy or sensitive Save Card path remains: ${forbidden}`);
}
if (purchase.includes("listPayments")) throw new Error("Purchase flow must not load Payment history");
const unpaidThanks = purchase.indexOf('if (paymentMethod === "konbini" || paymentMethod === "virtual_account")');
const providerRedirect = purchase.indexOf("window.location.assign(payment.next_action.url)");
if (unpaidThanks < 0 || providerRedirect < 0 || unpaidThanks > providerRedirect ||
    !purchase.includes("/points/purchase/thanks?pid=")) {
  throw new Error("Konbini and Virtual Account must retain Purchase to Thanks before unpaid resume");
}

const saveConfirmation = readFileSync("src/components/payment/card-save-confirmation.tsx", "utf8");
for (const required of ["onBack", "onBuyWithoutSaving", "戻る", "保存せず購入"]) {
  if (!saveConfirmation.includes(required)) throw new Error(`New Card confirmation action is missing: ${required}`);
}
for (const forbidden of ["onSaveAndBuy", "カードを保存して購入"]) {
  if (saveConfirmation.includes(forbidden)) throw new Error(`Disabled Save Card confirmation action remains: ${forbidden}`);
}

const paymentProblem = readFileSync("src/lib/platform/payment-problem.ts", "utf8");
for (const required of [
  'paymentMethod === "konbini"',
  'error.code === KONBINI_UNPAID_LIMIT_CODE',
  'KONBINI_UNPAID_LIMIT_REACHED',
  'コンビニ決済の未払いがあるため、コンビニ決済を使用できません',
  "isCardRegistrationProblemError",
  "presentCardRegistrationProblem",
]) {
  if (!paymentProblem.includes(required)) throw new Error(`Canonical Konbini problem mapping is missing: ${required}`);
}
for (const forbidden of ["error.title", "error.detail", "error.message"]) {
  if (paymentProblem.includes(forbidden)) throw new Error(`Konbini problem mapping uses forbidden text matching: ${forbidden}`);
}

const returnRouter = readFileSync("src/components/payment/card-registration-return-router.tsx", "utf8");
for (const required of ["readCardRegistrationResume", 'phase === "awaiting_return"', "window.location.replace"] ) {
  if (!returnRouter.includes(required)) throw new Error(`Registration Return router invariant is missing: ${required}`);
}
if (/startCardRegistration|startPayment|reconcileCardRegistration/.test(returnRouter)) {
  throw new Error("Root Registration Return router must not perform a mutation");
}
const purchaseRoute = readFileSync("src/app/points/purchase/[productId]/page.tsx", "utf8");
if (!purchaseRoute.includes("!registrationId &&") ||
    !purchaseRoute.includes("card_registration_id") || !purchaseRoute.includes("pid")) {
  throw new Error("Registration Return and Payment Return correlations are not kept distinct");
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
