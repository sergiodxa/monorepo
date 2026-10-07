# ADR-109: Search Package

## Status

**Accepted** - 2026-10-06

## Background

Three apps search text, and each one wrote its own search. The blog ranks its whole published
corpus in memory on every query and has no search page. The reader composes a `LIKE` statement
with an `ESCAPE` clause, folds the pager's seek predicate into it by hand, and carries two copies
of the code that turns that seek predicate into SQL. The documentation site ranks a static index
in the browser. Nothing shares query parsing, escaping, ranking or highlighting, and both apps
that store their text in SQLite have an ADR naming FTS5 as the next step without either one
taking it.

The apps run on the two SQLite flavours Cloudflare offers: D1 (`@sdxc/data-table-d1`) and a
Durable Object's SQL storage (`@sdxc/data-table-sqlstorage`). Both support FTS5, both reject
interactive transactions, both cap a statement at 100 bound parameters, and `remix/data-table`'s
typed builder can express neither a `MATCH`, a `bm25()` call nor a `LIKE … ESCAPE`. A search
over either one has to be written as raw SQL and still page through `@sdxc/pagination` the way
every other list does. That is what this package is for.

## Context

### Current implementations

| Location                                                                                       | Storage                   | Matching                                            | Ranking                                               | Paging                                                                      |
| ---------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/blog/app/repositories/search.ts` (`PostSearch.query`)                                    | D1, key/value `post_meta` | Lowercased substring over title, tags, excerpt      | Title > tag > body, then newest, in memory            | `slice(0, limit)` after reading every published post                        |
| `apps/reader/database/user-do.ts` (`SearchQuery`, `searchStatement`, `likePattern`, `seekSql`) | Durable Object SQLite     | `LIKE '%…%' ESCAPE '\'` over title, summary, author | None; the list's own `(published_at, id)` order       | `Pagination.byKeyset` over a hand-written `KeysetQuery`, date-bounded steps |
| `apps/sdxc/app/services/search-query.ts` (`rankDocuments`)                                     | Static, in the browser    | Word-start match per token, every token required    | Hand-tuned field scores, scope-stripped package names | `slice(0, limit)`                                                           |

The blog's ADR-003 chose in-memory matching because the app had no database test harness, and
says the signature is what is meant to last. The reader's ADR-016 measured FTS5 against its
bounded scan, verified that `workerd`'s authorizer allows `fts5` virtual tables, and declined to
build one until its `user.search` event shows readers exhausting steps.

### What the platform allows

| Concern                     | D1                                                                                     | Durable Object SQLite                                                        |
| --------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| FTS5                        | Supported, including `fts5vocab`                                                       | Supported, including `fts5vocab`; virtual-table writes count as rows written |
| Transactions                | Each statement commits on its own; `db.transaction()` is a scope, not atomicity        | `BEGIN`/`SAVEPOINT` rejected; writes within one turn commit together         |
| Bound parameters            | 100 per statement                                                                      | 100 per statement                                                            |
| Statement length            | 100 KB                                                                                 | 100 KB                                                                       |
| Statement duration / budget | 30 seconds per query; 1,000 queries per invocation on Workers Paid (50 on Free)        | One thread per object; a long statement blocks every other request           |
| Export                      | `wrangler d1 export` refuses a database holding a virtual table                        | No export tool                                                               |
| Raw statements              | The adapter reads rows back from `SELECT`, `WITH`, `PRAGMA` and `RETURNING` statements | Same rule in the adapter                                                     |

A trigger runs inside the statement that fired it, so on both platforms a write to a source row
and the trigger's write to its index commit together, with no transaction scope needed.

### FTS5 behaviour verified while writing this ADR

Each of these was run against SQLite 3.53 through `node:sqlite` and through
`@sdxc/data-table-d1` over `@sdxc/cloudflare-mocks`' D1:

