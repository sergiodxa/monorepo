# ADR-089: Security Headers Package

## Status

**Accepted** - 2026-09-24

## Background

A browser enforces a set of response headers that describe what a document may do: which
origins its scripts, styles, images and frames come from (`Content-Security-Policy`), whether
it is reached only over HTTPS (`Strict-Transport-Security`), how much of its URL leaks in a
`Referer` (`Referrer-Policy`), which device APIs it may ask for (`Permissions-Policy`),
whether it shares a browsing-context group or resources with other origins (COOP, COEP,
CORP), and whether a response's type may be sniffed (`X-Content-Type-Options`). They are the
layer that fails closed when an escaping or sanitizing bug lets markup through.

One app sets them. The reader builds a Content-Security-Policy and five other headers in an
app-local middleware; r3-auth and auth-saas set `Referrer-Policy` by hand on the three pages
whose URL carries a token; uptime and blog send none. The CSP is a joined string array, the
Permissions-Policy is a hand-written structured-field dictionary, and nothing can add a nonce,
so an inline script (r3-auth has two) is either blocked or forces `'unsafe-inline'`.

## Context

### Inventory

A search for `Content-Security-Policy`, `Referrer-Policy`, `X-Content-Type-Options`,
`Strict-Transport-Security`, `Permissions-Policy`, `Cross-Origin-*-Policy`,
`frame-ancestors`, `X-Frame-Options`, `Reporting-Endpoints` and `report-to` across `apps/`
and `packages/` (no `_headers` file exists in any app):

| Location                                                                                                 | Lines | What it does                                                                                                                                                                                                                                                                                                       | Spec logic vs app logic                                                                                                               |
| -------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/reader/app/http/middleware/security-headers.ts`                                                    | 106   | CSP of 13 directives (`default-src 'none'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self'` …); `no-referrer`, `nosniff`, HSTS two years with `preload`, COOP and CORP `same-origin`, a Permissions-Policy denying six features; a header the response set wins; rebuilds the `Response` | serialization, the set-if-absent rule and the rebuild are spec/package logic; the directive values and their rationale are app policy |
| `apps/reader/app/http/middleware/security-headers.test.ts`                                               | 96    | asserts the header values and the response-wins rule                                                                                                                                                                                                                                                               | becomes the reader's policy test plus package tests                                                                                   |
| `apps/reader/bootstrap/app.tsx`, `app/lib/test/controller.ts`                                            | -     | mounts `securityHeaders` immediately before `renderWith(...)`                                                                                                                                                                                                                                                      | placement stays                                                                                                                       |
| `apps/reader/app/http/controllers/media.tsx`                                                             | -     | `x-content-type-options: nosniff`, `cross-origin-resource-policy: same-origin` on proxied images                                                                                                                                                                                                                   | duplicates the middleware defaults                                                                                                    |
| `apps/r3-auth/app/http/controllers/verify-email.tsx`                                                     | -     | `Referrer-Policy: no-referrer` on a token page                                                                                                                                                                                                                                                                     | a per-route override                                                                                                                  |
| `apps/r3-auth/app/http/controllers/password/reset.tsx`                                                   | -     | the same                                                                                                                                                                                                                                                                                                           | a per-route override                                                                                                                  |
| `apps/auth-saas/app/http/controllers/hosted/magic-link.tsx`                                              | -     | the same                                                                                                                                                                                                                                                                                                           | a per-route override                                                                                                                  |
| `apps/r3-auth/app/http/controllers/oidc/check-session.ts`                                                | -     | serves an inline `<script>` in an iframe every relying party embeds cross-origin; its JSDoc says framing must stay open                                                                                                                                                                                            | a per-route override: `frame-ancestors *` and a nonce                                                                                 |
| `apps/r3-auth/resources/views/form-post.tsx`                                                             | -     | `<script>{"document.forms[0].submit()"}</script>` for `response_mode=form_post`                                                                                                                                                                                                                                    | needs a nonce under any CSP without `'unsafe-inline'`                                                                                 |
| `apps/uptime/resources/layouts/document.tsx`                                                             | -     | Cloudflare Web Analytics beacon from `static.cloudflareinsights.com`; an inline `<style>` of `@font-face` rules                                                                                                                                                                                                    | external origins the policy must name                                                                                                 |
| `apps/uptime/resources/components/turnstile.tsx`, `apps/auth-saas/app/views/hosted/turnstile-widget.tsx` | -     | Turnstile script from `challenges.cloudflare.com`, which renders an iframe                                                                                                                                                                                                                                         | `script-src` and `frame-src` entries                                                                                                  |
| blog                                                                                                     | -     | nothing; responses cached by `workersCache`                                                                                                                                                                                                                                                                        | a cached response and a per-request nonce do not mix                                                                                  |

