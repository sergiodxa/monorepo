# ADR-001: An RSS Reader on Per-User Durable Objects

## Status

**Accepted** - 2026-09-06

## Background

There is no feed reader in this monorepo. The parts exist and none of them are
assembled: `@sdxc/rss` reads and writes RSS, `@sdxc/data-table-sqlstorage` puts a
`remix/data-table` database inside a Durable Object, `@sdxc/pagination` walks a keyset
cursor, and `@sdxc/auth` signs a person in against `auth.sergiodxa.com`.

`apps/reader` assembles them into a product at `reader.sergiodxa.com`: a person signs
in, follows feeds, and reads a single chronological stream mixing every feed they
follow.

## Context

### The read path decides the storage design

The home screen is one list, newest first, mixing posts from every followed feed, and
it pages. That is the requirement everything else falls out of.

Storing posts once globally and assembling that list per request means fetching from N
feeds and merging in memory, then paging a merged list that has no stable cursor —
the cost grows with how many feeds a person follows, and it is paid on every scroll.

Storing each person's posts in their own database makes it one indexed query with a
keyset cursor, and the cost is the page size regardless of how many feeds they follow.

### What that trades away

Duplication. Ten people following one ten-post feed store a hundred rows between them,
and ten separate polls fetch the same document. A shared-feed design would poll once
and store ten posts.

For this product that is the right trade. The duplication is bounded by retention, the
polls are bounded by conditional requests that return 304 for an unchanged feed, and a
per-user database also makes read state, per-person retention, and account deletion
trivial rather than a join and a cascade.

### Durable Object limits that shape the schema

| Limit                     | Value                | Consequence                        |
| ------------------------- | -------------------- | ---------------------------------- |
| SQLite storage per object | 10 GB                | Retention cap needed, not optional |
| Max row size              | 2 MB                 | Stored post content is capped      |
| Max SQL parameters        | 100                  | Batch inserts must be chunked      |
| Request throughput        | ~1K req/s per object | Fine: one object serves one person |

## Decision

One Durable Object per user, `UserDO`, holding that person's settings, followed feeds
and every post from them. Addressed by `env.USER.getByName(subject)` where `subject` is
the OIDC `sub` claim — never the email, which can be reassigned to another person, and
renaming a Durable Object strands its storage.

Sign-up is a first login. The auth callback resolves the object and calls an idempotent
`ensureUser`, which is the moment a visitor becomes a user. There is no separate user
table and no control-plane database: the name _is_ the lookup.

### Schema

Three tables, migrated inside the object at boot. Every timestamp is `INTEGER` epoch
milliseconds — not a style choice, but because `@sdxc/pagination`'s `CursorValue` is
`string | number | boolean` and rejects a `Date` at encode time, and the SqlStorage
adapter binds values through with no coercion.

- **`settings`** — one row: the subject, the refresh interval, the last refresh.
- **`feeds`** — identity and metadata, plus polling state: `etag`, `last_modified`,
  `last_status`, `failure_count`, `next_attempt_at`.
- **`feed_items`** — `feed_id`, `guid`, the post, `published_at`, `content_hash`,
  `read_at`.

Four indexes on `feed_items`, each serving one path: `UNIQUE (feed_id, guid)` for
dedupe, `(published_at, id)` for the global timeline, `(feed_id, published_at, id)` for
a single feed and the retention prune, and a partial
`(published_at, id, feed_id) WHERE read_at IS NULL` for unread views.

`published_at` is `NOT NULL`, falling back to first-seen. A nullable sort column would
put NULL-ordering semantics into the keyset predicate and leave a hole in the index; a
total ordering is what makes the cursor arithmetic correct.

### The alarm

Each object schedules its own refresh. Default hourly; the person may choose 3, 6, 9,
12 or 24 hours, enforced by a `CHECK` constraint and re-checked at the RPC boundary.

Two scheduling methods, deliberately not one. A `getAlarm()`-guarded `scheduleRefresh`
runs at boot, because without the guard an object that wakes on every page view re-arms
one interval into the future on every wake and, for an active user, never refreshes at
all. An unconditional `rearmRefresh` runs when the interval changes, because reusing the
guarded one there would leave someone who switched from 24h to 1h waiting a day.

`deleteAlarm` is never needed: an object has exactly one alarm and `setAlarm` replaces it.

**The handler must never reject.** A rejected alarm is retried by the platform, which
would re-fetch every feed because one origin was down, repeatedly, against origins that
already answered. Each feed's refresh resolves to an outcome rather than throwing, and
the rearm sits in a `finally` so the heartbeat survives a bug in the refresh path.

