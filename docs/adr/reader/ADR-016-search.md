# ADR-016: Search

## Status

**Proposed** - 2026-09-16

## Background

Search is already built. The reading queue's header carries a field, `q` rides in the URL
beside `show`, and `readingQueue` composes the two into one statement: a `LIKE` pattern
over `title` and `summary`, an `ESCAPE` clause so a reader looking for `100%` finds it, the
read-state predicate spelled exactly as the partial index that serves it, and the pager's
own seek folded in. One read per page, ordered by the same `(published_at, id)` keyset
every other list in this app pages by, minting cursors interchangeable with the timeline's.

That baseline is decent, and this ADR does not replace it. What it has never had is a limit.
`SearchQuery`'s own comment is honest about the shape — "a match that may begin anywhere in
the text is one no index answers, so the timeline index serves the ordering and nothing
else" — but nothing bounds how far that scan walks, and on the archive ADR-002 sized a
reader's object for, a search that matches nothing walks every row they own.

So this decides four things: how far back a search reaches and how that is enforced, what it
matches and whether that should become a real index, whether a query can be kept, and
whether the article body can ever be searched at all.

## Context

### What a scan costs, in rows

The rate card this monorepo prices usage against is in cents per unit, and it has no entry
for a Durable Object's SQLite row reads. It does have `d1RowRead` at `1.0e-7` cents, which
is $0.001 per million rows — the same price Cloudflare charges for rows read out of a
Durable Object's SQLite, so that is the rate used below and the card wants a key of its
own.

Rows read counts index rows as well as table rows. The ordered walk reads the timeline
index for the ordering and then the row itself to test the pattern against `title` and
`summary`, because neither text column is in any index. So an exhausting search reads
roughly two rows per stored post:

| Stored posts | Posts examined | Rows read | Cents | Thread time |
| ------------ | -------------- | --------- | ----- | ----------- |
| 100,000      | 100,000        | 200,000   | 0.02  | ~100 ms     |
| 500,000      | 500,000        | 1,000,000 | 0.10  | ~500 ms     |

A tenth of a cent is not a frightening number, and saying otherwise would be dishonest. The
`doDurationMs` rate prices that half-second at `7.8e-5` cents, a thousandth of what the rows
cost, so the money in a search is entirely rows and none of it time.

Two things make it matter anyway. Repetition: twenty searches a day over two pages each, on
a 500,000-post archive, is about $1.20 a month of failed searches against a $5 plan. And the
thread: a `UserDO` has one, and half a second of it is half a second in which that reader's
timeline, mark-read and catch-up synchronization queue behind a query returning nothing.

The worst case is also the commonest one. A search that matches plenty stops early — the
walk is in `published_at` order, so fifty matches at one per cent selectivity are found in
five thousand posts. The full scan is what a typo costs, what a half-remembered name costs,
and what looking for a post that fell out of retention costs. It is paid exactly when there
is nothing to show for it.

### FTS5 is available, and that was checked rather than assumed

The claim that SQLite inside a Durable Object supports FTS5 is worth more than an assertion,
so it was verified against the `workerd` binary this repo installs. Its SQLite is built with
`ENABLE_FTS5` and carries FTS5's own diagnostics, its tokenizers (`unicode61`, `porter`,
`ascii`, `trigram`) and `bm25`, `snippet`, `highlight`, `prefix=`, `detail=` and
`contentless_delete`. Decisively, the authorizer in `src/workerd/util/sqlite.c++` — the
callback deciding which statements a Durable Object may run at all — carries an allowlist of
virtual-table modules, and that list is `fts5`, `fts5vocab`, `rtree`, `rtree_i32`.

So `CREATE VIRTUAL TABLE … USING fts5(…)` is permitted inside a `UserDO`, on the runtime
version this repo pins. What was not done is execute one against a live object, so this is a
verification of the binary rather than of behaviour, and the first step for anyone adopting
it is a `*.workers.test.ts` that creates one.

### What an FTS5 index would and would not buy

The interesting result is that the ordered scan and an inverted index fail on opposite
queries, and neither is uniformly better.

