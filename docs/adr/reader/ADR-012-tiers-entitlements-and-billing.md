# ADR-012: Tiers, Entitlements and Billing

## Status

**Proposed** - 2026-09-16

## Background

Every other ADR in this directory assumes a tier. Background freshness checks run at a
different cadence depending on one ([ADR-004](./ADR-004-background-freshness-checks.md)),
the MCP server refuses anybody who is not on one
([ADR-006](./ADR-006-mcp-server.md)), filter rules are counted against one
([ADR-009](./ADR-009-filter-rules.md)), and the storage budget is sized by one
([ADR-010](./ADR-010-retention-tiers-and-archive.md)). None of them says where that number
comes from, what happens to it when a card fails, or what it means for a reader whose
tier moves down while their data stays where it is.

This ADR answers them. It decides where entitlement is stored, how the billing platform's
view of a subscription reaches that store, how the store recovers when a delivery is lost,
and — at most length, because it is the part with a person on the other end of it — what
happens to a reader who stops paying while holding four hundred feeds and eight hundred
thousand posts.

Nothing here is novel infrastructure. `@sdxc/billing` ([ADR-043](../ADR-043-billing-package-with-pluggable-providers.md))
already exists, Polar is already the provider, and `apps/auth-saas` already implements the
webhook-to-projection shape this adopts almost verbatim. What this ADR adds is one column
in a Durable Object and a set of rules about what that column is allowed to mean.

## Context

### Three tiers, and what each one is for

| Tier    | Price     | Feeds | Background checks | Saved posts | Search  | Also                                                                |
| ------- | --------- | ----- | ----------------- | ----------- | ------- | ------------------------------------------------------------------- |
| Free    | $0        | 50    | none              | 100         | 30 days | —                                                                   |
| Paid    | $5/month  | 200   | every 30 minutes  | 1,000       | full    | Folders, tags, filter rules, full-text extraction, MCP, public API  |
| Premium | $12/month | 500   | every 5 minutes   | 1,000       | full    | Raised storage budget, AI features, non-feed sources, email digests |

The paid tier sits at $5 because that is Polar's minimum charge. It is not a price derived
from a cost model — the cost model below says the product could be sold for a fraction of
it — so the floor is doing the work a cost model would otherwise do, and every margin
figure in this ADR is comfortable for that reason rather than by design.

### The feed caps bound the tail, not the median

A feed cap reads like a marketing device. It is not. It is the only thing in this design
that bounds the worst case, and the reason is the freshness index.

[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) made staleness a
derived comparison: a reader's object reads one KV key per subscription and compares each
head against its own cursor. That read costs `feeds × checks`, and both factors are things
a tier sells. A Premium reader at five-minute checks wakes 8,640 times a month; at five
hundred feeds that is 4.3 million KV reads, which prices at about $2.16. At five thousand
feeds — a number nothing in the architecture prevents, since a subscription is one row —
the same reader costs $21.60 a month against a $12 price, and the product loses money on
its best customer for doing exactly what it was sold.

Nothing else in the design has that shape. Storage grows with posts and is slow. Item
ingestion is shared, so the second subscriber of a feed costs nothing. Worker requests
track how often somebody opens the app, which is self-limiting. Only `feeds × checks`
multiplies two numbers a reader controls, and only a cap on one of them makes the product
bounded. So the caps are set where the tail stops being affordable, and they are stated in
the product because a limit that exists has to be visible.

### A limit is enforced where the count is

The `UserDO` is the only thing that knows how many feeds a reader follows, how many posts
they have saved, how many rules they wrote and how much storage they are using. Those
counts are rows in its own SQLite database, reachable in one local query with no network
call, so every limit is a comparison the object can make for itself — provided it also
knows the tier.

If the tier is not in that object, it has to be fetched. Fetching it from D1 breaks
`AGENTS.md`'s rule that the read path stays clear of the catalog and puts a database round
trip inside a single-threaded object on every enforcement point; fetching it from Polar
makes the platform's availability a precondition for saving a post. Entitlement goes where
the counts are.

### The monorepo already decided the hard parts

`@sdxc/billing` supplies the provider contract, one failure convention, a normalized event
vocabulary and a webhook endpoint that verifies, records and deduplicates deliveries.
`apps/auth-saas` supplies the pattern built on top of it: a handler that never reads the
delivery's payload as state, calls `entitlements.of(customer)` to re-read what the platform
says is true right now, and writes that snapshot into the app's own tables.

That pattern is adopted unchanged, and it deserves a name, because it is the same move
ADR-002 made for feed freshness: **a delivery is a hint that something moved, never a
statement of what it moved to.** ADR-002 published a head to KV and let readers derive
staleness; this publishes a delivery and lets the app derive entitlement. Both are correct
under replay, reordering and loss for one reason — the thing that is read is authoritative
and monotonic, and the thing that is delivered only says when to go and look.

