import { readFileSync } from "node:fs";
import { assertBrowserRequestBoundary, PUBLIC_AUTH_FIXTURE, PUBLIC_CONTRACT_FIXTURE, PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES } from "@oripa/storefront-testkit";
import { createPaymentClientTestHarness } from "@/lib/platform/testing";
import type { Payment, PaymentCard, PaymentCardRegistrationIntent } from "@/lib/platform";

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
} satisfies PaymentCard;

const registrationIntent = {
  expires_at: metadataTime,
  id: "reg_public_040",
  provider_context: {
    customer_id: "customer_public_040",
    provider: "fincode",
    public_api_key: "p_test_public-safe-fixture",
    tds_type: "2",
  },
} satisfies PaymentCardRegistrationIntent;

function enqueueCsrf(harness: ReturnType<typeof createPaymentClientTestHarness>) {
  harness.mock.enqueueJson(
    { method: "GET", url: `${origin}/auth/session` },
    { body: PUBLIC_AUTH_FIXTURE.authenticated_session, status: 200 },
  );
}

describe("MIG-089 canonical Payment browser client", () => {
  it("pins alpha.28 and the 65-operation Public OpenAPI", () => {
    for (const name of ["storefront-client", "storefront-testkit"]) {
      expect(JSON.parse(readFileSync(`node_modules/@oripa/${name}/package.json`, "utf8")).version).toBe("2.0.0-alpha.28");
    }
    expect(PUBLIC_CONTRACT_FIXTURE.bundle_sha256).toBe("41ebdddbd7c4edeedd36ad3810b2afa564495aa2d1c3e48a187f44c85deb85da");
    expect(PUBLIC_CONTRACT_FIXTURE.operation_ids).toEqual(expect.arrayContaining([
      "getPaymentCardUiBootstrap", "createPayment", "getPayment", "resumeUnpaidPayment",
      "listMyPayments", "listPaymentCards", "createPaymentCardRegistrationIntent", "deletePaymentCard",
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

  it("reads bootstrap, Payment, and canonical card order without mutation", async () => {
    const harness = createPaymentClientTestHarness();
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/me/payment-card-ui-bootstrap` }, { body: PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox });
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/payments/${payment.id}` }, { body: payment });
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/me/payment-cards` }, { body: { data: [card], limits: { maximum: 3, remaining: 2 } } });
    await expect(harness.client.getPaymentCardUiBootstrap()).resolves.toMatchObject({ data: PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox });
    await expect(harness.client.getPayment(payment.id)).resolves.toMatchObject({ data: payment });
    await expect(harness.client.listCards()).resolves.toMatchObject({ data: { data: [card] } });
    expect(harness.mock.requests.map((request) => request.method)).toEqual(["GET", "GET", "GET"]);
    assertBrowserRequestBoundary(harness.mock.requests[0]!, { client_version: "2.0.0-alpha.28", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it("uses one caller idempotency key for intent and Payment creation", async () => {
    const harness = createPaymentClientTestHarness(csrf);
    const key = "site040-idempotency-key";
    enqueueCsrf(harness);
    harness.mock.enqueueJson({ method: "POST", url: `${origin}/me/payment-card-registration-intents` }, { body: registrationIntent, status: 201 });
    harness.mock.enqueueJson({ method: "POST", url: `${origin}/payments` }, { body: payment, status: 201 });
    await harness.client.createCardRegistrationIntent({ idempotency_key: key });
    await harness.client.startPayment({ payment_method: "paypay", point_product_id: payment.point_product_id! }, { idempotency_key: key });
    expect(harness.mock.requests.slice(1).map((request) => request.headers["idempotency-key"])).toEqual([key, key]);
    expect(harness.mock.requests.slice(1).map((request) => request.headers["x-xsrf-token"])).toEqual([csrf, csrf]);
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
    harness.mock.assertExhausted();
  });

  it("exposes purchase history but not registration completion", () => {
    const client = createPaymentClientTestHarness().client as unknown as Record<string, unknown>;
    expect(client.listPayments).toBeTypeOf("function");
    expect(client.completeCardRegistration).toBeUndefined();
  });
});
