# ADR-084: OAuth 2.0 Protected Resource Metadata

## Status

**Accepted** - 2026-09-24

## Background

[RFC 9728](https://www.rfc-editor.org/rfc/rfc9728) lets an API describe itself to an OAuth
client the way RFC 8414 lets an authorization server do: a JSON document at
`/.well-known/oauth-protected-resource` naming the resource identifier, the authorization
servers whose tokens it accepts, the scopes it understands and how it takes a bearer token.
A `401` from the API points at that document through a `resource_metadata` parameter on its
`WWW-Authenticate` challenge, so a client holding nothing but the API's URL can find out
where to get a token for it.

The Model Context Protocol makes this mandatory: its authorization specification says MCP
servers MUST implement RFC 9728 and MUST answer a `401` with a `WWW-Authenticate` header
carrying the metadata URL. Nothing about the mechanism is specific to MCP, though. Every API
in this repo that accepts a bearer token has the same problem it solves, and none of them
publishes metadata today. This ADR decides where the document and the behavior around it
live, and makes RFC 9728 part of how every bearer-token API in the repo answers.

## Context

### APIs that accept bearer tokens

| API                               | App file                                                  | Token                                               | Issued by                                      | `401` challenge today                           |
| --------------------------------- | --------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| `/userinfo`                       | `apps/r3-auth/app/http/controllers/userinfo.ts`           | ES256 JWT access token                              | r3-auth itself                                 | `Bearer realm="…"`, `error="invalid_token"`     |
| tenant `/userinfo`                | `apps/auth-saas/app/http/controllers/userinfo.ts`         | tenant access token                                 | the tenant's issuer                            | `Bearer`, `invalid_token`, `insufficient_scope` |
| Management API                    | `apps/auth-saas/app/http/middleware/management-auth.ts`   | `ManagementAccessToken` JWT, or a dashboard session | `api.{PLATFORM_DOMAIN}/oauth/token`, same host | none; a problem document only                   |
| SCIM 2.0 (`/scim/v2/*`)           | `apps/auth-saas/app/http/middleware/scim-gate.ts`         | per-connection opaque token                         | the tenant dashboard                           | SCIM error body (ADR-085 covers SCIM)           |
| Uptime API (`/api/v1/*`)          | `apps/uptime/app/http/middleware/require-api-key.ts`      | opaque `uptime_<hex>` API key                       | the uptime app's settings page                 | none; a problem document only                   |
| Reader MCP (`/mcp`)               | `apps/reader/app/mcp/agent.ts`                            | signed agent token                                  | the reader's settings page                     | bare `Bearer`                                   |
| `packages/oidc-provider` userinfo | `packages/oidc-provider/src/oidc/controllers/userinfo.ts` | provider access token                               | the provider                                   | `Bearer error=…`; package unconsumed            |

The blog's and the sdxc site's MCP servers are public and take no credential, so they are
not protected resources. RFC 9110 §15.5.2 requires a `WWW-Authenticate` header on every `401`,
and RFC 6750 §3 requires one on a bearer-token rejection, so the management API and the
uptime API are already out of step before RFC 9728 enters.

[ADR-006 in the reader](./reader/ADR-006-mcp-server.md) deliberately leaves the metadata
pointer out, because `auth.sergiodxa.com` offers no dynamic client registration, no
audience-restricted tokens for a person, and no custom scopes, so a client that followed the
pointer could not finish the flow. That constraint stands; this ADR supplies the mechanism
the reader adopts once the authorization server can complete it.

### What `@sdxc/auth` has

`@sdxc/auth/resource-server` holds `ResourceServer`: RFC 6750 §2.1 header parsing, local JWT
verification against the issuer's JWKS, RFC 7662 introspection for opaque tokens, and an
audience check. It knows its issuer and audiences. It does not know its own resource
identifier, so it cannot say where its metadata lives, and its one challenge string is the
constant `Bearer error="invalid_token"` in `./remix/schemes`. On the client side, `Issuer`
discovers a provider from its OIDC discovery document; nothing starts from a resource.

`@sdxc/mcp` has no authorization handling. Its README states that authentication is the
router's own middleware, which runs before the MCP action for every method.

### What the RFC asks of an implementation

| Rule                                                                                                        | Consequence                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| §1.2: the resource identifier is an `https` URL with no fragment; a query is discouraged                    | `define` rejects a fragment and a non-`https` scheme at the type-and-value level            |
| §2: `resource` is the one required member                                                                   | an API with no OAuth issuer (the uptime API) still publishes a valid document               |
| §2: `tls_client_certificate_bound_access_tokens` and `dpop_bound_access_tokens_required` default to `false` | the parsed type carries booleans, never `undefined`                                         |
| §2.1: human-readable members take language-tagged variants (`resource_name#es`)                             | `resourceName` has a default value and a map of translations                                |
| §3.1: the suffix goes between host and path, after dropping a terminating slash                             | `metadataUrl(resource)` is `wellKnownUrl(resource, NAME, "insert")` from ADR-083            |
| §3.3: `resource` must equal the identifier the metadata URL was built from                                  | `parse` takes the expected resource and fails on any difference                             |
| §3.3: metadata found through a challenge must name the URL the client requested                             | the client checks against the request URL, see below                                        |
| §4: authorization server metadata gains `protected_resources`                                               | the RFC 8414 document type in ADR-083 carries `protectedResources`                          |
| §5.1: `resource_metadata` is a `WWW-Authenticate` parameter, combinable with RFC 6750's                     | one challenge writer produces `error`, `error_description`, `scope` and `resource_metadata` |
| §5.2: a resource may send a new challenge to signal changed metadata                                        | the client refetches whenever a challenge names a URL different from the one it holds       |
| §7.6: a client picks among `authorization_servers` and must not trust an unlisted one                       | discovery returns the list; building an `Issuer` from an unlisted URL fails                 |

### The challenge rule and APIs with many paths

§3.3 requires a client that found the metadata through a `resource_metadata` challenge to
check that `resource` equals the URL it requested. That fits an MCP server, which is one
URL. It fits a REST API like `/api/v1/monitors/:id` only if the API treats every request URL
as its own resource identifier, which defeats RFC 8707 audience binding, since the token
would then be bound to one path. Deployed MCP clients compare against the server URL, which
is the base of every request they make. The server side of this ADR publishes one identifier
per API and points every challenge at its metadata; the client side defaults to the RFC's
exact comparison and offers an opt-in same-origin prefix match, on path-segment boundaries,
for APIs that span many paths.

## Decision

Split the capability along the line ADR-083 draws. The document (its type, reader, writer
and URL rule) lives in `@sdxc/well-known/oauth-protected-resource`. The behavior (a resource
server that knows its identifier and publishes its metadata, the challenge it answers with,
and the client that starts discovery from a resource) lives in `@sdxc/auth`. Every API in
the repo that accepts a bearer token publishes metadata and carries `resource_metadata` on
its `401` and `403` challenges.

### Package name

This ADR adds a capability, not a package, so the choice is where it lives.

| Placement                                                                 | Trade-off                                                                                                |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Document in `@sdxc/well-known`, runtime in `@sdxc/auth`** (recommended) | Each package keeps one job; `ResourceServer` gains a few members instead of a sibling class              |
| A standalone `@sdxc/protected-resource`                                   | One place to look, but it duplicates `ResourceServer`'s identity and would depend on `@sdxc/auth` anyway |
| All in `@sdxc/mcp`                                                        | Closest to the MCP requirement, and unreachable for the uptime and management APIs, which are not MCP    |
| All in `@sdxc/well-known`                                                 | Keeps RFC 9728 whole, and makes a document package own `WWW-Authenticate` and token-issuer policy        |

The recommendation wins because the two halves change for different reasons. The document
changes when the IANA registry does, and it is read by clients that have nothing to do with
this repo's resource server. The challenge and the metadata values change when an API's
token handling does, and `ResourceServer` is already where that is decided: it knows the
issuer, which becomes `authorization_servers`, and the audiences, which should equal the
resource identifier under RFC 8707. `@sdxc/mcp` stays free of authorization, as its README
promises; an MCP server is a `ResourceServer` in front of an MCP action.

### Scope

`@sdxc/well-known/oauth-protected-resource` includes the `ProtectedResourceMetadata` type,
`parse` with the §3.3 identity check, `stringify`, `define`, `metadataUrl` and the format
descriptor that `respond` and the `wellKnown` middleware consume.

`@sdxc/auth` gains:

- `./bearer-challenge`: write and read `WWW-Authenticate` bearer challenges (RFC 6750 §3 plus
  RFC 9728 §5.1)
- `./resource-server`: a resource identifier, metadata, and the challenge it answers with
- `./protected-resource`: client-side discovery from a resource URL or from a `401`
- `./remix/schemes`: the bearer scheme's rejection carries the metadata pointer, and a
  `bearerFailure` handler gives `requireAuth()` the same challenge for a request with no token

What lives elsewhere:

- Resource indicators (RFC 8707) on the authorization request, dynamic client registration
  (RFC 7591) and custom scopes live in the authorization servers, `apps/r3-auth` and
  `apps/auth-saas`, and are separate decisions
- Signed metadata (`signed_metadata`) is read as an opaque string; producing and verifying
  it lives with `@sdxc/jwt` when an adopter needs it
- DPoP and mutual-TLS token binding stay out: the documents carry their members, and no API
  in the repo enforces either

### Exports

#### `@sdxc/well-known/oauth-protected-resource`

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Result } from "@sdxc/result";
import type { WellKnownFormat, WellKnownParseError } from "@sdxc/well-known";

