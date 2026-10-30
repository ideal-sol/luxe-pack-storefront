import { StrictMode, forwardRef, useEffect, useImperativeHandle } from "react";
import { act, fireEvent, render, screen, waitFor, type RenderResult } from "@testing-library/react";
import { PUBLIC_AUTH_FIXTURE, PUBLIC_POINT_PRODUCT_FIXTURES, PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES, PUBLIC_POINT_BALANCE_FIXTURES } from "@oripa/storefront-testkit";
import { SessionProvider } from "@/components/auth/session-provider";
import { PointClientProvider } from "@/components/points/point-client-provider";
import { PaymentClientProvider } from "@/components/payment/payment-client-provider";
import { PaymentMethodLoader } from "@/components/payment/payment-method-loader";
import { PointPurchaseDetail } from "@/components/points/point-purchase-detail";
import type { AuthClientAdapter, PaymentClientAdapter, PointClientAdapter } from "@/lib/platform";
import type { PaymentMethodOption, PaymentUiGateway, UiPayment } from "@/lib/platform/payment-ui-gateway";
import type { InlineSession, PaymentProviderSdk } from "@/components/payment/provider-payment-sdk";
import { readPaymentAttempt } from "@/components/payment/payment-attempt";
import type { UnivapayEvent } from "@/components/payment/univapay-events";

// Retain dormant provider regressions independently of purchase visibility.
// Selection-policy acceptance below explicitly uses the real production policy.
const policyScope = vi.hoisted(() => ({ providerRegression: true, requested: "" }));
vi.mock("@/components/payment/new-purchase-methods", async importOriginal => {
  const original = await importOriginal<typeof import("@/components/payment/new-purchase-methods")>();
  return { newPurchaseMethods: (items: readonly PaymentMethodOption[]) => policyScope.providerRegression ? items : original.newPurchaseMethods(items) };
});

vi.mock("@/components/payment/fincode-card-fields", () => ({
  FincodeCardFields: forwardRef(function Fields({ onMountStateChange }: { onMountStateChange: (v: boolean) => void }, ref) {
    useImperativeHandle(ref, () => ({ execute: vi.fn(), tokenize: vi.fn() }));
    useEffect(() => { onMountStateChange(true); return () => onMountStateChange(false); }, [onMountStateChange]);
    return <div data-testid="fincode-fields" />;
  }),
}));

const product = PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[0];
const subject = PUBLIC_AUTH_FIXTURE.authenticated_session.user!.id;
const metadata = { status: 200, idempotency_replayed: false };
const navigation = { assign: vi.fn(), replace: vi.fn() };
const inlineForm = {
  provider: "univapay", script_url: "https://widget.univapay.com/client/checkout.js",
  options: { appId: "public-fixture-only", checkout: "payment", amount: product.price.amount, currency: "jpy", tokenType: "one_time", capture: true, inline: true, locale: "ja", email: "member@example.test", showCvv: true },
} as const;
const options: [PaymentMethodOption, PaymentMethodOption, PaymentMethodOption] = [
  { method: "credit_card", label: "クレジットカード", flow: "inline_card_form", available: true, unavailable_reason: null, saved_cards_enabled: false, inline_form: inlineForm },
  { method: "netridecash", label: "電子マネー（NetRideCash）", flow: "redirect", available: true, unavailable_reason: null, saved_cards_enabled: false },
  { method: "paidy", label: "あと払い（ペイディ）", flow: "paidy_checkout", available: true, unavailable_reason: null, saved_cards_enabled: false },
];
const inlineAction = { type: "univapay_inline", amount: product.price.amount,
  update: { metadata: { "oripa-payment-id": "payment-fixture", "oripa-member": subject }, email: "member@example.test" },
  success_url: "https://shop.example.test/points/purchase/thanks?pid=payment-fixture" };
