# ADR-010: Retention Tiers, and an Archive That Is Not Built Yet

## Status

**Proposed** - 2026-09-16

Extends the Retention, Velocity and Saved posts sections of
[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md), and contradicts
none of them. There is still no age rule, nothing is deleted while there is room, and a
budget that cannot be reclaimed still applies back-pressure rather than deleting a post
the reader never agreed to lose.

Half of this ADR ships and half of it does not. **Part one — tiered budgets — is the
decision being taken. Part two — the archive — is designed here and explicitly not being
built**, so that the tier promise is made in language that stays true later and the shape
is settled before anybody is close enough to the ceiling to be in a hurry about it.

## Background

ADR-002 set one number for every reader: `READER_BUDGET = 1_000_000` posts, sized against
a row it estimated at "a kilobyte and a half once SQLite's own overhead and three indexes
are counted, and two kilobytes to be pessimistic", and took a fifth of the object rather
than the whole of it on the stated grounds that the estimate had "room to be wrong by five
times".

That margin was bought with a specific worry, since removed. The estimate's one unbounded
term was the stored summary, capped at 100,000 characters at the time — a hundred kilobytes
stored to render about a hundred. ADR-002's own implementation list closed that:
`MAX_SUMMARY_LENGTH` is 280 today, and with it every text column in
`feed_items` is either bounded or short by nature. A five-times margin on a number that
can be added up is not caution, it is unused disk. The other thing that has changed is that
there is a price list: Free, Paid and Premium have to differ in something, and how much
reading a reader may keep is the one axis of this product where the difference is real
rather than invented.

## Context

### What a row actually costs

The reader-side `feed_items`, as `0006-shared-feed-objects.sql` creates it: seven text
columns, five integers, and five indexes beside the primary key's own. Counting the table
row first, with typical rather than best-case content:

| Field                                                             | Bytes   |
| ----------------------------------------------------------------- | ------- |
| `id` — a `TypeID` over a UUID                                     | 31      |
| `feed_id` — the same shape                                        | 31      |
| `guid` — the publisher's, usually an entry URL                    | 80      |
| `title`                                                           | 80      |
| `url`                                                             | 90      |
| `summary` — at its cap, which is where it is being counted        | 280     |
| `author`                                                          | 24      |
| `published_at`, `read_at`, `saved_at`, `created_at`, `updated_at` | 30      |
| Record header, payload length and rowid varints                   | 20      |
| **Table row**                                                     | **666** |

Then the indexes, each of which stores its keys again plus a rowid:

| Index                                                          | Bytes   | Applies to         |
| -------------------------------------------------------------- | ------- | ------------------ |
| `sqlite_autoindex_feed_items_1` — `id` as a `TEXT` primary key | 41      | every row          |
| `feed_items_timeline_idx (published_at, id)`                   | 48      | every row          |
| `feed_items_feed_timeline_idx (feed_id, published_at, id)`     | 80      | every row          |
| `feed_items_unread_timeline_idx` / `..._read_timeline_idx`     | 80      | exactly one, ever  |
| `feed_items_saved_idx`                                         | 80      | at most 1,000 rows |
| **Indexes**                                                    | **249** |                    |

The two partial timeline indexes are mutually exclusive by construction — a row is read or
it is unread — so they cost one entry between them rather than two, which is the one place
the index list looks more expensive than it is. The saved index is partial over a capped
set, eighty kilobytes for the whole object, which rounds to nothing per row.

**A row is about 920 bytes**, or around 1.15 KB on disk once SQLite's page slack leaves
b-tree pages something like three-quarters full. **Budget it at 2 KB**, a margin of 2.2
times over the measured figure and still the round number ADR-002 reached for. Against the
10 GB an object gets, that is **five million posts**, and that number is now the ceiling of
the whole design rather than an estimate with five-times slack under it.

### "Forever" is already true for almost everybody

