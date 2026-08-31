# ADR-038: Auth SDK, An OAuth 2.0 And OIDC Client For Remix On Workers

## Status

**Proposed** - 2026-08-30

## Background

`@pkg/oidc-provider` is an OpenID Connect provider. The client half of that protocol is spread across two packages that share no code and no conventions: `@pkg/auth-sdk` runs the `client_credentials` grant and reads a subject from the management API, and `@pkg/oidc-client` runs the browser login flow. Around them sit four independently grown ID-token verifiers, one of which skips the signature entirely.

The bar for the replacement is Better Auth's OAuth client surface: every step of the flow overridable through a named option, the identity anchor kept separate from profile mapping, RP-initiated logout as a first-class call, an ID-token sign-in path beside the redirect flow, and documented error codes. What is _not_ taken from it is its shape. Better Auth is a framework that owns a database, a user model, accounts, and verification tables. This package owns none of that.

## Context

### The Package Is A Client, Not A Framework

Non-goals, stated so they stay non-goals: no user, account, or verification tables; no database adapter; no account linking; no password, email, or 2FA flows; no client-side JavaScript.

What the package persists is a token set in a `remix/session`. Whether an app turns a subject into a user row is the app's decision, made in a hook this package calls and does not itself implement.

### `remix/auth` Goes, `remix/middleware/auth` Stays

They are separate packages with separate jobs, and the repo already leans on them unequally: `remix/auth` is imported by 8 files, `remix/middleware/auth` by roughly 80 across `apps/uptime`, `apps/blog`, and `@pkg/blog-engine`.

`remix/auth` owns protocol this package needs to control, and its OIDC provider is closed in the places that matter. Reading 0.2.6's source: `createOAuthProvider`, `exchangeAuthorizationCode`, and `exchangeRefreshToken` are not exported, so `createOIDCAuthProvider` is the only extension point; `handleCallback` requires a `userinfo_endpoint` and throws without one; `tokens.idToken` is captured and never parsed, so nothing verifies it; and the transaction holds `state` and `codeVerifier` with no slot for a `nonce`. Wrapping that costs a mandatory userinfo round-trip and a nonce smuggled through `providerState`, to inherit a flow whose internals cannot be reached.

`remix/middleware/auth` owns HTTP plumbing with no protocol in it: resolving `context.auth`, ordered scheme fallback, `401` with `WWW-Authenticate`, and `requireAuth()`. Its `AuthScheme` is a two-member interface, `{ name, authenticate(context) }`. This package implements that interface instead of reimplementing the middleware, and because the interface is that small, the decision is cheap to revisit.

## Decision

### 1. One Package, `@pkg/auth`, Classes Throughout

`packages/auth`, a single `.` export. Every unit is a class constructed with its collaborator and its options — `new Thing(dependency, options)` — matching `CloudflareAdapter` and the rest of the repo. Both old packages are deleted, not shimmed.

### 2. Four Roles, Four Classes

The protocol has distinct actors; each gets a class, and no class does another's job.

```ts
// The server every other class talks to. One per issuer, shared by all of them.
let issuer = new Issuer(env.OIDC_ISSUER, { cache: new Cache.KV(env.CACHE) });

// Signing a person in through the browser: the login, callback, and logout routes.
let rp = new RelyingParty(issuer, { clientId, clientSecret, redirectUri });

// Acting as itself, with no person present: cron jobs, queue consumers, server-to-server reads.
let service = new ServiceClient(issuer, { clientId, clientSecret });

// Being called by someone else: verifying the bearer token on an incoming API request.
let api = new ResourceServer(issuer, { audience: "uptime" });

// Reading and writing the provider's own records over its management API.
let admin = new ManagementClient(service);
```

`Issuer` is the server: discovery metadata, JWKS, and the caches both live behind it, so an issuer's documents are fetched once no matter how many roles an app plays. It takes inline `metadata` for apps that skip discovery.

### 3. The Browser Flow Is Three Methods