export const NAME = "oauth-protected-resource";
export const MEDIA_TYPE = "application/json";

export type BearerMethod = "header" | "body" | "query";

/** RFC 9728 §2, in the order the RFC lists its members. */
export interface ProtectedResourceMetadata<Extensions extends object = {}> {
	resource: URL;
	authorizationServers: URL[];
	jwksUri: URL | null;
	scopesSupported: string[];
	bearerMethodsSupported: BearerMethod[];
	resourceSigningAlgValuesSupported: string[];
	resourceName: LocalizedString | null;
	resourceDocumentation: URL | null;
	resourcePolicyUri: URL | null;
	resourceTosUri: URL | null;
	tlsClientCertificateBoundAccessTokens: boolean;
	authorizationDetailsTypesSupported: string[];
	dpopSigningAlgValuesSupported: string[];
	dpopBoundAccessTokensRequired: boolean;
	signedMetadata: string | null;
	extensions: Extensions;
}

/** A value with its untagged form and its `#`-tagged variants (§2.1). */
export interface LocalizedString {
	value: string;
	translations: Record<string, string>;
}

export interface ParseOptions<Extensions extends object> {
	/** The identifier the metadata URL was built from, or the requested URL (§3.3). */
	resource: URL | string;
	/** Accept a `resource` that is a same-origin, segment-aligned prefix of `resource`. */
	match?: "exact" | "prefix"; // @default "exact"
	extensions?: StandardSchemaV1<unknown, Extensions>;
}

