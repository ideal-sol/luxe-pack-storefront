import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_POINT_BALANCE_FIXTURES,
  PUBLIC_POINT_HISTORY_FIXTURES,
  PUBLIC_POINT_PRODUCT_FIXTURES,
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

function renderPointUi(children: React.ReactNode, point = pointClient(), auth = authClient()) {
  return render(
    <ToastProvider>
      <SessionProvider client={auth}>
        <PointClientProvider client={point}>{children}</PointClientProvider>
      </SessionProvider>
    </ToastProvider>,
  );
}

describe("SITE-027 Point history and synchronized balance", () => {
  it("renders Backend history order, signed deltas, occurred time, and reason labels", async () => {
    const view = renderPointUi(<MyPointsPage />);
    expect(await screen.findByLabelText("現在のポイント残高")).toHaveTextContent("1,000");
    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText("ガチャ利用")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("-300")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("景品のポイント交換")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("+50")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("ポイント購入")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("+1,000")).toBeInTheDocument();
    expect(view.container.querySelectorAll("time")).toHaveLength(3);
  });

  it("renders a canonical empty history", async () => {
    renderPointUi(<MyPointsPage />, pointClient({
      listPointLedgerEntries: vi.fn().mockResolvedValue({ data: PUBLIC_POINT_HISTORY_FIXTURES.empty, metadata }),
    }));
    expect(await screen.findByText("ポイント履歴はありません")).toBeInTheDocument();
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
    expect(rows.map((row) => row.querySelector("strong")?.textContent)).toEqual(["ガチャ利用", "景品のポイント交換"]);
    expect(screen.queryByText(PUBLIC_POINT_HISTORY_FIXTURES.first_page.next_cursor)).not.toBeInTheDocument();
  });

  it("shares one canonical wallet read across Header, /points, and /mypage/points", async () => {
    const client = pointClient();
    renderPointUi(<><SiteHeader /><PointsPage /><MyPointsPage /></>, client);
    await waitFor(() => expect(screen.getAllByLabelText("現在のポイント残高")).toHaveLength(2));
    const outputs = screen.getAllByLabelText("現在のポイント残高");
    expect(outputs).toHaveLength(2);
    expect(outputs.every((output) => output.textContent === "1,000")).toBe(true);
    const headerBalances = screen.getAllByLabelText("ポイント残高");
    expect(headerBalances).toHaveLength(2);
    expect(headerBalances.every((item) => item.textContent === "ポイント 1,000")).toBe(true);
    expect(client.getWallet).toHaveBeenCalledOnce();
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
