import { HomeSectionHeading } from "@/components/catalog/home-section-heading";
import Image from "next/image";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";
import { brandAssetUrl } from "@/lib/brand-assets";
import { officialLineUrl, officialXUrl, preRegisterBonusCoins, preRegisterOpenDateLabel } from "@/lib/pre-register";
import { PreRegisterNote } from "./pre-register-note";

const steps = [
  { image: "sd_orika_touroku.webp", width: 126, height: 208, title: "メールの認証", body: "完了しました。", done: true },
  { image: "sd_pokezou_coin.webp", width: 173, height: 200, title: "電話番号の認証", body: `完了しました。オープン当日に${preRegisterBonusCoins}をお渡しします。`, done: true },
  { image: "sd_fukumaru_ooyorokobi.webp", width: 185, height: 190, title: "11月1日をお待ちください", body: `オープンと同時に${preRegisterBonusCoins}が入り、そのままガチャを引いていただけます。`, done: false },
] as const;

export function PreRegisterThanks({ activated = false }: { readonly activated?: boolean }) {
  return (
    <>
      <PageContainer className="route-page auth-page pre-thanks-head" size="narrow">
        <PageTitle description="オリポケへの事前登録が完了しました。" eyebrow="THANK YOU" title="事前登録ありがとうございます" />
      </PageContainer>
      <section aria-labelledby="pre-thanks-flow" className="home-guide home-guide--flow pre-thanks-flow">
        <div className="page-container">
          <HomeSectionHeading id="pre-thanks-flow" lead={activated ? "事前登録特典の反映が完了しました。" : "お手続きはすべて完了しました。あとはオープンをお待ちください。"} title="このあとの流れ" watermark="NEXT" />
          <ol className="home-guide__flow">
            {steps.map((step, index) => (
              <li className={step.done ? "pre-step--done" : undefined} key={step.title}>
                {index > 0 && <span aria-hidden="true" className="home-guide__flow-arrow">▶</span>}
                <span className="home-guide__step-no">STEP {index + 1}{step.done ? "　完了" : ""}</span>
                <Image alt="" aria-hidden="true" height={step.height} src={brandAssetUrl(step.image)} unoptimized width={step.width} />
                <span aria-hidden="true" className="home-guide__pedestal" />
                <h3>{activated && index === 2 ? "特典の反映が完了しました" : step.title}</h3>
                <p>{activated && index > 0 ? index === 1 ? "完了しました。" : "特典の反映が完了しました。" : step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <PageContainer className="route-page pre-thanks-tail" size="narrow">
        <div className="thanks-cta">
          <p className="thanks-cta__lead">オープンまでのお知らせは、公式Xでお伝えします</p>
          <a className="button button--dark" href={officialXUrl} rel="noreferrer" target="_blank">公式Xをフォローする</a>
          <small>プレゼント企画や、入荷するカード・企画の内容をお知らせしています。オープンまでの情報は、Xでご確認ください。</small>
          {officialLineUrl && (
            <>
              <span aria-hidden="true" className="thanks-cta__sep" />
              <a className="button button--linegreen" href={officialLineUrl} rel="noreferrer" target="_blank">公式LINEを友だち追加する</a>
              <small>お知らせの受け取りや、お困りのときのご相談にお使いいただけます。</small>
            </>
          )}
        </div>
        {!activated && <PreRegisterNote
          items={[
            `${preRegisterBonusCoins}のお渡しは${preRegisterOpenDateLabel}のオープン当日です。`,
            `オープンは${preRegisterOpenDateLabel}です。それまでガチャの購入・抽選はできません。`,
          ]}
        />}
      </PageContainer>
    </>
  );
}
