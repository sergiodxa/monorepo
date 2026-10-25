# @sdxc/auth

OAuth 2.0 and OpenID Connect client for any runtime that speaks `Request` and `Response`.

The browser login, the app acting as itself, the API other clients call, and the provider's
management API all share one `Issuer`, so the discovery document and key set are fetched once
however many roles an app plays. Every protocol violation arrives as one `AuthError` with a
closed `code`.

## Installation

```sh
npm add @sdxc/auth
```

The core entry points need only `fetch`. The `@sdxc/auth/remix/*` entry points need
[`remix`](https://www.npmjs.com/package/remix) v3, an optional peer dependency.

| Entry point                      | What it holds                                                         |
| -------------------------------- | --------------------------------------------------------------------- |
| `@sdxc/auth/issuer`              | `Issuer`: discovery document, key set, and the shared cache           |
| `@sdxc/auth/relying-party`       | `RelyingParty`: the browser login, callback, and logout               |
| `@sdxc/auth/auth-session`        | `AuthSession`: the token set a login leaves in the session            |
| `@sdxc/auth/service-client`      | `ServiceClient`: client-credentials tokens, introspection, revocation |
| `@sdxc/auth/resource-server`     | `ResourceServer`: bearer token verification and RFC 9728 metadata     |
| `@sdxc/auth/protected-resource`  | `ProtectedResource`: finding an API's authorization server            |
| `@sdxc/auth/bearer-challenge`    | `parse` and `stringify` for `WWW-Authenticate: Bearer`                |
| `@sdxc/auth/dpop`                | `DPoP` client keys and proofs, `verifyProof` for servers (RFC 9449)   |
| `@sdxc/auth/management-client`   | `ManagementClient`: the provider's subject and tenant records         |
| `@sdxc/auth/id-token`            | `IdToken` and `AUTHENTICATION_METHODS`                                |
| `@sdxc/auth/access-token`        | `AccessToken`                                                         |
| `@sdxc/auth/auth-error`          | `AuthError` and `AuthErrorCode`                                       |
| `@sdxc/auth/remix/context`       | `sessionOf` and `contextOf`                                           |
| `@sdxc/auth/remix/schemes`       | `sessionScheme`, `bearerScheme`, `bearerFailure`                      |
| `@sdxc/auth/remix/authorization` | `createAuthorization`                                                 |

## Usage

### Point at an issuer

```typescript
import { Issuer } from "@sdxc/auth/issuer";

let issuer = Issuer.for("https://auth.example.com");

await issuer.metadata(); // the discovery document, checked against this issuer
await issuer.tokenEndpoint(); // URL
```

`Issuer.for` hands every caller with the same configuration the same instance, so every role
built on it shares one copy of the documents.

### Sign a person in

The three route methods take `{ request, session }`, where `session` is any store with
`get`, `set`, and `unset`.

```typescript
import type { AuthSession } from "@sdxc/auth/auth-session";

import { RelyingParty } from "@sdxc/auth/relying-party";

let rp = new RelyingParty(issuer, {
	clientId: "my-app",
	clientSecret: CLIENT_SECRET,
	redirectUri: "https://app.example.com/auth/callback",
});

async function handle(request: Request, session: AuthSession.Store): Promise<Response> {
	let ctx = { request, session };
	let url = new URL(request.url);

	if (url.pathname === "/auth/login") {
		return await rp.authorize(ctx, { returnTo: url.searchParams.get("returnTo") });
	}

	if (url.pathname === "/auth/callback") {
		let grant = await rp.callback(ctx);
		await users.upsert(grant.subject, grant.profile);
		return Response.redirect(new URL(grant.returnTo, url.origin), 303);
	}

	return await rp.endSession(ctx, { returnTo: "/" });
}
```

`authorize` stores `state`, `nonce`, and a PKCE verifier and redirects to the provider.
`callback` checks the response against them, verifies the ID token, and writes the token set
to the session. `endSession` clears it and sends the browser to the provider's logout.

### Read the session

```typescript
import { AuthSession } from "@sdxc/auth/auth-session";

let auth = AuthSession.from(session); // null when signed out

auth.idToken.subject; // the stable id to key your records on
auth.accessToken?.has("reports:write"); // null for an opaque access token
if (auth.expired && auth.renewable) await auth.refresh(rp);
auth.clear(); // signs out, leaving every other session entry alone
```

### Call an API as the app itself

```typescript
import { ServiceClient } from "@sdxc/auth/service-client";

let service = new ServiceClient(issuer, { clientId: "my-worker", clientSecret: CLIENT_SECRET });

let token = await service.token({ resources: ["https://api.example.com"] });
await fetch("https://api.example.com/reports", { headers: { authorization: `Bearer ${token}` } });
```

A token is reused until it nears expiry, and concurrent callers share one grant.

### Accept bearer tokens

```typescript
import { ResourceServer } from "@sdxc/auth/resource-server";

let api = new ResourceServer(issuer, { audience: "https://api.example.com" });

let token = await api.verifyRequest(request); // null when no bearer token was sent
if (token === null) return new Response(null, { status: 401 });
if (!token.has("reports:write")) return new Response(null, { status: 403 });
```

## API

### `@sdxc/auth/issuer`

#### `Issuer.for(url, options?)` and `new Issuer(url, options?)`

`for` answers one shared instance per configuration for the life of the isolate, so pass it
fixed configuration and use the constructor for anything that varies per request. Options:

- `identifier`: the `iss` value, when it differs from `url`
- `discovery`: `"openid"` (default) reads `/.well-known/openid-configuration`; `"oauth"`
  reads RFC 8414 `/.well-known/oauth-authorization-server`
- `cache`: an `Issuer.CacheSource` sharing documents across isolates
- `metadata`: a discovery document to use instead of fetching one, checked the same way
- `ttl`: how long a document stays in the shared cache, `"1 hour"` by default

#### Instance members

- `url`, `metadata()`, `identifier()` (the `iss` value)
- `keys()`: a key resolver for `JWT.verify` that refetches once for an unknown `kid`
- `verifyIdToken(raw, { audience, algorithms?, clockTolerance? })`: an `IdToken` verified
  against this issuer, for a token that arrived outside the browser flow
- `authorizationEndpoint()`, `tokenEndpoint()`, `jwksUri()`, `userInfoEndpoint()`,
  `endSessionEndpoint()`, `revocationEndpoint()`, `introspectionEndpoint()`: a `URL`; an
  optional endpoint the provider does not advertise throws `endpoint_unsupported`
- `scopesSupported()`, `responseTypesSupported()`, `tokenEndpointAuthMethodsSupported()`,
  `acrValuesSupported()`, `codeChallengeMethodsSupported()`: a `string[]`, empty when
  unpublished

#### `Issuer.CacheStore`

Any string-keyed store with `read(key)`, `write(key, value, { ttl })`, and
`fetch(key, load, { ttl })`, each answering a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). A
[`@sdxc/cache`](https://www.npmjs.com/package/@sdxc/cache) adapter satisfies it.
`CacheSource` is a store or a function answering one, called on every read.

### `@sdxc/auth/relying-party`

#### `new RelyingParty(issuer, options)`

Options: `clientId`, `clientSecret`, `redirectUri`, `scopes` (`["openid", "profile", "email"]`),
`clientAuth` (`"client_secret_post"` or `"client_secret_basic"`), `userInfo` (`"never"`,
`"always"`, or `"when-missing"`), `authorizationParams`, `tokenParams`, `mapProfile(claims,
tokens)`, `subject(claims)`, `mfa` (`["mfa"]`), `algorithms`, `clockTolerance` (`60` seconds),
`fallbackReturnTo` (`"/"`), and `rateLimit`. Extra params naming one the flow writes itself
throw `reserved_parameter`.

`rateLimit` is `{ adapter, key(request) }` with an
[`@sdxc/rate-limit`](https://www.npmjs.com/package/@sdxc/rate-limit) adapter; `authorize`
spends one unit per login and throws a `429` `Response` when the budget is spent.

`pushAuthorizationRequests: true` pushes each login to the issuer's
`pushed_authorization_request_endpoint` (RFC 9126) with the client's credentials and redirects
with only `client_id` and the `request_uri` it answers. `requestObject: { algorithm, keys,
lifetime? }` signs the parameters into a request object (RFC 9101), sent as `request` or pushed.

#### `rp.authorize(ctx, options?): Promise<Response>`

The `303` to the authorization endpoint. Options: `returnTo` (kept to the request's origin,
else `fallbackReturnTo`), `scopes`, `acrValues`, `maxAge` (seconds or a duration string),
`prompt`, and `authorizationParams`.

#### `rp.callback(ctx): Promise<Grant>`

Completes the login once per transaction and answers `idToken`, `accessToken`
(`null` when not a JWT), `accessTokenRaw`, `expiresAt`, `refreshToken`, `returnTo`,
`subject`, `claims`, and the mapped `profile`. Fails with an `AuthError`.

#### `rp.endSession(ctx, options?): Promise<Response>`

Clears the session and redirects to the provider's end-session endpoint with `id_token_hint`.
With `{ redirect: false }` it answers the `URL` instead.

#### Other members

- `verifyIdToken(raw)`: the callback's checks over a token in hand
- `exchangeRefreshToken(refreshToken)`: the renewed token set
- `revoke(token, { tokenTypeHint? })`: RFC 7009 revocation
- `mfa(idToken)`: whether the configured `mfa` values appear in `amr` or `acr`
- `renew(auth)`: refreshes a session, answering `null` when it stays signed in and the
  `AuthError` (with the session cleared) when the provider refuses
- `issuer`

### `@sdxc/auth/auth-session`

#### `AuthSession.from(store): AuthSession | null` and `AuthSession.write(store, tokens)`

Reads or writes the token set under one session key. A stored value that fails validation
reads as signed out.

#### Instance members

`idToken`, `accessToken` (`null` for an opaque token), `refreshToken`, `tokens` (a copy of
the raw strings), `expired` (true within 30 seconds of the end, or when no end is known),
`renewable`, `refresh(client)` (throws `missing_refresh_token` when not renewable), and
`clear()`.

### `@sdxc/auth/service-client`

#### `new ServiceClient(issuer, options)`

Options: `clientId`, `clientSecret`, `clientAuth`, `scope`, `tokenParams`, `cache` (an
`Issuer.CacheStore` shared across isolates), `rateLimit` (an `@sdxc/rate-limit` adapter
keyed by client id), `waitUntil`, and `expirationMargin` (`"30 seconds"` of remaining life
required to reuse a token).

#### Members

- `token({ resources?, scope? }): Promise<string>`: each resource is sent as its own RFC 8707
  `resource` parameter
- `exchange({ subjectToken, actorToken?, audience?, resources?, scope? })`: RFC 8693 token
  exchange, answering `{ accessToken, issuedTokenType, tokenType, expiresIn, scopes }`
- `introspect(token, { tokenType?, signed? })`: RFC 7662; an unknown, expired, or revoked token
  answers `active: false`. `signed: true` asks for the RFC 9701 JWT answer and verifies it
  against the issuer's keys, with this client as its audience
- `revoke(token, { tokenType? })`: RFC 7009; runs through `waitUntil` when configured
- `clientId`, `issuer`

### `@sdxc/auth/resource-server`

#### `new ResourceServer(issuer, options)`

Options: `audience` and/or `resource` (one is required), `metadata` (extra RFC 9728 members),
`realm`, `introspection` (anything with `introspect(token)`, such as a `ServiceClient`, to
accept opaque tokens), and `acceptUnscopedIntrospection` (`false`). With only `resource`, a
token's `aud` must name the resource.

#### Members

- `verifyRequest(request)`: the `AccessToken`, `null` when no bearer token was sent; throws
  `invalid_token` for a rejected one
- `verifyAccessToken(credential)`: the same checks over a token in hand
- `challenge({ error?, errorDescription?, scope?, acrValues?, maxAge? }?)`: the
  `WWW-Authenticate` value, with `realm` and `resource_metadata` when configured
- `authenticationChallenge(token, { acrValues?, maxAge? })`: RFC 9470's
  `insufficient_user_authentication` challenge for a token whose `acr` or `auth_time` falls
  short, `null` when it meets the requirement
- `metadata()`: the RFC 9728 document, `null` without a `resource`
- `resource`, `metadataUrl`, `issuer`

### `@sdxc/auth/protected-resource`

#### `ProtectedResource.discover(resource, options?)`

Fetches an API's RFC 9728 metadata and answers `Result<ProtectedResource, AuthError>`.
Options: `match` (`"exact"` or `"prefix"`) and `cache`.

#### `ProtectedResource.fromChallenge(response, requestedUrl, options?)`

Follows the `resource_metadata` pointer of a `401` or `403`, answering `null` in the `Result`
when there is none.

#### `ProtectedResource.requiredScopes(response): string[]`

The scopes a refusal's Bearer challenges ask for.

### `@sdxc/auth/dpop`

`DPoP.generate()` or `DPoP.import(serialized)` gives a key that signs one proof per request
(`dpop.proof(method, url, { accessToken? })`) and remembers each server's `DPoP-Nonce`.
`dpop.fetch(url, { accessToken, ...init })` sends the proof, presents the token as
`Authorization: DPoP`, and retries once on `use_dpop_nonce`. Pass it as `dpop` to
`ServiceClient` or `RelyingParty` to bind their tokens. On the server, `verifyProof(request, { replay,
accessToken? })` checks `htm`, `htu`, `iat`, `ath` and a single use of `jti` through your
`ReplayStore`, and answers the proof's key thumbprint; `ResourceServer`'s `dpop` option does
this for `DPoP`-scheme requests and holds the token's `cnf.jkt` to it, and
`api.dpopChallenge()` writes the `DPoP` challenge.

#### `ProtectedResource.requiredAuthentication(response)`

The `{ acrValues, maxAge }` an RFC 9470 step-up challenge asks for, to pass to
`rp.authorize`; `null` when the refusal asks for none.

#### `resource.issuer(authorizationServer?, options?)`

The `Issuer` for a listed authorization server (the first by default), read through RFC 8414
and then OpenID Connect discovery. `resource.metadata` holds the document;
`new ProtectedResource(metadata)` wraps one already in hand.

### `@sdxc/auth/bearer-challenge`

#### `stringify(challenge: Partial<BearerChallenge>): string`

Writes a `Bearer` challenge with every value quoted and escaped.

#### `parse(header: string): Result<BearerChallenge[], ChallengeParseError>`

Reads every `Bearer` challenge in a header that may list several schemes. Unrecognized or
untyped parameters land in `extensions`; `ChallengeParseError` carries the `offset`.

### `@sdxc/auth/management-client`

#### `new ManagementClient(service, options?)`

Reads the provider's records with a `ServiceClient`'s tokens. Options: `baseUrl` (the
issuer's URL by default), `resources` (the token's resource indicators), and `apiVersion`
(sent as `X-API-Version`; `admin.apiVersionReceived` holds what the last response echoed).

#### `ManagementClient.discover(api, credentials, options?)`

Builds a client from the API's URL through its RFC 9728 and RFC 8414 metadata, answering
`Result<ManagementClient, AuthError>`.

#### `admin.fetchSubjectById(subjectId)`

A `Result` with the `Subject`, `SubjectNotFoundError`, or `ManagementError`.

#### Tenant-scoped methods

Each takes a `tenantId` first and answers a `Result` failing with `ManagementError` or
`ManagementProblem`. List methods answer a `Page<T>` (`items`, `next`, `prev`) and take
`{ cursor?, limit? }`. `createTenantSubject`, `registerTenantClient`, and
`rotateTenantClientSecret` take a last `{ idempotencyKey }`, sent as `Idempotency-Key`.

- Subjects: `fetchTenantSubjectById`, `createTenantSubject`, `updateTenantSubject` (JSON
  Merge Patch), `blockTenantSubject`, `unblockTenantSubject`, `deleteTenantSubject`,
  `addTenantSubjectIdentifier`, `verifyTenantSubjectIdentifier`,
  `removeTenantSubjectIdentifier`
- Sessions and credentials: `listTenantSubjectSessions`, `revokeTenantSubjectSession`,
  `revokeAllTenantSubjectSessions`, `revokeTenantSubjectPasskey`,
  `forceTenantSubjectPasswordReset`, `resetTenantSubjectSecondFactor`
- Clients: `listTenantClients`, `registerTenantClient`, `updateTenantClient` (JSON Merge
  Patch), `rotateTenantClientSecret`, `revokeTenantClientSecret`, `disableTenantClient`,
  `deleteTenantClient`
- Grants and audit: `listTenantGrants`, `revokeTenantGrant`, `readTenantAuditPage`
- Tenant: `fetchTenant`, `listTenantMembers`, `inviteTenantMember`, `updateTenantMemberRole`,
  `removeTenantMember`, `listTenantDomains`, `attachTenantDomain`,
  `fetchTenantDomainVerification`, `updateTenantMfaPolicy`

#### Errors

- `ManagementError`: `code` (`unauthorized`, `rate_limited`, `provider_failed`,
  `request_failed`, `invalid_response`) and `status`; `ManagementError.is(error, code)`
  narrows
- `SubjectNotFoundError`: carries `subjectId`
- `ManagementProblem`: an RFC 9457 body with `type`, `title`, `status`, `detail`, `instance`,
  and `errors` (`{ pointer, code, message }` per invalid field)
- `managementProblems`: the API's problem types as an
  [`@sdxc/problem`](https://www.npmjs.com/package/@sdxc/problem) catalog

### `@sdxc/auth/id-token`

#### `IdToken`

A [`@sdxc/jwt`](https://www.npmjs.com/package/@sdxc/jwt) `JWT` with OpenID Connect claims:
`subject` (always a string), `nonce`, `authTime`, `sessionId`, `atHash`, `amr` (a list),
`acr`, `name`, `email`, `emailVerified`, `username`, and `picture`. Key records on `subject`;
the profile claims can change at the provider.

#### `AUTHENTICATION_METHODS`

The RFC 8176 `amr` values by name, such as `AUTHENTICATION_METHODS.Mfa === "mfa"`.

### `@sdxc/auth/access-token`

#### `AccessToken`

An RFC 9068 `JWT` with `scopes`, `clientId`, `issuedToService` (`sub` equals `client_id`),
`acr`, `authTime`, `has(scope)`, and `meets({ acrValues?, maxAge? })`. `AccessToken.tryDecode(raw)` answers `null` for an opaque token instead of
throwing.

### `@sdxc/auth/auth-error`

#### `AuthError`

Carries `code`, `providerError`, and `providerErrorDescription`; `AuthError.is(error, code)`
narrows a caught value. `AuthErrorCode`: `discovery_failed`, `issuer_mismatch`,
`endpoint_unsupported`, `jwks_failed`, `missing_transaction`, `state_mismatch`,
`nonce_mismatch`, `authorization_failed`, `missing_code`, `token_request_failed`,
`missing_id_token`, `invalid_token`, `at_hash_mismatch`, `acr_not_satisfied`,
`max_age_not_satisfied`, `user_info_failed`, `missing_refresh_token`,
`introspection_failed`, `revocation_failed`, `rate_limited`, `reserved_parameter`.

### `@sdxc/auth/remix/context`

#### `sessionOf(ctx)` and `contextOf(ctx)`

The `remix/middleware/session` session as an `AuthSession.Store`, and `{ request, session }`
for the `RelyingParty` route methods. Both throw when the session middleware has not run.

### `@sdxc/auth/remix/schemes`

#### `sessionScheme(rp, { verify, name? })`

A `remix/middleware/auth` scheme resolving the stored session into `verify(auth)`'s identity,
renewing an expired set first. A signed-out request falls through to the next scheme.

#### `bearerScheme(api, { verify, name? })`

Resolves the bearer token into `verify(token, ctx)`'s identity. A request without one falls
through; a rejected one answers `401` with `api.challenge({ error: "invalid_token" })`.

#### `bearerFailure(api, body?)`

A `requireAuth({ onFailure })` handler answering `401` with the server's challenge. `body`
builds your own response; a `WWW-Authenticate` it sets is kept.

### `@sdxc/auth/remix/authorization`

#### `createAuthorization(options)`

Options: `login`, `signedIn` (`"/"`), `returnToParam` (`"returnTo"`), and `relyingParty`, a
function answering the `mfa` policy. Answers helpers that read the current request through
`remix/middleware/async-context`:

- `currentSession()`: the `AuthSession`, or throws a redirect to `login` with `returnTo`
- `anonymous()`: throws a redirect to `signedIn` for a signed-in request
- `subject()`, `scope(name)`, `authenticated(duration?)`, `mfa()`: values that answer
  `null`/`false` for a signed-out request, safe to call while rendering

### Types

Each class carries its option and result types on a namespace of the same name:
`Issuer.Options`, `Issuer.Metadata`, `Issuer.CacheStore`, `Issuer.CacheSource`,
`Issuer.CacheWriteOptions`, `Issuer.IdTokenVerification`, `Issuer.Discovery`;
`RelyingParty.Options`, `Context`, `AuthorizeOptions`, `EndSessionOptions`, `Grant`,
`GrantedTokens`, `Profile`, `RateLimit`, `RevokeOptions`, `TokenTypeHint`, `Transaction`,
`ClientAuth`, `UserInfoMode`, `Prompt`; `AuthSession.Store`, `Tokens`, `Refreshed`, `Client`;
`ServiceClient.Options`, `TokenOptions`, `IntrospectOptions`, `RevokeOptions`,
`Introspection`, `ClientAuthMethod`, `TokenTypeHint`, `WaitUntil`; `ResourceServer.Options`,
`AudienceOptions`, `ResourceOptions`, `CommonOptions`, `PublishedMetadata`, `Introspection`,
`Introspector`, `IfBound`; `ProtectedResource.DiscoverOptions`; `ManagementClient.Options`,
`Service`, `Subject`, `Page`, `IdempotentCallOptions`, and the `Tenant*` records and inputs;
`IdToken.AuthenticationMethod`; `Authorization.Options`, `MfaPolicy`, `Helpers`.

Standalone: `AuthErrorOptions`; `BearerChallenge`, `BearerError`; `ManagementErrorCode`,
`ManagementErrorOptions`, `ManagementProblemOptions`, `ManagementProblemDetail`;
`RequestContextSource`; `BearerSchemeServer`, `SessionSchemeOptions`, `BearerSchemeOptions`.

## Pattern: Wiring A Remix Router

One `auth()` registration serves both browser sessions and API callers. `asyncContext()` runs
first so the authorization helpers can read the request, the session middleware before any
scheme, and `catchResponse()` turns thrown redirects and `429`s into the reply.

```typescript
import { createAuthorization } from "@sdxc/auth/remix/authorization";
import { contextOf } from "@sdxc/auth/remix/context";
import { bearerScheme, sessionScheme } from "@sdxc/auth/remix/schemes";
import { catchResponse } from "@sdxc/catch-response-middleware";
import { asyncContext } from "remix/middleware/async-context";
import { auth } from "remix/middleware/auth";
import { session } from "remix/middleware/session";
import { redirect } from "remix/response/redirect";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [
		asyncContext(),
		session(sessionCookie, sessionStorage),
		catchResponse(),
		auth({
			schemes: [
				sessionScheme(rp, { verify: (auth) => users.findBySubject(auth.idToken.subject) }),
				bearerScheme(api, { verify: (token) => ({ clientId: token.clientId }) }),
			],
		}),
	],
});

export let { currentSession, anonymous, scope } = createAuthorization({
	login: "/auth/login",
	signedIn: "/dashboard",
	relyingParty: () => rp,
});

router.get("/auth/login", (ctx) =>
	rp.authorize(contextOf(ctx), { returnTo: ctx.url.searchParams.get("returnTo") }),
);
router.get("/auth/callback", async (ctx) => {
	let grant = await rp.callback(contextOf(ctx));
	return redirect(grant.returnTo);
});
router.post("/auth/logout", (ctx) => rp.endSession(contextOf(ctx), { returnTo: "/" }));

router.get("/reports/new", () => {
	let auth = currentSession(); // signed-out visitors go to /auth/login?returnTo=…
	if (!scope("reports:write")) return new Response(null, { status: 403 });
	return new Response(`Hello ${auth.idToken.name}`);
});
```

## Pattern: Step-Up Authentication

Ask the provider for a stronger or fresher login, and gate the sensitive route on the answer.

```typescript
import { createAuthorization } from "@sdxc/auth/remix/authorization";
import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "remix/response/redirect";

let { authenticated, mfa } = createAuthorization({ login: "/auth/login", relyingParty: () => rp });

router.get("/auth/step-up", (ctx) =>
	rp.authorize(contextOf(ctx), {
		acrValues: ["urn:example:loa:mfa"],
		maxAge: "5 minutes",
		prompt: "login",
		returnTo: ctx.url.searchParams.get("returnTo"),
	}),
);

router.post("/settings/delete-account", () => {
	if (!mfa() || !authenticated("5 minutes")) {
		return redirect("/auth/step-up?returnTo=/settings");
	}
	return deleteAccount();
});
```

`callback` holds the provider to the request: it throws `acr_not_satisfied` when none of the
requested `acr_values` came back and `max_age_not_satisfied` when `auth_time` is missing or
too old, which you can catch with `AuthError.is(error, AuthErrorCode.AcrNotSatisfied)`.
`authenticated(duration)` measures from `auth_time`, which survives token refreshes, so a
long-lived session still has to step up.

## Pattern: An API That Describes Itself

Give a resource server its RFC 9728 identifier and it publishes metadata naming its issuer,
and every `401` points at that document.

```typescript
import { ResourceServer } from "@sdxc/auth/resource-server";
import { bearerFailure, bearerScheme } from "@sdxc/auth/remix/schemes";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { protectedResourceMetadata } from "@sdxc/well-known/oauth-protected-resource";
import { auth, requireAuth } from "remix/middleware/auth";

let api = new ResourceServer(issuer, {
	resource: "https://api.example.com/v1",
	metadata: { scopesSupported: ["reports:read", "reports:write"] },
});

let router = createRouter({
	middleware: [
		wellKnown({
			"oauth-protected-resource": serve(protectedResourceMetadata, () => api.metadata()),
		}),
		auth({ schemes: [bearerScheme(api, { verify: (token) => token })] }),
	],
});

router.get("/v1/reports", {
	middleware: [requireAuth({ onFailure: bearerFailure(api) })],
	handler() {
		return Response.json(reports.list());
	},
});

api.challenge(); // Bearer resource_metadata="https://api.example.com/.well-known/oauth-protected-resource/v1"
api.challenge({ error: "insufficient_scope", scope: ["reports:write"] });
```

## Pattern: Finding Where To Get A Token

A client holding only an API's URL follows the challenge on its refusal to the authorization
server, then requests a token scoped to that API.

```typescript
import { ProtectedResource } from "@sdxc/auth/protected-resource";
import { ServiceClient } from "@sdxc/auth/service-client";
import { isFailure } from "@sdxc/result";

let response = await fetch("https://api.example.com/v1/reports");

if (response.status === 401) {
	let found = await ProtectedResource.fromChallenge(response, response.url);
	if (isFailure(found) || found.data === null) throw new Error("No metadata pointer");

	let issuer = await found.data.issuer();
	if (isFailure(issuer)) throw issuer.error;

	let service = new ServiceClient(issuer.data, { clientId, clientSecret });
	let token = await service.token({
		resources: [found.data.metadata.resource.href],
		scope: ProtectedResource.requiredScopes(response),
	});
	response = await fetch(response.url, { headers: { authorization: `Bearer ${token}` } });
}
```

`ProtectedResource.discover(url)` does the same from the URL alone. To read a challenge
yourself, `parse` from `@sdxc/auth/bearer-challenge` answers each `Bearer` challenge in the
header with typed `error`, `scope`, and `resourceMetadata`.

## Pattern: Opaque Tokens Over Introspection

A provider whose access tokens are not JWTs is checked through RFC 7662 introspection; a
`ServiceClient` is the introspector, and both paths end at the same `AccessToken`.

```typescript
import { Issuer } from "@sdxc/auth/issuer";
import { ResourceServer } from "@sdxc/auth/resource-server";
import { ServiceClient } from "@sdxc/auth/service-client";

let issuer = Issuer.for("https://auth.example.com");
let service = new ServiceClient(issuer, { clientId: "reports-api", clientSecret });
let api = new ResourceServer(issuer, { audience: "reports-api", introspection: service });

let token = await api.verifyRequest(request);

let description = await service.introspect(rawToken, { tokenType: "access_token" });
if (!description.active) await audit.log("rejected token", description.clientId);

await service.revoke(refreshToken, { tokenType: "refresh_token" });
```

## Pattern: Sharing Documents Across Isolates

On a serverless runtime most isolates start cold. Hand the issuer and service client a shared
cache so a cold isolate reads the discovery document, key set, and client-credentials token
from it instead of the provider, and a rate-limit adapter so a flood of logins or grants is
stopped before it reaches the provider.

```typescript
import { Issuer } from "@sdxc/auth/issuer";
import { RelyingParty } from "@sdxc/auth/relying-party";
import { ServiceClient } from "@sdxc/auth/service-client";
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { MemoryAdapter } from "@sdxc/rate-limit";
import { env, waitUntil } from "cloudflare:workers";

let cache = () => new WorkerKVCache(env.CACHE, { waitUntil });
let issuer = Issuer.for("https://auth.example.com", { cache, ttl: "1 hour" });

let rp = new RelyingParty(issuer, {
	clientId,
	clientSecret,
	redirectUri,
	rateLimit: {
		adapter: new MemoryAdapter({ limit: 10, window: "1 minute" }),
		key: (request) => request.headers.get("CF-Connecting-IP") ?? "unknown",
	},
});

let service = new ServiceClient(issuer, {
	clientId,
	clientSecret,
	cache: cache(),
	rateLimit: new MemoryAdapter({ limit: 60, window: "1 minute" }),
	waitUntil,
});
```

A cache given as a function is resolved on every read, so an instance that outlives a request
never holds that request's bindings. A rate limiter that cannot answer lets the attempt through.

## Pattern: Reading The Provider's Records

`ManagementClient` reuses a service client's tokens to read the provider's own records.

```typescript
import { ManagementClient, SubjectNotFoundError } from "@sdxc/auth/management-client";
import { isFailure } from "@sdxc/result";

let admin = new ManagementClient(service);

let result = await admin.fetchSubjectById(subjectId);
if (isFailure(result)) {
	if (result.error instanceof SubjectNotFoundError) return null;
	throw result.error; // a ManagementError, worth retrying
}
result.data.displayName;
```

A multi-tenant provider's tenant-scoped API is discovered from its URL. Mint an idempotency key
once per operation and resend it on retries, and compare a `ManagementProblem`'s `type`
against the `managementProblems` catalog.

```typescript
import {
	ManagementClient,
	ManagementProblem,
	managementProblems,
} from "@sdxc/auth/management-client";
import { isFailure } from "@sdxc/result";

let discovered = await ManagementClient.discover(
	"https://api.auth.example.com",
	{ clientId, clientSecret },
	{ resources: ["https://api.auth.example.com"], apiVersion: "2026-09-01" },
);
if (isFailure(discovered)) throw discovered.error;
let tenants = discovered.data;

let created = await tenants.createTenantSubject(
	tenantId,
	{ identifiers: [{ kind: "email", value: "pat@example.com" }], profile: { name: "Pat" } },
	{ idempotencyKey },
);

let taken = managementProblems.entries().find((entry) => entry.name === "identifierTaken");
if (isFailure(created) && created.error instanceof ManagementProblem) {
	if (created.error.type === taken?.type) return "That email is already registered";
	throw created.error;
}

let page = await tenants.listTenantClients(tenantId, { limit: 20 });
if (!isFailure(page)) page.data.next; // pass back as `cursor` for the next page
```

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