| Behaviour                                                                                                                                              | Consequence for the design                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Raw user text fails as a `MATCH` argument: `foo"` (unterminated string), `AND` (syntax error), `a:b` (no such column), `c++`, `it's`, `-x`             | Every term reaches FTS5 as a double-quoted string, never as query syntax  |
| A double-quoted term is tokenized, never parsed: `"OR"`, `"c++"`, `"it's"`, `"a:b"` all match safely; `""` inside doubles a quote                      | Quoting is the whole escaping rule                                        |
| A query opening with `NOT` is a syntax error                                                                                                           | An exclusion needs a positive term before it                              |
| A quoted string holding no tokens (`"++"`) matches nothing alone and is ignored beside other terms                                                     | Symbol-only terms are dropped at parse time, so both strategies agree     |
| `rank = <number>` in a `WHERE` on the FTS table is read as a ranking-function override (`parse error in rank function`)                                | Seek predicates compare a CTE column, never the FTS table's hidden `rank` |
| `fts = ?` with the content table driving the join and the FTS table joined returns no rows; FTS driving returns the matches                            | The FTS table is always the driving table, which a CTE guarantees         |
| A `contentless_delete=1` table accepts `INSERT OR REPLACE` by `rowid` and a `DELETE` of a rowid it never held, as no-ops on the index's integrity      | Sync triggers and backfill can be idempotent and run concurrently         |
| An external-content table's `'delete'` command for a row it never indexed corrupts the index (`database disk image is malformed` on `integrity-check`) | A batched backfill racing a trigger is unsafe on external content         |
| `bm25()` scores move whenever the index changes, and identical documents tie                                                                           | Relevance paging needs a tiebreaker and cannot be snapshot-consistent     |
| Generated DDL with single-quoted option values and double-quoted identifiers replays with double-quoted string literals disabled                       | The recommended DDL satisfies `test/migration-replay.test.ts`             |

### Issues identified

| Issue                                                                     | Impact                                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| No shared FTS5 query escaping                                             | The first app to adopt FTS5 meets the syntax errors above at the first apostrophe                                               |
| `LIKE` escaping lives in one app                                          | The next `LIKE` search either copies `likePattern` or ships without `ESCAPE`                                                    |
| The pager's seek predicate is compiled to SQL by hand, twice, in one file | A third raw query copies it again                                                                                               |
| The blog reads every published post per query                             | Cost grows with the corpus, and there is no relevance beyond three buckets                                                      |
| No highlighting anywhere                                                  | A result cannot show why it matched; `snippet()` would hand back marker-injected strings, which the apps may not render as HTML |

## Decision

Add `@sdxc/search`: query parsing, safe FTS5 and `LIKE` matching, field-weighted ranking,
highlighting and batched reindexing over **tables the app already declares**, exposed as a query
that `Pagination.byOffset` and `Pagination.byKeyset` page like any other.

### The package owns logic, the app owns storage

The package ships no schema, no tables, no migrations and no migration generators. An app
declares its source table with `remix/data-table`'s `table()`, writes its FTS5 virtual table and
sync triggers into its own migration, and hands the package a description: which table, which
columns with which weights, which FTS5 table if any, and which integer column that table's
`rowid` mirrors. Everything the package does is a statement built from that description and run
through the `Database` the caller passes.

The DDL below is guidance an app copies, adapts and commits. It is the README's example, and the
package's tests replay it with double-quoted string literals disabled so the example stays
correct, but no exported function produces it.

### Package shape

```json
{
	"name": "@sdxc/search",
	"private": true,
	"exports": {
		".": "./src/index.ts",
		"./query": "./src/query.ts"
	},
	"dependencies": {
		"@sdxc/pagination": "workspace:*",
		"@sdxc/result": "workspace:*",
		"@sdxc/validate": "workspace:*",
		"remix": "3.0.0"
	}
}
```

| Export               | Contents                                                                                           | Imports `remix/data-table`  |
| -------------------- | -------------------------------------------------------------------------------------------------- | --------------------------- |
| `@sdxc/search/query` | `parseQuery`, `highlight`, `excerpt`, and their types                                              | No; safe in a client bundle |
| `@sdxc/search`       | Everything in `./query`, plus `defineSearch`, `SearchQuery`, `SearchError`, `ParameterBudgetError` | Yes                         |

`@sdxc/pagination` supplies the `KeysetQuery`/`OffsetQuery` contracts and the `Predicate` shape
its seek produces; `@sdxc/validate` supplies the `ValidationError` a malformed query fails with,
the same error `parsePageParams` answers. The package stays private until the blog consumes it,
then follows the publishing rules in `AGENTS.md`.

### 1. Parsing what somebody typed

```typescript
import { parseQuery } from "@sdxc/search/query";

parseQuery(`remix "route pattern" -legacy data*`);
// success: {
//   text: 'remix "route pattern" -legacy data*',
//   terms: [
//     { text: "remix", phrase: false, prefix: true, exclude: false },
//     { text: "route pattern", phrase: true, prefix: false, exclude: false },
//     { text: "legacy", phrase: false, prefix: true, exclude: true },
//     { text: "data", phrase: false, prefix: true, exclude: false },
//   ],
// }

parseQuery("   "); // success: null, a blank box is no search
parseQuery("-legacy"); // failure: ValidationError, nothing left to find
parseQuery("x".repeat(500)); // failure: ValidationError, longer than maxLength
```

- **Input is text, never syntax.** Whitespace separates terms, a double-quoted run is a phrase
  (an unclosed quote closes at the end), a leading `-` excludes a term and a trailing `*` is
  accepted and stripped. `AND`, `OR`, `NOT`, `NEAR`, `column:` and parentheses are ordinary
  words. Text is NFKC-normalized first.
