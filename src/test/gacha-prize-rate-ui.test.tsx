import { fireEvent, render, screen, within } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  PUBLIC_CATALOG_FIXTURE,
  PUBLIC_CONTENT_FIXTURE,
  PUBLIC_GACHA_PRESENTATION_FIXTURE,
} from "@oripa/storefront-testkit";
import { describe, expect, it, vi } from "vitest";
import { GachaDetailView } from "@/components/catalog/gacha-detail";
import { GachaPrizeRateView } from "@/components/catalog/gacha-prize-rate";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";
import type { DrawClientAdapter, GachaDetail, GachaPresentationState, PublicCatalogAdapter } from "@/lib/platform";
import { formatPpmAsPercent } from "@/lib/presentation/prize-rate";
import { gachaDetailRoute, gachaPrizeRateRoute, publicRoutes } from "@/lib/routes/navigation";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/points/point-client-provider", () => ({ usePointClient: () => ({ refreshWallet: vi.fn() }) }));

const metadata = { idempotency_replayed: false, status: 200 } as const;
const fixture = PUBLIC_CATALOG_FIXTURE.data as GachaDetail;
const presentation = PUBLIC_GACHA_PRESENTATION_FIXTURE.data as GachaPresentationState;
const [rankS, rankA] = fixture.ranks as [GachaDetail["ranks"][number], GachaDetail["ranks"][number]];
const stageTemplate = fixture.probability_stages[0]!;

function response<T>(data: T) {
  return { data, metadata };
}

/** 総口数 60,000、S賞 2口・A賞 47口は総数を公開、B賞は総数を非公開、という構成。 */
const detail: GachaDetail = {
  ...fixture,
  prizes: [
    { ...fixture.prizes![0]!, id: "s-1", name: "ピカチュウ PSA10", rank_id: rankS.rank_id, total_inventory: 1 },
    { ...fixture.prizes![0]!, id: "s-2", name: "リザードン PSA10", rank_id: rankS.rank_id, total_inventory: 1 },
    { ...fixture.prizes![0]!, id: "a-1", name: "ミュウ SAR", rank_id: rankA.rank_id, total_inventory: 47 },
    { ...fixture.prizes![0]!, id: "b-1", name: "ノーマルカード", rank_id: "0198a001-0000-7000-8000-0000000000b1", total_inventory: 59_951 },
  ],
  probability_stages: [{
    ...stageTemplate,
    is_current: true,
    minimum_guarantee: { point_amount: 0, result_type: "point_back", total_ppm: 0 },
    point_back_total_ppm: 0,
    rank_probabilities: [
      { rank: { id: rankS.rank_id, name: "S賞" }, total_ppm: 33 },
      { rank: { id: rankA.rank_id, name: "A賞" }, total_ppm: 783 },
      { rank: { id: "0198a001-0000-7000-8000-0000000000b1", name: "B賞" }, total_ppm: 999_184 },
    ],
  }],
  ranks: [
    { ...rankS, rank_name: "S賞", show_total_stock: true, total_stock: 2 },
    { ...rankA, rank_name: "A賞", show_total_stock: true, total_stock: 47 },
    { ...rankA, display_order: 30, rank_id: "0198a001-0000-7000-8000-0000000000b1", rank_name: "B賞", show_total_stock: false, total_stock: null },
  ],
  slug: "pikachu-chance",
  title: "ピカチュウプロモCHANCE",
  total_count: 60_000,
};

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

function renderPrizeRate(client: PublicCatalogAdapter | null = publicClient()) {
  return render(
    <PublicClientProvider client={client}>
      <GachaPrizeRateView slug={detail.slug} />
    </PublicClientProvider>,
  );
}

function rowTexts() {
  return Array.from(document.querySelectorAll(".prize-rate__rows > .prize-rate__row"))
    .map((row) => Array.from(row.querySelectorAll(".prize-rate__cells > span")).map((cell) => cell.textContent));
}

describe("提供割合：表記と遷移先", () => {
  it("ppm を小数第4位までの % にする（計算ではなく単位の書き換え）", () => {
    expect(formatPpmAsPercent(33)).toBe("0.0033%");
    expect(formatPpmAsPercent(783)).toBe("0.0783%");
    expect(formatPpmAsPercent(203_266)).toBe("20.3266%");
    expect(formatPpmAsPercent(1_000_000)).toBe("100.0000%");
    expect(formatPpmAsPercent(0)).toBe("0.0000%");
  });

  it("slug を1つのパス区間として扱い、提供割合ページを画面一覧に持つ", () => {
    expect(gachaDetailRoute("pikachu-chance")).toBe("/gachas/pikachu-chance");
    expect(gachaPrizeRateRoute("a/b?c")).toBe("/gachas/a%2Fb%3Fc/prize-rate");
    expect(publicRoutes).toContain("/gachas/[slug]/prize-rate");
  });
});

