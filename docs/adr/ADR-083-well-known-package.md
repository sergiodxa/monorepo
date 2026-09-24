# ADR-083: Well-known URIs Package

## Status

**Accepted** - 2026-09-24

## Background

[RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) reserves the `/.well-known/` path prefix
for documents a client can find on any origin without being told where to look, and IANA
keeps the registry of names under it. Four apps in this repo serve such documents today:
`apps/r3-auth` and `apps/auth-saas` publish OpenID Connect discovery, RFC 8414 authorization
server metadata and a JWKS; `apps/blog` publishes a WebFinger document; and
`packages/oidc-provider` still carries a third copy of the discovery controllers. Each one
writes its document as an untyped object literal of snake_case keys, picks its own media type
and cache headers, and parses nothing: the client side lives separately in `@sdxc/auth`'s
`Issuer`, with its own schema for the same discovery document.

Two documents nobody serves yet are about to be needed. `security.txt` (RFC 9116) tells a
security researcher where to report a vulnerability, and every public app in the repo lacks
one. `oauth-protected-resource` (RFC 9728) is how a client discovers which authorization
server protects an API, which the Model Context Protocol requires of every MCP server, and
which [ADR-084](./ADR-084-oauth-protected-resource-metadata.md) proposes for every API that
accepts bearer tokens. Both are more of the same pattern: a registered name, a small typed
document, a media type, a cache policy.

## Context

### Current implementations

