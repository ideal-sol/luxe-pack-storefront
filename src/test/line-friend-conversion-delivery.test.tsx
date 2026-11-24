import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { vi, expect, it, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { state: { status: "anonymous" } as Record<string, unknown>, smsAccess: "unknown" },
  api: { pending: vi.fn(), claim: vi.fn(), delivered: vi.fn() },
  factory: vi.fn(),
}));
vi.mock("@/components/auth/session-provider", () => ({ useSession: () => mocks.session }));
vi.mock("@/lib/platform/conversion-client", () => ({ createBrowserConversionClient: mocks.factory }));

const user = { id: "00000000-0000-4000-8000-000000000001", email: "member@example.test" };
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST0001");
  mocks.session = { state: { status: "anonymous" }, smsAccess: "unknown" };
  mocks.api.pending.mockResolvedValue([]); mocks.factory.mockReturnValue(mocks.api);
});
afterEach(() => vi.unstubAllEnvs());

it("mounts under SessionProvider while retaining purchase recovery", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const body = layout.split("<SessionProvider>")[1]?.split("</SessionProvider>")[0];
  expect(body).toContain("<LineFriendConversionDelivery />");
  expect(body).toContain("<PurchaseConversionRecovery />");
});

it("waits for GTM/auth/SMS, then uses the official adapter once across StrictMode and remount", async () => {
  const { LineFriendConversionDelivery } = await import("@/components/analytics/line-friend-conversion-delivery");
  const view = render(<StrictMode><LineFriendConversionDelivery /></StrictMode>);
  expect(mocks.factory).not.toHaveBeenCalled();
  mocks.session.state = { status: "authenticated", session: { user } };
  view.rerender(<StrictMode><LineFriendConversionDelivery /></StrictMode>);
  expect(mocks.factory).not.toHaveBeenCalled();
  mocks.session.smsAccess = "verified"; vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
  view.rerender(<StrictMode><LineFriendConversionDelivery /></StrictMode>);
  expect(mocks.factory).not.toHaveBeenCalled();
  vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST0001");
  mocks.session.state = { status: "authenticated", session: { user: { ...user } } };
  view.rerender(<StrictMode><LineFriendConversionDelivery /></StrictMode>);
  await waitFor(() => expect(mocks.api.pending).toHaveBeenCalledTimes(1));
  expect(mocks.factory).toHaveBeenCalled();
  view.unmount(); render(<StrictMode><LineFriendConversionDelivery /></StrictMode>);
  expect(mocks.api.pending).toHaveBeenCalledTimes(1);
});

it.each(["anonymous", "different-user"])("invalidates outstanding work on %s before processing a pending record", async condition => {
  let finish!: (records: unknown[]) => void;
  mocks.api.pending.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  mocks.session = { state: { status: "authenticated", session: { user } }, smsAccess: "verified" };
  const { LineFriendConversionDelivery } = await import("@/components/analytics/line-friend-conversion-delivery");
  const view = render(<LineFriendConversionDelivery />);
  await waitFor(() => expect(mocks.api.pending).toHaveBeenCalledTimes(1));
  mocks.session.state = condition === "anonymous" ? { status: "anonymous" }
    : { status: "authenticated", session: { user: { ...user, id: "00000000-0000-4000-8000-000000000099" } } };
  view.rerender(<LineFriendConversionDelivery />);
  finish([{ id: "00000000-0000-4000-8000-000000000002", event: "line_friend_added" }]);
  await new Promise(resolve => setTimeout(resolve, 5));
  expect(mocks.api.claim).not.toHaveBeenCalled(); expect(mocks.api.delivered).not.toHaveBeenCalled();
});
