# ADR-116: Lazy Pagination

## Status

**Proposed** - 2026-10-06

## Background

`Pagination.byOffset` and `Pagination.byKeyset` take a query, run it, and answer a `Result`
in one call. Building a page and running it are therefore one step, so nothing can sit
between them: a function that takes a query and returns a paged one has nowhere to return
to, and a test can only observe a page by executing it against a database.

The question came up while designing `@sdxc/search` (ADR-109). The ergonomic shape wanted
there is a chain of functions over one query — narrow it, search it, page it — and run it
at the end:

```typescript
let page = await Pagination.byOffset(search(baseQuery, parsed), { page, perPage }).run();
```

`search(query, parsed)` itself waits on `remix/data-table` gaining raw predicates and
computed columns ([proposal](../proposals/data-table-sql-expressions.md)). The paging half
does not, and it is the half every list in the repo uses.

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

Each call validates its options, composes the query (`limit`/`offset`, or the seek predicate
and the ordering), executes it — two statements for offset paging, one for keyset — and
wraps every failure in a `PaginationError`.

There are about 45 call sites across the apps, every one of them `await Pagination.byX(...)`
followed by an `isFailure` check.

### What a deferred page enables

| Use                                   | Today                                         |
| ------------------------------------- | --------------------------------------------- |
| A helper returns a paged query        | It must take the options and return a promise |
| Composing `page ∘ search ∘ narrow`    | Paging has to be the last, awaited, step      |
| A route builds a page, a view runs it | The route awaits before handing anything over |
| A test asserts the composed query     | Only by running it against a database         |

## Decision

`Pagination.byOffset` and `Pagination.byKeyset` become synchronous and return a page query;
`run()` executes it and answers the same `Result` they answer today.

```typescript
let pager = Pagination.byOffset(db.query(articles).where({ status: "published" }), {
	page: params.data.page,
	perPage: params.data.perPage,
});

let page = await pager.run(); // Result<Page<Row>, PaginationError>
```

### The page query

```typescript
interface OffsetPageQuery<Row> {
	/** Counts, then reads the requested page; every failure is a `PaginationError`. */
	run(): Promise<Result<Page<Row>, PaginationError>>;
}

interface KeysetPageQuery<Row> {
	/** Decodes the cursor, seeks and reads one page past it, and mints the cursors around it. */
	run(): Promise<Result<KeysetPage<Row>, PaginationError>>;
}
```

- **Construction is pure.** Building a page query reads nothing and validates nothing that
  could fail; a bad ordering, a malformed cursor and a refused query all surface from `run()`,
  so every failure keeps arriving through the one `Result` it arrives through today.
- **A page query is a frozen value.** `run()` may be called more than once and executes again
  each time, which is what a retry wants.
- **The method is `run()`.** `all()` would read as the query builder's own method, which a
  page query is not: it resolves a page and its arithmetic, never a bare row array.
- **No inspection API in this ADR.** Tests keep observing pages through a database, as they
  do now; exposing the composed queries is a separate decision if a test needs it.

### Migration

The change is breaking and lands without a compatibility path: every call site becomes
`await Pagination.byX(query, options).run()`. The compiler finds them all, because passing a
page query where a `Result` is expected (`isFailure(page)`) is a type error.

### Composition

With paging deferred, the composition that motivated this is plain function application:

```typescript
let page = await Pagination.byOffset(search(narrow(db.query(articles)), parsed), options).run();
```

A right-to-left `compose(...).with(base)` helper over the same functions is a natural
follow-up for a small functional-utilities package; it needs nothing from this one, so it is
left to its own ADR.

## Consequences

### Positive

- **A paged query is a value.** Helpers return one, routes pass one, and the step that runs it
  is wherever the code awaits.
- **Paging composes with any query function.** Search, tenancy scoping or soft-delete filters
  apply before paging without the helper knowing about pages.
- **The error contract is unchanged.** `run()` answers the same `Result` and error classes, so
  every `isFailure` branch and the `400`/`500` split stay as they are.

### Negative

- **Every call site changes.** About 45 one-line edits across the apps, mechanical and
  compiler-checked.
- **One more name to learn.** A page query sits between a query and a page.

### Neutral

- `paginate()`, `createPaging()` and `parsePageParams()` are unchanged; they work on the page a
  run produces.
- `@sdxc/search`'s `SearchQuery` already satisfies both query contracts, so search pages
  through the new shape with no change of its own.

## Implementation Plan

### Phase 1: The package

**Priority:** Medium
**Estimated Effort:** 2 hours

1. `byOffset` and `byKeyset` return frozen page query objects; the current bodies move into
   their `run()` methods.
2. Tests: construction never touches the query, `run()` answers what the eager call answered,
   a second `run()` executes again, and validation failures arrive from `run()`.
3. README and JSDoc describe the two-step shape.

### Phase 2: Call sites

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Append `.run()` at every call site, one commit per app.
2. `bun check` and every app's tests pass.

## Alternatives Considered

### 1. Keep the eager methods and add lazy ones beside them

`Pagination.offset(query, options)` returning a page query, with `byOffset` kept.

**Rejected because**: two ways to page the same query, and the eager pair would be a
deprecated alias in all but name. Breaking changes land directly in this repo.

### 2. Return a thenable

A page query with `then()`, so `await Pagination.byOffset(...)` keeps working unchanged.

**Rejected because**: a value that runs when awaited is a promise in disguise; it runs at
every accidental `await`, and passing it through an `async` function's `return` executes it.
The explicit `run()` is the point.

### 3. Leave paging eager and compose before it

Every query function composes first, and paging stays the final, awaited call.

**Rejected because**: it covers the composition but leaves a paged query unable to be
returned, passed or deferred, which is half of what is wanted.

## References

- [ADR-029: Pagination Package](./ADR-029-pagination-package.md)
- [ADR-109: Search Package](./ADR-109-search-package.md)
- [Proposal: SQL expressions in `remix/data-table` queries](../proposals/data-table-sql-expressions.md)

## Current Progress

- [ ] Phase 1: The package
- [ ] Phase 2: Call sites
