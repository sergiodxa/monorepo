# ADR-028: Enterprise SSO Connections

## Status

**Accepted** - 2026-09-21

## Background

A tenant selling to companies reaches a buyer whose security review ends the conversation unless
the product federates with the buyer's own identity provider. The people signing in are already
employees somewhere, and the directory that hires and fires them is the one that should decide
whether they still have an account.

[ADR-027](./ADR-027-social-identity-providers.md) builds the connection this runs on: one record
per external provider in the tenant object, holding credentials, mapping claims to subject
attributes, and finishing a flow that began on another hostname. An enterprise connection is that
record with a `saml` kind, a set of certificates, a claim over one or more email domains, and a
sign-in nobody picks from a list — the **Enterprise SSO connections** add-on, $49 per tenant per
month with five connections included and $10 each beyond them, on top of any tier including Free.

## Context

### The connection is chosen by the address

A social provider is a button someone presses. An enterprise connection is not, because a tenant
with forty customers would show forty buttons, each naming a customer to everyone who loaded the
page. The person types an address and the platform decides, which makes the routing table the
load-bearing part of this design and a wrong row in it a sign-in handed to the wrong company.

### A SAML assertion is an XML document a stranger wrote

It arrives as a form POST from a browser, signed by a certificate the tenant configured, and
everything decided about the person comes out of parsing it. XML brings its own failure modes: a
DOCTYPE that fetches a URL, entity expansion, and signature wrapping — a document carrying a
legitimately signed assertion beside a forged one, where the signature verifies and the reader picks
up the wrong element.

## Decision

### The entitlement and the count

The routes that create or edit an enterprise connection sit behind
`requireEntitlement("sso_connections")` from `@sdxc/billing/middleware`, and the sign-in page reads
the same grant through `ctx.flags` as `entitlement.sso_connections` to decide whether an address is
routed at all. Both read the entitlement projection on the tenant's control-plane row, so neither
touches the billing provider ([ADR-020](./ADR-020-entitlements-as-feature-flags.md)), and a lapsed
subscription keeps configured connections serving through the grace window while adding another
stops at once.

The five included connections are a price, not a cap. `saveEnterpriseConnection` takes a ceiling
resolved from the plan and enforces it in the statement that writes the row, as a decided limit
rather than a subscription the object interprets, and a daily job reports each tenant's active
connection count on the `sso_connections` meter through `usage.ingest`, so the sixth bills $10
rather than being refused. The price answers the integration and support burden of somebody else's
identity provider; infrastructure cost is immaterial against it, as everywhere in this series.

### SAML as service provider

A `saml` connection extends ADR-027's `connections` record, and its identifiers are built on the
tenant's platform subdomain, fixed for the tenant's life: the entity ID is
`https://{slug}.{platform domain}/u/sso/{connection}`, the assertion consumer service is that plus
`/acs` over the HTTP-POST binding, and the metadata document is that plus `/metadata`. The object
generates an RSA key pair at first save and keeps the private half, publishing the certificate in
the metadata so an IdP can encrypt to it and verify what `SAML.createAuthnRequest` signs. Ending a
session is the platform's own revocation, from the account screen or management API.

`signInWithSamlResponse` is one operation, handing the POST body to `@sdxc/saml`'s
`verifyResponse` with the connection's active certificates, the entity ID as audience, the ACS URL
as destination and recipient, the stored `InResponseTo` or `null`, the SP private key for an
`EncryptedAssertion`, the replay table holding ids until they expire, and 60 seconds of skew. That
call refuses a DOCTYPE and entity expansion, requires the response or the assertion to be signed,
and reads claims **only from the element the verified signature references** — it answers with a
verified assertion and nothing else, which makes a wrapped second assertion unreadable. A
cleartext assertion is refused where encryption is required, and only then are attributes mapped,
the subject resolved and the session opened.

All of it runs inside the tenant object, where the certificate set, the SP private key, the replay
table and the subject already are, so ADR-001 makes the whole check one method rather than a parse
in the Worker followed by a lookup: the private key never crosses and nothing partially verified is
a value the Worker holds. The Worker bounds the POST body first and the object caps document size
and depth before the call.

An enterprise OIDC connection is ADR-027's generic OIDC connection under this gate and this
routing: `Issuer.for` over the IdP's discovery URL, `RelyingParty` from `@sdxc/auth`, the
transaction in the object, the callback on the platform subdomain. It carries no certificates,
since the key set is discovered and rotated by the provider, so a tenant with a choice takes it.

### Certificates

An IdP's signing certificate expires on a date and rotates on a schedule the tenant does not
control, so a connection trusts a set and both events pass unnoticed. `connection_certificates`
holds `connection_id`, `use` (`signing` or `encryption`), `certificate`, `fingerprint`,
`not_before`, `not_after`, `source` (`metadata` or `manual`) and `retired_at`, the middle three
from `SAML.Certificate.parse`. A tenant gives a metadata URL — fetched by the Worker daily and on
demand, then handed to `refreshConnectionMetadata`, which `SAML.parseIdPMetadata` reads, replacing
endpoints, adding certificates and retiring one absent for seven days, so a blip at the IdP locks
nobody out — or pastes the certificate and endpoints by hand. `warnExpiringCertificates` runs
daily, marking those crossing 30, 14 and 7 days of life left, writing an audit row per crossing
and answering whom to notify, the Worker sending through
[ADR-017](./ADR-017-transactional-email.md). An expired certificate stops verifying, its reason
named to the tenant's administrators while the person signing in is told only that the connection
is unavailable.

### Routing a sign-in

