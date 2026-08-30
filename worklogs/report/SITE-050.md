# SITE-050 — Account Security UI / Artifact alpha.33 Adoption

## Governance and Stage 0

- Change model: one Change／one branch／one pull request
- Branch: `site/SITE-050-account-security-alpha33-resume`
- Base: `main@3e6617ed8c10aec7bd22fca16cbb6ef9a0ee74d3`
- Risk: high-risk Strict Auth／Session／CSRF／Security／Public Contract／Artifact
- Issue／dedicated Worktree／Task Policy／Source Lock: not used under current Git Lite governance

Stage 0 live-read local `main`, `origin/main`, and protected GitHub `main` at the
same Base with a clean worktree. The canonical Storefront remote is
`ideal-sol/luxe-pack-storefront`. Existing Login, My Page Account navigation,
shared form/state components, Session／CSRF Browser transport, route conventions,
Preview activation runbook, and relevant Auth／Payment tests were read before
implementation. Save Card remained hidden, new-card Payment retained `save=false`,
and Payment source scope was not opened.

## Canonical Artifact

The Platform release ledger and publication run were read live without modifying
the Platform Repository:

- latest immutable: `2.0.0-alpha.33`
- candidate: `null`
- alpha.32: retired／published but non-adoptable
- publication run／Artifact ID: `33318307918`／`9734141503`
- publication outer digest: `734b8e36fef261b72ab8013a0656c4a2ca3f1a6c8ea472d817c3b3ae7410e58c`
- source revision: `9867c1ea3bfe0868759ba4e704415698ea603110`
- Manifest SHA-256: `b6522d16230734ea7f4604be59a2585c29bcf03a2b447269e824e712759d893c`
- `SHA256SUMS` SHA-256: `10252bf2cb15f80e2c26fd329c15092517d667267a9cc105ab74b9f5c3649328`
- Client SHA-256: `846b0e036ebf76dd46ab1a2c9d6b67b786f9d2dfe5672d8b3a0eb31b7ad675a2`
- Testkit SHA-256: `720d8cc6a0b1c786267de34af0f1fddefc5a517d5d064491f4a78af2e492df4d`
- Public OpenAPI SHA-256: `9670bc769080da605c97cb9849b61f342cf0111bc39e91c09dbbf62fc4bcc720`

The Storefront directly exact-pins alpha.31 → alpha.33; alpha.32 is never pinned.
Manifest, archive safety, checksums, package／lock identity, generated operation
inventory, and deterministic Testkit fixtures are enforced by the Artifact gate.
Client package, runtime `STOREFRONT_CLIENT_VERSION`, actual
`X-Oripa-Client-Version`, and Manifest Client version are all alpha.33. Testkit
package and Manifest versions are alpha.33. Public OpenAPI intentionally remains
the independent alpha.29 contract with 74 operations.

## Account Security UI

Password Reset adds the forgot-password link immediately above registration,
an enumeration-safe request form／receipt, shared new-password／confirmation
controls, common invalid-link presentation, and success navigation to Login with
a one-time message. Reset completion neither refreshes nor creates a Session and
never logs in automatically.

Email Address Change adds the Account navigation row below address and above
Password Change, with no current-password or Fresh Authentication field. Request
success explains the verification email. Same-browser completion refreshes the
canonical Session after Platform rotation and returns to My Page; cross-browser
completion remains anonymous, mints no Session, and offers Login. Invalid,
expired, used, revoked, superseded, and malformed public states collapse to the
same safe presentation.

Password Change submits only current and new password to the canonical alpha.33
Client, updates immediately, refreshes the canonical Session after rotation, and
returns to My Page. It creates no verification-email, verification-link, pending
change, notification-mail, or independent Password Policy flow.

The shared Password fields own visibility, confirmation matching, accessible
errors, `current-password`／`new-password` autocomplete, loading, and disabled
presentation only. Typed Problem Details map to Japanese UX without exposing
internal codes. Every mutation suppresses duplicate submission; the single-use
complete operations are not automatically retried.

## Token and Session boundary

Platform URL builders were verified to use root query parameters and one-hour
TTL contracts. A local Browser gate found that direct App Router rendering kept
the initial query token in Next's RSC bootstrap. SITE-050 therefore redirects the
root request before render through the Next 16 Proxy to a dedicated route with a
browser-only fragment plus `no-store` and `no-referrer`. Malformed／ambiguous
input does not carry a token to the destination. The Client Component consumes
the fragment once across React Strict Mode, immediately removes it without
copying App Router history state, and retains the value only in React memory for
the one canonical Client call.

Final Browser assertions verify token absence from URL, query, hash, history
state, and DOM markup. Components use no local/session storage, cookie mutation,
console logging, direct `/api/v2` path, or independent auth state.

## Local verification

- Artifact／Policy／all Auth, LINE, Catalog, Content, Gacha, Draw, Prize, Point,
  and Payment boundaries: PASS
- Focused Account Security／Auth／My Page／Route／Session／Public／Payment tests:
  9 files／88 tests PASS
- Full tests: 43 files／445 tests PASS
- Lint／typecheck: PASS
- Production build: PASS; 24 static pages, all dynamic routes, and Next Proxy compiled
- Dependency audit: PASS; no known vulnerabilities
- Secret scan／staged diff check: PASS
- Payment implementation changed paths: zero

Local Chromium 151／Playwright 1.62.0 acceptance uses only safe synthetic API
interception and performs no Platform mutation. Eleven scenarios and seventeen
screenshots cover Login desktop／mobile, Reset request／validation／confirm／invalid／
success, My Page Account order, Email request／same-browser／cross-browser／invalid,
Password Change／mismatch／success, rotated Session refresh, no auto-login, no
horizontal overflow, and zero console／page／request／500／502／504 errors. Evidence
is root-owned under `/var/lib/luxe-pack-storefront-evidence/SITE-050/browser-local`.
The runner host has the same CJK-font limitation as earlier Storefront evidence;
Browser role／text／label assertions verify Japanese content while screenshots
verify layout, responsive geometry, and state presentation.

## Delivery boundary

At source-report time, Pull Request, Required Checks, final-head Fresh self-review,
Squash Merge, merged-main Preview Build／Activation, Shared Preview synthetic E2E,
and Runtime Acceptance are pending and must not be described as passing.
Production Activation is prohibited. Platform Repository／API／Migration／Mail
Template／Artifact publication／Payment business behavior／Save Card behavior／
Nginx／DNS／production mutations are zero.
