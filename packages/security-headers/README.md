# @sdxc/security-headers

Typed Permissions-Policy and security response headers, with CSP helpers for Remix.

Write a document's `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`,
cross-origin isolation headers and `X-Content-Type-Options` as one typed object, and let the
middleware send them on every response. Content-Security-Policy and its per-request nonce come
from Remix's [`csp()`](https://www.npmjs.com/package/remix) middleware; this package still
parses and stringifies CSP for audits, the CLI, and `remixCsp()` factories.

## Installation

```sh
npm add @sdxc/security-headers
```

The middleware runs on the [`remix`](https://www.npmjs.com/package/remix) router (3.2+ for
`csp()`), and parsers return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result)
values.

## Usage

### Install Remix CSP and this middleware

```typescript
import type { CSP, SecurityHeaders } from "@sdxc/security-headers";

import { remixCsp } from "@sdxc/security-headers/remix";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { csp, getCspNonce } from "remix/middleware/csp";
import { createRouter } from "remix/router";

let contentSecurityPolicy: CSP.Directives = {
	defaultSrc: ["self"],
	scriptSrc: ["self", "nonce"],
	styleSrc: ["self", "unsafe-inline"],
	frameAncestors: ["none"],
};

let policy: SecurityHeaders.Policy = {
	strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
	referrerPolicy: "strict-origin-when-cross-origin",
	crossOriginOpenerPolicy: "same-origin",
	xFrameOptions: "DENY",
	permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
};

let router = createRouter({
	middleware: [
		csp({
			policy: ({ nonce }) => remixCsp(contentSecurityPolicy, nonce),
		}),
		securityHeaders(policy),
	],
});
```

`remixCsp` quotes keywords and substitutes the request nonce. An `https:` HTML response is sent
with Remix's CSP plus:

```text
x-frame-options: DENY
strict-transport-security: max-age=63072000; includeSubDomains; preload
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=()
cross-origin-opener-policy: same-origin
x-content-type-options: nosniff
```

A header the response already set is kept as it is.

### Hand the nonce to the document

With `@sdxc/assets-middleware`, `assets()` reads the nonce through its `nonce` option from
Remix's `getCspNonce`:

```typescript
import { getCspNonce } from "remix/middleware/csp";

createRouter({
	middleware: [
		csp({ policy: ({ nonce }) => remixCsp(CONTENT_SECURITY_POLICY, nonce) }),
		securityHeaders(SECURITY_POLICY),
		assets(assetResolver, {
			stylesheets: "resources/layouts/document.tsx",
			script: "bootstrap/browser.ts",
			nonce: (ctx) => getCspNonce(ctx),
		}),
		render({ assets: assetResolver }),
	],
});
```

### Patch CSP after Remix serialized it

Remix builds the CSP header before handlers run. For a route that must change directives after
that (an import-map hash, a front-channel logout `frame-src`), install `cspPatch()` before
`csp()` and call `patchCsp`:

```typescript
import { cspPatch, patchCsp } from "@sdxc/security-headers/csp-patch";

createRouter({
	middleware: [
		cspPatch(),
		csp({ reportOnlyPolicy: ({ nonce }) => remixCsp(CONTENT_SECURITY_POLICY, nonce) }),
		securityHeaders(SECURITY_POLICY),
	],
});

// in a handler:
patchCsp(ctx, { reportOnlyPolicy: { frameSrc: ["https://rp.example"] } });
```

### Write headers without the middleware

```typescript
import { apply } from "@sdxc/security-headers";

let headers = new Headers({ "content-type": "text/html" });
apply(headers, policy, { url: new URL(request.url) });
```

### Parse a CSP header back

```typescript
import { unwrap } from "@sdxc/result";
import { parse } from "@sdxc/security-headers/csp";

let [csp] = unwrap(parse("default-src 'self'; frame-src https://challenges.example.com"));
csp?.directives.frameSrc; // ["https://challenges.example.com"]
```

## Command line

```sh
bunx @sdxc/security-headers --help
```