const formAction = { type: "form_post", url: "https://secure.tc-site.com/access", fields: [
  { name: "clientip", value: "merchant-fixture" }, { name: "payment_code", value: "fixture-code" },
  { name: "cookie", value: "fixturecookie" }, { name: "price", value: String(product.price.amount) },
  { name: "sendid", value: "fixturesendid" }, { name: "email", value: "member@example.test" },
] };
const paidyAction = { type: "paidy_checkout", script_url: "https://apps.paidy.com/", public_key: "pk_fixture",
  payload: { amount: product.price.amount, currency: "JPY", store_name: "Fixture", description: "コイン購入",
    buyer: { email: "member@example.test", phone: "09000000000" },
    buyer_data: { user_id: subject, age: 10, ltv: 0, order_count: 0, order_count_last3months: 0, order_amount_last3months: 0, number_of_points: 0 },
    order: { order_ref: "payment-fixture", shipping: 0, tax: 0, items: [{ id: product.id, title: "コイン", quantity: 1, unit_price: product.price.amount }] } } };

function fixturePayment(method: string, action?: unknown): UiPayment {
  return { id: "payment-fixture", point_product_id: product.id, method, status: "requires_action", amount: product.price,
    grant: { paid_points: 1000, bonus_points: 0, limited_bonus_points: 0, total_points: 1000 }, expires_at: null,
    created_at: "2026-10-27T00:00:00Z", succeeded_at: null,
    next_action: action ?? (method === "credit_card" ? inlineAction : method === "paidy" ? paidyAction : formAction) };
}
function setup(methods: PaymentMethodOption[] = options) {
  const legacy = { startPayment: vi.fn(), listCards: vi.fn(), getPaymentCardUiBootstrap: vi.fn().mockResolvedValue({ data: PUBLIC_PAYMENT_CARD_UI_BOOTSTRAP_FIXTURES.sandbox, metadata }), getPayment: vi.fn() } as unknown as PaymentClientAdapter;
  const gateway: PaymentUiGateway = {
    listPaymentMethods: vi.fn().mockResolvedValue({ data: { data: methods } }),
    startPayment: vi.fn().mockImplementation(input => Promise.resolve({ data: fixturePayment(input.payment_method) })),
    getPayment: vi.fn().mockResolvedValue({ data: fixturePayment("paidy") }),
    recordPaymentClientEvent: vi.fn().mockResolvedValue({ data: undefined }),
    reportUnivapayCharge: vi.fn().mockResolvedValue({ data: fixturePayment("credit_card") }),
    confirmPaidyAuthorization: vi.fn().mockResolvedValue({ data: fixturePayment("paidy") }),
  };
  const session: InlineSession = { update: vi.fn().mockResolvedValue(undefined), submit: vi.fn().mockResolvedValue({ result: "unknown" }), validate: vi.fn().mockResolvedValue(true), dispose: vi.fn() };
  let validity: (valid: boolean) => void = () => undefined;
  let callback: (value: unknown) => void = () => undefined;
  let event: (value: UnivapayEvent) => void = () => undefined;
  const sdk: PaymentProviderSdk = {
    mountInline: vi.fn().mockImplementation(async (_form, target, change, _signal, observe) => { validity = change; event = observe; target.appendChild(document.createElement("iframe")); change(true); return session; }),
    openPaidy: vi.fn().mockImplementation(async (_action, cb) => { callback = cb; return { dispose: vi.fn() }; }),
  };
  const auth = { getCurrentSession: vi.fn().mockResolvedValue({ data: PUBLIC_AUTH_FIXTURE.authenticated_session, metadata }), getSmsVerificationStatus: vi.fn().mockResolvedValue({ data: { verified: true }, metadata }) } as unknown as AuthClientAdapter;
  const points = { getWallet: vi.fn().mockResolvedValue({ data: PUBLIC_POINT_BALANCE_FIXTURES.positive, metadata }), listPointProducts: vi.fn().mockResolvedValue({ data: { ...PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible, data: [product] }, metadata }) } as unknown as PointClientAdapter;
  const tree = () => <StrictMode><SessionProvider client={auth}><PointClientProvider client={points}><PaymentClientProvider client={legacy} providerSdk={sdk} uiGateway={gateway}><PointPurchaseDetail productId={product.id} /></PaymentClientProvider></PointClientProvider></SessionProvider></StrictMode>;
  const mount = async () => {
    let view!: RenderResult;
    // Resolve the immediate Session/Point/Method fixtures inside React's async
    // act boundary before asserting UI; do not race them against a wall clock.
    await act(async () => { view = render(tree()); });
    return view;
  };
  return { legacy, gateway, sdk, session, points, event: (value: UnivapayEvent) => act(() => event(value)), validity: (v: boolean) => act(() => validity(v)), callback: (v: unknown) => act(() => callback(v)), mount };
}
async function buy() {
  // Flush provider lifecycle/correlation initialization before asserting readiness.
  await act(async () => undefined);
  await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "購入する" })); });
}
beforeEach(() => {
  policyScope.providerRegression = true;
  policyScope.requested = "";
  vi.clearAllMocks();
  window.sessionStorage.clear();
  const browser = window;
  vi.stubGlobal("window", new Proxy(browser, { get(target, key) {
    if (key === "location") return { assign: navigation.assign, replace: navigation.replace, href: "https://shop.example.test/" + policyScope.requested, origin: "https://shop.example.test", pathname: "/", search: policyScope.requested };
    return Reflect.get(target, key);
  } }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("renders API order/labels, unavailable reasons and unknown methods without restoring fincode choices", async () => {
  const s = setup([
    { ...options[2], available: false, unavailable_reason: "provider_unavailable" },
    { ...options[1], available: false, unavailable_reason: "amount_too_large" },
    { ...options[0], method: "future", label: "新しい方式", flow: "future" },
  ]);
  await s.mount();
  const radios = await screen.findAllByRole("radio");
  expect(radios.map(r => r.getAttribute("value"))).toEqual(["paidy", "netridecash", "future"]);
  expect(radios[0]).toBeDisabled(); expect(radios[1]).toBeDisabled();
  expect(radios[2]).toBeDisabled();
  expect(screen.getAllByText("現在ご利用いただけません")).toHaveLength(2);
  expect(screen.getByText("この商品はこのお支払い方法ではご購入いただけません")).toBeInTheDocument();
  expect(screen.queryByText("PayPay")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "購入する" })).toBeDisabled();
  expect(s.legacy.listCards).not.toHaveBeenCalled(); expect(s.gateway.startPayment).not.toHaveBeenCalled();
});

it("uses the Client Gateway by default without requiring a production injection", async () => {
  const s = setup([options[2]]);
  s.legacy.uiGateway = s.gateway;
  render(<PaymentClientProvider client={s.legacy}><PaymentMethodLoader productId={product.id} subject={subject}>{methods => <p>{methods[0]?.label}</p>}</PaymentMethodLoader></PaymentClientProvider>);
  expect(await screen.findByText(options[2].label)).toBeInTheDocument();
  expect(s.gateway.listPaymentMethods).toHaveBeenCalledWith(product.id);
});

it("does not invent methods when the canonical Client is unavailable", () => {
  const children = vi.fn();
  render(<PaymentClientProvider client={null}><PaymentMethodLoader productId={product.id} subject={subject}>{children}</PaymentMethodLoader></PaymentClientProvider>);
  expect(screen.getByRole("alert")).toHaveTextContent("お支払い方法を取得できませんでした。");
  expect(children).not.toHaveBeenCalled();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
});

it.each(["empty", "failure"])("keeps API %s fail-closed and allows explicit reload", async mode => {
  const s = setup([]);
  if (mode === "failure") vi.mocked(s.gateway.listPaymentMethods).mockRejectedValue(new Error("private provider detail"));
  await s.mount();
  expect(await screen.findByText(mode === "empty" ? "現在ご利用いただけるお支払い方法はありません。" : "お支払い方法を取得できませんでした。")).toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  if (mode === "failure") {
    vi.mocked(s.gateway.listPaymentMethods).mockResolvedValue({ data: { data: [options[1]] } });
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(await screen.findByRole("radio", { name: options[1].label })).toBeInTheDocument();
  }
});

it("creates only on purchase, keeps cards out of inline input, and updates before submit", async () => {
  const s = setup(); await s.mount();
  await screen.findByRole("radio", { name: "クレジットカード" });
  await waitFor(() => expect(s.sdk.mountInline).toHaveBeenCalled());
  expect(s.gateway.startPayment).not.toHaveBeenCalled();
  expect(s.legacy.listCards).not.toHaveBeenCalled();
  expect(screen.queryByText("登録カード")).not.toBeInTheDocument();
  await buy();
  await waitFor(() => expect(s.session.submit).toHaveBeenCalledOnce());
  expect(s.gateway.startPayment).toHaveBeenCalledExactlyOnceWith({ payment_method: "credit_card", point_product_id: product.id }, expect.objectContaining({ idempotency_key: expect.any(String) }));
  expect(s.session.update).toHaveBeenCalledWith(inlineAction.update, { forceUpdate: true });
  expect(vi.mocked(s.session.update).mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(s.session.submit).mock.invocationCallOrder[0]!);
  expect(s.gateway.reportUnivapayCharge).not.toHaveBeenCalled();
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "決済状況を確認する" })).toHaveAttribute("href", "/points/purchase/thanks?pid=payment-fixture");
  expect(JSON.stringify(readPaymentAttempt(subject))).not.toMatch(/member@example|appId|payload/);
});

