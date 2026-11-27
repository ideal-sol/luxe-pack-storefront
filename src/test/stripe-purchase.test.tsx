import { StrictMode, type ReactNode } from "react";
import { ApiProblemError, USER_XSRF_COOKIE, XSRF_TOKEN_HEADER } from "@oripa/storefront-client";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beginPaymentAttempt, finishPaymentAttempt, readPaymentAttempt } from "@/components/payment/payment-attempt";
import { validateStripeAction } from "@/components/payment/provider-payment-actions";
import { BlockingPaymentNotice } from "@/components/payment/blocking-payment-notice";
import { PUBLIC_POINT_PRODUCT_FIXTURES } from "@oripa/storefront-testkit";
import { StripePurchase } from "@/components/payment/stripe-purchase";
import { StripeCardElement } from "@/components/payment/stripe-card-element";
import type { UiPayment } from "@/lib/platform/payment-ui-gateway";

const sdk = vi.hoisted(() => ({ confirm: vi.fn(), element: vi.fn(), load: vi.fn() }));
vi.mock("@stripe/stripe-js/pure", () => ({ loadStripe: sdk.load }));
vi.mock("@stripe/react-stripe-js/checkout", () => ({
  CheckoutElementsProvider: ({ children }: { children: ReactNode }) => children,
  PaymentElement: ({ options }: { options: unknown }) => { sdk.element(options); return <div>カード入力欄</div>; },
  useCheckoutElements: () => ({ type: "success", checkout: { confirm: sdk.confirm } }),
}));
vi.mock("next/dynamic", () => ({ default: () => (props: Parameters<typeof StripeCardElement>[0]) => <StripeCardElement {...props} /> }));
const api = vi.hoisted(() => ({ startPayment: vi.fn(), getPayment: vi.fn(), resumeStripeCheckout: vi.fn(), cancelStripeCheckout: vi.fn(), syncStripePayment: vi.fn() }));
vi.mock("@/components/payment/payment-client-provider", () => ({ usePaymentClient: () => ({ uiGateway: api }) }));

const pid = "stripe-payment-test";
const subject = "member-test";
const productId = "product-test";
const origin = "https://shop.example.test";
const returnUrl = origin + "/points/purchase/thanks?pid=" + pid;
const cancelKey = "original-cancel-key";
const replace = vi.fn();
const assign = vi.fn();
const send = vi.fn();
function action() {
  return { type: "stripe_checkout", client_secret: ["cs", "test", "fixture", "secret", "value"].join("_"),
    publishable_key: ["pk", "test", "fixture"].join("_"), return_url: returnUrl, expires_at: new Date(Date.now()+2100000).toISOString() };
}
function payment(fields: Partial<UiPayment> = {}): UiPayment {
  return { id: pid, method: "credit_card", amount: { currency: "JPY", amount: 1000 }, point_product_id: productId, next_action: action(),
    provider_sync: true, cancellation_pending: false, status: "requires_action", expires_at: null, succeeded_at: null,
    grant: { paid_points: 1000, bonus_points: 0, limited_bonus_points: 0, total_points: 1000 }, created_at: "2026-11-25T00:00:00Z", ...fields };
}
const response = (fields: Partial<UiPayment> = {}) => ({ data: payment(fields) });
function seed(paymentId: string | null = pid) {
  beginPaymentAttempt(subject, { productId, paymentId, idempotencyKey: "existing-start-key", stripe: { method: "credit_card", cancelKey } });
}
const purchase = (routeProduct: string) => <StrictMode><StripePurchase key={routeProduct} subject={subject} productId={routeProduct}>
  {({ start }) => <button onClick={start}>カード情報の入力へ進む</button>}
</StripePurchase></StrictMode>;
const mount = (routeProduct = productId) => render(purchase(routeProduct));
const button = (text: string) => screen.getByRole("button", { name: text });
const input = () => screen.findByText("カード入力欄");
function hide() { window.dispatchEvent(new Event("pagehide")); }
function restore() { const event = new Event("pageshow"); Object.defineProperty(event, "persisted", { value: true }); window.dispatchEvent(event); }

