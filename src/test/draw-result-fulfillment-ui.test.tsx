import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_DRAW_FIXTURE, PUBLIC_USER_PRIZE_FIXTURE } from "@oripa/storefront-testkit";
import { readFileSync } from "node:fs";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";
import { DrawResultView } from "@/components/draw/draw-result";
import { DRAW_FULFILLMENT_MAX_SELECTION, DRAW_FULFILLMENT_PAGE_SIZE, groupPrizes } from "@/components/draw/draw-result-fulfillment";
import { PrizeClientProvider } from "@/components/prizes/prize-client-provider";
import type { AuthClientAdapter, DrawClientAdapter, DrawResponse, PrizeFulfillmentAdapter, UserPrize } from "@/lib/platform";
import { policy, policyAccess } from "./fixtures/shipping-policy";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/draws/x/result" }));
vi.mock("@/components/points/point-client-provider", () => ({ usePointClient: () => ({ refreshWallet: vi.fn() }) }));

const metadata = { idempotency_replayed: false, status: 200 } as const;
// The 100-row accessible tree can exceed the default one-second async wait.
beforeEach(() => configure({ asyncUtilTimeout: 5000 }));
afterEach(() => configure({ asyncUtilTimeout: 1000 }));
const response = <T,>(data: T) => ({ data, metadata });
const base = PUBLIC_USER_PRIZE_FIXTURE as UserPrize;
const drawBase = { ...PUBLIC_DRAW_FIXTURE, presentation: null, high_rank_results: [] } as DrawResponse;
const template = drawBase.results?.[0] ?? drawBase.high_rank_results[0];

function drawWith(count: number): DrawResponse {
  const results = Array.from({ length: count }, (_, index) => ({ ...template!, id: `result-${index}`, result_type: "prize" as const, sequence_number: index + 1 }));
  return { ...drawBase, executed_count: count, requested_count: count === 1 ? 1 : count <= 10 ? 10 : 1000, created_at: "2026-10-31T02:00:00Z", results };
}

function prize(index: number, points: number, overrides: Partial<UserPrize> = {}): UserPrize {
  return {
    ...base,
    acquired_at: "2026-10-31T02:00:00Z",
    draw_result_id: `result-${index}`,
    exchange_points: points,
    id: `prize-${index}`,
    presentation: { ...base.presentation!, name: `景品${index}`, prize_id: `prize-master-${index}` },
    status: "stored",
    allowed_actions: {
      point_exchange: { allowed: true, unavailable_reason: null },
      selection: { allowed: true, unavailable_reason: null },
      shipping: { allowed: true, unavailable_reason: null },
    },
    ...overrides,
  };
}

function prizeClient(overrides: Partial<PrizeFulfillmentAdapter>): PrizeFulfillmentAdapter {
  return {
    shippingPolicyAccess: policyAccess(policy("1500")),
    getShippingPolicy: vi.fn(),
    createShippingAddress: vi.fn(),
    createShippingRequest: vi.fn(),
    deleteShippingAddress: vi.fn(),
    exchangePrizes: vi.fn(),
    getPrize: vi.fn(),
    getShippingAddress: vi.fn(),
    getShippingRequest: vi.fn(),
    listPrizes: vi.fn(),
    listShippingAddresses: vi.fn().mockResolvedValue(response({ items: [] })),
    listShippingRequests: vi.fn().mockResolvedValue(response({ items: [], next_cursor: null })),
    updateShippingAddress: vi.fn(),
    ...overrides,
  } as PrizeFulfillmentAdapter;
}

function renderResult(result: DrawResponse, prizes: PrizeFulfillmentAdapter | null) {
  const auth = {
    getCurrentSession: vi.fn().mockResolvedValue(response(PUBLIC_AUTH_FIXTURE.authenticated_session)),
    getSmsVerificationStatus: vi.fn().mockResolvedValue(response({ challenge: null, phone: null, phone_masked: "x", verified: true, verified_at: "2026-10-01T00:00:00Z" })),
  } as unknown as AuthClientAdapter;
  const draws = { createDraw: vi.fn(), getDrawRequest: vi.fn().mockResolvedValue(response(result)), listDrawHistory: vi.fn() } as unknown as DrawClientAdapter;
  const view = <DrawClientProvider client={draws}><DrawResultView drawRequestId={result.id} /></DrawClientProvider>;
  render(<SessionProvider client={auth}>{prizes === null ? view : <PrizeClientProvider client={prizes}>{view}</PrizeClientProvider>}</SessionProvider>);
}

