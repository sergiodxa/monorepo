# ADR-004: Scheduled Freshness Checks as the Paid Tier

## Status

**Proposed** - 2026-09-16

Builds on [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) without
changing any of it. The `FeedDO` keeps writing one key and keeps knowing nothing about who
subscribes; what changes is when a reader's object runs the comparison that key exists for.

## Background

ADR-002 made freshness pull. A feed publishes one head to KV and tells nobody; a reader
learns their subscription moved by comparing that head against their own cursor, and the
only thing that ever runs the comparison is `openReader`. That is the design's best
property — "a reader who does not open the reader generates no work at all" — and it is
also the whole gap. A reader who has been away for a day opens the app, sees a page
assembled from what they already had, is told how much is missing, and then watches it
arrive over the following seconds and minutes.

Nothing in the product currently runs on a reader's behalf. There is no work anybody could
be charged for, because there is no work. This ADR adds exactly one thing: a clock on the
comparison ADR-002 already defined.

## Context

### Only per-reader work can be sold

This is the argument the rest of the ADR rests on, and it is economic rather than technical.

A scheduled freshness check happens inside one reader's Durable Object. It reads that
reader's subscription rows, bulk-reads the heads for the feeds in them, compares them
against that reader's cursors, and synchronizes that reader's timeline. Every byte of it is
addressed by the OIDC subject the object is named for, and none of it produces anything a
second reader can observe. The work happens inside that reader's own object or it does not
happen at all: stop paying and the wake stops, and nobody else's experience changes by any
amount. That is what makes it a product rather than a feature — it is bought by the person
it happens for, it cannot leak, and its cost is a function of their own subscription list.

### Poll cadence is shared, and therefore cannot be sold

The obvious thing to sell is the other one: check the feeds more often. It is what a reader
would ask for, it is what ADR-001 shipped as a setting, and it is the one thing this
architecture makes impossible to charge for.

A `FeedDO` polls once for every subscriber it has. Raising its cadence because one
subscriber paid raises it for all of them: one paying subscriber would fund fast polling
for every free rider on the same feed, and the fastest payer's money would set the cadence
everybody else received for nothing. That is not a tier, it is a donation. Worse, the
marginal cost of the upgrade lands on a publisher's origin rather than on our own bill, so
the thing being sold is somebody else's bandwidth — precisely the argument ADR-002 used to
delete the per-reader cadence setting in the first place.

The line ADR-002 drew between ingestion and projection is therefore also the line between
what can and cannot be metered. Ingestion is shared, so it is priced once, globally, and
given to everybody. Projection is per-reader by construction, so it is where a tier lives.
Any future paid feature has to pass the same test: does it run inside the buyer's own
object, and does the buyer get all of it.

### There is no entitlement concept in this app

`settings` holds an id, a subject, a last-refreshed stamp and timestamps, and that is all.
Nothing in `apps/reader` mentions Polar, a plan, a customer or a subscription. The
`UserDO` cannot ask what tier its reader is on, because nothing has ever recorded one.

Whatever answers that question has to be readable from inside the alarm, which runs with no
request, no session and no outbound budget worth spending. A live call to a billing API
from an alarm handler is the shape `apps/uptime` already removed for good reasons — see
[uptime ADR-005](../uptime/ADR-005-replicate-polar-subscriptions-into-d1.md), where asking
Polar on every scheduling tick was both a scaling wall and an availability bug that failed
closed and silently stopped the product. The tier has to be local, it has to already be in
the object, and reading it must cost nothing.

### One alarm, and now three schedules

A Durable Object has exactly one alarm, and `setAlarm` replaces it. ADR-002's limits table
records this, and today the `UserDO` uses its single alarm for one job: carrying on with
synchronization a request left behind, a minute at a time, while `run.remaining > 0`.

`#armCatchUp` holds whatever alarm is already set unless the new one is sooner, which is
correct while there is one kind of alarm and wrong the moment there are two. A catch-up
armed a minute out always beats a check armed half an hour out, and once the catch-up fires
nothing re-arms the check, so a single "sooner wins" guard quietly converts a scheduled
reader into an unscheduled one after their first busy day.

