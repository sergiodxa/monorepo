# ADR-002: Canonical Feed Objects and Lazy Per-Reader Timelines

## Status

**Proposed** - 2026-09-15

Supersedes the polling and storage halves of
[ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md). Its read path — one
person's posts in one object, paged by keyset — is kept exactly as it is, and is the
reason this design exists in the shape it does.

## Background

[ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) put everything a reader
owns in one Durable Object: settings, the feeds they follow, and every post from them.
It named the cost of that in its own Consequences — "posts are stored once per follower,
and a popular feed is polled once per follower" — and accepted it, on the grounds that
conditional requests make the second cheap.

Cheap is not the same as bounded. External traffic under that design grows with
subscriptions rather than with feeds, and the constant is one HTTP request per follower
per interval whether or not the feed changed. Ten thousand readers following one feed at
the hourly default is ten thousand requests an hour to one origin, forever, to learn the
same fact. That is a number the origin notices, and the one thing no amount of retention
or backoff inside a reader's object can reduce.

`FeedDO` splits ingestion away from projection: one object per canonical feed URL owns
the fetching, and each reader's object keeps the materialized timeline ADR-001 was built
around. There are no readers in production yet, so this is built directly, with no
migration path for existing data.

## Context

### The invariant this exists to establish

External RSS/Atom traffic scales with the number of unique feeds, not with the number of
subscriptions. Ten thousand readers following one feed produce approximately one polling
process, owned by one object — and one write when it finds something. Publication cost
stops responding to subscriber count entirely.

### The read path does not change

The home screen is still one list, newest first, mixing every followed feed, and it
still pages. ADR-001's reasoning stands untouched: assembling that list from N feed
objects at read time is a fan-in whose cost grows with how many feeds a person follows
and is paid on every scroll, and a merged list across objects has no stable cursor. The
per-reader copy of item metadata is what makes the timeline one indexed seek, and it
stays.

So this is not "shared storage instead of per-user storage". It is shared _ingestion_
with per-reader _projection_, and the only new question is how a post gets from the
first to the second.

### Notification is the work that disappears

Telling ten thousand readers that a feed moved is ten thousand writes, wherever they are
arranged — inside the alarm that found the items, or spread over a queue that retries
them. Arranging them better does not reduce them, and it is the wrong thing to optimize:
most of those readers will not open the reader today, and the write exists only so that
they can find out when they do.

The comparison that write encodes is `head > cursor`. Both sides of it already exist:
the head in the feed's own storage, the cursor in the reader's. Publishing the head
somewhere shared lets the reader make the comparison for themselves, at the moment they
ask a question that needs the answer. Then the publication writes once, and nobody who is
not reading pays anything at all.

That is the trade this ADR makes: notification becomes pull rather than push. A feed
announces where it has got to; readers find out by looking.

### What the freshness index is allowed to be

A number per feed, and nothing else. No item payloads, no subscriber lists, no per-reader
state — because per-reader state in a shared store is exactly the fan-out coming back
through a different door. One key per feed, written by its object, read by whoever cares.

It is also a hint rather than a fact. Workers KV is eventually consistent: a reader can
see a head lower than the one the feed has actually reached, and will then believe they
are current when they are not. The cost of that is a delay, and the next check corrects
it, because the head in the feed object only ever moves forward and the items are all
still there. Correctness lives in the two SQLite databases. The index only decides when to
go and look.

### Nothing knows which feeds exist

Feed objects are addressed by name, so no lookup is needed to reach one — and the cost of
that is that nothing anywhere holds the list. There is no query that answers how many
feeds the system has indexed, no way to find the object behind a URL somebody pasted into
a support ticket, and no surface to run maintenance from. A Durable Object namespace is
reachable one name at a time and enumerable by nothing.

That is a gap in operations rather than in the product, and it is filled by a catalog: a
row per feed, written when a feed is first followed, read by administrators and by nobody
rendering a page. Having it also settles a question the design would otherwise answer by
arithmetic — what a feed's object is called — and a table that already has to exist is a
better place for that than a function every caller has to agree on forever.

What the catalog must not become is a store the read path depends on. A row is consulted
once, to turn a URL into an id; from then on the id is written down where it is needed, and
no request that renders anything goes near the table.

### One cadence, for everybody

ADR-001 let a reader choose how often their feeds were checked — hourly through daily —
which was natural when the schedule sat beside that reader's own copy of the feed. A
shared poller has no such reader to ask: one document, one schedule, and six answers to
reconcile.

The per-reader cadence is removed rather than reconciled. Every feed is polled once a day,
the same for all of them, and a reader who wants something now still has the on-demand
check that already exists.

Taking the shorter cadences away rather than keeping the shortest is the deliberate half
of this. A setting whose only effect is to fetch a publisher's document more often is a
setting that spends somebody else's bandwidth, and the reader who asks for it cannot tell
whether it helped: a blog that posts weekly answers `304` a hundred and sixty-seven times
out of a hundred and sixty-eight at hourly. Daily is what the median feed actually
justifies, and it is one number to revisit later if real publishing rates argue for it.

The interval lives in one place, so changing it is an edit rather than a search.

### Limits that shape the design

| Limit                            | Value                    | Consequence                                                  |
| -------------------------------- | ------------------------ | ------------------------------------------------------------ |
| SQLite storage per object        | 10 GB                    | Both object types need a retention cap                       |
| Max SQL parameters               | 100                      | Batch inserts chunk, on both sides of the copy               |
| Alarms per object                | 1                        | Poll and purge share one; retention and catch-up the other   |
| KV key size                      | 512 bytes                | The key is built from the feed id, not its URL               |
| KV keys per bulk read            | 100                      | A freshness check chunks the subscription list               |
| KV consistency                   | Eventual, up to a minute | The head is a hint, never a source of truth                  |
| KV writes to one key             | 1 per second             | Far above any feed's poll cadence                            |
| Request throughput per object    | ~1K req/s                | A very popular feed's object is a real hot spot              |
| `COUNT(*)` over a large D1 table | Full scan                | An indexed-feed figure is cached, never computed per request |

## Decision

Two Durable Object classes, one shared KV key per feed, and a D1 catalog off the read
path.

| Store      | One per            | Holds                                                                        |
| ---------- | ------------------ | ---------------------------------------------------------------------------- |
| `FeedDO`   | Canonical feed URL | Feed metadata, HTTP validators, canonical items, subscribers, the poll alarm |
| `UserDO`   | OIDC subject       | Settings, subscriptions with their cursors, materialized posts, read state   |
| KV head    | Feed id            | The feed's latest head, as a freshness hint                                  |
| D1 catalog | Deployment         | Feed identity, and one row per feed that has ever been created               |

`FeedDO` owns ingestion. `UserDO` owns the reader's view. A `UserDO` never fetches an
external feed, and a timeline read never pages a `FeedDO`. Neither of the other two stores
is read to decide what a reader sees: KV answers when to go and look, and the catalog
answers which object a feed is, once, when somebody first follows it.

### Feed identity

A `FeedDO` is addressed by `env.FEED.getByName(feedId)`, where `feedId` is the identifier
the catalog assigned that feed the first time anybody followed it. Identity is assigned
once and then stored, rather than derived from the URL on every use.

The canonical URL is still what decides whether two people are following the same feed. It
is produced once, when somebody follows a feed, by the existing two steps in the follow
path:

