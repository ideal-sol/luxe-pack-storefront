import { createMockFetch, type MockFetchController } from "@oripa/storefront-testkit/mock";
import { createBrowserAuthClient } from "./auth-client";
import { createBrowserExternalIdentityClient } from "./external-identity-client";
import { createBrowserPublicClient } from "./public-client";
import { createBrowserPrizeInventoryClient } from "./prize-client";
import { createBrowserDrawClient } from "./draw-client";
import { createBrowserPointClient } from "./point-client";
import { STOREFRONT_SITE_VERSION } from "./runtime-configuration";

export interface AuthClientTestHarness {
  readonly client: ReturnType<typeof createBrowserAuthClient>;
  readonly mock: MockFetchController;
}

export interface ExternalIdentityClientTestHarness {
  readonly client: ReturnType<typeof createBrowserExternalIdentityClient>;
  readonly mock: MockFetchController;
}

export interface PublicClientTestHarness {
  readonly client: ReturnType<typeof createBrowserPublicClient>;
  readonly mock: MockFetchController;
}

export interface PrizeClientTestHarness {
  readonly client: ReturnType<typeof createBrowserPrizeInventoryClient>;
  readonly mock: MockFetchController;
}

export interface DrawClientTestHarness {
  readonly client: ReturnType<typeof createBrowserDrawClient>;
  readonly mock: MockFetchController;
}

export interface PointClientTestHarness {
  readonly client: ReturnType<typeof createBrowserPointClient>;
  readonly mock: MockFetchController;
}

export function createAuthClientTestHarness(cookieValue?: string): AuthClientTestHarness {
  const mock = createMockFetch();
  const client = createBrowserAuthClient(
    {
      baseUrl: "https://storefront.test/platform",
      defaultTimeoutMs: 1_000,
      siteVersion: STOREFRONT_SITE_VERSION,
    },
    {
      cookie_reader: () => cookieValue,
      fetch: mock.fetch,
    },
  );
  return { client, mock };
}

export function createExternalIdentityClientTestHarness(cookieValue?: string): ExternalIdentityClientTestHarness {
  const mock = createMockFetch();
  const client = createBrowserExternalIdentityClient(
    {
      baseUrl: "https://storefront.test/platform",
      defaultTimeoutMs: 1_000,
      siteVersion: STOREFRONT_SITE_VERSION,
    },
    {
      cookie_reader: () => cookieValue,
      fetch: mock.fetch,
    },
  );
  return { client, mock };
}

export function createPublicClientTestHarness(): PublicClientTestHarness {
  const mock = createMockFetch();
  const client = createBrowserPublicClient(
    {
      baseUrl: "https://storefront.test/platform",
      defaultTimeoutMs: 1_000,
      siteVersion: STOREFRONT_SITE_VERSION,
    },
    { fetch: mock.fetch },
  );
  return { client, mock };
}

export function createPrizeClientTestHarness(cookieValue?: string): PrizeClientTestHarness {
  const mock = createMockFetch();
  const client = createBrowserPrizeInventoryClient(
    {
      baseUrl: "https://storefront.test/platform",
      defaultTimeoutMs: 1_000,
      siteVersion: STOREFRONT_SITE_VERSION,
    },
    {
      cookie_reader: () => cookieValue,
      fetch: mock.fetch,
    },
  );
  return { client, mock };
}

export function createDrawClientTestHarness(cookieValue?: string): DrawClientTestHarness {
  const mock = createMockFetch();
  const client = createBrowserDrawClient(
    {
      baseUrl: "https://storefront.test/platform",
      defaultTimeoutMs: 1_000,
      siteVersion: STOREFRONT_SITE_VERSION,
    },
    {
      cookie_reader: () => cookieValue,
      fetch: mock.fetch,
    },
  );
  return { client, mock };
}

export function createPointClientTestHarness(cookieValue?: string): PointClientTestHarness {
  const mock = createMockFetch();
  const client = createBrowserPointClient(
    {
      baseUrl: "https://storefront.test/platform",
      defaultTimeoutMs: 1_000,
      siteVersion: STOREFRONT_SITE_VERSION,
    },
    {
      cookie_reader: () => cookieValue,
      fetch: mock.fetch,
    },
  );
  return { client, mock };
}