No package under `packages/` sets any of these headers.

### What Remix provides

No Remix package sets CSP, HSTS, `Referrer-Policy`, `Permissions-Policy`, COOP, COEP or
`X-Frame-Options`. The security middleware Remix ships protects incoming requests:
`cop-middleware` rejects unsafe cross-origin browser requests by `Sec-Fetch-Site` and
`Origin`, `csrf-middleware` checks synchronizer tokens, and `cors-middleware` answers
preflights and writes `Access-Control-*`. None of them writes response policy headers, so
this package is complementary: the reader already runs `cop()` and its security headers side
by side.

`remix/headers` (`@remix-run/headers` 0.21.1) exposes `contentSecurityPolicy`,
`contentSecurityPolicyReportOnly`, `crossOriginEmbedderPolicy` (and `ReportOnly`),
`crossOriginOpenerPolicy`, `crossOriginResourcePolicy`, `permissionsPolicy`,
`referrerPolicy`, `strictTransportSecurity`, `xContentTypeOptions` and `xFrameOptions` on
`SuperHeaders` as plain string accessors, with no typed model, parser or builder. This
package's `stringify` output is a string, so it can be assigned to those accessors.

### What `remix/ui` renders, and what that means for a nonce

`remix/ui` 0.9.0, as `renderToStream` produces it:

| Output                                                   | CSP consequence                                                                                                                                                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<style data-rmx-style="…">` per `css()` mixin, no nonce | `style-src` needs `'unsafe-inline'`. A nonce in `style-src` would make browsers ignore `'unsafe-inline'` and block these, so a nonce never goes into `style-src` while this holds                                          |
| `<script type="application/json" id="rmx-data">`         | a data block, never executed, so `script-src` does not govern it                                                                                                                                                           |
| `<ImportMap value nonce>` component                      | its attributes, `nonce` included, are kept on the managed `<script type="importmap">`; the client runtime (`src/runtime/import-map-manager.ts`) reads that nonce and stamps it on every import-map script it appends later |
| client-entry import map with no `<ImportMap>` rendered   | written with no attributes at all, so it is blocked by a nonce-based `script-src`                                                                                                                                          |
| JSX `nonce` attribute on `<script>` / `<style>`          | typed and rendered like any attribute                                                                                                                                                                                      |

So the per-request nonce has two consumers: app-authored inline scripts, and the managed
import map, which must be rendered through `<ImportMap nonce={...}>` in a document that uses
client entries. No app uses `resolveClientEntry` today, so the second is forward-looking.

### What the specifications ask of an implementation

| Rule                                                                                                                       | Consequence for the package                                                                               |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| CSP: `;`-separated directives, each a name and space-separated source expressions (CSP3 §2.2)                              | a typed object in, a string out; `parse` for tests and merging                                            |
| A header may carry several policies joined by `,`, and every one is enforced                                               | `parse` returns a list of policies                                                                        |
| Directive names are case-insensitive; a repeated directive is ignored after the first                                      | `parse` lowercases and keeps the first, placing the repeat in `unknown`                                   |
| Keywords are quoted (`'self'`, `'none'`, `'strict-dynamic'`, `'unsafe-hashes'`, `'report-sample'`, `'wasm-unsafe-eval'` …) | keywords are written unquoted in the API and quoted by `stringify`, so a missing quote is impossible      |
| A nonce or hash in a directive makes `'unsafe-inline'` ignored there                                                       | the nonce is placed only in directives the policy names, `scriptSrc` by default                           |
| A nonce is unguessable and unique per response (at least 128 bits)                                                         | 16 random bytes, base64, generated per request                                                            |
| `frame-ancestors` supersedes `X-Frame-Options`                                                                             | `X-Frame-Options` is derived from `frameAncestors`, never configured separately                           |
| `report-to` names an endpoint declared in `Reporting-Endpoints`, an RFC 9651 Dictionary of strings                         | both written from one `reporting` option, the header through ADR-079                                      |
| `Permissions-Policy` is an RFC 9651 Dictionary of inner lists, tokens `*`/`self`/`src`, strings for origins                | written and read through `@sdxc/structured-fields` (ADR-079)                                              |
| HSTS: `max-age`, `includeSubDomains`, `preload`; preload lists require one year and both flags                             | typed; `stringifyStrictTransportSecurity` refuses `preload: true` without a year and `includeSubDomains`  |
| HSTS is ignored over plain HTTP                                                                                            | the middleware writes it only when the request URL is `https:`, which keeps `localhost` development clean |

## Decision

Add `@sdxc/security-headers`: a typed Content Security Policy Level 3 builder and parser, a
typed model of the other response policy headers, and Remix router middleware that applies a
policy set per request with a per-request nonce and per-route overrides.

### Package name

| Name                                        | Trade-off                                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@sdxc/security-headers`                    | names the whole set the apps actually configure together, and the reader's existing middleware                 |
| `@sdxc/csp`                                 | exact for the largest part, but HSTS, COOP and Permissions-Policy would need a second home                     |
| `@sdxc/helmet`                              | recognizable from Express, but borrows a brand, and helmet's defaults (`X-XSS-Protection: 0` …) are not ours   |
| `@sdxc/csp` plus middleware in `@sdxc/http` | splits one policy decision across two packages, and `@sdxc/http` is response builders with no middleware state |

