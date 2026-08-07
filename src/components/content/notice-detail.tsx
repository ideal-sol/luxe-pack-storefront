"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ContentNotice, PlatformProblemPresentation } from "@/lib/platform";
import { isPlatformNotFound, presentPlatformProblem } from "@/lib/platform";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { usePublicClient } from "@/components/catalog/public-client-provider";
import { SafeContent } from "./safe-content";

type NoticeDetailState =
  | { readonly status: "loading" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "not-found" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "ready"; readonly notice: ContentNotice };

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export function NoticeDetail({ noticeId }: { readonly noticeId: string }) {
  const { client, configurationAvailable } = usePublicClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<NoticeDetailState>(
    configurationAvailable ? { status: "loading" } : { status: "configuration-unavailable" },
  );

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.getNotice(noticeId)
      .then(({ data }) => { if (active) setState({ status: "ready", notice: data }); })
      .catch((error: unknown) => {
        if (!active) return;
        setState(isPlatformNotFound(error)
          ? { status: "not-found" }
          : { status: "error", problem: presentPlatformProblem(error) });
      });
    return () => { active = false; };
  }, [client, noticeId, requestKey]);

  function retry() {
    setState({ status: "loading" });
    setRequestKey((current) => current + 1);
  }

  if (state.status === "loading") return <CatalogLoading label="お知らせ本文を読み込み中" />;
  if (state.status === "configuration-unavailable") {
    return <CatalogMessage description="この環境では公開Content接続が設定されていません。" eyebrow="CONFIGURATION" title="お知らせを表示できません" />;
  }
  if (state.status === "not-found") {
    return <CatalogMessage description="指定されたお知らせは公開されていないか、見つかりません。" eyebrow="NOT FOUND" title="お知らせが見つかりません" />;
  }
  if (state.status === "error") {
    return <CatalogMessage action={retry} description={state.problem.message} eyebrow="ERROR" title="お知らせを取得できませんでした" tone="error" />;
  }

  return (
    <article className="content-document">
      <Link className="content-document__back" href="/notices">← お知らせ一覧へ</Link>
      <header className="content-document__header">
        <div>
          <time dateTime={state.notice.publish_start_at}>{formatPublishedAt(state.notice.publish_start_at)}</time>
          {state.notice.is_important && <span>重要</span>}
        </div>
        <h1>{state.notice.title}</h1>
      </header>
      <SafeContent html={state.notice.body_html} />
    </article>
  );
}