1. `normalizeFeedUrl` — trims, assumes `https` when no scheme was typed, rejects anything
   that is not `http:` or `https:`, drops the fragment. `URL` itself lowercases the scheme
   and host and resolves dot segments.
2. `Feed.discover` — follows redirects and reports the URL the response finally came
   from, so a person who pastes a site address and a person who pastes its feed address
   converge on one name.

Normalization stops there, deliberately. Folding a trailing slash, stripping a query, or
lowercasing a path would make two genuinely different feeds collide into one object, and a
collision here is two publications merged into one reader's timeline with no way back. The
failure mode of being too conservative is a second object for a feed that also answers at
a second URL, which costs one extra poll and nothing else.

That URL is then exchanged for an id, once, through the catalog:

```text
INSERT INTO feeds (id, feed_url, …) VALUES (…)
  ON CONFLICT (feed_url) DO UPDATE SET feed_url = excluded.feed_url
  RETURNING id
```

`UNIQUE (feed_url)` is what makes this converge. The first person to follow a feed mints
its id; everybody after them conflicts on the URL and gets the same id back, which names
the object that already exists, holds their items and is already being polled. Two people
following the same feed in the same second both go through one unique index and come out
with one answer.

The upsert is spelled as `DO UPDATE … RETURNING` rather than `DO NOTHING … RETURNING`,
which is the shape that looks right and is not: SQLite returns no row for a conflicting
insert that does nothing, so the second follower of every feed would silently get back
nothing at all. Writing the URL back onto itself is what makes the statement always answer.

**Identity survives normalization.** A name derived from the URL would tie every object to
the exact normalization function that produced it, forever: tightening the rules later
would send new subscribers of a feed to a different object than its existing ones, with no
way to reconcile the two. An assigned id is a fixed point. Change the normalization, update
the `feed_url` column, and the object, its items and its cursors never notice. That is the
reason to pay for an id rather than compute one, and it is worth more than the round trip
it costs.

The id is also short and fixed-width, which is the other thing the URL was bad at: it is
what the freshness key is built from, and a KV key stops at 512 bytes where a URL does not.

Discovery is the only external request made outside a `FeedDO`, it runs in the follow
controller, and it runs once per subscription rather than on a schedule. The catalog
lookup joins it there, on the same path, and neither happens again.

### FeedDO storage

Three tables, migrated at boot by the same journalled runner `UserDO` already uses.

**`feed`** — one row, pinned by `CHECK (id = 1)` the way `settings` is: the canonical URL,
title, site URL, description, language, image; `etag` and `last_modified`; `last_status`,
`last_http_status`, `last_error`, `failure_count`, `next_attempt_at`; `last_fetched_at`;
the head counter; the measured posts per day; and `purge_at` for an object nobody follows
any more.

**`items`** — `id` (a `TypeID` over a generated UUID, minted on discovery), `guid`,
`sequence`, `revision`, `title`, `url`, `summary`, `author`, `published_at`,
`content_hash`, `created_at`, `updated_at`. No post body: ADR-001's
`0002-drop-item-content` already established that a reader's list renders the title, the
summary and the author, and this object stores strictly less than that object did.

Three indexes: `UNIQUE (guid)` — dedupe, and the correctness guarantee rather than an
optimization, since without it a feed that re-serves an entry duplicates it on every poll
forever; `UNIQUE (revision)` — the synchronization seek; `(published_at, id)` for the
retention sweep. `guid` needs no `feed_id` beside it any more, because the object is the
feed.

**`subscribers`** — `user_id` primary key, `subscribed_at`. Membership and when it
started, and nothing else; there is no per-subscriber cadence to record now that every
feed polls on the same schedule. The primary key rather than an application check, so
`subscribe` is idempotent because the database says so, and so an unsubscribe matches
exactly one row.

The table survives the removal of fan-out, and is not replaced by a count. Three things
read it, and none of them is a notification: whether a given reader is subscribed, which
subscription an unsubscribe removes, and whether the feed has reached the end of its
life.

Two of those want different queries. The lifecycle check runs on every unsubscribe and
every alarm and only ever asks whether anybody is left, so it is
`SELECT 1 FROM subscribers LIMIT 1` — a question the index answers from its first row.
`COUNT(*)` is for the places that show or record the number, and nowhere else.

### The feed catalog

A D1 database, bound as `PLATFORM_DB` the way `apps/auth-saas` and `apps/blog-saas` bind
theirs, holds one row for every canonical feed the system has created. It does two jobs: it
assigns feed identity, and it is the only place the list of feeds exists. It is not a
subscription table, not a copy of feed contents, and not read to render anything.

One table, migrated through `wrangler d1 migrations` from `database/migrations/`, reached
through `createD1DatabaseAdapter` from `@sdxc/data-table-d1`, and wrapped by
`database/registry.ts` — the one module that holds the binding, so the follow controller
asks for an id rather than writing SQL. `AGENTS.md` currently names three places that may
reach a Cloudflare API; this adds a fourth, and `database/feed-do.ts` is a fifth that the
rule already covers by being a Durable Object.

**`feeds`** — `id`, `feed_url`, `title`, `created_at`, `last_active_at`, `retired_at`.

- **`id`** is a `feed_…` `TypeID`, minted by the upsert that first inserts the row. It names
  the Durable Object, it is the body of the freshness key, it is what a `UserDO` stores
  against a subscription, and it is the handle an administrative URL is built from. One
  identifier, everywhere a feed is referred to.
- **`feed_url`** is the canonical URL, `UNIQUE`. That index is the whole convergence
  guarantee: one row per feed, therefore one id per feed, therefore one object per feed.
- **`title`** is a denormalized copy, so a list is readable and searchable without waking
  anything. It lags what the object holds, and the object is right.
- **`created_at`**, **`last_active_at`**, **`retired_at`** — when the feed was first
  indexed, when it last published anything, and when its last subscriber left.

Two indexes: `UNIQUE (feed_url)`, and `(created_at, id)` for the keyset paging an
administrative list would use, spelled the way every other paged list in this app is.

There is no `do_name` column. The name is the id, so a feed's object is reachable from its
row by `getByName(row.id)` and from a subscription without a row at all.

Four moments write it, and nothing else does:

- **Creation.** The upsert in Feed identity, on the follow path, before any object exists.
  The row precedes the `FeedDO` rather than being registered by it, which is what lets the
  id name the object.
- **Activity.** `last_active_at` is stamped by the `FeedDO` where the head is published, so
  it moves only when a poll actually stored something. A `304` writes nothing and an idle
  feed writes nothing, which makes the column mean what an administrator would assume it
  means. The stamp is best-effort: a failed write costs a wrong timestamp in a list, and
  nothing else.
- **Retirement.** The last unsubscribe sets `retired_at` instead of deleting the row, so a
  feed serving out its grace period is visible as exactly that — and so a reader who
  re-follows inside the week is handed the same id and the same object, with its items still
  in place. A subscriber arriving inside the week clears it.
- **Deletion.** The purge that clears the object's storage and its head key deletes the row
  with them. Only then, because a row deleted while the object still holds items would hand
  the next follower a new id, a new object, and no way ever to reach the old one.

Nothing on the read path reads D1. Rendering a timeline, paging a frame, checking freshness
and marking a post read cross two SQLite databases and one KV namespace between them and
never this one — a subscription stores its `feed_id`, so a reader who already follows a
feed needs no lookup to reach it. The catalog is on the follow path and nowhere else.