With [`@sdxc/kit`](https://www.npmjs.com/package/@sdxc/kit) installed, `sdxc pkg security-headers …`
runs the same command line, using the version your project installs.

```sh
bunx @sdxc/security-headers audit https://example.com --json
bunx @sdxc/security-headers csp parse "default-src 'self'; script-src 'self' 'nonce-abc'" --json
```

## API

### `@sdxc/security-headers`

#### `entries(policy, options): Array<[name, value]>`

Every header the policy produces, with lowercase names in a stable order. HSTS is written only
when `options.url` is `https:`, and `nosniff` unless `noSniff` is `false`.

#### `apply(headers, policy, options): void`

Sets each entry the `Headers` does not already carry.

#### `override(policy, patch): SecurityHeaders.Policy`

A patched copy: a field set to `null` is removed, any other value replaces the base's.

#### `stringifyStrictTransportSecurity(value): string`

Writes `max-age` in whole seconds, then `includeSubDomains`, then `preload` only when `maxAge`
is at least a year and `includeSubDomains` is set.

### `@sdxc/security-headers/csp`

#### `stringify(directives, options?): string`

Writes one policy. Keywords and hashes are quoted; `"nonce"` becomes `'nonce-<options.nonce>'`.

#### `parse(value): Result<CSP.Parsed[], CSPParseError>`

One `CSP.Parsed` per comma-joined policy.

#### `merge(base, override): CSP.Directives`

Replaces each directive the override names, removes those set to `null`.

#### `generateNonce(): string`

16 random bytes as padded base64. Prefer Remix's `csp()` nonce for documents.

### `@sdxc/security-headers/remix`

#### `remixCsp(directives, nonce): RemixCspDirectives`

Quotes keywords and substitutes `"nonce"` for a Remix `csp()` policy factory return value.

### `@sdxc/security-headers/csp-patch`

#### `cspPatch(): Middleware`

Rewrites Remix CSP headers using every `patchCsp` call. Install before `csp()`.

#### `patchCsp(ctx, patch): void`

Queues a merge into `Content-Security-Policy` and/or `Content-Security-Policy-Report-Only`, or
`null` to remove that header.

### `@sdxc/security-headers/permissions-policy`

#### `stringify` / `parse`

Permissions-Policy as an RFC 9651 dictionary.

### `@sdxc/security-headers/reports`

#### `parseReports(request): Promise<Result<CSPReport.Violation[], CSPReportParseError>>`

Reads a CSP report POST (`application/reports+json`, `application/csp-report`, or JSON).

### `@sdxc/security-headers/audit`

#### `audit(headers, url): Audit.Finding[]`

Grades CSP, HSTS, nosniff, framing, Referrer-Policy, Permissions-Policy and COOP on a response.

### `@sdxc/security-headers/middleware`

#### `securityHeaders(policy): Middleware`

Publishes `ctx.securityHeaders` and applies the non-CSP policy to the response.

#### `securityHeadersOverride(patch): Middleware`

Route middleware that patches the non-CSP policy for the routes it guards.

### Types

#### `SecurityHeaders.Policy`

| Field                                 | Header                                     |
| ------------------------------------- | ------------------------------------------ |
| `strictTransportSecurity`             | `Strict-Transport-Security`                |
| `referrerPolicy` (value or fallbacks) | `Referrer-Policy`                          |
| `permissionsPolicy`                   | `Permissions-Policy`                       |
| `crossOriginOpenerPolicy`             | `Cross-Origin-Opener-Policy`               |
| `crossOriginEmbedderPolicy`           | `Cross-Origin-Embedder-Policy`             |
| `crossOriginEmbedderPolicyReportOnly` | `Cross-Origin-Embedder-Policy-Report-Only` |
| `crossOriginResourcePolicy`           | `Cross-Origin-Resource-Policy`             |
| `xFrameOptions`                       | `X-Frame-Options`                          |
| `noSniff` (default `true`)            | `X-Content-Type-Options`                   |

## Pattern: Choosing Sources That Hold Up

- With Remix `csp()`, a nonce-based `style-src` is viable because `render()` stamps the nonce onto
  `css()` styles. With only this package's helpers and no Remix CSP, keep
  `styleSrc: ["self", "unsafe-inline"]`.
- `'strict-dynamic'` makes browsers ignore `'self'` and host sources, so every `<script src>`
  needs the nonce too; adopt it deliberately.

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
		"@sdxc/security-headers": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