export function parse<Extensions extends object = Record<string, unknown>>(
	text: string,
	options: ParseOptions<Extensions>,
): Result<ProtectedResourceMetadata<Extensions>, WellKnownParseError>;

export function stringify(document: ProtectedResourceMetadata<object>): string;

/** Lists default to empty, URLs to `null`, booleans to `false`; `bearerMethodsSupported` to `["header"]`. */
export function define<Extensions extends object = {}>(
	document: Pick<ProtectedResourceMetadata<Extensions>, "resource"> &
		Partial<ProtectedResourceMetadata<Extensions>>,
): ProtectedResourceMetadata<Extensions>;

/** `https://api.example.com/v1` becomes `https://api.example.com/.well-known/oauth-protected-resource/v1`. */
export function metadataUrl(resource: URL | string): URL;

export const protectedResourceMetadata: WellKnownFormat<ProtectedResourceMetadata<object>>;
```

`parse` is where the §3.3 check lives, so no caller can read metadata without naming the
resource it expected. `define` defaults `bearerMethodsSupported` to `["header"]` because the
RFC implies no method when the member is absent, and every API here takes the header; OAuth
2.1 and MCP forbid tokens in the query string, so `"query"` is never a default.

#### `@sdxc/auth/bearer-challenge`

```ts
import type { Result } from "@sdxc/result";

/** RFC 6750 §3.1 error codes. */
export type BearerError = "invalid_request" | "invalid_token" | "insufficient_scope";

export interface BearerChallenge {
	realm: string | null;
	scope: string[];
	error: BearerError | null;
	errorDescription: string | null;
	errorUri: URL | null;
	/** RFC 9728 §5.1. */
	resourceMetadata: URL | null;
	/** Other auth-params, such as `max_age`, by lowercased name. */
	extensions: Record<string, string>;
}

