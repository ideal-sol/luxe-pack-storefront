import type { UserPrize } from "@/lib/platform";

export type FulfillmentAction = "point_exchange" | "shipping";

export function actionablePrizes(items: readonly UserPrize[], action: FulfillmentAction): readonly UserPrize[] {
  return items.filter((item) => item.allowed_actions?.[action].allowed === true);
}

/** UI input only: connect to the formal generated field after Artifact adoption. */
export type ExchangeOnlyClassification = (prize: UserPrize) => boolean;
export const noExchangeOnlyClassification: ExchangeOnlyClassification = () => false;

export interface FulfillmentCompletion {
  readonly action: FulfillmentAction;
  readonly processedIds: readonly string[];
  readonly retainedIds: readonly string[];
}

export function retainedSelection(items: readonly UserPrize[], ids: readonly string[]): ReadonlySet<string> {
  const requested = new Set(ids);
  return new Set(items.filter((item) => requested.has(item.id)
    && item.allowed_actions?.selection.allowed === true
    && item.allowed_actions.point_exchange.allowed === true
    && item.allowed_actions.shipping.allowed === false).map((item) => item.id));
}