Polar signs with Standard Webhooks, so it fits `@sdxc/webhooks`
([ADR-026](../ADR-026-standard-webhooks-parsing-package.md)) directly, with the one quirk
that its secret is a text value needing base64 encoding before verification. `PolarBilling`
already does that, through `Webhooks.verify` with a five-minute tolerance. This app
therefore writes no verification code at all, and must not: a second implementation of the
signature check is a second thing to get wrong.

### The downgrade is the case the design is judged on

A reader on Premium with four hundred feeds, eight hundred thousand posts, sixty filter
rules and a folder tree stops paying. They are over the free feed cap by a factor of eight,
over the saved-post cap, over any storage budget the free tier could carry, and over the
rule cap by sixty.

Deleting three hundred and fifty of their feeds is not a defensible action to take on
somebody's behalf. Deleting posts they never agreed to lose is the thing ADR-002 refused
to do even under genuine storage pressure. And leaving them with Premium resources
indefinitely means the tier is advisory.

ADR-002 already answered this shape of problem once. Its budget rule says that when there
is nothing left to reclaim, **the object stops accepting posts rather than deleting them**
— back-pressure instead of data loss, with three ways out, all of them the reader's. A
downgrade is the same situation reached from the other direction: there, the object grew
into its limit; here, the limit shrank onto the object. The answer that was right then is
right now.

### Modelled cost per reader

Rates are `apps/uptime/app/lib/cost-rates.ts`, in cents per unit. That card is missing
three keys this model needs: Durable Object SQLite storage, and Durable Object rows read
and written. Storage is $0.20 per GB-month, which amortizes to `doStorageGbDay: 0.667` in
the card's own convention; DO rows price identically to D1's, so `d1RowRead` and
`d1RowWritten` stand in exactly. **The card should gain all three**, appended rather than
inserted, because `COST_RESOURCES` positions Analytics Engine `double` fields by key order
and a reorder orphans every point already written.

Assumptions: a typical reader follows 50 feeds; a free reader opens the app 60 times a
month, a paid reader 120, a premium reader 150; feeds publish 1.5 posts a day; a stored
row is 2 KB including indexes, which is ADR-002's own pessimistic figure; timelines are
modelled at one year of accumulation for Paid and two for Premium; and feed-side ingestion
is shared five ways, which is the one assumption that flatters the numbers and the one to
revisit first.

| Line                     | Free typical | Free cap  | Paid typical | Paid cap   | Premium typical | Premium cap |
| ------------------------ | ------------ | --------- | ------------ | ---------- | --------------- | ----------- |
| Feeds followed           | 25           | 50        | 50           | 200        | 50              | 500         |
| KV freshness reads       | 0.08¢        | 0.15¢     | 3.90¢        | 15.60¢     | 21.80¢          | 219.80¢     |
| DO storage               | 0.05¢        | 0.09¢     | 1.10¢        | 4.40¢      | 2.20¢           | 22.00¢      |
| DO rows written          | 0.45¢        | 0.90¢     | 0.90¢        | 3.60¢      | 0.90¢           | 9.00¢       |
| DO requests and duration | 0.01¢        | 0.01¢     | 0.05¢        | 0.05¢      | 0.33¢           | 0.54¢       |
| Worker requests and CPU  | 0.03¢        | 0.03¢     | 0.09¢        | 0.09¢      | 0.07¢           | 0.07¢       |
| Full-text extraction     | —            | —         | 0.50¢        | 0.50¢      | 0.50¢           | 0.50¢       |
| Email digests            | —            | —         | —            | —          | 1.05¢           | 1.05¢       |
| AI features              | —            | —         | —            | —          | 6.00¢           | 40.00¢      |
| Feed-side share          | 0.28¢        | 0.55¢     | 0.55¢        | 2.20¢      | 0.55¢           | 5.50¢       |
| **Total**                | **0.90¢**    | **1.73¢** | **7.09¢**    | **26.44¢** | **33.40¢**      | **298.46¢** |
| Price                    | $0           | $0        | $5.00        | $5.00      | $12.00          | $12.00      |
| Net of Polar's 4% + 40¢  | —            | —         | $4.40        | $4.40      | $11.12          | $11.12      |
| **Margin**               | —            | —         | **98.4%**    | **94.0%**  | **97.0%**       | **73.2%**   |

Two things the table is meant to show. Margins are comfortable everywhere, including at
the caps, so the caps are not load-bearing for profitability at the sizes they permit. And
the cap is what keeps the worst column finite: the single line that dominates it is KV
freshness reads, which is `feeds × checks` and nothing else, and removing the cap removes
the bound entirely.