That does change what the catalog is. It is authoritative for identity — the URL-to-id
mapping exists here and is not reconstructible, because a Durable Object namespace cannot
be enumerated — while remaining non-authoritative for everything it was already
non-authoritative for: items, subscribers, heads, and what any reader sees. Losing it would
not corrupt a single reader's timeline, and would not lose a single item; it would lose the
ability to reach the objects holding them. That is a real dependency, taken deliberately,
and it is the same dependency every other app in this monorepo already takes on
`PLATFORM_DB`.

What the catalog makes possible, none of which is built here: a count of indexed feeds,
an administrative list and search, resolving the object behind a URL from a support
ticket, `refresh("admin")` against one feed, telling an active feed from a retired one, and
sweeps across feeds that need attention. The count is the one with a trap in it — `COUNT(*)`
over a million-row D1 table is a scan — so a figure on a public page is cached rather than
computed per request, which is the hot-path rule applied to the page most likely to break
it.

### Two numbers per item, and why

Each item carries three identifiers doing three different jobs.

- **`id`** is a `TypeID` over a fresh UUID, minted when the item is first discovered, and
  is the permanent identity a reader's copy is keyed by. A publisher's GUID is never a
  primary key: it is chosen by somebody else and can be reused, re-scoped or malformed.
- **`guid`** is the publisher's own identity, as `@sdxc/feed` already resolves it — Atom
  `id`, RSS `guid`, JSON Feed `id`, falling back to the entry URL. It exists to recognize
  the same entry on the next fetch, and nothing else reads it.
- **`sequence`** is the discovery order, assigned once and never moved.

One monotonic counter in the `feed` row issues both `sequence` and `revision`, and each
tick it issues is used exactly once:

- an insert takes a tick and writes it to both `sequence` and `revision`;
- an edit to an already-known item takes a tick and writes it to `revision` alone.

So `sequence` stays a pure record of discovery, as it must, and `revision` is a total,
gap-free, strictly increasing order over "things a subscriber has not seen yet".
Synchronization reads `WHERE revision > cursor ORDER BY revision ASC LIMIT n`, which is a
seek down the unique index. The head published to KV is that counter's current value.

The counter lives in the `feed` row rather than being a `rowid`. SQLite reuses the highest
`rowid` after a delete, and retention deletes items: a counter that can go backwards would
strand every cursor above it, and would publish a head that told every reader to forget
what they already had. This one only ever moves forward, including through a sweep that
empties the table.

### Item edits

ADR-001's behaviour is kept: a publisher who fixes a typo updates the stored post, and
three columns are frozen against them — `read_at`, so an edit does not resurrect a read
article; `id`, the key a reader's copy is joined by; and `published_at`, the leading
cursor column, whose movement would make an in-flight cursor skip posts mid-scroll.
`content_hash` is taken over the displayable projection with the date excluded, because
feeds that re-date every entry on every poll exist.

The second counter is what carries that behaviour across the split. Without it an edit
would never reach a reader who had already materialized the item, because the item's
sequence is below their cursor forever. Bumping `revision` puts the item back in front of
every subscriber exactly once, and the reader's side applies it as an upsert on `id` with
the same three columns frozen — so the rule is spelled once per side and means the same
thing on both.

### Polling

Only a `FeedDO` fetches. One entry point, `refresh(reason)`, so a scheduled poll, a
reader's "check now", and a future WebSub ping are the same code path taking different
reasons. WebSub is not implemented here; `reason` is what makes it a later trigger rather
than a later rewrite.

On the alarm: fetch with the stored `etag` and `last_modified` as `If-None-Match` /
`If-Modified-Since` through `Feed.fetch`; a `304` stamps the row and returns, with no
parse, no item write and no publication. A document that does come back is classified
against a single index-only prefetch of `(guid, content_hash)` into inserts, no-ops and
edits, exactly as `database/refresh.ts` already does it — that module moves to the feed
object almost unchanged, because it already takes a `Database` rather than an object.

Inserts and edits take their ticks and the head advances. Only then, and only if at least
one item moved, is the new head published. A poll that changed nothing writes nothing
outside its own row.

**The alarm must never reject.** A rejected alarm is retried by the platform, which would
re-fetch an origin that already answered. Every outcome is a value, the re-arm sits in a
`finally`, and failures back off exponentially through `next_attempt_at` from five minutes
to a day, cleared by any answer including a `304`.

The next poll is a day out, from one `POLL_INTERVAL_MS` constant that every scheduling
path reads. No table is consulted to decide when: the schedule does not depend on who is
subscribed, only on whether anybody is.

`REFRESH_INTERVALS`, `settings.refresh_interval_hours`, its `CHECK` constraint,
`setRefreshInterval` and the control that set it all go. A backoff still overrides the
cadence downward for a feed that is failing, and `refresh("manual")` still ignores both.

### The freshness index

When a poll stores something, the feed writes one key:

```text
feed:<feedId>:head -> "153"
```

One write per publication, whatever the subscriber count. The value is the head counter as
a decimal string, and the key holds nothing else — no items, no subscribers, no per-reader
cursor, no flag. Anything per-reader in a shared store would be the fan-out this design
removed, wearing a different name.

It goes in the `KV` namespace the app already binds, beside sessions and the OIDC
discovery cache, under a prefix of its own. That namespace was described in ADR-001 as
holding derived state a cold isolate can rebuild, and this is exactly that: every head in
it is a copy of a number that lives in a `FeedDO`, and the object it came from is still
there. Losing the namespace signs everybody out and makes every feed look current until
its next poll republishes, which is a delay measured in one polling interval and not a
loss of anything owned.

A head is also published on two paths that are not polls: when a `FeedDO` is initialized,
so the key exists from the first subscription rather than from the first publication, and
after a purge-and-revive, so a reader never reads a head belonging to a table that has
been emptied.

### Staleness is derived, never stored

There is no `dirty` column and no `target_sequence` column. A subscription is stale when

```text
kvHead > cursor
```

and current otherwise, computed at the moment somebody asks. State that is derived cannot
drift, cannot be missed by a lost notification, and cannot be set by one path and left
unset by another. The two numbers it is derived from each have exactly one writer: the
head by the feed that owns it, the cursor by the reader that owns it.

A head KV does not have is read as "not stale". The alternative — treating an absent key
as stale — turns an empty or cold namespace into a full synchronization for every reader
on every request, which is a stampede triggered by the failure of a hint. Absence means
"no reason to go and look", and the feed's next poll supplies one.

### UserDO changes

The `feeds` table gains `feed_id` and `cursor`, and loses the columns that described a
fetch it no longer makes: `etag`, `last_modified`, `failure_count`, `next_attempt_at`.

`feed_id` is the catalog's identifier for the feed, copied into the subscription when it is
created. It names the object to synchronize from and builds the key to read the head from,
so a reader who already follows a feed reaches everything about it without a lookup. `id`
stays a local `TypeID` and keeps its own meaning: it is what `/feeds/:feedId` is built
from, and those URLs are this app's, scoped to one reader, and not something to expose a
global feed identifier through.

It also gains `velocity`, which is this reader's answer for this feed and is described
below.

`cursor` is the greatest revision this reader has ruled on, and it is the only
synchronization state they store.

