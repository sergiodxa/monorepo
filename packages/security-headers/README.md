# @sdxc/security-headers

Typed CSP, Permissions-Policy and security response headers, with middleware.

Write a document's `Content-Security-Policy`, `Strict-Transport-Security`, `Referrer-Policy`,
`Permissions-Policy`, cross-origin isolation headers and `X-Content-Type-Options` as one typed
object, review it in one place, and let the middleware send it with a per-response CSP nonce.
Serialization fails toward the stricter policy: a CSP source that would break out of its
directive is dropped, an emptied source list becomes `'none'`, and a Permissions-Policy origin
the header cannot carry denies its feature.

## Installation

```sh
npm add @sdxc/security-headers
```

The middleware runs on the [`remix`](https://www.npmjs.com/package/remix) router, and parsers
return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values.

## Usage

### Install the middleware

```typescript
import type { SecurityHeaders } from "@sdxc/security-headers";

import { securityHeaders } from "@sdxc/security-headers/middleware";
import { createRouter } from "remix/router";

let policy: SecurityHeaders.Policy = {
	contentSecurityPolicy: {
		defaultSrc: ["self"],
		scriptSrc: ["self", "nonce"],
		styleSrc: ["self", "unsafe-inline"],
		frameAncestors: ["none"],
	},
	strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
	referrerPolicy: "strict-origin-when-cross-origin",
	crossOriginOpenerPolicy: "same-origin",
	permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
};

let router = createRouter({ middleware: [securityHeaders(policy)] });
```

Keywords are written unquoted and quoted on output. An `https:` response that read the nonce is
sent with:

```text
content-security-policy: default-src 'self'; script-src 'self' 'nonce-3q2+7w…=='; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'
x-frame-options: DENY
strict-transport-security: max-age=63072000; includeSubDomains; preload
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=()
cross-origin-opener-policy: same-origin
x-content-type-options: nosniff
```

A header the response already set is kept as it is.

### Read the nonce in a handler

```tsx
import { createAction } from "remix/router";

import { routes } from "./routes.ts";

export default createAction(routes.checkout, {
	handler(ctx) {
		let nonce = ctx.securityHeaders.nonce;
		return ctx.render(
			<html lang="en">
				<body>
					<form method="post" action="/callback" />
					<script nonce={nonce}>{"document.forms[0].submit()"}</script>
				</body>
			</html>,
		);
	},
});
```

The nonce is generated on first read, and a response that never reads it has every `"nonce"`
source removed. Read it in the handler: the headers are written when the chain resolves, before
a streamed body renders.

### Write headers without the middleware

```typescript
import { apply } from "@sdxc/security-headers";
import { generateNonce } from "@sdxc/security-headers/csp";

let nonce = generateNonce();
let headers = new Headers({ "content-type": "text/html" });
apply(headers, policy, { url: new URL(request.url), nonce });
```

### Parse a header back

```typescript
import { unwrap } from "@sdxc/result";
import { parse } from "@sdxc/security-headers/csp";

let [csp] = unwrap(parse("default-src 'self'; frame-src https://challenges.example.com"));
csp?.directives.frameSrc; // ["https://challenges.example.com"]
```

## API

### `@sdxc/security-headers`

#### `entries(policy: SecurityHeaders.Policy, options: SecurityHeaders.ApplyOptions): Array<[name, value]>`

Every header the policy produces, with lowercase names in a stable order. HSTS is written only
when `options.url` is `https:`, `options.nonce` fills every `"nonce"` source in both CSP headers,
and `nosniff` is written unless `noSniff` is `false`. `X-Frame-Options` comes from the enforced
policy's `frameAncestors`: `DENY` for `["none"]` or `[]`, `SAMEORIGIN` for `["self"]`.

#### `apply(headers: Headers, policy: SecurityHeaders.Policy, options: SecurityHeaders.ApplyOptions): void`

Sets each entry the `Headers` does not already carry. When it already carries a
`Content-Security-Policy`, no `X-Frame-Options` is derived.

#### `override(policy: SecurityHeaders.Policy, patch: SecurityHeaders.Override): SecurityHeaders.Policy`

A patched copy: a field set to `null` is removed, a CSP patch is merged directive by directive
through `merge`, and any other value replaces the base's.

#### `stringifyStrictTransportSecurity(value: SecurityHeaders.StrictTransportSecurity): string`

Writes `max-age` in whole seconds, then `includeSubDomains`, then `preload` only when `maxAge`
is at least a year and `includeSubDomains` is set, as the preload lists require.

### `@sdxc/security-headers/csp`

#### `stringify(directives: CSP.Directives, options?: CSP.StringifyOptions): string`

Writes one policy in the object's directive order. Keywords, `nonce-…` and `sha256-…` sources
are quoted; hosts and schemes are written as-is. `"nonce"` becomes `'nonce-<options.nonce>'`, or
is dropped without one.

```typescript
stringify({ scriptSrc: ["self", "nonce"], objectSrc: [] }, { nonce: "cmFuZG9t" });
// "script-src 'self' 'nonce-cmFuZG9t'; object-src 'none'"
```

#### `parse(value: string): Result<CSP.Parsed[], CSPParseError>`

One `CSP.Parsed` per comma-joined policy, with names and keywords lowercased and unquoted. A
repeated directive keeps its first value; the repeat and any directive outside the model land
verbatim in `unknown`.

#### `merge(base: CSP.Directives, override: CSP.Override): CSP.Directives`

Replaces each directive the override names, removes those set to `null`, and keeps the base's
order.

#### `generateNonce(): string`

16 random bytes as padded base64.

#### `CSPParseError`

The failure of `parse` for a character outside printable ASCII or an invalid directive name;
`position` is the offset where parsing stopped.

### `@sdxc/security-headers/permissions-policy`

#### `stringify(policy: PermissionsPolicy.Policy): Result<string, StructuredFieldStringifyError>`

Writes `[]` as `()`, `"*"` as `*`, `self` and `src` as tokens and origins as strings. Feature
names keep their header spelling (`browsing-topics`).

```typescript
stringify({ camera: [], fullscreen: "*", geolocation: ["self", "https://maps.example.com"] });
// success('camera=(), fullscreen=*, geolocation=(self "https://maps.example.com")')
```

#### `parse(value: string): Result<PermissionsPolicy.Policy, StructuredFieldParseError>`

Reads a header back, dropping parameters and members that are neither tokens nor strings.

### `@sdxc/security-headers/reports`

#### `parseReports(request: Request): Promise<Result<CSPReport.Violation[], CSPReportParseError>>`

Reads a report POST sent as `application/reports+json` (other report types skipped),
`application/csp-report`, or either one labelled `application/json`. Empty strings in a report
become `null`.

#### `CSPReportParseError`

The failure for an unsupported media type, a body that is not JSON, or a legacy report naming no
directive.

### `@sdxc/security-headers/middleware`

#### `securityHeaders(policy: SecurityHeaders.Policy): Middleware`

Publishes `ctx.securityHeaders` and applies its policy to the response the chain returns, through
`apply`. A `101 Switching Protocols` response passes through untouched.

#### `securityHeadersOverride(patch: SecurityHeaders.Override): Middleware`

Route middleware that patches the policy for the routes it guards; it passes through when
`securityHeaders` is not installed.

#### `SecurityHeadersContext`

The `ctx.securityHeaders` value: `nonce` (generated on first read), `policy` (what the response
will be sent with) and `override(patch)` (patches this response's policy).

#### `SecurityHeadersKey`

The context key, for code that reads the state with `ctx.get`.

### Types

#### `SecurityHeaders.Policy`

| Field                                 | Header                                     |
| ------------------------------------- | ------------------------------------------ |
| `contentSecurityPolicy`               | `Content-Security-Policy`                  |
| `contentSecurityPolicyReportOnly`     | `Content-Security-Policy-Report-Only`      |
| `strictTransportSecurity`             | `Strict-Transport-Security`                |
| `referrerPolicy` (value or fallbacks) | `Referrer-Policy`                          |
| `permissionsPolicy`                   | `Permissions-Policy`                       |
| `crossOriginOpenerPolicy`             | `Cross-Origin-Opener-Policy`               |
| `crossOriginEmbedderPolicy`           | `Cross-Origin-Embedder-Policy`             |
| `crossOriginEmbedderPolicyReportOnly` | `Cross-Origin-Embedder-Policy-Report-Only` |
| `crossOriginResourcePolicy`           | `Cross-Origin-Resource-Policy`             |
| `noSniff` (default `true`)            | `X-Content-Type-Options`                   |
| `reportingEndpoints` (name to URL)    | `Reporting-Endpoints`                      |

#### `SecurityHeaders.*`

`Override` is `Policy` with every field nullable and the CSP fields taking a `CSP.Override`.
`ApplyOptions` is `{ url, nonce? }`, `StrictTransportSecurity` is
`{ maxAge, includeSubDomains?, preload? }` and `ReferrerPolicy` the policy tokens. The `CSP` and
`PermissionsPolicy` namespaces are re-exported from the main entry point too.

#### `CSP.*`

`Directives` holds source lists for the fetch directives (`defaultSrc`, `scriptSrc`,
`scriptSrcElem`, `scriptSrcAttr`, `styleSrc`, `styleSrcElem`, `styleSrcAttr`, `imgSrc`, `fontSrc`,
`connectSrc`, `mediaSrc`, `objectSrc`, `frameSrc`, `childSrc`, `workerSrc`, `manifestSrc`) and
for `baseUri`, `formAction` and `frameAncestors`; `sandbox` takes `true` or tokens, `reportTo` an
endpoint name, `reportUri` URLs, `upgradeInsecureRequests` `true`, `requireTrustedTypesFor`
`["script"]` and `trustedTypes` policy names. `Keyword`, `Source`, `SourceList`, `SandboxToken`,
`StringifyOptions`, `Override` and `Parsed` (`{ directives, unknown }`) type the rest.

#### `PermissionsPolicy.*`

`Policy` maps a feature name to an `Allowlist`: `[]`, `"*"`, or a list of `self`, `src` and
origins.

#### `CSPReport.Violation`

`documentURL`, `blockedURL`, `effectiveDirective`, `disposition`, `sample`, `sourceFile` and
`lineNumber`, read alike from both report formats.

## Pattern: The Managed Import Map

`remix/component` copies the nonce of the `<ImportMap>` script onto every import map its client
runtime appends later, so a document with client entries renders it with the nonce; without
it, a nonce-based `script-src` blocks the client-entry import map.

```tsx
import { ImportMap } from "remix/component/server";

<head>
	<ImportMap value={importMap} nonce={ctx.securityHeaders.nonce} />
</head>;
```

## Pattern: A Route That Must Be Framed

Loosen one route with `securityHeadersOverride`, or one response with
`ctx.securityHeaders.override`. The derived `X-Frame-Options` disappears with the `'none'` it
came from.

```typescript
import { securityHeadersOverride } from "@sdxc/security-headers/middleware";
import { createAction } from "remix/router";

import { routes } from "./routes.ts";

export default createAction(routes.embed, {
	middleware: [securityHeadersOverride({ contentSecurityPolicy: { frameAncestors: ["*"] } })],
	handler(ctx) {
		if (ctx.url.searchParams.has("download")) {
			ctx.securityHeaders.override({ contentSecurityPolicy: null });
		}
		return new Response("<p>Embedded</p>", { headers: { "content-type": "text/html" } });
	},
});
```

## Pattern: Report-Only Rollout And A Report Route

Ship new directives as Report-Only, collect violations, and move them to
`contentSecurityPolicy` once the reports are quiet.

```typescript
import type { SecurityHeaders } from "@sdxc/security-headers";

import { isFailure } from "@sdxc/result";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { parseReports } from "@sdxc/security-headers/reports";
import { createRouter } from "remix/router";

import { recordViolation, routes } from "./routes.ts";

let policy: SecurityHeaders.Policy = {
	contentSecurityPolicyReportOnly: {
		defaultSrc: ["self"],
		reportTo: "csp",
		reportUri: ["/reports/csp"],
	},
	reportingEndpoints: { csp: "/reports/csp" },
};

let router = createRouter({ middleware: [securityHeaders(policy)] });

router.post(routes.reports.csp, async (ctx) => {
	let reports = await parseReports(ctx.request);
	if (isFailure(reports)) return new Response(null, { status: 400 });
	for (let violation of reports.data) await recordViolation(violation);
	return new Response(null, { status: 204 });
});
```

`reportTo` reaches browsers with the Reporting API and `reportUri` the rest; `parseReports`
reads both formats.

## Pattern: A Variant Policy For Cached Pages

A cached HTML response replays its nonce to every visitor. Derive a policy without `"nonce"`
that allows fixed inline scripts by hash, and send it from the router behind the shared cache.

```typescript
import { override } from "@sdxc/security-headers";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { createRouter } from "remix/router";

import { policy } from "./policy.ts";

let cachedPolicy = override(policy, {
	contentSecurityPolicy: {
		scriptSrc: ["self", "sha256-B2yPHKaXnvFWtRChIbabYmUBFZdVfKKXHbWtWidDVF8="],
	},
});

let cachedRouter = createRouter({ middleware: [securityHeaders(cachedPolicy)] });
```

## Pattern: Asserting A Policy In A Test

```typescript
import { unwrap } from "@sdxc/result";
import { parse } from "@sdxc/security-headers/csp";
import { parse as parsePermissions } from "@sdxc/security-headers/permissions-policy";
import { expect, test } from "vitest";

import { router } from "./router.ts";

test("allows the challenge frame", async () => {
	let response = await router.fetch("https://example.com/");
	let [csp] = unwrap(parse(response.headers.get("content-security-policy") ?? ""));
	expect(csp?.directives.frameSrc).toEqual(["https://challenges.example.com"]);
	let permissions = unwrap(parsePermissions(response.headers.get("permissions-policy") ?? ""));
	expect(permissions.camera).toEqual([]);
});
```

## Pattern: Choosing Sources That Hold Up

- Keep `styleSrc: ["self", "unsafe-inline"]` and leave `"nonce"` out of `styleSrc`:
  `remix/component` emits one `<style>` per `css()` mixin without a nonce, and a nonce in
  `style-src` makes browsers ignore `'unsafe-inline'`.
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
