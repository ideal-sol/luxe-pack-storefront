# SITE-PREREG-V14-20261016 Source / Draft Handoff

Lane: Strict Change. Risk: R3. Application Runtime Activation: deferred.
Human authorization stops at Source, tests and a Draft PR. Human review is pending.

## Authority

- Site base: `1c368f61fa53ccd09a344c041eeae63e089aa102`.
- Platform Source PR #571: `c4efbee32a7846bc94f7375d0d5f71779aa0ac77`.
- Platform ledger PR #574 / verified main: `b5c28015ef94cb80f6702a61b1237cacd91d9863`.
- Published bundle / Client / Testkit: exact `2.0.0-alpha.45`.
- [Publication run 38866011951](https://github.com/ideal-sol/oripa/actions/runs/38866011951), attempt 1, artifact `12031381227`.
- Public API `2.0.0-alpha.41`, 81 operations; Site Schema `2.0.0-alpha.23` retained.
- Original ZIP, Manifest, checksums, tarballs and Public OpenAPI verified against
  the Human handoff and immutable ledger (25 entries; candidate null).
  Exact digests are in `vendor/oripa/PREREG-V14-20261016/PROVENANCE.md`.
- Human integrated v1.4 document SHA256:
  `36b838fd2cb73e41f8a8df72e03195f39096b3001f6688dfd81e3f354fb61414`.
- Design patch SHA256:
  `3298434b2550e11f40a2fd76bf471a38aa61f1797e1d45f291fa9ea2530261da`.
  The supplied ZIP and all seven listed checksums passed.

## Source behavior

`/pre-register` uses the typed `preRegister` operation. The published request
permits only full_name, birth_date, email, password and optional advertising_code.
The Platform fixes the verification redirect to exact `/pre-register/sms`;
sending redirect_path in this request would be invalid. Resend explicitly uses
that exact path. Normal register and external identity operations stay separate.
Required inputs, password limits, consent links and safe Backend validation
errors are retained. Age and cutoff authority remain in Laravel.

Campaign status controls the application form: not_started / accepting / closed.
Closed campaigns link to normal registration. Browser time and design copy never
determine acceptance. A pending opaque user ID in the application URL restores
the email resend notice after reload; it authenticates nobody and grants nothing.
Email, birth date, password, OTP and verification tokens are not persisted there.

Email completion reads Backend applicant status before choosing dedicated or
ordinary SMS. Login preserves the fixed preregistration return path; pending
applicants resume dedicated SMS. Activated / ineligible members without an
explicit preregistration return keep ordinary member navigation.
Session loss and API failure show safe login / retry recovery.

Dedicated SMS reuses the existing component, OTP polling, cooldown, resend,
phone re-entry, phone-change reauthentication and session refresh. It omits the
My Page return link. Completion reads the bonus status before navigating.
The thanks route reads private Backend status on entry and retry; anonymous,
ordinary, email-pending, SMS-pending, ineligible and failed reads cannot display
the completed design. Pre-registered and awaiting-activation states explicitly
say no coins have been granted. Activated state displays the actual Backend
amount, grant time and expiry. No wallet/point mutation is implemented here.

## Basic authentication handoff

The machine-readable design inventory is
`docs/operations/pre-registration-v14-basic-exceptions.json`.
It is documentation, not a deployed access-control configuration.

- Public pages: /pre-register, /pre-register/sms, /pre-register/thanks, /login,
  /password-reset, /password-reset/confirm, /pages/terms, /pages/privacy,
  /verify-email, /verify-email/error and the actual
  /verify-email/{userId}/{hash} completion route.
- For same-origin proxying only, prefix the inventory's exact API paths with
  /api/v2. These include campaign and private bonus status, session / CSRF
  bootstrap, dedicated signup, password login, verification resend/completion,
  password reset, SMS send/status/resend/verify and password reauthentication.
- Legal content additionally requires GET /api/v2/content/pages/terms and
  GET /api/v2/content/pages/privacy. Advertising capture only requires GET
  /api/v2/advertising-code-validation when ad_code is present.
- Asset paths: /_next/*, /brand/*, /fonts/* and the existing CDN /static-assets/*
  resources used by these screens. No new CDN or S3 operation is authorized.
- The API subdomain receives no new Basic authentication. Existing session,
  CSRF, Origin, permissions and rate limits must remain enforced.
- Do not exempt normal /register, member routes, coin purchase, gacha routes
  or the ordinary home page. Do not publish unrelated /pre-register/* pages.

Password reset has an existing additional server landing: Platform allows only
redirect_path=/ and sends /?password_reset_user_id={uuid}&token={64-hex}.
The existing Next proxy immediately redirects to /password-reset/confirm with a
browser fragment, Cache-Control: no-store and Referrer-Policy: no-referrer.
Before activation, the web delivery operator must allow only this GET /
request with exactly those two singleton, shape-valid query values through to
that proxy. The normal GET / stays behind Basic. Do not broaden the Platform
allowlist, copy tokens into another query, log raw reset URLs, or open all of /.
This conditional landing is part of the pending Basic delivery acceptance.

The three preregistration pages and recovery / legal pages use a small branded
shell with no protected navigation. Wallet/header/footer polling is not mounted
there. Normal Storefront pages retain the existing member-access shell.
The three preregistration pages are dynamic, revalidate=0 and noindex/nofollow;
verify downstream delivery/cache headers before public activation.

## Brand assets and operational inputs

All original 23 files keep their bytes and object keys:
`static-assets/brand/sha256-5d603bd6eab81d6ddca776af3a5a875a9c4840859e1f57c054047f29f081df63/`.
Only the following new files use
`static-assets/brand/sha256-6f32debad818f4907f5eb1593c8a7a0e31b2cc2edfb2f1f7f1d9f813f1e89c5d/`:

| File | MIME | Bytes | SHA256 |
| --- | --- | --- | --- |
| sd_orika_touroku.webp | image/webp | 17756 | fb3b8c421ee8eb7679f86a981aa41e6b64c5e12d9d88744a88d32d5c9e691ddb |
| sd_pokezou_coin.webp | image/webp | 18616 | 1a486e5a66a242d6ac60a1883121c066a6f6b83b08d19c4657be05f716426791 |

Local fallbacks and brandAssetUrl remain available. Upload, MIME/hash readback
and CloudFront HTTP 200 for the new two objects are PENDING. Do not copy,
overwrite or delete the original 23 objects.

The approved 500コイン / 11月1日（日）copy remains. Real OPEN time is UNSET
in this task; Human must compare operational settings with the copy before
activation. The copy is not an acceptance or grant clock. Fixed copy about
pre-OPEN purchase restrictions is presentation; this change adds no API block.
Actual bonus amount is also shown from campaign / activation responses.

X reference: https://x.com/oripoke_jp — confirm the final operational account.
LINE: NEXT_PUBLIC_OFFICIAL_LINE_URL is read at build time. Only a valid HTTPS
URL without embedded credentials renders a button; unset / invalid means hidden.
Human provides the actual URL and separately authorizes any build/ENV change.

## Human browser / environment acceptance (PENDING)

After a separate Human environment GO:

1. Verify Platform Migration 000087 / settings through Platform operations;
   this Site task creates and applies zero migrations.
2. Verify the reviewed Source and alpha.45 compatibility before deployment.
   The existing alpha.44 Production approval remains unchanged and must reject
   this new Source until a separate approval updates the authority.
3. Apply and test the minimum Basic exceptions above, including the conditional
   password-reset landing and blocked ordinary routes. Verify noindex, no-store,
   CSS/JS/fonts/images and new CDN objects.
4. With synthetic accounts, perform dedicated signup -> real email ->
   dedicated SMS -> wrong code / resend / phone re-entry -> thanks.
   Retry expired / invalid / already-used email links; the original application
   URL retains its opaque user ID for email resend. A completely lost pending ID
   cannot be recovered from the current generic Platform error redirect:
   the error screen instructs use of the original registration screen.
5. Confirm logged-out direct thanks, ordinary signup, late SMS, API failure,
   reload, login resume, password reset and phone-change reauthentication.
   Check pre_registered / awaiting_activation / activated separately.
6. Check 320/360/390/719/720/721/1280px, keyboard focus, no horizontal overflow,
   no protected-menu links and LINE unset / valid URL behavior.
7. Separately authorize OPEN settings, Basic removal and Admin batch activation.
   No SMS-time or automatic OPEN-time 500pt grant is expected.

Real email/SMS delivery, deployed Basic behavior, S3/CDN delivery, Human Browser
and Preview Runtime Acceptance remain PENDING until that separate task.

## Rollback and scope

Source rollback is a reviewed revert PR to the recorded Site base. Keep old
immutable bundles / brand objects and the current Production authority intact.
No merge, auto-merge, release/tag, deployment, deployed runtime, AWS/S3, Basic,
ENV, database, migration or Platform write is authorized or performed.
Required Checks and existing Security Gate are unchanged.

The existing production artifact workflow had a single-prefix / 23-file Brand
assertion. Its source assertion now requires the approved 25-file version and
exact old/new per-file keys; negative tests reject moved old keys, wrong new
prefixes and duplicate paths. No workflow dispatch or production authority
change is part of this task.