`feed_items` keeps its shape, its four indexes and its `id`, with one change of meaning:
`id` is now the canonical item id assigned by the `FeedDO`, copied verbatim. That is what
makes synchronization idempotent — the same item arriving twice is an upsert on a primary
key, not a duplicate — and it is why the id must be minted on the feed side.

Feed health moves with the fetching. `/reading/:feed` reads the feed's status from its
`FeedDO` in one RPC call when it renders that page, which is a call for one feed on a page
about one feed, and that call returns the true head as well — so the page about one feed
never depends on the hint.

### Opening the reader

`openReader(options)` is one RPC that answers the question the `/reading` controller
actually has, and it runs inside the `UserDO`, where the cursors are:

1. Read the first timeline page out of local SQLite.
2. Read every subscription's `feed_url` and `cursor`.
3. Bulk-read those feeds' heads from KV.
4. Compare, and collect the stale ones.
5. Return the page together with the staleness it found.

It returns a page and a count, never a promise of fresher data:

```text
{ timeline, freshness: { stale: string[], count: number } }
```

The controller renders the page immediately and tells the reader, through
`ctx.i18next.t` with keys in both `en.ts` and `es.ts`, that newer posts exist — which is
something the old design could not say at all, because a reader who was away had no idea
how much was waiting until it arrived.

`readingQueue` and `feedTimeline` are unchanged and check nothing. Paging a frame is not
opening the reader, and `lazy-frame` fetches enough pages that a KV read per page would be
a cost with no reader-visible effect.

### Bulk reads

Step 3 builds one key per subscription from the `feed_id` already in the row — no
derivation, no hashing, nothing to agree on at read time — and issues them as a bulk read,
chunked at KV's hundred-key limit and never a loop of single gets. A reader following thirty feeds issues one request; a hundred feeds, one request;
two hundred and fifty, three. The chunks run concurrently, so the check costs one
round trip regardless of how many subscriptions it covers, and a reader with many feeds
pays the same latency as a reader with few.

### Synchronizing a stale feed

Identified, not notified — but from there the protocol is untouched. Inside the `UserDO`,
for one stale subscription:

1. Read `cursor`.
2. `getItemsAfter(cursor, limit)` on that subscription's `FeedDO`.
3. Drop anything already past this subscription's velocity, which is a decision about the
   item rather than a failure to handle it.
4. Upsert what is left on `id`, chunked to fit the 100-parameter bind limit, with
   `read_at`, `published_at` and `id` frozen on conflict.
5. Set `cursor` to the greatest revision the page accounted for — after the write, never
   before.
6. Repeat while a page comes back full, up to a bounded number of pages per run.

**The KV head never touches the cursor.** It is read to decide whether to call the feed,
and then it is finished. Assigning `cursor = kvHead` would advance past items that were
never stored, using a number from an eventually consistent cache, and no later check could
notice because the comparison it feeds would then be satisfied. The cursor is only ever
set to a revision that came back from the feed and was written here:

```text
kv head 121, cursor 118
  -> getItemsAfter(118)
  -> persist 119, 120, 121
  -> cursor 121
```

"Accounted for" is doing exact work in step 5. An item stored and an item dropped by
velocity are both decided, so the cursor may pass either; an item whose write failed, or
that the run never reached, is neither, and the cursor must stop below it. The rule is not
"everything written" — it is "nothing the reader has not ruled on".

Order is the entire correctness argument. A run that dies between step 4 and step 5 leaves
a cursor pointing at work already done, and the retry re-upserts rows it already wrote,
which changes nothing. A cursor advanced first would silently skip whatever it skipped
past, permanently, with no signal that it happened — and unlike a lost notification, no
later freshness check would ever report it, because the cursor would be sitting at or
above the head.

### Where synchronization runs

The timeline response never waits for it. What was found stale in `openReader` is
synchronized after the page has been returned:

- up to eight feeds, four at a time, through `ExecutionContext.waitUntil` — which means
  `bootstrap/worker.ts` starts taking its `env` and `ctx` arguments rather than reading
  `env` off the module;
- anything past that leaves the `UserDO` alarm armed a minute out, to carry on.

A reader back after a month with two hundred stale feeds gets their timeline in one
indexed seek, the eight most useful feeds behind it, and the rest over the following
minutes without a single request waiting on any of it. The catch-up alarm is the idiom
this app already uses: the current refresh alarm re-arms in a minute rather than an
interval when a firing leaves feeds unattempted, and this is the same rule applied to a
different kind of leftover work. No queue, no consumer, no dead-letter path, and no
message that can be delivered twice — because there is no message.

Stale-while-revalidate, and the client half of it already exists: `lazy-frame` and the
sidebar frame re-fetch as a reader moves, so newly synchronized posts appear without a new
mechanism.

Pagination stays stable underneath all of this because the timeline's cursor is a keyset
over `(published_at, id)` and neither column ever moves. An item synchronized while a
reader pages is newer than the page they are on, or older than it, and either way it lands
where its own key says it does.

### Subscribing

The follow controller resolves what was pasted to a canonical URL, then:

1. The catalog upsert exchanges that URL for a `feedId` — minting one for a feed nobody
   has followed, returning the existing one for a feed somebody has.
2. `FeedDO.subscribe(userId)` on `getByName(feedId)` — idempotent, records the subscriber,
   fetches the feed if this object has never fetched, cancels any pending purge and its
   `retired_at`, publishes its head, and arms the daily alarm if it is not already armed.
3. It answers with the feed's metadata, its head, and a bounded page of recent items —
   the newest 50, which is what a subscription was already worth under ADR-001, where
   following a feed stored the document it carried.
4. `UserDO` writes the subscription with its `feed_id`, at the default velocity, stores
   those items, and sets `cursor` to the greatest revision among them. The measured posts
   per day comes back with the metadata, so a feed that is obviously a firehose can be
   raised the moment it is followed rather than after it has flooded anything.

Step 1 is the only step that can hand back an object somebody else created, and that is the
point: the second follower of a feed skips the fetch entirely, because step 2 finds an
object that has already done it.

A new subscriber does not inherit the object's whole archive. Everything after that
initial page goes through the cursor, and the first freshness check after the subscription
compares against a head that is already published.

### Unsubscribing and the end of a feed's life

`UserDO` drops the subscription and its posts — ADR-001's semantics, unchanged: unfollowing
takes its posts with it — and then calls `FeedDO.unsubscribe(userId)`. Posts first, so a
turn that fails between the two leaves the feed followed rather than its posts orphaned.

`unsubscribe` deletes the subscriber row and then asks whether any remain, with the
existence query rather than a count. When none do, the `FeedDO` stops polling immediately,
stamps `retired_at` in the catalog, and sets `purge_at` to a week out, re-arming its single
alarm for that instead. An alarm
firing with subscribers polls; an alarm firing without them purges. One alarm, and which
job it is doing is a question about the `subscribers` table rather than a flag.

A subscriber arriving inside that week clears `purge_at` and resumes polling against
canonical items that are all still there, which is the point of the grace period: an
unfollow and a re-follow a day later costs one fetch, not a re-download of everything.

A purge deletes the feed's head key and its catalog row along with its storage. Leaving
the key would advertise a head for an object that no longer has the items behind it, and
the first subscriber to revive the feed would read a stale hint the revived counter cannot
yet satisfy; leaving the row would list a feed that is gone. Nothing keeps state for a feed
nobody reads, in any of the three stores.

