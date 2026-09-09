import { createStorefrontIdentityClient } from "@oripa/storefront-client";
import { createMockFetch } from "@oripa/storefront-testkit/mock";
import {
  PUBLIC_ADVERTISING_ATTRIBUTION_FIXTURES as fixtures,
  PUBLIC_AUTH_FIXTURE, PUBLIC_EXTERNAL_IDENTITY_FIXTURE,
} from "@oripa/storefront-testkit";
import { createBrowserPlatformTransport } from "@/lib/platform/browser-client";
import { createAuthClientTestHarness, createExternalIdentityClientTestHarness } from "@/lib/platform/testing";
import { ADVERTISING_COOKIE_NAME, createAdvertisingLastClickService, readAdvertisingCandidate } from "@/lib/advertising-last-click";

const origin = "https://storefront.test/platform";
const code = fixtures.registration.advertising_code;
const csrf = "a".repeat(64);
const clear = () => { document.cookie = `${ADVERTISING_COOKIE_NAME}=; Path=/; Max-Age=0`; };
beforeEach(clear);
afterEach(clear);

it.each([true, false])("registration uses current cookie (%s) without changing existing fields or clearing it", async (exists) => {
  const { client, mock } = createAuthClientTestHarness(csrf);
  if (exists) document.cookie = `${ADVERTISING_COOKIE_NAME}=${code}; Path=/`;
  mock.enqueueJson({ method: "GET", url: `${origin}/auth/session` }, { body: PUBLIC_AUTH_FIXTURE.anonymous_session, status: 200 });
  mock.enqueueJson({ method: "POST", url: `${origin}/auth/register` }, { body: PUBLIC_AUTH_FIXTURE.pending_registration, status: 202 });
  const input = fixtures.registration_without_code;
  await expect(client.register(input)).resolves.toMatchObject({ data: PUBLIC_AUTH_FIXTURE.pending_registration });
  expect(JSON.parse(mock.requests[1]!.body!)).toEqual({ ...input, ...(exists ? { advertising_code: code } : {}) });
  expect(readAdvertisingCandidate()).toBe(exists ? code : undefined);
  mock.assertExhausted();
});

it.each([true, false])("existing LINE link initiation uses current cookie (%s) and canonical transport", async (exists) => {
  const { client, mock } = createExternalIdentityClientTestHarness(csrf);
  if (exists) document.cookie = `${ADVERTISING_COOKIE_NAME}=${code}; Path=/`;
  mock.enqueueJson({ method: "GET", url: `${origin}/auth/session` }, { body: PUBLIC_AUTH_FIXTURE.authenticated_session, status: 200 });
  mock.enqueueJson({ method: "POST", url: `${origin}/me/external-identities/line/link` }, { body: PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start, status: 200 });
  await expect(client.startLineIdentityLink({ return_path: "/mypage/line" }, {}))
    .resolves.toMatchObject({ data: PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start });
  expect(JSON.parse(mock.requests[1]!.body!)).toEqual({ return_path: "/mypage/line", ...(exists ? { advertising_code: code } : {}) });
  mock.assertExhausted();
});

it("password login and LINE reauthentication remain unchanged with an advertising cookie", async () => {
  document.cookie = `${ADVERTISING_COOKIE_NAME}=${code}; Path=/`;
  const auth = createAuthClientTestHarness(csrf);
  auth.mock.enqueueJson({ method: "GET", url: `${origin}/auth/session` }, { body: PUBLIC_AUTH_FIXTURE.anonymous_session, status: 200 });
  auth.mock.enqueueJson({ method: "POST", url: `${origin}/auth/login` }, { body: PUBLIC_AUTH_FIXTURE.authenticated_session, status: 200 });
  const input = { email: "fixture@example.test", password: "fixture-password" };
  await auth.client.login(input);
  expect(JSON.parse(auth.mock.requests[1]!.body!)).toEqual(input);
  const external = createExternalIdentityClientTestHarness(csrf);
  external.mock.enqueueJson({ method: "GET", url: `${origin}/auth/session` }, { body: PUBLIC_AUTH_FIXTURE.authenticated_session, status: 200 });
  external.mock.enqueueJson({ method: "POST", url: `${origin}/me/external-identities/line/reauthenticate` }, { body: PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start, status: 200 });
  await external.client.startLineReauthentication({ return_path: "/mypage/line" }, {});
  expect(JSON.parse(external.mock.requests[1]!.body!)).toEqual({ return_path: "/mypage/line" });
  auth.mock.assertExhausted();
  external.mock.assertExhausted();
});

it("uses the generated public validation with exact case and handles stopped/5xx responses", async () => {
  const mock = createMockFetch();
  const identity = createStorefrontIdentityClient(createBrowserPlatformTransport(
    { baseUrl: origin, defaultTimeoutMs: 100, siteVersion: "0.1.0" }, { fetch: mock.fetch },
  ));
  const service = createAdvertisingLastClickService(identity.validateAdvertisingCode);
  for (const [candidate, body, status] of [
    [code, fixtures.valid, 200],
    ["aB12cD34", fixtures.invalid, 200],
    ["Stopped0", fixtures.stopped_agency, 200],
    ["Server00", { title: "Unavailable", status: 503 }, 503],
  ] as const) {
    mock.enqueueJson({ method: "GET", url: `${origin}/advertising-code-validation?advertising_code=${candidate}` }, { body, status });
    await service.capture(`ad_code=${candidate}`);
    expect(readAdvertisingCandidate()).toBe(code);
  }
  expect(mock.requests.every((request) => request.method === "GET")).toBe(true);
  mock.assertExhausted();
});