`connection_domains` holds `connection_id`, `domain`, `folded`, `status`, `challenge`,
`verified_at` and `created_at`, with a unique index on `folded` spanning the tenant, so two
connections cannot claim one domain: the second claim is refused when it is written, naming the
connection that holds it, and the sign-in path is never asked to choose between two answers.
Domains are claimed per tenant, so two tenants may each claim `example.com`. `routeSignIn` folds
the submitted address by [ADR-006](./ADR-006-subjects-and-identifiers.md)'s rule, reads the domain
and answers the next step — an enterprise connection with its transaction already minted and the
URL to redirect to, or the credential steps the tenant offers — in one round trip.

A claim starts `pending` with a random challenge to publish as a TXT record at
`_auth-domain.{domain}`. The daily job resolves that record over DNS-over-HTTPS in the Worker and
calls `confirmConnectionDomain` with what it found; the object compares against its stored
challenge and promotes the claim, and a claim unverified after seven days expires and may be made
again. Only a verified claim routes a sign-in, and only a verified claim makes the connection an
authoritative source for addresses in that domain, which is what
[ADR-036](./ADR-036-account-linking.md) reads before it links anything.

### IdP-initiated sign-in, and just-in-time subjects

IdP-initiated sign-in is off per connection and turned on deliberately. It exists in SAML alone, so
an OIDC connection offers none. With no `AuthnRequest`, nothing binds the assertion to the browser
presenting it, and an assertion captured inside its validity window signs that browser in as its
subject. What the design does about it: the assertion is still signed and still unreplayed, its
window is capped at five minutes whatever the IdP asserted, `RelayState` names one of the tenant's
registered clients rather than carrying a URL so a forged POST steers the browser nowhere
unregistered, a sign-in naming no client lands on the account screen, and the session replaces
whatever the browser held.

`on_unknown_subject` defaults to `create` here, because provisioning from the directory is the
point of buying a connection. The created subject's address is marked verified when its domain is a
verified claim on that connection and left unverified otherwise: an IdP is the authority for the
domains it proved control of and no others, and attributes map by ADR-027's rules.

### RPC methods

- `saveEnterpriseConnection(input)` — validates, generates the SP key pair on first save, enforces
  the ceiling, answers the entity ID, ACS URL, metadata URL and SP certificate.
  `refreshConnectionMetadata({ slug, metadataXml })` parses it and replaces the certificate set.
- `claimConnectionDomain({ slug, domain })`, `confirmConnectionDomain({ slug, domain, txtRecords })`
  and `releaseConnectionDomain({ slug, domain })`.
- `routeSignIn({ identifier, authorizationRequestId, hostname })` — the next step, minting the
  transaction where that answer is a connection.
- `signInWithSamlResponse({ slug, samlResponse, relayState, hostname, agent })` — everything above,
  answering the subject, the originating hostname and the handoff ticket.
- `describeSamlServiceProvider({ slug })` — the metadata `SAML.buildServiceProviderMetadata` writes,
  cached in the Worker, and `warnExpiringCertificates({ now, thresholds })` for the daily sweep.

## Consequences

### Positive

- One domain routes to one connection by a unique index, so the routing table cannot hold the
  ambiguity that sends a sign-in to the wrong company's IdP.
- An assertion is verified where the certificates, the replay table and the subject already are.
- A rotating IdP needs no coordination, an expiry is announced three times before it happens, and
  a tenant willing to pay is never blocked from adding a connection.

### Negative

- A sign-in is exactly as sound as `@sdxc/saml`, the least forgiving code in the product, so its
  IdP fixtures and wrapped-assertion corpus are what a tenant's trust rests on.
- SAML parsing is CPU inside a single-threaded object, so a large assertion occupies that object.
- Domain verification asks an enterprise buyer for a DNS record before their first sign-in works.
- IdP-initiated sign-in stays unbound to the browser presenting it however tightly the window is
  drawn, so it is a risk a tenant accepts rather than one the design removes.

### Neutral

- Connections are metered rather than sold as quantity, so the count is a daily report rather than
  a subscription edit, and an IdP publishing no metadata URL is configured and rotated by hand.

## Alternatives Considered

**Routing by a tenant-chosen connection key in the URL.** A link per customer, no DNS record, no
domain table. It moves the routing decision into something a person retypes, and leaves a
per-customer link to keep correct forever. Rejected: the address already carries the answer.

**Letting the newest claim win a contested domain.** No refusal to explain, and a customer
correcting a mistake needs no support ticket. It also lets one connection take over another's
sign-ins the moment somebody claims a domain they do not own. Rejected: it is refused at the write,
where a person is there to read why.

**Calling `SAML.verifyResponse` in the Worker and handing the object the assertion.** Keeps XML work
off the single-threaded object. It puts the trust decision on the Worker's side and sends claims the
object would have to believe. Rejected: the assertion is verified where the certificates are.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — why the whole assertion check is one method in the object
- [ADR-006: Subjects and Identifiers](./ADR-006-subjects-and-identifiers.md) — the folding rule routing reads
- [ADR-017: Transactional Email](./ADR-017-transactional-email.md) — how a certificate warning reaches an administrator
- [ADR-020: Entitlements as Feature Flags](./ADR-020-entitlements-as-feature-flags.md) — where the add-on gate is evaluated
- [ADR-027: Social Identity Providers](./ADR-027-social-identity-providers.md) — the connection record, mapping and callback this extends
- [ADR-036: Account Linking](./ADR-036-account-linking.md) — what a verified domain claim authorizes
- [Root ADR-074: SAML Package](../ADR-074-saml-package.md) — the verification, parsing and metadata calls this uses
