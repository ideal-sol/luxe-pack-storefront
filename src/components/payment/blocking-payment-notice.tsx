"use client";

import { ApiProblemError, type PublicComponents } from "@oripa/storefront-client";
import { useEffect, useRef, useState } from "react";
import { createPaymentIdempotencyKey } from "@/lib/platform";
import { STRIPE_OFFER_REFRESH } from "@/lib/platform/stripe-checkout-leave";
import { paymentHistoryDetailRoute, pointPurchaseDetailRoute } from "@/lib/routes/navigation";
import { usePaymentClient } from "./payment-client-provider";
import { beginPaymentAttempt, finishPaymentAttempt, markStripePaymentAttempt, readPaymentAttempt } from "./payment-attempt";
import { boundedProviderOperation } from "./provider-document";
import { isStripePayment, paymentThanksRoute } from "./provider-payment-actions";

type BlockingPayment = PublicComponents["schemas"]["BlockingPayment"];
const shortTime = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const date = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric" });
const refresh = () => window.dispatchEvent(new Event(STRIPE_OFFER_REFRESH));
const unconfirmed = "取消の結果を確認できませんでした";
const pending = "取消の結果を確認中です。反映まで数分かかることがあります";

function startedAt(value: string) {
  const time = new Date(value);
  return `${date.format(time) === date.format(Date.now()) ? "" : date.format(time) + " "}${shortTime.format(time)}`;
}
function releaseTime(value: string) {
  const rounded = Math.ceil(Date.parse(value) / 300_000) * 300_000;
  const [hours, minutes] = shortTime.format(rounded).split(":");
  return `${Number(hours)}時${Number(minutes)}分`;
}

export function BlockingPaymentNotice({ payments, subject, truncated = false, activeId }: {
  payments: readonly BlockingPayment[] | undefined; subject: string; truncated?: boolean | undefined; activeId?: string | null;
}) {
  const [message, setMessage] = useState("");
  const visible = payments?.filter(payment => payment.id !== activeId) ?? [];
  if (!visible.length && !message && !truncated) return null;
  return <section className="point-rate-notice" aria-label="途中の決済">
    {message && <p role="status">{message}</p>}
    {visible.map(payment => <PaymentNoticeRow key={payment.id} payment={payment} subject={subject} announce={setMessage} />)}
    {truncated && <p>ほかにも途中の決済があります。各商品の画面でご確認ください</p>}
  </section>;
}

