"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ContentStaticPage, PlatformProblemPresentation } from "@/lib/platform";
import { isPlatformNotFound, presentPlatformProblem } from "@/lib/platform";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { usePublicClient } from "@/components/catalog/public-client-provider";
import { SafeContent } from "./safe-content";

type StaticPageState =
  | { readonly status: "loading" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "not-found" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "ready"; readonly page: ContentStaticPage };

export function StaticPage({ slug }: { readonly slug: string }) {
  const { client, configurationAvailable } = usePublicClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<StaticPageState>(
    configurationAvailable ? { status: "loading" } : { status: "configuration-unavailable" },
  );

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.getStaticPage(slug)
      .then(({ data }) => { if (active) setState({ status: "ready", page: data }); })
      .catch((error: unknown) => {
        if (!active) return;
        setState(isPlatformNotFound(error)
          ? { status: "not-found" }
          : { status: "error", problem: presentPlatformProblem(error) });
      });
    return () => { active = false; };
  }, [client, requestKey, slug]);

  function retry() {
    setState({ status: "loading" });
    setRequestKey((current) => current + 1);
  }

  if (state.status === "loading") return <CatalogLoading label="ページを読み込み中" />;
  if (state.status === "configuration-unavailable") {
    return <CatalogMessage description="この環境では公開Content接続が設定されていません。" eyebrow="CONFIGURATION" title="ページを表示できません" />;
  }
  if (state.status === "not-found") {
    return <CatalogMessage description="指定されたページは公開されていないか、見つかりません。" eyebrow="NOT FOUND" title="ページが見つかりません" />;
  }
  if (state.status === "error") {
    return <CatalogMessage action={retry} description={state.problem.message} eyebrow="ERROR" title="ページを取得できませんでした" tone="error" />;
  }

  return (
    <article className="content-document content-document--legal">
      <nav aria-label="パンくずリスト" className="content-breadcrumb">
        <Link href="/">ホーム</Link><span aria-hidden="true">/</span><span>{state.page.title}</span>
      </nav>
      <header className="content-document__header">
        <p>INFORMATION</p>
        <h1>{state.page.title}</h1>
      </header>
      <SafeContent html={state.page.body_html} />
    </article>
  );
}
