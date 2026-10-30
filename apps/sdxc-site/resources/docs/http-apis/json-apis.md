---
title: Build a JSON API with problem details
description: A small resource API that validates bodies, answers failures as RFC 9457 problems, pages its lists and states its rate limit.
section:
    title: HTTP APIs
    order: 5
order: 1
lastUpdated: 2026-10-25
outcomes:
    - "How to declare a problem catalog and answer failures as RFC 9457 problems"
    - "How to validate a body, create a resource and page the list"
    - "How to rate limit the API with `@sdxc/rate-limit`"
---

This guide builds a books API in a Remix v3 app: list the books, create one, and read one
back. Every failure answers as an RFC 9457 problem document from
[`@sdxc/problem`](/api/problem), bodies are checked by [`@sdxc/validate`](/api/validate),
lists page by cursor with [`@sdxc/pagination`](/api/pagination), and
[`@sdxc/rate-limit`](/api/rate-limit) counts every call.

```bash
npm add @sdxc/get-client-ip @sdxc/http @sdxc/lazy-route @sdxc/pagination @sdxc/problem \
	@sdxc/rate-limit @sdxc/result @sdxc/validate remix
npm add -D @sdxc/cloudflare-mocks
```

The handlers read the database as `ctx.db`, published by middleware as described in
[Wire the router](/docs/building-remix-apps/wire-the-router), and hang on three routes:

```typescript {% title="routes/api.ts" %}
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

[`sdxc scaffold`](/docs/sdxc/scaffold-a-resource) can write a whole resource like this one;
this guide writes each piece by hand, so you can see what it does.

## Declare the problem catalog

A client branches on a problem's `type`, so every failure deserves a stable URI.
`defineProblems` declares each one once, and every entry becomes a builder:

```typescript {% title="config/problems.ts" %}
import { defineProblems, ISSUES_SCHEMA } from "@sdxc/problem";
import * as s from "remix/data-schema";

