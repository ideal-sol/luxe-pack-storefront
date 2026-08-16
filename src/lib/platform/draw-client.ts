import {
  createIdempotencyKey,
  isDrawProblemError,
  type BrowserStorefrontDrawClient,
  type DrawCount,
  type DrawProblemCode,
  type PublicComponents,
} from "@oripa/storefront-client";
import { createBrowserStorefrontDrawClient } from "@oripa/storefront-client/browser";
import { callGlobalFetch, type BrowserClientOverrides } from "./browser-client";
import {
  readPlatformRuntimeConfiguration,
  type PlatformRuntimeConfiguration,
} from "./runtime-configuration";

type Schemas = PublicComponents["schemas"];

export type DrawResponse = Schemas["DrawResponse"];
export type DrawHistoryCollection = Schemas["DrawHistoryCollection"];
export type DrawHistoryEntry = Schemas["DrawHistoryEntry"];
export type StorefrontDrawCount = DrawCount;
export type StorefrontDrawProblemCode = DrawProblemCode;
export type DrawClientAdapter = BrowserStorefrontDrawClient;

export function createBrowserDrawClient(
  configuration: PlatformRuntimeConfiguration = readPlatformRuntimeConfiguration(),
  overrides: BrowserClientOverrides = {},
): DrawClientAdapter {
  return createBrowserStorefrontDrawClient({
    base_url: configuration.baseUrl,
    default_timeout_ms: configuration.defaultTimeoutMs,
    site_version: configuration.siteVersion,
    ...overrides,
    fetch: overrides.fetch ?? callGlobalFetch,
  });
}

export { createIdempotencyKey, isDrawProblemError };
