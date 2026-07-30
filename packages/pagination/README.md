# @pkg/pagination

Page arithmetic, offset and keyset query strategies, request parameter parsing, and response header annotation.

## Overview

Listing screens want page numbers and a total; append-only histories want a cursor
they can walk without paying for a growing offset. This package covers both with one
vocabulary: a `Pagination` value object holding every number a view or a response
needs, two static strategies over a `remix/data-table` query, one place where page
parameters are validated, and one function that writes `Link` and `X-Total-Count`.

The package returns data and writes headers. It constructs no responses and renders
nothing, which is why it needs no dependency on the HTTP package: bodies belong to
`json()` and to the app's own components, and a pager component belongs in the UI
package and consumes `series()`.

Nothing here touches a request context. Pagination is computed from numbers and a
URL, so the same functions work in an export job or a feed generator, and there is no
middleware to register.

## Usage

### Offset paging, with a numbered pager

```typescript
import { createPaging, Pagination } from "@pkg/pagination";
import { isFailure } from "@pkg/result";

/** Query parameter names and page-size limits, shared by parsing and `Link` generation. */
const PAGING = createPaging({
	names: { page: "page", perPage: "per_page", cursor: "cursor" },
	perPage: 25,
	maxPerPage: 100,
});

let params = PAGING.parse(url.searchParams);
if (isFailure(params)) return redirect(url.pathname);

let page = await Pagination.byOffset(db.query(posts).where({ author_id: authorId }), {
	page: params.data.page,
	perPage: params.data.perPage,
});
if (isFailure(page)) return renderUnavailable();

let headers = PAGING.paginate(new Headers(), page.data, { url });

page.data.items; // SelectPost[]
page.data.pagination.series(); // the pager range, gaps included
headers.get("X-Total-Count"); // "892"
```

### Keyset paging, for a long feed

```typescript
import { Pagination } from "@pkg/pagination";
import { isFailure } from "@pkg/result";

let page = await Pagination.byKeyset(db.query(events).where({ team_id: teamId }), {
	orderBy: [
		["created_at", "desc"],
		["id", "desc"],
	],
	cursor: params.data.cursor,
	limit: params.data.perPage,
});
if (isFailure(page)) return apiError(page.error.message);

page.data.items;
page.data.cursors; // { next: string | null, prev: string | null }
```

### The value object on its own

```typescript
import { Pagination } from "@pkg/pagination";

let pagination = new Pagination({ page: 3, perPage: 25, total: 892 });

pagination.offset; // 50
pagination.limit; // 25
pagination.from; // 51
pagination.to; // 75
```

## API

### `Pagination`

The page arithmetic for one page of one query. A class rather than a factory, so it
is both the type and the constructor, and so the two strategies have somewhere
obvious to live.

Instances are **immutable**: there is no setter, the instance is frozen, and changing
a page means constructing another one.

#### `new Pagination(init: PaginationInit)`

Builds the arithmetic, clamping the requested page into range.

**Parameters:**

- `init.page`: Requested page, 1-based. Clamped into `1..pages`
- `init.perPage`: Rows per page. Coerced to at least 1
- `init.total`: Total rows matching the query, across every page. Coerced to at least 0

The constructor is the one place clamping happens, so a request for page 500 of 36
resolves to page 36 and every derived value agrees with that. Non-finite, fractional,
and negative inputs are normalized rather than trusted, because they arrive from
query strings.

**Example:**

```typescript
new Pagination({ page: 500, perPage: 25, total: 892 }).page; // 36
```

#### Getters

Every value beyond the three inputs is a getter on the prototype, so a controller
that only needs `offset` and `limit` never computes a page series.

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

#### `pagination.series(options?: PageSeriesOptions): PageSeries`

Builds the pager range, with gap markers where page numbers are elided.

**Parameters:**

- `options.window`: Page numbers shown either side of the current page, default `1`

