# @sdxc/search

Full-text search over SQLite tables you already declare: safe query parsing, FTS5 and `LIKE`
matching, field-weighted ranking, highlighting and batched reindexing.

## Installation

```bash
npm add @sdxc/search
```

Tables are declared and queried with `remix/data-table`, from
[`remix`](https://www.npmjs.com/package/remix). A search is a query that
[`@sdxc/pagination`](https://www.npmjs.com/package/@sdxc/pagination) pages, fallible calls answer
with a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), and a bad
query fails with a `ValidationError` from
[`@sdxc/validate`](https://www.npmjs.com/package/@sdxc/validate). All install alongside this
package. It runs on any SQLite `remix/data-table` adapter, Cloudflare D1 and Durable Object
storage included.

## Usage

### Parse what somebody typed

Input is text, never query syntax, so `it's`, `c++`, `AND` and `100%` are ordinary words:

```typescript
import { parseQuery } from "@sdxc/search";

parseQuery(`remix "route pattern" -legacy`);
// success({ text, terms: [
//   { text: "remix", phrase: false, prefix: true, exclude: false },
//   { text: "route pattern", phrase: true, prefix: false, exclude: false },
//   { text: "legacy", phrase: false, prefix: true, exclude: true },
// ] })

parseQuery("   "); // success(null): a blank box is no search
parseQuery("-legacy"); // failure(ValidationError): nothing left to find
```

### Search a table with `LIKE`

No schema change: point a definition at the table that holds the text.

```typescript
import { defineSearch } from "@sdxc/search";

import { articles } from "./schema";

const ARTICLE_SEARCH = defineSearch({
	table: articles,
	columns: [
		{ name: "title", weight: 10 },
		{ name: "summary", weight: 1 },
	],
});

let rows = await ARTICLE_SEARCH.query(db, parsed).limit(10).all();
// articles, best match first, each with a `rank`
```

### Search with FTS5 and page the results

Add an FTS5 table and its triggers to your migration (see
[Pattern: Storing an FTS5 index](#pattern-storing-an-fts5-index)), and name it in the
definition. The query pages like any other:

```typescript
import { createPaging, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { defineSearch, parseQuery } from "@sdxc/search";
import { sql } from "remix/data-table";

const ARTICLE_SEARCH = defineSearch({
	table: articles,
	columns: [
		{ name: "title", weight: 10 },
		{ name: "tags", weight: 6 },
		{ name: "summary", weight: 1 },
	],
	fts: { table: "articles_fts" },
});

const PAGING = createPaging({ perPage: 20 });

let parsed = parseQuery(url.searchParams.get("q") ?? "");
if (isFailure(parsed)) return new Response(parsed.error.message, { status: 400 });

let params = PAGING.parse(url.searchParams);
if (parsed.data === null || isFailure(params)) return renderEmptySearch();

let page = await Pagination.byOffset(
	ARTICLE_SEARCH.query(db, parsed.data).where(sql`"published_at" <= ${Date.now()}`),
	{ page: params.data.page, perPage: params.data.perPage },
);
```

### Highlight what matched

```typescript
import { excerpt, highlight } from "@sdxc/search/query";

highlight("Remix Route Pattern basics", parsed);
// [{ text: "Remix", match: true }, { text: " ", match: false },
//  { text: "Route Pattern", match: true }, { text: " basics", match: false }]

excerpt(article.body, parsed, { words: 24 });
// { segments, truncatedStart: true, truncatedEnd: false }
```

`@sdxc/search/query` imports no database code, so a browser bundle can parse and highlight with
the code the server searched with.

## API

### `parseQuery(input, options?)`

Parses search box text into terms, answering `Result<ParsedQuery | null, ValidationError>`.
Whitespace separates terms, a double-quoted run is a phrase (an unclosed quote closes at the
end), a leading `-` excludes a term, and the text is NFKC-normalized first. Terms holding no
letter or number are dropped, and at least one term must be left to find.

| Option      | Default | Meaning                                                                           |
| ----------- | ------- | --------------------------------------------------------------------------------- |
| `prefix`    | `"all"` | Which words match as prefixes: `"all"`, `"last"` (search as you type) or `"none"` |
| `maxLength` | `256`   | Characters the normalized query may hold                                          |
| `maxTerms`  | `8`     | Terms the query may hold, exclusions included                                     |

Phrases always match exactly; a trailing `*` makes its word a prefix whatever `prefix` says.

### `highlight(text, query, options?)`

Splits `text` into `{ text, match }` segments that concatenate back to `text`, for rendering
matches as `<mark>` without building HTML from strings. Case and diacritics are ignored, as
FTS5's `unicode61 remove_diacritics 2` ignores them, and the segments keep the text as written.
Excluded terms never highlight. Pass `{ mode: "substring" }` for `LIKE` and `trigram` results.

### `excerpt(text, query, options?)`

A window of `words` (default 24) words around the first match, highlighted, as
`{ segments, truncatedStart, truncatedEnd }`. A text with no match yields its opening words.

### `defineSearch(options)`

Describes a searchable table and returns a frozen definition, which holds no connection, so one
module-level definition serves every database.

| Option          | Meaning                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| `table`         | Your `table()` value; a search returns its rows plus `rank`                                 |
| `key`           | The identifying column, default the primary key; with `fts`, an integer the `rowid` mirrors |
| `columns`       | `{ name, weight }[]`, in the FTS5 table's column order                                      |
| `fts.table`     | The FTS5 table's name; without `fts`, every query runs as `LIKE`                            |
| `fts.tokenizer` | `"unicode61"` (default, declared with `remove_diacritics 2`) or `"trigram"`                 |

It throws a `RangeError` for a description that can never work: empty `columns`, a non-positive
weight, a column the table lacks, a table that declares `rank`, no single-column key, or a
non-integer `key` with `fts`.

### `search.query(db, query)`

A query matching `query`, ordered by `rank` then key unless `orderBy` says otherwise. `where`
takes a `remix/data-table` predicate, a `{ column: value }` object or a `sql` fragment;
`orderBy`, `limit` and `offset` return new queries; `all()` reads rows, decoding JSON and boolean
columns, and `count()` counts matches. Both reject with a `SearchError`, which `Pagination` turns
into its `QueryFailedError`.

With FTS5, `rank` is `bm25()` with the column weights. With `LIKE`, it is the negated weighted
count of the columns each term hit. Lower is better under both. A `trigram` index cannot answer a
term shorter than three characters, so such a query runs as `LIKE`.

### `search.predicate(query, { alias? })`

The match alone as a `sql` fragment, qualified to `alias`, for a statement you write yourself,
such as a page read through a join table. It carries no `rank`.

### `search.reindex(db, { after?, limit? })`

Writes the next `limit` (default 500) rows with a key above `after` into the FTS5 index, answering
`Result<{ indexed, next }, SearchError>`; pass `next` as the following call's `after` until it is
`null`. A batch that fails or runs twice leaves the index correct.

### Errors and limits

`SearchError` is any failure of a statement this package built, with the database error in
`cause`. `ParameterBudgetError` extends it: SQLite on D1 and Durable Objects binds at most 100
values per statement (`MAX_BOUND_PARAMETERS`), and `LIKE` binds two per term per column, so a
query over the limit is refused before it runs. `DEFAULT_MAX_QUERY_LENGTH` and
`DEFAULT_MAX_QUERY_TERMS` are `parseQuery`'s defaults.

## Pattern: Storing an FTS5 index

FTS5 needs the searched columns on one row of the table you define the search on, and an integer
key its `rowid` mirrors. A table like this meets both:

```sql
CREATE TABLE "articles" (
	"id" INTEGER PRIMARY KEY,
	"slug" TEXT NOT NULL UNIQUE,
	"title" TEXT NOT NULL,
	"tags" TEXT NOT NULL DEFAULT '',
	"summary" TEXT,
	"published_at" INTEGER
);
```

The migration adds an index holding only the inverted index, and triggers that keep it current
on every write:

```sql
CREATE VIRTUAL TABLE "articles_fts" USING fts5(
	"title", "tags", "summary",
	content='', contentless_delete=1,
	tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER "articles_fts_insert" AFTER INSERT ON "articles" BEGIN
	DELETE FROM "articles_fts" WHERE "rowid" = new."id";
	INSERT INTO "articles_fts" ("rowid", "title", "tags", "summary")
	VALUES (new."id", new."title", new."tags", new."summary");
END;

CREATE TRIGGER "articles_fts_update" AFTER UPDATE OF "title", "tags", "summary" ON "articles" BEGIN
	DELETE FROM "articles_fts" WHERE "rowid" = old."id";
	INSERT INTO "articles_fts" ("rowid", "title", "tags", "summary")
	VALUES (new."id", new."title", new."tags", new."summary");
END;

CREATE TRIGGER "articles_fts_delete" AFTER DELETE ON "articles" BEGIN
	DELETE FROM "articles_fts" WHERE "rowid" = old."id";
END;
```

- The triggers delete before inserting because a trigger takes the conflict policy of the
  statement that fired it: under an upsert on the source, `INSERT OR REPLACE` would leave the old
  words indexed.
- `contentless_delete=1` needs SQLite 3.43, which D1 and Durable Objects carry.
- When the text is spread across rows or the key is not an integer, keep a search table of one
  row per searchable thing, with an `INTEGER PRIMARY KEY` and the source's id as a unique column,
  write it with one upsert per source write, and define the search on it.
- D1 refuses to export a database holding a virtual table: drop the three triggers, then the
  index, export, recreate both, and run `reindex` from the start.

## Pattern: Reindexing from a background job

```typescript
let progress = await ARTICLE_SEARCH.reindex(db, { after: job.data.after, limit: 500 });
if (isFailure(progress)) return retryLater(progress.error);
if (progress.data.next !== null) await enqueue("reindex-articles", { after: progress.data.next });
```

Batches keep every statement short, and writes made while a reindex runs stay current through the
triggers.

## Pattern: Search narrowing a list's own order

When search only narrows a list, page it by the list's ordering; keyset paging over a stable order
is exact, while relevance order shifts whenever the index changes between pages.

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
		"@sdxc/search": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
