# SITE-021 100／1000 Draw availability

## Status

**Resolved by MIG-062I／MIG-062J and Production Artifact `2.0.0-alpha.10` on
2026-08-13.**

The historical alpha.9 blocker analysis below is preserved. MIG-062I aligned
the Backend-managed Draw Count setting and MIG-062J published the versioned
Storefront Contract from source Head
`ed57eca709c9a49fc5bb5ffa9903a84573052077`.

Alpha.10 keeps `allowed_draw_counts` Backend-authoritative: `1` is required and
`5`／`10`／`100`／`1000` are optional management settings. Presentation continues
to return configured requested counts even when current remaining units are
below one of them. Draw execution receives the selected requested count and the
Backend alone decides canonical `executed_count` after revalidating sale,
audience, eligibility, daily limit, remaining units, inventory, and Point.

The new Testkit partial-remaining fixture proves one coherent boundary:

- Presentation counts: `[1, 100, 1000]`;
- requested count: `1000`;
- canonical executed count: `900`;
- final sale state: sold out;
- same-key replay: requested `1000`, executed `900`.

SITE-021 consumes that generated fixture without applying `min(requested,
remaining)` or hiding options based on remaining units. The result UI displays
canonical execution count and, only when the values differ, separately records
the selected requested count. Point cost, Prize aggregates, and result facts
remain generated response values.

## Historical blocker record

**Blocked on the Platform／Preview configuration as of 2026-08-12.**

MIG-062G Production Artifact `2.0.0-alpha.9` models `100` and `1000` as
valid generated Draw counts, but the authenticated Preview Presentation for the
only currently drawable Gacha returns only `[1, 5, 10]`. The Storefront already
renders every value returned in `allowed_draw_counts`, so adding local buttons
would bypass the Backend authority and is not an acceptable workaround.

No Draw mutation, Preview data change, Platform change, or Frontend behavior
change was made during this audit.

## Task context

- Storefront Task: `SITE-021`
- Issue: `#41`
- Risk: HIGH (`R3`)
- Base SHA: `20759b799584ab7a3d95f098d23b97f087f86b6b`
- Artifact: MIG-062G `2.0.0-alpha.9`
- Artifact source Commit: `36220b5c08820741b4763363a7e86c18274b9688`
- Preview origin: `https://test.luxe-pack.biz`

The Artifact Manifest, bundled `SHA256SUMS`, all three package archives, and
Public OpenAPI passed the Repository integrity check before this audit.

## Contract audit

The generated contract already publishes:

- `getGachaPresentation(gachaId)` with generated
  `allowed_draw_counts` items restricted to `1 | 5 | 10 | 100 | 1000`;
- `createDraw(gachaId, drawCount, options)` with generated `DrawCount` of
  `1 | 5 | 10 | 100 | 1000`;
- canonical caller-owned Idempotency Key input and Browser-managed CSRF;
- `getDrawRequest(drawRequestId)` for canonical result recovery;
- typed Draw problems covering Point insufficiency, audience eligibility,
  daily-limit rejection, non-drawable／paused sale state, count insufficiency,
  invalid requests, Idempotency conflicts, authentication, CSRF, and rate
  limiting.

The OpenAPI request union and Client method signature therefore allow 100／1000.
This is necessary but not sufficient evidence that a particular Gacha/User may
execute those counts: Presentation and mutation-time Backend validation remain
authoritative.

The alpha.9 Testkit's successful Draw fixture represents a 1000-count completed
Draw, and the generated Client Contract test can submit 1000. However, its
eligible Presentation fixture returns only `[1, 5, 10]`. It does not currently
provide one coherent fixture proving that 100／1000 are first advertised by
Presentation and then accepted by mutation-time validation.

## Preview observation

An authenticated, read-only Browser audit covered all five Gachas currently
returned by the Preview Catalog. No identifier, title, Prize content, response
body, credential, Cookie, Token, or PII was retained.

- all five Presentation reads returned HTTP 200 and decoded successfully;
- sold-out, ended, authenticated-ineligible, and coming-soon items returned an
  empty allowed-count array, consistently with their Backend state;
- the one authenticated, eligible, CTA-enabled, on-sale item returned exactly
  `[1, 5, 10]`;
- its rendered buttons were exactly `1`, `5`, and `10`, matching the canonical
  response;
- no item returned `100` or `1000` in `allowed_draw_counts`.

The eligible Preview Presentation reports the Backend's explicit unlimited
daily-limit representation. This alone does not authorize a large Draw. Point,
inventory, remaining-unit, count, eligibility, sale, and daily-limit checks must
still be performed by the Draw mutation.

## Storefront assessment

`GachaDrawPanel` initializes from the first returned count and maps
`presentation.allowed_draw_counts` directly to the option buttons. It passes the
selected generated `DrawCount` to the canonical Browser Draw Client with the
existing one-operation Idempotency Key behavior. It does not filter out 100 or
1000 and does not maintain a local allowed-count list.

Consequently, the missing Preview options are not a Storefront defect. The
Frontend must not append 100／1000 while the Platform returns only 1／5／10.

## Platform-side requirement

The Platform should make 100 and 1000 Backend-authoritative allowed Draw counts
for the human-approved Gacha configurations that support them. Without
prescribing a new endpoint, response shape, database design, or internal rule,
the published behavior must ensure:

- the existing Presentation read includes `100` and `1000` in
  `allowed_draw_counts` only when that User/Gacha combination may select them;
- the existing Draw mutation accepts those advertised counts and performs its
  canonical sale, audience, eligibility, daily-limit, remaining-unit,
  inventory, and Point validations again at mutation time;
- a Presentation count is never advertised if the corresponding mutation is
  categorically unsupported for that Gacha configuration;
- race/stale state remains a typed Backend rejection rather than a Frontend
  inference;
- existing Idempotency, duplicate-submission, and result-read semantics are
  unchanged;
- existing 1／5／10 behavior remains compatible.

The generated Artifact/Testkit should include a coherent eligible Presentation
fixture advertising `[1, 5, 10, 100, 1000]` together with deterministic 100 and
1000 mutation/result coverage. Error fixtures should continue to demonstrate
Backend rejection when Point, daily limit, eligibility, sale, or available
inventory does not permit the requested count.

## Safe Preview acceptance

Before a real 100／1000 Preview Draw, Platform operations must explicitly provide
a Preview-only QA User and Synthetic Gacha with all of the following prepared:

- Presentation advertising both 100 and 1000;
- enough canonical Point balance;
- sufficient remaining units and Prize inventory;
- a daily-limit state that permits the requested count;
- deterministic, non-production Prize fixtures;
- approval that the resulting state changes are disposable Preview QA data.

The Storefront task must not create or alter those fixtures. Once available, the
acceptance journey is: read Presentation, select the returned count, execute one
Idempotent Draw, obtain the canonical Draw Request public ID, and confirm the
completed result through `getDrawRequest`. Reports must omit credentials,
Cookies, Tokens, PII, and Prize contents.

## Historical resume criteria

SITE-021 may resume when both 100 and 1000 are returned by the canonical Preview
Presentation for an approved QA fixture and the Platform confirms that the same
fixture is safe for mutation-time acceptance testing. MIG-062I／MIG-062J satisfy
the Contract portion; Preview mutation remains conditional on a confirmed safe
QA fixture.