- **`prefix`** decides which terms match as word prefixes: `"all"` (default), `"last"` for
  search-as-you-type, or `"none"`. Phrases are always exact. Prefix-by-default is what lets
  `sql` keep finding `sqlite`, which is what `LIKE` search taught readers to expect.
- **Terms carrying no letter or number are dropped**, because FTS5's tokenizer keeps nothing of
  them; dropping them in the parser keeps the FTS and `LIKE` strategies agreeing on what a
  query means.
- **`maxLength`** (default 256 characters) and **`maxTerms`** (default 8) are validated here, so
  an oversized query is a `400` at the boundary rather than a statement over the 100-parameter
  limit.
- At least one non-excluded term is required, since FTS5 rejects a query opening with `NOT`
  and an "everything except" search is a scan of the whole table.

### 2. Describing an app's table

```typescript
import { defineSearch } from "@sdxc/search";

import { postSearch as postSearchTable } from "~/database/schema";

/** Published posts, ranked so a title hit outranks a tag, and a tag outranks the excerpt. */
const postSearch = defineSearch({
	table: postSearchTable,
	key: "id",
	columns: [
		{ name: "title", weight: 10 },
		{ name: "tags", weight: 6 },
		{ name: "excerpt", weight: 1 },
	],
	fts: { table: "post_search_fts", tokenizer: "unicode61" },
});
```

- **`table`** is the app's own `table()` value. Column names in `columns`, `key`, `orderBy` and
  `where` are typed against it, and the row a search returns is that table's row plus `rank`.
- **`columns`** is an array because order matters: it must match the FTS table's column
  declaration order, which is how `bm25()` assigns weights positionally. With `LIKE`, the same
  weights score which columns a term hit.
- **`key`** defaults to the table's primary key. With `fts`, it must be an integer column whose
  value the FTS table's `rowid` mirrors; `defineSearch` checks the column's declared type.
- **`fts`** is optional. Without it every query runs the `LIKE` strategy. `tokenizer` is
  `"unicode61"` (default, assumed to be declared with `remove_diacritics 2`) or `"trigram"`; it
  changes how terms are compiled and how highlighting matches.
- Like `createBackoff` (ADR-106), `defineSearch` throws a `RangeError` for a description that
  can never work — an empty `columns`, a non-positive weight, a column the table lacks, a
  non-integer `key` with `fts` — since these are fixed at module scope and never depend on input.

