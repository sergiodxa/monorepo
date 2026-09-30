---
title: Canonical URLs, lazy routes and header fields
description: Redirect to one canonical path, end a request with a thrown Response, load routes on demand, and read structured headers.
section:
    title: Building Remix apps
    order: 3
order: 7
lastUpdated: 2026-09-29
---

A few small decisions around the router pay off across every route: which spelling of a URL
is the real one, how a helper deep in a handler ends the request, how much code a cold Worker
evaluates before it answers, and how you read a header that has more structure than a single
word. Each has a package, and each takes a line or two in the composition root from
[Wire the router](/docs/building-remix-apps/wire-the-router).

[`@sdxc/trailing-slash-middleware`](/api/trailing-slash-middleware) picks one form of every
path, [`@sdxc/catch-response-middleware`](/api/catch-response-middleware) turns a thrown
`Response` into the answer, [`@sdxc/lazy-route`](/api/lazy-route) imports a route's module on
the first request that reaches it, and [`@sdxc/structured-fields`](/api/structured-fields)
parses and writes the RFC 9651 header values that newer HTTP fields use.

```bash
npm add @sdxc/trailing-slash-middleware @sdxc/catch-response-middleware \
	@sdxc/lazy-route @sdxc/structured-fields @sdxc/result @sdxc/http remix
```

## One canonical path

`/pricing` and `/pricing/` are two URLs to a search engine, a cache and an analytics query,
even when your router answers both with the same page. Choose one and redirect the other.
`trailingSlash()` with no options makes the slash-free form canonical:

```typescript {% title="bootstrap/app.ts" %}
import type { Middleware } from "remix/router";

import { log } from "@sdxc/logger/middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

import pricing from "~/app/http/controllers/pricing";
import routes from "~/routes/web";

import { logger } from "./logger";

export default function application() {
	let middleware: Middleware[] = [log(logger) as Middleware, trailingSlash()];

	let router = createRouter({ middleware });
	router.map(routes.pricing, pricing);
	return router;
}
```

`GET /pricing/?plan=team` answers `308`, redirecting to `/pricing?plan=team`: only the path
changes, so the origin and the query string survive. A `308` makes the client repeat the
method and the body, so a form posted to `/comments/` still arrives at `/comments` as a
`POST`. `/` never redirects, and a run of slashes (`/pricing///`) collapses in one hop.

Put it near the top of the chain, right after `log(logger)`, where `logger` is the one from
Wire the router. A redirected request then skips the session lookup, the body parsing and
everything else its canonical retry is about to do anyway, while the log still records the
redirect. `{ mode: "always" }` makes the slashed form canonical instead and leaves a path whose
last segment has a dot, such as `/robots.txt` or `/feed.xml`, as it is.

Browsers cache a `308`, so switching a live site from one mode to the other sends returning
visitors into a loop until those entries expire. Pick once, and generate links in the
canonical form so a click never pays for the redirect; the middleware is for the links other
people write by hand.

## End a request from any depth

A helper that needs a signed-in user has two ways to say "there isn't one": return `null` and
make every caller check, or end the request itself. The router only reads the value a handler
returns, so a thrown `Response` escapes as a rejected promise and becomes a `500`.
`catchResponse()` catches it and answers with it, which makes the second way work:

```typescript {% title="app/http/require-user.ts" %}
import { redirect } from "@sdxc/http/response";

import { currentUser } from "~/app/http/session";
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

import { requireUser } from "~/app/http/require-user";
import { Invoices } from "~/app/repositories/invoices";
import { BillingPage } from "~/resources/views/billing";
import routes from "~/routes/web";

export default createAction(routes.billing, async (ctx) => {
	let user = await requireUser();
	let invoices = await Invoices.forAccount(ctx.db, user.accountId);
	return ctx.render(<BillingPage invoices={invoices} />);
});
```

`currentUser` is your own lookup of the session's user, reading the request through Remix's
`asyncContext()` middleware so it needs no argument. `catchResponse()` returns the thrown
response untouched, and anything that is not a `Response` is thrown again as it was, so a real
bug still reaches the runtime with its stack: this is not an error boundary.

Order matters. A throw unwinds the chain, so a middleware between the throw and the catch
never resumes after its own `next()`, and whatever it meant to add to the response is lost.
Put `catchResponse()` below every middleware that reads or decorates the response, such as
the session middleware that commits the `Set-Cookie`. The next section shows it in place.

## Import each route on first use

