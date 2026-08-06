# Frontend architecture

## Layers

1. `src/app` owns App Router composition, route-level loading, and error boundaries.
2. `src/components/layout` owns responsive shell components.
3. `src/components/common` owns presentation-only reusable UI.
4. `src/lib/routes` is the single navigation definition.
5. `src/lib/platform` owns runtime configuration and the narrow canonical Client adapter.
6. `src/components/auth` owns session orchestration and authentication presentation.

## Server and Client Components

Pages, Footer, containers, titles, and static state panels are Server Components by default. Session Provider, Header authentication state, forms, Mobile active-route navigation, Toast state, Confirmation Dialog interaction, and the root error boundary are explicit Client Components with `"use client"`.

The root Session Provider constructs the browser adapter, performs the initial
session read, distinguishes loading/authenticated/unauthenticated/configuration
unavailable/session expired/error states, and refreshes after successful identity
mutations. It stores the typed session response only in memory and does not cache
credentials or authentication material.

## State and data rules

- No direct database or Platform request from a React Component.
- No local recreation of draw, point, inventory, eligibility, or limit rules.
- No fake balance, result, purchase response, or authenticated user.
- Empty values use `--` or an explicit development state.
- Public environment variables are read only by the Platform runtime adapter, never by Components.
- Browser credentials, CSRF setup, cookies, and protocol headers are delegated to the pinned Client.
- Typed requests and responses are aliases of generated Client types; they are not handwritten.

## Testing

Component tests cover the shared shell, session state transitions, forms, duplicate
submission protection, header state, and email verification. Contract tests inject
the deterministic Storefront Testkit into the real browser client. Policy tests
reject direct Platform paths, browser protocol details outside the boundary, and
authentication persistence. Money, Draw, and Point mutations remain later Tasks.
