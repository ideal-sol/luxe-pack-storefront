# SITE-045 — Temporarily Hide LINE Link UI

## Outcome

The user-facing LINE account-link entry is temporarily absent from authenticated
My Page. The underlying direct route and complete LINE integration remain in the
Storefront for later re-exposure.

- Issue: [#87](https://github.com/ideal-sol/luxe-pack-storefront/issues/87)
- Base SHA: `1fcc9bd3e46414b7755fb75628ee60c1c8937927`
- Branch: `site/SITE-045-temporarily-hide-line-link-ui`
- Risk: `R4`
- Task Policy: exact 6 paths, wildcard 0

## Implementation and presentation

- Removed only the LINE entry from `myPageAccountNavigation`.
- `/mypage` does not render a LINE menu link or label.
- Mobile at 375 pixels and desktop at 1440 pixels retain the single Account row
  for `お届け先登録`, with the shared existing spacing and no empty menu node.
- Purchase History, Coin History, Draw History, Prize, Support, and Logout
  navigation remain unchanged.
- No feature flag, conditional runtime configuration, 404, redirect, or broad
  refactor was introduced.

## Preserved LINE boundary

- `accountNavigation` retains `{ href: "/mypage/line", label: "LINE連携" }`.
- `lineAccountRoute` remains exact `/mypage/line`.
- `publicRoutes` and the Next.js production build retain `/mypage/line`.
- The LINE page, API Client, external-identity Contract, Friend State Contract,
  callback processing, account-link implementation, and existing Contract tests
  remain present.
- Platform, Provider configuration, DB, migration, Payment, and Coin changes are
  zero.

## Local verification

- Fresh and heavy Resource Gates: PASS; root free remained 27 GiB, available
  memory approximately 3.9 GiB, and inode use 5%.
- Official Task Policy write and Git loaders: PASS.
- Artifact and Policy gates: PASS.
- Auth／LINE／Catalog／Content／Gacha／Draw／Prize／Point／Payment boundaries: PASS.
- Focused tests: 5 files／34 tests PASS.
- Lint: PASS.
- Typecheck: PASS.
- Full tests: 40 files／376 tests PASS.
- Production build: PASS; all 19 static pages and dynamic routes compiled, with
  `/mypage/line` retained.
- Dependency audit: PASS; no known vulnerabilities.
- Secret scan: PASS.
- `git diff --check`: PASS.

Fresh exact-head Required Checks and R4 self-review are required before Squash
Merge. SEV-0／SEV-1 found locally: zero. Application-only Deployment is NOT RUN.
