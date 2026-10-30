---
title: Idempotent writes and JSON Merge Patch
description: Make a create safe to retry with Idempotency-Key, accept partial updates as merge patches, and refuse writes based on stale reads.
section:
    title: HTTP APIs
    order: 5
order: 3
lastUpdated: 2026-10-25
outcomes:
    - "How to make a create safe to retry with an `Idempotency-Key`"
    - "How to accept partial updates as JSON Merge Patch"
    - "How to refuse writes based on a stale read with an ETag"
---

Writes fail in two quiet ways. A `POST` times out, the client retries, and a second book is
created. Two clients edit the same book, and the second write erases the first. This guide
closes both gaps in the books API from
[Build a JSON API with problem details](/docs/http-apis/json-apis):
[`@sdxc/idempotency`](/api/idempotency) replays the first outcome of a retried request,
[`@sdxc/merge-patch`](/api/merge-patch) applies partial updates, and `@sdxc/http/cache` checks
an `ETag` on the write.

```bash
npm add @sdxc/http @sdxc/idempotency @sdxc/merge-patch @sdxc/problem @sdxc/result \
	@sdxc/validate remix
```

## Extend the problem catalog

Both features refuse requests with your API's problem types. Add `preconditionFailed`,
`unsupportedMediaType` and the middleware's own `IDEMPOTENCY_PROBLEM_ENTRIES` to the catalog:

```typescript {% title="config/problems.ts" %}
import { IDEMPOTENCY_PROBLEM_ENTRIES } from "@sdxc/idempotency";
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
	preconditionFailed: {
		slug: "precondition-failed",
		status: 412,
		title: "The resource changed after you read it",
	},
	unsupportedMediaType: {
		slug: "unsupported-media-type",
		status: 415,
		title: "The request body's media type is not accepted",
	},
	...IDEMPOTENCY_PROBLEM_ENTRIES,
});
```

## Make create safe to retry

The middleware claims the key before the handler runs, stores the response, and replays it
for every later request with the same key. `DataTableStore` claims with a single conditional
upsert, so the claim is atomic on D1 and Durable Object SQLite.

```typescript {% title="app/http/middleware/idempotency.ts" %}
import { DataTableStore } from "@sdxc/idempotency/data-table";
import { idempotency } from "@sdxc/idempotency/middleware";

import problems from "~/config/problems";

export const idempotent = idempotency({
	store: (ctx) => new DataTableStore(ctx.db),
	scope: (ctx) => `api-key:${ctx.apiKey.id}`,
	ttl: "24 hours",
	prefix: "books-api",
	problems,
});
```

> [!WARNING]
> Scope on an identity your authentication middleware established, shown here as `ctx.apiKey`.
> A scope built from anything the caller sends, or one shared by every caller, lets a caller who
> guesses or reuses another's key receive that caller's stored response.

Create the `idempotency_keys` table by pasting `IDEMPOTENCY_KEYS_SCHEMA_SQL` into a migration,
and delete expired records from a scheduled job with `purgeExpired(db)`. Then mount the
middleware on the create action:

```typescript {% title="app/http/controllers/api/books/create.ts" %}
import { created } from "@sdxc/http/response/json";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import Book, { serializeBook } from "~/app/models/book";
import { idempotent } from "~/app/http/middleware/idempotency";
import { BOOK_INPUT } from "~/app/http/validators/books";
import problems from "~/config/problems";
import routes from "~/routes/api";

export default createAction(routes.api.books.create, {
	middleware: [idempotent],
	handler: async (ctx) => {
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
	},
});
```

A request without the header runs unprotected; pass `required: true` to answer `400`
instead. The same key sent while the first request runs gets `409`, and the same key with a
different body gets `422`. Only outcomes below `500` are stored, so a failed write releases
the key and the retry runs it.

## Send a key

A client mints the key once per operation and reuses it on every attempt:

```typescript {% title="app/services/books/create-book.ts" %}
import { generateIdempotencyKey, withIdempotencyKey } from "@sdxc/idempotency/client";
import { unwrap } from "@sdxc/result";

export async function createBook(book: {
	title: string;
	author: string;
	year: number;
}) {
	let body = JSON.stringify(book);
	let headers = { "Content-Type": "application/json" };

	let key = generateIdempotencyKey();
	let init = unwrap(withIdempotencyKey({ method: "POST", headers, body }, key));

	let response: Response | null = null;
	for (let attempt = 0; attempt < 3; attempt++) {
		response = await fetch("https://books.example.com/api/books", init).catch(
			() => null,
		);
		if (response !== null && response.status < 500) break;
	}
	return response;
}
```

Serialize the body once and send it unchanged: a reused key with a different body answers
`422`.

## Hand out an ETag

A conditional write needs a validator from the read. `etag` hashes the body into a tag, and
`conditional` answers `304` when the client already holds it:

```typescript {% title="app/http/controllers/api/books/show.ts" %}
import { conditional, etag, Policies } from "@sdxc/http/cache";
import { ok } from "@sdxc/http/response/json";
import { isSuccess } from "@sdxc/result";
import { createAction } from "remix/router";

import Book, { serializeBook } from "~/app/models/book";
import problems from "~/config/problems";
import routes from "~/routes/api";

export default createAction(routes.api.books.show, async (ctx) => {
	let book = await Book.find(ctx.db, ctx.params.bookId);
	if (book === null) return problems.notFound({ detail: "No book has that id." });

	let body = { book: serializeBook(book) };
	let headers = new Headers({ "Cache-Control": Policies.revalidate().toString() });
	let tag = await etag(JSON.stringify(body));
	if (isSuccess(tag)) headers.set("ETag", tag.data);

	return await conditional(ctx.request, ok(body, { headers }));
});
```

