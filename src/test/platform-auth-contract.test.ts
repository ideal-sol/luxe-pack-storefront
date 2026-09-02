import { ApiProblemError } from "@oripa/storefront-client";
import { readFileSync } from "node:fs";
import {
  assertBrowserRequestBoundary,
  PUBLIC_ACCOUNT_SECURITY_FIXTURE,
  PUBLIC_ACCOUNT_SECURITY_PROBLEM_FIXTURES,
  PUBLIC_AUTH_FIXTURE,
  PUBLIC_SMS_VERIFICATION_FIXTURES,
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

describe("alpha.35 authentication, account security, and SMS contract", () => {
  it("imports the canonical immutable Client, Schema, and Testkit versions", () => {
    for (const [packageName, version] of Object.entries({
      "site-schema": "2.0.0-alpha.23",
      "storefront-client": "2.0.0-alpha.35",
      "storefront-testkit": "2.0.0-alpha.35",
    })) {
      const packageJson = JSON.parse(readFileSync(`node_modules/@oripa/${packageName}/package.json`, "utf8"));
      expect(packageJson.version).toBe(version);
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
    assertBrowserRequestBoundary(harness.mock.requests[0]!, { client_version: "2.0.0-alpha.35", site_version: "0.1.0" });
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
    await expect(registration.client.register({ email: "fixture@example.test", password: "fixture-password", redirect_path: "/mypage" }))
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
    assertBrowserRequestBoundary(login.mock.requests[1]!, { client_version: "2.0.0-alpha.35", site_version: "0.1.0" });
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

  it("uses the canonical Password Reset requests without creating a session", async () => {
    const request = createAuthClientTestHarness(csrf);
    enqueueCsrf(request);
    request.mock.enqueueJson(
      { method: "POST", url: `${origin}/auth/password/forgot` },
      {
        body: {
          message: "If the account is eligible, password reset instructions will be sent.",
          status: "accepted",
        },
        status: 202,
      },
    );
    await expect(request.client.requestPasswordReset({
      email: "fixture@example.test",
      redirect_path: "/",
    }, {})).resolves.toMatchObject({ data: { status: "accepted" } });
    expect(JSON.parse(request.mock.requests[1]?.body ?? "null")).toEqual({
      email: "fixture@example.test",
      redirect_path: "/",
    });
    assertBrowserRequestBoundary(request.mock.requests[1]!, {
      client_version: "2.0.0-alpha.35",
      site_version: "0.1.0",
    });

    const confirm = createAuthClientTestHarness(csrf);
    enqueueCsrf(confirm);
    confirm.mock.enqueueJson(
      { method: "POST", url: `${origin}/auth/password/reset` },
      { body: PUBLIC_ACCOUNT_SECURITY_FIXTURE.password_reset_completed, status: 200 },
    );
    await expect(confirm.client.confirmPasswordReset({
      password: "new-fixture-password",
      token: "b".repeat(64),
      user_id: PUBLIC_AUTH_FIXTURE.pending_registration.user_id,
    }, {})).resolves.toMatchObject({
      data: {
        authenticated: false,
        next_action: "login",
        user: null,
      },
    });
    expect(JSON.parse(confirm.mock.requests[1]?.body ?? "null")).toEqual({
      password: "new-fixture-password",
      token: "b".repeat(64),
      user_id: PUBLIC_AUTH_FIXTURE.pending_registration.user_id,
    });
    expect(confirm.mock.requests).toHaveLength(2);
  });

  it("uses canonical Email Change operations for same-browser and cross-browser completion", async () => {
    const requestId = PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_pending.request_id;
    const request = createAuthClientTestHarness(csrf);
    enqueueCsrf(request);
    request.mock.enqueueJson(
      { method: "POST", url: `${origin}/me/email-change-requests` },
      { body: PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_pending, status: 202 },
    );
    await expect(request.client.createEmailChangeRequest({
      email: "changed@example.test",
      redirect_path: "/",
    }, {})).resolves.toMatchObject({ data: { status: "pending_verification" } });
    expect(JSON.parse(request.mock.requests[1]?.body ?? "null")).toEqual({
      email: "changed@example.test",
      redirect_path: "/",
    });

    for (const completed of [
      PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_completed_same_browser,
      PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_completed_cross_browser,
    ]) {
      const completion = createAuthClientTestHarness(csrf);
      enqueueCsrf(completion);
      completion.mock.enqueueJson(
        { method: "POST", url: `${origin}/me/email-change-requests/${requestId}/complete` },
        { body: completed, status: 200 },
      );
      await expect(completion.client.completeEmailChange({ request_id: requestId, token: "c".repeat(64) }, {}))
        .resolves.toMatchObject({ data: completed });
      expect(JSON.parse(completion.mock.requests[1]?.body ?? "null")).toEqual({ token: "c".repeat(64) });
      expect(completion.mock.requests).toHaveLength(2);
    }
  });

  it("changes Password immediately with current and new values", async () => {
    const harness = createAuthClientTestHarness(csrf);
    enqueueCsrf(harness);
    harness.mock.enqueueJson(
      { method: "PUT", url: `${origin}/me/password` },
      { body: PUBLIC_ACCOUNT_SECURITY_FIXTURE.password_changed, status: 200 },
    );
    await expect(harness.client.changeUserPassword({
      current_password: "current-fixture-password",
      new_password: "new-fixture-password",
    }, {})).resolves.toMatchObject({ data: { authenticated: true, session_rotated: true } });
    expect(JSON.parse(harness.mock.requests[1]?.body ?? "null")).toEqual({
      current_password: "current-fixture-password",
      new_password: "new-fixture-password",
    });
    expect(harness.mock.requests[1]?.method).toBe("PUT");
  });

  it("keeps single-use mutations non-retrying and surfaces typed Account Security Problems", async () => {
    const reset = createAuthClientTestHarness(csrf);
    enqueueCsrf(reset);
    reset.mock.enqueueProblem(
      { method: "POST", url: `${origin}/auth/password/reset` },
      PUBLIC_ACCOUNT_SECURITY_PROBLEM_FIXTURES.invalid_password_reset,
    );
    await expect(reset.client.confirmPasswordReset({
      password: "new-fixture-password",
      token: "d".repeat(64),
      user_id: PUBLIC_AUTH_FIXTURE.pending_registration.user_id,
    }, {})).rejects.toMatchObject({ code: "INVALID_PASSWORD_RESET" });
    expect(reset.mock.requests).toHaveLength(2);

    const email = createAuthClientTestHarness(csrf);
    enqueueCsrf(email);
    email.mock.enqueueProblem(
      {
        method: "POST",
        url: `${origin}/me/email-change-requests/${PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_pending.request_id}/complete`,
      },
      PUBLIC_ACCOUNT_SECURITY_PROBLEM_FIXTURES.invalid_email_change,
    );
    await expect(email.client.completeEmailChange({
      request_id: PUBLIC_ACCOUNT_SECURITY_FIXTURE.email_change_pending.request_id,
      token: "e".repeat(64),
    }, {})).rejects.toMatchObject({ code: "INVALID_EMAIL_CHANGE_REQUEST" });
    expect(email.mock.requests).toHaveLength(2);
  });

  it("uses the canonical SMS status, send, resend, and verify operations", async () => {
    const status = createAuthClientTestHarness();
    status.mock.enqueueJson(
      { method: "GET", url: `${origin}/me/sms-verification` },
      { body: PUBLIC_SMS_VERIFICATION_FIXTURES.unverified, status: 200 },
    );
    await expect(status.client.getSmsVerificationStatus()).resolves.toMatchObject({
      data: PUBLIC_SMS_VERIFICATION_FIXTURES.unverified,
    });
    assertBrowserRequestBoundary(status.mock.requests[0]!, { client_version: "2.0.0-alpha.35", site_version: "0.1.0" });

    const send = createAuthClientTestHarness(csrf);
    enqueueCsrf(send);
    send.mock.enqueueJson(
      { method: "POST", url: `${origin}/me/sms-verification` },
      { body: PUBLIC_SMS_VERIFICATION_FIXTURES.send_pending, status: 202 },
    );
    await expect(send.client.sendSmsVerification({ phone: "09012345678" }, {})).resolves.toMatchObject({
      data: PUBLIC_SMS_VERIFICATION_FIXTURES.send_pending,
    });
    expect(JSON.parse(send.mock.requests[1]?.body ?? "null")).toEqual({ phone: "09012345678" });

    const resend = createAuthClientTestHarness(csrf);
    enqueueCsrf(resend);
    resend.mock.enqueueJson(
      { method: "POST", url: `${origin}/me/sms-verification/resend` },
      { body: PUBLIC_SMS_VERIFICATION_FIXTURES.send_pending, status: 202 },
    );
    await expect(resend.client.resendSmsVerification({})).resolves.toMatchObject({
      data: PUBLIC_SMS_VERIFICATION_FIXTURES.send_pending,
    });
    expect(JSON.parse(resend.mock.requests[1]?.body ?? "null")).toEqual({});

    const verify = createAuthClientTestHarness(csrf);
    enqueueCsrf(verify);
    verify.mock.enqueueJson(
      { method: "POST", url: `${origin}/me/sms-verification/verify` },
      { body: PUBLIC_SMS_VERIFICATION_FIXTURES.verified, status: 200 },
    );
    await expect(verify.client.verifySmsCode({
      challenge_id: PUBLIC_SMS_VERIFICATION_FIXTURES.accepted.challenge.id,
      code: "123456",
    }, {})).resolves.toMatchObject({ data: PUBLIC_SMS_VERIFICATION_FIXTURES.verified });
    expect(JSON.parse(verify.mock.requests[1]?.body ?? "null")).toEqual({
      challenge_id: PUBLIC_SMS_VERIFICATION_FIXTURES.accepted.challenge.id,
      code: "123456",
    });
  });

  it("uses canonical password Fresh Reauthentication and exposes server retry timing", async () => {
    const reauthentication = createAuthClientTestHarness(csrf);
    enqueueCsrf(reauthentication);
    reauthentication.mock.enqueueJson(
      { method: "POST", url: `${origin}/me/password/reauthenticate` },
      { body: { method: "password", reauthenticated: true }, status: 200 },
    );
    await expect(reauthentication.client.reauthenticateUserPassword({ password: "fixture-password" }, {}))
      .resolves.toMatchObject({ data: { method: "password", reauthenticated: true } });

    const limited = createAuthClientTestHarness(csrf);
    enqueueCsrf(limited);
    limited.mock.enqueueProblem(
      { method: "POST", url: `${origin}/me/sms-verification/resend` },
      PUBLIC_SMS_VERIFICATION_FIXTURES.problems.cooldown,
    );
    await expect(limited.client.resendSmsVerification({})).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retry_after_seconds: 59,
      status: 429,
    });
  });
});
