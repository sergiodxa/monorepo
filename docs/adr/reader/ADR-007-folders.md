# ADR-007: Folders

## Status

**Accepted** - 2026-09-16

## Background

A reader has two surfaces to read on. `/reading` is every post from every feed they follow,
newest first, narrowed by read state and by words; `/reading/:feed` is the same list
narrowed to one publisher. Between "all of it" and "one of them" there is nothing, and the
rail is a flat alphabetical list of every subscription, drawn in full because
[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) made it the whole
of the subscription list.

That is fine at ten feeds and unusable at fifty. Somebody following four newspapers, thirty
personal blogs and a dozen release feeds reads one stream in which a release announcement
and a long essay arrive interleaved, down a rail where the four newspapers are four rows
scattered among the blogs. The answer is not to take the stream away, but to let a reader
point it at a group they chose.

This adds folders: named groups of subscriptions, a stream per group, and the rail drawn
under those names.

## Context

### A folder is a reading surface before it is a filing cabinet

Filing is what a reader does; reading a group as one stream is what they get for it. That
ordering decides the design, because a folder that only groups rows in a rail earns one
column and a `GROUP BY`, while a folder with a timeline of its own earns an index and has to
answer the question every other list in this app answers: how does a page of it seek rather
than sort.

### The timeline indexes are one table away from the folder

Every index on `feed_items` leads with either `published_at` or `feed_id`, and every
timeline the app serves is a seek because of that: the global list, one feed's list, and
the read, unread and saved lists, each on a partial index holding only its own rows. A
folder is a property of `feeds` rather than of `feed_items`, so none of them can express
it.

Three ways to express it anyway, measured against the schema as it stands:

```text
-- The folder's feeds as an IN list, whether spelled out or as a subquery
SEARCH feed_items USING INDEX feed_items_feed_timeline_idx (feed_id=?)
USE TEMP B-TREE FOR ORDER BY

-- A join to feeds, filtering on the folder there
SCAN feed_items USING INDEX feed_items_timeline_idx
SEARCH feeds USING INDEX sqlite_autoindex_feeds_1 (id=?)
```

The list and the subquery are one plan: SQLite runs the feed index once per value of the
`IN` list and collects the results into a temporary b-tree to put them back in published
order, because an equality on the leading column stops satisfying an `ORDER BY` on the
columns after it the moment there is more than one value for it. That b-tree is built over
every matching row in the object before the first fifty come back, on every page, and it
grows with the reader's history rather than with the page. A keyset seek is only a seek
while rows arrive in key order from an index, and a plan that sorts has already read
everything the cursor existed not to read.

The join is worse in a way that reads better. It needs no sort — it walks the global
timeline index in order and probes `feeds` by primary key per row to ask which folder it
came from — but it walks every post from every feed, discarding what is not in the folder.
Filling fifty rows for a folder holding two of two hundred subscriptions reads and probes
on the order of a hundred index entries per row returned, and a folder whose feeds have
published nothing this month walks the reader's entire timeline before it can answer that
there is no more. Cost that grows with everything the reader has, to answer a question
about a small part of it, is the shape
[ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) rejected when it refused to
merge N feeds at read time.

The join carries a second problem that is fatal on its own. ADR-001 forbids the timeline
joining `feeds` for a title, because a join qualifies the ordering columns and **a cursor
records the exact column names it was minted for**. A cursor minted over `i.published_at`
cannot be followed by `readingQueue`, and the app has one `NEWEST_FIRST` constant precisely
so that no surface can mint an incompatible one.

### Nesting is what OPML models and what a second index would have to answer

OPML nests, every competitor nests, and a reader arriving with an export will have nested
it. It is the obvious shape and it is not the cheap one.

A nested folder makes "the posts in this folder" mean "the posts in this folder and
everything under it", and a stored column holds one answer. The recursive reading then needs
either a walk of the tree into a list of feeds — the `IN` list above, with its temporary
b-tree — or a materialized path, and `WHERE path LIKE 'a/b/%' ORDER BY published_at DESC`
is not a seek either: a range on the leading column leaves the ordering on the columns
after it unsorted, exactly as the `IN` list does. The only shape that stays a seek is one
row in one group, and a tree that reads recursively needs a row per ancestor.

