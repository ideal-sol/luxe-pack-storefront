import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_CATALOG_FIXTURE,
  PUBLIC_CONTENT_FIXTURE,
  PUBLIC_GACHA_CATALOG_DISPLAY_FIXTURES,
  PUBLIC_TOP_BANNERS_FIXTURE,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { GachaCatalog } from "@/components/catalog/gacha-catalog";
import { GachaCard } from "@/components/catalog/gacha-card";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import { PublicHome } from "@/components/catalog/public-home";
import type { AuthClientAdapter, GachaSummary, PublicCatalogAdapter } from "@/lib/platform";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/gachas",
  useRouter: () => ({ replace }),
}));

const metadata = { idempotency_replayed: false, status: 200 } as const;
const summary = PUBLIC_CATALOG_FIXTURE.data;
const categoryCollection = { data: [summary.category] };
const gachaCollection = { data: [summary], meta: { has_more: false, next_cursor: null, page_size: 1 } };
const displayFixtures = PUBLIC_GACHA_CATALOG_DISPLAY_FIXTURES as unknown as Readonly<
  Record<keyof typeof PUBLIC_GACHA_CATALOG_DISPLAY_FIXTURES, GachaSummary>
>;

function response<T>(data: T) {
  return { data, metadata };
}

function publicClient(overrides: Partial<PublicCatalogAdapter> = {}): PublicCatalogAdapter {
  return {
    getNotice: vi.fn().mockResolvedValue(response(PUBLIC_CONTENT_FIXTURE.notice)),
    getStaticPage: vi.fn(),
    listBanners: vi.fn().mockResolvedValue(response(PUBLIC_TOP_BANNERS_FIXTURE.response)),
    listGachaCategories: vi.fn().mockResolvedValue(response(categoryCollection)),
    listGachaTags: vi.fn().mockResolvedValue(response({ data: summary.tags })),
    listGachas: vi.fn().mockResolvedValue(response(gachaCollection)),
    listNotices: vi.fn().mockResolvedValue(response({ items: [PUBLIC_CONTENT_FIXTURE.notice], next_cursor: null })),
    ...overrides,
  } as PublicCatalogAdapter;
}

function renderPublic(ui: React.ReactNode, client: PublicCatalogAdapter | null) {
  return render(<PublicClientProvider client={client}>{ui}</PublicClientProvider>);
}

