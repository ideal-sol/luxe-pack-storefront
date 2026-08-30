import { readFileSync } from "node:fs";
import {
  beginCardRegistrationReturn,
  clearCardRegistrationResume,
  markCardRegistrationPaymentStarting,
  readCardRegistrationResume,
  saveCardRegistrationResume,
} from "@/components/payment/card-registration-resume";

const registrationId = "0198a001-0000-7000-8000-000000009801";
const productId = "0198a001-0000-7000-8000-000000000321";
const paymentIdempotencyKey = "0198a001-0000-7000-8000-000000009803";
const storageKey = "luxe-pack:card-registration-resume:v1";

describe("SITE-048 Card Registration Return correlation", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("advances the opaque correlation exactly once through Return and Payment start", () => {
    saveCardRegistrationResume({ paymentIdempotencyKey, productId, registrationId });
    expect(readCardRegistrationResume()).toEqual({
      paymentIdempotencyKey,
      phase: "awaiting_return",
      productId,
      registrationId,
    });
    expect(beginCardRegistrationReturn(registrationId, productId)?.phase).toBe("return_processing");
    expect(beginCardRegistrationReturn(registrationId, productId)).toBeNull();
    expect(markCardRegistrationPaymentStarting(registrationId)?.phase).toBe("payment_starting");
    expect(markCardRegistrationPaymentStarting(registrationId)).toBeNull();
    clearCardRegistrationResume(registrationId);
    expect(readCardRegistrationResume()).toBeNull();
  });

  it("does not advance a mismatched Browser Return", () => {
    saveCardRegistrationResume({ paymentIdempotencyKey, productId, registrationId });
    expect(beginCardRegistrationReturn("0198a001-0000-7000-8000-000000009899", productId)).toBeNull();
    expect(beginCardRegistrationReturn(registrationId, "0198a001-0000-7000-8000-000000009899")).toBeNull();
    expect(readCardRegistrationResume()?.phase).toBe("awaiting_return");
  });

  it.each([
    "not-json",
    JSON.stringify({ paymentIdempotencyKey, phase: "awaiting_return", productId }),
    JSON.stringify({ paymentIdempotencyKey, phase: "awaiting_return", productId, registrationId: "" }),
    JSON.stringify({ extra: true, paymentIdempotencyKey, phase: "awaiting_return", productId, registrationId }),
  ])("removes malformed or expanded correlation state", (value) => {
    window.sessionStorage.setItem(storageKey, value);
    expect(readCardRegistrationResume()).toBeNull();
    expect(window.sessionStorage.getItem(storageKey)).toBeNull();
  });

  it("treats Platform identifiers as opaque strings instead of assuming UUID format", () => {
    saveCardRegistrationResume({
      paymentIdempotencyKey,
      productId: "product/public?edition=1",
      registrationId: "registration-public-reference",
    });
    expect(readCardRegistrationResume()).toMatchObject({
      productId: "product/public?edition=1",
      registrationId: "registration-public-reference",
    });
  });

  it("persists no Card credential, Provider identifier, or raw token field", () => {
    saveCardRegistrationResume({ paymentIdempotencyKey, productId, registrationId });
    const stored = window.sessionStorage.getItem(storageKey) ?? "";
    expect(Object.keys(JSON.parse(stored)).sort()).toEqual([
      "paymentIdempotencyKey",
      "phase",
      "productId",
      "registrationId",
    ]);
    expect(stored).not.toMatch(/card_token|cardToken|provider_card|customer|pan|cvc|security_code|last4/i);
    expect(readFileSync("src/components/payment/card-registration-resume.ts", "utf8"))
      .not.toMatch(/localStorage|console\.|card_token|provider_card_id|customer_id/i);
  });
});
