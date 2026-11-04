import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { vi } from "vitest";
import MyMemberRankPage from "@/app/mypage/member-rank/page";
import { isConsistentBreakdown, MemberRankBreakdownSection } from "@/components/member-rank/member-rank-breakdown";
import { MemberRankBand } from "@/components/member-rank/member-rank-band";
import type { MemberRankBreakdown } from "@/lib/platform/member-rank-client";
import { useSession } from "@/components/auth/session-provider";
import { SessionProvider } from "@/components/auth/session-provider";
import type { AuthClientAdapter, AuthSession } from "@/lib/platform";

const { listMemberRanks, loadMyMemberRank } = vi.hoisted(() => ({ listMemberRanks: vi.fn(), loadMyMemberRank: vi.fn() }));
vi.mock("@/lib/platform/member-rank-client", async (original) => ({ ...await original<object>(), listMemberRanks, loadMyMemberRank }));
vi.mock("next/navigation", () => ({ usePathname: () => "/mypage/member-rank", useRouter: () => ({ push: vi.fn() }) }));

type Code = "beginner" | "bronze" | "silver" | "gold" | "platinum" | "diamond" | "vip";

/** 管理画面の会員ランク設定（テスト用の値。画面はこの一覧から数字を出す）。 */
const ranks = ([
  ["beginner", "ビギナー", null, 0, "0.00"],
  ["bronze", "ブロンズ", 11000, 600, "0.50"],
  ["silver", "シルバー", 31000, 2100, "1.00"],
  ["gold", "ゴールド", 101000, 5100, "1.50"],
  ["platinum", "プラチナ", 301000, 20100, "2.00"],
  ["diamond", "ダイヤモンド", 701000, 50100, "3.00"],
  ["vip", "VIP", 1501000, 100100, "4.25"],
] as const).map(([code, name, reach, bonus, rate], index) => ({
  code, level: index + 1, maintain_line: null, name,
  promotion_bonus: { point_type: "free", points: bonus },
  purchase_bonus: { point_type: "free", rate_percent: rate },
  reach_line: reach,
}));

function rankOf(code: Code) {
  const found = ranks.find((rank) => rank.code === code)!;
  return { code: found.code, level: found.level, name: found.name };
}

function enabled(code: Code, points: number, extra: Record<string, unknown> = {}) {
  const index = ranks.findIndex((rank) => rank.code === code);
  const next = ranks[index + 1];
  return {
    as_of: "2026-11-01T08:00:00Z",
    benefits: { purchase_bonus: { point_type: "free", rate_percent: ranks[index]!.purchase_bonus.rate_percent } },
    demotion_protection: null,
    enabled: true,
    maintain: null,
    next_rank: next ? { code: next.code, name: next.name, reach_line: next.reach_line, remaining: Math.max(0, next.reach_line! - points) } : null,
    period: null,
    point_basis: "cumulative",
    breakdown: { recent: [], total: points },
    promotion_bonus: { received: false },
    transferred: false,
    rank: rankOf(code),
    rank_points: points,
    ...extra,
  };
}

const disabled = { as_of: null, benefits: null, demotion_protection: null, enabled: false, maintain: null, next_rank: null, period: null, rank: null, rank_points: null };

const authenticated: AuthSession = { authenticated: true, user: { email_verified: true, id: "0198a001-0000-7000-8000-000000000701", state: "active" } };
const metadata = { idempotency_replayed: false, status: 200 } as const;

function client(session: AuthSession = authenticated): AuthClientAdapter {
  return {
    completeEmailVerification: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue({ data: session, metadata }),
    getSmsVerificationStatus: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    resendEmailVerification: vi.fn(),
  } as unknown as AuthClientAdapter;
}

function renderRankPage(session: AuthSession = authenticated) {
  return render(<SessionProvider client={client(session)}><MyMemberRankPage /></SessionProvider>);
}