| Query, against 500,000 stored posts | Ordered `LIKE` scan | FTS5 `MATCH`                         |
| ----------------------------------- | ------------------- | ------------------------------------ |
| matches nothing                     | 1,000,000 rows read | ~10 rows read                        |
| matches 1,000 posts (0.2%)          | ~50,000 rows read   | ~2,000 rows read, 1,000-row sort     |
| matches 100,000 posts (20%)         | ~500 rows read      | ~200,000 rows read, 100,000-row sort |

The sort is the part that matters more than the rows. FTS5 returns matches in `rowid`
order, and this app's ordering is `(published_at, id)` — so every page of a common-word
search reads the whole match set into a temporary b-tree to order it, which is the exact
cost every index in `0001-init.sql` and `0004-read-timeline-index.sql` was written to
avoid, reintroduced on the one query type where the current scan is already fast.

Storage is affordable and is not the reason to decline. A row's indexed text is a title and
a summary capped at `MAX_SUMMARY_LENGTH`, so about 200 bytes in practice; an FTS5 index at
`detail=full` runs something under half the indexed text, which is about 100 MB at the
million-post reader budget — five per cent of that budget's two gigabytes, one per cent of
the object. The `trigram` tokenizer, which is what would preserve today's substring
matching, costs roughly three times that.

What is expensive is elsewhere. An index has to be written by every path that writes or
deletes an item — synchronization, the edit upsert, the velocity sweep, the budget's
reclamation, unfollow, and the unsave that puts a post back under a rule — and a path that
forgets leaves a reader with results wrong in a way nothing detects. It would also change
what a match means: `LIKE '%sql%'` finds `sqlite` and an `fts5` token match does not, unless
every term is prefix-queried or the trigram tokenizer pays for it. Search would go from one
statement to a second store with its own consistency argument and its own semantics.

### A bound the reader can see beats an index they cannot

The scan's defect is not its constant factor, it is that it is unbounded. Bound it and the
numbers move into the same order of magnitude as the index, without a second store:

| Search page                            | Posts examined | Rows read | Cents |
| -------------------------------------- | -------------- | --------- | ----- |
| one 90-day step, 500,000 posts / 3 yrs | ~41,000        | ~82,000   | 0.008 |
| a word matching 1% of them             | ~5,000         | ~10,000   | 0.001 |

A step is bounded by a date rather than by a row count, and that is what makes it fit the
machinery already here. The floor is a predicate on `published_at`, the leading ordering
column, in the direction the walk already runs — so it ends the index range early instead of
filtering rows out of it, and nothing sorts. And because the floor is known before the query
runs, a page that fills no further knows exactly how far it got without reading a frontier
row back.

Costs then land where they belong. The ordinary search pays for the posts between the top of
the queue and its fiftieth match; the search that will find nothing pays for one step, says
what it covered, and stops. Exhausting a three-year archive is a dozen clicks the reader
chooses to make, which is the difference between a cost the product absorbs and a cost a
person asks for.

### The window is the one read whose cost grows with the archive

Paging the timeline costs the page, whatever is below it: that is the whole point of the
keyset, and scrolling back four years costs no more per page than scrolling back four days.
Search is the exception, the one read in this app whose cost grows with how much the reader
has kept. That makes the window an honest place to draw a tier line, because the line follows
the cost rather than being placed where it will hurt. Free searches the last 30 days; Paid
and Premium search everything stored. Nothing is hidden from a free reader who scrolls, and
nothing that was cheap becomes paid.

### The list owns the ordering; search is only ever a predicate

Composition is what breaks first when several narrowings meet, and what breaks is the cursor
rather than the results. The rule that keeps it whole: **a search adopts the ordering of the
list it narrows and adds a predicate to it.** It never brings an ordering of its own.

Three of the four narrowings are then trivial, because the sibling designs already put the
column on the post. Read state is `"read_at" is null`. One feed is `"feed_id" = ?`. A folder
is `"folder_id" = ?`, denormalized onto `feed_items` by [ADR-007](./ADR-007-folders.md) with
a partial index behind it — one bound parameter, where an `IN` list of a folder's feeds
would have run into the 100-parameter limit ADR-002 lists and had to chunk, and a query
split into chunks has no single ordered read and therefore no cursor.

