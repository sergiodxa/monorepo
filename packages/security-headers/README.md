# @sdxc/security-headers

Typed Content-Security-Policy, Permissions-Policy and response security headers, with middleware.

## Overview

A browser enforces a set of response headers describing what a document may do: where its
scripts, styles, images and frames come from (`Content-Security-Policy`), whether it is reached
only over HTTPS (`Strict-Transport-Security`), how much of its URL leaks in a `Referer`
(`Referrer-Policy`), which device APIs it may ask for (`Permissions-Policy`), whether it shares
a browsing-context group or resources with other origins (COOP, COEP, CORP), and whether a
response's type may be sniffed (`X-Content-Type-Options`). This package models each of them as
a typed object an app writes once and reviews in one place.

The CSP model writes keywords unquoted and quotes them on output, so a missing quote is
impossible, and a `"nonce"` source is replaced by a per-response nonce the middleware generates
on first read. The Permissions-Policy and `Reporting-Endpoints` go through the RFC 9651
serializer in `@sdxc/structured-fields`. `X-Frame-Options` is derived from `frameAncestors`, so
the two can never disagree.

Serialization fails toward the stricter policy: a CSP source that would break out of its
directive is dropped, a source list left empty is written as `'none'`, a Permissions-Policy
origin RFC 9651 cannot carry denies its feature, and HSTS `preload` is written only when the
preload lists would accept it.

## Usage

```typescript
import type { SecurityHeaders } from "@sdxc/security-headers";

import { securityHeaders } from "@sdxc/security-headers/middleware";
import { createRouter } from "remix/router";

const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicy: {
		defaultSrc: ["self"],
		scriptSrc: ["self", "nonce"],
		styleSrc: ["self", "unsafe-inline"],
		frameAncestors: ["none"],
		reportTo: "csp",
	},
	reportingEndpoints: { csp: "/reports/csp" },
	strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
	referrerPolicy: "strict-origin-when-cross-origin",
	crossOriginOpenerPolicy: "same-origin",
	permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
};

let router = createRouter({
	middleware: [securityHeaders(SECURITY_POLICY), renderWith(render)],
});
```

A response to `https://example.com/` that read `ctx.securityHeaders.nonce` is sent with:

```text
content-security-policy: default-src 'self'; script-src 'self' 'nonce-3q2+7w…=='; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; report-to csp
x-frame-options: DENY
strict-transport-security: max-age=63072000; includeSubDomains; preload
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=()
cross-origin-opener-policy: same-origin
reporting-endpoints: csp="/reports/csp"
x-content-type-options: nosniff
```

A response that never read the nonce is sent with `script-src 'self'`.

## API

### `@sdxc/security-headers`

#### `entries(policy, options): Array<[name, value]>`

Every header the policy produces, lowercase names in a stable order. `options.url` gates HSTS
(written only for `https:`), and `options.nonce` is substituted for every `"nonce"` source in
both CSP headers. `x-content-type-options: nosniff` is written unless `noSniff` is `false`.
`X-Frame-Options` is `DENY` for `frameAncestors: ["none"]` (or `[]`), `SAMEORIGIN` for
`["self"]`, and left out otherwise; the Report-Only policy derives nothing.

#### `apply(headers, policy, options): void`

Writes each entry the `Headers` does not already carry, so a route's own value wins. When the
response set its own `Content-Security-Policy`, no `X-Frame-Options` is derived.

#### `override(policy, patch): SecurityHeaders.Policy`

Returns a patched copy: a header set to `null` is removed, a CSP patch is merged directive by
directive through `merge`, and any other value replaces the base's.

#### `stringifyStrictTransportSecurity(value): string`

Writes `max-age` as whole, non-negative seconds, then `includeSubDomains`, then `preload` only
when `maxAge` is at least a year and `includeSubDomains` is set.

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
| `reportingEndpoints`                  | `Reporting-Endpoints`                      |

`SecurityHeaders.Override` is the same shape with every field nullable and the CSP fields
taking a `CSP.Override`.

