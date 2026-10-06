# SQL expressions in `remix/data-table` queries

## Use case

Full-text search as a function that takes a query and returns a query:

```ts
let results = await search(db.query(articles).where({ status: "published" }), "remix routing")
	.limit(20)
	.all();
// each row is an article, plus a `rank` column, best match first
```

Because the result is still a query, it composes with everything else: more filters, relations,
`count()`, pagination.

With SQLite FTS5, `search` needs to add this to whatever query it receives:

```sql
select "articles".*,
       (select bm25("articles_fts") from "articles_fts"
         where "articles_fts" match ? and "rowid" = "articles"."id") as "rank"
  from "articles"
 where <the caller's filters>
   and "articles"."id" in (select "rowid" from "articles_fts" where "articles_fts" match ?)
 order by "rank" asc
```

PostgreSQL (`@@ websearch_to_tsquery(?)`, `ts_rank(...)`) and MySQL (`match … against`) have the
same shape: a match condition, a score column, and ordering by the score.

## What blocks it

Measured against `@remix-run/data-table@1.0.0`:

- `where()` only accepts predicates and `{ column: value }` objects, so the match condition
  can't be added. Passing a `sql` fragment is a type error.
- `select()` only selects columns, so the score can't be added as `rank`.
- `orderBy()` only orders by columns, so results can't be sorted by `rank`.

The only way to run that SQL today is `db.exec(sql…)`, which returns raw rows and is no longer a
query: no decoding, no relations, no `count()`, nothing to compose with.

## What we need

1. **`where()` accepts a `sql` fragment**, combined with the other conditions with `and`.

   ```ts
   query.where(
   	sql`"articles"."id" in (select "rowid" from "articles_fts" where "articles_fts" match ${terms})`,
   );
   ```

2. **A way to add a computed column while keeping the table's columns**, typed on the rows.

   ```ts
   query.addSelect({ rank: sql<number>`(select bm25("articles_fts") from ...)` });
   ```

3. **`orderBy()` accepts that column's alias.**

   ```ts
   query.orderBy("rank", "asc");
   ```

Names are suggestions. With these three, `search` is a few lines and its output is an ordinary
query.
