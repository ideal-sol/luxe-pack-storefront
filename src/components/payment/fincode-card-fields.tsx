"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from "react";
import type { FincodeInstance, FincodeUI } from "@fincode/js";
import type {
  PaymentCardComponentAction,
  PaymentCardRegistrationIntent,
  PaymentCardUiBootstrap,
} from "@/lib/platform";

const FINCODE_SCRIPT_URL = {
  live: "https://js.fincode.jp/v1/fincode.js",
  test: "https://js.test.fincode.jp/v1/fincode.js",
} as const;
const FINCODE_SCRIPT_TIMEOUT_MS = 15_000;
const FINCODE_UI_DEFAULT_WIDTH = 500;
const FINCODE_UI_MIN_WIDTH = 250;
const FINCODE_UI_MAX_WIDTH = 768;
const providerScriptPromises = new Map<string, Promise<void>>();

type FincodeSdk = typeof import("@fincode/js");
type FincodeWindow = Window & { readonly Fincode?: unknown };

export type FincodeCardUiStage = "sdk_load" | "init" | "ui_create" | "ui_mount" | "ui_render";

export class FincodeCardUiError extends Error {
  readonly stage: FincodeCardUiStage;

  constructor(stage: FincodeCardUiStage) {
    super("fincode Card UI setup failed");
    this.name = "FincodeCardUiError";
    this.stage = stage;
  }
}

function providerScriptSource(isLiveMode: boolean) {
  return isLiveMode ? FINCODE_SCRIPT_URL.live : FINCODE_SCRIPT_URL.test;
}

function findProviderScript(source: string) {
  return Array.from(document.scripts).find((script) => script.src === source) ?? null;
}

function providerMountWidth(target: HTMLElement) {
  const measured = Math.floor(target.getBoundingClientRect().width);
  const width = Number.isFinite(measured) && measured > 0 ? measured : FINCODE_UI_DEFAULT_WIDTH;
  return String(Math.min(FINCODE_UI_MAX_WIDTH, Math.max(FINCODE_UI_MIN_WIDTH, width)));
}

async function loadFincodeSdk(isLiveMode: boolean): Promise<FincodeSdk> {
  const sdk = await import("@fincode/js");
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("fincode Browser SDK requires a document");
  }

  const source = providerScriptSource(isLiveMode);
  const otherSource = providerScriptSource(!isLiveMode);
  if (typeof (window as FincodeWindow).Fincode === "function") {
    if (findProviderScript(otherSource) && !findProviderScript(source)) {
      throw new Error("fincode SDK environment mismatch");
    }
    return sdk;
  }

  let pending = providerScriptPromises.get(source);
  if (!pending) {
    pending = new Promise<void>((resolve, reject) => {
      const existing = findProviderScript(source);
      const script = existing ?? document.createElement("script");
      const created = !existing;
      let settled = false;
      const finish = (failure?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        script.removeEventListener("load", handleLoad);
        script.removeEventListener("error", handleError);
        if (failure) {
          if (created) script.remove();
          reject(failure);
        }
        else resolve();
      };
      const handleLoad = () => {
        if (typeof (window as FincodeWindow).Fincode !== "function") {
          finish(new Error("fincode SDK initializer is unavailable"));
          return;
        }
        finish();
      };
      const handleError = () => finish(new Error("fincode SDK resource failed to load"));
      const timeout = window.setTimeout(
        () => finish(new Error("fincode SDK resource load timed out")),
        FINCODE_SCRIPT_TIMEOUT_MS,
      );
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      if (!existing) {
        script.async = true;
        script.src = source;
        (document.head || document.body).appendChild(script);
      }
    });
    providerScriptPromises.set(source, pending);
    void pending.then(() => {
      if (providerScriptPromises.get(source) === pending) providerScriptPromises.delete(source);
    }, () => {
      if (providerScriptPromises.get(source) === pending) providerScriptPromises.delete(source);
    });
  }
  await pending;
  return sdk;
}

export interface FincodeCardFieldsHandle {
  readonly execute: (action: PaymentCardComponentAction) => Promise<string | null>;
  readonly register: (intent: PaymentCardRegistrationIntent) => Promise<string>;
}

type MountedProvider = {
  readonly fincode: FincodeInstance;
  readonly sdk: FincodeSdk;
  readonly ui: FincodeUI;
};

function withMerchantReturnUrls(
  fincode: FincodeInstance,
  action: PaymentCardComponentAction,
): FincodeInstance {
  return new Proxy(fincode, {
    get(target, property, receiver) {
      if (property !== "payments") return Reflect.get(target, property, receiver);
      return (
        transaction: Parameters<FincodeInstance["payments"]>[0],
        callback: Parameters<FincodeInstance["payments"]>[1],
        errorCallback: Parameters<FincodeInstance["payments"]>[2],
      ) => target.payments({
        ...transaction,
        return_url: action.return_url,
        return_url_on_failure: action.failure_url,
      }, callback, errorCallback);
    },
  });
}

