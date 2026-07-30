# ADR-029: Pagination Package

## Status

**Accepted** - 2026-07-29

## Background

Listing screens and JSON APIs both need paging, and neither has a shared implementation. Each list decides its own page size, computes its own offsets, builds its own page-number range for the UI, and returns totals in whatever shape its route happens to use.

The `pagy` gem models this well: a small value object computed from page, page size, and total count, exposing everything a view or a response needs, with the query concern kept separate. That shape maps cleanly onto `remix/data-table` queries.

## Context

### Current State

| Situation                                             | Consequence                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| Admin and CMS lists compute limits and offsets inline | Page size and clamping rules differ per list                    |
| Public JSON APIs return arrays or ad-hoc envelopes    | Clients cannot discover the next page without reading the docs  |
| No page-number series for UI                          | Each list renders a different pager, or none                    |
| No keyset pagination anywhere                         | Deep offsets on growing tables get progressively more expensive |
| Page parameters parsed per route                      | Out-of-range and non-numeric input handled inconsistently       |

## Decision

Create `@pkg/pagination`: a `Pagination` class holding the page arithmetic, with offset and keyset strategies as static methods over `remix/data-table` queries, plus request parameter parsing and response header annotation. The package returns data and writes headers; it constructs no responses and renders nothing.

### 1. The Value Object Is A Class

```ts
let pagination = new Pagination({ page: 3, perPage: 25, total: 892 });

pagination.page; // 3
pagination.perPage; // 25
pagination.total; // 892
pagination.pages; // 36
pagination.offset; // 50
pagination.limit; // 25
pagination.from; // 51
pagination.to; // 75
pagination.hasPrev; // true
pagination.hasNext; // true
pagination.prev; // 2
pagination.next; // 4
```

A class rather than a factory returning a plain object, for three reasons. The constructor is the one place the requested page is clamped into range, so a request for page 500 of 36 resolves to the last page and every derived value is consistent with that. Every derived value is a getter, so a controller that only needs `offset` and `limit` does not compute a page series. And `Pagination` is then both the type and the constructor, which is the shape `remix/headers` uses for its own value objects and `@pkg/location` uses for `Location`.

Instances are immutable: there is no setter, and changing a page means constructing another instance.

Because getters live on the prototype, `JSON.stringify()` would serialize an instance as `{}`. The class implements `toJSON()` returning the plain shape, which `JSON.stringify()` calls automatically, so an API envelope or a hydrated component receives the numbers rather than an empty object.

### 2. The Page Series Is Typed

`series()` builds the pager range, with gaps where page numbers are elided:

```ts
pagination.series();
// [
//   { type: "page", page: 1, current: false },
//   { type: "page", page: 2, current: false },
//   { type: "page", page: 3, current: true },
//   { type: "page", page: 4, current: false },
//   { type: "gap" },
//   { type: "page", page: 36, current: false },
// ]
```

The items are a discriminated union exported for any consumer that renders or transforms them:

```ts
export type PageSeriesItem = { type: "page"; page: number; current: boolean } | { type: "gap" };

export type PageSeries = PageSeriesItem[];
```

Each item states what it is and whether it is the current page, so a pager component switches on `type` and reads properties, with no arithmetic and no comparison back to `pagination.page`.

`series()` is a method rather than a getter because the window size is the caller's decision, not the pagination's:

```ts
pagination.series({ window: 1 }); // fewer numbers either side of the current page
```

`PageSeries` is a type, so a pager component in a hydrating app imports it for free and renders the array the server already computed. The class itself stays on the server: nothing in a client bundle needs to construct one.

`series()` belongs to offset paging, since page numbers need a total. A keyset page carries `cursors` instead, and its pager renders older and newer links from those.

### 3. Strategies Are Static Methods

Both strategies take a bound `Query` from `db.query(table)`, so a caller composes joins, selects, and predicates with the query builder and the strategy only adds paging to it:

```ts
let page = await Pagination.byOffset(
	db.query(monitors).where({ team_id: teamId }).orderBy("created_at", "desc"),
	{ page: params.page, perPage: params.perPage },
);

page.items; // SelectMonitor[]
page.pagination; // Pagination
```

