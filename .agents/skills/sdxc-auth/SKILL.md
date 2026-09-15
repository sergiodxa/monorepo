---
name: sdxc-auth
description: "@sdxc/auth is an OAuth 2.0 and OpenID Connect client for any runtime with fetch: one `Issuer` shared by `RelyingParty` (browser login/callback/logout), `ServiceClient`, `ResourceServer` and `ManagementClient`, plus optional remix router schemes. Use when adding OIDC sign-in, verifying a bearer token on an API, minting machine-to-machine tokens, refreshing an `AuthSession`, or gating a route on scope, MFA or recent authentication."
---

# @sdxc/auth

Four protocol actors — the browser login, the app acting as itself, the API someone else calls, and the provider's own records — share one `Issuer`, so the discovery document and the key set are fetched once however many roles an app plays. It is a client, not a framework: no user table, no password flow, no client-side JavaScript. The core subpaths need only a runtime with `fetch`; the `@sdxc/auth/remix/*` subpaths add router schemes and authorization helpers and declare `remix` v3 as an optional peer dependency.

Full API, options and examples: [packages/auth/README.md](packages/auth/README.md)

## When to reach for it

- Adding a hosted OIDC login: the authorize redirect, the callback exchange, and end-session logout, with `state`, `nonce` and PKCE handled for you.
- An API has to accept a bearer token from another service, verified against the published key set or over RFC 7662 introspection.
- A scheduled job or background worker needs a token with no person present.
- A route must decide on scope, MFA, or how recently the person authenticated, and send a signed-out request to the login page.
- A stored token set has expired and should be refreshed from its refresh token before the request proceeds.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/auth": "workspace:*" } }
```

```ts
import { Issuer } from "@sdxc/auth/issuer";
import { RelyingParty } from "@sdxc/auth/relying-party";

// One instance per configuration, so every role shares its memos.
let issuer = Issuer.for("https://auth.example.com");

let rp = new RelyingParty(issuer, {
	clientId: CLIENT_ID,
	clientSecret: CLIENT_SECRET,
	redirectUri: "https://app.example.com/auth/callback",
});

let ctx = { request, session: await sessions.open(request) };
return await rp.authorize(ctx, { returnTo: url.searchParams.get("returnTo") });
```

### Entry points

- `@sdxc/auth/issuer` — the discovery document and key set every role shares
- `@sdxc/auth/relying-party` — the browser login, callback, and logout
- `@sdxc/auth/service-client` — acting as the app itself, with no person present
- `@sdxc/auth/resource-server` — accepting a bearer token an incoming request carries
- `@sdxc/auth/management-client` — reading the provider's own subject records
- `@sdxc/auth/auth-session` — the token set a login leaves in a session store
- `@sdxc/auth/id-token` — the verified ID token and its claims
- `@sdxc/auth/access-token` — the verified access token and its claims
- `@sdxc/auth/auth-error` — the error every protocol violation arrives as
- `@sdxc/auth/remix/context` — the session and the flow context, read off a request context
- `@sdxc/auth/remix/schemes` — the two `remix/middleware/auth` schemes
- `@sdxc/auth/remix/authorization` — the helpers a route states its decision in

## Suggestions

- Build one `Issuer.for(url)` at module scope and hand it to every role; `for` returns the same instance for the same terms, so discovery and JWKS are read once per isolate. Values that vary per request go to the constructor instead.
- The browser flow is three methods over one `{ request, session }` context, so it works under any router over any store with `get`, `set` and `unset`.
- On a `remix` router the middleware order is load-bearing: `asyncContext()` first (the authorization helpers read the request through it), then the session middleware (before any scheme reads the session), then `catchResponse()` (so a thrown redirect or `429` becomes the reply), then `auth({ schemes })`.
- `currentSession()` and `anonymous()` throw a `Response`, which only reaches the browser with `@sdxc/catch-response-middleware` installed; the capability helpers (`subject`, `scope`, `authenticated`, `mfa`) always answer with a value and are safe mid-render.
- `AuthErrorCode` is closed, so a `switch` over it exhausts; every code means the request has to stop, while a legitimate answer (an inactive introspection, a signed-out session) is a value rather than a throw.
- Give `Issuer` a `cache` (a `CacheStore`) to share discovery and key documents across isolates; without one, documents live only as long as the instance.

## Related

- `@sdxc/catch-response-middleware` — what turns the authorization helpers' thrown redirects into responses; skill `sdxc-catch-response-middleware`
- `@sdxc/jwt` — the verification and key-resolver types `Issuer.keys()` answers with; skill `sdxc-jwt`
- `@sdxc/cache` — satisfies the `CacheStore` an `Issuer` shares documents through; skill `sdxc-cache`
