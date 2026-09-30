# Design reference

## Reference

The canonical Luxe Pack Storefront design reference is <https://oripaone.jp/>.
Its screen composition, layout, and responsive behavior guide the Storefront.
Implementation should prioritize delivery speed and reproduction accuracy.
General UI structures, spacing, navigation, card composition, and short UI labels
may be used as strong references while keeping every asset boundary replaceable
with Luxe Pack-specific materials.

The public layout at <https://oripaone.jp/> was reviewed on 2026-08-06 as a
structural reference.

Observed principles used in SITE-001:

- clear registration and login actions near the top;
- a compact set of category and service destinations;
- a card-oriented landing area and concise information section;
- persistent mobile navigation for primary destinations;
- a responsive hierarchy that keeps actions reachable on narrow screens.

SITE-003 applies the same reviewed structural reference more strongly to the
public data surfaces:

- horizontally scrollable, wide banner cards near the top;
- compact pill-style category filtering;
- a dense two-column mobile catalog expanding to three and four columns;
- tall image-first cards with rounded corners, restrained shadows, tags, price,
  and returned stock counts;
- section headings with concise list-navigation actions;
- persistent mobile navigation and visible keyboard focus.

The list density above records the SITE-003 implementation at that time. SITE-010
supersedes its column count for current implemented screens: gacha cards use one
image-led column on mobile and two columns on desktop, matching the later verified
work reference without changing the Catalog contract.

The task-supplied, misspelled `oripone.jp` hostname did not resolve during
SITE-003. This sentence preserves the historical access record; the correct
canonical design-reference URL is <https://oripaone.jp/>. That reference was
protected by an automated browser challenge during re-check, so SITE-003 relies
on the prior reviewed observations recorded above rather than claiming a new
pixel comparison.

## Luxe Pack interpretation

Luxe Pack uses an original ink, ivory, and bronze visual system, typographic wordmark, CSS-generated geometric placeholder, and independent Japanese copy. No logo, image, source code, or wording from the reference site is included.

The placeholder artwork is deliberately replaceable. Catalog and banner assets
use Platform-provided paths when available; missing or non-image assets use a
neutral Luxe Pack CSS placeholder. Pixel-perfect comparison is not a SITE-003
acceptance criterion; responsive hierarchy, reusable components, dense catalog
rhythm, and accessible navigation are.

## SITE-009 content surfaces

The verified ORIPAONE notice and document layouts inform structure and responsive
rhythm while Luxe Pack keeps its own routes and canonical Platform content:

- `/notices` uses date, title, optional important status, dividers, chevrons, and
  cursor continuation in a compact row list;
- `/notices/[noticeId]` uses a back link, publication time, clear H1, and readable
  article body;
- `/pages/[slug]` uses an approximately 800-pixel centered document column,
  hierarchical headings, paragraphs, lists, links, and generous section spacing;
- mobile content uses approximately 12–16 pixels of effective edge spacing and
  full-width list rows.

ORIPAONE route names, brand content, legal text, and long-form copy are not reused.
Only the Platform-returned Luxe Pack `body_html` is rendered through the safe
content boundary.

## SITE-004 gacha detail

The verified detail-screen observations guide the Luxe Pack composition without
adopting ORIPAONE routes, assets, product copy, or business rules:

- breadcrumb, large main visual, title, returned badges, facts, and progress;
- attention/terms accordion populated only by returned Luxe Pack content;
- rank-ordered prize sections with a responsive two-column mobile and
  three-column desktop grid;
- accessible prize overlay with large fallback-capable image, title, Close,
  Escape handling, focus return, and background-scroll suppression;
- fixed bottom CTA above Mobile Navigation, with safe-area spacing and an
  approximately 800-pixel centered desktop interior;
- explicit sold-out, ended, coming-soon, eligibility, and daily-limit messages
  from the MIG-061Y presentation response.

The UI uses Luxe Pack's existing ink, ivory, and bronze system. Draw counts are
not copied from the reference: only `allowed_draw_counts` returned by Platform
are shown.

## SITE-007 prize inventory

The verified ORIPAONE inventory observations inform the one-column card rhythm,
image/status hierarchy, individual and bulk selection controls, and mobile action
tray stacked above Bottom Navigation. Desktop remains an approximately 800-pixel
centered reading column; mobile keeps compact 12–16 pixel effective spacing and
safe-area bottom padding.

