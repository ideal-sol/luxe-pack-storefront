# Advertising Last Click attribution

AGENCY-004B captures a single `ad_code` query parameter on ordinary Storefront
routes from the shared root layout. Codes are eight case-sensitive ASCII
alphanumeric characters. The generated alpha.36 Identity Client validates them
through the existing browser Platform transport. Only `{ valid: true }` stores
or refreshes the candidate. Invalid, suspended, malformed, missing and failed
validation never clear or replace a valid candidate. A slower older response
cannot replace a more recent valid click.

`oripa_ad_last_click` stores only the Advertising Code, with `Path=/`,
`Max-Age=2592000`, `SameSite=Lax`, `Secure` on HTTPS and no Domain. It is readable
by the browser because registration and LINE initiation use the existing browser
client. Browser expiry is the only persisted TTL authority. Registration success
does not delete it. Cookie access failure omits attribution without blocking use.
There is no consent UI, advertising banner, Agency display or alternate storage.

Email registration reads the current cookie immediately before calling the
canonical generated registration method. An absent or malformed cookie contributes
no field. Password login remains unchanged. Platform revalidates the optional
`advertising_code` during new User creation and owns immutable attribution.

## Existing external identity scope

Protected main at task start offers LINE account linking, with no Google or LINE
login/registration initiation UI. Human confirmed that this task applies to the
existing LINE link initiation and adds no UI. That request includes the current
optional candidate; Platform ignores it for account linking and creates no
attribution for existing Users. Reauthentication and callbacks remain unchanged.
This task does not enable external-provider new User registration.

## Verification and Human acceptance

Focused tests cover Last Click order, same-code refresh, expiry, exact case,
invalid/stopped/error preservation, route navigation, unrelated cookies,
registration request omission/inclusion, and existing LINE/login regressions.
Browser acceptance uses isolated API mocks for mutation requests. Live smoke
uses read-only HTTPS requests only. No QA Agency creation, automated real User
registration, mail, SMS, payment or Production activation is part of acceptance.

After technical acceptance, Human Browser Acceptance remains PENDING:

1. Use an existing active QA Agency in Admin and read its Advertising Code.
2. Visit `https://test.luxe-pack.biz/?ad_code=<code>` and confirm ordinary
   rendering, no Cookie consent popup, and the Last Click cookie.
3. If two existing QA Codes are available, visit A then B and verify B is retained.
   Invalid or code-less navigation must preserve it. Otherwise use automated
   tests as the authority for the two-Code scenario.
4. Register a new QA User through email/password and confirm the outgoing
   `advertising_code`. Human performs any real email confirmation.
5. Verify immutable attribution and the provisional User count in both Admin
   and Agency Portal User aggregates after email verification.
6. If an existing QA SMS flow is available, Human may verify that SMS moves
   provisional counts to full registration, including historical aggregates.
7. Optionally use an existing Test Payment flow to check Sales aggregates.
   Platform isolated tests already cover attributed succeeded Payments;
   real payment is not required for Storefront technical acceptance.

Never include QA Code values, credentials, email addresses or other PII in reports.