Three honest caveats. The AI line is a guess and is the only line not bounded by any cap
in this ADR — it needs a quota of its own, which belongs with whatever ADR defines those
features and does not exist yet. Feed-side storage is shared but unbounded per feed: a
news firehose at ADR-002's million-item ceiling is 2 GB, about $0.40 a month, paid once
globally rather than per subscriber, so a reader who follows ten such feeds that nobody
else follows costs several dollars more than this table says. And the reader has no cost
ledger of its own — `apps/uptime`'s card is being used as the repository's rate reference,
not as a meter.

## Decision

Entitlement is a `tier` column on the `UserDO` settings row, written only from outside,
derived from a D1 projection of what Polar last said, refreshed by webhooks and repaired
by reconciliation. A downgrade never deletes anything.

### `tier` on the settings row

Four columns join `settings`, which is the row pinned to exactly one by its own `CHECK`:

```text
tier            TEXT    NOT NULL DEFAULT 'free'
                CHECK (tier IN ('free', 'paid', 'premium'))
tier_source     TEXT    NOT NULL DEFAULT 'default'
                CHECK (tier_source IN ('default', 'billing', 'grant'))
grace_until     INTEGER
tier_checked_at INTEGER NOT NULL DEFAULT 0
```

`tier` is what every limit check reads. `tier_source` distinguishes a tier Polar granted
from one a person granted — staff accounts, comps, a trial if one is ever run — so that
reconciliation knows which rows it is allowed to lower. `grace_until` carries the lapse
window described below. `tier_checked_at` is when a snapshot last confirmed the value, and
it is both the staleness signal and the guard against two concurrent reconciliations
writing each other's answers out of order.

**What makes it authoritative.** Operationally, completely: no request anywhere reads
anything else to decide what a reader may do, so a wrong value here is a wrong product,
and that is the whole reason the repair paths below are designed as carefully as they are.

**What makes it a cache.** It is derived, and it has exactly one writer — a `setTier` RPC
called from outside the object. The `UserDO` never computes its own tier, never raises it,
and has no path to Polar or to D1 through which it could. So the column cannot drift from
within: every value it has ever held came from a snapshot, and if it disagrees with the
projection the projection wins without argument and the repair is a write in one
direction only.

That asymmetry is not a style choice. `AGENTS.md` names the five modules allowed to reach
a Cloudflare API and `database/registry.ts` is the only one holding the D1 binding, so a
`UserDO` that read its own billing state would be a sixth. The architecture forced the
direction before this ADR chose it.

### The projection in D1

Three tables in `PLATFORM_DB`, reached through `database/registry.ts` the way the feed
catalog already is, following `apps/auth-saas` closely enough that a reviewer who has read
one recognizes the other:

- **`billing_customers`** — `subject`, `connection`, `provider_customer_id`, one row per
  reader per connection. It exists only for readers who have reached checkout, which is
  what keeps reconciliation bounded: a free reader who never opened a checkout has no row,
  and there is nothing Polar could say about them.
- **`subscriptions`** — `subject`, `billing_connection`, `billing_subscription_id`,
  `status`, `product_slug`, `current_period_end`, `cancel_at_period_end`, `checked_at`,
  `provider_data`. One row per reader, holding the last snapshot.
- **`billing_webhook_deliveries`** — the `WebhookStore` shape `@sdxc/billing` defines:
  `id`, `type`, `payload`, `valid`, `processed`, `received_at`.

Polar is the source of truth about whether money arrived. The projection is this app's
authoritative record of what Polar last said, and it is the only layer that can be rebuilt
from nothing — replaying `entitlements.of` over `billing_customers` reconstructs both it
and every `tier` column downstream. Losing it costs a sweep, not a subscription.

Nothing on any read path touches it. The tier a request enforces against is already in the
object the request is talking to.

### Polar's state reaching the column

A checkout creates the Polar customer with `externalId` set to the reader's OIDC subject,
so the snapshot names the `UserDO` directly and `billing_customers` is only the fallback
for a customer some support action created without one. The email comes from the OIDC
`email` claim, which `app/auth/relying-party.ts` already requests.

`POST /webhooks/billing` mounts a `BillingWebhook` with the delivery store, and its seven
handlers — `checkout.completed`, the four `subscription.*` events, `order.paid` and
`order.refunded` — are the same one line: read the customer id off the event and call
`sync`. `sync` reads `polar.entitlements.of({ id: customerId })`, writes the projection,
computes the effective tier, and calls `userStore(subject).setTier(...)`. It reads nothing
out of the delivery except which customer it was about.

