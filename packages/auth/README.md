# @sdxc/auth

OAuth 2.0 and OpenID Connect client for any runtime that speaks `Request` and `Response`.

Four protocol actors — the browser login, the app acting as itself, the API someone else
calls, and the provider's own records — share one `Issuer`, so the discovery document and
the key set are fetched once however many roles an app plays. It is a client, not a
framework: no user table, no password flow, no client-side JavaScript.

## Installation

```bash
npm add @sdxc/auth
```

The core subpaths need only a runtime with `fetch`. The `@sdxc/auth/remix/*` subpaths need
[`remix`](https://www.npmjs.com/package/remix) v3, declared as an optional peer
dependency, so an app on another router installs nothing extra.

Twelve entry points, each importable on its own:

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

## Usage

### Reading The Session

```typescript
import { AuthSession } from "@sdxc/auth/auth-session";

let auth = AuthSession.from(session); // null for a signed-out request

auth.idToken.subject; // the identity anchor, never null
auth.accessToken.has("reports:write");
auth.expired; // the token set has reached its end, counting a 30-second reserve
auth.renewable; // a refresh token is there to bring it back
await auth.refresh(rp); // spends the refresh token, rewrites the session
auth.clear(); // signs out, leaving every other session entry alone
```

### The Four Roles

```typescript
import { Issuer } from "@sdxc/auth/issuer";
import { ManagementClient } from "@sdxc/auth/management-client";
import { RelyingParty } from "@sdxc/auth/relying-party";
import { ResourceServer } from "@sdxc/auth/resource-server";
import { ServiceClient } from "@sdxc/auth/service-client";

// One instance per configuration, so every role below shares its memos.
let issuer = Issuer.for("https://auth.example.com");

let rp = new RelyingParty(issuer, {
	clientId: CLIENT_ID,
	clientSecret: CLIENT_SECRET,
	redirectUri: "https://app.example.com/auth/callback",
});

let service = new ServiceClient(issuer, { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
let api = new ResourceServer(issuer, { audience: CLIENT_ID, introspection: service });
let admin = new ManagementClient(service);
```

### The Browser Flow Is Three Methods

Each takes the request and a session store as one `{ request, session }` context, so the
flow runs under any router over any store with `get`, `set`, and `unset`.

```typescript
export default {
	async fetch(request: Request): Promise<Response> {
		let ctx = { request, session: await sessions.open(request) };
		let url = new URL(request.url);

		if (url.pathname === "/auth/login") {
			return await rp.authorize(ctx, { returnTo: url.searchParams.get("returnTo") });
		}

		if (url.pathname === "/auth/callback") {
			let grant = await rp.callback(ctx);
			await users.findOrCreate(grant.subject, grant.profile);
			return Response.redirect(new URL(grant.returnTo, url.origin), 303);
		}

		return await rp.endSession(ctx, { returnTo: "/" }); // /auth/logout
	},
};
```

`authorize` mints `state`, the `nonce`, and the PKCE verifier, writes them to the session
as one transaction, and returns the `303`. `callback` spends that transaction, exchanges
the code, verifies the ID token, holds the provider to any step-up the login asked for,
rotates the session id where the store rotates ids, and writes the token set. `endSession`
drops the local session and hands the browser to the provider with `id_token_hint`.

### Tokens With No Person Present

```typescript
let token = await service.token({ resources: ["https://api.example.com"] });
await fetch(REPORTS_URL, { headers: { authorization: `Bearer ${token}` } });

// And at the far end, in the app being called:
let presented = await api.verifyRequest(request);
if (presented === null) return unauthenticated(); // no bearer credential at all
if (!presented.has("reports:write")) return forbidden();
```

One grant is spent per client and resource set however many callers ask at once. A
compact-serialized token is verified against the published key set, a claimless one over
RFC 7662 introspection, and both paths end at the same `AccessToken`.

## API

### `@sdxc/auth/issuer`

```typescript
Issuer.for(url: string | URL, options?: Issuer.Options): Issuer;
new Issuer(url: string | URL, options?: Issuer.Options);

issuer.url; // URL — discovery appends `/.well-known/openid-configuration` to it
issuer.metadata(); // Promise<Issuer.Metadata> — validated, and held to naming this issuer
issuer.identifier(); // Promise<string> — what the provider's tokens carry as `iss`
issuer.keys(); // Promise<JWK.KeyResolver> — ready as `JWT.verify`'s second argument
issuer.verifyIdToken(raw, options); // Promise<IdToken> — for a token that arrived out of band
```

`for` hands its instance to every later caller asking on the same terms, so the documents
are read once per isolate; everything but `cache` names the instance, so a value that
varies per request goes to the constructor instead. `keys` picks a key per token from its
`kid`, and a `kid` the set in hand lacks costs one refetch, so a rotation verifies within
the verification that met it.

Each endpoint accessor answers `Promise<URL>`: `authorizationEndpoint`, `tokenEndpoint`,
and `jwksUri` are required of a provider, while `userInfoEndpoint`, `endSessionEndpoint`,
`revocationEndpoint`, and `introspectionEndpoint` throw `endpoint_unsupported` when it
advertises none. Each advertised-value accessor answers `Promise<string[]>`, empty when
the provider publishes no list: `scopesSupported`, `responseTypesSupported`,
`tokenEndpointAuthMethodsSupported`, `acrValuesSupported`, and
`codeChallengeMethodsSupported`.

`Options` takes `identifier`, the `iss` value where it differs from the URL the documents
are served from; `cache`, a `CacheSource`, omitted keeping documents for the life of the
instance; `metadata`, a document served in the provider's place and checked the same way;
and `ttl`, `"1 hour"` by default. `Metadata` is the discovery document in the shape a
provider publishes it, so one copied from an issuer is accepted unchanged.
`IdTokenVerification` takes `audience`, the id the token names as `aud` or the ids it may
name; `algorithms`, defaulting to whatever the key set supports; and `clockTolerance`,
`60` seconds.

`CacheStore` is the tier an issuer shares with every isolate reading the same provider. Any
store keyed by a string satisfies it, and every call answers with a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), so a store's own troubles
stay the store's rather than surfacing as a protocol failure.

