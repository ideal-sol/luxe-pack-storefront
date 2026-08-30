"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AuthProblem, FieldProblem } from "@/components/auth/auth-problem";
import { useSession } from "@/components/auth/session-provider";
import {
  presentAccountSecurityProblem,
  type AccountSecurityProblemPresentation,
} from "@/lib/platform";
import { PasswordFields } from "./password-fields";

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

export function PasswordResetRequestForm() {
  const { requestPasswordReset, state } = useSession();
  const [accepted, setAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<AccountSecurityProblemPresentation | null>(null);
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
      await requestPasswordReset({ email: normalizedEmail, redirect_path: "/" });
      setEmail("");
      setAccepted(true);
    } catch (error) {
      setProblem(presentAccountSecurityProblem(error, "password-reset"));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (accepted) {
    return (
      <section className="verification-card account-security-status" role="status">
        <span aria-hidden="true">✉</span>
        <h2>パスワード再設定を受け付けました。</h2>
        <p>
          ご登録状況に問題がない場合、入力されたメールアドレス宛に
          <br />パスワード再設定用メールをお送りします。
        </p>
        <Link href="/login">ログイン画面へ</Link>
      </section>
    );
  }

  const unavailable = state.status === "configuration-unavailable";
  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      <AuthProblem
        problem={unavailable ? {
          authenticationRequired: false,
          fieldErrors: {},
          invalidLink: false,
          message: "現在の環境では認証接続が設定されていません。",
          sessionExpired: false,
        } : problem}
      />
      <div className="form-field">
        <label htmlFor="password-reset-email">メールアドレス</label>
        <input
          aria-describedby={problem?.fieldErrors.email ? "password-reset-email-error" : undefined}
          autoComplete="email"
          disabled={submitting || unavailable}
          id="password-reset-email"
          maxLength={320}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <span id="password-reset-email-error"><FieldProblem field="email" problem={problem} /></span>
      </div>
      <button className="button button--dark auth-form__submit" disabled={submitting || unavailable} type="submit">
        {submitting ? "送信中…" : "送信"}
      </button>
      <p className="auth-form__alternate"><Link href="/login">ログイン画面へ戻る</Link></p>
    </form>
  );
}

export function PasswordResetConfirmForm({
  token,
  userId,
}: {
  readonly token: string;
  readonly userId: string;
}) {
  const router = useRouter();
  const { confirmPasswordReset, state } = useSession();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [problem, setProblem] = useState<AccountSecurityProblemPresentation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (newPassword !== confirmPassword) {
      setMismatch(true);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setMismatch(false);
    setProblem(null);
    try {
      await confirmPasswordReset({ password: newPassword, token, user_id: userId });
      setNewPassword("");
      setConfirmPassword("");
      router.replace("/login?password-updated=1");
    } catch (error) {
      const presented = presentAccountSecurityProblem(error, "password-reset");
      if (presented.invalidLink) setLinkInvalid(true);
      else setProblem(presented);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (linkInvalid) return <InvalidPasswordResetLink />;
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
      <PasswordFields
        confirmPassword={confirmPassword}
        disabled={submitting || unavailable}
        fieldErrors={problem?.fieldErrors ?? {}}
        idPrefix="password-reset"
        mismatch={mismatch}
        newPassword={newPassword}
        newPasswordName="password"
        onConfirmPasswordChange={(value) => {
          setConfirmPassword(value);
          if (mismatch) setMismatch(value !== newPassword);
        }}
        onNewPasswordChange={(value) => {
          setNewPassword(value);
          if (mismatch) setMismatch(value !== confirmPassword);
        }}
      />
      <button className="button button--dark auth-form__submit" disabled={submitting || unavailable} type="submit">
        {submitting ? "更新中…" : "パスワード更新"}
      </button>
    </form>
  );
}

export function InvalidPasswordResetLink() {
  return (
    <section className="verification-card account-security-status" role="alert">
      <span aria-hidden="true">!</span>
      <h2>パスワード再設定リンクを確認できませんでした</h2>
      <p>このパスワード再設定リンクは無効または有効期限が切れています。<br />もう一度パスワード再設定を行ってください。</p>
      <Link className="button button--dark" href="/password-reset">パスワード再設定へ</Link>
      <Link href="/login">ログイン画面へ</Link>
    </section>
  );
}
