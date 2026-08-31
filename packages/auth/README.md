# @pkg/auth

OAuth 2.0 and OpenID Connect client for Remix on Cloudflare Workers.

## Overview

The package covers the client half of OpenID Connect: signing a person in through the
browser, acting as a service with no person present, verifying a bearer token someone
presents to this app, and reading the provider's own records. Each of those is a distinct
actor in the protocol, so each gets a class, and all four share one `Issuer` — the
discovery document and the JWKS are fetched once however many roles an app plays.

It is a client, not a framework. There is no user table, no account linking, no password
or 2FA flow, and no client-side JavaScript. What it persists is a token set in a
`remix/session`; whether a subject becomes a row in the app's database is the app's
decision, made in code this package calls rather than code it ships.

Every ID token is verified — signature against the published keys, then `iss`, `aud`,
`exp`, the `nonce`, and `at_hash` when the provider sends one. Protocol violations throw
an `AuthError` carrying a documented code; outcomes that are legitimate answers return a
value instead.

The package is organized into modules that can be imported independently:

- `@pkg/auth/issuer` - The discovery document and JWKS every role shares
- `@pkg/auth/relying-party` - Signing a person in through the browser
- `@pkg/auth/service-client` - Acting as the app itself, with no person present
- `@pkg/auth/resource-server` - Verifying a bearer token an incoming request carries
- `@pkg/auth/management-client` - Reading the provider's own records
- `@pkg/auth/auth-session` - The token set a login leaves in the session
- `@pkg/auth/id-token` - The verified ID token and its claims
- `@pkg/auth/access-token` - The verified access token and its claims
- `@pkg/auth/authorization` - The helpers a route states its authorization decision in
- `@pkg/auth/auth-error` - The error every protocol violation arrives as

## Usage

### The Four Roles

```typescript
import { Issuer } from "@pkg/auth/issuer";
import { ManagementClient } from "@pkg/auth/management-client";
import { RelyingParty } from "@pkg/auth/relying-party";
import { ResourceServer } from "@pkg/auth/resource-server";
import { ServiceClient } from "@pkg/auth/service-client";
import { Cache } from "@pkg/kv-cache";
import { env } from "cloudflare:workers";

/** The server every other class talks to. One per issuer. */
let issuer = new Issuer(env.OIDC_ISSUER, {
	cache: new Cache.KVStore(env.CACHE, (promise) => ctx.waitUntil(promise)),
});

/** Signing a person in through the browser: the login, callback, and logout routes. */
let rp = new RelyingParty(issuer, {
	clientId: env.OIDC_CLIENT_ID,
	clientSecret: env.OIDC_CLIENT_SECRET,
	redirectUri: "https://app.example.com/auth/callback",
});

/** Acting as itself, with no person present: cron jobs, queue consumers, outbound reads. */
let service = new ServiceClient(issuer, {
	clientId: env.OIDC_CLIENT_ID,
	clientSecret: env.OIDC_CLIENT_SECRET,
});

/** Being called by someone else: verifying the bearer token on an incoming request. */
let api = new ResourceServer(issuer, { audience: env.OIDC_CLIENT_ID, introspection: service });

/** Reading the provider's own records, with a token the service client issues. */
let admin = new ManagementClient(service);
```

### The Browser Flow Is Three Methods

```tsx
import { AuthSession } from "@pkg/auth/auth-session";
import { redirect } from "remix/response/redirect";
import { form, get, post, route } from "remix/routes";

/**
 * Declared once and used as the key wherever a route is mapped, so controllers,
 * middleware, and views build every URL through `routes.*.href(...)`. Every later
 * example draws its paths from this table.
 */
let routes = route({
	dashboard: get("/dashboard"),
	/** `form()` pairs the settings page's `GET` render with the `POST` that acts on it. */
	app: { settings: form("/settings") },
	auth: {
		login: get("/auth/login"),
		callback: get("/auth/callback"),
		logout: post("/auth/logout"),
		stepUp: get("/auth/step-up"),
		confirmPassword: get("/auth/confirm-password"),
		confirmMfa: get("/auth/confirm-mfa"),
	},
});

router.get(routes.auth.login, (ctx) =>
	rp.authorize(ctx, { returnTo: ctx.url.searchParams.get("returnTo") }),
);

router.get(routes.auth.callback, async (ctx) => {
	let grant = await rp.callback(ctx);
	await users.findOrCreate(grant.subject, grant.profile);
	return redirect(grant.returnTo);
});

router.post(routes.auth.logout, (ctx) => rp.endSession(ctx, { returnTo: "/" }));
```

`authorize` mints `state`, the `nonce`, and the PKCE verifier, writes them to the session
as one transaction, and returns the redirect. `callback` correlates the transaction,
exchanges the code, verifies the ID token, checks the step-up contract, rotates the
session id, and writes the token set. `endSession` drops the local session and hands the
browser to the provider with `id_token_hint`.

### Reading The Session

```typescript
let auth = AuthSession.from(ctx); // null when signed out

auth.idToken.subject; // the identity anchor, never null
auth.accessToken.has("reports:write");
auth.expired; // the token set has reached its end and wants renewing
await auth.refresh(rp); // spends the refresh token, rewrites the session
auth.clear(); // signs out, leaving every other session entry alone
```

