import { ApiProblemError } from "@oripa/storefront-client";
import { readFileSync } from "node:fs";
import {
  assertBrowserRequestBoundary,
  PUBLIC_AUTH_FIXTURE,
} from "@oripa/storefront-testkit";
import { createAuthClientTestHarness } from "@/lib/platform/testing";

const origin = "https://storefront.test/platform";
const csrf = "a".repeat(64);

function problem(code: string, status: number, errors?: Record<string, string[]>) {
  return {
    code,
    errors,
    request_id: "request-auth-contract",
    retryable: false,
    status,
    title: "Authentication request rejected",
    type: "https://storefront.test/problems/authentication",
  };
}

function enqueueCsrf(harness: ReturnType<typeof createAuthClientTestHarness>) {
  harness.mock.enqueueJson(
    { method: "GET", url: `${origin}/auth/session` },
    { body: PUBLIC_AUTH_FIXTURE.anonymous_session, status: 200 },
  );
}

describe("MIG-062U authentication contract regression", () => {
  it("imports the pinned Client, Schema, and Testkit at the expected version", () => {
    for (const packageName of ["site-schema", "storefront-client", "storefront-testkit"]) {
      const packageJson = JSON.parse(readFileSync(`node_modules/@oripa/${packageName}/package.json`, "utf8"));
      expect(packageJson.version).toBe("2.0.0-alpha.18");
    }
    expect(PUBLIC_AUTH_FIXTURE.authenticated_session.authenticated).toBe(true);
    expect(ApiProblemError).toBeTypeOf("function");
  });

  it.each([
    ["authenticated", PUBLIC_AUTH_FIXTURE.authenticated_session],
    ["anonymous", PUBLIC_AUTH_FIXTURE.anonymous_session],
  ])("gets the %s session through the canonical client", async (_, session) => {
    const harness = createAuthClientTestHarness();
    harness.mock.enqueueJson({ method: "GET", url: `${origin}/auth/session` }, { body: session, status: 200 });

    await expect(harness.client.getCurrentSession()).resolves.toMatchObject({ data: session });
    assertBrowserRequestBoundary(harness.mock.requests[0]!, { client_version: "2.0.0-alpha.18", site_version: "0.1.0" });
    harness.mock.assertExhausted();
  });

  it("surfaces an expired session as typed Problem Details", async () => {
    const harness = createAuthClientTestHarness();
    harness.mock.enqueueProblem({ method: "GET", url: `${origin}/auth/session` }, problem("SESSION_EXPIRED", 401));
    await expect(harness.client.getCurrentSession()).rejects.toMatchObject({ code: "SESSION_EXPIRED", status: 401 });
  });

  it("registers and logs in using canonical request and response types", async () => {
    const registration = createAuthClientTestHarness(csrf);
    enqueueCsrf(registration);
    registration.mock.enqueueJson(
      { method: "POST", url: `${origin}/auth/register` },
      { body: PUBLIC_AUTH_FIXTURE.pending_registration, status: 202 },
    );
    await expect(registration.client.register({ email: "fixture@example.test", password: "fixture-password", redirect_path: "/" }))
      .resolves.toMatchObject({ data: PUBLIC_AUTH_FIXTURE.pending_registration });
    registration.mock.assertExhausted();

    const login = createAuthClientTestHarness(csrf);
    enqueueCsrf(login);
    login.mock.enqueueJson(
      { method: "POST", url: `${origin}/auth/login` },
      { body: PUBLIC_AUTH_FIXTURE.authenticated_session, status: 200 },
    );
    await expect(login.client.login({ email: "fixture@example.test", password: "fixture-password" }))
      .resolves.toMatchObject({ data: PUBLIC_AUTH_FIXTURE.authenticated_session });
    assertBrowserRequestBoundary(login.mock.requests[1]!, { client_version: "2.0.0-alpha.18", site_version: "0.1.0" });
    login.mock.assertExhausted();
  });

  it("returns typed validation and credential failures", async () => {
    const registration = createAuthClientTestHarness(csrf);
    enqueueCsrf(registration);
    registration.mock.enqueueProblem(
      { method: "POST", url: `${origin}/auth/register` },
      problem("INVALID_REQUEST", 422, { email: ["The email field is invalid."] }),
    );
    await expect(registration.client.register({ email: "invalid", password: "fixture-password", redirect_path: "/" }))
      .rejects.toMatchObject({ code: "INVALID_REQUEST", errors: { email: ["The email field is invalid."] } });

    const login = createAuthClientTestHarness(csrf);
    enqueueCsrf(login);
    login.mock.enqueueProblem({ method: "POST", url: `${origin}/auth/login` }, problem("INVALID_CREDENTIALS", 401));
    await expect(login.client.login({ email: "fixture@example.test", password: "incorrect" }))
      .rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("logs out and handles email verification resend and completion", async () => {
    const logout = createAuthClientTestHarness(csrf);
    enqueueCsrf(logout);
    logout.mock.enqueueJson({ method: "POST", url: `${origin}/auth/logout` }, { body: undefined, status: 204 });
    await expect(logout.client.logout()).resolves.toMatchObject({ data: undefined });

    const resend = createAuthClientTestHarness(csrf);
    enqueueCsrf(resend);
    resend.mock.enqueueJson(
      { method: "POST", url: `${origin}/auth/email/verification-notification` },
      { body: PUBLIC_AUTH_FIXTURE.accepted, status: 202 },
    );
    await expect(resend.client.resendEmailVerification({ user_id: PUBLIC_AUTH_FIXTURE.pending_registration.user_id, redirect_path: "/" }))
      .resolves.toMatchObject({ data: PUBLIC_AUTH_FIXTURE.accepted });

    const completion = createAuthClientTestHarness();
    completion.mock.enqueueJson(
      {
        method: "GET",
        url: `${origin}/auth/email/verify/${PUBLIC_AUTH_FIXTURE.pending_registration.user_id}/${"b".repeat(64)}`,
      },
      { body: PUBLIC_AUTH_FIXTURE.authenticated_session, status: 200 },
    );
    await expect(completion.client.completeEmailVerification({
      hash: "b".repeat(64),
      user_id: PUBLIC_AUTH_FIXTURE.pending_registration.user_id,
    })).resolves.toMatchObject({ data: PUBLIC_AUTH_FIXTURE.authenticated_session });
  });

  it("surfaces resend and completion failures without retrying them as success", async () => {
    const resend = createAuthClientTestHarness(csrf);
    enqueueCsrf(resend);
    resend.mock.enqueueProblem(
      { method: "POST", url: `${origin}/auth/email/verification-notification` },
      problem("RATE_LIMITED", 429),
    );
    await expect(resend.client.resendEmailVerification({ user_id: PUBLIC_AUTH_FIXTURE.pending_registration.user_id, redirect_path: "/" }))
      .rejects.toMatchObject({ code: "RATE_LIMITED" });

    const completion = createAuthClientTestHarness();
    completion.mock.enqueueProblem(
      {
        method: "GET",
        url: `${origin}/auth/email/verify/${PUBLIC_AUTH_FIXTURE.pending_registration.user_id}/${"c".repeat(64)}`,
      },
      problem("VERIFICATION_LINK_EXPIRED", 410),
    );
    await expect(completion.client.completeEmailVerification({
      hash: "c".repeat(64),
      user_id: PUBLIC_AUTH_FIXTURE.pending_registration.user_id,
    })).rejects.toMatchObject({ code: "VERIFICATION_LINK_EXPIRED" });
  });
});