Tags are the one that genuinely differs. [ADR-015](./ADR-015-tags-pins-and-saved-organization.md)
pages a tag from `item_tags`, seeking on `(published_at, item_id)` — so a search inside a tag
is that statement with the pattern added, minting cursors on those column names rather than
on the queue's. The two grammars do not mix, and they do not have to: a cursor carries the
columns it was minted for, `Pagination.byKeyset` refuses one whose columns do not line up,
and `readingQueue` already answers that refusal as `bad-cursor` rather than as a silent first
page. Crossing surfaces starts at the top, visibly.

### There are no bodies to search

ADR-002 stores no post body: `0002-drop-item-content` removed it from the reader's object,
and `FeedDO`'s `items` never had one. Full-text search over article bodies is therefore not
a feature that is unbuilt — it is one this architecture has nowhere to put.

Extraction does not change that, because of how [ADR-013](./ADR-013-full-text-extraction.md)
scopes it: an article is fetched when a reader opens it, held in a shared cache keyed by the
article's URL, expired on a clock, and never written into a `UserDO` — `feed_items` gains no
column. There is no per-reader corpus to order, and the arithmetic says there will not be
one: twenty kilobytes of article against the million-post budget is twenty gigabytes against
an object that gets ten. Searching bodies in the feed objects is the other shape, and it is
the fan-in ADR-001 and ADR-002 both rejected: a query across every followed feed's object,
merged in memory, with no stable cursor over the merge.

### Nothing here knows about sources nobody follows

Global search over public feeds — the thing Inoreader sells — needs an index of posts from
sources this system has never fetched. What exists is the D1 catalog: one row per feed
somebody follows, holding a URL and a denormalized title. Not posts. Building the rest means
a crawler with a discovery strategy, an inverted index over millions of documents with its
own storage and ranking, and the moderation questions that come with serving strangers'
content to people who did not ask for it. It is a search engine with a reader attached, and
no amount of work inside a `UserDO` approaches it.

The catalog does make one nearby thing possible, worth not confusing with this one: searching
the feeds the system already knows, to find something to follow. That is a `LIKE` over a
table of thousands, on the follow path where D1 already is.

### A standing query belongs to filter rules, not to search

Keyword alerts — a query that keeps running and produces a feed — look like a search
feature and are not one. A search runs when a reader asks; an alert has to run when an item
arrives. The place an item is in hand, in memory, already being decided about, is
synchronization, which is exactly where [ADR-009](./ADR-009-filter-rules.md) puts filter
rules: matching a term there costs a string comparison on a post already being written,
where a search costs a scan per alert per poll over posts that were already visited.

So search grows no scheduler: a saved search is evaluated when a reader opens it and never on
a clock. Alerts across feeds nobody follows need both the subscriber walk ADR-002
deliberately does not have and the corpus of the previous section.

## Decision

Search stays one `LIKE` statement over the reader's own rows, ordered by the keyset of the
list it narrows, reading from the indexes that already exist. **No index is added to
`feed_items`, and no FTS5 table is created.** What is added is a floor, a step, a third
matched column, and somewhere to keep a query.

### The searched span

No column is added for it. The window is a function of the `tier` on the settings row that
[ADR-012](./ADR-012-tiers-entitlements-and-billing.md) already writes:

```text
SEARCH_WINDOW_DAYS: Record<Tier, number | null> = { free: 30, paid: null, premium: null }
```

A second column would be a second thing to keep in step with a plan, and the first one to be
wrong after a downgrade. Derived, a reader's window changes when their tier does, in one
write, with nothing to reconcile. It is read inside `readingQueue`, which is where ADR-012
puts every limit — in the method that does the thing rather than in the form that offers it,
since the MCP server and the public API reach the method and go through no form. One row
read, taken only when the search box holds something.

### The page, and the statement it runs as

A search page searches one **step**: the span between where its cursor sits and a floor,
which is the later of the tier's floor and a step back from the cursor. The step is
`reader-search-step-days`, evaluated through `flagsFor(subject)` and defaulting to 90, so a
reader whose archive is dense enough to make a step expensive can be given a shorter one
without moving anybody else's.