```ts
router.get(routes.auth.login, (ctx) => rp.authorize(ctx, { returnTo }));
router.get(routes.auth.callback, async (ctx) => {
	let grant = await rp.callback(ctx); // Grant: idToken, accessToken, refreshToken, returnTo
	let user = await User.findOrCreate(db, grant.idToken.subject); // the app's call, not ours
	return redirect(grant.returnTo ?? "/");
});
router.post(routes.auth.logout, (ctx) => rp.endSession(ctx, { returnTo: "/" }));
```

`authorize` generates `state`, the PKCE verifier, and the `nonce`, writes the transaction to the session, and returns the redirect. `callback` checks `state`, exchanges the code, verifies the ID token, checks the `nonce`, checks `at_hash` when the issuer sends one, and clears the transaction. `endSession` clears the local session and redirects to `end_session_endpoint` with `id_token_hint`; `{ redirect: false }` returns the URL instead.

Because the transaction lives in the session and never travels to the browser, everything in it is server-trusted. Better Auth needs two slots for state — client-supplied `additionalData` and server-only `serverContext` — and this design needs one.

### 4. Tokens Are `JWT` Subclasses

`@pkg/jwt`'s `JWT` exists to be subclassed, and its `verify`/`decode` statics use a polymorphic `this`, so a subclass's verify returns that subclass.

The base class already covers the registered claims — `issuer`, `subject`, `audience`, `id`, `issuedAt`, `notBefore`, `expiresAt`, `expiresIn`, `expired` — and its proxy reads any other claim by name. A subclass adds an accessor only where the claim needs a name, a type, or a narrower nullability than the proxy can give it.

```ts
class IdToken extends JWT {
	// `sub`. Required in an ID token, so the base class's `string | null` would put a
	// null check at every call site that cannot fail. It is the anchor apps key on.
	override get subject(): string;

	// Compared against the transaction on callback. Without that comparison, an ID
	// token issued for one login replays into another.
	get nonce(): string | null;

	// `auth_time`: seconds in the claim, a `Date` here. Required when `max_age` was
	// requested, and it decides whether to re-prompt before a sensitive action.
	get authTime(): Date | null;

	// `sid`. The join key between a login and the logout token that ends it (ADR-003).
	get sessionId(): string | null;

	// `at_hash`. Binds the ID token to the access token issued beside it, and is
	// verified when present. Our provider sends none, so it reads null against it.
	get atHash(): string | null;

	// The display name apps write to their own records. Nullable because the provider
	// sends it only with the `profile` scope.
	get name(): string | null;

	// Profile data under the `email` scope, never an identity key: it is mutable at
	// the provider, and an identity key has to be immutable.
	get email(): string | null;

	// `email_verified`, and `false` when the claim is absent rather than `null`, so an
	// authorization decision cannot treat "missing" as a third state. A provider that
	// serializes it as the string "true" normalizes here.
	get emailVerified(): boolean;

	// `preferred_username`. Display-only and mutable, named for the role it plays to
	// match the accessor the provider already exposes for the same claim.
	get username(): string | null;

	// Left a `string`: the value is provider-controlled, and parsing it into a `URL`
	// inside a getter would throw where the caller cannot catch it.
	get picture(): string | null;
}

class AccessToken extends JWT {
	// `scope` arrives as one space-separated string. Every caller wants a list, and
	// re-splitting it per call site is where scope checks go subtly wrong.
	get scopes(): string[];

	// `client_id`, required of a JWT access token by RFC 9068 §2.2. It names the
	// caller in the case where `sub` is a person rather than a service.
	get clientId(): string | null;

	// The question a resource server actually asks. A method because it takes an
	// argument, and it keeps `scopes.includes(...)` out of route code.
	has(scope: string): boolean;
}
```

`IdToken`'s accessors otherwise mirror the provider's server-side `IdToken` claim for claim and name for name, so one claim is not called two things in one repo.

One provider behavior shapes how `ResourceServer` is configured: `aud` is the client id on an authorization-code token, and the issuer plus the requested resources on a client-credentials one. A `sub` equal to `client_id` is what marks the latter as a service rather than a person, which RFC 9068 §2.2.1 prescribes.