This is the finding that decides what a tier is allowed to promise, so it is stated before
any tier is named. A reader following 25 to 75 feeds is the median this product is built
for, and the feeds they follow publish at blog rates rather than wire-service rates. Fifty
feeds at two and a half posts a week each is **6,500 posts a year**; a generous reading of
the same reader — seventy-five feeds, five posts a week each — is under 20,000, and
comfortably under the hundred thousand a year that would start to matter.

At 6,500 posts a year, one Durable Object's five million rows is seven hundred years. At
100,000 a year it is fifty. **Keep everything forever is not a feature the median reader
needs sold to them; it is what they already have, at the budget ADR-002 shipped, on the
free tier, without an archive existing.**

So the archive is not a feature for most people. It is a feature for the reader in the
tail: the one following three hundred feeds, several of them firehoses, at something like
three posts per feed per day — **328,500 posts a year**, half a gigabyte a year, who meets
a ten-gigabyte wall inside a career rather than inside a lifetime. That changes the copy as
much as the code. A tier may not say "unlimited history", because the object has a limit
and the honest version of the sentence is a number; what the tiers differ in is how far
into that limit a reader may go.

### Where a ceiling has to sit, and why not at the edge

Two things sit between a budget and the 10 GB wall. The first is the row estimate being
wrong — 920 bytes is a mean over content nobody controls, and a reader following feeds with
long titles and long entry URLs pays more per row. The second is that a Durable Object
hitting its storage limit is not back-pressure but a write that fails: the object stops
accepting anything, including the sweep that would make room. Back-pressure is a state the
interface explains; a full object is an outage for one person. So the budget sits far
enough inside 10 GB that no plausible error in the row size closes the gap, and the tiers
below are checked against that rather than against a fifth being a nice fraction.

### What the tier has to be stored as

The budget is read by the sweep and by the back-pressure check on the synchronization
path, and neither may consult a billing store: ADR-002's rule that the read path crosses
two SQLite databases and one KV namespace and never D1 exists so a reader's timeline does
not depend on a table that can be slow or absent, and a subscription lookup would put one
there.

So the tier is a column on the reader's own `settings`, written by the billing path and by
nothing else, the way every other fact about the object is written by the one thing that
owns it. A wrong value costs a pause rather than a deletion, which is what makes a copied
value safe to act on: the worst an under-stated tier can do is stop materializing posts
until the correct value arrives.

## Decision

### Part one: three budgets, derived

`READER_BUDGET` becomes `TIER_BUDGETS`, a record keyed by tier, and `settings` gains a
`tier` column with a `CHECK` repeating the names the way `velocity` already does.

| Tier    | Budget    | At 2 KB a row | Share of the object | Gap to the wall |
| ------- | --------- | ------------- | ------------------- | --------------- |
| Free    | 250,000   | 0.50 GB       | 5%                  | 20×             |
| Paid    | 1,500,000 | 3.00 GB       | 30%                 | 3.3×            |
| Premium | 3,000,000 | 6.00 GB       | 60%                 | 1.7×            |

Every number in that table is `budget × 2 KB`, and the last column is `10 GB ÷ that`. The
2 KB is itself 2.2 times the 920 bytes measured above, so Premium — the tier with the least
room left over — survives the row estimate being wrong by **3.6 times** before an object
fills. Free survives it being wrong by forty.

Premium stops at 3,000,000 rather than at 5,000,000 for that reason and no other: the last
two million rows are the ones that turn an estimate error into a failed write, and a tier
is not allowed to sell them.

What those budgets mean in years, against the two readers from the Context:

| Tier    | Typical reader — 6,500 posts a year | Heavy reader — 328,500 posts a year |
| ------- | ----------------------------------- | ----------------------------------- |
| Free    | 38 years                            | 9 months                            |
| Paid    | 230 years                           | 4.6 years                           |
| Premium | 461 years                           | 9.1 years                           |

