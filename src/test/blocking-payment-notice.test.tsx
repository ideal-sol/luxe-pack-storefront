import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApiProblemError, type PublicComponents } from "@oripa/storefront-client";
import { PUBLIC_POINT_PRODUCT_FIXTURES } from "@oripa/storefront-testkit";
import { BlockingPaymentNotice } from "@/components/payment/blocking-payment-notice";
import { beginPaymentAttempt, finishPaymentAttempt, readPaymentAttempt } from "@/components/payment/payment-attempt";
import { STRIPE_OFFER_REFRESH } from "@/lib/platform/stripe-checkout-leave";

const gateway = vi.hoisted(() => ({ cancelPayment: vi.fn(), getPayment: vi.fn(), startPayment: vi.fn() }));
vi.mock("@/components/payment/payment-client-provider", () => ({ usePaymentClient: () => ({ uiGateway: gateway }) }));
const sample = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_pending.first_user_offer.blocking_payments[0];
const subject = "notice-member";
type Row = PublicComponents["schemas"]["BlockingPayment"];
const row: Row = { ...sample, blocks_point_product_ids: ["blocked-version"], started_at: "2026-11-27T04:05:00Z" };
const assign = vi.fn(), replace = vi.fn(), refresh = vi.fn();
const button = (name: string) => screen.getByRole("button", { name });
const mount = (changes: Partial<Row> = {}) => render(<BlockingPaymentNotice subject={subject} payments={[{ ...row, ...changes }]} />);
const cancel = async () => {
  fireEvent.click(button("取り消して選び直す"));
  expect(screen.getByText(/この決済を取り消します。取り消すと/)).toBeVisible();
  await act(async () => { fireEvent.click(button("取り消す")); });
};
const seed = (id: string) => beginPaymentAttempt(subject, {
  productId: "original-product", paymentId: id, idempotencyKey: "original-key", stripe: { method: "credit_card", cancelKey: "cancel-key" },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", new Proxy(window, { get(target, key) {
    return key === "location" ? { origin: "https://shop.example.test", assign, replace } : Reflect.get(target, key);
  } }));
  window.addEventListener(STRIPE_OFFER_REFRESH, refresh);
});
afterEach(() => {
  cleanup(); window.removeEventListener(STRIPE_OFFER_REFRESH, refresh);
  const saved = readPaymentAttempt(subject);
  if (saved) finishPaymentAttempt(subject, saved.idempotencyKey);
  vi.useRealTimers(); vi.unstubAllGlobals();
});

