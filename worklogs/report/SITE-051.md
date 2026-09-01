# SITE-051 — Rank Master / Gacha Rank alpha.34 Adoption

## Governance and Stage 0

- Change model: one Change／one branch／one pull request
- Branch: `site/SITE-051-rank-alpha34-adoption`
- Base: `main@f66110ec72c1c574e210e5515551723f21bf7202`
- Risk: high-risk Strict breaking Public Contract／Artifact／Draw presentation
- Issue／dedicated Worktree／Task Policy／Source Lock: not used under Git Lite governance

Stage 0 fetched the Storefront remote and confirmed local `main` and
`origin/main` at the same Base, zero ahead／behind, and a clean worktree. The
starting exact pin was `@oripa/storefront-client` and Testkit
`2.0.0-alpha.33`. Rank-related Gacha detail, Prize presentation, Draw request／
result／history, animation media, fixtures, boundary gates, Auth, Account
Security, Point, and Payment consumers were read before implementation.

## Canonical Artifact

The live Platform release ledger, publication metadata, immutable payload,
Manifest, checksums, source, Public OpenAPI, generated Client, and generated
Testkit were read and verified without mutating the Platform:

- latest immutable: `2.0.0-alpha.34`
- candidate: `null`
- source revision: `576c35137946e5effcda63d6bf750d5ecc41150f`
- publication run／Artifact ID: `33395772059`／`9759273312`
- Artifact name: `oripa-storefront-contract-2.0.0-alpha.34`
- publication digest: `sha256:c6927b367f9d1ad1a5602792873da481405dc8c3d9c1ba12bbca1954c4e4c8fb`
- Manifest SHA-256: `42f4bee68b787dac16d07accee1c6154c7cea392c521c41b14461d6b56221464`
- `SHA256SUMS` SHA-256: `555ae3637e71a57bff447aa084d21e649b598c878f64766b9f044d1e59f75355`
- Client SHA-256: `3363ebf849e3c7165b89ea9f037c681ab889d16539ce290383cad41d31c134c6`
- Testkit SHA-256: `07916ff69e2e6882aa0e62ee676a65652382413f14f65459ba4e773a41f8a440`
- Public OpenAPI SHA-256: `27d0cdcee9194989058573d7e198066fa4af62017a0f301117ea4af034e733f0`

The Storefront now exactly pins the immutable alpha.34 Client and Testkit from
`vendor/oripa/MIG-099`. The Artifact gate verifies Manifest and payload hashes,
archive package identity, release metadata, 75 generated operations, runtime
Client version／request header coherence, canonical Rank and Draw fields, and
the exact Public OpenAPI delta. Existing alpha.33 evidence remains only as a
retained immutable predecessor; alpha.33 runtime dependency and lock resolution
are forbidden.

## Canonical Rank presentation

Gacha detail consumes `GachaDetail.ranks` directly as the authoritative public
Rank set. It neither reconstructs the Rank Master nor synthesizes Prize-zero
Ranks. Returned Ranks are stably presented by `display_order`, then `rank_id` as
a deterministic tie-break, while preserving the existing Gacha detail layout.

Each Rank uses only canonical `rank_name` and `lineup_image`. The existing asset
component provides the image optimization and broken-image fallback. Setting
total stock is rendered only when `show_total_stock === true` and `total_stock`
is non-null; zero remains valid. No remaining inventory, Prize count, or
available quantity is used to recalculate it. `current_video` is not played or
fetched for Gacha detail decoration.

Legacy `RankDisplay`, `rank.code`, nested `rank.prizes`, and
`presentation_assets` consumption have been removed rather than adapted. Prize
classification is not reconstructed from legacy identifiers.

## Draw snapshot presentation

Draw Result consumes the alpha.34 response snapshots only:

- `rank_name_snapshot` for the displayed Rank name
- `result_image_snapshot` for the Rank result image
- `video_snapshot` for playback

It does not read the current Rank Master name, Gacha lineup image, or current
Gacha Rank video and performs no current Master／video fetch. The existing Draw
ordering, aggregate Prize result, point-back result, request, count, balance,
retry, and transition semantics remain unchanged. Snapshot video retains
controls, inline playback, metadata preload, and no forced autoplay. A media
failure removes only that video; the snapshot name, image, Prize result, and
completion actions remain available.

Typed regression fixtures model an old Draw whose current Rank reference has
already changed. They prove that the old snapshot name, result image, and video
remain the only presentation sources and that no extra Platform read occurs.

## Safety and verification

Focused coverage includes canonical Rank inclusion, `display_order`, Rank name,
lineup image and fallback, stock ON／OFF／null／zero, snapshot name／image／video,
current-reference isolation, video-failure fallback, existing Draw flow, Prize
presentation, and boundary rejection of legacy assumptions. Broader regression
includes Auth, Password Reset, Email Change, Password Change, Account Security,
Point／Coin, Card, PayPay, Konbini, Virtual Account, and Save Card disabled
behavior. Save Card remains hidden and Card purchase continues to send
`save=false`; no real Payment transaction is performed.

Final local Artifact／Policy／boundary／lint／typecheck／full-test／production-build／
dependency-audit／secret／diff results are recorded in the delivery Closeout.

## Activation HOLD

Technical implementation and isolated automated acceptance are in scope.
Shared Preview and Production Storefront routing, service, revision, and API
targets are unchanged. Platform migrations `000069`／`000070` are not applied.
Platform, Payment business, Account Security, SMS, LINE, Coin, Draw Domain Core,
Nginx, and DNS mutations are zero.

Shared Preview E2E and Human Browser Acceptance remain HOLD until Infrastructure
proves Preview／Production `/api/v2` target isolation, applies Platform migrations
`000069`／`000070` to Shared Preview, and activates Platform API／Admin Preview.
Only then may a separate authorized task activate Storefront Preview. Production
Activation remains prohibited.

## Delivery boundary

At source-report time, Pull Request, Required Checks, exact final-head Fresh
self-review, Squash Merge, and post-merge cleanup are pending and must not be
described as passing. They are completed and reported from immutable GitHub and
Git readback in the final task Closeout.