describe("ガチャ詳細：提供割合へのリンク", () => {
  it("景品ラインナップの上に「提供割合を見る」を出す", async () => {
    const drawClient = { createDraw: vi.fn(), getDrawRequest: vi.fn(), listDrawHistory: vi.fn() } as DrawClientAdapter;
    render(
      <PublicClientProvider client={publicClient()}>
        <DrawClientProvider client={drawClient}><GachaDetailView slug={detail.slug} /></DrawClientProvider>
      </PublicClientProvider>,
    );

    const link = await screen.findByRole("link", { name: "提供割合を見る" });
    expect(link).toHaveAttribute("href", "/gachas/pikachu-chance/prize-rate");
    const lineup = screen.getByRole("region", { name: "景品ラインナップ" });
    expect(link.compareDocumentPosition(lineup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("提供割合ページ", () => {
  it("総口数と、Platform が返した賞ごとの提供割合をそのまま出す", async () => {
    const client = publicClient();
    renderPrizeRate(client);

    expect(await screen.findByRole("heading", { level: 2, name: "ピカチュウプロモCHANCE" })).toBeInTheDocument();
    expect(document.querySelector(".prize-rate__total")).toHaveTextContent("総口数60,000口");
    expect(document.querySelector(".prize-rate__head")).toHaveTextContent("賞封入数（口）提供割合");
    expect(rowTexts()).toEqual([
      ["S賞", "封入数2口", "提供割合0.0033%"],
      ["A賞", "封入数47口", "提供割合0.0783%"],
      ["B賞", "封入数—", "提供割合99.9184%"],
    ]);
    expect(screen.getByRole("link", { name: "ガチャ詳細へ戻る" })).toHaveAttribute("href", "/gachas/pikachu-chance");
    expect(client.getGachaBySlug).toHaveBeenCalledWith("pikachu-chance");
    expect(client.getGachaPresentation).not.toHaveBeenCalled();
  });

  it("総数を公開している賞だけ、景品ごとの封入数を開いて見られる", async () => {
    renderPrizeRate();

    const breakdown = await screen.findByRole("list", { name: "S賞の内訳" });
    expect(within(breakdown).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["ピカチュウ PSA101口", "リザードン PSA101口"]);
    expect(screen.getByRole("list", { name: "A賞の内訳" })).toHaveTextContent("ミュウ SAR47口");
    expect(screen.queryByRole("list", { name: "B賞の内訳" })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("ノーマルカード");
    expect(document.body).not.toHaveTextContent("59,951");

    const details = breakdown.closest("details")!;
    expect(details.open).toBe(false);
    fireEvent.click(details.querySelector("summary")!);
    expect(details.open).toBe(true);
  });

  it("注意書きを出す", async () => {
    renderPrizeRate();

    const notes = (await screen.findByText(/販売開始時点の封入数から算出した割合です/)).closest("ul")!;
    expect(within(notes).getAllByRole("listitem")).toHaveLength(3);
    expect(notes).toHaveTextContent("特定の賞の当選を保証するものではありません");
  });

  it("現在の段階（is_current）の割合を使い、最低保証とコイン還元があれば行に出す", async () => {
    const stages: GachaDetail["probability_stages"] = [
      { ...detail.probability_stages[0]!, id: "0198a001-0000-7000-8000-0000000000e1", is_current: false, rank_probabilities: [{ rank: { id: rankS.rank_id, name: "S賞" }, total_ppm: 1_000_000 }] },
      {
        ...detail.probability_stages[0]!,
        id: "0198a001-0000-7000-8000-0000000000e2",
        is_current: true,
        minimum_guarantee: { rank: { id: rankA.rank_id, name: "A賞" }, result_type: "prize", total_ppm: 800_000 },
        point_back_total_ppm: 100_000,
        rank_probabilities: [{ rank: { id: rankS.rank_id, name: "S賞" }, total_ppm: 100_000 }],
      },
    ];
    renderPrizeRate(publicClient({ getGachaBySlug: vi.fn().mockResolvedValue(response({ data: { ...detail, probability_stages: stages } })) }));

    await screen.findByRole("heading", { level: 2, name: "ピカチュウプロモCHANCE" });
    expect(rowTexts()).toEqual([
      ["S賞", "封入数2口", "提供割合10.0000%"],
      ["A賞（最低保証）", "封入数—", "提供割合80.0000%"],
      ["コイン還元", "封入数—", "提供割合10.0000%"],
    ]);
  });

  it("見つからない・取得できない・未設定のときは、それぞれの案内を出す", async () => {
    const notFound = new ApiProblemError({
      code: "CATALOG_NOT_FOUND",
      request_id: "request-prize-rate-not-found",
      retryable: false,
      status: 404,
      title: "Catalog not found",
      type: "https://storefront.test/problems/catalog-not-found",
    });
    const { unmount } = renderPrizeRate(publicClient({ getGachaBySlug: vi.fn().mockRejectedValue(notFound) }));
    expect(await screen.findByRole("heading", { name: "ガチャが見つかりません" })).toBeInTheDocument();
    unmount();

    const retry = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue(response({ data: detail }));
    const second = renderPrizeRate(publicClient({ getGachaBySlug: retry }));
    expect(await screen.findByRole("heading", { name: "提供割合を取得できませんでした" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(await screen.findByRole("heading", { level: 2, name: "ピカチュウプロモCHANCE" })).toBeInTheDocument();
    second.unmount();

    renderPrizeRate(null);
    expect(screen.getByRole("heading", { name: "提供割合を表示できません" })).toBeInTheDocument();
  });
});
