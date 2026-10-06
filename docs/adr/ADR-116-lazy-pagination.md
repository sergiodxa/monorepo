# ADR-116: Lazy Pagination

## Status

**Proposed** - 2026-10-06

## Background

`Pagination.byOffset` and `Pagination.byKeyset` take a query, run it, and answer a `Result`
in one call. Building a page and running it are therefore one step, so paging can only ever be
the last, awaited thing done to a query: a function that takes a query and returns a paged one
has nothing to return.

The question came up while designing `@sdxc/search` (ADR-109). The shape wanted there is a chain
of functions from query to query — narrow it, search it, page it — with the result run like any
query, by the query's own method:

```typescript
let items = await Pagination.byOffset(search(baseQuery, parsed), pagination).all();
```

`search(query, parsed)` itself waits on `remix/data-table` gaining raw predicates and computed
columns ([proposal](../proposals/data-table-sql-expressions.md)). The paging half does not.

## Context

### Current shape

```typescript
static async byOffset<Row>(query: OffsetQuery<Row>, options: OffsetOptions):
	Promise<Result<Page<Row>, PaginationError>>;

static async byKeyset<Row, WhereArg, ColumnArg>(
	query: KeysetQuery<Row, WhereArg, ColumnArg>,
	options: KeysetOptions,
): Promise<Result<KeysetPage<Row>, PaginationError>>;
```

Each call does three things:

| Step    | Offset                                        | Keyset                                                            |
| ------- | --------------------------------------------- | ----------------------------------------------------------------- |
| Before  | counts the rows, clamps the page against them | validates the ordering, decodes the cursor                        |
| Compose | `limit` and `offset`                          | the seek predicate, the ordering (reversed backward), `limit + 1` |
| After   | wraps rows and arithmetic in a `Page`         | drops the extra row, restores order, mints `next`/`prev` cursors  |

Only the middle step is "a query in, a query out". The other two are why the methods run the
query themselves today.

There are about 45 call sites across the apps.

## Decision

`Pagination.byOffset` and `Pagination.byKeyset` become synchronous and return the query they
were given, with paging applied: the same type, run with its own `.all()`. What a page needs
around the rows moves into the steps on either side.

### Offset

The `Pagination` value already holds the clamped page arithmetic, so the count comes first and
the value is what `byOffset` applies:

```typescript
let query = db.query(articles).where({ status: "published" });

let pagination = new Pagination({ page, perPage, total: await query.count() });
let items = await Pagination.byOffset(query, pagination).all();

paginate(headers, { items, pagination }, { url });
```

`byOffset(query, pagination)` is `query.limit(pagination.limit).offset(pagination.offset)`, and
cannot fail.

### Keyset

`byKeyset` decodes the cursor and composes the seek, so it answers a `Result` for a cursor a
client sent wrong; `Pagination.keysetPage` turns the rows that come back into a page:

```typescript
let options = { orderBy: NEWEST_FIRST, cursor: params.data.cursor, limit: 50 };

let paged = Pagination.byKeyset(db.query(pings).where({ monitor_id }), options);
if (isFailure(paged)) return badRequest(paged.error); // InvalidCursorError or InvalidOrderingError

let page = Pagination.keysetPage(await paged.data.all(), options);
if (isFailure(page)) return serverError(page.error); // UnencodableCursorValueError
```

- `byKeyset(query, options)` answers `Result<Query, InvalidCursorError | InvalidOrderingError>`.
  The query carries the seek predicate, the ordering (reversed for a backward page) and a limit
  of `limit + 1`.
- `keysetPage(rows, options)` drops the extra row, puts a backward page back in requested
  order, and mints the cursors, answering `Result<KeysetPage<Row>, UnencodableCursorValueError>`.
  It takes the same options, so the two halves cannot disagree about the ordering.

### Typing

Both methods are generic over the query, and return that same type:

```typescript
interface OffsetQuery {
	limit(value: number): this;
	offset(value: number): this;
}

static byOffset<Query extends OffsetQuery>(query: Query, pagination: Pagination): Query;
```

`remix/data-table`'s `Query` returns its own type from `limit`, `offset`, `where` and `orderBy`,
so it satisfies `this`-returning contracts as it is, and `.all()` after paging is the builder's
own, typed method. `SearchQuery` from `@sdxc/search` does the same.

### Errors from the query

Running the query is the caller's `.all()` and `.count()`, so a database failure rejects the way
any data-table query rejects; `QueryFailedError` is removed. A route handles it as it handles
every other query it runs.

### Migration

Breaking, with no compatibility path. Each call site changes from one awaited call to the steps
above: two lines for offset, four for keyset. The compiler finds every site, because the old
call's result was awaited as a `Result` and the new one is a query.

## Consequences

### Positive

- **Paging is query to query.** `Pagination.byOffset(search(narrow(base)), pagination)` is plain
  function application, and a `compose(...)` helper over query functions works with paging in
  the chain.
- **A paged query runs like any query.** `.all()`, `.first()`, a relation load — whatever the
  builder offers — with the builder's own types, and nothing new to learn.
- **The count is visible.** A caller that already knows the total, or wants none, skips it by
  not writing it, rather than through an option.

### Negative

- **More lines per call site.** Offset paging is two statements instead of one, keyset paging
  four, and the 45 call sites grow accordingly.
- **The order of steps is the caller's.** Counting before clamping, or passing different
  options to `byKeyset` and `keysetPage`, are now mistakes a caller can make.
- **Database failures leave the `Result`.** A failed page rejects, so a route that relied on the
  `QueryFailedError` branch catches instead.

### Neutral

- `paginate()`, `createPaging()` and `parsePageParams()` are unchanged; they work on the page the
  steps produce.
- A follow-up could fold the keyset steps into one helper that takes the query and runs it, for
  routes that never compose; it would sit beside these, built from them.

## Implementation Plan

### Phase 1: The package

**Priority:** Medium
**Estimated Effort:** 3 hours

1. `byOffset(query, pagination)` and `byKeyset(query, options)` return the paged query;
   `keysetPage(rows, options)` builds the keyset page; `QueryFailedError` is removed.
2. Type tests: a `remix/data-table` query and a `SearchQuery` keep their own type through both.
3. Tests: offset clamping through `new Pagination`, keyset forward and backward walks through
   `byKeyset` + `keysetPage`, and the cursor and ordering failures from `byKeyset`.
4. README and JSDoc describe the steps.

### Phase 2: Call sites

**Priority:** Medium
**Estimated Effort:** 3 hours

1. Rewrite every call site, one commit per app.
2. `bun check` and every app's tests pass.

## Alternatives Considered

### 1. A page query with its own `run()`

`byOffset` and `byKeyset` return a pager object whose `run()` executes and answers today's
`Result`.

**Rejected because**: it is a second kind of query beside the builder's. A pager composes with
nothing that expects a query, and running it is a method only this package defines.

### 2. Keep the eager methods and add query-returning ones beside them

**Rejected because**: two ways to page the same query. Breaking changes land directly in this
repo.

### 3. Count inside `byOffset`

`byOffset` returns a promise of the paged query, counting first so it can clamp.

**Rejected because**: the result is no longer a query, so it stops composing, which is the point.

## References

- [ADR-029: Pagination Package](./ADR-029-pagination-package.md)
- [ADR-109: Search Package](./ADR-109-search-package.md)
- [Proposal: SQL expressions in `remix/data-table` queries](../proposals/data-table-sql-expressions.md)

## Current Progress

- [ ] Phase 1: The package
- [ ] Phase 2: Call sites
