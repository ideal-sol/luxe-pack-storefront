"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { LoginRequiredState } from "@/components/common/state-panel";
import { presentPaymentProblem, type Payment, type PaymentProblemPresentation, type PaymentStatus } from "@/lib/platform";
import { usePaymentClient } from "./payment-client-provider";
import {
  formatPaymentAmount,
  formatPaymentCoins,
  formatPaymentDate,
  paymentMethodLabel,
} from "./payment-history-presentation";

type DetailState =
  | { readonly status: "idle" | "loading" }
  | { readonly status: "error"; readonly paymentId: string; readonly problem: PaymentProblemPresentation; readonly sessionUserId: string }
  | { readonly status: "ready"; readonly payment: Payment; readonly paymentId: string; readonly sessionUserId: string };

const unpaidStatuses = new Set<PaymentStatus>(["created", "requires_action", "processing"]);

function GrantRow({ label, value }: { readonly label: string; readonly value: number }) {
  return <div><dt>{label}</dt><dd><data value={value}>{formatPaymentCoins(value)}</data></dd></div>;
}

export function PaymentHistoryDetail({ paymentId }: { readonly paymentId: string }) {
  const { state: session } = useSession();
  const { client } = usePaymentClient();
  const [state, setState] = useState<DetailState>({ status: "idle" });
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState(false);
  const sessionUserId = session.status === "authenticated" ? session.session.user?.id ?? null : null;

  useEffect(() => {
    if (!client || !sessionUserId) return;
    let active = true;
    void client.getPayment(paymentId)
      .then(({ data }) => {
        if (active) setState({ payment: data, paymentId, sessionUserId, status: "ready" });
      })
      .catch((error: unknown) => {
        if (active) setState({ paymentId, problem: presentPaymentProblem(error), sessionUserId, status: "error" });
      });
    return () => { active = false; };
  }, [client, paymentId, sessionUserId]);

  if (session.status === "loading") return <CatalogLoading label="購入詳細を読み込み中" />;
  if (session.status === "unauthenticated" || session.status === "session-expired") return <LoginRequiredState />;
  if (session.status === "configuration-unavailable" || !client) {
    return <CatalogMessage description="エラーが発生しました。" eyebrow="ERROR" title="購入詳細を表示できません" tone="error" />;
  }
  if (session.status === "error") {
    return <CatalogMessage description="エラーが発生しました。" eyebrow="ERROR" title="購入詳細を表示できません" tone="error" />;
  }
  if (state.status === "error" && state.paymentId === paymentId && state.sessionUserId === sessionUserId) {
    if (state.problem.sessionExpired) return <LoginRequiredState />;
    return <CatalogMessage description="エラーが発生しました。" eyebrow="ERROR" title="購入詳細を表示できません" tone="error" />;
  }
  if (state.status !== "ready" || state.paymentId !== paymentId || state.sessionUserId !== sessionUserId) {
    return <CatalogLoading label="購入詳細を読み込み中" />;
  }

  const payment = state.payment;
  const transferMethod = payment.method === "konbini" || payment.method === "virtual_account";
  const expired = transferMethod && payment.status === "expired";
  const resumable = transferMethod && unpaidStatuses.has(payment.status);

  const resume = async () => {
    if (!client || !resumable || resumeBusy) return;
    setResumeBusy(true);
    setResumeError(false);
    try {
      const { data } = await client.resumeUnpaidPayment(payment.id);
      window.location.assign(data.next_action.url);
    } catch {
      setResumeError(true);
      setResumeBusy(false);
    }
  };

  return (
    <article className="payment-history-detail">
      <section aria-labelledby="payment-detail-summary-heading" className="payment-history-detail__section">
        <h1 id="payment-detail-summary-heading">購入内容</h1>
        <dl className="payment-history-detail__facts">
          <div><dt>支払い金額</dt><dd>{formatPaymentAmount(payment)}</dd></div>
          <GrantRow label="獲得コイン" value={payment.grant.paid_points} />
          {payment.grant.bonus_points > 0 ? <GrantRow label="ボーナスコイン" value={payment.grant.bonus_points} /> : null}
          {payment.grant.limited_bonus_points > 0 ? <GrantRow label="期間限定ボーナスコイン" value={payment.grant.limited_bonus_points} /> : null}
          <GrantRow label="合計コイン" value={payment.grant.total_points} />
        </dl>
      </section>

      <section aria-labelledby="payment-detail-method-heading" className="payment-history-detail__section">
        <h2 id="payment-detail-method-heading">お支払い方法</h2>
        <dl className="payment-history-detail__method">
          <div><dt>購入日時</dt><dd><time dateTime={payment.created_at}>{formatPaymentDate(payment.created_at)}</time></dd></div>
          <div><dt>決済種別</dt><dd>{paymentMethodLabel(payment.method)}</dd></div>
        </dl>
      </section>

      {expired ? <button className="button button--dark payment-history-detail__resume" disabled type="button">有効期限切れ</button> : null}
      {resumable ? (
        <button className="button button--dark payment-history-detail__resume" disabled={resumeBusy} onClick={() => void resume()} type="button">
          {resumeBusy ? "案内を確認中…" : "振込案内ページ"}
        </button>
      ) : null}
      {resumeError ? <p className="payment-inline-error" role="alert">エラーが発生しました。</p> : null}
    </article>
  );
}
