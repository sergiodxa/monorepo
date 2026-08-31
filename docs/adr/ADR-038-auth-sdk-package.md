# ADR-038: Auth SDK, An OAuth 2.0 And OIDC Client For Remix On Workers

## Status

**Accepted** - 2026-08-31

The package is built and tested. The cutover in the Implementation Plan is what remains.

## Background

`@pkg/oidc-provider` is an OpenID Connect provider. The client half of that protocol is spread across two packages that share no code and no conventions: `@pkg/auth-sdk` runs the `client_credentials` grant and reads a subject from the management API, and `@pkg/oidc-client` runs the browser login flow. Around them sit four independently grown ID-token verifiers, one of which skips the signature entirely.

The bar for the replacement is Better Auth's OAuth client surface: every step of the flow overridable through a named option, the identity anchor kept separate from profile mapping, RP-initiated logout as a first-class call, an ID-token sign-in path beside the redirect flow, and documented error codes. What is _not_ taken from it is its shape. Better Auth is a framework that owns a database, a user model, accounts, and verification tables. This package owns none of that.

## Context

### The Package Is A Client, Not A Framework

Non-goals, stated so they stay non-goals: no user, account, or verification tables; no database adapter; no account linking; no password, email, or 2FA flows; no client-side JavaScript.

What the package persists is a token set in a `remix/session`. Whether an app turns a subject into a user row is the app's decision, made in a hook this package calls and does not itself implement.

### The OIDC Flow Comes Here, `remix/middleware/auth` Stays

They are separate packages with separate jobs, and the repo already leans on them unequally: `remix/auth` is imported by 8 files, `remix/middleware/auth` by 81 outside this package — 78 of them in `apps/uptime`, the rest in `apps/blog` and `@pkg/blog-engine`.

`remix/auth` owns protocol this package needs to control, and its OIDC provider is closed in the places that matter. Reading 0.2.7's source, the version `bun.lock` pins: `createOAuthProvider`, `exchangeAuthorizationCode`, and `exchangeRefreshToken` are not exported, so `createOIDCAuthProvider` is the only extension point; `handleCallback` requires a `userinfo_endpoint` and throws without one; `tokens.idToken` is captured and never parsed, so nothing verifies it; and the transaction holds `state` and `codeVerifier` with no slot for a `nonce`. Wrapping that costs a mandatory userinfo round-trip and a nonce smuggled through `providerState`, to inherit a flow whose internals cannot be reached.

One more reason, found while writing this: `remix/auth`'s own `sanitizeReturnTo` is bypassable. It compares origins and then returns `url.pathname + url.search + url.hash`, so `/..//evil.com` passes the origin check and comes back as the protocol-relative `//evil.com`. That was a live open redirect on the blog's login callback, since the callback trusted the sanitized value. Inheriting a flow means inheriting its `returnTo` handling too.

What this package replaces is the OIDC path. `remix/auth` keeps the plain OAuth 2.0 upstream logins it already serves — `apps/r3-auth` signs its own operators in through GitHub with `createGitHubAuthProvider`, which an OIDC client has nothing to say about — so it stays a dependency for those and leaves the table below.

`remix/middleware/auth` owns HTTP plumbing with no protocol in it: resolving the auth state apps read as `context.get(Auth)`, ordered scheme fallback, and `401` with `WWW-Authenticate`. Its `AuthScheme` is a two-member interface, `{ name, authenticate(context) }`. This package implements that interface instead of reimplementing the middleware, and because the interface is that small, the decision is cheap to revisit.

## Decision

### 1. One Package, `@pkg/auth`, Classes Throughout

`packages/auth`, with one subpath export per public module and no `.` entry: `./issuer`, `./relying-party`, `./service-client`, `./resource-server`, `./management-client`, `./auth-session`, `./id-token`, `./access-token`, `./authorization`, `./auth-error`. `packages/http` is the house precedent for a package of independent modules with no barrel, and the shape keeps an app importing the roles it actually plays; a module left out of the map, such as the shared media-type read and the shared expiry rule, is internal by construction.

Every unit is a class constructed with its collaborator and its options — `new Thing(dependency, options)` — matching `CloudflareAdapter` and the rest of the repo. Both old packages are deleted, not shimmed.

### 2. Four Roles, Four Classes

The protocol has distinct actors; each gets a class, and no class does another's job.

```ts
// The server every other class talks to. One per issuer, shared by all of them.
let issuer = new Issuer(env.OIDC_ISSUER, {
	cache: new Cache.KVStore(env.CACHE, (promise) => ctx.waitUntil(promise)),
});

// Signing a person in through the browser: the login, callback, and logout routes.
let rp = new RelyingParty(issuer, { clientId, clientSecret, redirectUri });

// Acting as itself, with no person present: cron jobs, queue consumers, server-to-server reads.
let service = new ServiceClient(issuer, { clientId, clientSecret });

// Being called by someone else: verifying the bearer token on an incoming API request.
let api = new ResourceServer(issuer, { audience: clientId, introspection: service });

// Reading and writing the provider's own records over its management API.
let admin = new ManagementClient(service);
```

