import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_POINT_BALANCE_FIXTURES,
  PUBLIC_POINT_PRODUCT_FIXTURES,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import PointsPage from "@/app/points/page";
import { SessionProvider } from "@/components/auth/session-provider";
import { PointClientProvider } from "@/components/points/point-client-provider";
import type { AuthClientAdapter, AuthSession, PointClientAdapter, PointProductCollection } from "@/lib/platform";

const metadata = { idempotency_replayed: false, status: 200 } as const;
const jstDateTime = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

function authClient(session: AuthSession = PUBLIC_AUTH_FIXTURE.authenticated_session) {
  return { getCurrentSession: vi.fn().mockResolvedValue({ data: session, metadata }) } as unknown as AuthClientAdapter;
}

function pointClient({
  balance = PUBLIC_POINT_BALANCE_FIXTURES.positive,
  products = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible,
}: {
  readonly balance?: typeof PUBLIC_POINT_BALANCE_FIXTURES.positive | typeof PUBLIC_POINT_BALANCE_FIXTURES.zero;
  readonly products?: PointProductCollection;
} = {}) {
  return {
    getWallet: vi.fn().mockResolvedValue({ data: balance, metadata }),
    listPointLedgerEntries: vi.fn(),
    listPointProducts: vi.fn().mockResolvedValue({ data: products, metadata }),
  } as unknown as PointClientAdapter;
}

function pointClientWithNonCanonicalProducts(products: unknown) {
  return {
    getWallet: vi.fn().mockResolvedValue({ data: PUBLIC_POINT_BALANCE_FIXTURES.positive, metadata }),
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

describe("SITE-032 Limited Bonus Coin presentation", () => {
  it("preserves the existing Product presentation when limited_bonus is omitted", async () => {
    const { limited_bonus: omittedLimitedBonus, ...product } = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0];
    renderPoints(pointClient({ products: { data: [product] } }));

    expect(omittedLimitedBonus).toBeDefined();
    expect(await screen.findByRole("heading", { name: "スタンダード1000コイン" })).toBeInTheDocument();
    expect(screen.getByText("1,100")).toBeInTheDocument();
    expect(screen.getByText("￥1,000")).toBeInTheDocument();
    expect(screen.getByText("購入対象です。")).toBeInTheDocument();
    expect(screen.getByText("購入可能")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "期間限定ボーナスコイン" })).not.toBeInTheDocument();
    expect(screen.queryByText("通常ボーナス")).not.toBeInTheDocument();
  });

  it("safely omits a Contract-external nullish Limited Bonus without treating it as a canonical fixture", async () => {
    const nonCanonicalTransportPayload = {
      data: [{ ...PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0], limited_bonus: null }],
    };
    renderPoints(pointClientWithNonCanonicalProducts(nonCanonicalTransportPayload));

    expect(await screen.findByText("1,100")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "期間限定ボーナスコイン" })).not.toBeInTheDocument();
  });

  it("renders the active Backend state, canonical presentation, amount, and JST period", async () => {
    const canonical = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0].limited_bonus;
    const original = structuredClone(canonical);
    renderPoints(pointClient());

    const presentation = await screen.findByRole("region", { name: canonical.presentation.label });
    expect(presentation).toHaveAttribute("data-limited-bonus-state", canonical.state);
    expect(within(presentation).getByText(canonical.presentation.label)).toBeInTheDocument();
    expect(within(presentation).getByText(canonical.presentation.amount_text)).toBeInTheDocument();
    expect(within(presentation).getByText(jstDateTime.format(new Date(canonical.starts_at)))).toHaveAttribute("datetime", canonical.starts_at);
    expect(within(presentation).getByText(jstDateTime.format(new Date(canonical.ends_at)))).toHaveAttribute("datetime", canonical.ends_at);
    expect(canonical).toEqual(original);
  });

  it("renders the upcoming Backend state without deriving it from the current time", async () => {
    const canonical = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[1].limited_bonus;
    renderPoints(pointClient());
    fireEvent.click(await screen.findByRole("tab", { name: "初回ユーザー" }));

    const presentation = await screen.findByRole("region", { name: canonical.presentation.label });
    expect(presentation).toHaveAttribute("data-limited-bonus-state", "upcoming");
    expect(within(presentation).getByText(canonical.presentation.amount_text)).toBeInTheDocument();
    expect(within(presentation).getByText(jstDateTime.format(new Date(canonical.starts_at)))).toHaveAttribute("datetime", canonical.starts_at);
    expect(within(presentation).getByText(jstDateTime.format(new Date(canonical.ends_at)))).toHaveAttribute("datetime", canonical.ends_at);
  });

  it("omits the canonical inactive presentation when Backend is_visible is false", async () => {
    const canonical = PUBLIC_POINT_PRODUCT_FIXTURES.unavailable.data[0].limited_bonus;
    renderPoints(pointClient({ products: PUBLIC_POINT_PRODUCT_FIXTURES.unavailable }));

    expect(await screen.findByRole("heading", { name: "スタンダード1000コイン" })).toBeInTheDocument();
    expect(canonical.state).toBe("inactive");
    expect(canonical.presentation.is_visible).toBe(false);
    expect(screen.queryByRole("region", { name: canonical.presentation.label })).not.toBeInTheDocument();
    expect(screen.queryByText(canonical.presentation.amount_text ?? "non-rendered-inactive-amount")).not.toBeInTheDocument();
  });

  it("keeps grant.total_points and Limited Bonus separate without adding a normal Bonus row", async () => {
    const product = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0];
    renderPoints(pointClient());

    const card = await screen.findByRole("article");
    expect(within(card).getByText(new Intl.NumberFormat("ja-JP").format(product.grant.total_points))).toBeInTheDocument();
    expect(within(card).getByText(product.limited_bonus.presentation.amount_text)).toBeInTheDocument();
    expect(card).not.toHaveTextContent(new Intl.NumberFormat("ja-JP").format(product.grant.total_points + product.limited_bonus.amount));
    expect(card.querySelector(".point-product-card__standard-bonus")).not.toBeInTheDocument();
    expect(within(card).queryByText("通常ボーナス")).not.toBeInTheDocument();
  });
});

