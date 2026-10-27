import type { PaidyCheckoutAction, UnivapayInlineAction, UnivapayInlineForm } from "@/lib/platform/payment-ui-gateway";
import { PAYMENT_UI_UNAVAILABLE } from "@/lib/platform/payment-ui-gateway";
import { PAIDY_SCRIPT, UNIVAPAY_SCRIPT, validateInlineForm } from "./provider-payment-actions";

export type InlineResult = { result: "unknown" } | { result: "failed" } | { result: "reported"; charge_id: string };
export interface InlineSession {
  update(update: UnivapayInlineAction["update"], options: { forceUpdate: true }): Promise<void>;
  submit(): Promise<InlineResult>;
  validate(): Promise<boolean>;
  dispose(): void;
}
export interface PaymentProviderSdk {
  mountInline(form: UnivapayInlineForm, target: HTMLElement, validity: (valid: boolean) => void, signal: AbortSignal): Promise<InlineSession>;
  openPaidy(action: PaidyCheckoutAction, callback: (response: unknown) => void, signal: AbortSignal): Promise<{ dispose(): void }>;
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

/** The iframe's ownership/cleanup and normalized result are explicit dependencies.
 * U12 raw Promise/event decoding is intentionally not guessed here. A verified
 * Browser driver is a separate integration acceptance requirement.
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

export const browserPaymentProviderSdk: PaymentProviderSdk = {
  // No actual new-provider Runtime operation is enabled in this Source Draft.
  // Inject a provider-accepted driver together with the formal integrated Client.
  mountInline: async () => { throw new Error(PAYMENT_UI_UNAVAILABLE); },
  openPaidy: async (action, callback, signal) => {
    if (action.script_url !== PAIDY_SCRIPT) throw new Error(PAYMENT_UI_UNAVAILABLE);
    await loadPaymentScript(action.script_url);
    signal.throwIfAborted();
    const sdk = (window as unknown as { Paidy?: PaidyGlobal }).Paidy;
    if (!sdk || typeof sdk.configure !== "function") throw new Error(PAYMENT_UI_UNAVAILABLE);
    let active = true;
    const stop = () => { active = false; };
    signal.addEventListener("abort", stop, { once: true });
    // Normal payment uses `closed`; token-only on_close is a different contract.
    const handler = sdk.configure({ api_key: action.public_key, closed: (response) => {
      if (active && !signal.aborted) callback(response);
    } });
    handler.launch(action.payload);
    return { dispose: () => { stop(); signal.removeEventListener("abort", stop); } };
  },
};
