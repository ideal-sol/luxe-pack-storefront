import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import { vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import { EmailVerificationCompletion, EmailVerificationNotice } from "@/components/auth/verification";
import { ToastProvider } from "@/components/common/toast-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { PointClientProvider } from "@/components/points/point-client-provider";
import type { AuthClientAdapter, AuthSession } from "@/lib/platform";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace }),
}));

const anonymous: AuthSession = { authenticated: false, user: null };
const authenticated: AuthSession = {
  authenticated: true,
  user: {
    email_verified: true,
    id: "0198a001-0000-7000-8000-000000000501",
    state: "active",
  },
};
const metadata = { idempotency_replayed: false, status: 200 } as const;

function response<T>(data: T, status = 200) {
  return { data, metadata: { ...metadata, status } };
}

function client(overrides: Partial<AuthClientAdapter> = {}): AuthClientAdapter {
  return {
    completeEmailVerification: vi.fn().mockResolvedValue(response(authenticated)),
    getCurrentSession: vi.fn().mockResolvedValue(response(anonymous)),
    login: vi.fn().mockResolvedValue(response(authenticated)),
    logout: vi.fn().mockResolvedValue(response(undefined, 204)),
    register: vi.fn().mockResolvedValue(response({ status: "pending_verification", user_id: "0198a001-0000-7000-8000-000000000502" }, 202)),
    resendEmailVerification: vi.fn().mockResolvedValue(response({ status: "accepted" }, 202)),
    ...overrides,
  } as AuthClientAdapter;
}

function Probe() {
  const { refreshSession, state } = useSession();
  return (
    <div>
      <output>{state.status}</output>
      <button onClick={() => void refreshSession()} type="button">refresh</button>
    </div>
  );
}

function renderSession(ui: React.ReactNode, authClient: AuthClientAdapter | null) {
  return render(
    <ToastProvider>
      <SessionProvider client={authClient}>
        <PointClientProvider client={null}>{ui}</PointClientProvider>
      </SessionProvider>
    </ToastProvider>,
  );
}

describe("session foundation", () => {
  it("distinguishes loading, authenticated, unauthenticated, expired, and missing configuration", async () => {
    let resolveSession: ((value: ReturnType<typeof response<AuthSession>>) => void) | undefined;
    const pending = new Promise<ReturnType<typeof response<AuthSession>>>((resolve) => { resolveSession = resolve; });
    const loadingClient = client({ getCurrentSession: vi.fn(() => pending) });
    const loadingView = renderSession(<Probe />, loadingClient);
    expect(screen.getByText("loading")).toBeInTheDocument();
    resolveSession?.(response(authenticated));
    await screen.findByText("authenticated");
    loadingView.unmount();

    const anonymousView = renderSession(<Probe />, client());
    await screen.findByText("unauthenticated");
    anonymousView.unmount();

    const expired = new ApiProblemError({
      code: "SESSION_EXPIRED",
      request_id: "request-session-expired",
      retryable: false,
      status: 401,
      title: "Session expired",
      type: "https://storefront.test/problems/session-expired",
    });
    const expiredView = renderSession(<Probe />, client({ getCurrentSession: vi.fn().mockRejectedValue(expired) }));
    await screen.findByText("session-expired");
    expiredView.unmount();

    renderSession(<Probe />, null);
    expect(screen.getByText("configuration-unavailable")).toBeInTheDocument();
  });

  it("refreshes the session after login and supports an explicit refresh", async () => {
    const getCurrentSession = vi.fn()
      .mockResolvedValueOnce(response(anonymous))
      .mockResolvedValue(response(authenticated));
    const login = vi.fn().mockResolvedValue(response(authenticated));
    const authClient = client({ getCurrentSession, login });
    renderSession(<><LoginForm /><Probe /></>, authClient);
    await screen.findByText("unauthenticated");

    fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "fixture@example.test" } });
    const password = screen.getByLabelText("パスワード");
    fireEvent.change(password, { target: { value: "fixture-password" } });
    expect(password).not.toHaveAttribute("value");
    fireEvent.submit(screen.getByRole("button", { name: "ログイン" }).closest("form")!);

    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    await screen.findByText("authenticated");
    expect(replace).toHaveBeenCalledWith("/mypage");
    fireEvent.click(screen.getByRole("button", { name: "refresh" }));
    await waitFor(() => expect(getCurrentSession).toHaveBeenCalledTimes(3));
  });
});

