import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  PUBLIC_CATALOG_FIXTURE,
  PUBLIC_CONTENT_FIXTURE,
  PUBLIC_GACHA_PRESENTATION_FIXTURE,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { GachaDetailView } from "@/components/catalog/gacha-detail";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";
import type { DrawClientAdapter, GachaDetail, GachaPresentationState, PublicCatalogAdapter } from "@/lib/platform";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const metadata = { idempotency_replayed: false, status: 200 } as const;
const detail = PUBLIC_CATALOG_FIXTURE.data as GachaDetail;
const presentation = PUBLIC_GACHA_PRESENTATION_FIXTURE.data as GachaPresentationState;

function response<T>(data: T) {
  return { data, metadata };
}

function publicClient(overrides: Partial<PublicCatalogAdapter> = {}): PublicCatalogAdapter {
  return {
    getGachaBySlug: vi.fn().mockResolvedValue(response({ data: detail })),
    getGachaPresentation: vi.fn().mockResolvedValue(response({ data: presentation })),
    getNotice: vi.fn().mockResolvedValue(response(PUBLIC_CONTENT_FIXTURE.notice)),
    getStaticPage: vi.fn(),
    listBanners: vi.fn().mockResolvedValue(response({ items: [] })),
    listGachaCategories: vi.fn().mockResolvedValue(response({ data: [] })),
    listGachaTags: vi.fn().mockResolvedValue(response({ data: [] })),
    listGachas: vi.fn().mockResolvedValue(response({ data: [], meta: { has_more: false, next_cursor: null, page_size: 0 } })),
    listNotices: vi.fn().mockResolvedValue(response({ items: [], next_cursor: null })),
    ...overrides,
  } as PublicCatalogAdapter;
}

function renderDetail(client: PublicCatalogAdapter | null = publicClient()) {
  const drawClient = {
    createDraw: vi.fn(),
    getDrawRequest: vi.fn(),
  } as DrawClientAdapter;
  return render(
    <PublicClientProvider client={client}>
      <DrawClientProvider client={drawClient}>
        <GachaDetailView slug={detail.slug} />
      </DrawClientProvider>
    </PublicClientProvider>,
  );
}

function presentationResponse(next: GachaPresentationState) {
  return vi.fn().mockResolvedValue(response({ data: next }));
}

