"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState, LoginRequiredState } from "@/components/common/state-panel";
import {
  listMemberRanks,
  loadMyMemberRank,
  type MemberRankSetting,
  type MyMemberRank,
} from "@/lib/platform/member-rank-client";
import { memberRankGuideRoute } from "@/lib/routes/navigation";
import { formatBonusRate, formatRankNumber, RankLadder, rankToneClass } from "./member-rank-parts";

type EnabledMemberRank = Extract<MyMemberRank, { enabled: true }>;

type RankPageState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly userId: string; readonly rank: MyMemberRank; readonly ranks: readonly MemberRankSetting[] };

export function MemberRankPage() {
  const { state: session } = useSession();
  const userId = session.status === "authenticated" ? session.session.user?.id ?? null : null;
  const [state, setState] = useState<RankPageState>({ status: "loading" });

  useEffect(() => {
    if (!userId) return;
    let active = true;
    // ランクの一覧が読めなくても、いまのランクだけは出す（階段と昇格ボーナスの額は出さない）
    void Promise.all([loadMyMemberRank(), listMemberRanks().catch(() => [] as readonly MemberRankSetting[])])
      .then(([rank, ranks]) => { if (active) setState({ rank, ranks, status: "ready", userId }); })
      .catch(() => { if (active) setState({ status: "error" }); });
    return () => { active = false; };
  }, [userId]);

  if (session.status === "loading") return <LoadingState />;
  if (session.status === "unauthenticated" || session.status === "session-expired") return <LoginRequiredState />;
  if (session.status === "configuration-unavailable" || session.status === "error") return <ErrorState />;
  if (!session.session.user) return <LoginRequiredState />;
  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error") return <ErrorState />;
  if (state.userId !== userId) return <LoadingState />;
  if (!state.rank.enabled) {
    return (
      <section className="mrank-disabled">
        <h2>会員ランクは現在ご利用いただけません</h2>
        <p>再開の際は、お知らせにてご案内します。</p>
        <Link href="/mypage">← マイページへ戻る</Link>
      </section>
    );
  }
  return <MemberRankDetail rank={state.rank} ranks={state.ranks} />;
}

function MemberRankDetail({ rank, ranks }: { readonly rank: EnabledMemberRank; readonly ranks: readonly MemberRankSetting[] }) {
  const current = rank.rank;
  const setting = ranks.find((item) => item.code === current.code);
  const next = rank.next_rank;
  const totalSteps = ranks.length || 7;

  // 棒は 0 から次のランクの到達ラインまで。最上位は満たした状態にする。
  const goal = next ? next.reach_line : setting?.reach_line ?? rank.rank_points;
  const percent = next && next.reach_line > 0 ? Math.max(0, Math.min(100, (rank.rank_points / next.reach_line) * 100)) : 100;

  const rate = formatBonusRate(rank.benefits.purchase_bonus.rate_percent);

  return (
    <div className="mrank-page">
      <section aria-labelledby="mrank-current-heading" className={`mrank-card ${rankToneClass(current.code)}`}>
        <div className="mrank-card__top">
          <div aria-label={`${totalSteps}段中${current.level}段目`} className="mrank-card__level">{current.level}/{totalSteps}</div>
          <div>
            <p className="mrank-card__caption">いまの会員ランク</p>
            <h2 className="mrank-card__name" id="mrank-current-heading">{current.name}</h2>
          </div>
          <span className="mrank-card__spacer" />
          <dl className="mrank-card__points">
            <dt>今月のランクポイント</dt>
            <dd>{formatRankNumber(rank.rank_points)}</dd>
          </dl>
        </div>
        <div className="mrank-card__body">
          <div className="mrank-progress">
            <div className="mrank-progress__label">
              <span>{next ? "次のランクまで" : "いちばん上のランクです"}</span>
              <span className="mrank-progress__goal">
                {next
                  ? <>{next.name} まであと <b>{formatRankNumber(next.remaining)}</b> ランクポイント</>
                  : <b>到達済み</b>}
              </span>
            </div>
            <div
              aria-label="次のランクまでの進み具合"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(percent)}
              className="mrank-progress__track"
              role="progressbar"
            >
              <i style={{ width: `${percent.toFixed(1)}%` }} />
            </div>
            <div className="mrank-progress__ends">
              <span>0</span>
              <span>{next ? next.name : current.name} {formatRankNumber(goal)}</span>
            </div>
            <div className="mrank-keep">
              <p>集計対象月：{rank.period.month}（次回リセット：{new Date(rank.period.resets_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} JST）</p>
              {rank.maintain ? <p>現在ランクの維持ライン：{formatRankNumber(rank.maintain.line)}。{rank.maintain.achieved ? "達成済みです。" : `あと${formatRankNumber(rank.maintain.remaining)}ランクポイントです。`}</p> : null}
              {rank.demotion_protection ? <p>降格判定の見送り：残り{rank.demotion_protection.remaining_judgments}回</p> : null}
            </div>
          </div>
          <div className="mrank-perks">
            <dl className={`mrank-perk ${rate ? "is-on" : "is-off"}`}>
              <dt>コイン購入時のボーナス</dt>
              <dd>{rate ? <>+{rate}<small>％</small></> : "なし"}</dd>
              <dd className="mrank-perk__note">
                {rate
                  ? `お支払い金額の ${rate}％ を無償コインでお渡しします。お支払い額は変わりません。`
                  : "現在のランクでは購入ボーナスはありません。"}
              </dd>
            </dl>
            {setting ? <dl className="mrank-perk">
              <dt>{current.name}の昇格ボーナス設定</dt>
              <dd>{formatRankNumber(setting.promotion_bonus.points)}<small>無償コイン</small></dd>
              <dd className="mrank-perk__note">設定額です。受領状況を示すものではありません。</dd>
            </dl> : null}
          </div>
        </div>
      </section>

      {ranks.length > 0 ? (
        <section aria-labelledby="mrank-ladder-heading" className="mrank-panel">
          <div className="mrank-panel__head">
            <div>
              <h2 id="mrank-ladder-heading">ランクは{ranks.length}段あります</h2>
              <p>公開されている各ランクの到達ラインです。</p>
            </div>
            <Link className="mrank-pill-link" href={memberRankGuideRoute}>ランク制度の詳細を見る</Link>
          </div>
          <RankLadder currentCode={current.code} ranks={ranks} />
        </section>
      ) : null}

      {/* 内訳はHumanの表示許可と正式API対応後にMemberRankBreakdownSectionを接続する。現在はDOMへ出力しない。 */}

      <section aria-labelledby="mrank-notes-heading" className="mrank-panel">
        <h2 id="mrank-notes-heading">ご確認ください</h2>
        <p>ランクポイントは月ごとに集計され、維持条件と降格判定があります。</p>
        <a className="mrank-pill-link" href={memberRankGuideRoute}>会員ランクの説明を見る</a>
        <a className="mrank-pill-link" href="https://support.ori-poke.com/">よくあるご質問</a>
      </section>
    </div>
  );
}
