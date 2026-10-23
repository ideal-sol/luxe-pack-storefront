/** UI port only. Wire to the canonical Client after formal alpha.46 publication. */
export interface ShippingPolicySnapshot {
  readonly minimum_points: string;
  readonly effective_required_points: string;
  readonly revision: number;
  readonly zero_total_allowed: false;
}

export interface ShippingMinimumSnapshot {
  readonly minimum_points: string;
  readonly effective_required_points: string;
  readonly selected_total_points: string;
  readonly shortfall_points: string;
  readonly setting_revision: number;
}

export interface ShippingPolicyAccess {
  readonly load: (signal: AbortSignal) => Promise<ShippingPolicySnapshot>;
  /** Future adapter must use isShippingMinimumPointsProblemError, never raw detail. */
  readonly minimumRejection: (error: unknown) => ShippingMinimumSnapshot | null;
}
