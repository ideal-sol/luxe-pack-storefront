"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import type { PreRegistrationCampaign } from "@/lib/platform";
import { LoadingState } from "@/components/common/loading-state";
import { RegisterForm } from "@/components/auth/register-form";
import { EmailVerificationNotice } from "@/components/auth/verification";
import { PageTitle } from "@/components/common/page-title";
import { brandAssetUrl } from "@/lib/brand-assets";
import { preRegisterBonusCoins, preRegisterEmailRedirectPath, preRegisterOpenDateLabel } from "@/lib/pre-register";
import { PreRegisterNote } from "./pre-register-note";

export function PreRegisterFlow({ initialPendingUserId = null }: { readonly initialPendingUserId?: string | null }) {
  const { getPreRegistrationCampaign } = useSession();
  const [campaign, setCampaign] = useState<PreRegistrationCampaign | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pendingUserId, setPendingUserId] = useState<string | null>(initialPendingUserId);

  useEffect(() => {
    let active = true;
    void getPreRegistrationCampaign().then((data) => {
      if (active) { setCampaign(data); setFailed(false); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt, getPreRegistrationCampaign]);

  function registered(userId: string) {
    setPendingUserId(userId);
    window.history.replaceState(window.history.state, "", "/pre-register?" + new URLSearchParams({ user_id: userId }).toString());
    window.scrollTo({ top: 0 });
  }

  if (pendingUserId) {
    return (
      <>
        <PageTitle description="あと2つだけ、お手続きが残っています。" eyebrow="STEP 1 / MAIL" title="メールの認証" />
        <EmailVerificationNotice
          description="ご登録のメールアドレスに確認のメールをお送りしました。本文のボタンから認証を完了すると、続けて電話番号の認証（SMS）に進みます。"
          redirectPath={preRegisterEmailRedirectPath}
          userId={pendingUserId}
        />
        <PreRegisterNote
          items={[
            "認証のメールが届かない場合は、迷惑メールのフォルダをご確認ください。",
            `${preRegisterBonusCoins}のお渡しは、電話番号の認証まで済ませた方が対象です。`,
          ]}
        />
      </>
    );
  }

  if (failed) return <section className="verification-card" role="alert">
    <p>事前登録の受付状況を確認できませんでした。</p>
    <button className="button button--ghost" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }} type="button">再試行</button>
  </section>;
  if (!campaign) return <LoadingState />;
  if (campaign.status !== "accepting") return <section className="verification-card">
    <PageTitle title={campaign.status === "closed" ? "事前登録の受付は終了しました" : "事前登録はまだ始まっていません"} />
    {campaign.status === "closed" && <Link className="button button--dark" href="/register">通常の新規登録へ</Link>}
  </section>;

  return (
    <>
      <PageTitle description="オープンを待たずに、いまご登録いただけます。" eyebrow="PRE-REGISTRATION" title="事前登録 受付中" />
      <section className="pre-lead">
        <Image alt="" aria-hidden="true" height={200} src={brandAssetUrl("sd_pokezou_makasero.webp")} unoptimized width={133} />
        <span className="pre-open">{preRegisterOpenDateLabel}グランドオープン</span>
        <b>オープンの前に、登録だけ済ませておきませんか。</b>
        <p>ポケモンカード専門のオンラインオリパ「オリポケ」は、11月1日に開店します。いま登録しておくと、開店と同時にそのまま遊びはじめられます。</p>
      </section>
      <ul className="pre-perks">
        <li>
          <span aria-hidden="true" className="n">1</span>
          <div>
            <b>オープン当日に<em>{preRegisterBonusCoins}</em></b>
            <p>ご登録後、メールの認証と電話番号の認証まで済ませておいてください。500コインは11月1日のオープン当日にお渡しします。</p>
          </div>
        </li>
        <li>
          <span aria-hidden="true" className="n">2</span>
          <div>
            <b>オープン当日、待たずに遊べます</b>
            <p>登録のお手続きは数分で終わります。先に済ませておけば、11月1日は入ってすぐガチャを引けます。</p>
          </div>
        </li>
        <li>
          <span aria-hidden="true" className="n">3</span>
          <div>
            <b>オープンまでのお知らせはXで</b>
            <p>プレゼント企画や、どんなカードが入るのか、どんな企画があるのかは、公式X（旧Twitter）でお知らせしていきます。オープンまでの情報はXでご確認ください。</p>
          </div>
        </li>
      </ul>
      <RegisterForm
        onClosed={() => { setCampaign(null); setAttempt((value) => value + 1); }}
        onRegistered={registered}
        preRegistration
      />
      <p>予定特典：{campaign.point_amount.toLocaleString("ja-JP")}コイン（無償）</p>
      <PreRegisterNote
        items={[
          `オープンは${preRegisterOpenDateLabel}です。それまでガチャの購入・抽選はできません。`,
          `コインの購入ができるのはオープン後です。${preRegisterBonusCoins}のお渡しもオープン当日です。`,
          "ご登録は無料です。未成年の方は、親権者など法定代理人の同意が必要です。",
        ]}
      />
    </>
  );
}