Read across the first column and the finding from the Context is in front of you: the free
tier already keeps a normal reader's entire reading life, so the tiers are not selling
history to that person and the interface must not imply they are. They are selling headroom
to the person in the second column, and to them the difference between nine months and nine
years is the whole product.

### What a tier does not change

Velocity, the default of Evergreen, the saved exemption, the order the sweep asks its
questions in, and back-pressure when nothing is reclaimable. A Free reader at their budget
with nothing read and no velocity set has their worst feeds stop materializing and loses no
post. Tiers move one number; they introduce no rule that deletes something a lower tier's
reader had.

`SAVED_LIMIT` does become per-tier — 1,000, 5,000 and 25,000 — and that is a product
decision rather than an arithmetic one. Twenty-five thousand saves is fifty megabytes,
nothing against any budget above; ADR-002 already said the thousand was "about what a
person can meaningfully keep rather than about storage", and raising it for a reader who is
paying costs the same nothing. The refusal at the limit stays a refusal on every tier.

### Cost and margin

The rate card prices Workers, D1, KV, Analytics Engine and Durable Object requests and
duration ([uptime ADR-007](../uptime/ADR-007-report-infrastructure-cost-to-polar-cost-insights.md)),
and prices no Durable Object SQLite at all — not storage, not rows read, not rows written,
which is the largest resource this app consumes and the only one that scales with the
promise being made here. Three rates are missing and are added by the list below: **$0.20
per GB-month** of stored SQLite, **$0.001 per million rows read** and **$1.00 per million
rows written**, which in the card's cents-per-unit convention are `0.667` per GB-day,
`1.0e-7` and `1.0e-4`. Storage is what decides where the ceiling lands; rows written is
what decides whether moving posts around is ever worth doing.

Priced at the full 2 KB, so every figure is the pessimistic one, and against $0.20 per
GB-month:

| Tier    | Reader              | Posts stored | GB   | Storage / month | Price  | Margin         |
| ------- | ------------------- | ------------ | ---- | --------------- | ------ | -------------- |
| Free    | typical, 5 years in | 32,500       | 0.07 | $0.01           | $0.00  | −$0.01         |
| Free    | heavy, at ceiling   | 250,000      | 0.50 | $0.10           | $0.00  | −$0.10         |
| Paid    | typical, 5 years in | 32,500       | 0.07 | $0.01           | $5.00  | $4.99 — 99.7%  |
| Paid    | heavy, at ceiling   | 1,500,000    | 3.00 | $0.60           | $5.00  | $4.40 — 88%    |
| Premium | typical, 5 years in | 32,500       | 0.07 | $0.01           | $12.00 | $11.99 — 99.9% |
| Premium | heavy, at ceiling   | 3,000,000    | 6.00 | $1.20           | $12.00 | $10.80 — 90%   |

A free account is worth a tenth of a cent a month in storage in the case that actually
happens and ten cents in the worst case the budget permits, and the worst paying reader on
either tier leaves ninety per cent of their price intact after the one resource that scales
with what they were sold.

Requests, duration and rows read are not in the table because none of them scales with
retention: an object is woken by its reader whatever is inside it, and a timeline page is a
keyset seek of a page's worth of rows against three million as against three hundred.

### Part two: the archive — **DESIGNED, NOT BUILT**

Everything from here to the end of the Decision describes a subsystem that **does not
exist, is not work to do now, and must not be assumed by any copy, any route or any
schema.** It is recorded because the tiers above have a ceiling somebody will eventually
reach, and deciding the shape while nobody is under pressure produces a better answer than
deciding it when somebody is.

The shape: the `UserDO` keeps the **working set**, and posts older than it move out to
`ArchiveDO` objects partitioned by the post's **published year** — `<subject>:2026`,
`<subject>:2027` — each with its own 10 GB.

#### Why the published year, and not the eviction date

