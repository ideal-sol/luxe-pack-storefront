"use client";

import Link from "next/link";
import { resolveAssetUrl } from "@/lib/asset-url";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicComponents } from "@oripa/storefront-client/types";
import { ApiProblemError } from "@oripa/storefront-client";
import { useSession } from "@/components/auth/session-provider";
import { useOptionalPublicClient } from "@/components/catalog/public-client-provider";
import { RankLineupImage } from "@/components/catalog/rank-lineup-image";
import { CatalogAsset } from "@/components/catalog/catalog-asset";
import { LoadingState } from "@/components/common/loading-state";
import { LoginRequiredState } from "@/components/common/state-panel";
import { presentPlatformProblem, type DrawResponse, type PlatformProblemPresentation } from "@/lib/platform";
import type { GachaDetail, GachaPresentationState } from "@/lib/platform";
import { GachaDrawPanel } from "./gacha-draw-panel";
import { gachaDetailRoute } from "@/lib/routes/navigation";
import { usePointClient } from "@/components/points/point-client-provider";
import { useDrawClient } from "./draw-client-provider";
import { DrawResultFulfillment, useDrawResultFulfillmentAvailable } from "./draw-result-fulfillment";

type ResultState =
  | { readonly status: "loading" }
  | { readonly status: "not-found" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | { readonly status: "presentation"; readonly result: DrawResponse; readonly presentation: DrawPresentation }
  | { readonly status: "ready"; readonly result: DrawResponse };

const number = new Intl.NumberFormat("ja-JP");
type DrawPresentation = PublicComponents["schemas"]["DrawPresentation"];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function ResultMessage({
  description,
  retry,
  title,
}: {
  readonly description: string;
  readonly retry?: () => void;
  readonly title: string;
}) {
  return (
    <section className="state-panel state-panel--error">
      <p className="state-panel__eyebrow">DRAW RESULT</p>
      <h1>{title}</h1>
      <p>{description}</p>
      {retry && <button className="button button--dark" onClick={retry} type="button">もう一度確認する</button>}
      <Link className="button button--ghost" href="/">トップに戻る</Link>
    </section>
  );
}

// Resolve only the representative snapshot supplied by the Platform.
function usablePresentation(presentation: DrawResponse["presentation"]): presentation is DrawPresentation {
  const video = presentation?.video_snapshot;
  return video?.media_type === "video" && resolveAssetUrl(video.path) !== null;
}

type PlaybackState = "starting" | "playing-with-sound" | "playing-muted" | "needs-tap";

function isAutoplayBlocked(error: unknown) {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

function RepresentativeVideo({ presentation, onFinished }: {
  readonly presentation: DrawPresentation;
  readonly onFinished: () => void;
}) {
  const video = presentation.video_snapshot;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playback, setPlayback] = useState<PlaybackState>("starting");
  const finish = onFinished;

  useEffect(() => {
    let cancelled = false;
    const element = videoRef.current;
    if (!element) return;
    setPlayback("starting");
    element.muted = false;

    // Browsers may refuse autoplay with sound (Chrome, including Chrome on iOS).
    // A refused request is not a media error: fall back to muted autoplay with an
    // "unmute" button, and if even muted autoplay is refused (for example iOS Low
    // Power Mode), ask for a tap. Skip stays available; only onError ends it.
    const start = async () => {
      try {
        await element.play();
        if (!cancelled) setPlayback("playing-with-sound");
        return;
      } catch (error) {
        if (cancelled || !isAutoplayBlocked(error)) return;
      }
      element.muted = true;
      try {
        await element.play();
        if (!cancelled) setPlayback("playing-muted");
      } catch (error) {
        if (!cancelled && isAutoplayBlocked(error)) setPlayback("needs-tap");
      }
    };
    void start();
    return () => { cancelled = true; };
  }, [video.path]);

  // Called from a click, so the browser treats it as user-initiated playback.
  const playWithSound = () => {
    const element = videoRef.current;
    if (!element) return;
    element.muted = false;
    setPlayback("playing-with-sound");
    void element.play().catch(() => {
      element.muted = true;
      setPlayback("needs-tap");
    });
  };

  return (
    <section aria-label="抽選演出" className="draw-presentation">
      <video
        aria-label={video.alt_text ?? "抽選演出動画"}
        autoPlay
        className="draw-presentation__video"
        muted={false}
        onEnded={finish}
        onError={finish}
        playsInline
        preload="metadata"
        ref={videoRef}
        src={resolveAssetUrl(video.path) ?? undefined}
      />
      <button className="button button--dark draw-presentation__skip" onClick={finish} type="button">スキップ</button>
      {playback === "playing-muted" && (
        <button className="button button--dark draw-presentation__sound" onClick={playWithSound} type="button">音を出す</button>
      )}
      {playback === "needs-tap" && (
        <button className="draw-presentation__tap" onClick={playWithSound} type="button">
          <span className="draw-presentation__tap-icon" aria-hidden="true">▶</span>
          <span>タップして演出を再生</span>
        </button>
      )}
    </section>
  );
}

/** 横の帯に出す件数の上限（1000連でも重くしない） */
const SNAPSHOT_STRIP_LIMIT = 100;

function SnapshotResults({ result, strip = false }: { readonly result: DrawResponse; readonly strip?: boolean }) {
  // Compact legacy responses alone may lack results. Preserve every new result in API order.
  const all = result.results ?? result.high_rank_results;
  if (all.length === 0) return null;
  const snapshots = strip ? all.slice(0, SNAPSHOT_STRIP_LIMIT) : all;

  return (
    <section aria-labelledby="draw-snapshots" className={`draw-result__snapshots${strip ? " draw-result__snapshots--strip" : ""}`}>
      <div className="section-heading">
        <p>DRAW RESULTS</p>
        <h2 id="draw-snapshots">抽選結果一覧</h2>
        {strip && <span className="draw-result__snapshots-sub">1回ごとの結果です。{all.length > snapshots.length ? `（先頭の${number.format(snapshots.length)}件を表示）` : ""}</span>}
      </div>
      <div className="draw-snapshot-grid">
        {snapshots.map((snapshot) => {
          const image = snapshot.prize?.presentation_asset?.media_type === "image"
            ? snapshot.prize.presentation_asset
            : null;
          const title = snapshot.prize?.name ?? `${number.format(snapshot.point_back?.amount ?? 0)} コイン還元`;
          return (
            <article className="draw-snapshot-card" key={snapshot.id}>
              {snapshot.result_type === "prize" && (
                <div className="draw-snapshot-card__image">
                  <CatalogAsset
                    alt={image?.alt_text ?? title}
                    fallbackLabel="PRIZE IMAGE"
                    {...(image?.path ? { src: image.path } : {})}
                  />
                </div>
              )}
              <div className="draw-snapshot-card__copy">
                {snapshot.rank && <RankLineupImage image={snapshot.rank_lineup_image} name={snapshot.rank.name} />}
                <h3>{title}</h3>
                <p>抽選順 {number.format(snapshot.sequence_number)}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

type DrawAgainState =
  | { readonly status: "loading" }
  | { readonly status: "available"; readonly detail: GachaDetail; readonly presentation: GachaPresentationState }
  | { readonly status: "sold-out"; readonly title: string; readonly slug: string }
  | { readonly status: "unavailable" };

/**
 * 抽選結果の「もう一回挑戦しますか？」（2026-10-28 要望）。
 * 結果には gacha_id しかないため、公開カタログから詳細と抽選状態を引き、
 * ガチャ詳細と同じ抽選ボタンをこの画面にそのまま出す（詳細画面へは移動しない）。
 * ログインガチャなど公開カタログにないものや取得失敗時は、ガチャ一覧への導線にする。
 */
function useDrawAgain(gachaId: string): DrawAgainState {
  const client = useOptionalPublicClient();
  const [state, setState] = useState<DrawAgainState>(client ? { status: "loading" } : { status: "unavailable" });
  useEffect(() => {
    if (!client) return;
    let active = true;
    void Promise.all([client.getGacha(gachaId), client.getGachaPresentation(gachaId)])
      .then(([detailResponse, presentationResponse]) => {
        if (!active) return;
        const detail = detailResponse.data.data;
        const presentation = presentationResponse.data.data;
        if (presentation.sale_state === "sold_out" || detail.remaining_count <= 0) setState({ slug: detail.slug, status: "sold-out", title: detail.title });
        else if (presentation.sale_state === "on_sale") setState({ detail, presentation, status: "available" });
        else setState({ status: "unavailable" });
      })
      .catch(() => { if (active) setState({ status: "unavailable" }); });
    return () => { active = false; };
  }, [client, gachaId]);
  return state;
}

function DrawAgain({ state }: { readonly state: DrawAgainState }) {
  if (state.status === "loading") return null;
  if (state.status !== "available") {
    return (
      <div className="draw-result__again-note">
        {state.status === "sold-out" && <p>「{state.title}」は完売しました。</p>}
        <Link className="button button--ghost" href="/gachas">ほかのオリパを探す</Link>
      </div>
    );
  }
  const { detail, presentation } = state;
  const asset = detail.presentation_asset?.media_type === "image" ? detail.presentation_asset : null;
  return (
    <section aria-labelledby="draw-again-heading" className="draw-again">
      <h2 id="draw-again-heading">もう一回挑戦しますか？</h2>
      <div className="draw-again__banner">
        <CatalogAsset alt={asset?.alt_text ?? detail.title} fallbackLabel="PACK IMAGE" {...(asset?.path ? { src: asset.path } : {})} />
      </div>
      <GachaDrawPanel detail={detail} presentation={presentation} variant="inline" />
    </section>
  );
}

/**
 * 抽選結果の最後の「このあと」（デザイン 2026-10-31「画面改修案」）。
 * 「このガチャをもう一度引く」だけを大きくし、押すとこの画面で回数を選んで引ける（詳細画面へは移らない）。
 */
function NextSteps({ drawAgain }: { readonly drawAgain: DrawAgainState }) {
  const [open, setOpen] = useState(false);
  const wallet = useOptionalWalletBalance();
  const againRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) window.setTimeout(() => againRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 0);
  }, [open]);
  return (
    <>
      <section aria-labelledby="draw-next-heading" className="draw-next">
        <div>
          <h2 id="draw-next-heading">このあと</h2>
          <p>過去に獲得した景品も、あわせてお手続きいただけます。</p>
        </div>
        <div className="draw-next__actions">
          <Link className="draw-next__sub" href="/mypage/prizes">獲得アイテムを見る</Link>
          <Link className="draw-next__sub" href="/">トップに戻る</Link>
          {drawAgain.status === "available" ? (
            <button aria-expanded={open} className="draw-next__again" onClick={() => setOpen(true)} type="button">
              このガチャをもう一度引く
              <small>1回 {number.format(drawAgain.detail.price_points)}コイン{wallet !== null ? ` ／ 所持 ${number.format(wallet)}コイン` : ""}</small>
            </button>
          ) : drawAgain.status === "loading" ? null : (
            <Link className="draw-next__again draw-next__again--other" href="/gachas">
              ほかのオリパを探す
              {drawAgain.status === "sold-out" && <small>「{drawAgain.title}」は完売しました</small>}
            </Link>
          )}
        </div>
      </section>
      {open && drawAgain.status === "available" && <div className="draw-result__again-anchor" ref={againRef}><DrawAgain state={drawAgain} /></div>}
    </>
  );
}

function useOptionalWalletBalance(): number | null {
  try {
    const wallet = usePointClient().wallet;
    return wallet?.status === "ready" ? wallet.balance.total_points : null;
  } catch {
    return null;
  }
}

function DrawResultContent({ result }: { readonly result: DrawResponse }) {
  const drawAgain = useDrawAgain(result.gacha_id);
  const fulfillment = useDrawResultFulfillmentAvailable(result);
  const handleExchanged = useCallback(() => undefined, []);
  const backHref = drawAgain.status === "available" ? gachaDetailRoute(drawAgain.detail.slug)
    : drawAgain.status === "sold-out" ? gachaDetailRoute(drawAgain.slug) : "/gachas";
  return (
    <article className="draw-result">
      <header className="draw-result__header">
        <p>DRAW COMPLETED</p>
        <h1>抽選結果</h1>
        <span>{number.format(result.executed_count)}回の抽選が完了しました</span>
      </header>
      <dl className="draw-result__summary">
        {result.requested_count !== result.executed_count && (
          <div><dt>選択回数</dt><dd>{number.format(result.requested_count)}回</dd></div>
        )}
        <div><dt>実行回数</dt><dd>{number.format(result.executed_count)}回</dd></div>
        <div><dt>消費コイン</dt><dd>{number.format(result.point_cost_total)} コイン</dd></div>
        <div><dt>コイン還元</dt><dd>{number.format(result.point_back_total)} コイン</dd></div>
        <div><dt>実行日時</dt><dd>{formatDateTime(result.created_at)}</dd></div>
      </dl>
      <SnapshotResults result={result} strip={fulfillment} />
      {fulfillment ? <DrawResultFulfillment backHref={backHref} onExchanged={handleExchanged} result={result} /> : (
      <section aria-labelledby="draw-prizes" className="draw-result__prizes">
        <div className="section-heading">
          <p>PRIZES</p>
          <h2 id="draw-prizes">獲得景品</h2>
        </div>
        {result.prize_counts.length === 0 ? (
          <p className="draw-result__empty">獲得景品はありません、コイン還元をご確認ください</p>
        ) : (
          <div className="draw-result__grid">
            {result.prize_counts.map(({ count, prize }) => {
              const asset = prize.presentation_asset?.media_type === "image" ? prize.presentation_asset : null;
              return (
                <article className="draw-result-card" key={prize.id}>
                  <div className="draw-result-card__image">
                    <CatalogAsset alt={asset?.alt_text ?? prize.name} fallbackLabel="PRIZE IMAGE" {...(asset?.path ? { src: asset.path } : {})} />
                  </div>
                  <div>
                    <span>獲得景品</span>
                    <h3>{prize.name}</h3>
                    <p>× {number.format(count)}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      )}
      {fulfillment ? <NextSteps drawAgain={drawAgain} /> : (
        <>
          <DrawAgain state={drawAgain} />
          <nav aria-label="抽選結果の次の操作" className="draw-result__actions">
            <Link className="button button--dark" href="/mypage/prizes">獲得アイテムを確認</Link>
            <Link className="button button--ghost" href="/">トップに戻る</Link>
          </nav>
        </>
      )}
    </article>
  );
}

export function DrawResultView({ drawRequestId }: { readonly drawRequestId: string }) {
  return <DrawResultRequest key={drawRequestId} drawRequestId={drawRequestId} />;
}

function DrawResultRequest({ drawRequestId }: { readonly drawRequestId: string }) {
  const { state: session } = useSession();
  const { client, configurationAvailable } = useDrawClient();
  const [requestKey, setRequestKey] = useState(0);
  const presentationFinished = useRef(false);
  const [state, setState] = useState<ResultState>({ status: "loading" });

  useEffect(() => {
    if (session.status !== "authenticated" || !client) return;
    let active = true;
    void client.getDrawRequest(drawRequestId)
      .then(({ data }) => {
        if (!active) return;
        if (!presentationFinished.current && usablePresentation(data.presentation)) {
          setState({ result: data, status: "presentation", presentation: data.presentation });
        } else {
          presentationFinished.current = true;
          setState({ result: data, status: "ready" });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState(error instanceof ApiProblemError && error.status === 404
          ? { status: "not-found" }
          : { problem: presentPlatformProblem(error), status: "error" });
      });
    return () => { active = false; };
  }, [client, drawRequestId, requestKey, session.status]);

  if (session.status === "loading") return <LoadingState />;
  if (session.status === "configuration-unavailable" || !configurationAvailable) {
    return <ResultMessage description="エラーが発生しました、運営までお問い合わせください" title="抽選結果を表示できません" />;
  }
  if (session.status !== "authenticated") return <LoginRequiredState />;
  if (state.status === "loading") return <LoadingState />;
  if (state.status === "not-found") {
    return <ResultMessage description="指定された抽選結果は見つかりません。" title="抽選結果が見つかりません" />;
  }
  if (state.status === "error") {
    return <ResultMessage description={state.problem.message} retry={() => {
      setState({ status: "loading" });
      setRequestKey((current) => current + 1);
    }} title="抽選結果を取得できませんでした" />;
  }
  if (state.status === "presentation") {
    return <RepresentativeVideo presentation={state.presentation} onFinished={() => {
      presentationFinished.current = true;
      setState({ result: state.result, status: "ready" });
    }} />;
  }
  return <DrawResultContent result={state.result} />;
}
