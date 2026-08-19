import {
  assertBrowserRequestBoundary,
  PUBLIC_CONTRACT_FIXTURE,
  PUBLIC_LINE_FRIEND_STATE_FIXTURES,
  PUBLIC_LINE_FRIEND_STATE_PROBLEM_FIXTURES,
} from "@oripa/storefront-testkit";
import { createExternalIdentityClientTestHarness } from "@/lib/platform/testing";

const origin = "https://storefront.test/platform";

describe("MIG-062Z retained LINE Friend State contract", () => {
  it("publishes getLineFriendState through the generated canonical Client", () => {
    expect(PUBLIC_CONTRACT_FIXTURE.operation_ids).toContain("getLineFriendState");
  });

  it.each(Object.entries(PUBLIC_LINE_FRIEND_STATE_FIXTURES))(
    "reads the %s Backend presentation without dropping or recalculating fields",
    async (_, fixture) => {
      const harness = createExternalIdentityClientTestHarness();
      harness.mock.enqueueJson(
        { method: "GET", url: `${origin}/me/line-friend-state` },
        { body: fixture, status: 200 },
      );

      const result = await harness.client.getLineFriendState();

      expect(result.data).toEqual(fixture);
      expect(result.metadata.status).toBe(200);
      assertBrowserRequestBoundary(harness.mock.requests[0]!, {
        client_version: "2.0.0-alpha.23",
        site_version: "0.1.0",
      });
      expect(JSON.stringify(result.data)).not.toMatch(/provider_subject|access_token|refresh_token|client_secret/i);
      harness.mock.assertExhausted();
    },
  );

  it.each(Object.entries(PUBLIC_LINE_FRIEND_STATE_PROBLEM_FIXTURES))(
    "preserves the %s typed Problem Details",
    async (_, fixture) => {
      const harness = createExternalIdentityClientTestHarness();
      harness.mock.enqueueProblem(
        { method: "GET", url: `${origin}/me/line-friend-state` },
        fixture,
      );

      await expect(harness.client.getLineFriendState()).rejects.toMatchObject({
        code: fixture.code,
        status: fixture.status,
      });
      harness.mock.assertExhausted();
    },
  );
});
