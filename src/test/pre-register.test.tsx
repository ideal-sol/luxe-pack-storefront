import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_PRE_REGISTRATION_FIXTURES, PUBLIC_SMS_VERIFICATION_FIXTURES } from "@oripa/storefront-testkit";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import { LoginForm } from "@/components/auth/login-form";
import { EmailVerificationCompletion } from "@/components/auth/verification";
import { PreRegisterFlow } from "@/components/pre-register/pre-register-flow";
import { PreRegisterAccount } from "@/components/pre-register/pre-register-account";
import { StorefrontShell } from "@/components/layout/storefront-shell";
import type { AuthClientAdapter, AuthSession, PreRegistrationBonus, PreRegistrationCampaign } from "@/lib/platform";
import { httpsUrl, isPreRegisterReturn, pendingRegistrationId, preRegisterLoginHref, preRegisterSmsRoute } from "@/lib/pre-register";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), pathname: "/pre-register" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));
const response = <Value,>(data: Value) => ({ data, metadata: { status: 200, idempotency_replayed: false } });
const fixtures = PUBLIC_PRE_REGISTRATION_FIXTURES;
const anonymous: AuthSession = { authenticated: false, user: null };
const authenticated = PUBLIC_AUTH_FIXTURE.authenticated_session as AuthSession;
const campaign: PreRegistrationCampaign = { is_enabled: true, cutoff_at: "2026-11-01T00:00:00Z", point_amount: 500, point_type: "free", status: "accepting" };

function client(bonus: PreRegistrationBonus = fixtures.sms_pending, overrides: Partial<AuthClientAdapter> = {}): AuthClientAdapter {
  return {
    getCurrentSession: vi.fn().mockResolvedValue(response(authenticated)),
    getSmsVerificationStatus: vi.fn().mockResolvedValue(response(PUBLIC_SMS_VERIFICATION_FIXTURES.unverified)),
    getPreRegistrationCampaign: vi.fn().mockResolvedValue(response({ data: campaign })),
    getPreRegistrationBonus: vi.fn().mockResolvedValue(response({ data: bonus })),
    preRegister: vi.fn().mockResolvedValue(response(PUBLIC_AUTH_FIXTURE.pending_registration)),
    register: vi.fn(),
    login: vi.fn().mockResolvedValue(response(authenticated)),
    logout: vi.fn().mockResolvedValue(response(undefined)),
    completeEmailVerification: vi.fn().mockResolvedValue(response(authenticated)),
    resendEmailVerification: vi.fn().mockResolvedValue(response({ status: "accepted" })),
    ...overrides,
  } as AuthClientAdapter;
}

function renderWithClient(ui: React.ReactNode, adapter = client()) {
  return render(<SessionProvider client={adapter}>{ui}</SessionProvider>);
}

async function fillRegistration() {
  await screen.findByRole("button", { name: "無料で事前登録する" });
  for (const [label, value] of [["氏名", "登録テスト"], ["生年月日", "2000-01-01"], ["メールアドレス", "fixture@example.test"], ["パスワード", "fixture-password"]]) {
    const input = screen.getByLabelText(label!);
    expect(input).toBeRequired();
    fireEvent.change(input, { target: { value } });
  }
  return screen.getByRole("button", { name: "無料で事前登録する" }).closest("form")!;
}

