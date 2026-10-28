"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { ErrorState, LoginRequiredState } from "@/components/common/state-panel";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/common/toast-provider";
import { SESSION_ACCESS_REJECTED } from "@/lib/platform/browser-client";

import { createBrowserAccountClosureClient, ClosureUiError, type ClosureActions, type ClosurePreview } from "@/lib/platform/account-closure-client";
export { ClosureUiError, type ClosureActions, type ClosurePreview } from "@/lib/platform/account-closure-client";

export function AccountClosureGuide({ client }: { readonly client?: Omit<ClosureActions, "complete"> | null }) {
  const { state } = useSession();
  if (state.status === "loading") return <p role="status">読み込み中です。</p>;
  if (state.status === "unauthenticated" || state.status === "session-expired") return <LoginRequiredState />;
  if (state.status !== "authenticated") return <ErrorState />;
  return <ConnectedClosure key={state.session.user!.id} client={client} />;
}
function ConnectedClosure({ client: injected }: { readonly client?: Omit<ClosureActions, "complete"> | null | undefined }) {
  // This component is discarded on logout/session refresh and keyed by member identity.
  const [client] = useState(() => {
    if (injected !== undefined) return injected;
    try { return createBrowserAccountClosureClient(); } catch { return null; }
  });
  return client ? <AccountClosureFlow actions={client} /> : <ErrorState />;
}

/** The canonical server invalidates cookies; discard local session/CSRF ownership on completion. */
export function AccountClosureFlow({ actions }: { readonly actions: Omit<ClosureActions, "complete"> }) {
  const router = useRouter();
  const { showToast } = useToast();
  const completed = useRef(false);
  const flow = useMemo(() => ({ ...actions, complete() {
    if (completed.current) return;
    completed.current = true;
    window.dispatchEvent(new CustomEvent(SESSION_ACCESS_REJECTED, { detail: "ACCOUNT_CLOSED" }));
    showToast("退会が完了しました", "ご利用ありがとうございました。");
    router.replace("/");
  } }), [actions, router, showToast]);
  return <AccountClosureScreen actions={flow} />;
}