`Issuer` is the server: discovery metadata, JWKS, and the cache over both live behind it, so an issuer's documents are fetched once no matter how many roles an app plays. It takes inline `metadata` for apps that skip discovery, validated and identity-checked the same way a fetched document is. A read that failed is not remembered, so the next call retries rather than replaying the error for the life of the isolate.

The cache seam is `Issuer.CacheStore`, a `read`/`write`/`fetch` interface this package declares and `Cache.KVStore` satisfies, so the dependency is on the shape rather than on the class. The audiences a `ResourceServer` answers for are what Decision 4 says `aud` holds — the client id, or the issuer plus each requested resource — and its `introspection` is what opens the path for a credential carrying no claims of its own.

The OIDC Discovery §4.3 check that a document names the issuer it was asked for compares a stated value rather than a guessed one. `identifier` on the `Issuer` says what the provider publishes and writes into every `iss`, while the constructor's `url` stays where discovery is fetched from and every endpoint resolves against: our own provider publishes a scheme-less identifier, frozen because relying parties compare it byte for byte, and a bare host carries no origin to build an endpoint on. Absent `identifier` the URL is the expected value. A value that parses as a URL is compared normalized, because `new Issuer("https://x")` has to match a document publishing `https://x/` and host case carries no meaning in a URL either; an identifier that is not a URL is compared byte for byte. Either way a document naming anything else is `issuer_mismatch`, and `identifier()` answers the document's verbatim `issuer`, so the token-level `iss` comparison stays exact.

### 3. The Browser Flow Is Three Methods

```ts
router.get(routes.auth.login, (ctx) => rp.authorize(ctx, { returnTo }));
router.get(routes.auth.callback, async (ctx) => {
	// Grant: idToken, accessToken, refreshToken, subject, claims, profile, returnTo
	let grant = await rp.callback(ctx);
	let user = await User.findOrCreate(db, grant.subject); // the app's call, not ours
	return redirect(grant.returnTo); // already sanitized, already defaulted
});
router.post(routes.auth.logout, (ctx) => rp.endSession(ctx, { returnTo: "/" }));
```

`authorize` generates `state`, the PKCE verifier, and the `nonce`, writes the transaction to the session, and returns the redirect. `callback` checks `state`, exchanges the code, verifies the ID token, checks the `nonce`, checks `at_hash` when the issuer sends one, and clears the transaction. `endSession` clears the local session and redirects to `end_session_endpoint` with `id_token_hint`; `{ redirect: false }` returns the URL instead. Both `authorize` and `endSession` answer `303`, since a form post reaches either one and the browser has to follow it with a `GET`.

Because the transaction lives in the session and never travels to the browser, everything in it is server-trusted. Better Auth needs two slots for state — client-supplied `additionalData` and server-only `serverContext` — and this design needs one.

`returnTo` is sanitized by `authorize` before it reaches the transaction, and `startsWith("/")` is not the check that does it. `//evil.com`, `/\/evil.com`, and `/\evil.com` all pass that test and all resolve to an attacker's origin. Comparing origins after resolution is necessary but not sufficient either: `/..//evil.com` normalizes to `//evil.com` while resolution still reports our own origin, so the normalized pathname has to be re-checked. `Location.safe()` in `@pkg/location` does all three, and `authorize`, `endSession`, and the login redirect the identity helpers throw all route their `returnTo` through it.

The bug class turned out to be repo-wide rather than `remix/auth`'s alone. Building this package surfaced two more of it: the uptime app's `returnTo` cookie was narrowed with `startsWith("/")` plus a `//` test and no backslash guard, and `@pkg/blog-engine`'s `safeNext` compared origins and then returned `resolved.pathname`, which is the `/..//evil.com` bypass exactly. Both now go through `@pkg/location`, each with a regression test seen to fail against the old behavior first.

### 4. Tokens Are `JWT` Subclasses

`@pkg/jwt`'s `JWT` exists to be subclassed, and its `verify`/`decode` statics use a polymorphic `this`, so a subclass's verify returns that subclass.

The base class already covers the registered claims — `issuer`, `subject`, `audience`, `id`, `issuedAt`, `notBefore`, `expiresAt`, `expiresIn`, `expired` — and its proxy reads any other claim by name. A subclass adds an accessor only where the claim needs a name, a type, or a narrower nullability than the proxy can give it.

