# ADR-003: Adaptive Poll Cadence from a Feed's Own Publishing Rate

## Status

**Proposed** - 2026-09-16

Supersedes the single interval
[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) set, and nothing
else in it. The two object types, the derived staleness, the catalog and the retention
rules are all unchanged; this decides only when a `FeedDO` fetches.

## Background

[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) removed the
per-reader refresh interval and replaced it with one number for every feed in the system.
It had to: a `FeedDO` is shared by everybody who follows that feed, it holds exactly one
alarm, and six readers with six opinions about hourly are six schedules it cannot keep.
Daily was chosen as "what the median feed actually justifies", and the same paragraph
calls it "one number to revisit later if real publishing rates argue for it".

They do, and the argument is not about the median. A feed publishing twenty times a day
and a feed publishing once a fortnight are not two points on a distribution whose middle
is worth serving — they are two different products, and one number is wrong for both in
opposite directions. The newspaper is a day stale when a reader opens it. The blog is
fetched three hundred and sixty-five times to learn twenty-six things.

The measurement that separates them is already taken. `measurePostsPerDay` counts what the
feed published inside a thirty-day window and stores it in `posts_per_day`. ADR-002 added
it to suggest a velocity to a reader; unchanged, it is also the number a schedule should
be derived from.

## Context

### One cadence is wrong in both directions at once

A cadence is only ever justified against the feed it is applied to, so the honest measure
is not "how long does a post wait" but "how long does it wait compared to how long the
feed waits between posts" — a reader who follows a newspaper checks it against the news
cycle, and a reader who follows an essayist does not.

At a flat daily interval a feed publishing twenty times a day leaves a post waiting up to
fourteen publishing gaps. The same interval leaves a weekly blog waiting one seventh of
one gap, which is latency nobody can perceive, bought with three hundred and thirty-nine
requests a year that answer `304`. The two errors do not cancel: they are paid by
different feeds, and the flat number is the thing that guarantees both.

### The rate is measured, and it is measured in the right place

`posts_per_day` is taken inside the `FeedDO`, over that object's own items, once per poll,
and shared by every subscriber — the same property the fetch and the parse already have.
Nothing per-reader enters the decision, so the schedule stays a fact about a document
rather than a preference about a person.

It is measured over `published_at` rather than over discovery, which matters twice: it
makes the number mean "what this publication puts out" instead of "what we happened to
notice", and it makes the window slide off a feed that stopped, so thirty days after its
last entry a dead feed measures exactly zero with no liveness check and no flag anybody
has to set. It is also publisher-controlled, and `publishedAt` falls back to `now` for an
entry carrying no date, so a feed that re-dates everything on every poll reads as busier
than it is. The floor below is what bounds that.

### A rate is continuous and a schedule is not

A thirty-day rolling count moves every day, by a fraction of a post. Derived as a
continuous function it would re-arm the alarm on every poll for changes that alter no
outcome, and leave a feed hovering at a threshold oscillating between two cadences
forever. So the mapping quantizes: a few bands, each wide enough that ordinary movement
inside the window stays inside one, and a margin at the edges so a rate sitting on a
boundary settles rather than flaps.

### What a poll costs, and what the poll budget is a function of

Priced against `apps/uptime/app/lib/cost-rates.ts`, in cents. Durable Object SQLite
storage and Durable Object row reads and writes are not on that card; this models storage
at $0.20/GB-month and rows at the card's `d1RowRead` and `d1RowWritten`, and those three
rates need adding to it.

A `304` — the common outcome for every feed slower than its own cadence — is one Durable
Object request, roughly five hundred milliseconds of duration, one feed-row read, the rate
measurement's range count, and one feed-row write. A `200` adds the digest prefetch and
one write per item it stored.

| Component         | Units      | Rate (cents) | `304`        | `200`, 5 new items |
| ----------------- | ---------- | ------------ | ------------ | ------------------ |
| DO request        | 1          | 1.5e-5       | 0.000015     | 0.000015           |
| DO duration       | 500 ms     | 1.5625e-7    | 0.000078     | 0.000078           |
| Feed row read     | 1 row      | 1.0e-7       | 0.0000001    | 0.0000001          |
| Rate window count | 600 rows   | 1.0e-7       | 0.000060     | 0.000060           |
| Digest prefetch   | 1,000 rows | 1.0e-7       | —            | 0.000100           |
| Item writes       | 5 rows     | 1.0e-4       | —            | 0.000500           |
| Feed row write    | 1 row      | 1.0e-4       | 0.000100     | 0.000100           |
| **One poll**      |            |              | **0.000253** | **0.000853**       |

