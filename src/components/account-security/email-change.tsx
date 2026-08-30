"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthProblem, FieldProblem } from "@/components/auth/auth-problem";
import { useSession } from "@/components/auth/session-provider";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState, LoginRequiredState } from "@/components/common/state-panel";
import {
  presentAccountSecurityProblem,
  type AccountSecurityProblemPresentation,
} from "@/lib/platform";

const invalidEmailProblem: AccountSecurityProblemPresentation = {
  authenticationRequired: false,
  fieldErrors: { email: ["メールアドレスの形式を確認してください。"] },
  invalidLink: false,
  message: "入力内容を確認してください。",
  sessionExpired: false,
};

function isPlausibleEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

export function EmailChangeRequestForm() {
  const { createEmailChangeRequest, refreshSession, state } = useSession();
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<AccountSecurityProblemPresentation | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const normalizedEmail = email.trim();
    if (!isPlausibleEmail(normalizedEmail)) {
      setProblem(invalidEmailProblem);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      await createEmailChangeRequest({ email: normalizedEmail, redirect_path: "/" });
      setEmail("");
      setSent(true);
    } catch (error) {
      const presented = presentAccountSecurityProblem(error, "email-change");
      setProblem(presented);
      if (presented.authenticationRequired) void refreshSession();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "unauthenticated" || state.status === "session-expired") return <LoginRequiredState />;
  if (state.status === "configuration-unavailable" || state.status === "error") return <ErrorState />;
  if (sent) {
    return (
      <section className="verification-card account-security-status" role="status">
        <span aria-hidden="true">✉</span>
        <h2>確認メールを送信しました</h2>
        <p>入力されたメールアドレス宛に確認メールを送信しました。<br />メール内のリンクからメールアドレス変更を完了してください。</p>
        <Link href="/mypage">マイページへ戻る</Link>
      </section>
    );
  }

  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      <AuthProblem problem={problem} />
      <div className="form-field">
        <label htmlFor="email-change-email">新しいメールアドレス</label>
        <input
          aria-describedby={problem?.fieldErrors.email ? "email-change-email-error" : undefined}
          autoComplete="email"
          disabled={submitting}
          id="email-change-email"
          maxLength={320}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <span id="email-change-email-error"><FieldProblem field="email" problem={problem} /></span>
      </div>
      <button className="button button--dark auth-form__submit" disabled={submitting} type="submit">
        {submitting ? "送信中…" : "送信"}
      </button>
    </form>
  );
}

export function EmailChangeCompletion({
  requestId,
  token,
}: {
  readonly requestId: string;
  readonly token: string;
}) {
  const router = useRouter();
  const { completeEmailChange, state } = useSession();
  const started = useRef(false);
  const [problem, setProblem] = useState<AccountSecurityProblemPresentation | null>(null);
  const [status, setStatus] = useState<"complete-logged-out" | "error" | "invalid" | "loading">("loading");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void completeEmailChange({ request_id: requestId, token })
      .then((completed) => {
        if (completed.authenticated) {
          router.replace("/mypage?account-updated=email");
        } else {
          setStatus("complete-logged-out");
        }
      })
      .catch((error: unknown) => {
        const presented = presentAccountSecurityProblem(error, "email-change");
        setProblem(presented);
        setStatus(presented.invalidLink ? "invalid" : "error");
      });
  }, [completeEmailChange, requestId, router, token]);

  if (status === "loading") {
    return <div aria-live="polite" className="loading-state" role="status">メールアドレスを変更しています…</div>;
  }
  if (status === "invalid") return <InvalidEmailChangeLink />;
  if (status === "error") {
    return (
      <section className="verification-card account-security-status">
        <span aria-hidden="true">!</span>
        <h2>メールアドレスを変更できませんでした</h2>
        <AuthProblem problem={problem} />
        <Link href={state.status === "authenticated" ? "/mypage/email" : "/login"}>
          {state.status === "authenticated" ? "メールアドレス変更へ" : "ログイン画面へ"}
        </Link>
      </section>
    );
  }
  return (
    <section className="verification-card account-security-status" role="status">
      <span aria-hidden="true">✓</span>
      <h2>メールアドレスを変更しました。</h2>
      <p>新しいメールアドレスでログインできます。この画面では自動ログインを行いません。</p>
      <Link className="button button--dark" href="/login">ログインする</Link>
      <Link href="/">トップへ戻る</Link>
    </section>
  );
}

export function InvalidEmailChangeLink() {
  const { state } = useSession();
  const authenticated = state.status === "authenticated";
  return (
    <section className="verification-card account-security-status" role="alert">
      <span aria-hidden="true">!</span>
      <h2>メールアドレス変更用リンクを確認できませんでした</h2>
      <p>このメールアドレス変更用リンクは無効または有効期限が切れています。<br />もう一度メールアドレス変更を行ってください。</p>
      <Link className="button button--dark" href={authenticated ? "/mypage/email" : "/login"}>
        {authenticated ? "メールアドレス変更へ" : "ログインする"}
      </Link>
      {authenticated ? <Link href="/mypage">マイページへ戻る</Link> : null}
    </section>
  );
}