```text
select "id", "feed_id", "title", "url", "summary", "author", "published_at", "read_at", "saved_at"
  from feed_items
 where ("title" like ? escape '\' or "summary" like ? escape '\' or "author" like ? escape '\')
   and "published_at" >= ?                                        -- the step's floor
   and "read_at" is null                                          -- the read state, when chosen
   and ("published_at" < ? or ("published_at" = ? and "id" < ?))   -- the pager's seek
 order by "published_at" desc, "id" desc
 limit 51
```

The plan is unchanged from today's: `feed_items_unread_timeline_idx` for unread,
`feed_items_read_timeline_idx` for read, `feed_items_timeline_idx` for every post. The floor
is a second comparison on the same leading column as the seek, so it shortens the range the
index is scanned over and introduces no sort and no new index. `author` joins the match
because it is on the row the scan already fetches, so it is free, and a reader looking for a
byline is looking for a post.

### The cursor a search page mints

The page's `next` cursor marks how far the scan got: the last post shown when the page
filled, and the step's floor when it did not.

That second case is the change. `Pagination.byKeyset` mints cursors from returned rows and
reports no next page when fewer rows came back than were asked for, which for a bounded
search would mean a barren step ends the search rather than continuing it. So a search page
mints its own boundary, with `encodeCursor("after", ["published_at", "id"], [floor, ""])` —
the same two column names, in the same order, carrying the floor and an id no id sorts
below, so the next step resumes strictly below the floor and skips nothing that was never
examined.

Three properties follow, and they are the reason this is spelled as a cursor rather than as
a separate "continue" token:

- On the queue, a search cursor and a timeline cursor are the same object, so a reader who
  searches, pages, clears the box and keeps paging follows one the plain timeline can seek
  with — the ordering columns and their spelling never changed.
- A cursor survives the window moving. The floor is derived at read time from `Date.now()`
  and the tier, so a cursor minted yesterday, or before an upgrade, is still a position in
  the same total order: a changed window moves where the walk stops, never where a row sits.
- An empty step still has both links, because neither is minted from a row.

Steps therefore return uneven pages — fifty posts, or three, or none — and the interface
says so rather than pretending the list is short.

### What the interface says

A search that shows nothing must say what it looked at, because the confusing failure is the
one where the post exists and the search was never allowed to reach it. The current copy
claims too much — "No post in any feed you follow contains those words" — and becomes false
the moment a floor exists. Three sentences replace it, all of them naming a span:

- **Stopped at a step.** "Searched back to 4 March. Keep searching" — the same link as
  "Older posts", relabelled, following the same cursor.
- **Stopped at the window.** "Free searches the last 30 days. Everything you have kept is
  searchable on Paid", shown at the floor with the date it reached.
- **Stopped at the end.** "Searched everything you have kept." The oldest post's date is one
  row off the timeline index, so this is known rather than guessed.

All three are `ctx.i18next.t` keys in `en.ts` and `es.ts`, and all three carry the date the
scan reached, since a span nobody can see is not an explanation. The empty state also says
what search reads — the title, the summary and the author, not the article behind them —
because that is where a reader who did not find something is standing.

### Saved searches

A query worth typing twice is worth keeping. A `searches` table in the reader's object:
`id`, `name`, `query`, `read_state` with the same `CHECK` the parameter accepts, a nullable
`feed_id` for a search scoped to one subscription, `created_at` and `updated_at`, with
`(name, id)` indexed so the list pages by keyset the way the rail's feeds do. Twenty of
them, `SAVED_SEARCH_LIMIT`, refused rather than evicted at the limit, which is how this app
already answers a full shelf.

**A saved search is a link, not a surface.** The row holds a narrowing, and the rail draws it
as an address `queueUrl` builds — the same queue, the same controller, the same cursor
grammar. There is no `/searches/:id` that renders posts, because a second renderer of one
list is a second place for the two to disagree, and opening a saved search would then be
able to differ from typing the words it holds.

It carries no count. A number beside each one is a scan per search per sidebar render — this
ADR's cost multiplied by the length of the list, paid on every page of the app by readers
who were not searching. Feeds can afford a count because `UNREAD_COUNTS_SQL` is one grouped
read of an index; a search cannot, and the honest version of that feature is not to draw it.

### Observability