beforeEach(() => {
  vi.resetAllMocks();
  const previous = readPaymentAttempt(subject);
  if (previous) finishPaymentAttempt(subject, previous.idempotencyKey);
  vi.stubEnv("NEXT_PUBLIC_PLATFORM_API_BASE_URL", "/platform");
  const browser = window;
  vi.stubGlobal("window", new Proxy(browser, { get(target, key) {
    if (key === "location") return { origin, href: origin + "/points/purchase/" + productId, replace, assign };
    return Reflect.get(target, key);
  } }));
  vi.spyOn(document, "cookie", "get").mockReturnValue(`${USER_XSRF_COOKIE}=${"a".repeat(64)}`);
  send.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", send);
  api.startPayment.mockResolvedValue(response());
  api.getPayment.mockResolvedValue(response());
  api.syncStripePayment.mockResolvedValue(response());
  api.resumeStripeCheckout.mockResolvedValue(response());
  api.cancelStripeCheckout.mockResolvedValue(response({ status: "canceled", next_action: null }));
  sdk.load.mockResolvedValue(null);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("starts only on the button, disables wallets, and stores opaque correlation", async () => {
  mount();
  expect(api.startPayment).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: "カード情報の入力へ進む" }));
  await input();
  expect(api.startPayment).toHaveBeenCalledTimes(1);
  expect(sdk.element).toHaveBeenCalledWith({ wallets: { applePay: "never", googlePay: "never", link: "never" } });
  expect(JSON.stringify(readPaymentAttempt(subject))).not.toContain("secret");
  expect(send).not.toHaveBeenCalled();
});

it.each(["extra key", "other origin", "wrong pid", "bad key", "bad secret"])("rejects %s in the action", kind => {
  const a = action();
  const differences = { "extra key": { extra: "x" }, "other origin": { return_url: returnUrl.replace("shop.", "other.") },
    "wrong pid": { return_url: returnUrl+"2" }, "bad key": { publishable_key: "private" }, "bad secret": { client_secret: "invalid" } };
  expect(() => validateStripeAction(payment({ next_action: { ...a, ...differences[kind as keyof typeof differences] } }))).toThrow();
});

it("shows the start rate-limit message and allows choosing another method after definitive rejection", async () => {
  api.startPayment.mockRejectedValue(new ApiProblemError({ type: "about:blank", title: "rate limit", code: "PAYMENT_START_RATE_LIMITED", status: 429, request_id: "fixture", retryable: false }));
  mount(); fireEvent.click(await screen.findByRole("button", { name: "カード情報の入力へ進む" }));
  await screen.findByText(/短時間に決済の開始が続いたため/);
  expect(readPaymentAttempt(subject)).toBeNull();
});

it.each(["canceled", "expired", "failed", "succeeded"] as const)("releases a recovered attempt only after terminal %s", async status => {
  seed(); api.getPayment.mockResolvedValue(response({ status, next_action: null })); mount();
  await waitFor(() => expect(readPaymentAttempt(subject)).toBeNull());
  expect(screen.queryByText("カード入力欄")).toBeNull();
});

it("routes an owned processing attempt to thanks without creating another payment", async () => {
  seed(); api.getPayment.mockResolvedValue(response({ status: "processing", next_action: null })); mount();
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/points/purchase/thanks?pid="+pid));
  expect(readPaymentAttempt(subject)?.paymentId).toBe(pid);
});

it("keeps the slot reserved after an indeterminate cancellation and refreshes eligibility after terminal read", async () => {
  seed(); mount(); await input();
  const refresh = vi.fn();
  window.addEventListener("luxe-pack:stripe-offer-refresh", refresh);
  try {
    api.cancelStripeCheckout.mockResolvedValueOnce(response());
    api.getPayment.mockResolvedValueOnce(response({ cancellation_pending: true }));
    fireEvent.click(button("支払いをやめる"));
    await screen.findByText("取消の結果を確認中です。");
    expect(screen.queryByText("支払いに戻る")).toBeNull();
    expect(readPaymentAttempt(subject)?.paymentId).toBe(pid);
    refresh.mockClear();
    api.getPayment.mockResolvedValueOnce(response({ status: "canceled", next_action: null }));
    fireEvent.click(button("状態を確認する"));
    await waitFor(() => expect(readPaymentAttempt(subject)).toBeNull());
    expect(refresh).toHaveBeenCalled();
  } finally { window.removeEventListener("luxe-pack:stripe-offer-refresh", refresh); }
});

