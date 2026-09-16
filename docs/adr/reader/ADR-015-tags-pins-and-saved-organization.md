# ADR-015: Tags, Pinned Feeds, and the Shape a Reader Gives Their Own Posts

## Status

**Proposed** - 2026-09-16

Extends the saved posts of
[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md), and adds nothing to
the synchronization protocol or the retention rules it established.

## Background

[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) gave a reader one
answer that never deletes anything: a post can be saved, a save is exempt from the read sweep,
the budget's reclamation and its feed's velocity, and the thousand-and-first save is refused
rather than evicting the first. That is a shelf with a wall at the end of it and no shelving
in between. A thousand saved posts in one list, ordered by nothing but when somebody else
published them, is a junk drawer — findable by scrolling and by the `LIKE` search the reading
queue already offers, and by nothing else. The refusal is right; what is missing is a reason
to keep a thousand of anything.

The same sentence applies to subscriptions, twice. A feed a reader would be upset to miss is
drawn in the rail at whatever letter its title starts with, between two feeds they skim. And a
feed that publishes monthly is buried by one that publishes hourly, in a river ordered by
publication date, which is exactly the ordering that buries it.

This ADR is three answers: **tags** on saved posts, a **pin** on a subscription, and a derived
**quiet group** for feeds that publish rarely. None of them stores a post, fetches a document,
or moves a cursor.

## Context

### Grouping posts is not grouping subscriptions

[ADR-007](./ADR-007-folders.md) groups subscriptions: a folder is a box in the rail, a feed is
in one, and what is being organized is the list of things a reader follows. This ADR groups
posts: a tag is a label on one saved item, an item may carry several, and what is being
organized is what a reader kept.

They are not one feature with two nouns. A folder answers "where does this publication
belong"; a tag answers "why did I keep this". A post from a feed filed under Work is not
thereby about work, and a reader who tags one post `recipes` has said nothing about the feed
it came from. So the two never nest and never stand in for one another: no query joins them,
and the only place they meet is the rail, which is ADR-007's, and the strip above the river,
which is this one's.

### A multi-valued column does not index

The tempting storage for a tag is a column on `feed_items` holding a delimited list, because
that table is the one every read path already touches and a column adds no rows at all. It is
tempting for exactly as long as nobody writes the query. "Saved posts tagged `rust`, newest
first" becomes `WHERE saved_at IS NOT NULL AND tags LIKE '%rust%'`, which is a scan of every
saved row followed by a sort, and is also wrong: it matches `rustacean` and `trust`. Padding
the delimiters fixes the wrongness and not the scan. SQLite can seek a prefix of an indexed
value and cannot seek a value in the middle of one, and every tag but the first in a list is
in the middle of one.

A thousand saved rows is not a million, so the argument is not that it would be slow today. It
is that it would be the only list in this app that sorts rather than seeks, in a schema where
five indexes exist so that five lists do not. A list that cannot seek cannot page by keyset,
and paging by keyset is how every list here is drawn.

### The ordering column a tag query has to seek on

A join table fixes the matching and leaves one problem behind: the filter (`tag_id`) lives in
the join table and the ordering (`published_at`, `id`) in `feed_items`, no index spans two
tables, and so the planner filters, joins, and sorts the result in a temporary b-tree. The
seek has moved rather than appeared.

The fix is to copy `published_at` into the join row, so one index carries the equality and
both ordering columns in that order and a page is a range scan over it. That is a
denormalization, and a denormalization is usually a second copy of a value that changes. This
one cannot change: `published_at` is frozen against publisher edits by ADR-001 and again by
ADR-002, precisely because it leads the timeline's ordering and a row that moved within that
ordering would make an in-flight cursor skip posts. A column the design already forbids from
moving is a column that can be copied with no reconciliation, and the copy is written once, by
the statement that applies the tag.

### What a tag is allowed to cost

