"use client";

import Link from "next/link";
import { useState } from "react";
import { presentAuthProblem, type AuthProblemPresentation } from "@/lib/platform";
import { AuthProblem, FieldProblem } from "./auth-problem";
import { EmailVerificationNotice } from "./verification";
import { useSession } from "./session-provider";

export function RegisterForm() {
  const { register, state } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<AuthProblemPresentation | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setProblem(null);
    try {
      const pending = await register({
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
        redirect_path: "/mypage",
      });
      form.reset();
      setPendingUserId(pending.user_id);
    } catch (error) {
      setProblem(presentAuthProblem(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingUserId) return <EmailVerificationNotice userId={pendingUserId} />;
  const unavailable = state.status === "configuration-unavailable";
  return (
    <form className="auth-form" onSubmit={submit}>
      <AuthProblem
        problem={unavailable ? {
          fieldErrors: {},
          message: "現在の環境では認証接続が設定されていません。",
          sessionExpired: false,
        } : problem}
      />
      <label className="form-field">
        <span>メールアドレス</span>
        <input autoComplete="email" disabled={submitting || unavailable} maxLength={320} name="email" required type="email" />
        <FieldProblem field="email" problem={problem} />
      </label>
      <label className="form-field">
        <span>パスワード</span>
        <input aria-label="パスワード" autoComplete="new-password" disabled={submitting || unavailable} maxLength={128} minLength={8} name="password" required type="password" />
        <small>8文字以上128文字以内</small>
        <FieldProblem field="password" problem={problem} />
      </label>
      <p className="auth-form__terms">
        登録により<Link href="/pages/terms">利用規約</Link>と<Link href="/pages/privacy">プライバシーポリシー</Link>をご確認いただいたものとします。
      </p>
      <button className="button button--dark auth-form__submit" disabled={submitting || unavailable} type="submit">
        {submitting ? "登録中…" : "新規登録"}
      </button>
      <p className="auth-form__alternate">すでにアカウントをお持ちの方は <Link href="/login">ログイン</Link></p>
    </form>
  );
}