it("replays only the original start and method without a payment ID", async () => {
  seed(null); mount(); await input();
  expect(api.startPayment).toHaveBeenCalledWith({ payment_method: "credit_card", point_product_id: productId }, { idempotency_key: "existing-start-key" });
  expect(readPaymentAttempt(subject)?.paymentId).toBe(pid);
});

it("keeps an ambiguous replay locked", async () => {
  seed(null); api.startPayment.mockRejectedValue({ status: 409 }); mount();
  await screen.findByText(/購入履歴から確認/);
  expect(readPaymentAttempt(subject)?.idempotencyKey).toBe("existing-start-key");
  expect(screen.queryByText("カード入力欄")).toBeNull();
});

it("recovers created, or offers manual cancel if the Session cannot be resumed", async () => {
  seed(); api.getPayment.mockResolvedValue(response({ status: "created", next_action: null }));
  api.resumeStripeCheckout.mockRejectedValue(new Error()); mount();
  await screen.findByText("決済を準備できませんでした");
  expect(api.resumeStripeCheckout).toHaveBeenCalledTimes(1);
  fireEvent.click(button("支払いをやめる"));
  await waitFor(() => expect(readPaymentAttempt(subject)).toBeNull());
});

it("uses the resumed Session and never adopts an expired action before sync", async () => {
  seed(); api.getPayment.mockResolvedValue(response({ status: "created", next_action: null }));
  api.resumeStripeCheckout.mockResolvedValue(response({ next_action: { ...action(), expires_at: "2020-01-01T00:00:00Z" } }));
  mount(); await input();
  expect(api.syncStripePayment).toHaveBeenCalledWith(pid, { timeout_ms: 5000 });
});

it("preserves pending cancellation across reload and shares its key with user retry", async () => {
  seed(); api.getPayment.mockResolvedValue(response({ cancellation_pending: true })); mount();
  await screen.findByText("取消の結果を確認中です。");
  expect(screen.queryByText("支払いに戻る")).toBeNull();
  fireEvent.click(button("もう一度取り消す"));
  await waitFor(() => expect(readPaymentAttempt(subject)).toBeNull());
  expect(api.cancelStripeCheckout).toHaveBeenCalledWith(pid, "user", expect.objectContaining({ idempotency_key: cancelKey, timeout_ms: 5000 }));
});

it.each(["pagehide", "unmount", "method change"])("sends one prepared keepalive on %s even from an older screen", async mode => {
  seed(); const ui = mount(); await input();
  window.dispatchEvent(new Event("visibilitychange"));
  expect(send).not.toHaveBeenCalled();
  // Another screen's correlation does not remove the displayed screen's obligation.
  finishPaymentAttempt(subject, "existing-start-key");
  if (mode === "unmount") ui.unmount();
  else if (mode === "pagehide") { hide(); hide(); }
  else fireEvent.click(button("別の支払い方法を選ぶ"));
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send).toHaveBeenCalledWith(origin+"/platform/payments/"+pid+"/stripe-checkout-cancellations", expect.objectContaining({
    method: "POST", keepalive: true, credentials: "include", body: JSON.stringify({ trigger: "leave" }),
    headers: expect.objectContaining({ "Idempotency-Key": cancelKey, [XSRF_TOKEN_HEADER]: "a".repeat(64), "X-Oripa-Client-Version": "2.0.0-alpha.56", "X-Oripa-Site-Version": "0.1.0" }),
  }));
});

it("revalidates persisted pages before re-enabling card input", async () => {
  seed(); mount(); await input(); hide();
  api.getPayment.mockResolvedValue(response({ status: "expired", next_action: null }));
  await act(async () => restore());
  expect(readPaymentAttempt(subject)).toBeNull();
  expect(screen.queryByText("カード入力欄")).toBeNull();
});