Tags on any post, saved or not, is the more useful feature, and is where the storage argument
turns. A reader's object is bounded by `READER_BUDGET`, **one million posts**, around two
gigabytes at the row size ADR-002 derived. Ten tags on each of a million posts is ten million
join rows — at roughly 200 bytes a row once its index is counted, **two gigabytes of labels**
beside two gigabytes of posts. The metadata would be the size of the thing it describes, and
the retention sweep, which counts posts, would not see any of it.

Tags on saved posts alone are bounded by a cap that already exists and already refuses: a
thousand saved posts, ten tags each, **ten thousand join rows, about two megabytes** — the
same figure ADR-002 gives for the thousand saved posts themselves.

The semantic argument points the same way and is the stronger one. A tag on an unsaved post is
a label on a row that velocity, the read sweep or the budget may delete tomorrow, so a reader
would be organizing things this design has already warned them it may take. Saving is how a
reader says "keep this"; a tag is a reason to have kept it, and a reason without the keeping
is a promise that cannot be honored.

### The river must not learn about pins

The timeline pages by keyset over `(published_at, id)`, and its stability rests on one
property: the predicate a page was minted under is the predicate the next page runs. ADR-002
leans on this — an item synchronized mid-scroll lands where its own key says it does.

Subtracting pinned feeds from the river to avoid showing their posts twice breaks exactly
that. The predicate would carry an `IN` list of feed ids the reader can change while they are
scrolling: pinning mid-scroll would silently remove that feed's posts from pages not yet
fetched, and unpinning would insert posts already scrolled past. That is the class of bug the
keyset design exists to make impossible, reintroduced by a feature meant to be cosmetic. So
the pinned strip is a separate, bounded, uncursored query, the river beneath it is unchanged
in every column and predicate, and a pinned feed's newest post appears in both. One screenful
of duplication is cheaper than a cursor that lies.

### A quiet feed is a measurement, not a preference

Every `FeedDO` already computes `posts_per_day` on each poll — items published in a trailing
thirty-day window over thirty, in `measurePostsPerDay` — and already hands it back through
`subscribe` and the health call, where ADR-002 uses it to offer a velocity.

Asking the reader instead asks them to restate something the system measured, and produces a
setting that goes stale in silence when a newsletter becomes a daily. The measurement is taken
once per feed and shared by everyone following it, which is this app's whole argument applied
to one more thing, so the grouping derives from it and the reader is asked nothing. What the
reader is asked is the opposite question, and they answer it by doing something else: a feed
they have pinned or filed in a folder is a feed they have already grouped, and a derived group
has no business moving it.

## Decision

Two new tables, two new nullable columns, one derived grouping, and no new query on any path
that renders a river.

### Tags: two tables, and the index the list seeks on

A join table, in `0007-tags-and-pins.sql`, alongside the tag itself.

```text
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX tags_slug_idx ON tags (slug);

CREATE TABLE item_tags (
  tag_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (tag_id, item_id)
);

CREATE UNIQUE INDEX item_tags_timeline_idx ON item_tags (tag_id, published_at, item_id);
CREATE INDEX item_tags_item_idx ON item_tags (item_id);
```

`tags.id` is a `TypeID`, which is what a URL and a form field carry, so renaming a tag never
breaks a link. `slug` is the folded form uniqueness is taken over. The composite primary key
makes applying a tag twice a no-op the database decides rather than a count taken first.

"Saved posts tagged X, newest first" is one statement, composed the way `SearchQuery` in
`database/user-do.ts` already composes a page:

```text
select i."id", i."feed_id", i."title", i."url", i."summary", i."author",
       i."published_at", i."read_at", i."saved_at"
  from item_tags t
  join feed_items i on i."id" = t."item_id"
 where t."tag_id" = ?
   and (t."published_at" < ?
        or (t."published_at" = ? and t."item_id" < ?))
 order by t."published_at" desc, t."item_id" desc
 limit 50
```