There is also a third job hiding in the second. The retention sweep is not scheduled at all:
`synchronize()` calls `#sweep` at the end of every run, so retention happens whenever
synchronization happens and never otherwise. An object with nothing to synchronize therefore
ages nothing out, and a subscription set to Breaking holds its three hours of headlines
indefinitely once its feed goes quiet.

### An object that wakes forever for somebody who stopped reading

A free reader's object never wakes, which is the point and is not a problem. A paid
reader's object wakes forty-eight times a day, which is what they bought. A paid reader who
stopped opening the app in March and never cancelled has an object waking forty-eight times
a day forever, synchronizing a timeline nobody will read, and the only thing that ends it is
a billing event that may never arrive.

Both halves of that need an answer: what happens when the subscription lapses and nothing
tells us, and what happens when the subscription is real but the reader is not.

### A check cannot find what the poll has not fetched

The uncomfortable number. Time from a publisher pressing publish to a post appearing in a
premium reader's timeline is the sum of three waits, and the check interval is the smallest:

```text
poll cadence (up to 24h)  +  KV convergence (up to ~1m)  +  check interval (up to 5m)
```

`POLL_INTERVAL_MS` is a day. A five-minute check against a daily poll shaves the last five
minutes off a tail that averages twelve hours, and no amount of checking reaches an item the
`FeedDO` has not fetched. Sold as "your posts arrive within five minutes" this is a lie;
sold as "your reader is checked every five minutes" it is exactly true and worth much less.

So the mechanism here is necessary and not sufficient. What makes it worth buying is the
adaptive poll cadence of [ADR-003](./ADR-003-adaptive-poll-cadence.md) — polling a feed near its own
measured publishing rate, which the `feed` row already records and hands back on `subscribe`
and on the health call. Once a feed that posts six times a day is polled on something like
that rhythm, the check interval becomes the dominant term instead of a rounding error, and
Premium's five minutes starts describing something a reader can feel. Until then, Premium is
built but not offered for sale; Paid's thirty minutes is honest on its own terms, because
what it removes is the stale count on open rather than the latency behind it.

### What a check costs

Rates are the cost card in `apps/uptime/app/lib/cost-rates.ts`, in cents per unit. Durable
Object storage and Durable Object rows are not on that card: storage is priced here at the
published $0.20 per GB-month, and rows at the card's `d1RowRead` and `d1RowWritten`, which
are the closest thing it has. **Both belong on the card**, and their absence is why the
figures below carry an estimate rather than a meter.

The model is **one KV key read per subscribed feed per check**, plus the opens that already
happen. The bulk read chunks at a hundred keys and runs the chunks concurrently, which buys
one round trip of latency and no reduction in keys — KV bills per key, so a reader following
five hundred feeds pays five hundred reads whether they arrive in one request or five.
Thirty-day month; three opens a day for a paid reader, five for a premium one.

| Tier    | Feeds        | Checks + opens / month | KV reads / month | `kvRead` |
| ------- | ------------ | ---------------------: | ---------------: | -------: |
| Free    | 40           |                     90 |            3,600 |  $0.0018 |
| Paid    | 75 (typical) |                  1,530 |          114,750 |   $0.057 |
| Paid    | 200 (cap)    |                  1,530 |          306,000 |   $0.153 |
| Premium | 75           |                  8,790 |          659,250 |   $0.330 |
| Premium | 200 (power)  |                  8,790 |        1,758,000 |   $0.879 |
| Premium | 500 (cap)    |                  8,790 |        4,395,000 |   $2.198 |

The caps are in the table because a cap is a promise somebody will max out; the typical rows
are what the median subscriber looks like, and the gap between them is the risk in this
pricing. Everything else, per user per month, at 250 ms of object wall time per wake, ten
new posts per feed per day, and two kilobytes per stored row:

