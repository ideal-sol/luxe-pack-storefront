"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { LoginRequiredState } from "@/components/common/state-panel";
import { CatalogLoading } from "@/components/catalog/catalog-message";
import { presentPaymentProblem, type Payment } from "@/lib/platform";
import { usePaymentClient } from "./payment-client-provider";
import { usePaymentPolling } from "./use-payment-polling";

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

function SuccessScreen() {
  return (
    <section className="payment-result payment-result--success">
      <div aria-hidden="true" className="payment-result__mark">✓</div>
      <h1>購入完了しました</h1>
      <p>コイン購入して頂き、ありがとうございます。</p>
    </section>
  );
}

function TerminalFailure({ payment }: { readonly payment: Payment }) {
  const copy = payment.status === "canceled"
    ? { description: "決済をキャンセルしました。", title: "決済をキャンセルしました" }
    : payment.status === "expired"
      ? { description: "お支払い期限が切れました。", title: "お支払い期限が切れました" }
      : { description: "決済が失敗しました。", title: "決済が失敗しました" };
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
      <button className="button button--dark" disabled={busy} onClick={resume} type="button">
        {busy ? "案内を確認中…" : copy.cta}
      </button>
      <p className="payment-unpaid-guide__note">{copy.note}</p>
    </section>
  );
}

export function PaymentThanks({ pid }: { readonly pid: string | null }) {
  const { state: session } = useSession();
  const { client } = usePaymentClient();
  const authenticatedClient = session.status === "authenticated" ? client : null;
  const polling = usePaymentPolling(authenticatedClient, pid);

  if (session.status === "loading") return <CatalogLoading label="決済状況を確認中" />;
  if (session.status === "unauthenticated" || session.status === "session-expired") return <LoginRequiredState />;
  if (session.status === "configuration-unavailable" || !client) return <ErrorScreen />;
  if (session.status === "error") return <ErrorScreen />;
  if (polling.status === "loading") return <CatalogLoading label="決済状況を確認中" />;
  if (polling.status === "invalid" || polling.status === "error") return <ErrorScreen />;
  if (polling.status === "delayed") {
    return (
      <section aria-live="polite" className="payment-result payment-result--processing">
        <h1>決済処理中</h1>
        <p>購入履歴から確認してください</p>
      </section>
    );
  }

  const payment = polling.payment;
  if (payment.status === "succeeded") return <SuccessScreen />;
  if (["failed", "canceled", "expired"].includes(payment.status)) return <TerminalFailure payment={payment} />;
  if (payment.method === "konbini" || payment.method === "virtual_account") return <UnpaidGuide payment={payment} />;
  return <CatalogLoading label="決済処理中" />;
}
