"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { pointPurchaseDetailRoute } from "@/lib/routes/navigation";
import { ApiProblemError } from "@oripa/storefront-client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPaymentIdempotencyKey } from "@/lib/platform";
import { prepareStripeLeave, STRIPE_OFFER_REFRESH } from "@/lib/platform/stripe-checkout-leave";
import { PAYMENT_UI_PENDING, type PaymentUiGateway, type UiPayment } from "@/lib/platform/payment-ui-gateway";
import { beginPaymentAttempt, finishPaymentAttempt, identifyPaymentAttempt, markStripePaymentAttempt, readPaymentAttempt, type PaymentAttempt } from "./payment-attempt";
import { isStripePayment, paymentThanksRoute, validateStripeAction } from "./provider-payment-actions";
import { usePaymentClient } from "./payment-client-provider";
import { boundedProviderOperation } from "./provider-document";

const StripeCardElement = dynamic(() => import("./stripe-card-element").then(module => module.StripeCardElement), { ssr: false });
type Action = ReturnType<typeof validateStripeAction>;
type View = { kind: "input"; action: Action; amount: number } | { kind: "loading" | "preparation" | "pending" | "unknown" | "uncertain" | "open" };
export type StripeEntry = {
  start: () => void;
  recover: (payment: UiPayment, attempt: PaymentAttempt) => void;
};
const rateLimited = "短時間に決済の開始が続いたため、カードでのお支払いを一時的にご利用いただけません。時間をおいてお試しいただくか、ほかのお支払い方法をご利用ください";
const refreshOffers = () => window.dispatchEvent(new Event(STRIPE_OFFER_REFRESH));
const terminal = (status: string) => ["succeeded", "failed", "canceled", "expired"].includes(status);

function checkoutAction(payment: UiPayment) {
  return payment.status === "requires_action" && payment.next_action ? validateStripeAction(payment) : null;
}

function paymentExpired(payment: UiPayment) {
  return payment.provider_sync === true && !!payment.expires_at && Date.parse(payment.expires_at) <= Date.now();
}

export function StripePurchase({ subject, productId, children }: {
  subject: string | null; productId: string; children: (entry: StripeEntry) => ReactNode;
}) {
  const { uiGateway } = usePaymentClient();
  const [active, setActive] = useState<PaymentAttempt | null>();
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive || !subject) return;
      try {
        const attempt = readPaymentAttempt(subject);
        setActive(attempt?.stripe ? attempt : null);
      } catch { setError(PAYMENT_UI_PENDING); }
    });
    return () => { alive = false; };
  }, [subject, productId]);
  const recover = useCallback((payment: UiPayment, attempt: PaymentAttempt) => {
    if (!subject || !isStripePayment(payment) || attempt.productId !== productId || payment.id !== attempt.paymentId) return;
    try { setActive(markStripePaymentAttempt(subject, attempt.idempotencyKey, createPaymentIdempotencyKey())); }
    catch { setError(PAYMENT_UI_PENDING); }
  }, [subject, productId]);
  const done = useCallback((message = "") => { setActive(null); setError(message); refreshOffers(); }, []);
  function start() {
    if (!subject || !uiGateway) return;
    try {
      const attempt: PaymentAttempt = { productId, paymentId: null, idempotencyKey: createPaymentIdempotencyKey(),
        stripe: { method: "credit_card", cancelKey: createPaymentIdempotencyKey() } };
      beginPaymentAttempt(subject, attempt);
      setError("");
      setActive(attempt);
    } catch { setError(PAYMENT_UI_PENDING); }
  }
  if (subject && active === undefined) return <p role="status">{error || "決済状態を確認しています。"}</p>;
  if (active && subject) {
    if (!uiGateway) return <p role="status">{PAYMENT_UI_PENDING}</p>;
    return <StripeAttempt key={active.idempotencyKey} initial={active} otherProduct={active.productId !== productId}
      subject={subject} gateway={uiGateway} done={done} />;
  }
  return <>{error && <p role="alert">{error}</p>}{children({ start, recover })}</>;
}

