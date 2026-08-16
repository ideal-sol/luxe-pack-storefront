"use client";

import { useCallback, useEffect, useState } from "react";
import { isAuthProblemError } from "@oripa/storefront-client";
import { useSession } from "@/components/auth/session-provider";
import { CatalogAsset } from "@/components/catalog/catalog-asset";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { LoginRequiredState } from "@/components/common/state-panel";
import {
  presentPlatformProblem,
  type DrawHistoryEntry,
  type PlatformProblemPresentation,
} from "@/lib/platform";
import { useDrawClient } from "./draw-client-provider";

type HistoryState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | {
      readonly status: "error";
      readonly authenticationRequired: boolean;
      readonly problem: PlatformProblemPresentation;
      readonly sessionUserId: string;
    }
  | {
      readonly status: "ready";
      readonly items: readonly DrawHistoryEntry[];
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

function authenticationRequired(error: unknown) {
  return isAuthProblemError(error, "AUTHENTICATION_REQUIRED")
    || isAuthProblemError(error, "SESSION_EXPIRED");
}

function HistoryCard({ entry }: { readonly entry: DrawHistoryEntry }) {
  const asset = entry.gacha.presentation_asset;

  return (
    <li>
      <article className="draw-history-card">
        <div className="draw-history-card__image">
          <CatalogAsset
            alt={asset?.alt_text ?? entry.gacha.title}
            fallbackLabel="GACHA IMAGE"
            {...(asset?.path ? { src: asset.path } : {})}
          />
        </div>
        <div className="draw-history-card__body">
          <div className="draw-history-card__heading">
            <div>
              <p>HISTORICAL GACHA</p>
              <h2>{entry.gacha.title}</h2>
            </div>
            <span data-status-code={entry.status.code}>{entry.status.label}</span>
          </div>
          <time dateTime={entry.occurred_at}>{formatOccurredAt(entry.occurred_at)}</time>
          <dl>
            <div><dt>申込回数</dt><dd>{number.format(entry.requested_count)}回</dd></div>
            <div><dt>実行回数</dt><dd>{number.format(entry.executed_count)}回</dd></div>
          </dl>
        </div>
      </article>
    </li>
  );
}

export function DrawHistoryPage() {
  const { state: session } = useSession();
  const { client, configurationAvailable } = useDrawClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<HistoryState>({ status: "idle" });
  const sessionUserId = session.status === "authenticated" ? session.session.user?.id ?? null : null;

  useEffect(() => {
    if (!client || !sessionUserId) return;
    let active = true;
    void client.listDrawHistory({ limit: 10 })
      .then(({ data }) => {
        if (active) {
          setState({
            items: data.items,
            loadingMore: false,
            nextCursor: data.next_cursor,
            sessionUserId,
            status: "ready",
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            authenticationRequired: authenticationRequired(error),
            problem: presentPlatformProblem(error),
            sessionUserId,
            status: "error",
          });
        }
      });
    return () => { active = false; };
  }, [client, requestKey, sessionUserId]);

  const loadMore = useCallback(async () => {
    if (!client || state.status !== "ready" || state.loadingMore || !state.nextCursor) return;
    const snapshot = state;
    const cursor = state.nextCursor;
    setState({ ...snapshot, loadingMore: true });
    try {
      const { data } = await client.listDrawHistory({ cursor, limit: 10 });
      setState({
        items: [...snapshot.items, ...data.items],
        loadingMore: false,
        nextCursor: data.next_cursor,
        sessionUserId: snapshot.sessionUserId,
        status: "ready",
      });
    } catch (error) {
      setState({
        ...snapshot,
        continuationProblem: presentPlatformProblem(error),
        loadingMore: false,
      });
    }
  }, [client, state]);

  if (session.status === "loading" || state.status === "idle" && session.status === "authenticated" && configurationAvailable) {
    return <CatalogLoading label="ガチャ履歴を読み込み中" />;
  }
  if (session.status === "unauthenticated" || session.status === "session-expired") return <LoginRequiredState />;
  if (session.status === "configuration-unavailable" || !configurationAvailable) {
    return <CatalogMessage description="この環境ではガチャ履歴への接続が設定されていません。" eyebrow="CONFIGURATION" title="ガチャ履歴を表示できません" />;
  }
  if (session.status === "error") {
    return <CatalogMessage description="Sessionを確認できませんでした。時間をおいて再度お試しください。" eyebrow="ERROR" title="ガチャ履歴を表示できません" tone="error" />;
  }
  if (state.status === "loading" || state.status === "idle" || state.sessionUserId !== sessionUserId) {
    return <CatalogLoading label="ガチャ履歴を読み込み中" />;
  }
  if (state.status === "error") {
    if (state.authenticationRequired) return <LoginRequiredState />;
    return (
      <CatalogMessage
        action={() => {
          setState({ status: "loading" });
          setRequestKey((value) => value + 1);
        }}
        description={state.problem.message}
        eyebrow="ERROR"
        title="ガチャ履歴を取得できませんでした"
        tone="error"
      />
    );
  }

  if (state.items.length === 0) {
    return <CatalogMessage description="現在表示できるガチャ履歴はありません。" eyebrow="EMPTY" title="ガチャ履歴はありません" />;
  }

  return (
    <section aria-labelledby="draw-history-heading" className="draw-history">
      <header>
        <p>DRAW HISTORY</p>
        <h2 id="draw-history-heading">利用履歴</h2>
      </header>
      <ol className="draw-history__list">
        {state.items.map((entry) => <HistoryCard entry={entry} key={entry.id} />)}
      </ol>
      {state.continuationProblem && <p className="draw-history__continuation-error">{state.continuationProblem.message}</p>}
      {state.nextCursor && (
        <button className="button button--ghost draw-history__more" disabled={state.loadingMore} onClick={() => void loadMore()} type="button">
          {state.loadingMore ? "読み込み中…" : "さらに表示"}
        </button>
      )}
    </section>
  );
}
