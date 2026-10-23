import { PUBLIC_USER_PRIZE_FIXTURE, PUBLIC_SHIPPING_ONLY_PRIZE_FIXTURE } from "@oripa/storefront-testkit";
import type { UserPrize } from "@/lib/platform";
import { shippingRequirement, shippingShortfall, shippingTotal, validShippingMinimum } from "@/components/prizes/shipping-minimum";
import { policy } from "./fixtures/shipping-policy";

const prize: UserPrize = PUBLIC_USER_PRIZE_FIXTURE;

describe("shipping snapshot preview arithmetic", () => {
  it.each([
    [3000, "5000", 2000n], [5000, "5000", 0n], [7000, "5000", 0n],
    [0, "0", 1n], [0, "5000", 5000n],
  ])("calculates %s against configured %s without Number addition", (points, minimum, shortfall) => {
    expect(shippingShortfall(shippingTotal([{ ...prize, exchange_points: points }])!, shippingRequirement(policy(minimum))!)).toBe(shortfall);
  });

  it("combines zero, positive and shipping-only snapshots, excluding exchange-only and denied values", () => {
    const missing: UserPrize = { ...prize, exchange_points: 9000 };
    delete missing.allowed_actions;
    const denied: UserPrize = { ...prize, exchange_points: NaN, allowed_actions: {
      ...prize.allowed_actions!, shipping: { allowed: false, unavailable_reason: "payment_hold" },
    } };
    expect(shippingTotal([
      { ...prize, exchange_points: 0 }, { ...prize, exchange_points: 3000 },
      { ...PUBLIC_SHIPPING_ONLY_PRIZE_FIXTURE, exchange_points: 2000 }, denied,
      missing,
    ])).toBe(5000n);
  });

  it("preserves all digits for 100 maximum safe integer snapshots", () => {
    const prizes = Array.from({ length: 100 }, (_, index) => ({ ...prize, id: String(index), exchange_points: Number.MAX_SAFE_INTEGER }));
    expect(shippingTotal(prizes)).toBe(900719925474099100n);
    expect(shippingTotal(prizes)?.toLocaleString("ja-JP")).toBe("900,719,925,474,099,100");
    expect(shippingTotal([...prizes, prize])).toBeNull();
    expect(shippingRequirement(policy("9007199254740991"))).toBe(9007199254740991n);
  });

  it.each([NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, undefined, null, "5000"])("rejects an unsafe or missing snapshot: %s", (value) => {
    const malformed: UserPrize = JSON.parse(JSON.stringify({ ...prize, exchange_points: value }));
    expect(shippingTotal([malformed])).toBeNull();
  });

  it.each(["", "-1", "1.5", "01", " 1", "1e3", "9007199254740992", "999999999999999999999"])("rejects noncanonical policy decimals: %s", (value) => {
    expect(shippingRequirement(policy(value))).toBeNull();
  });

  it("rejects invalid effective requirements, revisions and zero-total permission", () => {
    expect(shippingRequirement({ ...policy(), effective_required_points: "0" })).toBeNull();
    expect(shippingRequirement({ ...policy(), effective_required_points: "4000" })).toBeNull();
    expect(shippingRequirement({ ...policy(), revision: Number.MAX_SAFE_INTEGER + 1 })).toBeNull();
    const malformed = JSON.parse(JSON.stringify({ ...policy(), zero_total_allowed: true }));
    expect(shippingRequirement(malformed)).toBeNull();
  });

  it("validates the safe server rejection before presenting any decimal", () => {
    const snapshot = { minimum_points: "5000", effective_required_points: "5000", selected_total_points: "3000", shortfall_points: "2000", setting_revision: 2 };
    expect(validShippingMinimum(snapshot)).toBe(true);
    expect(validShippingMinimum({ ...snapshot, shortfall_points: "1" })).toBe(false);
    expect(validShippingMinimum({ ...snapshot, selected_total_points: "unexpected detail" })).toBe(false);
    expect(validShippingMinimum({ ...snapshot, setting_revision: 0 })).toBe(false);
  });
});
