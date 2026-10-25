import { vi } from "vitest";
import { SHIPPING_POLICY_FIXTURES } from "@oripa/storefront-testkit";
import { createBrowserPrizeInventoryClient } from "@/lib/platform/prize-client";
import type { ShippingPolicyAccess, ShippingPolicySnapshot } from "@/lib/platform/shipping-policy";

// Variations of the official fixture; mutation error projection uses the real adapter.
const minimumRejection = createBrowserPrizeInventoryClient({
  baseUrl: "https://storefront.test/platform", defaultTimeoutMs: 1000, siteVersion: "0.1.0",
}).shippingPolicyAccess.minimumRejection;

export function policy(minimum = "5000", revision = 1): ShippingPolicySnapshot {
  return { ...SHIPPING_POLICY_FIXTURES.unrestricted, minimum_points: minimum, effective_required_points: minimum === "0" ? "1" : minimum, revision };
}

export function policyAccess(snapshot = policy("0")): ShippingPolicyAccess {
  return { load: vi.fn().mockResolvedValue(snapshot), minimumRejection: vi.fn(minimumRejection) };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
