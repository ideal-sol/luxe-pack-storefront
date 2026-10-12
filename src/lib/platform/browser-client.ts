import { createBrowserStorefrontClient } from "@oripa/storefront-client/browser";
import type { StorefrontTransport } from "@oripa/storefront-client";
import {
  readPlatformRuntimeConfiguration,
  type PlatformRuntimeConfiguration,
} from "./runtime-configuration";

export type BrowserClientOverrides = Pick<
  Parameters<typeof createBrowserStorefrontClient>[0],
  "cookie_reader" | "fetch"
>;

export const SESSION_ACCESS_REJECTED = "storefront:session-access-rejected";

export const callGlobalFetch: typeof globalThis.fetch = async (input, init) => {
  const response = await globalThis.fetch(input, init);
  if (typeof window !== "undefined" && (response.status === 401 || response.status === 403)) {
    try {
      const problem: unknown = await response.clone().json();
      if (problem && typeof problem === "object" && "code" in problem &&
          ["SESSION_EXPIRED", "AUTHENTICATION_REQUIRED", "SMS_VERIFICATION_REQUIRED"].includes(String(problem.code))) {
        window.dispatchEvent(new CustomEvent(SESSION_ACCESS_REJECTED, { detail: problem.code }));
      }
    } catch {}
  }
  return response;
};

export function createBrowserPlatformTransport(
  configuration: PlatformRuntimeConfiguration = readPlatformRuntimeConfiguration(),
  overrides: BrowserClientOverrides = {},
): StorefrontTransport {
  return createBrowserStorefrontClient({
    base_url: configuration.baseUrl,
    default_timeout_ms: configuration.defaultTimeoutMs,
    site_version: configuration.siteVersion,
    ...overrides,
    fetch: overrides.fetch ?? callGlobalFetch,
  });
}