| Tier / feeds  |    Wakes | Storage | Rows written | Rows read |  Total |
| ------------- | -------: | ------: | -----------: | --------: | -----: |
| Free / 40     |        — |  $0.006 |       $0.012 |   $0.0000 | $0.018 |
| Paid / 75     | $0.00078 |  $0.012 |       $0.023 |   $0.0001 | $0.093 |
| Paid / 200    | $0.00078 |  $0.040 |       $0.060 |   $0.0003 | $0.254 |
| Premium / 200 |  $0.0047 |  $0.040 |       $0.060 |   $0.0018 | $0.985 |
| Premium / 500 |  $0.0047 |  $0.400 |       $0.150 |   $0.0044 | $2.757 |

Storage for the last row is the full `READER_BUDGET` of a million posts, two gigabytes,
which is the worst case in the worst row rather than a typical one.

Against prices of $0, $5 and $12:

| Case                     |  Price |   Cost | Margin | Margin % |
| ------------------------ | -----: | -----: | -----: | -------: |
| Free, 40 feeds           |  $0.00 | $0.018 | −$0.02 |        — |
| Paid, 75 feeds (typical) |  $5.00 | $0.093 |  $4.91 |    98.1% |
| Paid, 200 feeds (cap)    |  $5.00 | $0.254 |  $4.75 |    94.9% |
| Premium, 200 feeds       | $12.00 | $0.985 | $11.02 |    91.8% |
| Premium, 500 feeds (cap) | $12.00 | $2.757 |  $9.24 |    77.0% |

The number to watch is the last one: at the Premium cap, infrastructure is 23% of revenue,
and it is almost entirely KV reads. Everything else in the table is noise. If the
subscription-count distribution drifts toward the cap, or Premium becomes the majority of
paid accounts, that line moves first and nothing else does.

Two mitigations exist and neither is adopted here.

**Adaptive check scheduling.** A subscription is read only when its feed's measured
publishing rate says something plausibly arrived since it was last checked. A blog
publishing weekly cannot have moved in 287 of a premium reader's 288 daily checks, and
reading its head those 287 times asks a question whose answer was known in advance. Over a
realistic mix of weekly blogs and daily news that cuts the key count four to eight times,
taking the Premium cap from $2.20 to under $0.55. Not taken now, because it costs a
per-subscription due-time column and a prediction that is wrong exactly when it matters —
on the quiet feed that suddenly posts — and the current margin justifies neither.

**Move the head from KV to the D1 catalog.** `d1RowRead` is $1e-9 against `kvRead` at $5e-7,
**500 times cheaper**, which would take the Premium cap's $2.198 of KV reads to $0.0044.
That is a real number and deserves saying plainly. ADR-002 chose KV anyway for two reasons
that still hold: KV reads scale globally and independently, where D1 is one database
instance per deployment, so ten thousand premium readers checking every five minutes is 28.8
million queries a month landing on a single database — a contention problem the cheaper unit
price does nothing about; and `AGENTS.md` makes "the read path never reads D1" a MUST, which
a freshness check is squarely inside. If the KV line ever dominates, adaptive scheduling is
the move to make first, because it removes reads rather than relocating them onto the one
shared thing this design deliberately keeps off the read path.

## Decision

The `UserDO` alarm runs the freshness check ADR-002 already defined on a schedule set by the
reader's tier, so a paying reader's timeline is synchronized before they open the app.

### Three cadences, one of which is none

| Tier    | Price | Check interval | Wakes / day |
| ------- | ----- | -------------- | ----------: |
| Free    | $0    | none           |           0 |
| Paid    | $5    | 30 minutes     |          48 |
| Premium | $12   | 5 minutes      |         288 |

Free is not a degraded schedule, it is no schedule: a free reader's object never wakes, and
their freshness comes from `openReader` exactly as it does today. That keeps ADR-002's best
consequence intact — an inactive free account costs its storage and nothing else — and makes
the free tier a rounding error rather than a subsidy.

