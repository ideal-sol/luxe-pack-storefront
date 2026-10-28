import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PUBLIC_AUTH_FIXTURE } from "@oripa/storefront-testkit";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import { SESSION_ACCESS_REJECTED } from "@/lib/platform/browser-client";
import type { AuthClientAdapter, SmsVerificationStatus } from "@/lib/platform";

const factory = vi.hoisted(() => vi.fn());
vi.mock("@/lib/platform", async original => ({ ...await original<typeof import("@/lib/platform")>(), createBrowserAuthClient: factory }));
function View() {
  const { state, smsAccess, login } = useSession();
  return <><p>{state.status}</p><p>sms:{smsAccess}</p><button onClick={() => void login({ email: "fixture@example.test", password: "fixture-password" })}>login</button></>;
}
it("replaces the old CSRF-owning client after closure, ignores stale SMS and logs in through the fresh client", async () => {
  let finishSms!: (value: { data: SmsVerificationStatus }) => void;
  const old = { getCurrentSession: vi.fn().mockResolvedValue({ data: PUBLIC_AUTH_FIXTURE.authenticated_session }), getSmsVerificationStatus: vi.fn().mockReturnValue(new Promise(resolve => { finishSms = resolve; })), login: vi.fn() };
  const fresh = { getCurrentSession: vi.fn().mockResolvedValue({ data: PUBLIC_AUTH_FIXTURE.anonymous_session }), login: vi.fn().mockResolvedValue(undefined) };
  factory.mockReset().mockReturnValueOnce(old as unknown as AuthClientAdapter).mockReturnValue(fresh as unknown as AuthClientAdapter);
  render(<SessionProvider><View /></SessionProvider>);
  expect(await screen.findByText("authenticated")).toBeInTheDocument();
  await waitFor(() => expect(old.getSmsVerificationStatus).toHaveBeenCalledOnce());
  act(() => window.dispatchEvent(new CustomEvent(SESSION_ACCESS_REJECTED, { detail: "ACCOUNT_CLOSED" })));
  expect(await screen.findByText("unauthenticated")).toBeInTheDocument();
  expect(factory).toHaveBeenCalledTimes(2);
  expect(fresh.getCurrentSession).toHaveBeenCalledOnce();
  await act(async () => finishSms({ data: { verified: true } as SmsVerificationStatus }));
  expect(screen.getByText("sms:loading")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "login" }));
  await waitFor(() => expect(fresh.login).toHaveBeenCalledOnce());
  await waitFor(() => expect(fresh.getCurrentSession).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("unauthenticated")).toBeInTheDocument();
  expect(old.login).not.toHaveBeenCalled();
});
it("keeps ordinary expiry fail-closed without rebuilding the authenticated client", async () => {
  const client = { getCurrentSession: vi.fn().mockResolvedValue({ data: PUBLIC_AUTH_FIXTURE.anonymous_session }) };
  factory.mockReset().mockReturnValue(client);
  render(<SessionProvider><View /></SessionProvider>);
  await screen.findByText("unauthenticated");
  act(() => window.dispatchEvent(new CustomEvent(SESSION_ACCESS_REJECTED, { detail: "SESSION_EXPIRED" })));
  expect(screen.getByText("session-expired")).toBeInTheDocument();
  expect(factory).toHaveBeenCalledOnce();
});