Partitioning by when a post was evicted is the obvious cheap answer: the sweep is already
running, it knows the current date, and a bucket named for it needs no thought. It is wrong
for one reason, and the reason is the whole of ADR-002's read-path argument.

Buckets keyed by published year are **ordered by exactly the thing the timeline is ordered
by**. Every post in `2026` sorts before every post in `2027`, so paging the archive newest
first is a walk down a list of years, with the same `(published_at, id)` keyset inside each
one that every other list in this app uses. One page touches one bucket. The next page
touches the same bucket, or the next one down.

Buckets keyed by eviction date are ordered by nothing the reader can see. A single year of
posts would be scattered across however many buckets the sweep happened to fire into, so
producing one page in published order means reading from all of them and merging — which is
the fan-in ADR-002 rejected for feeds, reappearing with a different key, and carrying the
same defect: a merged list across independently paged sources has no stable cursor.

The published year is also stable in a way an eviction date is not. `published_at` is one
of the three columns frozen against a publisher's edits, so a post's bucket is a permanent
fact decided once: nothing is ever moved between buckets, and a cursor naming a year can
never point at a bucket the post has left.

The one thing it costs is that buckets are uneven, and a bucket is capped at 10 GB like
everything else. At the heavy reader's 328,500 posts a year a bucket is 0.66 GB, so the cap
is fifteen times the worst realistic year; a reader who exceeds it has a year that cannot
be archived, and the answer there is the one ADR-002 gives everywhere else — back-pressure,
and a state the interface explains.

#### Archive search, and the fan-in this one is allowed to be

ADR-002 rejected building the timeline by querying every `FeedDO`, because that cost grows
with how many feeds a person follows, is chosen by the reader, is unbounded and is paid on
every scroll. Searching the archive is a fan-in too, and it is allowed because all four of
those properties differ. It is bounded by **how many years the reader has been a user**,
which grows by exactly one per calendar year and by nothing anybody does: a reader of ten
years' standing searches ten objects, and a reader who follows a thousand feeds tomorrow
searches the same number they searched today.

It is also not on the read path. Paging the archive touches one bucket per page, because
the buckets are concatenated rather than merged; only **search** has to ask every bucket,
and search is an explicit action rather than something a scroll does. The timeline, the
frames and the freshness check never touch the archive at all.

And the fan-out is concurrent and small: ten RPC calls issued together cost one round trip's
latency, the same argument that makes ADR-002's chunked bulk read acceptable. Ten thousand
would not be, which is the line: a fan-in whose width is a function of time is a constant in
every way that matters, and one whose width is a function of subscriptions is not.

#### The eviction path

Eviction is a sweep, and it obeys ADR-002's ordering discipline exactly, for the same
reason the cursor rule exists: **nothing is deleted from the `UserDO` until it is durably
in the archive.**

1. Select the oldest page of evictable posts by `(published_at, id)` — oldest first, which
   the `feed_items_timeline_idx` already answers.
2. Skip anything saved. Staying in the working set is how a saved post stays exempt from
   every rule that moves or deletes one, and at 25,000 saves that costs fifty megabytes.
3. Upsert the page into the bucket for its published year, chunked to the 100-parameter
   bind limit, keyed on the canonical `id`, so a re-run writes what it already wrote and
   changes nothing.
4. Only then delete those rows from the `UserDO`.
5. Only then advance the **archive watermark** — the `published_at` below which the working
   set no longer holds anything — which is what a read uses to decide when to cross over.

A run that dies between 3 and 4 leaves posts in both places with the watermark unmoved, so
reads still come entirely from the working set and the retry re-upserts rows already there.
A run that dies between 4 and 5 leaves posts only in the archive with a watermark that has
not reached them, so a page near the boundary comes back short and the next sweep completes.
Every intermediate state is one where a post exists somewhere and is reachable. The opposite
order — delete, then write — has a window where a post exists nowhere, and no later check
could find that out, exactly as an early cursor advance in ADR-002 is undetectable
afterwards.