Luxe Pack retains `/mypage/prizes`, its own visual system, generated Platform
statuses, and “ポイント” terminology. No reference product, image, route, or
business rule is copied. Status tabs are intentionally omitted until Platform
publishes a canonical grouping; the design does not turn a visual reference into
a Frontend state model.

## SITE-010 visual and responsive convergence

SITE-010 applies the verified work observations consistently across the current
Home, Catalog, Detail, Auth, Content, and Prize inventory surfaces:

- primary route content uses an approximately 800-pixel centered desktop reading
  width, while Auth forms remain a calmer 560-pixel column;
- mobile content uses 12–16-pixel effective rhythm where available, a compact
  52-pixel Header, and safe-area-aware Bottom Navigation stacking; desktop uses
  a 60-pixel Header;
- Home banners center a primary card while allowing adjacent content to remain
  discoverable, and category/filter rails scroll only inside their own boundary;
- gacha lists use one image-led column on mobile and two columns on desktop;
- shared cards, forms, state panels, dialogs, and notifications reuse consistent
  radius, border, shadow, focus-ring, and touch-target treatment;
- Gacha Detail keeps its returned-state logic and places its Sticky CTA above
  Mobile Navigation; Prize inventory does the same for its non-mutating bulk tray;
- Notice and legal-document content retains date/title/divider/chevron hierarchy,
  readable long-form spacing, and locally scrollable tables.

The convergence is presentation-only. It does not introduce a UI library, copy
ORIPAONE assets or content, alter Luxe Pack routes, or reinterpret any Platform
sale, eligibility, Draw, Session, or Prize action contract.

## SITE-DESIGN-001 オリポケ brand theme

The customer-delivered design package `oripoke-design-20260928` (HTML/CSS,
1280/390 px screen images, `spec.md`) is the canonical visual reference;
`html-css/pages/common.css` is its source of truth.
Its measured values are applied as a separate brand layer,
`src/styles/theme-oripoke.css`, loaded after the structural `globals.css`:

- color tokens: teal `#00BEB1` family, yellow `#FFCA37`, ink `#173A3C`, pale
  `#F2FBFA`; primary actions use the teal gradient, purchase/draw emphasis uses
  the yellow gradient;
- Noto Sans JP (variable 100–900, OFL-1.1) served from `public/fonts/noto-sans-jp/`
  through `src/styles/font-noto-sans-jp.css`, with Hiragino as fallback; no
  external font host. The former serif and monospace display styles are replaced;
- breakpoints follow the package (600/780/980/1180 px): gacha grid 1/2/3
  columns, content width 1180 px with 14/20 px gutters, header 64/74/88 px;
- white Header with a teal bottom rule, brand mark image plus the
  `NEXT_PUBLIC_APP_NAME` wordmark, pill-shaped Coin balance;
- Home adds a static main visual (`HomeHero`) with brand characters, catalog and
  guide actions, and a feature ribbon whose motion stops under
  `prefers-reduced-motion`;
- gacha cards use boxed facts, a remaining-units bar and a decorative detail
  action (hidden from assistive technology because the image and title already
  link to the same detail);
- page titles become a full-bleed teal band; Detail, Draw result, Coin, Prize and
  My Page surfaces adopt the same tokens.

The package's screens map to existing routes: ガチャ一覧 `/gachas`, ガチャ詳細
`/gachas/[slug]`, 開封結果 `/draws/[drawRequestId]/result`, マイページ `/mypage`,
発送依頼 `/mypage/prizes`, ポイント購入 `/points`, 会員登録 `/register`. Header and
Footer keep the navigation set confirmed in #115; unresolved links in the package
(FAQ, contact, login) resolve to the CMS footer pages, `/contact` and `/login`.
Its 390 px images are the desktop CSS rendered narrow, so mobile layouts that
break there (tables, four-column plans) use the existing stacked components.

Motion (SITE-DESIGN-003) follows the package's `top.html`: every keyframe is
ported as `oripoke-*` CSS, the banner carousel auto-advances every 3.4 s with a
pause control, card frames use a presentation-only price tier, and
`prefers-reduced-motion` stops all motion and carousel autoplay.

Brand images (`public/brand/`) are the client's fixed site assets only. Sample
gacha banners and card images in the design package are not committed; catalog
images continue to come from Platform-provided paths.

The theme is presentation-only. It keeps Coin terminology, routes, Platform
sale/eligibility/Draw/Session/Prize contracts and every returned-state rule.
Design items that need a product or Platform decision (当選実績, 排出履歴,
automatic point prizes, age confirmation, Point/Coin wording) are not implemented
here.
