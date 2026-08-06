import { assertBrowserRequestBoundary, PUBLIC_CATALOG_FIXTURE, PUBLIC_CONTENT_FIXTURE } from "@oripa/storefront-testkit";
import { createPublicClientTestHarness } from "@/lib/platform/testing";

const origin = "https://storefront.test/platform";
const gachaCollection = {
  data: [PUBLIC_CATALOG_FIXTURE.data],
  meta: { has_more: false, next_cursor: null, page_size: 1 },
};

describe("MIG-061U public catalog contract", () => {
  it("uses the canonical gacha list with category and cursor queries", async () => {
    const category = createPublicClientTestHarness();
    category.mock.enqueueJson(
      { method: "GET", url: `${origin}/gachas?limit=20&category=${PUBLIC_CATALOG_FIXTURE.data.category.slug}` },
      { body: gachaCollection, status: 200 },
    );
    await expect(category.client.listGachas({ limit: 20, category: PUBLIC_CATALOG_FIXTURE.data.category.slug }))
      .resolves.toMatchObject({ data: gachaCollection });
    assertBrowserRequestBoundary(category.mock.requests[0]!, { client_version: "2.0.0-alpha.1", site_version: "0.1.0" });
    category.mock.assertExhausted();

    const cursor = createPublicClientTestHarness();
    cursor.mock.enqueueJson(
      { method: "GET", url: `${origin}/gachas?limit=20&cursor=cursor-fixture-002` },
      { body: gachaCollection, status: 200 },
    );
    await expect(cursor.client.listGachas({ cursor: "cursor-fixture-002", limit: 20 }))
      .resolves.toMatchObject({ data: gachaCollection });
    cursor.mock.assertExhausted();
  });

  it("uses canonical category and tag collection methods", async () => {
    const harness = createPublicClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/gacha-categories` },
      { body: { data: [PUBLIC_CATALOG_FIXTURE.data.category] }, status: 200 },
    );
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/gacha-tags` },
      { body: { data: PUBLIC_CATALOG_FIXTURE.data.tags }, status: 200 },
    );
    await expect(harness.client.listGachaCategories()).resolves.toMatchObject({ data: { data: [PUBLIC_CATALOG_FIXTURE.data.category] } });
    await expect(harness.client.listGachaTags()).resolves.toMatchObject({ data: { data: PUBLIC_CATALOG_FIXTURE.data.tags } });
    harness.mock.assertExhausted();
  });

  it("uses canonical banner and notice summary methods", async () => {
    const harness = createPublicClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/content/banners` },
      { body: { items: [PUBLIC_CONTENT_FIXTURE.banner] }, status: 200 },
    );
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/content/notices?limit=3` },
      { body: { items: [PUBLIC_CONTENT_FIXTURE.notice], next_cursor: null }, status: 200 },
    );
    await expect(harness.client.listBanners()).resolves.toMatchObject({ data: { items: [PUBLIC_CONTENT_FIXTURE.banner] } });
    await expect(harness.client.listNotices({ limit: 3 })).resolves.toMatchObject({ data: { items: [PUBLIC_CONTENT_FIXTURE.notice] } });
    harness.mock.assertExhausted();
  });
});
