import type { PaidyCheckoutAction, UnivapayInlineAction, UnivapayInlineForm } from "@/lib/platform/payment-ui-gateway";
import { PAYMENT_UI_UNAVAILABLE } from "@/lib/platform/payment-ui-gateway";
import { PAIDY_SCRIPT, UNIVAPAY_SCRIPT, validateInlineForm } from "./provider-payment-actions";
import { boundedProviderOperation, leaveProviderDocument, ownProviderDocument } from "./provider-document";
import { observeUnivapay, type UnivapayEvent } from "./univapay-events";

export type InlineResult = { result: "unknown" } | { result: "failed" } | { result: "reported"; charge_id: string };
export interface InlineSession {
  readonly validationMode?: "provider_submit";
  update(update: UnivapayInlineAction["update"], options: { forceUpdate: true }): Promise<void>;
  submit(): Promise<InlineResult>;
  validate(): Promise<boolean>;
  dispose(): void;
}
export interface PaymentProviderSdk {
  mountInline(form: UnivapayInlineForm, target: HTMLElement, validity: (valid: boolean) => void, signal: AbortSignal, onEvent?: (event: UnivapayEvent) => void): Promise<InlineSession>;
  openPaidy(action: PaidyCheckoutAction, callback: (response: unknown) => void, signal: AbortSignal): Promise<{ dispose(returnUrl?: string): void }>;
}

const scripts = new Map<string, Promise<void>>();
export function loadPaymentScript(url: string): Promise<void> {
  if (url !== UNIVAPAY_SCRIPT && url !== PAIDY_SCRIPT) return Promise.reject(new Error(PAYMENT_UI_UNAVAILABLE));
  const existing = scripts.get(url);
  if (existing) return existing;
  const pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.charset = "utf-8";
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (ok) resolve();
      else { script.remove(); reject(new Error(PAYMENT_UI_UNAVAILABLE)); }
    };
    const timer = setTimeout(() => finish(false), 10_000);
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  });
  scripts.set(url, pending);
  void pending.catch(() => scripts.delete(url));
  return pending;
}

/** The injectable adapter retains explicit ownership and normalized results for
 * contract fixtures. The browser implementation below deliberately does not
 * normalize U12 raw Promise/event data into a financial outcome or charge ID.
 */
export interface UnivapayInlineDriver {
  create(options: UnivapayInlineForm["options"]): {
    open(target: HTMLElement, validity: (valid: boolean) => void, signal: AbortSignal): Promise<HTMLIFrameElement>;
    dispose(): void;
  };
  update(iframe: HTMLIFrameElement, update: UnivapayInlineAction["update"], options: { forceUpdate: true }): Promise<void>;
  submit(iframe: HTMLIFrameElement): Promise<InlineResult>;
  validate(iframe: HTMLIFrameElement): Promise<boolean>;
}

export function createInlineSdkAdapter(driver: UnivapayInlineDriver): PaymentProviderSdk["mountInline"] {
  return async (form, target, validity, signal) => {
    validateInlineForm(form);
    await loadPaymentScript(form.script_url);
    signal.throwIfAborted();
    const instance = driver.create(form.options);
    try {
      const iframe = await instance.open(target, validity, signal);
      signal.throwIfAborted();
      if (!target.contains(iframe)) throw new Error(PAYMENT_UI_UNAVAILABLE);
      return {
        update: (update, options) => driver.update(iframe, update, options),
        submit: () => driver.submit(iframe),
        validate: () => driver.validate(iframe),
        dispose: () => instance.dispose(),
      };
    } catch (error) { instance.dispose(); throw error; }
  };
}

interface PaidyGlobal {
  configure(config: { api_key: string; closed: (response: unknown) => void }): { launch(payload: PaidyCheckoutAction["payload"]): void };
}

