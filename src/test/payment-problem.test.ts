import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import { presentPaymentProblem, type PaymentMethod } from "@/lib/platform";

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
