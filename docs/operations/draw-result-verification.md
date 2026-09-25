# Draw presentation and full-results verification

## Contract and behavior

Minimum and adopted Client/Testkit bundle: `2.0.0-alpha.40`; Public OpenAPI:
`2.0.0-alpha.36`. Immutable Artifact `10845475225`, workflow `36089413205`,
Platform source `dadf79f3b0b2409a57e41b10a83c7b6570ea3507`.
See `vendor/oripa/DRAW-20260925/PROVENANCE.md` for exact digests.
Original alpha.39 artifacts and Production approval metadata remain unchanged.

The page fetches `getDrawRequest` through the generated browser client. Loading,
login, not-found and retryable-error UI remain. Once loaded:

- A usable top-level `presentation.video_snapshot` displays one video.
- Results and summary are not mounted during presentation.
- Ended, Skip or media error unmounts video and displays all results.
- Null, absent, non-video or unusable-path presentation proceeds to results.
- Same-page rerenders retain the completed phase. A new mount fetches again and
  starts presentation again. A different request ID starts with loading.

The existing same-origin media-path check, native controls, `playsInline` and
`preload="metadata"` convention are retained. Playback uses native controls;
autoplay is not required to reach results because Skip is always available.
No video fallback, Rank comparison, current Master lookup or mutation is added.

Every `results` entry is rendered in API order, without slicing, sorting,
pagination or virtualization. `high_rank_results` is used only for the existing
legacy fallback when `results` is absent. An empty `results` array stays empty.
No historical backfill or reconstruction is performed.

Cards retain Prize images, Rank lineup/name, Prize names and sequence information.
Per-card `video_snapshot` remains in the generated Contract but creates no video
or source element and issues no media preload request.

## Focused verification

`pnpm exec vitest run src/test/draw-result-ui.test.tsx` covers A–T:
loading, representative-only rendering, Ended/Skip/Error, null/absent/non-video,
no card videos, 1/10/100/1000 entries, high-rank independence, API ordering,
rerender stability, fresh mount and no Rank inference. Count cases parse JSON
through the actual generated Client using the Testkit mock transport.

`pnpm artifact:check` verifies immutable digests, manifest provenance,
Client/Testkit alignment, generated types and schema caps (results 1000,
high_rank_results 20). `pnpm draw-boundary:check` rejects per-card video,
result slicing/sorting and Rank inference patterns.

Production provenance tests retain frozen alpha.39 dependency excerpts from
approved source `c911155f2fff5aea0f0b3df4f3184aa4081b6203` and verify that
current alpha.40 dependencies are rejected by the unchanged Production gate.
This change does not authorize a Production build release or activation.

## Implementation verification evidence

- Draw Result focused UI: 27 tests passed, including Session refresh stability.
- Full local suite: 644/645 passed; the pre-existing Coin Product first-load
  query timed out under concurrent build/test load. Its isolated rerun passed
  all 12 tests; the unchanged protected-main baseline also passed 12 tests.
  No Coin Product source or timeout setting was changed.
- Artifact, all boundary/policy/security checks, frozen install, TypeScript,
  ESLint and production build passed.
- Isolated Chromium on that production build passed real media completion,
  Skip, safely intercepted media 404, direct reload, 100 and 1000 cards.
  Mobile 390px and tablet 768px stayed within the viewport. 1000-card order
  and final-card reachability passed; page errors, per-card media requests
  and API mutations were zero. No virtualization or performance cap added.
- The runner has no Japanese system font; screenshot typography is not Human
  visual acceptance. Japanese accessible labels and actions were verified.

## Shared OLD Test acceptance gate

Shared integration acceptance is pending Platform OLD Test activation. Before
Storefront activation, verify that the active Platform source contains
`dadf79f3b0b2409a57e41b10a83c7b6570ea3507` and has the new response behavior.
Do not change Platform runtime from this Storefront task.
Then follow `docs/operations/preview-deployment.md` for the merged Storefront.

Use a non-production QA account and new Draws whose Platform responses contain
presentation and full results. The browser URL is
`https://test.luxe-pack.biz/draws/{response.id}/result`; use each actual QA response
ID, not a historical compact Draw. Record those exact URLs at activation.

1. Multiple-result Draw: one representative video, results absent while playing.
2. Play to completion: all results appear, including Prize image and Rank.
3. Separate Draw: Skip immediately reveals all results; video stays removed.
4. Safely intercepted media 404: results appear with no fallback video.
5. 100 Draw: 100 cards; 1000 Draw: 1000 cards, in response order.
6. Cards have no video/source elements or video requests.
7. Reload: a new GET and presentation; same-page rerender: no replay.
8. Check mobile and tablet widths and the existing result action links.

A local production-build browser with intercepted synthetic responses can verify
rendering, media events and responsiveness before Platform activation. It is not
shared OLD Test integration acceptance. Human Browser Acceptance and explicit
Human GO remain required before Production activation. ENV, secrets and migrations
are outside this change.
