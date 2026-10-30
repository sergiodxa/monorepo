---
title: Canonical URLs, lazy routes and header fields
description: Redirect to one canonical host and path, end a request with a thrown Response, load routes on demand, and read structured header fields.
section:
    title: Building Remix apps
    order: 4
order: 7
lastUpdated: 2026-10-25
outcomes:
    - "How to redirect to one canonical host and path with the trailing-slash and no-www middleware"
    - "How to end a request from any depth by throwing a `Response`"
    - "How to import each route on first use and read structured header fields"
---

A few small decisions around the router pay off across every route: which spelling of a URL
is the real one, how a helper deep in a handler ends the request, how much code a cold Worker
evaluates before it answers, and how you read a header that has more structure than a single
word. Each has a package, and each takes a line or two in the composition root from
[Wire the router](/docs/building-remix-apps/wire-the-router).

[`@sdxc/no-www-middleware`](/api/no-www-middleware) keeps the site on one host,
[`@sdxc/trailing-slash-middleware`](/api/trailing-slash-middleware) picks one form of every
path, [`@sdxc/catch-response-middleware`](/api/catch-response-middleware) turns a thrown
`Response` into the answer, [`@sdxc/lazy-route`](/api/lazy-route) imports a route's module on
the first request that reaches it, and [`@sdxc/structured-fields`](/api/structured-fields)
parses the RFC 9651 header values that newer HTTP fields use.

```bash
npm add @sdxc/catch-response-middleware @sdxc/http @sdxc/lazy-route @sdxc/logger \
	@sdxc/no-www-middleware @sdxc/result @sdxc/structured-fields \
	@sdxc/trailing-slash-middleware remix
```

## Redirect to one canonical host and path

`/pricing` and `/pricing/`, or `www.example.com` and `example.com`, are two URLs to a search
engine, a cache and an analytics query. `noWWW()` makes the apex domain the only host, and
`trailingSlash()` with no options makes the slash-free path canonical:

```typescript {% title="app/initializers/router.ts" %}
import { log } from "@sdxc/logger/middleware";
import { noWWW } from "@sdxc/no-www-middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

import pricing from "~/app/http/controllers/pricing";
import routes from "~/routes/web";

import { logger } from "./logger";

export function createWebRouter() {
	let router = createRouter({
		middleware: [log(logger), noWWW(), trailingSlash()],
	});
	router.map(routes.pricing, pricing);
	return router;
}
```

Each answers `308` and changes only its own part of the URL, so the query string survives and a
form posted to `/comments/` still arrives at `/comments` as a `POST`. Put both right after
`log(logger)`, where `logger` is the one from Wire the router, so a redirected request skips
the session and body parsing its retry is about to do anyway.

> [!WARNING]
> Browsers cache a `308`, so switching a live site between `trailingSlash()` and
> `{ mode: "always" }` sends returning visitors into a loop until those entries expire. Pick once.

> [!NOTE]
> The `www.` host must still reach the Worker for the redirect to run, so route it to the same
> Worker as the apex domain.

A test sends the router a request for that host and reads both hops:

```typescript {% title="app/initializers/router.test.ts" %}
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

test("the www. host redirects to the apex domain, then the slash goes", async () => {
	let router = createWebRouter();

	let first = await router.fetch(new Request("https://www.example.com/pricing/"));
	expect(first.status).toBe(308);
	expect(first.headers.get("Location")).toBe("https://example.com/pricing/");

	let location = first.headers.get("Location") ?? "";
	let second = await router.fetch(new Request(location));
	expect(second.status).toBe(308);
	expect(second.headers.get("Location")).toBe("https://example.com/pricing");
});
```

## End a request from any depth

A helper that needs a signed-in user can end the request itself by throwing a redirect.
`catchResponse()` catches a thrown `Response` and answers with it, where the router alone would
turn it into a `500`:

```typescript {% title="app/services/require-user.ts" %}
import { redirect } from "@sdxc/http/response";

import { currentUser } from "~/app/services/current-user";
import routes from "~/routes/web";

export async function requireUser() {
	let user = await currentUser();
	if (user === null) {
		throw redirect(routes.login.href(), { status: redirect.Status.SeeOther });
	}
	return user;
}
```

Every call site gets a user, with no branch of its own:

```tsx {% title="app/http/controllers/billing.tsx" %}
import { createAction } from "remix/router";

import { requireUser } from "~/app/services/require-user";
import { Invoices } from "~/app/models/invoices";
import { BillingPage } from "~/resources/views/billing";
import routes from "~/routes/web";

export default createAction(routes.billing, async (ctx) => {
	let user = await requireUser();
	let invoices = await Invoices.forAccount(ctx.db, user.accountId);
	return ctx.render(<BillingPage invoices={invoices} />);
});
```

`currentUser` is your own lookup of the session's user. Anything thrown that is not a `Response`
is rethrown as it was, so a real bug still reaches the runtime with its stack.

