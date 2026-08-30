# SITE-043 — Payment Client alpha.29 Adoption / Card UI Fix

> **Historical report:** Its Issue, Worktree, Task Policy, exact-path, and lock
> evidence records the ceremony used at the time. Those requirements are
> superseded and no longer canonical; see `docs/engineering-governance.md`.

## Governance

- Issue: `#83`
- Branch: `site/SITE-043-payment-client-alpha29-card-ui-fix`
- Base: `main@30c6334c39a7c698dd18fa93243dfd29c2af4cfe`
- Risk: `R4`
- Task Policy: `/etc/ideal-sol/github-app/storefront-task-policies/SITE-043.json`
- Bound `issue_number`: `83`
- Policy validation: PASS through the official Storefront API and Git loaders
- Allowed paths: exact Task Policy paths only; no wildcard or scope expansion

## Canonical Artifact

- Task／version: MIG-094 `2.0.0-alpha.29`
- Compatibility: `package-only`
- Source SHA: `5cde1e0a91151b584de8a63d19efd7b4a15e8ab1`
- Manifest SHA-256: `9e5059d1d098d435d16399d8ce7d60172befb1c2ffe979037bf93ae1c447423b`
- SHA256SUMS SHA-256: `23a1afd8f69eacff43e5b0146259172e93754a542f88fa4294f52deec9c3a944`
- Storefront Client SHA-256: `28e5756000847df3a1a27cf77be3da97beb4aef447486978ee74ecd979b425e1`
- Storefront Testkit SHA-256: `1e976d1cd83c00e79c632636018c57461bc89940640d0de949568cc1769b0b56`
- Public OpenAPI SHA-256: `41ebdddbd7c4edeedd36ad3810b2afa564495aa2d1c3e48a187f44c85deb85da`
- Public OpenAPI version／operations: `2.0.0-alpha.27`／65
- Site Schema: retained `2.0.0-alpha.23`

The canonical Manifest is the latest released immutable entry with no candidate.
Manifest, SHA256SUMS, actual tarballs, package identity/version, compatibility,
inventory, archive paths, regular-file-only entries, lifecycle-script absence,
and Public OpenAPI digest were verified before adoption. MIG-094 is a new vendor
directory; every known MIG-089 alpha.28 digest and inventory entry remains
verified and unchanged. Client and Testkit are exact-pinned to alpha.29.

## Card UI root cause and fix

Card Bootstrap was already canonical and remained unchanged. The failure occurred
inside the exact-pinned official `@fincode/js@1.1.0` Browser loader: its
existing-script lookup constructs a malformed CSS selector. `initFincode()`
therefore rejects before it injects `https://js.test.fincode.jp/v1/fincode.js` or
`https://js.fincode.jp/v1/fincode.js`. SITE-040 caught and discarded the whole
mount chain, leaving the Storefront Card region visible with no input iframe.

The Storefront now loads only the official environment-specific fincode Browser
script before calling the canonical SDK. After successful load it performs the
fixed sequence:

1. `initFincode()` with canonical Bootstrap readiness;
2. `ui.create("payments")` with the retained official Card appearance;
3. connected mount-target verification;
4. `ui.mount()`;
5. mount-success notification that enables purchase.

SDK load, init, UI create, and UI mount errors are represented by a secret-safe
internal stage object. Raw causes and Provider responses are not retained or
logged, and the stage is not rendered. The existing generic error presentation
is reused. Failed load can be retried; unmount, payment-method change, and
Bootstrap change clear the mounted target and provider reference.

- PAN／CVC in Storefront state: zero
- `getFormData()` calls: zero
- undocumented iframe `postMessage`／events: zero
- Public API Key value logging: zero
- Secret／Token／Cookie／Session logging: zero
- Provider raw-response logging: zero

## Payment regressions

- New Card without save retains `source=new`, `save=false`, canonical Payment
  creation, fincode execution, and 3DS redirect behavior.
- Save-and-pay retains registration intent → official `registerCard()` →
  `provider_card_id`／`registration_intent_id` → `startPayment()`; purchase does
  not call registration completion.
- Saved Card preserves Platform order, `can_pay`, `is_expired`, and public
  `card_id` selection.
- PayPay retains canonical start and returned Provider redirect handling.
- Konbini and Virtual Account retain Purchase → Thanks Page → guide →
  `resumeUnpaidPayment(pid)` → existing Provider redirect. Start never redirects
  them directly and resume never creates a replacement Payment or session.
- Alpha.29 resume sends a CSRF-managed JSON POST with exact `{}` body and
  `application/json`; no Storefront raw fetch or 415 workaround exists.
- `requires_action` and `processing` resume are covered for both unpaid methods;
  expired and invalid methods fail closed. ApiProblem and Transport failures use
  safe presentation without fallback Payment creation.
- Purchase history, unpaid history/resume, Wallet refresh, 30-second polling,
  success/failure/cancel Return, and Header Wallet behavior remain covered by the
  full regression suite.

## Local verification

- Fresh Resource Gate before install: PASS
- Fresh Resource Gate before full validation: PASS
- Frozen install: PASS; Client/Testkit installed as exact alpha.29
- Artifact check: PASS
- Policy gate: PASS
- Auth／LINE／Catalog／Content／Gacha／Draw／Prize／Point／Payment boundaries: PASS
- Focused Payment suite: 5 files／62 tests PASS
- Lint: PASS
- Typecheck: PASS
- Full tests: 39 files／358 tests PASS
- Production build: PASS; 19 static pages generated and dynamic routes compiled
- Dependency audit: PASS; no known vulnerabilities
- Secret scan: PASS
- `git diff --check`: PASS

## GitHub and closeout

- Draft PR／Final PR Head／Required Checks／exact-head R4 self-review／Squash
  Commit: completed values are recorded in the final operator closeout after the
  immutable PR head and merge exist.
- SEV-0／SEV-1: none found in local review
- Application-only Deployment: NOT RUN
- Provider Browser E2E: NOT RUN
- Platform／DB／Migration／Nginx／DNS／TLS／systemd／runtime env／fincode Provider
  configuration change: zero
