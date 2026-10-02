"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { isAuthProblemError } from "@oripa/storefront-client";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import { usePointClient } from "@/components/points/point-client-provider";
import { createIdempotencyKey, presentDrawProblem, type LoginGachaDetail } from "@/lib/platform";
import { drawResultRoute } from "@/lib/routes/navigation";
import { useDrawClient } from "./draw-client-provider";

export function LoginGachaDrawPanel({ detail }: { readonly detail: LoginGachaDetail }) {
  const router = useRouter();
  const { client, configurationAvailable } = useDrawClient();
  const { refreshWallet } = usePointClient();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [recoveryId, setRecoveryId] = useState<string | null>(null);
  const pendingKey = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const signup = detail.gacha_type === "signup_once";
  const { eligibility } = detail;
  const status = eligibility.eligible ? (signup ? "このガチャを利用できます。" : "今日は利用できます。")
    : eligibility.reason === "already_used" ? (signup ? "このガチャは利用済みです。" : "今日は利用済みです。")
    : eligibility.reason === "registration_not_qualified" ? "新規登録の対象条件を満たしていません。"
    : "現在は抽選を利用できません。";
  async function executeDraw() {
    if (!client || !eligibility.eligible || submittingRef.current || recoveryId) return;
    pendingKey.current ??= createIdempotencyKey();
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      const { data } = await client.createDraw(detail.id, 1, { idempotency_key: pendingKey.current });
      setRecoveryId(data.id);
      setConfirming(false);
      void refreshWallet();
      router.push(drawResultRoute(data.id));
    } catch (error) {
      const presentation = presentDrawProblem(error);
      setProblem(presentation.message);
      setConfirming(false);
      if (!presentation.retryable) pendingKey.current = null;
      if (isAuthProblemError(error, "AUTHENTICATION_REQUIRED") || isAuthProblemError(error, "SESSION_EXPIRED")) {
        router.replace(`/login?returnTo=${encodeURIComponent(`/login-gachas/${encodeURIComponent(detail.id)}`)}`);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }
  const price = detail.price_points === 0 ? "無料" : `${new Intl.NumberFormat("ja-JP").format(detail.price_points)} コイン`;
  return <>
    <section aria-label="抽選状態" className="gacha-eligibility gacha-eligibility--on_sale"><div><strong>{status}</strong><small>{signup ? "新規登録限定・1ユーザー1回" : "1日1回"}</small></div></section>
    <aside aria-label="抽選オプション" className={`gacha-draw-tray gacha-draw-tray--${eligibility.eligible ? "enabled" : "disabled"}`} data-cta-state={eligibility.eligible ? "enabled" : "disabled"}>
      <div className="gacha-draw-tray__inner"><div className="gacha-draw-tray__summary"><p><span>1回</span><strong>{price}</strong></p></div>
        <div className="gacha-draw-tray__action">
          <button className="button button--accent" disabled={!eligibility.eligible || !configurationAvailable || submitting || recoveryId !== null} onClick={() => setConfirming(true)} type="button">{submitting ? "抽選結果を確認中…" : eligibility.eligible ? "1回抽選する" : status}</button>
          {problem && <p className="gacha-draw-tray__error" role="alert">{problem}</p>}
          {recoveryId && <Link className="gacha-draw-tray__recovery" href={drawResultRoute(recoveryId)}>取得済みの結果を表示する</Link>}
        </div>
      </div>
    </aside>
    <ConfirmationDialog confirmDisabled={submitting} confirmLabel={submitting ? "処理中…" : "抽選を実行する"} description={`${detail.title}を1回抽選します。${price}です。`} onCancel={() => { if (!submitting) setConfirming(false); }} onConfirm={() => { void executeDraw(); }} open={confirming} title="抽選内容を確認" />
  </>;
}
