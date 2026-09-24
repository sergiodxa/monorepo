# @sdxc/well-known

Typed documents for well-known URIs: security.txt, WebFinger, OAuth and OIDC metadata, JWKS and more.

## Overview

[RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) reserves `/.well-known/` for documents a
client finds on any origin without being told where to look. This package reads and writes
the ones the repo serves or consumes, one subpath per registered name, with camelCase fields,
`URL` values, and the specification's member names appearing only in the serialized text.
Every reader returns a `Result` whose failure, `WellKnownParseError`, lists every issue with
a JSON Pointer (or a line number for security.txt).

The document subpaths import only `@sdxc/result`, `@remix-run/data-schema` and
`@standard-schema/spec`, so a client library without the `remix` umbrella can parse through
them. `./response` and `./middleware` turn a document into a `Response` and mount several
names on a router; they use `@sdxc/http` and `remix`, which are optional peer dependencies.

The package generates and parses content. Which names an app serves, and what goes in them,
stays the app's decision.

## Usage

### Serve security.txt and WebFinger from a router

```typescript
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { securityTxt } from "@sdxc/well-known/security-txt";
import { readQuery, select, webFinger } from "@sdxc/well-known/webfinger";

let router = createRouter({
	middleware: [
		log(logger),
		wellKnown({
			"security.txt": serve(securityTxt, () => SECURITY_TXT),
			webfinger: serve(webFinger, (ctx) => {
				let query = readQuery(ctx.url);
				if (isFailure(query)) return null;
				return select(profileFor(query.data.resource), query.data.rels);
			}),
		}),
	],
});
```

### Publish OpenID Connect discovery from an action

```typescript
import { define, openIdConfiguration } from "@sdxc/well-known/openid-configuration";
import { respond } from "@sdxc/well-known/response";

const WELL_KNOWN = define({
	issuer: "https://auth.example.com",
	authorizationEndpoint: new URL("https://auth.example.com/authorize"),
	jwksUri: new URL("https://auth.example.com/.well-known/jwks.json"),
	responseTypesSupported: ["code"],
	subjectTypesSupported: ["public"],
	idTokenSigningAlgValuesSupported: ["ES256"],
});

export default createAction(routes.openidConfiguration, (ctx) =>
	respond(openIdConfiguration, WELL_KNOWN, { request: ctx.request }),
);
```

### Read a provider's metadata

```typescript
import { wellKnownUrl } from "@sdxc/well-known";
import { parse } from "@sdxc/well-known/oauth-authorization-server";

let url = wellKnownUrl(issuer, "oauth-authorization-server");
let metadata = parse(await (await fetch(url)).text(), { issuer });
if (isFailure(metadata)) return metadata;
metadata.data.tokenEndpoint; // URL | null
```

## API

### `"."`

#### `wellKnownUrl(identifier, name, placement = "insert"): URL`

The URL a document is served at for an identifier. `"insert"` (RFC 8414, RFC 9728) puts the
suffix between the host and the path, keeping the query and dropping a terminating slash
after the host; `"append"` (OIDC Discovery) adds it after the path.

```typescript
wellKnownUrl("https://as.example/tenant", "oauth-authorization-server");
// https://as.example/.well-known/oauth-authorization-server/tenant
wellKnownUrl("https://op.example/tenant", "openid-configuration", "append");
// https://op.example/tenant/.well-known/openid-configuration
```

#### `WellKnownParseError`

The failure every reader returns: `format` (the registered name) and `issues`, each with
`at` (a JSON Pointer, `""` for the whole document; or a 1-based line number, `0` for the
whole file) and `message`.

#### `WellKnownFormat<Document>` and `WellKnownPlacement`

The descriptor each subpath exports: `name`, `mediaType`, `placement`, `cors`, `stringify`
and `parse`. `respond` and `serve` take one.

### Every document subpath

Each exports `NAME`, `MEDIA_TYPE`, `parse(text)` returning a `Result`, `stringify(document)`
and a descriptor. The descriptor's `parse` reads structure only; a client reading a fetched
discovery document calls the subpath's `parse` with the identifier it expected.

### `"./security-txt"` (RFC 9116)

- `SecurityTxt` has `contact` (at least one), `expires`, `encryption`, `acknowledgments`,
  `preferredLanguages`, `canonical`, `policy`, `hiring`, and `extensions` for other fields,
  keyed by lowercased name.
- `parse(text)` returns a `ParsedSecurityTxt` with `signed` set when the text arrived inside
  an OpenPGP cleartext signature, read from its signed body; the signature is not verified.
  It fails on a missing `Contact`, a missing or repeated `Expires`, a repeated
  `Preferred-Languages`, an `http` URI (or a non-`https` one for fields taking only web
  URIs), and a line that is neither a field, a comment nor blank. An expired file parses.
- `stringify(document, { comments })` writes unsigned text with LF endings.
- `isExpired(document, now?)` answers staleness (§2.5.5).
- `securityTxt` is the descriptor.

### `"./webfinger"` (RFC 7033)

- `Jrd` and `JrdLink` are the descriptor and its links; absent members read as `null`, `[]`
  or `{}`.
- `readQuery(url)` returns `{ resource, rels }`, or a `MissingResourceError` to answer with a 400.
- `select(document, rels)` keeps only the links whose `rel` was asked for; an empty list
  keeps them all.
- `webFinger` is the descriptor, with `cors: true` as §5 requires.

### `"./oauth-authorization-server"` (RFC 8414)

