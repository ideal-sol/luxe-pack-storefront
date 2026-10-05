"use client";

import Link from "next/link";
import {
  type FirstBuyDeal,
  type FirstBuyOffer,
} from "@/lib/presentation/first-buy-layout";
import { firstBuyLayoutDetailHref, firstBuyLayoutHref } from "@/lib/presentation/first-buy-layout";

/*
 * 固定fixtureによる新規登録から24時間限定のコイン割引（デザイン 2026-10-02「オリポケ_24h割引デザイン」）。
 * 表示のみの部品。今回の状態と時計は固定presentation値。Platform接続・eligibility判定は実装しない。
 * 文言はデザインの指定どおり。クラスはすべて fb- で始まり、既存のクラスは上書きしない。
 */

type ActiveOffer = FirstBuyOffer;

export const firstBuyRegionLabel = "新規登録から24時間限定のコイン割引";

const number = new Intl.NumberFormat("ja-JP");
const yen = new Intl.NumberFormat("ja-JP", { currency: "JPY", style: "currency" });

// Deliberately fixed. No timer, deadline, clock offset, or state transition.
function presentationClock(offer: FirstBuyOffer) {
  return { ...offer.clock, urgent: false };
}

function clockLabel(clock: { readonly hours: string; readonly minutes: string; readonly seconds: string }) {
  return `残り ${clock.hours}時間${clock.minutes}分${clock.seconds}秒`;
}

/** ① 固定帯。site-header の中のいちばん上に置く（ヘッダーと一緒に追従する）。 */
export function FirstBuyBar({ offer }: { readonly offer: FirstBuyOffer }) {
  return offer.state === "active" ? <FirstBuyBarContent offer={offer} /> : null;
}

function FirstBuyBarContent({ offer }: { readonly offer: ActiveOffer }) {
  const clock = presentationClock(offer);
  return (
    <div className={clock.urgent ? "fb-bar is-urgent" : "fb-bar"}>
      <div className="fb-bar__inner">
        <span className="fb-bar__tag">新規登録から24時間限定</span>
        <span className="fb-bar__lead">コイン購入が<b>最大{offer.lead.ratePercent}%OFF</b></span>
        <span aria-label={clockLabel(clock)} className="fb-bar__clock" role="timer">
          <span aria-hidden="true">残り</span>
          <b aria-hidden="true">{clock.hours}</b><i aria-hidden="true">:</i>
          <b aria-hidden="true">{clock.minutes}</b><i aria-hidden="true">:</i>
          <b aria-hidden="true">{clock.seconds}</b>
        </span>
        <Link className="fb-bar__cta" href={firstBuyLayoutHref("/points", offer.state)}>コインを見る</Link>
      </div>
    </div>
  );
}

function HeroMessage({ lead, title }: { readonly lead: FirstBuyDeal; readonly title: string }) {
  return (
    <div className="fb-card__msg">
      <h2 className="fb-card__title">{title}</h2>
      <p className="fb-off-row">
        <span className="fb-off-cap">最大</span>
        <span className="fb-off">{lead.ratePercent}%<small>OFF</small></span>
      </p>
      <p className="fb-card__sub">
        {number.format(lead.product.grant.total_points)}コインが <s>通常 {number.format(lead.referencePrice)}円</s> → <b>{number.format(lead.product.price.amount)}円</b>
      </p>
    </div>
  );
}

export function FirstBuyActiveCard({
  ctaHref,
  offer,
  onCtaClick,
}: {
  readonly ctaHref: string;
  readonly offer: ActiveOffer;
  readonly onCtaClick?: () => void;
}) {
  const clock = presentationClock(offer);
  const { lead } = offer;
  return (
    <div className={clock.urgent ? "fb-card is-urgent" : "fb-card"}>
      <div className="fb-card__ribbon"><span>はじめての方だけ</span>会員登録から24時間だけのコイン割引</div>
      <div className="fb-card__body">
        <HeroMessage lead={lead} title="いまだけ、コイン購入が" />
        <div className="fb-card__act">
          <div aria-label={clockLabel(clock)} className="fb-clock" role="timer">
            <span aria-hidden="true" className="fb-clock__label">残り</span>
            <div aria-hidden="true" className="fb-clock__unit"><span className="fb-clock__num">{clock.hours}</span><span className="fb-clock__cap">時間</span></div>
            <div aria-hidden="true" className="fb-clock__unit"><span className="fb-clock__num">{clock.minutes}</span><span className="fb-clock__cap">分</span></div>
            <div aria-hidden="true" className="fb-clock__unit"><span className="fb-clock__num">{clock.seconds}</span><span className="fb-clock__cap">秒</span></div>
          </div>
          <Link className="fb-cta" href={ctaHref} {...(onCtaClick ? { onClick: onCtaClick } : {})}>
            {number.format(lead.product.price.amount)}円で{number.format(lead.product.grant.total_points)}コインを受け取る
          </Link>
        </div>
      </div>
      <p className="fb-note">お一人さま1回かぎり／表示はすべて税込／期限を過ぎると通常価格に戻ります</p>
    </div>
  );
}

