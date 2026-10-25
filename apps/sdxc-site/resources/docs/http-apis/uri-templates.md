---
title: Expand URI templates
description: Expand, publish and match RFC 6570 URI templates, so an API client builds the URLs a discovery document describes and a server reads them back.
section:
    title: HTTP APIs
    order: 5
order: 10
lastUpdated: 2026-10-25
outcomes:
    - "How to expand RFC 6570 templates with `@sdxc/uri-template`, every operator included"
    - "How to follow the templates an API publishes instead of hard-coding its paths"
    - "How to match a URI back to the variables that produced it"
---

Many APIs describe their URLs instead of listing them: a root document holds
`https://api.example.com/books/{id}`, a JMAP session holds a `downloadUrl` with
`{accountId}` and `{blobId}`, an MCP server lists resource templates. Each is an
[RFC 6570](https://www.rfc-editor.org/rfc/rfc6570) URI Template, and string replacement
gets it wrong as soon as a value holds a space, a `/` or a list. This guide expands those
templates as a client, publishes them from your own API, and reads a URI back into the
values it was built from.

[`@sdxc/uri-template`](/api/uri-template) implements all four levels of the RFC and passes
the uritemplate-test suite. Its fallible calls return a [`@sdxc/result`](/api/result), the
client checks the document it fetches with [`@sdxc/validate`](/api/validate), and the
server answers with [`@sdxc/http`](/api/http).

```bash
npm add @sdxc/uri-template @sdxc/result @sdxc/types @sdxc/validate @sdxc/http remix
```

## Expand a template

`expand` fills a template with values and encodes each one for the place it lands. The
operator in front of the variable decides that place: `{?q,page}` writes a query, `{/path*}`
writes segments, and `{+path}` keeps reserved characters such as `/` as they are.

```typescript {% title="app/services/book-urls.ts" %}
import { expand } from "@sdxc/uri-template";

expand("https://books.example.com/api/books{?q,page}", { q: "dune & co", page: 2 });
// success("https://books.example.com/api/books?q=dune%20%26%20co&page=2")

expand("/files/{path}", { path: "a/b c" }); // success("/files/a%2Fb%20c")
expand("/files/{+path}", { path: "a/b c" }); // success("/files/a/b%20c")

expand("{/segments*}{?filters*}", {
	segments: ["docs", "api"],
	filters: { state: "open", sort: "new" },
});
// success("/docs/api?state=open&sort=new")

expand("/books{?ids}", { ids: ["a", "b"] }); // success("/books?ids=a,b")
expand("/books{?ids*}", { ids: ["a", "b"] }); // success("/books?ids=a&ids=b")
```

A variable that is `undefined`, `null`, `[]` or `{}` disappears together with its `?`, `&`
or `/`, so an optional parameter needs no branch. Numbers and booleans are written as text.
`{id:3}` keeps the first three characters of a string, and applying that prefix to a list
or an object is the one way expansion fails.

<warning>
`{+var}` and `{#var}` pass `/`, `?`, `#` and `..` through unencoded. Expand a value someone
else typed with `{var}`, which encodes them, so a name like `../admin?x=` stays one segment
instead of rewriting the path and the query.
</warning>

## Publish templates from your API

A root document that lists your templates lets a client find every URL from one address,
and you can then move a path without breaking it. Write the templates once and expand the
same ones into the concrete links you return, so the shape you advertise and the URLs you
write cannot drift apart:

```typescript {% title="config/link-templates.ts" %}
export const BOOK_TEMPLATE = "https://books.example.com/api/books/{id}";
export const SEARCH_TEMPLATE = "https://books.example.com/api/books{?q,page}";
```

```typescript {% title="app/http/controllers/api/root.ts" %}
import { ok } from "@sdxc/http/response/json";
import { createAction } from "remix/router";

import { BOOK_TEMPLATE, SEARCH_TEMPLATE } from "~/config/link-templates";
import routes from "~/routes/api";

export default createAction(routes.api.root, () => {
	return ok({ book_url: BOOK_TEMPLATE, search_url: SEARCH_TEMPLATE });
});
```

```typescript {% title="app/services/books/book-url.ts" %}
import { unwrap } from "@sdxc/result";
import { expand } from "@sdxc/uri-template";

import { BOOK_TEMPLATE } from "~/config/link-templates";

export function bookUrl(id: string): string {
	return unwrap(expand(BOOK_TEMPLATE, { id }));
}
```

`unwrap` is safe here because the template is yours and a string value cannot meet a
prefix modifier; the test below parses every template you publish, so a typo fails there
rather than in a request.

## Follow a template as a client

A client fetches the root document once, checks it, and parses each template before it
trusts it. `UriTemplate.parse` refuses an unclosed expression, a reserved operator or a
literal a URI cannot hold, and `variableNames` tells you whether the template takes the
values you are about to pass.

```typescript {% title="app/services/books/discovery.ts" %}
import type { JSONValue } from "@sdxc/types";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import { UriTemplate } from "@sdxc/uri-template";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";

const ROOT = s.object({ book_url: s.string(), search_url: s.string() });

export interface BooksDirectory {
	book: UriTemplate;
	search: UriTemplate;
}

export async function discover(origin: URL) {
	let response = await fetch(new URL("/api", origin));
	if (!response.ok)
		return failure(new Error(`The root answered ${response.status}`));

	let json = await wrap(() => response.json() as Promise<JSONValue>);
	if (isFailure(json)) return json;
	let root = await validate(json.data, ROOT);
	if (isFailure(root)) return root;

	let book = UriTemplate.parse(root.data.book_url);
	if (isFailure(book)) return book;
	if (!book.data.variableNames.includes("id")) {
		return failure(new Error("book_url takes no id"));
	}

	let search = UriTemplate.parse(root.data.search_url);
	if (isFailure(search)) return search;

	return success<BooksDirectory>({ book: book.data, search: search.data });
}
```

A parsed `UriTemplate` expands as many times as you call it, so keep the directory for the
life of the client and expand per call:

```typescript {% title="app/services/books/search.ts" %}
import type { BooksDirectory } from "~/app/services/books/discovery";

import { isFailure } from "@sdxc/result";

export async function searchBooks(
	directory: BooksDirectory,
	q: string,
	page?: number,
) {
	let url = directory.search.expand({ q, page });
	if (isFailure(url)) return url;
	return await fetch(url.data);
}
```

`page` left `undefined` drops `&page=` from the URL. A `UriTemplate` interpolates and
serializes as its source text, so `JSON.stringify(directory)` stores the templates as the
server wrote them.

## Match a URI back to its variables

A client that refers to a resource by its URL, as a JSON body linking to a book does,
hands you a URI rather than an id. `match` reads it with the same template you published:
it answers the variables, or `null` when the template cannot produce that URI.

```typescript {% title="app/services/books/book-id-from-uri.ts" %}
import { isFailure } from "@sdxc/result";
import { UriTemplate } from "@sdxc/uri-template";

import { BOOK_TEMPLATE } from "~/config/link-templates";

export function bookIdFromUri(uri: string): string | null {
	let template = UriTemplate.parse(BOOK_TEMPLATE);
	if (isFailure(template)) return null;

	let matched = template.data.match(uri);
	if (isFailure(matched) || matched.data === null) return null;

	let id = matched.data.id;
	return typeof id === "string" ? id : null;
}
```

Matched values come back decoded, so `/api/books/a%20b` answers `"a b"`. A value holding a
raw `,` comes back as a list and exploded `key=value` items as an object, which is why the
function checks that `id` is a string. Query items match in any order, and a URI on another
host or path is `null`, so a link to someone else's API is refused rather than misread.

<note>
`match` fails for a template whose adjacent expressions have no literal between them, such
as `{a}{b}`, because nothing marks where one value ends. Publish templates with a separator
between expressions when you intend to read them back.
</note>

## Test the templates

The templates are module constants, so the test parses each one and checks that a link you
write reads back to the id it came from. The client's discovery goes through the global
`fetch`, so MSW answers the root document.

```typescript {% title="app/services/books/book-url.test.ts" %}
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { UriTemplate } from "@sdxc/uri-template";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { bookIdFromUri } from "~/app/services/books/book-id-from-uri";
import { bookUrl } from "~/app/services/books/book-url";
import { discover } from "~/app/services/books/discovery";
import { BOOK_TEMPLATE, SEARCH_TEMPLATE } from "~/config/link-templates";

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("every published template parses", () => {
	for (let source of [BOOK_TEMPLATE, SEARCH_TEMPLATE]) {
		expect(isSuccess(UriTemplate.parse(source))).toBe(true);
	}
});

test("a book link reads back to its id", () => {
	expect(bookIdFromUri(bookUrl("b 1"))).toBe("b 1");
	expect(bookIdFromUri("https://elsewhere.example.com/api/books/b1")).toBeNull();
});

test("the client expands the search template it discovered", async () => {
	server.use(
		http.get("https://books.example.com/api", () =>
			HttpResponse.json({
				book_url: BOOK_TEMPLATE,
				search_url: SEARCH_TEMPLATE,
			}),
		),
	);

	let directory = await discover(new URL("https://books.example.com"));
	if (isFailure(directory)) expect.unreachable("the root should parse");

	let url = unwrap(directory.data.search.expand({ q: "dune" }));
	expect(url).toBe("https://books.example.com/api/books?q=dune");
});
```

## Where to go next

- [Write a typed API client](/docs/http-apis/api-clients) — put the expanded URLs behind
  one client that validates every response.
- [Parse and write Link headers](/docs/http-apis/link-header) — the other way an API hands
  a client its next URL.
- [`@sdxc/uri-template`](/api/uri-template) — the parsed `parts`, every operator and the
  match rules.