export const FincodeCardFields = forwardRef<FincodeCardFieldsHandle, {
  readonly bootstrap: PaymentCardUiBootstrap;
  readonly onError?: (error: FincodeCardUiError) => void;
  readonly onMountStateChange: (mounted: boolean) => void;
}>(function FincodeCardFields({ bootstrap, onError, onMountStateChange }, ref) {
  const reactId = useId();
  const mountId = `fincode-card-${reactId.replaceAll(":", "")}`;
  const providerRef = useRef<MountedProvider | null>(null);

  useImperativeHandle(ref, () => ({
    async execute(action) {
      const provider = providerRef.current;
      if (!provider) throw new Error("fincode Card UI is not mounted");
      const payment = await provider.sdk.executePayment({
        accessId: action.access_id,
        fincode: withMerchantReturnUrls(provider.fincode, action),
        id: action.payment_id,
        payType: "Card",
        ui: provider.ui,
      });
      return payment.redirect_url ?? null;
    },
    async register(intent) {
      const provider = providerRef.current;
      if (!provider) throw new Error("fincode Card UI is not mounted");
      const card = await provider.sdk.registerCard({
        customerId: intent.provider_context.customer_id,
        fincode: provider.fincode,
        ui: provider.ui,
        useDefault: false,
      });
      return card.id;
    },
  }), []);

  useEffect(() => {
    let active = true;
    let cancelPendingLoad: (() => void) | null = null;
    onMountStateChange(false);
    providerRef.current = null;

    const fail = (stage: FincodeCardUiStage) => {
      if (!active) return;
      providerRef.current = null;
      onMountStateChange(false);
      onError?.(new FincodeCardUiError(stage));
    };

    const mount = async () => {
      let sdk: FincodeSdk;
      try {
        sdk = await loadFincodeSdk(bootstrap.is_live_mode);
      } catch {
        fail("sdk_load");
        return;
      }
      if (!active) return;

      let fincode: FincodeInstance;
      try {
        fincode = await sdk.initFincode({
          isLiveMode: bootstrap.is_live_mode,
          publicKey: bootstrap.public_api_key,
        });
      } catch {
        fail("init");
        return;
      }
      if (!active) return;

      let ui: FincodeUI;
      try {
        ui = fincode.ui({ layout: "vertical" });
        ui.create("payments", {
          hidePayTimes: true,
          labelCardNo: "カード番号",
          labelCVC: "セキュリティコード",
          labelExpire: "有効期限",
          labelHolderName: "カード名義人",
          layout: "vertical",
        });
      } catch {
        fail("ui_create");
        return;
      }
      if (!active) return;

      if (document.readyState !== "complete") {
        await new Promise<void>((resolve) => {
          let settled = false;
          const handleLoad = () => finish();
          const finish = () => {
            if (settled) return;
            settled = true;
            window.removeEventListener("load", handleLoad);
            cancelPendingLoad = null;
            resolve();
          };
          cancelPendingLoad = finish;
          window.addEventListener("load", handleLoad, { once: true });
        });
      }
      if (!active) return;

      const target = document.getElementById(mountId);
      if (!target?.isConnected) {
        fail("ui_mount");
        return;
      }
      try {
        target.replaceChildren();
        ui.mount(mountId, providerMountWidth(target));
      } catch {
        fail("ui_mount");
        return;
      }
      if (!active) {
        target.replaceChildren();
        return;
      }
      if (target.querySelector("iframe")?.isConnected !== true) {
        fail("ui_render");
        return;
      }
      providerRef.current = { fincode, sdk, ui };
      onMountStateChange(true);
    };

    void mount();
    return () => {
      active = false;
      cancelPendingLoad?.();
      providerRef.current = null;
      onMountStateChange(false);
      document.getElementById(mountId)?.replaceChildren();
    };
  }, [bootstrap.is_live_mode, bootstrap.public_api_key, mountId, onError, onMountStateChange]);

  return (
    <div className="fincode-card-fields" data-testid="fincode-card-fields">
      <p className="fincode-card-fields__label">カード情報</p>
      <p className="fincode-card-fields__description">
        カード番号、有効期限、セキュリティコード、カード名義人を入力してください。
      </p>
      <div className="fincode-card-fields__form" id={`${mountId}-form`}>
        <div aria-label="クレジットカード入力フォーム" className="fincode-card-fields__mount" id={mountId} />
      </div>
    </div>
  );
});