describe("public catalog UI", () => {
  it("renders multiple public gacha cards and detail links", async () => {
    renderPublic(
      <GachaCatalog />,
      publicClient({ listGachas: vi.fn().mockResolvedValue(response({ ...gachaCollection, data: [summary, summary] })) }),
    );
    expect(await screen.findAllByRole("link", { name: `${summary.title}の詳細を見る` })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: summary.title })[0]).toHaveAttribute("href", `/gachas/${summary.slug}`);
  });

  it.each([
    ["on_sale", "販売中", "抽選対象"],
    ["coming_soon", "販売開始前", "このガチャはまだ販売開始前です。"],
    ["ended", "販売終了", "このガチャの販売は終了しました。"],
    ["sold_out", "完売", "このガチャは完売しました。"],
    ["authenticated_eligible", "販売中", "抽選対象"],
    ["authenticated_ineligible", "販売中", "このガチャの対象条件を満たしていません。"],
    ["anonymous", "販売中", "抽選するにはログインが必要です。"],
  ] as const)("renders the alpha.9 %s presentation without local state derivation", (fixtureName, saleLabel, reasonLabel) => {
    render(<GachaCard gacha={displayFixtures[fixtureName]} />);
    expect(screen.getByText(saleLabel)).toBeInTheDocument();
    expect(screen.getByText(reasonLabel)).toBeInTheDocument();
  });

  it.each(["ended", "sold_out"] as const)("uses Backend display flags for %s facts", (fixtureName) => {
    const fixture = displayFixtures[fixtureName];
    render(<GachaCard gacha={fixture} />);
    expect(screen.queryByText(new Intl.NumberFormat("ja-JP").format(fixture.price_points))).not.toBeInTheDocument();
    expect(screen.getByLabelText(`残り${fixture.remaining_count}口`)).toBeInTheDocument();
    expect(screen.queryByLabelText(`残り${fixture.remaining_count}口、全${fixture.total_count}口`)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(`抽選済み${fixture.drawn_count}回`)).not.toBeInTheDocument();
    expect(screen.getByLabelText("販売・対象状態")).toHaveAttribute("data-cta-state", "hidden");
  });

  it("shows Backend-enabled on-sale facts and CTA presentation", () => {
    const fixture = displayFixtures.on_sale;
    render(<GachaCard gacha={fixture} />);
    expect(screen.getByText(new Intl.NumberFormat("ja-JP").format(fixture.price_points))).toBeInTheDocument();
    expect(screen.getByText("コイン / 1回")).toBeInTheDocument();
    expect(screen.getByLabelText(`残り${fixture.remaining_count}口、全${fixture.total_count}口`)).toBeInTheDocument();
    expect(screen.getByLabelText(`抽選済み${fixture.drawn_count}回`)).toBeInTheDocument();
    expect(screen.getByLabelText("販売・対象状態")).toHaveAttribute("data-cta-state", "enabled");
  });

  it("keeps ended, sold-out, and authenticated-ineligible items in Backend order", async () => {
    const data = [displayFixtures.ended, displayFixtures.sold_out, displayFixtures.authenticated_ineligible];
    renderPublic(
      <GachaCatalog />,
      publicClient({ listGachas: vi.fn().mockResolvedValue(response({ ...gachaCollection, data })) }),
    );
    expect(await screen.findAllByRole("link", { name: `${summary.title}の詳細を見る` })).toHaveLength(3);
    expect(screen.getAllByLabelText("販売・対象状態").map((item) => item.textContent)).toEqual([
      expect.stringContaining("販売終了"),
      expect.stringContaining("完売"),
      expect.stringContaining("対象条件を満たしていません"),
    ]);
  });

  it("distinguishes loading, empty, typed error, and configuration unavailable", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderPublic(<GachaCatalog />, publicClient({ listGachas: vi.fn(() => pending) }));
    expect(screen.getByRole("status")).toHaveTextContent("ガチャを読み込み中");
    loading.unmount();

    const empty = renderPublic(
      <GachaCatalog />,
      publicClient({ listGachas: vi.fn().mockResolvedValue(response({ data: [], meta: { has_more: false, next_cursor: null, page_size: 0 } })) }),
    );
    await screen.findByText("ガチャがありません");
    empty.unmount();

    const problem = new ApiProblemError({
      code: "CATALOG_UNAVAILABLE",
      request_id: "request-catalog-error",
      retryable: true,
      status: 503,
      title: "Catalog unavailable",
      type: "https://storefront.test/problems/catalog-unavailable",
    });
    const error = renderPublic(<GachaCatalog />, publicClient({ listGachas: vi.fn().mockRejectedValue(problem) }));
    await screen.findByText("ガチャを取得できませんでした");
    expect(screen.getByText(/時間をおいて/)).toBeInTheDocument();
    error.unmount();

    renderPublic(<GachaCatalog />, null);
    expect(screen.getByText("ガチャ一覧を表示できません")).toBeInTheDocument();
  });

  it("shows the neutral image fallback when the asset is missing", async () => {
    const withoutAsset = { ...summary, presentation_asset: null };
    renderPublic(
      <GachaCatalog />,
      publicClient({ listGachas: vi.fn().mockResolvedValue(response({ ...gachaCollection, data: [withoutAsset] })) }),
    );
    expect(await screen.findByRole("img", { name: summary.title })).toBeInTheDocument();
    expect(screen.getByText("IMAGE PREPARING")).toBeInTheDocument();
  });

  it("applies a canonical category filter without adding a local sort", async () => {
    const listGachas = vi.fn().mockResolvedValue(response(gachaCollection));
    renderPublic(<GachaCatalog />, publicClient({ listGachas }));
    const category = await screen.findByRole("button", { name: summary.category.name });
    fireEvent.click(category);
    await waitFor(() => expect(listGachas).toHaveBeenLastCalledWith({ category: summary.category.slug, limit: 20 }));
    expect(replace).toHaveBeenCalledWith(`/gachas?category=${summary.category.slug}`);
  });

  it("starts home filters unselected and requests the unchanged six-item lineup", async () => {
    const client = publicClient();
    renderPublic(<PublicHome />, client);
    const categories = await screen.findByRole("navigation", { name: "ガチャカテゴリー" });
    const tags = screen.getByRole("navigation", { name: "ガチャタグ" });
    for (const control of [...within(categories).getAllByRole("button"), ...within(tags).getAllByRole("button")]) {
      expect(control).toHaveAttribute("aria-pressed", "false");
    }
    expect(within(categories).queryByRole("button", { name: "すべて" })).not.toBeInTheDocument();
    expect(within(tags).getByRole("button", { name: `#${summary.tags[0]!.name}` })).toBeInTheDocument();
    expect(client.listGachaTags).toHaveBeenCalledOnce();
    expect(client.listGachas).toHaveBeenCalledWith({ limit: 6 });
  });

  it("filters home by tag alone without navigating or deriving results locally", async () => {
    replace.mockClear();
    const client = publicClient();
    renderPublic(<PublicHome />, client);
    const tag = summary.tags[0]!;
    fireEvent.click(await screen.findByRole("button", { name: `#${tag.name}` }));
    await waitFor(() => expect(client.listGachas).toHaveBeenLastCalledWith({ limit: 6, tag: tag.slug }));
    expect(screen.getByRole("button", { name: summary.category.name })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: `#${tag.name}` })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("link", { name: summary.title })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("switches independent category and tag selections using the combined API filter", async () => {
    replace.mockClear();
    const secondCategory = { ...summary.category, id: "category-2", slug: "category-2", name: "別カテゴリー" };
    const secondTag = { id: "tag-2", slug: "tag-2", name: "別タグ" };
    const client = publicClient({
      listGachaCategories: vi.fn().mockResolvedValue(response({ data: [summary.category, secondCategory] })),
      listGachaTags: vi.fn().mockResolvedValue(response({ data: [summary.tags[0]!, secondTag] })),
    });
    renderPublic(<PublicHome />, client);
    fireEvent.click(await screen.findByRole("button", { name: summary.category.name }));
    await waitFor(() => expect(client.listGachas).toHaveBeenLastCalledWith({ limit: 6, category: summary.category.slug }));
    fireEvent.click(screen.getByRole("button", { name: `#${summary.tags[0]!.name}` }));
    await waitFor(() => expect(client.listGachas).toHaveBeenLastCalledWith({ limit: 6, category: summary.category.slug, tag: summary.tags[0]!.slug }));
    fireEvent.click(screen.getByRole("button", { name: secondCategory.name }));
    await waitFor(() => expect(client.listGachas).toHaveBeenLastCalledWith({ limit: 6, category: secondCategory.slug, tag: summary.tags[0]!.slug }));
    fireEvent.click(screen.getByRole("button", { name: `#${secondTag.name}` }));
    await waitFor(() => expect(client.listGachas).toHaveBeenLastCalledWith({ limit: 6, category: secondCategory.slug, tag: secondTag.slug }));
    expect(screen.getByRole("button", { name: summary.category.name })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: secondCategory.name })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: `#${summary.tags[0]!.name}` })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: `#${secondTag.name}` })).toHaveAttribute("aria-pressed", "true");
    expect(client.listGachaCategories).toHaveBeenCalledOnce();
    expect(client.listGachaTags).toHaveBeenCalledOnce();
    expect(client.listNotices).toHaveBeenCalledOnce();
    expect(client.listBanners).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)("ignores an obsolete filter request that later %ss", async (outcome) => {
    let resolveOld!: (value: ReturnType<typeof response<typeof gachaCollection>>) => void;
    let rejectOld!: (error: Error) => void;
    const oldRequest = new Promise<ReturnType<typeof response<typeof gachaCollection>>>((resolve, reject) => {
      resolveOld = resolve;
      rejectOld = reject;
    });
    const latest = { ...summary, id: "latest", slug: "latest", title: "最新の絞り込み結果" };
    const listGachas = vi.fn()
      .mockResolvedValueOnce(response(gachaCollection))
      .mockReturnValueOnce(oldRequest)
      .mockResolvedValueOnce(response({ ...gachaCollection, data: [latest] }));
    renderPublic(<PublicHome />, publicClient({ listGachas }));
    await screen.findByRole("link", { name: summary.title });
    fireEvent.click(screen.getByRole("button", { name: summary.category.name }));
    expect(screen.queryByRole("link", { name: summary.title })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ガチャ一覧" })).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByRole("button", { name: `#${summary.tags[0]!.name}` }));
    await screen.findByRole("link", { name: latest.title });
    await act(async () => {
      if (outcome === "resolve") resolveOld(response(gachaCollection));
      else rejectOld(new Error("obsolete response"));
    });
    expect(screen.queryByRole("link", { name: summary.title })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: latest.title })).toBeInTheDocument();
    expect(screen.queryByText("ガチャを取得できませんでした")).not.toBeInTheDocument();
  });

  it("keeps filters available after an error and retries the selected query to an empty result", async () => {
    const listGachas = vi.fn().mockResolvedValueOnce(response(gachaCollection))
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(response({ ...gachaCollection, data: [] }));
    renderPublic(<PublicHome />, publicClient({ listGachas }));
    fireEvent.click(await screen.findByRole("button", { name: `#${summary.tags[0]!.name}` }));
    await screen.findByText("ガチャを取得できませんでした");
    expect(screen.getByRole("button", { name: `#${summary.tags[0]!.name}` })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    await screen.findByText("ラインナップを準備中です");
    expect(listGachas).toHaveBeenLastCalledWith({ limit: 6, tag: summary.tags[0]!.slug });
    expect(screen.queryByRole("link", { name: summary.title })).not.toBeInTheDocument();
  });

  it("renders home sections and links to the full catalog", async () => {
    renderPublic(<PublicHome />, publicClient());
    await screen.findByRole("img", { name: PUBLIC_TOP_BANNERS_FIXTURE.response.items[0].title });
    expect(screen.getByRole("link", { name: "トップ表示バナーを見る" })).toHaveAttribute("href", "/gachas");
    expect(screen.getByRole("link", { name: summary.title })).toHaveAttribute("href", `/gachas/${summary.slug}`);
    for (const text of ["FIND YOUR PACK", "カテゴリーから探す", "PACK LINEUP", "ガチャラインナップ", "PACK CATEGORY"]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("link", { name: /もっと見る|すべて見る/ })).not.toBeInTheDocument();
    expect(screen.getByText(PUBLIC_CONTENT_FIXTURE.notice.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /一覧を見る/ })).toHaveAttribute("href", "/notices");
    expect(screen.getByRole("link", { name: new RegExp(PUBLIC_CONTENT_FIXTURE.notice.title) }))
      .toHaveAttribute("href", `/notices/${PUBLIC_CONTENT_FIXTURE.notice.id}`);
  });

  it("distinguishes home loading, empty, typed error, and configuration unavailable", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderPublic(<PublicHome />, publicClient({ listGachas: vi.fn(() => pending) }));
    expect(screen.getByRole("status")).toHaveTextContent("トップページを読み込み中");
    loading.unmount();

    const emptyClient = publicClient({
      listBanners: vi.fn().mockResolvedValue(response({ items: [] })),
      listGachaCategories: vi.fn().mockResolvedValue(response({ data: [] })),
      listGachas: vi.fn().mockResolvedValue(response({ data: [], meta: { has_more: false, next_cursor: null, page_size: 0 } })),
      listNotices: vi.fn().mockResolvedValue(response({ items: [], next_cursor: null })),
    });
    const empty = renderPublic(<PublicHome />, emptyClient);
    await screen.findByText("新しいご案内を準備中です。");
    expect(screen.getByText("ラインナップを準備中です")).toBeInTheDocument();
    expect(screen.getByText("お知らせはありません")).toBeInTheDocument();
    empty.unmount();

    const problem = new ApiProblemError({
      code: "CATALOG_UNAVAILABLE",
      request_id: "request-home-error",
      retryable: true,
      status: 503,
      title: "Catalog unavailable",
      type: "https://storefront.test/problems/catalog-unavailable",
    });
    const error = renderPublic(<PublicHome />, publicClient({ listGachaCategories: vi.fn().mockRejectedValue(problem) }));
    await screen.findByText("公開情報を取得できませんでした");
    error.unmount();

    renderPublic(<PublicHome />, null);
    expect(screen.getByText("公開情報を表示できません")).toBeInTheDocument();
    expect(screen.getByText("現在、ガチャ情報を表示できません")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Catalog|CONFIGURATION/);
  });

  it("keeps home content available while the Banner request is loading or fails", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderPublic(<PublicHome />, publicClient({ listBanners: vi.fn(() => pending) }));
    expect(await screen.findByRole("link", { name: summary.title })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("バナーを読み込み中");
    loading.unmount();

    const problem = new ApiProblemError({
      code: "CONTENT_UNAVAILABLE",
      request_id: "request-banner-error",
      retryable: true,
      status: 503,
      title: "Content unavailable",
      type: "https://storefront.test/problems/content-unavailable",
    });
    renderPublic(<PublicHome />, publicClient({ listBanners: vi.fn().mockRejectedValue(problem) }));
    expect(await screen.findByText("バナーを取得できませんでした")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: summary.title })).toHaveAttribute("href", `/gachas/${summary.slug}`);
  });

  it("renders one canonical Banner without unnecessary Carousel controls", async () => {
    const banner = PUBLIC_TOP_BANNERS_FIXTURE.response.items[0];
    renderPublic(<PublicHome />, publicClient());
    expect(await screen.findByRole("img", { name: banner.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `${banner.title}を見る` })).toHaveAttribute("href", banner.link_url);
    expect(screen.queryByText(banner.title)).not.toBeInTheDocument();
    expect(screen.queryByText("FEATURED")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "次のバナー" })).not.toBeInTheDocument();
  });

  it("renders every Backend-returned Banner and changes the active Carousel item", async () => {
    const first = PUBLIC_TOP_BANNERS_FIXTURE.response.items[0];
    const second = { ...first, id: "0198a001-0000-7000-8000-000000000315", link_url: "/notices", title: "お知らせバナー" };
    const returnedDespiteFixtureExclusion = {
      ...first,
      id: PUBLIC_TOP_BANNERS_FIXTURE.excluded.top_off.id,
      link_url: "https://example.com/banner",
      title: PUBLIC_TOP_BANNERS_FIXTURE.excluded.top_off.title,
    };
    renderPublic(
      <PublicHome />,
      publicClient({ listBanners: vi.fn().mockResolvedValue(response({ items: [first, second, returnedDespiteFixtureExclusion] })) }),
    );

    expect(await screen.findByRole("link", { name: `${first.title}を見る` })).toHaveAttribute("href", first.link_url);
    expect(screen.getByRole("link", { name: `${second.title}を見る` })).toHaveAttribute("href", second.link_url);
    expect(screen.getByRole("link", { name: `${returnedDespiteFixtureExclusion.title}を見る` }))
      .toHaveAttribute("href", returnedDespiteFixtureExclusion.link_url);
    expect(screen.getByRole("button", { name: "1件目のバナーを表示" })).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "次のバナー" }));
    expect(screen.getByRole("button", { name: "2件目のバナーを表示" })).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(screen.getByRole("region", { name: "トップバナー" }), { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "3件目のバナーを表示" })).toHaveAttribute("aria-current", "true");
  });

  it("uses the existing Banner image fallback without inventing an asset", async () => {
    const banner = { ...PUBLIC_TOP_BANNERS_FIXTURE.response.items[0], image_url: undefined };
    renderPublic(<PublicHome />, publicClient({ listBanners: vi.fn().mockResolvedValue(response({ items: [banner] })) }));
    expect(await screen.findByText("BANNER PREPARING")).toBeInTheDocument();
  });

  it("renders the public catalog while Session is still loading", async () => {
    const sessionPending = new Promise<never>(() => undefined);
    const authClient = {
      getCurrentSession: vi.fn(() => sessionPending),
    } as unknown as AuthClientAdapter;
    render(
      <SessionProvider client={authClient}>
        <PublicClientProvider client={publicClient()}><GachaCatalog /></PublicClientProvider>
      </SessionProvider>,
    );
    expect(await screen.findByRole("link", { name: `${summary.title}の詳細を見る` })).toBeInTheDocument();
  });

  it.each([
    ["unauthenticated", PUBLIC_AUTH_FIXTURE.anonymous_session],
    ["authenticated", PUBLIC_AUTH_FIXTURE.authenticated_session],
  ])("keeps public catalog visible for an %s Session", async (_, session) => {
    const authClient = {
      getCurrentSession: vi.fn().mockResolvedValue(response(session)),
    } as unknown as AuthClientAdapter;
    const view = render(
      <SessionProvider client={authClient}>
        <PublicClientProvider client={publicClient()}><GachaCatalog /></PublicClientProvider>
      </SessionProvider>,
    );
    expect(await screen.findByRole("link", { name: `${summary.title}の詳細を見る` })).toBeInTheDocument();
    view.unmount();
  });
});