**Signature verification** is `PolarBilling.webhooks.verify`, which is `@sdxc/webhooks`
with the base64-encoded secret and a five-minute timestamp tolerance. A forged delivery is
the only thing that gets a `401`; everything else is acknowledged, because an error
response is how a platform decides an endpoint is broken and stops calling it.

**Replay** is the delivery store, keyed on Polar's `webhook-id` header. The row is written
before the delivery is trusted and marked `processed` only after a handler runs to
completion, so a redelivery of a half-finished delivery is dispatched again while a
redelivery of a finished one is skipped. The row also keeps the exact bytes the signature
covered, which is what makes a handler that got something wrong auditable afterwards.

**Out-of-order delivery cannot downgrade anybody**, because no handler carries a state to
apply. A `subscription.canceled` arriving an hour late, after the reader has already
resubscribed, causes one extra read of the platform, which answers that the customer holds
an active subscription, and writes exactly what is already there. The only way this design
downgrades a paying reader is if Polar itself reports them as lapsed.

The one race left is two snapshots read seconds apart landing in the wrong order.
`setTier` refuses a snapshot whose `readAt` is older than the stored `tier_checked_at`, so
the later read wins whichever write arrives second.

### Reconciliation

Webhooks get lost. Two paths recover, and neither can lower a tier on a failed read.

**At sign-in.** The OIDC callback already does network work once per session. If the
reader has a `billing_customers` row and `tier_checked_at` is more than 24 hours old, the
callback re-reads the snapshot and writes through before rendering anything. A reader who
paid and did not get what they paid for fixes it by reloading, which is what they will try
first anyway.

**A daily sweep.** A scheduled job walks `billing_customers` in pages, re-reads
`entitlements.of` for each, and writes the projection and the tier. It is bounded by the
number of readers who have ever reached a checkout rather than by the number of readers,
which is the property that makes it affordable at any size the product reaches.

**The window of wrongness**, stated plainly: seconds when the webhook lands; until the
next sign-in when it does not and the reader returns; at most 24 hours when it does not
and they do not. A tier that is too high for up to a day costs the modelled cents above. A
tier that is too low for up to a day is the one that matters, and the grace period below
is deliberately three orders of magnitude longer than the reconciliation window, so a lost
delivery can never be the thing that drops somebody.

**A failed read never writes.** If Polar is unavailable, the snapshot is not read, the
projection is not touched and no tier moves. Nobody is downgraded by an outage at the
provider, which is the failure mode a naive "if we cannot confirm, assume free" would
create and the reason it is spelled out as a rule rather than left to the shape of the
code.

### The grace period

A failed card must not be a data event on the day it fails. The sequence:

1. **Payment fails.** Polar moves the subscription to `past_due` and begins its own
   dunning. The snapshot arrives, the projection records `past_due`, and the effective
   tier does not move. `grace_until` is set to fourteen days out. The reader sees a
   banner: their card failed, here is the portal, nothing has changed.
2. **Days 0 to 14.** Polar retries. The reader keeps every feed, every check, every rule
   and every saved post. They are told at day 0, day 7 and day 12, and each message links
   straight to the hosted portal, because updating a card is the platform's job and this
   app never sees one.
3. **A successful payment at any point** clears `grace_until` and the banner, and nothing
   else happened.
4. **Day 14.** The tier drops to whatever the snapshot says, which is normally `free`, and
   the reader enters the over-limit state below. Still nothing is deleted.

Fourteen days is chosen to cover a card that expired while somebody was away, and to stay
under the shortest calendar month so a lapsed reader never receives a second free month.
It is ours rather than Polar's: a provider that gives up after three retries does not get
to decide how long somebody keeps their reading.

One branch: a reader who cancelled deliberately does not get the grace period. The
projection keeps `cancel_at_period_end` from the last snapshot that saw the subscription,
and when that flag was set the tier drops at the end of the paid period as the reader
asked. Grace is for a lapse somebody did not choose.

The whole rule is one pure function over the snapshot and the stored row, so it is
testable without a platform and without a clock:

```text
entitled = tier the snapshot's products grant
entitled >= current            -> { tier: entitled, grace: null }    upgrades are immediate
cancelled deliberately         -> { tier: entitled, grace: null }    they asked
grace not yet set              -> { tier: current,  grace: now + 14d }
now < grace                    -> { tier: current,  grace: unchanged }
otherwise                      -> { tier: entitled, grace: null }
```

### Downgrade: over-limit is a state, not an error

The reader from the Context section — four hundred feeds, eight hundred thousand posts,
sixty rules, a folder tree — is now on Free. Six rules govern what happens, and the first
is the one the other five serve.

**1. Nothing is deleted, ever, by a tier change.** Not a post, not a feed, not a rule, not
a folder, not a saved item. A tier change writes one column and triggers no sweep. This is
ADR-002's position on its own budget, applied to a limit that moved rather than to an
object that grew.

