import { isAuthProblemError } from "@oripa/storefront-client";
import { createPublicClientTestHarness } from "@/lib/platform/testing";

const base = "https://storefront.test/platform";
const id = "0198a001-0000-7000-8000-000000000011";
describe("immutable login Gacha client boundary", () => {
  it("uses the guest collection without credentials or a cache", async () => {
    const harness = createPublicClientTestHarness();
    harness.mock.enqueueJson({ method: "GET", url: `${base}/login-gachas` }, { body: { items: [] }, status: 200 });
    await expect(harness.client.listLoginGachas()).resolves.toMatchObject({ data: { items: [] } });
    expect(harness.mock.requests[0]).toMatchObject({ credentials: "omit" });
    harness.mock.assertExhausted();
  });
  it.each(["AUTHENTICATION_REQUIRED", "SESSION_EXPIRED"])("preserves typed %s from the dedicated detail operation", async (code) => {
    const harness = createPublicClientTestHarness();
    harness.mock.enqueueProblem({ method: "GET", url: `${base}/login-gachas/${id}` }, { code, status: 401, title: "Authentication required", type: "https://example.test/problems/auth", retryable: false, request_id: "qa" });
    try { await harness.client.getLoginGacha(id); throw new Error("Expected typed rejection"); }
    catch (error) { expect(isAuthProblemError(error, code as "AUTHENTICATION_REQUIRED" | "SESSION_EXPIRED")).toBe(true); }
    expect(harness.mock.requests[0]).toMatchObject({ credentials: "include" });
    harness.mock.assertExhausted();
  });
});
