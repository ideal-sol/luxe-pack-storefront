# SITE-046 — alpha.30 Adoption / Card Merchant Return Integration

## Governance

- Issue: `#89`
- Branch: `site/SITE-046-alpha30-card-merchant-return`
- Base: `main@126816f8e1102749a3b79289c033e003ecac93c1`
- Risk: `R4`
- Task Policy: root-owned mode `0600`, exact 25 paths, wildcard 0
- Official unbound Issue loader and bound write／Git loaders: PASS

## Canonical Artifact

- MIG-096 version／source: `2.0.0-alpha.30`／`4a7703859473f0c3f5e317cfca454cb8dce401ae`
- Manifest: `25667419d9db73a946f48ca1351f2c8b0e9fc1f371508efe2c44b9403852fe5a`
- SHA256SUMS: `5849402d1d7770751683c93d0dfd619edbf33eb7bd262094d6b3ce87948aa363`
- Client: `f44e2da2d427621296f2bb27958ef7b20e217b5b07fbcf6cc342978e2ef9dae6`
- Testkit: `f349b6e07421507ccbdca9a6e0cbc07d79379b444fbe2119b1a92709319e8809`
- Public OpenAPI: `41ebdddbd7c4edeedd36ad3810b2afa564495aa2d1c3e48a187f44c85deb85da`

MIG-096 is adopted as a new immutable directory. MIG-094 alpha.29 remains
byte-for-byte verified. Package identity, five-file formal inventory, custom
public-safe provenance, archive path/link/content safety, lifecycle-script
absence, offline dependency resolution, Public OpenAPI alpha.27／65 operations,
and unchanged OpenAPI bytes are enforced by the Artifact verifier. Client and
Testkit are exact-pinned to alpha.30 in package and lock metadata.

## Card Merchant Return and dispatch

- `fincode_card_component` dispatch uses the canonical alpha.30 discriminant.
- The Platform `return_url` is passed unchanged as fincode `return_url`.
- The Platform `failure_url` is passed unchanged as fincode
  `return_url_on_failure`, matching the official SDK transaction type.
- The official `executePayment()` utility remains the Card-field boundary. A
  scoped fincode instance proxy enriches only its outgoing `payments()` call, so
  Storefront code never calls `getFormData()` or reads raw Card fields.
- fincode response `redirect_url` is used only as the returned 3DS navigation
  target; it is never used as a merchant return destination.
- Redirect／`three_d_secure` actions navigate the exact canonical Action URL.
  Post-start dispatch no longer accepts or consults the pre-start `newCard`
  selection.
- New Card save=false executes the Card Component with Platform returns.
- New Card save=true registers the Provider Card, starts with the canonical
  registration references, then navigates the Platform-returned 3DS Action from
  Platform-side saved-card execute.
- Saved Card retains Platform-side execute and navigates its returned 3DS Action.
- `/cards/success`／`/cards/failure` use: zero. Merchant URL generation or rewrite:
  zero. PAN／CVC Storefront state, storage, or logging: zero.

## Card Registration Intent

The exact alpha.30 Client supplies canonical JSON `body: {}` with
`application/json`, CSRF management, and caller Idempotency Key. The Storefront
adds no fetch, Content-Type, 415, middleware, or completion workaround. Purchase
still does not expose or call standalone Card registration completion.

## Verification

- Fresh and heavy Resource Gates: PASS; root free remained above 26 GiB,
  MemAvailable above 3.7 GiB, inode use 5%.
- Frozen install: PASS; Client／Testkit alpha.30.
- Artifact／Policy／all Auth, LINE, Catalog, Content, Gacha, Draw, Prize, Point,
  and Payment boundaries: PASS.
- Focused Payment tests: 3 files／43 tests PASS.
- Lint: PASS after removing one unused test-mock parameter found by the initial
  lint run; application source was unchanged by that correction.
- Typecheck: PASS.
- Full tests: 40 files／376 tests PASS.
- Production build: PASS; 19 static pages and all dynamic routes compiled.
- Dependency audit: PASS; no known vulnerabilities.
- Secret scan and `git diff --check`: PASS.

Fresh exact-head Required Checks and R4 self-review are required before Squash
Merge. Local SEV-0／SEV-1 findings are zero. Application-only Deployment and
Provider Browser E2E are NOT RUN. Platform／DB／Migration／Webhook／Nginx／DNS／TLS／
runtime environment／fincode Dashboard changes are zero.