### `@sdxc/security-headers/csp`

#### `stringify(directives, options?): string`

Writes one policy in the order the object lists its directives. Keywords (`self`, `none`,
`unsafe-inline`, `strict-dynamic`, `wasm-unsafe-eval` …), `nonce-…` and `sha256-…` sources are
quoted; schemes and hosts are written as-is. `"nonce"` becomes `'nonce-<options.nonce>'`, or is
dropped without a nonce. An empty list is written as `'none'`.

```typescript
stringify({ scriptSrc: ["self", "nonce"], objectSrc: [] }, { nonce: "cmFuZG9t" });
// "script-src 'self' 'nonce-cmFuZG9t'; object-src 'none'"
```

#### `parse(value): Result<CSP.Parsed[], CSPParseError>`

Reads a header value into one entry per comma-joined policy. Names and keywords are lowercased
and unquoted; a repeated directive keeps its first value and the repeat lands in `unknown`, as
does any directive the model does not carry, verbatim. A character outside printable ASCII or a
directive name outside `[A-Za-z0-9-]` fails with the error's `position`.

```typescript
let result = parse(response.headers.get("content-security-policy") ?? "");
if (isFailure(result)) throw result.error;
expect(result.data[0]?.directives.scriptSrc).toContain("https://challenges.cloudflare.com");
```

#### `merge(base, override): CSP.Directives`

Replaces each directive the override names and removes those it sets to `null`, keeping the
base's order.

#### `generateNonce(): string`

16 random bytes as padded base64, for a caller that writes CSP without the middleware.

#### `CSP.Directives`

`defaultSrc`, `scriptSrc`, `scriptSrcElem`, `scriptSrcAttr`, `styleSrc`, `styleSrcElem`,
`styleSrcAttr`, `imgSrc`, `fontSrc`, `connectSrc`, `mediaSrc`, `objectSrc`, `frameSrc`,
`childSrc`, `workerSrc`, `manifestSrc`, `baseUri`, `formAction` and `frameAncestors` take source
lists; `sandbox` takes `true` or tokens; `reportTo` an endpoint name; `reportUri` URLs;
`upgradeInsecureRequests` `true`; `requireTrustedTypesFor` `["script"]`; `trustedTypes` policy
names plus the `none` and `allow-duplicates` keywords.

### `@sdxc/security-headers/permissions-policy`

#### `stringify(policy): Result<string, StructuredFieldStringifyError>`

Writes `[]` as `()`, `"*"` as the bare token `*`, `self` and `src` as tokens and origins as
strings. Feature names keep their wire spelling (`browsing-topics`), since they are an open
registry.

```typescript
stringify({ camera: [], fullscreen: "*", geolocation: ["self", "https://maps.example.com"] });
// success('camera=(), fullscreen=*, geolocation=(self "https://maps.example.com")')
```

#### `parse(value): Result<PermissionsPolicy.Policy, StructuredFieldParseError>`

Reads a header value back, dropping parameters (`report-to`) and members that are neither
tokens nor strings. A bare `self` reads as `["self"]`.

### `@sdxc/security-headers/reports`

#### `parseReports(request): Promise<Result<CSPReport.Violation[], CSPReportParseError>>`

Reads a report POST in either format: `application/reports+json` batches (reports of other
types and malformed CSP reports skipped), `application/csp-report` legacy documents, and either
one labelled `application/json`. Each violation carries `documentURL`, `blockedURL`,
`effectiveDirective`, `disposition`, `sample`, `sourceFile` and `lineNumber`; empty strings
become `null`, and an older legacy report's `violated-directive` supplies the directive.

### `@sdxc/security-headers/middleware`

#### `securityHeaders(policy): Middleware`

Publishes `ctx.securityHeaders` and applies the resulting policy to the response the chain
returns, keeping any header the response set itself. HSTS is written only on `https:`
requests, and a `101 Switching Protocols` response passes through untouched.

