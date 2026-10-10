import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import { PUBLIC_DRAW_FIXTURE } from "@oripa/storefront-testkit";
import { HomeLoginBonusFeed } from "@/components/catalog/home-login-bonus";
import { LoginGachaDetailView } from "@/components/catalog/login-gacha-detail";
import { PublicClientProvider } from "@/components/catalog/public-client-provider";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";
import { LoginGachaDrawPanel } from "@/components/draw/login-gacha-draw-panel";
import { contactLoginReturn } from "@/lib/contact-return";
import type { LoginGachaDetail, LoginGachaSummary, PublicCatalogAdapter, DrawClientAdapter } from "@/lib/platform";
import type { SessionState } from "@/components/auth/session-provider";

const { router, refreshWallet, session } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() }, refreshWallet: vi.fn(), session: { state: { status: "loading" } as SessionState },
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/auth/session-provider", () => ({ useSession: () => session }));
vi.mock("@/components/points/point-client-provider", () => ({ usePointClient: () => ({ refreshWallet }) }));
const id = "0198a001-0000-7000-8000-000000000011";
const daily: LoginGachaSummary = { id, public_code: "daily", gacha_type: "login_daily", title: "Daily", thumbnail: null, price_points: 0, publish_start_at: "2026-01-01T00:00:00Z", publish_end_at: null, availability: "available" };
const signup: LoginGachaSummary = { ...daily, id: "0198a001-0000-7000-8000-000000000012", gacha_type: "signup_once", title: "Signup" };
const detail: LoginGachaDetail = { ...daily, description: "説明", notices: "注意事項", prizes: [], ranks: [], eligibility: { eligible: true, used: false, reason: null, resets_at: null } };
const response = <T,>(data: T) => ({ data, metadata: { status: 200, idempotency_replayed: false } });
function error(code: string, status = 401) { return new ApiProblemError({ code, status, title: "Rejected", type: "https://example.test/problems/rejected", retryable: false, request_id: "qa" }); }
function auth(userId = "user-a") { session.state = { status: "authenticated", session: { authenticated: true, user: { id: userId } } } as SessionState; }
function client(items: readonly LoginGachaSummary[] = []) { return { listLoginGachas: vi.fn().mockResolvedValue(response({ items })), getLoginGacha: vi.fn().mockResolvedValue(response({ data: detail })) } as unknown as PublicCatalogAdapter; }
function wrap(ui: React.ReactNode, api = client(), draw = vi.fn().mockResolvedValue(response(PUBLIC_DRAW_FIXTURE))) {
  return <PublicClientProvider client={api}><DrawClientProvider client={{ createDraw: draw } as unknown as DrawClientAdapter}>{ui}</DrawClientProvider></PublicClientProvider>;
}
beforeEach(() => { vi.clearAllMocks(); auth(); });

