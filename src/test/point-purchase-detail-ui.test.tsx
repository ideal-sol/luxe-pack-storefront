import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import {
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_POINT_BALANCE_FIXTURES,
  PUBLIC_POINT_PRODUCT_FIXTURES,
  PUBLIC_POINT_READ_PROBLEM_FIXTURES,
} from "@oripa/storefront-testkit";
import { vi } from "vitest";
import PointPurchaseDetailPage from "@/app/points/purchase/[productId]/page";
import { SessionProvider } from "@/components/auth/session-provider";
import { PointClientProvider } from "@/components/points/point-client-provider";
import type {
  AuthClientAdapter,
  AuthSession,
  PointClientAdapter,
  PointProductCollection,
} from "@/lib/platform";

const metadata = { idempotency_replayed: false, status: 200 } as const;
const canonicalProduct = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0];

function authClient(session: AuthSession = PUBLIC_AUTH_FIXTURE.authenticated_session) {
  return {
    getCurrentSession: vi.fn().mockResolvedValue({ data: session, metadata }),
  } as unknown as AuthClientAdapter;
}

function pointClient(
  products: PointProductCollection = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible,
): PointClientAdapter {
  return {
    getWallet: vi.fn().mockResolvedValue({ data: PUBLIC_POINT_BALANCE_FIXTURES.positive, metadata }),
    listPointLedgerEntries: vi.fn(),
    listPointProducts: vi.fn().mockResolvedValue({ data: products, metadata }),
  } as unknown as PointClientAdapter;
}

async function renderDetail({
  client = pointClient(),
  productId = canonicalProduct.id,
  sessionClient = authClient(),
}: {
  readonly client?: PointClientAdapter | null;
  readonly productId?: string;
  readonly sessionClient?: AuthClientAdapter | null;
} = {}) {
  const page = await PointPurchaseDetailPage({ params: Promise.resolve({ productId }) });
  return render(
    <SessionProvider client={sessionClient}>
      <PointClientProvider client={client}>{page}</PointClientProvider>
    </SessionProvider>,
  );
}

