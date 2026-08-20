# SITE-034 Blocked Contract Report

## Outcome

SITE-034 implementation is blocked by the adopted Client's Browser CSRF
boundary. No Contact UI or mutation was implemented, and no unsafe Storefront
fallback was introduced.

- Issue: [#67](https://github.com/ideal-sol/luxe-pack-storefront/issues/67)
- Base SHA: `4098ffbb08018b132e8b14344400c1461c797873`
- Branch: `site/SITE-034-contact-page`
- Risk: `R2`
- Artifact: MIG-063B / `2.0.0-alpha.23`

## Preflight readback

- Local main: `4098ffbb08018b132e8b14344400c1461c797873`
- Origin main: `4098ffbb08018b132e8b14344400c1461c797873`
- GitHub main: `4098ffbb08018b132e8b14344400c1461c797873`
- Open Issue／PR before allocation: `0`／`0`
- Existing SITE-034 record before allocation: `0`
- Shared Locks: all `none`
- Storefront lane: `idle`; the Ledger `Latest main` value was stale at
  `8f0990bcf364d75d25f06c76b048fb06c79ddca6` and was not modified by Site Codex
- Resource Gate: root filesystem had 23 GiB available; memory had 2.0 GiB
  available; Gate passed
- Active Storefront Runtime: healthy systemd service, release
  `8f0990bcf364d75d25f06c76b048fb06c79ddca6`, relative `/api/v2` base
- Active Platform Runtime: healthy OPS-011 API revision
  `0d86972944491bdd3e9716787381e439848d606f`
- Current adopted Artifact: MIG-063B / `2.0.0-alpha.23`; integrity gate passed

The active Storefront Runtime is behind Repository main. Deployment was not
authorized and is not part of this Task.

## Verified Contact Contract

The Artifact and active Runtime provide:

- `POST /contact-inquiries`;
- `createContactInquiry`;
- `StorefrontContentContactClient.submitContact()`;
- anonymous or authenticated access;
- required CSRF, no Idempotency support, no automatic mutation retry;
- canonical field limits and `website` max length zero;
- canonical `202` receipt with `receipt_code`;
- typed Problem Details and explicit `429`.

The active Runtime's Contact OpenAPI, route, controller, and service files match
the Artifact source. No Contact endpoint or schema skew was detected.

## Blocking gap

`submitContact()` requires a Storefront-supplied CSRF token and constructs its
Header before the Browser transport can initialize CSRF and read its Cookie. No
Browser-safe Contact facade is exported. Anonymous first-use submission cannot
therefore be built without moving CSRF／Cookie protocol into Storefront code.

The formal request and resume criteria are recorded in
`docs/platform-change-requests/SITE-034-contact-browser-csrf.md`.

## Safety and scope

- Contact form／My Page link implementation: `NOT RUN` (blocked at Contract Gate)
- Contact mutation／real inquiry creation: `NOT RUN`
- Browser／Desktop／Mobile acceptance: `NOT RUN`
- Application／Preview／Production deployment: `NOT RUN`
- Platform Repository changes: `0`
- Database／Migration／Admin／Mail／Outbox／Payment changes: `0`
- Runtime／Nginx／DNS／systemd／environment changes: `0`

Only public-safe Storefront blocker documentation is included in this
checkpoint.
