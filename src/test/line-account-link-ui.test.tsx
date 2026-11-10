import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_EXTERNAL_IDENTITY_FIXTURE,
  PUBLIC_LINE_FRIEND_STATE_FIXTURES,
  PUBLIC_LINE_FRIEND_STATE_PROBLEM_FIXTURES,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { StrictMode } from "react";
import { ExternalIdentityClientProvider } from "@/components/account/external-identity-client-provider";
import { LineAccountLink } from "@/components/account/line-account-link";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import type {
  AuthClientAdapter,
  AuthSession,
  ExternalIdentityAdapter,
  LineFriendState,
} from "@/lib/platform";
import {
  accountNavigation,
  lineAccountRoute,
  myPageAccountNavigation,
  publicRoutes,
} from "@/lib/routes/navigation";

const metadata = { idempotency_replayed: false, status: 200 } as const;

function response<T>(data: T) {
  return { data, metadata };
}

function authClient(session: AuthSession = PUBLIC_AUTH_FIXTURE.authenticated_session): AuthClientAdapter {
  return {
    changeUserPassword: vi.fn(),
    preRegister: vi.fn(),
    getPreRegistrationCampaign: vi.fn(),
    getPreRegistrationBonus: vi.fn(),
    completeEmailChange: vi.fn(),
    completeEmailVerification: vi.fn(),
    confirmPasswordReset: vi.fn(),
    createEmailChangeRequest: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue(response(session)),
    getSmsVerificationStatus: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    reauthenticateUserPassword: vi.fn(),
    requestPasswordReset: vi.fn(),
    resendEmailVerification: vi.fn(),
    resendSmsVerification: vi.fn(),
    sendSmsVerification: vi.fn(),
    verifySmsCode: vi.fn(),
  } as AuthClientAdapter;
}

function identityClient(overrides: Partial<ExternalIdentityAdapter> = {}): ExternalIdentityAdapter {
  return {
    completeLineLogin: vi.fn(),
    getLineFriendState: vi.fn().mockResolvedValue(response(PUBLIC_LINE_FRIEND_STATE_FIXTURES.unlinked)),
    listExternalIdentities: vi.fn().mockResolvedValue(response({ items: [] })),
    startLineIdentityLink: vi.fn().mockResolvedValue(response(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start)),
    startLineReauthentication: vi.fn(),
    unlinkLineIdentity: vi.fn(),
    ...overrides,
  } as ExternalIdentityAdapter;
}

function renderLine(
  externalClient: ExternalIdentityAdapter | null = identityClient(),
  sessionClient: AuthClientAdapter | null = authClient(),
  navigate = vi.fn(),
) {
  return {
    navigate,
    ...render(
      <SessionProvider client={sessionClient}>
        <ExternalIdentityClientProvider client={externalClient}>
          <LineAccountLink navigate={navigate} />
        </ExternalIdentityClientProvider>
      </SessionProvider>,
    ),
  };
}

function RefreshSessionButton() {
  const { refreshSession } = useSession();
  return <button onClick={() => void refreshSession()} type="button">Session再取得</button>;
}

