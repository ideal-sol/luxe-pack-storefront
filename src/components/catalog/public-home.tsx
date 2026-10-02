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
import { HomeGuide } from "./home-guide";
import { HomeLoginBonusFeed } from "./home-login-bonus";
import { HomeSectionHeading } from "./home-section-heading";
import { gachaSortFetchLimit, gachaSortOptions, sortGachas, type GachaSortKey } from "./gacha-sort";

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
  | { readonly status: "ready"; readonly gachas: readonly GachaSummary[]; readonly hasMore: boolean };

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
  const [sort, setSort] = useState<GachaSortKey>("recommended");
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
      // おすすめ順は従来どおり6件の抜粋。並べ替え時は母数をそろえるため上限件数まで取得する。
      limit: sort === "recommended" ? 6 : gachaSortFetchLimit,
      ...(category ? { category } : {}),
      ...(tag ? { tag } : {}),
    }).then(({ data }) => {
      if (active) setGachaState({ status: "ready", gachas: data.data, hasMore: data.meta.has_more });
    }).catch((error: unknown) => {
      if (active) setGachaState({ status: "error", problem: presentPlatformProblem(error) });
    });
    return () => { active = false; };
  }, [category, client, gachaRequestKey, sort, tag]);

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

  function selectSort(key: GachaSortKey) {
    if (key === sort) return;
    setSort(key);
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
          <HomeSectionHeading id="home-pickup-heading" lead="注目の企画をご紹介します。左右に送ってもご覧いただけます。" title="注目の企画" watermark="PICK UP" />
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

      <div aria-hidden="true" className="home-walk">
        {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
        <img alt="" height={268} src="/brand/fukumaru_hashiru.webp" width={328} />
      </div>

      {/* 無料・ログインボーナス（注目の企画とガチャ一覧の間。表示のみ、抽選は Platform 側） */}
      <HomeLoginBonusFeed />

      <section className="home-categories">
        <PageContainer className="home-content">
          {categories.length > 0 ? (
            <nav aria-label="ガチャカテゴリー" className="category-links">
              {categories.map((item) => <button aria-pressed={category === item.slug} key={item.id} onClick={() => selectCategory(item.slug)} onFocus={revealFilter} type="button">{item.name}</button>)}
            </nav>
          ) : <CatalogMessage description="利用できるカテゴリーはありません。" eyebrow="EMPTY" title="カテゴリーを準備中です" />}
        </PageContainer>
      </section>

      <section aria-label="ガチャ一覧" aria-busy={gachaState.status === "loading"} className="home-gachas">
        <PageContainer className="home-content">
          <HomeSectionHeading id="home-lineup-heading" lead="コインでお引きいただくガチャです。並べ替えと絞り込みもご利用いただけます。" title="ガチャ一覧" watermark="LINEUP">
            {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
            <img alt="" aria-hidden="true" className="home-peek home-peek--right" height={190} src="/brand/sd_fukumaru_ooyorokobi.webp" width={176} />
          </HomeSectionHeading>
          <div className="gacha-toolbar">
            <span aria-hidden="true" className="gacha-toolbar__label">並べ替え</span>
            <div aria-label="並べ替え" className="gacha-toolbar__tabs" role="group">
              {gachaSortOptions.map((option) => (
                <button aria-pressed={sort === option.key} key={option.key} onClick={() => selectSort(option.key)} type="button">{option.label}</button>
              ))}
            </div>
            {tags.length > 0 && (
              <div className="gacha-toolbar__chips">
                <button aria-pressed={tag === ""} className="gacha-toolbar__all" onClick={() => selectTag("")} type="button">すべて</button>
                <nav aria-label="ガチャタグ" className="home-tag-links">
                  {tags.map((item) => <button aria-pressed={tag === item.slug} key={item.id} onClick={() => selectTag(item.slug)} onFocus={revealFilter} type="button">#{item.name}</button>)}
                </nav>
              </div>
            )}
            {gachaState.status === "ready" && (
              <p aria-live="polite" className="gacha-toolbar__count">
                {gachaState.hasMore ? <>先頭<b>{gachaState.gachas.length}</b>企画</> : <>全<b>{gachaState.gachas.length}</b>企画</>}
              </p>
            )}
          </div>
          {gachaState.status === "loading" && <CatalogLoading label="ガチャを読み込み中" />}
          {gachaState.status === "error" && <CatalogMessage action={retryGachas} description={gachaState.problem.message} eyebrow="ERROR" title="ガチャを取得できませんでした" tone="error" />}
          {gachaState.status === "ready" && (gachaState.gachas.length > 0 ? (
            <div className="gacha-grid gacha-grid--home">
              {sortGachas(gachaState.gachas, sort).map((gacha, index) => (
                <GachaCard featured={index === 0} {...(index === 0 ? { frame: "gold" as const } : {})} gacha={gacha} key={gacha.id} priority={index < 2} />
              ))}
            </div>
          ) : <CatalogMessage description="現在表示できるガチャはありません。" eyebrow="EMPTY" title="ラインナップを準備中です" />)}
        </PageContainer>
      </section>

      <HomeGuide />

      <section className="home-notices">
        <PageContainer>
          <HomeSectionHeading id="home-notice-heading" title="お知らせ" watermark="NEWS">
            {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
            <img alt="" aria-hidden="true" className="home-peek home-peek--left" height={220} src="/brand/sd_pokezou_ooatari.webp" width={164} />
          </HomeSectionHeading>
          <p className="home-notices__more"><Link href="/notices">一覧を見る <span>→</span></Link></p>
          {notices.length > 0 ? (
            <div className="notice-list">{notices.map((notice) => <Link href={`/notices/${notice.id}`} key={notice.id}><time dateTime={notice.publish_start_at}>{formatDate(notice.publish_start_at)}</time>{notice.is_important && <span>重要</span>}<strong>{notice.title}</strong><p>{notice.summary ?? "--"}</p></Link>)}</div>
          ) : <CatalogMessage description="現在表示できるお知らせはありません。" eyebrow="EMPTY" title="お知らせはありません" />}
        </PageContainer>
      </section>
    </>
  );
}
