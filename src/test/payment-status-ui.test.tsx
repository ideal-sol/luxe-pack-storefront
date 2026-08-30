import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import { PUBLIC_AUTH_FIXTURE } from "@oripa/storefront-testkit";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { PaymentClientProvider } from "@/components/payment/payment-client-provider";
import { PaymentReturnAlert } from "@/components/payment/payment-return-alert";
import { PaymentThanks } from "@/components/payment/payment-thanks";
import type { AuthClientAdapter, Payment, PaymentClientAdapter } from "@/lib/platform";

const { refreshWallet } = vi.hoisted(() => ({ refreshWallet: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/components/points/point-client-provider", () => ({ usePointClient: () => ({ refreshWallet }) }));

const metadata = { idempotency_replayed: false, status: 200 } as const;

function payment(
  status: Payment["status"],
  method: Payment["method"] = "credit_card",
): Payment {
  return {
    amount: { amount: 12_345, currency: "JPY" },
    created_at: "2026-08-26T00:00:00Z",
    expires_at: "2026-08-29T15:00:00Z",
    grant: { bonus_points: 1_000, limited_bonus_points: 2_000, paid_points: 10_000, total_points: 13_000 },
    id: "payment-public-reference",
    method,
    next_action: null,
    point_product_id: "product-public-reference",
    status,
    succeeded_at: status === "succeeded" ? "2026-08-26T00:00:01Z" : null,
  };
}

function client(result: Payment | Error): PaymentClientAdapter {
  return {
    getPayment: result instanceof Error
      ? vi.fn().mockRejectedValue(result)
      : vi.fn().mockResolvedValue({ data: result, metadata }),
    resumeUnpaidPayment: vi.fn().mockResolvedValue({
      data: { payment_id: "payment-public-reference", next_action: { type: "redirect", url: "https://provider.example/unpaid" } },
      metadata,
    }),
  } as unknown as PaymentClientAdapter;
}

function returnClient(result: Payment | Error) {
  const adapter = client(result);
  return Object.assign(adapter, {
    cancelCardRegistration: vi.fn(),
    deleteCard: vi.fn(),
    getCardRegistration: vi.fn(),
    reconcileCardRegistration: vi.fn(),
    startCardRegistration: vi.fn(),
    startPayment: vi.fn(),
  });
}

function expectNoReturnMutation(adapter: ReturnType<typeof returnClient>) {
  expect(adapter.cancelCardRegistration).not.toHaveBeenCalled();
  expect(adapter.deleteCard).not.toHaveBeenCalled();
  expect(adapter.getCardRegistration).not.toHaveBeenCalled();
  expect(adapter.reconcileCardRegistration).not.toHaveBeenCalled();
  expect(adapter.resumeUnpaidPayment).not.toHaveBeenCalled();
  expect(adapter.startCardRegistration).not.toHaveBeenCalled();
  expect(adapter.startPayment).not.toHaveBeenCalled();
}

function renderThanks(adapter: PaymentClientAdapter, pid: string | null = "payment-public-reference") {
  const auth = { getCurrentSession: vi.fn().mockResolvedValue({ data: PUBLIC_AUTH_FIXTURE.authenticated_session, metadata }) } as unknown as AuthClientAdapter;
  render(
    <SessionProvider client={auth}>
      <PaymentClientProvider client={adapter}>
        <PaymentThanks pid={pid} />
      </PaymentClientProvider>
    </SessionProvider>,
  );
}

describe("SITE-040 / SITE-047 Payment status UI", () => {
  beforeEach(() => refreshWallet.mockClear());

  it("retains the minimal success copy and links to Purchase History", async () => {
    renderThanks(client(payment("succeeded")));
    expect(await screen.findByRole("heading", { name: "購入完了しました" })).toBeInTheDocument();
    expect(screen.getByText("コイン購入して頂き、ありがとうございます。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "購入履歴" })).toHaveAttribute("href", "/mypage/purchases");
    expect(document.body).not.toHaveTextContent(/12,345|payment-public-reference/);
    await waitFor(() => expect(refreshWallet).toHaveBeenCalledOnce());
  });

  it.each([
    ["failed", "決済が失敗しました"],
    ["canceled", "決済をキャンセルしました"],
    ["expired", "お支払い期限が切れました"],
  ] as const)("renders canonical %s terminal UI", async (status, title) => {
    renderThanks(client(payment(status)));
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(refreshWallet).not.toHaveBeenCalled();
  });

  it.each([
    [null, null],
    ["malformed/id", null],
    ["unknown", new ApiProblemError({ code: "NOT_FOUND", detail: "fixture", request_id: "request-public-reference", retryable: false, status: 404, title: "Not Found", type: "about:blank" })],
    ["other-user", new ApiProblemError({ code: "FORBIDDEN", detail: "fixture", request_id: "request-public-reference", retryable: false, status: 403, title: "Forbidden", type: "about:blank" })],
  ] as const)("contains invalid or unauthorized pid without disclosing the cause", async (pid, problem) => {
    renderThanks(client(problem ?? payment("succeeded")), pid);
    expect(await screen.findByRole("heading", { name: "エラー" })).toBeInTheDocument();
    expect(screen.getByText("エラーが発生しました。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "マイページへ戻る" })).toHaveAttribute("href", "/mypage");
    expect(document.body).not.toHaveTextContent(/NOT_FOUND|FORBIDDEN|payment-public-reference|other-user/);
  });

  it.each([
    ["konbini", "requires_action", "コンビニ決済のご案内", "コンビニ決済案内ページへ", "コンビニ決済情報"],
    ["virtual_account", "requires_action", "銀行振込のご案内", "銀行振込案内ページへ", "銀行振込情報"],
    ["konbini", "processing", "コンビニ決済のご案内", "コンビニ決済案内ページへ", "コンビニ決済情報"],
    ["virtual_account", "processing", "銀行振込のご案内", "銀行振込案内ページへ", "銀行振込情報"],
  ] as const)("shows the %s %s unpaid guide and reuses the existing Payment", async (method, status, title, cta, information) => {
    const adapter = client(payment(status, method));
    renderThanks(adapter);
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText("￥12,345")).toBeInTheDocument();
    expect(screen.getByText(information)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: cta }));
    await waitFor(() => expect(adapter.resumeUnpaidPayment).toHaveBeenCalledWith("payment-public-reference"));
    expect(Object.keys(adapter)).not.toContain("startPayment");
    const source = readFileSync("src/components/payment/payment-thanks.tsx", "utf8");
    expect(source).toContain("window.location.assign(data.next_action.url)");
  });

  it.each([
    [
      new ApiProblemError({ code: "PAYMENT_NOT_RESUMABLE", detail: "fixture", request_id: "request-public-reference", retryable: false, status: 409, title: "Conflict", type: "about:blank" }),
      "決済処理を完了できませんでした。時間をおいて、もう一度お試しください。",
    ],
    [
      new StorefrontTransportError("NETWORK_ERROR", "fixture result unknown"),
      "通信結果を確認できませんでした。同じ操作を繰り返さず、時間をおいて状態をご確認ください。",
    ],
  ])("presents a safe resume failure without creating a replacement Payment", async (failure, message) => {
    const adapter = client(payment("requires_action", "konbini"));
    vi.mocked(adapter.resumeUnpaidPayment).mockRejectedValue(failure);
    renderThanks(adapter);
    fireEvent.click(await screen.findByRole("button", { name: "コンビニ決済案内ページへ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(adapter.resumeUnpaidPayment).toHaveBeenCalledOnce();
    expect(Object.keys(adapter)).not.toContain("startPayment");
  });

  it.each([
    ["credit_card", "processing"],
    ["paypay", "requires_action"],
  ] as const)("does not offer unpaid resume for invalid method %s in %s", async (method, status) => {
    const adapter = client(payment(status, method));
    renderThanks(adapter);
    await screen.findByText("決済処理中");
    expect(screen.queryByRole("button", { name: /案内ページへ/ })).not.toBeInTheDocument();
    expect(adapter.resumeUnpaidPayment).not.toHaveBeenCalled();
  });

  it.each([
    ["failed", "決済が失敗しました。"],
    ["succeeded", "決済が失敗しました。"],
    ["created", "決済が失敗しました。"],
    ["requires_action", "決済が失敗しました。"],
    ["processing", "決済が失敗しました。"],
    ["canceled", "決済をキャンセルしました。"],
    ["expired", "決済の有効期限が切れました。"],
  ] as const)("keeps purchase return status %s on the failure screen", async (status, copy) => {
    const adapter = returnClient(payment(status));
    render(<PaymentReturnAlert client={adapter} pid="payment-public-reference" productId="product-public-reference" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
    expect(adapter.getPayment).toHaveBeenCalledWith("payment-public-reference");
    expect(screen.queryByText("決済処理中")).not.toBeInTheDocument();
    expectNoReturnMutation(adapter);
  });

  it("keeps the canonical failure screen when a pending Card Return remounts after terminal failure", async () => {
    const adapter = returnClient(payment("requires_action"));
    vi.mocked(adapter.getPayment)
      .mockResolvedValueOnce({ data: payment("requires_action"), metadata })
      .mockResolvedValueOnce({ data: payment("failed"), metadata });
    const first = render(<PaymentReturnAlert client={adapter} pid="payment-public-reference" productId="product-public-reference" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("決済が失敗しました。");
    first.unmount();
    render(<PaymentReturnAlert client={adapter} pid="payment-public-reference" productId="product-public-reference" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("決済が失敗しました。");
    expect(adapter.getPayment).toHaveBeenCalledTimes(2);
    expectNoReturnMutation(adapter);
  });

  it.each(["paypay", "konbini", "virtual_account"] as const)("keeps %s failure Return read-only", async (method) => {
    const adapter = returnClient(payment("failed", method));
    render(<PaymentReturnAlert client={adapter} pid="payment-public-reference" productId="product-public-reference" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("決済が失敗しました。");
    expectNoReturnMutation(adapter);
  });

  it("contains an invalid failure Return pid without a read, mutation, or navigation", () => {
    const adapter = returnClient(payment("failed"));
    render(<PaymentReturnAlert client={adapter} pid="malformed/id" productId="product-public-reference" />);
    expect(screen.getByRole("alert")).toHaveTextContent("決済情報を確認できませんでした。");
    expect(adapter.getPayment).not.toHaveBeenCalled();
    expectNoReturnMutation(adapter);
  });

  it("contains failure Return navigation inside the purchase page", () => {
    const source = readFileSync("src/components/payment/payment-return-alert.tsx", "utf8");
    expect(source).not.toContain("window.location");
    expect(source).not.toContain("/points/purchase/thanks");
    expect(source).not.toContain('status: "redirecting"');
  });
});