describe("login Gacha TOP", () => {
  it("shows guest Daily/Signup/multiple cards using only the public response", async () => {
    session.state = { status: "unauthenticated", session: { authenticated: false, user: null } };
    const paid = { ...daily, id: "paid", title: "Paid Daily", price_points: 1250, publish_start_at: "2999-01-01T00:00:00Z" };
    const api = client([daily, signup, paid, { ...daily, id: "fourth", title: "Another" }]);
    render(wrap(<HomeLoginBonusFeed />, api));
    expect(await screen.findByRole("link", { name: "Dailyの詳細を見る" })).toHaveAttribute("href", `/login-gachas/${id}`);
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getByText("新規登録限定")).toBeInTheDocument();
    expect(screen.getByText("1ユーザー1回")).toBeInTheDocument();
    expect(screen.getByLabelText("単価 1250コイン")).toHaveTextContent("1,250");
    expect(screen.getAllByLabelText("単価 無料")).toHaveLength(3);
    expect(screen.queryByText("準備中")).not.toBeInTheDocument();
    expect(api.getLoginGacha).not.toHaveBeenCalled();
  });
  it("retains the pending design only for a successful empty list", async () => {
    render(wrap(<HomeLoginBonusFeed />));
    expect(await screen.findAllByText("準備中")).toHaveLength(3);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
  it("shows a recoverable section error instead of fake empty success", async () => {
    const api = client([daily]); vi.mocked(api.listLoginGachas).mockRejectedValueOnce(error("SERVICE_UNAVAILABLE", 503));
    render(wrap(<><p>Standard catalog remains</p><HomeLoginBonusFeed /></>, api));
    expect(await screen.findByText("ログインボーナスを取得できませんでした")).toBeInTheDocument();
    expect(screen.getByText("Standard catalog remains")).toBeInTheDocument();
    expect(screen.queryByText("準備中")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("link", { name: "Dailyの詳細を見る" })).toBeInTheDocument();
  });
  it("does not invent paused or empty-inventory cards omitted by Platform", async () => {
    render(wrap(<HomeLoginBonusFeed />, client([signup])));
    expect(await screen.findAllByRole("article")).toHaveLength(1);
    expect(screen.queryByText("Daily")).not.toBeInTheDocument();
  });
});

describe("login Gacha detail/session", () => {
  it.each(["unauthenticated", "session-expired"] as const)("redirects %s without mounting personal data", async (status) => {
    session.state = status === "unauthenticated" ? { status, session: { authenticated: false, user: null } } : { status };
    const api = client(); render(wrap(<LoginGachaDetailView gachaId={id} />, api));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/login?returnTo=${encodeURIComponent(`/login-gachas/${id}`)}`));
    expect(api.getLoginGacha).not.toHaveBeenCalled();
  });
  it.each(["AUTHENTICATION_REQUIRED", "SESSION_EXPIRED"])("uses typed %s for invalid/revoked/expired server sessions", async (code) => {
    const api = client(); vi.mocked(api.getLoginGacha).mockRejectedValue(error(code));
    render(wrap(<LoginGachaDetailView gachaId={id} />, api));
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "1回抽選する" })).not.toBeInTheDocument();
  });
  it("renders dedicated detail fields and leaves rates absent", async () => {
    const api = client(); render(wrap(<LoginGachaDetailView gachaId={id} />, api));
    expect(await screen.findByRole("heading", { name: "Daily" })).toBeInTheDocument();
    expect(api.getLoginGacha).toHaveBeenCalledWith(id);
    expect(screen.getByText("説明")).toBeInTheDocument();
    expect(screen.getByText("注意事項")).toBeInTheDocument();
    expect(screen.queryByText(/排出率|確率/)).not.toBeInTheDocument();
  });
  it("discards User A detail and ignores its late request after switching to User B", async () => {
    let finish!: (value: ReturnType<typeof response<{ data: LoginGachaDetail }>>) => void;
    const api = client(); vi.mocked(api.getLoginGacha).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce(response({ data: { ...detail, title: "User B detail", eligibility: { ...detail.eligibility, eligible: false, used: true, reason: "already_used" } } }));
    const ui = () => wrap(<LoginGachaDetailView gachaId={id} />, api);
    const view = render(ui()); auth("user-b"); view.rerender(ui());
    expect(await screen.findByRole("heading", { name: "User B detail" })).toBeInTheDocument();
    await act(async () => finish(response({ data: { ...detail, title: "User A detail" } })));
    expect(screen.queryByText("User A detail")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今日は利用済みです。" })).toBeDisabled();
  });
  it("allows only canonical detail return paths", () => {
    expect(contactLoginReturn(`/login-gachas/${id}`)).toBe(`/login-gachas/${id}`);
    for (const path of ["//evil.test", `/login-gachas/${id}/../points`, `/login-gachas/${id}?next=evil`, "/login-gachas/%2f%2fevil.test"]) expect(contactLoginReturn(path)).toBe("/mypage");
  });
});

describe("login Gacha Draw boundary", () => {
  it.each([["login_daily", 0], ["login_daily", 250], ["signup_once", 0]] as const)("submits %s price %s through the existing operation/result flow", async (gacha_type, price_points) => {
    const draw = vi.fn().mockResolvedValue(response(PUBLIC_DRAW_FIXTURE));
    render(wrap(<LoginGachaDrawPanel detail={{ ...detail, gacha_type, price_points }} />, client(), draw));
    fireEvent.click(screen.getByRole("button", { name: "1回抽選する" })); fireEvent.click(screen.getByRole("button", { name: "抽選を実行する" }));
    await waitFor(() => expect(draw).toHaveBeenCalledWith(id, 1, { idempotency_key: expect.any(String) }));
    expect(router.push).toHaveBeenCalledWith(`/draws/${PUBLIC_DRAW_FIXTURE.id}/result`);
    expect(refreshWallet).toHaveBeenCalledOnce();
  });
  it.each([
    ["login_daily", "already_used", "今日は利用済みです。"],
    ["signup_once", "already_used", "このガチャは利用済みです。"],
    ["signup_once", "registration_not_qualified", "新規登録の対象条件を満たしていません。"],
    ["login_daily", "inventory_unavailable", "現在は抽選を利用できません。"],
  ] as const)("disables %s / %s from Platform eligibility", (gacha_type, reason, label) => {
    const draw = vi.fn(); render(wrap(<LoginGachaDrawPanel detail={{ ...detail, gacha_type, eligibility: { eligible: false, used: reason === "already_used", reason, resets_at: null } }} />, client(), draw));
    expect(screen.getByRole("button", { name: label })).toBeDisabled(); expect(draw).not.toHaveBeenCalled();
  });
  it.each(["INSUFFICIENT_POINTS", "DAILY_DRAW_LIMIT_EXCEEDED", "GACHA_AUDIENCE_NOT_ELIGIBLE", "GACHA_NOT_DRAWABLE", "GACHA_SALES_PAUSED"])("handles authoritative Draw rejection %s without a result", async (code) => {
    const draw = vi.fn().mockRejectedValue(error(code, 409)); render(wrap(<LoginGachaDrawPanel detail={detail} />, client(), draw));
    fireEvent.click(screen.getByRole("button", { name: "1回抽選する" })); fireEvent.click(screen.getByRole("button", { name: "抽選を実行する" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument(); expect(router.push).not.toHaveBeenCalled(); expect(refreshWallet).not.toHaveBeenCalled();
  });
});

it("uses CloudFront for new login Gacha list and detail thumbnails", async () => {
  vi.stubEnv("NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL", "https://cdn.example.test");
  try {
    const thumbnail = { id: "image", path: "/gacha/Login_New.webp", media_type: "image" as const, mime_type: "image/webp", checksum_sha256: "1".repeat(64), alt_text: "New login" };
    const api = client([{ ...daily, thumbnail }]);
    const list = render(wrap(<HomeLoginBonusFeed />, api));
    expect(await screen.findByRole("img", { name: "New login" })).toHaveAttribute("src", "https://cdn.example.test/gacha/Login_New.webp");
    list.unmount();
    vi.mocked(api.getLoginGacha).mockResolvedValue(response({ data: { ...detail, thumbnail } }));
    render(wrap(<LoginGachaDetailView gachaId={id} />, api));
    expect(await screen.findByRole("img", { name: "New login" })).toHaveAttribute("src", "https://cdn.example.test/gacha/Login_New.webp");
  } finally { vi.unstubAllEnvs(); }
});