```ts
class IdToken extends JWT {
	// `sub`, the identity anchor apps key their own records on. Always present, since
	// OIDC requires it in an ID token, and immutable at the provider, which is what
	// makes it safe as a record key.
	override get subject(): string;

	// `nonce`. Matching it against the transaction on callback binds this token to
	// the login that asked for it.
	get nonce(): string | null;

	// `auth_time`: seconds in the claim, a `Date` here. Required when `max_age` was
	// requested, and it decides whether to re-prompt before a sensitive action.
	get authTime(): Date | null;

	// `sid`. The join key between a login and the logout token that ends it (ADR-003).
	get sessionId(): string | null;

	// `at_hash`. Binds the ID token to the access token issued beside it, and is
	// verified when present. Our provider sends none, so it reads null against it.
	get atHash(): string | null;

	// `amr`, the authentication methods that took part. This claim is how an identity
	// provider tells a relying party that MFA actually happened.
	get amr(): IdToken.AuthenticationMethod[];

	// `acr`, the authentication context class the provider says it met, and the claim
	// an `acr_values` request is answered in. Both this and `amr` are read because
	// providers disagree about which of the two they populate.
	get acr(): string | null;

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

	// `picture`, the avatar the provider publishes, as the string it sent. A caller
	// that wants a `URL` parses it where it can handle a provider-controlled value.
	get picture(): string | null;
}

class AccessToken extends JWT {
	// `scope` arrives as one space-separated string. Every caller wants a list, and
	// re-splitting it per call site is where scope checks go subtly wrong.
	get scopes(): string[];

	// `client_id`, required of a JWT access token by RFC 9068 §2.2. It names the
	// caller in the case where `sub` is a person rather than a service.
	get clientId(): string | null;

	// `sub` equal to `client_id`, the RFC 9068 §2.2.1 marker for a client acting as
	// itself. One of the two claims alone, or neither, reads as a person's token.
	get issuedToService(): boolean;

	// The question a resource server actually asks. A method because it takes an
	// argument, and it keeps `scopes.includes(...)` out of route code.
	has(scope: string): boolean;
}
```

`amr` abbreviates Authentication Methods References, and each of its elements identifies one method that took part. The type says that in full, the way `JWK.Algorithm` already spells out the `alg` header's type — the wire keeps the short name, the type gets the word. It follows that same const-object-plus-type shape, without closing the union. The const is a module-level `AUTHENTICATION_METHODS`, because `AGENTS.md` keeps runtime values out of namespaces and names module constants in `ALL_UPPER_SNAKE_CASE`; the namespace holds the type alone:

```ts
const AUTHENTICATION_METHODS = {
	Mfa: "mfa",
	Otp: "otp",
	Pwd: "pwd",
	Hwk: "hwk",
	/* …twenty in all */
} as const;

namespace IdToken {
	type AuthenticationMethod =
		(typeof AUTHENTICATION_METHODS)[keyof typeof AUTHENTICATION_METHODS] | (string & {});
}
```

RFC 8176 §2 registers exactly twenty values — `face`, `fpt`, `geo`, `hwk`, `iris`, `kba`, `mca`, `mfa`, `otp`, `pin`, `pwd`, `rba`, `retina`, `sc`, `sms`, `swk`, `tel`, `user`, `vbm`, `wia` — but §3 puts the registry under Expert Review rather than closing it, and OIDC Core has the parties agree on meanings that may be context-specific. Providers use that room: Entra sends `ngcmfa` and `wiaormfa`, and our own provider advertises `urn:passkey`. So the twenty give autocomplete and the `string & {}` arm keeps a real token from being rejected by its type.

`acr` gets no union at all, because there is no registry behind it — its values are whatever an identity provider publishes in `acr_values_supported`. That asymmetry between the two claims is the reason `mfa()` is configured rather than hard-coded to `["mfa"]`.

`IdToken`'s accessors otherwise mirror the provider's server-side `IdToken` claim for claim and name for name, so one claim is not called two things in one repo.

One provider behavior shapes how `ResourceServer` is configured: `aud` is the client id on an authorization-code token, and the issuer plus the requested resources on a client-credentials one. A `sub` equal to `client_id` is what marks the latter as a service rather than a person, which RFC 9068 §2.2.1 prescribes. `AccessToken.issuedToService` is where that comparison lives, and it reads a token carrying one of the two claims, or neither, as a person's.

`LogoutToken` follows when backchannel logout (ADR-003) lands. A refresh token carries no claims, so it stays a string on the `Grant`.

Every ID token goes through `IdToken.verify(raw, await issuer.keys(), { issuer, audience })`, and `ResourceServer` puts an inbound access token through `AccessToken.verify` against the same key set. Two reads are claims-only, both deliberately: `callback` returns the access token via `AccessToken.decode`, because it arrived on an authenticated back-channel response addressed to a client that is not the token's audience, and an introspected credential is rebuilt from the issuer's own description of it.

