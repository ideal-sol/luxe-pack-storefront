# Frontend architecture

## Layers

1. `src/app` owns App Router composition, route-level loading, and error boundaries.
2. `src/components/layout` owns responsive shell components.
3. `src/components/common` owns presentation-only reusable UI.
4. `src/lib/routes` is the single navigation definition.
5. `src/lib/platform` is the reserved Platform adapter boundary.

## Server and Client Components

Pages, Header, Footer, containers, titles, and static state panels are Server Components by default. Mobile active-route navigation, Toast state, Confirmation Dialog interaction, and the root error boundary are explicit Client Components with `"use client"`.

Client Components do not own business decisions. Later data adapters pass display-ready results from the canonical Storefront Client boundary.

## State and data rules

- No direct database or Platform request from a React Component.
- No local recreation of draw, point, inventory, eligibility, or limit rules.
- No fake balance, result, purchase response, or authenticated user.
- Empty values use `--` or an explicit development state.
- Public environment variables are read only by a future Platform adapter, never by Components.

## Testing

Component tests cover the shared shell and common states. Route tests keep navigation aligned with the screen map. Policy tests reject forbidden generated paths and direct Platform-path references. Money, draw, and point mutation tests require stronger contract-aware coverage in later Tasks.
