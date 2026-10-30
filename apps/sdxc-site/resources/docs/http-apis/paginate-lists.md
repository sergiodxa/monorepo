---
title: Paginate lists
description: Page by offset or keyset, validate the page parameters, advertise pages in Link headers, and render a pager in HTML.
section:
    title: HTTP APIs
    order: 5
order: 5
lastUpdated: 2026-10-25
outcomes:
    - "When to page by offset and when by keyset with `@sdxc/pagination`"
    - "How to validate page parameters and advertise pages in `Link` headers"
    - "How to render a numbered pager and older and newer feed links"
---

[Build a JSON API with problem details](/docs/http-apis/json-apis) pages its book list by
keyset in a single handler. This guide covers the rest: when to page by offset and when by
keyset, validating the page parameters, advertising pages in `Link` headers, and rendering
them as HTML. [`@sdxc/pagination`](/api/pagination) does the paging and writes the headers,
and [`@sdxc/ui`](/api/ui) draws the pager.

```bash
npm add @sdxc/http @sdxc/pagination @sdxc/problem @sdxc/result @sdxc/ui remix
```

## Offset or keyset

Both strategies page a `remix/data-table` query you have already composed. They differ in
cost and in what the reader can do:

|                            | Offset (`Pagination.byOffset`)                 | Keyset (`Pagination.byKeyset`) |
| -------------------------- | ---------------------------------------------- | ------------------------------ |
| The request carries        | `?page=3`                                      | `?cursor=…`                    |
| Jump to page 30            | yes                                            | no, only previous and next     |
| Knows the total            | yes, `X-Total-Count`                           | no                             |
| Deep pages                 | slower, the database skips every earlier row   | as fast as the first           |
| Rows inserted while paging | shift the pages, so a row repeats or is missed | nothing shifts                 |

Page by offset when a person wants page numbers and a total: invoices, members, search
results. Page by keyset when the list only grows and is read from the newest end: activity,
logs, any collection a client syncs.

## Bind the parameters once

`createPaging` binds the parameter names your `Link` URLs advertise to the default and
largest page size, so every list in the app parses and links the same way:

```typescript {% title="app/http/validators/paging.ts" %}
import { createPaging } from "@sdxc/pagination";

export const paging = createPaging({
	names: { perPage: "per_page" },
	perPage: 25,
	maxPerPage: 100,
});
```

`paging.parse(searchParams)` answers `{ page, perPage, cursor }`. It fails with a
`ValidationError` for a page below 1 or a page size outside `1..maxPerPage`, which stops a
client from asking for every row at once. A page past the end succeeds; `byOffset` clamps it
once it knows the total.

## Offset pages for an API

End the ordering in a unique column. Two invoices created in the same second would otherwise
trade places between pages, and one of them would show twice.

```typescript {% title="app/http/controllers/api/invoices/index.ts" %}
import { ok } from "@sdxc/http/response/json";
import { Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { serializeInvoice } from "~/app/models/invoice";
import { paging } from "~/app/http/validators/paging";
import problems from "~/config/problems";
import { invoices } from "~/database/schema";
import routes from "~/routes/api";

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
parameter answers the same `422` a bad body does. `paginate` writes the navigation into the
response headers; an offset page gets all four relations and the total:

```bash
curl -sI "https://app.example.com/api/invoices?status=open&page=3"
# Link: <https://app.example.com/api/invoices?status=open&page=1>; rel="first",
#   <https://app.example.com/api/invoices?status=open&page=2>; rel="prev",
#   <https://app.example.com/api/invoices?status=open&page=4>; rel="next",
#   <https://app.example.com/api/invoices?status=open&page=36>; rel="last"
# X-Total-Count: 892
```

Every other query parameter is carried into the links, so a filter such as `status` survives
paging. A keyset page gets only `prev` and `next`, and no total.

> [!WARNING]
> The links are built from the `url` you pass. Behind a proxy, pass the public URL the client
> called, so the header advertises your public hostname and every link a client follows reaches
> you through the proxy.

## A numbered pager in HTML

`pagination.series()` computes the pager: the first and last pages, a window around the
current one, and gap markers. `@sdxc/ui`'s `Pagination` is the `<nav>` landmark the items
render into:

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

Every destination is a plain link, so paging works with no script. A page handler pages the
same query as the API and renders `<Pager>` with `page.data.pagination`; a visitor cannot act
on a validation error, so redirect a bad parameter to the first page instead.

## Older and newer links for a feed

A keyset page has no numbers, only a way on from each end. `cursors.next` points further
into the ordering (older, since the feed is newest first) and `cursors.prev` points back. One
`cursor` parameter carries both, because the direction rides inside the opaque value:

```tsx {% title="app/http/controllers/activity/index.tsx" %}
import { redirect } from "@sdxc/http/response";
import { internalServerError } from "@sdxc/http/response/html";
import { InvalidCursorError, Pagination as Paging } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { Pagination } from "@sdxc/ui";
import { createAction } from "remix/router";