`@sdxc/security-headers` wins because apps decide these headers as one policy, reviewed
together, and the name says so; the CSP builder stays independently importable from
`./csp` for a caller that needs only that.

### Scope

The package includes:

- the CSP Level 3 directive model, `stringify`, `parse` and `merge`
- nonce generation and the `"nonce"` placeholder source
- typed models for HSTS, `Referrer-Policy`, `Permissions-Policy`, COOP, COEP, CORP,
  `X-Content-Type-Options` and `Reporting-Endpoints`, and their serializers
- Report-Only variants of CSP and COEP, for rollout
- parsing CSP violation reports (`application/reports+json` and the legacy
  `application/csp-report`)
- router middleware publishing `ctx.securityHeaders`, and a route-level override middleware

What stays out, and where it lives:

- Cross-origin request rejection lives in `remix/middleware/cop` and `remix/middleware/csrf`
- `Access-Control-*` lives in `remix/middleware/cors`
- The route that receives violation reports lives in each app, logging through `ctx.log`
- Structured-field serialization lives in `@sdxc/structured-fields` (ADR-079)
- Each app's policy values live in that app, next to the rationale for each directive

### Exports

#### `@sdxc/security-headers/csp`

```ts
import type { Result } from "@sdxc/result";

export namespace CSP {
	export type Keyword =
		| "self"
		| "none"
		| "unsafe-inline"
		| "unsafe-eval"
		| "unsafe-hashes"
		| "strict-dynamic"
		| "report-sample"
		| "wasm-unsafe-eval"
		| "inline-speculation-rules";

	/**
	 * A source expression. Keywords and hashes are written unquoted and quoted on output;
	 * `"nonce"` is replaced by the request's nonce; anything else is a scheme (`data:`) or a
	 * host source (`https://challenges.cloudflare.com`, `*.example.com`) written as-is.
	 */
	export type Source =
		| Keyword
		| "nonce"
		| `nonce-${string}`
		| `${"sha256" | "sha384" | "sha512"}-${string}`
		| (string & {});

	export type SourceList = Source[];

	export interface Directives {
		defaultSrc?: SourceList;
		scriptSrc?: SourceList;
		scriptSrcElem?: SourceList;
		scriptSrcAttr?: SourceList;
		styleSrc?: SourceList;
		styleSrcElem?: SourceList;
		styleSrcAttr?: SourceList;
		imgSrc?: SourceList;
		fontSrc?: SourceList;
		connectSrc?: SourceList;
		mediaSrc?: SourceList;
		objectSrc?: SourceList;
		frameSrc?: SourceList;
		childSrc?: SourceList;
		workerSrc?: SourceList;
		manifestSrc?: SourceList;
		baseUri?: SourceList;
		formAction?: SourceList;
		frameAncestors?: SourceList;
		sandbox?: true | SandboxToken[];
		reportTo?: string;
		/** Legacy, kept for browsers that read only this. */
		reportUri?: string[];
		upgradeInsecureRequests?: true;
		requireTrustedTypesFor?: ["script"];
		trustedTypes?: string[];
	}

	export type SandboxToken =
		| "allow-forms"
		| "allow-modals"
		| "allow-popups"
		| "allow-same-origin"
		| "allow-scripts"
		| "allow-downloads"
		| (string & {});

	export interface StringifyOptions {
		/** Substituted for every `"nonce"` source; without it those sources are dropped. */
		nonce?: string;
	}

	/** A directive whose value is `null` in an override is removed from the result. */
	export type Override = { [Name in keyof Directives]?: Directives[Name] | null };

	export interface Parsed {
		directives: Directives;
		/** Directives the policy repeated or this package does not model, kept verbatim. */
		unknown: Record<string, string[]>;
	}
}