| Location                                                                | Lines | Document                              | Spec logic                                                        | App logic                                                   |
| ----------------------------------------------------------------------- | ----- | ------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/r3-auth/app/config.ts` (`WELL_KNOWN`)                             | ~50   | OIDC discovery and RFC 8414, one copy | member names, `URL` values serialized by `JSON.stringify`         | endpoint URLs, scopes, claims, logout capabilities          |
| `apps/r3-auth/app/http/controllers/well-known/*.ts`                     | 57    | three `createAction`s                 | none; `ok(WELL_KNOWN)` from `@sdxc/http/response/json`            | none; no `Cache-Control`, no `ETag`                         |
| `apps/auth-saas/database/metadata.ts` (`publishMetadata`)               | ~110  | OIDC discovery, RFC 8414, JWKS        | member names; typed `Record<string, string \| string[]>`          | per-tenant scopes and claims, device-grant add-on gating    |
| `apps/auth-saas/app/http/controllers/well-known/*.ts`                   | 110   | three `createAction`s                 | `Cache-Control` and `ETag` written by hand in each, 300 s max age | reads the tenant Durable Object                             |
| `apps/blog/app/http/controllers/well-known.ts`                          | 186   | WebFinger JRD, plus an avatar proxy   | JRD interfaces, `application/jrd+json`, 400 and 404 answers       | resource normalization, profile content, the avatar proxy   |
| `packages/oidc-provider/src/discovery/controllers/{oidc,oauth,jwks}.ts` | 225   | all three                             | member names, `application/json`, `public, max-age=3600`          | tenant issuer lookup; the package is private and unconsumed |
| `packages/auth/src/issuer.ts` (`METADATA_SCHEMA`, `JWKS_SCHEMA`)        | ~40   | parses discovery and JWKS             | the discovery path, 13 members, `{ keys: [...] }`                 | caching, identity check against the configured issuer       |
| `packages/jwt/src/jwk.ts` (`JWK.toJSON`)                                | ~45   | builds the JWKS body                  | public members per key type, typed as `jose.JSONWebKeySet`        | none                                                        |

### Issues identified

| Issue                                                                                                                                    | Where                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Discovery member names written four times, and read with a fifth schema                                                                  | r3-auth, auth-saas, oidc-provider, auth |
| A misspelled member (`token_endpont`) type-checks everywhere                                                                             | every writer                            |
| Cache headers differ per app: none, 300 s with `ETag`, 3600 s without                                                                    | r3-auth, auth-saas, oidc-provider       |
| WebFinger answers carry no `Access-Control-Allow-Origin`, which RFC 7033 §5 requires                                                     | `apps/blog`                             |
| WebFinger ignores the `rel` parameter, so every lookup returns every link                                                                | `apps/blog`                             |
| `id_token_signing_alg_values_supported` omits `RS256`, which OIDC Discovery §3 requires                                                  | r3-auth, auth-saas (ES256 only)         |
| No app serves `security.txt`                                                                                                             | every public app                        |
| `Issuer` builds the discovery URL by appending, which is right for OIDC and wrong for an RFC 8414 or RFC 9728 identifier carrying a path | `packages/auth/src/issuer.ts`           |

### What the standards ask of an implementation

| Rule                                                                                                    | Consequence for the package                                                                  |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| RFC 8615: names come from the IANA registry, served under `/.well-known/`                               | each subpath exports its registered `NAME`; the registry helper serves only registered names |
| RFC 8414 §3 and RFC 9728 §3.1 insert the suffix between host and path; OIDC Discovery §4 appends it     | `wellKnownUrl` takes the placement explicitly, and each format fixes its own                 |
| RFC 8414 §3.3, OIDC Discovery §4.3, RFC 9728 §3.3: the returned identifier must equal the requested one | `parse` takes the expected identifier and fails on a mismatch                                |
| RFC 8414 §2 and RFC 9728 §2 are open registries; unknown members are ignored                            | parsing keeps unknown members under `extensions`, typed through an optional schema           |
| RFC 7517 §5: implementations ignore JWKs with an unknown `kty` or missing members                       | a malformed entry is dropped and reported, and the set still parses                          |
| RFC 9116 §2.5: `Contact` at least once, `Expires` exactly once, `Preferred-Languages` at most once      | the document type requires `contact` and `expires`; `parse` enforces the cardinalities       |
| RFC 9116 §2–3: `text/plain; charset=utf-8`, CRLF or LF, `#` comments, case-insensitive field names      | the security.txt reader and writer are line-based, and keep unknown fields                   |
| RFC 7033 §4.2, §4.3, §5: `resource` required, `rel` filters links, CORS `*` on every answer             | WebFinger query reading, link selection, and the CORS header are part of the subpath         |
| W3C change-password: answer with a 302, 303 or 307 redirect                                             | the subpath builds the redirect and owns nothing else                                        |
| W3C passkey-endpoints: a JSON object, every member optional, never a redirect                           | an empty document is valid; the registry never redirects it                                  |

### Why one package

Each format is between 50 and 200 lines of types, a reader and a writer. What they share is
the part worth getting right once: the URL placement rule, the identifier check, the
extension handling, the error type, and how a document becomes a `Response`. Subpath exports
keep the import granular, so an app serving only `security.txt` pulls in only that reader and
writer, and one release unit carries the shared rules.

## Decision

Add `@sdxc/well-known`: typed readers and writers for the documents served under
`/.well-known/`, one subpath per registered name, plus a helper that turns a document into a
`Response` and a middleware that mounts several. The package generates and parses content.
Which names an app serves, and what goes in them, stays the app's decision.

### Package name

| Name                  | Trade-off                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@sdxc/well-known`    | Matches the RFC 8615 term and the URL segment a reader searches for; the recommendation                         |
| `@sdxc/discovery`     | Reads well for OIDC and RFC 9728, and wrongly for `security.txt` and `change-password`                          |
| `@sdxc/wellknown`     | Same scope; the unhyphenated spelling matches neither the RFC nor the path                                      |
| Per-standard packages | `@sdxc/security-txt`, `@sdxc/webfinger`, `@sdxc/oauth-metadata`: seven release units repeating the shared rules |

`@sdxc/well-known` wins because the name is the path: someone looking for how the repo serves
`/.well-known/webfinger` finds it by the URL they are debugging. Per-standard packages would
each carry a copy of the placement rule, the identifier check and the response helper, and a
format this small does not pay for its own README, release and trusted publisher.

### Scope

The package includes:

- `security.txt` (RFC 9116): read and write, with `Expires` required
- `webfinger` (RFC 7033): the JRD document, query reading and `rel` selection
- `oauth-authorization-server` (RFC 8414): authorization server metadata
- `openid-configuration` (OpenID Connect Discovery 1.0): provider metadata, a superset of RFC 8414
- `oauth-protected-resource` (RFC 9728): protected resource metadata, detailed in ADR-084
- `jwks` (RFC 7517 §5): the JWK Set document shape
- `change-password` (W3C): the redirect
- `passkey-endpoints` (W3C): the enroll and manage URLs
- `wellKnownUrl`, the `Response` helper and the registry middleware

What lives elsewhere:

- Key generation, import, signing and verification live in `@sdxc/jwt`; this package holds
  the JWKS document shape, and `JWK.toJSON`'s output satisfies it
- Fetching, caching and trusting a provider's discovery document live in `@sdxc/auth`'s
  `Issuer`, which parses through this package
- The protected resource runtime (its challenge, its metadata values, client-side discovery)
  lives in `@sdxc/auth`, per ADR-084
- `robots.txt` lives in its own package (ADR-087); it is served at the root, not under
  `/.well-known/`
- `host-meta` (RFC 6415) stays out: it is XRD XML, which would make `@sdxc/xml` a dependency
  of every consumer, and its one live use, fediverse account lookup, is covered by WebFinger
- `mta-sts.txt` (RFC 8461) stays out: it is served from a dedicated `mta-sts.` host no Worker
  in the repo answers, and mail reception belongs to the mail provider
- `apple-app-site-association` and `assetlinks.json` stay out: the repo ships no native app

### Dependencies

The document subpaths import `@sdxc/result` and `@remix-run/data-schema` and nothing else,
so `@sdxc/auth`'s core, which ADR-048 keeps independent of the `remix` umbrella, can parse
through them. `./response` and `./middleware` import `@sdxc/http/cache` and `remix/router`
types; both are optional peer dependencies, the arrangement `@sdxc/auth` already uses for its
`remix/*` subpaths. `@sdxc/jwt`, which carries `jose`, is a dev dependency used only by the
type test asserting that `JWK.toJSON` produces a `JwkSet`. The dependency runs one way:
`@sdxc/auth` and `@sdxc/oidc-provider` depend on `@sdxc/well-known`, which depends on neither.

### Exports

Every format subpath follows the same shape: a `NAME`, a `MEDIA_TYPE`, `parse` returning a
`Result`, `stringify`, and a descriptor bundling them for `./response` and `./middleware`.
Public fields are camelCase and `URL`-typed where the value is a URL; the RFC's member names
appear only in the serialized text. The one exception is a JWK's own members (`kty`, `crv`,
`x`), which are the key material `crypto.subtle.importKey("jwk", …)` takes, so they keep
their registered names.

#### `"."`

```ts
import type { Result } from "@sdxc/result";

/** A registered well-known document: how to name, serve, read and write it. */
export interface WellKnownFormat<Document> {
	/** The IANA-registered suffix, as it appears after `/.well-known/`. */
	readonly name: string;
	readonly mediaType: string;
	/** Where the suffix goes relative to an identifier carrying a path. */
	readonly placement: WellKnownPlacement;
	/** Whether every answer carries `Access-Control-Allow-Origin: *`. */
	readonly cors: boolean;
	stringify(document: Document): string;
	parse(text: string): Result<Document, WellKnownParseError>;
}