- `AuthorizationServerMetadata<Extensions>` has every §2 member plus RFC 8628, RFC 9126,
  RFC 9207 and RFC 9728 §4 members. `issuer` is a string, compared as published.
- `parse(text, { issuer?, extensions? })` fails on a missing `issuer` or
  `response_types_supported`, a malformed member, or a different issuer (§3.3, a URL issuer
  compared ignoring a trailing slash). Unknown members land in `extensions`, validated by a
  synchronous Standard Schema when one is given.
- `define(document)` defaults lists to `[]`, URLs to `null` and flags to `false`.
- `stringify(document)` leaves out `null` members, empty lists and flags at their default;
  an extension member with a registered name is dropped rather than replacing the standard one.
- `authorizationServerMetadata` is the descriptor.

### `"./openid-configuration"` (OpenID Connect Discovery 1.0)

`OpenIdProviderMetadata` extends the RFC 8414 document with the §3 members, and makes
`authorizationEndpoint` and `jwksUri` required. `parse`, `define` and `stringify` work as
above; `requestUriParameterSupported` defaults to `true`, as §3 states. `parse` accepts a
provider lacking `RS256`. `openIdConfiguration` is the descriptor, with `placement: "append"`.

### `"./oauth-protected-resource"` (RFC 9728)

- `ProtectedResourceMetadata<Extensions>` has every §2 member; `resourceName` is a
  `LocalizedString` (`value` plus `#`-tagged `translations`).
- `parse(text, { resource, match?, extensions? })` requires the expected resource: the
  document's `resource` must equal it, or with `match: "prefix"` be a same-origin,
  segment-aligned prefix of it (§3.3).
- `define(document)` defaults `bearerMethodsSupported` to `["header"]`.
- `metadataUrl(resource)` inserts the suffix before the resource's path.
- `protectedResourceMetadata` is the descriptor.

### `"./jwks"` (RFC 7517 §5)

- `Jwk` keeps the registered member names Web Crypto imports; `JwkSet` is `{ keys }`.
- `parse(text)` drops entries that are not objects, lack `kty`, or lack a member their `EC`,
  `RSA`, `OKP` or `oct` key type requires, and counts them in `skipped`.
- `stringify(document)` returns a `Result` and fails on any private member (`d`, `p`, `q`,
  `dp`, `dq`, `qi`, `oth`, `k`).
- `jwks` is the descriptor; serving through it publishes each key's public half and leaves
  symmetric keys out.

### `"./change-password"` (W3C)

`redirect(target)` is a 302 to the page where a signed-in person changes their password.

### `"./passkey-endpoints"` (W3C)

`PasskeyEndpoints` has `enroll`, `manage` and `prfUsageDetails`, each `URL | null`; an empty
object is a valid document. `passkeyEndpoints` is the descriptor.

### `"./response"`

#### `respond(format, document, { request?, cache?, headers? }): Promise<Response>`

The document with its media type, a `Cache-Control` (default `public, max-age=3600`), an
`ETag` over the body, CORS for a CORS format, a 304 when `request`'s `If-None-Match` still
matches, and an empty body for `HEAD`. `headers` apply last.

### `"./middleware"`

#### `serve(format, produce, options?): WellKnownEntry`

An entry answering with `produce(ctx)`'s document through `respond`; `null` falls through.

#### `wellKnown(entries): Middleware`

Answers `GET` and `HEAD` on `/.well-known/<name>` for the names given (and on
`/.well-known/<name>/<path>` for a `serve`d format that inserts its suffix), `OPTIONS` for a
CORS format, and 405 with `Allow` for other methods. Every other path goes to `next()`, so
an app-specific name stays an ordinary route.

## Patterns

### Metadata for an API accepting bearer tokens

```typescript
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import {
	define,
	metadataUrl,
	protectedResourceMetadata,
} from "@sdxc/well-known/oauth-protected-resource";

const API_METADATA = define({
	resource: new URL("/api/v1", ORIGIN),
	authorizationServers: [new URL(AUTH_ORIGIN)],
	scopesSupported: ["read", "write"],
});

wellKnown({ "oauth-protected-resource": serve(protectedResourceMetadata, () => API_METADATA) });

let challenge = `Bearer resource_metadata="${metadataUrl(API_METADATA.resource)}"`;
```

### A change-password redirect beside documents

```typescript
import { redirect } from "@sdxc/well-known/change-password";

wellKnown({
	"security.txt": serve(securityTxt, () => SECURITY_TXT),
	"change-password": () => redirect("/account/password"),
});
```

### Reading a key set

```typescript
import { parse } from "@sdxc/well-known/jwks";

let set = parse(await response.text());
if (isFailure(set)) return set;
for (let key of set.data.keys)
	await crypto.subtle.importKey("jwk", key, algorithm, false, ["verify"]);
```

## Related Packages

- [`@sdxc/http`](../http/README.md) - the cache policy, `ETag` and conditional-request helpers `respond` uses
- [`@sdxc/auth`](../auth/README.md) - the client that fetches and trusts discovery documents
- [`@sdxc/jwt`](../jwt/README.md) - key generation and signing; `JWK.toJSON` produces a `JwkSet`
- [`@sdxc/result`](../result/README.md) - the `Result` every reader returns

## Tips

- Give security.txt a literal `expires` date and a test that fails when it is under 30 days
  away; a date computed from the clock keeps the file fresh while its contact goes stale.
- Pass `request` to `respond` so clients holding a current copy get a 304.
- Always call a discovery document's `parse` with the identifier you fetched it for; the
  descriptors' `parse` reads structure only.