it("permits retry after card rejection and suppresses leave during confirmation and 3DS", async () => {
  seed(); mount(); await input();
  sdk.confirm.mockResolvedValueOnce({ type: "error", error: { message: "カードを確認してください" } });
  fireEvent.click(button("1,000円を支払う"));
  await screen.findByText("カードを確認してください");
  let complete!: (v: unknown) => void;
  sdk.confirm.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
  const pay = button("1,000円を支払う");
  fireEvent.click(pay); expect(pay).toBeDisabled(); fireEvent.click(pay); hide();
  expect(send).not.toHaveBeenCalled(); expect(sdk.confirm).toHaveBeenCalledTimes(2);
  expect(sdk.confirm).toHaveBeenLastCalledWith({ redirect: "if_required", returnUrl });
  api.syncStripePayment.mockRejectedValue(new Error());
  await act(async () => complete({ type: "success" }));
  expect(replace).toHaveBeenCalledWith("/points/purchase/thanks?pid="+pid);
  hide(); expect(send).not.toHaveBeenCalled();
});

it("navigates after five seconds even if sync does not settle", async () => {
  seed(); mount(); await input();
  vi.useFakeTimers(); sdk.confirm.mockResolvedValue({ type: "success" }); api.syncStripePayment.mockReturnValue(new Promise(() => {}));
  await act(async () => fireEvent.click(button("1,000円を支払う")));
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(replace).toHaveBeenCalledTimes(1);
});

it("keeps the attempt on cancel timeout, blocks leave duplication and uses owned GET before offering return", async () => {
  seed(); mount(); await input();
  api.cancelStripeCheckout.mockReturnValue(new Promise(() => {}));
  api.getPayment.mockRejectedValueOnce(new Error());
  vi.useFakeTimers();
  fireEvent.click(button("支払いをやめる")); hide();
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(readPaymentAttempt(subject)?.paymentId).toBe(pid);
  expect(screen.getByText("状態を確認できませんでした。")).toBeInTheDocument();
  expect(screen.queryByText("支払いに戻る")).toBeNull();
  expect(send).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(button("状態を確認する")));
  expect(button("支払いに戻る")).toBeEnabled();
  api.cancelStripeCheckout.mockResolvedValueOnce(response({ status: "succeeded", next_action: null }));
  await act(async () => fireEvent.click(button("もう一度取り消す")));
  expect(replace).toHaveBeenCalledWith("/points/purchase/thanks?pid="+pid);
});

it("SF-R1 reconciles A after leaving for B and allows B to start only after A ends", async () => {
  const other = "product-b";
  seed();
  const view = mount();
  await input();
  let previous = response();
  api.getPayment.mockImplementation(async () => previous);
  send.mockImplementationOnce(async () => {
    previous = response({ cancellation_pending: true, next_action: null });
    return { ok: true };
  });
  view.rerender(purchase(other));
  await screen.findByRole("link", { name: "元の商品の決済に戻る" });
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send).toHaveBeenCalledWith(expect.stringContaining("/payments/" + pid + "/"), expect.objectContaining({
    keepalive: true, body: JSON.stringify({ trigger: "leave" }),
  }));
  expect(api.getPayment).toHaveBeenLastCalledWith(pid);
  expect(readPaymentAttempt(subject)?.productId).toBe(productId);
  expect(screen.queryByText("カード入力欄")).toBeNull();
  expect(screen.queryByText("カード情報の入力へ進む")).toBeNull();
  expect(api.startPayment).not.toHaveBeenCalled();
  const refresh = vi.fn();
  window.addEventListener("luxe-pack:stripe-offer-refresh", refresh);
  try {
    expect(previous.data.cancellation_pending).toBe(true);
    previous = response({ status: "canceled", provider_sync: false, next_action: null });
    fireEvent.click(button("状態を確認する"));
    const start = await screen.findByRole("button", { name: "カード情報の入力へ進む" });
    expect(readPaymentAttempt(subject)).toBeNull();
    expect(refresh).toHaveBeenCalled();
    api.startPayment.mockResolvedValue(response({ id: "payment-b", point_product_id: other,
      next_action: { ...action(), return_url: origin + "/points/purchase/thanks?pid=payment-b" } }));
    fireEvent.click(start);
    await input();
    expect(api.startPayment).toHaveBeenCalledTimes(1);
    expect(api.startPayment).toHaveBeenCalledWith({ point_product_id: other, payment_method: "credit_card" },
      { idempotency_key: expect.not.stringMatching(/^existing-start-key$/) });
    expect(readPaymentAttempt(subject)).toMatchObject({ productId: other, paymentId: "payment-b" });
  } finally { window.removeEventListener("luxe-pack:stripe-offer-refresh", refresh); }
});

