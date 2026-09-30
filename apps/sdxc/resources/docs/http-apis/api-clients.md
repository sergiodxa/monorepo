---
title: Write a typed API client
description: A client class for one API that attaches credentials once, validates every response, and turns problem documents into typed failures.
section:
    title: HTTP APIs
    order: 4
order: 4
lastUpdated: 2026-09-29
---

A client is where an API's contract meets code that trusts it. This guide writes one for the
books API from [Build a JSON API with problem details](/docs/http-apis/json-apis): every method
returns a `Result`, every success body is validated before a caller sees it, and every failure
carries the parsed problem document, typed by the same catalog the server answers with.

[`@sdxc/api-client`](/api/api-client) is the base class: one origin, one method per verb, and
two hooks every request and response pass through. [`@sdxc/validate`](/api/validate) checks
the bodies, [`@sdxc/problem`](/api/problem) recognizes and parses problem responses, and
[`@sdxc/result`](/api/result) carries the outcome.

```bash
npm add @sdxc/api-client @sdxc/validate @sdxc/problem @sdxc/result @sdxc/types
```

The client also reads `Link` headers with [`@sdxc/pagination`](/api/pagination), keys its
creates with [`@sdxc/idempotency`](/api/idempotency), and builds response schemas with
[`@sdxc/json-schema`](/api/json-schema), the packages the server already uses. Install them
too when the client lives in its own package.

## Share the contract

The server's problem catalog and its response schemas are the contract, so the client imports
them rather than restating them. Move them into modules both sides import:
`contract/problems.ts` holds the catalog from `app/services/problems.ts`, and
`contract/books.ts` the schemas from `app/http/schemas/books.ts` in the form
[Describe your API with OpenAPI](/docs/http-apis/openapi) gives them, with the `BOOK`
response schema.
`contract/` is a directory in one repository, or a package the client installs. A slug renamed
on the server then fails to compile in the client instead of failing silently in production.

The client reads the catalog's parsed problem type straight off it:

```typescript {% title="clients/books-error.ts" %}
import { problems } from "~/contract/problems";

export type BooksProblem = Parameters<typeof problems.is>[0];

export class BooksError extends Error {
	constructor(
		readonly status: number | null,
		readonly problem: BooksProblem | null,
		options?: ErrorOptions,
	) {
		super(
			problem?.title ?? `The books API answered ${status ?? "nothing"}`,
			options,
		);
		this.name = "BooksError";
	}
}
```

One error type covers every way a call fails. `status` is `null` when no response arrived,
`problem` is set when the API answered with a problem document, and `cause` keeps whatever
lower-level error explains the rest.

## Read every response one way

Each call asks the same four questions of a response: did it arrive, is it a problem, did it
succeed, and does the body match. Answer them once, in a function every method goes through.

```typescript {% title="clients/read.ts" %}
import type { JSONValue } from "@sdxc/types";
import type { Schema } from "remix/data-schema";

import { isProblem } from "@sdxc/problem";
import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";

import { BooksError } from "~/clients/books-error";
import { problems } from "~/contract/problems";

export async function read<Output>(
	send: () => Promise<Response>,
	schema: Schema<unknown, Output>,
) {
	let sent = await wrap(send);
	if (isFailure(sent)) {
		return failure(new BooksError(null, null, { cause: sent.error }));
	}
	let response = sent.data;
	let { status, headers } = response;

	if (isProblem(response)) {
		let parsed = await problems.parse(response);
		let problem = isSuccess(parsed) ? parsed.data : null;
		return failure(new BooksError(status, problem));
	}
	if (!response.ok) return failure(new BooksError(status, null));

	let json = await wrap(() => response.json() as Promise<JSONValue>);
	if (isFailure(json)) {
		return failure(new BooksError(status, null, { cause: json.error }));
	}

	let body = await validate(json.data, schema);
	if (isFailure(body)) {
		return failure(new BooksError(status, null, { cause: body.error }));
	}
	return success({ body: body.data, headers });
}
```

`wrap` turns the rejected promise of a network failure, and the throw of a body that is not
JSON, into `Result` values, so nothing escapes the function. `isProblem` checks the
`Content-Type` without reading the body, and `problems.parse` names the catalog entry the
problem belongs to and validates its extensions. A `type` the catalog does not know still
parses, with `name: null`, because an API may add problem types before its clients learn them.

Validating a `200` body is what makes a method's return type true: when the server ships
a change the client did not expect, the failure names the field that moved instead of
surfacing as `undefined` three calls later.

## Write the client

The subclass names the origin once, and each method is its path, its schema, and the part of
the body a caller wants.

