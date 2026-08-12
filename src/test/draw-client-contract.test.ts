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
  PUBLIC_DRAW_PROBLEM_FIXTURES,
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

describe("MIG-062E browser Draw contract regression", () => {
  it("pins alpha.8 and retains every Storefront operation used before the upgrade", () => {
    for (const packageName of ["site-schema", "storefront-client", "storefront-testkit"]) {
      const packageJson = JSON.parse(readFileSync(`node_modules/@oripa/${packageName}/package.json`, "utf8"));
      expect(packageJson.version).toBe("2.0.0-alpha.8");
    }
    expect(PUBLIC_CONTRACT_FIXTURE.bundle_sha256).toBe("210692ca1fa89c7ae28fc942c07d2b740eac7e2230d6b8c255570ac6bc16d568");
    expect(PUBLIC_CONTRACT_FIXTURE.operation_ids).toEqual(expect.arrayContaining([
      "getUserSession", "loginUser", "registerUser",
      "listGachas", "getGachaBySlug", "getGachaPresentation",
      "listContentBanners", "listContentNotices", "getContentNotice", "getContentStaticPage",
      "listUserPrizes", "getUserPrize",
      "listExternalIdentities", "startLineIdentityLink", "unlinkLineIdentity",
      "createDraw", "getDrawRequest",
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
    assertBrowserRequestBoundary(harness.mock.requests[1]!, { client_version: "2.0.0-alpha.8", site_version: "0.1.0" });
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
