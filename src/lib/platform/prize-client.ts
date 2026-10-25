import {
  FULFILLMENT_MUTATION_RETRY_SEMANTICS,
  createIdempotencyKey,
  isFulfillmentProblemError,
  isShippingMinimumPointsProblemError,
  type BrowserStorefrontPrizeShippingClient,
  type FulfillmentProblemCode,
  type PublicComponents,
} from "@oripa/storefront-client";
import { createBrowserStorefrontPrizeShippingClient } from "@oripa/storefront-client/browser";
import { callGlobalFetch, type BrowserClientOverrides } from "./browser-client";
import type { ShippingPolicyAccess } from "./shipping-policy";
import {
  readPlatformRuntimeConfiguration,
  type PlatformRuntimeConfiguration,
} from "./runtime-configuration";

type Schemas = PublicComponents["schemas"];

export type UserPrize = Schemas["UserPrize"];
export type UserPrizeActionUnavailableReason = Schemas["UserPrizeActionUnavailableReason"];
export type UserPrizeAllowedActions = Schemas["UserPrizeAllowedActions"];
export type UserPrizeCollection = Schemas["UserPrizeCollection"];
export type UserPrizeDetail = Schemas["UserPrizeDetail"];
export type UserPrizePresentation = Schemas["UserPrizePresentation"];
export type UserPrizeStatus = Schemas["UserPrizeStatus"];
export type ShippingAddress = Schemas["ShippingAddress"];
export type ShippingAddressCollection = Schemas["ShippingAddressCollection"];
export type ShippingAddressInput = Schemas["ShippingAddressInput"];
export type ShippingRequestCollection = Schemas["ShippingRequestCollection"];
export type ShippingRequestDetail = Schemas["ShippingRequestDetail"];
export type ShippingRequestSummary = Schemas["ShippingRequestSummary"];
export type PrizeExchangeResponse = Schemas["PrizeExchangeResponse"];
export type StorefrontFulfillmentProblemCode = FulfillmentProblemCode;

export type PrizeFulfillmentAdapter = BrowserStorefrontPrizeShippingClient & {
  readonly shippingPolicyAccess: ShippingPolicyAccess;
};
export type PrizeInventoryAdapter = Pick<PrizeFulfillmentAdapter, "getPrize" | "listPrizes">;

export function createBrowserPrizeInventoryClient(
  configuration: PlatformRuntimeConfiguration = readPlatformRuntimeConfiguration(),
  overrides: BrowserClientOverrides = {},
): PrizeFulfillmentAdapter {
  const client = createBrowserStorefrontPrizeShippingClient({
    base_url: configuration.baseUrl,
    default_timeout_ms: configuration.defaultTimeoutMs,
    site_version: configuration.siteVersion,
    ...overrides,
    fetch: overrides.fetch ?? callGlobalFetch,
  });
  return {
    ...client,
    shippingPolicyAccess: {
      load: async (signal) => (await client.getShippingPolicy(signal)).data,
      minimumRejection: (error) => isShippingMinimumPointsProblemError(error) ? {
        minimum_points: error.minimum_points,
        effective_required_points: error.effective_required_points,
        selected_total_points: error.selected_total_points,
        shortfall_points: error.shortfall_points,
        setting_revision: error.setting_revision,
      } : null,
    },
  };
}

export {
  FULFILLMENT_MUTATION_RETRY_SEMANTICS,
  createIdempotencyKey,
  isFulfillmentProblemError,
};
