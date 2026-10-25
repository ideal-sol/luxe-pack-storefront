import type { PublicComponents } from "@oripa/storefront-client";

type Schemas = PublicComponents["schemas"];

export type ShippingPolicySnapshot = Schemas["ShippingPolicy"];
export type ShippingMinimumSnapshot = Pick<Schemas["ShippingMinimumPointsProblem"],
  "minimum_points" | "effective_required_points" | "selected_total_points" | "shortfall_points" | "setting_revision">;

export interface ShippingPolicyAccess {
  readonly load: (signal: AbortSignal) => Promise<ShippingPolicySnapshot>;
  /** Only typed, safe Server fields; never raw detail. */
  readonly minimumRejection: (error: unknown) => ShippingMinimumSnapshot | null;
}