`at_hash` is checked with the digest OpenID Connect Core §3.1.3.6 pairs with the ID token's `alg`, and an `alg` outside that table refuses the token rather than passing an uncheckable binding over. `@pkg/jwt` verifies `ES256`, `RS256`, and `EdDSA`, so the SHA-384 and SHA-512 rows of the table are forward compatibility: they become reachable when `@pkg/jwt` learns those algorithms, and until then an ID token signed with one fails at the signature check before its `at_hash` is read.

### 5. Session State Is A Token Set The App Reads

`AuthSession` wraps the one session key this package writes:

```ts
let auth = AuthSession.from(ctx); // null when signed out
auth.idToken; // IdToken
auth.accessToken; // AccessToken
auth.expired; // the stored token set has reached its end
await auth.refresh(rp); // exchanges the refresh token, rewrites the session
```

`expired` reads the one expiry rule every holder of a token set shares. The access token's own signed `exp` answers first, because it is the value a resource server enforces; the `expires_in` the token endpoint stated answers for an opaque access token, whose claims no holder reads; and for a session the ID token's `exp` answers for a set carrying neither, which OpenID Connect Core requires and which the ID-token verification already checked when the set was written. A lifetime no source vouches for reads as spent, so one round-trip buys a credential that states one. `ServiceClient` holds no ID token, so its chain is the signed `exp` and the stated lifetime, with the same residual behind them. Both readings count a reserve, so a token nearing its end is renewed before the request reaches for it: 30 seconds for a stored session, `expirationMargin` for a cached service token.

Nothing else is persisted. An app that wants a user row fetches it in the scheme's `verify`, an app that only needs claims reads them off `auth.idToken`, and neither choice is in this package.

### 6. Request-Time Auth Is A Scheme, Then Helpers

#### The scheme resolves identity

```ts
createRouter({
	middleware: [
		asyncContext(),
		session(cookie, storage),
		catchResponse(),
		auth({
			schemes: [
				rp.scheme({ verify: (auth) => users.getBySubject(auth.idToken.subject) }),
				api.scheme({ verify: (token) => ({ clientId: token.clientId }) }),
			],
		}),
	],
});
```

`rp.scheme` reads `AuthSession`, refreshes an expired access token, and hands the app's `verify` the result. `api.scheme` reads the `Authorization` header, verifies a JWT access token against the cached JWKS, and describes an opaque one over RFC 7662 through the `Introspector` it is configured with — a one-method interface that `ServiceClient.introspect` satisfies, so the call lives on the class that already holds the credentials for it.

An introspected description is accepted when it names one of the audiences the server answers for, which holds the introspection path to what the local path checks in `aud`. RFC 7662 §2.2 leaves `aud` optional, so a description naming none is refused, and `acceptUnscopedIntrospection` is the switch for an issuer whose introspection endpoint answers only for tokens this server may honor. At its default every credential the path accepts has named this server, which is what scopes an issuer's active tokens to the resource servers they were issued for.

Both are `AuthScheme`s, so the state they resolve arrives under the `Auth` context key those 81 files already import, read as `getContext().get(Auth)`, then `.ok` and `.identity`. What the three apps with a scheme of their own hand over is `createSessionAuthScheme`'s `{ read, verify, invalidate }` triple, whose `invalidate` is where each of them clears the stored ID token. `rp.scheme` takes `read` and the clearing, since the token set and the key holding it belong here, and leaves `verify` with the app.

#### Helpers make the decision, and take no arguments

Resolving identity is cross-cutting and belongs in middleware. Deciding what an identity may do is per-route and belongs at the call site, stated plainly. `remix/middleware/async-context` already makes the second half argument-free, and over 300 files here already import it, so the helpers read the request context out of band rather than having it threaded through every signature.

```tsx
export const settings = createController(routes.app.settings, {
	actions: {
		async index(ctx) {
			let session = currentSession(); // throws a redirect when signed out

			return ctx.render(
				<SettingsPage subject={session.idToken.subject}>
					{scope("account:write") ? <DeleteAccountForm /> : null}
				</SettingsPage>,
			);
		},

		async action(ctx) {
			currentSession();
			if (!authenticated("5m")) throw redirect(routes.auth.confirmPassword.href());
			if (!mfa()) throw redirect(routes.auth.confirmMfa.href());

			return handleDeletion(ctx);
		},
	},
});
```

Two families, and the split is a rule rather than an accident:

**Identity helpers throw**, because there is exactly one sensible response to "nobody is here": go and log in. `currentSession()` throws a redirect to the login route carrying a sanitized `returnTo`, so that logic exists once instead of per route. `anonymous()` is its inverse for login pages, which is the guard everyone forgets.

**Capability helpers are one word and always return a boolean.** They never throw, including for an anonymous request, where they answer `false`. That keeps the name honest and makes them usable in a view — `scope("monitors:write") ? <DeleteForm /> : null` — which a throwing helper cannot be. A bare `scope("x");` as a statement authorizes nothing, and lint has nothing to say about it: `no-unused-expressions` assumes a call has side effects and leaves a call statement alone, in oxlint as in ESLint, and none of oxlint's 839 rules is a must-use or checked-return rule. What guards the form is `test/capability-statements.test.ts`, which parses every module under `apps/` and `packages/` and fails on a capability answer a statement drops. `no-unused-expressions` is on repo-wide for the `a;` and `a === 1;` it does catch.

An app builds its own set once, with `createAuthorization({ login, signedIn, relyingParty })`, and re-exports the six as its authorization vocabulary, so the login route and the MFA policy are named there rather than at every call site. The helpers read tokens and nothing else:

| Helper                     | Reads                | Answers                                                      |
| -------------------------- | -------------------- | ------------------------------------------------------------ |
| `currentSession()`         | `AuthSession`        | The session, or throws a redirect to login                   |
| `anonymous()`              | `AuthSession`        | Throws a redirect when someone is signed in                  |
| `subject()`                | `IdToken.subject`    | The identity anchor, or `null`                               |
| `scope(name)`              | `AccessToken.scopes` | Whether the client was granted that scope                    |
| `authenticated(duration?)` | `IdToken.authTime`   | Whether anyone is here, and authenticated within that window |
| `mfa()`                    | `IdToken.amr`/`acr`  | Whether more than one factor took part                       |

`authenticated` states its own subject, which is the whole reason it is not called `fresh`: what it measures is not session freshness. `auth_time` records when the person actually authenticated and survives every token refresh, so a long-lived session with a stale authentication — precisely the case step-up exists to catch — reads as authenticated but not recently. Called with no argument it is the boolean counterpart to the throwing `currentSession()`, which is what completes the two families symmetrically.

`scope` and an app's `permission` are orthogonal, and both have to pass. `scope` is **delegation** — what the client was allowed to do on the person's behalf, granted at consent time and carried by the access token. `permission` is **authorization** — what the person may do in this app, which lives in the app's own data. An admin driving a read-only integration is still refused a delete: `permission("account:delete")` true, `scope("account:write")` false. Treating one as the other is a real security error, so this package ships only the first.

Everything shaped like app data stays in the app: `currentUser()`, `permission()`, `role()`, `feature()`, `onboarded()`. Each app writes its own `authorize.ts` over `subject()` and the claims. The package talks about subjects and tokens; the app layer talks about users, and the vocabulary tells you which layer you are in. `role()` is the one that could migrate here later, since the provider's subject already carries a role and only the claim is missing.

The helpers that throw, and a rate-limited `authorize`, depend on a middleware that answers the request with a thrown `Response`, which `remix/router` does not do on its own. That is `@pkg/catch-response-middleware`, and it has to be installed _below_ every middleware that decorates the response — otherwise a thrown redirect unwinds past the session middleware's commit and silently loses its `Set-Cookie`.

### 7. Every Step Has A Named Override

| Need                                                              | Option                                                                                 |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Claims from the ID token, with no userinfo request                | `userInfo: "never"` (default), `"always"`, `"when-missing"` (any display claim absent) |
| A profile shape of the app's own                                  | `mapProfile(claims, tokens)`                                                           |
| An identity anchor that is not `sub`                              | `subject(claims)`                                                                      |
| Extra authorization parameters                                    | `authorizationParams`                                                                  |
| Extra token parameters                                            | `tokenParams`                                                                          |
| `client_secret_basic` instead of `client_secret_post`             | `clientAuth`                                                                           |
| No discovery document                                             | `metadata` on the `Issuer`                                                             |
| An issuer identifier that is not the URL discovery is served from | `identifier` on the `Issuer`                                                           |
| Rate limiting on the flow                                         | `rateLimit`                                                                            |
| An authentication context class, for step-up                      | `acrValues` on `authorize`                                                             |
| A maximum authentication age                                      | `maxAge` on `authorize`                                                                |
| Forcing re-authentication                                         | `prompt: "login"` on `authorize`                                                       |
| Which `amr`/`acr` values count as MFA                             | `mfa` on the `RelyingParty`                                                            |
| Introspection for a credential carrying no claims                 | `introspection` on the `ResourceServer`                                                |
| A description the issuer gives with no audience                   | `acceptUnscopedIntrospection` on the `ResourceServer` (default `false`)                |
| Revocation that outlives the response                             | `waitUntil` on the `ServiceClient`                                                     |
| How much of a service token's life is held in reserve             | `expirationMargin` on the `ServiceClient`                                              |

