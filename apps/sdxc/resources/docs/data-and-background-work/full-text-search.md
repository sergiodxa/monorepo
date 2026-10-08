---
title: Full-text search over SQLite
description: Keep an FTS5 index beside the tables you already have, parse what a reader types without a syntax error, rank title matches above body matches, highlight them, and page the results.
section:
    title: Data & background work
    order: 6
order: 21
lastUpdated: 2026-10-08
---

A help center needs a search box long before it needs a search service. SQLite ships FTS5, a
full-text index with ranking, and D1 and Durable Objects both carry it. The part between the box
and the index is the app's to write: reading what a person typed so a stray quote stays a
character, deciding that a title match beats a body match, and showing where each result
matched.

This guide adds search to a help center's articles. [`@sdxc/search`](/api/search) parses the
query, builds the FTS5 statement, ranks it with per-column weights, highlights matches and
rebuilds the index in batches. [`@sdxc/pagination`](/api/pagination) pages the results,
[`@sdxc/jobs`](/api/jobs) runs the rebuild, and [`@sdxc/result`](/api/result) carries every
failure.

```bash
npm add @sdxc/search @sdxc/pagination @sdxc/jobs @sdxc/result @sdxc/http remix
```

## Keep a search table beside the content

FTS5 indexes rows by an integer `rowid`, and it wants every searched column on one row. The
articles here are keyed by a text id, so the searchable text lives in a table of its own: one
row per article, an `INTEGER PRIMARY KEY` the index mirrors, and the article's id as a unique
column. The columns a search filters by, the article's section and publish date, ride along on
the same row, so a query reads one table.

The migration creates that table, the index over it, and the triggers that keep the index in
step with every write:

```sql {% title="database/migrations/0007_article_search.sql" %}
CREATE TABLE "article_search" (
	"id" INTEGER PRIMARY KEY,
	"article_id" TEXT NOT NULL UNIQUE
		REFERENCES "articles" ("id") ON DELETE CASCADE,
	"slug" TEXT NOT NULL,
	"section" TEXT NOT NULL,
	"published_at" INTEGER,
	"title" TEXT NOT NULL,
	"tags" TEXT NOT NULL DEFAULT '',
	"body" TEXT NOT NULL DEFAULT ''
);

CREATE VIRTUAL TABLE "article_search_fts" USING fts5(
	"title", "tags", "body",
	content='', contentless_delete=1,
	tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER "article_search_fts_insert" AFTER INSERT ON "article_search" BEGIN
	DELETE FROM "article_search_fts" WHERE "rowid" = new."id";
	INSERT INTO "article_search_fts" ("rowid", "title", "tags", "body")
	VALUES (new."id", new."title", new."tags", new."body");
END;

CREATE TRIGGER "article_search_fts_update"
AFTER UPDATE OF "title", "tags", "body" ON "article_search" BEGIN
	DELETE FROM "article_search_fts" WHERE "rowid" = old."id";
	INSERT INTO "article_search_fts" ("rowid", "title", "tags", "body")
	VALUES (new."id", new."title", new."tags", new."body");
END;

CREATE TRIGGER "article_search_fts_delete" AFTER DELETE ON "article_search" BEGIN
	DELETE FROM "article_search_fts" WHERE "rowid" = old."id";
END;

INSERT INTO "article_search"
	("article_id", "slug", "section", "published_at", "title", "tags", "body")
SELECT "id", "slug", "section", "published_at", "title", "tags", "body"
FROM "articles";
```

`content=''` makes the index contentless: it holds the inverted index and nothing else, since
the text is already in `article_search`. `contentless_delete=1` lets a contentless index delete
a row, and needs SQLite 3.43, which D1 and Durable Objects run. `remove_diacritics 2` makes
`resume` find `résumé`.

Each trigger deletes the `rowid` before inserting it. A trigger runs under the conflict policy
of the statement that fired it, so under the upsert in the next section a plain insert would
keep the old words indexed beside the new ones. The last statement backfills the articles that
already exist, and the insert trigger indexes each row it writes.

Store `body` as the text a reader reads. If articles are written in Markdown, write the
plain-text rendering into `article_search`, so `**` and link URLs never match a query or show up
in an excerpt.

## Describe the search

The table is declared for `remix/data-table` like any other:

```typescript {% title="database/schema/article-search.ts" %}
import { column as c, table } from "remix/data-table";

export const articleSearch = table({
	name: "article_search",
	columns: {
		id: c.integer().primaryKey(),
		article_id: c.text(),
		slug: c.text(),
		section: c.text(),
		published_at: c.integer().nullable(),
		title: c.text(),
		tags: c.text(),
		body: c.text(),
	},
});
```

`defineSearch` describes which of its columns are searched, how much a match in each counts,
and which FTS5 table indexes them. It holds no connection, so one definition at module scope
serves every request and every tenant's database:

```typescript {% title="app/search/articles.ts" %}
import { defineSearch, parseQuery } from "@sdxc/search";

import { articleSearch } from "~/database/schema/article-search";

export const ARTICLE_SEARCH = defineSearch({
	table: articleSearch,
	columns: [
		{ name: "title", weight: 10, field: "title" },
		{ name: "tags", weight: 6 },
		{ name: "body", weight: 1 },
	],
	fts: { table: "article_search_fts" },
});

export function parseArticleQuery(text: string) {
	return parseQuery(text, {
		fields: ARTICLE_SEARCH.fields,
		filters: ["section"],
	});
}
```

List `columns` in the order the FTS5 table declares them, because the weights are handed to
`bm25()` by position. With these weights a word in the title counts ten times a word in the
body, so an article titled "Reset your password" outranks one that mentions passwords in passing,
while a body that is about nothing else can still beat a passing title. `field: "title"` lets a
reader write `title:invoice` to search the title alone.

The key defaults to the table's primary key, `id`, which is the integer the index's `rowid`
mirrors. A description that can never work throws a `RangeError` when the module loads: an
empty `columns`, a weight of zero, a column the table lacks, or a non-integer key with `fts`.

## Keep the table current

An article's write action writes its search row too, in one upsert, so the row is created the
first time and replaced after:

```typescript {% title="app/search/articles.ts" %}
import type { Database } from "remix/data-table";

import { sql } from "remix/data-table";

export interface SearchableArticle {
	id: string;
	slug: string;
	section: string;
	publishedAt: number | null;
	title: string;
	tags: string[];
	body: string;
}

export async function indexArticle(db: Database, article: SearchableArticle) {
	await db.exec(sql`
		insert into "article_search"
			("article_id", "slug", "section", "published_at", "title", "tags", "body")
		values (${article.id}, ${article.slug}, ${article.section},
			${article.publishedAt}, ${article.title}, ${article.tags.join(" ")},
			${article.body})
		on conflict ("article_id") do update set
			"slug" = excluded."slug",
			"section" = excluded."section",
			"published_at" = excluded."published_at",
			"title" = excluded."title",
			"tags" = excluded."tags",
			"body" = excluded."body"
	`);
}
```

The triggers follow every write to `article_search`, so nothing else touches the index.
Deleting an article takes its search row with it through `ON DELETE CASCADE`, and the delete
trigger takes it out of the index. Drafts are indexed too: whether a row is published is checked
when the search runs, so publishing an article later needs no second write.

## Rebuild the index in batches

The triggers keep the index correct from the migration on. Rebuild it when what it holds
changes shape: a new tokenizer, a column added to the index, or after a D1 export, which D1
refuses while a virtual table exists. For an export, drop the three triggers and the index,
export, recreate both, and rebuild.

`reindex` writes the next `limit` rows with a key above `after`, and answers how many it wrote
and where the next batch starts. Each batch is a short statement, which is what a D1 request
budget wants, and a batch that fails or runs twice leaves the index correct. A job that writes
one batch and enqueues the next walks a table of any size:

```typescript {% title="app/jobs/index.ts" %}
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	reindexArticleSearch: job({
		input: s.object({ after: s.nullable(s.number()) }),
	}),
});
```

```typescript {% title="app/jobs/reindex-article-search.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/jobs/dispatcher";
import { ARTICLE_SEARCH } from "~/app/search/articles";

export default createJobHandler(jobs.reindexArticleSearch, async (ctx) => {
	let progress = await ARTICLE_SEARCH.reindex(ctx.database, {
		after: ctx.input.after,
		limit: 500,
	});
	if (isFailure(progress)) {
		return ctx.retry({ delay: "1 minute", cause: progress.error });
	}

	ctx.log.set({ search: { indexed: progress.data.indexed } });
	if (progress.data.next === null) return;
	await dispatcher.enqueue(jobs.reindexArticleSearch, {
		after: progress.data.next,
	});
});
```

