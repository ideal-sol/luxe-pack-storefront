import { createBrowserPlatformTransport } from "@/lib/platform/browser-client";
import { STOREFRONT_SITE_VERSION } from "@/lib/platform/runtime-configuration";

describe("browser Platform transport", () => {
  it("calls the native-style global fetch with the global receiver", async () => {
    const originalFetch = globalThis.fetch;
    const receiverSensitiveFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(Response.json({ ok: true }));
    });
    globalThis.fetch = receiverSensitiveFetch as typeof globalThis.fetch;

    try {
      const transport = createBrowserPlatformTransport({
        baseUrl: "/platform",
        defaultTimeoutMs: 1_000,
        siteVersion: STOREFRONT_SITE_VERSION,
      });

      await expect(transport.request({ path: "/public-runtime-check" })).resolves.toMatchObject({
        data: { ok: true },
        metadata: { status: 200 },
      });
      expect(receiverSensitiveFetch).toHaveBeenCalledOnce();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
