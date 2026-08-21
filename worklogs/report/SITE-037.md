# SITE-037 — Authenticated Contact and Support Link

`/contact` is now a Storefront-authenticated route, and My Page sends
`お問い合わせ` to the external Luxe Pack Support origin without changing the
confirmed support-menu order.

- Task: `SITE-037`
- Issue: [#73](https://github.com/ideal-sol/luxe-pack-storefront/issues/73)
- Base SHA: `39fa0df8dda67d8da4b6489faf9515ef3bc3f709`
- Branch: `site/SITE-037-authenticated-contact-support-link`
- Risk: `R3`

## Authentication boundary

- The existing root Session Provider remains the sole authentication authority.
- Session loading mounts only the existing loading state, never the Contact
  Client Provider or form.
- Confirmed unauthenticated and expired Sessions use the established Next client
  navigation pattern to replace the route with exact `/login`.
- Configuration／transport Session failures remain distinct safe error states.
- No Return URL query, Cookie read, direct API request, or independent Auth
  decision was introduced.

## Contact regression

Authenticated users retain the SITE-034 form and Browser-safe Contact Client.
The canonical required／optional field mapping, undisplayed empty `website`
honeypot, 202 receipt code, 422 field errors, 429 rate limit, network／unknown
error presentation, no automatic retry, and synchronous double-submit guard are
unchanged. Platform continues to accept anonymous Contact requests; only this
Storefront route is restricted.

## My Page and SITE-036

The `お知らせ・サポート` rows remain, in order: `お問い合わせ`, `お知らせ`,
`ご利用ガイド`, `利用規約`, `プライバシーポリシー`. The first href is exact
`https://support.luxe-pack.biz/`, never `/contact`, and reuses the established
new-tab HTTPS external-link attributes.

`お届け先登録` remains immediately above `LINE連携`; `/mypage/address`, address
CRUD presentation, registered-address Prize Shipping selection, the zero-address
registration link, and absence of the shipping-dialog `新しいお届け先` CTA are
unchanged.

Platform／Contact Contract／Public OpenAPI／Artifact／DB／Migration／Payment／Admin／
Nginx／DNS／TLS／systemd unit／runtime env changes: `0`.

## Verification

- Frozen install: PASS
- Focused Contact／My Page／SITE-036 regression: PASS (`6` files, `53` tests)
- Artifact／Policy／Auth／LINE／Catalog／Content／Gacha／Draw／Prize／Point gates:
  PASS
- Full Vitest: PASS (`31` files, `258` tests)
- ESLint／TypeScript／production build／secret and PII scan: PASS
- Dependency audit at `high`: no known vulnerabilities
- `git diff --check`: PASS
- Required 5 GitHub checks and fixed-head Fresh Self-review: pending

## Deployment

Source closeout and Application-only Deployment are tracked separately. The
post-closeout deployment may run only after a fresh Runtime／lock／resource／
Artifact compatibility gate under the existing runbook and explicit Human
approval.
