import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_CATALOG_FIXTURE, PUBLIC_CONTENT_FIXTURE } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { GachaCatalog } from "@/components/catalog/gacha-catalog";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import { PublicHome } from "@/components/catalog/public-home";
import type { AuthClientAdapter, PublicCatalogAdapter } from "@/lib/platform";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/gachas",
  useRouter: () => ({ replace }),
}));

const metadata = { idempotency_replayed: false, status: 200 } as const;
const summary = PUBLIC_CATALOG_FIXTURE.data;
const categoryCollection = { data: [summary.category] };
const gachaCollection = { data: [summary], meta: { has_more: false, next_cursor: null, page_size: 1 } };

function response<T>(data: T) {
  return { data, metadata };
}

function publicClient(overrides: Partial<PublicCatalogAdapter> = {}): PublicCatalogAdapter {
  return {
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
    expect(screen.getByRole("heading", { name: "販売中ガチャ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /もっと見る/ })).toHaveAttribute("href", "/gachas");
    expect(screen.getByText(PUBLIC_CONTENT_FIXTURE.notice.title)).toBeInTheDocument();
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
