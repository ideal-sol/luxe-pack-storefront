"use client";

import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";
import { loadStripe } from "@stripe/stripe-js/pure";
import { useMemo, useRef, useState } from "react";
import type { validateStripeAction } from "./provider-payment-actions";

type Props = {
  action: ReturnType<typeof validateStripeAction>;
  amount: number;
  onConfirming: (value: boolean) => void;
  onComplete: () => Promise<void>;
};

function Form({ action, amount, onConfirming, onComplete }: Props) {
  const result = useCheckoutElements();
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (result.type === "loading") return <p role="status">カード入力を準備しています。</p>;
  if (result.type === "error") return <p role="alert">{result.error.message}</p>;
  async function confirm() {
    if (running.current || result.type !== "success") return;
    running.current = true;
    onConfirming(true);
    setBusy(true);
    setError("");
    try {
      const response = await result.checkout.confirm({ redirect: "if_required", returnUrl: action.returnUrl });
      if (response.type === "error") {
        setError(response.error.message || "カード情報を確認してください。");
      } else {
        await onComplete();
        return;
      }
    } catch { setError("決済結果を確認できませんでした。"); }
    running.current = false;
    onConfirming(false);
    setBusy(false);
  }
  return <>
    <PaymentElement options={{ wallets: { applePay: "never", googlePay: "never", link: "never" } }} />
    {error && <p role="alert" className="payment-inline-error">{error}</p>}
    <button type="button" className="button button--dark payment-purchase-button" disabled={busy} onClick={() => void confirm()}>
      {busy ? "処理中…" : `${amount.toLocaleString("ja-JP")}円を支払う`}
    </button>
  </>;
}

export function StripeCardElement(props: Props) {
  const key = props.action.publishableKey;
  const stripe = useMemo(() => loadStripe(key, { locale: "ja" }), [key]);
  const options = useMemo(() => ({ clientSecret: props.action.clientSecret }), [props.action.clientSecret]);
  return <CheckoutElementsProvider stripe={stripe} options={options}><Form {...props} /></CheckoutElementsProvider>;
}
