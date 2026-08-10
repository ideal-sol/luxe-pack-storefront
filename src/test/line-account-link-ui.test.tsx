import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_EXTERNAL_IDENTITY_FIXTURE } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { ExternalIdentityClientProvider } from "@/components/account/external-identity-client-provider";
import { LineAccountLink } from "@/components/account/line-account-link";
import { SessionProvider } from "@/components/auth/session-provider";
import type { AuthClientAdapter, AuthSession, ExternalIdentityAdapter } from "@/lib/platform";
import { lineAccountRoute, myPageAccountNavigation } from "@/lib/routes/navigation";

const metadata = { idempotency_replayed: false, status: 200 } as const;

function response<T>(data: T) {
  return { data, metadata };
}

function authClient(session: AuthSession = PUBLIC_AUTH_FIXTURE.authenticated_session): AuthClientAdapter {
  return {
    completeEmailVerification: vi.fn(),
    getCurrentSession: vi.fn().mockResolvedValue(response(session)),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    resendEmailVerification: vi.fn(),
  } as AuthClientAdapter;
}

function identityClient(overrides: Partial<ExternalIdentityAdapter> = {}): ExternalIdentityAdapter {
  return {
    completeLineLogin: vi.fn(),
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

    fireEvent.click(await screen.findByRole("button", { name: "LINEアカウントを連携" }));
    await waitFor(() => expect(startLineIdentityLink).toHaveBeenCalledWith({ return_path: lineAccountRoute }, {}));
    expect(navigate).toHaveBeenCalledWith(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start.authorization_url);
    expect(externalClient.completeLineLogin).not.toHaveBeenCalled();
    expect(externalClient.unlinkLineIdentity).not.toHaveBeenCalled();
  });

  it("renders the linked identity without exposing subject, token, friend state, or an unsafe unlink action", async () => {
    renderLine(identityClient({
      listExternalIdentities: vi.fn().mockResolvedValue(response(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.linked)),
    }));
    expect(await screen.findByRole("heading", { name: "LINE連携済み" })).toBeInTheDocument();
    expect(screen.getByText("連携日時")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /解除/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/友だち/)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("token");
    expect(document.body).not.toHaveTextContent("subject");
  });

  it("distinguishes loading, typed error, configuration unavailable, and login required", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderLine(identityClient({ listExternalIdentities: vi.fn(() => pending) }));
    expect(await screen.findByRole("status")).toHaveTextContent("LINE連携状態を確認中");
    loading.unmount();

    const problem = new ApiProblemError({
      code: "AUTH_SERVICE_UNAVAILABLE",
      request_id: "request-line-state",
      retryable: true,
      status: 503,
      title: "Identity unavailable",
      type: "https://storefront.test/problems/identity-unavailable",
    });
    const error = renderLine(identityClient({ listExternalIdentities: vi.fn().mockRejectedValue(problem) }));
    expect(await screen.findByText("LINE連携状態を取得できませんでした")).toBeInTheDocument();
    error.unmount();

    const unavailable = renderLine(null);
    expect(await screen.findByText("LINE連携を表示できません")).toBeInTheDocument();
    unavailable.unmount();

    renderLine(identityClient(), authClient(PUBLIC_AUTH_FIXTURE.anonymous_session));
    expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
  });

  it("keeps the SITE-006 route definition and session boundary", async () => {
    renderLine();
    expect(await screen.findByRole("link", { name: "← マイページへ戻る" })).toHaveAttribute("href", "/mypage");
    expect(myPageAccountNavigation[0].href).toBe(lineAccountRoute);
    expect(lineAccountRoute).toBe("/mypage/line");
  });

  it("prevents duplicate link starts while the canonical transaction is pending", async () => {
    let resolveStart: ((value: ReturnType<typeof response<typeof PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start>>) => void) | undefined;
    const pending = new Promise<ReturnType<typeof response<typeof PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start>>>((resolve) => {
      resolveStart = resolve;
    });
    const startLineIdentityLink = vi.fn(() => pending);
    renderLine(identityClient({ startLineIdentityLink }));
    const button = await screen.findByRole("button", { name: "LINEアカウントを連携" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(startLineIdentityLink).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    resolveStart?.(response(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start));
  });
});
