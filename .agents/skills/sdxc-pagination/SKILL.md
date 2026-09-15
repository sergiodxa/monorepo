---
name: sdxc-pagination
description: "@sdxc/pagination gives offset and keyset paging over a `remix/data-table` query: the `Pagination` value object (`offset`, `limit`, `from`, `to`, `series()`), `Pagination.byOffset` and `Pagination.byKeyset`, `parsePageParams` / `createPaging`, and `paginate()` which writes `Link` and `X-Total-Count`. Use when building a numbered pager, a cursor-paged feed, validation for `?page=` / `?perPage=` / `?cursor=`, or RFC 8288 navigation headers."
---

# @sdxc/pagination

One vocabulary for both paging strategies: a frozen `Pagination` value object that holds the
arithmetic, two statics (`Pagination.byOffset`, `Pagination.byKeyset`) that page a query already
composed with `remix/data-table`, one place where request parameters are validated
(`parsePageParams`, or `createPaging` to bind custom parameter names), and one function
(`paginate`) that writes the navigation into a response's headers. It returns data and writes
headers — it constructs no responses, renders nothing, and reads no request context, so the same
calls work in a route handler, an export job, or a feed generator. Every fallible call answers
with a `Result`.

Full API, options and examples: [packages/pagination/README.md](packages/pagination/README.md)

## When to reach for it

- A list endpoint needs `Link` and `X-Total-Count` headers a client library can follow
- A numbered pager has to render page numbers with gaps, without arithmetic in the view
- A long feed should seek by cursor instead of paying an `offset` scan and a count query per page
- Query-string paging parameters need validating, and the page-size ceiling enforcing, before they reach the database
- An opaque cursor arrived from a client and must be decoded without letting bad input reach `JSON.parse`

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/pagination": "workspace:*" } }
```

```ts
import { Pagination, parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";

let params = parsePageParams(url.searchParams);
if (isFailure(params)) return redirect(url.pathname);

let page = await Pagination.byOffset(db.query(articles).where({ author_id: authorId }), {
	page: params.data.page,
	perPage: params.data.perPage,
});
if (isFailure(page)) throw page.error;

page.data.items;
page.data.pagination.total;
page.data.pagination.series(); // the pager range, gaps included
```

## Suggestions

- Bind the parameter names once with `createPaging({ names, perPage, maxPerPage })` and use its `parse` and `paginate`. Custom names exist only in that factory, which is what stops an API accepting `?per_page=50` while advertising `?perPage=50`.
- `byKeyset()` owns the ordering, so hand it a query carrying joins and predicates but no sort keys. A single sort key is refused unless `unique: true` says it is already unique, because rows sharing a sort value otherwise straddle the page boundary.
- `series()` belongs to offset paging only: page numbers need a total, and a keyset page carries `cursors` instead. A keyset `paginate()` emits `prev` and `next` and no total, since it runs no count.
- `paginate()` merges into an existing `Link` header rather than replacing it, dropping only the four paging relations, which makes the call idempotent and leaves `preload` / `canonical` / `alternate` hints intact. Pass the public `url` explicitly when the service sits behind a proxy.
- Every error extends `PaginationError`, so one `instanceof` covers paging while `InvalidCursorError` (a client mistake, `400`) stays distinguishable from `QueryFailedError` (a `500`).

## Related

- `@sdxc/result` — every fallible call answers with its `Result`, and `isFailure` is how a caller branches; skill `sdxc-result`
- `@sdxc/validate` — parameter parsing fails with its `ValidationError`; skill `sdxc-validate`
