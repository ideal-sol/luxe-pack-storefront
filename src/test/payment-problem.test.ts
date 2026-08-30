import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import {
  isDefinitiveCardRegistrationProblem,
  isUncertainCardRegistrationProblem,
  presentCardRegistrationProblem,
  presentPaymentProblem,
  type PaymentMethod,
} from "@/lib/platform";

const unpaidCopy = "コンビニ決済の未払いがあるため、コンビニ決済を使用できません";
const genericPaymentCopy = "決済処理を完了できませんでした。時間をおいて、もう一度お試しください。";

function apiProblem(code: string, overrides: Partial<ConstructorParameters<typeof ApiProblemError>[0]> = {}) {
  return new ApiProblemError({
    code,
    detail: "fixture detail that presentation must ignore",
    request_id: "request-public-reference",
    retryable: false,
    status: 409,
    title: "fixture title that presentation must ignore",
    type: "about:blank",
    ...overrides,
  });
}

describe("SITE-044 Payment problem presentation", () => {
  it("shows the exact Human copy only for Konbini and the canonical unpaid-limit code", () => {
    const problem = apiProblem("KONBINI_UNPAID_LIMIT_REACHED", {
      detail: "completely unrelated detail",
      status: 418,
      title: "completely unrelated title",
    });
    expect(presentPaymentProblem(problem, "konbini").message).toBe(unpaidCopy);
  });

  it("does not use title or detail strings when the canonical code differs", () => {
    const problem = apiProblem("OTHER_PAYMENT_ERROR", {
      detail: "KONBINI_UNPAID_LIMIT_REACHED コンビニ決済の未払い",
      title: "KONBINI_UNPAID_LIMIT_REACHED",
    });
    expect(presentPaymentProblem(problem, "konbini").message).toBe(genericPaymentCopy);
    expect(presentPaymentProblem(problem, "konbini").message).not.toBe(unpaidCopy);
  });

  it.each([
    "credit_card",
    "paypay",
    "virtual_account",
    undefined,
  ] satisfies readonly (PaymentMethod | undefined)[])("does not apply the Konbini copy to payment method %s", (method) => {
    expect(presentPaymentProblem(apiProblem("KONBINI_UNPAID_LIMIT_REACHED"), method).message).toBe(genericPaymentCopy);
  });

  it("keeps the transport result-unknown presentation for Konbini", () => {
    const transport = new StorefrontTransportError("NETWORK_ERROR", "fixture network failure");
    const presentation = presentPaymentProblem(transport, "konbini");
    expect(presentation.message).toBe("通信結果を確認できませんでした。同じ操作を繰り返さず、時間をおいて状態をご確認ください。");
    expect(presentation.message).not.toBe(unpaidCopy);
  });
});

describe("SITE-048 Card Registration problem presentation", () => {
  it.each(["CARD_REGISTRATION_UNAVAILABLE", "CARD_REGISTRATION_CONFLICT"])(
    "treats %s as result-uncertain without exposing Provider text",
    (code) => {
      const problem = apiProblem(code, {
        detail: "provider raw private detail",
        title: "provider raw private title",
      });
      const presentation = presentCardRegistrationProblem(problem);
      expect(isUncertainCardRegistrationProblem(problem)).toBe(true);
      expect(isDefinitiveCardRegistrationProblem(problem)).toBe(false);
      expect(presentation.message).toBe("通信結果を確認できませんでした。同じ操作を繰り返さず、時間をおいて状態をご確認ください。");
      expect(presentation.message).not.toMatch(/provider raw private/);
    },
  );

  it.each([
    "CARD_REGISTRATION_FAILED",
    "CARD_REGISTRATION_CANCELED",
    "CARD_INTENT_EXPIRED",
    "CARD_REGISTRATION_OWNERSHIP_INVALID",
  ])("maps definitive %s to a fixed safe copy", (code) => {
    const problem = apiProblem(code);
    expect(isDefinitiveCardRegistrationProblem(problem)).toBe(true);
    expect(isUncertainCardRegistrationProblem(problem)).toBe(false);
    expect(presentCardRegistrationProblem(problem).message)
      .toBe("エラーが発生しました。時間をおいて、もう一度お試しください。");
  });

  it("retains typed authentication and retry metadata without raw detail", () => {
    const problem = apiProblem("AUTHENTICATION_REQUIRED", {
      retry_after_seconds: 17,
      status: 401,
    });
    const presentation = presentCardRegistrationProblem(problem);
    expect(presentation.sessionExpired).toBe(true);
    expect(presentation.message).toBe("エラーが発生しました。時間をおいて、もう一度お試しください。");
    expect(presentation.message).not.toContain("fixture detail");
  });
});