`item_tags_timeline_idx` is what makes that a seek. Its leading column is the equality the
`WHERE` opens with, and the two behind it are the ordering columns in the order they are
ordered by, so the plan descends the index to the cursor, scans fifty entries backwards, and
stops: no temporary b-tree, no row read for any other tag, and a cost that is the page size
rather than the number of posts carrying the tag. Both keys point the same way, so an ascending
index answers the descending order by being scanned backwards and declaring `DESC` buys
nothing. The join behind it is fifty primary-key lookups, one per row the page returns, and
`item_tags_item_idx` serves the other direction — the chips drawn on a post, and the delete
that clears a post's rows when the post goes, which without it is a scan.

Two details look cosmetic and are not. The seek is written against the join table's copies,
while the projection returns the item's own `id` and `published_at` under those unqualified
names, so this list mints the app's one `NEWEST_FIRST` cursor rather than a second spelling no
other list could follow. And `saved_at IS NOT NULL` appears nowhere: every row in `item_tags`
belongs to a saved post by construction, so the filter is the join.

### The limits, and what each one protects

| Limit                | Value           | What it protects                                    |
| -------------------- | --------------- | --------------------------------------------------- |
| Tags per reader      | 100             | The picker, which is one unpaged query and one eye  |
| Tags per post        | 10              | The join table's size, and a row of chips that fits |
| Tag name length      | 32 UTF-16 units | A label rather than a note                          |
| Join rows per reader | 10,000          | Falls out of the two above and the saved cap        |

A hundred tags keeps the picker the same kind of thing as the rail: one unpaged read, drawn
whole, scannable without a search box of its own. A reader with four hundred tags has a second
junk drawer with a worse interface, and the honest moment to say so is at the hundred-and-first
rather than when they are looking for something. Ten per post bounds the arithmetic above and
is generous against how anybody labels: a post with eleven reasons to have been kept has none.

A name is what is left after trimming, collapsing internal whitespace to one space, rejecting
control characters and normalizing to NFKC — between 1 and 32 UTF-16 units. Uniqueness and
matching are over the case-folded form, so `Rust` and `rust` are one tag while the name shown
is the one first typed. Thirty-two is where a label is still a chip on one line beside four
others, and past which a reader is writing a note into a field the search serves better.

Every refusal is the discriminated union this app's RPC boundary already speaks —
`{ ok: false, reason: "tag-limit" | "tag-name-invalid" | "tag-exists" | "post-tag-limit" | "saved-full" }`
— never a throw and never a `Result`.

### Renaming a tag, and deleting one

Renaming updates `name` and `slug` on one row and touches no join row at all. That is the join
table paying for itself in a way a string column could not: renaming a tag with four hundred
posts under it is one write, and no post is rewritten by an operation that was not about
posts. A rename whose folded form collides with an existing tag is refused, naming it. Merging
is a different verb: it is destructive, the two sets can never be told apart again, and a
reader who wanted it asked for a rename.

Deleting a tag deletes its row and its join rows and deletes no post. A tag is a label, losing
the label is not losing the thing, and a reader who wanted the posts gone unsaves them; the
confirmation says how many posts stop carrying it, because that is the only consequence there
is.

Deletions in the other direction — a post leaving — are written by hand rather than delegated
to a foreign key. Four paths remove a `feed_items` row: unsaving, the velocity sweep, the
budget's reclamation, and unfollowing a feed. Each goes through one helper that clears
`item_tags` for those ids in the same batch. A cascade would be tidier and would put the
correctness of a bulk sweep behind whether a pragma is set the way the platform happens to set
it today; since each of those methods already owns its deletes, writing both is one line and
depends on nothing. Unsaving therefore drops a post's tags, and the post returns to whatever
rule would have taken it, unlabelled, because the labels described something kept.

### Tagging saves

Tags apply to saved posts only, and what makes that comfortable rather than annoying is that
**tagging an unsaved post saves it** — one gesture, with no ordering between two verbs for a
reader to get wrong. That puts tagging under the saved cap, where it belongs: tagging the
thousand-and-first post is refused with the same `saved-full` reason saving it is, and the
reader unsaves something. The cap keeps meaning what ADR-002 made it mean, there is no second
cap to explain, and the arithmetic above stays the arithmetic.

