import { readFileSync } from "node:fs";
import {
  assertBrowserRequestBoundary,
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_CONTRACT_FIXTURE,
  PUBLIC_PAYMENT_CARD_CAPACITY_FIXTURES,
  PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES,
  PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES,
} from "@oripa/storefront-testkit";
import { ApiProblemError } from "@oripa/storefront-client";
import { createPaymentClientTestHarness } from "@/lib/platform/testing";
import type { Payment, PaymentCard } from "@/lib/platform";

const origin = "https://storefront.test/platform";
const csrf = "e".repeat(64);
const metadataTime = "2026-08-26T00:00:00Z";

const payment = {
  amount: { amount: 1_000, currency: "JPY" },
  created_at: metadataTime,
  expires_at: null,
  grant: { bonus_points: 100, limited_bonus_points: 300, paid_points: 1_000, total_points: 1_400 },
  id: "pay_public_040",
  method: "paypay",
  next_action: { type: "redirect", url: "https://provider.example/pay" },
  point_product_id: "product_public_040",
  status: "requires_action",
  succeeded_at: null,
} satisfies Payment;

const card = {
  brand: "VISA",
  can_pay: true,
  expiration: { month: 12, year: 2030 },
  id: "card_public_040",
  is_expired: false,
  last4: "4242",
  last_used_at: null,
  verification_status: "verified",
} satisfies PaymentCard;

function enqueueCsrf(harness: ReturnType<typeof createPaymentClientTestHarness>) {
  harness.mock.enqueueJson(
    { method: "GET", url: `${origin}/auth/session` },
    { body: PUBLIC_AUTH_FIXTURE.authenticated_session, status: 200 },
  );
}