export class CSPParseError extends Error {
	override name = "CSPParseError";
	readonly position: number;
}

/**
 * Writes one policy. A source list left empty once `"nonce"` is dropped is written as
 * `'none'`, so a policy never grows more permissive by losing its nonce.
 */
export function stringify(directives: CSP.Directives, options?: CSP.StringifyOptions): string;

/** Parses a header value, which may hold several comma-joined policies. */
export function parse(value: string): Result<CSP.Parsed[], CSPParseError>;

/** Replaces each directive the override names, removing those it sets to `null`. */
export function merge(base: CSP.Directives, override: CSP.Override): CSP.Directives;

/** 16 random bytes as base64, the per-response nonce. */
export function generateNonce(): string;
```

#### `@sdxc/security-headers/permissions-policy`

```ts
export namespace PermissionsPolicy {
	/** `[]` denies the feature, `"*"` allows every origin, a list allows those named. */
	export type Allowlist = [] | "*" | Array<"self" | "src" | (string & {})>;
	/** Feature names as the header spells them, since they are registry identifiers. */
	export type Policy = Record<string, Allowlist>;
}

export function stringify(
	policy: PermissionsPolicy.Policy,
): Result<string, StructuredFieldStringifyError>;
export function parse(value: string): Result<PermissionsPolicy.Policy, StructuredFieldParseError>;
```

Feature names keep their wire spelling (`browsing-topics`, `publickey-credentials-get`)
because they are open-ended registry identifiers, and a camelCase mapping would need a table
that goes stale as browsers add features. Internally this is one `stringify(..., "dictionary")` call
from `@sdxc/structured-fields`, with `Token` for `self`, `src` and `*`, and strings for origins.

#### `@sdxc/security-headers`

```ts
export namespace SecurityHeaders {
	export interface StrictTransportSecurity {
		maxAge: number; // seconds
		includeSubDomains?: boolean;
		preload?: boolean;
	}

	export type ReferrerPolicy =
		| "no-referrer"
		| "no-referrer-when-downgrade"
		| "origin"
		| "origin-when-cross-origin"
		| "same-origin"
		| "strict-origin"
		| "strict-origin-when-cross-origin"
		| "unsafe-url";

	export interface Policy {
		contentSecurityPolicy?: CSP.Directives;
		/** Sent alongside or instead, to observe a stricter policy before enforcing it. */
		contentSecurityPolicyReportOnly?: CSP.Directives;
		strictTransportSecurity?: StrictTransportSecurity;
		/** Several values are a fallback list, the last one the browser understands wins. */
		referrerPolicy?: ReferrerPolicy | ReferrerPolicy[];
		permissionsPolicy?: PermissionsPolicy.Policy;
		crossOriginOpenerPolicy?:
			"same-origin" | "same-origin-allow-popups" | "noopener-allow-popups" | "unsafe-none";
		crossOriginEmbedderPolicy?: "require-corp" | "credentialless" | "unsafe-none";
		crossOriginResourcePolicy?: "same-origin" | "same-site" | "cross-origin";
		/** @default true */
		noSniff?: boolean;
		/** Endpoint names to URLs, written as `Reporting-Endpoints`; `reportTo` refers to a name. */
		reportingEndpoints?: Record<string, string>;
	}

