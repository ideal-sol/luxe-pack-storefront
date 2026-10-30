"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PAYMENT_STATUS_CHECK_EVENT, readPaymentAttempt } from "./payment-attempt";
import { usePaymentPolling } from "./use-payment-polling";
import { paymentThanksRoute } from "./provider-payment-actions";
import { usePaymentClient } from "./payment-client-provider";

// Outside the method loader: existing status stays reachable when new starts
// are disabled or a pending first-purchase product becomes ineligible.
export function PendingPaymentStatus({ subject, productId }: { subject: string; productId: string }) {
  const { client, uiGateway } = usePaymentClient();
  const [known, setKnown] = useState<{ subject: string; productId: string; paymentId: string; verified: boolean } | null>(null);
  const redirected = useRef<string | null>(null);
  const current = known?.subject === subject && known.productId === productId ? known : null;
  const polling = usePaymentPolling(client, current?.verified ? current.paymentId : null);
  useEffect(() => {
    if (!current || polling.status !== "ready") return;
    const payment = polling.payment;
    if (payment.id !== current.paymentId || payment.point_product_id !== productId || payment.method !== "credit_card" || payment.status !== "succeeded") return;
    const key = `${subject}:${payment.id}`;
    try { if (readPaymentAttempt(subject)?.paymentId !== payment.id) return; }
    catch { return; }
    if (redirected.current === key) return;
    redirected.current = key;
    window.location.replace(paymentThanksRoute(payment.id));
  }, [current, polling, productId, subject]);
  useEffect(() => {
    let active = true;
    if (!uiGateway) return;
    const check = () => { try {
      const attempt = readPaymentAttempt(subject);
      if (attempt?.productId !== productId || !attempt.paymentId) return;
      const paymentId = attempt.paymentId;
      setKnown(previous => previous?.subject === subject && previous.productId === productId && previous.paymentId === paymentId
        ? previous : { subject, productId, paymentId, verified: false });
      void uiGateway.getPayment(paymentId).then(({ data }) => {
        if (active && data.id === paymentId && data.method === "credit_card" && data.point_product_id === productId) {
          setKnown({ subject, productId, paymentId, verified: true });
        } else if (active) {
          setKnown(null);
        }
      }).catch(() => { /* Retain correlation; no replacement payment. */ });
    } catch { /* Invalid/unavailable storage never authorizes a new payment. */ } };
    check();
    window.addEventListener(PAYMENT_STATUS_CHECK_EVENT, check);
    return () => { active = false; window.removeEventListener(PAYMENT_STATUS_CHECK_EVENT, check); };
  }, [productId, subject, uiGateway]);
  if (!known || known.subject !== subject || known.productId !== productId) return null;
  return <p role="status">開始済みのお支払いがあります。購入し直さず、<Link href={paymentThanksRoute(known.paymentId)}>開始済みの決済状況を確認する</Link>からご確認ください。</p>;
}
