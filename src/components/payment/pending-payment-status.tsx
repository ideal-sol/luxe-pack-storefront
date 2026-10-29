"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readPaymentAttempt } from "./payment-attempt";
import { paymentThanksRoute } from "./provider-payment-actions";
import { usePaymentClient } from "./payment-client-provider";

// Outside the method loader: existing status stays reachable when new starts
// are disabled or a pending first-purchase product becomes ineligible.
export function PendingPaymentStatus({ subject, productId }: { subject: string; productId: string }) {
  const { uiGateway } = usePaymentClient();
  const [known, setKnown] = useState<{ subject: string; productId: string; paymentId: string } | null>(null);
  useEffect(() => {
    let active = true;
    if (!uiGateway) return;
    try {
      const attempt = readPaymentAttempt(subject);
      if (attempt?.productId !== productId || !attempt.paymentId) return;
      const paymentId = attempt.paymentId;
      void uiGateway.getPayment(paymentId).then(({ data }) => {
        if (active && data.id === paymentId && data.method === "credit_card" && data.point_product_id === productId) {
          setKnown({ subject, productId, paymentId });
        }
      }).catch(() => { /* Retain correlation; no replacement payment. */ });
    } catch { /* Invalid/unavailable storage never authorizes a new payment. */ }
    return () => { active = false; };
  }, [productId, subject, uiGateway]);
  if (!known || known.subject !== subject || known.productId !== productId) return null;
  return <p role="status">開始済みのお支払いがあります。購入し直さず、<Link href={paymentThanksRoute(known.paymentId)}>開始済みの決済状況を確認する</Link>からご確認ください。</p>;
}
