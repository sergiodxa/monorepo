# @sdxc/pagination

Offset and keyset pagination with parameter parsing and `Link` headers.

A `Pagination` value object holds the page arithmetic, two statics page a `remix/data-table`
query you already composed, `parsePageParams()` validates the request's paging parameters, and
`paginate()` writes the navigation into a response's headers. Nothing reads request context, so
the same calls work in a route handler, an export job or a feed generator.

## Installation

```sh
npm add @sdxc/pagination
```

Fallible calls answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result),
parameter parsing fails with the `ValidationError` from
[`@sdxc/validate`](https://www.npmjs.com/package/@sdxc/validate), and queries come from
`remix/data-table` in [`remix`](https://www.npmjs.com/package/remix). `parseLinkHeader` and
`serializeLinkHeader` are re-exports of [`@sdxc/link-header`](https://www.npmjs.com/package/@sdxc/link-header).

## Usage

The examples page `articles` and `events` tables declared with `remix/data-table`, through a
`db` database from the same package.

### Page arithmetic

```typescript
import { Pagination } from "@sdxc/pagination";

let pagination = new Pagination({ page: 3, perPage: 25, total: 892 });

pagination.pages; // 36
pagination.offset; // 50
pagination.from; // 51
pagination.to; // 75
pagination.next; // 4

new Pagination({ page: 500, perPage: 25, total: 892 }).page; // 36, clamped
```

### Offset paging from request parameters

```typescript
import { Pagination, parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";

import { articles } from "./schema.js";

let params = parsePageParams(url.searchParams); // ?page=3&perPage=25
if (isFailure(params)) return new Response("Bad Request", { status: 400 });

let page = await Pagination.byOffset(db.query(articles).where({ author_id: authorId }), {
	page: params.data.page,
	perPage: params.data.perPage,
});
if (isFailure(page)) throw page.error;

page.data.items; // the rows of page 3
page.data.pagination.total; // 892
```

`byOffset()` runs a count and a fetch; pass `total` when the count is already known and only the
fetch runs.

### Keyset paging for a long feed

```typescript
import { Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";

import { events } from "./schema.js";

let page = await Pagination.byKeyset(db.query(events).where({ team_id: teamId }), {
	orderBy: [
		["created_at", "desc"],
		["id", "desc"],
	],
	cursor: url.searchParams.get("cursor"),
	limit: 50,
});
if (isFailure(page)) throw page.error;

page.data.items;
page.data.cursors; // { next: string | null, prev: string | null }
```

`byKeyset()` applies the ordering itself, so pass a query with its joins and filters but no
`orderBy`. The last sort key breaks ties, and every ordering column must be in the selected row.

### Advertise the page in the response

```typescript
import { paginate } from "@sdxc/pagination";

return Response.json(page.data.items, {
	headers: paginate(new Headers(), page.data, { url }),
});
// Link: <https://api.example.com/articles?page=1>; rel="first",
//       <https://api.example.com/articles?page=2>; rel="prev",
//       <https://api.example.com/articles?page=4>; rel="next",
//       <https://api.example.com/articles?page=36>; rel="last"
// X-Total-Count: 892
```

## API

### `new Pagination(init: PaginationInit)`

A frozen value object built from `page`, `perPage` and `total`. Inputs are truncated to whole
numbers, and `page` is clamped to `1..pages`, so every derived value agrees with it.

| Getter               | Value                                                       |
| -------------------- | ----------------------------------------------------------- |
| `page`, `perPage`    | The resolved page and its size                              |
| `total`, `pages`     | Rows across every page, and the page count (`1` when empty) |
| `offset`, `limit`    | Rows to skip and to take, for a query builder               |
| `from`, `to`         | 1-based indexes of the first and last row, `0` when empty   |
| `hasPrev`, `hasNext` | Whether a page precedes or follows this one                 |
| `prev`, `next`       | The neighbouring page number, or `null` at either end       |

### `pagination.series(options?: PageSeriesOptions): PageSeries`

The pager range: the first and last pages, `window` pages either side of the current one
(default `1`), and a `{ type: "gap" }` item wherever numbers are elided.

```typescript
new Pagination({ page: 18, perPage: 25, total: 892 }).series();
// 1, gap, 17, 18 (current), 19, gap, 36
```

### `pagination.toJSON(): PaginationJSON`

Every getter as a plain property, which is what `JSON.stringify()` writes. The values live on
the prototype, so spread the result of `toJSON()` rather than the instance.

### `Pagination.byOffset(query, options: OffsetOptions): Promise<Result<Page<T>, PaginationError>>`

Counts the query, then fetches `options.page` (1-based, clamped against the total) of
`options.perPage` rows. `options.total` skips the count. A database failure answers
`QueryFailedError`.

### `Pagination.byKeyset(query, options: KeysetOptions): Promise<Result<KeysetPage<T>, PaginationError>>`

Seeks the query from an opaque cursor and returns `limit` rows with the cursors of the
neighbouring pages.

- `orderBy`: `[column, direction]` sort keys, most significant first; the last breaks ties
- `unique`: `true` allows a single sort key that is already unique, such as a primary key
- `cursor`: seeks in the direction the cursor was minted for
- `after` / `before`: seek forward or backward from a cursor
- `limit`: rows per page

At most one of `cursor`, `after` and `before` may be given; an empty string counts as absent.
Rows always come back in `orderBy` order, whichever way the page was sought.

### `parsePageParams(searchParams, options?: ParsePageParamsOptions): Result<PageParams, ValidationError>`

Reads `page`, `perPage` and `cursor` into `{ page, perPage, cursor }`. `page` must be a whole
number from 1 and defaults to 1; `perPage` must be a whole number within `1..options.maxPerPage`
(default `100`) and defaults to `options.perPage` (default `25`); `cursor` is `null` when absent.
A blank parameter counts as absent, and a page past the end parses, for `Pagination` to clamp.

### `createPaging(options?: CreatePagingOptions): Paging`

Binds parameter names and page-size limits once, returning `parse(searchParams)` and
`paginate(headers, page, { url })`, so a route reads the same spelling it writes into its links.
`options.names` overrides any of `page`, `perPage` and `cursor`; `options.perPage` and
`options.maxPerPage` are the parsing limits.

### `paginate(headers, page, options: PaginateOptions): Headers`

Writes navigation for a `Page<T>` or a `KeysetPage<T>` into `headers` and returns the same
instance. An offset page gets `first`, `prev`, `next` and `last` links plus `X-Total-Count`; a
keyset page gets `prev` and `next`. Links are built from `options.url` with every other query
parameter kept. Existing paging relations in
[`Link`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Link) are replaced
and every other relation is kept, so the call is safe to repeat.

### `parseLinkHeader(header: string | null): LinkValue[]`

Re-export of `parse` from [`@sdxc/link-header`](https://www.npmjs.com/package/@sdxc/link-header).
Splits a `Link` header into `{ target, rels, params, raw }` entries in source order, per
[RFC 8288](https://www.rfc-editor.org/rfc/rfc8288). A `null` header answers `[]`, and a
malformed entry is skipped.

### `serializeLinkHeader(links: readonly LinkValue[] | readonly string[]): string | null`

Re-export of `stringify` from [`@sdxc/link-header`](https://www.npmjs.com/package/@sdxc/link-header).
Joins link-value strings, or the `raw` of parsed entries, into one header value, or `null`
for an empty list.

### `serializeLink(target: string, rel: string, params?: Record<string, string>): string`

Re-export of `serializeLink` from [`@sdxc/link-header`](https://www.npmjs.com/package/@sdxc/link-header).
Renders one link-value with a quoted `rel` and any extra parameters after it.

### `encodeCursor(direction, columns, values): Result<string, UnencodableCursorValueError>`

Encodes a page boundary as a URL-safe base64url cursor. Cursors are opaque but readable, so
order by columns the client may see. A `null` or non-primitive value fails.

### `decodeCursor(cursor: string): Result<DecodedCursor, InvalidCursorError>`

Decodes a cursor into `{ direction, columns, values }`; any malformed input answers
`InvalidCursorError`.

### Defaults

`DEFAULT_PAGING_NAMES` is `{ page: "page", perPage: "perPage", cursor: "cursor" }`,
`DEFAULT_PER_PAGE` is `25` and `DEFAULT_MAX_PER_PAGE` is `100`.

### Errors

Every error extends `PaginationError`.

| Error                         | Cause                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `InvalidCursorError`          | A malformed cursor, one minted for another ordering, or two cursors given                        |
| `InvalidOrderingError`        | No sort keys, a repeated column, a lone non-unique key, or a query that already has an `orderBy` |
| `UnencodableCursorValueError` | A row's ordering value is `null` or not a primitive                                              |
| `QueryFailedError`            | The database threw; the original error is in `cause`                                             |

### Types

`Page<T>` is `{ items, pagination }` and `KeysetPage<T>` is `{ items, cursors }`, with
`KeysetCursors` holding `next` and `prev`. `PageSeries` is an array of `PageSeriesItem`, either
`{ type: "page", page, current }` or `{ type: "gap" }`. `OrderByTuple` is
`[column, OrderDirection]`, where a column may be table-qualified (`"events.created_at"`).
`LinkValue` is a parsed `Link` entry (`target`, `rels`, `params`, `raw`) and `DecodedCursor` a decoded cursor, with `CursorDirection`
and `CursorValue`. `OffsetQuery` and `KeysetQuery` describe the query methods each strategy
calls. The options and results above are `PaginationInit`, `PaginationJSON`, `PageSeriesOptions`,
`OffsetOptions`, `KeysetOptions`, `ParsePageParamsOptions`, `PageParams`, `CreatePagingOptions`,
`PagingNames`, `Paging` and `PaginateOptions`.

## Pattern: One API, Both Strategies

Bind the parameter names once so both handlers read `?per_page=` and write it into their links.

```typescript
import { createPaging, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";

import { articles, events } from "./schema.js";

let paging = createPaging({ names: { perPage: "per_page" }, perPage: 20, maxPerPage: 50 });

export async function listArticles(url: URL) {
	let params = paging.parse(url.searchParams);
	if (isFailure(params)) return Response.json(params.error.issues, { status: 400 });

	let page = await Pagination.byOffset(db.query(articles), params.data);
	if (isFailure(page)) return new Response(null, { status: 500 });

	return Response.json(page.data.items, {
		headers: paging.paginate(new Headers(), page.data, { url }),
	});
}

export async function listEvents(url: URL) {
	let params = paging.parse(url.searchParams);
	if (isFailure(params)) return Response.json(params.error.issues, { status: 400 });

	let page = await Pagination.byKeyset(db.query(events), {
		orderBy: [
			["created_at", "desc"],
			["id", "desc"],
		],
		cursor: params.data.cursor,
		limit: params.data.perPage,
	});
	if (isFailure(page)) return new Response(null, { status: 500 });

	return Response.json(page.data.items, {
		headers: paging.paginate(new Headers(), page.data, { url }),
	});
}
```

## Pattern: Answering Each Error

A bad cursor is the client's mistake, a bad ordering is the code's, and a failed query is the
database's.

```typescript
import {
	InvalidCursorError,
	InvalidOrderingError,
	Pagination,
	QueryFailedError,
} from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";

import { events } from "./schema.js";

export async function listEvents(url: URL) {
	let page = await Pagination.byKeyset(db.query(events), {
		orderBy: [["id", "asc"]],
		unique: true,
		after: url.searchParams.get("after"),
		before: url.searchParams.get("before"),
		limit: 50,
	});

	if (isFailure(page)) {
		if (page.error instanceof InvalidCursorError) {
			return Response.json({ error: page.error.message }, { status: 400 });
		}
		if (page.error instanceof QueryFailedError) reportError(page.error.cause);
		if (page.error instanceof InvalidOrderingError) reportError(page.error);
		return new Response(null, { status: 500 });
	}

	return Response.json({
		data: page.data.items,
		next: page.data.cursors.next,
		prev: page.data.cursors.prev,
	});
}
```

## Pattern: Rendering A Numbered Pager

`series()` states what each item is, so the pager is a loop with no arithmetic.

```tsx
import type { PageSeries } from "@sdxc/pagination";
import type { Handle } from "remix/component";

import { css } from "remix/component";

export function Pager(handle: Handle<{ series: PageSeries }>) {
	return () => (
		<nav aria-label="Pages" mix={css({ display: "flex", gap: "0.5rem" })}>
			{handle.props.series.map((item) => {
				if (item.type === "gap") return <span aria-hidden="true">…</span>;
				if (item.current) return <span aria-current="page">{item.page}</span>;
				return <a href={`?page=${item.page}`}>{item.page}</a>;
			})}
		</nav>
	);
}
```

Render it with `<Pager series={page.data.pagination.series({ window: 2 })} />`.

## Pattern: Page Numbers In The Body

When a client wants the numbers in the payload, put the value object there; `toJSON()` writes
every getter.

```typescript
import { paginate, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";

import { articles } from "./schema.js";

let page = await Pagination.byOffset(db.query(articles), { page: 2, perPage: 25 });
if (isFailure(page)) throw page.error;

return Response.json(
	{ data: page.data.items, meta: page.data.pagination },
	{ headers: paginate(new Headers(), page.data, { url }) },
);
// meta: { page: 2, perPage: 25, total: 892, pages: 36, offset: 25, ..., next: 3 }
```

## Pattern: Following Next Links As A Client

`parseLinkHeader()` reads any server's `Link` header, so a client walks a paginated API until
`rel="next"` runs out.

```typescript
import { parseLinkHeader } from "@sdxc/pagination";

export async function fetchAll<T>(start: string): Promise<T[]> {
	let items: T[] = [];
	let next: string | null = start;

	while (next !== null) {
		let response = await fetch(next);
		items.push(...((await response.json()) as T[]));

		let links = parseLinkHeader(response.headers.get("Link"));
		next = links.find((link) => link.rels.includes("next"))?.target ?? null;
	}

	return items;
}
```

## Pattern: Paging Links Beside Other Links

`paginate()` keeps relations it does not own, so a preload or canonical link set earlier
survives, and `serializeLinkHeader()` rebuilds a header from parsed entries.

```typescript
import { paginate, parseLinkHeader, serializeLinkHeader } from "@sdxc/pagination";

let headers = new Headers({ Link: '</app.css>; rel="preload"; as="style"' });
paginate(headers, page.data, { url });
// Link: </app.css>; rel="preload"; as="style", <…?page=1>; rel="first", …

let withoutPreload = parseLinkHeader(headers.get("Link"))
	.filter((link) => !link.rels.includes("preload"))
	.map((link) => link.raw);
let value = serializeLinkHeader(withoutPreload);
if (value === null) headers.delete("Link");
else headers.set("Link", value);
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/pagination": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