function StripeAttempt({ initial, otherProduct, subject, gateway, done }: {
  initial: PaymentAttempt; otherProduct: boolean; subject: string; gateway: PaymentUiGateway; done: (error?: string) => void;
}) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [cancellationUnconfirmed, setCancellationUnconfirmed] = useState(false);
  const attempt = useRef(initial);
  const sequence = useRef(0);
  const mounted = useRef(false);
  const confirmation = useRef<"idle" | "pending" | "restored">("idle");
  const dispatched = useRef(false);
  const leave = useRef<(() => void) | null>(null);
  const manual = useRef(false);
  const lifecycle = useRef(0);
  const invalidateReads = useCallback(() => { ++sequence.current; }, []);
  const navigate = (id: string) => window.location.replace(paymentThanksRoute(id));
  const sendLeave = useCallback(() => {
    if (!leave.current || dispatched.current || confirmation.current !== "idle" || manual.current) return;
    dispatched.current = true;
    leave.current();
  }, []);
  const observe = useCallback(async (intent: "recover" | "check" | "cancel", known?: UiPayment) => {
    const serial = ++sequence.current;
    const current = () => mounted.current && serial === sequence.current;
    const a = attempt.current;
    const id = a.paymentId;
    const owned = (p: UiPayment) => p.method === "credit_card" && p.point_product_id === a.productId &&
      p.amount.currency === "JPY" && (!attempt.current.paymentId || p.id === attempt.current.paymentId);
    let verifiedStripe = false;
    const settled = (payment: UiPayment, synchronized = false) => {
      if (!owned(payment)) throw new Error();
      if (terminal(payment.status)) {
        const wasConfirming = confirmation.current !== "idle";
        confirmation.current = "idle";
        if (!otherProduct && payment.status === "succeeded" && (intent !== "recover" || synchronized || wasConfirming)) navigate(payment.id);
        else { finishPaymentAttempt(subject, a.idempotencyKey); done(); }
        return true;
      }
      if (otherProduct) { setView({ kind: "unknown" }); return true; }
      if (!isStripePayment(payment)) { setView({ kind: "uncertain" }); return true; }
      verifiedStripe = true;
      if (payment.cancellation_pending) { setView({ kind: "pending" }); return true; }
      if (payment.status === "processing") { confirmation.current = "idle"; navigate(payment.id); return true; }
      return false;
    };
    leave.current = null;
    if (intent === "recover" && confirmation.current === "idle") setView({ kind: "loading" });
    try {
      let payment: UiPayment;
      if (known) payment = known;
      else if (!id) {
        if (otherProduct) { setView({ kind: "uncertain" }); return; }
        const { data } = await gateway.startPayment({ point_product_id: a.productId, payment_method: a.stripe!.method }, { idempotency_key: a.idempotencyKey });
        if (!current()) return;
        if (!owned(data)) throw new Error();
        identifyPaymentAttempt(subject, a.idempotencyKey, data.id);
        attempt.current = { ...a, paymentId: data.id };
        payment = data;
      } else payment = (await gateway.getPayment(id)).data;
      if (!current()) return;
      if (settled(payment)) return;
      if (confirmation.current !== "idle") return;
      if (manual.current && intent === "recover") { setView({ kind: "unknown" }); return; }
      if (payment.status === "created" && payment.next_action == null && intent === "recover") {
        try {
          payment = (await gateway.resumeStripeCheckout(payment.id, { idempotency_key: a.idempotencyKey })).data;
        } catch { if (current()) setView({ kind: "preparation" }); return; }
        if (!current()) return;
        if (settled(payment)) return;
      }
      let action = checkoutAction(payment);
      if (payment.status === "requires_action" && (paymentExpired(payment) || (action && action.expiresAt <= Date.now()))) {
        payment = (await gateway.syncStripePayment(payment.id, { timeout_ms: 5000 })).data;
        if (!current() || settled(payment, true)) return;
        action = checkoutAction(payment);
      }
      if (!action || action.expiresAt <= Date.now() || paymentExpired(payment)) {
        setView({ kind: intent === "recover" ? "preparation" : "unknown" }); return;
      }
      if (intent !== "recover") { setView({ kind: "open" }); return; }
      const prepared = await prepareStripeLeave(payment.id, a.stripe!.cancelKey);
      if (!current()) return;
      leave.current = prepared;
      dispatched.current = false;
      setCancellationUnconfirmed(false);
      setView({ kind: "input", action, amount: payment.amount.amount });
    } catch (problem) {
      if (!current()) return;
      if (confirmation.current === "restored") return;
      if (!attempt.current.paymentId && problem instanceof ApiProblemError &&
          ["PAYMENT_START_RATE_LIMITED", "PAYMENT_AMOUNT_TOO_SMALL"].includes(problem.code)) {
        finishPaymentAttempt(subject, a.idempotencyKey);
        done(problem.code === "PAYMENT_START_RATE_LIMITED" ? rateLimited : "決済を準備できませんでした");
      } else setView({ kind: !attempt.current.paymentId ? "uncertain" : intent === "recover" && verifiedStripe ? "preparation" : "unknown" });
    }
  }, [done, gateway, otherProduct, subject]);

  useEffect(() => {
    const generation = ++lifecycle.current;
    const isGeneration = () => lifecycle.current === generation;
    mounted.current = true;
    void Promise.resolve().then(() => { if (mounted.current && lifecycle.current === generation) void observe("recover"); });
    const hide = () => { sendLeave(); };
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) {
        if (confirmation.current === "pending") confirmation.current = "restored";
        if (confirmation.current === "idle" && !manual.current) setBusy(false);
        void observe("recover");
      }
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      mounted.current = false;
      invalidateReads();
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      queueMicrotask(() => { if (!mounted.current && isGeneration()) sendLeave(); });
    };
  }, [invalidateReads, observe, sendLeave]);

  useEffect(() => {
    if (!["unknown", "pending", "open"].includes(view.kind)) return;
    const timer = window.setTimeout(() => void observe("check"), 5000);
    return () => window.clearTimeout(timer);
  }, [observe, view]);

  async function cancel() {
    const a = attempt.current;
    if (!a.paymentId || manual.current || confirmation.current !== "idle") return;
    manual.current = true;
    dispatched.current = true;
    leave.current = null;
    const serial = ++sequence.current;
    const current = () => mounted.current && serial === sequence.current;
    setBusy(true);
    setView({ kind: "loading" });
    const controller = new AbortController();
    try {
      const { data } = await boundedProviderOperation(gateway.cancelStripeCheckout(a.paymentId, "user", {
        idempotency_key: a.stripe!.cancelKey, timeout_ms: 5000, signal: controller.signal,
      }), controller.signal, 5000);
      if (current()) {
        if (terminal(data.status)) void observe("cancel", data);
        else { setCancellationUnconfirmed(true); setView({ kind: "unknown" }); void observe("check"); }
      }
    } catch {
      if (current()) { setCancellationUnconfirmed(true); setView({ kind: "unknown" }); void observe("check"); }
    }
    finally { controller.abort(); manual.current = false; if (mounted.current) setBusy(false); refreshOffers(); }
  }
  function isConfirming() { return confirmation.current !== "idle"; }
  async function complete() {
    const id = attempt.current.paymentId;
    if (!id || !mounted.current || !isConfirming()) return;
    const controller = new AbortController();
    try {
      const { data } = await boundedProviderOperation(gateway.syncStripePayment(id, { timeout_ms: 5000, signal: controller.signal }), controller.signal, 5000);
      if (mounted.current && confirmation.current === "restored" && terminal(data.status)) {
        await observe("check", data);
      }
    } catch { /* The owned status is also read on the thanks page. */ }
    finally {
      controller.abort();
      if (mounted.current && isConfirming()) {
        invalidateReads();
        leave.current = null;
        confirmation.current = "idle";
        navigate(id);
      }
    }
  }

  if (otherProduct) return <section aria-label="決済状態">
    <p role="status">別の商品の決済状態を確認しています。</p>
    <Link href={pointPurchaseDetailRoute(initial.productId)}>元の商品の決済に戻る</Link>
    {initial.paymentId && <button type="button" onClick={() => void observe("check")}>状態を確認する</button>}
  </section>;

  const messages = {
    loading: "決済状態を確認しています。", preparation: "決済を準備できませんでした",
    pending: "取消の結果を確認中です。", unknown: "状態を確認できませんでした。",
    open: "取消できませんでした。", uncertain: PAYMENT_UI_PENDING,
  };
  return <section className="point-purchase-detail" aria-label="クレジットカード決済">
    {cancellationUnconfirmed && <p>取消の結果を確認できませんでした。反映まで数分かかることがあります。</p>}
    {view.kind === "input" ? <StripeCardElement key={view.action.clientSecret} action={view.action} amount={view.amount}
      onConfirming={value => {
        if (!mounted.current || (!value && !isConfirming())) return;
        const restored = confirmation.current === "restored";
        confirmation.current = value ? "pending" : "idle";
        setBusy(value);
        if (!value && restored) void observe("recover");
      }} onComplete={complete} />
      : <p role="status">{messages[view.kind]}</p>}
    {["input", "preparation", "pending", "open"].includes(view.kind) && <button type="button" disabled={busy} onClick={() => void cancel()}>
      {view.kind === "pending" || view.kind === "open" ? "もう一度取り消す" : "支払いをやめる"}
    </button>}
    {view.kind === "input" && <button type="button" disabled={busy} onClick={() => {
      sendLeave(); setView({ kind: "unknown" }); void observe("check");
    }}>別の支払い方法を選ぶ</button>}
    {["pending", "unknown", "uncertain", "preparation"].includes(view.kind) && <button type="button" disabled={busy} onClick={() => void observe(view.kind === "uncertain" ? "recover" : "check")}>状態を確認する</button>}
    {view.kind === "open" && <button type="button" disabled={busy} onClick={() => void observe("recover")}>支払いに戻る</button>}
  </section>;
}
