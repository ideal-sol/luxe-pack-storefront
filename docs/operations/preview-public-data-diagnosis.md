# Preview public data diagnosis

SITE-016 diagnoses public Preview reads through the pinned
`@oripa/storefront-client` boundary. It does not record response bodies, session
material, request identifiers, or personal data, and it performs only public GET
requests.

Run the repeatable check with:

```sh
pnpm preview:diagnose-public
```

`PREVIEW_ORIGIN` may select another approved HTTPS origin. The script keeps the
runtime-equivalent relative Base URL `/api/v2`, resolves it as a browser would,
and refuses cross-origin requests. Output is limited to the Client-level
classification, HTTP status, retryability, and collection count.

## SITE-016 result

The Preview Platform proxy and pinned alpha.8 Client accepted the current
responses as follows:

| Storefront route | Canonical Client method | Classification |
| --- | --- | --- |
| `/` | `listBanners`, `listGachaCategories`, `listGachas`, `listNotices` | Normal responses: banners and notices empty; category and gacha data present |
| `/gachas` | `listGachaCategories`, `listGachas` | Normal response with display data |
| `/notices` | `listNotices` | Normal response with zero items |
| `/pages/terms` | `getStaticPage` | Platform Problem Details, HTTP 404 |

The same-Origin runtime configuration is available, transport succeeds, and the
Client accepts the response structures used by the adapters. No Storefront
Client, adapter, presentation, or runtime-configuration defect was reproduced.
The generated Client is a typed transport boundary; it does not add a separate
runtime schema decoder, so there is no independent schema-decode failure in this
request path.

The `terms` canonical static page is not published by the Platform Preview. The
Storefront therefore correctly renders its existing not-found state. Notices
correctly render the existing empty state. Neither condition may be hidden with
Frontend fixtures or inferred content.

## SITE-017 Browser runtime finding

An actual headless Chromium run reproduced the reported failure at both
1280x720 and 390x844. Before the fix, the Client made no Public API network
request. Chrome rejected the stored native `fetch` before request dispatch with
`TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation`; the
Client correctly wrapped that exception as a transport error, which produced the
generic failure state.

The Node-based SITE-016 diagnosis did not reproduce this because Node's global
`fetch` does not enforce the Browser `Window` receiver. SITE-017 keeps the
canonical Client intact and supplies a minimal receiver-safe fetch function from
the shared Storefront Browser transport adapter. Runtime configuration, endpoint
selection, response types, and presentation rules are unchanged.

After the fix, Browser verification must show:

- Home and `/gachas`: Public reads return HTTP 200 and three cards render;
- `/notices`: HTTP 200 and the normal empty state renders;
- `/pages/terms`: the known HTTP 404 renders the normal not-found state;
- no transport failure, hydration error, or page runtime error at either
  required viewport.

The same shared transport constructs the authentication adapter. After Preview
deployment, run one approved test-user Login journey and verify the CSRF Session
initialization and Login request reach the Platform. Record status and Cookie／
CSRF presence only; never record credential, Cookie, Token, or header values.