import page from "~/app/http/middleware/page";
import { paging } from "~/app/http/validators/paging";
import { events } from "~/database/schema";
import DocumentLayout from "~/resources/layouts/document";
import { EventList } from "~/resources/views/event-list";
import routes from "~/routes/web";

export default createAction(routes.activity.index, {
	middleware: page,
	async handler(ctx) {
		let params = paging.parse(ctx.url.searchParams);
		let cursor = isFailure(params) ? null : params.data.cursor;

		let result = await Paging.byKeyset(ctx.db.query(events), {
			orderBy: [["id", "desc"]],
			unique: true,
			cursor,
			limit: 50,
		});
		if (isFailure(result)) {
			if (result.error instanceof InvalidCursorError) {
				return redirect(routes.activity.index.href());
			}
			ctx.log.fail(result.error);
			return internalServerError("Activity is unavailable right now.");
		}

		let { items, cursors } = result.data;
		let href = (value: string) =>
			`${routes.activity.index.href()}?cursor=${value}`;
		return ctx.render(
			<DocumentLayout
				assets={ctx.assets}
				intl={ctx.intl}
				url={ctx.url}
				title="Activity"
			>
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
			</DocumentLayout>,
		);
	},
});
```

`byKeyset` owns the ordering, so hand it a query with no `orderBy`. A single sort key is
refused unless `unique: true` says it cannot repeat, as time-ordered UUIDv7 ids can; order by
a timestamp and add `id` after it as the tiebreaker.

> [!WARNING]
> A cursor records the ordering it was minted for. Change `orderBy` and every cursor already
> issued fails with `InvalidCursorError`, which this page turns into a redirect to the newest
> page and an API turns into a `400`, so a client mid-walk starts over.

## Test the parameters and the headers

The binding and the headers are the contract a client sees, so test them without a database.
A `Pagination` built by hand stands in for a query's page:

```typescript {% title="app/http/validators/paging.test.ts" %}
import { Pagination } from "@sdxc/pagination";
import { isSuccess } from "@sdxc/result";
import { expect, test } from "vitest";

import { paging } from "~/app/http/validators/paging";

test("refuses a page size above the maximum", () => {
	let params = paging.parse(new URLSearchParams("per_page=500"));
	expect(isSuccess(params)).toBe(false);
});

test("links the next page and keeps the filter", () => {
	let pagination = new Pagination({ page: 3, perPage: 25, total: 892 });
	let headers = paging.paginate(
		new Headers(),
		{ items: [], pagination },
		{ url: "https://app.example.com/api/invoices?status=open&page=3" },
	);

	expect(headers.get("Link")).toContain(
		'<https://app.example.com/api/invoices?status=open&page=4>; rel="next"',
	);
	expect(headers.get("X-Total-Count")).toBe("892");
});
```

## Where to go next

- [Build a JSON API with problem details](/docs/http-apis/json-apis): the problem catalog
  these handlers answer with, and a keyset API list.
- [Write a typed API client](/docs/http-apis/api-clients): follow `rel="next"` from a client.
- [`@sdxc/pagination`](/api/pagination): every option, `toJSON()` for an envelope, and the
  cursor functions.
