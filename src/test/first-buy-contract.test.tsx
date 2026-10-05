import { act, cleanup, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_POINT_PRODUCT_FIXTURES } from "@oripa/storefront-testkit/fixtures";
import type { PointProduct, PointProductCollection } from "@/lib/platform";
import { firstBuyRemainingMilliseconds, presentFirstBuyDeal, presentFirstBuyOffer } from "@/lib/presentation/first-buy-offer";
import { FirstBuyBar, FirstBuyHero } from "@/components/points/first-buy-offer";
import { HomeFirstBuy } from "@/components/points/first-buy-home";
import { useFirstBuyCountdown, useFirstBuyOffer } from "@/components/points/use-first-buy-offer";

const connected = vi.hoisted(() => ({
  client: { listPointProducts: vi.fn() },
  state: { status: "authenticated", session: { user: { id: "synthetic-user" } } },
}));
vi.mock("@/components/auth/session-provider", () => ({ useSession: () => ({ state: connected.state }) }));
vi.mock("@/components/points/point-client-provider", () => ({ usePointClient: () => ({ client: connected.client }) }));

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); connected.client.listPointProducts.mockReset(); });

function product(id: string, price: number, total: number): PointProduct {
  return {
    ...PUBLIC_POINT_PRODUCT_FIXTURES.authenticated_eligible.data[1],
    id, price: { amount: price, currency: "JPY" },
    grant: { paid_points: price, bonus_points: total - price, total_points: total },
  };
}

function collection(): PointProductCollection {
  return {
    data: [product("cheapest", 50, 100), product("biggest-off", 100, 1000), product("equal-price", 50, 200)],
    first_user_offer: { state: "active", expires_at: "2026-10-06T00:00:00Z", as_of: "2026-10-05T23:59:58Z" },
  };
}

describe("first-user canonical product presentation", () => {
  it("derives regular price, saving and integer-floor rate", () => {
    expect(presentFirstBuyDeal(product("fraction", 100, 333))).toMatchObject({
      referencePrice: 333, saving: 233, ratePercent: 69,
    });
  });

  it("keeps the cheapest eligible lead separate from maximum OFF and preserves equal-price order", () => {
    const offer = presentFirstBuyOffer(collection())!;
    expect(offer.leadDeal.product.id).toBe("cheapest");
    expect(offer.leadDeal.ratePercent).toBe(50);
    expect(offer.maxRatePercent).toBe(90);
    render(<><FirstBuyHero offer={offer} /><FirstBuyBar offer={offer} /></>);
    expect(screen.getByRole("link", { name: "50円で100コインを受け取る" })).toHaveAttribute("href", "/points/purchase/cheapest");
    expect(screen.getByText("最大90%OFF")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(["期限を過ぎると", "通常価格に戻ります"].join(""));
  });

  it("never selects consumed or unavailable products for the lead", () => {
    const data = collection();
    data.data[0] = { ...data.data[0]!, eligible: false, ineligible_reason: "first_purchase_required", cta: { state: "disabled", action: "purchase", reason: "first_purchase_required" } };
    expect(presentFirstBuyOffer(data)?.leadDeal.product.id).toBe("equal-price");
  });

  it("retains displayed maximum OFF independently of a consumed product's eligibility", () => {
    const data = collection();
    data.data[1] = { ...data.data[1]!, eligible: false, cta: { state: "disabled", action: "purchase", reason: "first_purchase_required" } };
    const offer = presentFirstBuyOffer(data)!;
    expect(offer.leadDeal.product.id).toBe("cheapest");
    expect(offer.deals.map(deal => deal.product.id)).toEqual(["cheapest", "equal-price"]);
    expect(offer.maxRatePercent).toBe(90);
  });

  it("hides promotion when every first-user product is consumed or unavailable", () => {
    const data = collection();
    data.data = data.data.map(product => ({ ...product, eligible: false }));
    expect(presentFirstBuyOffer(data)).toBeNull();
    data.data = collection().data.map(product => ({ ...product, sale_state: "ended" }));
    expect(presentFirstBuyOffer(data)).toBeNull();
  });

  it("uses the same canonical lead in Hero and Popup and states the qualification and per-product limits", () => {
    render(<HomeFirstBuy offer={presentFirstBuyOffer(collection())!} showPopup />);
    const popup = screen.getByRole("dialog");
    expect(within(popup).getByRole("link", { name: "50円で100コインを受け取る" })).toHaveAttribute("href", "/points/purchase/cheapest");
    expect(popup).toHaveTextContent("初回メール認証完了から24時間");
    expect(popup).toHaveTextContent("各商品お一人さま1回かぎり");
    expect(popup).toHaveTextContent("50%OFF");
    expect(popup).not.toHaveTextContent("90%OFF");
    expect(popup).toHaveTextContent("通常 100円 → 50円");
    expect(document.body.textContent).not.toContain("会員登録から24時間");
  });

  it.each(["expired", "unavailable"] as const)("hides the offer and clock for Backend %s", state => {
    const data = collection();
    data.first_user_offer.state = state;
    expect(presentFirstBuyOffer(data)).toBeNull();
    expect(firstBuyRemainingMilliseconds(data)).toBe(0);
  });

  it("uses the Backend anonymous state for registration without a timer", () => {
    const offer = presentFirstBuyOffer(PUBLIC_POINT_PRODUCT_FIXTURES.anonymous)!;
    render(<FirstBuyHero offer={offer} />);
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "無料で会員登録する" })).toHaveAttribute("href", "/register");
  });

  it("counts monotonic elapsed time from expires_at minus as_of and refetches at zero without deciding expiry", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    const refresh = vi.fn();
    const data = collection();
    const { result, rerender } = renderHook(({ value }) => useFirstBuyCountdown(value, refresh), { initialProps: { value: data } });
    expect(result.current?.clock.seconds).toBe("02");
    vi.spyOn(Date, "now").mockReturnValue(0);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current?.clock.seconds).toBe("01");
    act(() => vi.advanceTimersByTime(1000));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current?.clock.seconds).toBe("00");
    expect(result.current?.state).toBe("active");
    act(() => vi.advanceTimersByTime(5000));
    expect(refresh).toHaveBeenCalledTimes(1);
    rerender({ value: { ...data, first_user_offer: { ...data.first_user_offer, state: "expired", as_of: "2026-10-06T00:00:05Z" } } });
    expect(result.current).toBeNull();
  });

  it("refetches through the Point Client and applies the returned expired state", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    const data = collection();
    connected.client.listPointProducts.mockResolvedValueOnce({ data })
      .mockResolvedValueOnce({ data: { ...data, first_user_offer: { ...data.first_user_offer, state: "expired" } } });
    const { result } = renderHook(() => useFirstBuyOffer());
    await act(async () => {});
    expect(result.current?.state).toBe("active");
    await act(async () => vi.advanceTimersByTime(2000));
    expect(connected.client.listPointProducts).toHaveBeenCalledTimes(2);
    expect(result.current).toBeNull();
  });
});
