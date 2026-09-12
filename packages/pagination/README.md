# @sdxc/pagination

Offset and keyset pagination with parameter parsing and `Link` headers.

One vocabulary for both strategies: a `Pagination` value object holding the arithmetic, two
statics that page a query you already composed, one place where request parameters are
validated, and one function that writes the navigation into a response's headers.

The package returns data and writes headers. It constructs no responses and renders nothing,
and it reads no request context, so the same calls work in a route handler, an export job, or
a feed generator.

## Installation

```bash
npm add @sdxc/pagination
```

Every fallible call answers with a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which is where `isFailure` comes
from, and parameter parsing fails with a `ValidationError` from
[`@sdxc/validate`](https://www.npmjs.com/package/@sdxc/validate). The two strategies page a
query built with `remix/data-table`, from
[`remix`](https://www.npmjs.com/package/remix). All three install alongside this package.

## Usage

### Page Arithmetic On Its Own

```typescript
import { Pagination } from "@sdxc/pagination";

let pagination = new Pagination({ page: 3, perPage: 25, total: 892 });

pagination.pages; // 36
pagination.offset; // 50
pagination.limit; // 25
pagination.from; // 51
pagination.to; // 75
```

The constructor is the one place clamping happens, so a request for page 500 of 36 resolves to
page 36 and every derived value agrees with it.

### Offset Paging, With A Numbered Pager

```typescript
import { Pagination, parsePageParams } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";

let params = parsePageParams(url.searchParams);
if (isFailure(params)) return redirect(url.pathname);

let page = await Pagination.byOffset(db.query(articles).where({ author_id: authorId }), {
	page: params.data.page,
	perPage: params.data.perPage,
});
if (isFailure(page)) throw page.error;

page.data.items; // Article[]
page.data.pagination.total; // 892
page.data.pagination.series(); // the pager range, gaps included
```

Offset paging costs two queries per page, one to count and one to fetch. Pass `total` when it
is already known and the count is skipped.

### Keyset Paging, For A Long Feed

```typescript
import { Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";

let page = await Pagination.byKeyset(db.query(events).where({ team_id: teamId }), {
	orderBy: [
		["created_at", "desc"],
		["id", "desc"],
	],
	cursor: params.data.cursor,
	limit: 50,
});
if (isFailure(page)) throw page.error;

page.data.items;
page.data.cursors; // { next: string | null, prev: string | null }
```

`byKeyset()` owns the ordering, so hand it a query carrying joins and predicates but no sort
keys. It reads one row past the limit to learn whether a further page exists, rather than
counting.

### Advertising A Page In The Response

```typescript
import { paginate } from "@sdxc/pagination";

let headers = new Headers();
headers.set("Cache-Control", "private, max-age=60");

paginate(headers, page.data, { url });

headers.get("Link");
// <https://api.example.com/articles?page=1>; rel="first",
// <https://api.example.com/articles?page=2>; rel="prev",
// <https://api.example.com/articles?page=4>; rel="next",
// <https://api.example.com/articles?page=36>; rel="last"
headers.get("X-Total-Count"); // "892"
```

## API

### `new Pagination(init: PaginationInit)`

Page arithmetic for one page of one query, from `page`, `perPage`, and `total`. The instance is
frozen, and non-finite, fractional, and negative inputs are normalized rather than trusted,
because they arrive from query strings.

Every value beyond the three inputs is a getter on the prototype, computed on read:

| Getter    | Type             | Description                                                      |
| --------- | ---------------- | ---------------------------------------------------------------- |
| `page`    | `number`         | Resolved page, always within `1..pages`                          |
| `perPage` | `number`         | Rows per page                                                    |
| `total`   | `number`         | Total rows across every page                                     |
| `pages`   | `number`         | Page count; `1` even for an empty result, so `page` stays valid  |
| `offset`  | `number`         | Rows to skip to reach this page                                  |
| `limit`   | `number`         | Rows to take; the same as `perPage`, named for the query builder |
| `from`    | `number`         | 1-based index of the first row, or `0` when there are no rows    |
| `to`      | `number`         | 1-based index of the last row, or `0` when there are no rows     |
| `hasPrev` | `boolean`        | Whether a page precedes this one                                 |
| `hasNext` | `boolean`        | Whether a page follows this one                                  |
| `prev`    | `number \| null` | Previous page, or `null` on the first page                       |
| `next`    | `number \| null` | Next page, or `null` on the last page                            |

### `pagination.series(options?: PageSeriesOptions): PageSeries`

Builds the pager range, with a gap marker only where numbers are actually elided. `window` is
how many pages show either side of the current one, default `1`; the first and last pages are
always present regardless of it.

```typescript
new Pagination({ page: 18, perPage: 25, total: 892 }).series();
// [
//   { type: "page", page: 1, current: false },
//   { type: "gap" },
//   { type: "page", page: 17, current: false },
//   { type: "page", page: 18, current: true },
//   { type: "page", page: 19, current: false },
//   { type: "gap" },
//   { type: "page", page: 36, current: false },
// ]
```

Page numbers need a total, so `series()` belongs to offset paging. A keyset page carries
`cursors` instead, and renders older and newer links from those.

### `pagination.toJSON(): PaginationJSON`

Returns every value as own properties, which `JSON.stringify()` calls for you. It is the only
way an instance serializes: the getters live on the prototype, so `{ ...pagination }` produces
`{}` and `Object.keys(pagination)` produces `[]`.

### `Pagination.byOffset(query, options): Promise<Result<Page<T>, PaginationError>>`

Counts a composed query, then executes it with `limit` and `offset` applied. `options.page` is
1-based and clamped against the total, `options.perPage` is the page size, and `options.total`
supplies a count that is already known.

The query runs twice, which is safe because the builder's chaining returns new query values
rather than mutating in place, and its `count()` wraps the composed predicate in a subquery
that ignores limit, offset, and ordering. A database that refuses comes back as
`QueryFailedError`.

### `Pagination.byKeyset(query, options): Promise<Result<KeysetPage<T>, PaginationError>>`

Seeks a composed query from an opaque cursor.

- `options.orderBy`: Sort keys, most significant first; the last one is the tiebreaker
- `options.unique`: Declares that a one-column ordering is already unique, such as a primary key
- `options.after`: Seek forward from this cursor
- `options.before`: Seek backward from this cursor
- `options.cursor`: Seek in whichever direction the cursor was minted for
- `options.limit`: Rows per page

The ordering must be deterministic, so a single sort key is refused unless `unique: true` says
it is already unique — rows sharing a sort value otherwise straddle the page boundary and are
skipped or served twice. At most one of `after`, `before`, and `cursor` may be given. `cursor`
is what lets one query parameter carry both directions, since the direction rides inside the
opaque value, and paging backward runs the query reversed and reverses the rows again so a page
always reads in the requested order.

```typescript
let page = await Pagination.byKeyset(db.query(events), {
	orderBy: [["id", "desc"]],
	unique: true,
	limit: 50,
});
```

### `parsePageParams(searchParams, options?): Result<PageParams, ValidationError>`

Validates the paging parameters on a request URL under the default names `page`, `perPage`, and
`cursor`, answering `{ page, perPage, cursor }` with `cursor` `null` when absent.
`options.perPage` is the size used when the request does not ask for one, and
`options.maxPerPage` the largest a request may ask for.

A page that is not a whole number at or above 1 fails, and so does a page size outside
`1..maxPerPage`, which is what stops a client asking for every row. A blank parameter
(`?page=`) is treated as absent. A page _past the end_ succeeds: clamping belongs to
`Pagination`, which needs the total to know where the end is.

### `createPaging(options?): Paging`

Binds parameter names and page-size limits to the two functions that need them, returning
`parse(searchParams)` and `paginate(headers, page, options)` with those names applied.
`options.names` spells each parameter, defaulted per field, while `options.perPage` and
`options.maxPerPage` carry the limits.

Two halves care what the parameters are called: parsing reads them off an incoming URL, and
`paginate()` writes them into the `Link` URLs it advertises. Custom names exist only in this
factory, so an API cannot accept `?per_page=50` while advertising `?perPage=50`.

```typescript
let PAGING = createPaging({
	names: { page: "page", perPage: "per_page", cursor: "cursor" },
	perPage: 25,
	maxPerPage: 100,
});

let params = PAGING.parse(url.searchParams);
PAGING.paginate(headers, page, { url }); // ?per_page=… in every Link
```

### `paginate(headers, page, options): Headers`

Writes a page's navigation into a response's own headers and returns the same instance, so the
call can sit inline in a response's argument list. `page` is a `Page<T>` or a `KeysetPage<T>`
and the shape decides what is emitted; `options.url` is the URL the links are built from.

An offset page emits `first`, `prev`, `next`, `last`, and `X-Total-Count`. A keyset page emits
`prev` and `next` only, and no total: it runs no count query, so it cannot know how many pages
there are. Every other query parameter is carried over, so filters and sort options survive
paging, and the parameter belonging to the other strategy is dropped so an offset link never
advertises a stale cursor.

`X-Total-Count` is replaced, and
[`Link`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Link) is merged:
`rel="preload"`, `rel="canonical"`, and `rel="alternate"` share that header, so only the four
paging relations are dropped before the new ones are appended. That also makes the call
idempotent. Splitting the existing value respects angle brackets and quoted strings, per
[RFC 8288](https://www.rfc-editor.org/rfc/rfc8288), so a hint whose URL contains a comma comes
back out byte for byte.

The `url` is explicit rather than configured, so a service behind a proxy passes its public URL
and advertises that instead of an internal hostname. The total uses `X-Total-Count` because
that is the name existing client libraries look for, which is worth the `X-` prefix
[RFC 6648](https://www.rfc-editor.org/rfc/rfc6648) otherwise discourages.

### `encodeCursor(direction, columns, values): Result<string, UnencodableCursorValueError>`

Encodes a page boundary as an opaque, URL-safe cursor. `byKeyset()` calls it for you; it is
exported for tests and for a store that pages itself. A cursor is plain base64url — opaque but
not secret — so it carries only ordering keys the client is already allowed to see.

### `decodeCursor(cursor): Result<DecodedCursor, InvalidCursorError>`

Decodes and validates a cursor into `{ direction, columns, values }`. Bad base64url, bad UTF-8,
bad JSON, and a merely plausible payload all collapse into `InvalidCursorError`, so a
client-supplied cursor never reaches `JSON.parse` and throws.

### Defaults

`DEFAULT_PAGING_NAMES` is `{ page: "page", perPage: "perPage", cursor: "cursor" }`, the spelling
the standalone functions read and write. `DEFAULT_PER_PAGE` is `25` and `DEFAULT_MAX_PER_PAGE`
is `100`.

### Errors

All of them extend `PaginationError`, so one `instanceof` check covers paging while the
subclasses let a handler tell a client's mistake apart from an infrastructure failure.

| Error                         | Meaning                                                | Typical answer   |
| ----------------------------- | ------------------------------------------------------ | ---------------- |
| `InvalidCursorError`          | Undecodable cursor, or one issued for another ordering | `400`            |
| `InvalidOrderingError`        | The ordering cannot page deterministically             | a bug, not input |
| `UnencodableCursorValueError` | A row's ordering value is `null` or not a primitive    | a schema problem |
| `QueryFailedError`            | The database refused; the throw is kept in `cause`     | `500`            |

### Types

```typescript
type PageSeriesItem = { type: "page"; page: number; current: boolean } | { type: "gap" };

type PageSeries = PageSeriesItem[];

type OrderByTuple = readonly [column: string, direction: "asc" | "desc"];

interface Page<T> {
	items: T[];
	pagination: Pagination;
}

interface KeysetPage<T> {
	items: T[];
	cursors: { next: string | null; prev: string | null };
}
```

`PageSeriesItem` is a discriminated union, so a pager is a `switch` over `type` that reads
properties, with no arithmetic and no comparison back to `pagination.page`. An `OrderByTuple`
column may be qualified (`"events.created_at"`); the unqualified segment is what is read off a
result row when a cursor is minted, so an ordering column must be present in the query's
projection.

The options and result shapes named in the signatures above — `PaginationInit`,
`PaginationJSON`, `PageSeriesOptions`, `OffsetOptions`, `KeysetOptions`, `KeysetCursors`,
`OffsetQuery`, `KeysetQuery`, `PaginateOptions`, `PagingNames`, `Paging`, `CreatePagingOptions`,
`ParsePageParamsOptions`, `PageParams`, `CursorValue`, `CursorDirection`, and `DecodedCursor` —
are exported as types too.

## Pattern: One Route, Both Strategies

Binding the parameter names once means both handlers spell the page size the same way in the
query string they read and in the `Link` URLs they emit.

```typescript
import { createPaging, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";

let PAGING = createPaging({
	names: { page: "page", perPage: "per_page", cursor: "cursor" },
	perPage: 25,
	maxPerPage: 100,
});

/** A rendered list: numbered pager, all four relations, and a total. */
export async function listArticles(url: URL, authorId: string) {
	// A malformed page or size is not worth an error page; drop the query string
	// and let the canonical URL render the first page.
	let params = PAGING.parse(url.searchParams);
	if (isFailure(params)) return Response.redirect(new URL(url.pathname, url), 302);

	let page = await Pagination.byOffset(db.query(articles).where({ author_id: authorId }), {
		page: params.data.page,
		perPage: params.data.perPage,
	});
	if (isFailure(page)) throw page.error;

	return Response.json(
		{ data: page.data.items, series: page.data.pagination.series() },
		{ headers: PAGING.paginate(new Headers(), page.data, { url }) },
	);
}

/** A JSON feed: cursor links only, walked by following them. */
export async function listEvents(url: URL, teamId: string) {
	let params = PAGING.parse(url.searchParams);
	if (isFailure(params)) return new Response("Bad Request", { status: 400 });

	let page = await Pagination.byKeyset(db.query(events).where({ team_id: teamId }), {
		orderBy: [
			["created_at", "desc"],
			["id", "desc"],
		],
		cursor: params.data.cursor,
		limit: params.data.perPage,
	});
	if (isFailure(page)) throw page.error;

	return Response.json(page.data.items, {
		headers: PAGING.paginate(new Headers(), page.data, { url }),
	});
}
```

Either strategy works with either response kind; this pairing is the common one, since a
numbered pager needs a total and a long feed is cheaper to seek than to offset.

## Pattern: Rendering A Pager From `series()`

```tsx
import type { PageSeries } from "@sdxc/pagination";

function Pager({ series }: { series: PageSeries }) {
	return (
		<nav>
			{series.map((item) => {
				if (item.type === "gap") return <span aria-hidden>…</span>;
				if (item.current) return <span aria-current="page">{item.page}</span>;
				return <a href={`?page=${item.page}`}>{item.page}</a>;
			})}
		</nav>
	);
}
```

No arithmetic, no `typeof` narrowing, and no comparison back to the current page: the item
states what it is. `PageSeries` is a plain type, so a hydrating client imports it and renders
the array the server already computed while the class stays on the server.

## Pattern: Serializing Into An Envelope

Headers are the interoperable way to express navigation, and they keep the response body the
resource itself. When a client genuinely needs the numbers in the body, serialize the value
object rather than rebuilding it:

```typescript
return Response.json({ data: page.data.items, meta: page.data.pagination });
// meta is the full plain shape, via toJSON()
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