export class ChallengeParseError extends Error {}

/** One `Bearer` challenge, quoting and escaping every value per RFC 9110 §11.2. */
export function stringify(challenge: Partial<BearerChallenge>): string;

/**
 * The `Bearer` challenges in a `WWW-Authenticate` value, which may list several schemes.
 * A header naming no `Bearer` challenge is an empty list, not a failure.
 */
export function parse(header: string): Result<BearerChallenge[], ChallengeParseError>;
```

#### `@sdxc/auth/resource-server`

```ts
import type { ProtectedResourceMetadata } from "@sdxc/well-known/oauth-protected-resource";
import type { BearerChallenge } from "./bearer-challenge.js";

export class ResourceServer {
	constructor(issuer: Issuer, options: ResourceServer.Options);

	/** The identifier tokens are bound to and the metadata names as `resource`. */
	get resource(): URL | null;
	/** Where this server's metadata is served, derived from `resource`. */
	get metadataUrl(): URL | null;

	/** The document to serve; `authorizationServers` defaults to the issuer's URL. */
	metadata(): ProtectedResourceMetadata;

	/**
	 * The `WWW-Authenticate` value for a refusal, with `resource_metadata` and `realm`
	 * filled in. A missing token gets no `error`, per RFC 6750 §3.1.
	 */
	challenge(
		refusal?: Pick<Partial<BearerChallenge>, "error" | "errorDescription" | "scope">,
	): string;

	// verifyRequest and verifyAccessToken keep their signatures
}

export namespace ResourceServer {
	export interface Options {
		/**
		 * The audiences this server answers for. Defaults to `resource`'s href when a
		 * resource is set, which is what an RFC 8707 token carries in `aud`.
		 */
		audience?: string | string[];
		/** The RFC 9728 resource identifier; setting it turns on metadata and the pointer. */
		resource?: URL | string;
		/** Members published beside `resource` and `authorizationServers`. */
		metadata?: Omit<Partial<ProtectedResourceMetadata>, "resource">;
		realm?: string;
		introspection?: Introspector;
		acceptUnscopedIntrospection?: boolean;
	}
}
```

`audience` becomes optional only when `resource` is set; the constructor's overloads keep
one of the two required, so an existing call site compiles unchanged and a server with
neither does not compile.

An API with no OAuth issuer, the uptime API today, uses the document and the challenge
writer without a `ResourceServer`: it publishes metadata with no `authorizationServers` and
points its challenges at it. That is a valid RFC 9728 document, and it tells a client where
the API's documentation and scopes are.

#### `@sdxc/auth/protected-resource`

```ts
import type { Result } from "@sdxc/result";
import type { ProtectedResourceMetadata } from "@sdxc/well-known/oauth-protected-resource";

export class ProtectedResource {
	/** Fetches `metadataUrl(resource)` and checks `resource` against it (§3.3). */
	static discover(
		resource: URL | string,
		options?: ProtectedResource.DiscoverOptions,
	): Promise<Result<ProtectedResource, AuthError>>;

	/**
	 * Reads the `resource_metadata` pointer off a `401` or `403` and fetches it, checking
	 * `resource` against the URL that was requested. `null` when the response carries no
	 * pointer, so the caller falls back to configured values.
	 */
	static fromChallenge(
		response: Response,
		requested: URL | string,
		options?: ProtectedResource.DiscoverOptions,
	): Promise<Result<ProtectedResource | null, AuthError>>;

	readonly metadata: ProtectedResourceMetadata;

	/**
	 * The `Issuer` for one of the listed authorization servers, discovered through RFC 8414
	 * with an OIDC fallback. An `authorizationServer` absent from the list fails (§7.6).
	 */
	issuer(authorizationServer?: URL | string, options?: Issuer.Options): Result<Issuer, AuthError>;

	/** The scopes a `403`'s challenge asked for, for a client re-authorizing once for all of them. */
	static requiredScopes(response: Response): string[];
}