It also spreads past the query: cycles refused, depth capped, a rail with expand state, a
picker instead of a list, and an unread count summed over a subtree that changes when a
folder moves. None of that is hard, and all of it is a permanent tax on every view, paid so
that a reader can put Rust inside Programming inside Tech.

### The retention budget is arithmetic over feeds, and must stay that way

ADR-002's budget is one million posts per object, and a feed's share of it is that budget
divided by how many feeds the reader follows, enforced only while the object is over
budget. Every property that makes it safe comes from the divisor being the subscription
count: a reader under budget keeps everything, following a feed takes nothing from the
feeds already followed, and a quiet feed is never charged for a prolific one.

A folder must not appear anywhere in that arithmetic. A per-folder budget would count the
same post differently depending on where its feed was filed, and moving a feed between
folders would delete posts — a destructive side effect of a labelling action, which is the
ratchet ADR-002 refused when it declined to recompute shares on subscribe.

## Decision

Flat folders. A `folders` table in the `UserDO`, one nullable folder on each subscription,
the folder copied onto each item row, and one partial index that makes a folder's timeline
the same seek the other five timelines are.

### The folders table

```text
CREATE TABLE folders (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX folders_title_idx ON folders (title);
```

No `parent_id`, no `position`, no `depth`. The list is short, and it is drawn in the order
the names read, the way the rail draws subscriptions.

The unique title keeps a rail from showing two rows called Tech that a reader cannot tell
apart, and makes filing by name an upsert, which is what an OPML import needs to be
idempotent. It also buys the total ordering: `feeds_title_idx` carries `id` beside the title
because two feeds may share a name, and a unique title needs no tiebreaker, so one index
answers both the constraint and the rail. Uniqueness is over bytes, as everywhere else in
this schema, so `Tech` and `tech` are two folders — visible enough in a rail to be fixed by
renaming one.

### One folder per subscription

`feeds` gains `folder_id TEXT` referencing `folders (id)`, nullable, with no index on it:
the subscription list is hundreds of rows rather than millions, the rail reads all of it
anyway, and the one query that filters it by folder is a deletion clearing its members.

**A feed is in one folder or in none.** A junction table means an item has no single folder
to carry, which takes the denormalized column below away and puts the folder timeline back
on the join or the `IN` list, with their scan and their sort. Keeping the seek under one
would mean an item row per membership, duplicating posts inside the object and making the
budget count a post once per folder it happens to be filed in — the arithmetic the previous
section forbids touching. What refusing it costs is a reader who wants one feed under both
Rust and Work filing it under one and meeting it in the queue under the other, which is a
smaller loss than either alternative.

### The folder on the item row

`feed_items` gains `folder_id TEXT`, nullable, copied from the subscription when the item
is written.

This is denormalized data, and what keeps it from rotting is that it has exactly one
source: the `folder_id` on the subscription the item belongs to. Synchronization writes it
from the subscription row it is already holding, on insert and on conflict alike, so an item
arriving twice lands in the folder its feed is in now, and a move that failed halfway heals
on the next poll rather than drifting.

It does not join the frozen columns. `read_at`, `id` and `published_at` are frozen against
a publisher's edit, because somebody else's document must not move a row a reader has
already ruled on and because two of them are the cursor. `folder_id` is written by the
reader and only by the reader, and it is not a cursor column: changing it moves no row
within `(published_at, id)`, so no in-flight cursor can skip a post because a feed was
filed. Freezing it would be the bug — an item would keep the folder its feed had left.

### The folder timeline, and the index that seeks it

```text
CREATE INDEX feed_items_folder_timeline_idx
	ON feed_items (folder_id, published_at, id) WHERE folder_id IS NOT NULL;
```

A page of a folder is the query one feed's page already is, with the leading column
changed:

```text
SELECT id, feed_id, title, url, summary, author, published_at, read_at, saved_at
FROM feed_items
WHERE folder_id = ?1
	AND (published_at < ?2 OR (published_at = ?2 AND id < ?3))
ORDER BY published_at DESC, id DESC
LIMIT 50
```

Which SQLite answers as:

```text
SEARCH feed_items USING INDEX feed_items_folder_timeline_idx
	(folder_id=? AND published_at<?)
```

One equality on the leading column, a range on the next, no temporary b-tree on the first
page or on any page after it. The index descends to the entry the cursor names and walks
fifty entries backwards, so what a page costs is the page, and neither the reader's history
nor their subscription count enters it. Both keys point the same way, so an ascending index
answers the descending order by being scanned backwards and declaring `DESC` buys nothing,
which is the sentence every other index in this schema carries.