Enqueue it with `{ after: null }` to start from the first row. Articles written while it runs
stay current through the triggers, whichever side of the batch they fall on.
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) covers the dispatcher
and the `ctx.database` middleware.

## Parse what the reader typed

`parseArticleQuery` reads the box the way people expect a search box to read. Every word must
match and matches as a prefix, so `pass` finds "password". `"exact phrase"` matches the phrase,
`-word` leaves out results holding it, `refund OR chargeback` accepts either, `title:invoice`
searches one field and `section:billing` is a filter. Operators count only in capitals.

Nothing a person types is a syntax error. An unmatched quote, `c++`, `it's` or `a:b` with no
declared `a` all read as ordinary words, and characters FTS5 would treat as syntax never reach
it. What the parse answers is one of three things:

- `success(null)` for a blank box, which is no search at all.
- `success(query)` with the `clauses` to match and the `filters` to apply.
- `failure(ValidationError)` for a query that cannot run: past 256 characters, more than 8 terms,
  or nothing left to find once exclusions are set aside, as with `-legacy` alone.

The error carries one issue, at the path `q`, with a message written for the reader, such as "A
search holds at most 8 terms." Show it beside the box, with the text kept in it to edit, so the
reader learns what to change. The limits are options: `maxLength` and
`maxTerms` raise or lower them, and `prefix: "last"` makes only the final word a prefix, the
reading for a box that searches as the reader types.

## Search, filter and page

`ARTICLE_SEARCH.query` answers a query that orders by relevance, best first, and composes like
any `remix/data-table` query. The filters the parse read out are yours to apply, because only
the app knows what `section:billing` means:

```typescript {% title="app/search/articles.ts" %}
import type { ParsedQuery } from "@sdxc/search";

import { inList, notInList } from "remix/data-table";

export function matchingArticles(db: Database, query: ParsedQuery) {
	let found = ARTICLE_SEARCH.query(db, query).where(
		sql`"published_at" <= ${Date.now()}`,
	);

	for (let filter of query.filters) {
		found = found.where(
			filter.exclude
				? notInList("section", filter.values)
				: inList("section", filter.values),
		);
	}

	let hasTerms = query.clauses.some((clause) => !clause.exclude);
	return hasTerms ? found : found.orderBy("published_at", "desc");
}
```

`published_at <= now` leaves out drafts, whose date is `null`, and articles scheduled for later.
A query of filters alone, `section:billing`, matches every published article in the section with
nothing to rank by, so it lists the newest first.

Each row comes back with every column of `article_search` plus `rank`. With FTS5, `rank` is the
weighted `bm25()` score, where lower is better. A search result list is one a reader pages by
number and expects a total for, so page it by offset:

```tsx {% title="app/http/controllers/search.tsx" %}
import { redirect } from "@sdxc/http/response";
import { internalServerError } from "@sdxc/http/response/html";
import { createPaging, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { toHit } from "~/app/search/hits";
import { matchingArticles, parseArticleQuery } from "~/app/search/articles";
import { SearchPage } from "~/resources/views/search";
import routes from "~/routes/web";

const PAGING = createPaging({ perPage: 10, maxPerPage: 50 });

export default createAction(routes.search, async (ctx) => {
	let text = ctx.url.searchParams.get("q") ?? "";
	let parsed = parseArticleQuery(text);
	if (isFailure(parsed)) {
		let message = parsed.error.issues[0]?.message ?? "This search cannot run.";
		let page = <SearchPage state="invalid" query={text} message={message} />;
		return ctx.render(page, { status: 400 });
	}
	if (parsed.data === null) return ctx.render(<SearchPage state="blank" />);

	let params = PAGING.parse(ctx.url.searchParams);
	if (isFailure(params)) {
		let first = new URLSearchParams({ q: text });
		return redirect(`${routes.search.href()}?${first}`);
	}

	let query = parsed.data;
	let page = await Pagination.byOffset(
		matchingArticles(ctx.db, query),
		params.data,
	);
	if (isFailure(page)) {
		ctx.log.fail(page.error);
		return internalServerError("Search is unavailable right now.");
	}

	let headers = PAGING.paginate(new Headers(), page.data, { url: ctx.url });
	let hits = page.data.items.map((row) => toHit(row, query));
	return ctx.render(
		<SearchPage
			state="results"
			query={text}
			hits={hits}
			pagination={page.data.pagination}
			url={ctx.url}
		/>,
		{ headers },
	);
});
```

