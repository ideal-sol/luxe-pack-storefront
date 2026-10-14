"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { presentAuthProblem, type AuthProblemPresentation } from "@/lib/platform";
import { smsVerificationRoute } from "@/lib/routes/navigation";
import { AuthProblem } from "./auth-problem";
import { useSession } from "./session-provider";

export function EmailVerificationNotice({ userId }: { readonly userId?: string }) {
  const { resendEmailVerification } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<AuthProblemPresentation | null>(null);

  async function resend() {
    if (!userId || submitting) return;
    setSubmitting(true);
    setProblem(null);
    try {
      await resendEmailVerification({ user_id: userId, redirect_path: "/" });
      setSent(true);
    } catch (error) {
      setProblem(presentAuthProblem(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="verification-card">
      <span aria-hidden="true">✉</span>
      <h2>認証メールをご確認ください</h2>
      <p>メールに記載されたリンクを開くと登録が完了します。</p>
      <AuthProblem problem={problem} />
      {sent && <p className="verification-card__success" role="status">認証メールの再送を受け付けました。</p>}
      {userId ? (
        <button className="button button--ghost" disabled={submitting} onClick={resend} type="button">
          {submitting ? "再送中…" : "認証メールを再送"}
        </button>
      ) : (
        <p>再送が必要な場合は、登録手続きをもう一度開いてください。</p>
      )}
      <Link href="/login">ログイン画面へ</Link>
    </section>
  );
}

export function EmailVerificationCompletion({
  hash,
  userId,
}: {
  readonly hash: string;
  readonly userId: string;
}) {
  const { completeEmailVerification, state, smsAccess, refreshSession } = useSession();
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState<"loading" | "complete" | "error">("loading");
  const [problem, setProblem] = useState<AuthProblemPresentation | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void completeEmailVerification({ hash, user_id: userId })
      .then(() => {
        setStatus("complete");
      })
      .catch((error: unknown) => {
        setProblem(presentAuthProblem(error));
        setStatus("error");
      });
  }, [completeEmailVerification, hash, userId]);

  useEffect(() => {
    if (status === "complete" && state.status === "authenticated" && smsAccess === "unverified") router.replace(smsVerificationRoute);
  }, [router, smsAccess, state.status, status]);

  if (status === "loading") return <div aria-live="polite" className="loading-state">メールアドレスを認証しています…</div>;
  return (
    <section className="verification-card">
      <span aria-hidden="true">{status === "complete" ? "✓" : "!"}</span>
      <h2>{status === "complete" ? "メール認証が完了しました" : "メール認証を完了できませんでした"}</h2>
      {status === "complete" ? state.status === "authenticated" && smsAccess === "unverified"
        ? <Link className="button button--dark" href={smsVerificationRoute}>SMS認証へ</Link>
        : state.status === "error" || smsAccess === "error"
          ? <button className="button button--ghost" onClick={() => void refreshSession()} type="button">認証状態を再確認</button>
          : <Link className="button button--dark" href="/mypage">マイページへ</Link>
        : <AuthProblem problem={problem} />}
      {status === "error" && <Link href="/verify-email">認証メール案内へ</Link>}
    </section>
  );
}