Thirty minutes is the coarsest interval a reader cannot notice: somebody who opens the app
twice an hour essentially never meets a stale count they did not cause, which is the
experience being sold. Five minutes is the floor worth offering rather than the smallest
number available, because KV converges in up to a minute and below roughly five the interval
is the same order as the consistency window it reads through. It is also where the cost
ceiling sits, which is not a coincidence — the interval and the cap are the tier's whole bill.

Three named tiers rather than a slider. ADR-002 removed the cadence setting because it spent
a publisher's bandwidth; this one spends only the reader's own object, so a dial would be
defensible — but its only honest label would be "how much of your money to spend on this",
and three answers with prices on them say that better.

### Tier is a lease on the settings row

`settings` gains two columns:

- **`tier`** — `TEXT NOT NULL DEFAULT 'free'`, with a `CHECK` repeating the names the way
  `velocity`'s does, so the database refuses anything the webhook somehow lets through.
- **`tier_expires_at`** — `INTEGER`, nullable, the end of the period billing has actually
  been paid for.

The pair is read on every wake and a tier whose `tier_expires_at` has passed is treated as
free. That is what makes it a lease rather than a flag, and it is the reason there are two
columns instead of one: a flag needs a second event to clear it, and a webhook that never
arrives leaves an object waking forever for somebody who stopped paying in March. A lease
expires on its own. A renewal pushes it forward, a cancellation is honoured at the end of
the period the reader already bought, and a billing integration that goes completely silent
degrades every paid reader to free within one period instead of running unpaid forever.
Failing closed costs a paying reader their schedule until the next webhook; failing open
costs money with no way to notice.

One RPC writes them — `setTier(tier, expiresAt)` — and it re-arms the alarm, so an upgrade
takes effect at once rather than at whatever wake was already pending.

**The billing integration is out of scope.** This ADR assumes, and does not build:

- a `POST /webhooks/polar` route outside `requireUser` and outside `cop`, verifying the
  signature and failing closed on a verification error, in the shape
  [uptime ADR-005](../uptime/ADR-005-replicate-polar-subscriptions-into-d1.md) already
  established;
- that the customer carries the OIDC subject as its external id, so the handler can reach
  the right object without a lookup table;
- that subscription lifecycle events carry the current period end, which is what
  `tier_expires_at` is set from;
- that a product id maps to one of the three names, in one table in the handler;
- that delivery is retried and roughly ordered. Out-of-order delivery costs at most one
  interval of the wrong cadence and self-corrects on the next event, which is acceptable
  because the blast radius is a wake schedule rather than any reader's data.

Nothing above reads Polar live, from the alarm or from anywhere else.

### The alarm is a wake-up, not a job

The handler stops being "carry on with synchronization" and becomes a scheduler. Three
nullable due times live on `settings` — `next_check_at`, `next_sweep_at`, `next_catch_up_at`
— and one private `#arm()` sets the alarm to the earliest of them that is not null. Every
path that changes a due time calls it, and `#armCatchUp` writes `next_catch_up_at` rather
than calling `setAlarm` itself.

A firing then does what is due and nothing else:

1. Read the settings row once. An expired lease demotes the reader to free here, before
   anything is scheduled from it.
2. Run every job whose due time has passed, in the order catch-up, check, sweep — leftovers
   first, because leftovers are work a reader is already waiting for.
3. Clear or advance the due times each job owns.
4. `#arm()` to the new earliest, and return.

A wake that finds nothing due re-arms and returns, which is what a clock moving under a
schedule looks like and is not an error. The handler still never rejects, for the reason it
never did: a rejected alarm is retried by the platform, and a retry here would re-run a
check against objects that already answered.

This is the discipline ADR-002 applied to staleness, applied to scheduling: the alarm does
not remember what it was for. What is due is derived from three integers, each with exactly
one writer, so no path can arm a wake for one job and have it silently consumed by another.
The "hold whatever is set unless this is sooner" guard goes with it — correct for one
schedule, and the specific bug three schedules would produce. One alarm rather than three
because the platform gives one and `setAlarm` replaces it; the alternative is not three
alarms but a second object per reader existing solely to hold a timer, which buys a second
failure domain to avoid three columns.

