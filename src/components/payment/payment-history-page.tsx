"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { LoginRequiredState } from "@/components/common/state-panel";
import {
  presentPaymentProblem,
  type Payment,
  type PaymentHistoryQuery,
  type PaymentProblemPresentation,
} from "@/lib/platform";
import { paymentHistoryDetailRoute } from "@/lib/routes/navigation";
import { usePaymentClient } from "./payment-client-provider";
import {
  formatPaymentAmount,
  formatPaymentCoins,
  formatPaymentDate,
  paymentMethodLabel,
} from "./payment-history-presentation";

type PaymentHistoryView = PaymentHistoryQuery["view"];

type HistoryState =
  | { readonly status: "idle" }
  | { readonly status: "loading"; readonly view: PaymentHistoryView }
  | {
      readonly status: "error";
      readonly problem: PaymentProblemPresentation;
      readonly sessionUserId: string;
      readonly view: PaymentHistoryView;
    }
  | {
      readonly status: "ready";
      readonly items: readonly Payment[];
      readonly hasMore: boolean;
      readonly nextCursor: string | null;
      readonly loadingMore: boolean;
      readonly sessionUserId: string;
      readonly view: PaymentHistoryView;
      readonly continuationProblem?: PaymentProblemPresentation;
    };

const tabs = [
  { label: "購入履歴", view: "succeeded" },
  { label: "未払い", view: "unpaid" },
] as const satisfies readonly { readonly label: string; readonly view: PaymentHistoryView }[];

function PaymentHistoryRow({ payment }: { readonly payment: Payment }) {
  return (
    <li>
      <Link className="payment-history-row" href={paymentHistoryDetailRoute(payment.id)}>
        <time dateTime={payment.created_at}>{formatPaymentDate(payment.created_at)}</time>
        <span className="payment-history-row__method">{paymentMethodLabel(payment.method)}</span>
        <data value={payment.grant.paid_points}>{formatPaymentCoins(payment.grant.paid_points)}</data>
        <data className="payment-history-row__amount" value={payment.amount.amount}>{formatPaymentAmount(payment)}</data>
      </Link>
    </li>
  );
}

export function PaymentHistoryPage() {
  const { state: session } = useSession();
  const { client } = usePaymentClient();
  const [view, setView] = useState<PaymentHistoryView>("succeeded");
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<HistoryState>({ status: "idle" });
  const sessionUserId = session.status === "authenticated" ? session.session.user?.id ?? null : null;

  useEffect(() => {
    const listPayments = client?.listPayments;
    if (!listPayments || !sessionUserId) return;
    let active = true;
    void listPayments({ limit: 10, view })
      .then(({ data }) => {
        if (!active) return;
        setState({
          hasMore: data.pagination.has_more,
          items: data.data,
          loadingMore: false,
          nextCursor: data.pagination.next_cursor,
          sessionUserId,
          status: "ready",
          view,
        });
      })
      .catch((error: unknown) => {
        if (active) setState({ problem: presentPaymentProblem(error), sessionUserId, status: "error", view });
      });
    return () => { active = false; };
  }, [client, requestKey, sessionUserId, view]);

  const loadMore = useCallback(async () => {
    const listPayments = client?.listPayments;
    if (!listPayments || state.status !== "ready" || state.loadingMore || !state.hasMore || !state.nextCursor) return;
    const snapshot = state;
    const cursor = state.nextCursor;
    setState({ ...snapshot, loadingMore: true });
    try {
      const { data } = await listPayments({ cursor, limit: 10, view: snapshot.view });
      setState({
        hasMore: data.pagination.has_more,
        items: [...snapshot.items, ...data.data],
        loadingMore: false,
        nextCursor: data.pagination.next_cursor,
        sessionUserId: snapshot.sessionUserId,
        status: "ready",
        view: snapshot.view,
      });
    } catch (error) {
      setState({ ...snapshot, continuationProblem: presentPaymentProblem(error), loadingMore: false });
    }
  }, [client, state]);

  if (session.status === "loading") return <CatalogLoading label="購入履歴を読み込み中" />;
  if (session.status === "unauthenticated" || session.status === "session-expired") return <LoginRequiredState />;
  if (session.status === "configuration-unavailable" || !client?.listPayments) {
    return <CatalogMessage description="この環境では購入履歴への接続が設定されていません。" eyebrow="CONFIGURATION" title="購入履歴を表示できません" />;
  }
  if (session.status === "error") {
    return <CatalogMessage description="Sessionを確認できませんでした。時間をおいて再度お試しください。" eyebrow="ERROR" title="購入履歴を表示できません" tone="error" />;
  }
  if (state.status === "idle" || state.status === "loading") {
    return <CatalogLoading label="購入履歴を読み込み中" />;
  }
  if (state.view !== view || state.sessionUserId !== sessionUserId) {
    return <CatalogLoading label="購入履歴を読み込み中" />;
  }
  if (state.status === "error") {
    if (state.problem.sessionExpired) return <LoginRequiredState />;
    return <CatalogMessage action={() => setRequestKey((value) => value + 1)} description="エラーが発生しました。" eyebrow="ERROR" title="購入履歴を取得できませんでした" tone="error" />;
  }

  const activeTab = tabs.find((tab) => tab.view === view)!;
  return (
    <section aria-labelledby="payment-history-heading" className="payment-history">
      <h2 className="sr-only" id="payment-history-heading">購入履歴</h2>
      <div aria-label="購入履歴の表示切替" className="payment-history-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-controls="payment-history-panel"
            aria-selected={view === tab.view}
            className={view === tab.view ? "payment-history-tab payment-history-tab--selected" : "payment-history-tab"}
            id={`payment-history-tab-${tab.view}`}
            key={tab.view}
            onClick={() => setView(tab.view)}
            role="tab"
            tabIndex={view === tab.view ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div aria-labelledby={`payment-history-tab-${activeTab.view}`} id="payment-history-panel" role="tabpanel">
        {state.items.length === 0 ? (
          <CatalogMessage
            description={view === "succeeded" ? "現在表示できる購入履歴はありません。" : "現在お支払い可能な履歴はありません。"}
            eyebrow="EMPTY"
            title={view === "succeeded" ? "購入履歴はありません" : "未払いはありません"}
          />
        ) : (
          <ol className="payment-history-list">
            {state.items.map((payment) => <PaymentHistoryRow key={payment.id} payment={payment} />)}
          </ol>
        )}
        {state.continuationProblem ? <p className="payment-history__continuation-error" role="alert">エラーが発生しました。</p> : null}
        {state.hasMore && state.nextCursor ? (
          <button className="button button--ghost payment-history__more" disabled={state.loadingMore} onClick={() => void loadMore()} type="button">
            {state.loadingMore ? "読み込み中…" : "さらに表示"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