**2. Nothing new is accepted while over.** Each limit refuses its own additions and nothing
else. Over the feed cap, `followFeed` refuses and says by how many. Over the saved cap,
`saveItem` refuses, which is the refusal ADR-002 already built with a smaller number in it.
Over the rule cap, creating a rule refuses. Over the storage budget, synchronization pauses
— which is, exactly and without modification, ADR-002's back-pressure path, reached by a
different route.

**3. A stored shape is retained and frozen; a recurring computation is retained and
paused.** This is the line that decides everything ambiguous, and it has a cost argument
behind it rather than a punitive one. A folder is a row; evaluating it is free; taking it
away scrambles a reading surface for no saving. A filter rule runs on every synchronization
forever; leaving it running is a paid feature being consumed indefinitely by somebody who
is not paying.

So folders and tags keep working — existing ones stay, stay assignable, stay filterable,
and creating a new one is refused. Filter rules stop running and stay in the database,
shown on their own page as paused rather than missing, because deleting them would put a
re-entry chore on the path back and that is the last place to put friction. The same rule
paused-and-retained covers background checks, notifications, full-text extraction, MCP
sessions, email digests, AI features and the public API, all of which answer with the tier
they need rather than with a 404.

**4. Search narrows, and the posts do not.** Free searches the last thirty days. The older
posts are still stored, still in the timeline, still openable and still exportable — only
the search query carries a bound. That is a genuine reduction and the one a downgraded
reader will feel, and it is defensible because the query is the feature while the rows are
their data.

**5. The storage budget is not retroactive.** ADR-010 sizes a budget per tier, and a
premium reader dropping to a free budget would be over it by a factor nothing can
reclaim. ADR-002's sweep reclaims read posts when an object is over budget, and that
behaviour must not become the mechanism by which a downgrade deletes eight hundred
thousand posts. The constraint this ADR places on ADR-010: **reclamation stays triggered by
the object's own budget from ADR-002 — a physical limit no tier change can move — while a
tier budget below what the reader already holds converts to back-pressure instead.** The
tier budget bounds new material; it never reaches backwards.

**6. The reader is told what to do, in numbers, with no clock on it.** One banner and one
`/account` panel list every limit they are over and by how much: unfollow 350 feeds, unsave
700 posts, or subscribe again. There is no countdown, because nothing is going to be
deleted, and a countdown on a page where nothing expires is a lie told to create urgency.

What makes all of this cheap is the property it buys: **coming back is one column write.**
Re-subscribing flips `tier`, every refusal stops refusing, every paused computation resumes
on the next alarm, and there is no restore, no re-import and no migration. Retaining
everything is not generosity — it is what makes the return path a single row update instead
of a recovery procedure, and that is the actual argument for it.

### Where each limit is enforced

The rule: **every limit is checked inside the `UserDO`, in the RPC method that performs the
thing, never only in the form that offers it.** A form check is a courtesy that tells the
reader before they type. It is not enforcement, because OPML import, the MCP server, the
public API and a replayed form post all reach the same RPC method and none of them goes
through the form.

| Limit                | Enforced in                                    | On                                                 |
| -------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Feed count           | `UserDO.followFeed`, before the catalog upsert | every follow, including each URL of an OPML import |
| Saved posts          | `UserDO.saveItem`                              | every save                                         |
| Rule count           | `UserDO.createRule` (ADR-009)                  | every create                                       |
| Check interval       | the `UserDO` alarm's own re-arm                | every alarm firing                                 |
| Storage budget       | the `UserDO` sweep (ADR-010)                   | every sweep                                        |
| Background checks    | whether the alarm is armed at all              | a free reader arms none                            |
| Full-text extraction | the extraction call in the `UserDO`            | every extraction                                   |
| MCP access           | the MCP session setup (ADR-006)                | every session                                      |
| Public API access    | route middleware reading the tier              | every request                                      |

The first seven cost nothing to check: the object already holds both the tier and the
count, so the comparison is a local query in code that was going to run anyway. The last
two are surface gates rather than counts, and they read the tier through the RPC call the
request was already making.

Refusals cross the RPC boundary as discriminated unions, never thrown and never a `Result`,
as `AGENTS.md` requires — `{ ok: false, reason: "over-limit", limit, current, tier }`, so
the caller can render the exact sentence rather than a generic failure.

Enforcing background checks by not arming the alarm is worth one clarification, because
"no background checks" reads worse than it is. The shared `FeedDO` polls every feed daily
for everybody, regardless of who is subscribed and at what tier, since one poll serves
every subscriber. What a free reader loses is their own object waking on a clock to compare
heads and tell them. Their timeline still catches up in full the moment they open the app,
through `openReader`. Nothing goes stale; nobody wakes up for them.

