import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_CATALOG_FIXTURE,
  PUBLIC_CONTENT_FIXTURE,
  PUBLIC_GACHA_CATALOG_DISPLAY_FIXTURES,
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
    listBanners: vi.fn().mockResolvedValue(response({ items: [PUBLIC_CONTENT_FIXTURE.banner] })),
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

  it("renders home sections and links to the full catalog", async () => {
    renderPublic(<PublicHome />, publicClient());
    await screen.findByText(PUBLIC_CONTENT_FIXTURE.banner.title);
    expect(screen.getByRole("heading", { name: "ガチャラインナップ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /もっと見る/ })).toHaveAttribute("href", "/gachas");
    expect(screen.getByText(PUBLIC_CONTENT_FIXTURE.notice.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /一覧を見る/ })).toHaveAttribute("href", "/notices");
    expect(screen.getByRole("link", { name: new RegExp(PUBLIC_CONTENT_FIXTURE.notice.title) }))
      .toHaveAttribute("href", `/notices/${PUBLIC_CONTENT_FIXTURE.notice.id}`);
  });

  it("distinguishes home loading, empty, typed error, and configuration unavailable", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderPublic(<PublicHome />, publicClient({ listBanners: vi.fn(() => pending) }));
    expect(screen.getByRole("status")).toHaveTextContent("トップページを読み込み中");
    loading.unmount();

    const emptyClient = publicClient({
      listBanners: vi.fn().mockResolvedValue(response({ items: [] })),
      listGachaCategories: vi.fn().mockResolvedValue(response({ data: [] })),
      listGachas: vi.fn().mockResolvedValue(response({ data: [], meta: { has_more: false, next_cursor: null, page_size: 0 } })),
      listNotices: vi.fn().mockResolvedValue(response({ items: [], next_cursor: null })),
    });
    const empty = renderPublic(<PublicHome />, emptyClient);
    await screen.findByText("新しいご案内を準備中です");
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
    const error = renderPublic(<PublicHome />, publicClient({ listBanners: vi.fn().mockRejectedValue(problem) }));
    await screen.findByText("公開情報を取得できませんでした");
    error.unmount();

    renderPublic(<PublicHome />, null);
    expect(screen.getByText("公開情報を表示できません")).toBeInTheDocument();
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