describe("LINE account link UI", () => {
  function stateClient(state: LineFriendState, overrides: Partial<ExternalIdentityAdapter> = {}) {
    return identityClient({
      getLineFriendState: vi.fn().mockResolvedValue(response(state)),
      listExternalIdentities: vi.fn().mockResolvedValue(response(state.linked ? PUBLIC_EXTERNAL_IDENTITY_FIXTURE.linked : { items: [] })),
      ...overrides,
    });
  }

  it("reads fresh presentation after Session refresh instead of reusing a consumed callback", async () => {
    const externalClient = stateClient({ ...PUBLIC_LINE_FRIEND_STATE_FIXTURES.confirmed, callback_result: "reward_apply_failed" });
    const sessionClient = authClient();
    render(<SessionProvider client={sessionClient}><ExternalIdentityClientProvider client={externalClient}><RefreshSessionButton /><LineAccountLink /></ExternalIdentityClientProvider></SessionProvider>);
    const message = "LINE特典を反映できませんでした。もう一度お試しください。";
    expect(await screen.findByText(message)).toBeInTheDocument();
    let resolveFriendState!: (value: ReturnType<typeof response<LineFriendState>>) => void;
    vi.mocked(externalClient.getLineFriendState).mockImplementationOnce(() => new Promise(resolve => { resolveFriendState = resolve; }));
    let resolveSession!: (value: ReturnType<typeof response<AuthSession>>) => void;
    vi.mocked(sessionClient.getCurrentSession).mockImplementationOnce(() => new Promise(resolve => { resolveSession = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Session再取得" }));
    await screen.findByText("LINE連携状態を確認中");
    resolveSession(response(PUBLIC_AUTH_FIXTURE.authenticated_session));
    await waitFor(() => expect(externalClient.getLineFriendState).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    expect(screen.getByText("LINE連携状態を確認中")).toBeInTheDocument();
    resolveFriendState(response(PUBLIC_LINE_FRIEND_STATE_FIXTURES.confirmed));
    await screen.findByText("連携済み");
    await waitFor(() => expect(screen.queryByText(message)).not.toBeInTheDocument());
    expect(sessionClient.logout).not.toHaveBeenCalled();
  });

  it.each([
    [false, false, true, false, "LINEと連携して公式アカウントを友だち追加すると、条件を満たした方に750コインをプレゼントします。"],
    [true, false, true, false, "公式アカウントを友だち追加すると、条件を満たした方に750コインをプレゼントします。"],
    [true, true, true, false, "LINE連携・友だち追加が完了しています。条件を満たした方はLINE特典を受け取れます。"],
    [true, true, true, true, "友だち追加特典は受け取り済みです"],
    [true, false, false, true, "友だち追加特典は受け取り済みです"],
    [true, true, false, false, null],
    [true, false, false, false, null],
    [false, false, false, false, null],
  ] as const)("uses Platform reward presentation (linked %s / friend %s / enabled %s / granted %s)", async (linked, friend_confirmed, enabled, granted, message) => {
    const state: LineFriendState = {
      ...PUBLIC_LINE_FRIEND_STATE_FIXTURES.unlinked,
      linked, friend_confirmed,
      reward: { enabled, granted, point_amount: enabled ? 750 : null },
    };
    renderLine(stateClient(state));
    await screen.findByRole("heading", { name: state.status.label });
    if (message) expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByText(friend_confirmed ? "確認済み" : "未確認")).toBeInTheDocument();
    if (granted || !enabled) expect(document.body).not.toHaveTextContent(/750|500|コインをプレゼント/);
    expect(document.body).not.toHaveTextContent("現在のLINE連携・友だち追加済みです");
  });

  it.each([
    [PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required, true],
    [{ ...PUBLIC_LINE_FRIEND_STATE_FIXTURES.confirmed, reward: { enabled: true, granted: false, point_amount: 500 }, secondary_action: PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required.secondary_action }, true],
    [PUBLIC_LINE_FRIEND_STATE_FIXTURES.confirmed, false],
    [{ ...PUBLIC_LINE_FRIEND_STATE_FIXTURES.confirmed, reward: { enabled: false, granted: false, point_amount: null } }, false],
    [{ ...PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required, secondary_action: null }, false],
    [PUBLIC_LINE_FRIEND_STATE_FIXTURES.unlinked, false],
  ] as const)("uses secondary_action as the sole recheck authority (%#)", async (state, visible) => {
    renderLine(stateClient(state));
    await screen.findByRole("heading", { name: state.status.label });
    expect(Boolean(screen.queryByRole("button", { name: "友だち追加を確認する" }))).toBe(visible);
  });

  it("starts canonical reauthentication once, redirects and reads fresh state on return", async () => {
    let resolveStart!: (value: ReturnType<typeof response<typeof PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start>>) => void;
    const pending = new Promise<ReturnType<typeof response<typeof PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start>>>((resolve) => { resolveStart = resolve; });
    const startLineReauthentication = vi.fn(() => pending);
    const externalClient = stateClient(PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required, { startLineReauthentication });
    const view = renderLine(externalClient);
    const button = await screen.findByRole("button", { name: "友だち追加を確認する" });
    fireEvent.click(button); fireEvent.click(button);
    expect(startLineReauthentication).toHaveBeenCalledTimes(1);
    expect(startLineReauthentication).toHaveBeenCalledWith({ return_path: "/mypage/line" }, {});
    expect(button).toBeDisabled();
    resolveStart(response(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start));
    await waitFor(() => expect(view.navigate).toHaveBeenCalledWith(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start.authorization_url));
    expect(externalClient.startLineIdentityLink).not.toHaveBeenCalled();
    view.unmount();
    vi.mocked(externalClient.getLineFriendState).mockResolvedValue(response(PUBLIC_LINE_FRIEND_STATE_FIXTURES.confirmed));
    renderLine(externalClient);
    expect(await screen.findByText("友だち追加特典は受け取り済みです")).toBeInTheDocument();
    expect(externalClient.getLineFriendState).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "友だち追加を確認する" })).not.toBeInTheDocument();
  });

  it.each([
    ["friendship_check_failed", "友だち追加状態を確認できませんでした。もう一度お試しください。"],
    ["reward_apply_failed", "LINE特典を反映できませんでした。もう一度お試しください。"],
    ["line_auth_failed", "LINE認証を完了できませんでした。もう一度お試しください。"],
  ] as const)("renders %s once without losing the linked session", async (callback_result, message) => {
    const externalClient = stateClient({ ...PUBLIC_LINE_FRIEND_STATE_FIXTURES.confirmed, callback_result });
    const sessionClient = authClient();
    const view = render(<StrictMode><SessionProvider client={sessionClient}><ExternalIdentityClientProvider client={externalClient}><LineAccountLink /></ExternalIdentityClientProvider></SessionProvider></StrictMode>);
    expect(await screen.findAllByText(message)).toHaveLength(1);
    expect(screen.getByText("連携済み")).toBeInTheDocument();
    expect(externalClient.getLineFriendState).toHaveBeenCalledTimes(1);
    expect(sessionClient.logout).not.toHaveBeenCalled();
    view.unmount();
    vi.mocked(externalClient.getLineFriendState).mockResolvedValue(response(PUBLIC_LINE_FRIEND_STATE_FIXTURES.confirmed));
    renderLine(externalClient, sessionClient);
    await screen.findByText("連携済み");
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it.each(["javascript:alert(1)", "http://access.line.me/authorize", "//access.line.me/authorize", "https://user:pass@access.line.me/authorize"])("rejects unsafe reauthentication URL %s and allows retry", async (authorization_url) => {
    const startLineReauthentication = vi.fn().mockResolvedValue(response({ ...PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start, authorization_url }));
    const { navigate } = renderLine(stateClient({ ...PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required, callback_result: null }, { startLineReauthentication }));
    fireEvent.click(await screen.findByRole("button", { name: "友だち追加を確認する" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "友だち追加を確認する" })).toBeEnabled();
    expect(screen.getByText("連携済み")).toBeInTheDocument();
  });

  it("preserves the session and enables retry on a reauthentication error", async () => {
    const sessionClient = authClient();
    const startLineReauthentication = vi.fn().mockRejectedValue(new ApiProblemError(PUBLIC_LINE_FRIEND_STATE_PROBLEM_FIXTURES.session_expired));
    const { navigate } = renderLine(stateClient({ ...PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required, callback_result: null }, { startLineReauthentication }), sessionClient);
    fireEvent.click(await screen.findByRole("button", { name: "友だち追加を確認する" }));
    await screen.findByRole("alert");
    expect(navigate).not.toHaveBeenCalled();
    expect(sessionClient.logout).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "友だち追加を確認する" })).toBeEnabled();
  });

  it("renders the unlinked state and starts only the canonical LINE link transaction", async () => {
    const startLineIdentityLink = vi.fn().mockResolvedValue(response(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start));
    const externalClient = identityClient({ startLineIdentityLink });
    const { navigate } = renderLine(externalClient);

    expect(await screen.findByRole("heading", { name: PUBLIC_LINE_FRIEND_STATE_FIXTURES.unlinked.status.label })).toBeInTheDocument();
    expect(screen.queryByText(PUBLIC_LINE_FRIEND_STATE_FIXTURES.unlinked.status.code)).not.toBeInTheDocument();
    expect(screen.getByText("対象外")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: PUBLIC_LINE_FRIEND_STATE_FIXTURES.unlinked.primary_action.label }));
    await waitFor(() => expect(startLineIdentityLink).toHaveBeenCalledWith({ return_path: lineAccountRoute }, {}));
    expect(navigate).toHaveBeenCalledWith(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start.authorization_url);
    expect(externalClient.completeLineLogin).not.toHaveBeenCalled();
    expect(externalClient.unlinkLineIdentity).not.toHaveBeenCalled();
  });

  it("preserves the linked identity presentation while rendering the Backend friend state", async () => {
    renderLine(identityClient({
      getLineFriendState: vi.fn().mockResolvedValue(response(PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required)),
      listExternalIdentities: vi.fn().mockResolvedValue(response(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.linked)),
    }));
    expect(await screen.findByRole("heading", { name: PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required.status.label })).toBeInTheDocument();
    expect(screen.queryByText("現在のLINE連携・友だち追加済みです")).not.toBeInTheDocument();
    expect(screen.getByText("連携日時")).toBeInTheDocument();
    expect(screen.getByText("連携済み")).toBeInTheDocument();
    expect(screen.getByText("未確認")).toBeInTheDocument();
    expect(screen.getByText("対象外")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /解除/ })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("token");
    expect(document.body).not.toHaveTextContent("subject");
    expect(document.body).not.toHaveTextContent(/状態コード|LINE Identity|Callback|Storefront|Platform/);
    expect(screen.queryByRole("heading", { name: "連携について" })).not.toBeInTheDocument();
  });

  it("uses the Backend external action label and only a safe explicit HTTPS href", async () => {
    renderLine(identityClient({
      getLineFriendState: vi.fn().mockResolvedValue(response(PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required)),
      listExternalIdentities: vi.fn().mockResolvedValue(response(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.linked)),
    }));
    const link = await screen.findByRole("link", {
      name: PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required.primary_action.label,
    });
    expect(link).toHaveAttribute("href", PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required.primary_action.href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    const unsafe = {
      ...PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required,
      primary_action: {
        ...PUBLIC_LINE_FRIEND_STATE_FIXTURES.friend_add_required.primary_action,
        href: "javascript:alert(1)",
      },
    } as unknown as LineFriendState;
    const unsafeView = renderLine(identityClient({
      getLineFriendState: vi.fn().mockResolvedValue(response(unsafe)),
      listExternalIdentities: vi.fn().mockResolvedValue(response(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.linked)),
    }));
    await screen.findByRole("heading", { name: unsafe.status.label });
    expect(unsafeView.container.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it("renders the confirmed Backend LINE-user state without inventing an action", async () => {
    const { container } = renderLine(identityClient({
      getLineFriendState: vi.fn().mockResolvedValue(response(PUBLIC_LINE_FRIEND_STATE_FIXTURES.confirmed)),
      listExternalIdentities: vi.fn().mockResolvedValue(response(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.linked)),
    }));
    expect(await screen.findByRole("heading", { name: PUBLIC_LINE_FRIEND_STATE_FIXTURES.confirmed.status.label })).toBeInTheDocument();
    expect(screen.getByText("確認済み")).toBeInTheDocument();
    expect(screen.getByText("対象")).toBeInTheDocument();
    expect(container.querySelector('[data-is-line-user="true"]')).not.toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /友だち追加|連携する/ })).not.toBeInTheDocument();
  });

  it("suppresses unknown action codes and reports Identity/Friend State contradictions safely", async () => {
    const unknown = {
      ...PUBLIC_LINE_FRIEND_STATE_FIXTURES.unlinked,
      primary_action: { code: "future_action", href: "https://example.test/unsafe-fallback", label: "危険なFallback" },
    } as unknown as LineFriendState;
    const unknownView = renderLine(identityClient({
      getLineFriendState: vi.fn().mockResolvedValue(response(unknown)),
    }));
    await screen.findByRole("heading", { name: unknown.status.label });
    expect(screen.queryByText("危険なFallback")).not.toBeInTheDocument();
    expect(unknownView.container.querySelector('a[href="https://example.test/unsafe-fallback"]')).toBeNull();
    unknownView.unmount();

    renderLine(identityClient({
      getLineFriendState: vi.fn().mockResolvedValue(response(PUBLIC_LINE_FRIEND_STATE_FIXTURES.confirmed)),
      listExternalIdentities: vi.fn().mockResolvedValue(response({ items: [] })),
    }));
    expect(await screen.findByRole("heading", { name: "LINE連携を確認できませんでした" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/CONTRACT ERROR|LINE Identity/);
    expect(screen.queryByRole("button", { name: /連携|追加/ })).not.toBeInTheDocument();
  });

  it("distinguishes loading, typed error, configuration unavailable, and login required", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderLine(identityClient({ listExternalIdentities: vi.fn(() => pending) }));
    expect(await screen.findByRole("status")).toHaveTextContent("LINE連携状態を確認中");
    loading.unmount();

    for (const fixture of [
      PUBLIC_LINE_FRIEND_STATE_PROBLEM_FIXTURES.unauthenticated,
      PUBLIC_LINE_FRIEND_STATE_PROBLEM_FIXTURES.session_expired,
      PUBLIC_LINE_FRIEND_STATE_PROBLEM_FIXTURES.rate_limited,
    ]) {
      const problem = new ApiProblemError(fixture);
      const error = renderLine(identityClient({ getLineFriendState: vi.fn().mockRejectedValue(problem) }));
      if (fixture.code === "AUTHENTICATION_REQUIRED") {
        expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
      } else if (fixture.code === "SESSION_EXPIRED") {
        expect(await screen.findByText("LINE連携を確認できませんでした、時間をおいて再度お試しください")).toBeInTheDocument();
      } else {
        expect(await screen.findByText("アクセスが集中しています。時間をおいて、もう一度お試しください。")).toBeInTheDocument();
      }
      error.unmount();
    }

    const unknownError = renderLine(identityClient({ getLineFriendState: vi.fn().mockRejectedValue(new Error("private detail")) }));
    expect(await screen.findByText("予期しない問題が発生しました。時間をおいて、もう一度お試しください。")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("private detail");
    unknownError.unmount();

    const unavailable = renderLine(null);
    expect(await screen.findByText("LINE連携を表示できません")).toBeInTheDocument();
    expect(screen.getByText("LINE連携を確認できませんでした")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/CONFIGURATION|接続が設定/);
    unavailable.unmount();

    renderLine(identityClient(), authClient(PUBLIC_AUTH_FIXTURE.anonymous_session));
    expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
  });

  it("keeps the direct route and adds a fixed My Page menu entry", async () => {
    renderLine();
    expect(await screen.findByRole("link", { name: "← マイページへ戻る" })).toHaveAttribute("href", "/mypage");
    expect(myPageAccountNavigation).toContainEqual({ href: lineAccountRoute, label: "LINE連携", description: "LINE連携・友だち追加・特典を確認する" });
    expect(accountNavigation).toContainEqual({ href: lineAccountRoute, label: "LINE連携" });
    expect(lineAccountRoute).toBe("/mypage/line");
    expect(publicRoutes).toContain(lineAccountRoute);
  });

  it("prevents duplicate link starts while the canonical transaction is pending", async () => {
    let resolveStart: ((value: ReturnType<typeof response<typeof PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start>>) => void) | undefined;
    const pending = new Promise<ReturnType<typeof response<typeof PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start>>>((resolve) => {
      resolveStart = resolve;
    });
    const startLineIdentityLink = vi.fn(() => pending);
    renderLine(identityClient({ startLineIdentityLink }));
    const button = await screen.findByRole("button", { name: PUBLIC_LINE_FRIEND_STATE_FIXTURES.unlinked.primary_action.label });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(startLineIdentityLink).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("LINEへ移動中…");
    resolveStart?.(response(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start));
  });
});
