import { PUBLIC_ACCOUNT_CLOSURE_FIXTURES, PUBLIC_AUTH_FIXTURE, PUBLIC_CONTRACT_FIXTURE, assertBrowserRequestBoundary } from "@oripa/storefront-testkit";
import { createMockFetch } from "@oripa/storefront-testkit/mock";
import { createBrowserAccountClosureClient } from "@/lib/platform/account-closure-client";

const origin = "https://storefront.test/platform";
const csrf = "a".repeat(64);
const key = "00000000-0000-4000-8000-000000000048";
function harness() {
  const mock = createMockFetch();
  const client = createBrowserAccountClosureClient({ baseUrl: origin, defaultTimeoutMs: 1000, siteVersion: "0.1.0" }, { cookie_reader: () => csrf, fetch: mock.fetch });
  const initialize = () => mock.enqueueJson({ method: "GET", url: origin + "/auth/session" }, { body: PUBLIC_AUTH_FIXTURE.authenticated_session });
  return { mock, client, initialize };
}
function problem(code: string, status: number, extra = {}) {
  return { code, status, type: "https://storefront.test/problems/closure", title: "Request rejected", request_id: "synthetic-closure", retryable: false, ...extra };
}
it("publishes all closure operations in the immutable 93-operation contract", () => {
  expect(PUBLIC_CONTRACT_FIXTURE.operation_count).toBe(93);
  expect(PUBLIC_CONTRACT_FIXTURE.operation_ids).toEqual(expect.arrayContaining(["getAccountClosurePreview", "sendAccountClosureEmailCode", "closeAccount"]));
});
it.each(Object.entries(PUBLIC_ACCOUNT_CLOSURE_FIXTURES))("projects the formal %s fixture with no extra requests", async (_, fixture) => {
  const h = harness(); h.mock.enqueueJson({ method: "GET", url: origin + "/me/account-closure" }, { body: fixture });
  await expect(h.client.load()).resolves.toEqual({ pointBalance: fixture.data.point_balance, unclaimedPrizeCount: fixture.data.unclaimed_prize_count, shippingInProgressCount: fixture.data.shipping_in_progress_count,
    canClose: fixture.data.can_close, verificationMethod: fixture.data.verification_method, maskedEmail: fixture.data.masked_email ?? "" });
  assertBrowserRequestBoundary(h.mock.requests[0]!, { client_version: "2.0.0-alpha.48", site_version: "0.1.0" });
  h.mock.assertExhausted();
});
it.each([
  { ...PUBLIC_ACCOUNT_CLOSURE_FIXTURES.password.data, point_balance: -1 },
  { ...PUBLIC_ACCOUNT_CLOSURE_FIXTURES.password.data, point_balance: "12500" },
  { ...PUBLIC_ACCOUNT_CLOSURE_FIXTURES.password.data, can_close: false, blocked_reason: "unknown" },
  { ...PUBLIC_ACCOUNT_CLOSURE_FIXTURES.email_code.data, masked_email: null },
  { ...PUBLIC_ACCOUNT_CLOSURE_FIXTURES.password.data, verification_method: "unknown" },
])("rejects unknown/malformed preview %j", async data => {
  const h = harness(); h.mock.enqueueJson({ method: "GET", url: origin + "/me/account-closure" }, { body: { data } });
  await expect(h.client.load()).rejects.toMatchObject({ kind: "retry" });
});
it("uses canonical CSRF-managed OTP with actual server resend and expiry values", async () => {
  const h = harness(); h.initialize(); const now = Date.now();
  h.mock.enqueueJson({ method: "POST", url: origin + "/me/account-closure/email-code" },
    { body: { data: { masked_email: "t***@example.test", expires_at: new Date(now + 600000).toISOString(), resend_available_at: new Date(now + 60000).toISOString() } } });
  await expect(h.client.sendCode()).resolves.toEqual({ maskedEmail: "t***@example.test", expiresInMinutes: 10, resendAvailableAt: now + 60000 });
  expect(h.mock.requests).toHaveLength(2);
  assertBrowserRequestBoundary(h.mock.requests[1]!, { client_version: "2.0.0-alpha.48", site_version: "0.1.0" });
  expect(h.mock.requests[1]!.headers["x-xsrf-token"]).toBe(csrf);
  h.mock.assertExhausted();
});
it.each(["password", "email_code"])("posts only approved %s verification, preview values and a stable key", async method => {
  const h = harness(); h.initialize();
  h.mock.enqueueJson({ method: "POST", url: origin + "/me/account-closure" }, { body: { data: { closed_at: "2026-10-28T00:00:00Z" } } });
  await h.client.confirm({ confirmed: true, expectedPointBalance: 12500, expectedUnclaimedPrizeCount: 3, operationKey: key,
    ...(method === "password" ? { password: "fixture-password" } : { emailCode: "123456" }) });
  const request = h.mock.requests[1]!;
  expect(JSON.parse(request.body!)).toEqual({ confirmed: true, expected_point_balance: 12500, expected_unclaimed_prize_count: 3,
    ...(method === "password" ? { password: "fixture-password" } : { email_code: "123456" }) });
  expect(request.headers["x-xsrf-token"]).toBe(csrf);
  expect(request.headers["idempotency-key"]).toBe(key);
  assertBrowserRequestBoundary(request, { client_version: "2.0.0-alpha.48", site_version: "0.1.0" });
  h.mock.assertExhausted();
});
it.each([
  ["INVALID_PASSWORD", 422, "password"], ["INVALID_EMAIL_CODE", 422, "email_code"],
  ["ACCOUNT_CLOSURE_STALE", 409, "stale"], ["ACCOUNT_CLOSURE_BLOCKED", 409, "blocked"],
  ["ACCOUNT_CLOSURE_VERIFICATION_REQUIRED", 403, "verification"], ["SESSION_EXPIRED", 401, "session"],
  ["AUTHENTICATION_REQUIRED", 401, "session"], ["UNKNOWN", 403, "retry"], ["RATE_LIMITED", 429, "retry"],
  ["toString", 403, "retry"], ["constructor", 403, "retry"],
] as const)("maps formal %s safely without leaking problem details", async (code, status, kind) => {
  const h = harness(); h.initialize();
  h.mock.enqueueProblem({ method: "POST", url: origin + "/me/account-closure" }, problem(code, status, { detail: "private detail" }));
  await expect(h.client.confirm({ confirmed: true, expectedPointBalance: 12500, expectedUnclaimedPrizeCount: 3, password: "fixture-password", operationKey: key })).rejects.toMatchObject({ kind, message: kind });
  expect(h.mock.requests).toHaveLength(2); h.mock.assertExhausted();
});
it("honors RATE_LIMITED retry timing without automatically repeating the mutation", async () => {
  const h = harness(); h.initialize(); const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  h.mock.enqueueProblem({ method: "POST", url: origin + "/me/account-closure/email-code" }, problem("RATE_LIMITED", 429, { retry_after_seconds: 30 }));
  try { await expect(h.client.sendCode()).rejects.toMatchObject({ kind: "retry", retryAt: now + 30000 }); }
  finally { clock.mockRestore(); }
  expect(h.mock.requests).toHaveLength(2);
});
it.each([{ data: {} }, { data: { closed_at: "invalid" } }, null])("does not turn malformed completion %j into success", async body => {
  const h = harness(); h.initialize();
  h.mock.enqueueJson({ method: "POST", url: origin + "/me/account-closure" }, { body });
  await expect(h.client.confirm({ confirmed: true, expectedPointBalance: 12500, expectedUnclaimedPrizeCount: 3, password: "fixture-password", operationKey: key })).rejects.toMatchObject({ kind: "retry" });
});
it("does not replay uncertain transport failure and permits caller reuse of the same operation key", async () => {
  const mock = createMockFetch();
  let starts = 0;
  const fetcher: typeof fetch = async (url, init) => {
    if (init?.method === "POST") { starts++; throw new TypeError("private network detail"); }
    return mock.fetch(url, init);
  };
  mock.enqueueJson({ method: "GET", url: origin + "/auth/session" }, { body: PUBLIC_AUTH_FIXTURE.authenticated_session });
  const client = createBrowserAccountClosureClient({ baseUrl: origin, defaultTimeoutMs: 1000, siteVersion: "0.1.0" }, { cookie_reader: () => csrf, fetch: fetcher });
  await expect(client.confirm({ confirmed: true, expectedPointBalance: 12500, expectedUnclaimedPrizeCount: 3, password: "fixture-password", operationKey: key })).rejects.toMatchObject({ kind: "retry" });
  expect(starts).toBe(1);
});
