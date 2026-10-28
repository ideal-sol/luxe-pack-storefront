import type { UnivapayInlineForm } from "@/lib/platform/payment-ui-gateway";

const navigation = vi.fn();
const listeners: Array<[string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined]> = [];
beforeEach(() => {
  vi.resetModules();
  const browser = new EventTarget();
  vi.stubGlobal("window", Object.assign(browser, { location: { href: "https://store.example/points/purchase/product", replace: navigation } }));
  const add = document.addEventListener.bind(document);
  vi.spyOn(document, "addEventListener").mockImplementation((name, listener, options) => {
    listeners.push([name, listener, options]); add(name, listener, options);
  });
});
afterEach(() => {
  for (const [name, listener, options] of listeners.splice(0)) document.removeEventListener(name, listener, options);
  document.querySelectorAll("script[src], .provider-test-target").forEach(node => node.remove());
  navigation.mockReset(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
});

it("revokes on unmount and makes another checkout in the same document impossible", async () => {
  const { ownProviderDocument } = await import("@/components/payment/provider-document");
  const abort = new AbortController();
  const lease = ownProviderDocument(abort.signal);
  abort.abort(); lease.dispose();
  expect(lease.active()).toBe(false);
  expect(() => lease.assertActive()).toThrow();
  expect(navigation).toHaveBeenCalledExactlyOnceWith(window.location.href);
  expect(() => ownProviderDocument(new AbortController().signal)).toThrow();
});

it("revokes callbacks before logout, waits for its request, and then replaces the document", async () => {
  const { ownProviderDocument, deferProviderDocumentForLogout } = await import("@/components/payment/provider-document");
  const abort = new AbortController();
  const lease = ownProviderDocument(abort.signal);
  const finish = deferProviderDocumentForLogout();
  expect(lease.active()).toBe(false);
  abort.abort();
  expect(navigation).not.toHaveBeenCalled();
  finish(); finish();
  expect(navigation).toHaveBeenCalledOnce();
});

it("uses full document navigation for a site Link before its SPA handler", async () => {
  const { ownProviderDocument } = await import("@/components/payment/provider-document");
  ownProviderDocument(new AbortController().signal);
  const anchor = document.createElement("a"); anchor.href = "https://store.example/points"; anchor.className = "provider-test-target";
  document.body.appendChild(anchor);
  const spa = vi.fn(); anchor.addEventListener("click", spa);
  anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  expect(spa).not.toHaveBeenCalled();
  expect(navigation).toHaveBeenCalledWith(anchor.href);
});

it.each(["popstate", "bfcache"])("retires SDK callbacks on %s instead of reusing a member environment", async mode => {
  const { ownProviderDocument } = await import("@/components/payment/provider-document");
  const lease = ownProviderDocument(new AbortController().signal);
  if (mode === "bfcache") {
    window.dispatchEvent(new Event("pagehide"));
    const show = new Event("pageshow"); Object.defineProperty(show, "persisted", { value: true }); window.dispatchEvent(show);
  } else window.dispatchEvent(new Event("popstate"));
  expect(lease.active()).toBe(false);
  expect(navigation).toHaveBeenCalledOnce();
});

it("bounds a hanging SDK operation and rejects cancellation without interpreting a late result", async () => {
  vi.useFakeTimers();
  const { boundedProviderOperation } = await import("@/components/payment/provider-document");
  const timeout = boundedProviderOperation(new Promise(() => undefined), new AbortController().signal);
  const failed = expect(timeout).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(15_000); await failed;
  const abort = new AbortController();
  const canceled = boundedProviderOperation(new Promise(() => undefined), abort.signal);
  const rejected = expect(canceled).rejects.toThrow(); abort.abort(); await rejected;
  expect(vi.getTimerCount()).toBe(0);
});

const form: UnivapayInlineForm = { provider: "univapay", script_url: "https://widget.univapay.com/client/checkout.js", options: { appId: "synthetic", checkout: "payment", amount: 1000, currency: "jpy", tokenType: "one_time", capture: true, inline: true, locale: "ja", email: "fixture@example.test", showCvv: true } };
it.each(["resolved", "rejected"])("uses the owned public SDK frame and keeps a %s raw submit outcome unknown", async outcome => {
  const { browserPaymentProviderSdk } = await import("@/components/payment/provider-payment-sdk");
  const target = document.createElement("div"); target.className = "provider-test-target"; document.body.appendChild(target);
  const frame = document.createElement("iframe"); target.appendChild(frame);
  const foreign = document.createElement("iframe"); foreign.className = "provider-test-target"; document.body.prepend(foreign);
  const sdk = {
    create: vi.fn(() => ({ open: vi.fn(async () => frame) })),
    update: vi.fn(async () => undefined),
    submit: outcome === "resolved" ? vi.fn().mockResolvedValue({ charge: "not-a-verified-charge", status: "successful" }) : vi.fn().mockRejectedValue(new Error("opaque")),
    validate: vi.fn(),
  };
  Object.assign(window, { UnivapayCheckout: sdk });
  const valid = vi.fn(); const abort = new AbortController();
  const pending = browserPaymentProviderSdk.mountInline(form, target, valid, abort.signal);
  document.querySelector(`script[src="${form.script_url}"]`)!.dispatchEvent(new Event("load"));
  const session = await pending;
  expect(session.validationMode).toBe("provider_submit");
  expect(valid).not.toHaveBeenCalled();
  expect(await session.validate()).toBe(false);
  expect(sdk.validate).not.toHaveBeenCalled();
  const update = { email: "fixture@example.test", metadata: { "oripa-payment-id": "fixture", "oripa-member": "fixture" } };
  await session.update(update, { forceUpdate: true });
  expect(sdk.update).toHaveBeenCalledExactlyOnceWith(frame, update, { forceUpdate: true });
  expect(await session.submit()).toEqual({ result: "unknown" });
  expect(sdk.submit).toHaveBeenCalledExactlyOnceWith(frame);
  await expect(session.submit()).rejects.toThrow();
  await expect(session.update(update, { forceUpdate: true })).rejects.toThrow();
  abort.abort();
  expect(navigation).toHaveBeenCalledOnce();
  // Only the browser navigation destroys provider DOM; the adapter never deletes it.
  expect(frame.isConnected).toBe(true); expect(foreign.isConnected).toBe(true);
});

it("rejects an SDK frame outside this component's target", async () => {
  const { browserPaymentProviderSdk } = await import("@/components/payment/provider-payment-sdk");
  const target = document.createElement("div");
  Object.assign(window, { UnivapayCheckout: { create: () => ({ open: async () => document.createElement("iframe") }), update: vi.fn(), submit: vi.fn() } });
  const pending = browserPaymentProviderSdk.mountInline(form, target, vi.fn(), new AbortController().signal);
  const rejected = expect(pending).rejects.toThrow();
  document.querySelector(`script[src="${form.script_url}"]`)!.dispatchEvent(new Event("load"));
  await rejected;
});
