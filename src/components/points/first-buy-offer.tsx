"use client";

import Link from "next/link";
import {
  type FirstBuyDeal,
  type FirstBuyOffer,
} from "@/lib/presentation/first-buy-layout";
import { firstBuyLayoutDetailHref, firstBuyLayoutHref } from "@/lib/presentation/first-buy-layout";



type ActiveOffer = FirstBuyOffer;

export const firstBuyRegionLabel = "初回メール認証完了から24時間限定のコイン割引";

const number = new Intl.NumberFormat("ja-JP");
const yen = new Intl.NumberFormat("ja-JP", { currency: "JPY", style: "currency" });

function presentationClock(offer: FirstBuyOffer) {
  return { ...offer.clock, urgent: false };
}

function clockLabel(clock: { readonly hours: string; readonly minutes: string; readonly seconds: string }) {
  return `残り ${clock.hours}時間${clock.minutes}分${clock.seconds}秒`;
}


export function FirstBuyBar({ offer }: { readonly offer: FirstBuyOffer }) {
  return offer.state === "active" ? <FirstBuyBarContent offer={offer} /> : null;
}

function FirstBuyBarContent({ offer }: { readonly offer: ActiveOffer }) {
  const clock = presentationClock(offer);
  return (
    <div className={clock.urgent ? "fb-bar is-urgent" : "fb-bar"}>
      <div className="fb-bar__inner">
        <span className="fb-bar__tag">初回メール認証完了から24時間限定</span>
        <span className="fb-bar__lead">コイン購入が<b>最大{offer.maxRatePercent}%OFF</b></span>
        <span aria-label={clockLabel(clock)} className="fb-bar__clock" role="timer">
          <span aria-hidden="true">残り</span>
          <b aria-hidden="true">{clock.hours}</b><i aria-hidden="true">:</i>
          <b aria-hidden="true">{clock.minutes}</b><i aria-hidden="true">:</i>
          <b aria-hidden="true">{clock.seconds}</b>
        </span>
        <Link className="fb-bar__cta" href={offer.leadDeal.href ? "/points" : firstBuyLayoutHref("/points", offer.state)}>コインを見る</Link>
      </div>
    </div>
  );
}

function HeroMessage({ lead, title }: { readonly lead: FirstBuyDeal; readonly title: string }) {
  return (
    <div className="fb-card__msg">
      <h2 className="fb-card__title">{title}</h2>
      <p className="fb-off-row">
        <span className="fb-off-cap">この商品は</span>
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
  const lead = offer.leadDeal;
  return (
    <div className={clock.urgent ? "fb-card is-urgent" : "fb-card"}>
      <div className="fb-card__ribbon"><span>はじめての方だけ</span>初回メール認証完了から24時間だけのコイン割引</div>
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
      <p className="fb-note">各商品お一人さま1回かぎり／表示はすべて税込／期限後は購入できません</p>
    </div>
  );
}


export function GuestHeroCard({ lead }: { readonly lead: FirstBuyDeal }) {
  return (
    <div className="fb-card fb-card--guest">
      <div className="fb-card__ribbon"><span>はじめての方へ</span>初回メール認証完了から24時間だけのコイン割引</div>
      <div className="fb-card__body">
        <HeroMessage lead={lead} title="はじめの24時間は、コイン購入が" />
        <div className="fb-card__act">
          <Link className="fb-cta" href="/register">無料で会員登録する</Link>
        </div>
      </div>
      <p className="fb-note">初回メール認証完了から24時間／各商品お一人さま1回かぎり／表示はすべて税込</p>
    </div>
  );
}


export function FirstBuyHero({
  offer,
  placement = "inpage",
}: {
  readonly offer: FirstBuyOffer;
  readonly placement?: "inpage" | "home";
}) {
  if (offer.state === "expired") return null;
  const card = offer.state === "active"
    ? <FirstBuyActiveCard ctaHref={offer.leadDeal.href ?? (placement === "home" ? firstBuyLayoutHref("/points", offer.state) : firstBuyLayoutDetailHref(offer.leadDeal.product.id, offer.state))} offer={offer} />
    : <GuestHeroCard lead={offer.leadDeal} />;
  if (placement === "home") {
    return (
      <section aria-label={firstBuyRegionLabel} className="fb-hero">
        <div className="page-container">{card}</div>
      </section>
    );
  }
  return <section aria-label={firstBuyRegionLabel} className="fb-hero fb-hero--inpage">{card}</section>;
}


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


export function FirstBuyCoinCard({ deal }: { readonly deal: FirstBuyDeal }) {
  const { product } = deal;
  return (
    <article className="fb-coin">
      <div className="fb-coin__save">{number.format(deal.saving)}<small>円おトク</small></div>
      <div className="fb-coin__body">
        <p className="fb-coin__get"><b>{number.format(product.grant.total_points)}</b>コイン</p>
        <p className="fb-coin__was">通常 <s>{yen.format(deal.referencePrice)}</s>／24時間限定</p>
        <Link className="fb-coin__btn" href={deal.href ?? firstBuyLayoutDetailHref(product.id, "active")}>
          <b>{yen.format(product.price.amount)}</b><span>で購入</span>
        </Link>
        <p className="fb-coin__note">各商品お一人さま1回かぎり／税込</p>
      </div>
    </article>
  );
}
