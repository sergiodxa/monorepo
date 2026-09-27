# ADR-044: Platform Sign-Back-In

## Status

**Implemented** - 2026-09-26

## Background

ADR-043 opens a platform session the moment a signup verifies, and the invitation-accept
route (ADR-034) opens one the moment an invitation is accepted — both by calling
`openSessionForSubject` directly and setting the cookie, never through a sign-in form. Neither
route considered what happens once that cookie expires: the platform tenant's own subjects fully
support password sign-in, TOTP, password reset and magic-link sign-in (every RPC method exists
and is exercised by both of those routes' own tests), but nothing serves a hosted page for any of
them on the platform's own domain. `bootstrap/worker.ts`'s `isPlatformHost(hostname)` always
routes the bare platform domain to the marketing/signup router; the router that serves
`/u/sign-in`, `/u/reset` and `/u/magic-link` (`tenantRouter`, mounted in `bootstrap/tenant-app.ts`)
is reached only by a hostname the control plane resolves to a real, D1-registered tenant — and the
platform tenant has no `tenants`/`domains` row at all, being addressed purely by
`env.TENANT.getByName(env.PLATFORM_DOMAIN)`.

The result: a signed-up owner who signs out, or whose cookie simply expires, has no way back in.
ADR-043's own confirmation screen makes this worse by pointing at a sign-in page that cannot work
for them at all — `tenant.issuer` (the brand-new tenant's own hostname), whose subject store holds
no one, since the owner's credential lives in the platform tenant's object instead.

## Context

### Reuse the existing hosted pages, addressed at a different tenant

Every hosted controller (`hosted/sign-in.tsx`, `hosted/reset.tsx`, `hosted/magic-link.tsx`,
`hosted/second-factor.tsx`) already reads `ctx.tenantStub`/`ctx.tenant` generically — nothing in
any of them assumes a real, D1-registered tenant behind those values, only that
`TENANT_ID_HEADER`/`TENANT_ISSUER_HEADER`/`TENANT_REGION_HEADER` name one. `forwardToTenant` in
`bootstrap/worker.ts` already builds exactly this header set from a `ResolvedTenant`; the only
thing missing for the platform tenant is a `ResolvedTenant` value to forward with, since nothing
resolves it from D1 today, by design — it has no row there to find.

### Not every hosted path belongs on the platform domain

`hosted/sign-up.tsx` and `hosted/verify.tsx` claim and verify an identifier the same way
`/signup` does, and forwarding them too would let a visitor create a platform subject that owns no
tenant at all — a second, inconsistent front door into the same subject store `/signup` already
owns end to end. `hosted/device.tsx` and `hosted/consent.tsx` only make sense mid-authorization,
which nothing on the platform domain ever runs. So the platform domain forwards a fixed, explicit
allowlist — sign-in (and its passkey ceremony), second-factor, reset, magic-link, and the error
page — and nothing else; an allowlist fails closed, so a hosted route added later needs a
deliberate decision to reach the platform domain rather than reaching it by default.

## Decision

### The allowlisted paths

```
/u/sign-in
/u/sign-in/passkey/options
/u/sign-in/passkey/verify
/u/second-factor
/u/second-factor/enrol
/u/second-factor/continue
/u/reset
/u/magic-link
/u/magic-link/complete
/u/error
```

### Where the forward lives

`bootstrap/app.ts`'s router gets its own `defaultHandler` (replacing the shared `notFound`
controller it uses today) that checks the incoming request's path against the allowlist above.
A match forwards the request to `tenantRouter` (imported from `./tenant-app`, the same router
`bootstrap/worker.ts` already forwards a real tenant's traffic to) carrying a synthetic
`ResolvedTenant`:

```ts
{ tenantId: env.PLATFORM_DOMAIN, region: "wnam", issuer: `https://${env.PLATFORM_DOMAIN}` }
```

`tenantId` is the platform tenant's own Durable Object name — the exact string
`env.TENANT.getByName` already addresses it by everywhere else in this app — not a D1 id, since
none exists. `region` carries no real placement meaning here (the object is already running
wherever it was first created); it is metadata `ctx.tenant.region` merely echoes, so a fixed
value costs nothing. A path outside the allowlist still answers the plain `404 Not Found` the
shared `notFound` controller already returns, unchanged.

### `ADR-043`'s confirmation screen

`app/http/controllers/signup/verify.tsx`'s `signInUrl` moves from the new tenant's own issuer to
the platform's own: `https://${env.PLATFORM_DOMAIN}/u/sign-in?return_to=/`. `return_to=/` is
required — `safeReturnTo` resolves nothing without one — and lands a signed-in visitor back on
the marketing homepage, since no dashboard exists yet to send them to instead; that limitation is
already accepted throughout this ADR series and is not this ADR's problem to solve.

## Consequences

### Positive

- An owner has a real way back into their platform account: password, TOTP, reset, or magic link,
  through pages that already exist and are already tested.
- No hosted controller is touched or forked; the platform domain is a second address the exact
  same router answers at, the way `bootstrap/worker.ts` already treats every other tenant.

### Negative

- The allowlist is a second place a future hosted route's author must remember to update, if that
  route is ever meant to reach the platform domain too.
- Signing back in still lands on the marketing homepage, not a dashboard, since none exists.

### Neutral

- `/u/sign-up` and `/u/verify` stay unreachable on the platform domain by design; `/signup`
  remains the platform's only front door for creating an owner.

## References

- [ADR-043: Platform Onboarding](./ADR-043-platform-onboarding.md) — the confirmation screen this corrects, and the session this makes it possible to renew
- [ADR-005: Hostname Resolution and Tenant Domains](./ADR-005-hostname-resolution-and-tenant-domains.md) — `forwardToTenant`'s header contract this reuses unchanged
- [ADR-034: Management API](./ADR-034-management-api.md) — the invitation-accept route with the same open-a-session-with-no-way-back gap
