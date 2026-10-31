import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_CATALOG_FIXTURE, PUBLIC_DRAW_FIXTURE, PUBLIC_GACHA_PRESENTATION_FIXTURE } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";
import { DrawResultView } from "@/components/draw/draw-result";
import type { AuthClientAdapter, DrawClientAdapter, DrawResponse, GachaPresentationState, PublicCatalogAdapter } from "@/lib/platform";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/draws/x/result" }));
vi.mock("@/components/points/point-client-provider", () => ({ usePointClient: () => ({ refreshWallet: vi.fn() }) }));

const metadata = { idempotency_replayed: false, status: 200 } as const;
const result = { ...PUBLIC_DRAW_FIXTURE, presentation: null, high_rank_results: [] } as DrawResponse;
delete result.results;
const gacha = PUBLIC_CATALOG_FIXTURE.data;
const presentation = PUBLIC_GACHA_PRESENTATION_FIXTURE.data as GachaPresentationState;
const response = <T,>(data: T) => ({ data, metadata });
afterEach(() => { cleanup(); push.mockReset(); });

function renderWith(catalog: Partial<PublicCatalogAdapter>, createDraw = vi.fn()) {
  const auth = { getCurrentSession: vi.fn().mockResolvedValue(response(PUBLIC_AUTH_FIXTURE.authenticated_session)) } as unknown as AuthClientAdapter;
  const draws = { createDraw, getDrawRequest: vi.fn().mockResolvedValue(response(result)), listDrawHistory: vi.fn() } as unknown as DrawClientAdapter;
  render(
    <PublicClientProvider client={catalog as PublicCatalogAdapter}>
      <SessionProvider client={auth}>
        <DrawClientProvider client={draws}><DrawResultView drawRequestId={result.id} /></DrawClientProvider>
      </SessionProvider>
    </PublicClientProvider>,
  );
}

function catalog(remaining: number, saleState: GachaPresentationState["sale_state"]) {
  return {
    getGacha: vi.fn().mockResolvedValue(response({ data: { ...gacha, remaining_count: remaining } })),
    getGachaPresentation: vi.fn().mockResolvedValue(response({ data: { ...presentation, sale_state: saleState } })),
  } as unknown as Partial<PublicCatalogAdapter>;
}

describe("抽選結果の「もう一回挑戦しますか？」", () => {
  it("販売中なら、詳細画面へ移動せずにバナーと抽選ボタンをこの画面に出す", async () => {
    const client = catalog(10, "on_sale");
    renderWith(client);
    const block = await screen.findByRole("region", { name: "もう一回挑戦しますか？" });
    expect(client.getGacha).toHaveBeenCalledWith(result.gacha_id);
    expect(within(block).getByRole("complementary", { name: "抽選オプション" })).toHaveClass("gacha-draw-tray--inline");
    for (const count of presentation.allowed_draw_counts) {
      expect(within(block).getByRole("button", { name: `${count.toLocaleString()}回` })).toBeInTheDocument();
    }
    expect(within(block).queryByRole("region", { name: "抽選状態" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /もう一度このオリパを引く/ })).not.toBeInTheDocument();
  });

  it("確認して引くと、同じオリパで新しい抽選を行い次の結果へ進む", async () => {
    const createDraw = vi.fn().mockResolvedValue(response({ ...result, id: "next-draw" }));
    renderWith(catalog(10, "on_sale"), createDraw);
    const block = await screen.findByRole("region", { name: "もう一回挑戦しますか？" });
    const count = presentation.allowed_draw_counts[0]!;
    fireEvent.click(within(block).getByRole("button", { name: `${count.toLocaleString()}回抽選する` }));
    fireEvent.click(await screen.findByRole("button", { name: "抽選を実行する" }));
    await waitFor(() => expect(createDraw).toHaveBeenCalledWith(gacha.id, count, expect.objectContaining({ idempotency_key: expect.any(String) })));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/draws/next-draw/result"));
  });

  it("完売なら抽選ボタンは出さず、完売とほかのオリパへの導線を出す", async () => {
    renderWith(catalog(0, "on_sale"));
    expect(await screen.findByText(`「${gacha.title}」は完売しました。`)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "もう一回挑戦しますか？" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ほかのオリパを探す" })).toHaveAttribute("href", "/gachas");
  });

  it("販売停止中や公開カタログにない（ログインガチャ等）ときはガチャ一覧への導線にする", async () => {
    renderWith(catalog(10, "paused"));
    expect(await screen.findByRole("link", { name: "ほかのオリパを探す" })).toBeInTheDocument();
    cleanup();
    renderWith({ getGacha: vi.fn().mockRejectedValue(new Error("404")), getGachaPresentation: vi.fn().mockRejectedValue(new Error("404")) });
    expect(await screen.findByRole("link", { name: "ほかのオリパを探す" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "もう一回挑戦しますか？" })).not.toBeInTheDocument();
  });
});