async function currentCard() {
  const heading = await screen.findByRole("heading", { level: 2, name: /^(ビギナー|ブロンズ|シルバー|ゴールド|プラチナ|ダイヤモンド|VIP)$/ });
  return heading.closest("section")!;
}

beforeEach(() => {
  listMemberRanks.mockReset();
  loadMyMemberRank.mockReset();
  listMemberRanks.mockResolvedValue(ranks);
});

describe("会員本人のランク", () => {
  it("ビギナーの到達ラインとハイフンを描画せず、他ランクの到達ラインを保持する", async () => {
    loadMyMemberRank.mockResolvedValue(enabled("beginner", 0));
    renderRankPage();
    await currentCard();
    const steps = within(screen.getByRole("list", { name: "会員ランクの段" })).getAllByRole("listitem");
    expect(steps).toHaveLength(7);
    expect(steps[0]).toHaveTextContent("ビギナー");
    expect(steps[0]).toHaveTextContent("いまここ");
    expect(steps[0]).toHaveClass("mrank-t0", "is-current");
    expect(steps[0]).not.toHaveTextContent("—");
    expect(steps[0]!.querySelector(".mrank-ladder__line")).toBeNull();
    for (const [index, rank] of ranks.entries()) {
      if (rank.reach_line !== null) {
        expect(steps[index]!.querySelector(".mrank-ladder__line")).toHaveTextContent(`${new Intl.NumberFormat("ja-JP").format(rank.reach_line)} 〜`);
      }
    }
  });

  it("累計ポイント・次ランク・特典を表示し、月次項目を表示しない", async () => {
    loadMyMemberRank.mockResolvedValue(enabled("silver", 42000));
    renderRankPage();
    const card = await currentCard();
    expect(card).toHaveClass("mrank-t2");
    expect(card).toHaveTextContent("3/7");
    expect(card).toHaveTextContent("累計ランクポイント42,000");
    expect(card).toHaveTextContent("ゴールド まであと 59,000 ランクポイント");
    expect(card).not.toHaveTextContent("集計対象月：2026-11");
    expect(card).not.toHaveTextContent("次回リセット：");
    expect(card).not.toHaveTextContent("維持ライン：20,000。達成済み");
    expect(card).not.toHaveTextContent("降格判定の見送り：残り2回");
    expect(card).toHaveTextContent("コイン購入時のボーナス+1.0％");
    expect(card).toHaveTextContent("シルバーの昇格ボーナス設定2,100無償コイン");
    expect(card).not.toHaveTextContent("お渡し済み");
    expect(card).toHaveTextContent("付与対象・今後の受領を保証するものではありません");
    expect(card).not.toHaveTextContent("未受領");
    expect(card).not.toHaveTextContent("引けます");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    const steps = within(screen.getByRole("list", { name: "会員ランクの段" })).getAllByRole("listitem");
    expect(steps).toHaveLength(7);
    expect(steps[2]).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("link", { name: "ランク制度の詳細を見る" })).toHaveAttribute("href", "https://support.ori-poke.com/member-rank/");
    expect(screen.getByRole("link", { name: "よくあるご質問" })).toHaveAttribute("href", "https://support.ori-poke.com/");
    expect(document.body).toHaveTextContent("これまでの合計");
    expect(document.body).not.toHaveTextContent("下がることはありません");
  });

  it.each(["beginner", "vip"] as const)("%sのゼロ・最上位・次ランクなしを扱う", async (code) => {
    loadMyMemberRank.mockResolvedValue(enabled(code, code === "beginner" ? 0 : 1640000));
    renderRankPage();
    const card = await currentCard();
    expect(card).toHaveClass(code === "beginner" ? "mrank-t0" : "mrank-t6");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", code === "beginner" ? "0" : "100");
    if (code === "vip") expect(card).toHaveTextContent("いちばん上のランクです");
    else expect(card).toHaveTextContent("現在のランクでは購入ボーナスはありません");
  });

  it("条件到達でも現在ランクを変更せず反映待ちと表示する", async () => {
    loadMyMemberRank.mockResolvedValue(enabled("silver", 128000));
    renderRankPage();
    expect(await currentCard()).toHaveTextContent("ゴールドの条件到達・ランク反映待ち");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByRole("heading", { name: "シルバー" })).toBeInTheDocument();
  });

  it("旧月次レスポンスを累計と偽らない", async () => {
    loadMyMemberRank.mockResolvedValue(enabled("silver", 1000, { point_basis: undefined, period: { month: "2026-11" } }));
    renderRankPage();
    expect(await screen.findByText("情報を表示できませんでした")).toBeInTheDocument();
    expect(screen.queryByText("累計ランクポイント")).not.toBeInTheDocument();
  });

  it("残りポイントを到達ラインから独自再計算しない", async () => {
    loadMyMemberRank.mockResolvedValue(enabled("silver", 1000, {
      next_rank: { code: "gold", name: "ゴールド", reach_line: 101000, remaining: 7 },
    }));
    renderRankPage();
    expect(await currentCard()).toHaveTextContent("ゴールド まであと 7 ランクポイント");
  });

  it("機能が無効なら利用不可を示す", async () => {
    loadMyMemberRank.mockResolvedValue(disabled);
    renderRankPage();
    expect(await screen.findByRole("heading", { name: "会員ランクは現在ご利用いただけません" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("API失敗を表示し、未ログインではAPIを呼ばない", async () => {
    loadMyMemberRank.mockRejectedValue(new Error("offline"));
    const view = renderRankPage();
    expect(await screen.findByText("情報を表示できませんでした")).toBeInTheDocument();
    view.unmount();
    renderRankPage({ authenticated: false, user: null });
    expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
    expect(loadMyMemberRank).toHaveBeenCalledTimes(1);
  });

  it("設定一覧が失敗しても本人のランクと購入特典を表示する", async () => {
    loadMyMemberRank.mockResolvedValue(enabled("gold", 128000));
    listMemberRanks.mockRejectedValue(new Error("offline"));
    renderRankPage();
    expect(await currentCard()).toHaveTextContent("+1.5％");
    expect(screen.queryByRole("list", { name: "会員ランクの段" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "会員ランクの説明を見る" })).toHaveAttribute("href", "https://support.ori-poke.com/member-rank/");
  });

  it("ユーザーが切り替わったら前のユーザーのランクを出さない", async () => {
    const auth = client();
    let resolveRank!: (rank: unknown) => void;
    loadMyMemberRank.mockResolvedValueOnce(enabled("silver", 42000)).mockImplementationOnce(() => new Promise((resolve) => { resolveRank = resolve; }));
    function SwitchUser() {
      const { refreshSession } = useSession();
      return <button onClick={() => void refreshSession()}>利用者切替</button>;
    }
    render(<SessionProvider client={auth}><SwitchUser /><MyMemberRankPage /></SessionProvider>);
    await currentCard();
    vi.mocked(auth.getCurrentSession).mockResolvedValue({ data: { ...authenticated, user: { ...authenticated.user!, id: "different-user" } }, metadata });
    fireEvent.click(screen.getByRole("button", { name: "利用者切替" }));
    await waitFor(() => expect(loadMyMemberRank).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("heading", { name: "シルバー" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "ランクポイントの内訳" })).not.toBeInTheDocument();
    resolveRank(enabled("gold", 128000));
    expect(await screen.findByRole("heading", { name: "ゴールド" })).toBeInTheDocument();
  });

  it("購入42000と補填10000を含むAPI累計52000、受領済みを表示する", async () => {
    loadMyMemberRank.mockResolvedValue(enabled("silver", 52000, { breakdown, transferred: true, promotion_bonus: { received: true } }));
    renderRankPage();
    expect(await currentCard()).toHaveTextContent("受領済みです。");
    expect(screen.getByRole("heading", { name: "ランクポイントの内訳" })).toBeInTheDocument();
    expect(screen.getByText("ランクポイント（これまでの合計）").parentElement).toHaveTextContent("52,000");
    expect(document.body).not.toHaveTextContent("補填10,000");
  });

  it("7色とマイページ用CSSを保持し、説明ページは追加しない", () => {
    const css = readFileSync("src/styles/member-rank.css", "utf8");
    for (let i = 0; i < 7; i++) expect(css).toContain(`.mrank-t${i} {`);
    expect(readFileSync("src/app/mypage/member-rank/layout.tsx", "utf8")).toContain('import "@/styles/member-rank.css";');
    expect(readFileSync("scripts/readiness/source-inventory.v1.json", "utf8")).not.toContain("src/app/pages/member-rank/");
  });
});

const breakdown: MemberRankBreakdown = {
  recent: [
    { kind: "purchase", points: 2000, label: "コイン購入（2,000コイン）", occurred_at: "2026-11-14T00:00:00Z" },
    { kind: "purchase", points: 30000, label: "コイン購入（30,000コイン）", occurred_at: "2026-11-09T00:00:00Z" },
    { kind: "purchase", points: 10000, label: "コイン購入（10,000コイン）", occurred_at: "2026-11-02T00:00:00Z" },
  ],
  total: 52000,
};

describe("累計内訳（merged OpenAPIの合成入力、正式Artifact検証ではない）", () => {
  it("マイページの帯も残数0を反映待ちとして表示する", () => {
    // Runtime input only: alpha.48's generated response is deliberately not recast as alpha.49.
    render(<MemberRankBand rank={enabled("silver", 128000) as unknown as Parameters<typeof MemberRankBand>[0]["rank"]} />);
    expect(screen.getByRole("region", { name: "会員ランク" })).toHaveTextContent("累計ランクポイント");
    expect(screen.getByRole("region", { name: "会員ランク" })).toHaveTextContent("ゴールドの条件到達・ランク反映待ち");
  });
  it("最新3件を新しい順で表示し、累計を再計算しない", () => {
    expect(isConsistentBreakdown(breakdown, 52000)).toBe(true);
    render(<MemberRankBreakdownSection breakdown={breakdown} rankPoints={52000} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("11/14 コイン購入（2,000コイン）+2,000");
    expect(rows[1]).toHaveTextContent("11/09");
    expect(rows[2]).toHaveTextContent("11/02");
    expect(rows[3]).toHaveTextContent("52,000");
  });

  it("購入以外と4件目を表示しない（契約外入力への防御）", () => {
    const invalid = { ...breakdown, recent: [
      { kind: "manual", points: 10000, label: "秘密の調整", occurred_at: "2026-11-15T00:00:00Z" },
      { kind: "refund", points: -1000, label: "返金詳細", occurred_at: "2026-11-15T00:00:00Z" },
      ...[...breakdown.recent].reverse(),
      { kind: "purchase", points: 1, label: "古い購入", occurred_at: "2026-10-01T00:00:00Z" },
    ] } as unknown as MemberRankBreakdown;
    render(<MemberRankBreakdownSection breakdown={invalid} rankPoints={52000} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(document.body).not.toHaveTextContent("秘密の調整");
    expect(document.body).not.toHaveTextContent("返金詳細");
    expect(document.body).not.toHaveTextContent("古い購入");
  });

  it.each([0, 10000])("履歴0件でも累計%sを保持する", (total) => {
    render(<MemberRankBreakdownSection breakdown={{ recent: [], total }} rankPoints={total} />);
    expect(screen.getByText("コインの購入履歴はありません")).toBeInTheDocument();
    expect(screen.getByText("ランクポイント（これまでの合計）").parentElement).toHaveTextContent(total.toLocaleString("ja-JP"));
  });

  it.each([44000, NaN, Infinity, 52000.1, -1])("不一致・不正な合計%sを推測補正しない", (total) => {
    const invalid = { ...breakdown, total };
    expect(isConsistentBreakdown(invalid, 52000)).toBe(false);
    const { container } = render(<MemberRankBreakdownSection breakdown={invalid} rankPoints={52000} />);
    expect(container).toBeEmptyDOMElement();
  });
});
