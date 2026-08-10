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