	/** A policy patch: a header set to `null` is not sent for that response. */
	export type Override = {
		[Name in keyof Policy]?: Name extends
			"contentSecurityPolicy" | "contentSecurityPolicyReportOnly"
			? CSP.Override | null
			: Policy[Name] | null;
	};

	export interface ApplyOptions {
		nonce?: string;
		/** HSTS is written only for `https:`. */
		url: URL;
	}
}

/** Every header the policy produces, `X-Frame-Options` derived from `frameAncestors`. */
export function entries(
	policy: SecurityHeaders.Policy,
	options: SecurityHeaders.ApplyOptions,
): Array<[name: string, value: string]>;

/** Writes each header the response has not set for itself, so a route's own value wins. */
export function apply(
	headers: Headers,
	policy: SecurityHeaders.Policy,
	options: SecurityHeaders.ApplyOptions,
): void;

export function override(
	policy: SecurityHeaders.Policy,
	patch: SecurityHeaders.Override,
): SecurityHeaders.Policy;

export function stringifyStrictTransportSecurity(
	value: SecurityHeaders.StrictTransportSecurity,
): string;
```

`X-Frame-Options` is written as `DENY` when `frameAncestors` is `["none"]`, `SAMEORIGIN` when
it is `["self"]`, and left out otherwise, so the two can never disagree.

#### `@sdxc/security-headers/reports`

```ts
export namespace CSPReport {
	export interface Violation {
		documentURL: string;
		blockedURL: string | null;
		effectiveDirective: string;
		disposition: "enforce" | "report";
		sample: string | null;
		sourceFile: string | null;
		lineNumber: number | null;
	}
}

/** Reads either report format into one shape; wire names such as `blocked-uri` stay internal. */
export function parseReports(
	request: Request,
): Promise<Result<CSPReport.Violation[], CSPReportParseError>>;
```

#### `@sdxc/security-headers/middleware`

```ts
import type { Middleware } from "remix/router";

declare module "remix/router" {
	interface RequestContext {
		securityHeaders: SecurityHeadersContext;
	}
}

export interface SecurityHeadersContext {
	/**
	 * This response's nonce, generated on first read. A response that never reads it gets
	 * a policy with every `"nonce"` source removed, so an unused nonce is never advertised.
	 */
	readonly nonce: string;
	/** The policy this response will be sent with; a handler may patch it. */
	readonly policy: SecurityHeaders.Policy;
	override(patch: SecurityHeaders.Override): void;
}

/**
 * Publishes `ctx.securityHeaders` and applies the resulting policy to the response the
 * chain returns, keeping any header the response set itself.
 */
export function securityHeaders(policy: SecurityHeaders.Policy): Middleware<{
	key: typeof SecurityHeadersKey;
	value: SecurityHeadersContext;
	property: "securityHeaders";
}>;

/** Controller or action middleware applying `patch` for the routes it guards. */
export function securityHeadersOverride(patch: SecurityHeaders.Override): Middleware;
```

The router middleware sits immediately before the renderer, as the reader's does today, so
the response it decorates is the one the renderer produced. Its dependencies are
`@sdxc/result`, `@sdxc/crypto` (`randomBytes`, `Base64`), `@sdxc/structured-fields`, and
`remix` as an optional peer.

### Usage

The reader's policy moves into `apps/reader/app/http/security-policy.ts` unchanged in effect:

```ts
import type { SecurityHeaders } from "@sdxc/security-headers";

