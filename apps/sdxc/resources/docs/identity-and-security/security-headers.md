---
title: Security headers and CSP
description: One typed policy for CSP, HSTS and Permissions-Policy, nonces for the scripts you render, violation reports, and a security.txt.
section:
    title: Identity & security
    order: 5
order: 5
lastUpdated: 2026-09-29
---

A browser enforces what your response headers tell it: where scripts may load from, whether the
page may be framed, which device APIs it may ask for, whether the site is HTTPS-only. This guide
writes all of it as one typed policy, reviewed in one file, and applies it to every response of
a Remix v3 app. [`@sdxc/security-headers`](/api/security-headers) models the headers and ships
the middleware, [`@sdxc/crypto`](/api/crypto) hashes a fixed inline script, and
[`@sdxc/well-known`](/api/well-known) publishes the `security.txt` that tells a researcher where
to report what the headers missed.

```bash
npm add @sdxc/security-headers @sdxc/crypto @sdxc/well-known @sdxc/result
```

## Write the policy once

The CSP model writes keywords unquoted and quotes them on output, so a missing quote cannot
happen. `"nonce"` is a placeholder the middleware replaces with a fresh nonce per response.

```typescript {% title="app/http/security-policy.ts" %}
import type { SecurityHeaders } from "@sdxc/security-headers";

export const BOOT_SCRIPT = `document.documentElement.classList.add("js");`;

export const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicyReportOnly: {
		defaultSrc: ["self"],
		scriptSrc: [
			"self",
			"nonce",
			"sha256-WZRJfWvsnNCPcxzZwvyhovnZGqhZaC+8gPGPRbx6wTk=",
			"https://challenges.cloudflare.com",
		],
		styleSrc: ["self", "unsafe-inline"],
		imgSrc: ["self", "data:"],
		frameSrc: ["https://challenges.cloudflare.com"],
		formAction: ["self", "https://auth.example.com"],
		frameAncestors: ["none"],
		objectSrc: ["none"],
		baseUri: ["none"],
		reportTo: "csp",
	},
	reportingEndpoints: { csp: "/reports/csp" },
	strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
	referrerPolicy: "strict-origin-when-cross-origin",
	crossOriginOpenerPolicy: "same-origin",
	permissionsPolicy: { camera: [], microphone: [], geolocation: [], payment: [] },
};
```

A few choices here are load-bearing. `styleSrc` keeps `"unsafe-inline"` and never takes
`"nonce"`: `remix/component` writes one `<style>` per `css()` mixin without a nonce, and a nonce in
`style-src` makes browsers ignore `'unsafe-inline'` and block every one of them. `formAction`
names your identity provider, because a login form that posts to it — the one in
[Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) — is a form action
too. The Turnstile origin appears in `scriptSrc` and `frameSrc` because the challenge from
[Protect forms](/docs/identity-and-security/protect-forms) loads a script that renders a frame.
`frameAncestors: ["none"]` also derives `X-Frame-Options: DENY`, so the two can never disagree,
and `X-Content-Type-Options: nosniff` is written unless you turn it off. The `sha256-…` source
allows `BOOT_SCRIPT` inline, as the section on hashing a fixed script below explains.

The CSP starts as `contentSecurityPolicyReportOnly`: the browser reports what it would have
blocked without blocking it. You move it to `contentSecurityPolicy` once the reports go quiet.

## Install it before the renderer

`securityHeaders(policy)` publishes `ctx.securityHeaders` and writes the headers onto whatever
response the chain returns, keeping any header the response set itself. Place it right before
`renderWith`, so it decorates the rendered page and the renderer can read the nonce.

```typescript {% title="bootstrap/app.ts" %}
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";

import { SECURITY_POLICY } from "~/app/http/security-policy";
import { APP_MIDDLEWARE } from "~/bootstrap/middleware";
import { createHtmlRenderer } from "~/bootstrap/renderer";

export const router = createRouter({
	middleware: [
		...APP_MIDDLEWARE,
		securityHeaders(SECURITY_POLICY),
		renderWith(createHtmlRenderer),
	],
});
```

`APP_MIDDLEWARE` stands for whatever your app already runs ahead of it, and
`createHtmlRenderer` for the renderer from
[Wire the router](/docs/building-remix-apps/wire-the-router); the order among the rest does not
matter to the headers.

HSTS is written only on `https:` requests, so `localhost` over HTTP is never pinned to HTTPS by
accident, and `preload`, when you set it, is written only if the preload lists would accept the
rest of the header.

## Nonces for the scripts you render

A handler that renders an inline script reads `ctx.securityHeaders.nonce` and puts it on the
tag. The nonce is generated on first read, and a response that never reads it gets every
`"nonce"` source removed, so an unused nonce is never advertised.

```tsx {% title="resources/layouts/document.tsx" %}
import type { Handle, RemixNode } from "remix/component";

import { ImportMap } from "remix/component/server";

import { BOOT_SCRIPT } from "~/app/http/security-policy";

type DocumentProps = { nonce: string; children?: RemixNode };

export function Document(handle: Handle<DocumentProps>) {
	return () => (
		<html lang="en">
			<head>
				<ImportMap value={{ imports: {} }} nonce={handle.props.nonce} />
				<script>{BOOT_SCRIPT}</script>
			</head>
			<body>{handle.props.children}</body>
		</html>
	);
}
```