The six hundred rows are a feed publishing twenty a day, which is the feed that polls most
often; a weekly blog counts six. Blending at one document returned per five polls gives
**0.00037 cents a poll**, and a year of one feed at a fixed cadence:

| Cadence    | Polls/year | Cents/feed-year | 100,000 feeds |
| ---------- | ---------- | --------------- | ------------- |
| Daily      | 365        | 0.14            | $136          |
| Hourly     | 8,760      | 3.27            | $3,270        |
| 15 minutes | 35,040     | 13.07           | $13,070       |

The headline is the column heading rather than any figure under it. These are costs per
_unique feed_, because ADR-002 made one object do the fetching for everybody who follows
it, so ten thousand readers of a feed and one reader of it produce the same row. That is
the property ADR-002 bought and this ADR spends: the whole platform's polling bill grows
with how many distinct publications its readers have discovered between them, which
flattens hard as the product grows, while what the money buys improves for all of them at
once.

### Two queries already grow with the table, and this is what makes them bite

`storedDigests()` in `apps/reader/database/refresh.ts` selects `guid, content_hash` for
every stored item, so one document can be classified in memory. That was written when items
were per-reader and capped at five hundred rows; a `FeedDO` holds up to a million. It runs
only when a document actually comes back, which is what has hidden it — a feed answering
`304` never reaches the line. `pruneItems` has the same shape one call later:
`ORDER BY revision DESC LIMIT 1 OFFSET 999999` steps through a million index entries to
discover that a table of five thousand rows has nothing to prune, after every successful
poll.

At the card's row-read rate each is 0.1 cents on a feed at the ceiling — together **0.2
cents per document poll, against 0.00085 for everything else in it**. A feed whose origin
sends no validators answers `200` to every poll, and at a fifteen-minute cadence that is
$70 a year for one feed against thirteen cents. Cadence is the multiplier, so this ADR is
what converts a latent cost into the largest single line on the platform.

Before it becomes expensive it becomes impossible. A million entries of guid and digest is
something like three hundred megabytes of JavaScript strings and `Map` overhead inside an
isolate with a hundred and twenty-eight, so the real failure mode is a busy feed that
stops polling at all.

### A cadence cannot become a knob, for the same reason it stopped being one

ADR-002 removed the per-reader interval because a shared object has no reader to ask, and
nothing here changes that: one alarm, many subscribers, and a rate that describes a
document rather than a person. A per-tier version is the same mistake with a price
attached, and it has a second problem the per-reader one did not — what it sells is
somebody else's bandwidth, because the fetch belongs to the publisher's origin. The
measured rate is the same answer for every subscriber because it is the right answer for
all of them, and a reader who wants something now still has `refresh("manual")`.

## Decision

The poll interval is derived from `posts_per_day`, through a fixed table of bands, with a
floor of fifteen minutes, a ceiling of one day for a feed that is publishing anything at
all, and a dormant week for one that is not.

### The bands

| Measured rate (posts/day) | Publishes about every | Interval   | Polls/day | Worst wait, as a share of one publishing gap |
| ------------------------- | --------------------- | ---------- | --------- | -------------------------------------------- |
| exactly 0                 | nothing in 30 days    | 7 days     | 0.14      | —                                            |
| above 0, below 0.3        | 3.3 days or more      | 24 hours   | 1         | up to 30%                                    |
| 0.3 – 0.7                 | 1.4 – 3.3 days        | 12 hours   | 2         | 15% – 35%                                    |
| 0.7 – 2.5                 | 9.6 hours – 1.4 days  | 4 hours    | 6         | 12% – 42%                                    |
| 2.5 – 10                  | 2.4 – 9.6 hours       | 1 hour     | 24        | 10% – 42%                                    |
| 10 and above              | 2.4 hours or less     | 15 minutes | 96        | 10% and worsening with the rate              |

The last column is what the boundaries were chosen to hold flat. Across the whole active
range a post waits between a tenth and a little over four tenths of the time the feed
itself takes between posts, whatever kind of publication it is, so the
newspaper-versus-essayist asymmetry disappears rather than being split down the middle.
The boundaries fall where `interval ≈ 4.8 / rate` hours crosses between two bands; the
table is that arithmetic evaluated once, because a constant somebody can read is worth
more here than a formula nobody can check. A weekly blog measures 0.14 and is checked
daily; a feed publishing twenty times a day is checked every fifteen minutes.

