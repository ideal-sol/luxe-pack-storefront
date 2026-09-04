import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Children, isValidElement } from "react";
import { vi } from "vitest";
import MyPage from "@/app/mypage/page";
import { SessionProvider } from "@/components/auth/session-provider";
import { MyPageTop } from "@/components/account/my-page-top";
import { ToastProvider } from "@/components/common/toast-provider";
import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation";
import type { AuthClientAdapter, AuthSession } from "@/lib/platform";
import {
  accountNavigation,
  createMyPageSupportNavigation,
  lineAccountRoute,
  myPageAccountNavigation,
  myPageShortcutNavigation,
  publicRoutes,
  smsVerificationRoute,
} from "@/lib/routes/navigation";
import { markSmsRegistrationPrompt } from "@/lib/sms-registration-prompt";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/mypage", useRouter: () => ({ push }) }));

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
const contactHref = "https://contact.example.test/";

function response<T>(data: T) {
  return { data, metadata };
}

function client(session: AuthSession = authenticated, overrides: Partial<AuthClientAdapter> = {}): AuthClientAdapter {
  return {
    completeEmailVerification: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue(response(session)),
    getSmsVerificationStatus: vi.fn().mockResolvedValue(response({ challenge: null, phone: "+819012345678", phone_masked: "+819****5678", verified: true, verified_at: "2026-09-02T10:00:00Z" })),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue({ data: undefined, metadata: { ...metadata, status: 204 } }),
    register: vi.fn(),
    resendEmailVerification: vi.fn(),
    ...overrides,
  } as AuthClientAdapter;
}

function renderMyPage(
  authClient: AuthClientAdapter | null,
  accountUpdated?: "email" | "password",
  configuredContactHref: string | null = contactHref,
) {
  return render(
    <ToastProvider>
      <SessionProvider client={authClient}>
        <MyPageTop {...(accountUpdated ? { accountUpdated } : {})} {...(configuredContactHref ? { contactHref: configuredContactHref } : {})} />
      </SessionProvider>
    </ToastProvider>,
  );
}

async function configuredContactHref() {
  const page = await MyPage({});
  const myPageTop = Children.toArray(page.props.children).find(
    (child) => isValidElement(child) && child.type === MyPageTop,
  );
  return isValidElement<{ readonly contactHref?: string }>(myPageTop) ? myPageTop.props.contactHref : undefined;
}

