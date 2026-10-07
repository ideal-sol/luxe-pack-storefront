# Storefront Production Readiness Shadow Classifier

Machine Policy operational approval is **HUMAN_APPROVED** for
`1.1.2-operational-approved`.
This classifier is SHADOW ONLY. Blocking authority, CI skipping, Fast Lane
Production use, Phase 2, promotion and Production Human GO are not enabled.
Application behavior, Platform source and artifact pins are unchanged.

For separate Human finalization, durable PR evidence, whole-window auditing and
the Phase 1 Exit evaluator, see [SHADOW-LEDGER.md](SHADOW-LEDGER.md).

## Offline use and authority

```bash
node scripts/readiness/classifier.mjs \
  . <full-base-sha> <full-head-sha> /tmp/readiness-shadow.json [handoff.json]
pnpm exec vitest run src/test/readiness-classifier.test.mjs
```

The Git reader requires a clean exact-head checkout and a complete ancestor diff.
Both source trees are read without checkout, network or runtime access. The
output file must not already exist. No handoff means Platform impact is unknown.
Optional handoff v1.0 fields are `repository`, `base_sha`, `head_sha`, `tree_sha`,
`platform_impact=NONE`, `evidence_reference`, `confirmed_by_role=human_operator`,
and `record_digest`. All identities and the digest must match. The Human-assisted
transport is trusted; hashes provide integrity, not authentication. A supplied
`machine_policy` cannot override classifier policy.

Classification records bind policy version/digest, impact-map version/digest,
repository, base/head/tree and the entire record. Canonical representation is
sorted object keys, ordered arrays, compact UTF-8 JSON and one trailing LF;
`record_digest` itself is excluded when sealing a record.

The PR changing this tooling receives `NORMAL_STRICT_CI` in **both** candidate
and fallback fields, including observations without a Platform handoff. The
Platform independently requires its Platform-NONE and complete-diff facts before
consuming this record. It chooses Full if those external proofs are unavailable.
No branch-supplied policy, including a synthetic approved test policy, can cause
this shadow implementation to emit an operational Minor lane. Future operational
use requires Human-approved policy version/digest on protected main and separate
Formal Gate evidence; it is not enabled by this PR.

## Four states and fallback

| State | Meaning |
| --- | --- |
| ELIGIBLE | The supported presentation-only conditions are proved; Minor candidate only |
| NOT_ELIGIBLE | Parsed evidence proves a change outside Minor |
| UNCLASSIFIED | Parser, import, style dependency or unsupported construct prevents proof |
| INDETERMINATE | Required complete-diff, baseline or Platform evidence is absent |

With independent Platform NONE evidence, failed Minor classification falls back
to Normal Storefront Release. Platform impact present or not excluded falls back
to Full Platform + Storefront Release. Gate, policy, classifier, map and related
Gate test/tool changes use Strict as described above. Ineligibility is not HOLD.
Formal Required Check, Contract, Artifact, provenance or authority failures remain
Readiness failures handled by their existing Gate consumers.

ELIGIBLE does not establish Production READY. Operational policy approval,
Platform NONE proof, Required Checks, artifact/provenance, Stage and Human GO
remain required. This tool produces none of READY, Human GO or Activation.

## Executable policy

`minor-policy.v1.json` supplies class allowlists, source/authority path patterns,
copy attributes, native HTML element names, CSS properties and bounds, selector/media restrictions, image formats, fallback lanes and acceptance viewports. These
values are consumed by classification; tests mutate policy values to verify the
binding. Parser syntax checks remain implementation details, not second policy
allowlists. Unrecognized CSS syntax stays UNCLASSIFIED.

`text_only_copy` accepts literal JSX text, literal JSX string children, and the
policy-listed native-element display attributes (including placeholder and
accessibility text). The wording's subject does not exclude it: payment errors,
confirmation, authentication, SMS, draw and terms text are eligible when only
presentation leaves change. Existing conditions/handlers may surround the text,
but changing any of those AST nodes rejects the combined diff. Arbitrary strings
in call arguments, payloads or custom component props are not assumed to be copy.

TS AST comparison preserves element/attribute/tree structure and all other
leaves. It rejects handlers, hooks/effects, state writes, control flow, navigation,
API calls, payload construction, mutations and auth/payment/security helpers.
AST ancestry and call/property node categories provide diagnostic categories;
identifier matching alone never grants eligibility. Unsupported class/style
expressions are UNCLASSIFIED. The same checks apply in critical zones.

Native HTML elements can receive eligible literal class/style changes. Custom
components (including member expressions and custom elements) remain UNCLASSIFIED:
this implementation does not prove presentation forwarding. A native element
with `is` or spread attributes also lacks that proof. Existing pure text support
is unchanged.

