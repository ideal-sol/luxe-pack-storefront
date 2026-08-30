"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { presentAuthProblem, type AuthProblemPresentation } from "@/lib/platform";
import { AuthProblem, FieldProblem } from "./auth-problem";
import { useSession } from "./session-provider";

export function LoginForm({ passwordUpdated = false }: { readonly passwordUpdated?: boolean }) {
  const router = useRouter();
  const { login, state } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<AuthProblemPresentation | null>(null);

  useLayoutEffect(() => {
    if (passwordUpdated) window.history.replaceState(window.history.state, "", "/login");
  }, [passwordUpdated]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setProblem(null);
    try {
      await login({
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      form.reset();
      router.replace("/mypage");
    } catch (error) {
      setProblem(presentAuthProblem(error));
    } finally {
      setSubmitting(false);
    }
  }

  const unavailable = state.status === "configuration-unavailable";
  return (
    <form className="auth-form" noValidate={false} onSubmit={submit}>
      {passwordUpdated ? (
        <div className="auth-success" role="status">
          <strong>パスワードを更新しました。</strong>
          <p>新しいパスワードでログインしてください。</p>
        </div>
      ) : null}
      <AuthProblem
        problem={unavailable ? {
          fieldErrors: {},
          message: "現在の環境では認証接続が設定されていません。",
          sessionExpired: false,
        } : problem}
      />
      <label className="form-field">
        <span>メールアドレス</span>
        <input
          aria-describedby={problem?.fieldErrors.email ? "login-email-error" : undefined}
          autoComplete="email"
          disabled={submitting || unavailable}
          maxLength={320}
          name="email"
          required
          type="email"
        />
        <span id="login-email-error"><FieldProblem field="email" problem={problem} /></span>
      </label>
      <label className="form-field">
        <span>パスワード</span>
        <input
          aria-describedby={problem?.fieldErrors.password ? "login-password-error" : undefined}
          autoComplete="current-password"
          disabled={submitting || unavailable}
          maxLength={128}
          minLength={1}
          name="password"
          required
          type="password"
        />
        <span id="login-password-error"><FieldProblem field="password" problem={problem} /></span>
      </label>
      <button className="button button--dark auth-form__submit" disabled={submitting || unavailable} type="submit">
        {submitting ? "ログイン中…" : "ログイン"}
      </button>
      <p className="auth-form__alternate"><Link href="/password-reset">パスワードを忘れた方はこちら</Link></p>
      <p className="auth-form__alternate">アカウントをお持ちでない方は <Link href="/register">新規登録</Link></p>
    </form>
  );
}