The single interval is currently resolved through a `feedPollIntervalHours` flag, one
number for every feed in whole hours. The band replaces what it decides and keeps what it
is good at: it stays as a **multiplier** on the band, so a deployment can slow the whole
system down in an incident without losing the shape of the table. Its unit has to change,
because the floor is a quarter of an hour and the flag cannot express one.

### What the floor and the ceiling are each for

**The floor bounds cost, and it is the only thing that does.** Every other band's cost
falls out of the feed's own behaviour; fifteen minutes is the number that says what the
most expensive feed in the system may cost, which the table above prices at thirteen cents
a year. Below it the gain also stops being visible — KV's head is eventually consistent
for up to a minute and a reader finds out when they open the app, so the last few minutes
are spent against a hint that is already approximate and a person who is already not
looking — and it is about as often as a reader's client may touch a publisher's origin
before it stops looking like reading and starts looking like monitoring. A feed publishing
a hundred times a day gets no ratio guarantee at all; it waits a full publishing gap, and
that is the deliberate shape of a floor.

**The ceiling stops a dead feed being polled forever.** A feed with nothing published in
thirty days is fetched purely against the chance it comes back, and weekly notices a
resurrection within a week while returning eighty-six per cent of that feed's budget. It
is not zero, because nothing else here can tell us a publication resumed: no ping, no
WebSub, and no reader who will go and look on our behalf. Dormant is a cadence, not a
retirement — retirement is what the last unsubscribe already does.

### A feed with nothing measured yet

`#initialize` already measures: a brand-new `FeedDO` fetches its document and writes
`posts_per_day` before it answers the subscription. So the cold start is never truly cold
— it is _biased_, and biased in one direction. A feed document carries only its most
recent entries, usually ten to fifty, so a firehose publishing two hundred a day whose
document holds fifty has all fifty inside the last six hours: the thirty-day count is
fifty and the measured rate is 1.67. Truncation can only make a feed look slower than it
is, and slow is the expensive answer to be wrong about.

So a feed polls **hourly for its first twenty-four hours**, unless its measurement already
puts it faster. Twenty-four extra polls, once in a feed's life, cost about seven
thousandths of a cent and convert one truncated document into a day of observed
publishing. No column is needed: the feed row's `created_at` is the stamp.

Convergence after that is self-scaling, which is what makes the window's length tolerable.
The count fills at the rate the feed publishes, so a feed at twenty a day is
representative within a day or two while a feed at one a fortnight takes a month — and a
feed at one a fortnight is in the band the system would have defaulted to anyway. The
feeds that converge slowly are the ones where being wrong costs nothing.

### Hysteresis, and where the window already provides it

Bands are the first mechanism and the thirty-day window is the one underneath them. A rate
averaged over a month moves by at most a thirtieth of a day's publishing per day, so the
band a feed sits in is stable by construction for anything not sitting on a boundary. A
shorter window would make a weekly blog's rate jump between zero and 0.14 as its single
entry entered and left, which is exactly the flapping bands exist to prevent.

For a rate that _is_ on a boundary, the boundary is asymmetric: moving to a faster band
happens as soon as the rate crosses, and moving to a slower one requires the rate to fall
below **eighty per cent** of the boundary it crossed on the way up, so a feed oscillating
between 2.0 and 3.0 posts a day stays hourly. The asymmetry is the point — speeding up
costs a little money, slowing down costs a reader latency, so the cheap error is the one
made eagerly. It needs no new column: the poll reads the stored `posts_per_day` before it
writes the new one, so the previous band and the candidate band are both in hand.

### The rate is measured on every poll, not only on one that stored something

Today `posts_per_day` is written only in `pollFeed`'s `ok` branch. A feed that stops
publishing answers `304` forever, so its rate is never recomputed, so it never reaches
zero and never reaches the dormant band — the one case the ceiling exists for is the one
case the current code cannot observe.

So the measurement moves out of the `ok` branch and runs on every outcome. It is safe
anywhere, because on a poll that stored nothing the rate can only fall, and it falls only
by however far the window slid. It is not free: it is an indexed range count over
`(published_at, id)`, which reads `rate × 30` rows — six hundred for the busiest feed in
the table, six for a weekly blog. That is the shape every query on this path is being held
to below: bounded by what the feed publishes, never by what it has ever published.