/** 未ログインの固定presentation。時計は出さず、会員登録へ送る。 */
export function GuestHeroCard({ lead }: { readonly lead: FirstBuyDeal }) {
  return (
    <div className="fb-card fb-card--guest">
      <div className="fb-card__ribbon"><span>はじめての方へ</span>会員登録から24時間だけのコイン割引</div>
      <div className="fb-card__body">
        <HeroMessage lead={lead} title="はじめの24時間は、コイン購入が" />
        <div className="fb-card__act">
          <Link className="fb-cta" href="/register">無料で会員登録する</Link>
        </div>
      </div>
      <p className="fb-note">メール認証が終わった時点から24時間／お一人さま1回かぎり／表示はすべて税込</p>
    </div>
  );
}

/**
 * ② 大枠。
 * - inpage：コイン購入ページ。残高カードの下に置き、左右を残高カードにそろえる。
 *   ボタンは、割引率がいちばん高い商品の購入画面へ進む。
 * - home：トップ。ヒーローの直下（注目の企画の前）に置く。ボタンはコイン購入ページへ進む。
 */
export function FirstBuyHero({
  offer,
  placement = "inpage",
}: {
  readonly offer: FirstBuyOffer;
  readonly placement?: "inpage" | "home";
}) {
  if (offer.state === "expired") return null;
  const card = offer.state === "active"
    ? <FirstBuyActiveCard ctaHref={placement === "home" ? firstBuyLayoutHref("/points", offer.state) : firstBuyLayoutDetailHref(offer.lead.product.id, offer.state)} offer={offer} />
    : <GuestHeroCard lead={offer.lead} />;
  if (placement === "home") {
    return (
      <section aria-label={firstBuyRegionLabel} className="fb-hero">
        <div className="page-container">{card}</div>
      </section>
    );
  }
  return <section aria-label={firstBuyRegionLabel} className="fb-hero fb-hero--inpage">{card}</section>;
}

/** ③-2 一覧のすぐ上の細い時計。大枠が画面から流れたあとも残り時間が目に入るようにする。 */
export function FirstBuyStrip({ offer }: { readonly offer: ActiveOffer }) {
  const clock = presentationClock(offer);
  return (
    <div aria-label={`この値段で買えるのは${clockLabel(clock)}まで`} className={clock.urgent ? "fb-strip is-urgent" : "fb-strip"} role="timer">
      <span aria-hidden="true">この値段で買えるのは</span>
      <span aria-hidden="true" className="fb-strip__clock">
        <b>{clock.hours}</b><i>:</i><b>{clock.minutes}</b><i>:</i><b>{clock.seconds}</b>
      </span>
      <span aria-hidden="true">まで</span>
    </div>
  );
}

/** ③ コイン商品カード。割引率ではなく、おトク額を円で出す。払う額はボタンの中。 */
export function FirstBuyCoinCard({ deal }: { readonly deal: FirstBuyDeal }) {
  const { product } = deal;
  return (
    <article className="fb-coin">
      <div className="fb-coin__save">{number.format(deal.saving)}<small>円おトク</small></div>
      <div className="fb-coin__body">
        <p className="fb-coin__get"><b>{number.format(product.grant.total_points)}</b>コイン</p>
        <p className="fb-coin__was">通常 <s>{yen.format(deal.referencePrice)}</s>／24時間限定</p>
        <Link className="fb-coin__btn" href={firstBuyLayoutDetailHref(product.id, "active")}>
          <b>{yen.format(product.price.amount)}</b><span>で購入</span>
        </Link>
        <p className="fb-coin__note">お一人さま1回かぎり／税込</p>
      </div>
    </article>
  );
}
