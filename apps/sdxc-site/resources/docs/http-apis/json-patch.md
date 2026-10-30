---
title: Accept JSON Patch updates
description: Take RFC 6902 patches on a PATCH endpoint, answer each failure with the right status, and send guarded patches computed with diff.
section:
    title: HTTP APIs
    order: 5
order: 8
lastUpdated: 2026-10-25
outcomes:
    - "How to apply an `application/json-patch+json` body to a resource, all or nothing"
    - "How to answer a malformed, unresolvable or failed-test patch with 400, 422 or 409"
    - "When to send JSON Patch instead of a merge patch, and how `diff` and `test` guard an edit"
---

A merge patch cannot set a member to `null`, edit the middle of an array, or make a change
depend on what the resource holds now. A JSON Patch can: it is a list of operations (`add`,
`remove`, `replace`, `move`, `copy`, `test`), each aimed at a JSON Pointer. This guide adds a
JSON Patch update to the books API from
[Build a JSON API with problem details](/docs/http-apis/json-apis) with
[`@sdxc/json-patch`](/api/json-patch), and a client that sends only what changed, guarded so it
never overwrites an edit it did not see.

```bash
npm add @sdxc/http @sdxc/json-patch @sdxc/json-pointer @sdxc/problem @sdxc/result \
	@sdxc/validate remix
```

## Add the patch failures to the problem catalog

A patch fails in three ways, each with its own status: a malformed document is a `400`, a
`path` with nothing to act on is a `422`, and a failed `test` is a `409`, which tells a client
to reload and try again. Add an entry for each to the catalog:

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
	unsupportedMediaType: {
		slug: "unsupported-media-type",
		status: 415,
		title: "The request body's media type is not accepted",
	},
	patchUnresolvable: {
		slug: "patch-unresolvable",
		status: 422,
		title: "The patch names a location the resource does not have",
	},
	patchConflict: {
		slug: "patch-conflict",
		status: 409,
		title: "The resource no longer matches the patch's test",
	},
});
```

Map `JsonPatchError`'s `reason` onto those builders in one function:

```typescript {% title="app/http/controllers/api/books/json-patch-problem.ts" %}
import type { JsonPatchError } from "@sdxc/json-patch";

import problems from "~/config/problems";

export function jsonPatchProblem(error: JsonPatchError): Response {
	let detail = error.message;
	switch (error.reason) {
		case "invalid-patch":
			return problems.badRequest({ detail });
		case "unresolvable":
			return problems.patchUnresolvable({ detail });
		case "test-failed":
			return problems.patchConflict({ detail });
	}
}
```

## Apply the patch in the update action

Add `update: patch("/api/books/:bookId")` to `routes/api.ts`. The action checks the media type,
applies the patch to the book's writable members, and validates the result with the create
schema, so a patch can only produce a book a create would accept:

```typescript {% title="app/http/controllers/api/books/update.ts" %}
import { ok } from "@sdxc/http/response/json";
import { apply, MEDIA_TYPE, parse } from "@sdxc/json-patch";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import Book, { serializeBook } from "~/app/models/book";
import { jsonPatchProblem } from "~/app/http/controllers/api/books/json-patch-problem";
import { writableBook } from "~/app/http/controllers/api/books/writable-book";
import { BOOK_INPUT } from "~/app/http/validators/books";
import problems from "~/config/problems";
import routes from "~/routes/api";