it("blocks invalid inline fields, permits validation recheck and disposes on method change", async () => {
  const s = setup(); const view = await s.mount();
  await waitFor(() => expect(s.sdk.mountInline).toHaveBeenCalled());
  s.validity(false);
  expect(screen.getByRole("button", { name: "購入する" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "入力内容を確認する" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
  fireEvent.click(screen.getByRole("radio", { name: options[1].label }));
  expect(s.session.dispose).toHaveBeenCalled();
  view.unmount();
});

it("allows another method after inline SDK load failure while keeping purchase disabled for the failed iframe", async () => {
  const s = setup(); vi.mocked(s.sdk.mountInline).mockRejectedValue(new Error("private SDK detail"));
  await s.mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("この決済方法は現在ご利用いただけません");
  expect(screen.getByRole("button", { name: "購入する" })).toBeDisabled();
  const alternative = screen.getByRole("radio", { name: options[1].label });
  expect(alternative).toBeEnabled(); fireEvent.click(alternative);
  await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
  expect(s.gateway.startPayment).not.toHaveBeenCalled();
  expect(screen.queryByText("private SDK detail")).not.toBeInTheDocument();
});

it("rejects amount skew before iframe submission and returns a safe error", async () => {
  const s = setup();
  vi.mocked(s.gateway.startPayment).mockResolvedValue({ data: fixturePayment("credit_card", { ...inlineAction, amount: product.price.amount + 1 }) });
  await s.mount(); await buy();
  expect(await screen.findByRole("alert")).toHaveTextContent("金額が変わりました");
  expect(s.session.update).not.toHaveBeenCalled(); expect(s.session.submit).not.toHaveBeenCalled();
});

it("retains the iframe on definite SDK failure and gives a fresh key only on the next click", async () => {
  const s = setup(); vi.mocked(s.session.submit).mockResolvedValue({ result: "failed" });
  await s.mount(); await buy();
  expect(await screen.findByRole("alert")).toHaveTextContent("カードがご利用いただけませんでした");
  expect(screen.queryByText("お支払いを処理しています")).not.toBeInTheDocument();
  const mounts = vi.mocked(s.sdk.mountInline).mock.calls.length;
  await buy(); await waitFor(() => expect(s.gateway.startPayment).toHaveBeenCalledTimes(2));
  const calls = vi.mocked(s.gateway.startPayment).mock.calls;
  expect(calls[0]![1].idempotency_key).not.toBe(calls[1]![1].idempotency_key);
  expect(s.sdk.mountInline).toHaveBeenCalledTimes(mounts);
});

it.each([true, false])("reports a normalized fixture charge exactly once only when UUID is valid (%s)", async valid => {
  const s = setup(); vi.mocked(s.session.submit).mockResolvedValue({ result: "reported", charge_id: valid ? "00000000-0000-4000-8000-000000000001" : "not-a-charge" });
  await s.mount(); await buy(); await waitFor(() => expect(screen.getByRole("link", { name: "決済状況を確認する" })).toBeInTheDocument());
  expect(s.gateway.reportUnivapayCharge).toHaveBeenCalledTimes(valid ? 1 : 0);
  expect(JSON.stringify(vi.mocked(s.gateway.recordPaymentClientEvent).mock.calls)).not.toMatch(/member@example|phone|appId/);
});

it("keeps inline input visible and duplicate starts locked throughout a hanging submit and public validation/3DS events", async () => {
  const s = setup(); vi.mocked(s.session.submit).mockReturnValue(new Promise(() => undefined));
  await s.mount(); await buy(); await waitFor(() => expect(s.session.submit).toHaveBeenCalledOnce());
  expect(document.querySelector(".payment-processing-overlay")).toBeNull();
  expect(document.querySelector(".payment-inline-card iframe")).toBeVisible();
  s.event("validation_error");
  expect(screen.getByText(/カード入力欄の案内/)).toBeVisible();
  s.event("validation_error"); s.event("three_ds_opened");
  expect(screen.getByText(/カード会社の認証を進めて/)).toBeVisible();
  s.event("charge_created");
  s.event("three_ds_succeeded"); s.event("submit_resolved");
  expect(screen.queryByText("購入が完了しました")).not.toBeInTheDocument();
  expect(s.gateway.reportUnivapayCharge).not.toHaveBeenCalled();
  expect(s.gateway.recordPaymentClientEvent).toHaveBeenCalledWith("payment-fixture", { type: "inline_result", detail: { result: "error" } }, expect.anything());
  expect(vi.mocked(s.gateway.recordPaymentClientEvent).mock.calls.filter(c => c[1].type === "inline_result")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "処理中…" }));
  expect(s.gateway.startPayment).toHaveBeenCalledOnce();
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(readPaymentAttempt(subject)?.paymentId).toBe("payment-fixture");
});

it("navigates from an uncertain inline result only after the Platform read confirms success", async () => {
  const s = setup();
  vi.mocked(s.gateway.getPayment).mockResolvedValue({ data: fixturePayment("credit_card") });
  vi.mocked(s.legacy.getPayment).mockResolvedValue({ data: { ...fixturePayment("credit_card"), method: "credit_card", next_action: null, status: "succeeded" }, metadata });
  await s.mount(); await buy();
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/points/purchase/thanks?pid=payment-fixture"));
  expect(s.gateway.startPayment).toHaveBeenCalledOnce();
  expect(s.session.submit).toHaveBeenCalledOnce();
  expect(readPaymentAttempt(subject)?.paymentId).toBe("payment-fixture");
});

it("retains a status link when the first-purchase product is blocked and all new methods are OFF", async () => {
  const { beginPaymentAttempt } = await import("@/components/payment/payment-attempt");
  beginPaymentAttempt(subject, { productId: product.id, paymentId: "payment-fixture", idempotencyKey: "existing-key" });
  const s = setup([]);
  vi.mocked(s.gateway.getPayment).mockResolvedValue({ data: fixturePayment("credit_card") });
  vi.mocked(s.points.listPointProducts).mockResolvedValue({ data: { ...PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible,
    data: [{ ...product, eligible: false, ineligible_reason: "first_purchase_required", cta: { ...product.cta, state: "disabled", reason: "first_purchase_required" } }] }, metadata });
  await s.mount();
  expect(await screen.findByRole("link", { name: "開始済みの決済状況を確認する" })).toHaveAttribute("href", "/points/purchase/thanks?pid=payment-fixture");
  expect(screen.getByText("現在ご利用いただけるお支払い方法はありません。")).toBeInTheDocument();
  expect(s.gateway.startPayment).not.toHaveBeenCalled();
  expect(readPaymentAttempt(subject)?.idempotencyKey).toBe("existing-key");
});

it("POSTs six native hidden fields unchanged in server order despite stalled telemetry", async () => {
  const s = setup([options[1]]);
  vi.mocked(s.gateway.recordPaymentClientEvent).mockReturnValue(new Promise(() => undefined));
  let submitted: { action: string; method: string; fields: [string, string][] } | undefined;
  const post = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(function(this: HTMLFormElement) {
    submitted = { action: this.action, method: this.method, fields: Array.from(this.elements).map(e => [(e as HTMLInputElement).name, (e as HTMLInputElement).value]) };
  });
  await s.mount(); await buy();
  await waitFor(() => expect(post).toHaveBeenCalledOnce());
  expect(submitted).toEqual({ action: formAction.url, method: "post", fields: formAction.fields.map(f => [f.name, f.value]) });
  expect(navigation.assign).not.toHaveBeenCalled();
});

it("confirms an authorized Paidy callback once and never treats the callback as financial success", async () => {
  const s = setup([options[2]]); await s.mount(); await buy();
  await waitFor(() => expect(s.sdk.openPaidy).toHaveBeenCalledOnce());
  expect(vi.mocked(s.sdk.openPaidy).mock.calls[0]![0]).toEqual(paidyAction);
  s.callback({ status: "authorized", id: "pay_fixture", buyer: "private response" });
  s.callback({ status: "authorized", id: "pay_fixture" });
  await waitFor(() => expect(s.gateway.confirmPaidyAuthorization).toHaveBeenCalledOnce());
  expect(s.gateway.confirmPaidyAuthorization).toHaveBeenCalledWith("payment-fixture", { paidy_payment_id: "pay_fixture" }, expect.objectContaining({ idempotency_key: expect.any(String) }));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/points/purchase/thanks?pid=payment-fixture"));
  expect(JSON.stringify(vi.mocked(s.gateway.recordPaymentClientEvent).mock.calls)).not.toContain("private response");
});

it.each(["rejected", "closed"])("returns Paidy %s to method selection without a financial mutation", async status => {
  const s = setup([options[2]]); await s.mount(); await buy();
  await waitFor(() => expect(s.sdk.openPaidy).toHaveBeenCalledOnce());
  s.callback({ status });
  await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeEnabled());
  expect(s.gateway.confirmPaidyAuthorization).not.toHaveBeenCalled(); expect(navigation.replace).not.toHaveBeenCalled();
  if (status === "rejected") expect(screen.getByRole("alert")).toHaveTextContent("あと払い（ペイディ）をご利用いただけませんでした");
  fireEvent.click(screen.getByRole("button", { name: "購入する" }));
  await waitFor(() => expect(s.gateway.startPayment).toHaveBeenCalledTimes(2));
});

