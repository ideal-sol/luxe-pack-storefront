# SITE-047 — Card Failure Return Final Screen Fix

## Governance and Stage 0

- Issue: `#91`
- Pull Request: `#92`
- Branch: `site/SITE-047-card-failure-return-final-screen-fix`
- Base: `main@bddff7106a8e710859a94cc07ada9a93b18aa136`
- Lane: Strict Change
- Risk: `R4`
- Activation: immediate
- Task Policy: root-owned mode `0600`, exact five paths, wildcard zero

Task Policy issuance and the fresh post-issuance Stage 0 both read back local
main, origin/main, GitHub main, and the active Storefront Runtime at the exact
Base. Main was clean. SITE-047 had no Issue, PR, branch, worktree, or prior Task
Policy before issuance; open Storefront work and Shared Lock conflicts were
zero. The official unbound Issue loader and bound API-write／Git loaders passed
their fail-closed argument gates.

The active Storefront retains immutable `2.0.0-alpha.30`. Artifact verification
passed. The active MIG-097 Platform API exact revision／image was healthy with
restart zero. Direct and Storefront same-origin session, one-item Gacha, and
Point Product reads each returned HTTP 200 with redirect zero. OPS-023 sanitized
Runtime acceptance and closeout evidence were live-read as PASS. No secret value
or response body was read or recorded.

## Root cause and implementation

The Platform failure Return already sends the Browser to the Coin purchase page.
`PaymentReturnAlert` then read the canonical Payment and treated `succeeded`,
`created`, `requires_action`, and `processing` as a reason to call
`window.location.replace()` for the Thanks page. The latter statuses are valid
race observations before the Platform terminalizes the Provider failure, so the
client navigation replaced the Human-approved failure final screen.

SITE-047 removes that Thanks navigation, its injectable replacement callback,
and the redirecting state. The purchase page remains mounted and converges on
the canonical failure copy for the race states and terminal `failed`, including
after unmount／remount. It does not expose the Thanks processing presentation.
Canceled／expired and invalid／mismatched／unreadable Payment containment retain
their existing safe copies.

The component still performs only `getPayment()` to correlate the public
Payment reference and Point Product. It has no Payment or Coin mutation. Browser
Return is not promoted to Payment authority, and normal success Return still
enters the existing Thanks route through the Platform-owned success Return URL.

## Focused coverage

The focused Payment status suite covers:

- failure Return `failed`, `succeeded`, `created`, `requires_action`, and
  `processing` with canonical failure copy and no processing presentation;
- pending-to-terminal remount with the purchase page retained;
- zero source path to the Thanks route and zero `window.location` use;
- normal success Thanks presentation;
- PayPay, Konbini, and Virtual Account regression behavior;
- invalid `pid` containment without a read;
- Card registration, Card deletion, unpaid resume, Payment start, and Coin-side
  mutation count zero.

## Verification

- Frozen install: PASS; Client／Testkit `2.0.0-alpha.30`
- Artifact verification: PASS
- Task Policy gate: PASS
- Payment boundary: PASS
- Focused Payment status UI: 1 file／29 tests PASS
- Focused ESLint: PASS
- Typecheck: PASS
- Auth／LINE／Catalog／Content／Gacha／Draw／Prize／Point／Payment boundaries: PASS
- Full tests: 40 files／386 tests PASS
- Production build: PASS; 19 static pages and all dynamic routes compiled
- Dependency audit: PASS; no known vulnerabilities
- Secret scan and `git diff --check`: PASS
- Changed paths: exact five Task Policy paths; wildcard／scope escape zero
- Fresh exact-head R4 self-review and GitHub Required Checks: pending final head

## Scope and delivery boundary

Changed source scope is limited to the Return alert, focused status tests, and
the three canonical records. Platform Return URL／303 Location, API／Artifact
contracts, PayPay／Konbini／Virtual Account implementation, Save Card, Platform,
Admin, PostgreSQL, Redis, Nginx, DNS, TLS, Provider configuration, and production
payment are unchanged.

Application-only Deployment may run only after Squash Merge and exact equality
of local main, origin/main, and GitHub main at the Squash Commit. It builds and
activates only the affected Storefront application. The prior verified release
is the rollback target. Provider Browser E2E is not run by Codex; after Runtime
acceptance, Human acceptance uses new post-MIG-097 Payments for both failure
ceremonies and verifies purchase page retention, failure copy, Thanks navigation
zero, terminal Payment failure, and Coin Grant zero.
