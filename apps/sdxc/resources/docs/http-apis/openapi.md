---
title: Describe your API with OpenAPI
description: Turn the schemas your handlers validate with into an OpenAPI 3.1 document, serve it, and test responses against it.
section:
    title: HTTP APIs
    order: 4
order: 2
lastUpdated: 2026-09-29
---

An API reference written by hand drifts from the code the day after it is published. This
guide takes the books API from [Build a JSON API with problem details](/docs/http-apis/json-apis)
and makes the schemas the handlers validate with the same values the published OpenAPI 3.1
document is built from, so the contract and its enforcement cannot disagree.

[`@sdxc/json-schema`](/api/json-schema) provides schema builders that validate exactly like
`remix/data-schema` and can also describe themselves as JSON Schema 2020-12.
[`@sdxc/openapi`](/api/openapi) binds those schemas to routes as operations, assembles the
document, serves it, and checks responses against it in tests.

```bash
npm add @sdxc/json-schema @sdxc/openapi
```

## Swap the schema import

A `remix/data-schema` schema validates, but nothing can read back what it accepts.
`@sdxc/json-schema` has the same combinators with the same names, so rewriting the schema
module from the first guide changes the import and the checks' subpath, and every handler
that imports it keeps working. It also adds `integer()`, which a reference can state and a
`number()` cannot, and a `BOOK` schema for the response the API answers with.

```typescript {% title="app/http/schemas/books.ts" %}
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

`meta({ id: "Book" })` hoists the schema into `components.schemas`, and every use becomes a
`$ref`, so the reference shows one `Book` rather than a copy per endpoint. A check from
`@sdxc/json-schema/checks` both validates and adds its keyword (`minLength`, `maximum`), so a
limit is written once.

Make the same change in the problem catalog, `app/services/problems.ts`: import `s` from
`@sdxc/json-schema` instead of `remix/data-schema`, so the `validationFailed` extensions can
be described. The document describes every problem type, and a schema without a JSON Schema
form fails the build.

## Declare the operations

An operation binds one route to what it reads and what it answers. The first argument
becomes the `operationId`, which must be unique across the document.

```typescript {% title="app/http/openapi/operations.ts" %}
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import * as coerce from "@sdxc/json-schema/coerce";
import { defineOperation } from "@sdxc/openapi";

import { BOOK, BOOK_INPUT, BOOK_PARAMS } from "~/app/http/schemas/books";
import routes from "~/routes/web";

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

`coerce.number()` accepts the text a query string carries and documents both forms. The
`problems` names come from your catalog, and adding an operation that lists a name the
catalog lacks fails to compile. `params` must name exactly the pattern's variables, so a
schema for `/api/books/:bookId` without `bookId` is a type error. `tags` and `description`
group and explain an operation in the rendered reference.

Keep this module free of handlers. It holds only schemas, so building the document never
loads a controller.

## Parse through the operation

`operation.parse` validates params, query and body in that order, reads the body by its
`Content-Type`, and answers with a `Result`. The handler gets typed input from the same
declaration the reference is built from.

```typescript {% title="app/http/controllers/api/books/create.ts" %}
import { created } from "@sdxc/http/response/json";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import Book, { serializeBook } from "~/app/data/book";
import { CREATE_BOOK } from "~/app/http/openapi/operations";
import { problems } from "~/app/services/problems";
import routes from "~/routes/web";

export const create = createAction(routes.api.books.create, async (ctx) => {
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

The failure is an `OperationInputError` whose `location` says which part failed
(`"params"`, `"query"` or `"body"`), and `issuesFrom` reads its issues directly. In `show`,
a failure in `"params"` is the one to answer with `notFound`, as before.

The list handler keeps parsing its query with the `createPaging` binding, because that binding
also writes the `Link` URLs. The `query` schema on `LIST_BOOKS` documents the same names and
limits, so keep the two side by side.

## Build and serve the document

`createDocument` collects the operations and the catalog. Nothing is assembled until
`build()`, which returns a `Result` and fails on a duplicate `operationId`, a route OpenAPI
cannot express, or a schema without a JSON Schema form.

```typescript {% title="app/http/openapi/document.ts" %}
import { createDocument } from "@sdxc/openapi";
import { bearer } from "@sdxc/openapi/security";

import { CREATE_BOOK, LIST_BOOKS, SHOW_BOOK } from "~/app/http/openapi/operations";
import { problems } from "~/app/services/problems";

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

The catalog becomes a `Problem` schema plus one response per entry, and each operation's
problems are `$ref`s to those responses. An operation that requires a key declares
`security: [{ apiKey: ["books:write"] }]`, and `builder.scopes()` lists every scope the
document requires, for OAuth protected-resource metadata.

Add `openapi: get("/api/openapi.json")` to the route table, then serve it:

```typescript {% title="app/http/controllers/api/openapi.ts" %}
import { openapiHandler } from "@sdxc/openapi/router";
import { createAction } from "remix/router";

import { buildApiDocument } from "~/app/http/openapi/document";
import routes from "~/routes/web";

export default createAction(
	routes.api.openapi,
	openapiHandler(() => buildApiDocument().build()),
);
```

The handler builds on the first request and reuses the outcome, which keeps the assembly out of
the Worker's global scope. It answers JSON by default and YAML for `?format=yaml` or an `Accept`
preferring `application/yaml`, each with a strong `ETag` and `Cache-Control: public,
max-age=300`, so a client revalidates with a `304`. A build failure answers `500` with a
problem document.

## Keep it honest in tests

Commit the serialized document, so every contract change arrives as a reviewable diff in the
commit that makes it:

```typescript {% title="app/http/openapi/document.test.ts" %}
import { stringify } from "@sdxc/openapi";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { buildApiDocument } from "~/app/http/openapi/document";

test("the document builds and matches the committed snapshot", async () => {
	let document = unwrap(buildApiDocument().build());
	await expect(unwrap(stringify(document))).toMatchFileSnapshot(
		"./openapi.snapshot.json",
	);
});
```

The snapshot proves the document is stable, and `checkResponse` from `@sdxc/openapi/testing`
proves the handlers answer what it says. It finds the operation a request matches and reports
every departure: an undocumented status, a problem `type` the operation does not list, a
missing required header, or a body that fails its schema.

```typescript {% title="app/http/controllers/api/books/create.test.ts" %}
import { checkResponse } from "@sdxc/openapi/testing";
import { isFailure } from "@sdxc/result";
import { expect, test } from "vitest";

import { buildApiDocument } from "~/app/http/openapi/document";
import application from "~/bootstrap/app";

let router = application();

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

To cover a whole suite at once, `createConformanceRecorder(buildApiDocument())` returns a
`middleware` to install first on the test router. Its `violations()` collects every departure
the suite produced, and `uncovered()` lists the declared status codes no test reached.

## Where to go next

- [Build a JSON API with problem details](/docs/http-apis/json-apis) — the API this document
  describes.
- [Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) — document a
  `PATCH` with both `application/merge-patch+json` and `application/json` bodies.
- [Write a typed API client](/docs/http-apis/api-clients) — validate responses with the same
  schemas on the other side.
- [Test Workers apps](/docs/operations-and-testing/testing) — building the router a test
  like the one above sends requests through.
