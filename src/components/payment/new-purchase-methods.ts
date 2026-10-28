import type { PaymentMethodOption } from "@/lib/platform/payment-ui-gateway";

/** New purchase presentation/selection only. Historical payments retain all providers. */
export function newPurchaseMethods(options: readonly PaymentMethodOption[]): PaymentMethodOption[] {
  return options.filter(option => !["paidy", "netridecash"].includes(option.method));
}