/** RFC 8414 and RFC 9728 insert between host and path; OIDC Discovery appends. */
export type WellKnownPlacement = "insert" | "append";

/**
 * The URL a well-known document is served at for an identifier. A terminating slash after
 * the host is dropped before inserting, per RFC 9728 §3.1.
 */
export function wellKnownUrl(
	identifier: URL | string,
	name: string,
	placement?: WellKnownPlacement, // @default "insert"
): URL;

export class WellKnownParseError extends Error {
	readonly format: string;
	readonly issues: WellKnownParseError.Issue[];
}

export namespace WellKnownParseError {
	export interface Issue {
		/** A JSON Pointer for a JSON document, a 1-based line number for a text one. */
		at: string | number;
		message: string;
	}
}
```

#### `"./security-txt"`

```ts
import type { Result } from "@sdxc/result";
import type { WellKnownFormat, WellKnownParseError } from "@sdxc/well-known";

export const NAME = "security.txt";
export const MEDIA_TYPE = "text/plain; charset=utf-8";

export interface SecurityTxt {
	/** `mailto:`, `tel:` or `https:` URIs, in the order a researcher should try them. */
	contact: [URL, ...URL[]];
	expires: Date;
	encryption: URL[];
	acknowledgments: URL[];
	/** Language tags, written as one comma-separated field. */
	preferredLanguages: string[];
	canonical: URL[];
	policy: URL[];
	hiring: URL[];
	/** Fields outside RFC 9116 §2.5, keyed by lowercased name, kept in order. */
	extensions: Record<string, string[]>;
}

export interface ParsedSecurityTxt extends SecurityTxt {
	/** Whether the text arrived inside an OpenPGP cleartext signature (RFC 9116 §2). */
	signed: boolean;
}

export interface StringifyOptions {
	/** `#` comment lines written before the first field. */
	comments?: string[];
}

export function parse(text: string): Result<ParsedSecurityTxt, WellKnownParseError>;
export function stringify(document: SecurityTxt, options?: StringifyOptions): string;

/** RFC 9116 §2.5.5: a file past its `Expires` is stale and SHOULD be ignored. */
export function isExpired(document: SecurityTxt, now?: Date): boolean;

export const securityTxt: WellKnownFormat<SecurityTxt>;
```

- `parse` fails on a missing `Contact`, a missing or repeated `Expires`, a repeated
  `Preferred-Languages`, a non-`https` URL where §2.5 asks for one, and a line that is
  neither a field, a comment nor blank. An expired file parses; staleness is the caller's
  question, answered by `isExpired`.
- A signed file is read from its signed body. Verifying the signature, and producing one,
  stays with the operator's own OpenPGP tooling; `stringify` writes unsigned text.

#### `"./webfinger"`

```ts
import type { Result } from "@sdxc/result";
import type { WellKnownFormat, WellKnownParseError } from "@sdxc/well-known";

export const NAME = "webfinger";
export const MEDIA_TYPE = "application/jrd+json";

export interface Jrd {
	subject: string | null;
	aliases: string[];
	/** Property URIs to values; RFC 7033 §4.4.3 allows `null`. */
	properties: Record<string, string | null>;
	links: JrdLink[];
}

export interface JrdLink {
	rel: string;
	type: string | null;
	href: string | null;
	/** Language tag, or `und`, to title. */
	titles: Record<string, string>;
	properties: Record<string, string | null>;
}