## API

### `Issuer`

An OpenID Connect provider, addressed by its issuer identifier.

#### `new Issuer(url: string | URL, options?: Issuer.Options)`

**Parameters:**

- `url`: The issuer identifier, which is also where `/.well-known/openid-configuration` is
  served from
- `options.cache`: A store shared across isolates, so one fetch per TTL serves every
  isolate reading the same issuer
- `options.metadata`: A discovery document supplied inline, served in place of the
  provider's and validated the same way
- `options.ttl`: How long a fetched document stays in the shared cache (default
  `"1 hour"`)

#### `issuer.url`

The identifier this instance was constructed with, as a `URL`. `identifier()` answers with
the value the provider itself publishes, which is what tokens carry as `iss`.

#### `issuer.metadata(): Promise<Issuer.Metadata>`

The whole discovery document, with every member this package reads validated and the
document's own `issuer` confirmed to name the issuer it was asked for.

**Throws:** `discovery_failed` when the document cannot be fetched or read;
`issuer_mismatch` when it names another issuer.

#### `issuer.identifier(): Promise<string>`

The `issuer` value the provider publishes — the string its tokens carry as `iss`, and what
every verification checks them against.

#### `issuer.keys(): Promise<JWK.KeyResolver>`

The published key set as a resolver, ready to pass as `JWT.verify`'s second argument. It
picks a key per token from the token's `kid`, so tokens signed by any key the issuer still
publishes keep verifying across a rotation.

**Throws:** `jwks_failed` when the set cannot be fetched, read, or holds no key.

#### Endpoint accessors

Each reads one member out of the metadata and answers with a `URL`.

```typescript
await issuer.authorizationEndpoint();
await issuer.tokenEndpoint();
await issuer.jwksUri();
await issuer.userInfoEndpoint();
await issuer.endSessionEndpoint();
await issuer.revocationEndpoint();
await issuer.introspectionEndpoint();
```

The first three are required members, so they resolve for any conformant provider. The
last four throw `endpoint_unsupported` when the provider advertises none.

#### Advertised-value accessors

Each answers with the advertised list, empty when the provider publishes none.

```typescript
await issuer.scopesSupported();
await issuer.responseTypesSupported();
await issuer.tokenEndpointAuthMethodsSupported();
await issuer.acrValuesSupported();
await issuer.codeChallengeMethodsSupported();
```

### `RelyingParty<profile>`

A confidential client driving a person's login through the browser.

#### `new RelyingParty(issuer: Issuer, options: RelyingParty.Options<profile>)`

**Parameters:**

- `options.clientId`: The client's identifier at the issuer
- `options.clientSecret`: The client's secret
- `options.redirectUri`: Where the provider sends the browser back
- `options.scopes`: Scopes every login asks for (default `["openid", "profile", "email"]`)
- `options.clientAuth`: `"client_secret_post"` (default) or `"client_secret_basic"`
- `options.userInfo`: `"never"` (default), `"always"`, or `"when-missing"`
- `options.authorizationParams`: Extra parameters on every authorization request
- `options.tokenParams`: Extra parameters on every token request
- `options.mapProfile`: `(claims, tokens) => profile`, replacing the default display-claim
  profile
- `options.subject`: `(claims) => string`, for an identity anchor that is not `sub`
- `options.mfa`: The `amr`/`acr` values that count as several factors (default `["mfa"]`)
- `options.algorithms`: The signature algorithms an ID token may be signed with
- `options.clockTolerance`: Seconds of skew tolerated against the issuer (default `60`)
- `options.fallbackReturnTo`: Where a login returns when the requested destination is
  unusable (default `"/"`)
- `options.rateLimit`: The adapter the login budget is counted against

**Throws:** `reserved_parameter` when `authorizationParams` or `tokenParams` names a
parameter the flow writes itself.

#### `rp.authorize(ctx, options?): Promise<Response>`

Starts a login: spends the budget, writes the transaction, and redirects to the
authorization endpoint.

**Parameters:**

- `options.returnTo`: Where to come back to after the login, resolved through
  `Location.safe`
- `options.scopes`: Scopes for this login, in place of the configured ones
- `options.acrValues`: Authentication context classes to ask for, sent as `acr_values`
- `options.maxAge`: How recently the person must have authenticated, as seconds or a
  duration string, sent as `max_age`
- `options.prompt`: `"none"`, `"login"`, `"consent"`, `"select_account"`, or a value the
  provider defines
- `options.authorizationParams`: Extra parameters for this request

**Throws:** a `429` `Response` carrying `Retry-After` when the calling browser's login
budget is spent, delivered by `catchResponse()`; and `AuthError` with
`endpoint_unsupported` or `reserved_parameter`.

#### `rp.callback(ctx): Promise<RelyingParty.Grant<profile>>`

Finishes a login and signs the request in.

**Returns:**

- `grant.idToken`: The verified `IdToken`
- `grant.accessToken`: The `AccessToken` the grant carried
- `grant.refreshToken`: The refresh token, or `null`
- `grant.returnTo`: The sanitized destination the login was started with
- `grant.subject`: The identity anchor, from `subject(claims)` or from `sub`
- `grant.claims`: The claim set the flow resolved
- `grant.profile`: What `mapProfile` produced

