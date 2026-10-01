# Phase5e login-bonus display contract gap

Status: recorded only; no Platform adoption or implementation in this change.

The Phase5e design includes three static login-bonus examples. The Storefront
shows them as preparation-only examples with disabled actions, rather than
claiming that the displayed prices, guarantees, eligibility, or limits are live.
No endpoint, response shape, or client method is invented for these examples.

Before enabling this section, Platform must supply an authoritative contract for
which bonus campaigns can be displayed, their public presentation and detail
destinations, and the eligibility, draw, inventory, daily-limit, and first-user
decisions needed for any actual participation. The generated Storefront Client
must expose that contract. This request does not prescribe business values or
require changes to Platform, storage, database, environment, or workers now.

Client and Testkit remain pinned to 2.0.0-alpha.41. Enabling actions or adopting a
new contract requires a separately authorized Platform/Storefront change.
