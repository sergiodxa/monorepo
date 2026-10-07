# ADR-004: Full-Text Search Over A Search-Only Projection

## Status

**Accepted** - 2026-10-06

## Background

[ADR-003](./ADR-003-mcp-server-for-the-blog.md) gave the MCP server a `search_posts` tool that
read every published post's metadata and matched a lowercased substring in memory, ranked in
three buckets (title, tag, excerpt). It said the signature was what would last and that FTS5
could replace the internals. [ADR-109](../ADR-109-search-package.md) added `@sdxc/search`, and
the blog adopts it here, adding a `/search` page beside the MCP tool.

The first plan copied a search document table holding the post's kind, slug, title, tags,
excerpt and publish time. The direction from the blog's owner was narrower: the table is a
materialized view of what is searchable in a post, and the source tables stay the source of
truth for everything else.

## Context

| Fact                                         | Consequence                                                           |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `post_meta` is a key/value table             | FTS5 needs the searched columns on one row, so a projection is needed |
| `posts.id` is text                           | FTS5's `rowid` needs an integer, which the projection supplies        |
| Publish state is time-based                  | A scheduled post must appear on its date with no write to trigger     |
| D1 has no interactive transactions           | A post write keeps the projection current in one statement            |
| `wrangler d1 export` refuses a virtual table | Exporting the database needs a drop, export, recreate, reindex cycle  |

## Decision

### `post_search` holds only searchable text

```text
post_search (id INTEGER PRIMARY KEY, post_id TEXT UNIQUE → posts.id ON DELETE CASCADE,
             title TEXT, tags TEXT, content TEXT)
post_search_fts USING fts5(title, tags, content, content='', contentless_delete=1,
                           tokenize='unicode61 remove_diacritics 2')
```

| Kind     | `title`                   | `tags`               | `content`                  |
| -------- | ------------------------- | -------------------- | -------------------------- |
| Article  | Title                     | `[]`                 | Markdown body              |
| Tutorial | Title                     | Tags as a JSON array | Markdown body              |
| Glossary | Term, then alias when set | `[]`                 | Definition                 |
| Bookmark | Title                     | `[]`                 | Address without its scheme |

A post with no title and no content, such as one whose metadata was never saved, is never
projected, and a result whose post has none of the metadata a result shows is skipped;
`0008_DropBlankSearchRows.sql` removed the rows the backfills had written for such posts.

Bookmarks (posts of type `like`) were added by `0007_BookmarkSearch.sql`, which backfills them.
A bookmark result links to the page it saved and shows its address as its description; its
kind is `bookmark` in results, in `kind:` and in the MCP tool's `kind` argument.

No kind, slug, excerpt or timestamp is copied. Three triggers keep `post_search_fts` in step
with `post_search`, each deleting a `rowid` before inserting it, since a trigger takes the
conflict policy of the upsert that fired it. `bm25()` weighs title 10, tags 6, content 1.

### The `Post` repository keeps it current

`Post.create` and `Post.update` call `PostSearch.index`, which reads the post through its own
type's repository and writes one `INSERT … ON CONFLICT ("post_id") DO UPDATE`. `Post.destroy`
(a tombstone) deletes the row. Every live article, tutorial and glossary entry is projected,
previews included; the `0006_PostSearch.sql` migration backfilled the existing ones with one
`INSERT … SELECT` over the latest value of each meta key.

### Publish state and kind are read from `posts` at query time

Each search adds an `exists` predicate on `posts`: the post is not deleted, its type is a
searched one (or the one a caller narrowed to), and `published_at` is `NULL` or no later than
now. `published_at` is read as epoch milliseconds the way `Post.isPublishedAt` reads it: a run
of digits is seconds, anything else a date SQLite parses, and text that does not parse is never
published. A scheduled post therefore appears on its date with no write, and nothing about
publish state can drift between two tables. A tag filter reads the projected tags.

### Results come from the source tables

A page of matches is read back from `posts` and `post_meta` in two batched queries, keeping
relevance order, and projected into the shape `search_posts` has always returned: kind,
title, slug, URL, excerpt, tags and publish date. Relevance replaces the three buckets: a title
hit still outranks a tag hit, which outranks a body hit, but a body dense with a term can now
beat a passing mention in a title.

### `/search`

A `GET` form submits `?q=`. Results page by offset through `@sdxc/pagination`, ten per page,
with `Link` and `X-Total-Count` headers carrying `q`. Titles and the post's summary (its excerpt,
or a glossary entry's definition) are highlighted with `highlight` and `excerpt` from
`@sdxc/search/query` and rendered as `<mark>` through JSX. A blank box renders the form alone; a
query with nothing to search for, or over 8 terms or 256 characters, answers 400 with the
reason beside the field. The MCP tool answers that case as a tool error naming the reason.

The box reads the syntax of [ADR-117](../ADR-117-search-query-syntax.md): `title:` scopes a word
to the title, and the filters `tag:`, `kind:` and `lang:` (with `locale:` and `language:`) become
conditions on the source tables. An article's language is its latest `locale` meta, and a post
without one is English; `es` matches `es-AR`. A search of filters alone has no relevance to rank,
so it lists newest first, read through a join on `posts`. A disclosure under the form explains
the syntax.

### Search from any page

Every public page carries a search dialog whose body is the `/frames/search` frame: the same
form, plus the top six matches for what is being typed, highlighted the same way and linking
to the full `/search` page. See [ADR-005](./ADR-005-search-dialog-and-client-islands.md).

## Consequences

### Positive

- A search reads only matching rows, with real relevance, and post bodies become searchable.
- The projection holds no state that could disagree with `posts`; previews and deletes are
  decided where they are stored.
- A glossary entry is found by its term or its alias.

### Negative

- Every post write costs one more read through the typed repository and one upsert.
- A page of results costs the search, a count, and two reads back from the source tables.
- Exporting the D1 database needs the procedure in the app README.
- The publish-date reading in SQL mirrors `Post.isPublishedAt` for the formats the app writes
  (ISO 8601, SQL datetimes, Unix seconds or milliseconds); a date only `Date.parse` accepts,
  such as RFC 2822, reads as unpublished in search.

### Neutral

- A result whose summary holds no match shows the body around its first match instead, read
  as plain text through `@sdxc/markdown/plain` so no Markdown syntax shows; one with no
  summary always shows its body. Glossary entries show their definition.
- Glossary results link to their anchor on `/glossary`; the MCP tool keeps returning
  `/glossary/:slug`.

## Alternatives Considered

### Copying publish time and kind into the projection

The first plan. It answers a search from one table, but duplicates state the CMS changes, and
needs either a stored instant compared at query time or a write when a scheduled date passes.

**Rejected because**: the projection would be a second source of truth for publish state.

### Projecting only published posts

Insert on publish, delete on unpublish.

**Rejected because**: a scheduled post becomes public by the clock, not by a write, so it would
need a cron to project it and would appear up to one cron interval late.

## References

- [ADR-003: MCP Server For The Blog](./ADR-003-mcp-server-for-the-blog.md)
- [ADR-109: Search Package](../ADR-109-search-package.md)
- [ADR-005: Search Dialog And Client Islands](./ADR-005-search-dialog-and-client-islands.md)
