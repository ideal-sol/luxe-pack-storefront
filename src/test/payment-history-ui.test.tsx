import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import { SessionProvider } from "@/components/auth/session-provider";
import { PaymentClientProvider } from "@/components/payment/payment-client-provider";
import { PaymentHistoryPage } from "@/components/payment/payment-history-page";
import type { AuthClientAdapter, Payment, PaymentClientAdapter } from "@/lib/platform";

const metadata = { idempotency_replayed: false, status: 200 } as const;
const auth = {
  getCurrentSession: vi.fn().mockResolvedValue({
    data: { authenticated: true, user: { email_verified: true, id: "user_public_041", state: "active" } },
    metadata,
  }),
} as unknown as AuthClientAdapter;

function payment(id: string, method: Payment["method"] = "credit_card", status: Payment["status"] = "succeeded"): Payment {
  return {
    amount: { amount: 10_000, currency: "JPY" },
    created_at: "2026-08-25T06:30:00Z",
    expires_at: "2026-08-28T06:30:00Z",
    grant: { bonus_points: 1_000, limited_bonus_points: 2_000, paid_points: 10_000, total_points: 13_000 },
    id,
    method,
    next_action: null,
    point_product_id: "product_public_041",
    status,
    succeeded_at: status === "succeeded" ? "2026-08-25T06:30:02Z" : null,
  };
}

function collection(data: readonly Payment[], nextCursor: string | null = null) {
  return { data, pagination: { has_more: nextCursor !== null, limit: 10, next_cursor: nextCursor } };
}

function renderHistory(listPayments: PaymentClientAdapter["listPayments"]) {
  const adapter = { listPayments } as PaymentClientAdapter;
  render(
    <SessionProvider client={auth}>
      <PaymentClientProvider client={adapter}><PaymentHistoryPage /></PaymentClientProvider>
    </SessionProvider>,
  );
  return adapter;
}

describe("SITE-041 Payment History list", () => {
  it("defaults to succeeded, shows paid Points only, maps methods, and has no column headers", async () => {
    const items = [
      payment("pay_credit", "credit_card"),
      payment("pay_paypay", "paypay"),
      payment("pay_konbini", "konbini"),
      payment("pay_va", "virtual_account"),
    ];
    const listPayments = vi.fn().mockResolvedValue({ data: collection(items), metadata });
    renderHistory(listPayments);
    expect(await screen.findByRole("tab", { name: "購入履歴", selected: true })).toBeInTheDocument();
    expect(listPayments).toHaveBeenCalledWith({ limit: 10, view: "succeeded" });
    for (const label of ["クレジットカード", "PayPay", "コンビニ決済", "銀行振込"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText("10,000コイン")).toHaveLength(4);
    expect(screen.queryByText("13,000コイン")).not.toBeInTheDocument();
    for (const header of ["購入日時", "決済種別", "獲得コイン数", "購入金額"]) {
      expect(screen.queryByText(header)).not.toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /クレジットカード/ })).toHaveAttribute("href", "/mypage/purchases/pay_credit");
  });

  it("switches to the canonical unpaid view and exposes selected state", async () => {
    const listPayments = vi.fn()
      .mockResolvedValueOnce({ data: collection([payment("paid")]), metadata })
      .mockResolvedValueOnce({ data: collection([payment("unpaid", "konbini", "created")]), metadata });
    renderHistory(listPayments);
    await screen.findByText("クレジットカード");
    fireEvent.click(screen.getByRole("tab", { name: "未払い" }));
    expect(await screen.findByRole("tab", { name: "未払い", selected: true })).toHaveClass("payment-history-tab--selected");
    expect(await screen.findByText("コンビニ決済")).toBeInTheDocument();
    expect(listPayments).toHaveBeenLastCalledWith({ limit: 10, view: "unpaid" });
  });

  it("preserves the opaque cursor for continuation", async () => {
    const listPayments = vi.fn()
      .mockResolvedValueOnce({ data: collection([payment("first")], "opaque/cursor?site=041"), metadata })
      .mockResolvedValueOnce({ data: collection([payment("second", "paypay")]), metadata });
    renderHistory(listPayments);
    fireEvent.click(await screen.findByRole("button", { name: "さらに表示" }));
    await waitFor(() => expect(listPayments).toHaveBeenLastCalledWith({ cursor: "opaque/cursor?site=041", limit: 10, view: "succeeded" }));
    expect(await screen.findByText("PayPay")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("opaque/cursor?site=041");
  });

  it("renders accessible empty and safe error states", async () => {
    renderHistory(vi.fn().mockResolvedValue({ data: collection([]), metadata }));
    expect(await screen.findByText("購入履歴はありません")).toBeInTheDocument();
  });

  it("contains list failures without exposing raw details", async () => {
    renderHistory(vi.fn().mockRejectedValue(new Error("private payment failure SITE-041")));
    const error = await screen.findByText("購入履歴を取得できませんでした");
    expect(within(error.closest("section") ?? document.body).queryByText(/private payment failure/)).not.toBeInTheDocument();
    expect(screen.getByText("エラーが発生しました。")).toBeInTheDocument();
  });
});