`mapProfile` cannot set the subject — profile mapping and account recognition are separate concerns, and conflating them is how a mutable claim like `email` ends up as an identity key. Reserved authorization parameters (`state`, `client_id`, `redirect_uri`, `response_type`, `scope`, `code_challenge`, `code_challenge_method`, `nonce`) are rejected rather than merged, so a caller cannot break callback correlation.

Owning the flow is what makes `userInfo: "never"` possible: the ID token is verified, so its claims are trustworthy, and the third round-trip is optional rather than mandatory. `"when-missing"` spends it whenever the ID token withholds any of `name`, `email`, `preferred_username`, `picture`, so a provider that sends `name` and withholds `email` still resolves a whole claim set. That is what an app authorizing on `email` depends on: an admin allow-list matched against an absent claim reads it as an empty entry, matches nobody, and silently downgrades the person's role.

`expirationMargin` does two jobs, which is why it is one knob: it is the reserve a handed-out token still has left, covering the request it is about to authenticate plus the clock skew at the service checking it, and it is what gates the shared-cache write. A grant with under 60 seconds of shareable life stays in the isolate, because 60 seconds is the shortest TTL a KV write accepts.

#### Step-up authentication, built in full

The whole mechanism ships now, even though our provider populates none of the response claims yet, because the protocol already specifies both halves and a relying party that asks correctly works against every provider that answers.

**Asking** is `authorize`: `acrValues` sets `acr_values`, `maxAge` sets `max_age`, `prompt: "login"` forces re-authentication outright for a provider that honors neither.

**Answering** is the ID token: `amr` per RFC 8176, where `mfa` means several factors took part and `otp`/`hwk`/`pwd` name specific ones; `acr` for the context class; `auth_time` for when. `mfa()` tests `amr` against the configured values, falling back to `acr`, because providers disagree about which they populate.

**Verifying is not optional.** A provider may ignore `acr_values` and return a token without the claim, and an app that reads that as "not MFA" redirects to a step-up route that asks again and loops. So `callback` throws when the response fails to satisfy what the request asked for: `acr_not_satisfied` when `acrValues` was sent and no requested value came back, `max_age_not_satisfied` when `maxAge` was sent and `auth_time` is absent or older than the window. OIDC makes `auth_time` required in the response whenever `max_age` was requested, so that second check is a conformance check as much as a security one.

Against our provider today, `acrValues` and `maxAge` are sent and rejected as unsatisfied, and `mfa()` answers `false`. `authenticated(duration)` already works, because `auth_time` is issued. When the provider learns to emit `acr` and `amr`, nothing here changes.

### 8. Cloudflare Is The Runtime, Not A Target

- **Caching.** Discovery documents, JWKS, and `client_credentials` tokens go in an `Issuer.CacheStore` behind an in-isolate memo, and `@pkg/kv-cache`'s `Cache.KVStore(kv, waitUntil)` is what satisfies it in production. Two stores answer that one interface, because the two lifetimes have different owners: the `Issuer`'s holds what every role reading that issuer shares, and the `ServiceClient`'s own `cache` holds a grant keyed by its client id and the resource and scope sets it was asked for, which is the scope a `client_credentials` token is good for. Isolate-lifetime maps re-fetch on every cold start, which on Workers is often.
- **Rate limiting.** `RelyingParty` and `ServiceClient` take a `@pkg/rate-limit` `Adapter`. `CloudflareAdapter` wraps the native binding; the other three adapters work for tests and local runs. Keys come from `@pkg/get-client-ip` for browser routes and from the client id for the token grant. The browser budget is spent by `authorize` alone, under `auth:authorize:<clientIp>`: a budget on `callback` would lock a legitimate person out of finishing a login they had already started, and behind CG-NAT one address is many people. Both classes fail open — a limiter that cannot answer lets the attempt through, because the budget is there to keep a flood off the issuer and the issuer enforces its own limit on every request it sees.
- **`waitUntil`.** Cache writes and revocation calls do not block the response.

### 9. A Verification Failure Throws, A Legitimate Outcome Returns

An `AuthError` with a documented `code` reports a protocol violation an app can act on — bad `state`, `nonce` mismatch, invalid signature, wrong audience, expired token, `acr_not_satisfied`, `max_age_not_satisfied`. Where the violation came from a call, the code names the endpoint it went to, so `user_info_failed`, `introspection_failed`, and `revocation_failed` stand beside `discovery_failed` and `jwks_failed` instead of collapsing into one.