function PaymentNoticeRow({ payment, subject, announce }: {
  payment: BlockingPayment; subject: string; announce: (message: string) => void;
}) {
  const { uiGateway } = usePaymentClient();
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ mode: "retry" | "check"; snapshot: BlockingPayment } | null>(null);
  const mode = result?.snapshot === payment ? result.mode : null;
  const active = useRef(false);
  const operation = useRef<AbortController | null>(null);
  const key = useRef<string | null>(null);
  const id = payment.id;
  const canCancel = payment.cancellable && payment.cancel_restores_offer && !payment.cancellation_pending;
  const canResume = payment.resumable && payment.method !== "paidy" && !payment.cancellation_pending;
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; operation.current?.abort(); };
  }, []);
  function finishSame() {
    const saved = readPaymentAttempt(subject);
    if (saved?.paymentId === id) finishPaymentAttempt(subject, saved.idempotencyKey);
  }
  async function act(kind: "cancel" | "resume") {
    if (operation.current || !uiGateway || payment.cancellation_pending) return;
    if (kind === "cancel" ? !canCancel : !canResume) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setConfirmation(false);
    announce("");
    try {
      if (kind === "cancel") {
        const saved = readPaymentAttempt(subject);
        key.current ??= (saved?.paymentId === id && saved.stripe?.cancelKey) || createPaymentIdempotencyKey();
        const { data } = await boundedProviderOperation(uiGateway.cancelPayment(id, {
          idempotency_key: key.current, timeout_ms: 5000, signal: controller.signal,
        }), controller.signal, 5000);
        if (!active.current) return;
        if (data.id !== id) throw new Error();
        if (data.status === "canceled" || data.status === "expired" || data.status === "succeeded") {
          finishSame();
          setResult({ mode: "check", snapshot: payment });
          announce(data.status === "succeeded" ? "お支払いが完了していました" : "取り消しました");
          if (data.status === "succeeded") window.location.replace(paymentThanksRoute(id));
        } else {
          if (data.status === "failed") finishSame();
          setResult({ mode: "check", snapshot: payment });
          announce(unconfirmed + "。反映まで数分かかることがあります");
        }
        refresh();
      } else {
        const { data } = await uiGateway.getPayment(id);
        if (!active.current) return;
        if (data.id !== id || !data.point_product_id || data.method !== payment.method) throw new Error();
        if (["succeeded", "failed", "expired", "canceled"].includes(data.status)) {
          finishSame();
          if (data.status === "succeeded") window.location.replace(paymentThanksRoute(id));
          refresh();
          return;
        }
        if (data.cancellation_pending) { setResult({ mode: "check", snapshot: payment }); announce(pending); refresh(); return; }
        if (payment.method !== "credit_card") {
          if (!["virtual_account", "konbini"].includes(data.method) || !data.provider_sync || data.status !== "processing") throw new Error();
          window.location.assign(paymentHistoryDetailRoute(id));
          return;
        }
        if (!isStripePayment(data) || !["created", "requires_action"].includes(data.status)) throw new Error();
        const saved = readPaymentAttempt(subject);
        if (saved && (saved.paymentId !== id || saved.productId !== data.point_product_id)) {
          announce("開始済みのお支払いがあります。元の商品の決済状況をご確認ください。");
          return;
        }
        if (!saved) beginPaymentAttempt(subject, {
          productId: data.point_product_id, paymentId: id, idempotencyKey: createPaymentIdempotencyKey(),
          stripe: { method: "credit_card", cancelKey: createPaymentIdempotencyKey() },
        });
        else if (!saved.stripe) markStripePaymentAttempt(subject, saved.idempotencyKey, createPaymentIdempotencyKey());
        window.location.assign(pointPurchaseDetailRoute(data.point_product_id));
      }
    } catch (error) {
      if (!active.current) return;
      if (kind === "resume") announce("決済状態を確認できませんでした。");
      else if (error instanceof ApiProblemError && error.status === 409 && error.code === "PAYMENT_NOT_CANCELLABLE") {
        announce("この決済は取り消せません"); setResult({ mode: "check", snapshot: payment }); refresh();
      } else if (error instanceof ApiProblemError && error.status === 409 && error.code === "BANK_TRANSFER_PARTIALLY_FUNDED") {
        announce("一部のご入金があるため取り消せません。期限まで残りのお振込みをお待ちします"); setResult({ mode: "check", snapshot: payment });
      } else {
        announce(unconfirmed); setResult({ mode: "retry", snapshot: payment });
      }
    } finally {
      controller.abort();
      operation.current = null;
      if (active.current) setBusy(false);
    }
  }
  const check = <button type="button" disabled={busy} onClick={refresh}>状態を確認する</button>;
  const cancel = <button type="button" disabled={busy} onClick={() => setConfirmation(true)}>取り消して選び直す</button>;
  const resume = canResume && <button type="button" disabled={busy} onClick={() => void act("resume")}>お支払いを続ける</button>;
  let controls;
  if (payment.cancellation_pending) controls = <><p>{pending}</p>{check}</>;
  else if (mode === "retry") controls = <>{check}<button type="button" disabled={busy} onClick={() => void act("cancel")}>もう一度取り消す</button></>;
  else if (mode === "check") controls = check;
  else if (!payment.cancel_restores_offer) controls = payment.resumable ? resume : <p>支払い番号・振込先は購入履歴からご確認いただけます。</p>;
  else if (payment.cancellable) controls = <>{payment.resumable && resume}{cancel}</>;
  else if (payment.auto_release_at) controls = <p>この決済は、{releaseTime(payment.auto_release_at)}ごろに自動で取り消されます</p>;
  else controls = <><p>決済の状況を確認中です。確認が終わるまでお待ちください</p>{check}</>;
  return <div>
    <p>お支払い手続きの途中の決済があります（{payment.point_product_name}／{payment.method_label}／{startedAt(payment.started_at)} に開始）</p>
    <p>{payment.cancel_restores_offer || payment.cancellation_pending ? "この決済が終わるまで、初回限定の商品は購入できません。" : "この決済のお支払いが完了すると、初回限定の購入として扱われます"}</p>
    {confirmation && canCancel ? <div className="payment-save-confirmation" role="presentation" onKeyDown={event => {
      if (event.key === "Escape") setConfirmation(false);
    }}><section role="dialog" aria-modal="true" aria-label="取消の確認" className="payment-save-confirmation__dialog">
      <p>この決済を取り消します。取り消すと、この決済ではお支払いいただけなくなります。よろしいですか？</p>
      {(payment.method === "konbini" || payment.method === "virtual_account") &&
        <p>発行済みの支払い番号（振込先の案内）は使えなくなります。すでにお支払い済みの場合は取り消されません</p>}
      <div className="payment-save-confirmation__actions">
        <button autoFocus className="button button--ghost" type="button" onClick={() => setConfirmation(false)}>戻る</button>
        <button className="button button--dark" type="button" disabled={busy} onClick={() => void act("cancel")}>取り消す</button>
      </div>
    </section></div> : controls}
  </div>;
}