A definition is a frozen value with no state of its own, so one module-level definition serves
every tenant; see [Multi-tenancy](#7-multi-tenancy).

### 3. Querying, composed with `@sdxc/pagination`

`search.query(db, parsed)` returns a `SearchQuery<Row>`, which implements both `OffsetQuery<Row>`
and `KeysetQuery<Row, WhereInput | SqlStatement, string>`: `where`, `orderBy`, `limit`, `offset`,
`count` and `all`, each returning a new query. It is the reader's `SearchQuery` pattern,
generalized: the pager composes its seek and ordering into it, and `all()` runs one statement.

```typescript
import { createPaging, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { parseQuery } from "@sdxc/search";
import { sql } from "remix/data-table";

const PAGING = createPaging({ perPage: 20, maxPerPage: 50 });

/** A search results page: numbered, relevance first, with `q` carried into every `Link`. */
export async function searchPosts(ctx: SearchContext) {
	let parsed = parseQuery(ctx.url.searchParams.get("q") ?? "");
	if (isFailure(parsed)) return badRequest(parsed.error);
	if (parsed.data === null) return renderEmptySearch();

	let params = PAGING.parse(ctx.url.searchParams);
	if (isFailure(params)) return redirectToFirstPage(ctx.url);

	let found = postSearch
		.query(ctx.db, parsed.data)
		.where(sql`("published_at" is null or "published_at" <= ${Date.now()})`);

	let page = await Pagination.byOffset(found, {
		page: params.data.page,
		perPage: params.data.perPage,
	});
	if (isFailure(page)) return serverError(page.error);

	return render(page.data, PAGING.paginate(new Headers(), page.data, { url: ctx.url }));
}
```

`where` takes a `remix/data-table` predicate or object (`{ kind: "tutorial" }`, `eq(…)`,
`inList(…)`) and a `sql` fragment for anything the predicate shapes cannot say. Predicate columns
must belong to the described table or be `rank`, and compile qualified to it. `paginate()`
already carries every other query parameter into the `Link` URLs, so `q` survives paging with no
code here.

When `orderBy` is never called, the query orders by `rank asc`, then `key asc`. A caller that
wants a list's own order instead — the reader's rule that "a search adopts the ordering of the
list it narrows" — passes that ordering to the pager, and search becomes only a predicate:

```typescript
let page = await Pagination.byKeyset(
	itemSearch.query(this.#db, parsed).where({ feed_id: feedId }),
	{
		orderBy: [
			["published_at", "desc"],
			["id", "desc"],
		],
		cursor: params.data.cursor,
		limit: 50,
	},
);
```

For an app statement the package does not build, such as a page read through a join table,
`search.predicate(parsed, { alias })` returns the match alone as a `sql` fragment: the `LIKE`
clauses qualified to `alias`, or `"<key>" in (select "rowid" from <fts> where <fts> match ?)`.
It carries no `rank`, and it is the same fragment `SearchQuery` builds on.

`SearchQuery.all()` rejects rather than answering a `Result`, because it implements the query
builder's contract; `Pagination` catches the rejection and answers `QueryFailedError`, which is
the `Result` a route sees.

### 4. The statements

#### FTS5

```text
with "search_hits" as (
  select "rowid" as "search_key", bm25("post_search_fts", 10.0, 6.0, 1.0) as "search_rank"
    from "post_search_fts"
   where "post_search_fts" match ?                       -- '"remix"* "route pattern" NOT "legacy"*'
)
select "post_search".*, "search_hits"."search_rank" as "rank"
  from "search_hits"
  join "post_search" on "post_search"."id" = "search_hits"."search_key"
 where (<caller predicates and fragments>)
   and (<pager seek, "rank" compiled to "search_hits"."search_rank">)
 order by "rank" asc, "post_search"."id" asc
 limit ? offset ?
```

- **Terms** compile to `"text"` with internal `"` doubled, `*` after the closing quote for a
  prefix term, positives joined by spaces (implicit `AND`), and each exclusion appended as
  `NOT "text"` after the parenthesized positives. The whole `MATCH` argument is one bound
  parameter, whatever the number of terms.
- **The CTE** makes the FTS table the driving table and names the score `search_rank`, so a seek
  on `rank` is a comparison on a plain column instead of FTS5's ranking-function override.
- **Weights** are passed to `bm25()` per query from the description, so changing a weight is a
  code change, with nothing persisted in the index's configuration.
- **`count()`** wraps the same statement without ordering, limit or offset in
  `select count(*)`; FTS5 answers it from the index plus one join per match.
- **`trigram`** compiles terms without `*`, since every trigram match is already a substring
  match; a query whose positive terms include one shorter than three characters, which a trigram
  index cannot answer, runs the `LIKE` strategy instead.

#### `LIKE`

```text
select "feed_items".*,
       -(1 * ("title" like ? escape '\') + 1 * ("summary" like ? escape '\') + …) as "rank"
  from "feed_items"
 where ("title" like ? escape '\' or "summary" like ? escape '\' or "author" like ? escape '\')
   and (… the same for every further term …)
   and not (… the same for every excluded term …)
   and (<caller predicates and fragments>)
   and (<pager seek>)
 order by <the pager's ordering>
 limit ?
```

- **Patterns** escape `\` first, then `%` and `_`, and wrap the result in `%…%`: the reader's
  `likePattern`, moved. Phrases match as one substring; prefix flags change nothing, since a
  substring match is already looser than a prefix.
- **`rank`** is the negated weighted count of the columns each term hit, so `rank asc` puts the
  best match first under both strategies, with the sign FTS5 uses for `bm25()`. SQLite resolves
  `"rank"` in the `WHERE` to the result column, so a seek on it needs no subquery.
- **Case** folds for ASCII only and diacritics are compared as written, which is SQLite's `LIKE`;
  the README says so, and an app that needs `café` to find `cafe` uses the FTS strategy.

#### The parameter budget

D1 and Durable Object SQLite both stop at 100 bound parameters. The `MATCH` costs one; `LIKE`
costs two per term per column (the match and the score). The query counts its bound values
before executing and rejects with `ParameterBudgetError`, naming the count, instead of letting
the database fail mid-page. At the defaults — eight terms over three columns — `LIKE` binds 48,
leaving room for filters and a three-key seek.

### 5. Relevance and cursors

`bm25()` depends on the index's statistics — row count, average column length, how many rows
hold a term — so any write to the index between two page requests moves every score. No cursor
design makes relevance order snapshot-consistent without a snapshot, and neither platform offers
one across requests. The package states the anomaly instead of hiding it:

| Strategy                                          | Cursor                 | When the index changes between pages                                                        |
| ------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| `byOffset`, default order                         | `?page=n`              | Every row after an insertion shifts by one; a row can repeat or be skipped at each boundary |
| `byKeyset`, `[["rank", "asc"], [key, "asc"]]`     | `{ rank: float, key }` | Only rows whose score crossed the boundary value repeat or go missing                       |
| `byKeyset`, a stable order such as `published_at` | `{ published_at, id }` | Exact, as for any list                                                                      |

- **Offset is the recommended relevance pager** for pages a person reads: it gives the numbered
  pager and total a results page shows, and its anomaly is the familiar one.
- **Keyset over `(rank, key)`** is supported for feeds and APIs. The key is the tiebreaker
  `Pagination` requires, and it matters: identical documents score identically. A `bm25()` value
  is a finite double that survives the cursor's JSON exactly, and SQLite compares the bound
  `REAL` exactly, so on an unchanged index the seek is exact. Scores are never rounded: in a
  small corpus they sit around `1e-6`, and rounding would collapse them into ties.
- **A cursor carries no query.** A relevance cursor replayed against a different `q` decodes and
  seeks on meaningless scores. `paginate()` only advertises links built from the current URL,
  and a search form's `GET` submits without the cursor, so this needs a hand-edited URL.
- **A stable order with FTS5** sorts the whole match set before the first row is returned, the
  cost the reader's ADR-016 measured. The README documents it beside the ordering option.

### 6. Highlighting

```typescript
import { excerpt, highlight } from "@sdxc/search/query";

highlight("Remix Route Pattern basics", parsed);
// [
//   { text: "Remix", match: true },
//   { text: " ", match: false },
//   { text: "Route Pattern", match: true },
//   { text: " basics", match: false },
// ]

excerpt(row.excerpt, parsed, { words: 24 });
// { segments: HighlightSegment[], truncatedStart: true, truncatedEnd: false }
```

```tsx
function Highlighted() {
	return ({ segments }: { segments: HighlightSegment[] }) => (
		<span>{segments.map((part) => (part.match ? <mark>{part.text}</mark> : part.text))}</span>
	);
}
```

- Matching mirrors `unicode61 remove_diacritics 2`: both sides are NFD-decomposed, stripped of
  combining marks and lowercased for comparison, word boundaries are runs of letters and
  numbers, prefix terms match a word's start and phrases match consecutive words. Offsets map
  back to the original text, so `Résumé` is highlighted as written when somebody typed
  `resume`. `{ mode: "substring" }` matches anywhere, for `LIKE` and `trigram` results.
- It returns segments, never markup, so the app renders `<mark>` through `remix/component`
  and the text stays escaped by construction.
- It runs on the row the search already returned, so the `LIKE` strategy and FTS5 highlight the
  same way, and the browser can highlight with the same code because `./query` imports no
  database module.

FTS5's `highlight()` and `snippet()` go unused. They return the row's text with marker strings
spliced in, which would have to be split back apart and could collide with the text itself;
they need an index that stores or can read its content; and they do nothing for `LIKE`.

### 7. Multi-tenancy

- The package holds no cache and no connection. A definition is configuration; the `Database`
  arrives on every call, from `ctx.db` per ADR-057, so a definition shared at module scope can
  never read one tenant's rows through another's database.
- A future memo of compiled statement text would be keyed on the definition, never on a
  `Database`: statement text depends only on the description and the query, and holds no rows.
- Tenancy inside one database is the caller's `where`, exactly as it is for every other list.
  The package documents one thing that `where` cannot fix: `bm25()` statistics are per index,
  so tenants sharing one FTS table share document frequencies. Ranking then depends on other
  tenants' content, and a term's score leaks how common it is elsewhere. A per-tenant database
  (a Durable Object, or a D1 per tenant) has no such channel; a shared D1 that cares keeps an
  index per tenant.

### 8. Reindexing in batches

```typescript
let progress = await postSearch.reindex(ctx.db, { after: job.data.after, limit: 500 });
// Result<{ indexed: number; next: number | null }, SearchError>

if (isFailure(progress)) return ctx.retry({ delay: "1 minute", cause: progress.error });
if (progress.data.next !== null) await ctx.enqueue("reindex-posts", { after: progress.data.next });
```

- One call reads the next `limit` keys above `after` and writes them with
  `insert or replace into <fts> ("rowid", <columns>) select <key>, <columns> from <table> where <key> > ? and <key> <= ?`.
  Each statement is complete on its own, so the D1 statement-at-a-time model loses nothing,
  and a call that fails or runs twice — a job is delivered at least once — leaves the index
  correct.
- It writes into the app's FTS table and creates nothing: it is the same statement the
  recommended triggers run, applied to a range. It is correct only for an index that accepts
  `insert or replace` by `rowid`, which the recommended contentless-delete table does; an
  external-content table rejects that write and the README says so.
- Batches keep every statement far from D1's 30-second limit and the 1,000-query invocation
  budget, and keep a Durable Object's thread free between alarms. Writes made while a reindex
  runs are kept current by the triggers, and the backfill overwrites them with the same values.

### Recommended storage (guidance the app copies)

Index a table with an `INTEGER PRIMARY KEY`. When the searchable thing has a text id — both the
blog's posts and the reader's items do — that is a search document table of the app's own,
`("id" INTEGER PRIMARY KEY, "post_id" TEXT NOT NULL UNIQUE, …)`, or an integer column of its
own, as the reader's ADR-016 already prescribes. Never the implicit `rowid`: `VACUUM` may
renumber it, and so may an export that dumps rows without it.

```sql
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

- **Contentless-delete** stores only the inverted index. The text stays in the source row, which
  is where the search reads it from and where highlighting runs. It needs SQLite 3.43, which
  `workerd` carries; the package's `*.workers.test.ts` creates one on the `packages-workers`
  project's real D1 binding to keep that claim checked.
- **Triggers** are the one write path, so no repository, sweep or deletion site can forget the
  index, the failure the reader's ADR-016 named. They commit inside the statement that fired
  them on both platforms.
- **A `DELETE` by `rowid`, then an `INSERT`** is idempotent, which is what makes the triggers
  and the batched reindex safe to interleave. A trigger's statements take the conflict policy
  of the statement that fired it, so under an upsert on the source an `INSERT OR REPLACE` in
  the trigger becomes a plain insert and leaves the old terms indexed; the explicit `DELETE`
  holds under every policy. An external-content table's `'delete'` command needs the exact old
  values and corrupts the index when the row was never indexed.
- **Quoting** is single quotes for option values and double quotes for identifiers, so the
  migration replays in `test/migration-replay.test.ts` with double-quoted string literals off.
- **Exporting a D1 database** means dropping the three triggers and the virtual table, exporting,
  recreating both, and running `reindex` from the start. Dropping the table alone leaves
  triggers that fail every write to the source; the README carries the matching `DROP`
  statements in that order.
- **`prefix='2 3'`** is a tuning option for a large index under the default prefix matching; it
  grows the index and is left out of the default.

## Consequences

### Positive

- **One escaping rule per strategy.** No user text reaches FTS5 as syntax or `LIKE` as a
  wildcard, in any app.
- **Search pages like a list.** Offset and keyset, `Link` headers and `X-Total-Count`, cursor
  validation and the 400/500 split all come from `@sdxc/pagination` unchanged.
- **Real relevance where FTS5 is adopted.** `bm25()` with per-column weights replaces the blog's
  three buckets and its read of every published post.
- **Highlighting that renders safely.** Segments render as JSX, identically for both strategies,
  on the server and in the browser.
- **Storage stays with the app.** Migrations, trigger names, table layout and the decision to
  use FTS5 at all stay in the app's migration chain and its ADRs.
- **Safe backfill on D1.** Idempotent batches need no transaction and survive at-least-once jobs.

### Negative

- **Raw SQL.** The statements bypass the typed builder, so the package carries its own compiler
  for `remix/data-table` predicates and decodes JSON and boolean columns from the table's column
  definitions, a second copy of what the adapters do for a typed `select`.
- **Every source write costs more.** Each indexed write fires a trigger that writes several
  FTS5 shadow rows, billed as rows written on both platforms.
- **Relevance paging is not stable under writes.** Documented, not solved.
- **Contentless indexes cannot answer from themselves.** No `highlight()`, no `snippet()`, no
  `'rebuild'`; text always comes from the source row, and recovery is `reindex`.
- **D1 export needs a procedure.** Any D1 database with an index needs the drop, export,
  recreate, reindex sequence.
- **Highlighting approximates the tokenizer.** `unicode61` has its own separator and token
  character tables; the JS matcher follows Unicode letter and number classes, which agree for
  the scripts these apps hold but are not byte-for-byte the same.

### Neutral

- **The reader keeps its ADR-016 decision.** It adopts the `LIKE` strategy now and gets FTS5 by
  adding a migration and a `fts` entry when its own measurement says so.
- **`apps/sdxc` keeps its ranker.** See Alternatives.
- **The package has no opinion on cross-type search.** The blog's article, tutorial and glossary
  results come from one search document table because the app chose that layout.

## Implementation Plan

### Phase 1: The package

**Priority:** High
**Estimated Effort:** 6 hours

1. Create `packages/search`, private, with the two subpath exports above.
2. `./query`: `parseQuery`, `highlight`, `excerpt`; spec the parser first, covering every input in
   the verification table.
3. `.`: `defineSearch`, `SearchQuery` (FTS and `LIKE` statements, predicate and seek compilation,
   column decoding, the parameter budget), `reindex`, `SearchError`, `ParameterBudgetError`.
4. Tests in Vitest against `@sdxc/cloudflare-mocks`' D1 and SQL storage through both adapters:
   paging by offset and by keyset over `rank` and over a stable order, an apostrophe, a quote,
   `AND`, `c++` and `%` in a query, exclusions, weights changing the order, the budget refusal,
   an interrupted and repeated `reindex`, and a trigger write racing a reindex. The README's DDL
   is replayed with double-quoted string literals disabled.
5. `src/fts.workers.test.ts` on the `packages-workers` D1 binding: the recommended DDL applies,
   contentless-delete works, and a search runs end to end inside `workerd`.
6. README per the package documentation guide, carrying the storage guidance and the export
   procedure.

### Phase 2: The reader's `LIKE` search (first consumer)

**Priority:** High
**Estimated Effort:** 3 hours

1. Declare `itemSearch = defineSearch({ table: feedItems, columns: [title, summary, author] })`,
   with no `fts`.
2. `readingQueue`'s search path builds `itemSearch.query(db, parsed)` and adds the step floor,
   read state, feed and folder as `where` calls; the floor cursor minted from the step stays in
   the app, since it is the app's rule about where a step ends.
3. Delete `SearchQuery`, `searchStatement`, `likePattern` and the search use of `seekSql`. The
   tag list's `TaggedQuery` matches through `itemSearch.predicate(parsed, { alias: "i" })`,
   the same `LIKE` fragment as a `sql` value, and keeps its own seek for the join table.
4. ADR-016's test table is the acceptance suite, including test 4 (the plan uses the timeline
   indexes and sorts nothing). Cursor column names do not change, so outstanding cursors keep
   working.