An environment failure is a plain `Error`. A PKCE digest the runtime declines, the `at_hash` digest beside it, and a missing session middleware are all local faults, and every `AuthError` code available for them would report a provider problem that did not happen. An `alg` outside the `at_hash` digest table is the other kind: it throws `AuthError` `invalid_token`, because that is a statement about the token.

Ordinary outcomes return a value. `api.scheme` answers `null` for a request carrying no bearer credential, which leaves the schemes behind it their turn; a credential it does accept but declines becomes a scheme failure carrying RFC 6750's challenge, so the request stops with a `401` naming the reason. That conversion belongs to the scheme and covers `invalid_token` only: `api.verifyAccessToken` throws `invalid_token` directly, and `discovery_failed`, `jwks_failed`, and `introspection_failed` propagate out of the scheme too, so a provider outage stays a fault the app handles rather than a caller holding a bad token. `ManagementClient` reads return `Result` because not-found is an answer.

Two throws answer a person rather than a caller. The authorization helpers throw a redirect, which is a control-flow answer rather than a failure — which is why it needs a middleware to recover it and an `AuthError` does not. A rate-limited `authorize` throws a `429` `Response` carrying `Retry-After` and the `RateLimit-*` fields, for the same reason: there is a browser at the other end and one sensible reply, delivered by the same `catchResponse()`. `ServiceClient` keeps throwing an `AuthError` with `rate_limited`, because a job has a caller to handle it. The `429` carries a fixed plain-text body, and an app that wants its own page gets a hook for one when it asks.

`ManagementClient` splits its failures the same way. `SubjectNotFoundError` answers a 404 and nothing else; a `ManagementError` carrying a code and the status answers `unauthorized`, `rate_limited`, `provider_failed`, `request_failed`, and `invalid_response`. Each of those can succeed on a later attempt, so the split is what lets a caller retry one and pass over the other.

### 10. Verifying A Token That Arrived Out Of Band

`rp.verifyIdToken(raw)` returns a verified `IdToken` for a token an app obtained elsewhere — a native client, a test fixture, an IdP-initiated flow. It is the same verifier `callback` uses, minus the `nonce` check the redirect flow supplies.

`api.verifyAccessToken(credential)` is the mirror for an access token with no request to read it from: a queued job whose payload carries one, a connection authenticated once at its upgrade, a credential that arrived somewhere other than an `Authorization` header. It accepts whichever form the issuer hands out and runs every check the scheme runs, throwing `invalid_token` where the scheme would answer a `401`.

## Consequences

### Positive

- One ID-token verifier, signature included, replacing four.
- One discovery fetch per issuer per KV TTL instead of one per isolate, three times over.
- A login costs two round-trips instead of three.
- No database, so the package is testable with MSW alone and adds no migration to any app.
- Rate limiting arrives through an adapter the repo already ships, on the native binding.
- Encoding, randomness, and digests all come from `@pkg/crypto` — `Base64`/`Base64Url`, `randomToken`, `sha256`/`sha384`/`sha512` — so PKCE, the three correlation values, and `at_hash` share one implementation of each.
- Two open redirects of the same bug class, in the uptime app and in `@pkg/blog-engine`, were found and fixed on the way.

### Negative

- Owning the flow means owning `state`, PKCE, the nonce, the transaction, and callback error handling, with the security burden that carries. The specs are the mitigation, and they come first.
- More surface than either package it replaces: five classes, the token subclasses, and ten import paths.
- Apps on `remix/auth`'s OIDC provider are rewritten, not adapted.

### Neutral

- `client_secret_post` is the default, matching the provider's advertised methods; `client_secret_basic` is one option away.
- `remix/middleware/auth` stays a dependency. The `AuthScheme` interface is two members, so replacing it later changes no class in this package.
- Two more dependencies, both small and both useful on their own: `@pkg/catch-response-middleware` for the throwing helpers, and `remix/middleware/async-context` for their argument-free reads, which over 300 files here already import.
- The step-up surface ships ahead of the provider that answers it, so `mfa()` reads `false` and a step-up request is refused as unsatisfied until the provider emits `acr` and `amr`.
- Validation is `remix/data-schema` used directly, through `s.parseSafe`, rather than through `@pkg/validate` as `AGENTS.md` otherwise directs. `@pkg/validate` answers with a `Result`, and Decision 9 wants a thrown `AuthError` at these boundaries, so the schema library carries the work and the wrapper stays out of the way.
- An answer that declares a media type other than JSON is refused from that header, naming the type, before its body is read. Every endpoint this package parses reads that way, so one rule covers discovery, JWKS, the token endpoint, userinfo, introspection, and the management API. A `json` subtype, RFC 6839's `+json` suffix, and a header left off or written unreadably all reach a parse.
- `remix/auth` stays in the repo for the plain OAuth 2.0 upstream logins it already serves, which an OIDC client does not cover.

