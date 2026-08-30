# Storefront engineering governance

- Status: **Canonical**
- Effective: **2026-08-30**
- Decision: **Engineering Safety Strict / Git Ceremony Lite**

This policy governs changes to the Storefront Repository. It reduces routine Git
ceremony without reducing Auth, Payment, Session, Security, Public Contract,
Artifact, Build, Activation, or Production safety.

## Authority

Resolve Storefront change decisions in this order:

1. the protected Storefront `main` branch;
2. `AGENTS.md`;
3. this latest Human-approved governance policy;
4. current Security, development, release, and CI policy;
5. CI and policy-gate implementation;
6. Public Contract compatibility rules;
7. Platform Artifact Manifest and pinned Client rules;
8. merged source;
9. runtime evidence.

Historical worklogs and task reports are evidence of their completed changes,
not current process authority. If an older Git-ceremony statement conflicts with
this policy, this policy supersedes that statement. A stricter Auth, Payment,
Session, Security, Artifact, Build, Activation, or Production rule is not
superseded merely because it used to appear beside the older ceremony.

## Default change model

The normal model is:

```text
1 Change
= 1 Branch
= 1 Pull Request
```

`main` remains protected. Every change uses a pull request, completes all
Required Checks, and is Squash Merged. Direct pushes to `main`, force-pushes,
check bypasses, and weakening branch protection are prohibited.

The following resources are available when needed, but are not entry conditions
for a routine change:

- **Issue:** use for external tracking, multiple stakeholders, long-running work,
  bug or incident tracking, or an explicit Human request.
- **Dedicated Worktree:** use for genuine parallel changes, required isolation,
  an occupied main working directory, or an operational-safety need.
- **Task Policy / exact `allowed_paths`:** use for a highly constrained emergency
  fix, a cross-team boundary, a high-risk narrow mutation, or an explicit Human
  request.
- **Source Integration Lock:** use only when concurrent source integration creates
  a real conflict risk.

These controls may be combined when the change warrants them. Their optional
status does not authorize two unrelated changes in one branch or pull request.

## Strict engineering safety

Git Lite changes Git ceremony only. Risk classification and task-specific gates
remain proportional to impact. High-risk Storefront changes include:

- Authentication UI, Session, Password Reset, Email Change, and Password Change;
- Payment UI, fincode, Card/3DS, PayPay, Konbini, Virtual Account, Coin purchase,
  and Redirect/Return handling;
- security-sensitive Cookie or CSRF behavior;
- Public Contract or generated Client/Testkit adoption;
- Artifact adoption affecting a sensitive flow; and
- production routing, Build provenance, or Activation behavior.

At minimum, a high-risk change requires focused tests, all Required Checks, a
fresh final-head self-review, exact Artifact/Contract validation, and Preview
Runtime Acceptance. Known in-scope correctness or security defects must not be
merged.

Small CI or Git-blocker corrections may remain in the originating pull request
when they are directly necessary, narrowly scoped, tested, and do not weaken
Security, remove Required Checks, broaden permissions, change secrets, alter
branch protection, or redesign unrelated CI. Branch-protection changes, GitHub
App permission changes, credential architecture changes, Security-gate
weakening, Required Check redesign, and repository-wide CI redesign require a
separately authorized governance change.

## Fresh self-review

Self-review is against the immutable Final PR Head after the last source change.
The evidence identifies that full Head SHA and the exact changed paths. Review
depth may be proportional for low-risk documentation or presentation changes,
but high-risk changes require fresh machine-readable evidence with:

```text
SEV-0 = 0
SEV-1 = 0
```

Any source change invalidates earlier review evidence. Required Checks and the
self-review must both describe the same Final PR Head before Squash Merge.

## Platform Artifact safety

`@oripa/storefront-client` remains the canonical Platform connection boundary.
Artifact adoption must preserve all of the following:

- an immutable, versioned Artifact;
- an exact package and lockfile pin;
- the Artifact Manifest as release authority;
- checksum verification of the formal files;
- source and Public Contract compatibility validation;
- coherent generated Client and Testkit versions; and
- rejection of floating ranges and arbitrary `latest` adoption.

At the start of an adoption change, read the requested and latest available
Artifact versions live. When a Human decision or Canonical Contract names a
version, pin that exact version. Git Lite never substitutes for
`pnpm artifact:check` or for flow-specific Contract tests.

## Build authority

A build from the Squash-Merged `main` commit is the preferred authority when it
is readily available. A pipeline may instead reuse a build produced from the
reviewed Final PR Head only under the following **Reviewed Tree Authority**:

```text
Final PR Head
-> Required Checks PASS
-> Fresh self-review PASS
-> Build
-> Squash Merge
-> Final Head tree == Squash Merge tree
-> content diff == 0
-> built artifact or image is eligible for Activation
```

Commit-message or parent differences do not establish content equality. The
authority requires both identical Git tree object IDs and an empty content diff
between the two commits.

Record all applicable evidence:

- Final PR Head SHA and Final PR Head Tree SHA;
- Squash Merge SHA and Squash Merge Tree SHA;
- explicit tree equality and content diff `0`;
- Build ID or CI run;
- deployable Artifact or image digest;
- OCI/source revision; and
- active deployment revision after Activation.

Reviewed Tree Authority fails closed. Do not activate the reviewed-head build if
the trees differ, the content diff is nonzero, Final Head Required Checks or the
fresh self-review are incomplete, provenance is unknown, or the build source
revision does not match the recorded Final PR Head. A mismatch requires a new
authoritative build; relabeling or assuming equivalence is prohibited.

## Preview and Production Activation

Activate only affected Storefront services in Preview. After Activation, verify
the active source revision, expected Build/Artifact, public routes, same-origin
Platform API boundary, and relevant Auth or Payment smoke. High-risk changes
must complete their task-specific Preview Runtime Acceptance before Production.

Production Activation always requires an explicit Human checkpoint. Git Lite
does not authorize Production changes, shared infrastructure changes, or a
broader rollout. Documentation-only and policy-only changes normally require no
application Build or Runtime Activation.

## Historical governance

References dated before this policy to mandatory Issues, dedicated Worktrees,
Task Policies, exact `allowed_paths`, or always-on Source Integration Locks are
historical and no longer canonical. They remain valid only as evidence of the
change that used them. New changes must not copy those historical requirements
unless a current risk or Human decision independently calls for them.