describe("gacha detail UI", () => {
  it("renders canonical detail fields, ranks, prizes, and presentation state", async () => {
    const getGachaPresentation = presentationResponse(presentation);
    renderDetail(publicClient({ getGachaPresentation }));

    expect(await screen.findByRole("heading", { level: 1, name: detail.title })).toBeInTheDocument();
    expect(screen.getAllByText(`${detail.price_points}pt`)).toHaveLength(2);
    expect(screen.getByText(`${detail.remaining_count.toLocaleString()} / ${detail.total_count.toLocaleString()}`)).toBeInTheDocument();
    expect(screen.getByText(detail.category.name)).toBeInTheDocument();
    expect(screen.getByText(`#${detail.tags[0]!.name}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: detail.ranks[0]!.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${detail.ranks[0]!.prizes[0]!.name}の詳細を見る` })).toBeInTheDocument();
    expect(screen.getAllByText("販売中")).toHaveLength(2);
    expect(screen.getByText("対象: 初回ユーザー")).toBeInTheDocument();
    expect(getGachaPresentation).toHaveBeenCalledWith(detail.id);
  });

  it("distinguishes loading, configuration, not found, and typed errors", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderDetail(publicClient({ getGachaBySlug: vi.fn(() => pending) }));
    expect(screen.getByRole("status")).toHaveTextContent("ガチャ詳細を読み込み中");
    loading.unmount();

    const configuration = renderDetail(null);
    expect(screen.getByText("ガチャ詳細を表示できません")).toBeInTheDocument();
    configuration.unmount();

    const notFoundProblem = new ApiProblemError({
      code: "CATALOG_NOT_FOUND",
      request_id: "request-detail-not-found",
      retryable: false,
      status: 404,
      title: "Catalog not found",
      type: "https://storefront.test/problems/catalog-not-found",
    });
    const notFound = renderDetail(publicClient({ getGachaBySlug: vi.fn().mockRejectedValue(notFoundProblem) }));
    expect(await screen.findByText("ガチャが見つかりません")).toBeInTheDocument();
    notFound.unmount();

    const typedProblem = new ApiProblemError({
      code: "CATALOG_UNAVAILABLE",
      request_id: "request-detail-error",
      retryable: true,
      status: 503,
      title: "Catalog unavailable",
      type: "https://storefront.test/problems/catalog-unavailable",
    });
    renderDetail(publicClient({ getGachaPresentation: vi.fn().mockRejectedValue(typedProblem) }));
    expect(await screen.findByText("ガチャ詳細を取得できませんでした")).toBeInTheDocument();
    expect(screen.getByText(/時間をおいて/)).toBeInTheDocument();
  });

  it("uses neutral fallbacks for missing main and prize images", async () => {
    const missingAssets = {
      ...detail,
      presentation_asset: null,
      ranks: detail.ranks.map((rank) => ({
        ...rank,
        prizes: rank.prizes.map((prize) => ({ ...prize, presentation_asset: null })),
      })),
    } satisfies GachaDetail;
    renderDetail(publicClient({ getGachaBySlug: vi.fn().mockResolvedValue(response({ data: missingAssets })) }));
    expect(await screen.findByText("PACK IMAGE")).toBeInTheDocument();
    expect(screen.getByText("PRIZE IMAGE")).toBeInTheDocument();
  });

  it("opens and closes the accessible prize modal with pointer and Escape", async () => {
    renderDetail();
    const trigger = await screen.findByRole("button", { name: `${detail.ranks[0]!.prizes[0]!.name}の詳細を見る` });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: detail.ranks[0]!.prizes[0]!.name })).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "景品詳細を閉じる" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("renders only Backend-returned draw counts and opens the execution confirmation", async () => {
    renderDetail();
    const one = await screen.findByRole("button", { name: "1回" });
    expect(screen.getByRole("button", { name: "5回" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "10回" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "100回" })).not.toBeInTheDocument();
    fireEvent.click(one);
    expect(one).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "1回抽選する" }));
    expect(screen.getByRole("dialog", { name: "抽選内容を確認" })).toBeInTheDocument();
  });

  it("uses the canonical login CTA for an anonymous presentation", async () => {
    const anonymous: GachaPresentationState = {
      ...presentation,
      allowed_draw_counts: [],
      cta: { action: "login", reason: "authentication_required", state: "enabled" },
      eligible: false,
      ineligible_reason: "authentication_required",
      user_state: "unauthenticated",
    };
    renderDetail(publicClient({ getGachaPresentation: presentationResponse(anonymous) }));
    expect(await screen.findByRole("link", { name: "ログインして抽選する" })).toHaveAttribute("href", "/login");
    expect(screen.getByText("抽選するにはログインが必要です。")).toBeInTheDocument();
  });

  it.each([
    ["coming_soon", "sale_not_started", "販売開始前"],
    ["on_sale", "audience_not_eligible", "販売中"],
    ["sold_out", "sold_out", "完売"],
    ["ended", "sale_ended", "販売終了"],
  ] as const)("renders the %s Backend sale state without local derivation", async (saleState, reason, label) => {
    const next: GachaPresentationState = {
      ...presentation,
      allowed_draw_counts: [],
      cta: { action: null, reason, state: "hidden" },
      eligible: false,
      ineligible_reason: reason,
      sale_state: saleState,
    };
    renderDetail(publicClient({ getGachaPresentation: presentationResponse(next) }));
    expect((await screen.findAllByText(label)).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("抽選オプション")).not.toBeInTheDocument();
  });

  it("renders authenticated ineligibility and the returned daily count values", async () => {
    const limited: GachaPresentationState = {
      ...presentation,
      allowed_draw_counts: [],
      cta: { action: null, reason: "daily_limit_reached", state: "disabled" },
      daily_limit: { ...presentation.daily_limit, limit: 10, remaining: 0, unlimited: false, used: 10 },
      eligible: false,
      ineligible_reason: "daily_limit_reached",
    };
    renderDetail(publicClient({ getGachaPresentation: presentationResponse(limited) }));
    expect(await screen.findByText("本日の抽選上限に達しています。")).toBeInTheDocument();
    expect(screen.getAllByText("10回", { selector: "dd" })).toHaveLength(2);
    expect(screen.getByText("0回", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByLabelText("抽選オプション")).toHaveAttribute("data-cta-state", "disabled");
  });

  it("renders the explicit unlimited daily state", async () => {
    const unlimited: GachaPresentationState = {
      ...presentation,
      daily_limit: { ...presentation.daily_limit, limit: 0, remaining: null, unlimited: true, used: null },
    };
    renderDetail(publicClient({ getGachaPresentation: presentationResponse(unlimited) }));
    expect(await screen.findByText("制限なし")).toBeInTheDocument();
    expect(screen.getByText("このガチャの抽選対象です。")).toBeInTheDocument();
  });
});