`byOffset()` calls `count()` on the query, then executes it with `limit` and `offset` applied, and assembles both into a `Page<T>`. `Query#count()` compiles to a `select count(*)` wrapping the composed query with `orderBy`, `limit`, and `offset` dropped, so the count matches the predicate exactly. Builder methods and terminals both clone rather than mutate, so the same query value serves the count and the fetch. It also accepts an optional `total` to skip the count when a caller already knows it.

```ts
let page = await Pagination.byKeyset(db.query(pings).where({ monitor_id: monitorId }), {
	orderBy: [
		["created_at", "desc"],
		["id", "desc"],
	],
	after: params.cursor,
	limit: 50,
});

page.items;
page.cursors; // { next: string | null, prev: string | null }
```

`byKeyset()` takes two options this ADR did not originally name. `unique` lets a caller declare that a single ordering column is already unique, since uniqueness is unobservable from inside the package and a one-key ordering is otherwise refused. `cursor` accepts a direction-tagged cursor and seeks whichever way that cursor points, because one bound parameter name cannot express both `prev` and `next` while `after` and `before` are separate options.

`byKeyset()` owns the ordering, because it needs the sort keys both to build the seek predicate and to encode the cursor. It adds that predicate to whatever the query already carries and reads one row beyond the limit to learn whether a next page exists. Cursors encode the ordering key values with base64url from `@pkg/crypto` (ADR-023): opaque to clients, not secret, and a malformed cursor is a validation failure. Ordering must be deterministic, so a tiebreaker column is required.

Both return a `Result`, so a database failure is a value rather than an exception, and both resolve to an exported page type:

```ts
export interface Page<T> {
	items: T[];
	pagination: Pagination;
}

export interface KeysetPage<T> {
	items: T[];
	cursors: { next: string | null; prev: string | null };
}
```

Method names describe how the query seeks. Cursors are the wire format: the options take `after` and `before`, the result carries `cursors`, and a client only ever sees an opaque string.

A third strategy, `Pagination.byToken()`, covers stores that hand back their own opaque continuation token, such as a Workers KV prefix listing or an R2 bucket. It is forward-only with no total and no `prev`, and it lands when a listing endpoint needs it.

### 4. Parameter Parsing

```ts
let result = parsePageParams(ctx.url.searchParams, { perPage: 25, maxPerPage: 100 });
```

Parsing returns a `Result` synchronously, so a handler reads it without awaiting: non-numeric pages, negative values, and oversized page sizes are handled once, with `maxPerPage` protecting against a client asking for everything. It validates with `remix/data-schema` directly and fails with `ValidationError` from `@pkg/validate`, because that package's own `validate()` is asynchronous and a promise here would make every call site a latent bug.

### 5. Response Headers

`paginate()` takes a `Headers` instance, writes the pagination headers into it, and returns the same instance so it can be used inline:

```ts
let headers = new Headers();
headers.set("Cache-Control", Policies.private({ maxAge: "1 minute" }).toString());

paginate(headers, page, { url: ctx.url });

headers.get("Link");
// <https://api.example.com/monitors?page=1>; rel="first",
// <https://api.example.com/monitors?page=2>; rel="prev",
// <https://api.example.com/monitors?page=4>; rel="next",
// <https://api.example.com/monitors?page=36>; rel="last"
headers.get("X-Total-Count"); // "892"
```

Returning the instance is what lets it sit inline in a response, and the same call serves every response kind because it only ever touches headers:

```tsx
return json(page.items, { headers: paginate(headers, page, { url: ctx.url }) });

return ctx.render(<MonitorList page={page} />, {
	headers: paginate(headers, page, { url: ctx.url }),
});
```

The package annotates headers and nothing else, which is why it needs no dependency on `@pkg/http`: bodies belong to `json()` and to the app's own components.

The `Headers` argument comes first, matching `vary(headers, [...])` in `@pkg/http/cache` (ADR-022), so mutators in this codebase read the same way. The second argument is the whole page, and `paginate()` discriminates internally to emit the relations that page supports. The `url` is an explicit option, so the same call works in an export job or a feed generator; a service behind a proxy passes its public URL.