## Accept a merge patch

Add `update: patch("/api/books/:bookId")` to `routes/api.ts`. A merge patch lists only the
members that change, and `null` removes one. It applies to the book's writable members, with
unset ones left out:

```typescript {% title="app/http/controllers/api/books/writable-book.ts" %}
import type { JSONObject } from "@sdxc/merge-patch";

import type { BookRow } from "~/app/models/book";

export function writableBook(book: BookRow): JSONObject {
	let target: JSONObject = {
		title: book.title,
		author: book.author,
		year: book.year,
	};
	if (book.summary !== null) target.summary = book.summary;
	return target;
}
```

The update action checks the client's tag, reads the patch, applies it to that target and
validates the result:

```typescript {% title="app/http/controllers/api/books/update.ts" %}
import { etag, precondition } from "@sdxc/http/cache";
import { ok } from "@sdxc/http/response/json";
import { applyValidated, MEDIA_TYPE } from "@sdxc/merge-patch";
import { readMergePatch } from "@sdxc/merge-patch/request";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import Book, { serializeBook } from "~/app/models/book";
import { writableBook } from "~/app/http/controllers/api/books/writable-book";
import { BOOK_INPUT } from "~/app/http/validators/books";
import problems from "~/config/problems";
import routes from "~/routes/api";

export default createAction(routes.api.books.update, async (ctx) => {
	let book = await Book.find(ctx.db, ctx.params.bookId);
	if (book === null) return problems.notFound({ detail: "No book has that id." });

	let tag = await etag(JSON.stringify({ book: serializeBook(book) }));
	if (isFailure(tag)) return problems.internal();
	let checked = precondition(ctx.request, { etag: tag.data });
	if (isFailure(checked)) return problems.preconditionFailed();

	let patch = await readMergePatch(ctx.request, {
		alsoAccept: ["application/json"],
	});
	if (isFailure(patch)) {
		if (patch.error.reason === "invalid-json") return problems.badRequest();
		let headers = { "Accept-Patch": MEDIA_TYPE };
		return problems.unsupportedMediaType({}, { headers });
	}

	let next = applyValidated(writableBook(book), patch.data, BOOK_INPUT);
	if (isFailure(next)) {
		let errors = issuesFrom(next.error);
		return problems.validationFailed({ extensions: { errors } });
	}

	let saved = await Book.update(ctx.db, book.id, next.data);
	return ok({ book: serializeBook(saved) });
});
```

`precondition` compares `If-Match` with the book's current tag: an absent header passes, and
a stale tag answers `412`, so a client cannot overwrite a change it never saw.

> [!WARNING]
> The check and the write are two statements, so on D1 another write can land between them.
> When two writers racing matters, make the update itself conditional in SQL, matching the
> columns the tag was computed from.

`applyValidated` validates the patched **result** with `BOOK_INPUT`, the create schema, so
create and update share one set of limits. Its validation is synchronous, so the schema holds
only synchronous checks.

## Send a patch

`MergePatchOf<T>` types a patch: every member optional, and `null` allowed only where the
member is optional, so removing a required field fails to compile.

```typescript {% title="app/services/books/patch-book.ts" %}
import type { MergePatchOf } from "@sdxc/merge-patch";

import { MEDIA_TYPE, stringify } from "@sdxc/merge-patch";

interface Book {
	title: string;
	author: string;
	year: number;
	summary?: string;
}

export async function patchBook(id: string, patch: MergePatchOf<Book>) {
	let url = `https://books.example.com/api/books/${id}`;
	let read = await fetch(url);

	let headers = new Headers({ "Content-Type": MEDIA_TYPE });
	let tag = read.headers.get("ETag");
	if (tag !== null) headers.set("If-Match", tag);

	return await fetch(url, { method: "PATCH", headers, body: stringify(patch) });
}
```

A caller passes only what changes, `patchBook(id, { year: 1979, summary: null })`. A `412`
means the book changed since the read: read it again and reapply the edit. An API that needs
an explicit `null` or an edit to one array element accepts
[JSON Patch](/docs/http-apis/json-patch) beside merge patch.

## Test the update

The update's rules live in `writableBook` and the create schema, so a test applies patches
without a request:

```typescript {% title="app/http/controllers/api/books/writable-book.test.ts" %}
import type { BookRow } from "~/app/models/book";

import { applyValidated } from "@sdxc/merge-patch";
import { issuesFrom } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { writableBook } from "~/app/http/controllers/api/books/writable-book";
import { BOOK_INPUT } from "~/app/http/validators/books";

let book = {
	id: "01j9z4k2m8q7r6t5v4w3x2y1z0",
	title: "Kindred",
	author: "Octavia E. Butler",
	year: 1979,
	summary: "A writer is pulled back in time.",
} as BookRow;

test("a patch removing a required member fails on its pointer", () => {
	let next = applyValidated(writableBook(book), { title: null }, BOOK_INPUT);
	if (!isFailure(next)) expect.unreachable("the title is required");
	expect(issuesFrom(next.error)[0]?.pointer).toBe("/title");
});

test("a patch removing an optional member clears it", () => {
	let next = unwrap(
		applyValidated(writableBook(book), { summary: null }, BOOK_INPUT),
	);
	expect(next).toEqual({
		title: "Kindred",
		author: "Octavia E. Butler",
		year: 1979,
	});
});
```

## Where to go next

- [Write a typed API client](/docs/http-apis/api-clients) — attach idempotency keys in one
  hook for every create.
- [JSON Patch](/docs/http-apis/json-patch) — accept edits a merge patch cannot express.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — purge expired
  idempotency records on a schedule.
