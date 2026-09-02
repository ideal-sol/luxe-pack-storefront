"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthProblem, FieldProblem } from "@/components/auth/auth-problem";
import { useSession } from "@/components/auth/session-provider";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState, LoginRequiredState } from "@/components/common/state-panel";
import {
  presentSmsProblem,
  type SmsProblemPresentation,
  type SmsVerificationAccepted,
  type SmsVerificationStatus,
} from "@/lib/platform";
import { formatVerifiedPhone, normalizeJapaneseMobilePhone } from "@/lib/presentation/phone";

type Stage = "phone" | "reauthentication" | "otp" | "verified";

const LOCAL_COOLDOWN_SECONDS = 60;
const POLL_INTERVAL_MS = 2_000;

function stageForStatus(status: SmsVerificationStatus): Stage {
  if (status.challenge) return "otp";
  return status.verified ? "verified" : "phone";
}

function statusAfterAccepted(previous: SmsVerificationStatus | null, accepted: SmsVerificationAccepted): SmsVerificationStatus {
  return {
    challenge: {
      delivery_state: accepted.delivery_state ?? "pending",
      expires_at: accepted.expires_at,
      id: accepted.challenge_id,
      status: accepted.status ?? "pending",
    },
    phone: previous?.phone ?? null,
    phone_masked: accepted.phone_masked,
    verified: previous?.verified ?? false,
    verified_at: previous?.verified_at ?? null,
  };
}

function deliveryMessage(status: SmsVerificationStatus | null) {
  const challenge = status?.challenge;
  if (!challenge) return null;
  if (challenge.status === "failed" || challenge.delivery_state === "failed") {
    return { message: "認証コードを送信できませんでした。しばらくしてから再度お試しください。", tone: "error" as const };
  }
  if (challenge.status === "expired") {
    return { message: "認証コードの有効期限が切れました。再送信してください。", tone: "error" as const };
  }
  if (challenge.status === "accepted" || challenge.delivery_state === "accepted") {
    return { message: "認証コードを送信しました。", tone: "success" as const };
  }
  return { message: "認証コードを送信しています。", tone: "pending" as const };
}