export default defineProblems("https://books.example.com/docs/errors/", {
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

The `extensions` schema types the builder's argument, so `validationFailed` compiles only
with its `errors`. `problems.entries()` lists every entry, for an error reference page.

> [!NOTE]
> End the base URL with `/`. Each `type` is the base followed by the slug, so a base without the
> trailing slash runs into it, and every `type` names a page such as `…/errorsnot-found`.

## Validate the body and create

Describe the body and the path params as `remix/data-schema` schemas, in a module every
handler imports. A param schema that accepts only your ids' shape answers a malformed id
`404` without a query.

```typescript {% title="app/http/validators/books.ts" %}
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

`validate` reads a `Request` by its `Content-Type` and answers with a `Result`. `issuesFrom`
turns the schema's issues into `errors` entries whose `pointer` is a JSON Pointer into the
body:

```typescript {% title="app/http/controllers/api/books/create.ts" %}
import { created } from "@sdxc/http/response/json";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import Book, { serializeBook } from "~/app/models/book";
import { BOOK_INPUT } from "~/app/http/validators/books";
import problems from "~/config/problems";
import routes from "~/routes/api";

export default createAction(routes.api.books.create, async (ctx) => {
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

`Book` is the app's own model, and `serializeBook` maps a row to the public shape, so a
renamed column never changes the API. A `422` answer reads like this:

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

Path params are input too, so `show` validates them with `BOOK_PARAMS` before it queries:

```typescript {% title="app/http/controllers/api/books/show.ts" %}
import { ok } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import Book, { serializeBook } from "~/app/models/book";
import { BOOK_PARAMS } from "~/app/http/validators/books";
import problems from "~/config/problems";
import routes from "~/routes/api";

export default createAction(routes.api.books.show, async (ctx) => {
	let params = await validate(ctx.params, BOOK_PARAMS);
	if (isFailure(params))
		return problems.notFound({ detail: "No book has that id." });

	let book = await Book.find(ctx.db, params.data.bookId);
	if (book === null) return problems.notFound({ detail: "No book has that id." });

	return ok({ book: serializeBook(book) });
});
```

## Page the list

A books table only grows, so the list pages by keyset: each page ends in an opaque cursor the
next request seeks from. `createPaging` binds the parameter names and limits once:

```typescript {% title="app/http/controllers/api/books/index.ts" %}
import { ok } from "@sdxc/http/response/json";
import { createPaging, InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { serializeBook } from "~/app/models/book";
import problems from "~/config/problems";
import { books } from "~/database/schema";
import routes from "~/routes/api";

const paging = createPaging({ perPage: 25, maxPerPage: 100 });

export default createAction(routes.api.books.index, async (ctx) => {
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

The ordering ends in `id` so two books created in the same millisecond never share a
boundary. The response carries `rel="next"` and `rel="prev"` links;
[Paginate lists](/docs/http-apis/paginate-lists) covers offset paging and HTML pagers.

## Rate limit the API

`rateLimit` counts each request before the handler runs and writes the `RateLimit-Policy`
header onto the response. A refused request also gets `Retry-After`, and `onLimit` answers it
with an entry from your catalog:

```typescript {% title="app/http/middleware/api-rate-limit.ts" %}
import { env } from "cloudflare:workers";
import { getClientIP } from "@sdxc/get-client-ip";
import { addressKey, CloudflareAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";

import problems from "~/config/problems";

export function apiRateLimit() {
	let limit = { limit: 100, window: "1 minute" } as const;
	return rateLimit({
		adapter: new CloudflareAdapter(env.API_RATE_LIMITER, limit),
		prefix: "api",
		key: (ctx) => addressKey(getClientIP(ctx.request)),
		onLimit: () =>
			problems.rateLimited({ detail: "Wait for the time in Retry-After." }),
	});
}
```

`API_RATE_LIMITER` is a Workers rate limiting binding.

> [!WARNING]
> Give the adapter the same `limit` and `window` as the binding's own configuration. The binding
> does the counting and the adapter only uses the numbers to describe it, so a mismatch writes
> `RateLimit-Policy` and `Retry-After` headers that tell callers the wrong budget.

`addressKey` keys the budget on the caller's network: the address for IPv4, its `/64` for
IPv6. Once your API authenticates callers, key on their identity instead.

Map each controller through `lazy()` with the limiter as its second argument, so a caller
over budget is answered before any controller loads. Your router also runs the global
middleware that publishes `ctx.db`:

```typescript {% title="app/initializers/router.tsx" %}
import { lazy } from "@sdxc/lazy-route";
import { createRouter } from "remix/router";

import { apiRateLimit } from "~/app/http/middleware/api-rate-limit";
import routes from "~/routes/api";

export function createWebRouter() {
	let router = createRouter();
	let limit = [apiRateLimit()];
	router.map(
		routes.api.books.index,
		lazy(() => import("~/app/http/controllers/api/books/index"), limit),
	);
	router.map(
		routes.api.books.create,
		lazy(() => import("~/app/http/controllers/api/books/create"), limit),
	);
	router.map(
		routes.api.books.show,
		lazy(() => import("~/app/http/controllers/api/books/show"), limit),
	);
	return router;
}
```

## Test the endpoints

A route test sends a `Request` through the router, so the limiter, the validation and the
catalog all run. Add the limiter's binding to the `cloudflare:workers` stand-in, with the
same numbers as the adapter:

```typescript {% title="app/test/cloudflare-workers.ts" %}
import { createD1Database, createRateLimit } from "@sdxc/cloudflare-mocks";

export const env = {
	DB: createD1Database(),
	API_RATE_LIMITER: createRateLimit({ limit: 100, period: 60 }),
} as Partial<Cloudflare.Env> as Cloudflare.Env;
```

Both cases below are refused before any query runs, so they need no rows:

```typescript {% title="app/http/controllers/api/books/create.test.ts" %}
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

test("a refused body answers 422 with a pointer to the field", async () => {
	let response = await createWebRouter().fetch(
		new Request("https://books.example.com/api/books", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Kindred", author: "Octavia E. Butler" }),
		}),
	);

	expect(response.status).toBe(422);
	expect(response.headers.get("Content-Type")).toContain(
		"application/problem+json",
	);
	expect(await response.json()).toMatchObject({
		type: "https://books.example.com/docs/errors/validation-failed",
		errors: [{ pointer: "/year" }],
	});
});

test("a malformed id answers 404 and states the rate limit policy", async () => {
	let response = await createWebRouter().fetch(
		"https://books.example.com/api/books/not-an-id",
	);

	expect(response.status).toBe(404);
	expect(response.headers.get("RateLimit-Policy")).toBe('"default";q=100;w=60');
});
```

## Where to go next

- [Describe your API with OpenAPI](/docs/http-apis/openapi) — publish these schemas and
  problems as an OpenAPI 3.1 document.
- [Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) — make `create` safe
  to retry and add a partial update.
- [Write a typed API client](/docs/http-apis/api-clients) — consume this API with the same
  catalog.