**The retention sweep gets its own daily due time.** It still runs at the end of every
`synchronize()`, which is where it is cheapest, and `next_sweep_at` exists so that an object
which synchronizes nothing still ages posts out — velocity measures from `published_at`, so
a Breaking subscription's window closes whether or not its feed is still publishing. A free
reader's object has no wake to run it on, and that is correct: nothing is materializing into
it either, so there is nothing accumulating for the sweep to find.

### What a scheduled check does

Exactly what `openReader` does, minus the timeline read nobody is waiting for: read the
subscriptions, bulk-read their heads, derive the stale list by `head > cursor`, and hand it
to the existing `synchronize()`.

The bounds do not move. Eight feeds per run, four at a time, five pages per feed — the same
`SYNC_FEEDS_PER_REQUEST`, `SYNC_CONCURRENCY` and `SYNC_PAGES_PER_FEED` a request already
works under. The temptation is to raise them because nobody is waiting, and it is exactly
backwards: a bigger batch holds a single-threaded object longer and widens the burst a
`FeedDO` takes when a popular feed publishes. Leftovers go where leftovers already go, to
`next_catch_up_at` a minute out, until there are none.

**Wakes are spread, not aligned.** A check interval counted from a wall-clock boundary would
put every paid reader's alarm on the same half hour, and a popular feed's object — one
thread, ~1K req/s — would take every subscriber's `getItemsAfter` in the same second. The
phase is therefore offset per reader by a stable hash of the subject modulo the interval, so
the wakes are spread evenly across it and stay spread across restarts, with no stored random
number and no drift. This is the one place where scheduling could manufacture the stampede
ADR-002's pull model was built to avoid, and it is cheap to not do.

### Dormancy

An account with no open in a long time backs its interval off on a ladder, reset instantly
by `openReader`, which starts stamping `last_opened_at` for the purpose:

| Since last open | Multiplier | Paid | Premium |
| --------------- | ---------: | ---- | ------- |
| under 30 days   |         ×1 | 30 m | 5 m     |
| 30 to 90 days   |         ×4 | 2 h  | 20 m    |
| over 90 days    |        ×24 | 12 h | 2 h     |

A fully dormant paid account at the cap drops from 306,000 KV reads a month to about 12,000,
which is $0.006 — its cost becomes its storage, which is where an inactive account's cost
belongs.

What it costs in freshness is almost nothing **today**, and that is a statement with a shelf
life. Against a 24-hour poll, a 12-hour check is the same order as the thing it is checking:
a reader returning after 90 days finds their timeline at worst half a poll interval behind,
which is invisible next to the poll itself. Once adaptive polling lands and a busy feed is
fetched every few minutes, these multipliers become the binding constraint instead, which is
why the ladder is three named constants and not arithmetic.

Backing off rather than stopping, because a dormant subscriber is still owed what they
bought: the first open being instant. The floor under all of it is that an open _is_ a
check, so the worst a dormant reader's return can be is a free reader's return — a page, a
stale count, and background synchronization.

### The `FeedDO` does not change

Not one line. It still writes `feed:<feedId>:head` when a poll stores something, still
writes it once whatever the subscriber count, still keeps `subscribers` for membership and
lifecycle and nothing else, and still has no way to find out who is waiting. Every cost this
ADR adds is on the reader's side of that line, growing with one reader's feeds and one
reader's check rate and with nothing shared — which is "it can be sold", said in resources
instead of in money.

### Observability

`user.freshness` gains `trigger` (`open` or `scheduled`) and `tier`, so the cost model above
can be checked against reality rather than defended, and two events are added:

| Event            | Fields                                |
| ---------------- | ------------------------------------- |
| `user.scheduled` | `tier`, `interval`, `dormancy`, `due` |
| `user.tier`      | `from`, `to`, `expiresAt`, `source`   |

