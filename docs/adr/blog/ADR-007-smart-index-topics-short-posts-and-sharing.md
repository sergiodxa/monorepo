# ADR-007: Smart Index — Topics, Short Posts, Weekly Releases and Sharing on X

## Status

**Accepted** - 2026-10-12

## Background

The blog's home page is a reverse-chronological Activity list of articles, tutorials, bookmarks
and glossary entries. New articles and tutorials are infrequent, so the page rarely changes and
a reader has little reason to come back. Distribution depends on readers finding the feeds, and
the feeds only split by content type. Shawn Wang's
[Smart Indexes](https://swyx.io/smart-indexes) frames the alternative: an index that mixes
content types, lets a reader narrow it by type and topic, and offers a subscription that follows
the same narrowing.

This ADR records how the blog adopts that idea within what it already has: saved-search topics
with their own feeds, two short post types (notes and TILs) that keep the index moving without
the cost of a full article, a weekly post summarizing open-source releases, a footer that makes
topics and subscriptions discoverable, and share-on-X links that put sharing one click away for
the author and for readers.

## Context

### Current State

| Concern     | Today                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Index       | `/` lists every public post newest first (`Feed.listActivity`), one linked line per post                                                                      |
| Kind pages  | `/articles`, `/tutorials`, `/bookmarks`, `/glossary`, each its own controller and view                                                                        |
| Feeds       | `/rss`, `/atom.xml`, `/feed.json` for everything; `/<kind>.rss`, `.atom`, `.json` per kind                                                                    |
| Search      | `/search` over FTS5 (`app/models/search.ts`), with `tag:`, `kind:` and `lang:` filters parsed by `@sdxc/search`                                               |
| Search sort | Relevance when the query has text; newest first when it holds only filters                                                                                    |
| Federation  | Articles and tutorials federate as ActivityPub `Article`; inbound `Create`/`Like`/`Announce` are stored as mentions                                           |
| Post kinds  | The list of kinds is repeated in `PostSearch.Kind`, `KIND_TYPES`, `KIND_PATHS`, `KIND_NAMES`, `ActivityRow.Kind`, `Feed.ActivityItem.kind` and `PUBLIC_TYPES` |
| Public post | `app/http/controllers/post.tsx` serves only `articles` and `tutorials`                                                                                        |
| Jobs        | `blog-jobs` queue; crons `*/15 * * * *`, `0 5 * * 1`, `0 6 * * 1`, `0 14 * * *`; `GITHUB_TOKEN` already configured                                            |
| Footer      | None                                                                                                                                                          |

### Issues Identified

| Issue                                          | Impact                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| Kind pages and kind feeds are bespoke per kind | A new kind means a new controller, view and three feed routes             |
| Feeds split only by kind                       | A reader interested in one subject subscribes to everything or nothing    |
| Kinds are listed in seven places               | Each new kind is a scattered edit, easy to leave incomplete               |
| Short thoughts have no home                    | They go to X only, where they are not searchable, federated or owned      |
| Open-source releases happen outside the blog   | The index never reflects the most frequent work the author ships          |
| `@sdxc` releases republish dependents          | Release notes list most packages every day, mostly "Republished because…" |
| Sharing a post on X is manual                  | Nothing prompts the author or a reader to share at the moment they could  |
| Posting to X through its API costs money       | Automatic cross-posting is out of reach                                   |

## Decision

### 1. Kind Registry

One module, `app/models/kinds.ts`, lists every post kind once: its `posts.type`, its search
names (`kind:` singular and plural), its permalink path, its index emoji and label, its ActivityPub
object type, and the slug of its topic. Search, the Activity list, feeds, federation and the
public post controller read the registry instead of their own lists. The registry gains
`note`, `til` and `release` beside the current four kinds.

### 2. Search Order

`@sdxc/search` parses an `order:` directive with three values:

| Value       | Meaning                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------- |
| `relevance` | Default. Current behavior: rank by relevance, newest first when there is no text to rank |
| `desc`      | Newest first                                                                             |
| `asc`       | Oldest first                                                                             |

The package parses the direction only; the blog maps `asc`/`desc` to the publish date
(`coalesce(published_at, created_at)`). This is a separate `@sdxc/search` commit ahead of the
blog's.

### 3. Topics

A topic is a saved search with a title and a description:

```sql
create table topics (
	id text primary key,
	slug text not null unique,
	title text not null,
	description text not null default '',
	query text not null unique,
	created_at text not null,
	updated_at text not null
);
```

- `query` is stored in the canonical form `@sdxc/search` produces, so `tag:Remix` and `tag:remix`
  are one topic and the unique index means what it says.
- `ctx.models.topics.findBy({ slug })` loads a topic; its page renders the title, the Markdown
  description and the results of running `query`, honoring `order:` and defaulting to newest
  first.
- Every topic page offers "Subscribe using RSS, Atom, or JSON Feed", linking to the topic's
  `.rss`, `.atom` and `.json`. A topic feed runs the same query and is always newest first,
  whatever `order:` says.
- The CMS manages topics, and `/search` shows "Save as topic" to the signed-in author, prefilling
  the query.

#### Routes

| Topic          | Page                                                                                | Feeds                                 |
| -------------- | ----------------------------------------------------------------------------------- | ------------------------------------- |
| Kind topics    | `/articles`, `/tutorials`, `/bookmarks`, `/glossary`, `/til`, `/notes`, `/releases` | `/<slug>.rss`, `.atom`, `.json`       |
| Author-defined | `/topics/:slug`                                                                     | `/topics/:slug.rss`, `.atom`, `.json` |
| Topic index    | `/topics`                                                                           | none                                  |

Kind topics are rows like any other (query `kind:<name>`), seeded by migration with the titles
and descriptions their pages show today, and served by fixed routes that call the shared topic
controller with their slug. The registry names their slugs, which makes them built in: the CMS
edits their title and description and refuses to change their slug or query, or to delete them.
The existing per-kind URLs keep working unchanged, and the global `/rss`, `/atom.xml` and
`/feed.json` keep listing everything.

#### Linking In

A post's tags link to the topic whose query is exactly `tag:<tag>` (looked up by the canonical
query), and to `/search?q=tag:<tag>` when none exists. A post's kind label links to its kind
topic. The footer links to `/topics`.

