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
`https://api.example.com/books/{id}`. That is an
[RFC 6570](https://www.rfc-editor.org/rfc/rfc6570) URI Template, and string replacement gets
it wrong as soon as a value holds a space, a `/` or a list. This guide expands templates with
[`@sdxc/uri-template`](/api/uri-template), publishes them from your own API, follows them as a
client, and reads a URI back into its values.

```bash
npm add @sdxc/uri-template @sdxc/result @sdxc/types @sdxc/validate @sdxc/http remix
```

## Expand a template

`expand` encodes each value for the place it lands. The operator decides that place:
`{?q,page}` writes a query, `{/path*}` writes segments, and `{+path}` keeps reserved
characters such as `/`:

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
```

A variable that is `undefined`, `null`, `[]` or `{}` disappears together with its `?`, `&`
or `/`, so an optional parameter needs no branch.

> [!WARNING]
> `{+var}` and `{#var}` pass `/`, `?`, `#` and `..` through unencoded. Expand a value someone
> else typed with `{var}`, which encodes them, so a name like `../admin?x=` stays one segment
> instead of rewriting the path and the query.

## Publish templates from your API

A root document that lists your templates lets a client find every URL from one address, so
you can move a path without breaking it. Write the templates once and expand the same ones
into the links you return:

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

`unwrap` is safe here because the template is yours, and the test below parses every
template you publish.

## Follow a template as a client

A client fetches the root document once, checks it, and parses each template before it
trusts it. `variableNames` tells you whether a template takes the values you will pass:

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

Keep the directory for the life of the client and expand per call:
`directory.search.expand({ q, page })` answers the URL, with `&page=` dropped when `page` is
`undefined`.

## Match a URI back to its variables

A client that links to a resource hands you a URI rather than an id. `match` reads it with the
template you published, answering the variables or `null`:

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

Matched values come back decoded, and a value holding a raw `,` comes back as a list, which
is why the function checks that `id` is a string. A URI on another host is `null`.

> [!NOTE]
> `match` fails for a template whose adjacent expressions have no literal between them, such
> as `{a}{b}`, because nothing marks where one value ends. Publish templates with a separator
> between expressions when you intend to read them back.

## Test the templates

The test parses each published template, reads a link back to its id, and answers the
client's discovery with MSW:

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