beforeEach(() => {
  navigation.replace.mockClear();
  navigation.pathname = "/pre-register";
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("pre-registration application", () => {
  it("uses the dedicated API, four fields, native constraints and exact resend destination", async () => {
    const adapter = client(fixtures.sms_pending, { getCurrentSession: vi.fn().mockResolvedValue(response(anonymous)) });
    renderWithClient(<PreRegisterFlow />, adapter);
    const form = await fillRegistration();
    expect(screen.getByText("ご登録は無料です。18歳以上の方のみ登録可能です。")).toBeInTheDocument();
    expect(screen.queryByText(/未成年の方|親権者|法定代理人/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("パスワード")).toHaveAttribute("minlength", "8");
    expect(screen.getByLabelText("パスワード")).toHaveAttribute("maxlength", "128");
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/pages/terms");
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/pages/privacy");
    expect(screen.queryByRole("button", { name: /Google|LINE/ })).not.toBeInTheDocument();
    fireEvent.submit(form);
    await screen.findByRole("heading", { name: "メールの認証" });
    expect(adapter.preRegister).toHaveBeenCalledExactlyOnceWith({
      full_name: "登録テスト", birth_date: "2000-01-01", email: "fixture@example.test", password: "fixture-password",
    });
    expect(adapter.register).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "認証メールを再送" }));
    await waitFor(() => expect(adapter.resendEmailVerification).toHaveBeenCalledWith({
      user_id: PUBLIC_AUTH_FIXTURE.pending_registration.user_id, redirect_path: preRegisterSmsRoute,
    }));
    expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute("href", preRegisterLoginHref);
  });

  it.each(["not_started", "closed"] as const)("does not offer applications when the server reports %s", async (status) => {
    renderWithClient(<PreRegisterFlow />, client(fixtures.sms_pending, {
      getPreRegistrationCampaign: vi.fn().mockResolvedValue(response({ data: { ...campaign, status } })),
    }));
    await screen.findByRole("heading");
    expect(screen.queryByRole("button", { name: "無料で事前登録する" })).not.toBeInTheDocument();
    if (status === "closed") expect(screen.getByRole("link", { name: "通常の新規登録へ" })).toHaveAttribute("href", "/register");
  });

  it("fails closed on campaign errors and allows retry", async () => {
    const getPreRegistrationCampaign = vi.fn().mockRejectedValueOnce(new Error("private-detail")).mockResolvedValue(response({ data: campaign }));
    renderWithClient(<PreRegisterFlow />, client(fixtures.sms_pending, { getPreRegistrationCampaign }));
    await screen.findByRole("alert");
    expect(screen.queryByText("private-detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    await screen.findByRole("button", { name: "無料で事前登録する" });
  });

  it("rejects incomplete forms before a mutation", async () => {
    const adapter = client();
    renderWithClient(<PreRegisterFlow />, adapter);
    const submit = await screen.findByRole("button", { name: "無料で事前登録する" });
    fireEvent.submit(submit.closest("form")!);
    expect(adapter.preRegister).not.toHaveBeenCalled();
  });

  it("refreshes the server campaign after a cutoff race and offers normal registration", async () => {
    const adapter = client(fixtures.sms_pending, {
      getPreRegistrationCampaign: vi.fn().mockResolvedValueOnce(response({ data: campaign }))
        .mockResolvedValue(response({ data: { ...campaign, status: "closed" } })),
      preRegister: vi.fn().mockRejectedValue(new ApiProblemError({
        type: "https://storefront.test/problems/closed", title: "Closed", code: "PRE_REGISTRATION_CLOSED",
        status: 409, request_id: "fixture", retryable: false,
      })),
    });
    renderWithClient(<PreRegisterFlow />, adapter);
    fireEvent.submit(await fillRegistration());
    expect(await screen.findByRole("link", { name: "通常の新規登録へ" })).toHaveAttribute("href", "/register");
    expect(adapter.register).not.toHaveBeenCalled();
  });

  it("restores the resend notice on reload using only a validated opaque pending ID", async () => {
    const userId = PUBLIC_AUTH_FIXTURE.pending_registration.user_id;
    const adapter = client(fixtures.sms_pending, { getCurrentSession: vi.fn().mockResolvedValue(response(anonymous)) });
    renderWithClient(<PreRegisterFlow initialPendingUserId={pendingRegistrationId(userId)} />, adapter);
    fireEvent.click(screen.getByRole("button", { name: "認証メールを再送" }));
    await waitFor(() => expect(adapter.resendEmailVerification).toHaveBeenCalledWith({ user_id: userId, redirect_path: preRegisterSmsRoute }));
    expect(adapter.preRegister).not.toHaveBeenCalled();
    for (const value of ["bad", [userId], userId + "&token=secret"]) expect(pendingRegistrationId(value)).toBeNull();
  });

  it("delegates under-18 rejection to the server and preserves safe field errors", async () => {
    const preRegister = vi.fn().mockRejectedValue(new ApiProblemError({
      type: "https://storefront.test/problems/input", title: "Invalid input", status: 422, code: "INVALID_REQUEST",
      request_id: "fixture", retryable: false, detail: "private-detail", errors: { birth_date: ["18歳以上の方のみご登録いただけます。"] },
    }));
    renderWithClient(<PreRegisterFlow />, client(fixtures.sms_pending, { preRegister }));
    const form = await fillRegistration();
    fireEvent.change(screen.getByLabelText("生年月日"), { target: { value: "2020-01-01" } });
    fireEvent.submit(form);
    await screen.findByText("18歳以上の方のみご登録いただけます。");
    expect(screen.queryByText("private-detail")).not.toBeInTheDocument();
    expect(preRegister).toHaveBeenCalledOnce();
  });

  it("blocks duplicate submissions and recovers from a network failure", async () => {
    let rejectRequest!: (error: Error) => void;
    const preRegister = vi.fn().mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject; }))
      .mockResolvedValue(response(PUBLIC_AUTH_FIXTURE.pending_registration));
    renderWithClient(<PreRegisterFlow />, client(fixtures.sms_pending, { preRegister }));
    const form = await fillRegistration();
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(preRegister).toHaveBeenCalledOnce();
    await act(async () => { rejectRequest(new Error("private-network-error")); });
    await screen.findByRole("alert");
    fireEvent.submit(form);
    await screen.findByRole("heading", { name: "メールの認証" });
    expect(preRegister).toHaveBeenCalledTimes(2);
  });
});

