# Luxe Pack Storefront Codex Rules

## Governance

- Engineering Safety is Strict and Git Ceremony is Lite. The canonical policy is
  `docs/engineering-governance.md`.
- The default change model is one Change, one branch, and one pull request.
- An Issue, dedicated Worktree, Task Policy, exact `allowed_paths`, or Source
  Integration Lock is optional and is used only when the change's tracking,
  isolation, scope, or real conflict risk requires it.

## Scope

- Site Codex changes only this Repository. Never modify `/var/www/oripa` directly.
- Do not change `luxe-pack.biz`, Nginx, DNS, V1, or production payment without
  explicit Human authorization for that Change.

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
- Keep `main` protected. Do not push directly to `main`, force-push, bypass a
  Required Check, or merge without a pull request.
- Require final-head, fixed-head machine-readable self-review and Squash Merge.
  For high-risk Auth, Payment, Session, Security, Public Contract, Artifact,
  Build, or Activation changes, the review must be fresh and report
  `SEV-0 = 0` and `SEV-1 = 0` before merge.
- Keep Platform Artifacts immutable and exactly pinned. Verify the authoritative
  Manifest, checksums, source/contract compatibility, and generated Client and
  Testkit alignment; never adopt a floating or arbitrary `latest` version.
- Require Preview Runtime Acceptance for affected high-risk flows and a Human
  checkpoint before Production Activation.
- Report tests that were not run; never describe them as passing.