### The backoff is a floor on the delay, never a ceiling

`next_attempt_at` still walks from five minutes to a day, and still clears on any answer
including a `304`. When a fast feed is failing, **the backoff wins**:

```text
delay = max(bandInterval, nextAttemptAt - now)
```

which replaces `#nextPollDelay`'s current `Math.min(waiting - now, POLL_INTERVAL_MS)`.
That cap was correct when the band was always a day and the backoff could not usefully
exceed it; under a fifteen-minute band it would invert the two, and a 502 would be fetched
ninety-six times a day.

The band is a claim about what a feed publishes, and a feed that is not answering is
publishing nothing this system can see, so the claim is not evidence about anything while
the origin is down. The backoff is meanwhile the only thing protecting an origin already
in trouble from the client that noticed first.

One detail worth stating rather than discovering: for a feed in the fifteen-minute band
the first two backoff steps — five and ten minutes — are shorter than the band and change
nothing, so the backoff only bites on the third consecutive failure. That is correct. The
band is already a floor on how often anything is touched, and one failure on a busy feed
should cost its readers nothing.

### Every per-poll query is bounded by the document

`storedDigests` takes a bound: the newest **one thousand** items, ordered by `revision`
descending. By `revision` rather than by `sequence` because `UNIQUE (revision)` is an index
that exists and `sequence` has none, and because "most recently decided" is at least as
good a predictor of what a document carries as "most recently discovered" — an edited item
is precisely one the publisher just touched.

A thousand is a cache hit rate, not a correctness boundary, and that distinction is the
whole safety argument. `UNIQUE (guid)` is what guarantees an entry is stored once; the
prefetch only decides whether the comparison happens in memory or in SQLite. An entry the
window did not answer for gets an exact point lookup on that unique index — one index
seek, and at most as many as the document has entries, so the query count is bounded by
the document rather than by the table. Inserts are additionally written
`ON CONFLICT (guid) DO NOTHING`, which makes two interleaved polls of one object safe.

`pruneItems` takes a guard rather than a bound, because its cost is the offset probe
itself. The head counter is incremented once per insert and once per edit, so it is never
smaller than the number of items ever inserted, so `head <= FEED_RETENTION` proves the
table is under the ceiling. One integer comparison against a row already in hand skips the
whole probe for every feed that is not at a million items, which is all of them for years.

**What a missed comparison costs, honestly.** The conflict path is not free. An entry
classified as an insert takes a tick from the head counter before the write, so an insert
that conflicts spends a tick on a row that does not exist — a gap in a sequence ADR-002
describes as gap-free — and a subscriber then sits at a cursor below a head they can never
reach, permanently stale. The exact point lookup is what makes that rare; closing it is
one rule on the reader's side: when `getItemsAfter` returns an empty page while the head
it answered with is above the cursor, the cursor advances to that head. That does not
touch ADR-002's rule that the KV head never moves a cursor — this head is the true one,
read from the object in the same call, and an empty page above a cursor is a fact about
the feed rather than a hint about it.

### What this does to the retention ceiling

Nothing directly, and the indirect part is worth writing down anyway. A feed's
million-item ceiling fills at the rate the feed publishes, and polling more often does not
make a publisher publish more: the fastest feeds fill it soonest, they did so before this
ADR, and ADR-002 already sized the number for that.

What cadence changes is how often the sweep is _asked_. A fifteen-minute feed reaches
`pruneItems` up to ninety-six times a day instead of once, which is why the guard above is
part of this decision rather than an unrelated cleanup: without it, raising the cadence
means reading the entire item table ninety-six times a day to delete nothing.

Retention is not redesigned here, and it is worth noting where the money actually is: a
feed at the ceiling holds around two gigabytes, which at $0.20/GB-month is $4.80 a year
against thirteen cents of polling. Storage is what a large feed costs, and cadence does
not move it.

### Rates the card is missing

`apps/uptime/app/lib/cost-rates.ts` prices Workers, D1, KV and Durable Object requests and
duration, and has no entry for Durable Object SQLite storage or for its row reads and
writes. Three rates are needed — `doSqliteStorageGbDay` at $0.20/GB-month amortized to
0.667 cents a GB-day, and `doRowRead` and `doRowWritten` at the same values as `d1RowRead`
and `d1RowWritten` — and they must be **appended**, because `COST_RESOURCES` derives the
Analytics Engine `double` order from that object's key order and reordering it orphans
every point already written.

## Consequences

### Positive