### A rule-applied tag is a tag

[ADR-009](./ADR-009-filter-rules.md) may flag a post as it arrives. When it does so by applying
a tag, the row it writes is the same row in the same table as one applied by hand, with no
column telling them apart: two kinds of label would make every query, chip and count ask which
kind it was looking at, for a distinction that changes nothing about what the reader wants.

Three things follow, and they are this ADR's side of that boundary. A rule may **apply** a tag
and may not **create** one, so no rule grows the tag list past its hundred, invents a name that
passed no validation, or resurrects a deleted one; a rule naming a deleted tag stops matching
and says so. A rule applying a tag saves the post, so a rule can fill the shelf — and when it
is full the rule stops applying rather than evicting, reported through its own surface, because
a rule may not do by accumulation what a reader may not do by hand. And a reader removing a
rule-applied tag has removed a tag: rules run on arrival, so nothing re-applies it to an item
already ruled on. If ADR-009 wants provenance for its own reporting, that is a column in its
tables, about rules, and not a second kind of tag in this one.

### Pinned feeds

`pinned_at INTEGER` on the reader's `feeds` table, nullable, the shape `read_at`, `saved_at`
and `unfollowed_at` already have — a timestamp rather than a boolean for the reason the others
are timestamps: it answers when as well as whether, so pin order is an ordering the reader
produced.

**No new query reads it.** `listFeeds` is already unpaged — the rail draws every subscription,
deliberately, because a rail that stops partway down has no way on — so the pinned set is a
partition of rows already in memory, chosen by a predicate rather than fetched by a statement.
That is the reason the flag is a column on the subscription rather than a table of its own: a
table would be a second read on a page that had already read the answer.

At most ten pins, and the eleventh is refused. A feed a reader never wants to miss stops
meaning anything at thirty, the strip has to sit above the river without becoming the page, and
ten ids sit well inside the 100-parameter bind limit `IDS_PER_LOOKUP` already works under.

Above the river means a strip that does not page and is not part of the timeline's cursor. It
asks its own question — for each pinned feed, its newest three unread posts — as one seek per
pinned feed down `feed_items_feed_timeline_idx`, which already exists and already leads with
`feed_id`. At most ten seeks of at most three rows, bounded by the pins rather than by how much
anybody published, drawn as a card per feed so a busy pin does not bury a quiet one. Beneath
it, `readingQueue` runs the statement it runs today and mints the cursor it mints today.

### The quiet group

`posts_per_day REAL` on the reader's `feeds` table, nullable, stamped from the value the feed
object already measures and already returns. It is written at three moments that are all
conversations the reader's object was having anyway: `followFeed`, every synchronization of
that subscription, and the health call `/reading/:feed` makes. No extra RPC, no walk over
subscriptions, no schedule — and no local recount, which would measure this reader's velocity
as much as the publisher's rate.

**A feed is quiet below one post a week**: `posts_per_day < 1 / 7`, against the thirty-day
window the measurement is taken over, so a monthly newsletter at 0.03 and a three-a-month blog
at 0.1 are in and a twice-weekly feed is out. The constant sits beside `BUSY_POSTS_PER_DAY`,
which is the same judgement from the other end — that one decides when a feed publishes enough
to be worth a velocity, this one when it publishes so little that it disappears. A trailing
thirty-day mean cannot move faster than a publisher does, so a feed near the line does not
flicker between page loads.

**The reader's own grouping wins.** A pinned feed, or one filed in a folder
([ADR-007](./ADR-007-folders.md)), is never moved into the quiet group however little it
publishes: an explicit choice beats a derived one, and a derived group that moves a feed out of
the folder somebody put it in is a feature arguing with its user. Only unfiled, unpinned
subscriptions fall in — which is also the escape hatch, without a setting, since a reader who
wants one out of the group pins it or files it.

