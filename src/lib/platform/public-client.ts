import {
  createStorefrontCatalogClient,
  createStorefrontContentContactClient,
} from "@oripa/storefront-client";
import type {
  PublicComponents,
  StorefrontCatalogClient,
  StorefrontContentContactClient,
  StorefrontTransport,
} from "@oripa/storefront-client";
import { createBrowserPlatformTransport, type BrowserClientOverrides } from "./browser-client";
import type { PlatformRuntimeConfiguration } from "./runtime-configuration";

type Schemas = PublicComponents["schemas"];

export type ContentBanner = Schemas["ContentBanner"];
export type ContentNotice = Schemas["ContentNotice"];
export type ContentNoticeCollection = Schemas["ContentNoticeCollection"];
export type ContentNoticeSummary = Schemas["ContentNoticeSummary"];
export type ContentStaticPage = Schemas["ContentStaticPage"];
export type GachaCategory = Schemas["GachaCategory"];
export type GachaSummary = Schemas["GachaSummary"];
export type GachaSummaryCollection = Schemas["GachaSummaryCollection"];

export type PublicCatalogAdapter = Pick<
  StorefrontCatalogClient,
  "listGachaCategories" | "listGachaTags" | "listGachas"
> & Pick<
  StorefrontContentContactClient,
  "getNotice" | "getStaticPage" | "listBanners" | "listNotices"
>;

export function createPublicCatalogAdapter(transport: StorefrontTransport): PublicCatalogAdapter {
  const catalog = createStorefrontCatalogClient(transport);
  const content = createStorefrontContentContactClient(transport);
  return {
    getNotice: content.getNotice,
    getStaticPage: content.getStaticPage,
    listBanners: content.listBanners,
    listGachaCategories: catalog.listGachaCategories,
    listGachaTags: catalog.listGachaTags,
    listGachas: catalog.listGachas,
    listNotices: content.listNotices,
  };
}

export function createBrowserPublicClient(
  configuration?: PlatformRuntimeConfiguration,
  overrides: BrowserClientOverrides = {},
): PublicCatalogAdapter {
  const transport = createBrowserPlatformTransport(configuration, overrides);
  return createPublicCatalogAdapter(transport);
}