export namespace ProtectedResource {
	export interface DiscoverOptions {
		match?: "exact" | "prefix";
		cache?: Issuer.CacheSource;
	}
}
```

`Issuer` today builds only the OIDC discovery URL. It gains a `discovery: "openid" |
"oauth"` option, defaulting to `"openid"`, and builds either URL with `wellKnownUrl`, since
an RFC 8414 issuer carrying a path needs the suffix inserted. `fromChallenge` and `discover`
call the global `fetch`, as every other `@sdxc/auth` request does.

#### `@sdxc/auth/remix/schemes`

```ts
/** The scheme's rejection carries `api.challenge({ error: "invalid_token" })`. */
export function bearerScheme<identity>(
	api: ResourceServer,
	options: BearerSchemeOptions<identity>,
): AuthScheme<identity>;

/** A `requireAuth({ onFailure })` handler: a `401` whose challenge points at the metadata. */
export function bearerFailure(
	api: ResourceServer,
	body?: (ctx: RequestContext) => Response,
): (ctx: RequestContext) => Response;
```

`remix/middleware/auth` forwards a failure's `challenge` to `WWW-Authenticate` already, so
the rejected-token path needs only the richer string. A request with no token is anonymous
to `auth()`, and `requireAuth()` answers it without a challenge unless `onFailure` supplies
one, which is what `bearerFailure` does. The body stays the app's: auth-saas answers with a
problem document, the reader with its JSON-RPC-friendly refusal.

### Usage

**The reader's MCP server**, once the authorization server can complete the flow:

```ts
export let READER_API = new ResourceServer(Issuer.for(AUTH_ORIGIN), {
	resource: new URL("/mcp", READER_ORIGIN),
	metadata: {
		scopesSupported: ["reader:read", "reader:write"],
		resourceName: { value: "Reader", translations: {} },
		resourceDocumentation: new URL("/docs/mcp", READER_ORIGIN),
	},
});

let router = createRouter({
	middleware: [
		log(logger),
		wellKnown({
			"oauth-protected-resource": serve(protectedResourceMetadata, () => READER_API.metadata()),
		}),
	],
});
```

`requireAgent` in `apps/reader/app/mcp/agent.ts` replaces its `CHALLENGE` constant with
`READER_API.challenge(...)`. Until then, the reader keeps the bare `Bearer` challenge ADR-006
chose, and nothing in this ADR changes it.

**The management API in `apps/auth-saas`**, both sides of which live in this repo:

```ts
function unauthorized(ctx: RequestContext, detail: string): Response {
	return managementProblem(
		"unauthorized",
		{ detail },
		{
			headers: { "WWW-Authenticate": ctx.managementApi.challenge({ error: "invalid_token" }) },
		},
	);
}
```

`ctx.managementApi` is the `ResourceServer` the worker publishes on the request context
(ADR-057), with `resource` set to `https://api.{PLATFORM_DOMAIN}` and the same host as its
authorization server, which also starts serving RFC 8414 metadata so a client can find
`/oauth/token`. `@sdxc/auth`'s `ManagementClient` then discovers the token endpoint from the
API URL alone.

**The uptime API**, with no issuer:

```ts
export const API_METADATA = define({
	resource: new URL("/api/v1", ORIGIN),
	scopesSupported: API_KEY_SCOPES,
	resourceDocumentation: new URL("/docs/api", ORIGIN),
});

let challenge = stringify({ resourceMetadata: metadataUrl(API_METADATA.resource) });
return apiProblems.unauthorized(
	{ detail: "Invalid or missing API key", instance: problemInstance() },
	{ headers: { "WWW-Authenticate": challenge } },
);
```

A `403` for a missing scope in `require-api-key.ts` adds `error: "insufficient_scope"` and
`scope: [scope]`.

**The auth servers' own `/userinfo`**: r3-auth's `REALM` challenge and auth-saas's three
constant challenges become `api.challenge(...)` calls on a `ResourceServer` whose
`resource` is the userinfo URL and whose authorization server is the issuer itself. Both
issuers list that URL under `protectedResources` in their RFC 8414 document.

### Adoption order

| Order | API                               | Why                                                                                               |
| ----- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1     | auth-saas management API          | Server and client both in the repo, so the flow is tested end to end; fixes the missing challenge |
| 2     | r3-auth and auth-saas `/userinfo` | Smallest change: a challenge string and one document per issuer                                   |
| 3     | uptime API                        | Fixes the missing challenge; documents scopes and docs for API-key clients                        |
| 4     | reader MCP                        | Required by MCP; waits on r3-auth's dynamic registration, resource indicators and custom scopes   |
| 5     | auth-saas SCIM                    | Decided with ADR-085, since SCIM clients authenticate with a configured token and rarely discover |

