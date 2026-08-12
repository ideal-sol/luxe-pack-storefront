#!/usr/bin/env node

import {
  ApiProblemError,
  StorefrontTransportError,
  createStorefrontCatalogClient,
  createStorefrontContentContactClient,
} from "@oripa/storefront-client";
import { createBrowserStorefrontClient } from "@oripa/storefront-client/browser";

const previewOrigin = readHttpsOrigin(
  process.env.PREVIEW_ORIGIN ?? "https://test.luxe-pack.biz",
);

const browserFetch = (input, init) => {
  const url = new URL(String(input), previewOrigin);
  if (url.origin !== previewOrigin.origin) {
    throw new Error("The diagnostic refuses cross-origin requests.");
  }
  return fetch(url, init);
};

const transport = createBrowserStorefrontClient({
  base_url: "/api/v2",
  cookie_reader: () => undefined,
  default_timeout_ms: 10_000,
  fetch: browserFetch,
  site_version: "0.1.0",
});
const catalog = createStorefrontCatalogClient(transport);
const content = createStorefrontContentContactClient(transport);

const checks = [
  ["home banners", () => content.listBanners(), ({ items }) => items.length],
  ["home categories", () => catalog.listGachaCategories(), ({ data }) => data.length],
  ["home/catalog gachas", () => catalog.listGachas({ limit: 6 }), ({ data }) => data.length],
  ["home/notices", () => content.listNotices({ limit: 10 }), ({ items }) => items.length],
  ["static page terms", () => content.getStaticPage("terms"), () => 1],
];

let unexpectedFailure = false;
for (const [label, operation, countItems] of checks) {
  try {
    const result = await operation();
    const count = countItems(result.data);
    const classification = count === 0 ? "normal-empty" : "normal-data";
    console.log(`${label}: ${classification} status=${result.metadata.status} count=${count}`);
  } catch (error) {
    if (error instanceof ApiProblemError) {
      console.log(`${label}: platform-problem status=${error.status} retryable=${error.retryable}`);
      continue;
    }
    unexpectedFailure = true;
    if (error instanceof StorefrontTransportError) {
      console.log(`${label}: transport-error category=${error.code}`);
    } else {
      console.log(`${label}: client-adapter-error type=${error?.constructor?.name ?? "unknown"}`);
    }
  }
}

if (unexpectedFailure) process.exitCode = 1;

function readHttpsOrigin(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("PREVIEW_ORIGIN must be an HTTPS origin without credentials.");
  }
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}