describe("server-authoritative thanks guard and recovery", () => {
  it.each(["pre_registered", "awaiting_activation", "activated"] as const)("renders %s without inventing a grant", async (status) => {
    const adapter = client(fixtures[status]);
    renderWithClient(<PreRegisterAccount screen="thanks" />, adapter);
    await screen.findByRole("heading", { name: "事前登録ありがとうございます" });
    if (status === "activated") {
      expect(screen.getByText("付与コイン：500コイン")).toBeInTheDocument();
      expect(screen.getByText(/有効期限：/)).toBeInTheDocument();
    } else {
      expect(screen.getByText("特典のコインはまだ付与されていません。")).toBeInTheDocument();
      expect(screen.queryByText(/付与コイン：/)).not.toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "公式Xをフォローする" })).toHaveAttribute("href", "https://x.com/oripoke_jp");
    expect(screen.queryByRole("link", { name: "公式LINEを友だち追加する" })).not.toBeInTheDocument();
    expect(adapter.preRegister).not.toHaveBeenCalled();
  });

  it.each(["not_applicant", "email_pending", "sms_pending", "sms_after_cutoff"] as const)("does not show thanks for %s", async (fixture) => {
    const adapter = client(fixtures[fixture]);
    renderWithClient(<PreRegisterAccount screen="thanks" />, adapter);
    await waitFor(() => expect(adapter.getPreRegistrationBonus).toHaveBeenCalled());
    await screen.findByText(fixture === "not_applicant" ? "このアカウントの事前登録のお申し込みはありません。"
      : fixture === "email_pending" ? "認証メールをご確認ください"
        : fixture === "sms_pending" ? "電話番号の認証（SMS）を完了してください。" : "事前登録特典の対象外です");
    expect(screen.queryByRole("heading", { name: "事前登録ありがとうございます" })).not.toBeInTheDocument();
  });

  it("does not determine eligibility from browser time or fixed copy", async () => {
    renderWithClient(<PreRegisterAccount screen="thanks" />, client({
      ...fixtures.pre_registered, pre_registered_at: "2099-01-01T00:00:00Z",
    }));
    await screen.findByRole("heading", { name: "事前登録ありがとうございます" });
  });

  it("shows the actual activated amount rather than fixed design copy", async () => {
    renderWithClient(<PreRegisterAccount screen="thanks" />, client({ ...fixtures.activated, point_amount: 750 }));
    await screen.findByText("付与コイン：750コイン");
    expect(screen.queryByText("付与コイン：500コイン")).not.toBeInTheDocument();
  });

  it("requires login on direct entry and does not read private status", async () => {
    const adapter = client(fixtures.activated, { getCurrentSession: vi.fn().mockResolvedValue(response(anonymous)) });
    renderWithClient(<PreRegisterAccount screen="thanks" />, adapter);
    expect(await screen.findByRole("link", { name: "ログインする" })).toHaveAttribute("href", preRegisterLoginHref);
    expect(adapter.getPreRegistrationBonus).not.toHaveBeenCalled();
    expect(screen.queryByText("事前登録ありがとうございます")).not.toBeInTheDocument();
  });

  it("fails closed on private API errors, retries, and keeps stale reads hidden after logout", async () => {
    let resolveRead!: (value: ReturnType<typeof response<{ data: PreRegistrationBonus }>>) => void;
    const getPreRegistrationBonus = vi.fn().mockRejectedValueOnce(new Error("private-exception"))
      .mockImplementation(() => new Promise((resolve) => { resolveRead = resolve; }));
    function Logout() { const { logout } = useSession(); return <button onClick={() => void logout()}>logout</button>; }
    const adapter = client(fixtures.activated, { getPreRegistrationBonus });
    renderWithClient(<><PreRegisterAccount screen="thanks" /><Logout /></>, adapter);
    await screen.findByRole("alert");
    expect(screen.queryByText("private-exception")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => expect(getPreRegistrationBonus).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "logout" }));
    await screen.findByRole("link", { name: "ログインする" });
    await act(async () => { resolveRead(response({ data: fixtures.activated })); });
    expect(screen.queryByText("事前登録ありがとうございます")).not.toBeInTheDocument();
  });

  it("reuses SMS OTP and phone re-entry then reads eligibility before thanks", async () => {
    let bonus: PreRegistrationBonus = fixtures.sms_pending;
    const adapter = client(bonus, {
      getPreRegistrationBonus: vi.fn().mockImplementation(async () => response({ data: bonus })),
      getSmsVerificationStatus: vi.fn().mockImplementation(async () => response(bonus.sms_verified ? PUBLIC_SMS_VERIFICATION_FIXTURES.verified : PUBLIC_SMS_VERIFICATION_FIXTURES.unverified)),
      sendSmsVerification: vi.fn().mockResolvedValue(response({ ...PUBLIC_SMS_VERIFICATION_FIXTURES.send_pending, status: "accepted", delivery_state: "accepted" })),
      verifySmsCode: vi.fn().mockImplementation(async () => { bonus = fixtures.pre_registered; return response(PUBLIC_SMS_VERIFICATION_FIXTURES.verified); }),
    });
    renderWithClient(<PreRegisterAccount screen="sms" />, adapter);
    fireEvent.change(await screen.findByLabelText("携帯電話番号"), { target: { value: "090-1234-5678" } });
    fireEvent.click(screen.getByRole("button", { name: "認証コードを送信" }));
    await screen.findByLabelText("認証コード");
    fireEvent.click(screen.getByRole("button", { name: "電話番号を再入力" }));
    fireEvent.change(await screen.findByLabelText("携帯電話番号"), { target: { value: "080-1234-5678" } });
    fireEvent.click(screen.getByRole("button", { name: "認証コードを送信" }));
    expect(adapter.sendSmsVerification).toHaveBeenLastCalledWith({ phone: "08012345678" }, {});
    expect(screen.queryByRole("link", { name: /マイページ/ })).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("認証コード"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "SMS認証を完了" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/pre-register/thanks"));
    expect(adapter.getPreRegistrationBonus).toHaveBeenCalled();
  });

  it.each([undefined, preRegisterSmsRoute, "//evil.test", "/pre-register/sms?next=evil"] as const)("resumes an applicant safely from login return %s", async (returnTo) => {
    const adapter = client(fixtures.sms_pending);
    renderWithClient(<LoginForm returnTo={returnTo} />, adapter);
    fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "fixture@example.test" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "fixture-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "ログイン" }).closest("form")!);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(preRegisterSmsRoute));
  });

  it("routes an applicant to dedicated SMS after email verification", async () => {
    renderWithClient(<EmailVerificationCompletion userId={authenticated.user!.id} hash={"b".repeat(64)} />, client(fixtures.sms_pending));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(preRegisterSmsRoute));
  });
});

describe("public pre-registration presentation", () => {
  it.each(["/pre-register", "/pre-register/sms", "/pre-register/thanks", "/login", "/password-reset/confirm", "/verify-email/error"])("omits protected navigation and wallet reads on %s", (pathname) => {
    navigation.pathname = pathname;
    render(<StorefrontShell firstBuyLayoutEnabled={false}><p>public content</p></StorefrontShell>);
    expect(screen.getByText("public content")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "オリポケ" })).toHaveAttribute("src", "/brand/logo.webp");
  });

  it.each([undefined, "", "http://line.test/path", "https://", "https://user:password@line.test", "javascript:alert(1)", " https://line.test"])("hides invalid LINE configuration %s", (value) => {
    expect(httpsUrl(value)).toBeNull();
  });
  it("accepts a valid HTTPS LINE URL and only the fixed return path", () => {
    expect(httpsUrl("https://line.test/invite")).toBe("https://line.test/invite");
    expect(isPreRegisterReturn(preRegisterSmsRoute)).toBe(true);
    for (const value of ["//evil.test", preRegisterSmsRoute + "/", preRegisterSmsRoute + "?next=/", [preRegisterSmsRoute]]) expect(isPreRegisterReturn(value)).toBe(false);
  });
});