5. Behaviour change, recorded in the commit body: a multi-word query matches posts holding every
   word, where it used to match only the exact string; quoting restores the old meaning.

### Phase 3: The blog's FTS5 search and search page

**Priority:** Medium
**Estimated Effort:** 5 hours

1. Migration `0006_PostSearch.sql`: a `post_search` document table keyed by `INTEGER PRIMARY KEY`
   with `post_id`, `kind`, `slug`, `title`, `tags`, `excerpt` and `published_at`; the FTS table
   and triggers from the guidance. The `Post` repository keeps `post_search` current with one
   upsert per post write (`ON CONFLICT ("post_id") DO UPDATE`), a single D1 statement.
2. `PostSearch.query` keeps its signature and returns `Pagination` pages from `postSearch`;
   the MCP `search_posts` tool keeps its output shape.
3. A `/search` route with offset paging, highlighted titles and excerpts, and `q` in the `Link`
   headers.
4. Build, migrate, deploy, then run `reindex` once from a job; the corpus fits one batch.

### Phase 4: The reader's FTS5 index (conditional)

**Priority:** Low

Only when ADR-016's `user.search` measurements call for it: the reader adds an integer search
key and the guidance DDL to its own migrations, adds `fts` to `itemSearch`, and reindexes each
object from alarms in batches. That decision is the reader's, recorded in its own ADR.

