"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from "react";
import {
  executePayment,
  initFincode,
  registerCard,
  type FincodeInstance,
  type FincodeUI,
} from "@fincode/js";
import type {
  PaymentCardComponentAction,
  PaymentCardRegistrationIntent,
  PaymentCardUiBootstrap,
} from "@/lib/platform";

export interface FincodeCardFieldsHandle {
  readonly execute: (action: PaymentCardComponentAction) => Promise<string | null>;
  readonly register: (intent: PaymentCardRegistrationIntent) => Promise<string>;
}

export const FincodeCardFields = forwardRef<FincodeCardFieldsHandle, {
  readonly bootstrap: PaymentCardUiBootstrap;
  readonly onMountStateChange: (mounted: boolean) => void;
}>(function FincodeCardFields({ bootstrap, onMountStateChange }, ref) {
  const reactId = useId();
  const mountId = `fincode-card-${reactId.replaceAll(":", "")}`;
  const providerRef = useRef<{ fincode: FincodeInstance; ui: FincodeUI } | null>(null);

  useImperativeHandle(ref, () => ({
    async execute(action) {
      const provider = providerRef.current;
      if (!provider) throw new Error("fincode Card UI is not mounted");
      const payment = await executePayment({
        accessId: action.access_id,
        fincode: provider.fincode,
        id: action.payment_id,
        payType: "Card",
        ui: provider.ui,
      });
      return payment.redirect_url ?? null;
    },
    async register(intent) {
      const provider = providerRef.current;
      if (!provider) throw new Error("fincode Card UI is not mounted");
      const card = await registerCard({
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
    onMountStateChange(false);
    providerRef.current = null;
    const mount = async () => {
      const fincode = await initFincode({
        isLiveMode: bootstrap.is_live_mode,
        publicKey: bootstrap.public_api_key,
      });
      if (!active) return;
      const ui = fincode.ui({ layout: "vertical" });
      ui.create("payments", {
        hidePayTimes: true,
        labelCardNo: "カード番号",
        labelCVC: "セキュリティコード",
        labelExpire: "有効期限",
        labelHolderName: "カード名義人",
        layout: "vertical",
      });
      ui.mount(mountId, "100%");
      if (!active) return;
      providerRef.current = { fincode, ui };
      onMountStateChange(true);
    };
    void mount().catch(() => {
      if (active) onMountStateChange(false);
    });
    return () => {
      active = false;
      providerRef.current = null;
      onMountStateChange(false);
      document.getElementById(mountId)?.replaceChildren();
    };
  }, [bootstrap.is_live_mode, bootstrap.public_api_key, mountId, onMountStateChange]);

  return (
    <div className="fincode-card-fields" data-testid="fincode-card-fields">
      <p className="fincode-card-fields__label">カード情報</p>
      <p className="fincode-card-fields__description">
        カード番号、有効期限、セキュリティコード、カード名義人を入力してください。
      </p>
      <div aria-label="クレジットカード入力フォーム" id={mountId} />
    </div>
  );
});