### Retention

ADR-001's cap of 500 posts per feed does not carry over, because the row it was sized
against no longer exists. That number was written while `feed_items` still had a `content`
column holding the post body, capped at the 2 MB a Durable Object row allows; the body was
dropped a couple of hours later by `0002-drop-item-content`, and the retention constant was
never re-derived. It has been bounding a schema it was not chosen for ever since.

What a row costs now: an id, a guid, a title, a URL, a one-line summary, an author, a
digest and five integers — something like 700 bytes of field, call it a kilobyte and a half
once SQLite's own overhead and three indexes are counted, and two kilobytes to be
pessimistic. Against the 10 GB an object gets, that is roughly **five million items per
object**. Five hundred was using one ten-thousandth of the space available.

The one figure that breaks that estimate is the stored summary, capped at 100,000
characters. The timeline renders it on the title's own line, clipped — the view's own
comment calls it "the far end of a summary the row never shows" — so a hundred kilobytes
are stored to display about a hundred characters. Capping it near what is rendered is what
makes a row's cost predictable, and it is the change that makes the numbers below safe
rather than merely likely.

`FeedDO` keeps its newest **one million items** by `revision` and drops the rest. One rule,
counting rows, with no age to it.

An age rule was the obvious second half of this and it is wrong, because of when it fires. A
count bites first only for a feed above roughly two thousand seven hundred posts a day;
below that — which is every feed anybody actually follows — the age rule is the binding one,
and it deletes from an object that had room to spare. A blog posting weekly would be held to
its last fifty-two entries while its object used a hundred kilobytes of the ten gigabytes it
was given. An age rule only ever fires when it is not needed, so there is not one.

A million items is around two gigabytes at the row size above, a fifth of the object, and
the same figure the reader side uses for the same reason: room for the estimate to be wrong
by five times. For anything publishing less than a few thousand posts a day it is years of
history, which is what the age rule was reaching for and misses.

Being generous here is cheaper than being generous anywhere else, and that is the point: one
object is shared by every subscriber of the feed, so its history is paid for once globally
instead of once per follower. Under ADR-001's cap, a site publishing a hundred posts a day
held five days of history for everybody.

Pruning runs on `revision` rather than on a date. It is the order in which this object
decided things, it is exactly the order cursors move through, and the rows at the bottom of
it are by construction the ones furthest behind every subscriber. A publication date would
not be: a publisher posting an entry dated four years ago has published something new, and
pruning on that date would delete it before a single reader synchronized it.

Deleting the oldest cannot strand a cursor: cursors only move forward, and a reader whose
cursor is older than everything left simply receives what remains, which is everything they
could still be shown. The head counter is untouched by a delete, which is the invariant the
counter's placement buys and the reason a sweep publishes nothing.

`UserDO` has no age rule of its own, for the reason the feed side has none: a sweep that
drops posts read over a year ago fires on an object holding five hundred rows as readily as
on one holding a million, and deletes reading history from a reader with three feeds who is
using a thousandth of their space. Age belongs on this side only where the reader asked for
it, which is velocity, below. Everything else waits for actual pressure.

Its one rule is a budget rather than a per-feed number, because a per-feed number is
wrong at both ends: a reader following one feed would be held to a cap sized for somebody
following two hundred, and a reader following two hundred would be allowed two hundred
times more than one of them. The object is what has a limit, so the object is what gets the
figure. **One million posts** — around two gigabytes at the row size above, a fifth of the
object, which leaves the estimate room to be wrong by five times — and a feed's share of it
is that budget divided by how many feeds the reader follows. One feed may fill it alone; a
thousand feeds get a thousand posts each.

The share is enforced only while the object is over budget. That is what keeps the division
from being destructive: a reader under the budget keeps everything, so following a second
feed does not halve the history of the first, and following a
fifty-first does not quietly take rows from the other fifty. Recomputing the share when a
subscription is added would do exactly that — and it would ratchet, since unfollowing that
feed raises the share back without returning anything it deleted. A reader would lose
history as a side effect of an unrelated action, on an object using two per cent of its
space.

So the sweep asks in order: is this object over budget at all; if so, which feeds are over
their share; and it takes read posts from those, oldest first, leaving feeds under their
share untouched. A quiet feed is never charged for a prolific one, which is the property a
per-feed cap was there to protect, and nothing is deleted while there is room.

That leaves exactly two ways a post can be removed from a reader's timeline: a velocity they
set, or a budget they are over. Consent, or pressure. Nothing is deleted for being old on an
object with room for it.

**When nothing is reclaimable, the object stops taking posts rather than deleting them.**
Every feed at the default velocity is the case this has to survive: the budget reclaims only
what was read, and a reader who reads nothing leaves it with nothing to take. The sweep then
has one honest move left, and it is not to start deleting posts nobody agreed to lose.

So a feed over its share on an object that is over budget and cannot be reclaimed stops
materializing. Its cursor stays where it is, its subscription stays stale, and the freshness
check already has somewhere to say so. Back-pressure rather than data loss: nothing the
reader has is taken, and what they have not got yet waits.

That leaves three ways out, all of them the reader's: read some of it, which makes it
reclaimable; set a velocity on the feeds doing the flooding, which is consent to drop the
rest; or unfollow them. A feed left paused long enough does eventually lose posts — the
`FeedDO` prunes past its million whatever any reader is doing — but that happens at the
shared layer, to a copy that is not this reader's, and on a firehose fast enough to have
paused them it is the one loss in this design that no configuration can refuse.

The budget is therefore one number with two consequences, not a soft target and a hard cap:
reclaim at it, and refuse at it when reclaiming finds nothing. It is set a fifth of the way
into the object rather than at its edge because the second consequence is one a reader
notices.

### Velocity

Retention above answers "what does this object have room for". It cannot answer the
question a reader actually has, which is how long a post from _this_ feed stays worth
looking at. A headline and an essay are not the same kind of thing, and one number applied
to both is wrong for one of them.

Every subscription therefore carries a **velocity**: how long a post from that feed stays
in this reader's timeline, measured from `published_at`. A named list with a `CHECK`
repeating it, the way `FEED_STATUSES` is spelled:

| Velocity  | Holds for |
| --------- | --------- |
| Breaking  | 3 hours   |
| News      | 18 hours  |
| Article   | 3 days    |
| Essay     | 2 weeks   |
| Evergreen | Forever   |

It is a column on the `UserDO` subscription, not on the feed. Two people following one
newspaper disagree about it all the time — one wants the day's headlines gone by evening,
the other keeps them to read at the weekend — and neither is wrong, so neither answer
belongs in an object they share. The feed is the same for both; what it is _worth_ to each
of them is not.

Velocity ages on `published_at` rather than on discovery, which is the opposite of the
feed-side rule and for the opposite reason. Retention asks when this system first saw a
post, because it is protecting cursors. Velocity asks when the world saw it, because a
headline published four hours ago is stale whether we found it four hours ago or four
minutes ago.

**Velocity may drop unread posts, and that is the whole point.** ADR-001 held that a
reader's unread queue is never pruned, and for a blanket retention rule that is right — a
queue is a list of things somebody meant to get to. For a news feed it is the opposite: two
hundred unread headlines from last week are not a backlog, they are the thing that makes the
reader stop opening the app. Velocity is the reader saying so ahead of time, per feed, and
consent given in advance is what makes this acceptable where a rule applied on their behalf
would not be.

