import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_EXTERNAL_IDENTITY_FIXTURE,
  PUBLIC_LINE_FRIEND_STATE_FIXTURES,
  PUBLIC_LINE_FRIEND_STATE_PROBLEM_FIXTURES,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { ExternalIdentityClientProvider } from "@/components/account/external-identity-client-provider";
import { LineAccountLink } from "@/components/account/line-account-link";
import { SessionProvider } from "@/components/auth/session-provider";
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

describe("LINE account link UI", () => {
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
    expect(screen.getByText("現在のLINE連携・友だち追加済みです")).toBeInTheDocument();
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

  it("keeps the direct route and session boundary outside the My Page menu", async () => {
    renderLine();
    expect(await screen.findByRole("link", { name: "← マイページへ戻る" })).toHaveAttribute("href", "/mypage");
    expect(myPageAccountNavigation.map((item) => item.href)).not.toContain(lineAccountRoute);
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