```typescript
interface CacheStore {
	read(key: string): Promise<Result<string | null, Error>>;
	write(
		key: string,
		value: string,
		options?: { ttl?: DurationInput },
	): Promise<Result<void, Error>>;
	fetch(
		key: string,
		load: () => Promise<string>,
		options?: { ttl?: DurationInput },
	): Promise<Result<string, Error>>;
}

type CacheSource = CacheStore | (() => CacheStore);
```

`read` succeeds with `null` for an entry that is missing or expired, `fetch` computes and
stores the entry on a miss, and a write that failed costs the next isolate one read of the
provider. A `CacheSource` stated as a factory is resolved on every read, so a store built
over per-request values stays current for an instance that outlives the request.

### `@sdxc/auth/relying-party`

```typescript
new RelyingParty<profile>(issuer: Issuer, options: RelyingParty.Options<profile>);

rp.authorize(ctx, options?); // Promise<Response> — the 303 to the authorization endpoint
rp.callback(ctx); // Promise<RelyingParty.Grant<profile>>
rp.endSession(ctx, options?); // Promise<Response>, or Promise<URL> with `redirect: false`
rp.verifyIdToken(raw); // Promise<IdToken> — the callback's checks, over a token in hand
rp.exchangeRefreshToken(refreshToken); // Promise<AuthSession.Refreshed>
rp.mfa(idToken); // boolean — the configured values against `amr`, then `acr`
rp.renew(auth); // Promise<AuthError | null>
rp.issuer; // Issuer
```

`Options` requires `clientId` and `redirectUri`, and takes `clientSecret`, `scopes`
(`["openid", "profile", "email"]`), `clientAuth` (`"client_secret_post"` or
`"client_secret_basic"`), `userInfo` (`"never"`, `"always"`, or `"when-missing"`),
`authorizationParams`, `tokenParams`, `mapProfile`, `subject`, `mfa` (`["mfa"]`),
`algorithms`, `clockTolerance` (`60`), `fallbackReturnTo` (`"/"`), and `rateLimit`, a
`RateLimit`. Naming a parameter the flow writes itself throws `reserved_parameter` at
construction.

