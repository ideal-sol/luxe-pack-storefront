"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { LoginRequiredState } from "@/components/common/state-panel";
import {
  presentPlatformProblem,
  type PlatformProblemPresentation,
  type PointHistoryEntry,
} from "@/lib/platform";
import { usePointClient } from "./point-client-provider";
import { PointBalanceSummary } from "./point-purchase-page";

type HistoryState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation; readonly sessionUserId: string }
  | {
      readonly status: "ready";
      readonly items: readonly PointHistoryEntry[];
      readonly nextCursor: string | null;
      readonly loadingMore: boolean;
      readonly sessionUserId: string;
      readonly continuationProblem?: PlatformProblemPresentation;
    };

const number = new Intl.NumberFormat("ja-JP");

function formatOccurredAt(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function formatDelta(value: number) {
  return `${value > 0 ? "+" : ""}${number.format(value)}`;
}

export function PointHistoryPage() {
  const { state: session } = useSession();
  const { client, wallet } = usePointClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<HistoryState>({ status: "idle" });
  const sessionUserId = session.status === "authenticated" ? session.session.user?.id ?? null : null;

  useEffect(() => {
    if (!client || !sessionUserId) return;
    let active = true;
    void client.listPointLedgerEntries({ limit: 10 })
      .then(({ data }) => {
        if (active) setState({ items: data.items, loadingMore: false, nextCursor: data.next_cursor, sessionUserId, status: "ready" });
      })
      .catch((error: unknown) => {
        if (active) setState({ problem: presentPlatformProblem(error), sessionUserId, status: "error" });
      });
    return () => { active = false; };
  }, [client, requestKey, sessionUserId]);

  const loadMore = useCallback(async () => {
    if (!client || state.status !== "ready" || state.loadingMore || !state.nextCursor) return;
    const snapshot = state;
    const cursor = state.nextCursor;
    setState({
      items: snapshot.items,
      loadingMore: true,
      nextCursor: snapshot.nextCursor,
      sessionUserId: snapshot.sessionUserId,
      status: "ready",
    });
    try {
      const { data } = await client.listPointLedgerEntries({ cursor, limit: 10 });
      setState({
        items: [...snapshot.items, ...data.items],
        loadingMore: false,
        nextCursor: data.next_cursor,
        sessionUserId: snapshot.sessionUserId,
        status: "ready",
      });
    } catch (error) {
      setState({ ...snapshot, continuationProblem: presentPlatformProblem(error), loadingMore: false });
    }
  }, [client, state]);

  if (session.status === "loading" || state.status === "idle" && session.status === "authenticated" && client) {
    return <CatalogLoading label="ポイント履歴を読み込み中" />;
  }
  if (session.status === "unauthenticated" || session.status === "session-expired") return <LoginRequiredState />;
  if (session.status === "configuration-unavailable" || !client) {
    return <CatalogMessage description="この環境ではPoint履歴への接続が設定されていません。" eyebrow="CONFIGURATION" title="ポイント履歴を表示できません" />;
  }
  if (session.status === "error") {
    return <CatalogMessage description="Sessionを確認できませんでした。時間をおいて再度お試しください。" eyebrow="ERROR" title="ポイント履歴を表示できません" tone="error" />;
  }
  if (state.status === "loading" || state.status === "idle" || state.sessionUserId !== sessionUserId) {
    return <CatalogLoading label="ポイント履歴を読み込み中" />;
  }
  if (state.status === "error") {
    return <CatalogMessage action={() => { setState({ status: "loading" }); setRequestKey((value) => value + 1); }} description={state.problem.message} eyebrow="ERROR" title="ポイント履歴を取得できませんでした" tone="error" />;
  }

  return (
    <div className="point-history-page">
      <PointBalanceSummary wallet={wallet} />
      <section aria-labelledby="point-history-title" className="point-history">
        <header><p>POINT HISTORY</p><h2 id="point-history-title">ポイント履歴</h2></header>
        {state.items.length === 0 ? (
          <CatalogMessage description="現在表示できるポイント履歴はありません。" eyebrow="EMPTY" title="ポイント履歴はありません" />
        ) : (
          <ol className="point-history__list">
            {state.items.map((entry) => (
              <li key={entry.id}>
                <div><strong>{entry.reason.label}</strong><time dateTime={entry.occurred_at}>{formatOccurredAt(entry.occurred_at)}</time></div>
                <data className={entry.amount_delta < 0 ? "point-history__delta point-history__delta--negative" : "point-history__delta"} value={entry.amount_delta}>{formatDelta(entry.amount_delta)}</data>
              </li>
            ))}
          </ol>
        )}
        {state.continuationProblem && <p className="point-history__continuation-error">{state.continuationProblem.message}</p>}
        {state.nextCursor && (
          <button className="button button--ghost point-history__more" disabled={state.loadingMore} onClick={() => void loadMore()} type="button">
            {state.loadingMore ? "読み込み中…" : "さらに表示"}
          </button>
        )}
      </section>
    </div>
  );
}
