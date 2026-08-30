import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  PUBLIC_ACCOUNT_SECURITY_FIXTURE,
  PUBLIC_AUTH_FIXTURE,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { AccountSecurityLinkRouter } from "@/components/account-security/account-security-link-router";
import { EmailChangeCompletion, EmailChangeRequestForm } from "@/components/account-security/email-change";
import { PasswordChangeForm } from "@/components/account-security/password-change";
import { PasswordResetConfirmForm, PasswordResetRequestForm } from "@/components/account-security/password-reset";
import { LoginForm } from "@/components/auth/login-form";
import { SessionProvider } from "@/components/auth/session-provider";
import { ToastProvider } from "@/components/common/toast-provider";
import {
  presentAccountSecurityProblem,
  type AuthClientAdapter,
  type AuthSession,
} from "@/lib/platform";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace }),
}));

const authenticated = PUBLIC_AUTH_FIXTURE.authenticated_session as AuthSession;
const anonymous = PUBLIC_AUTH_FIXTURE.anonymous_session as AuthSession;
const metadata = { idempotency_replayed: false, status: 200 } as const;

function response<T>(data: T, status = 200) {
  return { data, metadata: { ...metadata, status } };
}

function problem(code: string, status = 422, errors?: Record<string, string[]>) {
  return new ApiProblemError({
    code,
    ...(errors ? { errors } : {}),
    request_id: "request-account-security-ui",
    retryable: false,
    status,
    title: "Account security request rejected",
    type: "https://storefront.test/problems/account-security",
  });
}

function client(
  session: AuthSession = authenticated,
  overrides: Partial<AuthClientAdapter> = {},
): AuthClientAdapter {
  return {
    changeUserPassword: vi.fn().mockResolvedValue(response(PUBLIC_ACCOUNT_SECURITY_FIXTURE.password_changed)),
    completeEmailChange: vi.fn().mockResolvedValue(response(PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_completed_same_browser)),
    completeEmailVerification: vi.fn(),
    confirmPasswordReset: vi.fn().mockResolvedValue(response(PUBLIC_ACCOUNT_SECURITY_FIXTURE.password_reset_completed)),
    createEmailChangeRequest: vi.fn().mockResolvedValue(response(PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_pending, 202)),
    getCurrentSession: vi.fn().mockResolvedValue(response(session)),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    requestPasswordReset: vi.fn().mockResolvedValue(response({
      message: "If the account is eligible, password reset instructions will be sent.",
      status: "accepted",
    }, 202)),
    resendEmailVerification: vi.fn(),
    ...overrides,
  } as AuthClientAdapter;
}

function renderSession(ui: React.ReactNode, authClient: AuthClientAdapter) {
  return render(
    <ToastProvider>
      <SessionProvider client={authClient}>{ui}</SessionProvider>
    </ToastProvider>,
  );
}