#### How a cursor says which bucket it is in

The keyset cursor gains a leading component: the bucket, spelled either `live` or a year.
A cursor is `(bucket, published_at, id)`, and the ordering is `live` first, then years
descending.

The year is derivable from `published_at`, which is precisely why it is carried anyway.
Deriving it is calendar arithmetic against a timezone at every page boundary, and one
instant would resolve to two buckets the moment a reader's arithmetic disagreed with the
sweep's. Writing the bucket down makes it a fact the cursor carries rather than a
computation two paths have to agree on forever, and it is also the only way to tell the
working set's copy of 2026 from the 2026 bucket's.

Crossing a boundary happens when a page comes back short: the cursor rolls to the next
bucket down and resets its keyset to the top of that year. Which buckets exist is read from
a small table in the `UserDO` that the sweep writes when it first fills one, and **never by
probing** — `getByName` on a year nobody has archived instantiates an empty object, so a
reader paging past their own tenure would create one per year they scroll through.

#### The boundary on a lower tier, and what a downgrade does

**At the boundary, a lower tier sees the list end.** The archive is a paid capability; a
Free reader has no buckets, so their timeline is their working set, it stops at their
budget, and what happens above it is ADR-002's back-pressure — their worst feeds stop
materializing, nothing they have is taken, and the three ways out are still reading,
velocity and unfollowing. The list ending is a state with copy, not an error.

**A downgrade does not delete anything.** The archive that exists was paid for when it was
written, and deleting it on a lapsed payment is precisely the eviction ADR-002 refuses,
carried out by the billing system instead of by the sweep. So on downgrade the buckets are
**sealed**: readable, pageable and searchable exactly as before, and closed to writes. The
reader keeps every post they have and loses the ability to add another.

The working set is treated the same way. A reader dropping from Premium to Free is over the
Free budget by definition, and the sweep's first question — is this object over budget —
answers yes on an object with nothing reclaimable. That is a state the design already has
an answer for: reclaim what was read, and when there is nothing, stop taking new posts.
**A downgrade therefore costs a reader everything they have not received yet and nothing
they already have**, which is the only version of this consistent with every other rule in
the two ADRs.

What that leaves is a cost nobody is paying for, and pretending otherwise would be the
hand-wave. A sealed archive is storage on a free account, up to 20 cents a month
indefinitely, so it is bounded rather than infinite: it is kept for twelve months, the
reader is told when it was sealed and when it expires, an export is offered throughout, and
the buckets are deleted at the end of it. Twelve months is long enough that a lapse, a
changed card or a year away is not destructive, and short enough that a free account's cost
stays a number. Re-subscribing inside the window unseals everything, which is the
grace-period shape a feed's `purge_at` already uses, applied to a person instead of a feed.

#### Why this is deferred

Two reasons, and the second is the real one.

It is a subsystem, not a feature: a third Durable Object class with its own migrations, an
eviction sweep with an ordering argument, a cursor format every paged surface has to
understand, a search fan-in, a bucket registry, a seal state, an expiry and an export. Each
of those is small; together they are comparable to the whole of ADR-002.

And almost nobody needs it. The median reader has decades of room on the free tier and
centuries on a paid one, and the only reader who reaches a bucket follows hundreds of busy
feeds for years — a reader who does not currently exist, because this product has no
readers in production yet.

There is also a cost argument that would otherwise be missed. Moving a post saves no bytes;
it moves them to a different object so the first one has room. What it costs is rows
written, at $1.00 per million, counting index entries: about eight per post moved — five
entries leaving, three arriving. Evicting one heavy year of 328,500 posts is 2.6 million
row writes, or **$2.63 once**, against the $0.13 a month that same year's storage costs
wherever it sits. The archive buys headroom against a wall by spending twenty months of the
storage cost of the data it moves, which is a fine trade for a reader who has hit the wall
and a pure loss for everybody else.

