import { ApiProblemError, type PublicComponents } from "@oripa/storefront-client";
import { assertBrowserRequestBoundary, PUBLIC_AUTH_FIXTURE, PUBLIC_CONTRACT_FIXTURE } from "@oripa/storefront-testkit";
import { createMockFetch } from "@oripa/storefront-testkit/mock";
import { createConversionAdapter } from "@/lib/platform/conversion-client";
import { createBrowserPlatformTransport } from "@/lib/platform/browser-client";

const origin = "https://storefront.test/platform";
const id = "00000000-0000-4000-8000-000000000002";
const token = "a".repeat(64);
function harness(mutation = false) {
  const mock = createMockFetch();
  const client = createConversionAdapter(createBrowserPlatformTransport({ baseUrl: origin, defaultTimeoutMs: 1000, siteVersion: "0.1.0" }, {
    fetch: mock.fetch, cookie_reader: () => "d".repeat(64),
  }));
  if (mutation) mock.enqueueJson({ method: "GET", url: `${origin}/auth/session` }, { body: PUBLIC_AUTH_FIXTURE.authenticated_session, status: 200 });
  return { client, mock };
}

it("uses the three official operations and generated response schemas", async () => {
  expect(PUBLIC_CONTRACT_FIXTURE.operation_count).toBe(97);
  for (const operation of ["getPendingConversionEvents", "claimConversionEvent", "deliverConversionEvent"]) {
    expect(PUBLIC_CONTRACT_FIXTURE.operation_ids).toContain(operation);
  }
  const { client, mock } = harness();
  const response: PublicComponents["schemas"]["PendingConversionEvents"] = { data: [{ id, event: "line_friend_added", occurred_at: "2026-11-24T00:00:00Z" }] };
  mock.enqueueJson({ method: "GET", url: `${origin}/me/conversion-events/pending` }, { body: response, status: 200 });
  expect(await client.pending()).toEqual(response.data);
  assertBrowserRequestBoundary(mock.requests[0]!, { client_version: "2.0.0-alpha.54", site_version: "0.1.0" });
  mock.assertExhausted();
});

it("claims and confirms through the official CSRF transport, without retrying mutations", async () => {
  const { client, mock } = harness(true);
  const response: PublicComponents["schemas"]["ConversionEventClaim"] = { data: { claim_token: token, expires_in_seconds: 120 } };
  mock.enqueueJson({ method: "POST", url: `${origin}/me/conversion-events/${id}/claim` }, { body: response, status: 200 });
  mock.enqueueJson({ method: "POST", url: `${origin}/me/conversion-events/${id}/delivered` }, { body: null, status: 204 });
  expect(await client.claim(id)).toEqual({ token, expiresInSeconds: 120 });
  expect(await client.delivered(id, token)).toBe("delivered");
  expect(mock.requests).toHaveLength(3);
  for (const request of mock.requests.slice(1)) {
    assertBrowserRequestBoundary(request, { client_version: "2.0.0-alpha.54", site_version: "0.1.0" });
    expect(request.headers["x-xsrf-token"]).toBe("d".repeat(64));
  }
  expect(mock.requests[2]!.body).toEqual(JSON.stringify({ claim_token: token }));
  mock.assertExhausted();
});

it.each([
  ["claim", 409, "CONVERSION_CLAIM_HELD", "held"],
  ["claim", 409, "CONVERSION_ALREADY_DELIVERED", "already_delivered"],
  ["claim", 409, "CONVERSION_NOT_DELIVERABLE", "not_deliverable"],
  ["claim", 404, "CONVERSION_NOT_FOUND", "not_found"],
  ["delivered", 409, "CONVERSION_TOKEN_MISMATCH", "token_mismatch"],
  ["delivered", 404, "CONVERSION_NOT_FOUND", "not_found"],
] as const)("maps only the official %s %s %s result", async (operation, status, code, result) => {
  const { client, mock } = harness(true);
  mock.enqueueProblem({ method: "POST", url: `${origin}/me/conversion-events/${id}/${operation}` }, { type: "about:blank", title: "Synthetic conflict", status, code, request_id: "synthetic-request", retryable: false });
  expect(await (operation === "claim" ? client.claim(id) : client.delivered(id, token))).toBe(result);
  expect(mock.requests).toHaveLength(2);
  mock.assertExhausted();
});

it.each([[401, "AUTHENTICATION_REQUIRED"], [403, "SMS_VERIFICATION_REQUIRED"], [429, "RATE_LIMITED"], [500, "INTERNAL_ERROR"], [409, "UNKNOWN_CONFLICT"]] as const)("preserves %s %s as a typed failure", async (status, code) => {
  const { client, mock } = harness(true);
  mock.enqueueProblem({ method: "POST", url: `${origin}/me/conversion-events/${id}/claim` }, { type: "about:blank", title: "Synthetic failure", status, code, request_id: "synthetic-request", retryable: false });
  await expect(client.claim(id)).rejects.toBeInstanceOf(ApiProblemError);
  expect(mock.requests).toHaveLength(2);
  mock.assertExhausted();
});