**Throws:** `authorization_failed`, `missing_transaction`, `state_mismatch`,
`missing_code`, `token_request_failed`, `missing_id_token`, `invalid_token`,
`nonce_mismatch`, `at_hash_mismatch`, `acr_not_satisfied`, `max_age_not_satisfied`, or
`user_info_failed`. A query string carrying no readable authorization response at all is
`authorization_failed`, so the diagnosis names the answer that arrived rather than a
correlation failure standing in for it.

#### `rp.endSession(ctx, options?): Promise<Response | URL>`

Ends the login locally and hands the browser to the provider's end-session endpoint.

```typescript
await rp.endSession(ctx, { returnTo: "/" }); // Response
await rp.endSession(ctx, { returnTo: "/", redirect: false }); // URL
```

**Throws:** `endpoint_unsupported` when the provider publishes no end-session endpoint.

#### `rp.verifyIdToken(raw: string): Promise<IdToken>`

Verifies an ID token obtained outside the redirect flow — a native client, an
IdP-initiated sign-in, a fixture. Every check the callback runs against the token itself,
without the `nonce` comparison the redirect flow supplies.

**Throws:** `invalid_token`.

#### `rp.exchangeRefreshToken(refreshToken: string): Promise<AuthSession.Refreshed>`

Spends a refresh token on a renewed access token, verifying any ID token the response
repeats. This is what satisfies `AuthSession.Client`, so `auth.refresh(rp)` works.

#### `rp.mfa(idToken: IdToken): boolean`

Whether the provider reported that more than one factor took part, testing the configured
values against `amr` and then `acr`.

#### `rp.scheme(options): AuthScheme<identity>`

A `remix/middleware/auth` scheme resolving identity from the session, renewing an expired
access token first.

**Parameters:**

- `options.verify`: `(auth: AuthSession) => identity | null`
- `options.name`: The method name the resolved auth state reports (default
  `"oidc-session"`)

### `ServiceClient`

A confidential client acting on its own behalf.

#### `new ServiceClient(issuer: Issuer, options: ServiceClient.Options)`

**Parameters:**

- `options.clientId`, `options.clientSecret`: The client's credentials
- `options.clientAuth`: `"client_secret_post"` (default) or `"client_secret_basic"`
- `options.scope`: Scopes every grant asks for
- `options.tokenParams`: Extra fields on the grant
- `options.cache`: Where granted tokens are shared across isolates
- `options.rateLimit`: The budget the grant is counted against, keyed by client id
- `options.waitUntil`: Lets a revocation finish after the response is sent
- `options.expirationMargin`: How much of a token's life is kept in reserve (default
  `"30 seconds"`)

**Throws:** `reserved_parameter` when `tokenParams` names a field the grant owns.

#### `service.token(options?): Promise<string>`

The access token for a resource set, ready for an `Authorization: Bearer` header.

**Parameters:**

- `options.resources`: RFC 8707 resource indicators, each sent as its own `resource` field
- `options.scope`: Scopes for this token, in place of the configured ones

**Returns:**

- The bearer token, from the isolate memo, the shared cache, or a new grant

**Throws:** `rate_limited`, `token_request_failed`.

```typescript
let token = await service.token({ resources: ["https://api.example.com"] });
```

#### `service.introspect(token, options?): Promise<ServiceClient.Introspection>`

What the issuer says about a token, per RFC 7662. `active: false` is the ordinary reply
for a token that is unknown, expired, or revoked, so branch on the value rather than
catching.

**Throws:** `endpoint_unsupported`, `introspection_failed`, `invalid_token`.

#### `service.revoke(token, options?): Promise<void>`

Asks the issuer to stop honoring a token, per RFC 7009.

**Throws:** `endpoint_unsupported`, `revocation_failed`.

#### `service.clientId` / `service.issuer`

The client this instance authenticates as, and the provider every call goes to.

### `ResourceServer`

An API this app exposes to callers holding an access token.

#### `new ResourceServer(issuer: Issuer, options: ResourceServer.Options)`

**Parameters:**

- `options.audience`: The audiences this server answers for, as one value or a list
- `options.introspection`: Who describes a credential that carries no claims of its own;
  supplying one opens the introspection path
- `options.acceptUnscopedIntrospection`: Whether a description naming no audience is
  accepted on the issuer's scoping alone (default `false`, so it is refused)

#### `api.scheme(options): AuthScheme<identity>`

A `remix/middleware/auth` scheme resolving the request's bearer token into the identity
the app's `verify` returns.

**Parameters:**

- `options.verify`: `(token: AccessToken, context: RequestContext) => identity | null`
- `options.name`: The method name the resolved auth state reports (default `"bearer"`)

A request carrying no bearer credential is left to the next scheme. A presented credential
this server does not accept is reported as a failure carrying RFC 6750's challenge, so the
request stops with a `401` and `WWW-Authenticate: Bearer error="invalid_token"`.

```typescript
api.scheme({ verify: (token) => users.getBySubject(token.subject) });
api.scheme({ verify: (token) => (token.issuedToService ? { clientId: token.clientId } : null) });
```

