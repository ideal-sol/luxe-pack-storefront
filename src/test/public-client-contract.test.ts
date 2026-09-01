import {
  assertBrowserRequestBoundary,
  PUBLIC_CATALOG_FIXTURE,
  PUBLIC_CONTENT_FIXTURE,
  PUBLIC_FOOTER_PAGES_FIXTURE,
  PUBLIC_GACHA_CATALOG_DISPLAY_FIXTURES,
  PUBLIC_GACHA_PRESENTATION_FIXTURE,
  PUBLIC_TOP_BANNERS_FIXTURE,
} from "@oripa/storefront-testkit";
import { createPublicClientTestHarness } from "@/lib/platform/testing";

const origin = "https://storefront.test/platform";
const gachaCollection = {
  data: [PUBLIC_CATALOG_FIXTURE.data],
  meta: { has_more: false, next_cursor: null, page_size: 1 },
};

describe("MIG-099 canonical public catalog contract", () => {
  it("uses the canonical Prize-associated Rank fixture without legacy RankDisplay fields", () => {
    const rank = PUBLIC_CATALOG_FIXTURE.data.ranks[0]!;
    expect(rank).toMatchObject({
      display_order: 10,
      rank_name: "Sランク",
      show_total_stock: true,
      total_stock: 100,
    });
    expect(rank.lineup_image.media_type).toBe("image");
    expect(rank.current_video.media_type).toBe("video");
    expect(rank).not.toHaveProperty("code");
    expect(rank).not.toHaveProperty("presentation_assets");
    expect(rank).not.toHaveProperty("prizes");
  });

  it("uses the canonical gacha list with category and cursor queries", async () => {
    const category = createPublicClientTestHarness();
    category.mock.enqueueJson(
      { method: "GET", url: `${origin}/gachas?limit=20&category=${PUBLIC_CATALOG_FIXTURE.data.category.slug}` },
      { body: gachaCollection, status: 200 },
    );
    await expect(category.client.listGachas({ limit: 20, category: PUBLIC_CATALOG_FIXTURE.data.category.slug }))
      .resolves.toMatchObject({ data: gachaCollection });
    assertBrowserRequestBoundary(category.mock.requests[0]!, { client_version: "2.0.0-alpha.34", site_version: "0.1.0" });
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

  it("uses canonical detail and user-specific presentation reads", async () => {
    const harness = createPublicClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/gachas/by-slug/${PUBLIC_CATALOG_FIXTURE.data.slug}` },
      { body: PUBLIC_CATALOG_FIXTURE, status: 200 },
    );
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/gacha-presentations/${PUBLIC_CATALOG_FIXTURE.data.id}` },
      { body: PUBLIC_GACHA_PRESENTATION_FIXTURE, status: 200 },
    );
    await expect(harness.client.getGachaBySlug(PUBLIC_CATALOG_FIXTURE.data.slug))
      .resolves.toMatchObject({ data: PUBLIC_CATALOG_FIXTURE });
    await expect(harness.client.getGachaPresentation(PUBLIC_CATALOG_FIXTURE.data.id))
      .resolves.toMatchObject({ data: PUBLIC_GACHA_PRESENTATION_FIXTURE });
    assertBrowserRequestBoundary(harness.mock.requests[1]!, { client_version: "2.0.0-alpha.34", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it("preserves mixed sale-state ordering with category, tag, and cursor queries", async () => {
    const harness = createPublicClientTestHarness();
    const ordered = [
      PUBLIC_GACHA_CATALOG_DISPLAY_FIXTURES.ended,
      PUBLIC_GACHA_CATALOG_DISPLAY_FIXTURES.sold_out,
      PUBLIC_GACHA_CATALOG_DISPLAY_FIXTURES.authenticated_ineligible,
    ];
    const query = {
      category: PUBLIC_CATALOG_FIXTURE.data.category.slug,
      cursor: "cursor-mixed-states",
      limit: 20,
      tag: PUBLIC_CATALOG_FIXTURE.data.tags[0]!.slug,
    };
    harness.mock.enqueueJson(
      {
        method: "GET",
        url: `${origin}/gachas?limit=20&cursor=cursor-mixed-states&category=${query.category}&tag=${query.tag}`,
      },
      { body: { data: ordered, meta: { has_more: false, next_cursor: null, page_size: 3 } }, status: 200 },
    );
    const { data } = await harness.client.listGachas(query);
    expect(data.data.map((item) => item.presentation?.sale_state)).toEqual(["ended", "sold_out", "on_sale"]);
    expect(data.data[2]?.presentation?.ineligible_reason).toBe("audience_not_eligible");
    harness.mock.assertExhausted();
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
      { body: PUBLIC_TOP_BANNERS_FIXTURE.response, status: 200 },
    );
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/content/notices?limit=3` },
      { body: { items: [PUBLIC_CONTENT_FIXTURE.notice], next_cursor: null }, status: 200 },
    );
    await expect(harness.client.listBanners()).resolves.toMatchObject({ data: PUBLIC_TOP_BANNERS_FIXTURE.response });
    expect(PUBLIC_TOP_BANNERS_FIXTURE.response.items[0]).toMatchObject({
      image_url: expect.stringMatching(/^\//),
      link_url: "/gachas",
      title: "トップ表示バナー",
    });
    await expect(harness.client.listNotices({ limit: 3 })).resolves.toMatchObject({ data: { items: [PUBLIC_CONTENT_FIXTURE.notice] } });
    harness.mock.assertExhausted();
  });

  it("uses the canonical Backend-filtered Footer Page collection", async () => {
    const harness = createPublicClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/content/footer-pages` },
      { body: PUBLIC_FOOTER_PAGES_FIXTURE.response, status: 200 },
    );

    await expect(harness.client.listFooterPages()).resolves.toMatchObject({
      data: PUBLIC_FOOTER_PAGES_FIXTURE.response,
    });
    assertBrowserRequestBoundary(harness.mock.requests[0]!, {
      client_version: "2.0.0-alpha.34",
      site_version: "0.1.0",
    });
    harness.mock.assertExhausted();
  });

  it("accepts an empty canonical Footer Page collection", async () => {
    const harness = createPublicClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/content/footer-pages` },
      { body: { items: [] }, status: 200 },
    );

    await expect(harness.client.listFooterPages()).resolves.toMatchObject({ data: { items: [] } });
    harness.mock.assertExhausted();
  });

  it("accepts canonical empty public content without treating it as an error", async () => {
    const harness = createPublicClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/content/banners` },
      { body: { items: [] }, status: 200 },
    );
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/content/notices?limit=10` },
      { body: { items: [], next_cursor: null }, status: 200 },
    );

    await expect(harness.client.listBanners()).resolves.toMatchObject({ data: { items: [] } });
    await expect(harness.client.listNotices({ limit: 10 })).resolves.toMatchObject({
      data: { items: [], next_cursor: null },
    });
    harness.mock.assertExhausted();
  });

  it("uses canonical notice detail and static page methods", async () => {
    const staticPage = {
      body_html: "<h2>Fixture heading</h2><p>Fixture static content.</p>",
      checksum_sha256: "7a9cfb28bf7ec29156a06182de4097920877db4279b231306f975c2e6c0f6200",
      id: "0198a001-0000-7000-8000-000000000204",
      is_legal: true,
      publish_end_at: null,
      publish_start_at: "2026-07-28T00:00:00Z",
      slug: "fixture-page",
      title: "Fixture Page",
    } as const;
    const harness = createPublicClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/content/notices/${PUBLIC_CONTENT_FIXTURE.notice.id}` },
      { body: PUBLIC_CONTENT_FIXTURE.notice, status: 200 },
    );
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/content/pages/${staticPage.slug}` },
      { body: staticPage, status: 200 },
    );
    await expect(harness.client.getNotice(PUBLIC_CONTENT_FIXTURE.notice.id))
      .resolves.toMatchObject({ data: PUBLIC_CONTENT_FIXTURE.notice });
    await expect(harness.client.getStaticPage(staticPage.slug))
      .resolves.toMatchObject({ data: staticPage });
    harness.mock.assertExhausted();
  });
});
