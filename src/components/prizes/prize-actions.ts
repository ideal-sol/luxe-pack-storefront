import type { UserPrize } from "@/lib/platform";

export type FulfillmentAction = "point_exchange" | "shipping";

export function actionablePrizes(items: readonly UserPrize[], action: FulfillmentAction): readonly UserPrize[] {
  return items.filter((item) => item.allowed_actions?.[action].allowed === true);
}