The first and last pages are always present regardless of the window. A gap is
emitted only where numbers are actually left out, so a marker never sits between two
consecutive numbers.

A method rather than a getter because the window is the caller's decision, not the
pagination's. It is also the only place page-number windows are computed: a component
that wants a different one passes it here rather than slicing the result, which would
leave the gap markers stranded next to numbers they no longer describe.

**Returns:**

- The range in render order, as `PageSeriesItem[]`

**Example:**

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

`series()` belongs to offset paging, since page numbers need a total. A keyset page
carries `cursors` instead, and its pager renders older and newer links from those.

#### `pagination.toJSON(): PaginationJSON`

Returns the plain shape, which `JSON.stringify()` calls automatically.

**This is the only way an instance serializes.** Every derived value lives on the
prototype as a getter, so:

- `JSON.stringify(pagination)` works, because it calls `toJSON()` for you
- `{ ...pagination }` produces `{}`
- `Object.keys(pagination)` produces `[]`

Anything that reads its own properties off an instance must go through the getters. A
spread or an `Object.keys()` walk sees nothing, which is exactly the bug `toJSON()`
exists to prevent when an instance is handed to an API envelope or to a hydrated
component.

**Example:**

```typescript
JSON.parse(JSON.stringify(pagination)).pages; // 36
Object.keys({ ...pagination }); // [] — go through the getters instead
```

#### `Pagination.byOffset(query, options): Promise<Result<Page<T>, PaginationError>>`

Counts a composed query, then executes it with `limit` and `offset` applied.

**Parameters:**

- `query`: A bound query from `db.query(table)`, already carrying joins, predicates, and ordering
- `options.page`: Requested page, 1-based; clamped against the total
- `options.perPage`: Rows per page
- `options.total`: A total that is already known, which skips the count query

The query is executed twice, once to count and once to fetch. That is safe because
`remix/data-table`'s chaining returns new query values rather than mutating in place,
and its `count()` terminal wraps the composed predicate in a subquery, ignoring any
limit, offset, and ordering. Offset paging therefore costs two queries per page, and
on a large table the count is the expensive one — pass `total` when it is already
known, or reach for keyset paging.

**Returns:**

- `Page<T>`: the rows and the `Pagination` they were selected with
- `QueryFailedError`: the database refused, as a value rather than a throw

#### `Pagination.byKeyset(query, options): Promise<Result<KeysetPage<T>, PaginationError>>`

Seeks a composed query from an opaque cursor.

**Parameters:**

- `query`: A bound query from `db.query(table)`, carrying joins and predicates but **no ordering**
- `options.orderBy`: Sort keys, most significant first; the last one is the tiebreaker
- `options.unique`: Declares that a one-column ordering is already unique, such as a primary key
- `options.after`: Seek forward from this cursor
- `options.before`: Seek backward from this cursor
- `options.cursor`: Seek in whichever direction the cursor was minted for
- `options.limit`: Rows per page

`byKeyset()` owns the ordering, because it needs the sort keys both to build the seek
predicate and to encode the cursor — so do not order the query yourself. It adds the
seek predicate to whatever the query already carries and reads one row beyond the
limit to learn whether a further page exists, rather than counting.

The ordering must be deterministic. A single sort key is refused unless you pass
`unique: true`, because rows sharing a sort value straddle the page boundary and are
then skipped or served twice. The helper enforces this rather than trusting the
caller.

At most one of `after`, `before`, and `cursor` may be given. `cursor` is what lets a
single query parameter carry both directions: the direction rides inside the opaque
value, so a client can follow the `prev` link and the `next` link through the same
`?cursor=` parameter.

Paging backward runs the query reversed and reverses the rows again, so a page always
reads in the requested order.

**Returns:**

- `KeysetPage<T>`: the rows and the cursors around them
- `InvalidOrderingError`: the ordering cannot page deterministically
- `InvalidCursorError`: the cursor is malformed, or was issued for a different ordering
- `QueryFailedError`: the database refused

