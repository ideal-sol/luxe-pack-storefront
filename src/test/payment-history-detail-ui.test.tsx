import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProblemError } from "@oripa/storefront-client";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { PaymentClientProvider } from "@/components/payment/payment-client-provider";
import { PaymentHistoryDetail } from "@/components/payment/payment-history-detail";
import type { AuthClientAdapter, Payment, PaymentClientAdapter } from "@/lib/platform";

const metadata = { idempotency_replayed: false, status: 200 } as const;
const auth = {
  getCurrentSession: vi.fn().mockResolvedValue({
    data: { authenticated: true, user: { email_verified: true, id: "user_public_041", state: "active" } },
    metadata,
  }),
} as unknown as AuthClientAdapter;

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    amount: { amount: 10_000, currency: "JPY" },
    created_at: "2026-08-25T06:30:00Z",
    expires_at: "2026-08-28T06:30:00Z",
    grant: { bonus_points: 1_000, limited_bonus_points: 2_000, paid_points: 10_000, total_points: 99_999 },
    id: "payment_public_041",
    method: "credit_card",
    next_action: null,
    point_product_id: "product_public_041",
    status: "succeeded",
    succeeded_at: "2026-08-25T06:30:02Z",
    ...overrides,
  };
}

function renderDetail(result: Payment | Error) {
  const adapter = {
    getPayment: result instanceof Error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue({ data: result, metadata }),
    resumeUnpaidPayment: vi.fn().mockResolvedValue({
      data: { payment_id: "payment_public_041", next_action: { type: "redirect", url: "https://provider.example/existing-payment" } },
      metadata,
    }),
  } as unknown as PaymentClientAdapter;
  render(
    <SessionProvider client={auth}>
      <PaymentClientProvider client={adapter}><PaymentHistoryDetail paymentId="payment_public_041" /></PaymentClientProvider>
    </SessionProvider>,
  );
  return adapter;
}

describe("SITE-041 Payment History detail", () => {
  it("renders the persisted Grant snapshot and never recalculates total Points", async () => {
    renderDetail(payment());
    expect(await screen.findByRole("heading", { name: "購入内容" })).toBeInTheDocument();
    expect(screen.getByText("10,000円")).toBeInTheDocument();
    expect(screen.getByText("10,000コイン")).toBeInTheDocument();
    expect(screen.getByText("1,000コイン")).toBeInTheDocument();
    expect(screen.getByText("2,000コイン")).toBeInTheDocument();
    expect(screen.getByText("99,999コイン")).toBeInTheDocument();
    expect(screen.queryByText("13,000コイン")).not.toBeInTheDocument();
    expect(screen.getByText("クレジットカード")).toBeInTheDocument();
    expect(screen.getByText("2026/08/25 15:30")).toBeInTheDocument();
  });

  it("omits zero bonus rows while retaining paid and total rows", async () => {
    renderDetail(payment({ grant: { bonus_points: 0, limited_bonus_points: 0, paid_points: 10_000, total_points: 10_000 } }));
    await screen.findByRole("heading", { name: "購入内容" });
    expect(screen.queryByText("ボーナスコイン")).not.toBeInTheDocument();
    expect(screen.queryByText("期間限定ボーナスコイン")).not.toBeInTheDocument();
    expect(screen.getByText("獲得コイン")).toBeInTheDocument();
    expect(screen.getByText("合計コイン")).toBeInTheDocument();
  });

  it.each([
    ["konbini", "コンビニ決済"],
    ["virtual_account", "銀行振込"],
  ] as const)("resumes the existing unpaid %s Payment only", async (method, label) => {
    const adapter = renderDetail(payment({ method, status: "created", succeeded_at: null }));
    expect(await screen.findByText(label)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "振込案内ページ" }));
    await waitFor(() => expect(adapter.resumeUnpaidPayment).toHaveBeenCalledWith("payment_public_041"));
    expect(Object.keys(adapter)).not.toContain("startPayment");
  });

  it("shows a disabled expired control without href or resume mutation", async () => {
    const adapter = renderDetail(payment({ method: "konbini", status: "expired", succeeded_at: null }));
    const button = await screen.findByRole("button", { name: "有効期限切れ" });
    expect(button).toBeDisabled();
    expect(button.closest("a")).toBeNull();
    fireEvent.click(button);
    expect(adapter.resumeUnpaidPayment).not.toHaveBeenCalled();
  });

  it("contains unknown and other-user reads without disclosing the cause", async () => {
    renderDetail(new ApiProblemError({ code: "FORBIDDEN", detail: "ownership private reason", request_id: "private-request", retryable: false, status: 403, title: "Forbidden", type: "about:blank" }));
    expect(await screen.findByText("購入詳細を表示できません")).toBeInTheDocument();
    expect(screen.getByText("エラーが発生しました。")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/FORBIDDEN|ownership private reason|private-request|payment_public_041/);
  });
});
