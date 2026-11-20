import { render } from "@testing-library/react";
import { PurchaseConversionRecovery } from "@/components/analytics/purchase-conversion-recovery";

const fixture = vi.hoisted(() => ({
  path: "/", state: { status: "authenticated", session: { user: { id: "10000000-0000-4000-8000-000000000001", email: null } } },
  recover: vi.fn().mockResolvedValue(undefined), client: { getPayment: vi.fn() },
}));
vi.mock("next/navigation", () => ({ usePathname: () => fixture.path }));
vi.mock("@/components/auth/session-provider", () => ({ useSession: () => ({ state: fixture.state }) }));
vi.mock("@/lib/platform", () => ({ createBrowserPaymentClient: () => fixture.client }));
vi.mock("@/lib/analytics/purchase-recovery", () => ({ recoverPurchases: fixture.recover }));

beforeEach(() => {
  fixture.path = "/"; fixture.state.status = "authenticated"; fixture.state.session.user.id = "10000000-0000-4000-8000-000000000001";
  fixture.recover.mockClear(); vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST0001");
});
afterEach(() => vi.unstubAllEnvs());

it("recovers once on direct access and never again for SPA navigation", () => {
  const view = render(<PurchaseConversionRecovery />); expect(fixture.recover).toHaveBeenCalledOnce();
  fixture.path = "/mypage/purchases"; view.rerender(<PurchaseConversionRecovery />); expect(fixture.recover).toHaveBeenCalledOnce();
});
it("waits for the first navigation away from thanks and authentication", () => {
  fixture.path = "/points/purchase/thanks"; fixture.state.status = "loading";
  const view = render(<PurchaseConversionRecovery />); expect(fixture.recover).not.toHaveBeenCalled();
  fixture.state = { ...fixture.state, status: "authenticated" }; view.rerender(<PurchaseConversionRecovery />); expect(fixture.recover).not.toHaveBeenCalled();
  fixture.path = "/mypage/purchases"; view.rerender(<PurchaseConversionRecovery />); expect(fixture.recover).toHaveBeenCalledOnce();
});
it.each(["logout", "switch"])("permanently invalidates the execution after %s", mode => {
  const view = render(<PurchaseConversionRecovery />);
  const isActive = fixture.recover.mock.calls[0]![3] as () => boolean; expect(isActive()).toBe(true);
  if (mode === "logout") fixture.state = { ...fixture.state, status: "unauthenticated" };
  else fixture.state = { ...fixture.state, session: { user: { ...fixture.state.session.user, id: "10000000-0000-4000-8000-000000000002" } } };
  view.rerender(<PurchaseConversionRecovery />); expect(isActive()).toBe(false);
  fixture.state = { status: "authenticated", session: { user: { id: "10000000-0000-4000-8000-000000000001", email: null } } };
  view.rerender(<PurchaseConversionRecovery />); expect(isActive()).toBe(false); expect(fixture.recover).toHaveBeenCalledOnce();
});
it("never invokes the client with GTM disabled", () => {
  vi.stubEnv("NEXT_PUBLIC_GTM_ID", ""); render(<PurchaseConversionRecovery />); expect(fixture.recover).not.toHaveBeenCalled();
});