The cursor is the one every other timeline mints. The columns are unqualified, off one
table, spelled by the shared `NEWEST_FIRST` constant, so `folderTimeline` is
`this.#page(this.#timeline().where({ folder_id: folderId }), options)` — one line beside
`feedTimeline`, reusing the pager, the seek grammar and the page limits unchanged.

The index is partial on `folder_id IS NOT NULL`, the idiom the read, unread and saved
indexes already use, and here it means an unfiled post costs nothing. A folder timeline
always seeks a folder that exists, so the predicate never excludes a row the query wanted.

**What it costs in storage.** ADR-002 sizes a `feed_items` row at roughly 700 bytes of
field and about a kilobyte and a half once SQLite's overhead and its indexes are counted,
and sets the budget at a million posts — around two gigabytes, a fifth of the object. An
entry in this index is a folder id, a timestamp, an item id and the row's key: call it a
hundred bytes with overhead. At a full budget, with every feed filed, that is **about
100 MB**, plus at most 30 MB for the column on the rows themselves. Six per cent on top of
a footprint that was deliberately set a fifth of the way into a ten-gigabyte object so the
estimate could be wrong by five times, and one per cent of the object. **`READER_BUDGET`
does not change**, and neither does the share arithmetic: the budget counts posts, a folder
stores none, and the divisor is still how many feeds the reader follows.

### One index, and the filters it does not get

There is one folder index, and it holds every post in the folder — read, unread and saved
alike. A folder page is the feed page's shape, not the queue's.

Crossing folders with the queue's three read states would mean three more partial indexes
led by `folder_id`, under `read_at IS NULL`, `read_at IS NOT NULL` and `saved_at IS NOT
NULL`, to answer filters the queue already answers globally — four indexes on one column.
The cost of refusing is worth naming: a reader cannot ask for the unread posts of one
folder and cannot search within one, only read the folder or filter the whole queue. If
that turns out to be what readers do, it is one migration away, added knowing which index
pays for it.

### Unread counts per folder

The rail already carries an unread count per feed, computed by one grouped read the
schema's own query-plan test pins to `feed_items_feed_timeline_idx`, and cached in KV as
four fields per row for five minutes. A folder's count is the sum of the counts of the feeds
in it, computed where the rail is assembled, over a list the request already holds.

No second query, no second cache, and no number that can disagree with the rows under it: a
folder showing eleven shows it because the four feeds beneath it show four, three, three and
one. `CachedFeed` gains its feed's folder, and every path that already clears the rail cache
clears it for filing, renaming and deleting too.

The folder index would answer a standalone count as a seek if one were ever needed — a
`GROUP BY folder_id` over the unread rows groups from it with no temporary b-tree — which
is worth knowing and not worth spending a read on today.

### Filing, renaming and deleting

Filing a feed is one update to the subscription and one to its posts:

```text
UPDATE feeds SET folder_id = ?1 WHERE id = ?2
UPDATE feed_items SET folder_id = ?1 WHERE feed_id = ?2
```

The second is bounded by that feed's share of the budget and touches one index. It is the
price of the seek, paid when a reader files a feed rather than every time they read one,
which is the right way round.

Renaming touches one row, because the id is what everything holds. Deleting a folder clears
`folder_id` on its subscriptions and on their posts and deletes the row. **A folder holds no
posts, so deleting one deletes none**: the feeds come back unfiled, exactly as they were
before anybody made the folder, which is what the reader is told rather than asked to
confirm.

### OPML

The import and export already exist, and `@sdxc/opml` deliberately throws folders away:
`parse` walks the tree depth-first into a flat list, and `stringify` writes one `<outline>`
per subscription under `body`. That is a lossy round trip through an app which now has
somewhere to put them, so the package gains the one field that carries them.

`OPML.Outline` gains an optional `folder`, and reading sets it to the title of the
**nearest enclosing** folder outline. Nearest rather than outermost, and rather than a
joined path: the nearest name is the one the person wrote over that feed, while a joined
`Tech / Programming / Rust` invents a name nobody ever typed. Depth is what a flat reader
loses, and it loses it once, on the way in. Two folders of the same name in different
branches merge, which is what a unique title means, and a feed listed twice keeps its first
place, which is the rule the package already applies to a duplicate.