### What the free tier deliberately does not limit

The cost model puts a typical free reader under a cent a month, so a thousand of them cost
about nine dollars. The free tier's limits are therefore **conversion design rather than
cost control**, and they should be judged as such. Feeds, retention and background checks
are the levers, because those three are the only ones that scale with real cost and also
map onto something a reader can feel themselves outgrowing. Everything else is left alone
on purpose:

- **Reading.** Unlimited posts read, marked read, unread counts, velocity settings. Reading
  is the product; metering it would be metering the demo.
- **Export.** OPML export works on every tier, at any time, including while over every
  limit. A reader can always take everything out. A paywall on the exit makes the free tier
  a trap, and a product that needs one is not worth selling.
- **On-demand checks.** "Check now" is unlimited. It is bounded by the reader's patience
  and by the shared object's conditional requests, and removing it would make the free tier
  feel broken rather than limited.
- **Quality.** Same pages, same speed, no ads, no tracking, no degraded surface.

Starving the free tier saves nothing measurable and costs the only sustained demonstration
the product gets. The limits that exist should be the ones a reader notices by growing into
them, not the ones they notice on day one.

### No trial

There is no trial of Paid or Premium, for three reasons.

The free tier is the trial, and it does not expire. Fifty feeds and a hundred saved posts
is a genuinely usable reader; somebody who outgrows it has demonstrated the thing a trial
exists to demonstrate, on their own schedule. `apps/auth-saas` trials because its product
has no useful free mode — an OIDC provider either serves traffic or does not — so the
argument that applies there does not transfer.

A time-limited trial manufactures the downgrade problem on a timer, for every trialist, and
most trialists do not convert. The most common experience of the product would become the
over-limit banner, which is the one screen this ADR works hardest to make rare.

And nothing is foreclosed. Polar supports trials, and a trial here is already expressible
as `tier = 'paid'` with `tier_source = 'grant'` and a `grace_until`, which reconciliation
declines to lower. Starting one later is a decision, not a schema change.

The cost to name: a reader who would have converted after tasting filter rules and
full-text extraction never tastes them. The answer that is not a trial is to show those
features where they would be used, refused with the price attached rather than hidden, so
the free tier advertises the paid one instead of concealing it.

### Observability

Structured events through `@sdxc/logger` ([ADR-033](../ADR-033-wide-events-as-the-logging-contract.md)),
carrying identifiers and outcomes and never a payment detail:

| Event                    | Fields                                                |
| ------------------------ | ----------------------------------------------------- |
| `billing.delivery`       | `deliveryId`, `type`, `valid`, `replay`               |
| `billing.synced`         | `subject`, `status`, `from`, `to`, `source`           |
| `billing.sync.failed`    | `customerId`, `code`, `providerCode`, `retryable`     |
| `billing.grace.started`  | `subject`, `tier`, `graceUntil`                       |
| `billing.grace.expired`  | `subject`, `from`, `to`                               |
| `billing.reconciled`     | `customers`, `changed`, `failed`, `durationMs`        |
| `entitlement.refused`    | `subject`, `tier`, `limit`, `current`, `allowed`      |
| `entitlement.over_limit` | `subject`, `tier`, `feeds`, `saved`, `rules`, `posts` |

`entitlement.refused` is the one to watch: a rising count on a limit nobody was warned
about is a limit set in the wrong place, and it is visible before anybody writes in about
it.

## Consequences

### Positive

- Every limit is a local comparison in the object that already holds both numbers. No
  enforcement point costs a network call, and none of them can be bypassed by reaching the
  same RPC method through a different door.
- A replayed, late or duplicated delivery cannot downgrade a paying reader, because no
  handler carries state to apply. The correctness argument is the same one ADR-002 makes
  about the freshness index, so there is one idea to understand rather than two.
- A lost webhook is recovered within a day, and the grace period is two weeks, so a delivery
  failure has three orders of magnitude of headroom before it could ever be visible to a
  reader.
- Nothing a reader owns is ever deleted by a billing event, at any point in the lapse
  sequence, on any tier. The only rules that delete posts remain the two ADR-002 named:
  a velocity the reader chose, and physical pressure on the object.
- Coming back from a lapse is one column write. No restore path exists because none is
  needed, which is also why none can be broken.
- The projection is rebuildable from the platform by replaying `entitlements.of` over the
  customer table, so losing D1 costs a sweep rather than a subscription, and a provider
  outage cannot downgrade anybody because reconciliation writes only on a successful read.
- Reconciliation is bounded by the number of readers who have ever reached a checkout, not
  by the number of readers, so it stays affordable at any size the free tier reaches.
