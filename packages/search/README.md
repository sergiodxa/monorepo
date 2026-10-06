# @sdxc/search

Full-text search over SQLite tables an app already declares: query parsing, safe FTS5 and
`LIKE` matching, field-weighted ranking, highlighting and batched reindexing.

## Overview

A search box hands the server raw text, and raw text is not safe in either kind of SQLite
search. FTS5 reads `it's`, `c++`, `AND` and `a:b` as query syntax and fails; `LIKE` reads `%`
and `_` as wildcards. This package parses the text into terms once, then compiles them so no
user text reaches FTS5 as syntax or `LIKE` as a wildcard.

The package owns logic, never storage. The app declares its source table with
`remix/data-table`'s `table()`, writes the FTS5 table and its triggers into its own migrations
(see [Storage](#storage)), and describes both to `defineSearch`. A search is a query that
`Pagination.byOffset` and `Pagination.byKeyset` from `@sdxc/pagination` page like any other
list, on D1 and on Durable Object SQLite alike.

Two entry points:

| Import               | Contents                                                     | Database code |
| -------------------- | ------------------------------------------------------------ | ------------- |
| `@sdxc/search/query` | `parseQuery`, `highlight`, `excerpt` and their types         | None          |
| `@sdxc/search`       | Everything above, plus `defineSearch`, `SearchQuery`, errors | Yes           |

`@sdxc/search/query` is safe in a browser bundle, so a client highlights with the same code
the server searched with.

## Usage

```typescript
import { createPaging, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { defineSearch, parseQuery } from "@sdxc/search";
import { sql } from "remix/data-table";

import { postSearch as postSearchTable } from "~/database/schema";

/** Published posts, ranked so a title hit outranks a tag, and a tag outranks the excerpt. */
const POST_SEARCH = defineSearch({
	table: postSearchTable,
	key: "id",
	columns: [
		{ name: "title", weight: 10 },
		{ name: "tags", weight: 6 },
		{ name: "excerpt", weight: 1 },
	],
	fts: { table: "post_search_fts" },
});

const PAGING = createPaging({ perPage: 20, maxPerPage: 50 });

let parsed = parseQuery(url.searchParams.get("q") ?? "");
if (isFailure(parsed)) return badRequest(parsed.error);
if (parsed.data === null) return renderEmptySearch();

let params = PAGING.parse(url.searchParams);
if (isFailure(params)) return redirectToFirstPage(url);

let page = await Pagination.byOffset(
	POST_SEARCH.query(ctx.db, parsed.data).where(sql`"published_at" <= ${Date.now()}`),
	{ page: params.data.page, perPage: params.data.perPage },
);
if (isFailure(page)) return serverError(page.error);

page.data.items; // posts, best match first, each with its `rank`
```

`paginate()` from `@sdxc/pagination` carries every other query parameter into its `Link` URLs,
so `q` survives paging with no extra code.

## API

### `parseQuery(input, options?)`

Parses search box text into terms, returning `Result<ParsedQuery | null, ValidationError>`:
`null` for a blank box, and a `ValidationError` (the one `@sdxc/validate` defines, with its issue
on `q`) for a query that is too long, holds too many terms, or has nothing left to find.

```typescript
parseQuery(`remix "route pattern" -legacy data*`);
// success({ text, terms: [
//   { text: "remix", phrase: false, prefix: true, exclude: false },
//   { text: "route pattern", phrase: true, prefix: false, exclude: false },
//   { text: "legacy", phrase: false, prefix: true, exclude: true },
//   { text: "data", phrase: false, prefix: true, exclude: false },
// ] })
```

- Input is text, never syntax. Whitespace separates terms, a double-quoted run is a phrase (an
  unclosed quote closes at the end), and a leading `-` excludes a term. `AND`, `OR`, `NOT`,
  `NEAR`, `column:` and parentheses are ordinary words. Text is NFKC-normalized first.
- Terms holding no letter or number are dropped, since a tokenizer keeps nothing of them.
- At least one term must be left to find once exclusions are set aside.

| Option      | Default | Meaning                                                                              |
| ----------- | ------- | ------------------------------------------------------------------------------------ |
| `prefix`    | `"all"` | Which words match as prefixes: `"all"`, `"last"` (search as you type) or `"none"`    |
| `maxLength` | `256`   | Characters the normalized query may hold                                             |
| `maxTerms`  | `8`     | Terms the query may hold, exclusions included; it keeps `LIKE` inside the bind limit |

Phrases always match exactly. A trailing `*` makes its own word a prefix whatever `prefix` says.

### `highlight(text, query, options?)`

Splits `text` into `{ text, match }` segments that concatenate back to `text`. Matching mirrors
`unicode61 remove_diacritics 2`: case and diacritics are ignored, prefix terms match a word's
start (and mark the whole word), phrases match consecutive words, and the segments keep the text
as written, so `Résumé` is marked when somebody typed `resume`. Excluded terms never highlight.
Pass `{ mode: "substring" }` for results found by `LIKE` or a `trigram` index.

```typescript
highlight("Remix Route Pattern basics", parsed);
// [{ text: "Remix", match: true }, { text: " ", match: false },
//  { text: "Route Pattern", match: true }, { text: " basics", match: false }]
```

### `excerpt(text, query, options?)`

A window of `words` (default 24) whitespace-separated words around the first match, as
`{ segments, truncatedStart, truncatedEnd }`. A text with no match yields its opening words.

### `defineSearch(options)`

Describes a searchable table and returns a frozen `Search` definition. It throws a `RangeError`
for a description that can never work: empty `columns`, a non-positive weight, a column the
table lacks, a table that declares a `rank` column, a table without a single-column primary key
and no `key`, or a non-integer `key` with `fts`.

| Option          | Meaning                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `table`         | The app's own `table()` value; a search returns its rows plus `rank`                               |
| `key`           | The row's identifying column, default the primary key; with `fts`, the integer the `rowid` mirrors |
| `columns`       | `{ name, weight }[]` in the FTS5 table's declaration order, since `bm25()` weighs by position      |
| `fts.table`     | The FTS5 virtual table's name; without `fts`, every query runs as `LIKE`                           |
| `fts.tokenizer` | `"unicode61"` (default, declared with `remove_diacritics 2`) or `"trigram"`                        |

A definition holds no connection and no rows, so one module-level definition serves every
tenant: the `Database` arrives on every call.

### `search.query(db, query)`

A `SearchQuery` matching `query`. Without `orderBy` it orders by `rank`, then `key`, both
ascending, so the best match comes first. It implements the `OffsetQuery` and `KeysetQuery`
contracts `@sdxc/pagination` pages:

- `where(input)` takes a `remix/data-table` predicate or `{ column: value }` object over the
  table's columns or `rank`, or a `sql` fragment for anything the predicates cannot say.
- `orderBy(column, direction)`, `limit(n)` and `offset(n)` each return a new query.
- `all()` reads the rows, decoding `c.json()` and `c.boolean()` columns as the table declares
  them; `count()` counts the matches.

`all()` and `count()` reject with a `SearchError` rather than answering a `Result`, since a
pager expects a query builder; `Pagination` turns the rejection into its `QueryFailedError`.

### `search.predicate(query, { alias? })`

The match alone as a `sql` fragment, for a statement the app writes itself — a page read through
a join table, for instance. It is the `LIKE` clauses qualified to `alias` (default the table's
name), or `"<alias>"."<key>" in (select "rowid" from <fts> where <fts> match ?)`. It carries no
`rank`.

### `search.reindex(db, { after?, limit? })`

Writes the next `limit` (default 500) source rows with a key above `after` into the FTS5 index,
returning `Result<{ indexed, next }, SearchError>`; `next` is the `after` for the following call,
or `null` once every row is indexed. Each statement is complete on its own and the write is
`insert or replace` by `rowid`, so a call that fails or runs twice — a job is delivered at least
once — leaves the index correct. It needs an index that accepts that write, which the
contentless-delete table below does and an external-content table does not.

### `SearchError` and `ParameterBudgetError`

`SearchError` is every failure of a statement this package built, with the database's error in
`cause`. `ParameterBudgetError` extends it, carrying `count` and `limit`: D1 and Durable Object
SQLite bind at most 100 values per statement (`MAX_BOUND_PARAMETERS`), and the query counts its
values before executing instead of letting the database fail mid-page.

## Strategies

### FTS5

```text
with "search_hits" as (
  select "rowid" as "search_key", bm25("post_search_fts", 10, 6, 1) as "search_rank"
  from "post_search_fts" where "post_search_fts" match ?   -- '"remix"* "route pattern" NOT "legacy"*'
)
select "post_search".*, "search_hits"."search_rank" as "rank"
from "search_hits" cross join "post_search" on "post_search"."id" = "search_hits"."search_key"
where (<filters>) order by "search_hits"."search_rank" asc, "post_search"."id" asc limit ? offset ?
```

Every term is double-quoted with inner quotes doubled, so nothing is read as syntax. The whole
`MATCH` argument is one bound value however many terms it holds. The CTE makes the FTS table
the driving table and names the score `search_rank`, so a seek on `rank` compares a plain
column. Weights are passed to `bm25()` per query, so changing one is a code change.

A `trigram` index cannot answer a term shorter than three characters, so a query holding one
runs as `LIKE`.

### `LIKE`

Each term becomes `%…%` with `\`, `%` and `_` escaped, tested with `escape '\'`. A phrase
matches as one substring. `rank` is the negated weighted count of the columns each term hit,
so `rank asc` puts the best match first under both strategies.

`LIKE` folds case for ASCII only and compares diacritics as written; an app that needs `café`
to find `cafe` uses FTS5. It binds two values per term per column, so eight terms over three
columns bind 48, leaving room for filters and a seek.

## Patterns

### Pattern: A search results page

Offset paging gives the numbered pager and total a results page shows; highlight the fields
the result shows with segments rendered through `remix/component`, which keeps the text escaped
by construction.

```tsx
import type { HighlightSegment } from "@sdxc/search/query";

import { excerpt, highlight } from "@sdxc/search/query";

function Highlighted() {
	return ({ segments }: { segments: HighlightSegment[] }) => (
		<span>{segments.map((part) => (part.match ? <mark>{part.text}</mark> : part.text))}</span>
	);
}

<Highlighted segments={highlight(post.title, parsed)} />;
<Highlighted segments={excerpt(post.excerpt, parsed, { words: 24 }).segments} />;
```

### Pattern: Search narrowing a list's own order

When search only narrows a list, page it by the list's ordering and the search becomes a
predicate. Keyset paging over a stable order is exact, as for any list.

```typescript
let page = await Pagination.byKeyset(ITEM_SEARCH.query(db, parsed).where({ feed_id: feedId }), {
	orderBy: [
		["published_at", "desc"],
		["id", "desc"],
	],
	cursor: params.data.cursor,
	limit: 50,
});
```

With FTS5, a stable order sorts the whole match set before the first row returns.

### Pattern: Reindexing from a job

```typescript
let progress = await POST_SEARCH.reindex(ctx.db, { after: job.data.after, limit: 500 });
if (isFailure(progress)) return ctx.retry({ delay: "1 minute", cause: progress.error });
if (progress.data.next !== null) await ctx.enqueue("reindex-posts", { after: progress.data.next });
```

Batches keep every statement far from D1's 30-second limit and its per-invocation query budget,
and keep a Durable Object's thread free between alarms. Writes made while a reindex runs are
kept current by the triggers.

## Relevance and cursors

`bm25()` depends on the whole index's statistics, so any write between two page requests moves
every score; no cursor makes relevance order snapshot-consistent.

| Pager                                             | When the index changes between pages                                 |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `byOffset`, default order                         | Every row after an insertion shifts; a boundary row repeats or skips |
| `byKeyset`, `[["rank", "asc"], [key, "asc"]]`     | Only rows whose score crossed the boundary repeat or go missing      |
| `byKeyset`, a stable order such as `published_at` | Exact                                                                |

Offset is the recommended relevance pager for pages a person reads. Keyset over `(rank, key)`
suits feeds and APIs: the key breaks ties between identical documents, and a `bm25()` value
survives the cursor's JSON exactly. A cursor carries no query, so replaying it against another
`q` seeks on meaningless scores; only a hand-edited URL does that.

## Storage

Guidance an app copies into its own migration and adapts; the package creates nothing.

Index a table with an `INTEGER PRIMARY KEY`. When the searchable thing has a text id, give it
a search document table of its own, `("id" INTEGER PRIMARY KEY, "post_id" TEXT NOT NULL UNIQUE,
…)`. Never the implicit `rowid`: `VACUUM` may renumber it, and so may an export.

```sql
CREATE TABLE "post_search" (
	"id" INTEGER PRIMARY KEY,
	"post_id" TEXT NOT NULL UNIQUE,
	"title" TEXT NOT NULL,
	"tags" TEXT NOT NULL DEFAULT '',
	"excerpt" TEXT,
	"published_at" INTEGER
);

CREATE VIRTUAL TABLE "post_search_fts" USING fts5(
	"title", "tags", "excerpt",
	content='', contentless_delete=1,
	tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER "post_search_fts_insert" AFTER INSERT ON "post_search" BEGIN
	DELETE FROM "post_search_fts" WHERE "rowid" = new."id";
	INSERT INTO "post_search_fts" ("rowid", "title", "tags", "excerpt")
	VALUES (new."id", new."title", new."tags", new."excerpt");
END;

CREATE TRIGGER "post_search_fts_update" AFTER UPDATE OF "title", "tags", "excerpt" ON "post_search" BEGIN
	DELETE FROM "post_search_fts" WHERE "rowid" = old."id";
	INSERT INTO "post_search_fts" ("rowid", "title", "tags", "excerpt")
	VALUES (new."id", new."title", new."tags", new."excerpt");
END;

CREATE TRIGGER "post_search_fts_delete" AFTER DELETE ON "post_search" BEGIN
	DELETE FROM "post_search_fts" WHERE "rowid" = old."id";
END;
```

- **Contentless-delete** stores only the inverted index; the text stays in the source row, which
  is where a search reads it and where highlighting runs. It needs SQLite 3.43, which `workerd`
  carries.
- **Triggers** are the one write path, so no repository or deletion site can forget the index.
  A trigger commits inside the statement that fired it, on D1 and Durable Object SQLite alike.
- **A `DELETE` by `rowid`, then an `INSERT`** is idempotent, which is what makes the triggers
  and a batched `reindex` safe to interleave. A trigger's statements take the conflict policy
  of the statement that fired it, so an upsert (`ON CONFLICT … DO UPDATE`) or a plain
  `INSERT` on the source turns a trigger's `INSERT OR REPLACE` into a plain insert, which
  leaves the old terms indexed beside the new ones; the explicit `DELETE` holds under every
  policy. An external-content table's `'delete'` command corrupts the index for a row it never
  held, so it is unsafe beside a backfill.
- **Quoting** is single quotes for option values and double quotes for identifiers, so the
  migration replays with double-quoted string literals disabled.
- **`prefix='2 3'`** speeds prefix queries on a large index at the cost of a larger index.

### Exporting a D1 database

`wrangler d1 export` refuses a database holding a virtual table. Drop the triggers first, since
a trigger left behind fails every write to the source, then the index; export; recreate both
from the migration; and run `reindex` from the start.

```text
DROP TRIGGER "post_search_fts_insert";
DROP TRIGGER "post_search_fts_update";
DROP TRIGGER "post_search_fts_delete";
DROP TABLE "post_search_fts";
```

### Multi-tenancy

Tenancy inside one database is the caller's `where`, as for every list. `where` cannot fix one
thing: `bm25()` statistics are per index, so tenants sharing one FTS5 table share document
frequencies, and a term's score leaks how common it is elsewhere. A database per tenant has no
such channel; a shared D1 that cares keeps an index per tenant.

## Related Packages

- [`@sdxc/pagination`](../pagination/README.md) — the offset and keyset pagers a `SearchQuery` plugs into
- [`@sdxc/validate`](../validate/README.md) — the `ValidationError` `parseQuery` fails with
- [`@sdxc/data-table-d1`](../data-table-d1/README.md) and [`@sdxc/data-table-sqlstorage`](../data-table-sqlstorage/README.md) — the adapters a search runs through

## Tips

- Parse once per request and hand the same `ParsedQuery` to the query and to `highlight`, so
  what is marked is what was searched.
- Answer a `ValidationError` from `parseQuery` with `400`, and a failed page with `500`, the same
  split `@sdxc/pagination` draws for cursors.
- Keep definitions at module scope; they are configuration, and a mistake throws at load.
- Reach for `trigram` when substring matching matters more than word relevance; it costs a much
  larger index.