> [!WARNING]
> A throw unwinds the chain, so a middleware between the throw and the catch never resumes
> after its own `next()`, and whatever it meant to add to the response is lost. Put
> `catchResponse()` below every middleware that reads or decorates the response, such as the
> session middleware that commits the `Set-Cookie`, as the router in
> [Import each route on first use](#import-each-route-on-first-use) does.

A test asks for the billing page with no session and reads the redirect `requireUser` threw:

```typescript {% title="app/http/controllers/billing.test.ts" %}
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import routes from "~/routes/web";

test("sends a visitor with no session to the login page", async () => {
	let response = await createWebRouter().fetch(
		new Request(new URL(routes.billing.href(), "https://example.com")),
	);

	expect(response.status).toBe(303);
	expect(response.headers.get("Location")).toBe(routes.login.href());
});
```

## Import each route on first use

A Worker evaluates its whole module graph when a cold isolate starts, so with every controller
imported statically a request for `/pricing` pays for the admin area too. `lazy()` keeps the
route mapped, so matching and `href()` are unchanged, and imports the module on the first
request that matches:

```typescript {% title="app/initializers/router.ts" %}
import type { Middleware } from "remix/router";

import { catchResponse } from "@sdxc/catch-response-middleware";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { noWWW } from "@sdxc/no-www-middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

import { requireAdmin } from "~/app/http/middleware/require-admin";
import routes from "~/routes/web";

import { logger } from "./logger";

const ADMIN: Middleware[] = [requireAdmin];

export function createWebRouter() {
	let router = createRouter({
		middleware: [
			log(logger),
			noWWW(),
			trailingSlash(),
			// …your session, formData() and renderer middleware
			catchResponse(),
		],
	});
	router.map(
		routes.pricing,
		lazy(() => import("~/app/http/controllers/pricing")),
	);
	router.map(
		routes.billing,
		lazy(() => import("~/app/http/controllers/billing")),
	);
	router.map(
		routes.admin,
		lazy(() => import("~/app/http/controllers/admin"), ADMIN),
	);
	return router;
}
```

The loader runs at most once per isolate. The second argument holds guards: `requireAdmin`
answers an unauthorized request before the admin module loads. A guard there must publish
nothing onto the context; publish values from the router's chain instead.

> [!NOTE]
> Write each loader as a bare `import()` of a fixed path, so the bundler splits it into its own
> chunk. A computed specifier lands in the main bundle, and the deferral saves nothing.

## Read structured header fields

Newer HTTP fields share one grammar, RFC 9651: `Priority`, `Cache-Status`, `RateLimit` and
`Idempotency-Key` are each a List, a Dictionary or an Item of typed values, and splitting them on
commas by hand breaks on a quoted comma. When your Worker fetches from an origin behind a CDN,
`Cache-Status` says which caches answered. Describe a hop once with the `sf` builders, which
compose with `remix/data-schema`:

```typescript {% title="app/services/cache-status.ts" %}
import { isSuccess } from "@sdxc/result";
import { getField } from "@sdxc/structured-fields";
import { sf } from "@sdxc/structured-fields/schema";
import * as s from "remix/data-schema";

const HOP = sf.item(
	s.union([sf.token(), s.string()]),
	s.object({
		hit: s.optional(s.boolean()),
		fwd: s.optional(sf.token()),
		ttl: s.optional(sf.integer()),
	}),
);

export function servedFromCache(response: Response): boolean {
	let hops = getField(response.headers, "Cache-Status", "list", s.array(HOP));
	if (!isSuccess(hops) || hops.data === null) return false;
	return hops.data.some((hop) => hop.params.hit === true);
}
```

`getField` answers `null` for an absent field and a failure for text that breaks the grammar or
a value your schema refuses; the RFC has a recipient ignore an invalid field, which is what
answering `false` does. [`@sdxc/rate-limit`](/api/rate-limit) writes the `RateLimit` field for
you, and `setField` writes any other.

Its test builds a response with the header a CDN writes:

```typescript {% title="app/services/cache-status.test.ts" %}
import { expect, test } from "vitest";

import { servedFromCache } from "~/app/services/cache-status";

function withCacheStatus(value: string) {
	return new Response(null, { headers: { "Cache-Status": value } });
}

test("reads a hit from any cache along the way", () => {
	expect(
		servedFromCache(withCacheStatus("ExampleCDN; hit, Origin; fwd=uri-miss")),
	).toBe(true);
	expect(servedFromCache(withCacheStatus("ExampleCDN; fwd=uri-miss"))).toBe(false);
	expect(servedFromCache(withCacheStatus('"unterminated'))).toBe(false);
});
```

## Where to go next

- [Wire the router: middleware, context and services](/docs/building-remix-apps/wire-the-router)
  — the composition root these middleware join.
- [SEO, sitemaps and robots.txt](/docs/building-remix-apps/seo-sitemaps-and-robots) — the
  canonical host and paths a sitemap should list.
- [Parse and write Link headers](/docs/http-apis/link-header) — RFC 8288 `Link`, which is
  not a structured field.