export interface WebFingerQuery {
	resource: string;
	/** Every `rel` parameter, in order; empty selects all links. */
	rels: string[];
}

export class MissingResourceError extends Error {}

/** Reads `resource` and every `rel` from a request URL, per RFC 7033 §4.1. */
export function readQuery(url: URL): Result<WebFingerQuery, MissingResourceError>;

/** The document with only the links whose `rel` was asked for, per §4.3. */
export function select(document: Jrd, rels: string[]): Jrd;

export function parse(text: string): Result<Jrd, WellKnownParseError>;
export function stringify(document: Jrd): string;

export const webFinger: WellKnownFormat<Jrd>; // cors: true
```

#### `"./oauth-authorization-server"`

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Result } from "@sdxc/result";
import type { WellKnownFormat, WellKnownParseError } from "@sdxc/well-known";

export const NAME = "oauth-authorization-server";
export const MEDIA_TYPE = "application/json";

/** RFC 8414 §2 plus the registry members an app in this repo publishes. */
export interface AuthorizationServerMetadata<Extensions extends object = {}> {
	issuer: URL;
	authorizationEndpoint: URL | null;
	tokenEndpoint: URL | null;
	jwksUri: URL | null;
	registrationEndpoint: URL | null;
	revocationEndpoint: URL | null;
	introspectionEndpoint: URL | null;
	deviceAuthorizationEndpoint: URL | null; // RFC 8628
	pushedAuthorizationRequestEndpoint: URL | null; // RFC 9126
	scopesSupported: string[];
	responseTypesSupported: string[];
	responseModesSupported: string[];
	grantTypesSupported: string[];
	tokenEndpointAuthMethodsSupported: string[];
	tokenEndpointAuthSigningAlgValuesSupported: string[];
	revocationEndpointAuthMethodsSupported: string[];
	introspectionEndpointAuthMethodsSupported: string[];
	codeChallengeMethodsSupported: string[];
	uiLocalesSupported: string[];
	serviceDocumentation: URL | null;
	opPolicyUri: URL | null;
	opTosUri: URL | null;
	authorizationResponseIssParameterSupported: boolean; // RFC 9207
	protectedResources: URL[]; // RFC 9728 §4
	signedMetadata: string | null;
	extensions: Extensions;
}

export interface ParseOptions<Extensions extends object> {
	/** The issuer the document was fetched for; a different `issuer` fails (§3.3). */
	issuer?: URL | string;
	extensions?: StandardSchemaV1<unknown, Extensions>;
}

export function parse<Extensions extends object = Record<string, unknown>>(
	text: string,
	options?: ParseOptions<Extensions>,
): Result<AuthorizationServerMetadata<Extensions>, WellKnownParseError>;

export function stringify(document: AuthorizationServerMetadata<object>): string;

/** Builds a document from the members an app sets; lists default to empty, URLs to `null`. */
export function define<Extensions extends object = {}>(
	document: Pick<AuthorizationServerMetadata<Extensions>, "issuer" | "responseTypesSupported"> &
		Partial<AuthorizationServerMetadata<Extensions>>,
): AuthorizationServerMetadata<Extensions>;

export const authorizationServerMetadata: WellKnownFormat<AuthorizationServerMetadata<object>>;
```

`stringify` omits `null` members and empty lists rather than writing them, so a document
built with `define` serializes to what the app would have written by hand. Extensions are
spread before the standard members, so an extension can never replace one.

#### `"./openid-configuration"`

```ts
import type { Result } from "@sdxc/result";
import type { WellKnownFormat, WellKnownParseError } from "@sdxc/well-known";
import type {
	AuthorizationServerMetadata,
	ParseOptions,
} from "@sdxc/well-known/oauth-authorization-server";

export const NAME = "openid-configuration";
export const MEDIA_TYPE = "application/json";

/** OpenID Connect Discovery 1.0 §3, which extends the RFC 8414 members. */
export interface OpenIdProviderMetadata<
	Extensions extends object = {},
> extends AuthorizationServerMetadata<Extensions> {
	authorizationEndpoint: URL;
	jwksUri: URL;
	userinfoEndpoint: URL | null;
	endSessionEndpoint: URL | null;
	checkSessionIframe: URL | null;
	subjectTypesSupported: string[];
	idTokenSigningAlgValuesSupported: string[];
	claimsSupported: string[];
	promptValuesSupported: string[];
	acrValuesSupported: string[];
	requestParameterSupported: boolean;
	requestUriParameterSupported: boolean;
	frontchannelLogoutSupported: boolean;
	frontchannelLogoutSessionSupported: boolean;
	backchannelLogoutSupported: boolean;
	backchannelLogoutSessionSupported: boolean;
}

export function parse<Extensions extends object = Record<string, unknown>>(
	text: string,
	options?: ParseOptions<Extensions>,
): Result<OpenIdProviderMetadata<Extensions>, WellKnownParseError>;

export function stringify(document: OpenIdProviderMetadata<object>): string;
export function define<Extensions extends object = {}>(
	document: Pick<
		OpenIdProviderMetadata<Extensions>,
		| "issuer"
		| "authorizationEndpoint"
		| "jwksUri"
		| "responseTypesSupported"
		| "subjectTypesSupported"
		| "idTokenSigningAlgValuesSupported"
	> &
		Partial<OpenIdProviderMetadata<Extensions>>,
): OpenIdProviderMetadata<Extensions>;

export const openIdConfiguration: WellKnownFormat<OpenIdProviderMetadata<object>>; // placement: "append"
```

