---
title: Paginate lists
description: Page by offset or keyset, validate the page parameters, advertise pages in Link headers, and render a pager in HTML.
section:
    title: HTTP APIs
    order: 4
order: 5
lastUpdated: 2026-09-29
---

[Build a JSON API with problem details](/docs/http-apis/json-apis) pages its book list by
keyset in a single handler. This guide covers the rest of that ground: when to page by offset
and when by keyset, what the page parameters accept, what the `Link` header carries, how a
client walks it, and how the same pages render as HTML with a numbered pager or older and
newer links.

[`@sdxc/pagination`](/api/pagination) does the paging and writes the headers,
[`@sdxc/ui`](/api/ui) draws the pager, [`@sdxc/problem`](/api/problem) and
[`@sdxc/http`](/api/http) answer the failures, and [`@sdxc/result`](/api/result) carries
them.

```bash
npm add @sdxc/pagination @sdxc/ui @sdxc/problem @sdxc/http @sdxc/result
```

## Offset or keyset

Both strategies page a `remix/data-table` query you have already composed, and both hand
back the rows plus what the next request needs. What differs is what each costs, and what it
lets the reader do.

|                            | Offset (`Pagination.byOffset`)                 | Keyset (`Pagination.byKeyset`) |
| -------------------------- | ---------------------------------------------- | ------------------------------ |
| The request carries        | `?page=3`                                      | `?cursor=…`                    |
| Queries per page           | a count, then the rows                         | the rows, plus one extra row   |
| Jump to page 30            | yes                                            | no, only previous and next     |
| Knows the total            | yes, `X-Total-Count`                           | no                             |
| Deep pages                 | slower, the database skips every earlier row   | as fast as the first           |
| Rows inserted while paging | shift the pages, so a row repeats or is missed | nothing shifts                 |

Page by offset when a person wants page numbers and a total, and the list is one they can
realistically reach the end of: invoices, members, search results. Page by keyset when the
list only grows and is read from the newest end: activity, logs, events, any API collection
a client syncs. A cursor stays valid while rows are added in front of it, which is what makes
it right for a list that changes under the reader.

## Bind the parameters once

The parameters arrive as untrusted text, and the names you parse must be the names your
`Link` URLs advertise. `createPaging` binds both, together with the default and the largest
page size, so every list in the app agrees:

```typescript {% title="app/http/paging.ts" %}
import { createPaging } from "@sdxc/pagination";

export const paging = createPaging({
	names: { perPage: "per_page" },
	perPage: 25,
	maxPerPage: 100,
});
```

`paging.parse(searchParams)` answers `{ page, perPage, cursor }`, with `cursor` `null` when
absent. It fails with a `ValidationError` for a page below 1 or with a fraction, and for a page
size outside `1..maxPerPage`, which is what stops a client from asking for every row at once. A
blank parameter such as `?page=` counts as absent. A page past the end succeeds on purpose:
only the query knows where the end is, so `byOffset` clamps it once it has the total.

Names you leave out keep their defaults, so this app reads `page`, `per_page` and `cursor`.

## Offset pages for an API

An offset query carries its own ordering, and the ordering should end in a unique column.
Two invoices created in the same second would otherwise trade places between the query for
page 2 and the one for page 3, and one of them would show twice.

```typescript {% title="app/http/controllers/api/invoices/index.ts" %}
import { ok } from "@sdxc/http/response/json";
import { Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { serializeInvoice } from "~/app/data/invoice";
import { paging } from "~/app/http/paging";
import { problems } from "~/app/services/problems";
import { invoices } from "~/database/schema";
import routes from "~/routes/web";

export default createAction(routes.api.invoices.index, async (ctx) => {
	let params = paging.parse(ctx.url.searchParams);
	if (isFailure(params)) {
		let errors = issuesFrom(params.error);
		return problems.validationFailed({ extensions: { errors } });
	}

	let query = ctx.db
		.query(invoices)
		.orderBy("created_at", "desc")
		.orderBy("id", "desc");
	let page = await Pagination.byOffset(query, params.data);
	if (isFailure(page)) return problems.internal();

	let headers = paging.paginate(new Headers(), page.data, { url: ctx.url });
	return ok({ invoices: page.data.items.map(serializeInvoice) }, { headers });
});
```

`problems` is the catalog from [the JSON API guide](/docs/http-apis/json-apis), so a bad page
parameter answers the same `422` a bad body does, with a pointer to the parameter at fault.
`byOffset` takes the parsed params as they are, since it reads only `page` and `perPage`. It
runs the query twice, a count and then the rows with `limit` and `offset` applied; when you
already know the total, pass it as `total` and the count is skipped. A database that refuses
comes back as `QueryFailedError`, with the original throw on its `cause`.

