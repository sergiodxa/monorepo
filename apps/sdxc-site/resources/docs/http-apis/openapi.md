---
title: Describe your API with OpenAPI
description: Turn the schemas your handlers validate with into an OpenAPI 3.1 document, serve it, and test responses against it.
section:
    title: HTTP APIs
    order: 5
order: 2
lastUpdated: 2026-10-25
outcomes:
    - "How to swap your schema import so `@sdxc/openapi` can read the same schemas"
    - "How to declare operations and build and serve an OpenAPI 3.1 document"
    - "How to test responses against the document"
---

An API reference written by hand drifts from the code. This guide takes the books API from
[Build a JSON API with problem details](/docs/http-apis/json-apis) and builds its OpenAPI 3.1
document from the same schemas the handlers validate with.
[`@sdxc/json-schema`](/api/json-schema) validates like `remix/data-schema` and also describes
itself as JSON Schema, and [`@sdxc/openapi`](/api/openapi) builds, serves and tests the
document.

```bash
npm add @sdxc/http @sdxc/json-schema @sdxc/openapi @sdxc/problem @sdxc/result remix
```

## Swap the schema import

`@sdxc/json-schema` has the same combinators as `remix/data-schema`, so the schema module
changes only its imports, and every handler keeps working. Add a `BOOK` schema for the
response:

```typescript {% title="app/http/validators/books.ts" %}
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";

export const BOOK = s
	.object({
		id: s.string(),
		title: s.string(),
		author: s.string(),
		year: s.integer(),
		summary: s.nullable(s.string()),
		createdAt: s.integer().meta({ description: "Epoch milliseconds" }),
	})
	.meta({ id: "Book" });

export const BOOK_INPUT = s.object({
	title: s.string().pipe(checks.minLength(1), checks.maxLength(200)),
	author: s.string().pipe(checks.minLength(1), checks.maxLength(200)),
	year: s.integer().pipe(checks.min(1450), checks.max(2100)),
	summary: s.optional(s.string().pipe(checks.maxLength(2000))),
});

export const BOOK_PARAMS = s.object({
	bookId: s.string().pipe(checks.minLength(26), checks.maxLength(26)),
});
```

`meta({ id: "Book" })` puts the schema in `components.schemas`, so every use is a `$ref`.

> [!NOTE]
> Make the same import change in `config/problems.ts`. The document describes every problem
> type in the catalog, so extension schemas from `remix/data-schema` fail the build.

## Declare the operations

An operation binds one route to what it reads and answers; the first argument is its unique
`operationId`. Declare the operations in `routes/api.ts`, after the contract, so building
the document never loads a controller:

```typescript {% title="routes/api.ts" %}
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import * as coerce from "@sdxc/json-schema/coerce";
import { defineOperation } from "@sdxc/openapi";
import { get, post, route } from "remix/routes";

import { BOOK, BOOK_INPUT, BOOK_PARAMS } from "~/app/http/validators/books";

const routes = route({
	api: {
		books: {
			index: get("/api/books"),
			create: post("/api/books"),
			show: get("/api/books/:bookId"),
		},
	},
});

export default routes;

export const LIST_BOOKS = defineOperation("listBooks", routes.api.books.index, {
	summary: "List books",
	query: s.object({
		cursor: s.optional(s.string()),
		perPage: s.optional(coerce.number().pipe(checks.min(1), checks.max(100))),
	}),
	responses: {
		200: {
			description: "A page of books, newest first",
			body: s.object({ books: s.array(BOOK) }),
			headers: {
				Link: { schema: s.string(), description: "Next and prev pages" },
			},
		},
	},
	problems: ["validationFailed", "badRequest", "rateLimited"],
});

export const CREATE_BOOK = defineOperation("createBook", routes.api.books.create, {
	summary: "Create a book",
	body: BOOK_INPUT,
	responses: { 201: { description: "The book", body: s.object({ book: BOOK }) } },
	problems: ["validationFailed", "rateLimited"],
});

export const SHOW_BOOK = defineOperation("showBook", routes.api.books.show, {
	summary: "Show a book",
	params: BOOK_PARAMS,
	responses: { 200: { description: "The book", body: s.object({ book: BOOK }) } },
	problems: ["notFound", "rateLimited"],
});
```

`coerce.number()` accepts the text a query string carries. The `problems` names come from
your catalog, so a name the catalog lacks fails to compile.

## Parse through the operation

`operation.parse` validates params, query and body, and answers with a `Result`, so the
handler gets typed input from the same declaration the reference is built from:

