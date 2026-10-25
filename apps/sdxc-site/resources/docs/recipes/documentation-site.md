---
title: Build a documentation site with search
description: Write pages in markdown, index their text for full-text search, open a search dialog from every page, and add reference pages from your JSDoc.
section:
    title: Recipes
    order: 1.7
order: 17
lastUpdated: 2026-10-25
outcomes:
    - "What guides build a searchable documentation site, and in what order to follow them"
    - "How to index markdown pages that live in files rather than rows"
    - "When to rebuild the search index"
---

By the end of this recipe your documentation is a folder of markdown files rendered as pages,
every page's text sits in a full-text index, and a search dialog in the header finds them as
the reader types. Reference pages for your library's public API come from its JSDoc.

```bash
npm add @sdxc/markdown @sdxc/result remix
```

## Publish pages from markdown

Pages come first, since the index reads them. Follow
[A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline), with the glob in
`posts.ts` pointing at the folder your pages live in.

## Index the pages for search

Follow [Full-text search over SQLite](/docs/data-and-background-work/full-text-search). Your
pages live in files, so drop the `REFERENCES "articles"` clause and the backfill from its
migration, and index every page from its prepared document instead:

```typescript {% title="app/services/content/index-pages.ts" %}
import type { Database } from "remix/data-table";

import { toPlainText } from "@sdxc/markdown/plain";
import { isFailure } from "@sdxc/result";

import { indexArticle } from "~/app/models/search/articles";
import { POSTS, readPost } from "~/app/services/content/posts";

export async function indexPages(db: Database) {
	for (let path of Object.keys(POSTS)) {
		let slug = path.slice(path.lastIndexOf("/") + 1, -".md".length);
		let page = await readPost(slug);
		if (page === null || isFailure(page)) continue;

		let { frontmatter, document } = page.data;
		await indexArticle(db, {
			id: slug,
			slug,
			section: "docs",
			publishedAt: frontmatter.publishedAt.getTime(),
			title: frontmatter.title,
			tags: frontmatter.tags,
			body: toPlainText(document),
		});
	}
}
```

`toPlainText` keeps the prose alone, so markup and link URLs never match a query. Pages change
only when you deploy, so run `indexPages` from a command after each deploy, as
[Add a command](/docs/operations-and-testing/your-apps-command-line#add-a-command) shows.

## Search from every page

Follow [Build a search dialog](/docs/building-remix-apps/search-dialog) for the header button,
the live results and the `/search` page, with `toHit`'s `href` pointing at your page route.

## Add reference pages

Generate a page per public symbol of your library with
[Generate reference docs from JSDoc](/docs/content-and-feeds/reference-docs).

## Test it

Test each stage as its guide does:
[Test the ranking](/docs/data-and-background-work/full-text-search#test-the-ranking) writes
articles through `indexArticle` and checks the order a reader sees, and
[Test the fragment](/docs/building-remix-apps/search-dialog#test-the-fragment) asks the router
for the dialog's results.

## Where to go next

- [Anchor, polish and lint markdown](/docs/content-and-feeds/markdown-plugins) — check every
  page's links and headings in CI.
- [SEO, sitemaps and robots.txt](/docs/building-remix-apps/seo-sitemaps-and-robots) — list every
  page for search engines.
- [Draw diagrams from text](/docs/content-and-feeds/diagrams) — Mermaid diagrams rendered on
  the server inside your pages.