describe("alpha.33 canonical Payment browser client", () => {
  it("pins alpha.33 and retains the additive 74-operation Public OpenAPI", () => {
    for (const name of ["storefront-client", "storefront-testkit"]) {
      expect(JSON.parse(readFileSync(`node_modules/@oripa/${name}/package.json`, "utf8")).version).toBe("2.0.0-alpha.33");
    }
    expect(PUBLIC_CONTRACT_FIXTURE.bundle_sha256).toBe("9670bc769080da605c97cb9849b61f342cf0111bc39e91c09dbbf62fc4bcc720");
    expect(PUBLIC_CONTRACT_FIXTURE.operation_count).toBe(74);
    expect(PUBLIC_CONTRACT_FIXTURE.operation_ids).toEqual(expect.arrayContaining([
      "getPaymentCardUiBootstrap", "createPayment", "getPayment", "resumeUnpaidPayment",
      "listMyPayments", "listPaymentCards", "startPaymentCardRegistration",
      "getPaymentCardRegistration", "reconcilePaymentCardRegistration",
      "cancelPaymentCardRegistration", "deletePaymentCard",
    ]));
  });

  it("lists the canonical Payment view and preserves the opaque cursor", async () => {
    const harness = createPaymentClientTestHarness();
    const collection = { data: [payment], pagination: { has_more: true, limit: 10, next_cursor: "opaque/cursor?site=041" } };
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/me/payments?view=succeeded&limit=10&cursor=opaque%2Fcursor%3Fsite%3D041` },
      { body: collection },
    );
    await expect(harness.client.listPayments!({ cursor: "opaque/cursor?site=041", limit: 10, view: "succeeded" })).resolves.toMatchObject({ data: collection });
    expect(harness.mock.requests).toHaveLength(1);
    harness.mock.assertExhausted();
  });

  it("reads bootstrap, Payment, and authoritative registration capacity without mutation", async () => {
    const harness = createPaymentClientTestHarness();
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/me/payment-card-ui-bootstrap` }, { body: PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox });
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/payments/${payment.id}` }, { body: payment });
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/me/payment-cards` }, { body: PUBLIC_PAYMENT_CARD_CAPACITY_FIXTURES.saved_2_pending_1 });
    await expect(harness.client.getPaymentCardUiBootstrap()).resolves.toMatchObject({ data: PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox });
    await expect(harness.client.getPayment(payment.id)).resolves.toMatchObject({ data: payment });
    await expect(harness.client.listCards()).resolves.toMatchObject({
      data: { limits: { next_capacity_at: expect.any(String), registration_remaining: 0 } },
    });
    expect(harness.mock.requests.map((request) => request.method)).toEqual(["GET", "GET", "GET"]);
    assertBrowserRequestBoundary(harness.mock.requests[0]!, { client_version: "2.0.0-alpha.33", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it("uses the exact typed start, read, reconcile, and cancel Registration operations", async () => {
    const harness = createPaymentClientTestHarness(csrf);
    const key = "site048-registration-idempotency-key";
    const registrationId = PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.requires_action.id;
    enqueueCsrf(harness);
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/me/payment-card-registrations` },
      { body: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.requires_action, status: 201 },
    );
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/me/payment-card-registrations/${registrationId}` },
      { body: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.pending },
    );
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/me/payment-card-registrations/${registrationId}/reconcile` },
      { body: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.completed },
    );
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/me/payment-card-registrations/${registrationId}/cancel` },
      { body: PUBLIC_PAYMENT_CARD_REGISTRATION_FIXTURES.canceled },
    );

    await harness.client.startCardRegistration(
      { card_token: "tok_browser_public-safe-fixture" },
      { idempotency_key: key },
    );
    await harness.client.getCardRegistration(registrationId);
    await harness.client.reconcileCardRegistration(registrationId);
    await harness.client.cancelCardRegistration(registrationId);

    expect(harness.mock.requests.slice(1).map((request) => request.method)).toEqual(["POST", "GET", "POST", "POST"]);
    expect(harness.mock.requests[1]?.body).toBe('{"card_token":"tok_browser_public-safe-fixture"}');
    expect(harness.mock.requests[1]?.headers["idempotency-key"]).toBe(key);
    expect(harness.mock.requests[3]?.body).toBe("{}");
    expect(harness.mock.requests[4]?.body).toBe("{}");
    expect(harness.mock.requests.slice(1).map((request) => request.headers["x-xsrf-token"]))
      .toEqual([csrf, undefined, csrf, csrf]);
    assertBrowserRequestBoundary(harness.mock.requests[1]!, { client_version: "2.0.0-alpha.33", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it("preserves the canonical Konbini unpaid-limit Problem code through the Client boundary", async () => {
    const harness = createPaymentClientTestHarness(csrf);
    enqueueCsrf(harness);
    harness.mock.enqueueProblem(
      { method: "POST", url: `${origin}/payments` },
      {
        code: "KONBINI_UNPAID_LIMIT_REACHED",
        detail: "fixture detail",
        request_id: "request-public-reference",
        retryable: false,
        status: 409,
        title: "fixture title",
        type: "about:blank",
      },
    );
    const error = await harness.client.startPayment(
      { payment_method: "konbini", point_product_id: payment.point_product_id! },
      { idempotency_key: "site044-idempotency-key" },
    ).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiProblemError);
    expect(error).toMatchObject({ code: "KONBINI_UNPAID_LIMIT_REACHED", status: 409 });
    harness.mock.assertExhausted();
  });

  it("resumes and deletes through CSRF-managed canonical operations", async () => {
    const harness = createPaymentClientTestHarness(csrf);
    enqueueCsrf(harness);
    harness.mock.enqueueJson({ method: "POST", url: `${origin}/payments/${payment.id}/resume` }, { body: { next_action: payment.next_action, payment_id: payment.id } });
    harness.mock.enqueueJson({ method: "DELETE", url: `${origin}/me/payment-cards/${card.id}` }, { body: undefined, status: 204 });
    await harness.client.resumeUnpaidPayment(payment.id);
    await harness.client.deleteCard(card.id);
    expect(harness.mock.requests.slice(1).map((request) => request.method)).toEqual(["POST", "DELETE"]);
    expect(harness.mock.requests[1]?.body).toBe("{}");
    expect(harness.mock.requests[1]?.headers["content-type"]).toBe("application/json");
    expect(harness.mock.requests[1]?.headers["x-xsrf-token"]).toBe(csrf);
    expect(harness.mock.requests[1]?.headers["idempotency-key"]).toBeUndefined();
    assertBrowserRequestBoundary(harness.mock.requests[1]!, { client_version: "2.0.0-alpha.33", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it("exposes canonical Registration operations but not either legacy save operation", () => {
    const client = createPaymentClientTestHarness().client as unknown as Record<string, unknown>;
    expect(client.startCardRegistration).toBeTypeOf("function");
    expect(client.getCardRegistration).toBeTypeOf("function");
    expect(client.reconcileCardRegistration).toBeTypeOf("function");
    expect(client.cancelCardRegistration).toBeTypeOf("function");
    expect(client.createCardRegistrationIntent).toBeUndefined();
    expect(client.completeCardRegistration).toBeUndefined();
  });
});