## Alternatives Considered

### 1. Package-owned schema and migrations

The package would export generators for the FTS table and its triggers (`searchIndexSql(def)`
returning `up`/`down` SQL), or ship its own tables and a migration the app applies.

**Rejected because**: storage belongs to the app. Each app already owns a migration chain with
its own runner, naming and journal (D1 migrations, `?raw`-inlined Durable Object migrations),
and decides whether an index is worth its rows written at all — the reader's ADR-016 is that
decision. Generated SQL is also a second source of truth beside the committed file: the
migration replay reads files, so a generator needs a test pinning its output to them, and a
generator change rewrites history that migrations must never rewrite. Guidance an app copies
keeps the SQL reviewable where it runs.

### 2. FTS5 through the typed builder

Declaring the FTS table as a `table()` with `rowid`, a hidden column named after the table, and
`rank`, then `db.query(fts).join(source, …).where(eq("fts.fts", match))`. This was run and
returns correct matches when the FTS table drives.

**Rejected because**: it works only by accident of how the adapters spell identifiers. Joining
from the source table silently returns nothing, a top-level `eq` on `rank` is read as a ranking
override, per-query `bm25()` weights cannot be expressed, and `LIKE … ESCAPE` cannot be either.

### 3. A two-step search: keys first, rows through the builder

