# Storefront dependency audit policy

Authority: Human-approved `STOREFRONT-CI-SECURITY-BOOTSTRAP-20261005`.
Lane: Strict Change. Application Runtime Activation: none.

The existing `security-gate` and all artifact, secret and boundary checks remain
required. The full dependency audit's blocking threshold remains **High**.
Info, Low and Moderate findings remain visible and nonblocking in the full audit;
they are not baselined, waived or allowlisted. Production-only findings must be
zero across **all five severities**. No production finding receives an exception.

## Fresh evidence and exits

CI uses its pinned pnpm 11.25.0 from an isolated directory containing the current
lockfile. `security-audit-policy.mjs --collect REPOSITORY AUDIT_DIRECTORY` runs
fresh full and `--prod` audits with `--audit-level info --json`, retaining both
JSON documents, raw exit statuses and the successful policy summary. `info` is
the evidence collection filter, not the full-audit blocking threshold: pnpm 11
filters advisory details at higher levels while metadata still counts lower
severities. Collecting all severities makes production-zero and exit/count
consistency independently verifiable. The validator blocks High/Critical full
findings except the single exact approved state below.

Both collection commands must exit 0 when no advisory records exist, or 1 when
any record exists, including nonblocking Moderate records. Other exits, missing
or malformed JSON, audit errors, suppression, inconsistent metadata, filtered
records, malformed manifests and findings absent from the lock fail closed.
Counts are package advisory records, consistent with pnpm metadata; multiple
paths are retained as exposure evidence, not counted as additional advisories.

## Exact dev-tool exception

Only `GHSA-vfj7-8cjw-p6xm`, audit ID `1240992`, `braces@3.0.3`, High, through
`.>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces`
qualifies. The validator checks the manifest against the root lock importer,
proves eslint-config-next exists only in devDependencies (absent from
dependencies, optionalDependencies and peerDependencies), walks every locked
dependency edge, and requires the fresh production audit to be entirely clean.
The audit finding must be dev-only, nonoptional and nonbundled.

The fingerprint pins `vulnerable_versions: <=3.0.3`, `patched_versions: null`,
`patched_versions_unpublished: true` and `cwe: CWE-674`. CVE/CVSS fields are
ABSENT in the approved fresh pnpm output. Their appearance, including null or an
empty value, invalidates the exception. No Platform CVE/CVSS values are copied.
Advisory/audit identity, package, locked version, severity, range, patch state,
CWE, CVE/CVSS state, exact path and dev scope changes fail closed. A published
patch requires dependency remediation and a new review; no generic GHSA or
package allowlist applies. The target's severity downgrade also requires review
of the changed fingerprint rather than silently continuing this exception.

Title, overview, references, timestamps, recommendation, attribution and other
description-only metadata do not invalidate an unchanged security fingerprint.
There is no fixed expiry or scheduled review. If the target disappears, it is
reported RESOLVED / IMPROVED and its retained policy does not block the gate.
Other High/Critical advisories always block. Summaries report current findings,
approved exceptions, unapproved High/Critical and all Moderate records honestly.

## Bootstrap dependency remediation

PR #136's exact dependency delta pins sanitize-html 2.17.6 to 2.17.7 and only its
corresponding lock entries/integrity. Fresh full and production evidence must
exclude `GHSA-g8qq-57p8-ggw5`; recurrence fails. The bootstrap does not remediate
or introduce policy for the five existing Moderate dev package findings.

## Verification and follow-up

`pnpm exec vitest run src/test/security-audit-policy.test.mjs` runs focused
regressions, also included in `pnpm test`. To revalidate saved evidence, run
`node scripts/ci/security-audit-policy.mjs --validate REPOSITORY AUDIT_DIRECTORY`.
Delivery requires new fresh collection from the final head; saved evidence alone
is not a substitute. JSON and the summary are emitted in CI logs; the isolated
directory is ephemeral. Existing clean-directory CI validation remains intact.

This task authorizes source/CI delivery and Human review only. PR #134, PR #136,
the historical HOLD branch, Machine Policy and application source are preserved.
Merge, auto-merge and runtime activation are not authorized. Future rollback is a
reviewed PR; reverting the whole bootstrap also reintroduces the sanitize-html
runtime advisory and must not be treated as a safe remediation.