An issuer that cannot serve its own documents surfaces as the `AuthError` it is, so an
outage stays a fault the app handles rather than a caller reading as if it held a bad
token.

#### `api.verifyAccessToken(credential: string): Promise<AccessToken>`

Verifies an access token that arrived outside a request — a queued job whose payload
carries one, a connection authenticated once at its upgrade, a fixture. It accepts
whichever form the issuer hands out and runs every check the scheme runs, so a caller with
no scheme chain behind it gets the reason rather than a `null`.

**Throws:** `invalid_token` when this server declines the credential; `discovery_failed` or
`jwks_failed` when the issuer's documents are unreadable.

```typescript
let token = await api.verifyAccessToken(job.payload.accessToken);
if (!token.has("reports:write")) return;
```

### `ManagementClient`

The provider's management API, read as the client its service client authenticates as.

#### `new ManagementClient(service, options?)`

**Parameters:**

- `service`: The service client every read takes its token and, by default, its origin from
- `options.baseUrl`: Where the management API is served (default: the service client's
  issuer URL)
- `options.resources`: Resource indicators the access token is scoped to (default `[]`)

#### `admin.fetchSubjectById(subjectId): Promise<Result<ManagementClient.Subject, SubjectNotFoundError | ManagementError>>`

Reads one subject by id. The two failures are separate on purpose: an id the provider
holds no record under is an answer, and a refusal, a throttle, a provider fault, or an
unreadable payload is a condition that may succeed later.

```typescript
import { isFailure } from "@pkg/result";
import { SubjectNotFoundError } from "@pkg/auth/management-client";

let result = await admin.fetchSubjectById(subjectId);
if (isFailure(result)) {
	if (result.error instanceof SubjectNotFoundError) return null;
	throw result.error;
}
return result.data;
```

### `AuthSession`

A signed-in request's tokens, read through the classes that name their claims. Reads are
lazy and memoized, so a route that only needs the subject decodes one token.

#### `AuthSession.from(ctx): AuthSession | null`

The token set a login stored, and `null` for a request that is signed out.

#### `AuthSession.write(ctx, tokens): AuthSession`

Stores a token set as the request's session, which is what makes the request signed in.

#### Instance members

- `auth.idToken`: `IdToken`
- `auth.accessToken`: `AccessToken`
- `auth.refreshToken`: `string | null`
- `auth.tokens`: `AuthSession.Tokens`, the strings the provider issued, for a step that
  sends a token on
- `auth.expired`: Whether the token set has reached its end, from the access token's own
  `exp`, then `expires_in`, then the ID token's `exp`, holding back a 30-second reserve
- `auth.refresh(client)`: Spends the refresh token and rewrites the session. **Throws**
  `missing_refresh_token` when the grant carried none
- `auth.clear()`: Drops this package's session key, leaving every other entry alone

### `IdToken`

A verified ID token, extending `JWT`. Beyond the registered claims the base class covers,
it names the ones a login turns on:

| Accessor        | Claim                | Answers                                                      |
| --------------- | -------------------- | ------------------------------------------------------------ |
| `subject`       | `sub`                | The identity anchor. Never null, and throws when absent      |
| `nonce`         | `nonce`              | Binds the token to the login that asked for it               |
| `authTime`      | `auth_time`          | When the person authenticated, as a `Date`                   |
| `sessionId`     | `sid`                | The join key between a login and the logout token ending it  |
| `atHash`        | `at_hash`            | Binds the token to the access token issued beside it         |
| `amr`           | `amr`                | The authentication methods that took part                    |
| `acr`           | `acr`                | The authentication context class the provider says it met    |
| `name`          | `name`               | Display name, under the `profile` scope                      |
| `email`         | `email`              | Contact and display data, mutable at the provider            |
| `emailVerified` | `email_verified`     | `false` for an absent claim, and `"true"` normalizes to true |
| `username`      | `preferred_username` | Display-only and mutable                                     |
| `picture`       | `picture`            | The avatar as the string the provider sent                   |

Any claim without an accessor reads through by name, so a provider-specific claim is
available as it was sent.

`AUTHENTICATION_METHODS` names the twenty values RFC 8176 §2 registers, keyed so
autocomplete spells out what the wire abbreviates. `IdToken.AuthenticationMethod` accepts
those plus any other string, because the registry stays open under Expert Review and
providers use that room.

```typescript
import { AUTHENTICATION_METHODS } from "@pkg/auth/id-token";

let rp = new RelyingParty(issuer, {
	clientId,
	clientSecret,
	redirectUri,
	mfa: [AUTHENTICATION_METHODS.Mfa, AUTHENTICATION_METHODS.Otp, "urn:example:passkey"],
});
```

### `AccessToken`

A JWT access token, per RFC 9068.

- `token.scopes`: The granted scopes as a list, split from the one space-separated string
  `scope` arrives as
- `token.clientId`: The `client_id` claim, naming the caller even where `sub` identifies
  the person it acts for
- `token.issuedToService`: Whether `sub` equals `client_id`, which is how RFC 9068 §2.2.1
  marks a client acting as itself