What ships now is the tiers. The one prerequisite the archive needs is already true and
needs no work to keep true: `published_at` never moves, so a post's bucket is decided the
moment it is stored.

## Consequences

### Positive

- The budget is derived rather than estimated. Every figure in the tier table is the row
  size times a count, and the row size is a sum over columns and indexes that exist, so a
  schema change that adds a column is a number to redo rather than a margin to hope in.
- A free reader following a normal number of normal feeds keeps everything they have ever
  read for longer than the product will exist, which is what ADR-002's no-age-rule position
  was worth and is now a quantity.
- The resource that scales with the promise is priced, and the worst permitted reader on
  either paid tier leaves ninety per cent of their price intact.
- The archive's shape is settled without its cost being incurred, and the one thing that
  would have been expensive to retrofit — a stable, frozen partition key — is already a
  property of the schema.

### Negative

- A number that was one is now three, and the sweep reads the reader's tier to know which.
  A tier written wrongly is a budget applied wrongly, and the only thing making that safe
  is that being under-budgeted pauses a feed rather than deleting a post.
- Premium's ceiling is 60% of an object, so the tier with the most room is also the one
  with the least margin for the row estimate being wrong. It is the tier to re-derive first
  if real rows turn out heavier than 920 bytes.
- The word "forever" cannot be used about any tier without a number beside it, because the
  archive that would make it literal is not being built.
- Sealing rather than deleting a downgraded reader's archive means a free account carries
  paid-for storage for a year: bounded and cheap, and still a cost with no revenue against
  it, chosen because the alternative is deleting posts somebody paid to keep.
- The archive design is something a future reader has to be told is not real. Every section
  of it is marked, and that is the whole defence.

### Neutral

- Rows read stays flat, so nothing in the read path gets more expensive as history grows.
- The `FeedDO` side is untouched. Its million items by revision is shared by every
  subscriber of a feed and has nothing to do with what any individual reader may keep.

## Alternatives Considered

**Keep one budget for everybody.** Nothing to store, nothing to write, no tier column and
no billing coupling on the retention path. It also gives the price list nothing to differ
in that is true, and this product has exactly one resource that genuinely varies with what
somebody is sold.

**Tier by age — a year of history free, unlimited paid.** It is the shape every competitor
uses, and ADR-002 already dismantled it: an age rule only ever fires when it is not needed,
deleting from an object with room to spare, and it would take a weekly blog's history down
to fifty-two entries while its owner used a thousandth of their space.

**Partition the archive by eviction date.** The sweep needs no key beyond the clock it
already has, and buckets fill evenly. Producing one page of a timeline then means reading
every bucket and merging, which is the fan-in this design rejects for feeds, without even a
stable cursor to show for it.

**Move the archive to R2 as objects rather than to Durable Objects.** Storage is roughly a
tenth the price and there is no per-object ceiling, which is genuinely attractive at the
tail. It gives up SQL: paging and searching would be a format this app would have to invent
and maintain, where a Durable Object already carries the keyset, the indexes and the
migration runner every other part of this app is built on. Worth revisiting if the archive
is ever actually built.

**Build the archive now, alongside the tiers.** The promise on the pricing page would be
literally true on the day it was made. It would also be a subsystem built for nobody:
today's ceiling is decades away for every reader this product is designed for, the
downgrade policy it encodes is the part most likely to be revised before its first user
exists, and moving a post costs more than leaving it where it is.

## Tests

Behaviours one to sixteen ship with part one. Seventeen onward belong to the archive and
are **written down, not written**: no code, no test and no fixture exists for them until
the archive is built.