`parse` fails when a required member is missing. It does not fail on an
`idTokenSigningAlgValuesSupported` lacking `RS256`, because every provider in this repo
publishes ES256 alone and `@sdxc/auth` must keep reading them; the omission is recorded
under Consequences instead.

#### `"./oauth-protected-resource"`

`ProtectedResourceMetadata`, its `parse` (with the RFC 9728 §3.3 resource check), `stringify`,
`define`, `metadataUrl(resource)` and the `protectedResourceMetadata` descriptor. The full
API and its runtime counterpart in `@sdxc/auth` are specified in ADR-084.

#### `"./jwks"`

```ts
import type { Result } from "@sdxc/result";
import type { WellKnownFormat, WellKnownParseError } from "@sdxc/well-known";

export const NAME = "jwks.json";
export const MEDIA_TYPE = "application/json";

/** One key, with the member names RFC 7517 §4 registers, as Web Crypto imports it. */
export interface Jwk {
	kty: string;
	kid?: string;
	use?: string;
	key_ops?: string[];
	alg?: string;
	x5u?: string;
	x5c?: string[];
	x5t?: string;
	"x5t#S256"?: string;
	[member: string]: unknown;
}

export interface JwkSet {
	keys: Jwk[];
}

export interface ParsedJwkSet extends JwkSet {
	/** Entries dropped for lacking `kty` or not being objects, per RFC 7517 §5. */
	skipped: number;
}

export function parse(text: string): Result<ParsedJwkSet, WellKnownParseError>;
/** Fails when a private member (`d`, `p`, `q`, `dp`, `dq`, `qi`, `k`) is present. */
export function stringify(document: JwkSet): Result<string, WellKnownParseError>;

export const jwks: WellKnownFormat<JwkSet>;
```

JWKS is not an IANA-registered name; `jwks.json` is the path OIDC providers conventionally
advertise through `jwks_uri`, so the descriptor's `name` is `"jwks.json"` and the registry
helper serves it like the others. `stringify` returns a `Result` because refusing to publish
private key material is the one check worth making at the moment of writing: a key pair
passed where its public half belonged is the mistake that leaks a signing key.

#### `"./change-password"`

```ts
export const NAME = "change-password";

/** A 302 to the page where a signed-in person changes their password. */
export function redirect(target: URL | string): Response;
```

#### `"./passkey-endpoints"`

```ts
import type { Result } from "@sdxc/result";
import type { WellKnownFormat, WellKnownParseError } from "@sdxc/well-known";

export const NAME = "passkey-endpoints";
export const MEDIA_TYPE = "application/json";

export interface PasskeyEndpoints {
	enroll: URL | null;
	manage: URL | null;
	prfUsageDetails: URL | null;
}

export function parse(text: string): Result<PasskeyEndpoints, WellKnownParseError>;
export function stringify(document: PasskeyEndpoints): string;
export const passkeyEndpoints: WellKnownFormat<PasskeyEndpoints>;
```

#### `"./response"`

```ts
import type { PolicyOptions } from "@sdxc/http/cache";
import type { WellKnownFormat } from "@sdxc/well-known";

export interface RespondOptions {
	/** Enables a 304 when the request's `If-None-Match` still matches. */
	request?: Request;
	/** @default { visibility: "public", maxAge: "1 hour" } */
	cache?: PolicyOptions;
	headers?: HeadersInit;
}

/**
 * The document as a `Response`: its media type, a `Cache-Control` from `policy()`, an
 * `ETag` from `etag()` over the serialized body, CORS where the format requires it, and a
 * 304 through `conditional()` when `request` is given.
 */
export function respond<Document>(
	format: WellKnownFormat<Document>,
	document: Document,
	options?: RespondOptions,
): Promise<Response>;
```

#### `"./middleware"`

