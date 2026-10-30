---
title: Full-text search over SQLite
description: Keep an FTS5 index beside the tables you already have, parse what a reader types without a syntax error, rank title matches above body matches, highlight them, and page the results.
section:
    title: Data & background work
    order: 7
order: 18
lastUpdated: 2026-10-25
outcomes:
    - "How to keep an FTS5 index beside your tables with `@sdxc/search`"
    - "How to parse what a reader typed, rank title matches first, highlight and page results"
    - "How to rebuild the index in batches from a background job"
---

A help center needs a search box long before it needs a search service. SQLite ships FTS5, a
full-text index with ranking, and D1 and Durable Objects both carry it. This guide adds search
to a help center's articles: [`@sdxc/search`](/api/search) parses the query, ranks title matches
above body matches, highlights them and rebuilds the index in batches,
[`@sdxc/pagination`](/api/pagination) pages the results, and [`@sdxc/jobs`](/api/jobs) runs the
rebuild.

```bash
npm add @sdxc/http @sdxc/jobs @sdxc/pagination @sdxc/result @sdxc/search remix
```

## Keep a search table beside the content

FTS5 indexes rows by an integer `rowid`, so the searchable text lives in a table of its own: one
row per article, an `INTEGER PRIMARY KEY` the index mirrors, and the columns a search filters by.
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

`content=''` makes the index contentless, since the text is already in `article_search`, and
`remove_diacritics 2` makes `resume` find `résumé`. Each trigger deletes the `rowid` before
inserting it, so an upsert never leaves the old words indexed beside the new ones. The last
statement backfills the articles that already exist.

Store `body` as plain text: if articles are written in Markdown, write the rendered text, so
`**` and link URLs never match a query.

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

`defineSearch` describes which columns are searched, how much a match in each counts, and which
FTS5 table indexes them. It holds no connection, so one definition serves every database:

```typescript {% title="app/models/search/articles.ts" %}
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

> [!WARNING]
> List `columns` in the order the FTS5 table declares them, because the weights are handed to
> `bm25()` by position: a different order weighs each column by another column's weight.

A word in the title counts ten times a word in the body, and `field: "title"` lets a reader
write `title:invoice` to search the title alone.

## Keep the table current

An article's write action writes its search row too, in one upsert:

```typescript {% title="app/models/search/articles.ts" %}
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

The triggers follow every write, and deleting an article removes its row through
`ON DELETE CASCADE`. Drafts are indexed too; the search checks the publish date when it runs.

## Rebuild the index in batches

The triggers keep the index correct from the migration on. Rebuild it when what it holds
changes shape: a new tokenizer, a column added to the index, or after a D1 export.

> [!WARNING]
> D1 refuses to export a database while a virtual table exists. For an export, drop the three
> triggers and the index, export, recreate both, and rebuild.

`reindex` writes the next `limit` rows with a key above `after` and answers where the next batch
starts. A batch that fails or runs twice leaves the index correct, so a job that writes one batch
and enqueues the next walks a table of any size:

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

import { dispatcher } from "~/app/initializers/dispatcher";
import jobs from "~/app/jobs";
import { ARTICLE_SEARCH } from "~/app/models/search/articles";

export default createJobHandler(jobs.reindexArticleSearch, async (ctx) => {
	let progress = await ARTICLE_SEARCH.reindex(ctx.db, {
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

Enqueue it with `{ after: null }` to start from the first row.
[Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) covers the dispatcher
and the `ctx.db` middleware.

## Parse what the reader typed

`parseArticleQuery` reads the box the way people expect. Every word must match as a prefix, so
`pass` finds "password"; `"exact phrase"`, `-word`, `refund OR chargeback`, `title:invoice` and
the `section:billing` filter work as written. Nothing a person types is a syntax error: an
unmatched quote or `c++` reads as ordinary words. The parse answers one of three things:

- `success(null)` for a blank box, which is no search at all.
- `success(query)` with the `clauses` to match and the `filters` to apply.
- `failure(ValidationError)` for a query that cannot run, such as one past 8 terms, with a
  message written for the reader to show beside the box.

## Search, filter and page

`ARTICLE_SEARCH.query` orders by relevance, best first, and composes like any
`remix/data-table` query. The filters the parse read out are yours to apply:

```typescript {% title="app/models/search/articles.ts" %}
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

`published_at <= now` leaves out drafts and scheduled articles, and a query of filters alone
lists the newest first. Each row carries every column plus `rank`. Readers page search results by
number, so the controller pages by offset:

```tsx {% title="app/http/controllers/search.tsx" %}
import { redirect } from "@sdxc/http/response";
import { internalServerError } from "@sdxc/http/response/html";
import { createPaging, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { matchingArticles, parseArticleQuery } from "~/app/models/search/articles";
import { toHit } from "~/app/services/search/hits";
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

A malformed `?page=` starts the query over from its first page.
[Paginate lists](/docs/http-apis/paginate-lists) covers the parameters and the `Link` headers
`paginate` writes.

## Highlight what matched

`highlight` splits a text into `{ text, match }` segments that concatenate back to the text, and
`excerpt` picks a window of words around the first match, both ignoring case and diacritics the
way the index does:

```typescript {% title="app/services/search/hits.ts" %}
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

`field: "title"` marks `title:invoice` in titles only. The view renders each match segment as a
`<mark>`; [Build a search dialog](/docs/building-remix-apps/search-dialog) draws them with
`@sdxc/ui`'s `Highlight`.

## Test the ranking

The in-memory SQLite your tests already migrate carries FTS5, so a test writes two articles
through `indexArticle` and checks the order a reader sees:

```typescript {% title="app/models/search/articles.test.ts" %}
import { unwrap } from "@sdxc/result";
import { beforeAll, expect, test } from "vitest";

import { openDatabase } from "~/app/initializers/database";
import {
	indexArticle,
	matchingArticles,
	parseArticleQuery,
} from "~/app/models/search/articles";
import { factories, migrate } from "~/app/test/database";
import { ArticleFactory } from "~/database/factories/article";

beforeAll(migrate);

test("ranks a title match above a passing mention", async () => {
	let db = openDatabase();
	let entries = [
		{
			slug: "settings",
			title: "Account settings",
			body: "Change your password here.",
		},
		{
			slug: "reset",
			title: "Reset your password",
			body: "Follow the link we send.",
		},
	];
	for (let { slug, title, body } of entries) {
		let article = await factories().create(ArticleFactory, { slug, title });
		await indexArticle(db, {
			id: article.id,
			slug,
			section: "account",
			publishedAt: Date.now() - 60_000,
			title,
			tags: [],
			body,
		});
	}

	let query = unwrap(parseArticleQuery("passw"));
	let rows = query === null ? [] : await matchingArticles(db, query).all();

	expect(rows.map((row) => row.slug)).toEqual(["reset", "settings"]);
});

test("reads a stray quote as part of a word", () => {
	expect(unwrap(parseArticleQuery('"refund'))).not.toBeNull();
});
```

To check the page itself, request `routes.search` with `?q=` through
`createWebRouter().fetch(...)`, as [Test Workers apps](/docs/operations-and-testing/testing)
shows.

## Where to go next

- [Build a search dialog](/docs/building-remix-apps/search-dialog) — the search box in every
  page's header, its live results, and the results page.
- [Paginate lists](/docs/http-apis/paginate-lists) — offset and keyset paging, the page
  parameters, and the numbered pager.
- [`@sdxc/search`](/api/search) — the full query syntax, every option and error.