### 4. Notes and TILs

Two new post types, written in the CMS through their own models, published, searched,
listed and federated like the others.

| Kind   | Fields                     | Permalink                 | ActivityPub | In `/rss` |
| ------ | -------------------------- | ------------------------- | ----------- | --------- |
| `note` | `content`                  | `/notes/<base36 seconds>` | `Note`      | Yes       |
| `til`  | `title`, `content`, `tags` | `/til/<title slug>`       | `Note`      | Yes       |

- **Length.** Both are cross-posted to X as their content plus their permalink, so the CMS
  enforces X's limit on the exact text that would be posted (see Sharing below).
- **Index.** Notes and TILs render their content inline in the Activity list, with the date
  linking to the permalink; every other kind stays a single linked line. Each has its own emoji.
- **Note slug.** The publish instant in seconds, `seconds.toString(36)`: six characters until
  late 2038, seven after. A same-second collision appends a digit. Ordering always uses the
  publish date, never the slug. JavaScript's built-in conversion covers this, so no encoding
  package changes.
- **Feeds.** Atom requires a title, so a note's entry title is its content shortened.
- **Replies.** Fediverse replies to the federated `Note` arrive through the existing inbox and
  render on the permalink like any mention.
- The blog's `AGENTS.md` rule restricting `post.tsx` to articles and tutorials is updated to the
  kinds with permalinks: articles, tutorials, notes, TILs and releases.

### 5. Weekly Releases Post

A job creates one `release` post per week summarizing the packages released across the
author's repositories.

- **Schedule.** Fridays at noon in Peru (UTC−5, no daylight saving): cron `0 17 * * 5`. Each
  run covers the seven days before it, so consecutive runs leave no gap.
- **Sources** (in `config/releases.ts`): `sergiodxa/monorepo`, `sergiodxa/remix-utils`,
  `sergiodxa/remix-i18next`, `sergiodxa/remix-auth`, read through the GitHub Releases API with
  the existing `GITHUB_TOKEN`.
- **Packages.** A monorepo release lists one `## @sdxc/<name>` section per package; every
  section counts except one whose only content is "Republished because …". A single-package
  repository's release counts as its package. Packages are deduplicated across the week and
  repositories, and listed without versions.
