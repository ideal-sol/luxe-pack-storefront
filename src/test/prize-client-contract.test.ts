import { readFileSync } from "node:fs";
import {
  FULFILLMENT_MUTATION_RETRY_SEMANTICS,
  createIdempotencyKey,
  createStorefrontDrawClient,
  isFulfillmentProblemError,
} from "@oripa/storefront-client";
import {
  assertBrowserRequestBoundary,
  assertFulfillmentProblemDetails,
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_CONTRACT_FIXTURE,
  PUBLIC_FULFILLMENT_PROBLEM_FIXTURES,
  PUBLIC_SHIPPING_REQUEST_FIXTURE,
  PUBLIC_USER_PRIZE_FIXTURE,
} from "@oripa/storefront-testkit";
import type { UserPrize } from "@/lib/platform";
import { createPrizeClientTestHarness } from "@/lib/platform/testing";

const origin = "https://storefront.test/platform";
const fixture = PUBLIC_USER_PRIZE_FIXTURE as UserPrize;
const csrf = "f".repeat(64);

function enqueueCsrf(harness: ReturnType<typeof createPrizeClientTestHarness>) {
  harness.mock.enqueueJson(
    { method: "GET", url: `${origin}/auth/session` },
    { body: PUBLIC_AUTH_FIXTURE.authenticated_session, status: 200 },
  );
}

describe("MIG-062Z retained prize fulfillment contract", () => {
  it("pins the canonical immutable versions and retains existing contracts", () => {
    for (const [packageName, version] of Object.entries({
      "site-schema": "2.0.0-alpha.23",
      "storefront-client": "2.0.0-alpha.33",
      "storefront-testkit": "2.0.0-alpha.33",
    })) {
      const packageJson = JSON.parse(readFileSync(`node_modules/@oripa/${packageName}/package.json`, "utf8"));
      expect(packageJson.version).toBe(version);
    }
    expect(PUBLIC_CONTRACT_FIXTURE.bundle_sha256).toBe("9670bc769080da605c97cb9849b61f342cf0111bc39e91c09dbbf62fc4bcc720");
    expect(PUBLIC_CONTRACT_FIXTURE.operation_ids).toEqual(expect.arrayContaining([
      "getUserSession",
      "loginUser",
      "registerUser",
      "listGachas",
      "getGachaBySlug",
      "getGachaPresentation",
      "listContentBanners",
      "listContentNotices",
      "getContentNotice",
      "getContentStaticPage",
      "createDraw",
      "getDrawRequest",
      "listUserPrizes",
      "getUserPrize",
      "exchangeUserPrizes",
      "listShippingAddresses",
      "getShippingAddress",
      "createShippingAddress",
      "updateShippingAddress",
      "deleteShippingAddress",
      "listShippingRequests",
      "getShippingRequest",
      "createShippingRequest",
    ]));
    expect(createStorefrontDrawClient).toBeTypeOf("function");
    expect(FULFILLMENT_MUTATION_RETRY_SEMANTICS).toEqual({
      createShippingAddress: "same-idempotency-key",
      createShippingRequest: "same-idempotency-key",
      deleteShippingAddress: "reconcile-before-retry",
      exchangePrizes: "same-idempotency-key",
      updateShippingAddress: "reconcile-before-retry",
    });
  });

  it("reads the generated presentation and allowed_actions through listPrizes", async () => {
    const harness = createPrizeClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/me/prizes` },
      { body: { items: [fixture], next_cursor: "next-page" }, status: 200 },
    );

    const { data } = await harness.client.listPrizes();
    expect(data.items[0]?.presentation).toMatchObject({
      name: fixture.presentation?.name,
      prize_id: fixture.presentation?.prize_id,
      rank: fixture.presentation?.rank,
    });
    expect(data.items[0]?.allowed_actions).toEqual(fixture.allowed_actions);
    expect(data.next_cursor).toBe("next-page");
    assertBrowserRequestBoundary(harness.mock.requests[0]!, { client_version: "2.0.0-alpha.33", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it("passes the cursor unchanged and reads one prize through getPrize", async () => {
    const harness = createPrizeClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/me/prizes?cursor=next-page` },
      { body: { items: [], next_cursor: null }, status: 200 },
    );
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/me/prizes/${fixture.id}` },
      { body: { ...fixture, status_history: [] }, status: 200 },
    );

    await expect(harness.client.listPrizes("next-page")).resolves.toMatchObject({ data: { next_cursor: null } });
    await expect(harness.client.getPrize(fixture.id)).resolves.toMatchObject({
      data: { id: fixture.id, presentation: fixture.presentation },
    });
    harness.mock.assertExhausted();
  });

  it("owns Browser CSRF while the caller supplies the exchange idempotency key", async () => {
    const harness = createPrizeClientTestHarness(csrf);
    const key = createIdempotencyKey();
    enqueueCsrf(harness);
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/me/prizes/exchange` },
      { body: {
        exchange_point_total: fixture.exchange_points,
        exchanged_count: 1,
        id: "0198a001-0000-7000-8000-000000000150",
        idempotent_replay: false,
        status: "completed",
        wallet_free_points_after: 8000,
      }, status: 200 },
    );
    await harness.client.exchangePrizes([fixture.id], { idempotency_key: key });
    expect(harness.mock.requests[1]?.credentials).toBe("include");
    expect(harness.mock.requests[1]?.headers["idempotency-key"]).toBe(key);
    expect(harness.mock.requests[1]?.headers["x-xsrf-token"]).toBe(csrf);
    assertBrowserRequestBoundary(harness.mock.requests[1]!, { client_version: "2.0.0-alpha.33", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it("creates shipping with Browser-owned CSRF and the caller key", async () => {
    const harness = createPrizeClientTestHarness(csrf);
    const key = createIdempotencyKey();
    enqueueCsrf(harness);
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/me/shipping-requests` },
      { body: PUBLIC_SHIPPING_REQUEST_FIXTURE, status: 201 },
    );
    await harness.client.createShippingRequest(
      "0198a001-0000-7000-8000-000000000140",
      [fixture.id],
      { idempotency_key: key },
    );
    expect(harness.mock.requests[1]?.headers["idempotency-key"]).toBe(key);
    expect(harness.mock.requests[1]?.headers["x-xsrf-token"]).toBe(csrf);
    harness.mock.assertExhausted();
  });

  it.each(PUBLIC_FULFILLMENT_PROBLEM_FIXTURES)("preserves generated fulfillment problem $code", async (problem) => {
    const harness = createPrizeClientTestHarness(csrf);
    enqueueCsrf(harness);
    harness.mock.enqueueProblem(
      { method: "POST", url: `${origin}/me/prizes/exchange` },
      problem,
    );
    const error = await harness.client.exchangePrizes([fixture.id], { idempotency_key: createIdempotencyKey() })
      .catch((caught: unknown) => caught);
    assertFulfillmentProblemDetails(error, problem.code);
    expect(isFulfillmentProblemError(error, problem.code)).toBe(true);
  });
});
