import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { ApiProblemError } from "@oripa/storefront-client";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_SMS_VERIFICATION_FIXTURES } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import { MemberAccess, MemberRouteAccess } from "@/components/auth/member-access";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { EmailVerificationCompletion } from "@/components/auth/verification";
import VerifyEmailPage from "@/app/verify-email/page";
import { PointClientProvider, usePointClient } from "@/components/points/point-client-provider";
import { requiresSmsVerification, smsVerificationRoute } from "@/lib/routes/navigation";
import { callGlobalFetch } from "@/lib/platform/browser-client";
import { smsVerificationHref, smsReturnDestination } from "@/lib/sms-return";
import type { AuthClientAdapter, AuthSession, PointClientAdapter, SmsVerificationStatus } from "@/lib/platform";

const navigation = vi.hoisted(() => ({ pathname: "/mypage", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));
const metadata = { status: 200, idempotency_replayed: false } as const;
const authenticated = PUBLIC_AUTH_FIXTURE.authenticated_session as AuthSession;
const anonymous: AuthSession = { authenticated: false, user: null };
const verified = PUBLIC_SMS_VERIFICATION_FIXTURES.verified as SmsVerificationStatus;
const unverified = PUBLIC_SMS_VERIFICATION_FIXTURES.unverified as SmsVerificationStatus;
const response = <Value,>(data: Value) => ({ data, metadata });

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function authClient(overrides: Partial<AuthClientAdapter> = {}): AuthClientAdapter {
  return {
    getPreRegistrationBonus: vi.fn().mockResolvedValue(response({ data: { status: "not_applicant" } })),
    getCurrentSession: vi.fn().mockResolvedValue(response(authenticated)),
    getSmsVerificationStatus: vi.fn().mockResolvedValue(response(verified)),
    login: vi.fn().mockResolvedValue(response(authenticated)),
    logout: vi.fn().mockResolvedValue(response(undefined)),
    completeEmailVerification: vi.fn().mockResolvedValue(response(authenticated)),
    verifySmsCode: vi.fn().mockResolvedValue(response(verified)),
    register: vi.fn().mockResolvedValue(response(PUBLIC_AUTH_FIXTURE.pending_registration)),
    ...overrides,
  } as AuthClientAdapter;
}

function Controls() {
  const { refreshSession, logout, verifySmsCode, smsAccess } = useSession();
  return <>
    <output>{smsAccess}</output>
    <button onClick={() => void refreshSession()}>refresh</button>
    <button onClick={() => void logout()}>logout</button>
    <button onClick={() => void verifySmsCode({ challenge_id: "fixture", code: "123456" })}>verify</button>
  </>;
}

function Wallet() {
  const { wallet } = usePointClient();
  return <output>{wallet.status === "ready" ? wallet.balance.total_points : "wallet withheld"}</output>;
}

beforeEach(() => {
  navigation.pathname = "/mypage";
  navigation.replace.mockReset();
  window.history.replaceState(null, "", "/");
});
afterEach(() => vi.unstubAllGlobals());

describe("signup SMS member boundary", () => {
  it("never mounts member readers until both Session and SMS resolve", async () => {
    const session = deferred<ReturnType<typeof response<AuthSession>>>();
    const sms = deferred<ReturnType<typeof response<SmsVerificationStatus>>>();
    const readMember = vi.fn();
    function MemberData() {
      useEffect(() => { readMember(); }, []);
      return <p>member data</p>;
    }
    const client = authClient({ getCurrentSession: vi.fn(() => session.promise), getSmsVerificationStatus: vi.fn(() => sms.promise) });
    render(<SessionProvider client={client}><MemberRouteAccess><MemberData /></MemberRouteAccess></SessionProvider>);
    expect(screen.queryByText("member data")).not.toBeInTheDocument();
    expect(readMember).not.toHaveBeenCalled();
    await act(async () => session.resolve(response(authenticated)));
    expect(screen.queryByText("member data")).not.toBeInTheDocument();
    expect(readMember).not.toHaveBeenCalled();
    await act(async () => sms.resolve(response(verified)));
    expect(await screen.findByText("member data")).toBeInTheDocument();
    expect(readMember).toHaveBeenCalledOnce();
  });

  it.each(["/mypage", "/mypage/purchases", "/mypage/purchases/fixture", "/mypage/points", "/mypage/draws", "/mypage/prizes", "/mypage/address", "/draws/fixture/result", "/login-gachas/fixture"])(
    "blocks an unverified direct entry/reload at %s", async (pathname) => {
      navigation.pathname = pathname;
      const client = authClient({ getSmsVerificationStatus: vi.fn().mockResolvedValue(response(unverified)) });
      for (const entry of ["direct", "reload"]) {
        const view = render(<SessionProvider client={client}><MemberRouteAccess><p>private {entry}</p></MemberRouteAccess></SessionProvider>);
        await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(smsVerificationRoute));
        expect(screen.queryByText("private " + entry)).not.toBeInTheDocument();
        view.unmount();
      }
    },
  );

  it("blocks internal navigation while leaving the public entry available", async () => {
    navigation.pathname = "/";
    const client = authClient({ getSmsVerificationStatus: vi.fn().mockResolvedValue(response(unverified)) });
    const tree = <SessionProvider client={client}><MemberRouteAccess><p>route body</p></MemberRouteAccess><Controls /></SessionProvider>;
    const view = render(tree);
    expect(screen.getByText("route body")).toBeInTheDocument();
    await screen.findByText("unverified");
    navigation.pathname = "/mypage/prizes";
    view.rerender(<SessionProvider client={client}><MemberRouteAccess><p>private body</p></MemberRouteAccess><Controls /></SessionProvider>);
    expect(screen.queryByText("private body")).not.toBeInTheDocument();
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(smsVerificationRoute));
  });

  it.each(["/", "/gachas", "/gachas/pack", "/gachas/pack/prize-rate", "/notices", "/notices/fixture", "/pages/terms", "/pages/privacy", "/points", "/login", "/register", "/verify-email", "/password-reset", "/password-reset/confirm", "/email-change/verify", "/mypage/email", "/mypage/password", "/mypage/line", "/mypage/sms-verification", "/contact", "/points/purchase/thanks"])(
    "preserves the SMS exception %s while checking authentication", (pathname) => {
      expect(requiresSmsVerification(pathname)).toBe(false);
      navigation.pathname = pathname;
      render(<SessionProvider client={authClient({ getCurrentSession: vi.fn(() => new Promise<ReturnType<typeof response<AuthSession>>>(() => undefined)) })}><MemberRouteAccess><p>exception route</p></MemberRouteAccess></SessionProvider>);
      expect(screen.getByText("exception route")).toBeInTheDocument();
      expect(navigation.replace).not.toHaveBeenCalled();
    },
  );

  it("fails closed on SMS errors and retries before mounting data", async () => {
    const getSmsVerificationStatus = vi.fn().mockRejectedValueOnce(new Error("private failure")).mockResolvedValue(response(verified));
    render(<SessionProvider client={authClient({ getSmsVerificationStatus })}><MemberAccess><p>member data</p></MemberAccess></SessionProvider>);
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private failure");
    expect(screen.queryByText("member data")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(await screen.findByText("member data")).toBeInTheDocument();
    expect(getSmsVerificationStatus).toHaveBeenCalledTimes(2);
  });

  it("invalidates SMS and wallet on user changes and ignores old reads after logout", async () => {
    const nextSms = deferred<ReturnType<typeof response<SmsVerificationStatus>>>();
    const client = authClient({
      getCurrentSession: vi.fn().mockResolvedValueOnce(response(authenticated)).mockResolvedValue(response({ ...authenticated, user: { ...authenticated.user!, id: "second-user" } })),
      getSmsVerificationStatus: vi.fn().mockResolvedValueOnce(response(verified)).mockImplementation(() => nextSms.promise),
    });
    const getWallet = vi.fn().mockResolvedValue(response({ paid_points: 100, free_points: 0, total_points: 100 }));
    render(<SessionProvider client={client}><PointClientProvider client={{ getWallet } as unknown as PointClientAdapter}>
      <MemberAccess><p>member data</p></MemberAccess><Wallet /><Controls />
    </PointClientProvider></SessionProvider>);
    await screen.findByText("100");
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    expect(screen.queryByText("100")).not.toBeInTheDocument();
    expect(screen.queryByText("member data")).not.toBeInTheDocument();
    await waitFor(() => expect(client.getSmsVerificationStatus).toHaveBeenCalledTimes(2));
    expect(getWallet).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "logout" }));
    await screen.findByText("ログインしてください");
    await act(async () => nextSms.resolve(response(verified)));
    expect(screen.queryByText("member data")).not.toBeInTheDocument();
    expect(screen.queryByText("100")).not.toBeInTheDocument();
  });

  it("refreshes both Session and SMS after verification, then opens member content", async () => {
    const client = authClient({ getSmsVerificationStatus: vi.fn().mockResolvedValueOnce(response(unverified)).mockResolvedValue(response(verified)) });
    render(<SessionProvider client={client}><MemberAccess><p>member data</p></MemberAccess><Controls /></SessionProvider>);
    await screen.findByText("unverified");
    fireEvent.click(screen.getByRole("button", { name: "verify" }));
    expect(await screen.findByText("member data")).toBeInTheDocument();
    expect(client.getCurrentSession).toHaveBeenCalledTimes(2);
    expect(client.getSmsVerificationStatus).toHaveBeenCalledTimes(2);
  });

  it.each([["SESSION_EXPIRED", 401], ["SMS_VERIFICATION_REQUIRED", 403]] as const)(
    "removes member content after the canonical API rejects access with %s", async (code, status) => {
      render(<SessionProvider client={authClient()}><MemberAccess><p>member data</p></MemberAccess></SessionProvider>);
      await screen.findByText("member data");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { status })));
      await act(async () => { await callGlobalFetch("https://storefront.test/platform/member"); });
      expect(screen.queryByText("member data")).not.toBeInTheDocument();
    },
  );

  it("retains only safe member return paths, including an in-progress card callback", () => {
    const registrationId = "0198a001-0000-7000-8000-000000000501";
    window.history.replaceState(null, "", "/points/purchase/fixture?card_registration_id=" + registrationId + "&secret=excluded");
    window.history.replaceState(null, "", smsVerificationHref());
    expect(smsReturnDestination()).toBe("/points/purchase/fixture?card_registration_id=" + registrationId);
    window.history.replaceState(null, "", smsVerificationRoute + "?returnTo=" + encodeURIComponent("//evil.test/mypage"));
    expect(smsReturnDestination()).toBe("/mypage");
  });
});

