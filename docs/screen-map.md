# Screen map

## Public navigation

| Route | Purpose | SITE-001 state |
| --- | --- | --- |
| `/` | Storefront landing and primary navigation | Foundation presentation |
| `/gachas` | Public pack list | Empty placeholder |
| `/gachas/[slug]` | Public pack detail | Empty placeholder |
| `/notices` | Public notices | Empty placeholder |
| `/notices/[noticeId]` | Public notice detail | Empty placeholder |
| `/pages/[slug]` | Managed public content | Empty placeholder |
| `/login` | Login entry | Development notice |
| `/register` | Registration entry | Development notice |

## Member navigation

| Route | Purpose | SITE-001 state |
| --- | --- | --- |
| `/points` | Balance, products, and purchase entry | Login-required placeholder |
| `/mypage` | Account hub | Login-required placeholder |
| `/mypage/points` | Point history | Login-required placeholder |
| `/mypage/draws` | Draw history | Login-required placeholder |
| `/mypage/prizes` | Acquired items | Login-required placeholder |
| `/mypage/line` | LINE connection | Login-required placeholder |

The desktop Header and Mobile Bottom Navigation use the same definitions from `src/lib/routes/navigation.ts`. Dynamic identifiers are routing inputs only; SITE-001 does not interpret them as business data.
