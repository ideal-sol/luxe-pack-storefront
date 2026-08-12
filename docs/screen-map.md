# Screen map

## Public navigation

| Route | Purpose | SITE-003 state |
| --- | --- | --- |
| `/` | Banners, categories, current gacha summaries, and notice summaries | Public Client-connected; Testkit verified |
| `/gachas` | Public gacha cards, category filter, and cursor continuation | Public Client-connected; Testkit verified |
| `/gachas/[slug]` | Public pack detail and Draw entry | Detail/presentation plus Browser-safe Draw confirmation and mutation connected |
| `/draws/[drawRequestId]/result` | Completed Draw result | Authenticated `getDrawRequest` recovery; reload performs GET only |
| `/notices` | Public notices | Content Client-connected cursor list; Testkit verified |
| `/notices/[noticeId]` | Public notice detail | Content Client-connected canonical HTML; sanitized before rendering |
| `/pages/[slug]` | Managed public content | Content Client-connected by slug; sanitized document layout |
| `/login` | Email/password login | Client-connected form; runtime configuration required |
| `/register` | Registration entry | Client-connected form and pending-verification state |
| `/verify-email` | Verification guidance and optional resend | Client-connected when canonical `user_id` is present |
| `/verify-email/[userId]/[hash]` | One-time email verification completion | Client-connected canonical completion input |

## Member navigation

| Route | Purpose | Current state |
| --- | --- | --- |
| `/points` | Balance, products, and purchase entry | Login-required placeholder |
| `/mypage` | Account hub | Session-connected member summary, centralized shortcuts/support navigation, and logout |
| `/mypage/points` | Point history | Session-aware authenticated placeholder; data Contract pending |
| `/mypage/draws` | Draw history | Session-aware authenticated placeholder; data Contract pending |
| `/mypage/prizes` | Acquired item inventory, Backend-authoritative selection, address management, shipping, and point exchange | MIG-062E Browser Prize Fulfillment Client-connected |
| `/mypage/line` | LINE connection | Session and External Identity Client-connected state/link UI; unlink deferred pending safe reauthentication journey |

The Header now renders neutral, unauthenticated, and authenticated controls from
the Session Provider. Point balance remains `--`. The verification completion
route accepts only the values required by the canonical Client; Platform must
confirm the external redirect mapping before Preview use.

The My Page top uses only the existing Session `email_verified` and account
`state` fields for its member summary. Points, draw history, Prize inventory,
LINE, notices, and support links come from `src/lib/routes/navigation.ts`.
Nickname, Avatar, Rank, Point balance, and unconfirmed member products are not
shown because no corresponding SITE-006 contract was assumed.

The LINE page uses the centralized My Page route, reads only the generated
external identity collection, and starts linking with the canonical Platform
authorization URL. It does not parse callback parameters or store provider
tokens. Friend state is absent from alpha.6. Although recent reauthentication
and unlink methods exist, no unlink button is exposed until their safe
post-return confirmation journey is fixed.

The Prize inventory preserves `/mypage/prizes`, uses cursor continuation, and
shows generated status badges without inventing status groups. Its mobile bulk
tray exposes only actions allowed for every selected item; action buttons are a
non-mutating boundary for later Tasks.

The desktop and mobile navigation continue to use `src/lib/routes/navigation.ts`.
The mobile current-page rule treats gacha detail placeholders as part of the
`/gachas` section. Public home and catalog rendering does not wait for Session.

SITE-009 keeps the existing Luxe Pack routes rather than adopting the reference
site's routes. Home notice summaries link to the list and ID-based detail routes.
Existing Footer page links are centralized in the navigation definition; the
Platform remains authoritative for whether each requested slug is published.

SITE-004 keeps the Luxe Pack `/gachas/[slug]` route and adds the returned main
asset, facts, progress, notices, rank/prize sections, modal, eligibility, daily
limit, allowed-count selection, and sticky CTA. Anonymous login guidance is used
only when the canonical CTA action requests it. SITE-005 submits only after a
confirmation, uses the generated Browser Draw Client and Idempotency helper, and
recovers the canonical result by public Draw Request ID without replaying mutation.