- `token.has(scope)`: Whether one scope was granted, comparing whole values

### `createAuthorization(options): Authorization.Helpers`

Binds the routes and the MFA policy every decision is measured against, and answers with
the helpers an app re-exports as its own authorization vocabulary.

**Parameters:**

- `options.login`: Where a signed-out request is sent
- `options.signedIn`: Where a signed-in request is sent from an anonymous-only page, and
  where a login returns when its destination is unusable (default `"/"`)
- `options.returnToParam`: The search parameter carrying the destination (default
  `"returnTo"`)
- `options.relyingParty`: `() => MfaPolicy`, read on every `mfa()` call so an app may hand
  over an instance it builds per request

**Returns:**

| Helper                     | Reads                | Answers                                                  |
| -------------------------- | -------------------- | -------------------------------------------------------- |
| `currentSession()`         | `AuthSession`        | The session, or throws a redirect to login               |
| `anonymous()`              | `AuthSession`        | Throws a redirect when someone is signed in              |
| `subject()`                | `IdToken.subject`    | The identity anchor, or `null`                           |
| `scope(name)`              | `AccessToken.scopes` | Whether the client was granted that scope                |
| `authenticated(duration?)` | `IdToken.authTime`   | Whether anyone is here, authenticated within that window |
| `mfa()`                    | `IdToken.amr`/`acr`  | Whether more than one factor took part                   |

The split between the two families is a rule, not an accident. **Identity helpers throw**,
because there is one sensible response to "nobody is here": go and log in.
**Capability helpers always return a boolean and never throw**, including for an anonymous
request, where they answer `false`. That is what makes them usable in a view, which a
throwing helper cannot be.

```tsx
export const settings = createController(routes.app.settings, {
	actions: {
		async index(ctx) {
			let session = currentSession();

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

A bare `scope("x");` as a statement authorizes nothing, and no lint rule catches it:
`no-unused-expressions` assumes a call has side effects and leaves a call statement alone.
What guards the form is `test/capability-statements.test.ts`, which parses every module in
the repo and fails on a capability answer a statement drops.

`scope` and an app's own `permission` are orthogonal, and both have to pass. `scope` is
**delegation** — what the client was allowed to do on the person's behalf, granted at
consent time and carried by the access token. `permission` is **authorization** — what the
person may do in this app, which lives in the app's data. An admin driving a read-only
integration is still refused a delete. This package ships only the first, so everything
shaped like app data — `currentUser()`, `permission()`, `role()`, `feature()` — stays in
the app, written over `subject()` and the claims.

### `AuthError`

Thrown when a protocol step cannot be completed safely. Every code means the request has
to stop, which is why throwing is what makes ignoring one impossible.

- `error.code`: One of `AuthErrorCode`
- `error.providerError`: The provider's own `error` code, when the failure came from its
  response
- `error.providerErrorDescription`: The provider's `error_description`, when it sent one
- `AuthError.is(error, code)`: A single narrowing test for a catch block

```typescript
import { AuthError, AuthErrorCode } from "@pkg/auth/auth-error";