Literal class changes must resolve every added/removed token in both source
trees to declarations containing only allowed properties and values. Unresolved
imports, generated utilities or complex style dependencies are UNCLASSIFIED;
there is no spacing-utility naming shortcut. Every stylesheet selector must be
fully parsed before being excluded from a class change. The initial grammar
recognizes only `.simple-class` and `.simple-class:hover`. Attribute selectors,
escapes, combinators, selector lists, nesting and functional pseudo-classes are
UNCLASSIFIED, including selectors whose relation to the changed token is unclear.
Related declarations still undergo the existing property/bounds checks. This
restriction applies to class-token resolution; safe CSS value comparisons retain
their existing policy. AST-detected JS selector/classList
usage prevents treating behavioral classes as presentation. Literal inline styles
must contain only static property assignments, without spreads or variables.

## CSS V1

Allowed properties are color, background-color, border-color; all four margin
and padding sides and their shorthands; gap/row-gap/column-gap; border-radius;
font-size, line-height, font-weight and letter-spacing.

| Property | Bounds |
| --- | --- |
| Margin/padding/gap | 0–128px; 0–8rem/em; no negatives |
| Font size | 10–64px; 0.625–4rem/em |
| Line height | 0.8–2.5 unitless; 0.75–6rem/em |
| Letter spacing | −2–4px; −0.1–0.2em |
| Border radius | 0–999px; 0–50rem/em |
| Font weight | CSS numeric grammar 1–1000 or normal/bold |

The color parser recognizes policy-enumerated hex, named and comma RGB(A) forms.
Values such as unresolved calc/var, unknown units or unsupported color forms are
UNCLASSIFIED. Both old and new values must be safe. Only existing declarations'
values may change. Property/selector/block addition, deletion or reorder is
Normal. Existing media blocks permit safe value changes and contribute their
exact conditions to focused browser acceptance. Media condition/breakpoint
changes are Normal, as are reduced-motion contexts.

Visibility, display, pointer events, opacity, overflow, clipping, positioning,
z-index, transforms, order, animation, transition, dimensions, grid templates,
flex direction/wrap/alignment and font-family remain Initial Normal. Global reset
selectors (:root, html, body, *), focus/disabled/error/confirmation/operational
selectors and font-face are Initial Normal. Unchanged unsafe declarations elsewhere
in a file do not prevent a safe value change. `globals.css` and
`theme-oripoke.css` are mapped and eligible for safe selectors;
`font-noto-sans-jp.css` remains Initial Normal.

## Source images and external asset operations

Same-path PNG/JPG/JPEG/WebP content replacement can be a Minor candidate. Both
versions are decoded using the existing pinned Next image tooling and must match
the extension's format. Changed bytes alone do not reject an image. The diff
must contain only same-path image modifications, with no reference/code/config
changes. Impact must resolve through mapped source paths or importing routes.
SVG, path additions/deletions and changed code references remain Normal.

Admin/API-managed prize images, rank images, banners, draw result images and
presentation videos are outside this source classifier. S3 fixed-URL object-byte
replacement is outside GitHub Release/Gate and has no classifier adapter.
Production and OLD Test use separate objects/URLs. URL configuration,
NEXT_PUBLIC values and build-time environment changes are source/build-input
changes and take Normal Storefront Release.

## Impact and focused acceptance

The map contains the 21 Human-confirmed areas, grounded in tracked paths. Empty
symbol arrays and blanket per-domain shared dependencies have been removed.
Static import/re-export/dynamic-literal-import edges propagate affected paths
through both trees. Literal local JSX image references and CSS imports are
included. Unresolved imports are UNCLASSIFIED.

The only manual edge is Next's filesystem relation from `src/app/layout.tsx`
to App Router pages, which is not expressed as an explicit TS import. Global
styles imported by the layout therefore reach actual pages. Critical paths mark
business logic zones and enrich the record; they do not forbid pure copy/CSS.

Acceptance is generated per changed file's affected area and actual change
classes. It does not enumerate every domain/state combination. Changed media
conditions are included, and CSS retains pending Human browser acceptance at
mobile/desktop viewports. No browser acceptance is fabricated.

## Existing contracts and verification

The Strict compatibility fixture reproduces `storefront_strict_record` plus
source/digest binding from Platform
`b90a1b931d29755c40f81a030712a7d2fdc7cf57`. It checks typed arrays and evidence,
Human-approved policy, both Strict lanes and disabled blocking/CI skip. Negative
fixtures ensure malformed identities, lists, digests and authority fields fail.
Platform source is not modified.

`adapters.mjs` retains existing offline Required Check/source/provenance consumers.
The artifact verifier retains the immutable Platform Client/Testkit alignment;
this change adopts no artifact. Normal CI retains its existing gates; the Shadow
ledger extends readiness-shadow evidence transport without changing its lanes.
Source rollback is a reviewed revert PR; no runtime activation is required.

## Archive-compatible regression inventory

`source-inventory.v1.json` is the explicit packaged `src/` inventory, generated
from tracked paths. The same two source-grounding tests compare filesystem files
to that inventory, reject symlinks/missing/extra files, and run all 21-area/path
and real-source import-graph assertions in both checkout and `git archive`.
They never require `.git`, skip an archive test, or use untracked files as
grounding. When packaged source paths change, refresh this test fixture from
`git ls-tree -r --name-only HEAD src` and review the inventory delta. This test
fixture does not replace the classifier's exact Git diff/source-tree authority.