## What the headers say

`paginate` writes the navigation into the response's own headers. An offset page gets all
four relations and the total:

```bash
curl -sI "https://app.example.com/api/invoices?status=open&page=3"
# Link: <https://app.example.com/api/invoices?status=open&page=1>; rel="first",
#   <https://app.example.com/api/invoices?status=open&page=2>; rel="prev",
#   <https://app.example.com/api/invoices?status=open&page=4>; rel="next",
#   <https://app.example.com/api/invoices?status=open&page=36>; rel="last"
# X-Total-Count: 892
```

Every other query parameter is carried into the links, so a filter such as `status` survives
paging, and the parameter belonging to the other strategy is dropped, so an offset link never
carries a stale cursor. A keyset page gets only `prev` and `next`, and no total, because it ran
no count.

The call merges rather than replaces: a `Link` header that already holds a `preload` or
`canonical` entry keeps it, and only the four paging relations are rewritten. The links are
built from the `url` you pass, so behind a proxy pass the public URL, or the header advertises
your internal hostname.

## Walk the pages from a client

A client should follow `rel="next"` instead of building URLs itself. The server can then
change strategies, rename a parameter or add a filter without breaking anyone. `parseLinkHeader`
reads the header, from this API or any other:

```typescript {% title="app/services/walk-pages.ts" %}
import { parseLinkHeader } from "@sdxc/pagination";

export async function* walkPages(start: URL, init?: RequestInit) {
	let next: string | null = start.toString();

	while (next !== null) {
		let response = await fetch(next, init);
		yield response;
		if (!response.ok) return;

		let links = parseLinkHeader(response.headers.get("Link"));
		next = links.find((link) => link.rels.includes("next"))?.target ?? null;
	}
}
```

Each response is yielded for the caller to check and parse, and the walk ends at a failed
response or at a page that carries no `next`. A missing header parses to `[]` and a malformed
entry is dropped rather than throwing, so one bad link ends the walk instead of failing it.
For a typed client with schemas on each response, see
[Write a typed API client](/docs/http-apis/api-clients).

## A numbered pager in HTML

`pagination.series()` computes the pager: the first and last pages, a window around the
current one, and a gap marker only where numbers are left out. Each item says what it is, so
rendering it takes a branch per item and no arithmetic. `@sdxc/ui`'s `Pagination` is the
`<nav>` landmark, list and links the items render into:

```tsx {% title="resources/views/pager.tsx" %}
import type { Pagination as Page } from "@sdxc/pagination";
import type { Handle } from "remix/component";

import { Pagination } from "@sdxc/ui";

interface PagerProps {
	label: string;
	url: URL;
	pagination: Page;
}

export function Pager(handle: Handle<PagerProps>) {
	return () => {
		let { label, url, pagination } = handle.props;
		if (pagination.pages === 1) return null;

		let href = (page: number) => {
			let target = new URL(url);
			target.searchParams.set("page", String(page));
			return `${target.pathname}${target.search}`;
		};

		return (
			<Pagination aria-label={label}>
				<Pagination.List>
					{pagination.series({ window: 2 }).map((item, index) => (
						<Pagination.Item
							key={item.type === "gap" ? `gap-${index}` : item.page}
						>
							{item.type === "gap" ? (
								<Pagination.Link aria-disabled="true">
									…
								</Pagination.Link>
							) : (
								<Pagination.Link
									href={href(item.page)}
									aria-current={item.current ? "page" : undefined}
								>
									{String(item.page)}
								</Pagination.Link>
							)}
						</Pagination.Item>
					))}
				</Pagination.List>
			</Pagination>
		);
	};
}
```

Every destination is a plain link, so paging works with the browser's own navigation and no
script. `aria-current="page"` both marks the current page for assistive technology and gives
it the component's active style, and `aria-disabled="true"` renders the gap as inert.
`Pagination` wants an `aria-label`, because a page can hold more than one navigation
landmark. `href` keeps every other query parameter, as `paginate` does for the API.

The page's handler parses the same way the API's does, but a visitor cannot act on a
validation error, so a bad parameter redirects to the first page instead:

```tsx {% title="app/http/controllers/invoices/index.tsx" %}
import { redirect } from "@sdxc/http/response";
import { internalServerError } from "@sdxc/http/response/html";
import { Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { paging } from "~/app/http/paging";
import { invoices } from "~/database/schema";
import Layout from "~/resources/layouts/app";
import { InvoiceTable } from "~/resources/views/invoice-table";
import { Pager } from "~/resources/views/pager";
import routes from "~/routes/web";

export default createAction(routes.invoices.index, async (ctx) => {
	let params = paging.parse(ctx.url.searchParams);
	if (isFailure(params)) return redirect(routes.invoices.index.href());

	let query = ctx.db
		.query(invoices)
		.orderBy("created_at", "desc")
		.orderBy("id", "desc");
	let page = await Pagination.byOffset(query, params.data);
	if (isFailure(page)) {
		ctx.log.fail(page.error);
		return internalServerError("Invoices are unavailable right now.");
	}

	let { items, pagination } = page.data;
	let range = `${pagination.from}–${pagination.to} of ${pagination.total}`;
	return ctx.render(
		<Layout title={`Invoices, page ${pagination.page} of ${pagination.pages}`}>
			<p>{`Showing ${range}`}</p>
			<InvoiceTable invoices={items} />
			<Pager label="Invoice pages" url={ctx.url} pagination={pagination} />
		</Layout>,
	);
});
```

`Pagination` clamps in its constructor, so `?page=500` of 36 renders page 36 and `from`,
`to`, `prev` and `next` all agree with it. `from` and `to` are 1-based and read `0` for an
empty list, and `pages` is `1` even then, so the pager hides itself instead of rendering a
lone "1".

## Older and newer links for a feed

A keyset page has no numbers to render, only a way on from each end. `cursors.next` points
further into the ordering, older here since the feed is newest first, and `cursors.prev`
points back. A single `cursor` parameter carries both, because the direction rides inside the
opaque value:

```tsx {% title="app/http/controllers/activity/index.tsx" %}
import { redirect } from "@sdxc/http/response";
import { internalServerError } from "@sdxc/http/response/html";
import { InvalidCursorError, Pagination as Paging } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { Pagination } from "@sdxc/ui";
import { createAction } from "remix/router";

import { paging } from "~/app/http/paging";
import { events } from "~/database/schema";
import Layout from "~/resources/layouts/app";
import { EventList } from "~/resources/views/event-list";
import routes from "~/routes/web";

export default createAction(routes.activity.index, async (ctx) => {
	let params = paging.parse(ctx.url.searchParams);
	let cursor = isFailure(params) ? null : params.data.cursor;

	let page = await Paging.byKeyset(ctx.db.query(events), {
		orderBy: [["id", "desc"]],
		unique: true,
		cursor,
		limit: 50,
	});
	if (isFailure(page)) {
		if (page.error instanceof InvalidCursorError) {
			return redirect(routes.activity.index.href());
		}
		ctx.log.fail(page.error);
		return internalServerError("Activity is unavailable right now.");
	}

	let { items, cursors } = page.data;
	let href = (value: string) => `${routes.activity.index.href()}?cursor=${value}`;
	return ctx.render(
		<Layout title="Activity">
			<EventList events={items} />
			<Pagination aria-label="Activity pages">
				<Pagination.List>
					{cursors.prev !== null && (
						<Pagination.Item>
							<Pagination.Link href={href(cursors.prev)} rel="prev">
								Newer
							</Pagination.Link>
						</Pagination.Item>
					)}
					{cursors.next !== null && (
						<Pagination.Item>
							<Pagination.Link href={href(cursors.next)} rel="next">
								Older
							</Pagination.Link>
						</Pagination.Item>
					)}
				</Pagination.List>
			</Pagination>
		</Layout>,
	);
});
```

`byKeyset` owns the ordering, because it builds both the seek predicate and the cursor from
it, so hand it a query with predicates and joins but no `orderBy`. A single sort key is refused
with `InvalidOrderingError` unless `unique: true` says it cannot repeat. `id` can say that
here because the ids are unique and time-ordered, such as UUIDv7s. Order by a timestamp and
you need `id` after it as the tiebreaker, as the JSON API guide does. The ordering columns
must be in the query's projection, since the cursor is read off the last row.

Cursors are base64url, so they are safe in a URL as they are, and opaque but not secret: they
carry the ordering values of the boundary row, which the reader can already see. A cursor also
records the ordering it was minted for. Change `orderBy` and every cursor already issued fails
with `InvalidCursorError`, which this page turns into a redirect to the newest page and an API
turns into a `400`. `byKeyset` reads one row past `limit` to learn whether another page exists,
which is how `cursors.next` comes back `null` on the last page without a count.

## Where to go next

- [Build a JSON API with problem details](/docs/http-apis/json-apis): the problem catalog
  these handlers answer with, and a keyset API list.
- [Describe your API with OpenAPI](/docs/http-apis/openapi): document the `page`,
  `per_page` and `cursor` parameters and the `Link` header.
- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui):
  the layout and components the HTML lists render into.
- [`@sdxc/pagination`](/api/pagination): every option, `toJSON()` for an envelope, and the
  cursor functions.
