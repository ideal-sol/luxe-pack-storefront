import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { MyPageTop } from "@/components/account/my-page-top";
import { ToastProvider } from "@/components/common/toast-provider";
import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation";
import type { AuthClientAdapter, AuthSession } from "@/lib/platform";
import {
  myPageAccountNavigation,
  myPageShortcutNavigation,
  myPageSupportNavigation,
} from "@/lib/routes/navigation";

vi.mock("next/navigation", () => ({ usePathname: () => "/mypage" }));

const authenticated: AuthSession = {
  authenticated: true,
  user: {
    email_verified: true,
    id: "0198a001-0000-7000-8000-000000000601",
    state: "active",
  },
};
const anonymous: AuthSession = { authenticated: false, user: null };
const metadata = { idempotency_replayed: false, status: 200 } as const;

function response(data: AuthSession) {
  return { data, metadata };
}

function client(session: AuthSession = authenticated, overrides: Partial<AuthClientAdapter> = {}): AuthClientAdapter {
  return {
    completeEmailVerification: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue(response(session)),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue({ data: undefined, metadata: { ...metadata, status: 204 } }),
    register: vi.fn(),
    resendEmailVerification: vi.fn(),
    ...overrides,
  } as AuthClientAdapter;
}

function renderMyPage(authClient: AuthClientAdapter | null) {
  return render(
    <ToastProvider>
      <SessionProvider client={authClient}><MyPageTop /></SessionProvider>
    </ToastProvider>,
  );
}

describe("my page top", () => {
  it("renders only the canonical Session summary for an authenticated member", async () => {
    renderMyPage(client());
    expect(await screen.findByRole("heading", { name: "会員メニュー" })).toBeInTheDocument();
    expect(screen.getByText("メール認証")).toBeInTheDocument();
    expect(screen.getByText("確認済み")).toBeInTheDocument();
    expect(screen.getByText("アカウント状態")).toBeInTheDocument();
    expect(screen.getByText("利用中")).toBeInTheDocument();
    expect(screen.queryByText(authenticated.user!.id)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+pt/i)).not.toBeInTheDocument();
    expect(screen.queryByText("--")).not.toBeInTheDocument();
  });

  it("uses the centralized member and support routes", async () => {
    renderMyPage(client());
    await screen.findByRole("heading", { name: "会員メニュー" });
    for (const item of [...myPageShortcutNavigation, ...myPageAccountNavigation, ...myPageSupportNavigation]) {
      expect(screen.getByRole("link", { name: new RegExp(item.label) })).toHaveAttribute("href", item.href);
    }
    expect(screen.getByRole("link", { name: /コイン履歴/ })).toHaveAttribute("href", "/mypage/points");
    expect(screen.getByRole("link", { name: /ガチャ履歴/ })).toHaveAttribute("href", "/mypage/draws");
    expect(screen.getByRole("link", { name: /獲得アイテム/ })).toHaveAttribute("href", "/mypage/prizes");
    expect(screen.getByRole("link", { name: /お届け先登録/ })).toHaveAttribute("href", "/mypage/address");
    expect(screen.getByRole("link", { name: /LINE連携/ })).toHaveAttribute("href", "/mypage/line");
    expect(screen.getByRole("link", { name: /お知らせ/ })).toHaveAttribute("href", "/notices");
    expect(screen.getByRole("link", { name: /お問い合わせ/ })).toHaveAttribute("href", "/contact");
  });

  it("places shipping address registration immediately above LINE in Account", async () => {
    renderMyPage(client());
    const account = await screen.findByRole("navigation", { name: "アカウント" });
    const links = Array.from(account.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/mypage/address", "/mypage/line"]);
    expect(links.map((link) => link.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining("お届け先登録"),
      expect.stringContaining("LINE連携"),
    ]));
  });

  it("distinguishes Session loading and unauthenticated states", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderMyPage(client(authenticated, { getCurrentSession: vi.fn(() => pending) }));
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
    loading.unmount();

    renderMyPage(client(anonymous));
    expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログインへ" })).toHaveAttribute("href", "/login");
  });

  it("logs out through the existing Session boundary", async () => {
    const logout = vi.fn().mockResolvedValue({ data: undefined, metadata: { ...metadata, status: 204 } });
    renderMyPage(client(authenticated, { logout }));
    fireEvent.click(await screen.findByRole("button", { name: "ログアウト" }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
  });

  it("keeps unconfirmed member products and profile fields out of the page", async () => {
    renderMyPage(client());
    await screen.findByRole("heading", { name: "会員メニュー" });
    for (const label of ["Premium Plan", "Jackpot", "Coupon", "招待", "SMS", "Rank", "ランク", "プロフィール"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("keeps My Page current in Mobile Bottom Navigation", () => {
    render(<MobileBottomNavigation />);
    expect(screen.getByRole("navigation", { name: "モバイルナビゲーション" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /マイページ/ })).toHaveAttribute("aria-current", "page");
  });
});
