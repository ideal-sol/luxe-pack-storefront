import type { PointProduct, PointProductCollection } from "@/lib/platform";
import { pointPurchaseDetailRoute } from "@/lib/routes/navigation";
import type { FirstBuyDeal, FirstBuyOffer } from "./first-buy-layout";

export function firstBuyRemainingMilliseconds(collection: PointProductCollection): number {
  const offer = collection.first_user_offer;
  return offer?.state === "active" && offer.expires_at
    ? Math.max(0, Date.parse(offer.expires_at) - Date.parse(offer.as_of))
    : 0;
}

export function firstBuyClock(milliseconds: number) {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  return {
    hours: String(Math.floor(total / 3600)).padStart(2, "0"),
    minutes: String(Math.floor(total / 60) % 60).padStart(2, "0"),
    seconds: String(total % 60).padStart(2, "0"),
  };
}

export function presentFirstBuyOffer(collection: PointProductCollection, remaining = firstBuyRemainingMilliseconds(collection)): FirstBuyOffer | null {
  const state = collection.first_user_offer?.state;
  if (state !== "active" && state !== "unauthenticated") return null;
  const displayedProducts = collection.data.filter(product =>
    product.audience.code === "first_purchase_users"
    && product.sale_state === "available");
  const products = displayedProducts.filter(product =>
    state === "unauthenticated" ? product.cta.action === "login" : product.eligible && product.cta.state === "enabled" && product.cta.action === "purchase");
  const deals = products.map(presentFirstBuyDeal);
  const leadDeal = deals.reduce<FirstBuyDeal | undefined>((lead, deal) =>
    !lead || deal.product.price.amount < lead.product.price.amount ? deal : lead, undefined);
  if (!leadDeal) return null;
  return { state, leadDeal, maxRatePercent: Math.max(...displayedProducts.map(product => presentFirstBuyDeal(product).ratePercent)), deals, clock: firstBuyClock(remaining) };
}

export function presentFirstBuyDeal(product: PointProduct): FirstBuyDeal {
  return {
    product,
    referencePrice: product.grant.total_points,
    saving: product.grant.bonus_points,
    ratePercent: product.grant.total_points > 0
      ? Number(BigInt(product.grant.total_points - product.price.amount) * 100n / BigInt(product.grant.total_points))
      : 0,
    href: pointPurchaseDetailRoute(product.id),
  };
}
