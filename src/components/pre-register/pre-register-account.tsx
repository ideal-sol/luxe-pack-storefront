"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SmsVerification } from "@/components/account/sms-verification";
import { useSession } from "@/components/auth/session-provider";
import { EmailVerificationNotice } from "@/components/auth/verification";
import { LoadingState } from "@/components/common/loading-state";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";
import type { PreRegistrationBonus } from "@/lib/platform";
import { preRegisterEmailRedirectPath, preRegisterLoginHref, preRegisterSmsRoute, preRegisterThanksRoute } from "@/lib/pre-register";
import { PreRegisterThanks } from "./pre-register-thanks";

const reasons: Record<NonNullable<PreRegistrationBonus["reason"]>, string> = {
  not_pre_registration_entry: "専用の事前登録ページからのお申し込みが確認できませんでした。",
  registration_after_cutoff: "事前登録の受付期限を過ぎています。",
  email_after_cutoff: "メール認証が期限内に完了していません。",
  sms_after_cutoff: "初回SMS認証が期限内に完了していません。",
  phone_already_rewarded: "この電話番号の事前登録特典は受け取り済みです。",
  account_unavailable: "このアカウントでは事前登録特典をご利用いただけません。",
  phone_unavailable: "認証済みの電話番号を確認できませんでした。",
  qualification_unavailable: "事前登録特典の資格を確認できませんでした。",
};

export function PreRegisterAccount({ screen }: { readonly screen: "sms" | "thanks" }) {
  const { getPreRegistrationBonus, refreshSession, state } = useSession();
  const router = useRouter();
  const userId = state.status === "authenticated" ? state.session.user?.id : undefined;
  const [read, setRead] = useState<{ userId: string; bonus: PreRegistrationBonus | null; failed: boolean } | null>(null);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    if (!userId) return;
    const current = ++sequence.current;
    try {
      const bonus = await getPreRegistrationBonus();
      if (sequence.current === current) setRead({ userId, bonus, failed: false });
    } catch {
      if (sequence.current === current) setRead({ userId, bonus: null, failed: true });
    }
  }, [getPreRegistrationBonus, userId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => active ? refresh() : undefined);
    return () => { active = false; sequence.current += 1; };
  }, [refresh]);

  const bonus = userId && read?.userId === userId ? read.bonus : null;
  const completed = bonus?.status === "pre_registered" || bonus?.status === "awaiting_activation" || bonus?.status === "activated";
  useEffect(() => {
    if (screen === "sms" && completed) router.replace(preRegisterThanksRoute);
  }, [completed, router, screen]);

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "unauthenticated" || state.status === "session-expired") return <section className="verification-card">
    <p>ログインして事前登録のお手続きを再開してください。</p>
    <Link className="button button--dark" href={preRegisterLoginHref}>ログインする</Link>
  </section>;
  if (state.status !== "authenticated") return <section className="verification-card" role="alert">
    <p>認証状態を確認できませんでした。</p>
    <button className="button button--ghost" onClick={() => void refreshSession()} type="button">再試行</button>
  </section>;
  if (read?.userId === userId && read?.failed) return <section className="verification-card" role="alert">
    <p>事前登録の状態を確認できませんでした。</p>
    <button className="button button--ghost" onClick={() => void refresh()} type="button">再試行</button>
    <Link href={preRegisterLoginHref}>ログインから再開</Link>
  </section>;
  if (!bonus) return <LoadingState />;
  if (bonus.status === "email_pending") return <EmailVerificationNotice
    description="メールの認証後、電話番号の認証（SMS）へ進みます。"
    redirectPath={preRegisterEmailRedirectPath}
    {...(userId ? { userId } : {})}
  />;
  if (bonus.status === "not_applicant") return <section className="verification-card">
    <p>このアカウントの事前登録のお申し込みはありません。</p>
    <Link href="/pre-register">事前登録のご案内へ</Link>
  </section>;
  if (bonus.status === "not_eligible") return <section className="verification-card" role="status">
    <h2>事前登録特典の対象外です</h2>
    <p>{bonus.reason ? reasons[bonus.reason] : "事前登録特典の対象条件を満たしていません。"}</p>
    <p>メール・SMS認証後は通常の会員としてご利用いただけます。</p>
    {screen === "sms" && bonus.email_verified && !bonus.sms_verified
      ? <SmsVerification preRegistration onVerified={refresh} />
      : <Link href={preRegisterSmsRoute}>認証状態を確認する</Link>}
  </section>;
  if (bonus.status === "sms_pending") return screen === "sms" ? <>
    <PageTitle description="メールの認証が完了しました。最後に、電話番号の認証（SMS）をお願いします。" eyebrow="STEP 2 / SMS" title="電話番号の認証" />
    <SmsVerification preRegistration onVerified={refresh} />
    <p>SMSが届かない場合は、電話番号に誤りがないか、迷惑メッセージの設定をご確認ください。</p>
    <button className="button button--ghost" onClick={() => void refresh()} type="button">事前登録の状態を再確認</button>
  </> : <section className="verification-card">
    <p>電話番号の認証（SMS）を完了してください。</p>
    <Link className="button button--dark" href={preRegisterSmsRoute}>SMS認証へ</Link>
  </section>;
  if (!completed) return <section className="verification-card" role="alert"><p>事前登録の状態を確認できませんでした。</p></section>;
  if (screen === "sms") return <LoadingState />;
  return <>
    <PreRegisterThanks activated={bonus.status === "activated"} />
    <PageContainer size="narrow">
      <section className="verification-card" role="status">
        {bonus.status === "activated" ? <>
          <h2>事前登録特典が反映されました</h2>
          {bonus.point_amount !== null && <p>付与コイン：{bonus.point_amount.toLocaleString("ja-JP")}コイン</p>}
          {bonus.granted_at && <p>付与日時：<time dateTime={bonus.granted_at}>{new Date(bonus.granted_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（JST）</time></p>}
          {bonus.expires_at && <p>有効期限：<time dateTime={bonus.expires_at}>{new Date(bonus.expires_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（JST）</time></p>}
        </> : <>
          <h2>{bonus.status === "awaiting_activation" ? "特典の反映をお待ちください" : "事前登録のお手続きが完了しました"}</h2>
          <p>特典のコインはまだ付与されていません。</p>
        </>}
        <button className="button button--ghost" onClick={() => void refresh()} type="button">状態を再確認</button>
      </section>
    </PageContainer>
  </>;
}