```ts
import type { Middleware, RequestContext } from "remix/router";
import type { WellKnownFormat } from "@sdxc/well-known";
import type { RespondOptions } from "@sdxc/well-known/response";

/** What one name answers with; `null` falls through to the next middleware, usually a 404. */
export type WellKnownEntry = (ctx: RequestContext) => Response | null | Promise<Response | null>;

/** Serves a format's document, produced per request so tenant or clock data can vary. */
export function serve<Document>(
	format: WellKnownFormat<Document>,
	produce: (ctx: RequestContext) => Document | null | Promise<Document | null>,
	options?: Omit<RespondOptions, "request">,
): WellKnownEntry;

/**
 * Answers `GET` and `HEAD` on `/.well-known/<name>` (and `/.well-known/<name>/<path>` for an
 * inserted name) for the names given, `OPTIONS` for a CORS format, and a 405 with `Allow`
 * for any other method. Every other path goes to `next()`.
 */
export function wellKnown(entries: Record<string, WellKnownEntry>): Middleware;
```

The middleware claims only the names it is given, so an app-specific path such as the
blog's `/.well-known/avatar` stays an ordinary route beside it.

### Usage

**security.txt on the auth servers**, the first adopters, through the middleware:

```ts
import { securityTxt } from "@sdxc/well-known/security-txt";
import { serve, wellKnown } from "@sdxc/well-known/middleware";

import { SECURITY_TXT } from "~/app/config";

let router = createRouter({
	middleware: [log(logger), wellKnown({ "security.txt": serve(securityTxt, () => SECURITY_TXT) })],
});
```

`SECURITY_TXT` is a constant in `app/config.ts` with a literal `expires` date, and a test in
each adopting app fails once that date is less than 30 days away. The RFC asks for `Expires`
so that a human looks at the file at least once a year; computing it from the clock would
keep the file fresh forever while its contact went stale.

**OIDC discovery in `apps/r3-auth`**, keeping its route table and controllers:

```ts
import { define } from "@sdxc/well-known/openid-configuration";

export const WELL_KNOWN = define({
	issuer: new URL(ISSUER),
	authorizationEndpoint: new URL("/authorize", ISSUER_HOST),
	jwksUri: new URL("/.well-known/jwks.json", ISSUER_HOST),
	responseTypesSupported: ["code"],
	subjectTypesSupported: ["public"],
	idTokenSigningAlgValuesSupported: [JWK.Algorithm.ES256],
	// …every member WELL_KNOWN sets today, now camelCase and checked
});

export default createAction(routes.wellKnown.openidConfiguration, (ctx) =>
	respond(openIdConfiguration, WELL_KNOWN, { request: ctx.request }),
);
```

**The JWKS in `apps/auth-saas`**, where the tenant already publishes a version and max age:

```ts
export default createAction(routes.jwks, async (ctx) => {
	let metadata = await ctx.tenantStub.publishMetadata({ now: Date.now() });
	return respond(jwks, metadata.jwks, {
		request: ctx.request,
		cache: { visibility: "public", maxAge: `${metadata.maxAge} seconds` },
	});
});
```

**WebFinger in `apps/blog`**, keeping the profile content and resource normalization:

```ts
async webFinger(ctx) {
	let query = readQuery(ctx.url);
	if (isFailure(query)) return badRequest({ error: query.error.message });

	let subject = normalizeResource(query.data.resource);
	if (!subject) return notFound({ error: "Unknown resource." });

	return respond(webFinger, select(createWebFingerDocument(subject), query.data.rels), {
		request: ctx.request,
	});
}
```

**The client side in `@sdxc/auth`**: `Issuer#discover` calls
`openIdConfiguration.parse(body, { issuer: this.identifier })` in place of
`METADATA_SCHEMA`, and `JWKS_SCHEMA` gives way to `jwks.parse`. `Issuer.Metadata` keeps
accepting the snake_case document an app copies from a provider, since that is its purpose.

### security.txt adoption order

| App                                    | Host                                      | Why this order                                                                   |
| -------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| `r3-auth`                              | `auth.sergiodxa.com`                      | Holds every account's credentials; the first host a researcher probes            |
| `auth-saas`                            | each tenant host, plus the platform hosts | Customers' identities; tenants inherit the platform's file, `Canonical` per host |
| `uptime`                               | `uptime.sergiodxa.com`                    | Paid product holding customer API keys                                           |
| `blog`                                 | `sergiodxa.com`                           | The apex domain, where a researcher looks when no subdomain answers              |
| `reader`, `books`, `sdxc`, `blog-saas` | their hosts                               | Same file, same contact, their own `Canonical`                                   |

The contact address and policy URL are the owner's to choose and are not decided here. One
shared constant in each app is enough; nothing forces a shared package for the content,
because `Canonical` and the host differ per app.

## Consequences

### Positive

- **Typed documents** - a misspelled member or a string where a URL belongs fails the type
  check, in every writer, and the RFC's member names are written once
- **Writer and reader agree** - `@sdxc/auth` parses the documents the auth apps produce with
  the same module, so the discovery document cannot drift from its client
- **One cache policy** - every well-known response carries `Cache-Control` and an `ETag` and
  answers conditional requests, where today one app of three does
- **WebFinger conforms** - CORS and `rel` selection come with the subpath
- **security.txt everywhere** - a one-line middleware entry per app, with a test forcing the
  annual review
