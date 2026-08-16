import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_DRAW_HISTORY_FIXTURES,
  PUBLIC_DRAW_HISTORY_PROBLEM_FIXTURES,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { DrawClientProvider } from "@/components/draw/draw-client-provider";
import { DrawHistoryPage } from "@/components/draw/draw-history-page";
import type { AuthClientAdapter, DrawClientAdapter } from "@/lib/platform";

const metadata = { idempotency_replayed: false, status: 200 } as const;

function authClient(overrides: Partial<AuthClientAdapter> = {}) {
  return {
    getCurrentSession: vi.fn().mockResolvedValue({ data: PUBLIC_AUTH_FIXTURE.authenticated_session, metadata }),
    logout: vi.fn(),
    ...overrides,
  } as unknown as AuthClientAdapter;
}

function drawClient(overrides: Partial<DrawClientAdapter> = {}) {
  return {
    createDraw: vi.fn(),
    getDrawRequest: vi.fn(),
    listDrawHistory: vi.fn().mockResolvedValue({ data: PUBLIC_DRAW_HISTORY_FIXTURES.multiple, metadata }),
    ...overrides,
  } as DrawClientAdapter;
}

function renderHistory(draw = drawClient(), auth = authClient()) {
  return render(
    <SessionProvider client={auth}>
      <DrawClientProvider client={draw}>
        <DrawHistoryPage />
      </DrawClientProvider>
    </SessionProvider>,
  );
}

describe("SITE-028 current-user Gacha history", () => {
  it("renders Historical Gacha presentation, occurred time, counts, and Backend status in returned order", async () => {
    const client = drawClient();
    const view = renderHistory(client);
    const rows = await screen.findAllByRole("listitem");

    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByRole("heading", { name: "Fixture Catalog Gacha" })).toBeInTheDocument();
    expect(within(rows[0]!).getByRole("img", { name: "Fixtureガチャ" }).getAttribute("src")
      ?.endsWith(PUBLIC_DRAW_HISTORY_FIXTURES.multiple.items[0]!.gacha.presentation_asset!.path)).toBe(true);
    expect(within(rows[0]!).getByText("2回")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("完了")).toHaveAttribute("data-status-code", "completed");
    expect(within(rows[1]!).getAllByText("5回")).toHaveLength(2);
    expect(within(rows[2]!).getAllByText("1回")).toHaveLength(2);
    expect(view.container.querySelectorAll("time")).toHaveLength(3);
    expect(screen.queryByText(/一部|partial|差分/i)).not.toBeInTheDocument();
    expect(client.listDrawHistory).toHaveBeenCalledWith({ limit: 10 });
    expect(client.createDraw).not.toHaveBeenCalled();
    expect(client.getDrawRequest).not.toHaveBeenCalled();
  });

  it("renders an empty canonical history", async () => {
    renderHistory(drawClient({
      listDrawHistory: vi.fn().mockResolvedValue({ data: PUBLIC_DRAW_HISTORY_FIXTURES.empty, metadata }),
    }));
    expect(await screen.findByText("ガチャ履歴はありません")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("appends the opaque cursor continuation without sorting or exposing the cursor", async () => {
    const listDrawHistory = vi.fn()
      .mockResolvedValueOnce({ data: PUBLIC_DRAW_HISTORY_FIXTURES.first_page, metadata })
      .mockResolvedValueOnce({ data: PUBLIC_DRAW_HISTORY_FIXTURES.continuation, metadata });
    renderHistory(drawClient({ listDrawHistory }));

    fireEvent.click(await screen.findByRole("button", { name: "さらに表示" }));
    await waitFor(() => expect(listDrawHistory).toHaveBeenNthCalledWith(2, {
      cursor: PUBLIC_DRAW_HISTORY_FIXTURES.first_page.next_cursor,
      limit: 10,
    }));
    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText("2回")).toBeInTheDocument();
    expect(within(rows[1]!).getAllByText("5回")).toHaveLength(2);
    expect(within(rows[2]!).getAllByText("1回")).toHaveLength(2);
    expect(screen.queryByText(PUBLIC_DRAW_HISTORY_FIXTURES.first_page.next_cursor)).not.toBeInTheDocument();
  });

  it("contains a continuation error and keeps already returned history visible", async () => {
    const listDrawHistory = vi.fn()
      .mockResolvedValueOnce({ data: PUBLIC_DRAW_HISTORY_FIXTURES.first_page, metadata })
      .mockRejectedValueOnce(new Error("fixture continuation failure"));
    renderHistory(drawClient({ listDrawHistory }));

    fireEvent.click(await screen.findByRole("button", { name: "さらに表示" }));
    expect(await screen.findByText("予期しない問題が発生しました。時間をおいて、もう一度お試しください。")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("distinguishes Session loading, History loading, and read errors", async () => {
    const pendingSession = new Promise<never>(() => undefined);
    const sessionLoading = renderHistory(drawClient(), authClient({ getCurrentSession: vi.fn(() => pendingSession) }));
    expect(screen.getByRole("status")).toHaveTextContent("ガチャ履歴を読み込み中");
    sessionLoading.unmount();

    const pendingHistory = new Promise<never>(() => undefined);
    const historyLoading = renderHistory(drawClient({ listDrawHistory: vi.fn(() => pendingHistory) }));
    expect(await screen.findByRole("status")).toHaveTextContent("ガチャ履歴を読み込み中");
    historyLoading.unmount();

    renderHistory(drawClient({ listDrawHistory: vi.fn().mockRejectedValue(new Error("fixture read failure")) }));
    expect(await screen.findByText("ガチャ履歴を取得できませんでした")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
  });

  it("renders login state for an anonymous Session without issuing a history read", async () => {
    const client = drawClient();
    renderHistory(client, authClient({
      getCurrentSession: vi.fn().mockResolvedValue({ data: PUBLIC_AUTH_FIXTURE.anonymous_session, metadata }),
    }));
    expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
    expect(client.listDrawHistory).not.toHaveBeenCalled();
  });

  it.each([
    PUBLIC_DRAW_HISTORY_PROBLEM_FIXTURES.unauthenticated,
    { ...PUBLIC_DRAW_HISTORY_PROBLEM_FIXTURES.unauthenticated, code: "SESSION_EXPIRED", title: "The session has expired." },
  ])("renders login state for canonical $code history problems", async (problem) => {
    renderHistory(drawClient({
      listDrawHistory: vi.fn().mockRejectedValue(new ApiProblemError(problem)),
    }));
    expect(await screen.findByText("ログインしてください")).toBeInTheDocument();
  });

  it("contains a Session error without issuing a Draw read or mutation", async () => {
    const client = drawClient();
    renderHistory(client, authClient({ getCurrentSession: vi.fn().mockRejectedValue(new Error("fixture session failure")) }));
    expect(await screen.findByText("Sessionを確認できませんでした。時間をおいて再度お試しください。")).toBeInTheDocument();
    expect(client.listDrawHistory).not.toHaveBeenCalled();
    expect(client.createDraw).not.toHaveBeenCalled();
  });

  it.each([
    ["mobile", 390],
    ["desktop", 1280],
  ])("keeps canonical history content present at the %s viewport", async (_, width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    renderHistory();
    expect(await screen.findAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByText("完了")).toHaveLength(3);
    expect(screen.getAllByRole("img", { name: "Fixtureガチャ" })).toHaveLength(3);
  });
});