The merge policy differs per header:

| Header          | Policy                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `X-Total-Count` | Replaced                                                                                           |
| `Link`          | Merged: link-values with a `rel` of `first`, `prev`, `next`, or `last` are replaced, the rest kept |

Merging `Link` keeps the resource hints a response already carries, since `rel="preload"`, `rel="modulepreload"`, `rel="preconnect"`, `rel="canonical"`, and `rel="alternate"` all live in the same header. Replacing its own four relations before appending them makes the call idempotent.

`Link` relations follow RFC 8288 and preserve every other query parameter from the given URL, so filters and sort options survive paging. An offset page emits all four relations plus `X-Total-Count`; a keyset page emits `next` and `prev`, since it runs no count query.

The total uses `X-Total-Count` because that is the name existing client libraries look for, which is worth the `X-` prefix that RFC 6648 otherwise discourages.

### 6. Query Parameter Names Are Bound Once

Two functions care what the query parameters are called: `parsePageParams()` reads them off an incoming URL, and `paginate()` writes them into the `Link` URLs it advertises. They must agree, or an API accepts `?per_page=50` and advertises `?perPage=50`.

With the default names, `page` and `perPage`, both functions are used directly and there is nothing to configure:

```ts
let params = parsePageParams(ctx.url.searchParams, { perPage: 25, maxPerPage: 100 });

paginate(headers, page, { url: ctx.url });
```

An API that spells its parameters differently binds them once, and gets back the same two functions with the names already applied:

```ts
let paging = createPaging({
	names: { page: "page", perPage: "per_page", cursor: "cursor" },
	perPage: 25,
	maxPerPage: 100,
});

let params = paging.parse(ctx.url.searchParams); // Result<{ page, perPage, cursor }>

paging.paginate(headers, page, { url: ctx.url }); // ?per_page=… in every Link
```

`paging.parse()` and `paging.paginate()` take the same parameters and behave the same as the standalone functions, with names and page-size limits already applied. Custom names live only in the factory, so both sides of a route always read the same spelling.

### 7. A Controller End To End

One module, both strategies, with the parameter names bound once at the top:

```tsx
import { Policies } from "@pkg/http/cache";
import { redirect } from "@pkg/http/response";
import { json } from "@pkg/http/response/json";
import { BadRequest, InternalServerError } from "@pkg/http/status-code";
import { createPaging, Pagination } from "@pkg/pagination";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import { alertEvents, monitors } from "~/database/schema";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError } from "~/app/services/api-response";
import routes from "~/routes/web";

/** Query parameter names and page-size limits, shared by parsing and `Link` generation. */
const PAGING = createPaging({
	names: { page: "page", perPage: "per_page", cursor: "cursor" },
	perPage: 25,
	maxPerPage: 100,
});

export default createController(routes.app.team.monitors, {
	actions: {
		/** GET /app/:team/monitors — offset paged, rendered with a numbered pager. */
		monitorsIndex: {
			handler: async (ctx) => {
				// A malformed page or size is not worth an error page; drop the query string
				// and let the canonical URL render the first page.
				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params)) return redirect(ctx.url.pathname);

				let db = getServiceContainer().get(Database);

				let page = await Pagination.byOffset(
					db.query(monitors).where({ team_id: ctx.team.id }).orderBy("created_at", "desc"),
					{ page: params.data.page, perPage: params.data.perPage },
				);

				if (isFailure(page)) {
					ctx.logger.error("monitors.list_failed", { error: page.error.message });
					return ctx.render(<MonitorListUnavailable />, { status: 500 });
				}

				let headers = new Headers();
				headers.set("Cache-Control", Policies.private({ maxAge: "1 minute" }).toString());

				return ctx.render(
					<MonitorList monitors={page.data.items} series={page.data.pagination.series()} />,
					{ headers: PAGING.paginate(headers, page.data, { url: ctx.url }) },
				);
			},
		},

		/** GET /api/v1/events — keyset paged feed, newest first, navigated by cursor. */
		eventsIndex: {
			middleware: [requireApiKey("events:read")],
			handler: async (ctx) => {
				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params)) return apiError("BAD_REQUEST", params.error.message, BadRequest);

				let db = getServiceContainer().get(Database);

				let page = await Pagination.byKeyset(
					db.query(alertEvents).where({ team_id: ctx.apiTeam.id }),
					{
						orderBy: [
							["created_at", "desc"],
							["id", "desc"],
						],
						after: params.data.cursor,
						limit: params.data.perPage,
					},
				);

				if (isFailure(page)) {
					return apiError("INTERNAL", page.error.message, InternalServerError);
				}

				let headers = new Headers();

				return json(page.data.items.map(serializeEvent), {
					headers: PAGING.paginate(headers, page.data, { url: ctx.url }),
				});
			},
		},
	},
});
```