Importing files each feed into the folder its outline named, creating that folder by title
when the reader has none — the upsert the unique index makes safe. A feed the reader already
follows stays where they put it: an import is not a licence to refile a list somebody has
already organized.

Exporting writes the tree back: one `<outline>` per folder holding its feeds, folders in
title order, unfiled subscriptions at the top level of `body` after them. Ordinary OPML 2.0,
what every other reader expects to receive, and an export of this app imported back into it
reproduces the filing it left with.

### Routes

Five patterns, all declared in `routes/web.ts` and reached through the typed `href()`:

```text
folder:  GET  /reading/folders/:folder
create:  POST /folders
rename:  POST /folders/:folderId
delete:  DEL  /folders/:folderId
file:    POST /feeds/:feedId/folder
```

The timeline sits under `/reading` because that is what it is: the queue narrowed to a
group, one step out from `/reading/:feed` narrowing it to one publisher. It takes a segment
of its own rather than sharing the feed's, so the two patterns never decide between each
other, the way `/reading/read` avoids it by answering no `GET`. The folder's page carries
the actions on that folder the way `/reading/:feed` carries unfollow, refresh and velocity,
so a folder is met where it is read. Filing is a path of its own beside
`/feeds/:feedId/velocity`, so a plain form reaches it, and it accepts an existing folder or
a new name, which is where most folders will be created.

The sidebar gains no route. `GET /sidebar/feeds` still answers the band, now drawn under
folder headings, so the fragment that redraws after a post is read is the same fragment.

### Migration and what "no folder" is

`0007-folders.sql` creates `folders`, adds the nullable `folder_id` to `feeds` and to
`feed_items`, and creates the partial index. Nothing is rebuilt and nothing is backfilled:
at migration time no folder exists, so every existing row's folder is `NULL` — which is
already what `ALTER TABLE … ADD COLUMN` writes, and what the column means.

**"No folder" is `NULL`, not a default folder row.** A default row would have to exist in
every reader's object before they had ever made a folder: a migration that writes one, a
title in a language the migration has to guess, a row every list and every count filters
back out, and an export carrying a folder nobody made. It would also cost the partial index
its whole point, since every post would then be in a folder and the reader who files nothing
would pay a hundred megabytes for a feature they are not using.

An ungrouped subscription keeps working because it is what every subscription already is:
the queue and the feed page are unchanged, the rail draws unfiled feeds under its existing
heading with folders above them, and a reader who never opens the folder controls sees the
app they had.

## Consequences

### Positive

- A group of feeds reads as one stream, at the cost of a page, paged by the same keyset
  cursor as every other list in the app — the property ADR-001 built the storage around,
  extended rather than excepted.
- Folders are Free-tier. A reader with fifty feeds cannot use this product without them, so
  gating basic organization would make the free tier an argument against the paid one
  rather than an advertisement for it. What a plan sells is not the ability to organize
  what you already have.
- OPML stops being a lossy round trip: an export re-imported reproduces the filing it left
  with, and an export handed to another reader arrives filed.
- The budget, the velocity rules and the back-pressure behaviour are untouched. A folder
  stores nothing, so nothing that counts storage had to learn about it.

### Negative

- A feed is in one folder. A reader who wants a release feed under both Work and Rust has
  to choose, and the alternative costs either the seek or the budget's arithmetic.
- Nesting is refused, so an import from a reader that nests loses its depth on the way in,
  silently, once. A person who had Tech / Rust gets Rust.
- Filing a feed rewrites that feed's posts. It is one indexed update inside one object,
  bounded by the feed's share of the budget, but it is a write measured in thousands of
  rows where the reader clicked a menu.
- A sixth index on `feed_items`, and a column that is a copy of one on `feeds`. Every write
  path into the table now has a folder to get right, and correctness rests on the single
  writer rather than on the database.
- A folder cannot be filtered to unread and cannot be searched within; the queue's filters
  stay global. Two folders whose titles differ only in case are two folders.

### Neutral

- A folder is a view over subscriptions, not a storage boundary. It owns no posts, it has
  no retention of its own, deleting one deletes nothing, and no rule that removes a post
  can be reached through it.
- Folder order is alphabetical, like the rail's feeds. Manual ordering would need a column
  and a reorder surface, and is not built here.

