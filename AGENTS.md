# Luxe Pack Storefront Codex Rules

## Scope

- One Task equals one Issue, one branch, one worktree, and one pull request.
- Site Codex changes only this Repository. Never modify `/var/www/oripa` directly.
- Do not change `luxe-pack.biz`, Nginx, DNS, V1, or production payment without an explicit Task.

## Platform boundary

- Laravel and the Platform are the source of truth for business rules.
- The Storefront never connects directly to the database.
- Do not reimplement draw, point, inventory, eligible-user, or daily-limit decisions in the Frontend.
- `@oripa/storefront-client` is the canonical Platform connection boundary.
- React Components must not call `/api/v2` directly.
- Record missing contracts as a Platform Change Request instead of inventing an endpoint or response.

## Safety and verification

- Never commit secrets, PII, credentials, or internal infrastructure details to this Public Repository.
- Keep general UI checks lightweight; verify money, draw, and point mutations with stronger task-specific gates.
- Do not push directly to `main`, force-push, or bypass checks.
- Require fixed-head machine-readable self-review and Squash Merge.
- Report tests that were not run; never describe them as passing.