describe("authentication UI", () => {
  it("switches Header authentication controls and logs out once", async () => {
    const logout = vi.fn().mockResolvedValue(response(undefined, 204));
    const authClient = client({ getCurrentSession: vi.fn().mockResolvedValue(response(authenticated)), logout });
    renderSession(<SiteHeader />, authClient);
    await screen.findAllByText("マイページ");
    expect(screen.getAllByLabelText("コイン残高")).toHaveLength(2);
    expect(screen.getAllByLabelText("コイン残高")[0]).toHaveTextContent("--");
    const logoutButtons = screen.getAllByRole("button", { name: "ログアウト" });
    fireEvent.click(logoutButtons[0]!);
    fireEvent.click(logoutButtons[0]!);
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    await screen.findAllByRole("link", { name: "ログイン" });
  });

  it("shows field Problem Details on registration and prevents duplicate submit", async () => {
    let rejectRegistration: ((error: unknown) => void) | undefined;
    const pending = new Promise<never>((_, reject) => { rejectRegistration = reject; });
    const register = vi.fn(() => pending);
    renderSession(<RegisterForm />, client({ register }));
    await waitFor(() => expect(screen.getByRole("button", { name: "新規登録" })).toBeEnabled());
    fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "fixture@example.test" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "fixture-password" } });
    const form = screen.getByRole("button", { name: "新規登録" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(register).toHaveBeenCalledTimes(1);
    rejectRegistration?.(new ApiProblemError({
      code: "INVALID_REQUEST",
      errors: { email: ["メールアドレスを確認してください。"] },
      request_id: "request-registration",
      retryable: false,
      status: 422,
      title: "Invalid request",
      type: "https://storefront.test/problems/invalid-request",
    }));
    expect(await screen.findByText("メールアドレスを確認してください。")).toBeInTheDocument();
  });

  it("renders registration success and verification resend success and failure", async () => {
    const userId = "0198a001-0000-7000-8000-000000000502";
    const resendEmailVerification = vi.fn()
      .mockResolvedValueOnce(response({ status: "accepted" }, 202))
      .mockRejectedValueOnce(new ApiProblemError({
        code: "RATE_LIMITED",
        request_id: "request-resend",
        retryable: false,
        status: 429,
        title: "Rate limited",
        type: "https://storefront.test/problems/rate-limited",
      }));
    const view = renderSession(<EmailVerificationNotice userId={userId} />, client({ resendEmailVerification }));
    await screen.findByText("認証メールをご確認ください");
    fireEvent.click(screen.getByRole("button", { name: "認証メールを再送" }));
    await screen.findByText("認証メールの再送を受け付けました。");
    fireEvent.click(screen.getByRole("button", { name: "認証メールを再送" }));
    await screen.findByText(/操作回数が上限/);
    view.unmount();

    renderSession(<RegisterForm />, client());
    await waitFor(() => expect(screen.getByRole("button", { name: "新規登録" })).toBeEnabled());
    fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: "fixture@example.test" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "fixture-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "新規登録" }).closest("form")!);
    await screen.findByText("認証メールをご確認ください");
  });

  it("completes email verification once and refreshes the session", async () => {
    const completeEmailVerification = vi.fn().mockResolvedValue(response(authenticated));
    const getCurrentSession = vi.fn().mockResolvedValue(response(authenticated));
    renderSession(
      <EmailVerificationCompletion hash={"b".repeat(64)} userId="0198a001-0000-7000-8000-000000000502" />,
      client({ completeEmailVerification, getCurrentSession }),
    );
    await screen.findByText("メール認証が完了しました");
    expect(completeEmailVerification).toHaveBeenCalledTimes(1);
    expect(getCurrentSession).toHaveBeenCalledTimes(2);
  });

  it("renders a safe typed error when email verification fails", async () => {
    const completeEmailVerification = vi.fn().mockRejectedValue(new ApiProblemError({
      code: "VERIFICATION_LINK_EXPIRED",
      request_id: "request-verification-expired",
      retryable: false,
      status: 410,
      title: "Verification link expired",
      type: "https://storefront.test/problems/verification-link-expired",
    }));
    renderSession(
      <EmailVerificationCompletion hash={"c".repeat(64)} userId="0198a001-0000-7000-8000-000000000502" />,
      client({ completeEmailVerification }),
    );
    await screen.findByText("メール認証を完了できませんでした");
    expect(screen.getByRole("alert")).toHaveTextContent("有効期限が切れています");
    expect(completeEmailVerification).toHaveBeenCalledTimes(1);
  });
});