export const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicy: {
		defaultSrc: ["none"],
		scriptSrc: ["self"],
		styleSrc: ["self", "unsafe-inline"],
		imgSrc: ["self"],
		fontSrc: ["self"],
		connectSrc: ["self"],
		manifestSrc: ["self"],
		mediaSrc: ["none"],
		frameSrc: ["none"],
		frameAncestors: ["none"],
		formAction: ["self"],
		baseUri: ["none"],
		objectSrc: ["none"],
	},
	referrerPolicy: "no-referrer",
	strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
	crossOriginOpenerPolicy: "same-origin",
	crossOriginResourcePolicy: "same-origin",
	permissionsPolicy: {
		camera: [],
		microphone: [],
		geolocation: [],
		payment: [],
		usb: [],
		"browsing-topics": [],
	},
};
```

```ts
// apps/reader/bootstrap/app.tsx
securityHeaders(SECURITY_POLICY),
renderWith(createHtmlRenderer) as Middleware,
```

r3-auth adds a nonce for its inline scripts and opens framing on one route:

```ts
// apps/r3-auth/resources/views/form-post.tsx — the view receives ctx.securityHeaders.nonce
<script nonce={nonce}>{SUBMIT_SCRIPT}</script>
```

```ts
// apps/r3-auth/app/http/controllers/oidc/check-session.ts
export default createAction(routes.oidc.checkSession, {
	middleware: [securityHeadersOverride({ contentSecurityPolicy: { frameAncestors: ["*"] } })],
	handler(ctx) {
		return new Response(checkSessionHtml(ctx.securityHeaders.nonce), { headers });
	},
});
```

uptime names the origins its third-party widgets load from:

```ts
contentSecurityPolicy: {
	defaultSrc: ["self"],
	scriptSrc: ["self", "nonce", "https://static.cloudflareinsights.com", "https://challenges.cloudflare.com"],
	frameSrc: ["https://challenges.cloudflare.com"],
	connectSrc: ["self", "https://cloudflareinsights.com"],
	styleSrc: ["self", "unsafe-inline"],
	frameAncestors: ["none"],
	reportTo: "csp",
},
reportingEndpoints: { csp: "/reports/csp" },
```

A document that uses client entries renders the import map with the nonce, so the client
runtime reuses it for every import map it appends:

```ts
<ImportMap value={importMap} nonce={ctx.securityHeaders.nonce} />
```

## Consequences

### Positive

- **Every app gets a policy** - uptime, blog, r3-auth and auth-saas gain HSTS, `nosniff`, a
  referrer policy and a CSP, where today only the reader has them
- **Inline scripts without `'unsafe-inline'`** - a per-request nonce makes r3-auth's
  `form_post` and check-session scripts legal under a strict `script-src`
- **Quoting and separators cannot be wrong** - keywords are quoted by `stringify`, the
  Permissions-Policy goes through the RFC 9651 serializer, and HSTS preload requirements are
  checked
- **Per-route exceptions are declared where they apply** - `check-session` states its own
  `frame-ancestors`, instead of a comment explaining why a global header must not exist
- **Report-Only rollout** - an app can observe violations for a week before enforcing
- **Testable** - `parse` lets an app's test assert "script-src contains the Turnstile origin"
  instead of comparing a whole string

### Negative

- **`style-src 'unsafe-inline'` stays** - `remix/ui` emits its styles without a nonce, so every
  app keeps inline styles allowed until it does; injected `style` attributes are closed only by
  sanitizing, as the reader already does
- **Nonces and shared caching conflict** - a cached HTML response replays its nonce to every
  visitor, so blog (behind `workersCache`) runs a nonce-free policy, and any app caching HTML
  must do the same
- **A strict CSP can break a page silently in production** - a missed origin blocks a widget
  with only a console message; the Report-Only phase and a report route are the mitigation
- **Header bytes on every response** - roughly 600 bytes, including JSON and redirects
- **Another package to publish and document**

### Neutral

- **Response-set headers win** - the reader's rule is kept, so a controller writing its own
  `Referrer-Policy` needs no override middleware
- **Feature names in Permissions-Policy keep their wire spelling** - the one place the typed
  model is not camelCase, since the names are an open registry

## Implementation Plan

### Phase 1: Specify and build the package

**Priority:** High
**Estimated Effort:** 5 hours

1. Tests first: keyword quoting, the nonce placeholder (present, absent, sole source becoming
   `'none'`), hashes, multiple policies in one header, repeated directives, `merge` with
   `null`, HSTS preload validation, `X-Frame-Options` derivation, Permissions-Policy round
   trips, both report formats, response-set headers winning, HSTS skipped on `http:`
2. Implement `./csp`, `./permissions-policy`, the root export, `./reports`, then `./middleware`
3. README and root README row

### Phase 2: Migrate the reader

**Priority:** High
**Estimated Effort:** 1 hour

1. Move the policy values and their rationale into `app/http/security-policy.ts`
2. Replace `app/http/middleware/security-headers.ts` with `securityHeaders(SECURITY_POLICY)` in
   `bootstrap/app.tsx` and `app/lib/test/controller.ts`
3. Keep `security-headers.test.ts` asserting the same header values, rewritten against the
   middleware; the byte-for-byte header values are the check that nothing changed
4. Drop the duplicated `nosniff` and CORP lines from `controllers/media.tsx`

### Phase 3: Adopt in r3-auth and auth-saas

**Priority:** High
**Estimated Effort:** 3 hours

| File                                                                       | Change                                                                      |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/r3-auth/bootstrap/app.tsx`                                           | `securityHeaders(...)` before the renderer, `referrerPolicy: "no-referrer"` |
| `apps/r3-auth/app/http/controllers/verify-email.tsx`, `password/reset.tsx` | drop `Referrer-Policy` from the page constants, now the app default         |
| `apps/r3-auth/resources/views/form-post.tsx`                               | `nonce` on the inline script                                                |
| `apps/r3-auth/app/http/controllers/oidc/check-session.ts`                  | `securityHeadersOverride` with `frameAncestors: ["*"]`, nonce on the script |
| `apps/auth-saas/bootstrap/*.ts`                                            | `securityHeaders(...)` on the tenant, management and platform routers       |
| `apps/auth-saas/app/http/controllers/hosted/magic-link.tsx`                | keeps its `Referrer-Policy`, or relies on the default                       |

