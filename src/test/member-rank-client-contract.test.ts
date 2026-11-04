import { vi } from "vitest";
import { assertBrowserRequestBoundary, createMockFetch, PUBLIC_MEMBER_RANK_FIXTURES, PUBLIC_MEMBER_RANK_LIST_FIXTURE } from "@oripa/storefront-testkit";
import { listMemberRanks, loadMyMemberRank } from "@/lib/platform/member-rank-client";

const origin = "https://storefront.test/platform";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function harness() {
  const mock = createMockFetch();
  vi.stubEnv("NEXT_PUBLIC_PLATFORM_API_BASE_URL", origin);
  vi.stubGlobal("fetch", mock.fetch);
  return mock;
}

describe("pinned member rank Public API client", () => {
  it.each(["disabled", "beginner", "silver", "vip", "month_boundary"] as const)("reads %s via the canonical browser client without fabricating fields", async (key) => {
    const mock = harness();
    mock.enqueueJson({ method: "GET", url: `${origin}/me/member-rank` }, { status: 200, body: PUBLIC_MEMBER_RANK_FIXTURES[key] });
    const rank = await loadMyMemberRank();
    expect(rank).toEqual(PUBLIC_MEMBER_RANK_FIXTURES[key].data);
    expect(rank).toHaveProperty("breakdown");
    expect(rank.point_basis).toBe(rank.enabled ? "cumulative" : null);
    expect(rank.period).toBeNull();
    if (rank.enabled) expect(rank.breakdown.total).toBe(rank.rank_points);
    assertBrowserRequestBoundary(mock.requests[0]!, { client_version: "2.0.0-alpha.49", site_version: "0.1.0" });
    expect(mock.requests[0]).toMatchObject({ method: "GET", credentials: "include" });
    mock.assertExhausted();
  });

  it("sorts existing public settings by level without changing API amounts", async () => {
    const mock = harness();
    mock.enqueueJson({ method: "GET", url: `${origin}/member-ranks` }, { status: 200, body: { data: [...PUBLIC_MEMBER_RANK_LIST_FIXTURE.data].reverse() } });
    expect(await listMemberRanks()).toEqual(PUBLIC_MEMBER_RANK_LIST_FIXTURE.data);
    mock.assertExhausted();
  });

  it("propagates failures without synthesizing rank or history", async () => {
    const mock = harness();
    mock.enqueueNetworkError({ method: "GET", url: `${origin}/me/member-rank` });
    await expect(loadMyMemberRank()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    mock.assertExhausted();
  });
});
