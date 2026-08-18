import {
  createStorefrontCurrentUserPointClient,
  createStorefrontPointProductClient,
} from "@oripa/storefront-client";
import type {
  PublicComponents,
  StorefrontCurrentUserPointClient,
  StorefrontPointProductClient,
  StorefrontTransport,
  StorefrontWalletBalance,
} from "@oripa/storefront-client";
import { createBrowserPlatformTransport, type BrowserClientOverrides } from "./browser-client";
import type { PlatformRuntimeConfiguration } from "./runtime-configuration";

type Schemas = PublicComponents["schemas"];

export type PointHistoryCollection = Schemas["PointHistoryCollection"];
export type PointHistoryEntry = Schemas["PointHistoryEntry"];
export type PointProduct = Schemas["PointProduct"];
export type PointProductAudienceCode = Schemas["PointProductAudienceCode"];
export type PointProductCollection = Schemas["PointProductCollection"];
export type PointProductIneligibleReason = Schemas["PointProductIneligibleReason"];
export type PointProductSaleState = Schemas["PointProductSaleState"];
export type PointWalletBalance = StorefrontWalletBalance;

export type PointClientAdapter = Pick<
  StorefrontCurrentUserPointClient,
  "getWallet" | "listPointLedgerEntries"
> & Pick<StorefrontPointProductClient, "listPointProducts">;

export function createPointClientAdapter(transport: StorefrontTransport): PointClientAdapter {
  const currentUserPoints = createStorefrontCurrentUserPointClient(transport);
  const products = createStorefrontPointProductClient(transport);
  return {
    getWallet: currentUserPoints.getWallet,
    listPointLedgerEntries: currentUserPoints.listPointLedgerEntries,
    listPointProducts: products.listPointProducts,
  };
}

export function createBrowserPointClient(
  configuration?: PlatformRuntimeConfiguration,
  overrides: BrowserClientOverrides = {},
): PointClientAdapter {
  return createPointClientAdapter(createBrowserPlatformTransport(configuration, overrides));
}