- **Post.** Title "What I released this week", body the package list linking to each package,
  permalink `/releases/<ISO year>-w<ISO week>`, published immediately and federated as a `Note`.
  The author edits it afterwards when needed. A week with no qualifying package creates no
  post. Writing the post is an upsert on its slug, so a retried run never duplicates it.

### 6. Sharing on X

Sharing goes through X's web intent (`https://x.com/intent/post?text=…`), a plain link that
opens a prefilled composer. Nothing is posted through the X API and nothing records whether a
post was shared.

#### Author Share Text

| Kind              | Text                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| Note              | `{content} {permalink}`                                                   |
| TIL               | `TIL {content} {permalink}`                                               |
| Article, tutorial | `{kind emoji} {title}`, blank line, `{teaser}`, blank line, `{permalink}` |
| Release           | `This week I released {packages} {permalink}`                             |

- The kind emoji is the one the index shows for that kind.
- **Teaser.** Articles and tutorials gain an optional `teaser` field: one line written for X.
  When empty, the excerpt stands in.
- The author's "Post on X" button appears on every row of the CMS lists and on a post's edit page
  after a save, so a post is shareable at any time, including the job-created release posts.

#### Reader Share Link

Every public post page shows "Discuss on X", an intent prefilled with the title and permalink.

#### X Length Rules

The CMS measures the whole share text with X's weighting: a URL counts 23, emoji and CJK
characters count 2 (an emoji sequence counts once), and every other character, line breaks
included, counts 1, against a limit of 280.

| Kind              | Content budget                                  |
| ----------------- | ----------------------------------------------- |
| Note              | 256                                             |
| TIL               | 252                                             |
| Article, tutorial | 250 minus the weighted title length             |
| Release           | Package list shortened with "and N more" to fit |

- Notes, TILs and a typed teaser that do not fit are rejected on save, naming how much to cut;
  changing a title re-runs the check on that save.
- An excerpt standing in for the teaser is shortened with an ellipsis instead, so it never blocks
  a save. A title too long to leave room for a teaser is flagged in the form.
- Links inside a note's Markdown become bare URLs in the posted text and count 23 each.
- A small island shows the remaining count while typing; the save check holds without it.

### 7. Footer

A blog-only footer component, rendered by the blog layout, in labeled columns:

| Column    | Links                                                          |
| --------- | -------------------------------------------------------------- |
| Read      | Articles, Tutorials, TIL, Notes, Bookmarks, Glossary, Releases |
| Topics    | `/topics`, plus the topics with the most posts                 |
| Follow    | RSS, Atom, JSON Feed, the Fediverse handle                     |
| Support   | Sponsors                                                       |
| Elsewhere | X, GitHub, sdxc.sergiodxa.com                                  |

The header navigation keeps the kind links; the CMS dashboard link moves to the footer.

## Consequences

### Positive

- **Subscriptions follow interest** - Any topic, kind or saved search, has its own three feeds.
- **One topic implementation** - Kind pages, kind feeds and author topics share one controller,
  view and feed path; a new kind is a registry entry and a seeded row.
- **The index moves** - Notes, TILs and the weekly releases post add entries between articles.
- **Owned short posts** - Notes and TILs are searchable, federated and have permalinks, and X
  receives a copy that links back.
- **Sharing costs no API fees** - Intents need no credentials, secrets or paid tier.
- **Existing URLs keep working** - Kind pages and kind feeds keep their paths.

### Negative

- **Manual cross-posting** - Every share is a click by the author; a forgotten share is never
  noticed, since nothing is tracked.
- **No replies from X** - Reading replies needs X's paid search API; only Fediverse replies and
  Webmentions reach the permalink.
- **Dependency sweeps inflate the releases post** - A week with a dependency upgrade lists nearly
  every `@sdxc` package; the share text shortens with "and N more".
- **Release notes format is a contract** - The job depends on the `## @sdxc/<name>` headings and
  the "Republished because" wording the release script writes.
- **Topic queries run per request** - A topic page and its feeds run a search; edge caching under
  the post-list tag absorbs it.

### Neutral

- **`/search` stays** - Filtering lives in search and topics; the home page stays the unfiltered
  Activity list.
- **X weighting lives in the app** - It is generic enough for a package, which would be proposed
  separately when a second consumer appears.
- **Two URL shapes for topics** - Kind topics stay at the root, author topics live under
  `/topics/`.