One event, `user.search`, through the logging contract: `windowDays`, `stepDays`,
`examined`, `matched`, `exhausted`, `readState`, `scoped`, `durationMs`. No query text —
what a person searched for is the most revealing thing this app holds.

`examined` and `exhausted` decide this ADR's own future. When steps are routinely exhausted
without matches, or `examined` per page stops looking like the table above, the bounded scan
has stopped being enough and the FTS5 design in Alternatives is what to build — measured,
rather than guessed at now.

### What does not change

The four `feed_items` indexes and the two timeline queries. The keyset, its shared
`NEWEST_FIRST` ordering constant, and the rule that both ordering columns stay unqualified in
the projection. `likePattern` and its escaping. The RPC boundary rules: never a `Result`,
never a `Date`, a discriminated union instead of a throw. And the corpus, which is exactly
the rows `feed_items` holds — saved posts from unfollowed feeds included, since that is the
set the queue itself shows.

## Consequences

### Positive

- A search has a ceiling. One page examines one step, costs on the order of a hundredth of a
  cent, and takes tens of milliseconds of the object's single thread rather than half a
  second of it. The unbounded search still exists, paced by a person clicking.
- A reader can tell the difference between "nothing matches" and "nothing matches in the
  span I searched", which the current empty state cannot express at all.
- The tier line follows the only read whose cost grows with the archive, so a free reader
  loses nothing that was ever cheap, and paging back through years stays free.
- No new index, no second store, no second write path. Retention, velocity, the budget and
  unsave keep exactly one place to delete a post from.
- Search composes with read state, one feed, folders and tags, because each is a predicate
  on a list that already owns its ordering. Whether the matching ever needs to change is
  now a measurement rather than an argument.

### Negative

- A search may be finished in the reader's mind and unfinished in the query. The step is
  visible and continuable, but it is a concept they have to meet, and the second click is
  one they did not have to make before.
- Search pages are uneven. A step holding three matches renders three posts, which reads
  like the end of a list and has to be captioned so it does not. A rare term over a long
  archive is a dozen requests where it used to be one, each one waking the object.
- The free window is a real subtraction. A free reader who remembers a post from last spring
  can scroll to it and cannot search for it, and the interface has to say so at the exact
  moment they are looking for it. It also inherits the `tier` column's failure modes: a
  stale tier is a reader paying for a window they do not get, and search cannot tell.
- Matching is still a scan, so the cost per match stays linear in the archive. This bounds
  it; it does not make search cheap in the way an index would.
- A search page mints a cursor the pager did not, which is the first boundary in this app
  that comes from something other than a returned row. One function, the same column names,
  and still a rule someone has to know.

### Neutral

- FTS5 is available and unused. The verification is recorded so the next person does not
  repeat it, and the trigger for revisiting is written down.
- Saved searches add a table nothing on the reading path reads, and body and global search
  are settled as out of scope rather than left looking like small tasks.

## Alternatives Considered

**FTS5 over `title`, `summary` and `author`.** Verified available inside a Durable Object,
and it answers the query this design is worst at — a term that matches nothing — in about
ten row reads instead of a million. Declined because it is worst where the scan is best: a
common word means reading the whole match set and sorting it into `published_at` order on
every page, the temporary b-tree every index in this schema exists to avoid. Add a second
write path through six deletion sites, a hundred megabytes against the retention budget, a
contentless table that cannot be rebuilt, and a change in what a match means, and the
bounded scan buys most of the benefit for one predicate. If `user.search` says readers
routinely exhaust steps, this is what to build, with an external-content table keyed by a
monotonic integer column of its own — never the implicit `rowid`, for the reason ADR-002
gives for not making the feed's head counter one.

**The `trigram` tokenizer, to keep substring matching.** Restores today's semantics over an
index, and makes `LIKE '%…%'` indexable for patterns of three characters or more. It roughly
triples the index, to around fifteen per cent of the retention budget, and still does nothing
for shorter queries. Worth reconsidering only together with the previous alternative.

**Bound the scan by rows rather than by a date.** A tighter bound, since a step through a
dense month is not the work of a step through a quiet year. It needs the frontier row read
back to know where it stopped, which means either returning tens of thousands of
non-matching rows into the isolate or a second statement asking where the walk ended. The
date-bounded step knows its own floor before it runs.