describe("SITE-030 Coin Product read regression", () => {
  it("renders canonical totals and converts only Backend currency terminology", async () => {
    const client = pointClient();
    const originalTitle = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0].title;
    const view = renderPoints(client);

    await waitFor(() => expect(screen.getByLabelText("現在のコイン残高")).toHaveTextContent("1,000"));
    expect(await screen.findByRole("heading", { name: "スタンダード1000コイン" })).toBeInTheDocument();
    expect(screen.getByText("1,100")).toBeInTheDocument();
    expect(screen.getByText("コイン", { selector: ".point-product-card__grant span" })).toBeInTheDocument();
    expect(screen.getByText("購入対象です。")).toBeInTheDocument();
    expect(screen.getByText("購入可能")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "購入手続きは準備中" })).toBeDisabled();
    const detailLink = screen.getByRole("link", { name: "詳細を見る" });
    expect(detailLink).toHaveAttribute(
      "href",
      `/points/purchase/${PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0].id}`,
    );
    expect(detailLink.querySelector("button")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "購入手続きは準備中" }).closest("a")).toBeNull();
    expect(client.getWallet).toHaveBeenCalledOnce();
    expect(client.listPointProducts).toHaveBeenCalledOnce();
    expect(PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0].title).toBe(originalTitle);
    expect(view.container).not.toHaveTextContent(/ポイント|\bpt\b/i);
  });

  it("encodes only the canonical public Product identifier in the detail Route", async () => {
    const canonical = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0];
    const productId = "public/product?review=true";
    renderPoints(pointClient({ products: { data: [{ ...canonical, id: productId }] } }));

    expect(await screen.findByRole("link", { name: "詳細を見る" })).toHaveAttribute(
      "href",
      "/points/purchase/public%2Fproduct%3Freview%3Dtrue",
    );
  });

  it("renders zero balance and a canonical empty product collection", async () => {
    renderPoints(pointClient({ balance: PUBLIC_POINT_BALANCE_FIXTURES.zero, products: PUBLIC_POINT_PRODUCT_FIXTURES.anonymous_empty }));
    await waitFor(() => expect(screen.getByLabelText("現在のコイン残高")).toHaveTextContent("0"));
    expect(await screen.findByText("コイン商品はありません")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("preserves category-relative Backend order and first-user eligibility", async () => {
    const first = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[1];
    const products: PointProductCollection = {
      data: [
        { ...first, id: "0198a001-0000-7000-8000-000000000399", title: "先に返された初回商品" },
        first,
        PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0],
      ],
    };
    renderPoints(pointClient({ products }));
    await screen.findByRole("heading", { name: "スタンダード1000コイン" });
    fireEvent.click(screen.getByRole("tab", { name: "初回ユーザー" }));
    const headings = screen.getAllByRole("article").map((card) => within(card).getByRole("heading", { level: 3 }).textContent);
    expect(headings).toEqual(["先に返された初回商品", "初回限定1000コイン"]);
    expect(screen.getAllByText("購入対象です。")).toHaveLength(2);
  });

  it("shows the Backend first-purchase ineligible reason without enabling purchase", async () => {
    renderPoints(pointClient({ products: PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_after_first_purchase }));
    fireEvent.click(await screen.findByRole("tab", { name: "初回ユーザー" }));
    expect(await screen.findByText("過去にコイン購入があるため、初回ユーザー対象外です。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "現在購入できません" })).toBeDisabled();
  });

  it("uses the canonical anonymous login CTA", async () => {
    const client = pointClient();
    client.listPointProducts = vi.fn().mockResolvedValue({ data: PUBLIC_POINT_PRODUCT_FIXTURES.anonymous, metadata });
    renderPoints(client, PUBLIC_AUTH_FIXTURE.anonymous_session);
    expect(await screen.findByRole("link", { name: "ログインして確認" })).toHaveAttribute("href", "/login");
    expect(screen.getByLabelText("現在のコイン残高")).toHaveTextContent("--");
    await waitFor(() => expect(client.getWallet).not.toHaveBeenCalled());
  });
});
