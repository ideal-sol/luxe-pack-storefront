import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { PlaceholderPage } from "@/components/common/placeholder-page";
import type { AuthClientAdapter, AuthSession } from "@/lib/platform";

const authenticated: AuthSession = {
  authenticated: true,
  user: {
    email_verified: true,
    id: "0198a001-0000-7000-8000-000000000701",
    state: "active",
  },
};
const anonymous: AuthSession = { authenticated: false, user: null };
const metadata = { idempotency_replayed: false, status: 200 } as const;

function client(session: AuthSession, pending = false): AuthClientAdapter {
  return {
    completeEmailVerification: vi.fn(),
    getCurrentSession: pending
      ? vi.fn(() => new Promise(() => undefined))
      : vi.fn().mockResolvedValue({ data: session, metadata }),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    resendEmailVerification: vi.fn(),
  } as AuthClientAdapter;
}

function renderMemberPlaceholder(authClient: AuthClientAdapter | null) {
  return render(
    <SessionProvider client={authClient}>
      <PlaceholderPage description="Contract接続後に表示します。" eyebrow="MY PAGE" loginRequired title="会員履歴" />
    </SessionProvider>,
  );
}

describe("member placeholder Session guard", () => {
  it("shows loading until the current Session resolves", () => {
    renderMemberPlaceholder(client(authenticated, true));
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
    expect(screen.queryByText("ログインしてください")).not.toBeInTheDocument();
  });

  it("keeps an authenticated member inside the pending-contract route", async () => {
    renderMemberPlaceholder(client(authenticated));
    expect(await screen.findByText("準備中です")).toBeInTheDocument();
    expect(screen.queryByText("ログインしてください")).not.toBeInTheDocument();
  });

  it("shows Login Required only for an unauthenticated Session", async () => {
    renderMemberPlaceholder(client(anonymous));
    expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
  });

  it("keeps configuration failure distinct from Login Required", () => {
    renderMemberPlaceholder(null);
    expect(screen.getByText("情報を表示できませんでした")).toBeInTheDocument();
    expect(screen.queryByText("ログインしてください")).not.toBeInTheDocument();
  });
});
