import type { UnivapayInlineDriver } from "@/components/payment/provider-payment-sdk";
import type { PaidyCheckoutAction, UiPayment, UnivapayInlineForm } from "@/lib/platform/payment-ui-gateway";
import { validateInlineAction } from "@/components/payment/provider-payment-actions";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); document.querySelectorAll("script[src]").forEach(s => s.remove()); });
const form: UnivapayInlineForm = { provider: "univapay", script_url: "https://widget.univapay.com/client/checkout.js", options: { appId: "fixture", checkout: "payment", amount: 1000, currency: "jpy", tokenType: "one_time", capture: true, inline: true, locale: "ja", email: "member@example.test", showCvv: true } };

it.each([
  "https://evil.test/points/purchase/thanks?pid=payment-fixture",
  "/unknown?pid=payment-fixture",
  "/points/purchase/thanks?pid=another-payment",
  "/points/purchase/thanks?pid=payment-fixture&pid=payment-fixture",
  "/points/purchase/thanks?pid=payment-fixture#external",
])("rejects malformed/external/miscorrelated UnivaPay success_url %s", path => {
  const action = { type: "univapay_inline", amount: 1000, update: { metadata: { "oripa-payment-id": "payment-fixture", "oripa-member": "member-fixture" }, email: "member@example.test" }, success_url: new URL(path, window.location.origin).href };
  expect(() => validateInlineAction(action, { id: "payment-fixture" } as UiPayment)).toThrow();
});

it("loads the exact script once, then creates/opens and disposes owned inline sessions", async () => {
  vi.resetModules();
  const { createInlineSdkAdapter, loadPaymentScript } = await import("@/components/payment/provider-payment-sdk");
  const target = document.createElement("div"); document.body.appendChild(target);
  const dispose = vi.fn();
  const driver: UnivapayInlineDriver = {
    create: vi.fn(() => ({ open: vi.fn(async (element, change) => { const iframe = document.createElement("iframe"); element.appendChild(iframe); change(true); return iframe; }), dispose })),
    update: vi.fn().mockResolvedValue(undefined), submit: vi.fn().mockResolvedValue({ result: "unknown" }), validate: vi.fn().mockResolvedValue(true),
  };
  const mount = createInlineSdkAdapter(driver);
  const pending = mount(form, target, vi.fn(), new AbortController().signal);
  const same = loadPaymentScript(form.script_url);
  expect(document.querySelectorAll(`script[src="${form.script_url}"]`)).toHaveLength(1);
  document.querySelector(`script[src="${form.script_url}"]`)!.dispatchEvent(new Event("load"));
  await same; const session = await pending;
  expect(driver.create).toHaveBeenCalledExactlyOnceWith(form.options);
  const update = { metadata: { "oripa-payment-id": "payment", "oripa-member": "member" }, email: "member@example.test" };
  await session.update(update, { forceUpdate: true }); await session.submit(); await session.validate();
  expect(driver.update).toHaveBeenCalledWith(target.querySelector("iframe"), update, { forceUpdate: true });
  session.dispose(); expect(dispose).toHaveBeenCalledOnce(); target.remove();
});

it("disposes an inline instance whose async open finishes after cancellation", async () => {
  vi.resetModules(); const { createInlineSdkAdapter } = await import("@/components/payment/provider-payment-sdk");
  const controller = new AbortController(); const dispose = vi.fn(); const target = document.createElement("div");
  let finish!: (frame: HTMLIFrameElement) => void;
  const driver: UnivapayInlineDriver = { create: vi.fn(() => ({ open: () => new Promise<HTMLIFrameElement>(r => { finish = r; }), dispose })), update: vi.fn(), submit: vi.fn(), validate: vi.fn() };
  const pending = createInlineSdkAdapter(driver)(form, target, vi.fn(), controller.signal);
  const rejected = expect(pending).rejects.toThrow();
  document.querySelector(`script[src="${form.script_url}"]`)!.dispatchEvent(new Event("load"));
  await Promise.resolve(); await Promise.resolve(); controller.abort(); finish(document.createElement("iframe"));
  await rejected; expect(dispose).toHaveBeenCalledOnce();
});

it("fails script load and timeout safely and permits a fresh load attempt", async () => {
  vi.resetModules(); vi.useFakeTimers();
  const { loadPaymentScript } = await import("@/components/payment/provider-payment-sdk");
  const first = loadPaymentScript(form.script_url); const rejected = expect(first).rejects.toThrow("この決済方法は現在ご利用いただけません");
  document.querySelector(`script[src="${form.script_url}"]`)!.dispatchEvent(new Event("error")); await rejected;
  const second = loadPaymentScript(form.script_url); const timedOut = expect(second).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(10_000); await timedOut;
  await expect(loadPaymentScript("https://evil.test/sdk.js")).rejects.toThrow();
});

it("uses normal Paidy configure.closed and forwards the same payload without adding shipping or token data", async () => {
  vi.resetModules(); const { browserPaymentProviderSdk } = await import("@/components/payment/provider-payment-sdk");
  let closed!: (v: unknown) => void;
  const launch = vi.fn(); const configure = vi.fn(config => { closed = config.closed; return { launch }; });
  vi.stubGlobal("Paidy", { configure });
  const action = { type: "paidy_checkout", script_url: "https://apps.paidy.com/", public_key: "pk_fixture", payload: { amount: 1000 } } as PaidyCheckoutAction;
  const callback = vi.fn(); const controller = new AbortController();
  const pending = browserPaymentProviderSdk.openPaidy(action, callback, controller.signal);
  document.querySelector('script[src="https://apps.paidy.com/"]')!.dispatchEvent(new Event("load"));
  const session = await pending;
  expect(configure).toHaveBeenCalledWith({ api_key: action.public_key, closed: expect.any(Function) });
  expect(launch).toHaveBeenCalledWith(action.payload);
  closed({ status: "closed" }); expect(callback).toHaveBeenCalledOnce();
  session.dispose(); closed({ status: "authorized", id: "pay_fixture" }); expect(callback).toHaveBeenCalledOnce();
});