describe("signup and post-authentication navigation", () => {
  it("keeps the normal registration notice login link and existing resend destination", async () => {
    const client = authClient({
      getCurrentSession: vi.fn().mockResolvedValue(response(anonymous)),
      resendEmailVerification: vi.fn().mockResolvedValue(response({ status: "accepted" })),
    });
    render(<SessionProvider client={client}><RegisterForm /></SessionProvider>);
    for (const [label, value] of [["氏名", "登録テスト"], ["生年月日", "2000-01-01"], ["メールアドレス", "fixture@example.test"], ["パスワード", "fixture-password"]]) {
      fireEvent.change(screen.getByLabelText(label!), { target: { value } });
    }
    fireEvent.submit(screen.getByRole("button", { name: "新規登録" }).closest("form")!);
    expect(await screen.findByRole("heading", { name: "認証メールをご確認ください" })).toBeInTheDocument();
    expect(client.register).toHaveBeenCalledExactlyOnceWith({ full_name: "登録テスト", birth_date: "2000-01-01", email: "fixture@example.test", password: "fixture-password", redirect_path: "/mypage" });
    expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute("href", "/login");
    expect(screen.getByText("メールに記載されたリンクを開くと登録が完了します。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "認証メールを再送" }));
    await waitFor(() => expect(client.resendEmailVerification).toHaveBeenCalledExactlyOnceWith({
      user_id: PUBLIC_AUTH_FIXTURE.pending_registration.user_id, redirect_path: "/",
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("認証メールの再送を受け付けました。");
    expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute("href", "/login");
  });

  it.each([false, true])("keeps the normal verify-email page login link (pending user=%s)", async (withUser) => {
    const client = authClient({ getCurrentSession: vi.fn().mockResolvedValue(response(anonymous)) });
    const page = await VerifyEmailPage({ searchParams: Promise.resolve(withUser ? { user_id: PUBLIC_AUTH_FIXTURE.pending_registration.user_id } : {}) });
    await act(async () => { render(<SessionProvider client={client}>{page}</SessionProvider>); });
    expect(screen.getByRole("heading", { name: "認証メールをご確認ください" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute("href", "/login");
    if (withUser) expect(screen.getByRole("button", { name: "認証メールを再送" })).toBeInTheDocument();
    else expect(screen.getByText("再送が必要な場合は、登録手続きをもう一度開いてください。")).toBeInTheDocument();
  });

  it("submits four required fields unchanged and displays Backend age/date validation", async () => {
    const register = vi.fn().mockRejectedValue(new ApiProblemError({
      code: "INVALID_REQUEST", status: 422, title: "Invalid input", type: "https://storefront.test/problems/input",
      request_id: "fixture", retryable: false, errors: { birth_date: ["18歳以上の生年月日を入力してください。"], full_name: ["氏名を確認してください。"] },
    }));
    render(<SessionProvider client={authClient({ getCurrentSession: vi.fn().mockResolvedValue(response(anonymous)), register })}><RegisterForm /></SessionProvider>);
    expect(screen.getByText("すでにアカウントをお持ちの方は")).toHaveClass("auth-form__alternate");
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/login");
    for (const [label, value] of [["氏名", "登録テスト"], ["生年月日", "2008-10-12"], ["メールアドレス", "fixture@example.test"], ["パスワード", "fixture-password"]]) {
      const input = screen.getByLabelText(label!);
      expect(input).toBeRequired();
      fireEvent.change(input, { target: { value } });
    }
    expect(screen.getByLabelText("生年月日")).toHaveAttribute("type", "date");
    fireEvent.submit(screen.getByRole("button", { name: "新規登録" }).closest("form")!);
    expect(register).toHaveBeenCalledWith({ full_name: "登録テスト", birth_date: "2008-10-12", email: "fixture@example.test", password: "fixture-password", redirect_path: "/mypage" });
    await screen.findByText("18歳以上の生年月日を入力してください。");
    expect(screen.getByText("氏名を確認してください。")).toBeInTheDocument();
  });

  it.each([[false, undefined, smsVerificationRoute], [true, undefined, "/mypage"], [false, "/contact?inquiry_id=fixture", "/contact?inquiry_id=fixture"], [false, "//evil.test", smsVerificationRoute]] as const)(
    "checks SMS after login (verified=%s, return=%s)", async (isVerified, returnTo, destination) => {
      const client = authClient({ getCurrentSession: vi.fn().mockResolvedValueOnce(response(anonymous)).mockResolvedValue(response(authenticated)), getSmsVerificationStatus: vi.fn().mockResolvedValue(response(isVerified ? verified : unverified)) });
      render(<SessionProvider client={client}><LoginForm returnTo={returnTo} /></SessionProvider>);
      fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "fixture@example.test" } });
      fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "fixture-password" } });
      fireEvent.submit(screen.getByRole("button", { name: "ログイン" }).closest("form")!);
      await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(destination));
    },
  );

  it("redirects to SMS only after email verification and Session confirmation", async () => {
    const client = authClient({ getSmsVerificationStatus: vi.fn().mockResolvedValue(response(unverified)) });
    render(<SessionProvider client={client}><EmailVerificationCompletion userId={authenticated.user!.id} hash={"b".repeat(64)} /></SessionProvider>);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(smsVerificationRoute));
    expect(client.completeEmailVerification).toHaveBeenCalledOnce();
    expect(client.getCurrentSession).toHaveBeenCalledTimes(2);
  });
});