it.each([
  [{ cancellation_pending: true }, ["状態を確認する"], "取消の結果を確認中です。反映まで数分かかることがあります"],
  [{ status: "created", auto_release_at: null }, ["お支払いを続ける", "取り消して選び直す"], "この決済が終わるまで"],
  [{ resumable: false, method: "paidy" }, ["取り消して選び直す"], "この決済が終わるまで"],
  [{ cancel_restores_offer: false, cancellable: false }, ["お支払いを続ける"], "この決済のお支払いが完了すると"],
  [{ cancel_restores_offer: false, resumable: false, cancellable: false }, [], "支払い番号・振込先は購入履歴"],
  [{ cancellable: false, auto_release_at: "2026-11-27T04:01:10Z" }, [], "13時5分ごろに自動で取り消されます"],
  [{ cancellable: false, auto_release_at: null }, ["状態を確認する"], "決済の状況を確認中です。確認が終わるまでお待ちください"],
] as [Partial<Row>, string[], string][])("uses the first applicable display rule for %o", (changes, buttons, text) => {
  mount(changes);
  expect(screen.getByText(new RegExp(text))).toBeVisible();
  expect(screen.queryAllByRole("button").map(item => item.textContent)).toEqual(buttons);
  expect(screen.getByText(/13:05 に開始/)).toBeVisible();
});
it("omits only the active payment and retains other notices", () => {
  render(<BlockingPaymentNotice subject={subject} payments={[row, { ...row, id: "another", point_product_name: "別の商品" }]} activeId={row.id} />);
  expect(screen.getAllByText(/お支払い手続きの途中/)).toHaveLength(1);
  expect(screen.getByText(/別の商品／/)).toBeVisible();
});
it.each(["canceled","expired","succeeded"])("finishes its own attempt only after %s", async status => {
  seed(row.id);
  gateway.cancelPayment.mockResolvedValue({ data: { id: row.id, status } });
  mount();
  await cancel();
  expect(gateway.cancelPayment).toHaveBeenCalledExactlyOnceWith(row.id, expect.objectContaining({ idempotency_key: "cancel-key", timeout_ms: 5000 }));
  expect(readPaymentAttempt(subject)).toBeNull();
  expect(refresh).toHaveBeenCalledTimes(1);
  if (status === "succeeded") expect(replace).toHaveBeenCalledWith(expect.stringContaining("/thanks?pid="));
  else expect(screen.getByText("取り消しました")).toBeVisible();
});
it("retains an unrelated attempt after cancellation", async () => {
  seed("another");
  const saved = readPaymentAttempt(subject);
  gateway.cancelPayment.mockResolvedValue({ data: { id: row.id, status: "expired" } });
  mount(); await cancel();
  expect(readPaymentAttempt(subject)).toEqual(saved);
});
it("retains the lock for a non-terminal cancellation and for a 409", async () => {
  seed(row.id);
  gateway.cancelPayment.mockResolvedValueOnce({ data: { id: row.id, status: "processing", cancellation_pending: true } });
  const view = mount(); await cancel();
  expect(screen.getByText(/取消の結果を確認できませんでした。反映まで/)).toBeVisible();
  fireEvent.click(button("状態を確認する"));
  expect(screen.queryByRole("button", { name: "お支払いを続ける" })).toBeNull();
  view.rerender(<BlockingPaymentNotice subject={subject} payments={[{ ...row }]} />);
  gateway.cancelPayment.mockRejectedValueOnce(new ApiProblemError({ type: "about:blank", title: "conflict", status: 409, code: "PAYMENT_NOT_CANCELLABLE", request_id: "fixture", retryable: false }));
  await cancel();
  expect(screen.getByText("この決済は取り消せません")).toBeVisible();
  expect(readPaymentAttempt(subject)?.paymentId).toBe(row.id);
});
it("bounds the entire request, rejects a second submission and retries with the same key", async () => {
  vi.useFakeTimers();
  gateway.cancelPayment.mockImplementationOnce(() => new Promise(() => {})).mockRejectedValueOnce(new Error("offline"));
  mount();
  fireEvent.click(button("取り消して選び直す"));
  const confirm = button("取り消す");
  await act(async () => { confirm.click(); confirm.click(); });
  expect(gateway.cancelPayment).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(gateway.cancelPayment.mock.calls[0]![1].signal.aborted).toBe(true);
  expect(screen.queryByText("取り消しました")).toBeNull();
  expect(screen.getByText("取消の結果を確認できませんでした")).toBeVisible();
  await act(async () => fireEvent.click(button("もう一度取り消す")));
  expect(gateway.cancelPayment.mock.calls[1]![1].idempotency_key).toBe(gateway.cancelPayment.mock.calls[0]![1].idempotency_key);
});
it.each(["remote","same","other","wrong-provider","pending"])("validates the owned Stripe payment before resuming (%s)", async situation => {
  if (situation === "same" || situation === "other") seed(situation === "same" ? row.id : "unrelated");
  const saved = readPaymentAttempt(subject);
  gateway.getPayment.mockResolvedValue({ data: { id: row.id, method: "credit_card", provider_sync: situation !== "wrong-provider",
    status: "created", point_product_id: "original-product", cancellation_pending: situation === "pending" } });
  mount();
  await act(async () => fireEvent.click(button("お支払いを続ける")));
  expect(gateway.getPayment).toHaveBeenCalledWith(row.id);
  expect(gateway.startPayment).not.toHaveBeenCalled();
  if (situation === "remote" || situation === "same") {
    expect(assign).toHaveBeenCalledWith("/points/purchase/original-product");
    expect(readPaymentAttempt(subject)).toMatchObject({ productId: "original-product", paymentId: row.id });
  } else {
    expect(assign).not.toHaveBeenCalled(); expect(readPaymentAttempt(subject)).toEqual(saved);
  }
});