Both start with `contentSecurityPolicyReportOnly` and a report route, then enforce.

### Phase 4: Adopt in uptime and blog

**Priority:** Medium
**Estimated Effort:** 2 hours

1. uptime: policy naming the Web Analytics and Turnstile origins, Report-Only first
2. blog: nonce-free policy, Report-Only first, since the origins article images load from
   have not been audited

### Phase 5: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. Remove `private: true`, add `description` and `LICENSE.md`; `@sdxc/structured-fields` must be
   public first
2. `bun run release:bootstrap @sdxc/security-headers`, then configure the trusted publisher

## Current Progress

- [x] Phase 1: Specify and build the package
- [x] Phase 2: Migrate the reader
- [ ] Phase 3: Adopt in r3-auth and auth-saas
  - [x] `apps/auth-saas`: the tenant and platform routers send their CSP Report-Only with a
        `/reports/csp` route logging each violation; the JSON-only management router enforces
        `default-src 'none'; frame-ancestors 'none'`. The tenant policy leaves `form-action` open
        (an authorization ends in a form-submission redirect to the client) and sends no COOP
        (popup-based relying parties keep their opener); `no-referrer` there replaces the
        magic-link page's own header. No inline script or ImportMap renders today, so the
        nonce source is advertised only once a page reads it
- [ ] Phase 4: Adopt in uptime and blog
  - [x] `apps/uptime`: CSP Report-Only naming the Web Analytics and Turnstile origins, reported
        to a `/reports/csp` route; HSTS, `Referrer-Policy`, Permissions-Policy and `nosniff`
        enforced. The renderer reads the nonce before streaming and hands it to the document
        through a context provider, which stamps it on an `<ImportMap>` in the head
- [ ] Phase 5: Publish

## Notes

- Implementation: serialization never fails and always errs toward the stricter policy, where
  the Decision leaves invalid input unspecified or says `stringifyStrictTransportSecurity`
  "refuses" `preload`. `stringify` drops a CSP source (or nonce) that would break out of its
  directive (whitespace, `;`, `,`, `'`), so the list may become `'none'`;
  `stringifyStrictTransportSecurity` leaves `preload` out unless `maxAge` is a year or more and
  `includeSubDomains` is set; `entries` writes a Permissions-Policy feature whose origin RFC 9651
  cannot carry as `()` and drops a feature name outside the key grammar; a
  `Reporting-Endpoints` entry with no RFC 9651 form is dropped. The signatures stay as the
  Decision writes them, with no `Result` on the write path.
- Implementation: `SecurityHeaders.Policy` gains `crossOriginEmbedderPolicyReportOnly`
  (`Cross-Origin-Embedder-Policy-Report-Only`), which the Scope lists and the interface lacked.