| #   | Behaviour                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------- |
| 1   | A reader with no tier recorded is budgeted as Free                                                             |
| 2   | Each tier's sweep reclaims at its own budget, and none of them at another's                                    |
| 3   | A reader under their tier's budget loses no post, however many feeds they follow                               |
| 4   | An upgrade raises the budget and reclaims nothing that was already stored                                      |
| 5   | A downgrade deletes no post, and the object applies back-pressure instead                                      |
| 6   | A downgraded reader's saved posts survive the downgrade intact                                                 |
| 7   | Saved posts stay exempt from reclamation on every tier                                                         |
| 8   | The per-tier saved limit refuses the next save and evicts none                                                 |
| 9   | Lowering the saved limit by a downgrade refuses new saves and removes no existing one                          |
| 10  | Velocity applies identically on all three tiers                                                                |
| 11  | A Free reader at budget with nothing read and no velocity loses no post, and their worst feeds pause           |
| 12  | A paused feed resumes when reading, a velocity, an unfollow or an upgrade brings the object under              |
| 13  | The tier is read from the reader's own settings, and the sweep issues no D1 query                              |
| 14  | Only the billing path writes the tier column, and a refresh of it materializes nothing                         |
| 15  | An unknown tier value is refused by the `CHECK` rather than silently budgeted                                  |
| 16  | The per-feed share is the tier's budget divided by the subscription count, on each tier                        |
| 17  | _(deferred)_ A post is present in its year's bucket before it is deleted from the working set                  |
| 18  | _(deferred)_ An eviction interrupted before the delete leaves the watermark unmoved and re-runs clean          |
| 19  | _(deferred)_ An eviction interrupted before the watermark leaves every post reachable in exactly one place     |
| 20  | _(deferred)_ Paging across the boundary touches one bucket per page and mints a cursor naming it               |
| 21  | _(deferred)_ A cursor for a bucket resumes at the same row after the working set has changed                   |
| 22  | _(deferred)_ Buckets are enumerated from the registry, and paging past a reader's tenure creates none          |
| 23  | _(deferred)_ Archive search fans in over years, not feeds, and a new subscription changes its width by nothing |
| 24  | _(deferred)_ Saved posts are never evicted to a bucket                                                         |
| 25  | _(deferred)_ A sealed archive answers reads and refuses writes                                                 |
| 26  | _(deferred)_ Re-subscribing inside the grace period unseals every bucket with nothing lost                     |

## Implementation

Part one:

- [ ] `TIERS`, `TIER_BUDGETS` and `TIER_SAVED_LIMITS` in `database/schema.ts`, replacing
      `READER_BUDGET` and `SAVED_LIMIT`
- [ ] `tier` on `settings` with a `CHECK` repeating the names, defaulting to Free, in a new
      migration
- [ ] The sweep and the back-pressure check read the budget through the tier
- [ ] The save path reads its limit through the tier
- [ ] The billing path writes the column, and is the only writer of it
- [ ] `user.retention` carries the tier and the budget it applied
- [ ] Tier copy in `app/locales/en.ts` and `app/locales/es.ts`, stating a number rather than
      the word "unlimited"
- [ ] Durable Object SQLite storage, rows read and rows written added to the rate card
- [ ] Behaviours 1 through 16

Part two — **not scheduled, listed so the shape is not re-derived later**:

- [ ] `ArchiveDO`, its migrations and its `ARCHIVE` binding
- [ ] The bucket registry in the `UserDO`, and the watermark
- [ ] The eviction sweep, in the order write / delete / advance
- [ ] The bucket component on the keyset cursor, and boundary crossing
- [ ] Archive search, fanned in over the reader's years
- [ ] Seal, the grace period, the export and the expiry
- [ ] Behaviours 17 through 26

## References

- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — the retention, velocity and saved rules this extends
- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the per-reader object whose 10 GB every number here is measured against
- [ADR-029](../ADR-029-pagination-package.md) — the keyset cursor a bucket component would be added to
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the retention event follows
- [ADR-043](../ADR-043-billing-package-with-pluggable-providers.md) — the billing contract the tier column is written from
- [uptime ADR-007](../uptime/ADR-007-report-infrastructure-cost-to-polar-cost-insights.md) — the rate card the missing storage and row rates belong in