A page past the end renders the last page, as `Pagination` clamps it, and a malformed `?page=`
starts the query over from its first page. A statement the database refuses reaches
`Pagination` as a `SearchError`, and `byOffset` answers it as a failure holding a
`QueryFailedError`, which the log records before the page answers 500.
[Paginate lists](/docs/http-apis/paginate-lists) covers the parameters and the `Link` headers
`paginate` writes.

Offset paging suits relevance order, which is how a reader expects results. When search only
narrows a list that has its own order, such as the newest articles in one section, page it by
keyset over that order with `Pagination.byKeyset` instead: a stable order pages exactly, while
relevance shifts each time the index changes between two pages.

## Highlight what matched

`highlight` splits a text into `{ text, match }` segments that concatenate back to the text, and
`excerpt` picks a window of words around the first match. Both compare the way the index
does, ignoring case and diacritics, and both keep the text exactly as written:

```typescript {% title="app/search/hits.ts" %}
import type { SearchRow } from "@sdxc/search";
import type { Excerpt, HighlightSegment, ParsedQuery } from "@sdxc/search/query";

import { excerpt, highlight } from "@sdxc/search/query";

import type { articleSearch } from "~/database/schema/article-search";

export interface SearchHit {
	href: string;
	title: HighlightSegment[];
	excerpt: Excerpt;
}

export function toHit(
	row: SearchRow<typeof articleSearch>,
	query: ParsedQuery,
): SearchHit {
	return {
		href: `/help/${row.slug}`,
		title: highlight(row.title, query, { field: "title" }),
		excerpt: excerpt(row.body, query, { words: 28 }),
	};
}
```

`field: "title"` tells `highlight` which declared field the text is, so `title:invoice` marks
"invoice" in titles and nowhere else, while unscoped words mark in every text. Excluded words
never highlight. An excerpt of a body with no match, such as an article that matched on a tag,
is its opening words, and `truncatedStart` and `truncatedEnd` say whether to draw an ellipsis on
either side.

Segments are data, so the view renders each match as a `<mark>` element with no HTML built from
strings. [Build a search dialog](/docs/building-remix-apps/search-dialog) draws them with
`@sdxc/ui`'s `Highlight`. `@sdxc/search/query` holds only the parser and the highlighters, so a
browser bundle can parse and highlight with the same functions the server searched with.

## Search without FTS5

Leave out `fts` and the same definition runs every query as `LIKE` over the columns. The table
you already have is all it reads, so this search ships without a migration:

```typescript {% title="app/search/faq.ts" %}
import { defineSearch } from "@sdxc/search";

import { faqs } from "~/database/schema/faqs";

export const FAQ_SEARCH = defineSearch({
	table: faqs,
	columns: [
		{ name: "question", weight: 3 },
		{ name: "answer", weight: 1 },
	],
});
```

`LIKE` matches anywhere inside a word, so `voice` finds "invoice". `rank` is then the negated
weighted count of the columns each term hit, still lower-is-better, so the rest of this guide
reads the same. `LIKE` reads every row, which suits a table of hundreds of rows, not hundreds of
thousands. Highlight its results with `{ mode: "substring" }`, so the marks agree with what
matched.

FTS5's `trigram` tokenizer is the middle ground: an index that matches substrings. Declare the
virtual table with `tokenize='trigram'` and the definition with
`fts: { table: "faqs_fts", tokenizer: "trigram" }`. A trigram index needs three characters to
look anything up, so a query holding a shorter term runs as `LIKE` on its own.

`LIKE` binds two values per term per column, and SQLite on D1 and Durable Objects binds at most
100 per statement. A query over that limit is refused before it runs with a
`ParameterBudgetError`, a `SearchError`. With the default 8 terms, a `LIKE` search stays under it
up to 6 columns.

## Where to go next

- [Build a search dialog](/docs/building-remix-apps/search-dialog): the search box in every
  page's header, its live results, and the results page.
- [Paginate lists](/docs/http-apis/paginate-lists): offset and keyset paging, the page
  parameters, and the numbered pager.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron): the dispatcher
  the rebuild runs on.
- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases): the
  adapters a search runs on.
- [`@sdxc/search`](/api/search): the full query syntax, every option and error.
