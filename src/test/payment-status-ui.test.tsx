import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beginPaymentAttempt, finishPaymentAttempt, readPaymentAttempt } from "@/components/payment/payment-attempt";
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

function renderThanks(adapter: PaymentClientAdapter, pid: string | null = "payment-public-reference", smsVerified = true) {
  const auth = {
    getCurrentSession: vi.fn().mockResolvedValue({ data: PUBLIC_AUTH_FIXTURE.authenticated_session, metadata }),
    getSmsVerificationStatus: vi.fn().mockResolvedValue({ data: { verified: smsVerified, phone: null, phone_masked: null, verified_at: null, challenge: null }, metadata }),
  } as unknown as AuthClientAdapter;
  return render(
    <SessionProvider client={auth}>
      <PaymentClientProvider client={adapter}>
        <PaymentThanks pid={pid} />
      </PaymentClientProvider>
    </SessionProvider>,
  );
}

describe("UnivaPay confirmed-owner result screen", () => {
  const subject = PUBLIC_AUTH_FIXTURE.authenticated_session.user!.id;
  beforeEach(() => {
    const old = readPaymentAttempt(subject); if (old) finishPaymentAttempt(subject, old.idempotencyKey);
    beginPaymentAttempt(subject, { productId: "product-public-reference", paymentId: "payment-public-reference", idempotencyKey: "univapay-attempt" });
    refreshWallet.mockClear();
  });
  afterEach(() => { const old = readPaymentAttempt(subject); if (old) finishPaymentAttempt(subject, old.idempotencyKey); vi.useRealTimers(); });
  it.each(["requires_action", "processing"] as const)("shows 決済確認中 for owned %s then the existing success UI after delayed settlement", async status => {
    vi.useFakeTimers(); const adapter = client(payment(status));
    await act(async () => renderThanks(adapter));
    expect(screen.getByRole("heading", { name: "決済確認中" })).toBeInTheDocument();
    expect(refreshWallet).not.toHaveBeenCalled();
    vi.mocked(adapter.getPayment).mockResolvedValue({ data: payment("succeeded"), metadata });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.getByRole("heading", { name: "購入完了しました" })).toBeInTheDocument();
    expect(refreshWallet).toHaveBeenCalledOnce();
  });
  it("retains checking after the bound and permits only a single in-flight GET recheck", async () => {
    vi.useFakeTimers(); const adapter = client(payment("processing"));
    await act(async () => renderThanks(adapter));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByRole("heading", { name: "決済確認中" })).toBeInTheDocument();
    let resolve!: (value: { data: Payment; metadata: typeof metadata }) => void;
    vi.mocked(adapter.getPayment).mockReturnValue(new Promise(r => { resolve = r; }));
    const prior = vi.mocked(adapter.getPayment).mock.calls.length;
    const retry = screen.getByRole("button", { name: "決済状況を再確認する" });
    await act(async () => { fireEvent.click(retry); });
    fireEvent.click(retry); expect(retry).toBeDisabled();
    expect(adapter.getPayment).toHaveBeenCalledTimes(prior + 1);
    await act(async () => resolve({ data: payment("succeeded"), metadata }));
    expect(screen.getByRole("heading", { name: "購入完了しました" })).toBeInTheDocument();
  });
  it("retains owner-verified checking on transient API errors, but not on authorization failure", async () => {
    vi.useFakeTimers(); const adapter = client(payment("processing"));
    await act(async () => renderThanks(adapter));
    vi.mocked(adapter.getPayment).mockRejectedValue(new Error("temporary"));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.getByRole("heading", { name: "決済確認中" })).toBeInTheDocument();
    vi.mocked(adapter.getPayment).mockRejectedValue(new ApiProblemError({ code: "FORBIDDEN", detail: "fixture", request_id: "fixture", retryable: false, status: 403, title: "Forbidden", type: "about:blank" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "決済状況を再確認する" })); });
    expect(screen.getByRole("heading", { name: "エラー" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "決済確認中" })).not.toBeInTheDocument();
  });
  it("clears the failed purchase lock but retains display-only context across reload", async () => {
    finishPaymentAttempt(subject, "univapay-attempt");
    beginPaymentAttempt(subject, { productId: "product-public-reference", paymentId: "failed-univapay-reference", idempotencyKey: "failed-key" });
    const adapter = client({ ...payment("failed"), id: "failed-univapay-reference" });
    const view = renderThanks(adapter, "failed-univapay-reference");
    expect(await screen.findByText("入力されたカードが使用できません、他のカードでお試しください。")).toBeInTheDocument();
    await waitFor(() => expect(readPaymentAttempt(subject)).toBeNull());
    view.unmount(); renderThanks(adapter, "failed-univapay-reference");
    expect(await screen.findByText("入力されたカードが使用できません、他のカードでお試しください。")).toBeInTheDocument();
    expect(readPaymentAttempt(subject)).toBeNull();
    expect(refreshWallet).not.toHaveBeenCalled();
  });
  it("keeps Paidy read-error behavior even with an existing provider correlation", async () => {
    vi.useFakeTimers(); const adapter = client({ ...payment("processing"), method: "paidy" });
    await act(async () => renderThanks(adapter));
    vi.mocked(adapter.getPayment).mockRejectedValue(new Error("temporary"));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.getByRole("heading", { name: "エラー" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "決済確認中" })).not.toBeInTheDocument();
  });
});

describe("SITE-040 / SITE-047 Payment status UI", () => {
  it("keeps in-progress Payment status readable but withholds unpaid resume before SMS", async () => {
    const adapter = client({ ...payment("processing"), method: "konbini" });
    renderThanks(adapter, "payment-public-reference", false);
    await screen.findByRole("heading", { name: "コンビニ決済のご案内" });
    await screen.findByRole("link", { name: "SMS認証へ" });
    expect(adapter.getPayment).toHaveBeenCalled();
    expect(adapter.resumeUnpaidPayment).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "コンビニ決済案内ページへ" })).not.toBeInTheDocument();
  });
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
    await screen.findByText("お支払いを確認しています");
    expect(screen.queryByRole("button", { name: /案内ページへ/ })).not.toBeInTheDocument();
    expect(adapter.resumeUnpaidPayment).not.toHaveBeenCalled();
  });

  it.each([
    ["failed", "決済が失敗しました。"],
    ["succeeded", "お支払いが完了しました。"],
    ["created", "お支払いを確認しています。購入履歴から確認してください。"],
    ["requires_action", "お支払いを確認しています。購入履歴から確認してください。"],
    ["processing", "お支払いを確認しています。購入履歴から確認してください。"],
    ["canceled", "決済をキャンセルしました。"],
    ["expired", "決済の有効期限が切れました。"],
  ] as const)("presents canonical purchase return status %s without inferring from the return URL", async (status, copy) => {
    const adapter = returnClient(payment(status));
    render(<PaymentReturnAlert client={adapter} pid="payment-public-reference" productId="product-public-reference" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
    expect(adapter.getPayment).toHaveBeenCalledWith("payment-public-reference");
    expect(screen.queryByText("決済処理中")).not.toBeInTheDocument();
    expectNoReturnMutation(adapter);
  });

  it("shows pending Return first, then the canonical terminal failure after remount", async () => {
    const adapter = returnClient(payment("requires_action"));
    vi.mocked(adapter.getPayment)
      .mockResolvedValueOnce({ data: payment("requires_action"), metadata })
      .mockResolvedValueOnce({ data: payment("failed"), metadata });
    const first = render(<PaymentReturnAlert client={adapter} pid="payment-public-reference" productId="product-public-reference" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("お支払いを確認しています。購入履歴から確認してください。");
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