export default createAction(routes.api.books.update, async (ctx) => {
	let book = await Book.find(ctx.db, ctx.params.bookId);
	if (book === null) return problems.notFound({ detail: "No book has that id." });

	let type = ctx.request.headers.get("Content-Type")?.split(";")[0]?.trim();
	if (type?.toLowerCase() !== MEDIA_TYPE) {
		let headers = { "Accept-Patch": MEDIA_TYPE };
		return problems.unsupportedMediaType({}, { headers });
	}

	let patch = parse(await ctx.request.text());
	if (isFailure(patch)) return jsonPatchProblem(patch.error);

	let next = apply(writableBook(book), patch.data);
	if (isFailure(next)) return jsonPatchProblem(next.error);

	let input = await validate(next.data, BOOK_INPUT);
	if (isFailure(input)) {
		let errors = issuesFrom(input.error);
		return problems.validationFailed({ extensions: { errors } });
	}

	let saved = await Book.update(ctx.db, book.id, input.data);
	return ok({ book: serializeBook(saved) });
});
```

`writableBook` is the function from
[Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes). `apply` runs the
operations against a private copy, so when one fails none take effect.

> [!NOTE]
> JSON Patch never creates missing parents: `add` at `/a/b` needs `/a` to exist, and `-` appends
> only to an array. Clients that patch a member a resource may lack add the parent first, in an
> earlier operation of the same patch.

## Send only what changed, guarded by test

A client holding the book it read and the edited copy computes the patch with `diff`.
Prefixing each `replace` and `remove` with a `test` of the value it overwrites makes the patch
a compare-and-set:

```typescript {% title="app/services/books/save-book.ts" %}
import type { JSONObject, JSONValue, Operation } from "@sdxc/json-patch";

import { diff, MEDIA_TYPE, stringify } from "@sdxc/json-patch";
import { get } from "@sdxc/json-pointer";
import { isSuccess } from "@sdxc/result";

export function guardedPatch(original: JSONObject, edited: JSONObject): Operation[] {
	let patch: Operation[] = [];
	for (let operation of diff(original, edited)) {
		if (operation.op === "replace" || operation.op === "remove") {
			let current = get(original, operation.path);
			if (isSuccess(current)) {
				patch.push({
					op: "test",
					path: operation.path,
					value: current.data as JSONValue,
				});
			}
		}
		patch.push(operation);
	}
	return patch;
}

export async function saveBook(id: string, original: JSONObject, edited: JSONObject) {
	let patch = guardedPatch(original, edited);
	if (patch.length === 0) return null;

	return await fetch(`https://books.example.com/api/books/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": MEDIA_TYPE },
		body: stringify(patch),
	});
}
```

Editing the year and clearing the summary sends four operations:

```json
[
	{ "op": "test", "path": "/summary", "value": "A writer is pulled back in time." },
	{ "op": "remove", "path": "/summary" },
	{ "op": "test", "path": "/year", "value": 1979 },
	{ "op": "replace", "path": "/year", "value": 1980 }
]
```

A `409` means another client changed one of those members: read the book again and reapply
the edit. A member nobody else touched never conflicts, unlike an `If-Match` check on the whole
resource.

## Test the patch rules

The rules are pure, so a test applies patches to a book built by hand:

```typescript {% title="app/http/controllers/api/books/json-patch-problem.test.ts" %}
import type { BookRow } from "~/app/models/book";

import { apply } from "@sdxc/json-patch";
import { isFailure } from "@sdxc/result";
import { expect, test } from "vitest";

import { jsonPatchProblem } from "~/app/http/controllers/api/books/json-patch-problem";
import { writableBook } from "~/app/http/controllers/api/books/writable-book";

let book = {
	id: "01j9z4k2m8q7r6t5v4w3x2y1z0",
	title: "Kindred",
	author: "Octavia E. Butler",
	year: 1979,
	summary: "A writer is pulled back in time.",
} as BookRow;

test("a failed test answers 409 and changes nothing", () => {
	let target = writableBook(book);
	let next = apply(target, [
		{ op: "replace", path: "/year", value: 1980 },
		{ op: "test", path: "/title", value: "Dawn" },
	]);
	if (!isFailure(next)) expect.unreachable("the title is Kindred");

	expect(next.error.index).toBe(1);
	expect(jsonPatchProblem(next.error).status).toBe(409);
	expect(target.year).toBe(1979);
});

test("removing a member the book lacks answers 422", () => {
	let next = apply(writableBook(book), [{ op: "remove", path: "/isbn" }]);
	if (!isFailure(next)) expect.unreachable("a book has no isbn");

	expect(next.error.reason).toBe("unresolvable");
	expect(jsonPatchProblem(next.error).status).toBe(422);
});
```

## Where to go next

- [Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) — the simpler partial
  update, and the `ETag` check that guards a whole resource.
- [Query JSON with JSONPath](/docs/http-apis/jsonpath) — find the nodes a patch should touch,
  and turn their locations into pointers.
- [`@sdxc/json-patch`](/api/json-patch) — every operation type and how `diff` edits arrays.
