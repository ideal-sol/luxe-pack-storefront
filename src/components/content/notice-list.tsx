"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ContentNoticeCollection, PlatformProblemPresentation } from "@/lib/platform";
import { presentPlatformProblem } from "@/lib/platform";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { usePublicClient } from "@/components/catalog/public-client-provider";

type NoticeListState =
  | { readonly status: "loading" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "ready"; readonly collection: ContentNoticeCollection };

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export function NoticeList() {
  const { client, configurationAvailable } = usePublicClient();
  const [requestKey, setRequestKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [state, setState] = useState<NoticeListState>(
    configurationAvailable ? { status: "loading" } : { status: "configuration-unavailable" },
  );

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.listNotices({ limit: 10 })
      .then(({ data }) => { if (active) setState({ status: "ready", collection: data }); })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", problem: presentPlatformProblem(error) });
      });
    return () => { active = false; };
  }, [client, requestKey]);

  function retry() {
    setState({ status: "loading" });
    setRequestKey((current) => current + 1);
  }

  async function loadMore() {
    if (!client || state.status !== "ready" || loadingMore || !state.collection.next_cursor) return;
    setLoadingMore(true);
    try {
      const { data } = await client.listNotices({ cursor: state.collection.next_cursor, limit: 10 });
      setState({
        status: "ready",
        collection: {
          items: [...state.collection.items, ...data.items],
          next_cursor: data.next_cursor,
        },
      });
    } catch (error) {
      setState({ status: "error", problem: presentPlatformProblem(error) });
    } finally {
      setLoadingMore(false);
    }
  }

  if (state.status === "loading") return <CatalogLoading label="お知らせを読み込み中" />;
  if (state.status === "configuration-unavailable") {
    return <CatalogMessage description="この環境では公開Content接続が設定されていません。" eyebrow="CONFIGURATION" title="お知らせを表示できません" />;
  }
  if (state.status === "error") {
    return <CatalogMessage action={retry} description={state.problem.message} eyebrow="ERROR" title="お知らせを取得できませんでした" tone="error" />;
  }
  if (state.collection.items.length === 0) {
    return <CatalogMessage description="現在表示できるお知らせはありません。" eyebrow="EMPTY" title="お知らせはありません" />;
  }

  return (
    <div className="content-list-browser">
      <div className="content-notice-list">
        {state.collection.items.map((notice) => (
          <Link aria-label={`${notice.title}を読む`} href={`/notices/${notice.id}`} key={notice.id}>
            <time dateTime={notice.publish_start_at}>{formatPublishedAt(notice.publish_start_at)}</time>
            <span className="content-notice-list__title">
              {notice.is_important && <small>重要</small>}
              <strong>{notice.title}</strong>
            </span>
            <span aria-hidden="true" className="content-notice-list__chevron">›</span>
          </Link>
        ))}
      </div>
      {state.collection.next_cursor && (
        <div className="content-list-browser__more">
          <button className="button button--dark" disabled={loadingMore} onClick={loadMore} type="button">
            {loadingMore ? "読み込み中…" : "さらに表示"}
          </button>
        </div>
      )}
    </div>
  );
}
