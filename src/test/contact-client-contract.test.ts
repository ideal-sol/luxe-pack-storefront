import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import {
  assertBrowserRequestBoundary,
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_CONTACT_FIXTURE,
  PUBLIC_CONTACT_PROBLEM_FIXTURES,
} from "@oripa/storefront-testkit";
import { createContactClientTestHarness } from "@/lib/platform/testing";

const origin = "https://storefront.test/platform";
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

describe("STORE-SITE-034 browser Contact contract", () => {
  it("uses the canonical package-only dependency versions", () => {
    expect(PUBLIC_CONTACT_FIXTURE.input.website).toBe("");
    expect(ApiProblemError).toBeTypeOf("function");
    expect(StorefrontTransportError).toBeTypeOf("function");
  });

  it("supports an anonymous first submission and maps the canonical request once", async () => {
    const harness = createContactClientTestHarness(browserToken);
    enqueueSession(harness, PUBLIC_AUTH_FIXTURE.anonymous_session);
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/contact-inquiries` },
      { body: PUBLIC_CONTACT_FIXTURE.receipt, status: 202 },
    );

    await expect(harness.client.submitContact(PUBLIC_CONTACT_FIXTURE.input)).resolves.toMatchObject({
      data: PUBLIC_CONTACT_FIXTURE.receipt,
      metadata: { status: 202 },
    });

    expect(harness.mock.requests).toHaveLength(2);
    expect(harness.mock.requests[0]).toMatchObject({ credentials: "include", method: "GET" });
    expect(harness.mock.requests[1]).toMatchObject({ credentials: "include", method: "POST" });
    expect(JSON.parse(harness.mock.requests[1]!.body ?? "null")).toEqual(PUBLIC_CONTACT_FIXTURE.input);
    expect(Object.keys(harness.mock.requests[1]!.headers).some((name) => name.includes("idempotency"))).toBe(false);
    assertBrowserRequestBoundary(harness.mock.requests[1]!, { client_version: "2.0.0-alpha.30", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it("supports an authenticated submission through the same browser-safe boundary", async () => {
    const harness = createContactClientTestHarness(browserToken);
    enqueueSession(harness, PUBLIC_AUTH_FIXTURE.authenticated_session);
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/contact-inquiries` },
      { body: PUBLIC_CONTACT_FIXTURE.receipt, status: 202 },
    );

    await harness.client.submitContact({ ...PUBLIC_CONTACT_FIXTURE.input, phone: "000-0000-0000" });
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
    enqueueSession(harness, PUBLIC_AUTH_FIXTURE.anonymous_session);
    harness.mock.enqueueProblem({ method: "POST", url: `${origin}/contact-inquiries` }, problem);

    await expect(harness.client.submitContact(PUBLIC_CONTACT_FIXTURE.input)).rejects.toMatchObject({
      code: problem.code,
      status: problem.status,
    });
    expect(harness.mock.requests).toHaveLength(2);
    harness.mock.assertExhausted();
  });

  it("surfaces a typed network error and never automatically retries the mutation", async () => {
    const harness = createContactClientTestHarness(browserToken);
    enqueueSession(harness, PUBLIC_AUTH_FIXTURE.anonymous_session);
    harness.mock.enqueueNetworkError({ method: "POST", url: `${origin}/contact-inquiries` });

    const error = await harness.client.submitContact(PUBLIC_CONTACT_FIXTURE.input).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StorefrontTransportError);
    expect(error).toMatchObject({ code: "NETWORK_ERROR" });
    expect(harness.mock.requests).toHaveLength(2);
    harness.mock.assertExhausted();
  });
});
