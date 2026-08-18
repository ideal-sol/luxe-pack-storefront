# MIG-062W Storefront Contract Artifact

- Task: `MIG-062W`
- Version: `2.0.0-alpha.20`
- Source commit: `dfefa07e1a905bba07a56079d02ebfbaabfafc94`
- Generated at: `2026-08-17T12:31:03Z`
- Adoption task: `SITE-029`

The artifact manifest and bundled `SHA256SUMS` are the authority for file names,
package versions, compatibility, and checksums. The Storefront pins all three
private packages to the tarballs in this directory. Earlier vendored artifacts
remain unchanged.

Before adoption, SITE-029 verified the Manifest, formal files, package identities,
archive paths and links, lifecycle scripts, concrete secret／token／private-key
candidates, and repository-external absolute dependencies. The Public OpenAPI adds
only `/me/line-friend-state` and its LINE Friend State schemas; existing paths and
schemas are unchanged. Existing Catalog, Content, Draw, Point, Prize, Browser,
Server, and Transport Client modules remain byte-identical to alpha.19. The
Identity module differs only by the additive `getLineFriendState` declaration and
runtime method, preserving its existing Authentication and External Identity
operations. Alpha.20 also supplies generated LINE Friend State Testkit fixtures.