- A post from a feed that publishes twenty times a day reaches a reader within fifteen
  minutes instead of within a day, and a feed that publishes weekly stops being fetched
  three hundred and thirty-nine times a year to learn nothing.
- Latency is proportional to the feed rather than uniform across feeds, so a newspaper and
  an essayist give their readers the same guarantee even though their intervals differ by
  two orders of magnitude.
- The schedule is derived from a measurement that already existed, in the object that
  already holds it, shared by everybody who follows the feed. No new store, no new column,
  and nothing per-reader in the decision.
- A dead feed costs fifty-two polls a year instead of three hundred and sixty-five, and
  reaches that state on its own thirty days after its last entry.
- The two unbounded queries on the poll path become bounded, removing a latent cost that
  would have become the platform's largest line and a memory failure that would have
  stopped a busy feed polling at all.
- The polling bill stays a function of unique feeds, so every band amortizes further as
  readers arrive.

### Negative

- The whole platform's poll budget rises. On a plausible distribution of a hundred
  thousand feeds — one per cent in the fastest band, a fifth dormant — it is about a
  hundred and thirty-three million polls a year against thirty-six million flat, which is
  $497 against $136. Small in absolute terms and a real 3.6× in relative ones; the claim
  that this redistributes a fixed budget is true about its shape and false about its total.
- A busy publisher's origin now receives ninety-six conditional requests a day where it
  received one. Defensible for a feed that changes that often, still a number a publisher
  can notice, and there is no mechanism here for them to ask for less. `refresh("manual")`
  ignores both the band and the backoff on top of that, so a reader holding a button can
  fetch as fast as they can click; this ADR raises the stakes on it and does not fix it.
- The rate is measured over `published_at`, which the publisher controls and which falls
  back to discovery time. A feed that re-dates every entry on every poll reads as a
  firehose and is polled at the floor, and the floor is the only thing bounding that.
- A resurrected feed waits up to a week to be noticed and then climbs the bands one poll
  at a time, so a blog that comes back after a year is stale to its readers for longer
  than a flat daily interval would have left it.
- A feed that bursts and goes quiet stays in a fast band for the rest of the window — up
  to thirty days of polling nothing. It costs a few hundredths of a cent and it is visible
  in the logs as a feed being polled for no reason.
- One more table of constants that has to be right, and a cadence that is a function of
  data rather than a number somebody can read off a page. Answering "why is this feed
  polled every four hours" requires reading a column.
- Bounding the digest prefetch introduces a conflict path that can spend a head tick on a
  row that was never written, and the reader-side rule that closes it is a second place
  where a cursor may move without an item behind it.

### Neutral

- Retention, velocity, saved posts and the freshness protocol are untouched. This changes
  when a feed fetches and nothing about what anybody sees.
- Storage remains the dominant cost of a large feed by a factor of thirty-six at the
  floor, and cadence does not move it.
- The rate card gains three entries whether or not this ships, since the reader app has
  been running on Durable Object SQLite without a price for it since ADR-002.

## Alternatives Considered

**Keep the flat daily interval and let readers press refresh.** No table, no bands, no
convergence argument, and the interval stays one constant. It also puts the work of
noticing on the reader, for exactly the feeds where noticing matters most — a person who
follows a newspaper does not want a button, they want the newspaper — and it spends three
hundred and thirty-nine requests a year on every blog to avoid needing one.

**Derive the interval as a continuous function of the rate.** `4.8 / rate`, clamped, with
no bands at all. It is one line, and it re-arms the alarm on almost every poll for changes
too small to alter any outcome, and leaves a feed near a threshold flapping forever. Bands
are that function with the churn taken out, and the table is readable in a way the formula
is not.

**Schedule from the gap between the last two entries rather than a thirty-day rate.** It
reacts immediately and needs no window. It also reacts to a single burst as though it were
a new tempo — two entries posted a minute apart put a weekly blog into the fifteen-minute
band — and has no way at all to observe a feed that stopped, because there is never a next
entry to measure against.

**Use HTTP caching hints: `Cache-Control: max-age`, `Retry-After`, `<sy:updatePeriod>`.**
The publisher's own statement about how often to come back, which is the most polite
possible input. Most feeds carry none of them and most that do are carrying a CDN default
with nothing to do with publishing. Worth honouring later as a ceiling a publisher may
impose, which is a different decision from how this system chooses on its own.