describe("SITE-040 Coin Purchase Detail", () => {
  it("resolves an exact canonical Product and renders the canonical purchase summary", async () => {
    const client = pointClient();
    const view = await renderDetail({ client });

    expect(await screen.findByRole("heading", { level: 1, name: "スタンダード1000コイン" })).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "購入内容" });
    expect(within(summary).getByText("支払金額").tagName).toBe("DT");
    expect(within(summary).getByText("￥1,000").tagName).toBe("DD");
    expect(within(summary).getByText("獲得コイン").tagName).toBe("DT");
    expect(within(summary).getByText("1,000")).toBeInTheDocument();
    expect(within(summary).getByText("ボーナスコイン").tagName).toBe("DT");
    expect(within(summary).getByText("100")).toBeInTheDocument();
    expect(within(summary).getByText("期間限定ボーナスコイン").tagName).toBe("DT");
    expect(within(summary).getByText("300")).toBeInTheDocument();
    expect(within(summary).getByText("合計コイン").tagName).toBe("DT");
    expect(within(summary).getByText("1,400")).toBeInTheDocument();
    expect(screen.getByText("すべてのユーザー")).toBeInTheDocument();
    expect(screen.getByText("販売中")).toHaveAttribute("data-sale-state", canonicalProduct.sale_state);
    expect(screen.getByText("購入対象です。")).toHaveAttribute("data-eligible", "true");
    expect(screen.getByRole("link", { name: /コイン購入へ戻る/ })).toHaveAttribute("href", "/points");
    expect(client.listPointProducts).toHaveBeenCalledOnce();
    expect(Object.keys(client).filter((key) => /payment|purchase|session|provider|grant|redirect/i.test(key))).toHaveLength(0);
    expect(view.container).not.toHaveTextContent(/ポイント|決済へ進む|購入手続きは準備中です/);
    expect(screen.getByRole("button", { name: "購入する" })).toBeDisabled();
  });

  it("adds only an active Limited Bonus amount to the canonical total", async () => {
    const limitedBonus = canonicalProduct.limited_bonus;
    await renderDetail();

    const summary = await screen.findByRole("region", { name: "購入内容" });
    expect(within(summary).getByText(limitedBonus.presentation.label)).toBeInTheDocument();
    expect(within(summary).getByText("300")).toBeInTheDocument();
    expect(within(summary).getByText("1,400")).toBeInTheDocument();
  });

  it("omits Limited Bonus when canonical presentation visibility is false", async () => {
    const product = PUBLIC_POINT_PRODUCT_FIXTURES.unavailable.data[0];
    await renderDetail({ client: pointClient(PUBLIC_POINT_PRODUCT_FIXTURES.unavailable), productId: product.id });

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("スタンダード1000コイン");
    expect(screen.queryByRole("region", { name: product.limited_bonus.presentation.label })).not.toBeInTheDocument();
    expect(screen.getByText("この商品の販売は終了しました。")).toHaveAttribute("data-eligible", "false");
  });

  it("omits zero normal and inactive Limited Bonus rows while retaining paid and total rows", async () => {
    const inactiveLimited = PUBLIC_POINT_PRODUCT_FIXTURES.unavailable.data[0].limited_bonus;
    const product = {
      ...canonicalProduct,
      grant: { ...canonicalProduct.grant, bonus_points: 0 },
      id: "public-no-bonus-product",
      limited_bonus: inactiveLimited,
    };
    await renderDetail({ client: pointClient({ data: [product] }), productId: product.id });
    const summary = await screen.findByRole("region", { name: "購入内容" });
    expect(within(summary).queryByText("ボーナスコイン")).not.toBeInTheDocument();
    expect(within(summary).queryByText("期間限定ボーナスコイン")).not.toBeInTheDocument();
    expect(within(summary).getByText("獲得コイン")).toBeInTheDocument();
    expect(within(summary).getByText("合計コイン")).toBeInTheDocument();
  });

  it("uses the anonymous collection presentation and treats an expired Session as anonymous", async () => {
    const expired = new ApiProblemError({
      ...PUBLIC_POINT_READ_PROBLEM_FIXTURES.unauthenticated,
      code: "SESSION_EXPIRED",
    });
    const client = pointClient(PUBLIC_POINT_PRODUCT_FIXTURES.anonymous);
    const expiredSessionClient = {
      getCurrentSession: vi.fn().mockRejectedValue(expired),
    } as unknown as AuthClientAdapter;
    await renderDetail({ client, sessionClient: expiredSessionClient });

    expect(await screen.findByText("購入するにはログインが必要です。")).toHaveAttribute("data-eligible", "false");
    expect(client.listPointProducts).toHaveBeenCalledOnce();
    expect(client.getWallet).not.toHaveBeenCalled();
  });

  it("shows Not Found only after a successful collection read with no exact identifier match", async () => {
    const client = pointClient();
    await renderDetail({ client, productId: `${canonicalProduct.id}-unknown` });

    expect(await screen.findByRole("heading", { name: "コイン商品が見つかりません" })).toBeInTheDocument();
    expect(screen.getByText("指定されたコイン商品は公開されていないか、見つかりません。")).toBeInTheDocument();
    expect(client.listPointProducts).toHaveBeenCalledOnce();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("keeps a collection fetch error distinct from Not Found and retries the same read", async () => {
    const client = pointClient();
    client.listPointProducts = vi.fn()
      .mockRejectedValueOnce(new Error("fixture collection failure"))
      .mockResolvedValueOnce({ data: PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible, metadata });
    await renderDetail({ client });

    expect(await screen.findByRole("heading", { name: "コイン商品を取得できませんでした" })).toBeInTheDocument();
    expect(screen.queryByText("コイン商品が見つかりません")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(await screen.findByRole("heading", { level: 1, name: "スタンダード1000コイン" })).toBeInTheDocument();
    expect(client.listPointProducts).toHaveBeenCalledTimes(2);
  });

  it("renders Loading without inventing Product content", async () => {
    const client = pointClient();
    client.listPointProducts = vi.fn(() => new Promise<never>(() => undefined));
    await renderDetail({ client });

    await waitFor(() => expect(client.listPointProducts).toHaveBeenCalledOnce());
    expect(await screen.findByRole("status")).toHaveTextContent("コイン購入詳細を読み込み中");
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /コイン購入へ戻る/ })).toBeInTheDocument();
  });

  it("contains Session failure and configuration-unavailable states before Product reads", async () => {
    const sessionErrorClient = pointClient();
    const sessionFailure = await renderDetail({
      client: sessionErrorClient,
      sessionClient: { getCurrentSession: vi.fn().mockRejectedValue(new Error("fixture session failure")) } as unknown as AuthClientAdapter,
    });
    expect(await screen.findByRole("heading", { name: "コイン購入詳細を表示できません" })).toBeInTheDocument();
    expect(screen.getByText("Sessionを確認できませんでした。時間をおいて再度お試しください。")).toBeInTheDocument();
    expect(sessionErrorClient.listPointProducts).not.toHaveBeenCalled();

    screen.getByRole("link", { name: /コイン購入へ戻る/ });
    sessionFailure.unmount();
    const configuration = await renderDetail({ client: null, sessionClient: null });
    expect(await screen.findByText("この環境ではコイン商品への接続が設定されていません。")).toBeInTheDocument();
    configuration.unmount();
  });

  it("contains long titles and large canonical money/Coin values", async () => {
    const { limited_bonus: omittedLimitedBonus, ...productWithoutLimitedBonus } = canonicalProduct;
    const product = {
      ...productWithoutLimitedBonus,
      id: "public-large-product",
      title: "とても長いコイン商品名".repeat(12),
      price: { amount: 999_999_999_999, currency: "JPY" as const },
      grant: { bonus_points: 0, paid_points: 888_888_888_888, total_points: 1 },
    };
    expect(omittedLimitedBonus).toBeDefined();
    const view = await renderDetail({ client: pointClient({ data: [product] }), productId: product.id });

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("とても長いコイン商品名");
    expect(screen.getByText("￥999,999,999,999")).toBeInTheDocument();
    expect(screen.getAllByText("888,888,888,888")).toHaveLength(2);
    expect(view.container.querySelector(".point-purchase-detail")).toBeInTheDocument();
  });
});
