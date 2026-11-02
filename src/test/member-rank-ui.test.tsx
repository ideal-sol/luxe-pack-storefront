import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { vi } from "vitest";
import MyMemberRankPage from "@/app/mypage/member-rank/page";
import { isConsistentBreakdown, MemberRankBreakdownSection } from "@/components/member-rank/member-rank-breakdown";
import type { MemberRankBreakdown } from "@/lib/platform/member-rank-client";
import { useSession } from "@/components/auth/session-provider";
import { SessionProvider } from "@/components/auth/session-provider";
import type { AuthClientAdapter, AuthSession } from "@/lib/platform";

const { listMemberRanks, loadMyMemberRank } = vi.hoisted(() => ({ listMemberRanks: vi.fn(), loadMyMemberRank: vi.fn() }));
vi.mock("@/lib/platform/member-rank-client", () => ({ listMemberRanks, loadMyMemberRank }));
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
    next_rank: next ? { code: next.code, name: next.name, reach_line: next.reach_line, remaining: next.reach_line! - points } : null,
    period: { month: "2026-11", resets_at: "2026-11-30T15:00:00Z" },
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
  it("現行APIの月次ポイント・次ランク・特典・維持条件を表示し、説明はサポートへ誘導する", async () => {
    loadMyMemberRank.mockResolvedValue(enabled("silver", 42000, {
      maintain: { line: 20000, remaining: 0, achieved: true },
      demotion_protection: { remaining_judgments: 2, guaranteed_until: "2027-01-31T14:59:59Z" },
    }));
    renderRankPage();
    const card = await currentCard();
    expect(card).toHaveClass("mrank-t2");
    expect(card).toHaveTextContent("3/7");
    expect(card).toHaveTextContent("今月のランクポイント42,000");
    expect(card).toHaveTextContent("ゴールド まであと 59,000 ランクポイント");
    expect(card).toHaveTextContent("集計対象月：2026-11");
    expect(card).toHaveTextContent("次回リセット：");
    expect(card).toHaveTextContent("維持ライン：20,000。達成済み");
    expect(card).toHaveTextContent("降格判定の見送り：残り2回");
    expect(card).toHaveTextContent("コイン購入時のボーナス+1.0％");
    expect(card).toHaveTextContent("シルバーの昇格ボーナス設定2,100無償コイン");
    expect(card).not.toHaveTextContent("お渡し済み");
    expect(card).not.toHaveTextContent("引けます");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    const steps = within(screen.getByRole("list", { name: "会員ランクの段" })).getAllByRole("listitem");
    expect(steps).toHaveLength(7);
    expect(steps[2]).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("link", { name: "ランク制度の詳細を見る" })).toHaveAttribute("href", "https://support.ori-poke.com/member-rank/");
    expect(screen.getByRole("link", { name: "よくあるご質問" })).toHaveAttribute("href", "https://support.ori-poke.com/");
    expect(document.body).not.toHaveTextContent("これまでの合計");
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

  it("維持条件の未達残数をAPIの値で示す", async () => {
    loadMyMemberRank.mockResolvedValue(enabled("silver", 1000, { maintain: { line: 20000, remaining: 19000, achieved: false } }));
    renderRankPage();
    expect(await currentCard()).toHaveTextContent("あと19,000ランクポイントです。");
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
    resolveRank(enabled("gold", 128000));
    expect(await screen.findByRole("heading", { name: "ゴールド" })).toBeInTheDocument();
  });

  it("内訳データが届いてもユーザーDOMには出力しない", async () => {
    loadMyMemberRank.mockResolvedValue(enabled("silver", 42000, { breakdown, transferred: true, promotion_bonus: { received: true }, point_basis: "cumulative" }));
    renderRankPage();
    await currentCard();
    expect(screen.queryByRole("heading", { name: "ランクポイントの内訳" })).not.toBeInTheDocument();
    expect(document.querySelector(".mrank-calc")).toBeNull();
    expect(document.body).not.toHaveTextContent("ご返金テスト");
    expect(document.body).not.toHaveTextContent("お渡し済み");
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
    { kind: "purchase", points: 10000, label: "購入テスト", occurred_at: "2026-11-01T00:00:00Z" },
    { kind: "refund", points: -2000, label: "ご返金テスト", occurred_at: "2026-11-02T00:00:00Z" },
    { kind: "manual", points: 1000, label: "調整テスト", occurred_at: "2026-11-03T00:00:00Z" },
  ],
  earlier_total: 30000,
  transfer: { status: "transferred", equivalent_rank: rankOf("bronze"), points: 3000 },
  total: 42000,
};

describe("将来用の内訳部品（本画面には接続しない）", () => {
  it("recent・earlier_total・transferを一度ずつ扱い、refund/manualを二重計上しない", () => {
    expect(isConsistentBreakdown(breakdown)).toBe(true);
    render(<MemberRankBreakdownSection breakdown={breakdown} />);
    expect(screen.getByText("それ以前の分（合計）").parentElement).toHaveTextContent("+30,000");
    expect(screen.getByText("他サイトからの移行（ブロンズ相当）").parentElement).toHaveTextContent("+3,000");
    expect(screen.getByText(/ご返金テスト/).parentElement).toHaveTextContent("−2,000");
    expect(screen.getByText(/調整テスト/).parentElement).toHaveTextContent("+1,000");
    expect(screen.getByText("ランクポイント合計").parentElement).toHaveTextContent("42,000");
    expect(screen.queryByText("そのほかの調整（合計）")).not.toBeInTheDocument();
  });

  it("空の内訳・移行なし・負の以前合計を扱う", () => {
    const view = render(<MemberRankBreakdownSection breakdown={{ recent: [], earlier_total: 0, transfer: null, total: 0 }} />);
    expect(screen.getByText("コインのご購入はまだありません")).toBeInTheDocument();
    view.rerender(<MemberRankBreakdownSection breakdown={{ recent: [], earlier_total: -100, transfer: null, total: -100 }} />);
    expect(screen.getByText("それ以前の分（合計）").parentElement).toHaveTextContent("−100");
  });

  it.each([44000, NaN, Infinity, 42000.1])("不一致・不正な合計%sは推測で補正せず表示しない", (total) => {
    const invalid = { ...breakdown, total };
    expect(isConsistentBreakdown(invalid)).toBe(false);
    const { container } = render(<MemberRankBreakdownSection breakdown={invalid} />);
    expect(container).toBeEmptyDOMElement();
  });
});