Run the `MATCH` for `(key, rank)` only, then load rows with `db.query(table).where(inList(key, keys))`,
reusing the adapters' row decoding.

**Rejected because**: caller filters still need the join in the first statement, every page
costs two statements, and `Pagination` reads `limit + 1` rows, so a 100-row page binds 101 keys
and breaks the 100-parameter limit without chunking.

### 4. External-content FTS5 tables

The canonical SQLite pattern: `content='posts', content_rowid='id'`, with `'delete'` triggers
passing old values and `'rebuild'` for recovery. It keeps `highlight()` and `snippet()` working.

**Rejected as the recommendation because**: a `'delete'` for a row the index never held
corrupts it, so a batched backfill racing a trigger is unsafe, and `'rebuild'` is one statement
over the whole table, which D1's 30-second limit and a Durable Object's single thread both
punish. The package's queries still work over an external-content index, since they read only
`rowid` and `bm25()`; only `reindex` does not.

### 5. Ranking in memory, in the package

Moving `apps/sdxc`'s `rankDocuments`, or the blog's buckets, into the package as a third
strategy for small corpora.

**Rejected because**: it is a second ranking model beside `bm25()` with different semantics,
which is the duplicate abstraction this package exists to avoid. The documentation site's corpus
is a static file shipped to the browser, never a table, and its scores encode knowledge of that
site — package names lose their `@sdxc/` scope to rank. It stays in the app. The blog's
in-memory buckets are replaced by weights. `./query` stays importable in the browser, so the
palette can adopt `highlight` without adopting the rest.