- `ctx.securityHeaders.nonce` - this response's nonce, generated on first read; a response that
  never reads it gets every `"nonce"` source removed. Read it in the handler: the headers are
  written when the chain resolves, before a streamed body renders.
- `ctx.securityHeaders.policy` - the policy the response will be sent with.
- `ctx.securityHeaders.override(patch)` - patches this response's policy.

`SecurityHeadersKey` is the context key, for code that reads the state with `ctx.get`.

#### `securityHeadersOverride(patch): Middleware`

Controller or action middleware applying `patch` for the routes it guards; a pass-through when
`securityHeaders` is not installed.

## Patterns

### Pattern: An Inline Script With A Nonce

```tsx
import { createAction } from "remix/router";

export default createAction(routes.formPost, {
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

The policy lists `"nonce"` in `scriptSrc`; the response carries `'nonce-…'` because the
handler read it.

### Pattern: The Managed Import Map

`remix/ui` keeps the attributes of `<ImportMap>` on the `<script type="importmap">` it writes,
and its client runtime copies that script's nonce onto every import map it appends later. A
document that uses client entries renders it with the nonce:

```tsx
import { ImportMap } from "remix/ui/server";

<head>
	<ImportMap value={importMap} nonce={ctx.securityHeaders.nonce} />
</head>;
```

Without `<ImportMap>`, the client-entry import map is written with no attributes and a
nonce-based `script-src` blocks it.

### Pattern: A Route That Must Be Framed

```typescript
import { securityHeadersOverride } from "@sdxc/security-headers/middleware";

export default createAction(routes.embed, {
	middleware: [securityHeadersOverride({ contentSecurityPolicy: { frameAncestors: ["*"] } })],
	handler() {
		return new Response(embedHtml, { headers: { "content-type": "text/html" } });
	},
});
```

The derived `X-Frame-Options` disappears with the `'none'` it came from.

### Pattern: Report-Only Rollout And A Report Route

```typescript
import { parseReports } from "@sdxc/security-headers/reports";
import { isFailure } from "@sdxc/result";

const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicyReportOnly: {
		defaultSrc: ["self"],
		reportTo: "csp",
		reportUri: ["/reports/csp"],
	},
	reportingEndpoints: { csp: "/reports/csp" },
};

router.post(routes.reports.csp, async (ctx) => {
	let reports = await parseReports(ctx.request);
	if (isFailure(reports)) return new Response(null, { status: 400 });
	for (let violation of reports.data) ctx.log.warn("csp violation", violation);
	return new Response(null, { status: 204 });
});
```

### Pattern: Asserting A Policy In A Test

```typescript
import { parse } from "@sdxc/security-headers/csp";

let [policy] = unwrap(parse(response.headers.get("content-security-policy") ?? ""));
expect(policy?.directives.frameSrc).toEqual(["https://challenges.cloudflare.com"]);
```

## Related Packages

- [`@sdxc/structured-fields`](../structured-fields/README.md) - the RFC 9651 serializer behind
  Permissions-Policy and Reporting-Endpoints
- [`@sdxc/crypto`](../crypto/README.md) - the random bytes and base64 behind `generateNonce`
- [`@sdxc/result`](../result/README.md) - the `Result` every parser returns

## Tips

- Keep `styleSrc: ["self", "unsafe-inline"]` and never put `"nonce"` in `styleSrc`:
  `remix/ui` emits one `<style>` per `css()` mixin without a nonce, and a nonce in `style-src`
  makes browsers ignore `'unsafe-inline'` and block those styles.
- A cached HTML response replays its nonce to every visitor. Behind a shared cache, run a policy
  without `"nonce"` and use `sha256-…` sources for fixed inline scripts.
- Start with `contentSecurityPolicyReportOnly` and a report route; move the directives to
  `contentSecurityPolicy` once the reports are quiet.
- `'strict-dynamic'` makes browsers ignore `'self'` and host sources, so every `<script src>`
  would need the nonce too; adopt it deliberately.