it.each([{ status: "unknown" }, { status: "authorized", id: "bad-id" }])("queries canonical status for unknown Paidy response %j", async response => {
  const s = setup([options[2]]); await s.mount(); await buy();
  await waitFor(() => expect(s.sdk.openPaidy).toHaveBeenCalledOnce()); s.callback(response);
  await waitFor(() => expect(s.gateway.getPayment).toHaveBeenCalledOnce());
  expect(s.gateway.confirmPaidyAuthorization).not.toHaveBeenCalled();
});

it("locks an uncertain start across remount and never posts a replacement payment", async () => {
  const s = setup([options[1]]); vi.mocked(s.gateway.startPayment).mockRejectedValue(new Error("raw private transport data"));
  const view = await s.mount(); await buy();
  expect(await screen.findByText(/お支払いを確認しています。購入履歴/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "購入する" })).toBeDisabled();
  view.unmount(); await s.mount();
  await screen.findByRole("button", { name: "購入する" });
  await waitFor(() => expect(screen.getByRole("button", { name: "購入する" })).toBeDisabled());
  expect(s.gateway.startPayment).toHaveBeenCalledOnce();
  expect(screen.queryByText("raw private transport data")).not.toBeInTheDocument();
});

it("discards a pending start after unmount instead of navigating a different session", async () => {
  const s = setup([options[1]]); let resolve!: (value: { data: UiPayment }) => void;
  vi.mocked(s.gateway.startPayment).mockReturnValue(new Promise(r => { resolve = r; }));
  const post = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => undefined);
  const view = await s.mount(); await buy(); await waitFor(() => expect(s.gateway.startPayment).toHaveBeenCalledOnce());
  view.unmount(); await act(async () => resolve({ data: fixturePayment("netridecash") }));
  expect(post).not.toHaveBeenCalled(); expect(navigation.replace).not.toHaveBeenCalled();
});

