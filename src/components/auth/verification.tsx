"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { presentAuthProblem, type AuthProblemPresentation } from "@/lib/platform";
import { smsVerificationRoute } from "@/lib/routes/navigation";
import { preRegisterEmailRedirectPath, preRegisterLoginHref, preRegisterSmsRoute } from "@/lib/pre-register";
import { AuthProblem } from "./auth-problem";
import { useSession } from "./session-provider";

export function EmailVerificationNotice({
  userId, redirectPath = "/", description = "メールに記載されたリンクを開くと登録が完了します。",
}: {
  readonly userId?: string;
  readonly redirectPath?: string;
  readonly description?: string;
}) {
  const { resendEmailVerification } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<AuthProblemPresentation | null>(null);

  async function resend() {
    if (!userId || submitting) return;
    setSubmitting(true);
    setProblem(null);
    try {
      await resendEmailVerification({ user_id: userId, redirect_path: redirectPath });
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
      <p>{description}</p>
      <AuthProblem problem={problem} />
      {sent && <p className="verification-card__success" role="status">認証メールの再送を受け付けました。</p>}
      {userId ? (
        <button className="button button--ghost" disabled={submitting} onClick={resend} type="button">
          {submitting ? "再送中…" : "認証メールを再送"}
        </button>
      ) : (
        <p>再送が必要な場合は、登録手続きをもう一度開いてください。</p>
      )}
      {redirectPath !== preRegisterEmailRedirectPath && <Link href="/login">ログイン画面へ</Link>}
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
  const { completeEmailVerification, getPreRegistrationBonus, state, smsAccess, refreshSession } = useSession();
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState<"loading" | "complete" | "error">("loading");
  const [problem, setProblem] = useState<AuthProblemPresentation | null>(null);
  const [destination, setDestination] = useState<"pending" | "standard" | "pre-registration" | "error">("pending");
  const [attempt, setAttempt] = useState(0);

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
    if (status !== "complete" || state.status !== "authenticated") return;
    let active = true;
    void getPreRegistrationBonus().then((bonus) => {
      if (active) setDestination(bonus.status === "not_applicant" ? "standard" : "pre-registration");
    }).catch(() => { if (active) setDestination("error"); });
    return () => { active = false; };
  }, [attempt, getPreRegistrationBonus, state.status, status]);

  useEffect(() => {
    if (status !== "complete" || state.status !== "authenticated") return;
    if (destination === "pre-registration") router.replace(preRegisterSmsRoute);
    else if (destination === "standard" && smsAccess === "unverified") router.replace(smsVerificationRoute);
  }, [destination, router, smsAccess, state.status, status]);

  function completedAction() {
    if (state.status === "loading") return <p role="status">認証状態を確認しています…</p>;
    if (state.status === "unauthenticated" || state.status === "session-expired") return <Link className="button button--dark" href={preRegisterLoginHref}>ログインして再開</Link>;
    if (state.status !== "authenticated" || smsAccess === "error") return <button className="button button--ghost" onClick={() => void refreshSession()} type="button">認証状態を再確認</button>;
    if (destination === "pending") return <p role="status">認証状態を確認しています…</p>;
    if (destination === "error") return <button className="button button--ghost" onClick={() => setAttempt((value) => value + 1)} type="button">事前登録の状態を再確認</button>;
    if (destination === "pre-registration") return <Link className="button button--dark" href={preRegisterSmsRoute}>事前登録のSMS認証へ</Link>;
    if (smsAccess === "unverified") return <Link className="button button--dark" href={smsVerificationRoute}>SMS認証へ</Link>;
    if (smsAccess === "loading") return <p role="status">認証状態を確認しています…</p>;
    return <Link className="button button--dark" href="/mypage">マイページへ</Link>;
  }

  if (status === "loading") return <div aria-live="polite" className="loading-state">メールアドレスを認証しています…</div>;
  return (
    <section className="verification-card">
      <span aria-hidden="true">{status === "complete" ? "✓" : "!"}</span>
      <h2>{status === "complete" ? "メール認証が完了しました" : "メール認証を完了できませんでした"}</h2>
      {status === "complete" ? completedAction() : <AuthProblem problem={problem} />}
      {status === "error" && <Link href="/verify-email">認証メール案内へ</Link>}
      <Link href={preRegisterLoginHref}>事前登録のお手続きを再開</Link>
    </section>
  );
}
