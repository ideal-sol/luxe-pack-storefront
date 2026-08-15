# MIG-062U Storefront Contract Artifact

- Task: `MIG-062U`
- Version: `2.0.0-alpha.18`
- Source commit: `83f2732ce9a7adac3573e6f3975e43a53467de07`
- Generated at: `2026-08-15T03:18:52Z`
- Adoption task: `SITE-027`

The artifact manifest and the bundled `SHA256SUMS` are the authority for file
names, package versions, compatibility, and checksums. The Storefront pins all
three private packages to the tarballs in this directory. Earlier vendored
artifacts remain unchanged.

Before adoption, SITE-027 verified the MIG-062U Manifest declarations and
confirmed that alpha.18 retains MIG-062R's generated `listPointProducts`
Client contract and Point Product／Eligibility／CTA Testkit fixtures. Alpha.18
additively supplies generated `getWallet` and `listPointLedgerEntries` reads and
their balance, history, and typed-problem fixtures.