The rendered list passes `series()` to its pager and advertises all four `Link` relations plus `X-Total-Count`, because an offset page knows its total. Its two failure paths answer in HTML: malformed paging parameters redirect to the canonical URL, and a database failure logs and renders an unavailable state with a `500`. The API feed pages an append-only table by cursor, so it advertises `next` and `prev` only, and a client walks it by following those links. It answers both failures with a JSON error envelope. Either strategy works with either response kind; this pairing is the common one, since a numbered pager needs a total and a long feed is cheaper to seek than to offset.

Both handlers reach `paginate()` through `PAGING`, so both spell the page size `per_page`, in the query string they read and in the `Link` URLs they emit.

## Consequences

### Positive

- **One paging vocabulary** - lists and APIs agree on page size handling, clamping, and totals.
- **One entry point** - `Pagination` is the constructor, the type, and the namespace for both strategies, so the whole concern autocompletes from one symbol.
- **Clamping has one home** - the constructor, so no derived value can disagree with the page it was computed from.
- **Pagers become trivial to render** - a typed `PageSeriesItem` union means a component is a `switch` over `type` with no arithmetic and no `typeof` narrowing.
- **APIs become navigable** - `Link` relations let clients page without hardcoding parameter names.
- **A scale path exists** - keyset paging is available for the tables that need it, without changing how offset paging works elsewhere.
- **Bad input handled once** - parameter parsing is shared and returns `Result`.
- **Parameter names cannot drift** - custom names exist only inside `createPaging()`, so parsing and `Link` URLs cannot disagree about what a parameter is called.
- **Headers annotate the real response** - `paginate()` writes into the response's own `Headers`, merging into `Link` rather than replacing it, so resource hints already on the response survive.
- **One function for every response kind** - the same `paginate()` call annotates a JSON response, a rendered page, or a response built in a job, because it only touches headers.
- **No dependency on the HTTP package** - constructing no responses means importing no response constructors.

### Negative

- **Count queries cost** - offset paging runs two queries per page, and on large tables the count is the expensive one; callers can pass a known total or opt into keyset paging.
- **Two paging models to choose between** - the choice must be made per list, and mixing them in one API is a client-visible inconsistency.
- **Cursor compatibility** - changing a keyset ordering invalidates issued cursors, so ordering changes need care.

### Neutral

- **No pager component anywhere** - `@pkg/r3-ui` already ships `Pagination` with `List`, `Item`, `Link`, and `Button` compound parts, so an app maps `series()` onto those directly. Neither package gains a dependency on the other, and the page-number-to-URL function an app writes for the markup is the same one `paginate()` needs for `Link` headers.
- **Existing endpoints keep their shape until migrated** - adoption is per route.

## Implementation Plan

### Phase 1: Value Object And Parsing

**Priority:** High
**Estimated Effort:** 3 hours

1. The `Pagination` class: clamping in the constructor, derived getters, `toJSON()`, and `series()` with a configurable window, covering zero total, single page, and last partial page.
2. `parsePageParams()` through `@pkg/validate`.

### Phase 2: Query Helpers

**Priority:** High
**Estimated Effort:** 4 hours

1. `Pagination.byOffset()` over a bound `Query`, tested against both the D1 and Durable Object adapters. Confirm which terminal the query builder exposes for counting a composed query, and accept a caller-supplied `total` for pages whose count is already known.
2. `Pagination.byKeyset()` with cursor encoding, tiebreaker enforcement, and reverse traversal.

