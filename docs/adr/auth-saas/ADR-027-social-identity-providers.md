# ADR-027: Social Identity Providers

## Status

**Proposed** - 2026-09-18

## Background

A tenant's sign-in page offers a password, a passkey and a magic link, and every one of them asks
a person to establish something new with the tenant. A social provider asks them to present an
account they already hold, which is the shortest path to a first sign-in.

The platform is an OIDC provider to its tenants' applications and, on this path, an OIDC or OAuth2
client to somebody else's. [ADR-001](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) settles
where the client's state belongs: the tenant object, holding the credentials for each provider,
the flow in progress, and the external account a subject signed in with.

This ADR settles the connection — what a tenant configures, where the provider sends the browser
back, and what becomes of what it returns. Attaching the result to a subject is
[ADR-036](./ADR-036-account-linking.md). Social sign-in is base, on Free and above.

## Context

### A connection's credentials carry the tenant's name

The consent screen a person sees names the OAuth application, shows its logo and lists the scopes
it asks for. That screen belongs to whoever registered the application, so it carries the tenant's
brand or the platform's and there is no third option. The same registration carries the provider's
rate limits, its abuse decisions and its quota, and at several providers it decides the value of
the subject claim, which is stable per user per registered application.

### The callback is an address that has to stay put

A redirect URI is typed into a provider's console by hand and matched exactly. A tenant may serve
its sign-in page on a platform subdomain today and a custom domain next quarter
([ADR-005](./ADR-005-hostname-resolution-and-tenant-domains.md)), so a callback derived from the
serving host means a console visit per provider per hostname with a broken login in between. The
platform subdomain is fixed at creation and resolves for the tenant's life, which makes it the one
host a provider can be told about once.

## Decision

### The catalog, and the generic connection

The platform ships a catalog of entries covering what a consumer product meets — Google, Apple,
Microsoft, GitHub, GitLab, Facebook, LinkedIn, Discord, Slack. An entry is either OIDC, naming an
issuer URL that `Issuer.for` from `@sdxc/auth` resolves through discovery, or OAuth2, naming the
authorization, token and profile endpoints for a provider publishing no discovery document. Each
carries default scopes, the claim holding the provider's subject identifier, whether its
verified-email assertion is authoritative, and an icon. Anything outside the catalog is a
connection where the tenant supplies those same fields, so the catalog is a set of pre-filled
forms over one shape and a provider the platform has never heard of reaches the page the same way.

### The connection record

```sql
connections(id, slug, kind, catalog_entry, display_name, enabled,
            issuer, authorization_endpoint, token_endpoint, userinfo_endpoint,
            client_id, client_secret_sealed, scopes, subject_claim,
            email_authority, auto_link, on_unknown_subject, created_at, updated_at)
connection_mappings(connection_id, source, target, apply)
connection_transactions(id, connection_id, state, nonce, verifier, hostname,
                        authorization_request_id, scopes, expires_at)
```

`slug` is unique per tenant, chosen once and immutable, because it names the callback URL. `kind`
covers `oidc`, `oauth2` and the `saml` that
[ADR-028](./ADR-028-enterprise-sso-connections.md) adds, so an enterprise connection extends this
table rather than running beside it. `client_secret_sealed` is an AES-GCM envelope from `seal` in
`@sdxc/crypto`, opened inside the object with a key read from the object's own environment, so the
secret is never a value the Worker holds. A connection is created disabled and cannot be enabled
without credentials, so a half-configured provider never appears on a sign-in page.

### The callback, and the hand back

The redirect URI is `https://{slug}.{platform domain}/u/connections/{connection}/callback` — the
tenant's platform subdomain, whatever host it serves on, so it is one URI per connection
registered once. A flow that began on a custom domain therefore finishes on another host, where
the session cookie is not. The object answers the completed exchange with the originating hostname
and a single-use handoff ticket good for 30 seconds; the Worker redirects to
`/u/connections/resume` on that host, which spends the ticket, writes the session there and
continues the pending authorization request. The ticket names a row and authorizes nothing itself.

`RelyingParty` from `@sdxc/auth` writes `state`, the nonce and the PKCE verifier into any store
with `get`, `set` and `unset`, and the object supplies one over `connection_transactions`, so what
a callback is checked against sits in tenant storage rather than in a cookie the callback host
cannot read. `authorize` answers a `303`, and the object returns its `Location` as a string since a
`Response` does not cross the boundary; `callback` is handed the callback URL as a string and
rebuilds its `Request` inside.

### Mapping, and the first sign-in

What a provider returns arrives from outside the tenant's control, which makes it input to be
mapped rather than profile to be written, and [ADR-006](./ADR-006-subjects-and-identifiers.md)
already draws that line. A mapping row holds `source`, a claim name in the response; `target`, a
standard profile column or a declared attribute key; and `apply`, `on-create` or
`on-every-sign-in`, which keeps the provider authoritative for that field where `on-create` leaves
it to the subject. A target with no attribute definition is refused when the mapping is saved
rather than when a sign-in runs, so a mapping cannot quietly drop claims for months. A provider's
`phone_number` claim has no target, here as everywhere in this series: the verified mailbox is the
ownership credential, proving as much with no carrier in the path and no per-message cost.

