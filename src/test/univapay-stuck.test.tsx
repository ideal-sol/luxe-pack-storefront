import type { UnivapayInlineForm } from "@/lib/platform/payment-ui-gateway";
import { observeUnivapay } from "@/components/payment/univapay-events";

const form: UnivapayInlineForm = { provider: "univapay", script_url: "https://widget.univapay.com/client/checkout.js", options: {
  appId: "synthetic", checkout: "payment", amount: 50, currency: "jpy", tokenType: "one_time", capture: true, inline: true, locale: "ja", email: "synthetic@example.test", showCvv: true,
} };
const navigate = vi.fn();
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", Object.assign(new EventTarget(), { location: { href: "https://shop.example.test/points", replace: navigate } }));
});
afterEach(() => {
  document.querySelectorAll("script[src], .provider-test-target").forEach(e => e.remove());
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); navigate.mockReset();
});

it("observes only fixed instance-scoped phase enums without reading or retaining a callback payload", () => {
  let active = true;
  const notify = vi.fn(); const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const observer = observeUnivapay(() => active, notify);
  const payload = new Proxy({}, { get() { throw new Error("Payload must not be read"); } });
  for (const callback of Object.values(observer.callbacks)) (callback as (data: unknown) => void)(payload);
  observer.callbacks.onValidationError();
  expect(notify.mock.calls.map(c => c[0])).toEqual(["validation_error", "charge_created", "three_ds_started", "three_ds_opened", "three_ds_succeeded", "three_ds_failed", "closed"]);
  expect(log.mock.calls.every(c => c.length === 2 && c[0] === "[UnivaPay]" && typeof c[1] === "string")).toBe(true);
  active = false; observer.emit("submit_resolved");
  expect(notify).toHaveBeenCalledTimes(7);
});

async function mount(submit: () => Promise<unknown>) {
  const { browserPaymentProviderSdk } = await import("@/components/payment/provider-payment-sdk");
  const target = document.createElement("div"); target.className = "provider-test-target"; document.body.appendChild(target);
  const iframe = document.createElement("iframe"); target.appendChild(iframe);
  const sdk = { create: vi.fn((options: unknown) => {
    expect(options).toMatchObject(form.options);
    return { open: async () => iframe };
  }), update: vi.fn(async () => undefined), submit: vi.fn(submit) };
  Object.assign(window, { UnivapayCheckout: sdk });
  const controller = new AbortController(); const notify = vi.fn();
  const ready = browserPaymentProviderSdk.mountInline(form, target, vi.fn(), controller.signal, notify);
  document.querySelector(`script[src="${form.script_url}"]`)!.dispatchEvent(new Event("load"));
  const session = await ready;
  return { session, notify, sdk, controller };
}

it("ends site waiting after 30s while retaining 3DS, late public callbacks and the one-submit lock", async () => {
  vi.useFakeTimers(); vi.spyOn(console, "info").mockImplementation(() => undefined);
  let resolve!: (data: unknown) => void;
  const s = await mount(() => new Promise(r => { resolve = r; }));
  await s.session.update({ metadata: { "oripa-payment-id": "synthetic", "oripa-member": "synthetic" }, email: "synthetic@example.test" }, { forceUpdate: true });
  const options = s.sdk.create.mock.calls[0]![0] as unknown as ReturnType<typeof observeUnivapay>["callbacks"];
  const pending = s.session.submit();
  await vi.advanceTimersByTimeAsync(29_999);
  options.onThreeDsAuthorizationModalOpened();
  expect(s.notify).not.toHaveBeenCalledWith("submit_wait_elapsed");
  await vi.advanceTimersByTimeAsync(1);
  expect(await pending).toEqual({ result: "unknown" });
  expect(navigate).not.toHaveBeenCalled();
  expect(s.notify).toHaveBeenCalledWith("submit_wait_elapsed");
  options.onThreeDsAuthorizationSuccess();
  resolve({ status: "successful", raw: "DO_NOT_LOG_PRIVATE_DATA" });
  await vi.advanceTimersByTimeAsync(0);
  expect(s.notify).toHaveBeenCalledWith("three_ds_succeeded");
  expect(s.notify).toHaveBeenCalledWith("submit_resolved");
  expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain("DO_NOT_LOG");
  await expect(s.session.submit()).rejects.toThrow();
  expect(s.sdk.submit).toHaveBeenCalledOnce();
  options.closed(); expect(navigate).not.toHaveBeenCalled();
  s.controller.abort();
  const count = s.notify.mock.calls.length; options.onChargeCreated();
  expect(s.notify).toHaveBeenCalledTimes(count);
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["reject", "sync_throw"])("normalizes %s to uncertainty and logs no exception or provider response", async mode => {
  const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
  const s = await mount(() => {
    if (mode === "sync_throw") throw new Error("SECRET_PROVIDER_RESPONSE");
    return Promise.reject({ card: "SECRET_PROVIDER_RESPONSE" });
  });
  expect(await s.session.submit()).toEqual({ result: "unknown" });
  expect(s.notify).toHaveBeenCalledWith("submit_rejected");
  expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET_PROVIDER_RESPONSE");
  expect(navigate).not.toHaveBeenCalled();
  s.controller.abort();
});
