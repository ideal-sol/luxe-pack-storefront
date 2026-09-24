# Prize image presentation verification

The alpha.39 Client/Testkit and Public API alpha.35 provide the image authority
for both screens. Gacha detail filters the returned prize collection by
`rank_id` without sorting it. It shows each prize's `total_inventory` only when
its rank's `show_total_stock` is true. Draw result keeps the returned result
order, reads `prize.presentation_asset` and `rank_lineup_image`, and shows no
inventory badge. Both screens retain the prize placeholder and use the rank
name when its image is unavailable.

Run component and contract checks with:

```sh
pnpm exec vitest run src/test/gacha-detail-ui.test.tsx src/test/draw-result-ui.test.tsx src/test/public-client-contract.test.ts src/test/draw-client-contract.test.ts
pnpm artifact:check
pnpm lint
pnpm typecheck
```

Against an existing development or Preview process, with Playwright available:

```sh
BROWSER_TEST_ORIGIN=http://127.0.0.1:3000 node scripts/verify-prize-images-browser.mjs
```

`PLAYWRIGHT_MODULE` can point to a separately installed Playwright module;
`BROWSER_EXECUTABLE` can select an existing compatible Chromium executable.
No browser dependency is added to the application. The script intercepts every
Platform request, uses canonical testkit fixtures, asserts zero mutations, and
never authenticates a real user or performs a real draw. It checks 1440, 390,
and 320 pixel viewports, image authority, 3/5/2 prize quantities, stock disclosure
OFF, missing images, image containment, card overlap and page overflow. It writes
JSON evidence to stdout and screenshots to `.local/browser` (override with
`BROWSER_TEST_OUTPUT`). Generated fixture images are browser responses only, not
application fallback assets.

Production release authority now separately approves exact Runtime Source
`c911155f2fff5aea0f0b3df4f3184aa4081b6203` with alpha.39; see
[Production provenance](../production-build-provenance.md).
The authority update does not authorize a Production Build or Activation.