## Implementation Plan

Specs first, per the repo convention. Steps 1 through 7 are built and covered by 349 tests; step 8 is what remains.

Two prerequisites sit outside this package, and both are already in place. `Location.safe` lives in `@pkg/location` rather than a package of its own, because `Location.from` discards an origin by construction and a separate package would have depended on it for one function. `@pkg/catch-response-middleware` is what the throwing helpers need, and its ordering constraint is tested in both directions.

1. **Issuer and tokens** — discovery, JWKS, the KV-backed caches, `IdToken`, `AccessToken`, `AuthError` and its codes. Built.
2. **Relying party** — `authorize`, `callback`, `endSession`, `verifyIdToken`, `AuthSession`, the transaction, the override hooks, and step-up end to end. Built.
3. **Service client** — `client_credentials` with resource indicators, the cached and single-flighted token, `introspect`, `revoke`. Built, and `introspect` is what `ResourceServer` reaches for through the `Introspector` interface.
4. **Resource server** — `scheme`, the local-JWT and introspection paths, `verifyAccessToken`. Built.
5. **Authorization helpers** — the two families, over `remix/middleware/async-context`, behind `createAuthorization`. Built, with the bare-statement guard in `test/capability-statements.test.ts`.
6. **Management client** — `fetchSubjectById`, widened only on demand. Built.
7. **Rate limiting** — the adapter seam through both client classes. Built.
8. **Cutover**, per the table below. `ManagementClient`'s failure taxonomy is the one behavior change to carry across deliberately: the old package answered not-found for every non-2xx, so each read that relied on that best-effort behavior re-establishes it with an `instanceof SubjectNotFoundError` test rather than inheriting it.

| Deleted                                          | Rewritten                                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `packages/auth-sdk`, `packages/oidc-client`      | `apps/uptime`: OAuth service, auth controller, subjects service, container, two jobs, team settings |
| `apps/uptime/app/auth/value-objects/id-token.ts` | `apps/blog`: OAuth service, auth controller, auth middleware                                        |
| `apps/blog/app/auth/value-objects/id-token.ts`   | `apps/blog-saas/app/http/controllers/auth.tsx`                                                      |
| `apps/auth-saas/app/lib/id-token-verify.ts`      | `@pkg/blog-engine`: OIDC module, auth controller, auth middleware                                   |

`apps/auth-saas` is the narrow row in that table. It holds an HMAC-signed self-contained cookie rather than a `remix/session`, it names no `remix/middleware/auth` scheme, and it is the one app in the repo that checks the `nonce` today. What it takes from this package is `verifyIdToken` and `IdToken`'s claims; `AuthSession.from(ctx)` and `rp.scheme` have no place there.

## Alternatives Considered

### 1. Wrap `createOIDCAuthProvider`

The previous revision of this ADR. Rejected: it inherits a mandatory userinfo request, forces the nonce through `providerState` — a mutation that works but is not a documented contract — and leaves token exchange and verification unreachable behind a closed provider.

### 2. Replace `remix/middleware/auth` As Well

Rejected. It contains no protocol, 81 files depend on its contract, and a scheme is a two-member interface. Owning it buys control of `WWW-Authenticate` header formatting.

### 3. A Better Auth Shaped Config Object

One `betterAuth({ ... })` call returning an inferred client. Rejected: the inference and the plugin system exist to serve a client bundle and a database schema, and this package has neither. Classes with constructor injection give the same discoverability server-side without the type machinery.

### 4. Keep The Session Record Opaque To The App

Rejected by the no-DB constraint. The app decides what a subject means, so it needs the tokens and the claims, not a resolved user this package invented.

### 5. Module-Scope Caches

What both current packages do. Rejected: on Workers a cold isolate re-fetches discovery, JWKS, and every M2M token. KV with an isolate memo in front is the same code with a shared tier underneath.

## References

- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) — §3.1.3.7 ID token validation, §15.5.2 nonce
- [OpenID Connect RP-Initiated Logout 1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)
- [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) §4.4, [RFC 7009](https://datatracker.ietf.org/doc/html/rfc7009), [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636), [RFC 7662](https://datatracker.ietf.org/doc/html/rfc7662), [RFC 8176](https://datatracker.ietf.org/doc/html/rfc8176) (`amr` values), [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707)
- [Better Auth: OAuth](https://better-auth.com/docs/concepts/oauth), [Generic OAuth](https://better-auth.com/docs/plugins/generic-oauth) — the surface this one is measured against
- ADR-003: OIDC Backchannel Logout
- ADR-011: OIDC Provider Engine Package
- ADR-019: Adapter-Based Rate Limiting Package
