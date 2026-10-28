import { assertBrowserRequestBoundary, PUBLIC_AUTH_FIXTURE, PUBLIC_PRE_REGISTRATION_FIXTURES } from "@oripa/storefront-testkit";
import { createAuthClientTestHarness } from "@/lib/platform/testing";

const origin = "https://storefront.test/platform";
const csrf = "a".repeat(64);
const input = { full_name: "登録テスト", birth_date: "2000-01-01", email: "fixture@example.test", password: "fixture-password" };

it("uses alpha.46 preRegister with canonical CSRF and no invented request flags or redirect", async () => {
  const harness = createAuthClientTestHarness(csrf);
  harness.mock.enqueueJson({ method: "GET", url: origin + "/auth/session" }, { body: PUBLIC_AUTH_FIXTURE.anonymous_session, status: 200 });
  harness.mock.enqueueJson({ method: "POST", url: origin + "/auth/pre-register" }, { body: PUBLIC_AUTH_FIXTURE.pending_registration, status: 202 });
  await expect(harness.client.preRegister(input)).resolves.toMatchObject({ data: PUBLIC_AUTH_FIXTURE.pending_registration });
  expect(JSON.parse(harness.mock.requests[1]!.body!)).toEqual(input);
  assertBrowserRequestBoundary(harness.mock.requests[1]!, { client_version: "2.0.0-alpha.48", site_version: "0.1.0" });
  harness.mock.assertExhausted();
});

it.each(["not_started", "accepting", "closed"])("reads the nested campaign response for %s", async (status) => {
  const harness = createAuthClientTestHarness();
  const campaign = { is_enabled: status === "accepting", cutoff_at: null, point_amount: 500, point_type: "free", status };
  harness.mock.enqueueJson({ method: "GET", url: origin + "/campaigns/pre-registration" }, { body: { data: campaign }, status: 200 });
  await expect(harness.client.getPreRegistrationCampaign()).resolves.toMatchObject({ data: { data: campaign } });
  harness.mock.assertExhausted();
});

it.each(Object.entries(PUBLIC_PRE_REGISTRATION_FIXTURES))("reads canonical bonus fixture %s without SMS or a grant mutation", async (_name, bonus) => {
  const harness = createAuthClientTestHarness();
  harness.mock.enqueueJson({ method: "GET", url: origin + "/me/pre-registration-bonus" }, { body: { data: bonus }, status: 200 });
  await expect(harness.client.getPreRegistrationBonus()).resolves.toMatchObject({ data: { data: bonus } });
  expect(harness.mock.requests).toHaveLength(1);
  harness.mock.assertExhausted();
});

it("surfaces cutoff rejection without retrying or falling back to normal registration", async () => {
  const harness = createAuthClientTestHarness(csrf);
  harness.mock.enqueueJson({ method: "GET", url: origin + "/auth/session" }, { body: PUBLIC_AUTH_FIXTURE.anonymous_session, status: 200 });
  harness.mock.enqueueProblem({ method: "POST", url: origin + "/auth/pre-register" }, {
    code: "PRE_REGISTRATION_CLOSED", status: 409, request_id: "fixture", retryable: false,
    title: "Closed", type: "https://storefront.test/problems/closed",
  });
  await expect(harness.client.preRegister(input)).rejects.toMatchObject({ code: "PRE_REGISTRATION_CLOSED" });
  expect(harness.mock.requests).toHaveLength(2);
  harness.mock.assertExhausted();
});
