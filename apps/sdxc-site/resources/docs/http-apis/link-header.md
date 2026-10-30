---
title: Parse and write Link headers
description: Parse and stringify RFC 8288 Link headers, keep foreign parameters through a merge, and drop malformed entries instead of failing the response.
section:
    title: HTTP APIs
    order: 5
order: 7
lastUpdated: 2026-10-25
outcomes:
    - "How to parse and write RFC 8288 `Link` headers with `@sdxc/link-header`"
    - "How to merge headers without dropping foreign links"
    - "How to follow `next` links as a client and publish links as an RFC 9264 link set"
---

A `Link` header is a list of URI-References with relation types and parameters. A target
can contain a comma and a parameter value can be quoted, so
[`@sdxc/link-header`](/api/link-header) splits entries only on the commas outside angle
brackets and quoted strings, and drops malformed entries, so one bad link never fails a
response.

```bash
npm add @sdxc/link-header
```

## Parse a header

`parse` splits the value into entries in source order, and `parse(null)` is `[]`:

```typescript {% title="app/services/read-links.ts" %}
import { parse } from "@sdxc/link-header";

let links = parse(
	'</a,b.css>; rel="preload"; as="style", </items?page=2>; rel="next"',
);

links[0]?.target; // "/a,b.css"
links[0]?.rels; // ["preload"]
links[0]?.params; // { as: "style" }

links.find((link) => link.rels.includes("next"))?.target; // "/items?page=2"
```

`rels` is the `rel` parameter, lowercased and split on whitespace, and `params` holds every
other parameter, unquoted.

> [!NOTE]
> Relative targets stay relative, and `fetch` in a Worker needs an absolute URL. Resolve each
> target against the response it came from, `new URL(target, response.url)`, before you follow
> it.

## Write a header

`serializeLink` renders one link-value with quoted parameters, and `stringify` joins them.
`stringify([])` is `null`, so the caller deletes the header instead of writing an empty one:

```typescript {% title="app/services/write-links.ts" %}
import { serializeLink, stringify } from "@sdxc/link-header";

stringify([
	serializeLink("https://api.example.com/items?page=2", "next"),
	serializeLink("/feed.xml", "self", { type: "application/atom+xml" }),
]);
// <https://api.example.com/items?page=2>; rel="next", </feed.xml>; rel="self"; type="application/atom+xml"
```

## Merge without dropping foreign links

`raw` is the exact source text, so parameters this caller did not read still round-trip. A
paging helper that rewrites `next` keeps a `preload` that was already on the response:

```typescript {% title="app/services/set-next-link.ts" %}
import { parse, serializeLink, stringify } from "@sdxc/link-header";

export function setNextLink(headers: Headers, nextUrl: string) {
	let kept = parse(headers.get("Link"))
		.filter((link) => !link.rels.includes("next"))
		.map((link) => link.raw);

	let value = stringify([...kept, serializeLink(nextUrl, "next")]);
	if (value === null) headers.delete("Link");
	else headers.set("Link", value);
}
```

`paginate` from `@sdxc/pagination` does this for the four paging relations.

## Follow next links as a client

Walk a paginated API until `rel="next"` runs out. The server can then change strategies or
rename a parameter without breaking the client.

```typescript {% title="app/services/fetch-all.ts" %}
import { parse } from "@sdxc/link-header";

export async function fetchAll<T>(start: string): Promise<T[]> {
	let items: T[] = [];
	let next: string | null = start;

	while (next !== null) {
		let response: Response = await fetch(next);
		items.push(...((await response.json()) as T[]));

		let links = parse(response.headers.get("Link"));
		let target = links.find((link) => link.rels.includes("next"))?.target;
		next = target === undefined ? null : new URL(target, response.url).href;
	}

	return items;
}
```

[Write a typed API client](/docs/http-apis/api-clients) does the same walk behind a schema
on each page.

## Publish the links as a link set

Every link makes the header longer, and proxies cap how long a header may be. RFC 9264 moves
the same links into a document of their own, `application/linkset+json`, which a response
points at with `rel="linkset"`. `@sdxc/link-header/linkset` reads a header into a flat list of
links and writes that list in either link set form:

```typescript {% title="app/services/linkset.ts" %}
import { JSON_MEDIA_TYPE, parse, stringifyJson } from "@sdxc/link-header/linkset";

export function linksetResponse(header: string | null, context: string): Response {
	let links = parse(header, { context });
	return new Response(stringifyJson(links), {
		headers: { "Content-Type": JSON_MEDIA_TYPE },
	});
}
```

`context` is the URL the links describe, so the set keeps its meaning away from the response
it came from.

## Test the merge

`setNextLink` works on a `Headers` instance, so its test needs no request:

```typescript {% title="app/services/set-next-link.test.ts" %}
import { parse } from "@sdxc/link-header";
import { expect, test } from "vitest";

import { setNextLink } from "~/app/services/set-next-link";

test("replaces next and keeps the preload", () => {
	let headers = new Headers({
		Link: '</app.css>; rel="preload"; as="style", </items?page=2>; rel="next"',
	});

	setNextLink(headers, "/items?page=3");

	let links = parse(headers.get("Link"));
	expect(links.map((link) => link.rels[0])).toEqual(["preload", "next"]);
	expect(links[0]?.params).toEqual({ as: "style" });
	expect(links[1]?.target).toBe("/items?page=3");
});
```

## Where to go next

- [Paginate lists](/docs/http-apis/paginate-lists) — offset and keyset pages, and the
  `Link` values `paginate` writes.
- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds) — `rel="hub"`
  and `rel="self"` for WebSub.
- [`@sdxc/link-header`](/api/link-header) — the `Link` type and the empty-header cases.
