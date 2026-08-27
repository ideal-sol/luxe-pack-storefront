import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
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

describe("SITE-040 Payment status UI", () => {
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
    ["konbini", "コンビニ決済のご案内", "コンビニ決済案内ページへ", "コンビニ決済情報"],
    ["virtual_account", "銀行振込のご案内", "銀行振込案内ページへ", "銀行振込情報"],
  ] as const)("shows the %s unpaid guide and reuses the existing Payment", async (method, title, cta, information) => {
    const adapter = client(payment("created", method));
    renderThanks(adapter);
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText("￥12,345")).toBeInTheDocument();
    expect(screen.getByText(information)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: cta }));
    await waitFor(() => expect(adapter.resumeUnpaidPayment).toHaveBeenCalledWith("payment-public-reference"));
    expect(Object.keys(adapter)).not.toContain("startPayment");
  });

  it("presents resume failure and never falls back to next_action.url", async () => {
    const adapter = client(payment("created", "konbini"));
    vi.mocked(adapter.resumeUnpaidPayment).mockRejectedValue(new Error("fixture resume failure"));
    renderThanks(adapter);
    fireEvent.click(await screen.findByRole("button", { name: "コンビニ決済案内ページへ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("エラーが発生しました。時間をおいて、もう一度お試しください。");
    expect(adapter.resumeUnpaidPayment).toHaveBeenCalledOnce();
  });

  it.each([
    ["failed", "決済が失敗しました。"],
    ["canceled", "決済をキャンセルしました。"],
  ] as const)("uses getPayment for purchase return status %s", async (status, copy) => {
    const adapter = client(payment(status));
    render(<PaymentReturnAlert client={adapter} pid="payment-public-reference" productId="product-public-reference" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
    expect(adapter.getPayment).toHaveBeenCalledWith("payment-public-reference");
  });

  it("gives canonical succeeded status priority on a failure Return race", async () => {
    const adapter = client(payment("succeeded"));
    const replace = vi.fn();
    render(<PaymentReturnAlert client={adapter} pid="payment-public-reference" productId="product-public-reference" replace={replace} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/points/purchase/thanks?pid=payment-public-reference"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
