import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_POINT_BALANCE_FIXTURES,
  PUBLIC_POINT_HISTORY_FIXTURES,
  PUBLIC_POINT_PRODUCT_FIXTURES,
  PUBLIC_POINT_READ_PROBLEM_FIXTURES,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import MyPointsPage from "@/app/mypage/points/page";
import PointsPage from "@/app/points/page";
import { SessionProvider } from "@/components/auth/session-provider";
import { ToastProvider } from "@/components/common/toast-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { PointClientProvider } from "@/components/points/point-client-provider";
import type { AuthClientAdapter, PointClientAdapter } from "@/lib/platform";

const metadata = { idempotency_replayed: false, status: 200 } as const;

function authClient(overrides: Partial<AuthClientAdapter> = {}) {
  return {
    getCurrentSession: vi.fn().mockResolvedValue({ data: PUBLIC_AUTH_FIXTURE.authenticated_session, metadata }),
    logout: vi.fn(),
    ...overrides,
  } as unknown as AuthClientAdapter;
}

function pointClient(overrides: Partial<PointClientAdapter> = {}) {
  return {
    getWallet: vi.fn().mockResolvedValue({ data: PUBLIC_POINT_BALANCE_FIXTURES.positive, metadata }),
    listPointLedgerEntries: vi.fn().mockResolvedValue({ data: PUBLIC_POINT_HISTORY_FIXTURES.multiple, metadata }),
    listPointProducts: vi.fn().mockResolvedValue({ data: PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible, metadata }),
    ...overrides,
  } as PointClientAdapter;
}

function renderPointUi(children: React.ReactNode, point: PointClientAdapter | null = pointClient(), auth = authClient()) {
  return render(
    <ToastProvider>
      <SessionProvider client={auth}>
        <PointClientProvider client={point}>{children}</PointClientProvider>
      </SessionProvider>
    </ToastProvider>,
  );
}