It is drawn as the last section of the rail, holding the feeds nobody grouped and nothing
published, with the sum of their unread counts on it so an arriving newsletter is visible
unexpanded. No post moves: the quiet group is a way of drawing the rail, and a quiet feed's
posts sit in the river where their date puts them. A feed that was busy and goes quiet is the
one case the stamp lags — it is rarely stale, so it rarely synchronizes, so it joins the group
later than it could, until the health call corrects it. The other direction corrects itself,
because publishing is what makes a subscription stale.

### What the retention budget does not learn

`READER_BUDGET` counts posts, and nothing here creates a post. Tags and pins are metadata on
rows that already exist, so the sweep's arithmetic, its per-feed shares, its reclamation order
and its back-pressure are untouched, and a reader who tags every saved post they have is
exactly as far from the budget as one who tags none. Tagging does save, so a heavy tagger fills
the saved shelf faster — but the shelf has its own cap, its own refusal and its own place in
the budget, all of them ADR-002's and none of them moved.

The one place that is not quite true: **a join table is rows, and rows are storage.**
`item_tags` is invisible to a budget that counts posts while being perfectly visible to the ten
gigabytes the budget was sized inside. At its ceiling it is 10,000 rows of two identifiers and
two integers, about 200 bytes apiece with both indexes counted — **roughly two megabytes**
against the eight gigabytes of headroom the budget deliberately leaves, about 0.03% of the
slack. Putting that in the budget's arithmetic would be measuring a rounding error.

### Tier and cost

**Tags are Paid.** They are the feature with a table behind them, a cap to police and a
migration to maintain, and they mean something only to somebody who has kept enough to need
them. **Pinned feeds and the quiet group are Free**: they are basic legibility — seeing a feed
you already follow — and gating them would make the free tier worse for no revenue, since
neither costs a row.

The app has no entitlement mechanism today, so what this fixes is the tier rather than the
plumbing. The gate is one predicate at the RPC boundary answering
`{ ok: false, reason: "not-entitled" }` and one condition on the surface, and an entitlement
that lapses leaves every row in place: the reader keeps their saved posts and their tags, can
still filter by them, and cannot make new ones. Nothing here deletes anything on a billing
event. A kill switch sits beside the `saved-posts` entry in the app's flag catalog.

The cost is noise, and is worth showing rather than asserting.
`apps/uptime/app/lib/cost-rates.ts` prices storage in cents per GB-day and carries no line for
Durable Object SQLite at all, so the conservative move is its most expensive storage rate,
`d1StorageGbDay` at 2.5 cents. Two megabytes is 0.002 GB, so a reader at the saved cap with ten
tags on every post costs **0.005 cents a day, about 1.8 cents a year** — and ten thousand such
readers, every one at a ceiling almost nobody reaches, under two dollars. The writes are
`doRequest` and `doDurationMs` on requests the reader was already making.

### Events

Through `@sdxc/logger`, following
[ADR-033](../ADR-033-wide-events-as-the-logging-contract.md): identifiers and counts, never a
tag's name, which is text a reader wrote.

| Event                                      | Fields                     |
| ------------------------------------------ | -------------------------- |
| `user.tag.created` / `renamed` / `deleted` | `tagId`, `tags`, `items`   |
| `user.item.tagged`                         | `tagId`, `itemId`, `saved` |
| `user.tag.refused`                         | `reason`, `tags`           |
| `user.feed.pinned`                         | `feedId`, `pinned`         |
| `user.rail.quiet`                          | `feeds`, `quiet`           |

## Consequences

### Positive

- The saved cap becomes a shelf rather than a wall. A thousand posts under twenty labels is
  something a reader navigates; a thousand posts in one list is something they scroll past.
- A tagged list pages by the same keyset, under the same ordering, minting the same cursor
  shape as every other list in this app, and it seeks rather than sorts.
- Renaming a tag writes one row however many posts carry it, which is the property that decided
  the storage and the one a denormalized column could never have had.
- The pinned set costs no query: the rail already reads every subscription, so a pin is a
  predicate over rows in memory, and the river is untouched — same statement, same predicate,
  same cursor — so a feature about presentation cannot produce a paging bug.
