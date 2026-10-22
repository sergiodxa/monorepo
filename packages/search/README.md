# @sdxc/search

Full-text search over SQLite tables you already declare: safe query parsing, FTS5 and `LIKE`
matching, field-weighted ranking, highlighting and batched reindexing.

## Installation

```sh
npm add @sdxc/search
```

Tables come from `remix/data-table` in [`remix`](https://www.npmjs.com/package/remix); results
page with [`@sdxc/pagination`](https://www.npmjs.com/package/@sdxc/pagination), fallible calls
answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), and a bad
query fails with a `ValidationError` from
[`@sdxc/validate`](https://www.npmjs.com/package/@sdxc/validate). It runs on any SQLite
`remix/data-table` adapter, Cloudflare D1 and Durable Object storage included.

## Usage

### Parse what somebody typed

```typescript
import { parseQuery } from "@sdxc/search";

let parsed = parseQuery(`remix OR react "route pattern" -legacy title:forms tag:"react router"`, {
	fields: ["title"],
	filters: ["tag"],
});
// success({ text, clauses: [remix | react, "route pattern", -legacy, title:forms],
//           filters: [{ name: "tag", values: ["react router"], exclude: false }] })

parseQuery("   "); // success(null): a blank box is no search
parseQuery("-legacy"); // failure(ValidationError): nothing left to find
```

The syntax is a lenient Lucene-style subset, so input is never a syntax error and `it's`, `c++`,
`a:b` and `100%` stay ordinary words:

| Typed                                  | Meaning                                 |
| -------------------------------------- | --------------------------------------- |
| `remix router`                         | Both words                              |
| `"route pattern"`                      | The exact phrase                        |
| `rout*`                                | A prefix (every word is one by default) |
| `-legacy`, `NOT legacy`                | Leave out results holding it            |
| `+remix`, `remix AND router`           | Required, the same as the default       |
| `remix OR react`                       | Either of the terms on each side        |
| `title:remix`, `title:"route pattern"` | A word or phrase in one declared field  |
| `tag:"react router"`, `-tag:legacy`    | An exact value for a declared filter    |
| `order:asc`, `order:desc`              | Sort ascending or descending            |
| `order:relevance`                      | Sort by relevance, the default          |

Operators count only in capitals; an undeclared `name:value` stays text, and an `OR` that cannot
apply reads as plain AND. `order:` sets `parsed.order` and never becomes a term: the package
knows only the direction, so you choose the column it sorts (see
[Letting a query pick its order](#pattern-letting-a-query-pick-its-order)).

### Search a table

Point a definition at the table holding the text; with no index it matches with `LIKE`.

```typescript
import { isSuccess } from "@sdxc/result";
import { defineSearch, parseQuery } from "@sdxc/search";

import { articles } from "./schema.js";

const ARTICLE_SEARCH = defineSearch({
	table: articles,
	columns: [
		{ name: "title", weight: 10 },
		{ name: "summary", weight: 1 },
	],
});

let parsed = parseQuery("route pattern");
if (isSuccess(parsed) && parsed.data !== null) {
	let rows = await ARTICLE_SEARCH.query(db, parsed.data).limit(10).all();
	// articles, best match first, each with a `rank`
}
```

### Rank with an FTS5 index

Name the FTS5 table your migration creates (see
[Pattern: Storing an FTS5 index](#pattern-storing-an-fts5-index)), and give a column a `field` so
`title:` scopes a term to it:

```typescript
import { defineSearch, parseQuery } from "@sdxc/search";

import { articles } from "./schema.js";

const ARTICLE_SEARCH = defineSearch({
	table: articles,
	columns: [
		{ name: "title", weight: 10, field: "title" },
		{ name: "tags", weight: 6 },
		{ name: "summary", weight: 1 },
	],
	fts: { table: "articles_fts" },
});

let parsed = parseQuery(input, { fields: ARTICLE_SEARCH.fields });
```

### Highlight what matched

```typescript
import { excerpt, highlight } from "@sdxc/search/query";

highlight("Remix Route Pattern basics", query);
// [{ text: "Remix", match: true }, { text: " ", match: false },
//  { text: "Route Pattern", match: true }, { text: " basics", match: false }]

excerpt(article.body, query, { words: 24 });
// { segments, truncatedStart: true, truncatedEnd: false }
```

`@sdxc/search/query` holds `parseQuery`, `formatQuery`, `highlight` and `excerpt` with no
database code, so a browser bundle parses and highlights with the code the server searched with.

## API

### `parseQuery(input, options?): Result<ParsedQuery | null, ValidationError>`

Parses search box text with the syntax above: `null` for a blank box, a `ValidationError` for a
query too long, with too many terms, or with no positive clause or filter. Text is
NFKC-normalized and terms with no letter or number are dropped.

| Option      | Default | Meaning                                                                           |
| ----------- | ------- | --------------------------------------------------------------------------------- |
| `prefix`    | `"all"` | Which words match as prefixes: `"all"`, `"last"` (search as you type) or `"none"` |
| `maxLength` | `256`   | Characters the normalized query may hold                                          |
| `maxTerms`  | `8`     | Terms and filter values the query may hold, exclusions included                   |
| `fields`    | `[]`    | Names that scope a term to a column, usually a definition's `fields`              |
| `filters`   | `[]`    | Names that read an exact value into `filters`                                     |

Phrases always match exactly, and a trailing `*` makes its word a prefix whatever `prefix` says.
`order:` reads `relevance`, `asc` or `desc` in any case, and the last one typed wins; any other
value, a signed `order:`, or a declared field or filter named `order` reads as the syntax above.
It counts toward neither `maxTerms` nor the positive clause a query needs.

### `formatQuery(query, options?): string`

Writes a parsed query back as text in one canonical form: clauses in the order typed, then
filters, then `order:` when it is not `relevance`, single-spaced, with `OR` between alternatives
and quotes only around phrases and filter values holding whitespace. Parsing the text with the
options the query came from yields the same clauses, filters and order, so two spellings of one
query write the same text, ready to store under a unique index. Pass the `prefix` rule the text
will be parsed with, and a `*` is written only where that rule leaves a word exact.

```typescript
let query = unwrap(parseQuery("  remix AND react  tag:Remix", { filters: ["tag"] }));
formatQuery(query!); // "remix react tag:Remix"
```

### `highlight(text, query, options?): HighlightSegment[]`

Splits `text` into `{ text, match }` segments that concatenate back to it, ignoring case and
diacritics as the default tokenizer does. `mode: "substring"` matches as `LIKE` and `trigram` do;
`field` names which declared field `text` is, so terms scoped to it highlight there and only there.
Excluded terms never highlight.

### `excerpt(text, query, options?): Excerpt`

A highlighted window of `words` (default 24) words around the first match, as
`{ segments, truncatedStart, truncatedEnd }`; a text with no match yields its opening words.

### `defineSearch(options): Search`

Describes a searchable table as a frozen definition holding no connection, so one module-level
definition serves every database. It throws a `RangeError` for a description that can never work,
such as a column the table lacks or a non-integer `key` with `fts`.

| Option          | Meaning                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------ |
| `table`         | Your `table()` value; a search returns its rows plus `rank`, so it cannot declare `rank`   |
| `key`           | The identifying column, default the single-column primary key; an integer with `fts`       |
| `columns`       | `{ name, weight, field? }[]`, in the FTS5 table's column order, each weight positive       |
| `fts.table`     | The FTS5 table, whose `rowid` mirrors `key`; without `fts`, every query runs as `LIKE`     |
| `fts.tokenizer` | `"unicode61"` (default, declared with `remove_diacritics 2`) or `"trigram"` for substrings |

The definition also exposes `table`, `key` and `fields`, the declared field names to pass to
`parseQuery`.

### `search.query(db, query): SearchQuery`

A query matching `query`, ordered by `rank` then key until the first `orderBy`, which pages with
`Pagination.byOffset` and `Pagination.byKeyset`. `where` takes a predicate, a `{ column: value }`
object or a `sql` fragment; `orderBy`, `limit` and `offset` return new queries; `all()` reads rows,
decoding JSON and boolean columns, and `count()` counts matches. Both reject with a
`SearchError`.

`rank` is lower for better matches: `bm25()` with the column weights under FTS5, the negated
weighted count of columns hit under `LIKE`, and `0` for a query of only filters and exclusions.
Under `trigram`, a query holding a term shorter than three characters runs as `LIKE`.

### `search.predicate(query, { alias? }): SqlStatement`

The match alone as a `sql` fragment qualified to `alias` (default the table name), for a statement
you write yourself. It carries no `rank`.

### `search.reindex(db, { after?, limit? }): Promise<Result<ReindexProgress, SearchError>>`

Writes the next `limit` (default 500) rows with a key above `after` into the FTS5 index and answers
`{ indexed, next }`; call again with `after: next` until `next` is `null`. A batch that fails or
runs twice leaves the index correct.

### `SearchError`

Any failure of a statement this package built, with the database's error in `cause`.

### `ParameterBudgetError`

A `SearchError` raised before a statement runs when it would bind more than
`MAX_BOUND_PARAMETERS` (100, the D1 and Durable Object limit) values, with `count` and `limit`.
`LIKE` binds two values per term per column, which `maxTerms` keeps within budget.

### Constants

`MAX_BOUND_PARAMETERS` (`100`), `DEFAULT_MAX_QUERY_LENGTH` (`256`) and `DEFAULT_MAX_QUERY_TERMS`
(`8`).

### Types

`ParsedQuery` holds `text`, `clauses`, `filters` and `order`, a `SearchOrder` of
`"relevance"` (the default), `"asc"` or `"desc"`. A `SearchClause` is `{ terms, exclude }`,
matching when any of its `SearchTerm`s `{ text, phrase, prefix, field }` does; a `SearchFilter` is
`{ name, values, exclude }`. `ParseQueryOptions`, `FormatQueryOptions`, `HighlightOptions`,
`HighlightSegment`, `ExcerptOptions` and `Excerpt` type the query entry point. `Search<Table>`,
`SearchQuery<Table>`, `SearchRow<Table>` (a row plus `rank`), `SearchColumnName<Table>`,
`SearchWhere<Table>`, `DefineSearchOptions`, `SearchColumn`, `SearchFts`, `SearchPredicateOptions`,
`ReindexOptions` and `ReindexProgress` type a definition and its queries.

## Pattern: Storing an FTS5 index

FTS5 needs the searched columns on one row and an integer key its `rowid` mirrors. The migration
creates a contentless index and triggers that keep it current on every write:

```sql
CREATE TABLE "articles" (
	"id" INTEGER PRIMARY KEY,
	"slug" TEXT NOT NULL UNIQUE,
	"title" TEXT NOT NULL,
	"tags" TEXT NOT NULL DEFAULT '',
	"summary" TEXT,
	"published_at" INTEGER
);

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

- The triggers delete before inserting, so an upsert on the source replaces the indexed words.
- `contentless_delete=1` needs SQLite 3.43, which D1 and Durable Objects carry.
- For text spread across rows or a non-integer key, keep a search table of one row per
  searchable thing, with an `INTEGER PRIMARY KEY` and the source id as a unique column, and define
  the search on it.
- D1 exports a database only without virtual tables: drop the triggers and the index, export,
  recreate both, and run `reindex` from the start.

## Pattern: A search page with filters

Declared filters come back in `parsed.filters` for you to apply as `where`, since only you know
which column each one reads.

```typescript
import type { Database } from "remix/data-table";

import { createPaging, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { defineSearch, parseQuery } from "@sdxc/search";
import { inList, notInList, sql } from "remix/data-table";

import { articles } from "./schema.js";

const ARTICLE_SEARCH = defineSearch({
	table: articles,
	columns: [
		{ name: "title", weight: 10, field: "title" },
		{ name: "summary", weight: 1 },
	],
	fts: { table: "articles_fts" },
});

const PAGING = createPaging({ perPage: 20 });

async function searchArticles(db: Database, url: URL) {
	let parsed = parseQuery(url.searchParams.get("q") ?? "", {
		fields: ARTICLE_SEARCH.fields,
		filters: ["author"],
	});
	if (isFailure(parsed)) return new Response(parsed.error.message, { status: 400 });

	let params = PAGING.parse(url.searchParams);
	if (parsed.data === null || isFailure(params)) return Response.json({ items: [] });

	let query = ARTICLE_SEARCH.query(db, parsed.data).where(sql`"published_at" <= ${Date.now()}`);
	for (let filter of parsed.data.filters) {
		query = query.where(
			filter.exclude ? notInList("author", filter.values) : inList("author", filter.values),
		);
	}

	let page = await Pagination.byOffset(query, {
		page: params.data.page,
		perPage: params.data.perPage,
	});
	if (isFailure(page)) return new Response("Search failed", { status: 500 });
	return Response.json(page.data);
}
```

`Pagination` turns a rejected `all()` or `count()` into its `QueryFailedError`.

## Pattern: Search as you type

`prefix: "last"` matches only the word still being typed as a prefix. Highlight each column as the
field it is, so `title:` terms mark only the title, and catch a `ParameterBudgetError` where you
call `all()` directly.

```typescript
import type { Database } from "remix/data-table";

import { isFailure } from "@sdxc/result";
import { excerpt, highlight, ParameterBudgetError, parseQuery } from "@sdxc/search";

import { ARTICLE_SEARCH } from "./search.js";

async function suggest(db: Database, input: string) {
	let parsed = parseQuery(input, { prefix: "last", fields: ARTICLE_SEARCH.fields });
	if (isFailure(parsed) || parsed.data === null) return Response.json([]);
	let query = parsed.data;

	try {
		let rows = await ARTICLE_SEARCH.query(db, query).limit(5).all();
		return Response.json(
			rows.map((row) => ({
				slug: row.slug,
				title: highlight(row.title, query, { field: "title" }),
				summary: excerpt(row.summary ?? "", query, { words: 16 }),
			})),
		);
	} catch (error) {
		if (error instanceof ParameterBudgetError) return Response.json([], { status: 400 });
		throw error;
	}
}
```

The browser renders each segment with `match: true` inside a `<mark>`, from the same
`@sdxc/search/query` code.

## Pattern: Substring search with a trigram index

A `trigram` tokenizer finds any substring of three characters or more, for codes, file names or
identifiers; shorter terms fall back to `LIKE`. Highlight with `mode: "substring"` to match.

```sql
CREATE VIRTUAL TABLE "packages_fts" USING fts5(
	"name", "description",
	content='', contentless_delete=1,
	tokenize='trigram'
);
```

```typescript
import { defineSearch, highlight } from "@sdxc/search";

import { packages } from "./schema.js";

const PACKAGE_SEARCH = defineSearch({
	table: packages,
	columns: [
		{ name: "name", weight: 5 },
		{ name: "description", weight: 1 },
	],
	fts: { table: "packages_fts", tokenizer: "trigram" },
});

let rows = await PACKAGE_SEARCH.query(db, query).limit(20).all();
let names = rows.map((row) => highlight(row.name, query, { mode: "substring" }));
```

## Pattern: Search narrowing a list's own order

When search only narrows a list, page it by the list's ordering: keyset paging over a stable
order is exact, while relevance order shifts whenever the index changes between pages.

```typescript
import { Pagination } from "@sdxc/pagination";

import { ITEM_SEARCH } from "./search.js";

let page = await Pagination.byKeyset(ITEM_SEARCH.query(db, query).where({ feed_id: feedId }), {
	orderBy: [
		["published_at", "desc"],
		["id", "desc"],
	],
	cursor: url.searchParams.get("cursor"),
	limit: 50,
});
```

## Pattern: Letting a query pick its order

`parsed.order` is a direction for you to apply: keep `rank` for `"relevance"`, and sort the column
that fits your data for `"asc"` and `"desc"`.

```typescript
import { ARTICLE_SEARCH } from "./search.js";

let query = ARTICLE_SEARCH.query(db, parsed);
if (parsed.order !== "relevance") {
	query = query.orderBy("published_at", parsed.order).orderBy("id", parsed.order);
}

let rows = await query.limit(20).all();
```

## Pattern: Matching inside your own statement

`predicate` drops the match into SQL you write, such as a read through a join table; qualify it
with the alias your statement gives the searched table.

```typescript
import { sql } from "remix/data-table";

import { ARTICLE_SEARCH } from "./search.js";

let match = ARTICLE_SEARCH.predicate(query, { alias: "a" });

let result = await db.exec(sql`
	select a.* from "articles" a
	join "bookmarks" b on b."article_id" = a."id"
	where b."user_id" = ${userId} and ${match}
	order by b."created_at" desc
	limit 20
`);
```

## Pattern: Reindexing from a background job

Fill a new index, or rebuild one, in batches that keep every statement short; writes made while
it runs stay current through the triggers.

```typescript
import type { Database } from "remix/data-table";

import { isFailure } from "@sdxc/result";

import { enqueue } from "./jobs.js";
import { ARTICLE_SEARCH } from "./search.js";

async function reindexArticles(db: Database, after: number | null) {
	let progress = await ARTICLE_SEARCH.reindex(db, { after, limit: 500 });
	if (isFailure(progress)) return progress;
	if (progress.data.next !== null) await enqueue("reindex-articles", { after: progress.data.next });
	return progress;
}
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
