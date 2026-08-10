import { readFileSync } from "node:fs";
import { createStorefrontDrawClient } from "@oripa/storefront-client";
import {
  assertBrowserRequestBoundary,
  PUBLIC_CONTRACT_FIXTURE,
  PUBLIC_USER_PRIZE_FIXTURE,
} from "@oripa/storefront-testkit";
import type { UserPrize } from "@/lib/platform";
import { createPrizeClientTestHarness } from "@/lib/platform/testing";

const origin = "https://storefront.test/platform";
const fixture = PUBLIC_USER_PRIZE_FIXTURE as UserPrize;

describe("MIG-062C prize inventory contract regression", () => {
  it("pins every Production package to alpha.6 and retains existing contracts", () => {
    for (const packageName of ["site-schema", "storefront-client", "storefront-testkit"]) {
      const packageJson = JSON.parse(readFileSync(`node_modules/@oripa/${packageName}/package.json`, "utf8"));
      expect(packageJson.version).toBe("2.0.0-alpha.6");
    }
    expect(PUBLIC_CONTRACT_FIXTURE.bundle_sha256).toBe("6f4fc425718a57237fa89c0f6c75b196c0bf287022ce117dd916dd9b2cf457a1");
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
    ]));
    expect(createStorefrontDrawClient).toBeTypeOf("function");
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
    assertBrowserRequestBoundary(harness.mock.requests[0]!, { client_version: "2.0.0-alpha.6", site_version: "0.1.0" });
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
});