- **Path placement decided once** - `wellKnownUrl` gets RFC 8414 and RFC 9728 path insertion
  right for identifiers carrying a path, which `Issuer` and ADR-084 both need

### Negative

- **One more package on the release path** - README, public-package steps, and a dependency
  added to `@sdxc/auth`, `@sdxc/oidc-provider` and four apps
- **A field-mapping table to maintain** - each camelCase member maps to its registered wire
  name by hand, and a new registry member means a new row
- **Optional peers** - an app using `./response` without `@sdxc/http` installed fails at
  import time rather than at install time
- **RS256 still missing** - the package documents OIDC Discovery's RS256 requirement rather
  than enforcing it; r3-auth and auth-saas stay non-conforming until they publish an RSA key

### Neutral

- **Byte-level output changes** - member order in serialized discovery documents changes;
  clients read JSON members by name, and the existing discovery tests assert by member
- **JWKS keeps `application/json`** - `application/jwk-set+json` (RFC 7517 §8.5) is the
  registered type, and `application/json` is what every current consumer receives; the
  descriptor's `mediaType` is one constant to flip later
- **`packages/oidc-provider` migrates without a consumer** - it is private and no app
  imports it, so its three controllers move for consistency only

## Implementation Plan

### Phase 1: Core and the auth documents

**Priority:** High
**Estimated Effort:** 5 hours

1. Write the tests first: `wellKnownUrl` insertion and appending (with and without a path, a
   trailing slash), identifier mismatches, extension round-trips, JWKS entries skipped per
   RFC 7517 §5, private members refused by `jwks.stringify`
2. Implement `"."`, `./oauth-authorization-server`, `./openid-configuration`, `./jwks`,
   `./response`
3. Add the type test asserting `JWK.toJSON`'s return is assignable to `JwkSet`
4. README per the package documentation guide; root README table row

### Phase 2: Migrate the auth call sites

**Priority:** High
**Estimated Effort:** 4 hours

| Call site                                                               | Change                                                                                                     |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `apps/r3-auth/app/config.ts`                                            | `WELL_KNOWN` built with `openid-configuration`'s `define`                                                  |
| `apps/r3-auth/app/http/controllers/well-known/*.ts`                     | `respond(...)`, gaining `Cache-Control`, `ETag` and 304                                                    |
| `apps/auth-saas/database/metadata.ts`                                   | `MetadataDocument` replaced by the two typed documents                                                     |
| `apps/auth-saas/app/http/controllers/well-known/*.ts`                   | the hand-written header blocks replaced by `respond(...)`                                                  |
| `packages/oidc-provider/src/discovery/controllers/{oidc,oauth,jwks}.ts` | `define` and `respond`                                                                                     |
| `packages/auth/src/issuer.ts`                                           | `METADATA_SCHEMA` and `JWKS_SCHEMA` replaced by the subpath parsers; the discovery URL from `wellKnownUrl` |

The existing `discovery.test.ts` files in both auth apps stay unchanged as the check that
every member survived.

### Phase 3: security.txt and the middleware

**Priority:** High
**Estimated Effort:** 3 hours

1. Implement `./security-txt` from RFC 9116's examples, including a cleartext-signed input,
   and `./middleware`
2. Adopt in r3-auth and auth-saas, then uptime and blog, then the remaining apps, each with
   the expiry test

### Phase 4: WebFinger extraction

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Implement `./webfinger`
2. `apps/blog/app/http/controllers/well-known.ts`: drop the three JRD interfaces and the
   hand-built `Response`, keep `normalizeResource`, `createWebFingerDocument` and the avatar
   proxy; add the controller tests the blog has none of today (missing resource, unknown
   resource, `rel` selection, CORS header)

### Phase 5: change-password and passkey-endpoints

**Priority:** Low
**Estimated Effort:** 1 hour

1. Implement both subpaths
2. `apps/r3-auth` serves `change-password` pointing at `/password/forgot`, its only
   password-setting flow until an account page gains one; `passkey-endpoints` waits for the
   first app with a self-service passkey page (auth-saas manages passkeys only through its
   management API today)

### Phase 6: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. Remove `private: true`, add `description` and `LICENSE.md`
2. `bun run release:bootstrap @sdxc/well-known`, then configure the trusted publisher

## Alternatives Considered

### 1. Per-standard packages

`@sdxc/security-txt`, `@sdxc/webfinger`, `@sdxc/oauth-metadata` and so on, following the
repo's habit of giving each format its own package.

**Rejected because**: the formats are small and share their hardest rules. Seven packages
would each carry the placement rule, the identifier check and the response helper, or depend
on an eighth that holds them, which is this package with extra release units.

### 2. Put the discovery documents in `@sdxc/auth` and `@sdxc/oidc-provider`

**Rejected because**: the writer (a provider) and the reader (`@sdxc/auth`) would each own a
copy, which is today's problem, and `security.txt` and WebFinger have no home in either.

