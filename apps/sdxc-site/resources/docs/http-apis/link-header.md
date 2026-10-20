---
title: Parse and write Link headers
description: Parse and stringify RFC 8288 Link headers, keep foreign parameters through a merge, and drop malformed entries instead of failing the response.
section:
    title: HTTP APIs
    order: 5
order: 7
lastUpdated: 2026-10-19
outcomes:
    - "How to parse and write RFC 8288 `Link` headers with `@sdxc/link-header`"
    - "How to merge headers without dropping foreign links"
    - "How to follow `next` links as a client and drop malformed entries"
---

A `Link` header is a list of URI-References with relation types and parameters. A target
can contain a comma and a parameter value can be quoted, so
[`@sdxc/link-header`](/api/link-header) splits entries only on the commas outside angle
brackets and quoted strings.

Malformed entries are dropped, so a merge into a response already under construction cannot
fail on one bad link. [`@sdxc/pagination`](/api/pagination) writes paging relations with
this package, [`@sdxc/websub`](/api/websub) advertises hubs, and
[`@sdxc/webmention`](/api/webmention) discovers an endpoint from the header first.

```bash
npm add @sdxc/link-header
```

`Link` is RFC 8288. Newer fields such as `RateLimit` and `Cache-Status` use RFC 9651,
which [Canonical URLs, lazy routes and header fields](/docs/building-remix-apps/router-utilities)
covers with `@sdxc/structured-fields`.

## Parse a header

`parse` splits the value into entries in source order. `parse(null)` is `[]`. The call
never throws. A `type` parameter lands in `params.type`, which is how a feed reader learns
the advertised media type.

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

`rels` is the first `rel` parameter, lowercased and split on whitespace. `params` keeps
the first of every other name, unquoted. An entry with no URI-Reference is skipped, so a
malformed fragment ends that one link rather than the walk.

<note>
Relative targets stay relative, and `fetch` in a Worker needs an absolute URL. Resolve each
target against the response it came from, `new URL(target, response.url)`, before you follow
it.
</note>

## Write a header

`serializeLink` renders one link-value with a quoted `rel` and any extra parameters after
it. `stringify` joins those texts. `stringify([])` is `null`, so the caller deletes the
header instead of writing an empty one.

```typescript {% title="app/services/write-links.ts" %}
import { serializeLink, stringify } from "@sdxc/link-header";

stringify([
	serializeLink("https://api.example.com/items?page=2", "next"),
	serializeLink("/feed.xml", "self", { type: "application/atom+xml" }),
]);
// <https://api.example.com/items?page=2>; rel="next", </feed.xml>; rel="self"; type="application/atom+xml"
```

Values are quoted so a comma inside one cannot split the header.

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

`paginate` from `@sdxc/pagination` does this for the four paging relations. `@sdxc/pagination`
still re-exports `parse` as `parseLinkHeader`; import from `@sdxc/link-header` when the
header is the work, not the page.

## Follow next links as a client

Walk a paginated API until `rel="next"` runs out. The server can then change strategies or
rename a parameter without breaking the client.

```typescript {% title="app/services/fetch-all.ts" %}
import { parse } from "@sdxc/link-header";

export async function fetchAll<T>(start: string): Promise<T[]> {
	let items: T[] = [];
	let next: string | null = start;

	while (next !== null) {
		let response = await fetch(next);
		items.push(...((await response.json()) as T[]));

		let links = parse(response.headers.get("Link"));
		let target = links.find((link) => link.rels.includes("next"))?.target;
		next = target === undefined ? null : new URL(target, response.url).href;
	}

	return items;
}
```

[Paginate lists](/docs/http-apis/paginate-lists) is the server side of those headers.
[Write a typed API client](/docs/http-apis/api-clients) does the same walk behind a schema
on each page.

## Test the merge

`setNextLink` works on a `Headers` instance, so its test needs no request. The case to prove
is the foreign link surviving while `next` is replaced:

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