`RateLimit` pairs an [`@sdxc/rate-limit`](https://www.npmjs.com/package/@sdxc/rate-limit)
`adapter` with a required `key(request)`, which says what one login budget belongs to. It is
required because only the app knows: the connecting address on a platform that reports one,
a tenant, a submitted username. Return one shared bucket for a request you cannot identify,
so an unidentified attempt still spends something.

```typescript
new RelyingParty(issuer, {
	clientId,
	redirectUri,
	rateLimit: {
		adapter,
		key: (request) => request.headers.get("CF-Connecting-IP") ?? "unknown",
	},
});
```

`AuthorizeOptions` takes `returnTo`, `scopes`, `acrValues` (sent as `acr_values`, and
required of the response), `maxAge` (sent as `max_age`; a number counts seconds), `prompt`,
and `authorizationParams`. `authorize` spends the browser's budget before the session is
touched, so a refused login leaves it as it was, and a spent budget throws a `429`
`Response` for the caller to answer the request with. `returnTo` resolves through
`Location.safe` from [`@sdxc/location`](https://www.npmjs.com/package/@sdxc/location),
taking `fallbackReturnTo` for anything naming another origin.

`callback` spends the transaction the moment it reads it, so one login answers exactly one
callback, and its `Grant` carries `idToken`, `accessToken`, `refreshToken`, `returnTo`,
`subject`, the resolved `claims`, and the mapped `profile`; every way it can refuse is an
`AuthError` carrying one of the codes below. `renew` answers `null` where
the request goes on signed in — with a renewed set, or with a set that carried no refresh
token to renew — and answers with the refusal, the session already cleared, when the
provider declines the refresh token.

`Context` is `{ request, session }`; `Profile` is the default mapped profile (`name`,
`email`, `emailVerified`, `username`, `picture`); `GrantedTokens` is what `mapProfile` is
handed alongside the claims; `Transaction` is the login in flight, every field
server-written and compared against the response before the response is believed; and
`ClientAuth`, `UserInfoMode`, `Prompt`, and `EndSessionOptions` name the unions and the
`{ returnTo, redirect }` pair above.

### `@sdxc/auth/service-client`

```typescript
new ServiceClient(issuer: Issuer, options: ServiceClient.Options);

service.token({ resources, scope }); // Promise<string> — a bearer token for one resource set
service.introspect(token, options?); // Promise<ServiceClient.Introspection>, per RFC 7662
service.revoke(token, options?); // Promise<void>, per RFC 7009
service.clientId; // string
service.issuer; // Issuer
```

`Options` requires `clientId` and `clientSecret`, and takes `clientAuth`
(`"client_secret_post"`), `scope`, `tokenParams`, `cache` (an `Issuer.CacheStore`),
`rateLimit`, `waitUntil`, and `expirationMargin` (`"30 seconds"`), how much of a token's
life is kept in reserve for the request it authenticates and the skew at the far end.

`token` answers from the isolate, the shared cache, or a new grant; each resource travels
as its own `resource` field, which is how RFC 8707 §2 scopes one token to several services.
`Introspection` names the claims and splits the scopes — `active`, `scopes`, `clientId`,
`subject`, `username`, `tokenType`, `audience`, `issuer`, `issuedAt`, `expiresAt` — where
`active: false` is the ordinary reply for a token that is unknown, expired, or revoked.
`revoke` finishes after the response is sent when a `waitUntil` is configured. Both calls
take `{ tokenType?: "access_token" | "refresh_token" }`, the hint that lets the issuer look
the token up first.

### `@sdxc/auth/resource-server`

```typescript
new ResourceServer(issuer: Issuer, options: ResourceServer.Options);

api.verifyRequest(request); // Promise<AccessToken | null> — null: no bearer credential
api.verifyAccessToken(credential); // Promise<AccessToken> — over a credential in hand
api.issuer; // Issuer

interface Options {
	audience: string | string[]; // accepted when the token's `aud` carries any of them
	introspection?: Introspector; // supplying one opens the introspection path
	acceptUnscopedIntrospection?: boolean; // false
}
```

`verifyRequest` reads the bearer credential per RFC 6750 §2.1 and answers `null` for a
request carrying none, which is another authentication method's to answer; a credential
this server declines throws `invalid_token`. `verifyAccessToken` runs the same checks over
a credential an app already holds: a queued job's payload, a fixture.
`acceptUnscopedIntrospection` suits an issuer whose introspection endpoint answers only for
tokens this server may honor.

An `Introspector` is anything with `introspect(token)` answering a
`ResourceServer.Introspection` — `active`, `subject`, `clientId`, `scopes`, `audience`,
`issuer`, `expiresAt` — which a `ServiceClient` satisfies. A single-valued `aud` arrives as
a one-element list, an absent one as an empty list, every other omitted member as `null`.

### `@sdxc/auth/management-client`

```typescript
new ManagementClient(service: ManagementClient.Service, options?: ManagementClient.Options);

admin.fetchSubjectById(subjectId): Promise<
	Result<ManagementClient.Subject, SubjectNotFoundError | ManagementError>
>;
```

`Service` is what the client needs of a service client: `issuer.url`, and
`token({ resources })`. `Options` takes `baseUrl`, for a provider serving its management
API apart from its OpenID Connect endpoints, and `resources`, the indicators the token is
scoped to. A `Subject` carries `id`, `createdAt`, `updatedAt`, `displayName`, `avatar`, `role`
(`"user"` or `"admin"`), `username`, and `emailAddress`, both timestamps already widened
into `Date`. An id the provider holds no record under fails with `SubjectNotFoundError`,
which is a definite answer carrying the `subjectId`; a provider that refused, throttled,
failed, or answered unreadably fails with `ManagementError`, which a later attempt may
still satisfy. The call throws `AuthError` when the service client cannot obtain a token.

`ManagementError` carries a `code` and the `status` the provider answered with, `null` when
it never answered, and `ManagementError.is(error, code)` narrows a caught value.
`ManagementErrorCode` is closed — `unauthorized`, `rate_limited`, `provider_failed`,
`request_failed`, `invalid_response` — and `ManagementErrorOptions` is what the constructor
takes.

### `@sdxc/auth/auth-session`

```typescript
AuthSession.from(store); // AuthSession | null — re-validated on every read
AuthSession.write(store, tokens); // AuthSession

auth.idToken; // IdToken, decoded lazily and memoized
auth.accessToken; // AccessToken, likewise
auth.refreshToken; // string | null
auth.tokens; // AuthSession.Tokens — a copy, for a step that sends a token on
auth.expired; // boolean
auth.renewable; // boolean
await auth.refresh(client); // renews and rewrites the session; answers this
auth.clear(); // drops this package's key alone
```

The session arrives from a cookie, so a record written by an older version of this package
reads as signed out. `expired` describes the tokens rather than the person: a set past its
end still names who signed in, and a set stating no end at all reads as spent, since
nothing vouches for it. `refresh` throws `missing_refresh_token` for a set that was never
renewable.

`Store` is declared structurally — `get(key)`, `set(key, value)`, `unset(key)`, and an
optional `regenerateId(destroy?)` called on login and logout — so a session object
satisfies it as it is and a store over any other backing needs only those calls.
Everything this package persists lives under one key, so every other entry — a locale, a
flash message — stays the app's own.

`Tokens` is the stored set — `idToken`, `accessToken`, `refreshToken`, and `expiresAt`,
seconds since the epoch the token endpoint stated and `null` where it stated none — and
`Refreshed` is what an exchange answers with, where an omitted token keeps the stored one.
`Client` is what a refresh runs through: anything with
`exchangeRefreshToken(refreshToken)`, which a `RelyingParty` satisfies.

### `@sdxc/auth/id-token`

`IdToken` extends `JWT` from [`@sdxc/jwt`](https://www.npmjs.com/package/@sdxc/jwt), so
`IdToken.verify(raw, keys, options)`, `IdToken.decode(raw)`, and the base claim accessors
are inherited. The OpenID Connect claims arrive named, with their nullability stated.

```typescript
idToken.subject; // string — `sub`; throws when absent, since such a token is malformed
idToken.nonce; // string | null — bound to the login that asked for it
idToken.authTime; // Date | null — survives every token refresh
idToken.sessionId; // string | null — `sid`
idToken.atHash; // string | null — verified whenever a provider sends one
idToken.amr; // IdToken.AuthenticationMethod[] — empty when nothing was reported
idToken.acr; // string | null
idToken.name; // string | null
idToken.email; // string | null
idToken.emailVerified; // boolean — an absent claim reads as false
idToken.username; // string | null — `preferred_username`
idToken.picture; // string | null — as the provider sent it
```

`email`, `username`, and `picture` are mutable at the provider, so records stay keyed on
`subject`. `AUTHENTICATION_METHODS` holds the twenty `amr` values RFC 8176 §2 registers,
keyed by name so autocomplete spells out what the wire abbreviates:
`AUTHENTICATION_METHODS.Mfa` is `"mfa"`. `AuthenticationMethod` is one such value — those
twenty, and any other string besides, since RFC 8176 §3 keeps the registry open.

### `@sdxc/auth/access-token`

`AccessToken` is a JWT access token per RFC 9068, extending `JWT` the same way.

```typescript
token.scopes; // string[] — split from the one space-separated `scope` string
token.clientId; // string | null — RFC 9068 §2.2's `client_id`
token.issuedToService; // boolean — `sub` equals `client_id`
token.has("reports:write"); // boolean — whole-value comparison
```

The inherited `audience` reads either shape of `aud`: the client id on an
authorization-code token, and the issuer plus every requested resource on a
client-credentials one.

### `@sdxc/auth/auth-error`

`AuthError` is every protocol violation in this package. It carries a `code`, and
`providerError` and `providerErrorDescription` when the failure came from the provider's
own response; `AuthError.is(error, code)` gives a catch block one narrowing test to branch
on, and `AuthErrorOptions` is what the constructor takes.

`AuthErrorCode` is closed, so a `switch` over it exhausts: `discovery_failed`,
`issuer_mismatch`, `endpoint_unsupported`, `jwks_failed`, `missing_transaction`,
`state_mismatch`, `nonce_mismatch`, `authorization_failed`, `missing_code`,
`token_request_failed`, `missing_id_token`, `invalid_token`, `at_hash_mismatch`,
`acr_not_satisfied`, `max_age_not_satisfied`, `user_info_failed`, `missing_refresh_token`,
`introspection_failed`, `revocation_failed`, `rate_limited`, `reserved_parameter`. Every
code means the request has to stop; an outcome that is a legitimate answer —
`active: false`, a session nobody signed in on — is a value rather than a throw.

### `@sdxc/auth/remix/context`

```typescript
sessionOf(ctx: RequestContextSource): AuthSession.Store;
contextOf(ctx: RequestContextSource): RelyingParty.Context;
```

`sessionOf` is the session `remix/middleware/session` stored on the request context, and
throws when that middleware has not run. `contextOf` pairs it with the request, so a route
hands its context to the browser flow in one call. `RequestContextSource` is the part both
reads use — `request`, and `get(Session)` — which every flavor of the router's
`RequestContext` satisfies.

### `@sdxc/auth/remix/schemes`

```typescript
sessionScheme<identity>(
	rp: Pick<RelyingParty<unknown>, "renew">,
	options: SessionSchemeOptions<identity>, // { verify(auth), name?: "oidc-session" }
): AuthScheme<identity>;

bearerScheme<identity>(
	api: Pick<ResourceServer, "verifyRequest">,
	options: BearerSchemeOptions<identity>, // { verify(token, context), name?: "bearer" }
): AuthScheme<identity>;
```

`sessionScheme` resolves the stored token set into the identity `verify` returns, renewing
a set that has reached its end first; a `verify` answering `null` or `undefined` rejects
the request. `bearerScheme` resolves the request's bearer token, then asks who is holding
it, and a declined token stops there with RFC 6750's `401` and a
`Bearer error="invalid_token"` challenge. Either scheme leaves a request it has nothing to
say about — signed out, or carrying no bearer credential — to the next one, and lets an
issuer outage through as a thrown `AuthError`, so an environment fault stays a fault the
app answers rather than a person being signed out.

### `@sdxc/auth/remix/authorization`

```typescript
createAuthorization(options: Authorization.Options): Authorization.Helpers;
```

`Options` takes `login`, where a signed-out request is sent; `signedIn` (`"/"`);
`returnToParam` (`"returnTo"`); and `relyingParty`, a getter for the `MfaPolicy` holding
the `amr`/`acr` values that count as several factors, read on every `mfa()` call. The
helpers read the current request out of band, through `remix/middleware/async-context`, so
a route or a view asks its question in one word.

```typescript
currentSession(); // AuthSession — throws a redirect to `login`, carrying where to come back to
anonymous(); // void — throws a redirect to `signedIn` for a request already signed in
subject(); // string | null
scope("reports:write"); // boolean
authenticated("5 minutes"); // boolean — from `auth_time`; with no argument, asks only who is here
mfa(); // boolean
```

The two identity helpers throw a `Response`, which reaches the browser through
[`@sdxc/catch-response-middleware`](https://www.npmjs.com/package/@sdxc/catch-response-middleware).
The four capability helpers answer every request with a value, so a view mid-render may
branch on one directly.

## Pattern: Wiring A Remix Router

Both schemes go in one `auth()` registration and are tried in the order they are listed, so
one router serves a browser session and an API caller. The middleware order is
load-bearing: `asyncContext()` is what the authorization helpers read the request through,
the session middleware has to have run before any scheme reads it, and `catchResponse()`
sits below both so that a thrown redirect or `429` becomes the reply.

```typescript
import { bearerScheme, sessionScheme } from "@sdxc/auth/remix/schemes";
import { catchResponse } from "@sdxc/catch-response-middleware";
import { asyncContext } from "remix/middleware/async-context";
import { auth } from "remix/middleware/auth";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [
		asyncContext(),
		session(sessionCookie, sessionStorage),
		catchResponse(),
		auth({
			schemes: [
				sessionScheme(rp, { verify: (auth) => users.getBySubject(auth.idToken.subject) }),
				bearerScheme(api, { verify: (token) => ({ clientId: token.clientId }) }),
			],
		}),
	],
});
```

Routes hand their context to the flow in one call, and the authorization vocabulary is
created once and re-exported, so every route states its decision in one word and the login
route is named in one place.

```typescript
import { createAuthorization } from "@sdxc/auth/remix/authorization";
import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "remix/response/redirect";

export const { currentSession, anonymous, scope } = createAuthorization({
	login: routes.auth.login.href(),
	signedIn: routes.dashboard.href(),
	relyingParty: () => rp,
});

router.get(routes.auth.login, (ctx) => rp.authorize(contextOf(ctx)));
router.get(routes.auth.callback, async (ctx) => {
	let grant = await rp.callback(contextOf(ctx));
	return redirect(grant.returnTo);
});
router.post(routes.auth.logout, (ctx) => rp.endSession(contextOf(ctx), { returnTo: "/" }));
```

## Pattern: Step-Up Authentication

Asking is `authorize`; answering is the ID token. Both halves ship, and the response is
verified against the request.

```typescript
router.get(routes.auth.stepUp, (ctx) =>
	rp.authorize(contextOf(ctx), {
		acrValues: ["urn:example:loa:mfa"],
		maxAge: "5 minutes",
		prompt: "login",
		returnTo: ctx.url.searchParams.get("returnTo"),
	}),
);
```

Verification is the part that matters. A provider may ignore `acr_values` and answer with a
token carrying no `acr` at all; reading that as "not MFA" sends the request back to the
step-up route and loops. So `callback` throws instead — `acr_not_satisfied` when
`acrValues` was sent and no requested value came back, `max_age_not_satisfied` when
`maxAge` was sent and `auth_time` is absent or outside the window plus the clock tolerance.

`authenticated(duration)` measures from `auth_time`, which survives every token refresh, so
a long-lived session with a stale authentication — precisely the case step-up exists to
catch — reads as signed in but not recently authenticated.

## Pattern: Sharing Documents Across Isolates

A cold isolate is the normal case on a serverless runtime, so both caches have a shared
tier under the in-isolate memo. `Issuer.for` supplies the in-isolate half, handing the same
instance and the same memos to every role in the isolate; a `CacheStore` supplies the
other, so a cold isolate reads the discovery document and the key set from it rather than
from the provider.

```typescript
import type { Result } from "@sdxc/result";

import { Issuer } from "@sdxc/auth/issuer";
import { ServiceClient } from "@sdxc/auth/service-client";
import { toSeconds } from "@sdxc/duration";
import { success } from "@sdxc/result";

/** A store over any key-value backing; every call answers with a `Result`. */
let cache = {
	async read(key): Promise<Result<string | null, Error>> {
		return success(await store.get(key));
	},
	async write(key, value, options = {}): Promise<Result<void, Error>> {
		await store.put(key, value, { ttl: toSeconds(options.ttl ?? "1 hour") });
		return success(undefined);
	},
	async fetch(key, load, options = {}): Promise<Result<string, Error>> {
		let stored = await store.get(key);
		if (stored !== null) return success(stored);
		let loaded = await load();
		await this.write(key, loaded, options);
		return success(loaded);
	},
} satisfies Issuer.CacheStore;

let issuer = Issuer.for(AUTH_ORIGIN, { cache, ttl: "1 hour" });
let service = new ServiceClient(issuer, { clientId, clientSecret, cache });
```

The documents are keyed per issuer; a `client_credentials` token is keyed per client,
resource set, and scope set, with both sets sorted so the order a caller writes them in
carries no meaning. An app whose bindings arrive with the request states its cache as a
factory —
`cache: () => storeFor(currentEnvironment())` — so an instance that outlives a request
never holds a value belonging to one that has already answered.

Both client classes also count their outbound work against a
[`@sdxc/rate-limit`](https://www.npmjs.com/package/@sdxc/rate-limit) adapter passed as
`rateLimit`: the login budget against the key its `RateLimit` derives, the grant budget
against the client id, which the client already knows. A limiter that cannot answer lets the
attempt through, so people keep signing in through a limiter outage and the provider still
enforces its own limit on every request it sees.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/auth": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