afterEach(() => cleanup());

async function fulfillmentRegion() {
  // Poll the readiness marker cheaply before walking 100 rows for accessible roles.
  await waitFor(() => expect(document.querySelector(".draw-fulfillment__head")).not.toBeNull());
  return screen.getByRole("region", { name: "今回の獲得景品" });
}

describe("抽選結果で、今回の獲得景品をそのまま交換・発送する", () => {
  it.each([1, 10, 100, 1000])("%i回の横帯はSnapshotのランクタグと共通サムネイルを表示する", async (count) => {
    const result = drawWith(count);
    result.results = result.results!.map((item, index) => ({ ...item,
      rank: index === 0 ? null : { id: "historical-rank", name: `当時の等級${index}` },
    }));
    renderResult(result, prizeClient({ listPrizes: vi.fn().mockResolvedValue(response({ items: [], next_cursor: null })) }));
    await screen.findByRole("heading", { name: "抽選結果一覧" });
    const cards = document.querySelectorAll(".draw-result__snapshots--strip .draw-snapshot-card");
    expect(cards).toHaveLength(Math.min(count, 100));
    cards.forEach((card, index) => {
      expect(card.querySelector(".draw-snapshot-card__thumbnail.prize-row__image")).not.toBeNull();
      expect(card.querySelector(".rank-lineup-image")).toBeNull();
      if (index === 0) expect(card.querySelector(".prize-tier")).toBeNull();
      else expect(card.querySelector(".prize-tier")).toHaveTextContent(`当時の等級${index}`);
      expect(card).toHaveTextContent(`抽選順 ${index + 1}`);
    });
  });

  it("権限や保管期限が違う景品を同じ行にまとめない", () => {
    const a = prize(0, 10);
    const b = { ...a, id: "different-deadline", storage_expires_at: "2026-11-06T00:00:00Z" };
    const c = { ...a, id: "shipping-only-action", allowed_actions: { ...a.allowed_actions!, point_exchange: { allowed: false, unavailable_reason: "shipping_only" as const } } };
    expect(groupPrizes([a, b, c])).toHaveLength(3);
  });

  it("1000回の結果でも横帯は先頭100件、まとめた実景品101件の行は選択しない", async () => {
    const items = Array.from({ length: 101 }, (_, i) => prize(i, 10, { presentation: { ...base.presentation!, name: "まとめ景品", prize_id: "same" } }));
    renderResult(drawWith(1000), prizeClient({ listPrizes: vi.fn().mockResolvedValue(response({ items, next_cursor: null })) }));
    const list = await fulfillmentRegion();
    expect(within(list).getByRole("checkbox", { name: "まとめ景品を選択" })).toBeDisabled();
    expect(document.querySelectorAll(".draw-snapshot-card")).toHaveLength(100);
    fireEvent.click(screen.getByRole("button", { name: "全て選択" }));
    expect(screen.getByRole("complementary", { name: "選択した景品の操作" })).toHaveTextContent("0 点を選択中");
  });

  it("ページが重複しても実景品IDを二重計上しない", async () => {
    const a = prize(0, 10), b = prize(1, 20);
    const client = prizeClient({ listPrizes: vi.fn().mockResolvedValueOnce(response({ items: [a], next_cursor: "next" })).mockResolvedValueOnce(response({ items: [a, b], next_cursor: null })) });
    renderResult(drawWith(2), client);
    const list = await fulfillmentRegion();
    expect(within(list).getAllByRole("checkbox")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "全て選択" }));
    expect(screen.getByRole("complementary", { name: "選択した景品の操作" })).toHaveTextContent("コイン交換すると 30 コイン");
  });

  it("認証エラー時は交換操作を表示せず再読込を案内する", async () => {
    renderResult(drawWith(1), prizeClient({ listPrizes: vi.fn().mockRejectedValue(new Error("unauthorized")) }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "コインに交換する" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "もう一度読み込む" })).toBeInTheDocument();
  });
  it("今回の抽選の景品だけを、コインが高い順・未選択で並べ、全て選択で合計と発送の基準を出す", async () => {
    const other = prize(99, 9999, { draw_result_id: "other-draw", id: "other" });
    const client = prizeClient({ listPrizes: vi.fn().mockResolvedValue(response({ items: [prize(0, 2), other, prize(1, 50)], next_cursor: null })) });
    renderResult(drawWith(2), client);
    const list = await fulfillmentRegion();
    const names = within(list).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(names).toEqual(["景品1", "景品0"]);
    expect(within(list).getByRole("checkbox", { name: "景品1を選択" })).not.toBeChecked();
    expect(within(list).queryByText("景品99")).not.toBeInTheDocument();
    const bar = screen.getByRole("complementary", { name: "選択した景品の操作" });
    expect(bar).toHaveTextContent("0 点を選択中");
    expect(within(bar).getByRole("button", { name: "コインに交換する" })).toBeDisabled();
    expect(await within(bar).findByText("発送依頼には合計1,500コイン以上の商品選択が必要です")).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole("button", { name: "全て選択" }));
    expect(bar).toHaveTextContent("コイン交換すると 52 コイン");
    fireEvent.click(within(list).getByRole("checkbox", { name: "景品1を選択" }));
    expect(bar).toHaveTextContent("コイン交換すると 2 コイン");
    fireEvent.click(within(list).getByRole("button", { name: /コインが高い順/ }));
    expect(within(list).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["景品0", "景品1"]);
    expect(bar).toHaveTextContent("0 点を選択中");
  });

  it("交換した景品は一覧から消え、このあとの欄に「ガチャに戻る」と次の操作を出す", async () => {
    const converted = (item: UserPrize): UserPrize => ({ ...item, status: "converted", allowed_actions: { point_exchange: { allowed: false, unavailable_reason: "status_not_actionable" }, selection: { allowed: false, unavailable_reason: "status_not_actionable" }, shipping: { allowed: false, unavailable_reason: "status_not_actionable" } } });
    const a = prize(0, 100);
    const b = prize(1, 200);
    const client = prizeClient({
      exchangePrizes: vi.fn().mockResolvedValue(response({ id: "x", status: "completed", exchanged_count: 1, exchange_point_total: 200, wallet_free_points_after: 200, idempotent_replay: false })),
      listPrizes: vi.fn()
        .mockResolvedValueOnce(response({ items: [a, b], next_cursor: null }))
        .mockResolvedValueOnce(response({ items: [a, converted(b)], next_cursor: null })),
    });
    renderResult(drawWith(2), client);
    const list = await fulfillmentRegion();
    expect(within(list).getByRole("link", { name: "ガチャに戻る" })).toHaveAttribute("href", "/gachas");
    const next = screen.getByRole("region", { name: "このあと" });
    expect(within(next).getByRole("link", { name: "獲得アイテムを見る" })).toHaveAttribute("href", "/mypage/prizes");
    expect(within(next).getByRole("link", { name: "トップに戻る" })).toHaveAttribute("href", "/");

    fireEvent.click(within(list).getByRole("checkbox", { name: "景品1を選択" }));
    fireEvent.click(screen.getByRole("button", { name: "コインに交換する" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "コインに交換する" }));
    await waitFor(() => expect(client.exchangePrizes).toHaveBeenCalledWith(["prize-1"], { idempotency_key: expect.any(String) }));
    await waitFor(() => expect(within(list).queryByText("景品1")).not.toBeInTheDocument());
    expect(within(list).getByText("景品0")).toBeInTheDocument();
  });

  it("同じ景品は1行にまとめ、まとめて選ぶ", async () => {
    const same = (index: number) => prize(index, 10, { presentation: { ...base.presentation!, name: "10コイン", prize_id: "same-master" } });
    const client = prizeClient({ listPrizes: vi.fn().mockResolvedValue(response({ items: [same(0), same(1), same(2), prize(3, 300)], next_cursor: null })) });
    renderResult(drawWith(4), client);
    const list = await fulfillmentRegion();
    expect(within(list).getAllByRole("checkbox")).toHaveLength(2);
    expect(within(list).getByRole("heading", { name: "10コイン× 3" })).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("checkbox", { name: "10コインを選択" }));
    const bar = screen.getByRole("complementary", { name: "選択した景品の操作" });
    expect(bar).toHaveTextContent("3 点を選択中");
    expect(bar).toHaveTextContent("コイン交換すると 30 コイン");
  });

  it("大量の結果は全件を読んでから並べ替え、100件ずつ表示する（表示していない景品は選べない）", async () => {
    const total = DRAW_FULFILLMENT_PAGE_SIZE + 5;
    const all = Array.from({ length: total }, (_, index) => prize(index, index === total - 1 ? 99999 : 10));
    const client = prizeClient({
      listPrizes: vi.fn()
        .mockResolvedValueOnce(response({ items: all.slice(0, 60), next_cursor: "c1" }))
        .mockResolvedValueOnce(response({ items: all.slice(60), next_cursor: null })),
    });
    renderResult(drawWith(total), client);
    const list = await fulfillmentRegion();
    expect(client.listPrizes).toHaveBeenCalledTimes(2);
    expect(client.listPrizes).toHaveBeenLastCalledWith("c1");
    expect(within(list).getAllByRole("checkbox")).toHaveLength(DRAW_FULFILLMENT_PAGE_SIZE);
    // 2回目の読み込みにあった一番高い景品が、先頭に来る
    expect(within(list).getAllByRole("heading", { level: 3 })[0]).toHaveTextContent(`景品${total - 1}`);
    const bar = screen.getByRole("complementary", { name: "選択した景品の操作" });
    expect(bar).toHaveTextContent("選択できるのは表示中の景品だけです。");
    fireEvent.click(screen.getByRole("button", { name: "さらに表示（残り5件）" }));
    expect(within(list).getAllByRole("checkbox")).toHaveLength(total);
    expect(screen.queryByRole("button", { name: /さらに表示/ })).not.toBeInTheDocument();
  });

  it("交換・発送は1回100件までなので、選択も100件までにする", async () => {
    const total = DRAW_FULFILLMENT_MAX_SELECTION + 10;
    const all = Array.from({ length: total }, (_, index) => prize(index, 10));
    const client = prizeClient({ listPrizes: vi.fn().mockResolvedValue(response({ items: all, next_cursor: null })) });
    renderResult(drawWith(total), client);
    const list = await fulfillmentRegion();
    fireEvent.click(screen.getByRole("button", { name: /さらに表示/ }));
    fireEvent.click(screen.getByRole("button", { name: "全て選択" }));
    const checked = within(list).getAllByRole("checkbox").filter((box) => (box as HTMLInputElement).checked);
    expect(checked).toHaveLength(DRAW_FULFILLMENT_MAX_SELECTION);
    const bar = screen.getByRole("complementary", { name: "選択した景品の操作" });
    expect(bar).toHaveTextContent("一度に手続きできるのは100件までです");
    expect(within(list).getAllByRole("checkbox").find((box) => !(box as HTMLInputElement).checked)).toBeDisabled();
  });

  it("獲得アイテムの画面（/mypage/prizes）と部品は変えない", () => {
    expect(readFileSync("src/app/mypage/prizes/page.tsx", "utf8")).not.toContain("draw-result-fulfillment");
    expect(readFileSync("src/components/prizes/prize-inventory.tsx", "utf8")).not.toContain("draw-result-fulfillment");
  });

  it("PrizeClientProvider が無いときは、今までの獲得景品の一覧を出す", async () => {
    renderResult(drawWith(1), null);
    expect(await screen.findByRole("heading", { name: "獲得景品" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "今回の獲得景品" })).not.toBeInTheDocument();
  });
});