`due` records which jobs a wake found due, which is the one thing that turns a scheduler
into something debuggable. No titles, no contents, no identifiers beyond the subject the
object is already named for.

## Consequences

### Positive

- A paying reader opens the app and their timeline is already current, which is the first
  thing in this product that is worth money and the only one that runs entirely inside the
  buyer's own object.
- Something now exists to notify from. ADR-002 named the absence of a subscriber walk as the
  blocker for a digest or a push, and a per-reader wake that already knows what is new is the
  place both of those would hang off — neither is built here.
- The free tier's cost stays what ADR-002 made it: an inactive free account costs its
  storage, because nothing wakes it.
- Scheduling becomes derived state, so no path can arm a wake for one purpose and have
  another consume it, and a fourth job later is a fourth column rather than a rewrite.
- Retention finally has a clock. A velocity window closes on its own schedule instead of
  waiting for the feed to publish something.
- A lapsed subscription stops costing money without anything having to notice, because the
  lease expires rather than waiting to be cleared.

### Negative

- The Premium cap is 23% of revenue in infrastructure, almost all of it KV reads, and it
  gets there by a reader doing exactly what the tier's own cap invites. The cap is the number
  to defend, and it is set by a promise rather than by a measurement.
- A five-minute check against a daily poll mostly checks nothing. Premium sells a mechanism
  whose value is gated on work in another ADR, and until that lands the tier is built and not
  offered.
- The alarm handler is now a scheduler, which is more to get wrong than a handler that always
  did one thing. A due time advanced on a path that does not re-arm is an object that stops
  waking, and the symptom is silence.
- The `UserDO` gains a concept it had no business knowing about. A storage object now reads a
  billing fact to decide how often to run, and the coupling is real even though the column is
  small.
- The lease fails closed, so a billing integration that stops delivering silently demotes
  every paying reader to free within one period. That is the right direction to fail and it
  is still a customer-visible outage caused by a system this app does not own.
- A dormant paid account is a paid account receiving less than it pays for. The ladder is
  defensible today only because the poll cadence is slower than every rung on it.
- Cost is modelled, not metered: Durable Object storage and rows are not on the rate card,
  so two of the columns above are estimates the platform provides no way to check.
- The platform bill now grows with paid subscribers rather than only with feeds, which is
  the intended shape and still means growth costs money before the invoice for it clears.

### Neutral

- Free readers get precisely the behaviour they have today, so this ADR is invisible to
  everybody who does not pay, and the tier column gives any future entitlement — a feed cap,
  a saved-post cap, an export — somewhere to be read from.
- Feed caps per tier are asserted by this ADR's cost model and enforced by nothing. The
  numbers above assume 200 and 500; the follow path does not know about either.

## Alternatives Considered

**Sell a faster poll cadence.** The feature readers would actually ask for, and the one the
architecture cannot price: a `FeedDO` polls once for all its subscribers, so one payer funds
every free rider on that feed, and the marginal cost lands on a publisher's origin rather
than on ours. It fails the test that makes anything sellable here — the buyer does not get
all of what they bought, and non-buyers get most of it.

**Fan out from the feed instead, now that there is a paying subset.** A `FeedDO` could walk
only its paying subscribers, which is a far smaller walk than ADR-002 rejected. It is still a
write per paying subscriber per publication for a fact each of them can derive, it puts
per-reader state back in the object that was carefully kept ignorant of readers, and it
reintroduces a subscriber walk on the path of a single-threaded hot spot. The pull is already
correct and already bounded; what it needed was a clock, not a sender.

**A `tier` flag with no expiry.** One column, one webhook, less to carry. It only ever
converts correctly in one direction: a missed cancellation leaves an object waking forever
with nothing to stop it, and the failure is invisible because a wake that finds nothing stale
looks exactly like a healthy one. The lease turns a missed event into a bounded overrun.