Which is exactly why the default is Evergreen. Nothing ages out of any feed until somebody
chooses otherwise, so the behaviour ADR-001 shipped is what a reader gets until they ask
for something else, and no post is ever lost by a default they never saw.

**Inference suggests; it does not act.** Each `FeedDO` already holds every item it has
discovered with the time it discovered it, so posts per day is an aggregate over an index it
already has. It is computed on poll, kept in the `feed` row, and handed back by the calls a
reader already makes — `subscribe`, and the health call `/reading/:feed` makes — so the
measurement is taken once for a feed and shared by everyone following it, which is the whole
argument of this ADR applied to one more thing.

What it produces is a prompt: a feed running at forty posts a day against an Evergreen
subscription is a feed worth offering to speed up. It never changes the setting on its own.
A measurement is a good reason to ask a question and a bad reason to delete somebody's
posts.

That also settles what to do with a feed's own hints about what kind of thing it is —
whether one person writes it, how many distinct bylines its entries carry. Those are proxies
for a publishing rate we can measure directly, so they earn nothing here. If the reader is
ever asked, the thing to ask for is the velocity itself rather than something it might be
guessed from.

**Velocity is what makes the firehose case comfortable.** The budget above can only reclaim
read posts, so a reader who follows a thousand busy feeds and reads none of them eventually
meets the back-pressure rather than the sweep: correct, and not pleasant. A velocity on those
feeds is what turns that into an object that simply stays inside its budget. The prompt is
how a reader finds out that is available before a feed pauses on them rather than after.

It reaches the synchronization path too. An item already older than its subscription's
velocity is not stored at all, so a reader returning after a month to a Breaking feed
materializes the last three hours rather than a month of headlines to delete on the next
sweep.

A subscription set to Evergreen keeps whatever it has materialized for as long as the reader
keeps it, whatever the `FeedDO` does with its own copy. The feed-side million bounds how far
back a _new_ subscriber or a long-absent one can be served; it does not reach into a
timeline that has already been written.

### Saved posts

Every rule above deletes something, and a reader needs one answer that does not. A post can
be **saved**, and a saved post is exempt from all of them: the read-age sweep, the budget's
reclamation, and its feed's velocity. A headline from a Breaking feed, saved, is still there
next year.

`saved_at` on `feed_items`, nullable, exactly the shape `read_at` already has — and a
partial index `(published_at, id) WHERE saved_at IS NOT NULL`, exactly the shape the read
and unread timelines already use, so the saved list pages by the same keyset as every other
list in the app.

**A thousand of them, and the thousand-and-first is refused.** Not evicted: a cap that drops
the oldest save to make room deletes the one thing in the whole design a reader explicitly
asked to keep, which would make the feature worth less than not having it. The reader is
told they are full and unsaves something, which is the same answer back-pressure gives above
and for the same reason. A thousand posts is two megabytes against a two gigabyte budget, so
the number is about what a person can meaningfully keep rather than about storage.

Unsaving puts the post back under whatever rule would have taken it, effective at the next
sweep. A Breaking post unsaved a month later goes on that sweep; there is no second grace
period, because the save was the grace period.

Two things fall out of the per-reader copy, and both are worth stating. A saved post
survives its `FeedDO` pruning the canonical item, because the reader's row is theirs and
nothing upstream reaches it. And unfollowing a feed keeps them: ADR-001's semantics take a
feed's posts with it, so a subscription with saved posts left in it keeps its row, marked
`unfollowed_at`, and the subscription list and the rail filter those out. The row is what
holds the feed's name for the saved list to show, and it goes when the last saved post from
it does. That is the price of the word "forever", and it is one nullable column and one
predicate.

What "forever" does not mean: the article. A saved post keeps its title, its excerpt, its
author and its link, because that is all this design ever stores — the body was dropped by
`0002-drop-item-content` and does not come back. When the site goes, the link goes. Actual
archiving is a different feature with a different storage story, and this is not a down
payment on it.

### Fetching untrusted URLs

Feed URLs come from readers, so every fetch is untrusted network input. `normalizeFeedUrl`
already rejects everything that is not `http:` or `https:` and everything that does not
parse, and the refresh path already applies a 10-second per-fetch timeout.

Two bounds are missing today and are added in `@sdxc/feed`, which owns fetching:

- a response size cap, read off a stream rather than through `response.text()`, so a
  publisher serving a gigabyte cannot exhaust an isolate's memory before the parser ever
  sees it;
- a redirect limit, so a chain cannot be used to spend a feed object's whole poll budget.

Both belong there rather than here: every caller of `Feed.fetch` wants them, and a cap
applied by one caller is a cap the next caller forgets.

### Observability

Structured events through `@sdxc/logger` ([ADR-033](../ADR-033-wide-events-as-the-logging-contract.md)),
one per operation, carrying counts and identifiers rather than contents:

| Event                     | Fields                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `feed.initialized`        | `feedUrl`, `feedId`, `head`                                                             |
| `feed.registered`         | `feedUrl`, `feedId`, `created`                                                          |
| `feed.subscriber.added`   | `feedUrl`                                                                               |
| `feed.subscriber.removed` | `feedUrl`, `remaining`                                                                  |
| `feed.poll`               | `feedUrl`, `reason`, `status`, `httpStatus`, `durationMs`, `inserted`, `edited`, `head` |
| `feed.head.published`     | `feedUrl`, `head`                                                                       |
| `feed.purged`             | `feedUrl`, `items`                                                                      |
| `user.freshness`          | `feeds`, `reads`, `stale`, `durationMs`                                                 |
| `user.sync`               | `feedId`, `items`, `skipped`, `cursorFrom`, `cursorTo`, `durationMs`                    |
| `user.retention`          | `aged`, `velocity`, `overBudget`, `reclaimed`, `paused`, `exemptSaved`                  |
| `user.sync.deferred`      | `remaining`                                                                             |

`feed.subscriber.removed` records whether anybody is left, which is what the existence
query answers, rather than a count nothing needed. `user.freshness` records how many bulk
reads covered the subscription list, so a check that stops being one round trip is visible
before a reader complains about it.

No feed contents, no post bodies, no titles, no reader identifiers beyond the subject the
object is already named for.

### What does not change

The timeline queries and their four indexes. The keyset cursor and its rules — both
ordering columns in the projection, one shared `NEWEST_FIRST` ordering constant, no join
to `feeds` for a title. The RPC boundary rules: never a `Result`, never a `Date`, a
discriminated union instead of a throw, and those apply to the `FeedDO` surface too. Every
timestamp an integer. Search, read state, OPML import and export, mark-read, and every
route in `routes/web.ts`.

## Consequences

### Positive

- One polling process per unique feed. The external traffic this product generates is a
  function of how many distinct feeds its readers follow, and stops responding to how many
  of them follow each one.
- Item ingestion is done once per feed rather than once per follower: one fetch, one
  parse, one hash per document, however many people are waiting for it.
- Which feeds exist is a question that can be answered at all, which it could not be in a
  namespace reachable one name at a time. Administrative work has somewhere to start, and
  it starts outside the path readers are on.
- Feed identity is a fixed point rather than a function of the URL, so the normalization
  rules can be tightened later without splitting any feed's readers across two objects.
  That is a decision this design would otherwise have been unable to revisit.