- A feed that publishes monthly stops being buried by one that publishes hourly, without the
  reader being asked to describe a rate the system has already measured.

### Negative

- A pinned feed's newest posts appear twice on the home screen, which is the visible price of
  not letting a pin touch the timeline's predicate.
- Tags stop at the saved cap, so labelling something means being willing to keep it. Tagging as
  a way of triaging a river is not what this is.
- `published_at` is stored twice for a tagged post, safe only because that column is frozen —
  so the freeze is now load-bearing for a second reason, and anything that ever unfreezes it
  has two tables to reckon with.
- Four deletion paths each have to remember to clear `item_tags`. One helper is the mitigation;
  a forgotten call site is an orphaned row nothing else would notice.
- The quiet grouping lags for a feed that was busy and went quiet, because a quiet feed is
  rarely stale and a stale feed is what refreshes the measurement.
- A colliding rename is refused rather than merged, so a reader reaching for a merge is told no
  and moves the posts by hand. Merging is deliberately not built.
- Four limits — a hundred tags, ten per post, thirty-two characters, ten pins — are numbers
  from judgement rather than measurement, and each is a refusal a reader can meet.
- Tags are Paid in an app with nothing that can charge anybody, so the tier is recorded here
  and enforced by a predicate with no billing behind it yet.

### Neutral

- Nothing here crosses into a `FeedDO`, reads the catalog, or touches KV. It is per-reader
  state in a per-reader object, which is the isolation ADR-001 built.
- Sharing or publishing a tagged collection has somewhere obvious to live now, and nothing here
  builds any of it. OPML export stays a list of feeds, and the reading queue's `LIKE` search is
  unchanged.

## Alternatives Considered

**A delimited `tags` column on `feed_items`.** No new table, no join, one `ALTER TABLE`, and
the hot table stays one table. It cannot be indexed for the query the feature exists to answer,
matches substrings of other tags unless the delimiters are padded, and makes a rename a rewrite
of every row carrying the tag. It was the shape this ADR started in, and the query ended it.

**A JSON array in that column, with SQLite's JSON functions.** Correct matching, and `json_each`
makes the query expressible. It is still a scan — a keyset seek cannot descend an expression
index over an array member — inside a schema whose whole argument is that every list is a seek.

**Tags on any post rather than saved ones only.** More useful, and the version a reader would
ask for. Ten million join rows and two gigabytes of labels beside two gigabytes of posts, in an
object with one budget that counts posts and would see none of it — and every label would sit
on a row velocity or the budget may delete tomorrow.

**A join table keyed by tag name instead of id.** Removes the `tags` table entirely: the name is
the tag. Renaming then rewrites every join row, folded-form uniqueness has nowhere to live, and
a URL built from a name breaks when the name does.

**Pinned feeds as a filter on the timeline.** One list, no duplication, no strip: the river
simply shows pinned feeds first. It needs either a predicate carrying an `IN` list the reader
can change mid-scroll, or a sort key that is not `published_at`, and both break the property the
keyset cursor rests on.

**Pinning posts rather than feeds.** A pin on an item is a save with a better name, and this
design already has saves and is about to have tags. Pinning a feed answers what saving cannot:
which publications do I want to see having moved, before I start reading.

**Asking the reader which feeds are infrequent.** A setting with no measurement behind it, stale
the moment a publisher changes habits, asking a person to restate a number computed on every
poll. ADR-002 made this call for velocity — inference suggests, it does not act — and this is
the case where the derived answer changes nothing the reader owns, so it may act.

**A stored `quiet` flag with hysteresis around the threshold.** Removes any chance of a feed
flipping groups between page loads. A thirty-day trailing mean cannot move fast enough for that
to happen, so it is a column, a write path and a second threshold bought against a problem the
measurement's own window already prevents.

## Tests

Twenty-two behaviours, in the layout the app already uses: the pure paths in plain Vitest
against a SQLite `Database`, the object paths in `*.workers.test.ts`.