describe("SITE-030 Coin history and canonical Wallet presentation", () => {
  it("renders Backend history order, signed deltas, and Coin terminology without mutating canonical labels", async () => {
    const originalLabels = PUBLIC_POINT_HISTORY_FIXTURES.multiple.items.map((entry) => entry.reason.label);
    const view = renderPointUi(<MyPointsPage />);
    expect(await screen.findByLabelText("現在のコイン残高")).toHaveTextContent("1,000");
    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText("ガチャ利用")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("-300")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("景品のコイン交換")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("+50")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("コイン購入")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("+1,000")).toBeInTheDocument();
    expect(view.container.querySelectorAll("time")).toHaveLength(3);
    expect(PUBLIC_POINT_HISTORY_FIXTURES.multiple.items.map((entry) => entry.reason.label)).toEqual(originalLabels);
    expect(view.container).not.toHaveTextContent(/ポイント|\bpt\b/i);
  });

  it("renders a canonical empty history", async () => {
    renderPointUi(<MyPointsPage />, pointClient({
      listPointLedgerEntries: vi.fn().mockResolvedValue({ data: PUBLIC_POINT_HISTORY_FIXTURES.empty, metadata }),
    }));
    expect(await screen.findByText("コイン履歴はありません")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("appends cursor continuation without sorting or exposing the cursor", async () => {
    const listPointLedgerEntries = vi.fn()
      .mockResolvedValueOnce({ data: PUBLIC_POINT_HISTORY_FIXTURES.first_page, metadata })
      .mockResolvedValueOnce({ data: PUBLIC_POINT_HISTORY_FIXTURES.continuation, metadata });
    renderPointUi(<MyPointsPage />, pointClient({ listPointLedgerEntries }));
    fireEvent.click(await screen.findByRole("button", { name: "さらに表示" }));
    await waitFor(() => expect(listPointLedgerEntries).toHaveBeenNthCalledWith(2, {
      cursor: PUBLIC_POINT_HISTORY_FIXTURES.first_page.next_cursor,
      limit: 10,
    }));
    const rows = await screen.findAllByRole("listitem");
    expect(rows.map((row) => row.querySelector("strong")?.textContent)).toEqual(["ガチャ利用", "景品のコイン交換"]);
    expect(screen.queryByText(PUBLIC_POINT_HISTORY_FIXTURES.first_page.next_cursor)).not.toBeInTheDocument();
  });

  it("shares one canonical wallet read across Header, /points, and /mypage/points", async () => {
    const client = pointClient();
    renderPointUi(<><SiteHeader /><PointsPage /><MyPointsPage /></>, client);
    await waitFor(() => expect(screen.getAllByLabelText("現在のコイン残高")).toHaveLength(2));
    const outputs = screen.getAllByLabelText("現在のコイン残高");
    expect(outputs).toHaveLength(2);
    expect(outputs.every((output) => output.textContent === "1,000")).toBe(true);
    const headerBalances = screen.getAllByLabelText("コイン残高");
    expect(headerBalances).toHaveLength(2);
    expect(headerBalances.every((item) => item.textContent === "コイン 1,000")).toBe(true);
    expect(client.getWallet).toHaveBeenCalledOnce();
  });

  it("renders every canonical expiry bucket in Backend order with JST date and time", async () => {
    const wallet = PUBLIC_POINT_BALANCE_FIXTURES.canonical_expiry;
    const getWallet = vi.fn().mockResolvedValue({ data: wallet, metadata });
    const view = renderPointUi(<PointsPage />, pointClient({ getWallet }));
    expect(await screen.findByLabelText("現在のコイン残高")).toHaveTextContent(wallet.total_points.toString());
    const expiryList = screen.getByRole("list", { name: "7日以内に失効するコイン一覧" });
    const expiryRows = within(expiryList).getAllByRole("listitem");
    expect(expiryRows).toHaveLength(3);
    const formatter = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" });
    wallet.expiring_within_7_days.forEach((bucket, index) => {
      expect(expiryRows[index]).toHaveTextContent(`${bucket.amount} コイン`);
      expect(within(expiryRows[index]!).getByText(formatter.format(new Date(bucket.expires_at)))).toHaveAttribute("datetime", bucket.expires_at);
    });
    expect(view.container.querySelectorAll(".point-balance-summary__expiry li")).toHaveLength(wallet.expiring_within_7_days.length);
    expect(getWallet).toHaveBeenCalledOnce();
  });

  it("uses the canonical empty expiry array without a Frontend expiry decision", async () => {
    renderPointUi(<PointsPage />);
    expect(await screen.findByText("7日以内に失効するコインはありません。")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "7日以内に失効するコイン一覧" })).not.toBeInTheDocument();
  });

  it("distinguishes Wallet loading, configuration unavailable, and typed errors", async () => {
    const pending = new Promise<never>(() => undefined);
    const loading = renderPointUi(<PointsPage />, pointClient({ getWallet: vi.fn(() => pending) }));
    expect(await screen.findByText("読み込み中", { selector: ".point-balance-summary__loading" })).toBeInTheDocument();
    loading.unmount();

    const configuration = renderPointUi(<PointsPage />, null);
    expect(await screen.findByText("コイン情報への接続が設定されていません。")).toBeInTheDocument();
    configuration.unmount();

    const problem = new ApiProblemError(PUBLIC_POINT_READ_PROBLEM_FIXTURES.unauthenticated);
    renderPointUi(<PointsPage />, pointClient({ getWallet: vi.fn().mockRejectedValue(problem) }));
    expect(await screen.findByText("情報を取得できませんでした。時間をおいて、もう一度お試しください。")).toBeInTheDocument();
    expect(screen.queryByText(problem.title)).not.toBeInTheDocument();
  });

  it("contains Authentication and Session errors without Point or Payment mutation", async () => {
    const client = pointClient();
    const failingAuth = authClient({ getCurrentSession: vi.fn().mockRejectedValue(new Error("fixture session failure")) });
    renderPointUi(<PointsPage />, client, failingAuth);
    expect(await screen.findByText("Sessionを確認できませんでした。時間をおいて再度お試しください。")).toBeInTheDocument();
    expect(client.getWallet).not.toHaveBeenCalled();
    expect(client.listPointProducts).not.toHaveBeenCalled();
    expect(Object.keys(client).filter((key) => /payment|purchase|grant|debit/i.test(key))).toHaveLength(0);
  });
});