`LogoutToken` follows when backchannel logout (ADR-003) lands. A refresh token carries no claims, so it stays a string on the `Grant`.

Every verification in the package is `IdToken.verify(raw, await issuer.keys(), { issuer, audience })`. There is one verifier, and it checks the signature.

### 5. Session State Is A Token Set The App Reads

`AuthSession` wraps the one session key this package writes:

```ts
let auth = AuthSession.from(ctx); // null when signed out
auth.idToken; // IdToken
auth.accessToken; // AccessToken
auth.expired; // access token past expiry
await auth.refresh(rp); // exchanges the refresh token, rewrites the session
```

Nothing else is persisted. An app that wants a user row fetches it in the scheme's `verify`, an app that only needs claims reads them off `auth.idToken`, and neither choice is in this package.

### 6. Request-Time Auth Is An `AuthScheme`

```ts
createRouter({
	middleware: [
		session(cookie, storage),
		auth({
			schemes: [
				rp.scheme({ verify: (auth) => users.getBySubject(auth.idToken.subject) }),
				api.scheme({ verify: (token) => ({ clientId: token.clientId }) }),
			],
		}),
	],
});
```

`rp.scheme` reads `AuthSession`, refreshes an expired access token, and hands the app's `verify` the result. `api.scheme` reads the `Authorization` header, verifies a JWT access token against the cached JWKS, and falls back to RFC 7662 introspection for an opaque one. `requireAuth()` and `context.auth` keep working exactly as they do in the ~80 files already using them.

### 7. Every Step Has A Named Override

| Need                                                  | Option                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| Claims from the ID token, with no userinfo request    | `userInfo: "never"` (default), `"always"`, `"when-missing"` |
| A profile shape of the app's own                      | `mapProfile(claims, tokens)`                                |
| An identity anchor that is not `sub`                  | `subject(claims)`                                           |
| Extra authorization parameters                        | `authorizationParams`                                       |
| Extra token parameters                                | `tokenParams`                                               |
| `client_secret_basic` instead of `client_secret_post` | `clientAuth`                                                |
| No discovery document                                 | `metadata` on the `Issuer`                                  |
| Rate limiting on the flow                             | `rateLimit`                                                 |

`mapProfile` cannot set the subject — profile mapping and account recognition are separate concerns, and conflating them is how a mutable claim like `email` ends up as an identity key. Reserved authorization parameters (`state`, `client_id`, `redirect_uri`, `response_type`, `scope`, `code_challenge`, `code_challenge_method`, `nonce`) are rejected rather than merged, so a caller cannot break callback correlation.

Owning the flow is what makes `userInfo: "never"` possible: the ID token is verified, so its claims are trustworthy, and the third round-trip is optional rather than mandatory.

### 8. Cloudflare Is The Runtime, Not A Target

- **Caching.** Discovery documents, JWKS, and `client_credentials` tokens go in a `@pkg/kv-cache` `Cache.Store` behind an in-isolate memo. Isolate-lifetime maps re-fetch on every cold start, which on Workers is often.
- **Rate limiting.** `RelyingParty` and `ServiceClient` take a `@pkg/rate-limit` `Adapter`. `CloudflareAdapter` wraps the native binding; the other three adapters work for tests and local runs. Keys come from `@pkg/get-client-ip` for browser routes and from the client id for the token grant.
- **`waitUntil`.** Cache writes and revocation calls do not block the response.

### 9. A Verification Failure Throws, A Legitimate Outcome Returns

Protocol violations — bad `state`, `nonce` mismatch, invalid signature, wrong audience, expired token — throw an `AuthError` with a documented `code`. Ordinary outcomes return a value: `api.scheme`'s verify answers `null` for absent or invalid credentials because that is the middleware's normal path, and `ManagementClient` reads return `Result` because not-found is an answer.

### 10. ID-Token Sign-In Without The Redirect

`rp.verifyIdToken(raw)` returns a verified `IdToken` for a token an app obtained elsewhere — a native client, a test fixture, an IdP-initiated flow. It is the same verifier `callback` uses, minus the `nonce` check the redirect flow supplies.

