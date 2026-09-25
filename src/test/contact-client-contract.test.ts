import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import {
  assertBrowserRequestBoundary,
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_CONTACT_FIXTURE,
  PUBLIC_CONTACT_PROBLEM_FIXTURES,
} from "@oripa/storefront-testkit";
import { createContactClientTestHarness } from "@/lib/platform/testing";

const origin = "https://storefront.test/platform";
const options = { idempotency_key: PUBLIC_CONTACT_FIXTURE.idempotency_key };
const browserToken = "c".repeat(64);

function enqueueSession(
  harness: ReturnType<typeof createContactClientTestHarness>,
  session: typeof PUBLIC_AUTH_FIXTURE.anonymous_session | typeof PUBLIC_AUTH_FIXTURE.authenticated_session,
) {
  harness.mock.enqueueJson(
    { method: "GET", url: `${origin}/auth/session` },
    { body: session, status: 200 },
  );
}

describe("alpha.40 browser Contact contract", () => {
  it("uses the canonical immutable dependency versions", () => {
    expect(PUBLIC_CONTACT_FIXTURE.input.website).toBe("");
    expect(ApiProblemError).toBeTypeOf("function");
    expect(StorefrontTransportError).toBeTypeOf("function");
  });

  it("supports a new authenticated submission and maps the canonical request once", async () => {
    const harness = createContactClientTestHarness(browserToken);
    enqueueSession(harness, PUBLIC_AUTH_FIXTURE.authenticated_session);
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/contact-inquiries` },
      { body: PUBLIC_CONTACT_FIXTURE.receipt, status: 202 },
    );

    await expect(harness.client.submitContact(PUBLIC_CONTACT_FIXTURE.input, options)).resolves.toMatchObject({
      data: PUBLIC_CONTACT_FIXTURE.receipt,
      metadata: { status: 202 },
    });

    expect(harness.mock.requests).toHaveLength(2);
    expect(harness.mock.requests[0]).toMatchObject({ credentials: "include", method: "GET" });
    expect(harness.mock.requests[1]).toMatchObject({ credentials: "include", method: "POST" });
    expect(JSON.parse(harness.mock.requests[1]!.body ?? "null")).toEqual(PUBLIC_CONTACT_FIXTURE.input);
    expect(harness.mock.requests[1]!.headers["idempotency-key"]).toBe(options.idempotency_key);
    expect(harness.mock.requests[1]!.headers["x-xsrf-token"]).toBe(browserToken);
    assertBrowserRequestBoundary(harness.mock.requests[1]!, { client_version: "2.0.0-alpha.40", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it("supports an authenticated submission through the same browser-safe boundary", async () => {
    const harness = createContactClientTestHarness(browserToken);
    enqueueSession(harness, PUBLIC_AUTH_FIXTURE.authenticated_session);
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/contact-inquiries` },
      { body: PUBLIC_CONTACT_FIXTURE.receipt, status: 202 },
    );

    await harness.client.submitContact({ ...PUBLIC_CONTACT_FIXTURE.input, phone: "000-0000-0000" }, options);
    expect(JSON.parse(harness.mock.requests[1]!.body ?? "null")).toEqual({
      ...PUBLIC_CONTACT_FIXTURE.input,
      phone: "000-0000-0000",
    });
    harness.mock.assertExhausted();
  });

  it.each([
    PUBLIC_CONTACT_PROBLEM_FIXTURES.validation,
    PUBLIC_CONTACT_PROBLEM_FIXTURES.rate_limited,
  ])("preserves typed Contact Problem Details with status $status", async (problem) => {
    const harness = createContactClientTestHarness(browserToken);
    enqueueSession(harness, PUBLIC_AUTH_FIXTURE.authenticated_session);
    harness.mock.enqueueProblem({ method: "POST", url: `${origin}/contact-inquiries` }, problem);

    await expect(harness.client.submitContact(PUBLIC_CONTACT_FIXTURE.input, options)).rejects.toMatchObject({
      code: problem.code,
      status: problem.status,
    });
    expect(harness.mock.requests).toHaveLength(2);
    harness.mock.assertExhausted();
  });

  it("surfaces a typed network error and never automatically retries the mutation", async () => {
    const harness = createContactClientTestHarness(browserToken);
    enqueueSession(harness, PUBLIC_AUTH_FIXTURE.authenticated_session);
    harness.mock.enqueueNetworkError({ method: "POST", url: `${origin}/contact-inquiries` });

    const error = await harness.client.submitContact(PUBLIC_CONTACT_FIXTURE.input, options).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StorefrontTransportError);
    expect(error).toMatchObject({ code: "NETWORK_ERROR" });
    expect(harness.mock.requests).toHaveLength(2);
    harness.mock.assertExhausted();
  });

  it("sends the canonical follow-up payload and preserves its key on an explicit retry", async () => {
    const harness = createContactClientTestHarness(browserToken);
    enqueueSession(harness, PUBLIC_AUTH_FIXTURE.authenticated_session);
    harness.mock.enqueueNetworkError({ method: "POST", url: `${origin}/contact-inquiries` });
    await expect(harness.client.submitContact(PUBLIC_CONTACT_FIXTURE.follow_up_input, options)).rejects.toBeInstanceOf(StorefrontTransportError);
    expect(harness.mock.requests).toHaveLength(2);
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/contact-inquiries` },
      { body: PUBLIC_CONTACT_FIXTURE.receipt, status: 202 },
    );
    await expect(harness.client.submitContact(PUBLIC_CONTACT_FIXTURE.follow_up_input, options)).resolves.toMatchObject({ data: PUBLIC_CONTACT_FIXTURE.receipt });
    const posts = harness.mock.requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(2);
    for (const request of posts) {
      expect(JSON.parse(request.body!)).toEqual(PUBLIC_CONTACT_FIXTURE.follow_up_input);
      expect(request.headers["idempotency-key"]).toBe(options.idempotency_key);
      expect(request.headers["x-xsrf-token"]).toBe(browserToken);
      expect(request.credentials).toBe("include");
    }
    harness.mock.assertExhausted();
  });

  it("does not send a Contact mutation with an invalid CSRF token", async () => {
    const harness = createContactClientTestHarness("invalid-token");
    enqueueSession(harness, PUBLIC_AUTH_FIXTURE.anonymous_session);
    await expect(harness.client.submitContact(PUBLIC_CONTACT_FIXTURE.input, options)).rejects.toMatchObject({ code: "CSRF_INITIALIZATION_FAILED" });
    expect(harness.mock.requests).toHaveLength(1);
    harness.mock.assertExhausted();
  });
});
