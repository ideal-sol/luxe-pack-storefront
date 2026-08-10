import { PUBLIC_AUTH_FIXTURE, PUBLIC_CONTRACT_FIXTURE, PUBLIC_EXTERNAL_IDENTITY_FIXTURE } from "@oripa/storefront-testkit";
import { createExternalIdentityClientTestHarness } from "@/lib/platform/testing";

const origin = "https://storefront.test/platform";
const csrf = "d".repeat(64);

function enqueueCsrf(harness: ReturnType<typeof createExternalIdentityClientTestHarness>) {
  harness.mock.enqueueJson(
    { method: "GET", url: `${origin}/auth/session` },
    { body: PUBLIC_AUTH_FIXTURE.authenticated_session, status: 200 },
  );
}

describe("MIG-062A LINE external identity contract", () => {
  it("publishes the state, start, callback, reauthentication, and unlink operations", () => {
    for (const operation of [
      "completeLineLogin",
      "listExternalIdentities",
      "startLineIdentityLink",
      "startLineReauthentication",
      "unlinkLineIdentity",
    ]) {
      expect(PUBLIC_CONTRACT_FIXTURE.operation_ids).toContain(operation);
    }
  });

  it("gets linked identities without exposing a provider subject or token", async () => {
    const harness = createExternalIdentityClientTestHarness();
    harness.mock.enqueueJson(
      { method: "GET", url: `${origin}/me/external-identities` },
      { body: PUBLIC_EXTERNAL_IDENTITY_FIXTURE.linked, status: 200 },
    );
    const result = await harness.client.listExternalIdentities();
    expect(result.data).toEqual(PUBLIC_EXTERNAL_IDENTITY_FIXTURE.linked);
    expect(JSON.stringify(result.data)).not.toMatch(/subject|token/i);
    harness.mock.assertExhausted();
  });

  it("starts a Session-bound LINE link using the generated request and response", async () => {
    const harness = createExternalIdentityClientTestHarness(csrf);
    enqueueCsrf(harness);
    harness.mock.enqueueJson(
      { method: "POST", url: `${origin}/me/external-identities/line/link` },
      { body: PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start, status: 200 },
    );
    await expect(harness.client.startLineIdentityLink({ return_path: "/mypage/line" }, {}))
      .resolves.toMatchObject({ data: PUBLIC_EXTERNAL_IDENTITY_FIXTURE.line_start });
    harness.mock.assertExhausted();
  });
});
