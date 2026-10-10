# CloudFront asset source preparation (Phase 2)

This change prepares source and local evidence only. No AWS commands, uploads,
object listing, environment-file edits, deployment, runtime switching or merge
are part of Phase 2. Platform Client/Testkit remain exactly 2.0.0-alpha.43.

## Build inputs

- `NEXT_PUBLIC_ASSET_PUBLIC_BASE_URL=https://cdn.example.test`
- `NEXT_PUBLIC_STATIC_ASSET_BASE_URL=https://cdn.example.test/static-assets`

These are synthetic examples. Supply each environment's approved CloudFront
origin (HTTPS, hostname only, no trailing slash/port/credentials/query/fragment).
OLD and NEW use identical source and object keys; only environment configuration
and the Phase 3 upload destination differ. Never use an S3 bucket URL. Keep API
connection variables unchanged. Both `NEXT_PUBLIC_*` values are inlined at build
time: setting, changing or clearing them requires a new Storefront build and
separately authorized activation. Restarting an existing build is insufficient.

Missing dynamic base preserves safe relative paths, including legacy local
namespaces. With a configured base, only `/gacha/`, `/top-banner/`,
`/rank-masters/`, `/rank-effects/` are accepted. Every segment must start with an
ASCII letter, digit, underscore or hyphen; subsequent characters may also contain
dots. Empty segments, dot segments, escapes/percent encoding, whitespace,
backslashes, Unicode, query/fragment and absolute/protocol-relative URLs fail
closed. An invalid dynamic base also yields the existing placeholder (or skips
an unusable representative video to show the result). No alternate URL or
mutation retry is used. Next Image remains unoptimized with no remotePatterns
expansion. Failed image requests retain the existing fallback.

Missing/invalid static base uses the retained local `/brand/` assets. Static
paths must be members of the generated 23-entry manifest. Keep `public/brand/`
until separate Human approval after S3 acceptance. App-name conditions for the
Logo and icon metadata remain unchanged.

## Asset rendering inventory

| API consumer | Shared boundary |
| --- | --- |
| TOP banners (`image_url`) | CatalogAsset |
| Gacha catalog/cards/detail, thumbnail, prize lineup | CatalogAsset |
| Login Gacha list/detail/prizes | CatalogAsset |
| Rank lineup and Draw rank images | RankLineupImage |
| Draw snapshots and aggregate prize images | CatalogAsset |
| Draw history thumbnails | CatalogAsset |
| My Page acquired prizes (`presentation.image`) | CatalogAsset |
| TOP decorative Gacha cards | resolveAssetUrl |
| Representative Draw video snapshot | resolveAssetUrl |
| Notice detail (`asset.path`) | CatalogAsset |

Draw selection, array order, points, idempotency, GET recovery, autoplay/skip/end
and media-error behavior remain unchanged. The resolver never selects a second
video or resubmits a Draw. `result_image_snapshot` is not a current rendering
source; the existing prize thumbnail and rank lineup selection is preserved.

All direct Brand literals in components and icon metadata now use brandAssetUrl.
This includes Header, Footer, home hero/guide/assist, login bonus, public home,
favicon, Apple Touch and Android PWA icons. Root layout and app manifest inherit
the generated icon URLs through their existing `brand-icons` imports.

Notice detail now renders the existing nullable `ContentNotice.asset` through
the same boundary. Text-only Notice list rows remain unchanged. The HTML
sanitizer remains unchanged; uncontracted HTML images remain inert.

## Deterministic Brand migration input

- Manifest: `src/lib/brand-assets.manifest.json` (JSON schema version 1).
- Generate explicitly: `pnpm brand-assets:generate`.
- Verify only: `pnpm brand-assets:check` (also enforced before every build).
- Source root: `public/brand/`.
- Object key: `static-assets/brand/<version>/<relative_path>`.
- Public URL: `<static-base>/brand/<version>/<relative_path>`.

Each entry has `relative_path`, `object_key`, `content_type`, `byte_size`, and
`sha256`. The shared `version` is `sha256-` plus the full SHA-256 of UTF-8 compact
JSON of lexically sorted records, in property order relative_path, content_type,
byte_size, sha256. Paths use `/`; there are no timestamps or environment inputs.
Source bytes are hashed directly. A change to any source file changes the shared
version and all 23 keys. The final manifest is two-space JSON plus trailing LF.

Generation requires exactly 23 regular files (11 root, 9 icons, 3 login-bonus)
and recognizes PNG, ICO, WebP and SVG signatures. Verification recomputes all
entries and rejects missing files, duplicate paths/keys, wrong version/MIME/size/
checksum, stale source and noncanonical serialization. Tests also mutate a
separate temporary copy to prove new keys and deterministic regeneration.
No AWS SDK or upload implementation is included.

## Phase 3 handoff and acceptance

1. Review and approve the source PR separately; Phase 2 leaves it Draft/unmerged.
2. Use this manifest's exact keys and Content-Type for both authorized target
   buckets. Compare local byte sizes and all 23 SHA-256 values immediately before
   migration. Confirm destination identity in that separate task; retain old keys
   and never overwrite different bytes under an existing key (versioning is off).
3. Phase 3 must verify uploaded bytes, size and Content-Type against the manifest
   and test private-origin CloudFront/OAC access and all four dynamic namespaces.
   Confirm Function rejection rules agree with the resolver using valid/invalid
   test paths. Function source was not changed or treated as acceptance evidence.
4. Browser acceptance must use new valid Gacha/Draw/prize data: TOP/list/detail,
   Login Gacha, rank/prize images, result order, points, history and acquired
   prizes; repeat GET display without a new Draw. Check no post-Draw 503/list
   failure, no unexpected external/admin/S3 requests and useful failed-image UI.
5. Play the representative video, test autoplay rejection, Skip, ended/error,
   seeking and actual Range/206 behavior through CloudFront. Local DOM tests do
   not establish media delivery, OAC, CORS, cache behavior or browser decoding.
6. Verify Logo/Mark, all character/login-bonus files, favicon, Apple and PWA icons
   in HTML/manifest and real browser requests. Compare every URL with this exact
   manifest version. Include Notice detail assets in acceptance.
7. Rebuild with approved environment-specific public bases only after uploads
   and AWS acceptance, then follow a separately authorized runtime checkpoint.
   Keep the local files for rollback; clearing a build-time base needs rebuild.

Platform PR #553 remains HOLD/unmerged. OLD test publication, OLD runtime switch,
NEW production activation, legacy fixture repair, DB reset and CSV work are not
authorized here. Preview Runtime and AWS/browser acceptance are deferred, not
reported as passing. Use the normal release policy before any later activation.
