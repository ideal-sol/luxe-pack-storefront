# Screen map

## Public navigation

| Route | Purpose | SITE-003 state |
| --- | --- | --- |
| `/` | Banners, categories, current gacha summaries, and notice summaries | Public Client-connected; Testkit verified |
| `/gachas` | Public gacha cards, category filter, and cursor continuation | Public Client-connected; Testkit verified |
| `/gachas/[slug]` | Public pack detail | Placeholder; detail implementation is outside SITE-003 |
| `/notices` | Public notices | Empty placeholder |
| `/notices/[noticeId]` | Public notice detail | Empty placeholder |
| `/pages/[slug]` | Managed public content | Empty placeholder |
| `/login` | Email/password login | Client-connected form; runtime configuration required |
| `/register` | Registration entry | Client-connected form and pending-verification state |
| `/verify-email` | Verification guidance and optional resend | Client-connected when canonical `user_id` is present |
| `/verify-email/[userId]/[hash]` | One-time email verification completion | Client-connected canonical completion input |

## Member navigation

| Route | Purpose | SITE-002 state |
| --- | --- | --- |
| `/points` | Balance, products, and purchase entry | Login-required placeholder |
| `/mypage` | Account hub | Login-required placeholder |
| `/mypage/points` | Point history | Login-required placeholder |
| `/mypage/draws` | Draw history | Login-required placeholder |
| `/mypage/prizes` | Acquired items | Login-required placeholder |
| `/mypage/line` | LINE connection | Login-required placeholder |

The Header now renders neutral, unauthenticated, and authenticated controls from
the Session Provider. Point balance remains `--`. The verification completion
route accepts only the values required by the canonical Client; Platform must
confirm the external redirect mapping before Preview use.

The desktop and mobile navigation continue to use `src/lib/routes/navigation.ts`.
The mobile current-page rule treats gacha detail placeholders as part of the
`/gachas` section. Public home and catalog rendering does not wait for Session.
