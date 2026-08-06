# Design reference

## Reference

The public layout at <https://oripaone.jp/> was reviewed on 2026-08-06 as a structural reference only.

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

The task-supplied `oripone.jp` hostname did not resolve during SITE-003. The
previously documented `oripaone.jp` reference was protected by an automated
browser challenge during re-check, so SITE-003 relies on the prior reviewed
observations recorded above rather than claiming a new pixel comparison.

## Luxe Pack interpretation

Luxe Pack uses an original ink, ivory, and bronze visual system, typographic wordmark, CSS-generated geometric placeholder, and independent Japanese copy. No logo, image, source code, or wording from the reference site is included.

The placeholder artwork is deliberately replaceable. Catalog and banner assets
use Platform-provided paths when available; missing or non-image assets use a
neutral Luxe Pack CSS placeholder. Pixel-perfect comparison is not a SITE-003
acceptance criterion; responsive hierarchy, reusable components, dense catalog
rhythm, and accessible navigation are.
