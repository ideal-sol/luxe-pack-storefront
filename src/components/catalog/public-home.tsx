"use client";

import Link from "next/link";
import { useEffect, useState, type FocusEvent } from "react";
import type {
  ContentBanner,
  ContentNoticeSummary,
  GachaCategory,
  GachaSummary,
  PlatformProblemPresentation,
} from "@/lib/platform";
import { presentPlatformProblem } from "@/lib/platform";
import { PageContainer } from "@/components/layout/page-container";
import { usePublicClient } from "./public-client-provider";
import { CatalogLoading, CatalogMessage } from "./catalog-message";
import { GachaCard } from "./gacha-card";
import { HomeBannerCarousel } from "./home-banner-carousel";

interface HomeData {
  readonly categories: readonly GachaCategory[];
  readonly tags: GachaSummary["tags"];
  readonly notices: readonly ContentNoticeSummary[];
}

type HomeState =
  | { readonly status: "loading" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "ready"; readonly data: HomeData };

type BannerState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "ready"; readonly banners: readonly ContentBanner[] };

type GachaState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "ready"; readonly gachas: readonly GachaSummary[] };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeZone: "Asia/Tokyo" }).format(new Date(value));
}

function revealFilter(event: FocusEvent<HTMLButtonElement>) {
  event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export function PublicHome() {
  const { client, configurationAvailable } = usePublicClient();
  const [requestKey, setRequestKey] = useState(0);
  const [bannerRequestKey, setBannerRequestKey] = useState(0);
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [gachaRequestKey, setGachaRequestKey] = useState(0);
  const [gachaState, setGachaState] = useState<GachaState>({ status: "loading" });
  const [state, setState] = useState<HomeState>(
    configurationAvailable ? { status: "loading" } : { status: "configuration-unavailable" },
  );
  const [bannerState, setBannerState] = useState<BannerState>({ status: "loading" });

  useEffect(() => {
    if (!client) return;
    let active = true;
    void Promise.all([
      client.listGachaCategories(),
      client.listGachaTags(),
      client.listNotices({ limit: 3 }),
    ]).then(([categories, tags, notices]) => {
      if (!active) return;
      setState({
        status: "ready",
        data: {
          categories: categories.data.data,
          tags: tags.data.data,
          notices: notices.data.items,
        },
      });
    }).catch((error: unknown) => {
      if (active) setState({ status: "error", problem: presentPlatformProblem(error) });
    });
    return () => { active = false; };
  }, [client, requestKey]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.listGachas({
      limit: 6,
      ...(category ? { category } : {}),
      ...(tag ? { tag } : {}),
    }).then(({ data }) => {
      if (active) setGachaState({ status: "ready", gachas: data.data });
    }).catch((error: unknown) => {
      if (active) setGachaState({ status: "error", problem: presentPlatformProblem(error) });
    });
    return () => { active = false; };
  }, [category, client, gachaRequestKey, tag]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.listBanners()
      .then(({ data }) => {
        if (active) setBannerState({ status: "ready", banners: data.items });
      })
      .catch((error: unknown) => {
        if (active) setBannerState({ status: "error", problem: presentPlatformProblem(error) });
      });
    return () => { active = false; };
  }, [bannerRequestKey, client]);

  function retry() {
    setState({ status: "loading" });
    setRequestKey((current) => current + 1);
  }

  function retryBanners() {
    setBannerState({ status: "loading" });
    setBannerRequestKey((current) => current + 1);
  }

  function selectCategory(slug: string) {
    if (slug === category) return;
    setCategory(slug);
    setGachaState({ status: "loading" });
  }

  function selectTag(slug: string) {
    if (slug === tag) return;
    setTag(slug);
    setGachaState({ status: "loading" });
  }

  function retryGachas() {
    setGachaState({ status: "loading" });
    setGachaRequestKey((current) => current + 1);
  }

  if (state.status === "loading") {
    return <PageContainer className="public-home-state"><CatalogLoading label="トップページを読み込み中" /></PageContainer>;
  }
  if (state.status === "configuration-unavailable") {
    return <PageContainer className="public-home-state"><CatalogMessage description="現在、ガチャ情報を表示できません" eyebrow="ERROR" title="公開情報を表示できません" tone="error" /></PageContainer>;
  }
  if (state.status === "error") {
    return <PageContainer className="public-home-state"><CatalogMessage action={retry} description={state.problem.message} eyebrow="ERROR" title="公開情報を取得できませんでした" tone="error" /></PageContainer>;
  }

  const { categories, tags, notices } = state.data;
  return (
    <>
      <section className="home-banners" aria-label="メインビジュアル">
        <PageContainer className="home-content">
          {bannerState.status === "loading" && <CatalogLoading label="バナーを読み込み中" />}
          {bannerState.status === "error" && (
            <CatalogMessage action={retryBanners} description={bannerState.problem.message} eyebrow="ERROR" title="バナーを取得できませんでした" tone="error" />
          )}
          {bannerState.status === "ready" && bannerState.banners.length > 0 && (
            <HomeBannerCarousel banners={bannerState.banners} />
          )}
          {bannerState.status === "ready" && bannerState.banners.length === 0 && (
            <CatalogMessage description="現在表示できるバナーはありません。" eyebrow="EMPTY" title="新しいご案内を準備中です。" />
          )}
        </PageContainer>
      </section>

      <section className="home-categories">
        <PageContainer className="home-content">
          {categories.length > 0 ? (
            <nav aria-label="ガチャカテゴリー" className="category-links">
              {categories.map((item) => <button aria-pressed={category === item.slug} key={item.id} onClick={() => selectCategory(item.slug)} onFocus={revealFilter} type="button">{item.name}</button>)}
            </nav>
          ) : <CatalogMessage description="利用できるカテゴリーはありません。" eyebrow="EMPTY" title="カテゴリーを準備中です" />}
          {tags.length > 0 && (
            <nav aria-label="ガチャタグ" className="home-tag-links">
              {tags.map((item) => <button aria-pressed={tag === item.slug} key={item.id} onClick={() => selectTag(item.slug)} onFocus={revealFilter} type="button">#{item.name}</button>)}
            </nav>
          )}
        </PageContainer>
      </section>

      <section aria-label="ガチャ一覧" aria-busy={gachaState.status === "loading"} className="home-gachas">
        <PageContainer className="home-content">
          {gachaState.status === "loading" && <CatalogLoading label="ガチャを読み込み中" />}
          {gachaState.status === "error" && <CatalogMessage action={retryGachas} description={gachaState.problem.message} eyebrow="ERROR" title="ガチャを取得できませんでした" tone="error" />}
          {gachaState.status === "ready" && (gachaState.gachas.length > 0 ? (
            <div className="gacha-grid">{gachaState.gachas.map((gacha, index) => <GachaCard gacha={gacha} key={gacha.id} priority={index < 2} />)}</div>
          ) : <CatalogMessage description="現在表示できるガチャはありません。" eyebrow="EMPTY" title="ラインナップを準備中です" />)}
        </PageContainer>
      </section>

      <section className="home-notices">
        <PageContainer>
          <header className="catalog-section-heading"><div><p>INFORMATION</p><h2>お知らせ</h2></div><Link href="/notices">一覧を見る <span>→</span></Link></header>
          {notices.length > 0 ? (
            <div className="notice-list">{notices.map((notice) => <Link href={`/notices/${notice.id}`} key={notice.id}><time dateTime={notice.publish_start_at}>{formatDate(notice.publish_start_at)}</time>{notice.is_important && <span>重要</span>}<strong>{notice.title}</strong><p>{notice.summary ?? "--"}</p></Link>)}</div>
          ) : <CatalogMessage description="現在表示できるお知らせはありません。" eyebrow="EMPTY" title="お知らせはありません" />}
        </PageContainer>
      </section>
    </>
  );
}
