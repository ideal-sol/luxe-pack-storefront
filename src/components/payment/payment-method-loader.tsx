"use client";

import { useEffect, useState } from "react";
import { ALPHA46_PAYMENT_METHODS, type PaymentMethodOption, type PaymentUiGateway } from "@/lib/platform/payment-ui-gateway";
import { usePaymentClient } from "./payment-client-provider";

type Result = { productId: string; subject: string; list: PaymentUiGateway["listPaymentMethods"]; options: PaymentMethodOption[] | null };
export function PaymentMethodLoader({ productId, subject, children }: {
  productId: string; subject: string;
  children(options: readonly PaymentMethodOption[], compatibility: boolean): React.ReactNode;
}) {
  const { client, uiGateway } = usePaymentClient();
  const list = uiGateway?.listPaymentMethods ?? client?.listPaymentMethods;
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!list) return;
    let active = true;
    void Promise.resolve().then(() => list(productId)).then(({ data }) => {
      const options = data.data;
      if (!Array.isArray(options) || options.some(o => !o || typeof o.method !== "string" || !o.method ||
          typeof o.label !== "string" || typeof o.available !== "boolean" || typeof o.saved_cards_enabled !== "boolean" || typeof o.flow !== "string") ||
          new Set(options.map(o => o.method)).size !== options.length) throw new Error("Payment method contract unavailable");
      if (active) setResult({ productId, subject, list, options });
    }).catch(() => { if (active) setResult({ productId, subject, list, options: null }); });
    return () => { active = false; };
  }, [list, productId, retry, subject]);
  if (!list) return children(ALPHA46_PAYMENT_METHODS, true);
  if (!result || result.productId !== productId || result.subject !== subject || result.list !== list) return <p role="status">お支払い方法を読み込み中です。</p>;
  if (!result.options) return <div role="alert"><p>お支払い方法を取得できませんでした。</p><button onClick={() => { setResult(null); setRetry(n => n + 1); }} type="button">再読み込み</button></div>;
  if (!result.options.length) return <p role="status">現在ご利用いただけるお支払い方法はありません。</p>;
  return children(result.options, false);
}
