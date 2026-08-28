# SITE-044 — Credit Card UI Browser Fix / Konbini Unpaid Error Copy

## Governance

- Issue: `#85`
- Branch: `site/SITE-044-credit-card-ui-browser-fix`
- Base: `main@7fae62be0d841d9db5b319acc2b7cf381a46277d`
- Risk: `R4`
- Task Policy: `/etc/ideal-sol/github-app/storefront-task-policies/SITE-044.json`
- Bound `issue_number`: `85`
- Policy validation: PASS through the official Storefront API and Git loaders
- Allowed paths: 12 exact paths; no wildcard or scope expansion

## Canonical Artifact

- Adopted version: `2.0.0-alpha.29`
- Source SHA: `5cde1e0a91151b584de8a63d19efd7b4a15e8ab1`
- Manifest SHA-256: `9e5059d1d098d435d16399d8ce7d60172befb1c2ffe979037bf93ae1c447423b`
- Storefront Client SHA-256: `28e5756000847df3a1a27cf77be3da97beb4aef447486978ee74ecd979b425e1`
- Storefront Testkit SHA-256: `1e976d1cd83c00e79c632636018c57461bc89940640d0de949568cc1769b0b56`
- Public OpenAPI SHA-256: `41ebdddbd7c4edeedd36ad3810b2afa564495aa2d1c3e48a187f44c85deb85da`
- Compatibility: `package-only`

MIG-095 is an API-only Platform change and did not publish a replacement
Storefront Artifact. Client and Testkit remain exact-pinned to alpha.29; package,
lockfile, and vendor content are unchanged.

## Credit Card actual root cause and fix

SITE-043 fixed a real first-stage failure in the official `@fincode/js@1.1.0`
wrapper loader: its existing-script lookup could build a malformed selector.
That diagnosis was incomplete. After the Storefront preload bypassed that loader
failure, the official Browser runtime's `ui.mount(elementId, width)` synchronously
looked up both `elementId` and `${elementId}-form`. The Storefront rendered only
the first element. The runtime therefore attempted `setAttribute` on a missing
form element and threw before creating the iframe. The Storefront also passed
`"100%"`, although the runtime parses a numeric pixel width and clamps it to
250–768.

The Card component now renders the exact form wrapper and nested mount target,
waits for Browser load readiness, passes a measured and clamped numeric width,
and accepts mount success only after a connected iframe exists. Cleanup cancels
pending readiness, clears the Provider reference and target, and reports the UI
unmounted. Payment method and Bootstrap changes continue to remount through the
React lifecycle. Responsive CSS keeps the official iframe within its container.

The official environment-specific SDK URLs and canonical sequence are retained:
`initFincode({ publicKey, isLiveMode })` → `fincode.ui(...)` →
`ui.create("payments", ...)` → `ui.mount(elementId, numericWidth)`.

- Infrastructure／CSP／Nginx involvement: none found
- PAN／CVC in Storefront state: zero
- `getFormData()` calls: zero
- undocumented iframe events／`postMessage`: zero
- custom Card inputs: zero
- Public Key, Token, Cookie, or Provider raw-response logging: zero

## Konbini canonical error mapping

Only current Payment Method `konbini` plus canonical
`ApiProblemError.code === "KONBINI_UNPAID_LIMIT_REACHED"` maps to:

`コンビニ決済の未払いがあるため、コンビニ決済を使用できません`

The mapping does not inspect title, detail, message, or HTTP status. Other
ApiProblem codes, transport failures, PayPay, Virtual Account, and Credit Card
retain existing presentation. The Storefront does not prefetch unpaid history or
reimplement the Platform business rule. Unpaid selection, history, Thanks,
resume, and MIG-095 contracts are unchanged.

## Verification

- Fresh Resource Gate before install and full validation: PASS
- Frozen install: PASS; alpha.29 retained
- Artifact verification: PASS
- Task Policy gate: PASS
- Auth／LINE／Catalog／Content／Gacha／Draw／Prize／Point／Payment boundaries: PASS
- Focused Payment suite: 4 files／50 tests PASS
- Lint: PASS
- Typecheck: PASS
- Full tests: 40 files／374 tests PASS
- Production build: PASS; all 19 static pages and dynamic routes compiled
- Dependency audit: PASS; no known vulnerabilities
- Secret scan: PASS
- `git diff --check`: PASS

Coverage includes SDK load, init, UI create, mount and render success/failure;
target lifecycle; cleanup and remount; Strict Mode-equivalent remount; method and
Bootstrap changes; iframe-gated purchase usability; new Card save=false and
save=true; saved Card; exact Konbini mapping and negative method/error cases;
PayPay; Virtual Account; purchase/unpaid history; Header Wallet; and the existing
non-card regression suite.

## Delivery boundary

- Fresh exact-head R4 self-review and Required Checks are required before merge;
  immutable PR and merge identifiers are recorded in the final operator closeout.
- SEV-0／SEV-1 found locally: zero
- Application-only Deployment: NOT RUN
- Provider Browser E2E: NOT RUN
- Platform／DB／Migration／Nginx／runtime env change: zero
