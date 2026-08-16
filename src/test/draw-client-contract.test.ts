import { readFileSync } from "node:fs";
import {
  createIdempotencyKey,
  isDrawProblemError,
} from "@oripa/storefront-client/browser";
import {
  assertBrowserRequestBoundary,
  assertDrawProblemDetails,
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_CONTRACT_FIXTURE,
  PUBLIC_DRAW_FIXTURE,
  PUBLIC_DRAW_HISTORY_FIXTURES,
  PUBLIC_DRAW_HISTORY_PROBLEM_FIXTURES,
  PUBLIC_DRAW_PROBLEM_FIXTURES,
  PUBLIC_PARTIAL_REMAINING_DRAW_FIXTURE,
} from "@oripa/storefront-testkit";
import { createDrawClientTestHarness } from "@/lib/platform/testing";

const origin = "https://storefront.test/platform";
const csrf = "e".repeat(64);

function enqueueCsrf(harness: ReturnType<typeof createDrawClientTestHarness>) {
  harness.mock.enqueueJson(
    { method: "GET", url: `${origin}/auth/session` },
    { body: PUBLIC_AUTH_FIXTURE.authenticated_session, status: 200 },
  );
}

describe("MIG-062V browser Draw and current-user history contract", () => {
  it("pins alpha.19 and retains every Storefront operation used before the upgrade", () => {
    for (const packageName of ["site-schema", "storefront-client", "storefront-testkit"]) {
      const packageJson = JSON.parse(readFileSync(`node_modules/@oripa/${packageName}/package.json`, "utf8"));
      expect(packageJson.version).toBe("2.0.0-alpha.19");
    }
    expect(PUBLIC_CONTRACT_FIXTURE.bundle_sha256).toBe("2b6883e8e51eebe6414f401553e866112b56d6e400b34ca17436433666fa0211");
    expect(PUBLIC_CONTRACT_FIXTURE.operation_ids).toEqual(expect.arrayContaining([
      "getUserSession", "loginUser", "registerUser",
      "listGachas", "getGachaBySlug", "getGachaPresentation",
      "listContentBanners", "listContentNotices", "getContentNotice", "getContentStaticPage",
      "listUserPrizes", "getUserPrize",
      "listExternalIdentities", "startLineIdentityLink", "unlinkLineIdentity",
      "createDraw", "getDrawRequest", "listDrawHistory",
      "createShippingRequest", "exchangeUserPrizes",
    ]));
  });

  it("initializes browser CSRF and creates a Draw with the caller key", async () => {
    const harness = createDrawClientTestHarness(csrf);
    const key = createIdempotencyKey();
    enqueueCsrf(harness);
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/gachas/${PUBLIC_DRAW_FIXTURE.gacha_id}/draws` },
      { body: PUBLIC_DRAW_FIXTURE, status: 200 },
    );

    const response = await harness.client.createDraw(PUBLIC_DRAW_FIXTURE.gacha_id, 1000, { idempotency_key: key });
    expect(response.data.id).toBe(PUBLIC_DRAW_FIXTURE.id);
    expect(harness.mock.requests[0]?.credentials).toBe("include");
    expect(harness.mock.requests[1]?.credentials).toBe("include");
    expect(harness.mock.requests[1]?.headers["idempotency-key"]).toBe(key);
    expect(harness.mock.requests[1]?.headers["x-xsrf-token"]).toBe(csrf);
    assertBrowserRequestBoundary(harness.mock.requests[1]!, { client_version: "2.0.0-alpha.19", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it("keeps requested 1000 while the Backend executes and replays the canonical partial 900", async () => {
    const fixture = PUBLIC_PARTIAL_REMAINING_DRAW_FIXTURE;
    const harness = createDrawClientTestHarness(csrf);
    const key = createIdempotencyKey();
    enqueueCsrf(harness);
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/gachas/${fixture.presentation.gacha_id}/draws` },
      { body: fixture.response, status: 200 },
    );
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/gachas/${fixture.presentation.gacha_id}/draws` },
      { body: { ...fixture.response, ...fixture.replay }, status: 200 },
    );

    const first = await harness.client.createDraw(fixture.presentation.gacha_id, fixture.request.requested_count, {
      idempotency_key: key,
    });
    const replay = await harness.client.createDraw(fixture.presentation.gacha_id, fixture.request.requested_count, {
      idempotency_key: key,
    });

    expect(first.data).toMatchObject({ executed_count: 900, requested_count: 1000 });
    expect(replay.data).toMatchObject({ executed_count: 900, idempotent_replay: true, requested_count: 1000 });
    expect(harness.mock.requests[1]?.headers["idempotency-key"]).toBe(key);
    expect(harness.mock.requests[2]?.headers["idempotency-key"]).toBe(key);
    harness.mock.assertExhausted();
  });

  it("retrieves a completed Draw without creating another mutation", async () => {
    const harness = createDrawClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/draw-requests/${PUBLIC_DRAW_FIXTURE.id}` },
      { body: PUBLIC_DRAW_FIXTURE, status: 200 },
    );
    await expect(harness.client.getDrawRequest(PUBLIC_DRAW_FIXTURE.id)).resolves.toMatchObject({
      data: { id: PUBLIC_DRAW_FIXTURE.id, status: "completed" },
    });
    expect(harness.mock.requests).toHaveLength(1);
    harness.mock.assertExhausted();
  });

  it("passes the opaque history cursor unchanged and preserves stable Backend ordering", async () => {
    const harness = createDrawClientTestHarness();
    const cursor = PUBLIC_DRAW_HISTORY_FIXTURES.first_page.next_cursor;
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/me/draws?limit=10&cursor=${cursor}` },
      { body: PUBLIC_DRAW_HISTORY_FIXTURES.multiple, status: 200 },
    );

    const { data } = await harness.client.listDrawHistory({ cursor, limit: 10 });
    expect(data.items.map((entry) => entry.id)).toEqual(
      PUBLIC_DRAW_HISTORY_FIXTURES.multiple.items.map((entry) => entry.id),
    );
    expect(data.items.map((entry) => [entry.requested_count, entry.executed_count])).toEqual([[5, 2], [5, 5], [1, 1]]);
    expect(data.items.map((entry) => entry.status)).toEqual([
      { code: "completed", label: "完了" },
      { code: "completed", label: "完了" },
      { code: "completed", label: "完了" },
    ]);
    expect(harness.mock.requests[0]?.method).toBe("GET");
    assertBrowserRequestBoundary(harness.mock.requests[0]!, { client_version: "2.0.0-alpha.19", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it.each([
    PUBLIC_DRAW_HISTORY_PROBLEM_FIXTURES.unauthenticated,
    PUBLIC_DRAW_HISTORY_PROBLEM_FIXTURES.invalid_cursor,
    PUBLIC_DRAW_HISTORY_PROBLEM_FIXTURES.rate_limited,
  ])("preserves generated Draw History problem $code", async (problem) => {
    const harness = createDrawClientTestHarness();
    harness.mock.enqueueProblem({ method: "GET", url: `${origin}/me/draws?limit=10` }, problem);
    await expect(harness.client.listDrawHistory({ limit: 10 })).rejects.toMatchObject({
      code: problem.code,
      status: problem.status,
    });
    expect(harness.mock.requests[0]?.method).toBe("GET");
  });

  it.each(PUBLIC_DRAW_PROBLEM_FIXTURES)("preserves the generated typed Draw problem $code", async (problem) => {
    const harness = createDrawClientTestHarness(csrf);
    enqueueCsrf(harness);
    harness.mock.enqueueProblem(
      { method: "POST", url: `${origin}/gachas/${PUBLIC_DRAW_FIXTURE.gacha_id}/draws` },
      problem,
    );
    const error = await harness.client.createDraw(PUBLIC_DRAW_FIXTURE.gacha_id, 1000, { idempotency_key: createIdempotencyKey() })
      .catch((caught: unknown) => caught);
    assertDrawProblemDetails(error, problem.code);
    expect(isDrawProblemError(error, problem.code)).toBe(true);
  });
});