- One identifier names a feed everywhere: the object, the freshness key, the subscription
  row and any administrative URL. Nothing has to be derived to move between them.
- How long a post is worth keeping becomes a per-subscription answer rather than one number
  applied to a newspaper and an essayist alike, and a reader who takes the prompt on a
  firehose feed stops accumulating a backlog they were never going to read.
- The publishing rate a velocity suggestion rests on is measured once per feed and shared by
  everyone following it, the same way the fetch and the parse already are.
- A publication costs one KV write, whether the feed has one subscriber or a hundred
  thousand. Nothing in the write path grows with the follower count.
- A reader who does not open the reader generates no work at all — not a row, not a write,
  not an object wake. The cost of an inactive account is its storage.
- No queue, no consumer, no dead-letter path, and no at-least-once reasoning, because
  there is no message. The three properties a queue forces you to design around —
  duplicate delivery, reordering, and loss — are not properties of a number that only
  moves forward.
- Staleness cannot drift, because it is not stored. There is no flag to leave set, no
  target to leave behind, and no path that can forget to write one.
- The timeline is still one indexed seek with a stable cursor, and now returns before
  synchronization rather than after a refresh — and returns knowing how much is missing,
  which the old design could not tell a reader at all.
- `refresh(reason)` is one door, so WebSub later changes how a feed learns it changed
  without touching anything downstream of the discovery.

### Negative

- Freshness is pull, so nothing can reach a reader who is not looking. Any future feature
  that has to push — an email digest, a web push notification — needs a subscriber walk
  this design deliberately does not have, and would have to build it.
- KV is eventually consistent, so a reader can be told they are current for up to about a
  minute after a feed moved. The window is invisible against a daily poll and is the
  price of the write that replaced the fan-out.
- Every full page load pays KV reads proportional to the reader's subscription count,
  where the old model paid nothing at read time. Bulk reads make it one round trip; they do
  not make it free.
- A reader returning to two hundred stale feeds catches up over several alarm firings
  rather than at once, and the count they are shown shrinks as it happens.
- Two object types and a synchronization protocol where there was one object. Cursors,
  idempotency and ordering are load-bearing in a way they were not when one object both
  fetched and stored.
- A third store, a D1 binding and a second migration surface. The catalog is also now a
  dependency rather than a convenience: following a feed needs it, and the URL-to-object
  mapping lives nowhere else, because a Durable Object namespace cannot be enumerated to
  rebuild it. Reader timelines and feed items would survive losing it; the ability to reach
  the objects holding them would not.
- A reader who follows enough busy feeds, sets no velocity and reads nothing eventually has
  those feeds pause on them. That is the deliberate choice — no unread post is deleted
  without consent — but it is a state the interface has to explain, and the reader has to act
  to leave.
- Saving is the one promise the retention rules cannot override, which gives a reader a
  place to put anything they cannot afford to lose to a velocity they set months earlier.
- Velocity is the one rule allowed to delete a post the reader has not read, which nothing
  in ADR-001 could do. It is defended by being off by default and never set by inference, but
  a reader who chooses Breaking and then goes away for a day will find that day gone.
- Its operational columns can still disagree with the objects — a title that has moved on, an
  activity stamp whose write failed — so everything except identity is read as a catalog
  rather than as a census.
- A popular feed's object is a genuine hot spot: one thread, receiving every subscribe,
  unsubscribe and synchronization page for that feed. Bounded reader-side concurrency keeps
  the stampede small; it does not remove the shape.
- Item metadata is still duplicated per reader, so the storage trade ADR-001 made is
  unchanged. Only the fetching was shared.
- The refresh cadence stops being a setting at all. A reader who wants a feed checked more
  often than daily has only the on-demand check, and a feature ADR-001 shipped is
  withdrawn.
- A post published just after a poll can wait most of a day to appear. That is the cost of
  a cadence chosen for the median feed rather than for the impatient reader, and the number
  it is set from is one constant.
- A feed reachable at two URLs that do not converge under discovery gets two objects, two
  polls and two item sets. Conservative normalization chooses this over the collision.
- Feed health for the single-feed page is an RPC call at render, where it used to be a
  local column.

### Neutral

- Cross-feed facts — how many readers follow a feed, which feeds are popular — now have an
  obvious home in the catalog, though nothing computes them yet.
- Per-reader retention, read state and account deletion stay exactly as isolated as ADR-001
  made them: a `FeedDO` knows user ids and nothing else about anybody, and the shared store
  knows nothing about anybody at all.

## Alternatives Considered

**Keep ADR-001 and rely on conditional requests.** One object, no protocol, no shared
store. It is simpler in every way except the one that matters: a `304` is still a request,
and the request count grows with subscriptions. The design cannot be scaled by tuning.

**Queue fan-out, marking every subscriber dirty.** This was the previous shape of this
ADR: the feed enqueues batches of subscriber ids, a consumer calls `markFeedDirty` on each
`UserDO`, and each stores `dirty` and a target sequence. It works, and it buys a
notification that arrives without the reader asking — but it writes once per subscriber
per publication for a fact each of them could derive, adds a queue, a consumer and a
dead-letter path, and makes duplicate delivery, reordering and loss into properties the
whole design has to stay correct under. A shared counter and a comparison removes the
message rather than making it reliable.

**Fan out items directly from the alarm, with no queue.** Skips the binding and the
consumer, and puts an unbounded loop of RPC calls inside a single-threaded object holding
an alarm that must not reject. One slow reader delays the feed's next poll, and one failed
write either loses a notification or retries the fetch.

**Push items rather than invalidations.** Every subscriber gets the posts without a second
round trip. It also writes twenty posts to a hundred thousand objects for the twenty
thousand people who will read them, which is the specific cost this architecture exists to
avoid.

**Store dirty state in KV, keyed per reader and feed.** Keeps the derived comparison out
of the request path. It also puts per-reader state back in the shared store, which means a
write per subscriber per publication — the fan-out again, with KV's consistency model
underneath state that would then be load-bearing rather than a hint.

**Synchronize eagerly before returning the timeline.** Always-fresh reads, and no need to
tell a reader that something is missing. A reader back after a month would wait on every
stale feed before seeing a page that was already sitting in local storage, and the slowest
object in their subscription list would set the latency of a request that did not need to
touch one at all.

**Build the timeline by querying every `FeedDO` at read time.** Removes the per-reader
copies and the entire synchronization protocol. It reinstates the fan-in ADR-001 rejected:
cost growing with subscriptions on every scroll, and no stable cursor across a merge of
independently-paged sources.

**Canonical feeds and items in D1 rather than in objects.** Ordinary SQL, easy cross-feed
queries, no object-per-feed, and the catalog would come for free as a view over the same
rows. It gives up the alarm that makes a feed schedule its own poll, and D1 has no
interactive transactions, so a multi-step refresh must be written to survive partial
application. The catalog adopted here takes the part of this that is worth having — a table
that can be listed — without putting the read path behind a shared database.

**Derive the object's name from the canonical URL.** The name is then a pure function of
the URL, reconstructible by anyone from nothing, with no round trip on the follow path and
no store that can lose the mapping — and the KV key's 512-byte limit is handled by hashing
the URL into it rather than by capping what a feed's URL may be. It is genuinely simpler,
and it was the earlier shape of this ADR. What it cannot do is change its mind: the
normalization function becomes part of every object's identity for as long as that object
exists, so tightening it later sends a feed's new subscribers to a different object than
its existing ones, with two live objects for one feed and no way to merge them. Paying one
D1 round trip per subscription buys the ability to revisit a decision that is otherwise
permanent.

