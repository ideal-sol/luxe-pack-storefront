import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_POINT_BALANCE_FIXTURES,
  PUBLIC_POINT_PRODUCT_FIXTURES,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import PointsPage from "@/app/points/page";
import { SessionProvider } from "@/components/auth/session-provider";
import { PointClientProvider } from "@/components/points/point-client-provider";
import type { AuthClientAdapter, AuthSession, PointClientAdapter } from "@/lib/platform";

const metadata = { idempotency_replayed: false, status: 200 } as const;

function authClient(session: AuthSession = PUBLIC_AUTH_FIXTURE.authenticated_session) {
  return { getCurrentSession: vi.fn().mockResolvedValue({ data: session, metadata }) } as unknown as AuthClientAdapter;
}

function pointClient({
  balance = PUBLIC_POINT_BALANCE_FIXTURES.positive,
  products = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible,
}: {
  readonly balance?: typeof PUBLIC_POINT_BALANCE_FIXTURES.positive | typeof PUBLIC_POINT_BALANCE_FIXTURES.zero;
  readonly products?: typeof PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible | typeof PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_after_first_purchase | typeof PUBLIC_POINT_PRODUCT_FIXTURES.anonymous_empty;
} = {}) {
  return {
    getWallet: vi.fn().mockResolvedValue({ data: balance, metadata }),
    listPointLedgerEntries: vi.fn(),
    listPointProducts: vi.fn().mockResolvedValue({ data: products, metadata }),
  } as unknown as PointClientAdapter;
}

function renderPoints(client: PointClientAdapter, session: AuthSession = PUBLIC_AUTH_FIXTURE.authenticated_session) {
  return render(
    <SessionProvider client={authClient(session)}>
      <PointClientProvider client={client}><PointsPage /></PointClientProvider>
    </SessionProvider>,
  );
}

describe("SITE-027 Point purchase read presentation", () => {
  it("renders the canonical positive balance and Backend product presentation", async () => {
    const client = pointClient();
    renderPoints(client);

    await waitFor(() => expect(screen.getByLabelText("現在のポイント残高")).toHaveTextContent("1,000"));
    expect(await screen.findByRole("heading", { name: "スタンダード1000ポイント" })).toBeInTheDocument();
    expect(screen.getByText("1,100")).toBeInTheDocument();
    expect(screen.getByText("購入対象です。")).toBeInTheDocument();
    expect(screen.getByText("購入可能")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "購入手続きは準備中" })).toBeDisabled();
    expect(client.getWallet).toHaveBeenCalledOnce();
    expect(client.listPointProducts).toHaveBeenCalledOnce();
  });

  it("renders zero balance and a canonical empty product collection", async () => {
    renderPoints(pointClient({ balance: PUBLIC_POINT_BALANCE_FIXTURES.zero, products: PUBLIC_POINT_PRODUCT_FIXTURES.anonymous_empty }));
    await waitFor(() => expect(screen.getByLabelText("現在のポイント残高")).toHaveTextContent("0"));
    expect(await screen.findByText("ポイント商品はありません")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("preserves category-relative Backend order and first-user eligibility", async () => {
    const first = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[1];
    const products = {
      data: [
        { ...first, id: "0198a001-0000-7000-8000-000000000399", title: "先に返された初回商品" },
        first,
        PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0],
      ],
    } as unknown as typeof PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible;
    renderPoints(pointClient({ products }));
    await screen.findByRole("heading", { name: "スタンダード1000ポイント" });
    fireEvent.click(screen.getByRole("tab", { name: "初回ユーザー" }));
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["先に返された初回商品", "初回限定1000ポイント"]);
    expect(screen.getAllByText("購入対象です。")).toHaveLength(2);
  });

  it("shows the Backend first-purchase ineligible reason without enabling purchase", async () => {
    renderPoints(pointClient({ products: PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_after_first_purchase }));
    fireEvent.click(await screen.findByRole("tab", { name: "初回ユーザー" }));
    expect(await screen.findByText("過去にPoint購入があるため、初回ユーザー対象外です。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "現在購入できません" })).toBeDisabled();
  });

  it("uses the canonical anonymous login CTA", async () => {
    const client = pointClient({ products: PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible });
    client.listPointProducts = vi.fn().mockResolvedValue({ data: PUBLIC_POINT_PRODUCT_FIXTURES.anonymous, metadata });
    renderPoints(client, PUBLIC_AUTH_FIXTURE.anonymous_session);
    expect(await screen.findByRole("link", { name: "ログインして確認" })).toHaveAttribute("href", "/login");
    expect(screen.getByLabelText("現在のポイント残高")).toHaveTextContent("--");
    await waitFor(() => expect(client.getWallet).not.toHaveBeenCalled());
  });
});