A failing feed backs off exponentially through `next_attempt_at`, capped at 24 hours and
surfaced in the UI as a failure count. Any success, a 304 included, resets it. Refresh
runs six at a time with a per-fetch timeout and a bounded number of feeds per firing;
when the budget is hit with work remaining it rearms for a minute rather than an
interval, so a person with many feeds has no permanently stale tail.

### Freshness without re-downloading

Stored `etag` and `last_modified` are sent back as `If-None-Match` / `If-Modified-Since`
through `Feed.fetch` ([ADR-052](../ADR-052-feed-facade-package.md)). A 304 stamps the
feed and writes nothing else — no parse, no row comparison.

When a document does come back, one index-only prefetch of `(guid, content_hash)`
classifies every parsed entry as insert, no-op or update in memory. **A poll where
nothing changed performs zero writes.**

### What an edit may not change

When a feed re-publishes a post with edits, three columns are frozen:

- **`read_at`** — a publisher fixing a typo must not resurrect a read article as unread.
- **`id`** — the primary key and the keyset tiebreaker.
- **`published_at`** — it is the leading cursor column, so re-dating a row would make an
  in-flight cursor skip posts or serve them twice mid-scroll. It is excluded from
  `content_hash` for the same reason: feeds that jitter their dates on every poll exist.

Posts that disappear from the feed document are **not** deleted. A feed carries only its
most recent entries, and deleting on disappearance would erase a person's history and
read state a week after publication. Deletion happens only through retention, which caps
each feed and removes only posts already read.

### RPC, not `fetch`

The object exposes typed methods and the Worker renders the HTML, so the Durable Object
is a data store rather than a nested application. Three rules on what crosses:

- **Never a `Result`.** It is structured-cloneable, but the platform serializes an
  `Error` by name and message and drops the subclass, so an `instanceof` check is always
  false on the far side and the controller cannot tell a stale cursor from a broken
  query. Narrow inside, return a plain discriminated union.
- **Never a `Date`**, for the same reason timestamps are integers.
- **Both ordering columns stay in the projection**, because the cursor is minted by
  reading the sort values off the returned row.

One shared `NEWEST_FIRST` ordering constant, spelled identically in both timeline
methods — a cursor records the exact column names it was minted for. This is also why
the timeline does not join `feeds` for a title: qualified column names would mint
cursors incompatible with the per-feed timeline's.

## Consequences

### Positive

- The home timeline is one indexed query with a stable cursor, at a cost independent of
  how many feeds a person follows.
- A person's entire dataset is one object: deleting an account is `deleteAll()`, and
  there is no cross-tenant query that could ever leak.
- Per-user refresh intervals are natural, because the schedule lives with the data.
- No control-plane database at all. The OIDC subject addresses the object directly.

### Negative

- Posts are stored once per follower, and a popular feed is polled once per follower.
  Retention caps the first; conditional requests make the second cheap but not free.
- A person's reading is bounded by one object's 10 GB and its single-threaded
  throughput. Both are far beyond one person's use, and neither shards later without a
  migration.
- Cross-user features — "popular this week", a shared feed directory — have nowhere to
  live in this design and would need a separate aggregate.

### Neutral

- Read state, retention and refresh cadence are per-person by construction rather than
  by policy, because there is no shared row to disagree about.

## Alternatives Considered

**A shared feed store with per-user subscriptions and read state.** Polls each feed once
and stores each post once. The home timeline then becomes a join across a subscription
table and a global post table, or a fan-out and merge — and in a Durable Object world
there is no single database holding both, so it means D1 and a different consistency
story. It is the right design for a service with many users per feed; it is the wrong
one for the read path this product is built around.

**One Durable Object per feed, plus one per user.** Polls a feed once no matter how many
follow it, which is the real win. But the user object still needs every post locally to
serve the mixed timeline, so the duplication returns — now with a synchronization step
between two object types, and an object-per-feed cost for feeds nobody reads.

**D1 for everything.** One database, ordinary SQL, easy cross-user queries. It gives up
per-user isolation, makes read state and retention a matter of getting a `WHERE` clause
right on every query, and D1 has no interactive transactions, so a multi-step refresh
must be written to survive partial application.

## References

- [ADR-050](../ADR-050-html-named-entities-in-xml-parsing.md) — entity decoding this depends on
- [ADR-051](../ADR-051-atom-package.md) — Atom parsing
- [ADR-052](../ADR-052-feed-facade-package.md) — the feed façade the app consumes
- [ADR-057](../ADR-057-request-context-instead-of-a-service-container.md) — service resolution in Remix v3 apps, which supersedes the ADR-008 container this plan was written against
- [ADR-049](../ADR-049-deferred-route-module-loading.md) — the lazy route mapping this app uses
