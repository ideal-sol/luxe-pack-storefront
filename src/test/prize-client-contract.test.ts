import { readFileSync } from "node:fs";
import {
  FULFILLMENT_MUTATION_RETRY_SEMANTICS,
  createIdempotencyKey,
  createStorefrontDrawClient,
  isFulfillmentProblemError,
  isShippingMinimumPointsProblemError,
} from "@oripa/storefront-client";
import {
  assertBrowserRequestBoundary,
  assertFulfillmentProblemDetails,
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_CONTRACT_FIXTURE,
  PUBLIC_FULFILLMENT_PROBLEM_FIXTURES,
  PUBLIC_SHIPPING_REQUEST_FIXTURE,
  PUBLIC_USER_PRIZE_FIXTURE,
  PUBLIC_SHIPPING_ONLY_PRIZE_FIXTURE,
  SHIPPING_POLICY_FIXTURES,
  SHIPPING_MINIMUM_PROBLEM_FIXTURE,
} from "@oripa/storefront-testkit";
import type { UserPrize } from "@/lib/platform";
import { createBrowserPrizeInventoryClient } from "@/lib/platform/prize-client";
import { createPrizeClientTestHarness } from "@/lib/platform/testing";
import { vi } from "vitest";

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
  it("loads the official alpha.46 policy through the typed UI port without losing decimal precision", async () => {
    const harness = createPrizeClientTestHarness();
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/me/shipping-policy` }, { body: SHIPPING_POLICY_FIXTURES.maximum });
    const controller = new AbortController();
    const snapshot = await harness.client.shippingPolicyAccess.load(controller.signal);
    expect(snapshot).toEqual(SHIPPING_POLICY_FIXTURES.maximum);
    expect(snapshot.minimum_points).toBe("9007199254740991");
    expect(PUBLIC_CONTRACT_FIXTURE.operation_ids).toContain("getShippingPolicy");
    expect(harness.mock.requests).toHaveLength(1);
    expect(harness.mock.requests[0]).toMatchObject({ method: "GET", credentials: "include" });
    expect(harness.mock.requests[0]?.headers["x-xsrf-token"]).toBeUndefined();
    assertBrowserRequestBoundary(harness.mock.requests[0]!, { client_version: "2.0.0-alpha.46", site_version: "0.1.0" });
    // no-store is the formal endpoint cache policy; mock reads are not Runtime proof.
    const contract = JSON.parse(readFileSync("vendor/oripa/SHIPPINGMIN-20261023/public.openapi.json", "utf8"));
    expect(contract.paths["/me/shipping-policy"].get).toMatchObject({
      "x-sms-verification": "required", "x-cache-policy": "no-store", security: [{ userSession: [] }],
    });
    harness.mock.assertExhausted();
  });

  it("projects only typed Server minimum fields, refreshes the policy and never automatically resends the mutation", async () => {
    const harness = createPrizeClientTestHarness(csrf);
    const key = createIdempotencyKey();
    enqueueCsrf(harness);
    harness.mock.enqueueProblem({ method: "POST", url: `${origin}/me/shipping-requests` }, {
      ...SHIPPING_MINIMUM_PROBLEM_FIXTURE, detail: "unsafe internal detail",
    });
    const error = await harness.client.createShippingRequest("address", [fixture.id], { idempotency_key: key }).catch((caught: unknown) => caught);
    expect(isShippingMinimumPointsProblemError(error)).toBe(true);
    expect(harness.client.shippingPolicyAccess.minimumRejection(error)).toEqual({
      minimum_points: "10000", effective_required_points: "10000", selected_total_points: "8000", shortfall_points: "2000", setting_revision: 2,
    });
    expect(harness.client.shippingPolicyAccess.minimumRejection(new Error("unsafe"))).toBeNull();
    expect(harness.client.shippingPolicyAccess.minimumRejection(SHIPPING_MINIMUM_PROBLEM_FIXTURE)).toBeNull();
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/me/shipping-policy` }, { body: SHIPPING_POLICY_FIXTURES.minimum });
    await expect(harness.client.shippingPolicyAccess.load(new AbortController().signal)).resolves.toEqual(SHIPPING_POLICY_FIXTURES.minimum);
    expect(harness.mock.requests.filter((request) => request.method === "POST")).toHaveLength(1);
    expect(harness.mock.requests[1]?.headers["idempotency-key"]).toBe(key);
    expect(harness.mock.requests[1]?.headers["x-xsrf-token"]).toBe(csrf);
    harness.mock.assertExhausted();
  });

  it.each(["SESSION_EXPIRED", "SMS_VERIFICATION_REQUIRED"])("retains the policy endpoint %s boundary", async (code) => {
    const harness = createPrizeClientTestHarness();
    harness.mock.enqueueProblem({ method: "GET", url: `${origin}/me/shipping-policy` }, {
      type: `https://storefront.test/problems/${code.toLowerCase()}`, title: "Access required", code,
      status: code === "SESSION_EXPIRED" ? 401 : 403, request_id: "policy-access", retryable: false,
    });
    await expect(harness.client.shippingPolicyAccess.load(new AbortController().signal)).rejects.toMatchObject({ code });
    expect(harness.mock.requests).toHaveLength(1);
    harness.mock.assertExhausted();
  });

  it("propagates caller cancellation to the canonical policy request", async () => {
    const requestFetch = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.signal?.aborted).toBe(true);
      throw new DOMException("aborted", "AbortError");
    });
    const client = createBrowserPrizeInventoryClient({ baseUrl: origin, defaultTimeoutMs: 1000, siteVersion: "0.1.0" }, { fetch: requestFetch });
    const controller = new AbortController();
    controller.abort();
    await expect(client.shippingPolicyAccess.load(controller.signal)).rejects.toMatchObject({ code: "ABORTED" });
    expect(requestFetch).toHaveBeenCalledOnce();
    expect(requestFetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
  it("pins the canonical immutable versions and retains existing contracts", () => {
    for (const [packageName, version] of Object.entries({
      "site-schema": "2.0.0-alpha.23",
      "storefront-client": "2.0.0-alpha.46",
      "storefront-testkit": "2.0.0-alpha.46",
    })) {
      const packageJson = JSON.parse(readFileSync(`node_modules/@oripa/${packageName}/package.json`, "utf8"));
      expect(packageJson.version).toBe(version);
    }
    expect(PUBLIC_CONTRACT_FIXTURE.bundle_sha256).toBe("81ee96478ee3d80539817b54321f9f6d181c2a78a3dae2062527dd81049dcec4");
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

  it("reads the owned shipping-only snapshot and action authority through the canonical client", async () => {
    const harness = createPrizeClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/me/prizes` },
      { body: { items: [PUBLIC_SHIPPING_ONLY_PRIZE_FIXTURE], next_cursor: null }, status: 200 },
    );
    const { data } = await harness.client.listPrizes();
    expect(data.items[0]).toMatchObject({
      shipping_only: true,
      allowed_actions: {
        selection: { allowed: true },
        point_exchange: { allowed: false, unavailable_reason: "shipping_only" },
        shipping: { allowed: true },
      },
    });
    harness.mock.assertExhausted();
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
    assertBrowserRequestBoundary(harness.mock.requests[0]!, { client_version: "2.0.0-alpha.46", site_version: "0.1.0" });
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
    assertBrowserRequestBoundary(harness.mock.requests[1]!, { client_version: "2.0.0-alpha.46", site_version: "0.1.0" });
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