interface UnivapayGlobal {
  create(options: UnivapayInlineForm["options"] & ReturnType<typeof observeUnivapay>["callbacks"]): { open(overrides: undefined, target: HTMLElement): Promise<HTMLIFrameElement | undefined> };
  update(iframe: HTMLIFrameElement, update: UnivapayInlineAction["update"], options: { forceUpdate: true }): Promise<unknown>;
  submit(iframe: HTMLIFrameElement): Promise<unknown>;
}

export const browserPaymentProviderSdk: PaymentProviderSdk = {
  mountInline: async (form, target, _validity, signal, onEvent) => {
    validateInlineForm(form);
    const lifetime = ownProviderDocument(signal);
    await boundedProviderOperation(loadPaymentScript(form.script_url), signal);
    lifetime.assertActive();
    const sdk = (window as unknown as { UnivapayCheckout?: UnivapayGlobal }).UnivapayCheckout;
    if (!sdk || typeof sdk.create !== "function" || typeof sdk.update !== "function" || typeof sdk.submit !== "function") throw new Error(PAYMENT_UI_UNAVAILABLE);
    const events = observeUnivapay(lifetime.active, onEvent);
    const instance = sdk.create({ ...form.options, ...events.callbacks });
    const iframe = await boundedProviderOperation(instance.open(undefined, target), signal);
    lifetime.assertActive();
    if (!(iframe instanceof HTMLIFrameElement) || !target.contains(iframe)) throw new Error(PAYMENT_UI_UNAVAILABLE);
    iframe.title = "UnivaPay カード入力";
    // Instance-bound public callbacks remain advisory. Closing the provider
    // must not unload this document or erase the unresolved payment.
    events.emit("sdk_ready");
    let submitted = false;
    return {
      validationMode: "provider_submit",
      // Official inline integration validates within submit(). validate() is
      // not required and an empty validation-error event is NOT positive proof.
      validate: async () => false,
      update: async (update, options) => {
        lifetime.assertActive();
        if (submitted || !target.contains(iframe)) throw new Error(PAYMENT_UI_UNAVAILABLE);
        events.emit("update_started");
        try { await boundedProviderOperation(sdk.update(iframe, update, options), signal); }
        catch (error) { events.emit("update_rejected"); throw error; }
        lifetime.assertActive();
        events.emit("update_complete");
      },
      submit: async () => {
        lifetime.assertActive();
        if (submitted || !target.contains(iframe)) throw new Error(PAYMENT_UI_UNAVAILABLE);
        submitted = true;
        events.emit("submit_started");
        let settled = false;
        // Stop waiting on the site after 30s without canceling the SDK, closing
        // 3DS, or navigating away. Late callbacks still update the status UI.
        const operation = Promise.resolve().then(() => sdk.submit(iframe)).then(
          () => { settled = true; events.emit("submit_resolved"); },
          () => { settled = true; events.emit("submit_rejected"); },
        );
        try { await boundedProviderOperation(operation, signal, 30_000); }
        catch { if (!settled) events.emit("submit_wait_elapsed"); }
        lifetime.assertActive();
        return { result: "unknown" };
      },
      dispose: lifetime.dispose,
    };
  },
  openPaidy: async (action, callback, signal) => {
    if (action.script_url !== PAIDY_SCRIPT) throw new Error(PAYMENT_UI_UNAVAILABLE);
    const lifetime = ownProviderDocument(signal);
    await boundedProviderOperation(loadPaymentScript(action.script_url), signal);
    lifetime.assertActive();
    const sdk = (window as unknown as { Paidy?: PaidyGlobal }).Paidy;
    if (!sdk || typeof sdk.configure !== "function") throw new Error(PAYMENT_UI_UNAVAILABLE);
    let claimed = false;
    // Normal payment uses `closed`; token-only on_close is a different contract.
    const handler = sdk.configure({ api_key: action.public_key, closed: (response) => {
      if (lifetime.active() && !claimed) { claimed = true; callback(response); }
    } });
    handler.launch(action.payload);
    return { dispose: (returnUrl?: string) => { leaveProviderDocument(returnUrl); } };
  },
};