## Consequences

### Positive

- One ID-token verifier, signature included, replacing four.
- One discovery fetch per issuer per KV TTL instead of one per isolate, three times over.
- A login costs two round-trips instead of three.
- No database, so the package is testable with MSW alone and adds no migration to any app.
- Rate limiting arrives through an adapter the repo already ships, on the native binding.

### Negative

- Owning the flow means owning `state`, PKCE, the nonce, the transaction, and callback error handling, with the security burden that carries. The specs are the mitigation, and they come first.
- More surface than either package it replaces: five classes and the token subclasses.
- Apps on `remix/auth` today are rewritten, not adapted.

### Neutral

- `client_secret_post` is the default, matching the provider's advertised methods; `client_secret_basic` is one option away.
- `remix/middleware/auth` stays a dependency. The `AuthScheme` interface is two members, so replacing it later changes no class in this package.

## Implementation Plan

Specs first, per the repo convention.

1. **Issuer and tokens** — discovery, JWKS, the KV-backed caches, `IdToken`, `AccessToken`, `AuthError` and its codes.
2. **Relying party** — `authorize`, `callback`, `endSession`, `verifyIdToken`, `AuthSession`, the transaction, the override hooks.
3. **Service client** — `client_credentials` with resource indicators, the cached and single-flighted token, `introspect`, `revoke`.
4. **Resource server** — `scheme`, the local-JWT and introspection paths.
5. **Management client** — `fetchSubjectById`, widened only on demand.
6. **Rate limiting** — the adapter seam through both client classes.
7. **Cutover.**

| Deleted                                          | Rewritten                                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `packages/auth-sdk`, `packages/oidc-client`      | `apps/uptime`: OAuth service, auth controller, subjects service, container, two jobs, team settings |
| `apps/uptime/app/auth/value-objects/id-token.ts` | `apps/blog`: OAuth service, auth controller, auth middleware                                        |
| `apps/blog/app/auth/value-objects/id-token.ts`   | `apps/blog-saas/app/http/controllers/auth.tsx`                                                      |
| `apps/auth-saas/app/lib/id-token-verify.ts`      | `@pkg/blog-engine`: OIDC module, auth controller, auth middleware                                   |

## Alternatives Considered

### 1. Wrap `createOIDCAuthProvider`

The previous revision of this ADR. Rejected: it inherits a mandatory userinfo request, forces the nonce through `providerState` — a mutation that works but is not a documented contract — and leaves token exchange and verification unreachable behind a closed provider.

### 2. Replace `remix/middleware/auth` As Well

Rejected. It contains no protocol, ~80 files depend on its contract, and a scheme is a two-member interface. Owning it buys control of `WWW-Authenticate` header formatting.

### 3. A Better Auth Shaped Config Object

One `betterAuth({ ... })` call returning an inferred client. Rejected: the inference and the plugin system exist to serve a client bundle and a database schema, and this package has neither. Classes with constructor injection give the same discoverability server-side without the type machinery.

### 4. Keep The Session Record Opaque To The App

Rejected by the no-DB constraint. The app decides what a subject means, so it needs the tokens and the claims, not a resolved user this package invented.

### 5. Module-Scope Caches

What both current packages do. Rejected: on Workers a cold isolate re-fetches discovery, JWKS, and every M2M token. KV with an isolate memo in front is the same code with a shared tier underneath.

## References

- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) — §3.1.3.7 ID token validation, §15.5.2 nonce
- [OpenID Connect RP-Initiated Logout 1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)
- [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) §4.4, [RFC 7009](https://datatracker.ietf.org/doc/html/rfc7009), [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636), [RFC 7662](https://datatracker.ietf.org/doc/html/rfc7662), [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707)
- [Better Auth: OAuth](https://better-auth.com/docs/concepts/oauth), [Generic OAuth](https://better-auth.com/docs/plugins/generic-oauth) — the surface this one is measured against
- ADR-003: OIDC Backchannel Logout
- ADR-011: OIDC Provider Engine Package
- ADR-019: Adapter-Based Rate Limiting Package
