import { vi } from "vitest";
import type { ShippingPolicyAccess, ShippingPolicySnapshot } from "@/lib/platform/shipping-policy";

// Local UI fixtures, not published alpha.46 Testkit/Contract evidence.
export function policy(minimum = "5000", revision = 1): ShippingPolicySnapshot {
  return { minimum_points: minimum, effective_required_points: minimum === "0" ? "1" : minimum, revision, zero_total_allowed: false };
}

export function policyAccess(snapshot = policy("0")): ShippingPolicyAccess {
  return { load: vi.fn().mockResolvedValue(snapshot), minimumRejection: vi.fn().mockReturnValue(null) };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