`on_unknown_subject` is `create` or `refuse`. `create` mints a subject from the mapped attributes;
`refuse` answers that the identity is unknown and the page asks for a credential the tenant
already knows, after which the link completes, which is what an invite-only directory wants.
Whether an unknown identity carrying a known address joins that subject is the automatic-linking
rule in [ADR-036](./ADR-036-account-linking.md), evaluated in the same call.

### Provider tokens, and asking for more scope

A tenant's application often wants the provider's API as the person who signed in, so the identity
row holds the access and refresh tokens as sealed envelopes with the access token's expiry as an
integer beside them. `getProviderToken` opens the envelope and, within the expiry margin, redeems
the refresh token and reseals both before answering; concurrent callers on one row share the
in-flight redemption. The redemption runs inside the object because a refresh token has no reason
to cross the boundary, while the access token does, since handing it over is the whole operation.

A connection's configured scopes stay at identity, and more is asked for when it is needed:
`requestAdditionalScopes` mints a transaction carrying the union of current and requested scopes
with `prompt=consent`, and the flow records what was granted, since a provider may grant less than
it was asked.

### No shared development credentials

The platform ships no shared OAuth application for a quick start. A shared registration puts the
platform's name on the consent screen for every tenant's users, pools one rate limit and one abuse
reputation across tenants, and lets its owner see and revoke grants belonging to all of them. The
decisive cost is the exit: where a provider's subject identifier is scoped to the registration,
moving a tenant onto its own credentials re-keys every identity it holds, leaving the email
address as the only thing to rejoin them by — the exact path ADR-036 constrains. The friction is
answered instead with a per-entry setup guide naming the console screen, the scopes to request and
the callback URL to paste.

### RPC methods

- `saveConnection(input)` — validates the shape for the kind, seals the secret, claims the slug,
  answers the public record with the callback URL to register. `setConnectionEnabled({ slug,
  enabled })` turns it on once credentials are there.
- `removeConnection({ slug, unlinkIdentities })` — refuses while identities reference it unless
  told to unlink them, each unlink obeying the credential rule in ADR-036.
- `describeConnections({})` — the enabled connections as the sign-in page renders them; a read-only
  document, cached in the Worker and dropped when a connection changes.
- `beginConnectionSignIn({ slug, authorizationRequestId, hostname, scopes, prompt })` — writes the
  transaction, answers the provider URL.
- `completeConnectionSignIn({ slug, callbackUrl, agent })` — spends the transaction, exchanges the
  code, verifies the ID token, maps the claims, resolves the identity, seals the provider tokens
  and opens the session, answering the subject, the originating hostname and the handoff ticket,
  or `link_required` with the ticket that finishes it.
- `resumeConnectionSignIn({ ticket, hostname, agent })` — spends the handoff ticket, writes the
  session on the originating host, answers the pending authorization request.
- `getProviderToken({ subjectId, slug })` — a live provider access token and its expiry, and
  `requestAdditionalScopes({ subjectId, slug, scopes, hostname })` for the step-up transaction.

## Consequences

### Positive

- One connection shape serves the catalog, a generic provider and an enterprise connection, so a
  provider nobody anticipated costs no code.
- A callback URL is registered once per connection and survives every hostname change afterwards.
- A tenant's users see the tenant's name on the consent screen, and one tenant's abuse of a provider
  reaches no other tenant.
- The flow's `state`, nonce and verifier are tenant storage, so one host finishes what another
  began.

### Negative

- Every tenant registers an application with every provider it wants, real setup work before the
  first social sign-in and the likeliest place onboarding stalls.
- The cross-host hand back adds a redirect and a ticket to expire, and refreshing a provider token
  is an outbound request inside the object, so a slow provider occupies it while it answers.
- The method list is the whole of the access control over a sealed provider token.

### Neutral

- The catalog is data, so a provider changing an endpoint is an edit rather than a release, and a
  tenant on a generic connection makes it itself.

## Alternatives Considered

**Shared platform credentials for a quick start.** A tenant tries social sign-in in a minute with
nothing registered anywhere. It sells the tenant's consent screen, rate limit and abuse reputation
into a shared pool, and makes the move to their own credentials a re-keying of every identity.
Rejected on the exit cost.

**A callback on whichever hostname serves the flow.** One redirect, no ticket, no second host. It
also re-registers a redirect URI with every provider each time a tenant attaches a domain, with a
broken login in between. Rejected: the callback is the thing that must not move.

**The connection record in the D1 control plane.** The sign-in page would render its buttons with
no call to the object, as branding does. It puts a tenant's OAuth client secret in the shared
store, the one place isolation is not structural. Rejected; the button list is a cached document.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — the boundary this flow is split across
- [ADR-005: Hostname Resolution and Tenant Domains](./ADR-005-hostname-resolution-and-tenant-domains.md) — why the platform subdomain is the permanent callback host
- [ADR-006: Subjects and Identifiers](./ADR-006-subjects-and-identifiers.md) — the profile columns and declared attributes a mapping targets
- [ADR-028: Enterprise SSO Connections](./ADR-028-enterprise-sso-connections.md) — the `saml` kind and domain-routed connections
- [ADR-036: Account Linking](./ADR-036-account-linking.md) — the identity record and the linking rule