export function SmsVerification({ pollIntervalMs = POLL_INTERVAL_MS }: { readonly pollIntervalMs?: number }) {
  const {
    getSmsVerificationStatus,
    reauthenticatePassword,
    refreshSession,
    resendSmsVerification,
    sendSmsVerification,
    state: session,
    verifySmsCode,
  } = useSession();
  const [status, setStatus] = useState<SmsVerificationStatus | null>(null);
  const [stage, setStage] = useState<Stage>("phone");
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [problem, setProblem] = useState<SmsProblemPresentation | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [changingPhone, setChangingPhone] = useState(false);
  const resumeAfterReauthentication = useRef<"phone" | "otp">("phone");
  const submittingRef = useRef(false);
  const sessionUserId = session.status === "authenticated" ? session.session.user?.id ?? null : null;

  const applyStatus = useCallback((next: SmsVerificationStatus) => {
    setStatus(next);
    setStage(stageForStatus(next));
    setChangingPhone(next.verified && Boolean(next.challenge));
  }, []);

  const refreshSmsStatus = useCallback(async () => {
    const next = await getSmsVerificationStatus();
    applyStatus(next);
    return next;
  }, [applyStatus, getSmsVerificationStatus]);

  useEffect(() => {
    if (!sessionUserId) return;
    let active = true;
    void getSmsVerificationStatus()
      .then((next) => {
        if (active) {
          setProblem(null);
          applyStatus(next);
        }
      })
      .catch((error: unknown) => {
        if (active) setProblem(presentSmsProblem(error));
      })
      .finally(() => {
        if (active) setLoadedForUserId(sessionUserId);
      });
    return () => { active = false; };
  }, [applyStatus, getSmsVerificationStatus, sessionUserId]);

  useEffect(() => {
    const challenge = status?.challenge;
    if (!challenge || challenge.status !== "pending") return;
    let active = true;
    const timer = window.setTimeout(() => {
      void getSmsVerificationStatus()
        .then((next) => {
          if (active) applyStatus(next);
        })
        .catch((error: unknown) => {
          if (active) setProblem(presentSmsProblem(error));
        });
    }, pollIntervalMs);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [applyStatus, getSmsVerificationStatus, pollIntervalMs, status]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const update = () => setCooldownRemaining(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1_000)));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  function startCooldown(seconds: number) {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    setCooldownUntil(Date.now() + safeSeconds * 1_000);
    setCooldownRemaining(safeSeconds);
  }

  function handleProblem(error: unknown, resumeStage: "phone" | "otp") {
    const presented = presentSmsProblem(error);
    setProblem(presented);
    if (presented.retryAfterSeconds !== null) startCooldown(presented.retryAfterSeconds);
    if (presented.reauthenticationRequired) {
      resumeAfterReauthentication.current = resumeStage;
      setStage("reauthentication");
    }
    if (presented.phoneUnavailable) {
      setPhone("");
      setStage("phone");
    }
    if (presented.sessionExpired) void refreshSession();
  }

  async function retryStatus() {
    setLoadingStatus(true);
    setProblem(null);
    try {
      await refreshSmsStatus();
    } catch (error) {
      handleProblem(error, "phone");
    } finally {
      setLoadingStatus(false);
    }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    const normalizedPhone = normalizeJapaneseMobilePhone(phone);
    if (!normalizedPhone) {
      setPhoneError("070・080・090で始まる11桁の携帯電話番号を入力してください。");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setPhoneError(null);
    setProblem(null);
    try {
      const accepted = await sendSmsVerification({ phone: normalizedPhone });
      setStatus((current) => statusAfterAccepted(current, accepted));
      setStage("otp");
      setCode("");
      startCooldown(LOCAL_COOLDOWN_SECONDS);
    } catch (error) {
      handleProblem(error, "phone");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function resend() {
    if (submittingRef.current || cooldownRemaining > 0) return;
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      const accepted = await resendSmsVerification();
      setStatus((current) => statusAfterAccepted(current, accepted));
      setCode("");
      startCooldown(LOCAL_COOLDOWN_SECONDS);
    } catch (error) {
      handleProblem(error, "otp");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const challenge = status?.challenge;
    if (!challenge || challenge.status !== "accepted" || !/^\d{6}$/.test(code) || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      const verified = await verifySmsCode({ challenge_id: challenge.id, code });
      setStatus(verified);
      setStage("verified");
      setCode("");
      setPhone("");
      setCompletionMessage(changingPhone ? "電話番号を変更しました。" : "SMS認証が完了しました。");
      if (changingPhone) await refreshSession();
      await refreshSmsStatus();
    } catch (error) {
      handleProblem(error, "otp");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function reauthenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      await reauthenticatePassword({ password });
      setPassword("");
      setStage(resumeAfterReauthentication.current);
    } catch (error) {
      handleProblem(error, resumeAfterReauthentication.current);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function startPhoneChange() {
    setChangingPhone(true);
    setCompletionMessage(null);
    setProblem(null);
    setPhone("");
    resumeAfterReauthentication.current = "phone";
    setStage("reauthentication");
  }

  if (session.status === "loading") return <LoadingState />;
  if (session.status === "unauthenticated" || session.status === "session-expired") return <LoginRequiredState />;
  if (session.status === "configuration-unavailable" || session.status === "error") return <ErrorState />;
  if (!sessionUserId) return <LoginRequiredState />;
  if (loadingStatus || loadedForUserId !== sessionUserId) return <LoadingState />;
  if (!status && problem) {
    return (
      <section className="sms-verification-card">
        <AuthProblem problem={problem} />
        <button className="button button--ghost" onClick={() => void retryStatus()} type="button">再読み込み</button>
      </section>
    );
  }

  const delivery = deliveryMessage(status);
  const acceptedForVerification = status?.challenge?.status === "accepted";

  return (
    <div className="sms-verification">
      <Link className="sms-verification__back" href="/mypage">← マイページへ戻る</Link>

      {stage === "verified" && status?.verified && status.phone ? (
        <section aria-labelledby="sms-verification-heading" className="sms-verification-card sms-verification-card--verified">
          <div aria-hidden="true" className="sms-verification-card__mark">✓</div>
          <div>
            <p>PHONE OWNERSHIP</p>
            <h2 id="sms-verification-heading">SMS認証済み</h2>
          </div>
          {completionMessage && <p className="sms-verification__success" role="status">{completionMessage}</p>}
          <dl>
            <div><dt>電話番号</dt><dd>{formatVerifiedPhone(status.phone)}</dd></div>
            <div><dt>認証状態</dt><dd>SMS認証済み</dd></div>
          </dl>
          <button className="button button--dark" onClick={startPhoneChange} type="button">電話番号を変更する</button>
        </section>
      ) : stage === "reauthentication" ? (
        <form className="sms-verification-card" onSubmit={reauthenticate}>
          <div>
            <p>FRESH AUTHENTICATION</p>
            <h2>本人確認</h2>
            <span>電話番号を変更するため、現在のパスワードを入力してください。</span>
          </div>
          <AuthProblem problem={problem} />
          <label className="form-field" htmlFor="sms-current-password">
            <span>現在のパスワード</span>
            <input
              aria-label="現在のパスワード"
              aria-describedby={problem?.fieldErrors.password ? "sms-current-password-error" : undefined}
              autoComplete="current-password"
              disabled={submitting}
              id="sms-current-password"
              maxLength={128}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <span id="sms-current-password-error"><FieldProblem field="password" problem={problem} /></span>
          <div className="sms-verification__actions">
            <button className="button button--ghost" disabled={submitting} onClick={() => setStage(status?.verified ? "verified" : "phone")} type="button">戻る</button>
            <button className="button button--dark" disabled={submitting || !password} type="submit">{submitting ? "確認中…" : "本人確認する"}</button>
          </div>
        </form>
      ) : stage === "phone" ? (
        <form className="sms-verification-card" noValidate onSubmit={send}>
          <div>
            <p>PHONE OWNERSHIP</p>
            <h2>{changingPhone ? "新しい電話番号" : "SMS認証"}</h2>
            <span>070・080・090で始まる日本国内の携帯電話番号を入力してください。</span>
          </div>
          <AuthProblem problem={problem} />
          <label className="form-field" htmlFor="sms-phone">
            <span>携帯電話番号</span>
            <input
              aria-label="携帯電話番号"
              aria-describedby={phoneError || problem?.fieldErrors.phone ? "sms-phone-error" : "sms-phone-hint"}
              aria-invalid={Boolean(phoneError || problem?.fieldErrors.phone)}
              autoComplete="tel-national"
              disabled={submitting}
              id="sms-phone"
              inputMode="tel"
              maxLength={13}
              onChange={(event) => { setPhone(event.target.value); setPhoneError(null); }}
              placeholder="090-1234-5678"
              required
              type="tel"
              value={phone}
            />
            <small id="sms-phone-hint">ハイフンあり・なし、どちらでも入力できます。</small>
          </label>
          <span id="sms-phone-error">
            {phoneError ? <span className="field-problem" role="alert">{phoneError}</span> : <FieldProblem field="phone" problem={problem} />}
          </span>
          <button className="button button--dark" disabled={submitting} type="submit">{submitting ? "送信受付中…" : "認証コードを送信"}</button>
        </form>
      ) : (
        <form className="sms-verification-card" noValidate onSubmit={verify}>
          <div>
            <p>ONE-TIME CODE</p>
            <h2>認証コードを入力</h2>
            <span>SMSに記載された6桁の認証コードを入力してください。</span>
          </div>
          {delivery && <p className={`sms-verification__delivery sms-verification__delivery--${delivery.tone}`} role="status">{delivery.message}</p>}
          <AuthProblem problem={problem} />
          <label className="form-field" htmlFor="sms-code">
            <span>認証コード</span>
            <input
              aria-label="認証コード"
              aria-describedby={problem?.fieldErrors.code ? "sms-code-error" : "sms-code-hint"}
              aria-invalid={Boolean(problem?.fieldErrors.code)}
              autoComplete="one-time-code"
              disabled={submitting}
              id="sms-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              pattern="[0-9]{6}"
              required
              type="text"
              value={code}
            />
            <small id="sms-code-hint">認証コードの有効期限は5分です。</small>
          </label>
          <span id="sms-code-error"><FieldProblem field="code" problem={problem} /></span>
          <button className="button button--dark" disabled={submitting || code.length !== 6 || !acceptedForVerification} type="submit">
            {submitting ? "認証中…" : "SMS認証を完了"}
          </button>
          <button className="sms-verification__resend" disabled={submitting || cooldownRemaining > 0} onClick={() => void resend()} type="button">
            {cooldownRemaining > 0 ? `再送信（${cooldownRemaining}秒）` : "認証コードを再送信"}
          </button>
        </form>
      )}
    </div>
  );
}
