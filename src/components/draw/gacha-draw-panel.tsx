"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import type { GachaDetail, GachaPresentationState, StorefrontDrawCount } from "@/lib/platform";
import { createIdempotencyKey, presentDrawProblem } from "@/lib/platform";
import { drawResultRoute } from "@/lib/routes/navigation";
import { useDrawClient } from "./draw-client-provider";
import { gachaPresentationReasonLabels, gachaSaleStateLabels } from "@/components/catalog/gacha-presentation";

const number = new Intl.NumberFormat("ja-JP");
const audienceLabels = {
  all_users: "すべてのユーザー",
  first_time_users: "初回ユーザー",
  line_users: "LINE連携ユーザー",
} as const satisfies Readonly<Record<GachaPresentationState["audience"], string>>;

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

function statusMessage(presentation: GachaPresentationState) {
  const reason = presentation.ineligible_reason ?? presentation.cta.reason;
  if (reason) return gachaPresentationReasonLabels[reason] ?? "現在は抽選を利用できません。";
  return presentation.eligible ? "このガチャの抽選対象です。" : "現在は抽選を利用できません。";
}

function DailyLimit({ dailyLimit }: { readonly dailyLimit: GachaPresentationState["daily_limit"] }) {
  return (
    <dl className="gacha-daily-limit" aria-label="日次抽選回数">
      {dailyLimit.unlimited ? (
        <div><dt>日次回数</dt><dd>制限なし</dd></div>
      ) : (
        <>
          <div><dt>上限</dt><dd>{number.format(dailyLimit.limit)}回</dd></div>
          <div><dt>利用済み</dt><dd>{dailyLimit.used === null ? "--" : `${number.format(dailyLimit.used)}回`}</dd></div>
          <div><dt>残り</dt><dd>{dailyLimit.remaining === null ? "--" : `${number.format(dailyLimit.remaining)}回`}</dd></div>
        </>
      )}
      <div><dt>更新予定</dt><dd>{formatDateTime(dailyLimit.resets_at) ?? "--"}</dd></div>
    </dl>
  );
}

interface PendingOperation {
  readonly count: StorefrontDrawCount;
  readonly idempotencyKey: string;
}

export function GachaDrawPanel({
  detail,
  presentation,
}: {
  readonly detail: GachaDetail;
  readonly presentation: GachaPresentationState;
}) {
  const router = useRouter();
  const { client, configurationAvailable } = useDrawClient();
  const [selectedCount, setSelectedCount] = useState<StorefrontDrawCount | null>(
    presentation.allowed_draw_counts[0] ?? null,
  );
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [recoveryId, setRecoveryId] = useState<string | null>(null);
  const pendingOperation = useRef<PendingOperation | null>(null);
  const submittingRef = useRef(false);
  const visible = presentation.cta.state !== "hidden";
  const enabled = presentation.cta.state === "enabled";

  function selectCount(count: StorefrontDrawCount) {
    pendingOperation.current = null;
    setProblem(null);
    setSelectedCount(count);
  }

  async function executeDraw() {
    if (!client || !selectedCount || submittingRef.current) return;
    const operation = pendingOperation.current?.count === selectedCount
      ? pendingOperation.current
      : { count: selectedCount, idempotencyKey: createIdempotencyKey() };
    pendingOperation.current = operation;
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      const { data } = await client.createDraw(detail.id, operation.count, {
        idempotency_key: operation.idempotencyKey,
      });
      setRecoveryId(data.id);
      setConfirming(false);
      router.push(drawResultRoute(data.id));
    } catch (error) {
      const presentation = presentDrawProblem(error);
      setProblem(presentation.message);
      setConfirming(false);
      if (!presentation.retryable) pendingOperation.current = null;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const confirmation = selectedCount
    ? `${detail.title}を${number.format(selectedCount)}回抽選します。表示上の合計は${number.format(detail.price_points * selectedCount)}ptです。実際の消費額と結果はPlatformの応答を正本とします。`
    : "抽選回数を選択してください。";

  return (
    <>
      <section aria-label="抽選状態" className={`gacha-eligibility gacha-eligibility--${presentation.sale_state}`}>
        <div>
          <span>{gachaSaleStateLabels[presentation.sale_state]}</span>
          <strong>{statusMessage(presentation)}</strong>
          <small>対象: {audienceLabels[presentation.audience]}</small>
        </div>
        <DailyLimit dailyLimit={presentation.daily_limit} />
      </section>
      {visible && (
        <aside aria-label="抽選オプション" className={`gacha-draw-tray gacha-draw-tray--${presentation.cta.state}`} data-cta-state={presentation.cta.state}>
          <div className="gacha-draw-tray__inner">
            <div className="gacha-draw-tray__summary">
              <p><span>1回</span><strong>{number.format(detail.price_points)}pt</strong></p>
              <p><span>残り</span><strong>{number.format(detail.remaining_count)}</strong><small>/ {number.format(detail.total_count)}</small></p>
              <div aria-label={`残り${detail.remaining_count}口、全${detail.total_count}口`} className="gacha-progress gacha-progress--compact" role="progressbar" aria-valuemax={detail.total_count} aria-valuemin={0} aria-valuenow={detail.remaining_count}>
                <span style={{ width: `${remainingPercentage(detail)}%` }} />
              </div>
            </div>
            <div className="gacha-draw-tray__options" aria-label="抽選回数">
              {presentation.allowed_draw_counts.map((count) => (
                <button aria-pressed={selectedCount === count} disabled={!enabled || submitting} key={count} onClick={() => selectCount(count)} type="button">
                  {number.format(count)}回
                </button>
              ))}
            </div>
            <div className="gacha-draw-tray__action">
              {presentation.cta.action === "login" && enabled ? (
                <Link className="button button--accent" href="/login">ログインして抽選する</Link>
              ) : (
                <button
                  aria-describedby="draw-boundary-note"
                  className="button button--accent"
                  disabled={!enabled || !selectedCount || !configurationAvailable || submitting}
                  onClick={() => setConfirming(true)}
                  type="button"
                >
                  {submitting ? "抽選結果を確認中…" : selectedCount ? `${number.format(selectedCount)}回抽選する` : "抽選を利用できません"}
                </button>
              )}
              <small id="draw-boundary-note">
                {!configurationAvailable ? "この環境では抽選接続が設定されていません。" : "抽選条件と消費ポイントは実行時にPlatformが再検証します。"}
              </small>
              {problem && <p className="gacha-draw-tray__error" role="alert">{problem}</p>}
              {recoveryId && <Link className="gacha-draw-tray__recovery" href={drawResultRoute(recoveryId)}>取得済みの結果を表示する</Link>}
            </div>
          </div>
        </aside>
      )}
      <ConfirmationDialog
        confirmDisabled={submitting}
        confirmLabel={submitting ? "処理中…" : "抽選を実行する"}
        description={confirmation}
        onCancel={() => { if (!submitting) setConfirming(false); }}
        onConfirm={() => { void executeDraw(); }}
        open={confirming}
        title="抽選内容を確認"
      />
    </>
  );
}
