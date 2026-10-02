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
import { callGlobalFetch, createBrowserPlatformTransport, type BrowserClientOverrides } from "./browser-client";
import type { PlatformRuntimeConfiguration } from "./runtime-configuration";

type Schemas = PublicComponents["schemas"];

export type ContentBanner = Schemas["ContentBanner"];
export type ContentFooterPage = Schemas["ContentFooterPage"];
export type ContentFooterPageCollection = Schemas["ContentFooterPageCollection"];
export type ContentNotice = Schemas["ContentNotice"];
export type ContentNoticeCollection = Schemas["ContentNoticeCollection"];
export type ContentNoticeSummary = Schemas["ContentNoticeSummary"];
export type ContentStaticPage = Schemas["ContentStaticPage"];
export type LoginGachaSummary = Schemas["LoginGachaSummary"];
export type LoginGachaDetail = Schemas["LoginGachaDetailResponse"]["data"];

export type GachaCategory = Schemas["GachaCategory"];
export type GachaDetail = Schemas["GachaDetail"];
export type GachaPresentationState = Schemas["GachaPresentationState"];
export type GachaSaleState = Schemas["GachaSaleState"];
export type GachaSummary = Schemas["GachaSummary"];
export type GachaSummaryCollection = Schemas["GachaSummaryCollection"];

export type PublicCatalogAdapter = Pick<
  StorefrontCatalogClient,
  "listLoginGachas" | "getLoginGacha" | "getGachaBySlug" | "getGachaPresentation" | "listGachaCategories" | "listGachaTags" | "listGachas"
> & Pick<
  StorefrontContentContactClient,
  "getNotice" | "getStaticPage" | "listBanners" | "listFooterPages" | "listNotices"
>;

export function createPublicCatalogAdapter(transport: StorefrontTransport): PublicCatalogAdapter {
  const catalog = createStorefrontCatalogClient(transport);
  const content = createStorefrontContentContactClient(transport);
  return {
    listLoginGachas: catalog.listLoginGachas,
    getLoginGacha: catalog.getLoginGacha,
    getGachaBySlug: catalog.getGachaBySlug,
    getGachaPresentation: catalog.getGachaPresentation,
    getNotice: content.getNotice,
    getStaticPage: content.getStaticPage,
    listBanners: content.listBanners,
    listFooterPages: content.listFooterPages,
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
  const fetch = overrides.fetch ?? callGlobalFetch;
  const loginCatalog = createStorefrontCatalogClient(createBrowserPlatformTransport(configuration, {
    ...overrides,
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  }));
  const guestCatalog = createStorefrontCatalogClient(createBrowserPlatformTransport(configuration, {
    ...overrides,
    fetch: (input, init) => fetch(input, { ...init, credentials: "omit", cache: "no-store" }),
  }));
  return {
    ...createPublicCatalogAdapter(transport),
    listLoginGachas: guestCatalog.listLoginGachas,
    getLoginGacha: loginCatalog.getLoginGacha,
  };
}