- Implementation: `apply` derives no `X-Frame-Options` when the response set its own
  `Content-Security-Policy`, since the derived value would describe a `frame-ancestors` the
  response no longer sends. The Report-Only policy derives nothing either.
- Implementation: `parse` fails with `CSPParseError` on a character outside printable ASCII
  and whitespace, and on a directive name outside `[A-Za-z0-9-]`; CSP3's browser algorithm skips
  those, but this parser serves tests and merging, where a malformed policy is a bug to surface.
- Implementation: the nonce is generated on first read, and the headers are written when the
  chain resolves. A renderer that streams its body renders after that point, so the nonce must be
  read in the handler (and passed down as a prop), which is how the Usage examples already
  read it.
- Implementation: the middleware passes a `101 Switching Protocols` response through untouched,
  since rebuilding it would detach its WebSocket, and rebuilds every other response, so one with
  immutable headers (`Response.redirect`) is decorated too.
- Implementation: `parseReports` also accepts `application/json`, which some browsers send
  legacy reports under, and skips reports of other types and malformed CSP reports inside a
  Reporting API batch instead of failing the whole batch.
- Implementation: `remix` stays a regular dependency, where the Decision names it an optional
  peer, and the scaffolded `@sdxc/http` dependency is unused; both are `package.json` changes that
  need a lockfile update, left to the publish phase.
- Implementation: the `remix/ui` 0.9.0 findings hold against its source. `buildImportMapSegment`
  keeps every `<ImportMap>` prop but `value` as attributes of
  `<script data-rmx-import-map type="importmap">`, `createImportMapManager` reads that script's
  `nonce` and stamps it on each import map it appends, and `<style data-rmx-style>` carries no
  nonce. `import-map.test.tsx` renders `<ImportMap nonce>` through the middleware and checks the
  nonce matches the `script-src` the response carries.
- Reader adoption: the reader renders no `<ImportMap>` and loads its one client entry with
  `script-src 'self'`, so it reads no nonce and its policy carries none. It gains
  `X-Frame-Options: DENY` (derived from `frame-ancestors 'none'`), and HSTS is left off plain
  `http:` responses, which only local development serves.

## Alternatives Considered

### 1. Keep the header set app-local

**Rejected because**: four more apps would copy the reader's middleware, and the nonce and
per-route override machinery would be written in each.

### 2. Use `helmet` or a CSP builder from npm

**Rejected because**: `helmet` targets Express and Node's response object, and its defaults
include headers this repo has no use for. The CSP-only libraries build strings but neither
parse, integrate a per-request nonce with a router context, nor route Permissions-Policy
through a structured-field serializer.

### 3. Hashes instead of nonces

A static inline script has a stable SHA-256, which also survives shared caching.

**Rejected as the default because**: every edit to a script's text changes its hash, so the
policy and the markup must be updated together, and a script that embeds a per-request value
has no stable hash at all. A nonce covers both kinds with one mechanism. The model accepts
`sha256-…` sources, so a cached page with a fixed inline script can use one.

### 4. `'strict-dynamic'` by default

**Rejected because**: under `'strict-dynamic'` browsers ignore `'self'` and host sources, so
every `<script src>` the apps write (client entries, Turnstile, the analytics beacon) would
need the nonce too. It stays available as a keyword for an app that adopts it deliberately.

## References

- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)
- [Permissions Policy](https://www.w3.org/TR/permissions-policy/)
- [Reporting API](https://www.w3.org/TR/reporting-1/)
- [RFC 6797 - HTTP Strict Transport Security](https://www.rfc-editor.org/rfc/rfc6797)
- [Referrer Policy](https://www.w3.org/TR/referrer-policy/)
- [HTML: Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy](https://html.spec.whatwg.org/multipage/browsers.html#cross-origin-opener-policies)
- [Fetch: Cross-Origin-Resource-Policy](https://fetch.spec.whatwg.org/#cross-origin-resource-policy-header)
- [ADR-079: Structured Field Values](./ADR-079-structured-field-values-package.md)
- [ADR-057: Request context instead of a service container](./ADR-057-request-context-instead-of-a-service-container.md)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