describe("my page top", () => {
  beforeEach(() => {
    push.mockReset();
    window.sessionStorage.clear();
  });
  it("reads the contact destination from server-side APP_CONTACT", async () => {
    const original = process.env.APP_CONTACT;
    try {
      process.env.APP_CONTACT = `  ${contactHref}  `;
      expect(await configuredContactHref()).toBe(contactHref);
      process.env.APP_CONTACT = "   ";
      expect(await configuredContactHref()).toBeUndefined();
    } finally {
      if (original === undefined) delete process.env.APP_CONTACT;
      else process.env.APP_CONTACT = original;
    }
  });
  it("renders only the canonical Session summary for an authenticated member", async () => {
    renderMyPage(client());
    expect(await screen.findByRole("heading", { name: "会員メニュー" })).toBeInTheDocument();
    expect(document.querySelector(".mypage-summary__mark")).toHaveTextContent("OZ");
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
    for (const item of [...myPageShortcutNavigation, ...myPageAccountNavigation, ...createMyPageSupportNavigation(contactHref)]) {
      expect(screen.getByRole("link", { name: new RegExp(item.label) })).toHaveAttribute("href", item.href);
    }
    expect(screen.getByRole("link", { name: /コイン履歴/ })).toHaveAttribute("href", "/mypage/points");
    expect(screen.getByRole("link", { name: /購入履歴/ })).toHaveAttribute("href", "/mypage/purchases");
    expect(screen.getByRole("link", { name: /ガチャ履歴/ })).toHaveAttribute("href", "/mypage/draws");
    expect(screen.getByRole("link", { name: /獲得アイテム/ })).toHaveAttribute("href", "/mypage/prizes");
    expect(screen.getByRole("link", { name: /お届け先登録/ })).toHaveAttribute("href", "/mypage/address");
    expect(screen.getByRole("link", { name: /SMS認証/ })).toHaveAttribute("href", smsVerificationRoute);
    expect(screen.getByRole("link", { name: /メールアドレス変更/ })).toHaveAttribute("href", "/mypage/email");
    expect(screen.getByRole("link", { name: /パスワード変更/ })).toHaveAttribute("href", "/mypage/password");
    expect(screen.queryByRole("link", { name: /LINE連携/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /お知らせ/ })).toHaveAttribute("href", "/notices");
    expect(screen.getByRole("link", { name: /お問い合わせ/ })).toHaveAttribute("href", contactHref);
    expect(screen.getByRole("link", { name: /お問い合わせ/ })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /お問い合わせ/ })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("places Purchase History immediately above Coin History", async () => {
    renderMyPage(client());
    const shortcuts = await screen.findByRole("navigation", { name: "会員ショートカット" });
    const links = Array.from(shortcuts.querySelectorAll("a"));
    expect(links.slice(0, 2).map((link) => link.getAttribute("href"))).toEqual([
      "/mypage/purchases",
      "/mypage/points",
    ]);
  });

  it("keeps the confirmed support order and uses no /contact destination", async () => {
    renderMyPage(client());
    const support = await screen.findByRole("navigation", { name: "お知らせ・サポート" });
    const links = Array.from(support.querySelectorAll("a"));
    expect(links.map((link) => link.querySelector("strong")?.textContent)).toEqual([
      "お問い合わせ",
      "お知らせ",
      "ご利用ガイド",
      "利用規約",
      "プライバシーポリシー",
    ]);
    expect(links[0]).toHaveAttribute("href", contactHref);
    expect(links.some((link) => link.getAttribute("href") === "/contact")).toBe(false);
  });

  it("hides the contact link when APP_CONTACT is unavailable", async () => {
    renderMyPage(client(), undefined, null);
    const support = await screen.findByRole("navigation", { name: "お知らせ・サポート" });
    expect(screen.queryByRole("link", { name: /お問い合わせ/ })).not.toBeInTheDocument();
    expect(Array.from(support.querySelectorAll("a")).map((link) => link.querySelector("strong")?.textContent)).toEqual([
      "お知らせ",
      "ご利用ガイド",
      "利用規約",
      "プライバシーポリシー",
    ]);
  });

  it.each([
    ["mobile", 375],
    ["desktop", 1440],
  ])("keeps the Account layout without the LINE entry at the %s viewport", async (_viewport, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new Event("resize"));
    renderMyPage(client());
    const account = await screen.findByRole("navigation", { name: "アカウント" });
    const links = Array.from(account.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/mypage/address",
      "/mypage/sms-verification",
      "/mypage/email",
      "/mypage/password",
    ]);
    expect(links[0]).toHaveTextContent("お届け先登録");
    expect(links[1]).toHaveTextContent("SMS認証");
    expect(links[2]).toHaveTextContent("メールアドレス変更");
    expect(links[3]).toHaveTextContent("パスワード変更");
    expect(account).not.toHaveTextContent("LINE連携");
    expect(screen.getAllByRole("link")).toHaveLength(
      myPageShortcutNavigation.length + myPageAccountNavigation.length + createMyPageSupportNavigation(contactHref).length,
    );
  });

  it("retains the LINE direct-route navigation contract outside the My Page menu", () => {
    expect(accountNavigation).toContainEqual({ href: "/mypage/line", label: "LINE連携" });
    expect(lineAccountRoute).toBe("/mypage/line");
    expect(publicRoutes).toContain("/mypage/line");
    expect(publicRoutes).toContain(smsVerificationRoute);
  });

  it("consumes the user-scoped registration SMS prompt only once", async () => {
    markSmsRegistrationPrompt(authenticated.user!.id);
    const first = renderMyPage(client());
    expect(await screen.findByRole("dialog")).toHaveTextContent("SMS認証のご案内");
    fireEvent.click(screen.getByRole("button", { name: "あとで認証する" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    renderMyPage(client());
    await screen.findByRole("heading", { name: "会員メニュー" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("guards the address navigation for an unverified phone", async () => {
    const getSmsVerificationStatus = vi.fn().mockResolvedValue(response({ challenge: null, phone: null, phone_masked: null, verified: false, verified_at: null }));
    renderMyPage(client(authenticated, { getSmsVerificationStatus }));
    fireEvent.click(await screen.findByRole("link", { name: /お届け先登録/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("お届け先の登録にはSMS認証が必要です");
    fireEvent.click(screen.getByRole("button", { name: "SMS認証する" }));
    expect(push).toHaveBeenCalledWith(smsVerificationRoute);
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

  it.each([
    ["email", "メールアドレスを変更しました。"],
    ["password", "パスワードを変更しました。"],
  ] as const)("shows the one-time %s success and removes its query marker", async (accountUpdated, message) => {
    window.history.replaceState({}, "", `/mypage?account-updated=${accountUpdated}`);
    renderMyPage(client(), accountUpdated);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/mypage");
    expect(window.location.search).toBe("");
  });

  it("keeps unconfirmed member products and profile fields out of the page", async () => {
    renderMyPage(client());
    await screen.findByRole("heading", { name: "会員メニュー" });
    for (const label of ["Premium Plan", "Jackpot", "Coupon", "招待", "Rank", "ランク", "プロフィール"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("keeps My Page current in Mobile Bottom Navigation", () => {
    render(<MobileBottomNavigation />);
    expect(screen.getByRole("navigation", { name: "モバイルナビゲーション" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /マイページ/ })).toHaveAttribute("aria-current", "page");
  });
});