**Sell cadence as a plan tier.** It converts the latency difference into revenue and it is
the obvious product move. A `FeedDO` has one alarm and many subscribers and cannot honour
two answers, so it would have to poll at the fastest subscriber's rate and withhold the
result from everybody else — which spends the publisher's bandwidth and then stores the
items without showing them. ADR-002 rejected per-reader cadence on the first half of that
argument; the second half is why a price does not rescue it.

**Leave `storedDigests` and `pruneItems` alone and cap the cadence at hourly.** Avoids
touching the refresh path at all. It caps the symptom rather than the cost: the scans still
grow with the table, the memory ceiling is still reached by a busy feed, and the bound
would have to be revisited the first time anybody wants the floor lowered.

**Bound the prefetch by the size of the parsed document instead of a constant.** Strictly
tighter, and available, since the parse happens before the classification. It makes the
query's cost depend on a publisher's document size, which is untrusted input, and buys
nothing the exact point lookup does not already cover.

## Tests

Sixteen behaviours, in the layout the app already uses: the band arithmetic and the
refresh path in plain Vitest against a SQLite `Database`, the alarm and its re-arming in
`feed-do.workers.test.ts`.

| #   | Behaviour                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Each rate in the table maps to the interval the table names, at both edges of every band                      |
| 2   | A feed measuring zero polls at the dormant week, and one measuring anything above zero does not               |
| 3   | A rate rising past a boundary moves to the faster band on the next poll                                       |
| 4   | A rate falling below a boundary but above eighty per cent of it keeps the faster band                         |
| 5   | A rate oscillating across a boundary re-arms one interval, not two alternating ones                           |
| 6   | A feed inside its first day polls hourly even when its measured rate puts it slower                           |
| 7   | A feed past its first day polls at the band its measurement puts it in                                        |
| 8   | A poll returning `304` recomputes the rate, and a feed whose last entry left the window reaches zero          |
| 9   | A failing feed in the fifteen-minute band polls at its band until the backoff exceeds it, then at the backoff |
| 10  | Any answer, `304` included, clears the backoff and returns the feed to its band on the next firing            |
| 11  | `refresh("manual")` fetches regardless of the band and of the backoff                                         |
| 12  | The digest prefetch reads at most the bound, whatever the table holds                                         |
| 13  | An entry outside the prefetch window is recognized by its exact lookup and stored once, not twice             |
| 14  | An insert that conflicts on `guid` writes no second row                                                       |
| 15  | An empty page under a higher true head advances the subscriber's cursor to that head                          |
| 16  | The prune probe is skipped while the head is at or below the retention ceiling                                |

## Implementation

- [ ] `POLL_BANDS`, `POLL_DORMANT_MS`, the warm-up constants and the hysteresis factor in
      `database/feed-schema.ts`, replacing `POLL_INTERVAL_MS`
- [ ] `pollIntervalFor(previousRate, rate, createdAt, now)` beside them, taking the previous
      rate so hysteresis needs no column
- [ ] `#nextPollDelay` and `#armPoll` read the band; the backoff becomes a `max` rather than
      a `min` against it
- [ ] `subscribe` arms at the band rather than at a fixed day
- [ ] `feedPollIntervalHours` becomes a multiplier on the band, in a unit that can express
      the floor
- [ ] `measurePostsPerDay` runs on every `pollFeed` outcome, not only on `ok`
- [ ] Bound `storedDigests` to the newest thousand by `revision`, with an exact `guid` lookup
      for anything the window missed
- [ ] `ON CONFLICT (guid) DO NOTHING` on the item insert
- [ ] Guard `pruneItems` behind `head <= FEED_RETENTION`
- [ ] `UserDO` advances a cursor to the answered head when a page comes back empty below it
- [ ] `feed.poll` carries `postsPerDay` and `intervalMs`, so a cadence is readable from the
      event rather than inferred from firing times
- [ ] Append `doSqliteStorageGbDay`, `doRowRead` and `doRowWritten` to the rate card, without
      reordering anything already there
- [ ] The tests above, and ADR-002's behaviour 24 rewritten to assert the band rather than the
      single interval
- [ ] Update the README's refresh-schedule feature line

## References

- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — the shared feed object whose single interval this replaces
- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the per-reader cadence ADR-002 withdrew
- [ADR-007](../uptime/ADR-007-report-infrastructure-cost-to-polar-cost-insights.md) — the rate card these figures are priced against
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the poll event follows
- [ADR-052](../ADR-052-feed-facade-package.md) — the feed façade every poll fetches through