try {
	let grant = await rp.callback(ctx);
} catch (error) {
	if (AuthError.is(error, AuthErrorCode.AcrNotSatisfied)) return renderStepUpRefused();
	if (AuthError.is(error, AuthErrorCode.MissingTransaction)) return redirect("/auth/login");
	throw error;
}
```

`AuthErrorCode` is closed, so a caller can exhaust every case and a log dashboard groups
failures by a stable value:

`discovery_failed`, `issuer_mismatch`, `endpoint_unsupported`, `jwks_failed`,
`missing_transaction`, `state_mismatch`, `nonce_mismatch`, `authorization_failed`,
`missing_code`, `token_request_failed`, `missing_id_token`, `invalid_token`,
`at_hash_mismatch`, `acr_not_satisfied`, `max_age_not_satisfied`, `user_info_failed`,
`missing_refresh_token`, `introspection_failed`, `revocation_failed`, `rate_limited`,
`reserved_parameter`.

### `ManagementError` and `SubjectNotFoundError`

`ManagementError` carries a `code` from `ManagementErrorCode` — `unauthorized`,
`rate_limited`, `provider_failed`, `request_failed`, `invalid_response` — and the `status`
the provider answered with, `null` when it never answered. `ManagementError.is(error, code)`
narrows a retry decision. `SubjectNotFoundError` carries the requested `subjectId` and
nothing else, because an absence is an answer rather than a fault.

### Types

#### `AuthSession.Tokens`

```typescript
interface Tokens {
	idToken: string;
	accessToken: string;
	refreshToken: string | null;
	expiresAt: number | null;
}
```

#### `Issuer.CacheStore`

The cache tier an `Issuer` and a `ServiceClient` share across isolates, declared
structurally so any store keyed by a string satisfies it.

```typescript
interface CacheStore {
	read(key: string): Promise<string | null>;
	write(key: string, value: string, options?: { ttl?: DurationInput }): Promise<void>;
	fetch(
		key: string,
		load: () => Promise<string>,
		options?: { ttl?: DurationInput },
	): Promise<string>;
}
```

#### `RelyingParty.Profile`

What `mapProfile` replaces, each member answering the same nullability its ID-token
accessor does.

```typescript
interface Profile {
	name: string | null;
	email: string | null;
	emailVerified: boolean;
	username: string | null;
	picture: string | null;
}
```

#### `ResourceServer.Introspection`

What the issuer says about a token, in the shape a resource server reads.
`ServiceClient.Introspection` is a superset of it, which is why a service client can be
passed straight to `introspection`.

```typescript
interface Introspection {
	active: boolean;
	subject: string | null;
	clientId: string | null;
	scopes: string[];
	audience: string[];
	issuer: string | null;
	expiresAt: Date | null;
}
```

#### `ManagementClient.Subject`

```typescript
interface Subject {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	displayName: string;
	avatar: string;
	role: "user" | "admin";
	username: string;
	emailAddress: string;
}
```

## Pattern: Wiring The Router

Both schemes go in one `auth()` registration, tried in the order they are listed, so one
router serves a browser session and an API caller. The middleware order below is
load-bearing and covered again under Behavior.

```typescript
import { asyncContext } from "remix/middleware/async-context";
import { auth } from "remix/middleware/auth";
import { session } from "remix/middleware/session";
import { catchResponse } from "@pkg/catch-response-middleware";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [
		asyncContext(),
		session(sessionCookie, sessionStorage),
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

`rp.scheme` reads the session, renews an access token that has reached its expiry, and
hands the app's `verify` a live token set. `api.scheme` reads the `Authorization` header,
verifies a JWT access token against the cached key set, and falls back to RFC 7662
introspection for a credential carrying no claims. A route then reads the resolved state
the way it reads any other scheme's: `getContext().get(Auth)`, then `.ok` and `.identity`.

## Pattern: The App's Own Authorization Vocabulary

Create the helpers once and re-export them, so every route states its decision in one word
and the login route is named in one place.

```typescript
import { createAuthorization } from "@pkg/auth/authorization";

import { relyingParty } from "~/auth/relying-party";

export const { currentSession, anonymous, subject, scope, authenticated, mfa } =
	createAuthorization({
		login: routes.auth.login.href(),
		signedIn: routes.dashboard.href(),
		relyingParty: () => relyingParty(),
	});
```

## Pattern: Step-Up Authentication

Asking is `authorize`; answering is the ID token. Both halves ship, and the request is
verified against the response.

```typescript
router.get(routes.auth.stepUp, (ctx) =>
	rp.authorize(ctx, {
		acrValues: ["urn:example:loa:mfa"],
		maxAge: "5 minutes",
		prompt: "login",
		returnTo: ctx.url.searchParams.get("returnTo"),
	}),
);
```

`acrValues` goes out as `acr_values`, `maxAge` as `max_age`, `prompt: "login"` forces
re-authentication for a provider that honors neither. Coming back, `acr` carries the
context class, `amr` the methods that took part, and `auth_time` when it happened.

Verification is not optional, and this is the part that matters. A provider may ignore
`acr_values` and answer with a token carrying no `acr` at all. Reading that as "not MFA"
sends the request to a step-up route that asks again and loops, so `callback` throws
instead: `acr_not_satisfied` when `acrValues` was sent and no requested value came back,
`max_age_not_satisfied` when `maxAge` was sent and `auth_time` is absent or older than the
window plus the clock tolerance. Against a provider that populates neither claim, a
step-up request is refused outright rather than silently downgraded.

`authenticated(duration)` works against any provider that issues `auth_time`, because
`auth_time` survives every token refresh: a long-lived session with a stale
authentication — precisely the case step-up exists to catch — reads as authenticated but
not recently.

## Pattern: Caching And Rate Limiting On Workers

A cold isolate is the normal case on Workers, so both caches have a shared tier under the
in-isolate memo, and both client classes count their outbound work against a budget.

```typescript
import { CloudflareAdapter } from "@pkg/rate-limit";
import { Cache } from "@pkg/kv-cache";

let cache = new Cache.KVStore(env.CACHE, (promise) => ctx.waitUntil(promise));

let issuer = new Issuer(env.OIDC_ISSUER, { cache, ttl: "1 hour" });

let rp = new RelyingParty(issuer, {
	clientId,
	clientSecret,
	redirectUri,
	rateLimit: new CloudflareAdapter(env.LOGIN_RATE_LIMITER, { limit: 10, window: "1 minute" }),
});

let service = new ServiceClient(issuer, {
	clientId,
	clientSecret,
	cache,
	rateLimit: new CloudflareAdapter(env.GRANT_RATE_LIMITER, { limit: 20, window: "1 minute" }),
	waitUntil: (promise) => ctx.waitUntil(promise),
});
```

The discovery document and the key set are keyed per issuer; a `client_credentials` token
is keyed per client, resource set, and scope set, with both sets sorted so the order a
caller writes them in carries no meaning. The login budget is keyed by the client IP, and
the grant budget by the client id.

## Behavior

1. **`catchResponse()` must sit below every response-decorating middleware** - The identity
   helpers answer an anonymous request by throwing a redirect, `authorize` answers a spent
   login budget by throwing a `429`, and `remix/router` does not turn a thrown `Response`
   into the reply on its own. Install `catchResponse()` after the session middleware, never
   before it: a redirect thrown above the session middleware unwinds past its commit and
   reaches the browser without its `Set-Cookie`, which loses the login transaction and the
   `returnTo` with it.
2. **`userInfo` defaults to `"never"`** - The ID token is verified, so its claims are
   trustworthy and a login costs two round-trips rather than three. `"always"` and
   `"when-missing"` opt into the third; both then need the provider to advertise a
   `userinfo_endpoint`, and both bind the response to the login by its `sub` — a response
   naming anyone else is `invalid_token`.
3. **Reserved parameters are rejected, not merged** - `state`, `client_id`, `redirect_uri`,
   `response_type`, `scope`, `code_challenge`, `code_challenge_method`, and `nonce` on the
   authorization request, and `grant_type`, `code`, `code_verifier`, `redirect_uri`,
   `refresh_token`, `client_id`, and `client_secret` on the token request, belong to the
   flow. Naming one in `authorizationParams` or `tokenParams` throws
   `reserved_parameter` — at construction for the configured sets, and per call for the
   ones `authorize` takes. Silently dropping them would leave callback correlation
   answering to a caller.
4. **`returnTo` goes through `Location.safe`, and anything unusable becomes the fallback** -
   `startsWith("/")` is not the check that does this: `//evil.com`, `/\/evil.com`, and
   `/\evil.com` all pass it and all resolve to another origin, and `/..//evil.com`
   normalizes to `//evil.com` while resolution still reports this app's own origin. What
   reaches the transaction names this origin as both a URL and a pathname; everything else
   takes `fallbackReturnTo`. The same sanitization runs on `endSession`'s `returnTo` and on
   the `returnTo` the identity helpers append to a login redirect.
5. **The rate limiter fails open** - A backend that cannot answer lets the attempt through.
   The budget exists to keep a flood off the issuer, people keep signing in and scheduled
   work keeps running through a limiter outage, and the issuer enforces its own limit on
   every request it sees. The budget is spent before anything else happens, so a refused
   attempt leaves the session untouched and asks the issuer for nothing.
6. **The two budgets refuse in two different ways** - A spent login budget is a person at a
   browser, so `authorize` throws a `429` `Response` carrying `Retry-After` and the quota
   headers, which `catchResponse()` delivers as the reply. A spent grant budget has no
   browser behind it, so `ServiceClient.token` throws an `AuthError` with `rate_limited`
   for the calling job to handle.
7. **`aud` has two shapes, so `audience` often needs both** - An authorization-code token
   names the client id it was issued to. A client-credentials token names the issuer
   alongside every resource it asked for, and marks itself as a service with a `sub` equal
   to `client_id`, which `AccessToken.issuedToService` reads. A `ResourceServer` reachable
   by both is configured with both values, and a token is accepted when its `aud` — written
   by the provider as one value or as a list — carries any of them.
8. **A transaction answers exactly one callback** - It is spent the moment it is read, so a
   browser replaying the callback URL gets `missing_transaction` rather than a second
   sign-in. `callback` also rotates the session id on success, and `endSession` rotates it
   while dropping the old record.
9. **A stored token set that no longer parses reads as signed out** - The session arrives
   from a cookie and is re-validated on every read, so a record written by an earlier
   version of this package answers `null` from `AuthSession.from` instead of throwing. The
   visitor logs in again; nothing has to be migrated.
10. **A token's own `exp` outranks the `expires_in` beside it** - Both `AuthSession` and
    `ServiceClient` read the access token's signed `exp` first, because that is the value
    the resource server enforces and it cannot drift from the lifetime captured at grant
    time. `expires_in` answers for an opaque token, and a session with neither falls back
    to the ID token's `exp`, which OpenID Connect requires. Each holds back a reserve —
    30 seconds for a session, `expirationMargin` for a service token — so a token nearing
    its end is renewed rather than sent and refused.
11. **A token whose life nothing states is never reused** - With no `exp`, no `expires_in`
    and, for a session, no ID-token `exp` either, nothing vouches for the credential:
    `expired` reads `true` and every `ServiceClient.token()` call runs a fresh grant. A
    grant whose remaining life minus the expiration margin is under 60 seconds stays in
    the isolate and is not published to the shared tier, because that is the shortest TTL
    a KV write accepts.
12. **The access token from a login is decoded, not verified** - `callback` returns it as
    the token endpoint sent it over an authenticated back-channel call, so it is read for
    its claims rather than re-checked. The ID token beside it is fully verified, and
    `at_hash` binds the two whenever the provider sends one. A token arriving from a
    _caller_ is a different matter and goes through `ResourceServer`, which verifies.
13. **An `at_hash` that cannot be checked is refused** - A signature algorithm outside the
    OpenID Connect Core §3.1.3.6 table leaves the binding uncheckable, and that throws
    `invalid_token` rather than passing the claim over. A runtime that declines the digest
    itself is a local fault, so it throws a plain `Error` the way a declined PKCE digest
    does; the login is refused either way.
14. **`IdToken.subject` throws when `sub` is absent** - OpenID Connect requires the claim,
    so the accessor is typed `string` and a malformed token fails loudly at the read. The
    capability helpers absorb that: they answer `false` or `null` where a stored token no
    longer yields a claim, which is what lets them promise a boolean to a view that is
    mid-render.
15. **A resource server with no introspector declines an opaque credential** - Only a
    compact-serialized JWT reaches the local verification path. Without `introspection`
    configured, anything else is a credential this server does not accept, answered with
    the `401` and the challenge — not passed to the next scheme.
16. **An introspected token has to name an audience** - RFC 7662 leaves `aud` optional, so
    an issuer that omits it would otherwise make every active token good at every server
    pointed at that issuer. A description naming no audience is refused, matching the
    local path where `aud` is checked; `acceptUnscopedIntrospection: true` accepts it for
    an issuer whose introspection endpoint is already scoped to this server's tokens.
17. **A declined token and an unreachable issuer part ways in the scheme** - `invalid_token`
    becomes the `401` with the challenge, and every other `AuthError` — `discovery_failed`,
    `jwks_failed`, `introspection_failed` — propagates out of `authenticate` instead. A
    provider outage answers as the fault it is rather than as a caller holding a bad
    credential.
18. **A session whose refresh fails is cleared, and the request stops** - When
    `rp.scheme` cannot renew an expired access token it drops the session and reports a
    scheme failure, so the request gets a `401` rather than continuing as anonymous with
    the old token still in the cookie.
19. **`revoke` with a `waitUntil` resolves before the call finishes** - The response is
    sent while the revocation completes in the background, so a refusal reaches the
    runtime's handler rather than the caller. Omit `waitUntil` where the outcome has to be
    awaited.
20. **A failed `Issuer` read is not memoized** - Discovery and the key set are remembered
    per instance, but a failure clears the memo, so the next call retries instead of
    replaying the error for the life of the isolate.
21. **Every management read answers with a `Result`** - `fetchSubjectById` never throws for
    a provider outcome; it returns `SubjectNotFoundError` for a 404 and `ManagementError`
    for a refusal, a throttle, a fault, or an unreadable payload. It does still throw
    `AuthError` when the service client cannot obtain a token at all, because that is a
    protocol failure rather than an answer.
22. **The session middleware is required, and its absence throws a plain `Error`** - Every
    read and write of the token set and the login transaction goes through
    `remix/middleware/session`. That failure is a wiring mistake rather than a protocol
    violation, so it is not an `AuthError` with a code.

## Related Packages

- [`@pkg/jwt`](/packages/jwt) - The `JWT` base class both token classes extend, and the
  `JWK` key resolver `Issuer.keys()` answers with
- [`@pkg/crypto`](/packages/crypto) - The digests, random tokens, and base64url encoding
  behind PKCE, the correlation values, and `at_hash`
- [`@pkg/kv-cache`](/packages/kv-cache) - `Cache.KVStore` satisfies `Issuer.CacheStore`,
  so an app supplies the shared tier and this package depends on the shape alone
- [`@pkg/rate-limit`](/packages/rate-limit) - The `Adapter` both client classes count
  against
- [`@pkg/location`](/packages/location) - `Location.safe`, which sanitizes every
  `returnTo`
- [`@pkg/catch-response-middleware`](/packages/catch-response-middleware) - Turns the
  identity helpers' thrown redirect into the reply
- [`@pkg/get-client-ip`](/packages/get-client-ip) - Derives the key the login budget is
  counted under
- [`@pkg/result`](/packages/result) - The `Result` management reads answer with
- [`@pkg/duration`](/packages/duration) - The `DurationInput` every TTL, window, and
  `maxAge` is expressed in

## Tips

1. **Share one `Issuer` across every role** - Its documents are memoized per instance and
   cached per issuer, so building a second instance for the same provider pays the fetch
   twice.
2. **Give the `Issuer` a shared cache in production** - Without one the documents live only
   for the life of the isolate, which on Workers means re-fetching discovery and the JWKS
   on most requests.
3. **Key records on `subject`, never on `email` or `username`** - Both are mutable at the
   provider; `sub` is not, which is the whole reason it is the anchor.
4. **Pass `metadata` to skip discovery in tests** - An inline document is validated exactly
   like a fetched one, so a test asserts against the same code path with no HTTP mock for
   `/.well-known/openid-configuration`.
5. **Ask `Issuer` what the provider supports before configuring a step-up** -
   `acrValuesSupported()` and `codeChallengeMethodsSupported()` say what will actually be
   honored, which beats discovering it from an `acr_not_satisfied` in production.
6. **Scope service tokens with resource indicators** - The resource set is part of the
   cache key, so one client hands out a separate cached token per service it calls.
7. **Use `AuthError.is` rather than reading `code` by hand** - It narrows the type and the
   code in one test, which keeps a catch block from acting on an unrelated error that
   happens to carry a `code`.
8. **Write a capability answer into a condition, never a bare statement** -
   `test/capability-statements.test.ts` scans the repo's TypeScript for a dropped answer
   and fails on one, because no lint rule flags a call statement.
9. **Put the app's vocabulary in the app** - `currentUser()`, `permission()`, and `role()`
   read app data; build them over `subject()` and the claims so the name tells you which
   layer you are in.
