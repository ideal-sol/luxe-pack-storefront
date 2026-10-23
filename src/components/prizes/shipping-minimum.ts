import type { UserPrize } from "@/lib/platform";
import type { ShippingMinimumSnapshot, ShippingPolicySnapshot } from "@/lib/platform/shipping-policy";
import { actionablePrizes } from "./prize-actions";

const maxPrizePoints = BigInt(Number.MAX_SAFE_INTEGER);
const maxTotalPoints = maxPrizePoints * 100n;

export function shippingTotal(items: readonly UserPrize[]): bigint | null {
  const shipping = actionablePrizes(items, "shipping");
  if (shipping.length > 100) return null;
  let total = 0n;
  for (const item of shipping) {
    if (!Number.isSafeInteger(item.exchange_points) || item.exchange_points < 0) return null;
    total += BigInt(item.exchange_points);
  }
  return total;
}

function decimal(value: string, maximum: bigint): bigint | null {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,17})$/.test(value)) return null;
  const parsed = BigInt(value);
  return parsed <= maximum ? parsed : null;
}

export function shippingRequirement(policy: ShippingPolicySnapshot): bigint | null {
  const minimum = decimal(policy.minimum_points, maxPrizePoints);
  const required = decimal(policy.effective_required_points, maxPrizePoints);
  if (minimum === null || required === null || required < minimum || required === 0n
    || policy.zero_total_allowed !== false || !Number.isSafeInteger(policy.revision) || policy.revision < 1) return null;
  return required;
}

export function validShippingMinimum(snapshot: ShippingMinimumSnapshot): boolean {
  const required = shippingRequirement({ ...snapshot, revision: snapshot.setting_revision, zero_total_allowed: false });
  const total = decimal(snapshot.selected_total_points, maxTotalPoints);
  const shortfall = decimal(snapshot.shortfall_points, maxPrizePoints);
  return required !== null && total !== null && shortfall !== null && total < required && shortfall === required - total;
}

export function shippingShortfall(total: bigint, required: bigint): bigint {
  return total < required ? required - total : 0n;
}

export function shippingMinimumMessage(shortfall: bigint): string {
  return `発送条件を満たしていません。あと${shortfall.toLocaleString("ja-JP")}コイン分の景品が必要です。景品を追加してから発送してください。`;
}