```typescript {% title="app/http/controllers/api/books/create.ts" %}
import { created } from "@sdxc/http/response/json";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import Book, { serializeBook } from "~/app/models/book";
import problems from "~/config/problems";
import routes, { CREATE_BOOK } from "~/routes/api";

export default createAction(routes.api.books.create, async (ctx) => {
	let input = await CREATE_BOOK.parse(ctx.request, ctx.params);
	if (isFailure(input)) {
		let errors = issuesFrom(input.error);
		return problems.validationFailed({ extensions: { errors } });
	}

	let book = await Book.create(ctx.db, input.data.body);
	let location = routes.api.books.show.href({ bookId: book.id });
	return created(
		{ book: serializeBook(book) },
		{ headers: { Location: location } },
	);
});
```

The failure's `location` says which part failed (`"params"`, `"query"` or `"body"`); in
`show`, a `"params"` failure answers `notFound`. The list handler keeps parsing with its
`createPaging` binding, so keep `LIST_BOOKS`'s `query` schema beside it with the same limits.

## Build and serve the document

`createDocument` collects the operations and the catalog. `build()` assembles it and fails
on a duplicate `operationId` or a schema without a JSON Schema form:

```typescript {% title="app/initializers/openapi.ts" %}
import { createDocument } from "@sdxc/openapi";
import { bearer } from "@sdxc/openapi/security";

import problems from "~/config/problems";
import { CREATE_BOOK, LIST_BOOKS, SHOW_BOOK } from "~/routes/api";

export function buildApiDocument() {
	return createDocument({
		info: { title: "Books API", version: "1" },
		servers: [{ url: "https://books.example.com" }],
		securitySchemes: {
			apiKey: bearer({ description: "An API key as a bearer token" }),
		},
		problems,
	}).add(LIST_BOOKS, CREATE_BOOK, SHOW_BOOK);
}
```

An operation that requires a key declares `security: [{ apiKey: ["books:write"] }]`. Add `openapi: get("/api/openapi.json")` to the `api` group of the route contract, then serve
it:

```typescript {% title="app/http/controllers/api/openapi.ts" %}
import { openapiHandler } from "@sdxc/openapi/router";
import { createAction } from "remix/router";

import { buildApiDocument } from "~/app/initializers/openapi";
import routes from "~/routes/api";

export default createAction(
	routes.api.openapi,
	openapiHandler(() => buildApiDocument().build()),
);
```

> [!WARNING]
> Keep `build()` inside the function you hand to `openapiHandler`. Called at module scope, the
> assembly runs during the Worker's startup, whose time Cloudflare limits, so a slow build can
> fail the deploy.

The handler answers JSON by default and YAML for `?format=yaml`, with an `ETag` a client
revalidates against.

## Keep it honest in tests

Commit the serialized document, so every contract change arrives as a reviewable diff in the
commit that makes it:

```typescript {% title="app/initializers/openapi.test.ts" %}
import { stringify } from "@sdxc/openapi";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { buildApiDocument } from "~/app/initializers/openapi";

test("the document builds and matches the committed snapshot", async () => {
	let document = unwrap(buildApiDocument().build());
	await expect(unwrap(stringify(document))).toMatchFileSnapshot(
		"./openapi.snapshot.json",
	);
});
```

`checkResponse` from `@sdxc/openapi/testing` proves the handlers answer what the document
says, reporting an undocumented status, an unlisted problem `type` or a body that fails its
schema:

```typescript {% title="app/http/controllers/api/books/create.test.ts" %}
import { checkResponse } from "@sdxc/openapi/testing";
import { isFailure } from "@sdxc/result";
import { expect, test } from "vitest";

import { buildApiDocument } from "~/app/initializers/openapi";
import { createWebRouter } from "~/app/initializers/router";

let router = createWebRouter();

test("a refused create answers as documented", async () => {
	let request = new Request("https://books.example.com/api/books", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ title: "", author: "Octavia E. Butler", year: 1979 }),
	});
	let response = await router.fetch(request);

	let result = await checkResponse(buildApiDocument(), request, response);
	if (isFailure(result)) expect(result.error.violations).toEqual([]);
	expect(response.status).toBe(422);
});
```

## Where to go next

- [Build a JSON API with problem details](/docs/http-apis/json-apis) — the API this document
  describes.
- [Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) — document a
  `PATCH` with both `application/merge-patch+json` and `application/json` bodies.
- [Write a typed API client](/docs/http-apis/api-clients) — validate responses with the same
  schemas on the other side.
