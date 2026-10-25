# @sdxc/well-known

Typed documents for well-known URIs: security.txt, WebFinger, NodeInfo, OAuth and OIDC metadata, JWKS and more.

[RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) reserves `/.well-known/` for documents a client
finds on any origin without being told where to look. Each registered name is one subpath of this
package that reads, writes and describes its document, with camelCase fields and `URL` values; the
specification's member names appear only in the serialized text.

## Installation

```sh
npm add @sdxc/well-known
```

Readers return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values, installed
alongside. Serving through `./response` and `./middleware` also needs
[`@sdxc/http`](https://www.npmjs.com/package/@sdxc/http) and
[`remix`](https://www.npmjs.com/package/remix).

## Usage

### Find a document's URL

```typescript
import { wellKnownUrl } from "@sdxc/well-known";

wellKnownUrl("https://auth.example.com/tenant", "oauth-authorization-server");
// https://auth.example.com/.well-known/oauth-authorization-server/tenant
wellKnownUrl("https://auth.example.com/tenant", "openid-configuration", "append");
// https://auth.example.com/tenant/.well-known/openid-configuration
```

OAuth metadata inserts the suffix between the host and the path; OpenID Connect Discovery appends
it to the issuer.

### Read a fetched document

```typescript
import { isFailure } from "@sdxc/result";
import { wellKnownUrl } from "@sdxc/well-known";
import { parse } from "@sdxc/well-known/oauth-authorization-server";

let issuer = "https://auth.example.com";
let response = await fetch(wellKnownUrl(issuer, "oauth-authorization-server"));
let metadata = parse(await response.text(), { issuer });

if (isFailure(metadata)) {
	metadata.error.issues; // [{ at: "/token_endpoint", message: "..." }, ...]
} else {
	metadata.data.tokenEndpoint; // URL | null
}
```

Every reader returns a `Result`. Its failure, `WellKnownParseError`, lists every issue at once,
each located by a JSON Pointer (or a line number for security.txt).

### Write a document

```typescript
import { define, stringify } from "@sdxc/well-known/oauth-protected-resource";

let metadata = define({
	resource: new URL("https://api.example.com/v1"),
	authorizationServers: [new URL("https://auth.example.com")],
	scopesSupported: ["read", "write"],
});

stringify(metadata);
// {"resource":"https://api.example.com/v1","authorization_servers":[...],...}
```

`define` fills every member you leave out with its default, and `stringify` writes only what
differs from it.

### Serve it

```typescript
import { securityTxt } from "@sdxc/well-known/security-txt";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [
		wellKnown({
			"security.txt": serve(securityTxt, () => ({
				contact: [new URL("mailto:security@example.com")],
				expires: new Date("2027-06-30T00:00:00Z"),
				encryption: [],
				acknowledgments: [],
				preferredLanguages: ["en"],
				canonical: [new URL("https://example.com/.well-known/security.txt")],
				policy: [],
				hiring: [],
				extensions: {},
			})),
		}),
	],
});
```

`wellKnown` answers the names it lists with the media type, a cache policy, an `ETag`, CORS where
the specification requires it and a 304 for a current copy; every other path reaches your routes.

## API

### `@sdxc/well-known`

#### `wellKnownUrl(identifier: URL | string, name: string, placement?: WellKnownPlacement): URL`

The URL a document is served at for an identifier. `"insert"`, the default, puts the suffix
between the host and the path and keeps the query; `"append"` adds it after the path.

#### `WellKnownParseError`

The failure every reader returns, with `format` (the registered name) and `issues`, each an `at`
(a JSON Pointer, `""` for the whole document; or a 1-based line, `0` for the whole file) and a
`message`.

#### `WellKnownFormat<Document>`

The descriptor each document subpath exports: `name`, `mediaType`, `placement`, `cors`,
optional fixed `headers`, `stringify` and `parse`. `respond` and `serve` take one; its `parse` reads structure only, so a
client checking a fetched document's issuer or resource calls the subpath's own `parse`.

### Every document subpath

Each exports `NAME`, `MEDIA_TYPE`, `parse(text)`, `stringify(document)` and a descriptor.

### `@sdxc/well-known/security-txt` (RFC 9116)

- `parse(text): Result<ParsedSecurityTxt, WellKnownParseError>` reads signed or unsigned text,
  setting `signed` for an OpenPGP cleartext signature, which it leaves unverified. It fails on a
  missing `Contact`, a missing or repeated `Expires`, a repeated `Preferred-Languages`, an `http`
  URI and a malformed line; an expired file parses.
- `stringify(document, options?: StringifyOptions): string` writes unsigned text with LF endings,
  with `options.comments` at the top.
- `isExpired(document, now?: Date): boolean` answers whether `expires` has passed.
- `cleartextSigner({ key, passphrase?, onError? })` is a `transform` for `serve`/`respond` that
  wraps the file in an OpenPGP cleartext signature through
  [`@sdxc/openpgp`](https://www.npmjs.com/package/@sdxc/openpgp). `key` reads an armored private
  key per call; with none, or one that fails (reported to `onError`), the file is served unsigned.
  Each body is signed once, so the `ETag` stays stable.
- `securityTxt` is the descriptor.

### `@sdxc/well-known/webfinger` (RFC 7033)

- `readQuery(url: URL): Result<WebFingerQuery, MissingResourceError>` reads `resource` and every
  `rel`; the failure is the request to answer with a 400.
- `select(document: Jrd, rels: string[]): Jrd` keeps only the links whose `rel` was asked for; an
  empty list keeps them all.
- `parse` and `stringify` read and write a `Jrd`; `webFinger` is the descriptor, served with CORS.

### `@sdxc/well-known/oauth-authorization-server` (RFC 8414)

- `parse(text, options?: ParseOptions)` fails on a missing `issuer` or `response_types_supported`,
  a malformed member, or an `issuer` other than `options.issuer`. Members outside the
  specification land in `extensions` under their serialized names, validated by
  `options.extensions`, any synchronous [Standard Schema](https://standardschema.dev/).
- `define(document)` takes `issuer` and `responseTypesSupported` and defaults lists to `[]`, URLs
  to `null` and flags to `false`, except `requestUriParameterSupported`, which is `true` as the
  registry defines it. The PAR (RFC 9126) and request object (RFC 9101) members are typed fields:
  `pushedAuthorizationRequestEndpoint`, `requirePushedAuthorizationRequests`,
  `requestParameterSupported`, `requestUriParameterSupported`,
  `requestObjectSigningAlgValuesSupported` and `requireSignedRequestObject`.
- `stringify(document): string` writes extensions beside the standard members, which win a name
  clash.
- `authorizationServerMetadata` is the descriptor.

### `@sdxc/well-known/openid-configuration` (OpenID Connect Discovery 1.0)

`OpenIdProviderMetadata` adds the Discovery members to the RFC 8414 document. `define` also
requires `authorizationEndpoint`, `jwksUri`, `subjectTypesSupported` and
`idTokenSigningAlgValuesSupported`. `parse`,
`stringify` and `ParseOptions` work as above; `openIdConfiguration` is the descriptor, with
`placement: "append"`.

### `@sdxc/well-known/oauth-protected-resource` (RFC 9728)

- `parse(text, options: ParseOptions)` requires the expected `options.resource`: the document's
  `resource` must equal it, or with `match: "prefix"` be a same-origin, segment-aligned prefix of
  it. `extensions` works as for RFC 8414.
- `define(document)` takes `resource` and defaults `bearerMethodsSupported` to `["header"]`.
- `metadataUrl(resource: URL | string): URL` is where a resource's metadata is served.
- `stringify` writes the document; `protectedResourceMetadata` is the descriptor.

### `@sdxc/well-known/jwks` (RFC 7517)

- `parse(text): Result<ParsedJwkSet, WellKnownParseError>` drops entries without a `kty` or the
  members their `EC`, `RSA`, `OKP` or `oct` key type requires, counting them in `skipped`.
- `stringify(document: JwkSet): Result<string, WellKnownParseError>` fails on any private member
  (`d`, `p`, `q`, `dp`, `dq`, `qi`, `oth`, `k`).
- `jwks` is the descriptor. Serving through it publishes each key's public half and leaves
  symmetric keys out, so private keys can go in directly.

### `@sdxc/well-known/client-id-metadata-document` (OAuth Client ID Metadata Document, draft 02)

The RFC 7591 metadata a client serves at the `https` URL it uses as `client_id`: `parse(text, { clientId })`
applies the draft's `client_id`, credential and redirect URI rules, `define` and `stringify` write
one, and `respond(clientIdMetadataDocument, document)` serves it.

### `@sdxc/well-known/http-message-signatures-directory` (Web Bot Auth)

The key directory a signing bot publishes, served as `MEDIA_TYPE`
(`application/http-message-signatures-directory+json`) with CORS.

- `parse(text)` keeps public, asymmetric keys with a registered HTTP signature `alg` (or none) and
  numeric `nbf`/`exp`, counting the rest in `skipped`.
- `build(keys)` publishes each key's public half with `use: "sig"`, failing for a symmetric key or
  one without `kid`; set `kid` to the key's RFC 7638 thumbprint (`JWK.thumbprint` in `@sdxc/jwt`).
- `httpMessageSignaturesDirectory` is the descriptor. `@sdxc/http-signatures/web-bot-auth` signs
  the response through `respond`'s `sign` option.

### `@sdxc/well-known/api-catalog` (RFC 9727)

The link set listing the APIs a host publishes, served as `MEDIA_TYPE`
(`application/linkset+json` with the RFC 9727 `profile`) with CORS, and with
`Link: </.well-known/api-catalog>; rel="api-catalog"` on every answer, `HEAD` included.

- `build({ url, apis, catalogs? })` writes an `item` link from the catalog to each API, then each
  API's `serviceDesc`, `serviceDoc`, `serviceMeta` and `status` targets anchored at its endpoint,
  every path resolved against `url`. `catalogs` nests other catalogs.
- `parse(text)` reads any RFC 9264 JSON link set with at least one link, as `{ links }` in the
  shape `@sdxc/link-header/linkset` reads.
- `apiCatalog` is the descriptor:

```typescript
wellKnown({
	"api-catalog": serve(apiCatalog, (ctx) =>
		build({
			url: new URL("/.well-known/api-catalog", ctx.url),
			apis: [
				{ url: "/v1", serviceDesc: [{ href: "/v1/openapi.json" }], status: [{ href: "/health" }] },
			],
		}),
	),
});
```

### `@sdxc/well-known/change-password` (W3C)

`redirect(target: URL | string): Response` is a 302 to the page where a signed-in person changes
their password. The name has no document, so it exports `NAME` and no descriptor.

### `@sdxc/well-known/passkey-endpoints` (W3C)

`PasskeyEndpoints` has `enroll`, `manage` and `prfUsageDetails`, each `URL | null`; an empty
object is a valid document. `passkeyEndpoints` is the descriptor.

### `@sdxc/well-known/nodeinfo` (NodeInfo 2.0 and 2.1)

- `parseLinks(text)` and `stringifyLinks(document)` read and write the `/.well-known/nodeinfo`
  discovery document, `{ links }`, each link a schema `rel` (`NODEINFO_2_0` or `NODEINFO_2_1`) and
  an absolute `href`. `nodeInfoLinks` is its descriptor, served with CORS.
- `parse(text): Result<NodeInfo, WellKnownParseError>` reads 2.0 and 2.1 against the schema, a 2.0
  document with `software.repository` and `software.homepage` as `null`. Protocol and service
  names outside the schema's registry are kept.
- `stringify(document: NodeInfo): string` always writes 2.1, leaving out `null` members.
- `nodeInfo` is the descriptor for the document itself, served at the `href` the links name with
  `DOCUMENT_MEDIA_TYPE`, the 2.1 profile.

### `@sdxc/well-known/response`

#### `respond(format, document, options?: RespondOptions): Promise<Response>`

The document with its media type, a `Cache-Control` (`options.cache`, default public for one hour),
an `ETag` over the body and CORS for a CORS format. With `options.request` it answers 304 when
`If-None-Match` still matches and an empty body for `HEAD`. `options.headers` apply last.
`options.transform(body)` rewrites the serialized body before the `ETag` is computed, such as
`cleartextSigner`. `options.sign(response, request)` runs over the full 200 response first, for a
signature over the body.

### `@sdxc/well-known/middleware`

#### `serve(format, produce: (ctx) => Document | null, options?): WellKnownEntry`

Answers with `produce(ctx)`'s document through `respond`, built per request; `null` falls through
to the next middleware. `produce` may be async, and `options` takes `cache`, `headers`, `transform` and `sign`.

#### `wellKnown(entries: Record<string, WellKnownEntry>): Middleware`

Answers `GET` and `HEAD` on `/.well-known/<name>` for each name given, and on
`/.well-known/<name>/<path>` for a `serve`d format that inserts its suffix. A CORS format also
answers `OPTIONS`; any other method gets a 405 with `Allow`. Every other path goes to `next()`.

### Types

`WellKnownPlacement` is `"insert" | "append"`. `WellKnownEntry` is any
`(ctx) => Response | null`, sync or async. Each document subpath exports its document type
(`SecurityTxt`, `Jrd`, `AuthorizationServerMetadata<Extensions>`, `OpenIdProviderMetadata<Extensions>`,
`ProtectedResourceMetadata<Extensions>`, `JwkSet`, `ApiCatalog`, `PasskeyEndpoints`, `NodeInfo`,
`NodeInfoLinks`) and the types of its members (`ParsedSecurityTxt`, `JrdLink`, `WebFingerQuery`,
`LocalizedString`, `BearerMethod`, `Jwk`, `ParsedJwkSet`, `NodeInfoSoftware`, `NodeInfoUsage` and
the rest).

## Pattern: security.txt, WebFinger And Change-Password On One Router

```typescript
import { isFailure } from "@sdxc/result";
import { redirect } from "@sdxc/well-known/change-password";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { cleartextSigner, isExpired, securityTxt } from "@sdxc/well-known/security-txt";
import { env } from "cloudflare:workers";
import type { SecurityTxt } from "@sdxc/well-known/security-txt";
import { readQuery, select, webFinger } from "@sdxc/well-known/webfinger";
import type { Jrd } from "@sdxc/well-known/webfinger";
import { createRouter } from "remix/router";

export const SECURITY_TXT: SecurityTxt = {
	contact: [new URL("mailto:security@example.com")],
	expires: new Date("2027-06-30T00:00:00Z"),
	encryption: [],
	acknowledgments: [],
	preferredLanguages: ["en"],
	canonical: [new URL("https://example.com/.well-known/security.txt")],
	policy: [new URL("https://example.com/security-policy")],
	hiring: [],
	extensions: {},
};

declare function findProfile(resource: string): Promise<Jrd | null>;

let router = createRouter({
	middleware: [
		wellKnown({
			"security.txt": serve(securityTxt, () => SECURITY_TXT, {
				transform: cleartextSigner({ key: () => env.SECURITY_TXT_SIGNING_KEY }),
			}),
			webfinger: async (ctx) => {
				let query = readQuery(ctx.url);
				if (isFailure(query)) return new Response(query.error.message, { status: 400 });
				return serve(webFinger, async () => {
					let profile = await findProfile(query.data.resource);
					return profile === null ? null : select(profile, query.data.rels);
				})(ctx);
			},
			"change-password": () => redirect("/account/password"),
		}),
	],
});

let inThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
isExpired(SECURITY_TXT, inThirtyDays); // assert false in a test
```

Keep `expires` a literal date and assert in a test that it is more than 30 days away: a date
computed from the clock keeps the file fresh while its contact goes stale. A `null` profile falls
through to your 404.

## Pattern: OpenID Connect Discovery With Its Key Set

```typescript
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { jwks } from "@sdxc/well-known/jwks";
import type { Jwk } from "@sdxc/well-known/jwks";
import { define, openIdConfiguration } from "@sdxc/well-known/openid-configuration";
import { respond } from "@sdxc/well-known/response";
import { createRouter } from "remix/router";

let issuer = "https://auth.example.com";

let discovery = define({
	issuer,
	authorizationEndpoint: new URL("/authorize", issuer),
	tokenEndpoint: new URL("/token", issuer),
	jwksUri: new URL("/.well-known/jwks.json", issuer),
	responseTypesSupported: ["code"],
	subjectTypesSupported: ["public"],
	idTokenSigningAlgValuesSupported: ["ES256"],
	codeChallengeMethodsSupported: ["S256"],
});

declare function signingKeys(): Promise<Jwk[]>;

let router = createRouter({
	middleware: [
		wellKnown({
			"openid-configuration": serve(openIdConfiguration, () => discovery),
			"jwks.json": serve(jwks, async () => ({ keys: await signingKeys() })),
		}),
	],
});

// an issuer with a path serves discovery after it, from its own route
router.get("/tenant/.well-known/openid-configuration", (ctx) =>
	respond(openIdConfiguration, define({ ...discovery, issuer: `${issuer}/tenant` }), {
		request: ctx.request,
		cache: { visibility: "public", maxAge: "5 minutes" },
	}),
);
```

`signingKeys()` may answer private JWKs: the `jwks` descriptor serves each key's public half and
leaves symmetric keys out. Call `stringify` from `./jwks` instead when a private member should be
reported as an error.

## Pattern: Protected Resource Metadata For A Bearer-Token API

```typescript
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import {
	define,
	metadataUrl,
	protectedResourceMetadata,
} from "@sdxc/well-known/oauth-protected-resource";

let api = define({
	resource: new URL("https://api.example.com/v1"),
	authorizationServers: [new URL("https://auth.example.com")],
	scopesSupported: ["read", "write"],
	resourceName: { value: "Example API", translations: { es: "API de ejemplo" } },
});

let middleware = wellKnown({
	"oauth-protected-resource": serve(protectedResourceMetadata, () => api),
});

function unauthorized() {
	return new Response(null, {
		status: 401,
		headers: {
			"WWW-Authenticate": `Bearer resource_metadata="${metadataUrl(api.resource)}"`,
		},
	});
}
```

The document is served at `/.well-known/oauth-protected-resource/v1`, which `wellKnown` matches
because the format inserts its suffix before the resource's path.

## Pattern: Discovering An Authorization Server From A Resource

A client handed only an API URL follows the resource's metadata to its authorization server,
checking each document names the identifier it was fetched for.

```typescript
import { isFailure } from "@sdxc/result";
import { wellKnownUrl } from "@sdxc/well-known";
import * as authorizationServer from "@sdxc/well-known/oauth-authorization-server";
import * as protectedResource from "@sdxc/well-known/oauth-protected-resource";
import * as s from "remix/data-schema";

let resource = "https://api.example.com/v1/items";

let resourceResponse = await fetch(protectedResource.metadataUrl("https://api.example.com/v1"));
let api = protectedResource.parse(await resourceResponse.text(), { resource, match: "prefix" });
if (isFailure(api)) throw api.error;

let issuer = api.data.authorizationServers[0];
if (issuer === undefined) throw new Error("The API names no authorization server");

let serverResponse = await fetch(wellKnownUrl(issuer, "oauth-authorization-server"));
let server = authorizationServer.parse(await serverResponse.text(), {
	issuer,
	extensions: s.object({ userinfo_endpoint: s.optional(s.string()) }),
});
if (isFailure(server)) throw server.error;

server.data.tokenEndpoint; // URL | null
server.data.extensions.userinfo_endpoint; // string | undefined
```

## Pattern: Importing A Fetched Key Set

```typescript
import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/well-known/jwks";

let response = await fetch("https://auth.example.com/.well-known/jwks.json");
let set = parse(await response.text());
if (isFailure(set)) throw set.error;

let keys = new Map<string, CryptoKey>();
for (let key of set.data.keys) {
	if (key.kty !== "EC" || key.kid === undefined) continue;
	let algorithm = { name: "ECDSA", namedCurve: key.crv ?? "P-256" };
	keys.set(key.kid, await crypto.subtle.importKey("jwk", key, algorithm, false, ["verify"]));
}
```

A malformed entry is dropped and counted in `set.data.skipped`, so one bad key leaves the others
usable.

## Pattern: Advertising A Server Through NodeInfo

```typescript
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { NODEINFO_2_1, nodeInfo, nodeInfoLinks } from "@sdxc/well-known/nodeinfo";
import { respond } from "@sdxc/well-known/response";
import { createRouter } from "remix/router";

declare function countUsers(): Promise<number>;

let router = createRouter({
	middleware: [
		wellKnown({
			nodeinfo: serve(nodeInfoLinks, () => ({
				links: [{ rel: NODEINFO_2_1, href: "https://example.com/nodeinfo/2.1" }],
			})),
		}),
	],
});

router.get("/nodeinfo/2.1", async (ctx) =>
	respond(
		nodeInfo,
		{
			version: "2.1",
			software: { name: "example", version: "1.0.0", repository: null, homepage: null },
			protocols: ["activitypub"],
			services: { inbound: [], outbound: ["rss2.0"] },
			openRegistrations: false,
			usage: {
				users: { total: await countUsers(), activeMonth: null, activeHalfyear: null },
				localPosts: null,
				localComments: null,
			},
			metadata: {},
		},
		{ request: ctx.request },
	),
);
```

The links document lives under `/.well-known/`; the document it points to is an ordinary route,
answered through `respond`.

## Pattern: Passkey Endpoints For Password Managers

```typescript
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { passkeyEndpoints } from "@sdxc/well-known/passkey-endpoints";

let middleware = wellKnown({
	"passkey-endpoints": serve(passkeyEndpoints, () => ({
		enroll: new URL("https://example.com/account/passkeys/new"),
		manage: new URL("https://example.com/account/passkeys"),
		prfUsageDetails: null,
	})),
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/well-known": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
