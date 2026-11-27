"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { MemberAccess } from "@/components/auth/member-access";
import { LoginRequiredState } from "@/components/common/state-panel";
import { CatalogLoading } from "@/components/catalog/catalog-message";
import { usePointClient } from "@/components/points/point-client-provider";
import { presentPaymentProblem, type Payment } from "@/lib/platform";
import { usePaymentClient } from "./payment-client-provider";
import { usePaymentPolling } from "./use-payment-polling";
import { paymentMethodLabel } from "./payment-history-presentation";
import { usePaymentReturnEvent } from "./use-payment-return-event";
import { finishPaymentAttempt, readPaymentAttempt, rememberFailedInlinePayment, isFailedInlinePayment } from "./payment-attempt";
import { reportPurchaseComplete } from "@/lib/analytics/gtm";
import { rememberPurchase } from "@/lib/analytics/purchase-recovery";

function formatAmount(payment: Payment) {
  return new Intl.NumberFormat("ja-JP", {
    currency: payment.amount.currency,
    style: "currency",
  }).format(payment.amount.amount);
}

function formatExpiry(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ErrorScreen() {
  return (
    <section className="payment-result payment-result--error">
      <p>ERROR</p>
      <h1>エラー</h1>
      <span>エラーが発生しました。</span>
      <Link className="button button--dark" href="/mypage">マイページへ戻る</Link>
    </section>
  );
}

function SuccessScreen({ payment }: { payment: Payment }) {
  return (
    <section className="payment-result payment-result--success">
      <div aria-hidden="true" className="payment-result__mark">✓</div>
      <h1>購入完了しました</h1>
      <p>コイン購入して頂き、ありがとうございます。</p>
      <p>{paymentMethodLabel(payment.method, payment.method_label)}</p>
      <Link className="button button--dark" href="/mypage/purchases">購入履歴</Link>
    </section>
  );
}

function TerminalFailure({ payment, univapay = false }: { readonly payment: Payment; readonly univapay?: boolean }) {
  const copy = payment.status === "canceled"
    ? { description: "決済をキャンセルしました。", title: "決済をキャンセルしました" }
    : payment.status === "expired"
      ? { description: "お支払い期限が切れました。", title: "お支払い期限が切れました" }
      : { description: univapay ? "入力されたカードが使用できません、他のカードでお試しください。" : "決済が失敗しました。", title: "決済が失敗しました" };
  return (
    <section className="payment-result payment-result--error">
      <p>PAYMENT</p>
      <h1>{copy.title}</h1>
      <span>{copy.description}</span>
      <Link className="button button--dark" href="/points">コイン購入へ戻る</Link>
    </section>
  );
}

function UnpaidGuide({ payment }: { readonly payment: Payment }) {
  const { client } = usePaymentClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const konbini = payment.method === "konbini";
  const copy = konbini ? {
    description: "コンビニ決済案内ページより手続きをお願いいたします。",
    information: "コンビニ決済情報",
    note: "※コンビニ決済キャンセルにつきましてもコンビニ決済案内ページより可能になります。",
    title: "コンビニ決済のご案内",
    cta: "コンビニ決済案内ページへ",
  } : {
    description: "振込案内ページより手続きをお願いいたします。",
    information: "銀行振込情報",
    note: "※振込キャンセルにつきましても振込案内ページより可能になります。",
    title: "銀行振込のご案内",
    cta: "銀行振込案内ページへ",
  };

  const resume = async () => {
    if (!client || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await client.resumeUnpaidPayment(payment.id);
      window.location.assign(data.next_action.url);
    } catch (reason) {
      setError(presentPaymentProblem(reason).message);
      setBusy(false);
    }
  };

  return (
    <section className="payment-unpaid-guide">
      <header>
        <p>PAYMENT GUIDE</p>
        <h1>{copy.title}</h1>
        <span>{copy.description}</span>
      </header>
      <dl>
        <div><dt>振込金額</dt><dd>{formatAmount(payment)}</dd></div>
        <div><dt>お支払い期限</dt><dd>{formatExpiry(payment.expires_at)}</dd></div>
      </dl>
      <p className="payment-unpaid-guide__information">{copy.information}</p>
      {error ? <p className="payment-inline-error" role="alert">{error}</p> : null}
      <MemberAccess><button className="button button--dark" disabled={busy} onClick={resume} type="button">
        {busy ? "案内を確認中…" : copy.cta}
      </button></MemberAccess>
      <p className="payment-unpaid-guide__note">{copy.note}</p>
    </section>
  );
}

export function PaymentThanks({ pid }: { readonly pid: string | null }) {
  usePaymentReturnEvent(pid);
  const { state: session } = useSession();
  const { client, uiGateway } = usePaymentClient();
  const { refreshWallet } = usePointClient();
  const refreshedPaymentId = useRef<string | null>(null);
  const authenticatedClient = session.status === "authenticated" ? client : null;
  const subject = session.status === "authenticated" ? session.session.user?.id : null;
  const [inlineContext, setInlineContext] = useState<{ subject: string; pid: string } | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      try {
        if (!active || !subject || !pid) return;
        const attempt = readPaymentAttempt(subject);
        if (attempt?.paymentId === pid && !attempt.stripe || isFailedInlinePayment(subject, pid)) setInlineContext({ subject, pid });
      } catch { /* No trusted provider context. */ }
    });
    return () => { active = false; };
  }, [subject, pid]);
  const correlatedInline = Boolean(subject && inlineContext?.subject === subject && inlineContext.pid === pid);
  const [revision, setRevision] = useState(0);
  const polling = usePaymentPolling(authenticatedClient, pid, correlatedInline, revision);
  const verified = polling.status === "ready" || polling.status === "delayed" ? polling.payment : null;
  const univapay = correlatedInline && verified?.method === "credit_card" && verified.provider_sync !== true && verified.next_action?.type !== "stripe_checkout";
  const syncRequired = verified?.id === pid && verified?.provider_sync === true &&
    !["succeeded", "failed", "canceled", "expired"].includes(verified.status);
  useEffect(() => {
    if (!authenticatedClient || !pid || !uiGateway || !syncRequired) return;
    const controller = new AbortController();
    const sync = () => { void uiGateway.syncStripePayment(pid, { timeout_ms: 5000, signal: controller.signal }).catch(() => undefined); };
    const timers = [0, 5000, 15000, 30000, 60000].map(delay => window.setTimeout(sync, delay));
    return () => { controller.abort(); timers.forEach(window.clearTimeout); };
  }, [authenticatedClient, pid, syncRequired, uiGateway]);

  useEffect(() => {
    if (session.status !== "authenticated" || !session.session.user?.id || (polling.status !== "ready" && polling.status !== "delayed") || polling.payment.id !== pid) return;
    const payment = polling.payment;
    const user = session.session.user;
    let active = true;
    const run = async () => {
      if (polling.status === "ready" && payment.status === "succeeded" && payment.amount.currency === "JPY") {
        const result = await reportPurchaseComplete({ userId: user.id, email: user.email, revenue: payment.amount.amount, paymentId: payment.id, isActive: () => active });
        await rememberPurchase(payment, pid, user.id, result, () => active);
      } else await rememberPurchase(payment, pid, user.id, undefined, () => active);
    };
    void run();
    return () => { active = false; };
  }, [pid, polling, session]);

  useEffect(() => {
    const subject = session.status === "authenticated" ? session.session.user?.id : null;
    if (!subject || polling.status !== "ready" || !["succeeded", "failed", "canceled", "expired"].includes(polling.payment.status)) return;
    try {
      const attempt = readPaymentAttempt(subject);
      if (univapay && polling.payment.status === "failed") {
        try { rememberFailedInlinePayment(subject, polling.payment.id); }
        catch { /* Optional display persistence must not retain a confirmed-failed purchase lock. */ }
      }
      if (attempt?.paymentId === polling.payment.id) finishPaymentAttempt(subject, attempt.idempotencyKey);
    } catch { /* A broken correlation never permits another charge. */ }
  }, [polling, session, univapay]);

  useEffect(() => {
    if (polling.status !== "ready" || polling.payment.status !== "succeeded") return;
    if (refreshedPaymentId.current === polling.payment.id) return;
    refreshedPaymentId.current = polling.payment.id;
    void refreshWallet();
  }, [polling, refreshWallet]);

  if (session.status === "loading") return <CatalogLoading label="決済状況を確認中" />;
  if (session.status === "unauthenticated" || session.status === "session-expired") return <LoginRequiredState />;
  if (session.status === "configuration-unavailable" || !client) return <ErrorScreen />;
  if (session.status === "error") return <ErrorScreen />;
  if (polling.extended && (polling.status === "loading" || (polling.status === "ready" && !["succeeded", "failed", "canceled", "expired"].includes(polling.payment.status) && polling.payment.method !== "konbini" && polling.payment.method !== "virtual_account"))) {
    return <section aria-live="polite" className="payment-result payment-result--processing">
      <h1>決済処理中です</h1>
      <p>完了すると自動で表示が切り替わります。この画面を離れても、購入は完了します。</p>
      <Link href="/mypage/purchases">購入履歴</Link>
      {univapay ? <button type="button" disabled>決済状況を再確認する</button> : null}
    </section>;
  }
  if (polling.status === "loading") return <CatalogLoading label="決済状況を確認中" />;
  if (polling.status === "invalid" || polling.status === "error") return <ErrorScreen />;
  if (univapay && verified && !["succeeded", "failed", "canceled", "expired"].includes(verified.status)) {
    return <section aria-live="polite" className="payment-result payment-result--processing">
      <h1>決済確認中</h1>
      <button type="button" className="button button--dark" disabled={polling.status !== "delayed" || polling.refreshing} onClick={() => setRevision(value => value + 1)}>決済状況を再確認する</button>
    </section>;
  }
  if (polling.status === "delayed") {
    return (
      <section aria-live="polite" className="payment-result payment-result--processing">
        <h1>決済処理中</h1>
        <p>購入履歴から確認してください</p>
      </section>
    );
  }

  const payment = polling.payment;
  if (payment.status === "succeeded") return <SuccessScreen payment={payment} />;
  if (["failed", "canceled", "expired"].includes(payment.status)) return <TerminalFailure payment={payment} univapay={univapay} />;
  if (payment.method === "konbini" || payment.method === "virtual_account") return <UnpaidGuide payment={payment} />;
  return <CatalogLoading label="お支払いを確認しています" />;
}