it.each(["no id", "GET failure", "wrong product", "wrong payment"])("SF-R1 retains A on B for %s", async reason => {
  seed(reason === "no id" ? null : pid);
  const original = readPaymentAttempt(subject);
  if (reason === "GET failure") api.getPayment.mockRejectedValue(new Error("offline"));
  else api.getPayment.mockResolvedValue(response({ status: "canceled", next_action: null,
    ...(reason === "wrong product" ? { point_product_id: "product-b" } : { id: "unrelated" }) }));
  const view = mount("product-b");
  expect(await screen.findByRole("link", { name: "元の商品の決済に戻る" })).toHaveAttribute("href", "/points/purchase/"+productId);
  await act(async () => undefined);
  expect(api.getPayment).toHaveBeenCalledTimes(reason === "no id" ? 0 : 1);
  expect(api.startPayment).not.toHaveBeenCalled();
  expect(readPaymentAttempt(subject)).toEqual(original);
  expect(screen.queryByText("カード入力欄")).toBeNull();
  if (reason === "no id") {
    view.rerender(purchase(productId));
    await input();
    expect(api.startPayment).toHaveBeenCalledWith({ point_product_id: productId, payment_method: "credit_card" },
      { idempotency_key: "existing-start-key" });
  }
});

const expiredWithoutAction = { status: "requires_action" as const, provider_sync: true,
  expires_at: "2020-01-01T00:00:00Z", next_action: null };

it.each(["expired", "succeeded", "lookup failure", "still open"])("SF-R2 reconciles an expired Payment with null action: %s", async outcome => {
  seed(); api.getPayment.mockResolvedValue(response(expiredWithoutAction));
  let resolve!: (result: ReturnType<typeof response>) => void;
  let reject!: (err: Error) => void;
  api.syncStripePayment.mockReturnValue(new Promise((yes, no) => { resolve = yes; reject = no; }));
  mount();
  await waitFor(() => expect(api.syncStripePayment).toHaveBeenCalledWith(pid, { timeout_ms: 5000 }));
  expect(readPaymentAttempt(subject)?.paymentId).toBe(pid);
  expect(screen.queryByText("カード入力欄")).toBeNull();
  await act(async () => {
    if (outcome === "lookup failure") reject(new Error("offline"));
    else if (outcome === "still open") resolve(response(expiredWithoutAction));
    else resolve(response({ status: outcome === "expired" ? "expired" : "succeeded", provider_sync: false, next_action: null }));
  });
  expect(api.syncStripePayment).toHaveBeenCalledTimes(1);
  expect(api.resumeStripeCheckout).not.toHaveBeenCalled();
  if (outcome === "expired") expect(readPaymentAttempt(subject)).toBeNull();
  else if (outcome === "succeeded") expect(replace).toHaveBeenCalledWith("/points/purchase/thanks?pid="+pid);
  else expect(readPaymentAttempt(subject)?.paymentId).toBe(pid);
  expect(screen.queryByText("カード入力欄")).toBeNull();
});

it.each([true, false])("SF-R2 avoids unnecessary sync on pending=%s", async pending => {
  seed(); api.getPayment.mockResolvedValue(pending ? response({ ...expiredWithoutAction, cancellation_pending: true })
    : response({ expires_at: new Date(Date.now()+2100000).toISOString() }));
  mount();
  if (pending) {
    await screen.findByText("取消の結果を確認中です。");
    expect(screen.queryByText("カード入力欄")).toBeNull();
  } else await input();
  expect(api.syncStripePayment).not.toHaveBeenCalled();
  expect(readPaymentAttempt(subject)?.paymentId).toBe(pid);
});