## Alternatives Considered

**Nested folders with a `parent_id`.** What OPML models and what readers expect. Every
recursive read is then either a tree walk into an `IN` list, which sorts, or a materialized
path with a prefix match, which also sorts — and the flat cases that stay seeks are exactly
the ones flat folders already serve. The interface cost is permanent and spread across
every view; the query cost is paid on every page.

**Nested folders, with only the leaf's own posts in its timeline.** Keeps the single column
and the seek, since each item still belongs to one folder. It also makes a parent a heading
that reads as empty while its children hold everything, and the first bug report is that
opening Tech shows nothing.

**Many-to-many, through a `feed_folders` table.** A feed under both Work and Rust. The
folder timeline becomes the join or the `IN` list, with the scan or the sort, unless items
are duplicated per membership — and duplicated items are counted twice by a budget whose
divisor is the subscription count, which turns filing into a storage decision.

**No denormalized column; filter through a join.** One source of truth, no write on filing,
no extra index. It walks the global timeline index and probes `feeds` per row, so it reads
everything the reader has to return a page of what they filed, and it qualifies the
ordering columns, which mints a cursor no other surface in the app can follow.

**No denormalized column; pass the folder's feeds as an `IN` list.** Avoids the join and
the qualified columns, and sorts every matching row in the object into a temporary b-tree on
every page to restore published order.

**A folder with its own retention.** "Keep the newspapers for a day" reads as a natural
extension, and it makes moving a feed between folders delete posts — a labelling action with
a destructive side effect. Velocity already answers this per subscription.

## Tests

Fourteen behaviours, in the layout the app already uses: the plans and the pure paths in
plain Vitest against a SQLite `Database`, the object paths in `*.workers.test.ts`.

| #   | Behaviour                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------- |
| 1   | A folder's first page reads `feed_items_folder_timeline_idx` and sorts nothing                        |
| 2   | A folder's seeked page keeps that index under the cursor predicate and sorts nothing                  |
| 3   | A folder cursor and a feed cursor are minted over the same columns and are followed by the same pager |
| 4   | Filing a feed moves its posts into the folder's timeline, and leaves their read state alone           |
| 5   | Filing a feed moves no row within `(published_at, id)`, and an in-flight queue cursor skips nothing   |
| 6   | Synchronization writes an arriving item into its subscription's current folder, on insert and on edit |
| 7   | A move interrupted between the subscription and its posts heals on the next synchronization           |
| 8   | Deleting a folder unfiles its feeds and deletes no post                                               |
| 9   | A folder's unread count is the sum of its feeds' counts, and moves when one of them moves             |
| 10  | Importing nested OPML files each feed under its nearest enclosing folder, creating folders by title   |
| 11  | Importing does not refile a feed the reader already follows                                           |
| 12  | Exporting writes folders as outlines with their feeds inside, and unfiled feeds at the top level      |
| 13  | An export re-imported reproduces the same filing                                                      |
| 14  | Folders change no retention arithmetic: the per-feed share is the budget over the subscription count  |

## Implementation

- [x] `0007-folders.sql`, mirrored in `database/schema.ts`, and its query-plan tests
- [x] `listFolders`, `createFolder`, `renameFolder`, `deleteFolder` and `fileFeed` RPC
- [x] `folderTimeline` beside `feedTimeline`, through the same `#page`
- [x] The subscription's `folder_id` copied in the synchronization upsert
- [x] `folderId` on `CachedFeed`, the folder sums, and cache clearing on every folder write
- [x] The five routes in `routes/web.ts`, mapped lazily in `bootstrap/app.tsx`
- [x] The folder controller, and the filing control on `/reading/:feed` beside velocity
- [x] The rail drawn under folder headings, with unfiled feeds below them
- [x] `folder` on `OPML.Outline`, the grouped document it writes back, and the README line
- [x] Folder filing in the import controller, folder grouping in the export controller
- [x] Copy for every new string in `app/locales/en.ts` and `app/locales/es.ts`
- [x] The tests above, and a `user.folder` event carrying the action and what it moved
- [x] The README's feature list and its route table

## References

- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the index reasoning and the cursor rules this follows
- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — the schema, the retention budget and the synchronization this writes into
- [ADR-029](../ADR-029-pagination-package.md) — the keyset cursor a folder's timeline pages with
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the folder event follows