**Example:**

```typescript
let page = await Pagination.byKeyset(db.query(events), {
	orderBy: [["id", "desc"]],
	unique: true,
	limit: 50,
});
```

### `parsePageParams(searchParams, options?): Result<PageParams, ValidationError>`

Validates the paging parameters on a request URL, under the default names `page`,
`perPage`, and `cursor`.

**Parameters:**

- `searchParams`: The request URL's search parameters
- `options.perPage`: Page size to use when the request does not ask for one, default `25`
- `options.maxPerPage`: Largest page size a request may ask for, default `100`

Failure is the answer for a page that is not a whole number at or above 1, and for a
page size outside `1..maxPerPage`, which is what stops a client asking for every row.
A blank parameter (`?page=`) is treated as absent rather than malformed.

A page _past the end_ is not a failure: clamping belongs to `Pagination`, which needs
the total to know where the end is.

**Returns:**

- `PageParams`: `{ page, perPage, cursor }`, with `cursor` `null` when absent
- `ValidationError` from `@pkg/validate`, carrying the issues

**Example:**

```typescript
let params = parsePageParams(url.searchParams, { perPage: 25, maxPerPage: 100 });
if (isFailure(params)) return redirect(url.pathname);
```

### `createPaging(options?): Paging`

Binds parameter names and page-size limits to the two functions that need them.

**Parameters:**

- `options.names`: What each paging parameter is called, defaulted per field
- `options.perPage`: Default page size
- `options.maxPerPage`: Page-size ceiling

Two functions care what the query parameters are called: parsing reads them off an
incoming URL, and `paginate()` writes them into the `Link` URLs it advertises. They
must agree, or an API accepts `?per_page=50` and advertises `?perPage=50`. Custom
names exist **only** in this factory, so both sides of a route always read the same
spelling.

With the default names there is nothing to configure and the standalone functions can
be used directly.

**Returns:**

- `parse(searchParams)`: the same as `parsePageParams()`, with names and limits applied
- `paginate(headers, page, options)`: the same as `paginate()`, with names applied

**Example:**

```typescript
const PAGING = createPaging({
	names: { page: "page", perPage: "per_page", cursor: "cursor" },
	perPage: 25,
	maxPerPage: 100,
});

let params = PAGING.parse(url.searchParams);
PAGING.paginate(headers, page, { url }); // ?per_page=… in every Link
```

### `paginate(headers, page, options): Headers`

Writes a page's navigation into a response's own headers.

**Parameters:**

- `headers`: The response's `Headers`, mutated in place
- `page`: A `Page<T>` or a `KeysetPage<T>`; the shape decides which relations are emitted
- `options.url`: The URL this page was requested with

The `Headers` argument comes first, matching the other header mutators in this
codebase, and the same instance is returned so the call can sit inline in a response.
The second argument is the whole page, and `paginate()` discriminates internally.

The `url` is explicit rather than configured, so the same call works in an export job
or a feed generator. `Link` URLs are built from the URL handed in, not from a
configured base, so a service behind a proxy must pass its public URL or it will
advertise internal hostnames to its clients. Every other query parameter is
preserved, so filters and sort options survive paging.

The merge policy differs per header:

| Header          | Policy                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `X-Total-Count` | Replaced                                                                                           |
| `Link`          | Merged: link-values with a `rel` of `first`, `prev`, `next`, or `last` are replaced, the rest kept |

**`Link` is merged, never replaced.** `rel="preload"`, `rel="modulepreload"`,
`rel="preconnect"`, `rel="canonical"`, and `rel="alternate"` all live in the same
header, so replacing it would silently drop the resource hints a response already
carries. Instead the existing value is parsed, only the four paging relations are
dropped, and the new ones are appended — which also makes the call idempotent, so
annotating twice writes the same header.