### 3. The registry as a route table

Export a `remix/routes` map of well-known routes the app installs with `router.map`.

**Rejected because**: the set of names varies per app, a typed route map cannot be built
from a runtime record without losing the `href()` types it exists for, and nested maps
throw. A middleware that claims only the names it is given composes with the app's own
routes, and apps that want typed routes keep them and call `respond` from their action.

### 4. An npm package

`oauth4webapi` and `openid-client` parse discovery documents as part of a full client, and
`security.txt` libraries exist for Node.

**Rejected because**: none covers more than one of these formats, none returns `Result`, and
the discovery parsers come attached to a client `@sdxc/auth` already is.

## References

- [RFC 8615 - Well-Known Uniform Resource Identifiers](https://www.rfc-editor.org/rfc/rfc8615)
- [IANA Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris)
- [RFC 9116 - A File Format to Aid in Security Vulnerability Disclosure](https://www.rfc-editor.org/rfc/rfc9116)
- [RFC 7033 - WebFinger](https://www.rfc-editor.org/rfc/rfc7033)
- [RFC 8414 - OAuth 2.0 Authorization Server Metadata](https://www.rfc-editor.org/rfc/rfc8414)
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)
- [RFC 9728 - OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [RFC 7517 - JSON Web Key](https://www.rfc-editor.org/rfc/rfc7517)
- [W3C - A Well-Known URL for Changing Passwords](https://www.w3.org/TR/change-password-url/)
- [W3C - Passkey Endpoints Well-Known URL](https://www.w3.org/TR/passkey-endpoints/)
- [ADR-022: HTTP Cache Policies and Conditional Responses](./ADR-022-http-cache-policies-and-conditional-responses.md)
- [ADR-048: Auth Classes Independent of Remix](./ADR-048-auth-core-independent-of-remix.md)
- [ADR-084: OAuth 2.0 Protected Resource Metadata](./ADR-084-oauth-protected-resource-metadata.md)
- [ADR-087: robots.txt Package](./ADR-087-robots-txt-package.md)

## Notes

- Implementation: `issuer` is a `string` in `AuthorizationServerMetadata` and
  `OpenIdProviderMetadata`, and `ParseOptions.issuer` accepts `URL | string`. The deployed
  provider publishes the non-URL identifier `auth.sergiodxa.com`, `@sdxc/auth` already reads
  `issuer` as a string, and the value is compared as published and carried verbatim in `iss`.
  The identity check reads a URL identifier as a URL (host case and a trailing slash ignored)
  and compares any other identifier byte for byte.
- Implementation: `WellKnownFormat.stringify` returns a `string`, so the `jwks` descriptor
  cannot return `jwks.stringify`'s `Result`. Serving through the descriptor publishes each
  key's public half (private members removed) and leaves `oct` keys out, so a response can
  never carry private material; `jwks.stringify` still refuses private members with issues.
- Implementation: the descriptors' `parse` reads structure only. `protectedResourceMetadata`
  in particular cannot run the §3.3 check without the expected resource, which only the
  subpath's `parse(text, { resource })` receives.
- Implementation: flags carry the specification's default rather than always `false`:
  `requestUriParameterSupported` defaults to `true` (OIDC Discovery §3), and `stringify`
  omits a flag at its default, so an explicit `false` survives the round trip.
- Implementation: `jwks.parse` also drops an entry of a registered key type (`EC`, `RSA`,
  `OKP`, `oct`) missing a member that type requires, as RFC 7517 §5 allows; an unregistered
  `kty` is kept for the importing code to judge.
- Implementation: `WellKnownParseError.Issue.at` is `""` for a whole JSON document and `0`
  for a whole security.txt file (a missing `Contact` or `Expires`).
- Implementation: `wellKnown()` accepts `/.well-known/<name>/<path>` only for an entry built
  by `serve()` from an `"insert"` format; a plain function entry (a change-password
  redirect) matches its exact name. `respond` answers `HEAD` with an empty body.
- Implementation: the type test asserting `JWK.toJSON` produces a `JwkSet` is not written:
  `@sdxc/jwt` is not yet a dev dependency of the package.

## Current Progress

- [x] Phase 1: `"."`, `./oauth-authorization-server`, `./openid-configuration`, `./jwks`,
      `./response`, with tests and README
- [ ] Phase 1: the `JWK.toJSON` type test (needs `@sdxc/jwt` as a dev dependency)
- [ ] Phase 2: Migrate the auth call sites
- [x] Phase 3: `./security-txt` and `./middleware`
- [ ] Phase 3: security.txt adoption in the apps
- [x] Phase 4: `./webfinger`
- [ ] Phase 4: `apps/blog` WebFinger extraction
- [x] Phase 5: `./change-password` and `./passkey-endpoints`, plus `./oauth-protected-resource` for ADR-084
- [ ] Phase 5: `apps/r3-auth` serves `change-password`
- [ ] Phase 6: Publish
