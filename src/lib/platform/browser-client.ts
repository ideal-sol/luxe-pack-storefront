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

export function createBrowserPlatformTransport(
  configuration: PlatformRuntimeConfiguration = readPlatformRuntimeConfiguration(),
  overrides: BrowserClientOverrides = {},
): StorefrontTransport {
  return createBrowserStorefrontClient({
    base_url: configuration.baseUrl,
    default_timeout_ms: configuration.defaultTimeoutMs,
    site_version: configuration.siteVersion,
    ...overrides,
  });
}
