# ADR-046: Platform Tenant as the Management API's Authorization Server

## Status

**Implemented** - 2026-09-28

## Background

ADR-045 set out to give the management API an interactive credential — something a dashboard, an
MCP server, or a CLI could hold on a person's behalf, alongside the existing machine-only
`client_credentials` grant. It designed that as a second, purpose-built authorization server: its
own client table, its own authorization codes, its own refresh tokens, living beside the tenant
OIDC engine rather than reusing it.

That premise was wrong. The platform tenant is not a stand-in for an authorization server — it _is_
one, the exact same kind every customer's own tenant is, already carrying a complete OAuth 2.0 /
OpenID Connect implementation: client registration, authorize, consent, token, and refresh
rotation, all already built and already tested. Building a second one beside it to solve "how does
a non-browser client get a token on a person's behalf" duplicates a working implementation to solve
a problem that implementation already solves. This ADR replaces ADR-045 with the smaller, more
accurate change: route every management API credential — machine and human alike — through the
platform tenant's own, already-existing engine, and retire the parallel machinery
`client_credentials` currently uses instead.

## Context

### What exists today

The management API resolves a caller two ways. A machine presents an id and secret registered
specifically for the management API, tied to one tenant at registration time; verifying it mints a
short-lived token signed under a key that exists solely for this purpose, entirely separate from
any tenant's own signing keys. A person, separately, can already reach the management API with no
token at all: a live session on the platform tenant resolves straight to a subject id, which a
membership lookup turns into a tenant and a role, checked fresh on every request. That second path
already does everything ADR-045 was trying to build for people — it just has no equivalent for
software that isn't a browser holding a cookie.

Nothing today registers an OAuth client against the platform tenant for the purpose of reaching the
management API. The platform tenant's own scope catalog — the same, ordinary per-tenant mechanism
every tenant uses to define what a consent screen may grant — has never had the management API's
scopes added to it, since nothing has ever asked it to issue a token for them.

### The insight that shrinks this: enforcement never belongs in the token

The session path's real trick is that a token (or cookie) only ever has to prove _who_ is asking.
_What tenant, at what role_ is resolved fresh against the control plane's own membership records,
on every single request. Nothing about that requires the credential to name a tenant at all. Once
that's the model, a subject holding several memberships — across tenants owned by different
customers — costs nothing extra: the same lookup that already runs today just returns a different
row depending on which tenant the request names. No token needs to enumerate what a person can
reach; the control plane already knows, and asking it fresh is cheap and always current.

A machine credential is different in exactly one way: there is no person behind it to look up a
membership for. Something still has to say, once, which tenant a given registered client may act
for — that fact has nowhere else to live. Machine access keeps a registration-time tenant binding;
human access never needs one.

### What already supports this with no new code

Every tenant, the platform tenant included, already has a generic client-credentials grant: a
registered client presents its id and secret, names a scope and a target resource, and receives a
token audienced and scoped accordingly, signed under that tenant's own key. A tenant's own scope
catalog is a plain table of rows a consent screen reads from — adding the management API's scope
vocabulary to the platform tenant's is inserting rows, not writing code. Membership records
already impose no limit on how many tenants one subject can hold one — nothing about "a subject may
administer several, differently-owned tenants" needed a schema change; it was already true.

## Decision

1. **Retire** the management-only client registry, its dedicated signing-key rotation, and the
   bespoke access-token shape minted only for `client_credentials`. Every management API credential,
   machine or human, is issued by the platform tenant's own token endpoint from here on.
2. **The platform tenant's scope catalog gains the management API's scope vocabulary** —
   `subjects:read`, `clients:write`, and the rest, unchanged from what they already mean — as
   ordinary rows, the same way any tenant's own scopes are defined.