it("does not request saved cards or offer registration when API saved_cards_enabled is false", async () => {
  const s = setup([{ ...options[0], flow: "card_component", inline_form: null }]); await s.mount();
  expect(await screen.findByRole("radio", { name: "クレジットカード" })).toBeInTheDocument();
  expect(screen.queryByTestId("fincode-fields")).not.toBeInTheDocument();
  expect(s.legacy.listCards).not.toHaveBeenCalled();
  expect(s.legacy.getPaymentCardUiBootstrap).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "購入する" })).toBeDisabled();
  expect(screen.queryByText(/カードを追加する|登録カード|カードを保存/)).not.toBeInTheDocument();
});

it.each(["paidy", "netridecash"])("hides both providers and ignores URL selection of %s for new purchases", async method => {
  policyScope.providerRegression = false;
  policyScope.requested = "?payment_method=" + method;
  const s = setup(); await s.mount();
  expect(await screen.findByRole("radio", { name: "クレジットカード" })).toBeInTheDocument();
  expect(screen.queryByRole("radio", { name: options[1].label })).not.toBeInTheDocument();
  expect(screen.queryByRole("radio", { name: options[2].label })).not.toBeInTheDocument();
  expect(screen.queryByText(/NetRideCash|ペイディ/)).not.toBeInTheDocument();
  await buy();
  await waitFor(() => expect(s.gateway.startPayment).toHaveBeenCalledOnce());
  expect(s.gateway.startPayment).toHaveBeenCalledWith({ payment_method: "credit_card", point_product_id: product.id }, expect.anything());
  expect(s.sdk.openPaidy).not.toHaveBeenCalled();
});
it.each(["paidy", "netridecash"])("has no purchase action when only hidden providers are available (%s URL)", async method => {
  policyScope.providerRegression = false;
  policyScope.requested = "?payment_method=" + method;
  const s = setup(options.slice(1)); await s.mount();
  expect(await screen.findByText("現在ご利用いただけるお支払い方法はありません。")).toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "購入する" })).not.toBeInTheDocument();
  expect(s.gateway.startPayment).not.toHaveBeenCalled();
  expect(s.legacy.startPayment).not.toHaveBeenCalled();
});
it("cannot fall back to a hidden provider when the visible method is unavailable", async () => {
  policyScope.providerRegression = false;
  const s = setup([{ ...options[0], available: false, unavailable_reason: "provider_unavailable" }, ...options.slice(1)]);
  await s.mount();
  const card = await screen.findByRole("radio", { name: "クレジットカード" });
  expect(card).toBeDisabled();
  expect(screen.getAllByRole("radio")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "購入する" })).toBeDisabled();
  expect(s.gateway.startPayment).not.toHaveBeenCalled();
});

it("ignores a stale method response after both product and session change", async () => {
  const s = setup(); let resolve!: (v: { data: { data: PaymentMethodOption[] } }) => void;
  vi.mocked(s.gateway.listPaymentMethods).mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValue({ data: { data: [options[2]] } });
  const tree = (id: string, user: string) => <PaymentClientProvider client={s.legacy} uiGateway={s.gateway}><PaymentMethodLoader productId={id} subject={user}>{items => <p>{items.map(i => i.label).join(",")}</p>}</PaymentMethodLoader></PaymentClientProvider>;
  const view = render(tree("product-a", "member-a"));
  await waitFor(() => expect(s.gateway.listPaymentMethods).toHaveBeenCalledOnce());
  view.rerender(tree("product-b", "member-b"));
  expect(await screen.findByText("あと払い（ペイディ）")).toBeInTheDocument();
  await act(async () => resolve({ data: { data: [options[1]] } }));
  expect(screen.queryByText(options[1].label)).not.toBeInTheDocument();
});