Splitting a `Link` value is not a split on `","`: a URI reference can contain a comma
and a parameter value can be quoted, so the merge uses a scanner that respects angle
brackets and quoted strings. A `rel="preload"` hint whose URL contains a comma comes
back out byte for byte.

An offset page emits `first`, `prev`, `next`, `last`, and `X-Total-Count`. A keyset
page emits `prev` and `next` only, and no total: it runs no count query, so it cannot
know how many pages there are, and `first`/`last` are not reachable without that.

**Example:**

```typescript
let headers = new Headers();
headers.set("Cache-Control", "private, max-age=60");

paginate(headers, page, { url });

headers.get("Link");
// <https://api.example.com/posts?page=1>; rel="first",
// <https://api.example.com/posts?page=2>; rel="prev",
// <https://api.example.com/posts?page=4>; rel="next",
// <https://api.example.com/posts?page=36>; rel="last"
headers.get("X-Total-Count"); // "892"
```

The total uses `X-Total-Count` because that is the name existing client libraries
look for, which is worth the `X-` prefix that RFC 6648 otherwise discourages.

### `encodeCursor(direction, columns, values): Result<string, UnencodableCursorValueError>`

Encodes a page boundary as an opaque, URL-safe cursor. `byKeyset()` calls this for
you; it is exported for tests and for a store that pages itself.

Cursors are base64url from `@pkg/crypto`: **opaque but not secret**, so they must
only ever carry ordering keys the client is already allowed to see.

### `decodeCursor(cursor): Result<DecodedCursor, InvalidCursorError>`

Decodes and validates a cursor. Bad base64url, bad UTF-8, bad JSON, and a merely
plausible payload all collapse into `InvalidCursorError`, so a client-supplied cursor
can never reach `JSON.parse` and throw.

### Types

#### `PageSeriesItem`

```typescript
type PageSeriesItem = { type: "page"; page: number; current: boolean } | { type: "gap" };

type PageSeries = PageSeriesItem[];
```

A discriminated union, so a pager component is a `switch` over `type` that reads
properties, with no arithmetic and no comparison back to `pagination.page`.

`PageSeries` is a type, so a pager in a hydrating app imports it for free and renders
the array the server already computed. The class itself stays on the server: nothing
in a client bundle needs to construct one.

#### `Page<T>` and `KeysetPage<T>`

```typescript
interface Page<T> {
	items: T[];
	pagination: Pagination;
}

interface KeysetPage<T> {
	items: T[];
	cursors: { next: string | null; prev: string | null };
}
```

#### `OrderByTuple`

```typescript
type OrderByTuple = readonly [column: string, direction: "asc" | "desc"];
```

The column may be qualified (`"events.created_at"`); the unqualified segment is what
is read off a result row when a cursor is minted, so an ordering column must be
present in the query's projection.

#### Errors

All of them extend `PaginationError`, so one `instanceof` check covers paging while
the subclasses let a route tell a client's mistake apart from an infrastructure
failure.

| Error                         | Meaning                                                | Typical answer   |
| ----------------------------- | ------------------------------------------------------ | ---------------- |
| `InvalidCursorError`          | Undecodable cursor, or one issued for another ordering | `400`            |
| `InvalidOrderingError`        | The ordering cannot page deterministically             | a bug, not input |
| `UnencodableCursorValueError` | A row's ordering value is `null` or not a primitive    | a schema problem |
| `QueryFailedError`            | The database refused; the throw is kept in `cause`     | `500`            |

## Pattern: One controller, both strategies

The parameter names are bound once at the top, so both handlers spell the page size
the same way in the query string they read and in the `Link` URLs they emit.

