/** Fixed design samples only. This is neither an API shape nor an eligibility rule. */
export type FirstBuyLayoutState = "active" | "expired" | "unauthenticated";
export interface FirstBuyDeal {
  readonly product: { readonly id: string; readonly grant: { readonly total_points: number }; readonly price: { readonly amount: number } };
  readonly href?: string;
  readonly referencePrice: number;
  readonly saving: number;
  readonly ratePercent: number;
}
export type FirstBuyOffer = {
  readonly state: FirstBuyLayoutState;
  readonly maxRatePercent: number;
  readonly leadDeal: FirstBuyDeal;
  readonly deals: readonly FirstBuyDeal[];
  readonly clock: { readonly hours: string; readonly minutes: string; readonly seconds: string };
};
// Values transcribed from the canonical screenshots; no runtime discount calculation.
export const firstBuyLayoutDeals: readonly FirstBuyDeal[] = [
  { product: { id: "500", grant: { total_points: 500 }, price: { amount: 50 } }, referencePrice: 500, saving: 450, ratePercent: 90 },
  { product: { id: "1000", grant: { total_points: 1000 }, price: { amount: 200 } }, referencePrice: 1000, saving: 800, ratePercent: 80 },
  { product: { id: "5000", grant: { total_points: 5000 }, price: { amount: 3500 } }, referencePrice: 5000, saving: 1500, ratePercent: 30 },
  { product: { id: "10000", grant: { total_points: 10000 }, price: { amount: 8000 } }, referencePrice: 10000, saving: 2000, ratePercent: 20 },
  { product: { id: "30000", grant: { total_points: 30000 }, price: { amount: 27000 } }, referencePrice: 30000, saving: 3000, ratePercent: 10 },
  { product: { id: "50000", grant: { total_points: 50000 }, price: { amount: 45000 } }, referencePrice: 50000, saving: 5000, ratePercent: 10 },
  { product: { id: "100000", grant: { total_points: 100000 }, price: { amount: 90000 } }, referencePrice: 100000, saving: 10000, ratePercent: 10 },
];
export function readFirstBuyLayoutState(value: unknown, enabled = false): FirstBuyLayoutState | null {
  return enabled && (value === "active" || value === "expired" || value === "unauthenticated") ? value : null;
}
export function firstBuyLayoutOffer(state: FirstBuyLayoutState): FirstBuyOffer {
  return { state, maxRatePercent: 90, leadDeal: firstBuyLayoutDeals[0]!, deals: firstBuyLayoutDeals, clock: { hours: "23", minutes: "41", seconds: "12" } };
}
export function firstBuyLayoutHref(path: string, state: FirstBuyLayoutState) {
  return `${path}?first_buy=${state}`;
}
export function firstBuyLayoutDetailHref(id: string, state: FirstBuyLayoutState) {
  return firstBuyLayoutHref(`/design/first-buy/purchase/${encodeURIComponent(id)}`, state);
}
