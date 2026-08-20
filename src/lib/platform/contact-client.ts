import type {
  BrowserStorefrontContentContactClient,
  PublicComponents,
} from "@oripa/storefront-client";
import { createBrowserStorefrontContentContactClient } from "@oripa/storefront-client/browser";
import { callGlobalFetch, type BrowserClientOverrides } from "./browser-client";
import {
  readPlatformRuntimeConfiguration,
  type PlatformRuntimeConfiguration,
} from "./runtime-configuration";

type Schemas = PublicComponents["schemas"];

export type ContactInquiryInput = Schemas["CreateContactInquiryRequest"];
export type ContactInquiryReceipt = Schemas["ContactInquiryReceipt"];
export type ContactClientAdapter = Pick<BrowserStorefrontContentContactClient, "submitContact">;

export function createBrowserContactClient(
  configuration: PlatformRuntimeConfiguration = readPlatformRuntimeConfiguration(),
  overrides: BrowserClientOverrides = {},
): ContactClientAdapter {
  return createBrowserStorefrontContentContactClient({
    base_url: configuration.baseUrl,
    default_timeout_ms: configuration.defaultTimeoutMs,
    site_version: configuration.siteVersion,
    ...overrides,
    fetch: overrides.fetch ?? callGlobalFetch,
  });
}