it.each(["requires_action", "succeeded", "expired", "canceled"] as const)(
  "SF-R3 preserves in-flight confirmation across pagehide, restored %s and another leave", async status => {
    seed(); mount(); await input();
    let finish!: (result: unknown) => void;
    sdk.confirm.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    fireEvent.click(button("1,000円を支払う"));
    hide();
    api.getPayment.mockResolvedValue(status === "requires_action" ? response() : response({ status, provider_sync: false, next_action: null }));
    await act(async () => restore());
    expect(api.getPayment).toHaveBeenCalledTimes(2);
    hide();
    expect(send).not.toHaveBeenCalled();
    if (status === "requires_action") {
      const submit = button("処理中…");
      expect(submit).toBeDisabled(); fireEvent.click(submit);
      expect(button("支払いをやめる")).toBeDisabled();
      expect(sdk.confirm).toHaveBeenCalledTimes(1);
      await act(async () => finish({ type: "error", error: { message: "declined" } }));
      await input();
      expect(button("1,000円を支払う")).toBeEnabled();
      expect(api.getPayment).toHaveBeenCalledTimes(3);
      hide(); expect(send).toHaveBeenCalledTimes(1);
    } else {
      await act(async () => finish({ type: "success" }));
      expect(api.syncStripePayment).not.toHaveBeenCalled();
      if (status === "succeeded") expect(replace).toHaveBeenCalledTimes(1);
      else { expect(readPaymentAttempt(subject)).toBeNull(); expect(replace).not.toHaveBeenCalled(); }
      expect(send).not.toHaveBeenCalled();
    }
  });

it.each([true, false])("SF-R3 revalidates ordinary bfcache restoration with cancellation pending=%s", async pending => {
  seed(); mount(); await input(); hide();
  expect(send).toHaveBeenCalledTimes(1);
  api.getPayment.mockResolvedValue(response({ cancellation_pending: pending }));
  await act(async () => restore());
  expect(api.getPayment).toHaveBeenCalledTimes(2);
  if (pending) {
    expect(screen.getByText("取消の結果を確認中です。")).toBeInTheDocument();
    expect(screen.queryByText("カード入力欄")).toBeNull();
  } else expect(button("1,000円を支払う")).toBeEnabled();
  hide();
  expect(send).toHaveBeenCalledTimes(pending ? 1 : 2);
  expect(readPaymentAttempt(subject)?.paymentId).toBe(pid);
});

it("SF-R3 honors a confirmed cancellation before a slower bfcache GET finishes", async () => {
  seed(); mount(); await input();
  let confirmed!: (result: unknown) => void;
  let read!: (result: ReturnType<typeof response>) => void;
  sdk.confirm.mockReturnValue(new Promise(resolve => { confirmed = resolve; }));
  fireEvent.click(button("1,000円を支払う")); hide();
  api.getPayment.mockReturnValueOnce(new Promise(resolve => { read = resolve; }));
  await act(async () => restore());
  hide();
  api.syncStripePayment.mockResolvedValue(response({ status: "canceled", provider_sync: false, next_action: null }));
  await act(async () => confirmed({ type: "success" }));
  expect(readPaymentAttempt(subject)).toBeNull();
  await act(async () => read(response()));
  expect(screen.queryByText("カード入力欄")).toBeNull();
  expect(replace).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it("opens the existing Stripe element from another device using the owned payment's original product", async () => {
  const sample = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_pending.first_user_offer.blocking_payments[0];
  const row = { ...sample, id: pid, blocks_point_product_ids: ["current-version"] };
  api.getPayment.mockResolvedValue(response({ status: "created", next_action: null }));
  const view = render(<BlockingPaymentNotice subject={subject} payments={[row]} />);
  await act(async () => { fireEvent.click(button("お支払いを続ける")); });
  expect(assign).toHaveBeenCalledWith("/points/purchase/" + productId);
  view.unmount();
  mount();
  await input();
  expect(api.resumeStripeCheckout).toHaveBeenCalledExactlyOnceWith(pid, expect.objectContaining({ idempotency_key: expect.any(String) }));
  expect(api.startPayment).not.toHaveBeenCalled();
});