**Keep the tier in the D1 catalog beside the feeds.** A natural home for billing state and
easy to query across readers. The freshness check would then read D1 on the read path, which
`AGENTS.md` forbids and ADR-002 argued out at length, and the alarm would depend on a shared
database to decide whether to run at all.

**Check on a wall-clock boundary.** Simpler to reason about and trivially testable. It also
aligns every paid reader's wake, so a popular feed's single-threaded object receives every
subscriber's synchronization in the same second — manufacturing, on a schedule, the stampede
the pull model exists to avoid.

**Adaptive check scheduling now.** Cuts the dominant cost line several-fold and is the right
answer eventually. It needs a per-subscription due time and a prediction that is wrong
precisely on the interesting case — the quiet feed that suddenly posts — and a 77% margin at
the worst modelled point does not justify carrying either yet.

## Tests

| #   | Behaviour                                                                                    |
| --- | -------------------------------------------------------------------------------------------- |
| 1   | A free reader's object arms no alarm, and never wakes on its own                             |
| 2   | A paid reader's object arms a wake within its interval, and a premium reader's within theirs |
| 3   | A scheduled check reads heads, derives staleness and synchronizes without reading a timeline |
| 4   | A scheduled check finding nothing stale writes no items and re-arms                          |
| 5   | A scheduled check obeys the same per-run bounds a request does, and defers the rest          |
| 6   | Leftovers from a scheduled check are carried by the catch-up, which then re-arms the check   |
| 7   | A wake with catch-up, check and sweep all due runs all three, catch-up first                 |
| 8   | A wake with nothing due re-arms to the earliest due time and does no work                    |
| 9   | The alarm resolves when a job throws, and the next wake is still armed                       |
| 10  | An expired `tier_expires_at` is treated as free, and the object stops arming checks          |
| 11  | `setTier` up re-arms at once; `setTier` to free clears the check and leaves the rest         |
| 12  | A settings row written before this migration reads as free rather than as null               |
| 13  | Two subjects on one tier take different phases, and each subject's phase is stable           |
| 14  | The sweep runs on its own due time for an object that synchronized nothing                   |
| 15  | An open resets dormancy at once, and the next wake uses the unmultiplied interval            |
| 16  | An account past 90 days without an open checks on the ×24 interval and no faster             |
| 17  | A scheduled check issues one bulk read per hundred subscriptions, not one per subscription   |
| 18  | No scheduled path reads D1, and no `FeedDO` learns who its subscribers are                   |

## Implementation

- [ ] `settings` migration: `tier`, `tier_expires_at`, `last_opened_at`, and the three due times
- [ ] `TIERS`, `CHECK_INTERVAL_MS` and the dormancy ladder as named constants beside `VELOCITIES`
- [ ] `setTier(tier, expiresAt)` on the `UserDO`, returning a discriminated union
- [ ] `#arm()` over the three due times, and `#armCatchUp` rewritten to write one of them
- [ ] The alarm handler as a scheduler: read settings, run what is due, advance, re-arm
- [ ] The lease check, demoting an expired tier to free before anything is scheduled from it
- [ ] `#scheduledCheck()`, reusing `#staleSubscriptions` and `synchronize` unchanged
- [ ] The per-subject phase offset, derived from the subject rather than stored
- [ ] `last_opened_at` stamped by `openReader`, and the dormancy multiplier read from it
- [ ] `next_sweep_at`, armed daily, with the sweep still riding on every `synchronize`
- [ ] `trigger` and `tier` on `user.freshness`; `user.scheduled` and `user.tier`
- [ ] Durable Object storage and row rates added to `apps/uptime/app/lib/cost-rates.ts`
- [ ] The tests above

## References

- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — the pull model this puts on a clock, unchanged
- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the per-reader object the wake happens inside
- [uptime ADR-005](../uptime/ADR-005-replicate-polar-subscriptions-into-d1.md) — the webhook-to-local-state shape the tier assumes
- [uptime ADR-007](../uptime/ADR-007-report-infrastructure-cost-to-polar-cost-insights.md) — the rate card the costs above are priced against
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the new events follow