### 6. Keyset relevance cursors pinned to an index generation

A counter bumped by the triggers would ride in the cursor, refusing or restarting when it moved.

**Rejected because**: `Pagination`'s cursor has no slot for it, the counter is one more write
per indexed write, and the remedy — start over — is worse than a boundary row repeating.

### 7. FTS5's `snippet()` and `highlight()`

**Rejected because**: they return the text with marker strings spliced in, need an index that
can read its content, and cover only the FTS strategy. Segments from the source row cover both,
and render without building HTML from strings.

## References

- [Cloudflare D1: SQL statements, supported extensions](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
- [Cloudflare D1: Import and export data, virtual tables](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Cloudflare D1: Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Durable Objects: SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [Durable Objects: Limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [SQLite FTS5 extension](https://www.sqlite.org/fts5.html)
- [ADR-029: Pagination Package](./ADR-029-pagination-package.md)
- [ADR-057: Request Context Instead of a Service Container](./ADR-057-request-context-instead-of-a-service-container.md)
- [ADR-106: Backoff Package](./ADR-106-backoff-package.md)
- [Blog ADR-003: MCP Server for the Blog](./blog/ADR-003-mcp-server-for-the-blog.md)
- [Reader ADR-016: Search](./reader/ADR-016-search.md)

## Current Progress

- [x] Phase 1: The package
- [x] Phase 2: The reader's `LIKE` search (deploy pending)
- [x] Phase 3: The blog's FTS5 search and search page (deployed 2026-10-07)
- [ ] Phase 4: The reader's FTS5 index (conditional)

## Notes

- `remix/data-table`'s `Predicate` has no raw variant and its `like` emits no `ESCAPE`, which is
  why both strategies are raw statements; checked against `@remix-run/data-table` 1.0.0.
- The adapters read rows back from a statement opening with `WITH`, which the FTS statement
  relies on; a statement opening any other way with a CTE would come back as a write.
- D1 has blocked `sqlite_version()`, so its SQLite version is not observable from a query;
  contentless-delete support was established on 2026-10-07 against a throwaway production D1
  database: the blog's migrations 0000–0006 applied, and with the recommended schema an
  upsert, an update and a delete each left exactly the current text indexed, `NOT`, prefix
  and diacritic-folding matches answered correctly, `bm25()` ranked in both the CTE and the
  correlated-subquery form, and `integrity-check` passed.
- `SearchQuery` ships as an interface; the class behind it stays internal, so consumers
  compose it only through `search.query()`.
- The FTS statement joins with `cross join`, which fixes the CTE as SQLite's outer loop
  whatever the planner estimates.
- Over a plain index on the ordering columns, a floor beside the pager's `or`-shaped seek leads
  SQLite to merge two index searches and sort their rows once parameters are bound; the reader
  adds the cursor's own moment as a plain bound beside the seek, and its search tests read the
  plan off the statement each page actually runs.
- The D1 mock's script splitter now keeps a `CREATE TRIGGER` body in one statement, so the
  recommended triggers apply through `@sdxc/cloudflare-mocks` the way D1 applies them.
- The recommended triggers delete a `rowid` before inserting it: `INSERT OR REPLACE` inside a
  trigger inherits the firing statement's conflict policy, which an upsert on the source sets.
- The blog's `post_search` holds only the searchable text (title, tags, content) and the post
  id; kind and publish state are read from `posts` at query time (blog ADR-004).
- The verification in Context ran on SQLite 3.53 via `node:sqlite`, the same engine the
  migration replay and `@sdxc/cloudflare-mocks` use, and through `@sdxc/data-table-d1` over the
  mock D1; the reader's existing `user-do-search.workers.test.ts` covers FTS5 inside a Durable
  Object.
