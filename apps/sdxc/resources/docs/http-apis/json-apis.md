---
title: Build a JSON API with problem details
description: A small resource API that validates bodies, answers failures as RFC 9457 problems, pages its lists and states its rate limit.
section:
    title: HTTP APIs
    order: 4
order: 1
lastUpdated: 2026-10-05
---

This guide builds a books API in a Remix v3 app: list the books, create one, and read one
back. Every failure answers as an RFC 9457 problem document, lists page by cursor with `Link`
headers, and every response states how much of the caller's rate limit is left.

Six packages do the work. [`@sdxc/validate`](/api/validate) checks the body against a
`remix/data-schema` schema, [`@sdxc/http`](/api/http) names the success statuses,
[`@sdxc/problem`](/api/problem) names the failures, [`@sdxc/pagination`](/api/pagination)
pages the list, [`@sdxc/rate-limit`](/api/rate-limit) counts the calls, and
[`@sdxc/get-client-ip`](/api/get-client-ip) names the caller they are counted against.

```bash
npm add @sdxc/validate @sdxc/http @sdxc/problem @sdxc/pagination \
	@sdxc/rate-limit @sdxc/get-client-ip @sdxc/result
```

The handlers read the database as `ctx.db`, published by middleware as described in
[Wire the router](/docs/building-remix-apps/wire-the-router), and hang on three routes in
the app's route table:

```typescript {% title="routes/web.ts" %}
import { get, post, route } from "remix/routes";

export default route({
	api: {
		books: {
			index: get("/api/books"),
			create: post("/api/books"),
			show: get("/api/books/:bookId"),
		},
	},
});
```

## Declare the problem catalog

A client branches on a problem's `type`, so every failure the API can answer with deserves a
stable URI. `defineProblems` writes each one once: the slug, the status and the title. Every
entry becomes a builder, so a handler supplies only what differs per occurrence.

```typescript {% title="app/services/problems.ts" %}
import { defineProblems, ISSUES_SCHEMA } from "@sdxc/problem";
import * as s from "remix/data-schema";

export const problems = defineProblems("https://books.example.com/docs/errors/", {
	badRequest: {
		slug: "bad-request",
		status: 400,
		title: "The request is malformed",
	},
	notFound: {
		slug: "not-found",
		status: 404,
		title: "The resource does not exist",
	},
	validationFailed: {
		slug: "validation-failed",
		status: 422,
		title: "The request failed validation",
		extensions: s.object({ errors: ISSUES_SCHEMA }),
	},
	rateLimited: { slug: "rate-limited", status: 429, title: "Too many requests" },
	internal: {
		slug: "internal",
		status: 500,
		title: "The request failed on the server",
	},
});
```

The base URL must end in `/`, and each `type` should resolve to a page describing the error:
`problems.entries()` lists every entry with its resolved `type`, which is what an error
reference page renders from. The `extensions` schema types the builder's argument, so
`validationFailed` will not compile without its `errors`.

## Validate the body and create

The body and the path params are described as `remix/data-schema` schemas, in a module of
their own so every handler and the later guides import the same values. A path param schema
that only accepts the shape your ids have lets a malformed id answer `404` without a query,
since no book can have it.

```typescript {% title="app/http/schemas/books.ts" %}
import * as s from "remix/data-schema";
import { max, maxLength, min, minLength } from "remix/data-schema/checks";

export const BOOK_INPUT = s.object({
	title: s.string().pipe(minLength(1), maxLength(200)),
	author: s.string().pipe(minLength(1), maxLength(200)),
	year: s.number().pipe(min(1450), max(2100)),
	summary: s.optional(s.string().pipe(maxLength(2000))),
});

export const BOOK_PARAMS = s.object({
	bookId: s.string().pipe(minLength(26), maxLength(26)),
});
```

`validate` reads a `Request` according to its `Content-Type` and answers with a `Result`, so
a refused body is a branch rather than an exception. `issuesFrom` turns the schema's issues
into `errors` entries whose `pointer` is a JSON Pointer into the body.

```typescript {% title="app/http/controllers/api/books/create.ts" %}
import { created } from "@sdxc/http/response/json";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import Book, { serializeBook } from "~/app/data/book";
import { BOOK_INPUT } from "~/app/http/schemas/books";
import { problems } from "~/app/services/problems";
import routes from "~/routes/web";

export const create = createAction(routes.api.books.create, async (ctx) => {
	let input = await validate(ctx.request, BOOK_INPUT);
	if (isFailure(input)) {
		let errors = issuesFrom(input.error);
		return problems.validationFailed({ extensions: { errors } });
	}

	let book = await Book.create(ctx.db, input.data);
	let location = routes.api.books.show.href({ bookId: book.id });
	return created(
		{ book: serializeBook(book) },
		{ headers: { Location: location } },
	);
});
```

`Book` is the app's own data module, with `create`, `find` and `update` over the books
table, and `serializeBook` maps a row to the public shape. Keep that mapping explicit: the
JSON a client sees is a contract, and a renamed column should not change it.

A `422` answer reads like this, which a client can map straight onto its form fields:

```json
{
	"type": "https://books.example.com/docs/errors/validation-failed",
	"title": "The request failed validation",
	"status": 422,
	"errors": [
		{ "pointer": "/year", "code": "invalid", "message": "Expected number" }
	]
}
```

## Answer a missing resource