- The app writes no signature verification, no dedup logic and no retry policy; all three
  come from `@sdxc/billing` and `@sdxc/webhooks`, and a reviewer who has read
  `apps/auth-saas` recognizes this endpoint on sight.

### Negative

- The tier is a cached value with external writers, so there is a window in which it is
  wrong. It is bounded and it fails in the generous direction, but "bounded" is not "zero",
  and a reader who pays and closes the tab may wait a day for a lost delivery to be
  reconciled.
- A reader who cancels while the platform reports them active keeps the tier until the
  period ends, which is correct, and a reader whose card lapses keeps it for a further two
  weeks, which is a real cost paid deliberately on every lapse including the ones that never
  recover.
- A downgraded reader holding Premium-sized data keeps costing Premium-sized storage
  indefinitely, because rule 1 says nothing is deleted and rule 5 says the tier budget does
  not reach backwards. The bound is ADR-002's physical budget and nothing else.
- Over-limit is a state the interface has to explain in several places, and it can be
  reached on several axes at once. A reader over four limits sees four sentences.
- Filter rules pausing rather than deleting means a reader can accumulate rules that are not
  running, which is a state that looks like a bug until the copy explains it.
- The free search window is the one thing a downgrade takes away that the reader can point
  at. It is not deletion, and it will be experienced as if it were.
- Four new columns on a row that had five, plus three D1 tables and a webhook endpoint, in
  an app whose entire point was that a reader's data lives in one object.
- Polar's $5 floor sets the paid price, so the middle tier is priced by the provider rather
  than by the product. If that floor moves, the tier structure is what absorbs it.
- The AI line in the cost model is unbounded by anything in this ADR. Premium needs a quota
  that does not exist yet, and until it does, the worst-case Premium margin is a guess.

### Neutral

- `tier_source` makes staff accounts, comps and a future trial expressible without a schema
  change, and nothing uses the `grant` value yet.
- Usage-based pricing stays available: `@sdxc/billing` has an optional `usage` group and
  Polar implements it, so a metered tier later is configuration rather than architecture.
- The tier vocabulary is three strings with a `CHECK` beside them, spelled the way
  `VELOCITIES` already is, so a fourth tier is a migration and a constant.

## Alternatives Considered

**Read the tier from D1 on every request.** One source of truth, no cache, no
reconciliation. It puts a database round trip inside a single-threaded Durable Object on
every enforcement point, and it breaks `AGENTS.md`'s rule that only `database/registry.ts`
holds the catalog's binding. The read path was kept clear of D1 deliberately in ADR-002 and
this would put it back, for a value that changes a handful of times per reader per lifetime.

**Read entitlements from Polar on demand, with no local state.** Flowglad's "zero webhooks"
position, and genuinely simpler: no projection, no delivery store, no reconciliation. It
makes Polar's availability a precondition for saving a post, adds a third-party round trip
to operations that are currently one local query, and turns the rate limit on a billing API
into a rate limit on reading.

**Trust the webhook payload and apply the state it carries.** No second round trip per
delivery, and the obvious implementation. It is wrong under exactly the conditions webhooks
actually have: a replay re-applies, a late `canceled` overwrites a newer `activated`, and a
missed delivery leaves the state permanently wrong with nothing to notice it. dj-stripe's
own handlers carry the warning, and ADR-043 records it.

**Delete data on downgrade, after a warning period.** Bounded storage, no permanently
over-limit readers, and every other product in this category does some version of it. It
requires deciding which three hundred and fifty of somebody's four hundred feeds to
destroy, and destroying reading history over a payment failure is the single thing most
likely to make a person never come back. Storage is cents.

**Make the data read-only on downgrade — no new posts at all.** Simpler than per-limit
refusals: the object freezes entirely. It punishes the fifty feeds a free reader is entitled
to for the sake of the three hundred and fifty they are not, and it makes the free tier
unusable for anybody who ever paid, which is precisely the population most likely to pay
again.

**Enforce limits in the controllers.** Every check next to the form that triggers it, and
the `UserDO` stays unaware of tiers. The MCP server, the public API and OPML import all
reach the same RPC methods without passing a controller, so this is three enforcement gaps
by construction and a fourth the next time a surface is added.

**Per-feature entitlement flags rather than three tiers.** `EntitlementState.features`
already carries a flag map, so the platform supports it. It replaces one comparable column
with a bag of booleans that every call site has to agree about, and the product sells three
prices, not a matrix.

## Tests

Twenty-eight behaviours: the pure paths in plain Vitest, the object and D1 paths in
`*.workers.test.ts` with `@sdxc/cloudflare-mocks`, and the platform behind
`@sdxc/billing/providers/memory` rather than a hand-rolled double.