A Worker evaluates its whole module graph when an isolate starts, and a cold isolate can start
for any request. With every controller imported statically, a request for `/pricing` pays to
evaluate the admin area, the billing views and whatever those import. `lazy()` keeps the route
mapped at startup, so matching and `href()` are unchanged, and imports the module behind it on
the first request that matches:

```typescript {% title="bootstrap/app.ts" %}
import type { Middleware } from "remix/router";

import { catchResponse } from "@sdxc/catch-response-middleware";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

import { requireAdmin } from "~/app/http/middleware/require-admin";
import routes from "~/routes/web";

import { logger } from "./logger";

const ADMIN: Middleware[] = [requireAdmin];

export default function application() {
	let middleware: Middleware[] = [
		log(logger) as Middleware,
		trailingSlash(),
		// …your session, formData() and renderer middleware
		catchResponse(),
	];

	let router = createRouter({ middleware });
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

The loader runs at most once per isolate, and its module is reused for every request after
that. A module may default-export a `createAction` for a single route or a `createController`
for a route map; the router decides which shape it expects from the route you mapped, and the
stand-in is typed as the module's own default export, so pointing a route map at an action
module is still a type error at `router.map`. Middleware the module declares runs as it would
with a static import.

The second argument is for guards the composition root owns. `requireAdmin` runs before
anything the module declares, and it answers an unauthorized request before the admin module
is loaded at all, so a section most visitors cannot enter is never evaluated for them. It must
be middleware that publishes nothing onto the context, because the loaded handler's type
cannot learn about a value declared at the map call; publish those from the router's chain.

Write each loader as a bare `import()` of a fixed path, so the bundler splits it into its own
chunk. A computed specifier cannot be split, and the deferral saves nothing.

## Read and write structured header fields

Newer HTTP fields share one grammar, RFC 9651: `Priority`, `Cache-Status`, `RateLimit` and
`Idempotency-Key` are each a List, a Dictionary or an Item of typed values. Splitting them on
commas by hand works until a quoted string contains one. Every call to `@sdxc/structured-fields`
names the field's top-level type, because the RFC fixes it in the field's definition rather
than in the text.

When your Worker fetches from an origin behind a CDN, `Cache-Status` says which caches
answered. Describe a hop once, at module scope, with the `sf` builders, which compose with
`remix/data-schema`:

```typescript {% title="app/lib/cache-status.ts" %}
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

`getField` answers `null` for an absent field, a `StructuredFieldParseError` for text that
breaks the grammar, and a `ValidationError` for a well-formed value your schema refuses. The
RFC has a recipient ignore an invalid field as a whole, which is what `servedFromCache` does
by answering `false`. Parameters you do not list are dropped rather than refused, so a CDN that
adds its own keeps working. `servedFromCache(upstream)` is then a field for `ctx.log.set`, and
a request's log shows which origin calls a cache absorbed.

Writing goes the other way. An API that meters its callers reports what is left of the quota
on every response:

```typescript {% title="app/http/middleware/quota.ts" %}
import type { Middleware } from "remix/router";

import { json } from "@sdxc/http/response";
import { setField } from "@sdxc/structured-fields";

import { Quotas } from "~/app/repositories/quotas";

export const quota: Middleware = async (ctx, next) => {
	let key = ctx.request.headers.get("Authorization") ?? "anonymous";
	let usage = await Quotas.consume(ctx.db, key);

	let response =
		usage.remaining < 0
			? json({ error: "Quota exceeded" }, { status: 429 })
			: await next();

	let field = {
		limit: usage.limit,
		remaining: Math.max(0, usage.remaining),
		reset: usage.resetSeconds,
	};
	setField(response.headers, "RateLimit", field, "dictionary");
	return response;
};
```

`setField` serializes the value to the field's canonical text,
`RateLimit: limit=100, remaining=0, reset=30`, and replaces any earlier value. An integer
writes as an Integer and any other number as a Decimal; a string writes quoted, and a member
whose value is `true` writes as its bare key. It returns a `Result`: a value with no
representation, such as a string outside printable ASCII, fails with a
`StructuredFieldStringifyError` naming its `path`, and leaves the headers as they were.
`Quotas.consume` is your own counter, returning the limit, what remains, and the seconds until
the window resets.

## Where to go next

- [Wire the router: middleware, context and services](/docs/building-remix-apps/wire-the-router)
  — the composition root these middleware join.
- [SEO, sitemaps and robots.txt](/docs/building-remix-apps/seo-sitemaps-and-robots) — the
  canonical URLs a sitemap should list.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers) — caching
  the responses your own Worker serves.
- [Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) — another header,
  `Idempotency-Key`, that is a structured field.
