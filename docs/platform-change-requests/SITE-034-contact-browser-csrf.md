# SITE-034 Contact Browser CSRF boundary

## Status

**Blocking SITE-034 as of 2026-08-20.** MIG-063B
`@oripa/storefront-client` `2.0.0-alpha.23` publishes the Contact endpoint,
generated request and receipt types, and `StorefrontContentContactClient`, but it
does not publish a Browser-safe Contact mutation boundary.

This record does not propose an endpoint, Cookie name, token format, Backend
rule, or retry policy. The Storefront will not work around the missing boundary.

## Verified task context

- Storefront Task: `SITE-034`
- Issue: `#67`
- Base SHA: `4098ffbb08018b132e8b14344400c1461c797873`
- Artifact: MIG-063B `2.0.0-alpha.23`
- Artifact source Commit: `633b41f347083c82028229d6e238842118635feb`
- Public OpenAPI SHA-256:
  `5c735fe26514d5bfb47b3515ead108bf473fd5e1f81e0936b7e1986290904043`

The Artifact Manifest, `SHA256SUMS`, archives, Public OpenAPI, package identity,
and installed dependency pins pass the repository Artifact gate.

The active healthy Platform API Runtime is OPS-011 revision
`0d86972944491bdd3e9716787381e439848d606f`. Its Contact OpenAPI, public route,
controller, and service files are byte-identical to the Artifact source. The
Runtime exposes `POST api/v2/contact-inquiries`; no Contact-specific version
skew was detected.

## Contract already available

The Public OpenAPI defines:

- `POST /contact-inquiries` / `createContactInquiry`;
- anonymous or authenticated access;
- required CSRF parameter;
- no Idempotency Contract and no supported Idempotency Key;
- Backend rate limits;
- required `name`, `email`, `subject`, `body`, and `website` fields;
- optional nullable `phone`;
- `202` `ContactInquiryReceipt`, including canonical `receipt_code`;
- generic typed Problem Details and an explicit `429` response.

The generated `StorefrontContentContactClient` defines
`submitContact(input, options)`. It maps the canonical body and marks the POST
request as `csrf: "required"` without adding Idempotency or retry behavior.

## Blocker: Browser CSRF ownership gap

`submitContact()` requires a non-optional `options.csrf_token`. Its generated
facade validates that token and constructs `X-XSRF-TOKEN` before delegating to
the transport.

The generated Browser transport can initialize CSRF, read the canonical Cookie,
and add the header when the caller has not already supplied one. However, no
Browser-safe Contact client is exported that lets `submitContact()` use this
transport-owned token. On a first anonymous visit, the Storefront cannot invoke
the facade without obtaining a token before the transport performs its own CSRF
initialization.

The Storefront cannot safely satisfy this by:

- reading or parsing the CSRF Cookie in a React Component or Site adapter;
- calling the CSRF initialization endpoint directly;
- duplicating the Cookie name, token format, or header protocol;
- passing a fabricated token and intercepting or rewriting the generated request;
- bypassing `submitContact()` with a handwritten `/api/v2` or transport request.

Those alternatives would move Platform-owned security protocol into the public
Storefront and would not preserve the required anonymous Browser flow.

## Requested Platform capability

Publish an immutable, versioned Storefront Artifact with a Browser-safe Contact
mutation boundary. It must:

1. expose the canonical Contact request and `202` receipt types;
2. keep CSRF initialization, Cookie reading, credentials, and Header construction
   inside `@oripa/storefront-client`;
3. invoke the canonical Contact operation without requiring Storefront code to
   supply or parse a CSRF token;
4. preserve no automatic retry and no Idempotency Key for Contact submission;
5. preserve anonymous and authenticated access and typed Problem Details; and
6. provide deterministic Testkit coverage for CSRF initialization, the Contact
   request body (including `website: ""`), `202`, validation, `429`, and
   transport failure.

An additive `createBrowserStorefrontContentContactClient()` or another
Client-owned documented mechanism can satisfy this request; SITE-034 does not
prescribe the Platform implementation.

## Resume criteria

SITE-034 can resume when the adopted, integrity-verifiable Artifact provides the
Browser-safe capability above and the active Platform Runtime implements the
same Contact Contract without version skew.

Until then, `/contact`, the My Page link, form, adapter, and mutation tests remain
unimplemented. No Platform, Runtime, infrastructure, database, Admin, mail,
Outbox, or deployment change was made by this checkpoint.