The handler reads the nonce and passes it in, as
`ctx.render(<Document nonce={ctx.securityHeaders.nonce}>…</Document>)`. The boot script needs
no nonce, because its hash is in the policy.

A page with client entries — the passkey button from [Add passkeys](/docs/identity-and-security/passkeys),
say — needs this. `remix/component` keeps the attributes of `<ImportMap>` on the import map it writes
and copies its nonce onto every import map it appends later; without it, a nonce-based
`script-src` blocks the client entries. `TurnstileWidget` and the other CAPTCHA widgets take a
`nonce` prop for their loader script the same way.

Read the nonce in the handler, while the chain is still running: the headers are written when
it resolves, ahead of a streamed body.

## Hash a fixed inline script instead

A nonce is per response, so an HTML response stored in a shared cache replays one nonce to every
visitor. For a script whose text never changes, list its hash instead. The policy module above
exports the script's text as `BOOT_SCRIPT` and lists its `sha256-…` source as a literal, and a
test fails when the two drift apart:

```typescript {% title="app/http/security-policy.test.ts" %}
import { Base64, sha256 } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { SECURITY_POLICY, BOOT_SCRIPT } from "./security-policy";

test("the policy allows the boot script exactly as written", async () => {
	let digest = Base64.encode(unwrap(await sha256(BOOT_SCRIPT)));
	let scriptSrc = SECURITY_POLICY.contentSecurityPolicyReportOnly?.scriptSrc;
	expect(scriptSrc).toContain(`sha256-${digest}`);
});
```

CSP hashes are standard, padded base64, which is what `Base64.encode` writes. Hashing in a test
keeps the work out of the Worker's global scope and off every cold start.

## Collect reports before enforcing

`reportTo: "csp"` names the endpoint `reportingEndpoints` points at. `parseReports` reads either
format a browser sends — the Reporting API's `application/reports+json` batches and the legacy
`application/csp-report` document — into one violation shape.

```typescript {% title="app/http/controllers/csp-reports.ts" %}
import { isFailure } from "@sdxc/result";
import { parseReports } from "@sdxc/security-headers/reports";
import { createAction } from "remix/router";

import routes from "~/routes/web";

export default createAction(routes.cspReports, async (ctx) => {
	let parsed = await parseReports(ctx.request);
	if (isFailure(parsed)) return new Response(null, { status: 400 });

	for (let violation of parsed.data.slice(0, 20)) {
		ctx.log.warn("csp.violation", {
			document_url: violation.documentURL,
			blocked_url: violation.blockedURL,
			directive: violation.effectiveDirective,
		});
	}

	return new Response(null, { status: 204 });
});
```

Declare the route as `cspReports: post("/reports/csp")` in `routes/web.ts`. The slice caps how much one crafted batch can write
to your logs. When the only violations left are browser extensions, rename
`contentSecurityPolicyReportOnly` to `contentSecurityPolicy` and the policy is enforced.

## Loosen one route, not the policy

A route that has to differ — an embeddable widget that other sites frame — patches its own
response instead of weakening the policy for every page:

```tsx {% title="app/http/controllers/embed.tsx" %}
import { securityHeadersOverride } from "@sdxc/security-headers/middleware";
import { createAction } from "remix/router";

import { EmbedCard } from "~/resources/views/embed-card";
import routes from "~/routes/web";

export default createAction(routes.embed, {
	middleware: [
		securityHeadersOverride({ contentSecurityPolicy: { frameAncestors: ["*"] } }),
	],
	handler: (ctx) => ctx.render(<EmbedCard />),
});
```

A CSP patch merges directive by directive, and the derived `X-Frame-Options` disappears with the
`'none'` it came from. A handler can do the same with `ctx.securityHeaders.override(patch)`.

## Publish security.txt

RFC 9116's `/.well-known/security.txt` is where a researcher looks for your security contact.
`wellKnown()` answers it with the right media type, an `ETag` and caching, and hands every other
path to the next middleware.

```typescript {% title="app/lib/security-txt.ts" %}
import type { SecurityTxt } from "@sdxc/well-known/security-txt";

export const SECURITY_TXT: SecurityTxt = {
	contact: [new URL("mailto:security@example.com")],
	expires: new Date("2027-09-30T00:00:00Z"),
	encryption: [],
	acknowledgments: [],
	preferredLanguages: ["en"],
	canonical: [new URL("https://example.com/.well-known/security.txt")],
	policy: [],
	hiring: [],
	extensions: {},
};
```

Register `wellKnown({ "security.txt": serve(securityTxt, () => SECURITY_TXT) })` — `wellKnown`
and `serve` from `@sdxc/well-known/middleware`, `securityTxt` from
`@sdxc/well-known/security-txt` — near the top of the chain, before session work, since the
document is the same for every visitor. Keep `expires` a literal date, and add a test that fails
30 days before it with `isExpired(SECURITY_TXT, thirtyDaysFromNow)`: a date computed from the
clock keeps the file looking fresh while the inbox behind it goes stale.

## Where to go next

- [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) — the
  challenge whose origin this policy allows.
- [SEO, sitemaps and robots.txt](/docs/building-remix-apps/seo-sitemaps-and-robots) — the other
  documents crawlers look for at fixed paths.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — querying the
  `csp.violation` events.
- [`@sdxc/security-headers`](/api/security-headers) — every directive, `override`, and reading a
  policy back with `parse`.