### Phase 3: Headers And Adoption

**Priority:** Medium
**Estimated Effort:** 3 hours

1. `paginate()` writing into a given `Headers`, with `Link` parsing and merging, query-parameter preservation, and idempotency tests over a response that already carries preload hints.
2. Both page types covered: full relations plus a total for an offset page, cursor links only for a keyset page.
3. `createPaging()` returning `parse` and `paginate` with names and page-size limits bound.
4. Adopt on the public JSON APIs and on the largest admin lists.
5. Write the package README and add it to the root README table (ADR-017).

## Alternatives Considered

### 1. Offset Pagination Only

Ship the value object and offset queries, skip cursors.

**Rejected because**: the tables that most need paging are the append-only histories (pings, alert events, check results), and those are exactly where offsets get slow. Adding cursors later would mean a second, incompatible API on the same endpoints.

### 2. Keyset Pagination Only

Standardize on keyset paging everywhere.

**Rejected because**: admin screens genuinely want page numbers and totals, and a keyset cursor cannot express "jump to page 12 of 36".

### 3. Envelope-Based API Responses

Return `{ data, meta: { page, total } }` instead of headers.

**Rejected because**: headers keep the response body the resource itself, and `Link` relations are the interoperable way to express navigation. An envelope remains available per endpoint by serializing `pagination` into the body when a client needs it.

### 4. A Pagination Middleware

Expose `ctx.page(pagination)` and let a middleware append `Link` and `X-Total-Count` to the finished response, the way the mail middleware provides `ctx.email` (ADR-018) and the Workers Cache middleware provides `ctx.cache` (ADR-031).

**Rejected because**: those two middlewares exist for reasons pagination does not share. Each of them gives a handler something it cannot construct on its own, a configured transport or a platform cache interface, and the cache middleware additionally has to inspect the finished response to enforce its refusals. Pagination needs neither: the handler already holds the `Pagination` it computed and the URL it was requested with, and there is no late check to perform, because a middleware cannot tell whether a response body is a list.

What would remain is ergonomics, bought at the price of a context key that looks like `ctx.cache()` while doing something categorically different: declaring data rather than requesting infrastructure. What remains is a `Headers` argument at the call site, which section 5 keeps to one inline call.

## References

- [RFC 8288 - Web Linking](https://datatracker.ietf.org/doc/html/rfc8288)
- [pagy](https://ddnexus.github.io/pagy/)
- [ADR-023: Web Crypto Primitives Package](./ADR-023-web-crypto-primitives-package.md)
- [ADR-022: HTTP Cache Policies And Conditional Responses](./ADR-022-http-cache-policies-and-conditional-responses.md)

## Current Progress

- [x] Phase 1: Value Object And Parsing
- [x] Phase 2: Query Helpers
- [ ] Phase 3: Headers And Adoption

## Notes

- `byOffset()` runs two executions of the same `Query` value, one counting and one fetching, so the builder's chaining must return new values rather than mutating in place. Verify that before relying on it.
- `Pagination` is immutable, and serializable only through `toJSON()`. Anything that stringifies one gets the plain shape automatically; anything that reads its own properties off the instance must go through the getters, not `Object.keys()` or a spread, both of which see nothing on the prototype.
- `series()` is the only place page-number windows are computed. A component that wants a different window passes one rather than slicing the result, otherwise the gap markers stop matching the numbers around them.
- Nothing in this package touches a request context. Pagination is computed from numbers and a URL, so the same functions work in an export job or a feed generator, and there is no middleware to register.
- `Link` URLs are built from the URL handed in, not from a configured base, so a service behind a proxy must pass the public URL or advertise internal hostnames to its clients.
- Splitting a `Link` value on commas is not a split on `","`: a URI reference can contain a comma and a parameter value can be quoted. The merge needs a small parser that respects angle brackets and quoted strings, and it needs a test with a preload hint whose URL contains a comma.
- Keyset ordering must include a unique tiebreaker, otherwise rows with identical sort values are skipped or repeated across pages; the helper enforces this rather than trusting the caller.
- Paginated responses should carry a cache policy that accounts for the page parameters in `Vary` or in the URL, since page one and page two are different resources.
