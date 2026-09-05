# ADR-048: Auth Classes Independent Of Remix, With The Wiring Under `remix/`

## Status

**Implemented** - 2026-09-04

## Background

ADR-038 built `@sdxc/auth` for Remix on Workers, and its classes read that runtime
directly: `RelyingParty.authorize`, `callback`, and `endSession` took a `RequestContext`
and reached into it for the `remix/session` `Session`; `AuthSession.from` and `write` did
the same; `RelyingParty.scheme` and `ResourceServer.scheme` built `remix/middleware/auth`
schemes; `createAuthorization` read the request through `remix/middleware/async-context`.
Every module also validated with `remix/data-schema`, so the package's one runtime
dependency was the `remix` umbrella.

The protocol work in those classes has nothing to do with Remix. A relying party mints
`state`, PKCE, and a `nonce`, exchanges a code, verifies an ID token, and needs two things
from its host: the request, and somewhere to keep a login's transaction and token set
between two requests. A resource server needs the `Authorization` header. Neither needs a
router, a middleware chain, or a context key.

## Decision

### 1. The Classes Take Web Primitives Plus One Store Seam

`RelyingParty.Context` is `{ request: Request; session: AuthSession.Store }`, and the three
route methods take it. `AuthSession.from` and `write` take the store alone. The store is
the one seam this package declares:

```ts
interface Store {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
	unset(key: string): void;
	regenerateId?(destroy?: boolean): void;
}
```

A `remix/session` `Session` satisfies it as it stands, which is what keeps the Remix
wiring to a one-line read. A store over a cookie, a KV namespace, or a framework's own
session object needs the three reads and writes and nothing else. `regenerateId` is
optional because a store addressed by no id has nothing to rotate; where it exists, the
callback rotates after a login and the logout rotates while dropping the old record, as
before.

The `303` redirect both flow legs answer with is built with `new Response`, so the core
imports nothing from `remix/*`. Validation moves to `@remix-run/data-schema`, the scoped
package the umbrella re-exports, which is a schema library with no runtime of its own.

### 2. What Was A Scheme Becomes A Method The Scheme Calls

`RelyingParty.scheme` held one decision worth keeping framework-free: a session whose set
has lapsed is renewed, a set the provider refuses to renew ends the session, and a set
that carried no refresh token was never renewable and stays signed in. That is now
`rp.renew(auth)`, answering `null` when the request goes on signed in and the refusal
otherwise, with the session already cleared.

`ResourceServer.scheme` held RFC 6750's header read. That is now `api.verifyRequest(request)`,
answering `null` for a request carrying no bearer credential and throwing `invalid_token`
for one the server declines, so a caller in any framework tells "not for me" apart from
"refused" the way the scheme did.

### 3. The Remix Wiring Lives Under `@sdxc/auth/remix/*`

Three modules, one subpath each, matching the package's no-barrel convention:

| Module                           | Exports                                                    | Replaces                                    |
| -------------------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| `@sdxc/auth/remix/context`       | `sessionOf(ctx)`, `contextOf(ctx)`                         | `ctx.get(Session)` inside the classes       |
| `@sdxc/auth/remix/schemes`       | `sessionScheme(rp, options)`, `bearerScheme(api, options)` | `rp.scheme(options)`, `api.scheme(options)` |
| `@sdxc/auth/remix/authorization` | `createAuthorization(options)`                             | `@sdxc/auth/authorization`                  |

`contextOf(ctx)` is `{ request: ctx.request, session: sessionOf(ctx) }`, so a route
changes from `rp.authorize(ctx, options)` to `rp.authorize(contextOf(ctx), options)` and
nothing else. `createAuthorization` moves whole, because every helper in it reads the
request out of band through `remix/middleware/async-context` and throws a redirect the
`catchResponse()` middleware delivers, which is Remix wiring end to end.

### 4. `remix` Becomes An Optional Peer Dependency

The core depends on `@remix-run/data-schema`. The `remix/*` modules import `remix`, which
the package lists as an optional peer dependency and a dev dependency: an app importing
only the classes installs no router, and every app in this repository already has it.

## Consequences

### Positive

- The four classes, the tokens, and `AuthSession` run in any fetch-shaped runtime, over
  any session store with three methods.
- The core's tests drive the flow through a ten-line in-memory store, with no router, no
  cookie jar, and no middleware chain, so what they assert is the protocol.
- The Remix wiring is small enough to read in one sitting, and each adapter is tested
  through the real middleware it targets.

### Negative

- Every route that calls a flow method wraps its context: `contextOf(ctx)`. Four apps and
  one package were updated in the same change.
- The scheme builders are functions taking the class rather than methods on it, so
  `rp.scheme(...)` becomes `sessionScheme(rp, ...)`.

### Neutral

- `AuthSession.Context` and `RelyingParty.SchemeOptions` are gone; `AuthSession.Store`,
  `SessionSchemeOptions`, and `BearerSchemeOptions` take their places.
- ADR-038's decisions on the protocol, the four roles, the error taxonomy, and the two
  helper families stand. This ADR changes where the Remix wiring lives, not what it does.

## Alternatives Considered

### 1. Subclasses Under `remix/` Taking A `RequestContext`

A `RemixRelyingParty extends RelyingParty` overriding the three methods with
context-taking signatures. Rejected: a method override with a different parameter type is
unsound, and a wrapper class per role is a second copy of each role's surface to keep in
step.

### 2. A Core `authorize` That Returns The URL And Leaves Storage To The Caller

Arctic's shape: `authorize` hands back the URL plus the values to store, `callback` takes
them back. Rejected: the transaction's shape, its one-callback lifetime, and the token
set's storage are what the package exists to get right, and pushing them to every caller
means the Remix adapter re-implements them.

### 3. Keep `remix/data-schema` In The Core

It works outside a Remix app, since the umbrella only re-exports the scoped package.
Rejected because the visible signal that the core is framework-free is that it imports
nothing from `remix/*`, and the scoped package is the same code under its own name.

## References

- ADR-038: Auth SDK, An OAuth 2.0 And OIDC Client For Remix On Workers
- [RFC 6750](https://datatracker.ietf.org/doc/html/rfc6750) §2.1, the header read
  `verifyRequest` performs