**No catalog, and enumerate objects when something needs to.** Nothing extra to keep
consistent. A Durable Object namespace cannot be enumerated, so this is not an alternative
so much as the absence of one: it means no count, no list, and no way to reach a feed
except by already knowing its URL.

## Tests

Forty-two behaviours, in the layout the app already uses: the pure paths in plain Vitest
against a SQLite `Database`, the object, KV and D1 paths in `*.workers.test.ts` with
`@sdxc/cloudflare-mocks` and its `createD1Database`.

| #   | Behaviour                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | Two readers following one feed produce one `FeedDO` and one external fetch                                               |
| 2   | Repeated fetches of the same entries create no duplicate canonical items                                                 |
| 3   | Newly discovered items receive strictly increasing sequences                                                             |
| 4   | Discovering items writes one KV head and writes nothing into any `UserDO`                                                |
| 5   | A poll that stores nothing new writes no KV head                                                                         |
| 6   | Staleness is derived: a cursor below the head is stale, a cursor equal to it is current                                  |
| 7   | A KV head behind the feed's true head leaves the reader current, and the next check finds the work                       |
| 8   | A missing KV head leaves the reader current rather than forcing a synchronization                                        |
| 9   | A timeline read pages no `FeedDO`                                                                                        |
| 10  | A timeline read returns its page, and its stale count, without synchronizing                                             |
| 11  | A freshness check over 250 subscriptions issues three bulk reads, not 250 gets                                           |
| 12  | Synchronization requests only revisions above the cursor                                                                 |
| 13  | The cursor is advanced to the greatest persisted revision, never to the KV head                                          |
| 14  | Synchronization failing mid-page leaves the cursor at the last written revision, and the retry writes nothing new        |
| 15  | Synchronization beyond the per-request budget re-arms the `UserDO` alarm and finishes there                              |
| 16  | An unfollowed feed is not read from KV and not synchronized                                                              |
| 17  | The last unsubscribe stops polling through an existence query, retires the catalog row and schedules the purge           |
| 18  | A purge deletes the feed's head key and its catalog row, and a later first subscriber reinitializes and republishes both |
| 19  | A `304` parses nothing, writes no items, publishes no head and moves no activity stamp                                   |
| 20  | Paging stays stable while synchronization inserts newer and older posts                                                  |
| 26  | A feed's sweep keeps its newest million items by revision, drops below it, and publishes no head                         |
| 27  | A reader's sweep deletes nothing for age alone, however old their read posts are                                         |
| 28  | A reader under budget keeps every post, however many feeds they follow                                                   |
| 29  | Following a feed deletes nothing from the feeds already followed                                                         |
| 30  | A reader over budget loses read posts from feeds above their share, and none from feeds below                            |
| 31  | A subscription at the default velocity ages nothing out, read or unread                                                  |
| 32  | A velocity drops posts past its window whether or not they were read                                                     |
| 33  | Two readers of one feed at different velocities keep different posts from it                                             |
| 34  | Synchronization skips items already past the velocity and still advances the cursor past them                            |
| 35  | A measured publishing rate raises a suggestion and changes no setting                                                    |
| 36  | An over-budget reader with nothing read and no velocity set loses no post, and their worst feeds stop materializing      |
| 37  | A paused feed resumes once reading, a velocity or an unfollow brings the object back under budget                        |
| 38  | A saved post survives its feed's velocity, the read-age sweep and the budget's reclamation                               |
| 39  | A saved post survives its `FeedDO` pruning the canonical item                                                            |
| 40  | The thousand-and-first save is refused, and no existing save is evicted                                                  |
| 41  | Unsaving returns the post to the rule that would have taken it, on the next sweep                                        |
| 42  | Unfollowing a feed with saved posts keeps them and drops the rest                                                        |
| 21  | A first follow mints a feed id; a second follow of the same URL returns that id and reaches the same object              |
| 22  | Two concurrent first follows of one URL converge on one row, one id and one object                                       |
| 23  | Every read-path request — timeline, frame, freshness, mark-read — issues no D1 query                                     |
| 24  | Every feed is polled on the one daily interval, with no per-reader cadence to read                                       |
| 25  | An on-demand check refreshes a feed regardless of when its daily poll is due                                             |

## Implementation

- [ ] `FeedDO` class, migrations, and `FEED` binding with a `new_sqlite_classes` tag
- [ ] Add `database/feed-do.ts` and `database/registry.ts` to the AGENTS.md binding list
- [ ] Move `database/refresh.ts` into the feed object, dropping its per-reader assumptions
- [ ] Head counter, `sequence` / `revision`, and the `getItemsAfter` seek
- [ ] `subscribe` / `unsubscribe` / `refresh(reason)` / `getHead` / `getItemsAfter` RPC
- [ ] `subscribers` membership, the existence query, and the daily poll alarm
- [ ] Publish `feed:<feedId>:head` on discovery, initialization and revival; delete it on purge
- [ ] `PLATFORM_DB` binding, D1 `database/migrations/`, and the catalog table
- [ ] `database/registry.ts`, with the `ON CONFLICT (feed_url) DO UPDATE … RETURNING id` upsert
- [ ] Activity stamp, retirement on last unsubscribe, row deleted by the purge
- [ ] `UserDO` migrations: `feed_id` and `cursor` in, polling and cadence columns out
- [ ] `openReader`, the chunked bulk read, and the derived stale list
- [ ] Bounded `waitUntil` synchronization and the `UserDO` catch-up alarm
- [ ] `waitUntil` in `bootstrap/worker.ts` and the `/reading` controller
- [ ] Staleness copy in `app/locales/en.ts` and `app/locales/es.ts`
- [ ] Response size cap and redirect limit in `@sdxc/feed`
- [ ] Bring `MAX_SUMMARY_LENGTH` down to what the timeline actually renders
- [ ] The feed-side million by revision, and the reader-side budget with its per-feed shares
- [ ] `velocity` on the subscription, the sweep that applies it, and the skip on synchronization
- [ ] Back-pressure when the budget cannot be reclaimed, and the copy that explains a paused feed
- [ ] `saved_at`, its partial index, the thousand-post refusal, and exemption from every sweep
- [ ] `unfollowed_at` on subscriptions that still hold saved posts, filtered out of the lists
- [ ] `/saved` and `POST /items/:itemId/save`, alongside the existing read routes
- [ ] Measured posts per day in the `FeedDO`, returned by `subscribe` and the health call
- [ ] Velocity control and its suggestion on `/reading/:feed`, with copy in `en.ts` and `es.ts`
- [ ] Feed health and true head on `/reading/:feed` from its `FeedDO`
- [ ] Remove `REFRESH_INTERVALS`, `setRefreshInterval` and the cadence control on `/settings`
- [ ] Update the README's service table and its refresh-schedule feature line
- [ ] The tests above, and the structured events

## References

- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the per-reader design this splits, whose read path it keeps
- [ADR-052](../ADR-052-feed-facade-package.md) — the feed façade both objects fetch through
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the events follow
- [ADR-029](../ADR-029-pagination-package.md) — the keyset cursor the timeline still pages with
