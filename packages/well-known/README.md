# @sdxc/well-known

Typed documents for well-known URIs: security.txt, WebFinger, OAuth and OIDC metadata, JWKS and more.

## Installation

```bash
npm add @sdxc/well-known
```

Readers return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values, which
install alongside this package. `./response` and `./middleware` also need
[`@sdxc/http`](https://www.npmjs.com/package/@sdxc/http) and
[`remix`](https://www.npmjs.com/package/remix), optional peer dependencies you add when you
serve documents; the document subpaths work without them.

[RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) reserves `/.well-known/` for documents a
client finds on any origin without being told where to look. Each registered name is one
subpath, with camelCase fields and `URL` values; the specification's member names appear only
in the serialized text. Every reader returns a `Result` whose failure, `WellKnownParseError`,
lists every issue with a JSON Pointer (or a line number for security.txt).

## Usage

### Serve security.txt And WebFinger From A Router

```typescript
import { isFailure } from "@sdxc/result";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { securityTxt } from "@sdxc/well-known/security-txt";
import { readQuery, select, webFinger } from "@sdxc/well-known/webfinger";
import type { SecurityTxt } from "@sdxc/well-known/security-txt";
import { createRouter } from "remix/router";

const SECURITY_TXT: SecurityTxt = {
	contact: [new URL("mailto:security@example.com")],
	expires: new Date("2027-06-30T00:00:00Z"),
	encryption: [],
	acknowledgments: [],
	preferredLanguages: ["en"],
	canonical: [new URL("https://example.com/.well-known/security.txt")],
	policy: [],
	hiring: [],
	extensions: {},
};

let router = createRouter({
	middleware: [
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

### Publish OpenID Connect Discovery From An Action

```typescript
import { define, openIdConfiguration } from "@sdxc/well-known/openid-configuration";
import { respond } from "@sdxc/well-known/response";
import { createAction } from "remix/router";

const DISCOVERY = define({
	issuer: "https://auth.example.com",
	authorizationEndpoint: new URL("https://auth.example.com/authorize"),
	jwksUri: new URL("https://auth.example.com/.well-known/jwks.json"),
	responseTypesSupported: ["code"],
	subjectTypesSupported: ["public"],
	idTokenSigningAlgValuesSupported: ["ES256"],
});

export default createAction(routes.discovery, (ctx) =>
	respond(openIdConfiguration, DISCOVERY, { request: ctx.request }),
);
```

### Read A Provider's Metadata

```typescript
import { isFailure } from "@sdxc/result";
import { wellKnownUrl } from "@sdxc/well-known";
import { parse } from "@sdxc/well-known/oauth-authorization-server";

let issuer = "https://auth.example.com";
let url = wellKnownUrl(issuer, "oauth-authorization-server");
let metadata = parse(await (await fetch(url)).text(), { issuer });
if (isFailure(metadata)) return metadata;
metadata.data.tokenEndpoint; // URL | null
```

## API

### `@sdxc/well-known`

#### `wellKnownUrl(identifier, name, placement = "insert")`

The URL a document is served at for an identifier. `"insert"` (RFC 8414, RFC 9728) puts the
suffix between the host and the path, keeping the query; `"append"` (OIDC Discovery) adds it
after the path.

```typescript
wellKnownUrl("https://as.example/tenant", "oauth-authorization-server");
// https://as.example/.well-known/oauth-authorization-server/tenant
wellKnownUrl("https://op.example/tenant", "openid-configuration", "append");
// https://op.example/tenant/.well-known/openid-configuration
```

#### `WellKnownParseError`

The failure every reader returns: `format` (the registered name) and `issues`, each with `at`
(a JSON Pointer, `""` for the whole document; or a 1-based line number, `0` for the whole
file) and `message`.

#### `WellKnownFormat<Document>` and `WellKnownPlacement`

The descriptor each document subpath exports: `name`, `mediaType`, `placement`, `cors`,
`stringify` and `parse`. `respond` and `serve` take one.

### Every Document Subpath

Each exports `NAME`, `MEDIA_TYPE`, `parse(text)` returning a `Result`, `stringify(document)`
and a descriptor. The descriptor's `parse` reads structure only; a client reading a fetched
discovery document calls the subpath's `parse` with the identifier it expected.

### `@sdxc/well-known/security-txt` (RFC 9116)

- `SecurityTxt` has `contact` (at least one), `expires`, `encryption`, `acknowledgments`,
  `preferredLanguages`, `canonical`, `policy`, `hiring`, and `extensions` for other fields,
  keyed by lowercased name.
- `parse(text)` returns a `ParsedSecurityTxt`, with `signed` set when the text arrived inside
  an OpenPGP cleartext signature (read from its signed body; the signature is left
  unverified). It fails on a missing `Contact`, a missing or repeated `Expires`, a repeated
  `Preferred-Languages`, an `http` URI, and a line that is neither a field, a comment nor
  blank. An expired file parses.
- `stringify(document, options?)` writes unsigned text with LF endings; `StringifyOptions`
  takes `comments` to write at the top.
- `isExpired(document, now?)` answers staleness (§2.5.5).
- `securityTxt` is the descriptor.

### `@sdxc/well-known/webfinger` (RFC 7033)

- `Jrd` and `JrdLink` are the descriptor and its links; absent members read as `null`, `[]`
  or `{}`.
- `readQuery(url)` returns a `WebFingerQuery` (`{ resource, rels }`), or a
  `MissingResourceError` to answer with a 400.
- `select(document, rels)` keeps only the links whose `rel` was asked for; an empty list keeps
  them all.
- `webFinger` is the descriptor, with `cors: true` as §5 requires.

### `@sdxc/well-known/oauth-authorization-server` (RFC 8414)

- `AuthorizationServerMetadata<Extensions>` has every §2 member plus RFC 8628, RFC 9126,
  RFC 9207 and RFC 9728 §4 members. `issuer` is a string, compared as published.
- `parse(text, options?)` takes `ParseOptions` (`issuer`, `extensions`) and fails on a missing
  `issuer` or `response_types_supported`, a malformed member, or a different issuer (§3.3).
  Unknown members land in `extensions`, validated by a synchronous
  [Standard Schema](https://standardschema.dev/) when one is given.
- `define(document)` defaults lists to `[]`, URLs to `null` and flags to `false`.
- `stringify(document)` leaves out `null` members, empty lists and flags at their default; the
  standard member wins over an extension of the same name.
- `authorizationServerMetadata` is the descriptor.

### `@sdxc/well-known/openid-configuration` (OpenID Connect Discovery 1.0)

`OpenIdProviderMetadata` extends the RFC 8414 document with the §3 members, and makes
`authorizationEndpoint` and `jwksUri` required. `parse`, `define`, `stringify` and
`ParseOptions` work as above; `requestUriParameterSupported` defaults to `true`, as §3 states.
`openIdConfiguration` is the descriptor, with `placement: "append"`.

### `@sdxc/well-known/oauth-protected-resource` (RFC 9728)

- `ProtectedResourceMetadata<Extensions>` has every §2 member; `resourceName` is a
  `LocalizedString` (`value` plus `#`-tagged `translations`), and `BearerMethod` is
  `"header" | "body" | "query"`.
- `parse(text, options)` requires `ParseOptions.resource`: the document's `resource` must
  equal it, or with `match: "prefix"` be a same-origin, segment-aligned prefix of it (§3.3).
- `define(document)` defaults `bearerMethodsSupported` to `["header"]`.
- `metadataUrl(resource)` inserts the suffix before the resource's path.
- `protectedResourceMetadata` is the descriptor.

### `@sdxc/well-known/jwks` (RFC 7517 §5)

- `Jwk` keeps the registered member names Web Crypto imports; `JwkSet` is `{ keys }`.
- `parse(text)` returns a `ParsedJwkSet`, dropping entries that are not objects, lack `kty`,
  or lack a member their `EC`, `RSA`, `OKP` or `oct` key type requires, and counting them in
  `skipped`.
- `stringify(document)` returns a `Result` and fails on any private member (`d`, `p`, `q`,
  `dp`, `dq`, `qi`, `oth`, `k`).
- `jwks` is the descriptor; serving through it publishes each key's public half and leaves
  symmetric keys out.

### `@sdxc/well-known/change-password` (W3C)

`redirect(target)` is a 302 to the page where a signed-in person changes their password.
`NAME` is `"change-password"`.

### `@sdxc/well-known/passkey-endpoints` (W3C)

`PasskeyEndpoints` has `enroll`, `manage` and `prfUsageDetails`, each `URL | null`; an empty
object is a valid document. `passkeyEndpoints` is the descriptor.

### `@sdxc/well-known/response`

#### `respond(format, document, options?)`

A `Promise<Response>` with the document's media type, a `Cache-Control` (default
`public, max-age=3600`), an `ETag` over the body, CORS for a CORS format, a 304 when
`options.request`'s `If-None-Match` still matches, and an empty body for `HEAD`.
`RespondOptions` takes `request`, `cache` and `headers`, which apply last.

### `@sdxc/well-known/middleware`

#### `serve(format, produce, options?)`

A `WellKnownEntry` answering with `produce(ctx)`'s document through `respond`; a `null`
document falls through to the next middleware.

#### `wellKnown(entries)`

Answers `GET` and `HEAD` on `/.well-known/<name>` for the names given (and on
`/.well-known/<name>/<path>` for a `serve`d format that inserts its suffix), `OPTIONS` for a
CORS format, and 405 with `Allow` for other methods. Every other path goes to `next()`, so a
name of your own stays an ordinary route. An entry is any `(ctx) => Response | null`.

## Pattern: Metadata For An API Accepting Bearer Tokens

```typescript
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import {
	define,
	metadataUrl,
	protectedResourceMetadata,
} from "@sdxc/well-known/oauth-protected-resource";

const API_METADATA = define({
	resource: new URL("https://api.example.com/v1"),
	authorizationServers: [new URL("https://auth.example.com")],
	scopesSupported: ["read", "write"],
});

let middleware = wellKnown({
	"oauth-protected-resource": serve(protectedResourceMetadata, () => API_METADATA),
});

let challenge = `Bearer resource_metadata="${metadataUrl(API_METADATA.resource)}"`;
```

## Pattern: A Change-Password Redirect Beside Documents

```typescript
import { redirect } from "@sdxc/well-known/change-password";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { securityTxt } from "@sdxc/well-known/security-txt";

let middleware = wellKnown({
	"security.txt": serve(securityTxt, () => SECURITY_TXT),
	"change-password": () => redirect("/account/password"),
});
```

Give security.txt a literal `expires` date and a test that fails when it is under 30 days
away; a date computed from the clock keeps the file fresh while its contact goes stale.

## Pattern: Importing A Fetched Key Set

```typescript
import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/well-known/jwks";

let response = await fetch("https://auth.example.com/.well-known/jwks.json");
let set = parse(await response.text());
if (isFailure(set)) return set;

let algorithm = { name: "ECDSA", namedCurve: "P-256" };
for (let key of set.data.keys) {
	await crypto.subtle.importKey("jwk", key, algorithm, false, ["verify"]);
}
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
