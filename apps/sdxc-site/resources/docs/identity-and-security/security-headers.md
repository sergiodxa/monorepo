---
title: Security headers and CSP
description: One typed policy for CSP, HSTS and Permissions-Policy, nonces for the scripts you render, violation reports, and a security.txt.
section:
    title: Identity & security
    order: 6
order: 5
lastUpdated: 2026-10-25
outcomes:
    - "How to write CSP, HSTS and Permissions-Policy as one typed policy"
    - "How to use nonces or hashes for the scripts you render"
    - "How to collect violation reports and publish a `security.txt`"
---

A browser enforces what your response headers tell it: where scripts may load from, whether the
page may be framed, which device APIs it may ask for, whether the site is HTTPS-only. This guide
writes all of it as one typed policy, reviewed in one file, and applies it to every response of
a Remix v3 app. [`@sdxc/security-headers`](/api/security-headers) models the headers and ships
the middleware, [`@sdxc/crypto`](/api/crypto) hashes a fixed inline script, and
[`@sdxc/well-known`](/api/well-known) publishes the `security.txt` that tells a researcher where
to report what the headers missed.

```bash
npm add @sdxc/assets-middleware @sdxc/crypto @sdxc/result @sdxc/security-headers \
	@sdxc/well-known remix
```

## Write the policy once

The CSP model writes keywords unquoted and quotes them on output, so a missing quote cannot
happen. `"nonce"` is a placeholder the middleware replaces with a fresh nonce per response.

```typescript {% title="config/security-policy.ts" %}
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

`formAction` names your identity provider, because the login in
[Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) redirects a form
there. The Turnstile origin in `scriptSrc` and `frameSrc` is for the challenge from
[Protect forms](/docs/identity-and-security/protect-forms). Once the policy is enforced,
`frameAncestors: ["none"]` also derives `X-Frame-Options: DENY`.

> [!WARNING]
> Keep `"nonce"` out of `styleSrc`. `remix/component` writes one `<style>` per `css()` mixin
> without a nonce, and a nonce in `style-src` makes browsers ignore `'unsafe-inline'` and block
> every one of them.

The CSP starts as `contentSecurityPolicyReportOnly`: the browser reports what it would have
blocked without blocking it.

> [!WARNING]
> A report-only policy protects nothing. Scripts it would block still run, framing is still
> allowed and no `X-Frame-Options` is derived, until you rename it to `contentSecurityPolicy`.

## Install it before the renderer

`securityHeaders(policy)` writes the headers onto whatever response the chain returns. Place it
right before `assets()` and the renderer, so its nonce exists before the document asks for it.

```typescript {% title="app/initializers/router.ts" %}
import { assets } from "@sdxc/assets-middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import { assetResolver } from "~/app/initializers/assets";
import { SECURITY_POLICY } from "~/config/security-policy";

export function createWebRouter() {
	let router = createRouter({
		middleware: [
			// …the middleware your app already runs
			securityHeaders(SECURITY_POLICY),
			assets(assetResolver, {
				stylesheets: "resources/layouts/document.tsx",
				script: "bootstrap/browser.ts",
				nonce: (ctx) => ctx.securityHeaders.nonce,
			}),
			render({ assets: assetResolver }),
		],
	});
	// router.map(…) for each route
	return router;
}
```

The comment stands for the middleware from
[Wire the router](/docs/building-remix-apps/wire-the-router). `assets()` publishes the
stylesheets, entry script and nonce each page passes to its document as `ctx.assets`.

## Put nonces on the scripts you render

The nonce is generated on first read, and a response that never reads it advertises none. The
document puts `ctx.assets.nonce` on its import map, which `remix/component` copies onto every
import map it appends later, so client entries load under a nonce-based `script-src`:

```tsx {% title="resources/layouts/document.tsx" %}
import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { ImportMap } from "remix/component/server";

import { BOOT_SCRIPT } from "~/config/security-policy";

type DocumentProps = { assets: DocumentAssets; children?: RemixNode };

export function Document(handle: Handle<DocumentProps>) {
	return () => {
		let { nonce, script } = handle.props.assets;
		return (
			<html lang="en">
				<head>
					<ImportMap value={script.importMap} nonce={nonce} />
					<script>{BOOT_SCRIPT}</script>
				</head>
				<body>
					{handle.props.children}
					<script type="module" async src={script.href}></script>
				</body>
			</html>
		);
	};
}
```

The boot script needs no nonce, because its hash is in the policy. Any other inline script a
handler renders takes `ctx.securityHeaders.nonce` the same way.

> [!NOTE]
> Read the nonce while the chain is still running, in the handler or in the document
> `ctx.render` builds: the headers are written when the chain resolves, ahead of a streamed body.

## Hash a fixed inline script instead

> [!WARNING]
> A nonce is per response, so an HTML response stored in a shared cache replays one nonce to every
> visitor, and anyone who reads it can run a script under it.

For a script whose text never changes, list its hash instead. The policy module exports
`BOOT_SCRIPT` and lists its `sha256-…` source as a literal, and a test fails when the two drift
apart:

```typescript {% title="config/security-policy.test.ts" %}
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

Hashing in a test keeps the work out of the Worker's global scope and off every cold start.

## Collect reports before enforcing

`reportTo: "csp"` names the endpoint `reportingEndpoints` points at. `parseReports` reads both
report formats browsers send into one violation shape.

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

Declare the route as `cspReports: post("/reports/csp")`. The slice caps how much one crafted
batch can write to your logs. When the only violations left are browser extensions, rename
`contentSecurityPolicyReportOnly` to `contentSecurityPolicy` and the policy is enforced. A route
that has to differ, such as an embeddable widget, patches its own response with
`securityHeadersOverride` instead of weakening the policy for every page.

## Publish security.txt

RFC 9116's `/.well-known/security.txt` is where a researcher looks for your security contact:

```typescript {% title="config/security-txt.ts" %}
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
`@sdxc/well-known/security-txt` — near the top of the chain, before session work. Keep
`expires` a literal date, and add a test that fails 30 days before it with
`isExpired(SECURITY_TXT, thirtyDaysFromNow)`, so a stale contact cannot go unnoticed.

## Test the headers

Request a page your app maps, `/` here, through the router and read the headers back, then post
a report the way an older browser does:

```typescript {% title="app/http/controllers/csp-reports.test.ts" %}
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import routes from "~/routes/web";

test("every page carries the policy", async () => {
	let response = await createWebRouter().fetch(new URL("/", "https://example.com"));

	expect(response.headers.get("Content-Security-Policy-Report-Only")).toContain(
		"frame-ancestors 'none'",
	);
	expect(response.headers.get("Strict-Transport-Security")).toContain(
		"max-age=31536000",
	);
});

test("accepts a legacy violation report", async () => {
	let response = await createWebRouter().fetch(
		new Request(new URL(routes.cspReports.href(), "https://example.com"), {
			method: "POST",
			headers: { "Content-Type": "application/csp-report" },
			body: JSON.stringify({
				"csp-report": {
					"document-uri": "https://example.com/",
					"blocked-uri": "https://evil.example.com/x.js",
					"violated-directive": "script-src",
				},
			}),
		}),
	);

	expect(response.status).toBe(204);
});
```

The request URL is `https:`, because `Strict-Transport-Security` is written only on a response to
a secure request.

## Where to go next

- [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) — the
  challenge whose origin this policy allows.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — querying the
  `csp.violation` events.
- [`@sdxc/security-headers`](/api/security-headers) — every directive, `override`, and reading a
  policy back with `parse`.