| #   | Behaviour                                                                                         |
| --- | ------------------------------------------------------------------------------------------------- |
| 1   | A new reader's settings row is `free` from `default`, with no billing customer anywhere           |
| 2   | Every limit check reads the local `tier` column and issues no D1 query and no platform call       |
| 3   | A paid checkout creates the Polar customer with the OIDC subject as its external id               |
| 4   | A delivery whose signature does not verify is answered `401` and dispatches nothing               |
| 5   | A delivery is recorded before it is trusted, and marked processed only after the handler finishes |
| 6   | The same delivery arriving twice is dispatched once                                               |
| 7   | A redelivery of a delivery that failed mid-handler is dispatched again                            |
| 8   | Every handler re-reads the snapshot and reads no state out of the delivery payload                |
| 9   | A late `subscription.canceled` for a resubscribed reader leaves them on their paid tier           |
| 10  | A snapshot older than `tier_checked_at` is refused, so the later read wins either ordering        |
| 11  | An upgrade takes effect on the snapshot that reports it, with no grace period in the way          |
| 12  | A first `past_due` snapshot sets `grace_until` fourteen days out and moves no tier                |
| 13  | A successful payment inside the grace window clears `grace_until` and changes nothing else        |
| 14  | The tier drops only once `grace_until` has passed, and drops to what the snapshot says            |
| 15  | A deliberate cancellation drops at the end of the paid period with no grace period                |
| 16  | Sign-in with a stale `tier_checked_at` re-reads and writes through before rendering               |
| 17  | Sign-in with a fresh `tier_checked_at` reads nothing from the platform                            |
| 18  | The daily sweep walks only readers holding a billing customer row                                 |
| 19  | A failed platform read writes no projection row and lowers no tier                                |
| 20  | A tier drop deletes no post, no feed, no rule, no folder and no saved item                        |
| 21  | A reader over the feed cap is refused a new follow and told how many to unfollow                  |
| 22  | An OPML import over the cap follows up to the limit and reports each URL it refused               |
| 23  | A reader with 800 saved posts on a 100 cap keeps all 800 and is refused the 801st                 |
| 24  | A downgraded reader's folders and tags keep working, and creating a new one is refused            |
| 25  | A downgraded reader's filter rules stop running, stay stored, and resume on resubscription        |
| 26  | A tier budget below what a reader holds pauses synchronization and reclaims nothing               |
| 27  | OPML export succeeds on the free tier while the reader is over every limit                        |
| 28  | Resubscribing restores every refused operation with one column write and no migration             |

## Implementation

- [ ] `tier`, `tier_source`, `grace_until`, `tier_checked_at` on `settings`, with their `CHECK`s
- [ ] `TIERS`, the limit table per tier, and `effectiveTier` as a pure function
- [ ] `app/lib/billing.ts` — the `PolarBilling` instance, product slugs, connection code
- [ ] `PLATFORM_DB` migrations for `billing_customers`, `subscriptions`, `billing_webhook_deliveries`
- [ ] The `WebhookStore` over `billing_webhook_deliveries`, in `database/registry.ts`
- [ ] `POST /webhooks/billing` as a `BillingWebhook`, and its seven handlers
- [ ] `setTier` and `entitlement` RPC on the `UserDO`, refusals as discriminated unions
- [ ] Checkout and portal routes, and the `/account` panel they hang off
- [ ] Limit checks in `followFeed`, `saveItem`, `createRule`, the alarm re-arm and the sweep
- [ ] Surface gates for MCP and the public API
- [ ] Sign-in reconciliation in the OIDC callback
- [ ] The daily reconciliation job over `billing_customers`
- [ ] Over-limit banner and `/account` panel, with copy in `app/locales/en.ts` and `es.ts`
- [ ] Lapse notifications at day 0, 7 and 12, linking to the hosted portal
- [ ] `doStorageGbDay`, `doRowRead` and `doRowWritten` appended to `apps/uptime/app/lib/cost-rates.ts`
- [ ] The tests above, and the structured events
- [ ] Add the billing webhook route and `app/lib/billing.ts` to the app's README service table

## References

- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — the architecture this constrains, and the back-pressure rule the downgrade reuses
- [ADR-004](./ADR-004-background-freshness-checks.md) — the check interval this tier decides
- [ADR-006](./ADR-006-mcp-server.md) — the surface this tier gates
- [ADR-009](./ADR-009-filter-rules.md) — the rule count this tier caps
- [ADR-010](./ADR-010-retention-tiers-and-archive.md) — the storage budget this tier sizes
- [ADR-043](../ADR-043-billing-package-with-pluggable-providers.md) — the billing package, its contract and its webhook endpoint
- [ADR-026](../ADR-026-standard-webhooks-parsing-package.md) — the signature verification the provider reaches through
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the events follow