## Consequences

### Positive

- **Discoverable APIs** - a client holding only an API's URL finds its authorization
  server, scopes and documentation, which is what MCP clients need and API-key clients can use
- **Conforming challenges** - every `401` carries `WWW-Authenticate`, closing the RFC 9110
  and RFC 6750 gap in the management and uptime APIs
- **One challenge writer** - four hand-written challenge strings become one function that
  quotes and escapes correctly
- **`ResourceServer` knows what it is** - its resource identifier drives the audience check,
  the metadata and the challenge together, so the three cannot disagree
- **MCP servers stay ordinary** - `@sdxc/mcp` gains nothing; an MCP route is a resource
  server in front of an action, like any other API

### Negative

- **The reader's pointer is still blocked** - publishing metadata the authorization server
  cannot honor misleads clients, so the adopter MCP most needs waits on work in r3-auth
- **Prefix matching is a relaxation** - it keeps the origin binding RFC 9728 §7.3 relies on,
  but it is weaker than the RFC's exact rule and must stay opt-in
- **More surface in `@sdxc/auth`** - three subpaths and new `ResourceServer` members to
  document, test and keep stable
- **Metadata for an issuer-less API is thin** - the uptime document names no authorization
  server, so a generic OAuth client learns where the docs are and still cannot obtain a key

### Neutral

- **Existing call sites compile** - `audience` stays accepted, and `resource` is opt-in
- **`@sdxc/auth` gains a dependency** - `@sdxc/well-known`'s document subpaths import only
  `@sdxc/result` and `@remix-run/data-schema`, so the core stays independent of `remix`
  (ADR-048)

## Implementation Plan

### Phase 1: The document

**Priority:** High
**Estimated Effort:** 2 hours

1. Tests first: path insertion with and without a path, the exact and prefix identity
   checks, a fragment or `http` identifier refused, language-tagged `resource_name`, boolean
   defaults, extension round-trips
2. Implement `@sdxc/well-known/oauth-protected-resource` (ADR-083 Phase 1 provides the core)

### Phase 2: `@sdxc/auth`

**Priority:** High
**Estimated Effort:** 5 hours

1. `./bearer-challenge`, tested against RFC 6750 §3 and RFC 9728 §5.1 examples, a header
   listing `Basic` and `Bearer`, and escaped quotes
2. `ResourceServer`'s `resource`, `metadataUrl`, `metadata()` and `challenge()`, with the
   audience default and the constructor overloads
3. `bearerScheme`'s rejection and `bearerFailure`
4. `ProtectedResource` and `Issuer`'s `discovery` option, tested with MSW
5. README sections for the resource server and discovery

### Phase 3: Adopt

**Priority:** Medium
**Estimated Effort:** 5 hours