```typescript {% title="clients/books.ts" %}
import type { Result } from "@sdxc/result";

import { APIClient } from "@sdxc/api-client";
import { withIdempotencyKey } from "@sdxc/idempotency/client";
import * as s from "@sdxc/json-schema";
import { parseLinkHeader } from "@sdxc/pagination";
import { failure, isFailure, success } from "@sdxc/result";

import { BooksError } from "~/clients/books-error";
import { read } from "~/clients/read";
import { BOOK, BOOK_INPUT } from "~/contract/books";

const BOOK_BODY = s.object({ book: BOOK });
const BOOK_LIST = s.object({ books: s.array(BOOK) });

export class BooksClient extends APIClient {
	readonly #token: string;

	constructor(token: string, baseURL = new URL("https://books.example.com")) {
		super(baseURL);
		this.#token = token;
	}

	protected override async before(request: Request): Promise<Request> {
		request.headers.set("Authorization", `Bearer ${this.#token}`);
		request.headers.set("Accept", "application/json");
		return request;
	}

	async book(id: string): Promise<Result<s.InferOutput<typeof BOOK>, BooksError>> {
		let result = await read(() => this.get(`/api/books/${id}`), BOOK_BODY);
		return isFailure(result) ? result : success(result.data.body.book);
	}

	async books(page = "/api/books") {
		let result = await read(() => this.get(page), BOOK_LIST);
		if (isFailure(result)) return result;

		let links = parseLinkHeader(result.data.headers.get("Link"));
		let next = links.find((link) => link.rels.includes("next"))?.target ?? null;
		return success({ books: result.data.body.books, next });
	}

	async createBook(input: s.InferInput<typeof BOOK_INPUT>, key: string) {
		let headers = { "Content-Type": "application/json" };
		let keyed = withIdempotencyKey({ headers, body: JSON.stringify(input) }, key);
		if (isFailure(keyed)) {
			return failure(new BooksError(null, null, { cause: keyed.error }));
		}

		let init = keyed.data;
		let result = await read(() => this.post("/api/books", init), BOOK_BODY);
		return isFailure(result) ? result : success(result.data.body.book);
	}
}
```

`before` runs on every request, whichever verb sent it, so the credential is attached in
exactly one place. The base class also writes the running invocation's W3C `traceparent`
into each request before `before` runs, so a call from a traced Worker shows up in the API's
trace as a child span. Set `propagateTrace` to `"traceparent"` or `"none"` to send less.

`books()` follows the server's `Link` header rather than building cursors itself. The `next`
target is an absolute URL, and resolving an absolute URL against the base URL leaves it as it
is, so a caller walks the whole list by handing each `next` back until it is `null`.

`createBook` takes the idempotency key from its caller, who mints it once with
`generateIdempotencyKey()` and passes the same one on every retry, as
[Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) describes. For a client
that should protect every write without asking, `applyIdempotencyKey(request)` in `before`
sets a fresh key on each `POST` or `PATCH` that has none.

## Branch on the problem

A caller narrows the failure to one catalog entry with `problems.is`, which also types that
entry's extensions. Here the caller is a Worker holding the API key as its `BOOKS_API_KEY`
secret:

```typescript
import { env } from "cloudflare:workers";
import { generateIdempotencyKey } from "@sdxc/idempotency/client";
import { isFailure } from "@sdxc/result";

import { BooksClient } from "~/clients/books";
import { problems } from "~/contract/problems";

let client = new BooksClient(env.BOOKS_API_KEY);
let input = { title: "", author: "Octavia E. Butler", year: 1979 };
let result = await client.createBook(input, generateIdempotencyKey());

let messages = new Map<string, string>();
if (isFailure(result)) {
	let problem = result.error.problem;
	if (problem !== null && problems.is(problem, "validationFailed")) {
		for (let issue of problem.extensions.errors) {
			messages.set(issue.pointer, issue.message);
		}
	}
}
```

`issue.pointer` is the JSON Pointer the server wrote with `issuesFrom`, such as `/year`, so a
form shows each message beside its field without parsing prose.

## Test it with MSW

Requests go through the global `fetch`, so MSW intercepts them and the client under test is
the real one. The handler can return the catalog's own builder, so the test answers with
exactly the document the server would.

```typescript {% title="clients/books.test.ts" %}
import { isSuccess } from "@sdxc/result";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { BooksClient } from "~/clients/books";
import { problems } from "~/contract/problems";

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("a missing book fails with the notFound problem", async () => {
	server.use(
		http.get("https://books.example.com/api/books/:bookId", () =>
			problems.notFound(),
		),
	);

	let result = await new BooksClient("test-token").book(
		"01j9z4k2m8q7r6t5v4w3x2y1z0",
	);
	if (isSuccess(result)) expect.unreachable("the book should be missing");
	expect(result.error.problem?.name).toBe("notFound");
});
```

The same setup covers the other branches: a handler answering `HttpResponse.json({})` for a
book fails validation with the `ValidationError` as `cause`, and `onUnhandledRequest:
"error"` fails any test whose client calls a path you did not expect.

## Where to go next

- [Build a JSON API with problem details](/docs/http-apis/json-apis) — the server side of
  this contract.
- [Describe your API with OpenAPI](/docs/http-apis/openapi) — publish the same schemas for
  clients you do not write.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — follow a call from
  the client's Worker into the API's trace.
- [Test Workers apps](/docs/operations-and-testing/testing) — more on MSW and the Workers pool.
