"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type {
  GachaDetail,
  GachaPresentationState,
  GachaSaleState,
  PlatformProblemPresentation,
} from "@/lib/platform";
import { isPlatformNotFound, presentPlatformProblem } from "@/lib/platform";
import { CatalogAsset } from "./catalog-asset";
import { CatalogLoading, CatalogMessage } from "./catalog-message";
import { usePublicClient } from "./public-client-provider";
import { GachaDrawPanel } from "@/components/draw/gacha-draw-panel";

type DetailState =
  | { readonly status: "loading" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "not-found" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | {
      readonly status: "ready";
      readonly detail: GachaDetail;
      readonly presentation: GachaPresentationState;
    };

type Prize = GachaDetail["ranks"][number]["prizes"][number];

const number = new Intl.NumberFormat("ja-JP");
const saleStateLabels: Readonly<Record<GachaSaleState, string>> = {
  coming_soon: "販売開始前",
  ended: "販売終了",
  on_sale: "販売中",
  sold_out: "完売",
};

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function remainingPercentage(detail: GachaDetail) {
  if (detail.total_count <= 0) return 0;
  return Math.min(100, Math.max(0, (detail.remaining_count / detail.total_count) * 100));
}


function PrizeModal({ prize, onClose }: { readonly prize: Prize; readonly onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const asset = prize.presentation_asset?.media_type === "image" ? prize.presentation_asset : null;
  return (
    <div className="prize-modal" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className="prize-modal__dialog" role="dialog">
        <button aria-label="景品詳細を閉じる" className="prize-modal__close" onClick={onClose} ref={closeRef} type="button">×</button>
        <div className="prize-modal__visual">
          <CatalogAsset alt={asset?.alt_text ?? prize.name} fallbackLabel="PRIZE IMAGE" {...(asset?.path ? { src: asset.path } : {})} />
        </div>
        <div className="prize-modal__copy">
          <p>PRIZE DETAIL</p>
          <h2 id={titleId}>{prize.name}</h2>
          {prize.description && <p>{prize.description}</p>}
        </div>
      </section>
    </div>
  );
}

function PrizeSections({ detail }: { readonly detail: GachaDetail }) {
  const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  function closeModal() {
    setSelectedPrize(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  const currentStage = detail.probability_stages.find((stage) => stage.is_current);
  const probabilityByRank = new Map(currentStage?.rank_probabilities.map((entry) => [entry.rank.id, entry.total_ppm]));

  return (
    <section aria-labelledby="gacha-prizes" className="gacha-prizes">
      <header className="gacha-section-heading">
        <p>PRIZE LINEUP</p>
        <h2 id="gacha-prizes">景品ラインナップ</h2>
      </header>
      {detail.ranks.length === 0 ? (
        <p className="gacha-detail__neutral">公開中の景品情報はありません。</p>
      ) : detail.ranks.map((rank) => (
        <section aria-labelledby={`rank-${rank.id}`} className="prize-rank" key={rank.id}>
          <header>
            <div><span>{rank.code}</span><h3 id={`rank-${rank.id}`}>{rank.name}</h3></div>
            {probabilityByRank.has(rank.id) && (
              <p>提供割合 {(probabilityByRank.get(rank.id)! / 10_000).toLocaleString("ja-JP", { maximumFractionDigits: 4 })}%</p>
            )}
          </header>
          <div className="prize-grid">
            {rank.prizes.map((prize) => {
              const asset = prize.presentation_asset?.media_type === "image" ? prize.presentation_asset : null;
              return (
                <button
                  aria-label={`${prize.name}の詳細を見る`}
                  className="prize-card"
                  key={prize.id}
                  onClick={(event) => {
                    triggerRef.current = event.currentTarget;
                    setSelectedPrize(prize);
                  }}
                  type="button"
                >
                  <div className="prize-card__image">
                    <CatalogAsset alt={asset?.alt_text ?? prize.name} fallbackLabel="PRIZE IMAGE" {...(asset?.path ? { src: asset.path } : {})} />
                  </div>
                  <strong>{prize.name}</strong>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {selectedPrize && <PrizeModal onClose={closeModal} prize={selectedPrize} />}
    </section>
  );
}

function DetailContent({ detail, presentation }: { readonly detail: GachaDetail; readonly presentation: GachaPresentationState }) {
  const asset = detail.presentation_asset?.media_type === "image" ? detail.presentation_asset : null;
  const publishEnd = formatDateTime(detail.publish_end_at);
  return (
    <article className="gacha-detail">
      <nav aria-label="パンくず" className="gacha-detail__breadcrumb">
        <Link href="/">ホーム</Link><span aria-hidden="true">/</span><Link href="/gachas">ガチャ</Link><span aria-hidden="true">/</span><span aria-current="page">{detail.title}</span>
      </nav>
      <section className="gacha-detail__hero">
        <div className="gacha-detail__visual">
          <CatalogAsset alt={asset?.alt_text ?? detail.title} fallbackLabel="PACK IMAGE" priority {...(asset?.path ? { src: asset.path } : {})} />
        </div>
        <div className="gacha-detail__summary">
          <div className="gacha-detail__badges"><span>{saleStateLabels[presentation.sale_state]}</span><span>{detail.category.name}</span></div>
          <h1>{detail.title}</h1>
          <div className="gacha-detail__tags">{detail.tags.map((tag) => <span key={tag.id}>#{tag.name}</span>)}</div>
          <dl className="gacha-detail__facts">
            <div><dt>1回</dt><dd>{number.format(detail.price_points)}pt</dd></div>
            <div><dt>残り口数</dt><dd>{number.format(detail.remaining_count)} / {number.format(detail.total_count)}</dd></div>
            <div><dt>販売開始</dt><dd>{formatDateTime(detail.publish_start_at)}</dd></div>
            {publishEnd && <div><dt>販売終了予定</dt><dd>{publishEnd}</dd></div>}
          </dl>
          <div aria-label={`残り${detail.remaining_count}口、全${detail.total_count}口`} className="gacha-progress" role="progressbar" aria-valuemax={detail.total_count} aria-valuemin={0} aria-valuenow={detail.remaining_count}>
            <span style={{ width: `${remainingPercentage(detail)}%` }} />
          </div>
          {detail.description && <p className="gacha-detail__description">{detail.description}</p>}
        </div>
      </section>
      {detail.notices && (
        <details className="gacha-notices">
          <summary>注意事項・ご利用条件</summary>
          <p>{detail.notices}</p>
        </details>
      )}
      <PrizeSections detail={detail} />
      <GachaDrawPanel detail={detail} presentation={presentation} />
    </article>
  );
}

export function GachaDetailView({ slug }: { readonly slug: string }) {
  const { client, configurationAvailable } = usePublicClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<DetailState>(
    configurationAvailable ? { status: "loading" } : { status: "configuration-unavailable" },
  );

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.getGachaBySlug(slug)
      .then(async ({ data }) => {
        const presentation = await client.getGachaPresentation(data.data.id);
        if (active) setState({ detail: data.data, presentation: presentation.data.data, status: "ready" });
      })
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

  if (state.status === "loading") return <CatalogLoading label="ガチャ詳細を読み込み中" />;
  if (state.status === "configuration-unavailable") {
    return <CatalogMessage description="この環境では公開Catalog接続が設定されていません。" eyebrow="CONFIGURATION" title="ガチャ詳細を表示できません" />;
  }
  if (state.status === "not-found") {
    return <CatalogMessage description="指定されたガチャは公開されていないか、見つかりません。" eyebrow="NOT FOUND" title="ガチャが見つかりません" />;
  }
  if (state.status === "error") {
    return <CatalogMessage action={retry} description={state.problem.message} eyebrow="ERROR" title="ガチャ詳細を取得できませんでした" tone="error" />;
  }
  return <DetailContent detail={state.detail} presentation={state.presentation} />;
}