function fillNewPassword(password = "new-fixture-password") {
  fireEvent.change(screen.getByLabelText("新しいパスワード"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("新しいパスワード確認"), { target: { value: password } });
}

beforeEach(() => {
  replace.mockReset();
  window.history.replaceState({}, "", "/");
});

describe("Account Security entry and Password Reset", () => {
  it("places the forgot-password link immediately above registration and presents one-time reset success", async () => {
    window.history.replaceState({}, "", "/login?password-updated=1");
    renderSession(<LoginForm passwordUpdated />, client(anonymous));
    const form = screen.getByRole("button", { name: "ログイン" }).closest("form")!;
    const links = Array.from(form.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/password-reset", "/register"]);
    expect(links[0]).toHaveTextContent("パスワードを忘れた方はこちら");
    expect(screen.getByRole("status")).toHaveTextContent("パスワードを更新しました");
    expect(screen.getByRole("status")).toHaveTextContent("新しいパスワードでログインしてください");
    expect(window.location.pathname).toBe("/login");
    expect(window.location.search).toBe("");
  });

  it("validates obvious email errors, prevents duplicate submit, and shows enumeration-safe acceptance", async () => {
    type ResetResponse = Awaited<ReturnType<AuthClientAdapter["requestPasswordReset"]>>;
    let completeRequest: ((value: ResetResponse) => void) | undefined;
    const pending = new Promise<ResetResponse>((resolve) => { completeRequest = resolve; });
    const requestPasswordReset: AuthClientAdapter["requestPasswordReset"] = vi.fn(() => pending);
    renderSession(<PasswordResetRequestForm />, client(anonymous, { requestPasswordReset }));

    fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "invalid-email" } });
    fireEvent.submit(screen.getByRole("button", { name: "送信" }).closest("form")!);
    expect(await screen.findByText("メールアドレスの形式を確認してください。")).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "fixture@example.test" } });
    const form = screen.getByRole("button", { name: "送信" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(requestPasswordReset).toHaveBeenCalledWith({ email: "fixture@example.test", redirect_path: "/" }, {});
    expect(screen.getByRole("button", { name: "送信中…" })).toBeDisabled();
    completeRequest?.(response({
      message: "If the account is eligible, password reset instructions will be sent." as const,
      status: "accepted" as const,
    }, 202));
    expect(await screen.findByText("パスワード再設定を受け付けました。")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("ご登録状況に問題がない場合");
    expect(screen.getByRole("status")).not.toHaveTextContent(/不存在|suspended|unverified|closed|anonymized/i);
  });

  it("shares accessible password controls, blocks mismatch, and never refreshes into an automatic login", async () => {
    const confirmPasswordReset = vi.fn().mockResolvedValue(response(PUBLIC_ACCOUNT_SECURITY_FIXTURE.password_reset_completed));
    const getCurrentSession = vi.fn().mockResolvedValue(response(authenticated));
    renderSession(
      <PasswordResetConfirmForm token={"b".repeat(64)} userId={PUBLIC_AUTH_FIXTURE.pending_registration.user_id} />,
      client(authenticated, { confirmPasswordReset, getCurrentSession }),
    );
    await waitFor(() => expect(getCurrentSession).toHaveBeenCalledTimes(1));

    const newPassword = screen.getByLabelText("新しいパスワード");
    expect(newPassword).toHaveAttribute("autocomplete", "new-password");
    fireEvent.click(screen.getByRole("button", { name: "新しいパスワードを表示" }));
    expect(newPassword).toHaveAttribute("type", "text");
    fireEvent.change(newPassword, { target: { value: "new-fixture-password" } });
    fireEvent.change(screen.getByLabelText("新しいパスワード確認"), { target: { value: "different-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "パスワード更新" }).closest("form")!);
    expect(screen.getByText("新しいパスワードが一致しません。")).toBeInTheDocument();
    expect(confirmPasswordReset).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("新しいパスワード確認"), { target: { value: "new-fixture-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "パスワード更新" }).closest("form")!);
    await waitFor(() => expect(confirmPasswordReset).toHaveBeenCalledTimes(1));
    expect(confirmPasswordReset).toHaveBeenCalledWith({
      password: "new-fixture-password",
      token: "b".repeat(64),
      user_id: PUBLIC_AUTH_FIXTURE.pending_registration.user_id,
    }, {});
    expect(getCurrentSession).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login?password-updated=1");
  });

  it("collapses invalid, expired, used, and malformed reset outcomes into one public UI", async () => {
    const confirmPasswordReset = vi.fn().mockRejectedValue(problem("INVALID_PASSWORD_RESET", 410));
    renderSession(
      <PasswordResetConfirmForm token={"c".repeat(64)} userId={PUBLIC_AUTH_FIXTURE.pending_registration.user_id} />,
      client(anonymous, { confirmPasswordReset }),
    );
    fillNewPassword();
    fireEvent.submit(screen.getByRole("button", { name: "パスワード更新" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("無効または有効期限が切れています");
    expect(screen.getByRole("link", { name: "パスワード再設定へ" })).toHaveAttribute("href", "/password-reset");
    expect(screen.queryByText("INVALID_PASSWORD_RESET")).not.toBeInTheDocument();
  });
});

describe("Email Address Change", () => {
  it("requests verification without Password or Fresh Auth fields and maps duplicate email safely", async () => {
    const createEmailChangeRequest = vi.fn()
      .mockRejectedValueOnce(problem("EMAIL_ALREADY_CLAIMED", 409))
      .mockResolvedValueOnce(response(PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_pending, 202));
    renderSession(<EmailChangeRequestForm />, client(authenticated, { createEmailChangeRequest }));
    await screen.findByLabelText("新しいメールアドレス");
    expect(screen.queryByLabelText(/現在のパスワード/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fresh Authentication|再認証/)).not.toBeInTheDocument();

    const form = screen.getByRole("button", { name: "送信" }).closest("form")!;
    fireEvent.change(screen.getByLabelText("新しいメールアドレス"), { target: { value: "claimed@example.test" } });
    fireEvent.submit(form);
    expect(await screen.findByText(/すでに使用されています/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("新しいメールアドレス"), { target: { value: "changed@example.test" } });
    fireEvent.submit(form);
    expect(await screen.findByText("確認メールを送信しました")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("メール内のリンクからメールアドレス変更を完了してください");
    expect(createEmailChangeRequest).toHaveBeenLastCalledWith({ email: "changed@example.test", redirect_path: "/" }, {});
  });

  it("refreshes the rotated Session after same-browser completion before returning to My Page", async () => {
    const completeEmailChange = vi.fn().mockResolvedValue(response(PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_completed_same_browser));
    const getCurrentSession = vi.fn().mockResolvedValue(response(authenticated));
    renderSession(
      <EmailChangeCompletion requestId={PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_pending.request_id} token={"d".repeat(64)} />,
      client(authenticated, { completeEmailChange, getCurrentSession }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/mypage?account-updated=email"));
    expect(completeEmailChange).toHaveBeenCalledTimes(1);
    expect(getCurrentSession).toHaveBeenCalledTimes(2);
  });

  it("completes cross-browser while logged out without Session refresh or automatic login", async () => {
    const completeEmailChange = vi.fn().mockResolvedValue(response(PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_completed_cross_browser));
    const getCurrentSession = vi.fn().mockResolvedValue(response(anonymous));
    renderSession(
      <EmailChangeCompletion requestId={PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_pending.request_id} token={"e".repeat(64)} />,
      client(anonymous, { completeEmailChange, getCurrentSession }),
    );
    expect(await screen.findByText("メールアドレスを変更しました。")).toBeInTheDocument();
    expect(screen.getByText(/自動ログインを行いません/)).toBeInTheDocument();
    expect(getCurrentSession).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "ログインする" })).toHaveAttribute("href", "/login");
  });

  it("shows one common invalid-link presentation without leaking the Problem code", async () => {
    const completeEmailChange = vi.fn().mockRejectedValue(problem("INVALID_EMAIL_CHANGE_REQUEST", 410));
    renderSession(
      <EmailChangeCompletion requestId={PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_pending.request_id} token={"f".repeat(64)} />,
      client(anonymous, { completeEmailChange }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("無効または有効期限が切れています");
    expect(screen.queryByText("INVALID_EMAIL_CHANGE_REQUEST")).not.toBeInTheDocument();
  });
});

describe("Password Change", () => {
  it("requires current/new/confirmation, blocks mismatch, and exposes correct autocomplete", async () => {
    const changeUserPassword = vi.fn();
    renderSession(<PasswordChangeForm />, client(authenticated, { changeUserPassword }));
    const current = await screen.findByLabelText("現在のパスワード");
    expect(current).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("新しいパスワード")).toHaveAttribute("autocomplete", "new-password");
    fireEvent.change(current, { target: { value: "current-fixture-password" } });
    fireEvent.change(screen.getByLabelText("新しいパスワード"), { target: { value: "new-fixture-password" } });
    fireEvent.change(screen.getByLabelText("新しいパスワード確認"), { target: { value: "different-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "更新" }).closest("form")!);
    expect(screen.getByText("新しいパスワードが一致しません。")).toBeInTheDocument();
    expect(changeUserPassword).not.toHaveBeenCalled();
    expect(screen.queryByText(/認証メール|確認リンク/)).not.toBeInTheDocument();
  });

  it.each([
    ["INVALID_REAUTHENTICATION", "現在のパスワードを確認してください。"],
    ["PASSWORD_UNCHANGED", "現在と異なるパスワード"],
    ["PASSWORD_POLICY_VIOLATION", "セキュリティ要件"],
  ])("maps %s without exposing internal codes", async (code, message) => {
    const changeUserPassword = vi.fn().mockRejectedValue(problem(code, code === "INVALID_REAUTHENTICATION" ? 401 : 422));
    const view = renderSession(<PasswordChangeForm />, client(authenticated, { changeUserPassword }));
    fireEvent.change(await screen.findByLabelText("現在のパスワード"), { target: { value: "current-fixture-password" } });
    fillNewPassword();
    fireEvent.submit(screen.getByRole("button", { name: "更新" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText(code)).not.toBeInTheDocument();
    view.unmount();
  });

  it("updates immediately, refreshes rotated Session/CSRF state, and returns to My Page once", async () => {
    type PasswordChangeResponse = Awaited<ReturnType<AuthClientAdapter["changeUserPassword"]>>;
    let finishChange: ((value: PasswordChangeResponse) => void) | undefined;
    const pending = new Promise<PasswordChangeResponse>((resolve) => { finishChange = resolve; });
    const changeUserPassword: AuthClientAdapter["changeUserPassword"] = vi.fn(() => pending);
    const getCurrentSession = vi.fn().mockResolvedValue(response(authenticated));
    renderSession(<PasswordChangeForm />, client(authenticated, { changeUserPassword, getCurrentSession }));
    fireEvent.change(await screen.findByLabelText("現在のパスワード"), { target: { value: "current-fixture-password" } });
    fillNewPassword();
    const form = screen.getByRole("button", { name: "更新" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(changeUserPassword).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "更新中…" })).toBeDisabled();
    finishChange?.(response(PUBLIC_ACCOUNT_SECURITY_FIXTURE.password_changed));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/mypage?account-updated=password"));
    expect(changeUserPassword).toHaveBeenCalledWith({
      current_password: "current-fixture-password",
      new_password: "new-fixture-password",
    }, {});
    expect(getCurrentSession).toHaveBeenCalledTimes(2);
  });
});

describe("sensitive link routing", () => {
  it("scrubs a reset token before rendering the confirm form and never exposes it in the DOM", async () => {
    const token = "a".repeat(64);
    window.history.replaceState({}, "", `/password-reset/confirm#account_security=password-reset&password_reset_user_id=${PUBLIC_AUTH_FIXTURE.pending_registration.user_id}&token=${token}`);
    renderSession(<StrictMode><AccountSecurityLinkRouter expectedKind="password-reset" /></StrictMode>, client(anonymous));
    expect(await screen.findByRole("button", { name: "パスワード更新" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/password-reset/confirm");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
    expect(JSON.stringify(window.history.state)).not.toContain(token);
    expect(document.body).not.toHaveTextContent(token);
  });

  it("scrubs and consumes an email token once in a logged-out context", async () => {
    const token = "b".repeat(64);
    const requestId = PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_pending.request_id;
    const completeEmailChange = vi.fn().mockResolvedValue(response(PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_completed_cross_browser));
    window.history.replaceState({}, "", `/email-change/verify#account_security=email-change&email_change_request_id=${requestId}&token=${token}`);
    renderSession(<StrictMode><AccountSecurityLinkRouter expectedKind="email-change" /></StrictMode>, client(anonymous, { completeEmailChange }));
    expect(await screen.findByText("メールアドレスを変更しました。")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/email-change/verify");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
    expect(JSON.stringify(window.history.state)).not.toContain(token);
    expect(completeEmailChange).toHaveBeenCalledTimes(1);
    expect(completeEmailChange).toHaveBeenCalledWith({ request_id: requestId, token }, {});
    expect(document.body).not.toHaveTextContent(token);
  });

  it("rejects malformed or ambiguous link input without calling Platform", async () => {
    const authClient = client(anonymous);
    window.history.replaceState({}, "", "/password-reset/confirm#account_security=email-change&password_reset_user_id=malformed&email_change_request_id=also-malformed&token=raw-token");
    renderSession(<AccountSecurityLinkRouter expectedKind="password-reset" />, authClient);
    expect(await screen.findByRole("alert")).toHaveTextContent("パスワード再設定リンク");
    expect(authClient.confirmPasswordReset).not.toHaveBeenCalled();
    expect(authClient.completeEmailChange).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
    expect(within(document.body).queryByText("raw-token")).not.toBeInTheDocument();
  });
});

describe("typed Account Security Problem presentation", () => {
  it.each([
    ["AUTHENTICATION_REQUIRED", 401, "もう一度ログイン"],
    ["SESSION_EXPIRED", 401, "もう一度ログイン"],
    ["CSRF_TOKEN_MISMATCH", 419, "ページを再読み込み"],
    ["RATE_LIMITED", 429, "操作回数が上限"],
    ["AUTH_SERVICE_UNAVAILABLE", 503, "認証サービスを利用できません"],
    ["INVALID_REQUEST", 422, "入力内容を確認"],
  ])("maps %s to safe copy", (code, status, copy) => {
    const presented = presentAccountSecurityProblem(problem(code, status), "password-change");
    expect(presented.message).toContain(copy);
    expect(presented.message).not.toContain(code);
    expect(presented.authenticationRequired).toBe(
      code === "AUTHENTICATION_REQUIRED" || code === "SESSION_EXPIRED",
    );
  });
});