**Cap the window for everyone.** One number, no tier to read. It takes the archive away from
the readers most likely to pay for keeping one, to save a cost only they generate.

**Keep the unbounded scan and cache results.** Caching per reader per query makes the
repeated search free, which is the shape of the repetition cost. It is a cache invalidated
by every synchronization, over a list whose freshness is the point, storing the one thing
observability refuses to record.

**A saved search as its own surface, with its own controller and unread count.** What a
reader would draw. It is also a second renderer of the same list, and a count that costs a
scan per entry on every page load, paid by readers who are not searching.

## Tests

Extending the layout already in place: the statement and cursor behaviour in plain Vitest
against a SQLite `Database`, the entitlement and flag paths in `*.workers.test.ts`.

| #   | Behaviour                                                                                       |
| --- | ----------------------------------------------------------------------------------------------- |
| 1   | A search matches the title, the summary and the author, and nothing else on the row             |
| 2   | A pattern holding `%` or `_` matches those characters, as it does today                         |
| 3   | A floor excludes a post published below it, and a `null` window searches every stored post      |
| 4   | The search plan uses the read, unread or timeline index and sorts nothing                       |
| 5   | A filled page mints its next cursor from the last post shown                                    |
| 6   | A step that fills no page mints its next cursor from the step's floor                           |
| 7   | Following a floor cursor returns the next post below the floor, skipping none at the boundary   |
| 8   | An empty step still offers both a next and a previous cursor                                    |
| 9   | A cursor minted by a search seeks correctly on the plain timeline, and the reverse              |
| 10  | A cursor minted before the window moved still pages, and nothing repeats or disappears          |
| 11  | Search composes with each read state, using that state's own index                              |
| 12  | A folder-scoped search binds one parameter; a tag-scoped one pages on the tag list's keys       |
| 13  | A search reaching the window's floor reports the window, not the end of the archive             |
| 14  | A search reaching the oldest stored post reports the end of the archive                         |
| 15  | `user.search` records what was examined and whether the step was exhausted, and never the query |
| 16  | A saved search stores its narrowing, and its link resolves to the same page typing it produces  |
| 17  | The twenty-first saved search is refused, and no existing one is evicted                        |

## Implementation

- [ ] `SEARCH_WINDOW_DAYS` per tier, and the floor derived from it and `Date.now()`
- [ ] `reader-search-step-days` in the flag catalog, read through `flagsFor(subject)`
- [ ] The floor and the step in `searchStatement`, with `author` joining the match
- [ ] The boundary cursor, minted with `encodeCursor` from the step's floor
- [ ] `TimelineResult` carries the span a search covered and whether it stopped at the step,
      the window, or the end of the archive, the last read off the timeline index
- [ ] Empty-state and continuation copy in `app/locales/en.ts` and `app/locales/es.ts`,
      replacing the claim that nothing anywhere matches
- [ ] `searches` table, its migration, its index, and the CRUD routes in `routes/web.ts`
- [ ] Saved searches in the rail, drawn as `queueUrl` links with no count
- [ ] The `user.search` event
- [ ] The tests above
- [ ] A `*.workers.test.ts` creating an FTS5 virtual table inside a Durable Object, so the
      option is known to work before anybody needs it

## References

- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the indexes, and why a cursor records the column names it was minted for
- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — the timeline indexes, the retention budget, and the absence of post bodies
- [ADR-007](./ADR-007-folders.md) — the folder column a scoped search narrows by
- [ADR-009](./ADR-009-filter-rules.md) — where a standing query belongs
- [ADR-010](./ADR-010-retention-tiers-and-archive.md) — the retention budget an index would compete with
- [ADR-012](./ADR-012-tiers-entitlements-and-billing.md) — the tier the window is derived from
- [ADR-013](./ADR-013-full-text-extraction.md) — article extraction, and why it is not a corpus
- [ADR-015](./ADR-015-tags-pins-and-saved-organization.md) — the tag list a tagged search pages as
- [ADR-029](../ADR-029-pagination-package.md) — the keyset pager a search page borrows its cursor grammar from
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract `user.search` follows