Path params are input too, so `show` validates them with `BOOK_PARAMS` before it queries.

```typescript {% title="app/http/controllers/api/books/show.ts" %}
import { ok } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import Book, { serializeBook } from "~/app/data/book";
import { BOOK_PARAMS } from "~/app/http/schemas/books";
import { problems } from "~/app/services/problems";
import routes from "~/routes/web";

export const show = createAction(routes.api.books.show, async (ctx) => {
	let params = await validate(ctx.params, BOOK_PARAMS);
	if (isFailure(params))
		return problems.notFound({ detail: "No book has that id." });

	let book = await Book.find(ctx.db, params.data.bookId);
	if (book === null) return problems.notFound({ detail: "No book has that id." });

	return ok({ book: serializeBook(book) });
});
```

Each builder also takes `instance`, a URI for this one occurrence. A fresh
`urn:uuid:` value there gives a caller something to quote in a support request that you can
find in your logs.

## Page the list

A books table only grows, so the list pages by keyset: each page ends in an opaque cursor,
and the next request seeks from it instead of counting and skipping rows. `createPaging`
binds the parameter names and limits once, so the names you parse are the names the `Link`
header advertises.

```typescript {% title="app/http/controllers/api/books/index.ts" %}
import { ok } from "@sdxc/http/response/json";
import { createPaging, InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { serializeBook } from "~/app/data/book";
import { problems } from "~/app/services/problems";
import { books } from "~/database/schema";
import routes from "~/routes/web";

const paging = createPaging({ perPage: 25, maxPerPage: 100 });

export const index = createAction(routes.api.books.index, async (ctx) => {
	let params = paging.parse(ctx.url.searchParams);
	if (isFailure(params)) {
		let errors = issuesFrom(params.error);
		return problems.validationFailed({ extensions: { errors } });
	}

	let page = await Pagination.byKeyset(ctx.db.query(books), {
		orderBy: [
			["created_at", "desc"],
			["id", "desc"],
		],
		cursor: params.data.cursor,
		limit: params.data.perPage,
	});
	if (isFailure(page)) {
		if (page.error instanceof InvalidCursorError) return problems.badRequest();
		return problems.internal();
	}

	let headers = paging.paginate(new Headers(), page.data, { url: ctx.url });
	return ok({ books: page.data.items.map(serializeBook) }, { headers });
});
```

The ordering ends in `id` because two books created in the same millisecond would otherwise
share a boundary and one of them would be skipped or served twice; `byKeyset` refuses a
single non-unique sort key for that reason. The response carries `rel="next"` and
`rel="prev"` links, and a client walks the list by following them.

A numbered pager wants offset paging instead: `Pagination.byOffset` counts the query, and the
same `paginate` call then writes `first`, `last` and an `X-Total-Count` header.

## Rate limit the API

`rateLimit` counts each request before the handler runs and writes the `RateLimit` and
`RateLimit-Policy` headers onto whatever comes back. `onLimit` replaces the default `429` body
with an entry from your catalog, and the quota headers, `Retry-After` included, are applied to
it either way.

```typescript {% title="app/http/middleware/api-rate-limit.ts" %}
import { env } from "cloudflare:workers";
import { getClientIP } from "@sdxc/get-client-ip";
import { CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";

import { problems } from "~/app/services/problems";

export function apiRateLimit() {
	let limit = { limit: 100, window: "1 minute" } as const;
	return rateLimit({
		adapter: new CloudflareAdapter(env.API_RATE_LIMITER, limit),
		prefix: "api",
		key: (ctx) =>
			getClientIP(ctx.request)?.network({ v4: 32, v6: 64 }).toString() ??
			"unknown",
		onLimit: () =>
			problems.rateLimited({ detail: "Wait for the time in Retry-After." }),
	});
}
```

`API_RATE_LIMITER` is a Workers rate limiting binding, and the adapter's `limit` and `window`
must mirror the binding's own: the binding does the counting, and the adapter uses the
numbers to compute the reset. `getClientIP` parses the `CF-Connecting-IP` header into an
address, and the key is the network it sits in: the address itself for IPv4, its `/64` for
IPv6, since an IPv6 client holds the whole block and could rotate through it. A request
without a parseable header shares the `"unknown"` budget. Once your API authenticates
callers, key on the caller's identity instead of the address, so one client cannot spend
another's budget.

Mount the limiter once over the three actions, so they share one budget per caller. The
`application()` below shows only that mapping; the app's own router also runs the global
middleware that publishes `ctx.db`:

```typescript {% title="bootstrap/app.tsx" %}
import { createRouter } from "remix/router";

import { create } from "~/app/http/controllers/api/books/create";
import { index } from "~/app/http/controllers/api/books/index";
import { show } from "~/app/http/controllers/api/books/show";
import { apiRateLimit } from "~/app/http/middleware/api-rate-limit";
import routes from "~/routes/web";

export default function application() {
	let router = createRouter();
	router.map(routes.api.books, {
		middleware: [apiRateLimit()],
		actions: { index, create, show },
	});
	return router;
}
```

## Where to go next

- [Describe your API with OpenAPI](/docs/http-apis/openapi) — publish these schemas and
  problems as an OpenAPI 3.1 document.
- [Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) — make `create` safe
  to retry and add a partial update.
- [Write a typed API client](/docs/http-apis/api-clients) — consume this API with the same
  catalog.
- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — the same
  schemas behind HTML forms.
