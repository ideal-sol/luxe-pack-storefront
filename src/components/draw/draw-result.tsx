"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PublicComponents } from "@oripa/storefront-client/types";
import { ApiProblemError } from "@oripa/storefront-client";
import { useSession } from "@/components/auth/session-provider";
import { RankLineupImage } from "@/components/catalog/rank-lineup-image";
import { CatalogAsset } from "@/components/catalog/catalog-asset";
import { LoadingState } from "@/components/common/loading-state";
import { LoginRequiredState } from "@/components/common/state-panel";
import { presentPlatformProblem, type DrawResponse, type PlatformProblemPresentation } from "@/lib/platform";
import { useDrawClient } from "./draw-client-provider";

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

// Keep the existing same-origin snapshot URL convention; never select another asset.
function usablePresentation(presentation: DrawResponse["presentation"]): presentation is DrawPresentation {
  const video = presentation?.video_snapshot;
  return video?.media_type === "video" && video.path.startsWith("/") && !video.path.startsWith("//");
}

function RepresentativeVideo({ presentation, onFinished }: {
  readonly presentation: DrawPresentation;
  readonly onFinished: () => void;
}) {
  const video = presentation.video_snapshot;
  const finish = onFinished;
  return (
    <section aria-labelledby="draw-presentation-title" className="draw-presentation">
      <h1 id="draw-presentation-title">抽選演出</h1>
      <video
        aria-label={video.alt_text ?? "抽選演出動画"}
        className="draw-presentation__video"
        controls
        onEnded={finish}
        onError={finish}
        playsInline
        preload="metadata"
        src={video.path}
      />
      <button className="button button--dark" onClick={finish} type="button">スキップ</button>
    </section>
  );
}

function SnapshotResults({ result }: { readonly result: DrawResponse }) {
  // Compact legacy responses alone may lack results. Preserve every new result in API order.
  const snapshots = result.results ?? result.high_rank_results;
  if (snapshots.length === 0) return null;

  return (
    <section aria-labelledby="draw-snapshots" className="draw-result__snapshots">
      <div className="section-heading">
        <p>DRAW RESULTS</p>
        <h2 id="draw-snapshots">抽選結果一覧</h2>
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

function DrawResultContent({ result }: { readonly result: DrawResponse }) {
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
      <SnapshotResults result={result} />
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
      <nav aria-label="抽選結果の次の操作" className="draw-result__actions">
        <Link className="button button--dark" href="/mypage/prizes">獲得アイテムを確認</Link>
        <Link className="button button--ghost" href="/">トップに戻る</Link>
      </nav>
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
