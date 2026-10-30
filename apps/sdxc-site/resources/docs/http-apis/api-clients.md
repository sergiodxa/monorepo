---
title: Write a typed API client
description: A client class for one API that attaches credentials once, validates every response, and turns problem documents into typed failures.
section:
    title: HTTP APIs
    order: 5
order: 4
lastUpdated: 2026-10-25
outcomes:
    - "How to write a client class that attaches credentials once"
    - "How to validate every response and read it one way"
    - "How to turn `@sdxc/problem` documents into typed failures and test with MSW"
---

This guide writes a client for the books API from
[Build a JSON API with problem details](/docs/http-apis/json-apis): every method returns a
`Result`, every success body is validated before a caller sees it, and every failure carries
the parsed problem document, typed by the server's own catalog.
[`@sdxc/api-client`](/api/api-client) is the base class: one origin, one method per verb, and
a hook every request passes through.

```bash
npm add @sdxc/api-client @sdxc/idempotency @sdxc/json-schema @sdxc/link-header \
	@sdxc/problem @sdxc/result @sdxc/types @sdxc/validate remix
```

## Share the contract

The server's problem catalog and response schemas are the contract, so move them into
modules both sides import: `contract/problems.ts` holds the catalog, and `contract/books.ts`
the schemas in the form [Describe your API with OpenAPI](/docs/http-apis/openapi) gives them.
A slug renamed on the server then fails to compile in the client. One error type covers every
way a call fails:

```typescript {% title="app/services/books/books-error.ts" %}
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

`status` is `null` when no response arrived, and `problem` is set when the API answered with a
problem document.

## Read every response one way

Each call asks the same questions of a response: did it arrive, is it a problem, did it
succeed, and does the body match. Answer them once, in a function every method goes through:

```typescript {% title="app/services/books/read.ts" %}
import type { JSONValue } from "@sdxc/types";
import type { Schema } from "remix/data-schema";

import { isProblem } from "@sdxc/problem";
import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";

import { BooksError } from "~/app/services/books/books-error";
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

`wrap` turns a network failure or a non-JSON body into a `Result`, and `problems.parse` names
the catalog entry a problem belongs to. Validating a `200` body makes the method's return type
true: an unexpected server change fails here, naming the field that moved.

## Write the client

The subclass names the origin once, and each method is its path, its schema, and the part of
the body a caller wants:

```typescript {% title="app/services/books/client.ts" %}
import type { Result } from "@sdxc/result";

import { APIClient } from "@sdxc/api-client";
import { withIdempotencyKey } from "@sdxc/idempotency/client";
import * as s from "@sdxc/json-schema";
import { parse } from "@sdxc/link-header";
import { failure, isFailure, success } from "@sdxc/result";

import { BooksError } from "~/app/services/books/books-error";
import { read } from "~/app/services/books/read";
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

		let links = parse(result.data.headers.get("Link"));
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

`before` runs on every request, so the credential is attached in one place. `books()` follows
the server's `Link` header, so a caller walks the list by handing each `next` back until it is
`null`. `createBook` takes the idempotency key from its caller, as
[Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) describes.

> [!WARNING]
> The key protects a create only while every retry reuses it. Mint it once per operation, before
> the first attempt: a key minted per attempt makes each retry a new request, and a retried
> timeout creates the book twice.

## Branch on the problem

A caller narrows the failure to one catalog entry with `problems.is`, which also types its
extensions. Here a service maps each refused field to its message:

```typescript {% title="app/services/books/submit-book.ts" %}
import type { InferInput } from "@sdxc/json-schema";

import { env } from "cloudflare:workers";
import { generateIdempotencyKey } from "@sdxc/idempotency/client";
import { isFailure } from "@sdxc/result";

import { BooksClient } from "~/app/services/books/client";
import { BOOK_INPUT } from "~/contract/books";
import { problems } from "~/contract/problems";

export async function submitBook(input: InferInput<typeof BOOK_INPUT>) {
	let client = new BooksClient(env.BOOKS_API_KEY);
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
	return messages;
}
```

`issue.pointer` is the JSON Pointer the server wrote, such as `/year`, so a form shows each
message beside its field.

## Test it with MSW

Requests go through the global `fetch`, so MSW intercepts them. The handler returns the
catalog's own builder, exactly the document the server would send:

```typescript {% title="app/services/books/client.test.ts" %}
import { isSuccess } from "@sdxc/result";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { BooksClient } from "~/app/services/books/client";
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

## Where to go next

- [Build a JSON API with problem details](/docs/http-apis/json-apis) — the server side of
  this contract.
- [Describe your API with OpenAPI](/docs/http-apis/openapi) — publish the same schemas for
  clients you do not write.
- [Paginate lists](/docs/http-apis/paginate-lists) — the `Link` headers `books()` follows.