export function AccountClosureScreen({ actions }: { readonly actions: ClosureActions }) {
  const [preview, setPreview] = useState<ClosurePreview | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [credential, setCredential] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClosureUiError["kind"] | null>(null);
  const [sent, setSent] = useState<{ resendAvailableAt: number; expiresInMinutes: number; maskedEmail?: string } | null>(null);
  const [now, setNow] = useState(0);
  const [retryAt, setRetryAt] = useState(0);
  const operationKey = useRef<string | null>(null);
  const locked = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    let active = true;
    alive.current = true;
    void actions.load().then(value => { if (active) setPreview(value); }).catch(reason => {
      if (!active) return;
      if (reason instanceof ClosureUiError && ["session", "verification"].includes(reason.kind)) setError(reason.kind);
      else setLoadFailed(true);
    });
    return () => { active = false; alive.current = false; };
  }, [actions]);
  useEffect(() => {
    if (!sent && !error) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sent, error]);

  async function sendCode() {
    if (locked.current || Date.now() < Math.max(sent?.resendAvailableAt ?? 0, retryAt)) return;
    locked.current = true; setBusy(true); setError(null);
    try {
      const value = await actions.sendCode();
      if (alive.current) { setSent(value); setNow(Date.now()); }
    } catch (reason) {
      if (alive.current) { setError(reason instanceof ClosureUiError ? reason.kind : "retry"); setRetryAt(reason instanceof ClosureUiError ? reason.retryAt ?? 0 : 0); }
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!preview?.canClose || !confirmed || !credential || locked.current || Date.now() < retryAt ||
        preview.verificationMethod === "email_code" && !/^\d{6}$/.test(credential)) return;
    locked.current = true; setBusy(true); setError(null);
    operationKey.current ??= crypto.randomUUID();
    try {
      await actions.confirm({ confirmed: true, expectedPointBalance: preview.pointBalance, expectedUnclaimedPrizeCount: preview.unclaimedPrizeCount,
        ...(preview.verificationMethod === "password" ? { password: credential } : { emailCode: credential }), operationKey: operationKey.current });
      if (alive.current) { setCredential(""); actions.complete(); }
      // Remain locked on success, including while navigation is asynchronous.
    } catch (reason) {
      if (!alive.current) return;
      const kind = reason instanceof ClosureUiError ? reason.kind : "retry";
      setError(kind); setCredential("");
      setRetryAt(reason instanceof ClosureUiError ? reason.retryAt ?? 0 : 0);
      if (kind === "stale" || kind === "blocked") {
        setConfirmed(false); setPreview(null);
        try { const value = await actions.load(); if (alive.current) { setPreview(value); operationKey.current = null; } }
        catch (reason) {
          if (alive.current) {
            if (reason instanceof ClosureUiError && ["session", "verification"].includes(reason.kind)) setError(reason.kind);
            else setLoadFailed(true);
          }
        }
      }
      locked.current = false; setBusy(false);
    }
  }
  if (error === "session") return <LoginRequiredState />;
  if (error === "verification") return <div><p>メールアドレスと電話番号の認証をご確認ください。</p><Link href="/verify-email">メールアドレスの確認</Link><Link href="/mypage/sms-verification">電話番号の確認</Link></div>;
  if (loadFailed) return <ErrorState />;
  if (!preview) return <p role="status">読み込み中です。</p>;
  const password = preview.verificationMethod === "password";
  const fieldError = error === "password" ? "パスワードが正しくありません" : error === "email_code" ? "認証コードが正しくないか、有効期限が切れています" : null;
  const message = error === "stale" ? "保有ポイントまたは獲得カードの数が変わりました。内容を確認のうえ、もう一度お手続きください。" : fieldError ? `${fieldError}。` : "時間をおいてから、もう一度お試しください。";
  return <section className="account-closure" aria-labelledby="account-closure-loss">
    <div className="account-closure__loss">
      <h2 id="account-closure-loss"><span aria-hidden="true" className="account-closure__alert">!</span>退会すると、以下はすべて失われます</h2>
      <dl className="account-closure__counts"><div><dt>保有しているポイント</dt><dd>{preview.pointBalance.toLocaleString("ja-JP")} pt</dd></div><div><dt>受け取りの手続きをしていないカード</dt><dd>{preview.unclaimedPrizeCount.toLocaleString("ja-JP")} 枚</dd></div></dl>
      {preview.shippingInProgressCount > 0 ? <p>発送のお手続き中のカード（{preview.shippingInProgressCount}枚）は、退会後もお届けします。</p> : null}
      {preview.unclaimedPrizeCount > 0 ? <div className="account-closure__ship-cta"><p>受け取りたいカードがある場合は、退会の前に発送のご依頼をお済ませください。</p><Link className="button button--ghost account-closure__ship-button" href="/mypage/prizes">獲得カードを確認・発送を依頼する</Link></div> : null}
      <ul className="account-closure__notes"><li>退会に費用はかかりません。</li><li>一度退会されますと、同じアカウントに戻すことはできません。</li><li>同じメールアドレス・電話番号で新しく登録することはできますが、以前のポイント・カード・会員ランクは引き継がれません。</li></ul>
    </div>
    {!preview.canClose ? <div className="account-closure__blocked" role="status"><h2>現在、退会のお手続きができません</h2><p>決済の処理中のため、退会できません。数分ほど時間をおいてから、もう一度お試しください。</p></div> : <form className="account-closure__form" onSubmit={submit} aria-busy={busy}>
      {error ? <div role="alert"><h2>手続きを完了できませんでした</h2><p>{message}</p></div> : null}
      <label className="account-closure__consent"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />上記の内容を確認し、ポイントと受け取りの手続きをしていないカードが失われることに同意します。</label>
      <div className="form-field"><label htmlFor="closure-credential">{password ? "パスワード（確認のため再入力）" : "認証コード（登録メールアドレスへ送信）"}</label>
        {!password ? <p>「コードを送信」を押すと、登録メールアドレス（{preview.maskedEmail}）に6桁の認証コードをお送りします。</p> : null}
        <span className="password-field__control"><input id="closure-credential" type={password && !showPassword ? "password" : "text"} autoComplete={password ? "current-password" : "one-time-code"} inputMode={password ? undefined : "numeric"} maxLength={password ? 128 : 6} pattern={password ? undefined : "[0-9]{6}"} required disabled={busy} value={credential} onChange={event => setCredential(event.target.value)} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "closure-field-error" : undefined} />
        {password ? <button type="button" className="password-field__toggle" disabled={busy} onClick={() => setShowPassword(value => !value)}>{showPassword ? "隠す" : "表示"}</button> : <button type="button" onClick={() => void sendCode()} disabled={busy || now < Math.max(sent?.resendAvailableAt ?? 0, retryAt)}>{sent ? "再送信" : "コードを送信"}</button>}</span>
        {fieldError ? <p className="form-field__error" id="closure-field-error">{fieldError}</p> : null}
        {sent ? <p role="status">{sent.maskedEmail ?? preview.maskedEmail} に認証コードを送信しました。有効期限は{sent.expiresInMinutes}分です。届かない場合は迷惑メールフォルダもご確認ください。</p> : null}
      </div>
      <button type="submit" className="button account-closure__submit" disabled={busy || !confirmed || (password ? !credential : !/^\d{6}$/.test(credential)) || now < retryAt}>{busy ? "処理中…" : "退会する"}</button>
    </form>}
    <Link className="account-closure__cancel" href="/mypage">退会せずにマイページへ戻る</Link>
  </section>;
}