```typescript
import { createPaging, Pagination } from "@pkg/pagination";
import { isFailure } from "@pkg/result";

const PAGING = createPaging({
	names: { page: "page", perPage: "per_page", cursor: "cursor" },
	perPage: 25,
	maxPerPage: 100,
});

/** A rendered list: numbered pager, all four relations, and a total. */
async function postsIndex(ctx) {
	// A malformed page or size is not worth an error page; drop the query string
	// and let the canonical URL render the first page.
	let params = PAGING.parse(ctx.url.searchParams);
	if (isFailure(params)) return redirect(ctx.url.pathname);

	let page = await Pagination.byOffset(db.query(posts).where({ author_id: ctx.author.id }), {
		page: params.data.page,
		perPage: params.data.perPage,
	});

	if (isFailure(page)) {
		ctx.logger.error("posts.list_failed", { error: page.error.message });
		return ctx.render(<PostListUnavailable />, { status: 500 });
	}

	let headers = new Headers();
	headers.set("Cache-Control", "private, max-age=60");

	return ctx.render(<PostList posts={page.data.items} series={page.data.pagination.series()} />, {
		headers: PAGING.paginate(headers, page.data, { url: ctx.url }),
	});
}

/** A JSON feed: cursor links only, walked by following them. */
async function eventsIndex(ctx) {
	let params = PAGING.parse(ctx.url.searchParams);
	if (isFailure(params)) return apiError("BAD_REQUEST", params.error.message);

	let page = await Pagination.byKeyset(db.query(events).where({ team_id: ctx.team.id }), {
		orderBy: [
			["created_at", "desc"],
			["id", "desc"],
		],
		cursor: params.data.cursor,
		limit: params.data.perPage,
	});

	if (isFailure(page)) return apiError("INTERNAL", page.error.message);

	return json(page.data.items.map(serializeEvent), {
		headers: PAGING.paginate(new Headers(), page.data, { url: ctx.url }),
	});
}
```

Either strategy works with either response kind; this pairing is the common one,
since a numbered pager needs a total and a long feed is cheaper to seek than to
offset.

## Pattern: Rendering a pager from `series()`

```tsx
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

No arithmetic, no `typeof` narrowing, and no comparison back to the current page: the
item states what it is.

## Pattern: Serializing into an envelope

Headers are the interoperable way to express navigation, and they keep the response
body the resource itself. When a client genuinely needs the numbers in the body,
serialize the value object rather than rebuilding it:

```typescript
return json({ data: page.data.items, meta: page.data.pagination });
// meta is the full plain shape, via toJSON()
```

## Related Packages

- [`@pkg/crypto`](/packages/crypto) - Base64url encoding for cursors
- [`@pkg/result`](/packages/result) - `Result` type both strategies and both parsers return
- [`@pkg/validate`](/packages/validate) - `ValidationError` returned for bad page parameters

## Tips

1. **Reach for keyset paging on append-only tables** - pings, events, and check
   results are exactly where deep offsets get slow, and a cursor never does.
2. **Reach for offset paging when a screen wants page numbers** - a cursor cannot
   express "jump to page 12 of 36".
3. **Do not mix the two in one API** - the choice is per list, and mixing them across
   one API's endpoints is a client-visible inconsistency.
4. **Never order a query you hand to `byKeyset()`** - it owns the ordering, and an
   ordering you added would be applied before its own and win.
5. **Always include a unique tiebreaker** - `[["created_at", "desc"], ["id", "desc"]]`,
   not `[["created_at", "desc"]]`, or rows sharing a timestamp are skipped or repeated.
6. **Treat a keyset ordering as a wire contract** - changing it invalidates every
   cursor already issued, so plan the change the way you would plan a schema change.
7. **Never spread or `Object.keys()` a `Pagination`** - the getters are on the
   prototype, so both see nothing; read the getters, or call `toJSON()`.
8. **Pass `total` when you already know it** - it skips the count query, which is the
   expensive half of an offset page.
9. **Let `paginate()` merge** - never `headers.set("Link", …)` yourself afterwards, or
   the resource hints and the paging relations will clobber each other.
10. **Give paginated responses a cache policy that accounts for the page** - page one
    and page two are different resources, so the page parameters must be in the URL
    or in `Vary`.