## Implementation Plan

### Phase 1: Sharing on X

**Priority:** High
**Estimated Effort:** Small

1. X-weighted length module and share-text builders per kind
2. "Discuss on X" on public post pages
3. "Post on X" on CMS list rows and the post edit page
4. `teaser` field on articles and tutorials, with the save-time check

### Phase 2: Search Order

**Priority:** High
**Estimated Effort:** Small

1. `order:` in `@sdxc/search` (package commit)
2. Map `asc`/`desc` to the publish date in `app/models/search.ts`

### Phase 3: Kind Registry

**Priority:** High
**Estimated Effort:** Medium

1. `app/models/kinds.ts` with the current four kinds
2. Replace every repeated kind list with registry reads

### Phase 4: Topics

**Priority:** High
**Estimated Effort:** Large

1. `topics` migration, seeded with the kind topics
2. `Topics` model, canonical query storage
3. Shared topic controller and view; topic feeds in RSS, Atom and JSON Feed
4. Fixed kind routes and `/topics/:slug(.:ext)`, `/topics`
5. CMS management and "Save as topic" on `/search`
6. Tag and kind links on posts

### Phase 5: Notes and TILs

**Priority:** Medium
**Estimated Effort:** Large

1. Registry entries, models and CMS forms with the length check and counter island
2. Permalinks, inline Activity rows, global and topic feeds
3. Federation as `Note`
4. Update the blog `AGENTS.md` post-controller rule

### Phase 6: Weekly Releases

**Priority:** Medium
**Estimated Effort:** Medium

1. `config/releases.ts`, GitHub Releases reader and package extraction
2. Weekly job on `0 17 * * 5`, upserting the `release` post
3. Release permalinks, federation and share text

### Phase 7: Footer

**Priority:** Low
**Estimated Effort:** Small

1. Footer component in the blog layout

## Alternatives Considered

### 1. Filters on the Home Page

Filter links on `/` narrowing the Activity list by kind and tag.

**Rejected because**: It duplicates `/search`, which already filters. Topics give each useful
filter a page and feeds of its own.

### 2. Ad-Hoc Filtered Feeds

Feeds accepting a query string, such as `/rss?q=tag:remix`.

**Rejected because**: Topics cover the same need with a stable URL, a title and a description,
and keep arbitrary query strings out of the edge cache.

### 3. Topics as a Post Type

Storing topics as `posts` rows of type `topic` with metadata.

**Rejected because**: A topic is not content. A dedicated table gives the slug and the query
real unique indexes, and a direct `findBy` lookup.

### 4. Topics at the Root

Serving every topic at `/:topicSlug(.:ext)`.

**Rejected because**: A route added later would silently shadow a topic with the same slug, and
no reserved-word list anticipates every future route. A `/t/:slug` prefix with redirects from
the kind pages was also set aside, since the kind URLs must stay as they are.

### 5. Automatic Posting to X

A job posting each note, TIL or article through the X API.

**Rejected because**: X charges for API posting. An intent link needs no credentials, and the
author decides when to share.

### 6. Daily Release Entries

One Activity entry per GitHub release.

**Rejected because**: The monorepo releases daily, which would bury every other entry. A weekly
summary keeps one entry per week.

### 7. Cross-Posting to Bluesky

Posting and reading replies through the AT Protocol.

**Deferred**: X is where the author shares; Bluesky can be added later with the same share-text
builders.

## References

- [Smart Indexes](https://swyx.io/smart-indexes)
- [X web intents](https://developer.x.com/en/docs/x-for-websites/tweet-button/guides/web-intent)
- [twitter-text counting rules](https://github.com/twitter/twitter-text/tree/master/config)
- [ADR-004: Full-Text Search](./ADR-004-full-text-search.md)
- [ADR-005: Search Dialog and Client Islands](./ADR-005-search-dialog-and-client-islands.md)
- [ADR-007: Publishable Package Releases](../ADR-007-publishable-package-releases.md)

## Current Progress

- [x] Phase 1: Sharing on X
- [x] Phase 2: Search Order
- [x] Phase 3: Kind Registry
- [ ] Phase 4: Topics
- [ ] Phase 5: Notes and TILs
- [ ] Phase 6: Weekly Releases
- [x] Phase 7: Footer
