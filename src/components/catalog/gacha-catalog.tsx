"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  GachaCategory,
  GachaSummaryCollection,
  PlatformProblemPresentation,
} from "@/lib/platform";
import { presentPlatformProblem } from "@/lib/platform";
import { usePublicClient } from "./public-client-provider";
import { CatalogLoading, CatalogMessage } from "./catalog-message";
import { GachaCard } from "./gacha-card";

type CatalogState =
  | { readonly status: "loading" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "ready"; readonly collection: GachaSummaryCollection };

export function GachaCatalog({ initialCategory }: { readonly initialCategory?: string }) {
  const router = useRouter();
  const { client, configurationAvailable } = usePublicClient();
  const [category, setCategory] = useState(initialCategory ?? "");
  const [categories, setCategories] = useState<readonly GachaCategory[]>([]);
  const [categoriesFailed, setCategoriesFailed] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [state, setState] = useState<CatalogState>(
    configurationAvailable ? { status: "loading" } : { status: "configuration-unavailable" },
  );

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.listGachaCategories()
      .then(({ data }) => { if (active) setCategories(data.data); })
      .catch(() => { if (active) setCategoriesFailed(true); });
    return () => { active = false; };
  }, [client]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.listGachas({ limit: 20, ...(category ? { category } : {}) })
      .then(({ data }) => { if (active) setState({ status: "ready", collection: data }); })
      .catch((error: unknown) => { if (active) setState({ status: "error", problem: presentPlatformProblem(error) }); });
    return () => { active = false; };
  }, [category, client, requestKey]);

  function selectCategory(nextCategory: string) {
    if (nextCategory === category) return;
    setCategory(nextCategory);
    setState({ status: "loading" });
    const query = new URLSearchParams();
    if (nextCategory) query.set("category", nextCategory);
    router.replace(query.size > 0 ? `/gachas?${query.toString()}` : "/gachas");
  }

  function retry() {
    setState({ status: "loading" });
    setRequestKey((current) => current + 1);
  }

  async function loadMore() {
    if (!client || state.status !== "ready" || loadingMore) return;
    const cursor = state.collection.meta.next_cursor;
    if (!state.collection.meta.has_more || !cursor) return;
    setLoadingMore(true);
    try {
      const { data } = await client.listGachas({ cursor, limit: 20, ...(category ? { category } : {}) });
      setState({
        status: "ready",
        collection: {
          data: [...state.collection.data, ...data.data],
          meta: data.meta,
        },
      });
    } catch (error) {
      setState({ status: "error", problem: presentPlatformProblem(error) });
    } finally {
      setLoadingMore(false);
    }
  }

  if (state.status === "configuration-unavailable") {
    return <CatalogMessage description="この環境では公開Catalog接続が設定されていません。" eyebrow="CONFIGURATION" title="ガチャ一覧を表示できません" />;
  }

  return (
    <div className="catalog-browser">
      <nav aria-label="ガチャカテゴリー絞り込み" className="catalog-tabs">
        <button aria-pressed={category === ""} disabled={loadingMore} onClick={() => selectCategory("")} type="button">すべて</button>
        {categories.map((item) => <button aria-pressed={category === item.slug} disabled={loadingMore} key={item.id} onClick={() => selectCategory(item.slug)} type="button">{item.name}</button>)}
      </nav>
      {categoriesFailed && <p className="catalog-browser__filter-note">カテゴリー選択肢を表示できませんでした。</p>}
      {state.status === "loading" && <CatalogLoading label="ガチャを読み込み中" />}
      {state.status === "error" && <CatalogMessage action={retry} description={state.problem.message} eyebrow="ERROR" title="ガチャを取得できませんでした" tone="error" />}
      {state.status === "ready" && state.collection.data.length === 0 && <CatalogMessage description="選択した条件で表示できるガチャはありません。" eyebrow="EMPTY" title="ガチャがありません" />}
      {state.status === "ready" && state.collection.data.length > 0 && (
        <>
          <p className="catalog-browser__count">{state.collection.data.length} PACKS</p>
          <div className="gacha-grid">{state.collection.data.map((gacha, index) => <GachaCard gacha={gacha} key={`${gacha.id}-${index}`} priority={index < 4} />)}</div>
          {state.collection.meta.has_more && state.collection.meta.next_cursor && (
            <div className="catalog-browser__more"><button className="button button--dark" disabled={loadingMore} onClick={loadMore} type="button">{loadingMore ? "読み込み中…" : "さらに表示"}</button></div>
          )}
        </>
      )}
    </div>
  );
}