3. **Machine access**: an OAuth client registered against the platform tenant, granted
   `client_credentials`, requests the management API's own resource identifier and a scope. A small
   control-plane record replaces the one job the retired registry did — naming which tenant a given
   client id may reach — checked at request time exactly the way a membership is. It carries no
   scope ceiling of its own: the token's own granted scope, checked against what the route requires,
   is enough.
4. **Human access, interactively**: an OAuth client registered against the platform tenant runs an
   ordinary authorization-code-with-PKCE flow. The person signs in (or is already signed in) to the
   platform tenant, consents to the requested scopes, and the resulting token is presented to the
   management API. Which tenant it reaches is never encoded in the token — it is resolved fresh
   against the same membership records the existing session path already checks, for whichever
   tenant a given request names. A subject with several memberships, across tenants owned by
   different customers, is handled by this without any special case.
5. **Human access, first-party**: the existing session-cookie path is kept exactly as it is, as a
   same-origin shortcut available only to first-party callers sharing the platform's own cookie —
   it already implements point 4's own enforcement model and needs nothing changed.
6. **The management API's bearer verification** trusts the platform tenant's own published keys —
   checking that a presented token's issuer is the platform tenant and its audience names the
   management API — replacing the separate, dedicated signing key it trusted before.
7. **Dynamic Client Registration** (RFC 7591) is added to a tenant's own client-registration
   surface, as a general capability rather than something special to the platform tenant — usable
   here first, and later by any customer tenant wanting the same for its own relying parties.
8. **Client ID Metadata Document** support is added at authorize time, alongside Dynamic Client
   Registration, specifically so an MCP server can connect with no registration step at all — the
   ecosystem it was built for.

A dashboard (a rendered administrative interface, as opposed to the authorization mechanism this
ADR builds) is out of scope here and remains its own, later decision — what this makes possible is
that a dashboard, an MCP server, and a CLI are all, equally, just OAuth clients of the platform
tenant from here on.

## Consequences

### Positive

- One real authorization-server implementation serves every management API caller — a script, a
  dashboard, an agent — rather than a parallel one built solely for machine credentials.
- A subject administering tenants owned by different customers needs no special handling anywhere:
  the request-time membership check already covers it.
- Dynamic Client Registration and Client ID Metadata Documents are general platform capabilities
  from the day they exist, not something bolted onto one special tenant.

### Negative

- This retires and replaces a working, already-tested mechanism; every existing test exercising the
  old machine-credential path moves to the new one, and the migration itself is real work.
- Two distinct enforcement models now coexist by design — a machine's tenant is fixed at
  registration, a person's is resolved fresh per request — worth stating plainly so neither is later
  "simplified" into the other by mistake.

### Neutral

- The dashboard's own page inventory remains a separate, later ADR.

## Alternatives Considered

**Keep the machine-credential registry as a second, permanent path alongside the new one.** Less
disruptive in the moment. Rejected: nothing built on this is deployed yet, so consolidating now
costs nothing a later migration wouldn't also cost, and keeping two mechanisms that do the same job
forever is exactly the duplication this decision exists to remove.

**Bake the authorized tenant into a human-obtained token at consent time** (ADR-045's own
approach). Rejected: once enforcement lives at request time, naming a tenant in the token adds
nothing and only forces a "pick one tenant" step at consent that a subject with several memberships
would otherwise never need.

## References

- [ADR-045: Management API Authorization Server](./ADR-045-management-api-authorization-server.md) — superseded by this ADR
- [ADR-034: Management API](./ADR-034-management-api.md) — the scope vocabulary and the session-based membership check this reuses unchanged
- [ADR-032: Machine-to-Machine Access and API Keys](./ADR-032-machine-to-machine-access-and-api-keys.md) — the existing client-credentials grant every tenant already has, generalized here
- [ADR-014: Clients and Client Secrets](./ADR-014-clients-and-client-secrets.md) — client registration, gaining Dynamic Client Registration
- [ADR-015: Consent and Scopes](./ADR-015-consent-and-scopes.md) — the scope catalog the management vocabulary joins
