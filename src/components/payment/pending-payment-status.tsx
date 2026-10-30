"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PAYMENT_STATUS_CHECK_EVENT, readPaymentAttempt } from "./payment-attempt";
import { paymentThanksRoute } from "./provider-payment-actions";
import { usePaymentClient } from "./payment-client-provider";

// Outside the method loader: existing status stays reachable when new starts
// are disabled or a pending first-purchase product becomes ineligible.
export function PendingPaymentStatus({ subject, productId }: { subject: string; productId: string }) {
  const { uiGateway } = usePaymentClient();
  const [known, setKnown] = useState<{ subject: string; productId: string; paymentId: string; verified: boolean } | null>(null);
  const redirected = useRef<string | null>(null);
  const [providerActive, setProviderActive] = useState(false);
  const current = known?.subject === subject && known.productId === productId ? known : null;
  useEffect(() => {
    if (!current?.verified || providerActive) return;
    const key = `${subject}:${current.paymentId}`;
    try { if (readPaymentAttempt(subject)?.paymentId !== current.paymentId) return; }
    catch { return; }
    if (redirected.current === key) return;
    redirected.current = key;
    window.location.replace(paymentThanksRoute(current.paymentId));
  }, [current, subject, providerActive]);
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
    const onCheck = (event: Event) => {
      const detail = (event as CustomEvent<{ providerActive?: boolean; check?: boolean }>).detail;
      setProviderActive(detail?.providerActive === true);
      if (detail?.check !== false) check();
    };
    window.addEventListener(PAYMENT_STATUS_CHECK_EVENT, onCheck);
    return () => { active = false; window.removeEventListener(PAYMENT_STATUS_CHECK_EVENT, onCheck); };
  }, [productId, subject, uiGateway]);
  if (!known || known.subject !== subject || known.productId !== productId) return null;
  return <p role="status">開始済みのお支払いがあります。購入し直さず、<Link href={paymentThanksRoute(known.paymentId)}>開始済みの決済状況を確認する</Link>からご確認ください。</p>;
}
