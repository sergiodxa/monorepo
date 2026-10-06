# SQL expressions in `remix/data-table` queries

Requirements for letting a query carry SQL its builder cannot spell: a raw predicate in
`where`, a computed column in `select`, and that column usable in `orderBy` and comparisons.
Each numbered item is a statement that should become a test.

Measured against `@remix-run/data-table@1.0.0` and `@remix-run/data-table-sqlite@1.0.0`.

## Goal

A function receives a query, adds what it needs, and returns a query, with the result
still a typed builder: relations load, rows decode, `count()` counts and anyone downstream can
keep chaining. The motivating function is full-text search:

```ts
let page = await search(db.query(articles).where({ status: "published" }), "remix routing")
	.limit(20)
	.all();
// each row: an article, plus `rank`
```

Today `search` cannot be written against a query, because nothing it needs to add has a slot
in the builder.

## Current state

`Query` keeps its state in private fields and accepts only column-shaped input:

| Method    | Accepts                                |
| --------- | -------------------------------------- |
| `where`   | `Predicate` or `{ column: value }`     |
| `having`  | `Predicate` or `{ column: value }`     |
| `select`  | column names, or `{ alias: column }`   |
| `orderBy` | a column and a direction               |
| `join`    | a table and a `Predicate` over columns |

`Predicate` is a closed union (`comparison`, `between`, `null`, `logical`) whose every leaf
names a column. `sql` and `rawSql` build a `SqlStatement`, but only `db.exec()` takes one, and a
raw statement comes back as undecoded rows with no builder around it.

Passing a `SqlStatement` to `where` is a type error, and with the error suppressed the object
shorthand reads it as columns and compiles it to `"text" = ? and "values" = ?`.

`like()` and `ilike()` emit no `ESCAPE` clause, so a pattern built from user input cannot
match a literal `%` or `_`: the caller has no way to escape them.

## What a search function needs to add

Each backend spells full-text search as SQL the builder has no shape for:

| Database   | Match                                                 | Score                                          |
| ---------- | ----------------------------------------------------- | ---------------------------------------------- |
| SQLite     | `"id" in (select rowid from fts where fts match ?)`   | `bm25(fts, 10.0, 1.0)` for the row             |
| PostgreSQL | `"document" @@ websearch_to_tsquery(?)`               | `ts_rank("document", websearch_to_tsquery(?))` |
| MySQL      | `match ("title", "body") against (? in boolean mode)` | the same expression, selected                  |

So a search function needs to add a predicate, add a computed column, and order by that
column. A substring search over user input needs `like … escape '\'`. The same three slots
serve distance sorting, `coalesce` defaults, JSON extraction, `nulls last` ordering and every
other expression an app reaches for.

For SQLite, the score as a correlated subquery returns exactly what the usual join form
returns, so it fits a computed column:

```sql
select "articles".*,
       (select bm25("articles_fts", 10.0, 1.0) from "articles_fts"
         where "articles_fts" match ? and "rowid" = "articles"."id") as "rank"
  from "articles"
 where "articles"."id" in (select "rowid" from "articles_fts" where "articles_fts" match ?)
 order by "rank" asc, "articles"."id" asc
```

## Requirements

### Raw predicates

1. **`where` accepts a `SqlStatement`.** ``query.where(sql`"published_at" <= ${now}`)`` adds the
   statement, parenthesized, joined to the other predicates with`and`.
2. **A raw predicate nests.** `and()` and `or()` accept a `SqlStatement` among their inputs, and
   it compiles parenthesized in place.
3. **`having` and `join … on` accept one too**, with the same rules.
4. **Values bind in the order of the final statement.** However `where`, `select` and
   `orderBy` calls interleave, each fragment's values land at its placeholders, and the
   dialect's placeholder rewriting (`?` to `$1`) applies to fragment placeholders as well.
5. **A raw predicate is distinguishable from the object shorthand.** A `SqlStatement` is never
   read as `{ text, values }` columns, at the type level or at runtime.

### Computed columns

6. **A query can add a computed column without dropping the table's columns.**
   ``query.addSelect({ rank: sql`…` })`` (name open) keeps every column the query already
   selects and appends`(<expression>) as "rank"`.
7. **A computed column carries a type.** ``expression<number>(sql`…`)``, or `sql` taking a type
   argument, types the alias on the returned rows:`row.rank`is a`number`.
8. **Table columns still decode.** Rows from a query with a computed column decode `json` and
   `boolean` columns exactly as rows without one; the computed column is returned as the
   driver reads it.
9. **`count()` and `exists()` ignore computed columns** and keep every predicate, raw ones
   included, so a paged query counts what it pages.

### Ordering and comparing by an expression

10. **`orderBy` accepts a computed column's alias** and compiles it to that alias, or to the
    expression where the dialect requires.
11. **`orderBy` accepts a `SqlStatement`** for an ordering with no alias, such as
    `` sql`"published_at" is null` ``.
12. **Comparison operators accept a computed column's alias.** `lt("rank", x)` compiles to the
    expression itself, since PostgreSQL rejects a select alias in `WHERE`. This is what lets a
    keyset paginator seek on `rank` with no knowledge of how it was computed.

### `LIKE` with an escape character

13. **`like()` and `ilike()` take an escape character.** `like("title", pattern, { escape: "\\" })`
    compiles to `"title" like ? escape '\'`.
14. **An escaping helper exists.** `escapeLike(text, "\\")` escapes the escape character first,
    then `%` and `_`, so ``like("title", `%${escapeLike(input, "\\")}%`, { escape: "\\" })``
    matches the input literally.

## The search function, once these exist

```ts
import { expression, sql } from "remix/data-table";

function search<query extends Query<typeof articles>>(query: query, input: string) {
	let match = toFts5Match(input); // every term double-quoted, so input is never FTS5 syntax

	return query
		.where(
			sql`"articles"."id" in (select "rowid" from "articles_fts" where "articles_fts" match ${match})`,
		)
		.addSelect({
			rank: expression<number>(
				sql`(select bm25("articles_fts", 10.0, 1.0) from "articles_fts" where "articles_fts" match ${match} and "rowid" = "articles"."id")`,
			),
		})
		.orderBy("rank", "asc")
		.orderBy("id", "asc");
}
```

The function stays dialect-specific, as full-text search is; what it gains is that its output is
an ordinary query, so a paginator, a relation loader or another filter composes with it.

## Out of scope

- Making raw SQL portable across dialects. A fragment is written for the database it runs on.
- Introspecting a query's state. Requirements 1–12 make reading it unnecessary for extension.
- Subqueries as builder values (`inList("id", db.query(...))`). Useful, and a separate proposal.

## Alternatives

- **`db.exec(sql…)` for the whole statement.** Works today, and loses the builder: no decoding,
  no relations, no `count()`, and the result cannot be handed to anything expecting a query.
- **A library-side builder that mimics `Query`.** Each library that needs one expression
  re-implements predicate compilation, placeholder rewriting and row decoding for every
  dialect, and its query is still not a `Query`.
- **A two-step search: ids first, then `inList`.** Two round trips per page, and a page of `n`
  ids binds `n` values, which runs into the 100-parameter limit of SQLite-based platforms such
  as Cloudflare D1.
