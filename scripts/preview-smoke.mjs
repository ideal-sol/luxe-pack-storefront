#!/usr/bin/env node

const previewOrigin = readHttpsOrigin(
  process.env.PREVIEW_ORIGIN ?? "https://test.luxe-pack.biz",
  "PREVIEW_ORIGIN",
);
const productionOrigin = readHttpsOrigin(
  process.env.PRODUCTION_ORIGIN ?? "https://luxe-pack.biz",
  "PRODUCTION_ORIGIN",
);

const checks = [
  ...[
    "/",
    "/gachas",
    "/login",
    "/register",
    "/notices",
    "/pages/terms",
    "/mypage",
    "/mypage/prizes",
    "/mypage/line",
  ].map((path) => ({
    label: `preview ${path}`,
    url: new URL(path, previewOrigin),
    statuses: [200],
    contentType: "text/html",
  })),
  {
    label: "preview auth session API",
    url: new URL("/api/v2/auth/session", previewOrigin),
    statuses: [200],
    contentType: "application/json",
  },
  {
    label: "preview catalog API",
    url: new URL("/api/v2/gachas?limit=1", previewOrigin),
    statuses: [200],
    contentType: "application/json",
  },
  {
    label: "preview Admin API boundary",
    url: new URL("/admin/api/", previewOrigin),
    statuses: [404],
    contentType: "application/problem+json",
  },
  {
    label: "production storefront non-impact",
    url: new URL("/", productionOrigin),
    statuses: [200],
    contentType: "text/html",
  },
];

const failures = [];
for (const check of checks) {
  try {
    const response = await fetch(check.url, {
      cache: "no-store",
      headers: { Accept: check.contentType },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const actualContentType = response.headers.get("content-type") ?? "";
    const statusMatches = check.statuses.includes(response.status);
    const contentTypeMatches = actualContentType
      .toLowerCase()
      .startsWith(check.contentType);

    if (!statusMatches || !contentTypeMatches) {
      failures.push(
        `${check.label}: expected ${check.statuses.join("/")} ${check.contentType}, received ${response.status} ${actualContentType || "(none)"}`,
      );
      continue;
    }

    console.log(`PASS ${check.label}: ${response.status} ${check.contentType}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    failures.push(`${check.label}: request failed (${message})`);
  }
}

const httpPreview = new URL(previewOrigin);
httpPreview.protocol = "http:";
try {
  const response = await fetch(httpPreview, {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  if (![301, 308].includes(response.status)) {
    failures.push(`preview HTTP redirect: expected 301/308, received ${response.status}`);
  } else {
    console.log(`PASS preview HTTP redirect: ${response.status}`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error";
  failures.push(`preview HTTP redirect: request failed (${message})`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log("preview-smoke: passed");
}

function readHttpsOrigin(value, name) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error(`${name} must be an HTTPS origin without credentials`);
  }
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}
