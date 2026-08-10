import {
  createStorefrontPrizeShippingClient,
  type PublicComponents,
  type StorefrontPrizeShippingClient,
  type StorefrontTransport,
} from "@oripa/storefront-client";
import { createBrowserPlatformTransport, type BrowserClientOverrides } from "./browser-client";
import type { PlatformRuntimeConfiguration } from "./runtime-configuration";

type Schemas = PublicComponents["schemas"];

export type UserPrize = Schemas["UserPrize"];
export type UserPrizeActionUnavailableReason = Schemas["UserPrizeActionUnavailableReason"];
export type UserPrizeAllowedActions = Schemas["UserPrizeAllowedActions"];
export type UserPrizeCollection = Schemas["UserPrizeCollection"];
export type UserPrizeDetail = Schemas["UserPrizeDetail"];
export type UserPrizePresentation = Schemas["UserPrizePresentation"];
export type UserPrizeStatus = Schemas["UserPrizeStatus"];

export type PrizeInventoryAdapter = Pick<StorefrontPrizeShippingClient, "getPrize" | "listPrizes">;

export function createPrizeInventoryAdapter(transport: StorefrontTransport): PrizeInventoryAdapter {
  const client = createStorefrontPrizeShippingClient(transport);
  return {
    getPrize: client.getPrize,
    listPrizes: client.listPrizes,
  };
}

export function createBrowserPrizeInventoryClient(
  configuration?: PlatformRuntimeConfiguration,
  overrides: BrowserClientOverrides = {},
): PrizeInventoryAdapter {
  return createPrizeInventoryAdapter(createBrowserPlatformTransport(configuration, overrides));
}