| Call site                                               | Change                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/auth-saas/app/http/middleware/management-auth.ts` | challenges on `401`/`403`; `ResourceServer` published on the context     |
| auth-saas management worker                             | serves protected resource metadata and RFC 8414 metadata on the API host |
| `packages/auth/src/management-client.ts`                | discovers the token endpoint through `ProtectedResource`                 |
| `apps/r3-auth/app/http/controllers/userinfo.ts`         | `REALM` constant replaced by `api.challenge(...)`; metadata served       |
| `apps/auth-saas/app/http/controllers/userinfo.ts`       | three challenge constants replaced; metadata served per tenant           |
| `apps/uptime/app/http/middleware/require-api-key.ts`    | challenges on `401` and `403`; metadata served                           |
| `apps/reader/app/mcp/agent.ts`                          | deferred until r3-auth can complete the MCP flow                         |

Each adopting app gets a test that follows the challenge: request without a token, read
`resource_metadata`, fetch it, and parse it with the requested URL.

## Alternatives Considered

### 1. A standalone `@sdxc/protected-resource`

**Rejected because**: the metadata's values come from what `ResourceServer` already holds,
the issuer and the audience, so the package would either depend on `@sdxc/auth` or make
every app state them twice.

### 2. Everything in `@sdxc/mcp`

**Rejected because**: RFC 9728 is not about MCP. The management and uptime APIs need it and
are not MCP servers, and `@sdxc/mcp` keeps authentication in router middleware by design.

### 3. Everything in `@sdxc/well-known`

**Rejected because**: challenges, audiences and the choice among authorization servers are
token policy, and ADR-083 keeps that package to generating and parsing documents.

### 4. Treat each request URL as its own resource

Serve metadata at every path under the API, each naming its own URL as `resource`, which
satisfies §3.3 for any client.

**Rejected because**: RFC 8707 would then bind each token to one path, so a client would
need a token per endpoint, and the metadata endpoint would answer for arbitrary paths.

## References

- [RFC 9728 - OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [RFC 6750 - The OAuth 2.0 Authorization Framework: Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750)
- [RFC 8707 - Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [RFC 8414 - OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414)
- [RFC 9110 §11 - HTTP Authentication](https://www.rfc-editor.org/rfc/rfc9110#section-11)
- [MCP Authorization, 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [ADR-048: Auth Classes Independent of Remix](./ADR-048-auth-core-independent-of-remix.md)
- [ADR-057: Request Context Instead of a Service Container](./ADR-057-request-context-instead-of-a-service-container.md)
- [ADR-083: Well-known URIs Package](./ADR-083-well-known-package.md)
- [ADR-085: SCIM 2.0 Package](./ADR-085-scim-package.md)
- [Reader ADR-006: MCP Server](./reader/ADR-006-mcp-server.md)

## Notes

- Implementation: `ProtectedResource#issuer()` is asynchronous and answers
  `Promise<Result<Issuer, AuthError>>`. The RFC 8414-then-OIDC fallback needs to know
  whether the RFC 8414 document can be read, so the method reads it (the read fills the
  issuer's memo, so it is spent once) and hands out an issuer whose metadata is known good.
  A document naming another issuer fails with `issuer_mismatch` and never falls back; an
  unlisted server also fails with `issuer_mismatch`, and a resource listing none with
  `endpoint_unsupported`.
- Implementation: `ResourceServer#metadata()` answers `null` for a server with no
  `resource`, like the `resource` and `metadataUrl` getters. `ResourceServer` is generic over
  the options it was built with, so a server whose options state `resource` types all three
  as present and `serve(protectedResourceMetadata, () => api.metadata())` compiles without
  an assertion. `ResourceServer.Options` is a union of `AudienceOptions` and
  `ResourceOptions` in place of constructor overloads, which keeps one of the two required.
- Implementation: with `resource` and no `audience`, the default audience is the resource as
  stated and as serialized, with and without a trailing slash, because `URL#href` adds a
  slash to a bare origin and an RFC 8707 token carries whichever spelling the client sent.
- Implementation: `bearerScheme` takes a `BearerSchemeServer`, `verifyRequest` plus an
  optional `challenge`, so a stand-in exposing only `verifyRequest` still compiles and
  answers the plain `Bearer error="invalid_token"`. `bearerFailure`'s handler also takes
  `requireAuth()`'s `BadAuth`: a `WWW-Authenticate` the app's body sets wins, then the
  failing scheme's challenge, then `api.challenge()`, so the header is sent exactly once.
- Implementation: `BearerChallenge` keeps a registered parameter whose value fits no typed
  field (an `error` outside RFC 6750 §3.1, a relative `error_uri` or `resource_metadata`) in
  `extensions` under its wire name. `parse` fails on a Bearer challenge carrying a token68
  or repeating a parameter; `ChallengeParseError` carries the offset. `stringify` replaces
  control characters with spaces so no value can end the header line.
- Implementation: `Issuer`'s `discovery: "oauth"` reads the RFC 8414 document through
  the same schema as the OIDC one, so an authorization server whose RFC 8414 metadata omits
  `authorization_endpoint` or `jwks_uri` still fails discovery; loosening that changes
  `Issuer.Metadata`'s required members and is left to the management API's adoption.
- Implementation: `ProtectedResource.DiscoverOptions.cache` shares fetched documents for an
  hour, the `Issuer` default; the §3.3 check runs on every read, cached or not.

## Current Progress

- [x] Phase 1: The document (`@sdxc/well-known/oauth-protected-resource`, built with ADR-083)
- [x] Phase 2: `@sdxc/auth` — `./bearer-challenge`, `ResourceServer`'s resource members,
      `./protected-resource`, `Issuer`'s `discovery` option, `bearerScheme`'s pointer and
      `bearerFailure`, README
- [ ] Phase 3: Adopt
