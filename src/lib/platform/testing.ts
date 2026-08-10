import { createMockFetch, type MockFetchController } from "@oripa/storefront-testkit/mock";
import { createBrowserAuthClient } from "./auth-client";
import { createBrowserPublicClient } from "./public-client";
import { createBrowserPrizeInventoryClient } from "./prize-client";
import { STOREFRONT_SITE_VERSION } from "./runtime-configuration";

export interface AuthClientTestHarness {
  readonly client: ReturnType<typeof createBrowserAuthClient>;
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

export function createPrizeClientTestHarness(): PrizeClientTestHarness {
  const mock = createMockFetch();
  const client = createBrowserPrizeInventoryClient(
    {
      baseUrl: "https://storefront.test/platform",
      defaultTimeoutMs: 1_000,
      siteVersion: STOREFRONT_SITE_VERSION,
    },
    { fetch: mock.fetch },
  );
  return { client, mock };
}
