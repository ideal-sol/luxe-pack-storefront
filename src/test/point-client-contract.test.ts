import { readFileSync } from "node:fs";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  assertBrowserRequestBoundary,
  PUBLIC_CONTRACT_FIXTURE,
  PUBLIC_POINT_BALANCE_FIXTURES,
  PUBLIC_POINT_HISTORY_FIXTURES,
  PUBLIC_POINT_PRODUCT_FIXTURES,
  PUBLIC_POINT_READ_PROBLEM_FIXTURES,
} from "@oripa/storefront-testkit";
import { createPointClientTestHarness } from "@/lib/platform/testing";

const origin = "https://storefront.test/platform";

describe("MIG-063B canonical Point contract", () => {
  it("pins the canonical immutable versions and retains generated Point operations", () => {
    for (const [packageName, version] of Object.entries({
      "site-schema": "2.0.0-alpha.23",
      "storefront-client": "2.0.0-alpha.31",
      "storefront-testkit": "2.0.0-alpha.31",
    })) {
      const packageJson = JSON.parse(readFileSync(`node_modules/@oripa/${packageName}/package.json`, "utf8"));
      expect(packageJson.version).toBe(version);
    }
    expect(PUBLIC_CONTRACT_FIXTURE.bundle_sha256).toBe("60a14073f7ee52d91b919c69fbc7444bf6afe391a887121bb4af5e45fbb85626");
    expect(PUBLIC_CONTRACT_FIXTURE.operation_ids).toEqual(expect.arrayContaining([
      "getWallet",
      "listPointLedgerEntries",
      "listPointProducts",
    ]));
  });

  it("preserves the canonical total and every Backend expiry bucket", async () => {
    const harness = createPointClientTestHarness();
    const wallet = PUBLIC_POINT_BALANCE_FIXTURES.canonical_expiry;
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/me/wallet` }, { body: wallet, status: 200 });
    const { data } = await harness.client.getWallet();
    expect(data.total_points).toBe(wallet.total_points);
    expect(data.expiring_within_7_days).toEqual(wallet.expiring_within_7_days);
    expect(data.expiring_within_7_days).toHaveLength(3);
    harness.mock.assertExhausted();
  });

  it.each([PUBLIC_POINT_BALANCE_FIXTURES.positive, PUBLIC_POINT_BALANCE_FIXTURES.zero])("reads canonical wallet balance %#", async (balance) => {
    const harness = createPointClientTestHarness();
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/me/wallet` }, { body: balance, status: 200 });
    await expect(harness.client.getWallet()).resolves.toMatchObject({ data: balance });
    assertBrowserRequestBoundary(harness.mock.requests[0]!, { client_version: "2.0.0-alpha.31", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it("retains Point Product ordering, audience, eligibility, and CTA", async () => {
    const harness = createPointClientTestHarness();
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/point-products` }, { body: PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_after_first_purchase, status: 200 });
    const { data } = await harness.client.listPointProducts();
    expect(data.data.map((product) => product.audience.code)).toEqual(["all_users", "first_purchase_users"]);
    expect(data.data.map((product) => product.eligible)).toEqual([true, false]);
    expect(data.data[1]?.ineligible_reason).toBe("first_purchase_required");
    expect(data.data[1]?.cta).toEqual({ action: "purchase", reason: "first_purchase_required", state: "disabled" });
    harness.mock.assertExhausted();
  });

  it.each([
    ["active", PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0]],
    ["upcoming", PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[1]],
    ["inactive", PUBLIC_POINT_PRODUCT_FIXTURES.unavailable.data[0]],
  ] as const)("preserves the canonical %s Limited Bonus object without deriving presentation", async (state, product) => {
    const harness = createPointClientTestHarness();
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/point-products` }, { body: { data: [product] }, status: 200 });
    const { data } = await harness.client.listPointProducts();
    expect(data.data[0]?.limited_bonus).toEqual(product.limited_bonus);
    expect(data.data[0]?.limited_bonus?.state).toBe(state);
    expect(data.data[0]?.limited_bonus?.presentation).toEqual(product.limited_bonus.presentation);
    harness.mock.assertExhausted();
  });

  it("preserves the additive optional Point Product shape when limited_bonus is omitted", async () => {
    const harness = createPointClientTestHarness();
    const { limited_bonus: omittedLimitedBonus, ...product } = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0];
    expect(omittedLimitedBonus).toBeDefined();
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/point-products` }, { body: { data: [product] }, status: 200 });
    const { data } = await harness.client.listPointProducts();
    expect(data.data[0]).not.toHaveProperty("limited_bonus");
    expect(data.data[0]?.grant).toEqual(product.grant);
    harness.mock.assertExhausted();
  });

  it("passes the opaque cursor unchanged and preserves history order and signed deltas", async () => {
    const harness = createPointClientTestHarness();
    const cursor = PUBLIC_POINT_HISTORY_FIXTURES.first_page.next_cursor;
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/me/point-ledgers?limit=10&cursor=${cursor}` },
      { body: PUBLIC_POINT_HISTORY_FIXTURES.multiple, status: 200 },
    );
    const { data } = await harness.client.listPointLedgerEntries({ cursor, limit: 10 });
    expect(data.items.map((entry) => entry.amount_delta)).toEqual([-300, 50, 1000]);
    expect(data.items.map((entry) => entry.reason.label)).toEqual(["ガチャ利用", "景品のポイント交換", "ポイント購入"]);
    harness.mock.assertExhausted();
  });

  it.each([
    PUBLIC_POINT_READ_PROBLEM_FIXTURES.unauthenticated,
    PUBLIC_POINT_READ_PROBLEM_FIXTURES.session_expired,
  ])("preserves generated Point problem $code", async (problem) => {
    const harness = createPointClientTestHarness();
    harness.mock.enqueueProblem({ method: "GET", url: `${origin}/me/wallet` }, problem);
    const error = await harness.client.getWallet().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiProblemError);
    expect((error as ApiProblemError).code).toBe(problem.code);
  });

  it("performs read-only GET requests and no Payment mutation", async () => {
    const harness = createPointClientTestHarness();
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/me/wallet` }, { body: PUBLIC_POINT_BALANCE_FIXTURES.positive, status: 200 });
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/point-products` }, { body: PUBLIC_POINT_PRODUCT_FIXTURES.anonymous_empty, status: 200 });
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/me/point-ledgers?limit=10` }, { body: PUBLIC_POINT_HISTORY_FIXTURES.empty, status: 200 });
    await harness.client.getWallet();
    await harness.client.listPointProducts();
    await harness.client.listPointLedgerEntries({ limit: 10 });
    expect(harness.mock.requests.map((request) => request.method)).toEqual(["GET", "GET", "GET"]);
    expect(harness.mock.requests.filter((request) => /payment|purchase/i.test(request.url))).toHaveLength(0);
    harness.mock.assertExhausted();
  });
});