| #   | Behaviour                                                                                      |
| --- | ---------------------------------------------------------------------------------------------- |
| 1   | A tagged list pages by keyset and mints cursors of the shape the reading queue mints           |
| 2   | Paging a tagged list reads no row belonging to another tag                                     |
| 3   | A tagged list stays stable across pages while other posts are saved, tagged and unsaved        |
| 4   | Tagging an unsaved post saves it, and reports it as saved                                      |
| 5   | Tagging with the shelf full is refused for the same reason saving is, and tags nothing         |
| 6   | The hundred-and-first tag is refused, and the hundred remain                                   |
| 7   | The eleventh tag on one post is refused, and the ten remain                                    |
| 8   | A name is trimmed and its whitespace collapsed; one over 32 units is refused                   |
| 9   | Two names differing only in case resolve to one tag                                            |
| 10  | Applying a tag twice to one post writes one row                                                |
| 11  | Renaming a tag writes one row and leaves every join row untouched                              |
| 12  | A rename colliding with an existing tag is refused and names it                                |
| 13  | Deleting a tag removes its join rows, deletes no post and unsaves none                         |
| 14  | Unsaving a post drops its tags and returns it to the rule that would have taken it             |
| 15  | The velocity sweep, the budget's reclamation and an unfollow each leave no orphaned join row   |
| 16  | A rule may apply an existing tag and may not create one                                        |
| 17  | A rule applying a tag saves the post, and stops applying when the shelf is full                |
| 18  | The rail issues no extra query for pins, and the strip is built from the rows it already read  |
| 19  | The eleventh pin is refused                                                                    |
| 20  | The strip reads at most three unread posts per pinned feed, by one seek per feed               |
| 21  | Pinning and unpinning mid-scroll changes no page of the river and no cursor                    |
| 22  | A feed under one post a week is quiet; a pinned or filed one never is, however little it posts |

## Implementation

- [ ] `0007-tags-and-pins.sql`: `tags`, `item_tags`, their indexes, `pinned_at` and
      `posts_per_day` on `feeds`
- [ ] Mirror it in `database/schema.ts`, with `TAG_LIMIT`, `TAGS_PER_ITEM`, `TAG_NAME_LENGTH`,
      `PIN_LIMIT` and `QUIET_POSTS_PER_DAY` beside `SAVED_LIMIT`
- [ ] Name folding and validation, shared by the create and rename paths
- [ ] `createTag`, `renameTag`, `deleteTag`, `listTags`, `tagItem`, `untagItem` RPC, each
      answering a discriminated union
- [ ] `taggedQueue(tagId, options)`, built as `SearchQuery` is, seeking the join table's copies
      and projecting the item's own columns
- [ ] One deletion helper clearing `item_tags`, called by all four paths that remove a post
- [ ] `pinFeed` / `unpinFeed`, and `pinnedAt` on the summary `listFeeds` already returns
- [ ] The pinned strip on `/reading`, as a bounded per-feed read with no cursor
- [ ] Stamp `posts_per_day` on follow, on synchronization and on the health call
- [ ] The quiet section of the rail, with pinned and filed feeds excluded from it
- [ ] Tag chips on a post, the tag picker, and the tagged list route
- [ ] Copy for every surface and every refusal in `app/locales/en.ts` and `app/locales/es.ts`
- [ ] The entitlement predicate on the tag RPC surface, and the flag beside `saved-posts`
- [ ] The tests above, and the structured events

## References

- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the per-reader object, its indexes, and the frozen `published_at` this denormalization rests on
- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — saved posts, the retention budget, and the measured publishing rate the quiet group derives from
- [ADR-007](./ADR-007-folders.md) — grouping subscriptions, which the reader's own grouping wins by
- [ADR-009](./ADR-009-filter-rules.md) — the rules that may apply a tag on arrival
- [ADR-029](../ADR-029-pagination-package.md) — the keyset cursor a tagged list pages with
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the events follow
