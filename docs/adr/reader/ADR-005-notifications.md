# ADR-005: Notifications From the Reader's Own Check

## Status

**Accepted** - 2026-09-16

## Background

[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) turned freshness into a
pull. A feed's object publishes one number when it stores something, a reader compares it against
their own cursor when they open the app, and nothing tells anybody anything — which is what made
publication cost stop responding to subscriber count. It named the price in its own Negative
consequences: nothing can reach a reader who is not looking, and any feature that has to push — it
lists an email digest and a web push notification by name — would need a subscriber walk the design
deliberately does not have.

[ADR-004: Background Freshness Checks](./ADR-004-background-freshness-checks.md) changes what "not
looking" means. A `UserDO` now wakes on its own schedule and runs the reader's freshness check with
no request behind it. The reader is not looking, and their object is. This ADR is what that object
does with what it finds.

## Context

### What ADR-002 refused was fan-out, not push

The warning is right about the shape it was written about, and that shape is _publish-time_ push. A
`FeedDO` that has just stored twenty items and wants to tell everybody has to walk `subscribers` and
touch one object per row — ten thousand writes for a fact each of those readers could derive, most
of them for people who will not open the reader today. That is the cost the architecture exists to
remove, and no arrangement of the writes reduces their number.

A scheduled reader-side check needs none of it, because nobody is telling anybody. The `UserDO` is
already awake on a schedule of its own, already holds the subscriptions, already read the heads,
already materialized the posts. A notification is a statement about work that object has just
finished, made to the one person it belongs to. There is no list to walk: the list is one row long,
and it is the object itself.

So the `FeedDO` is untouched here. It still writes one KV key per publication, still knows nothing
about who subscribes, and still costs the same at one follower and at a hundred thousand. **Push was
never what ADR-002 could not afford. Fan-out was, and a reader notifying themselves has none.** The
cost therefore scales with readers who asked to be notified, which is the only denominator a plan
price can absorb.

Nor is anything added on the reader's side. `UserDO` gets one alarm, because an object gets one, and
that alarm already carries catch-up synchronization and the scheduled check; this ADR adds no second
timer, no queue and no cron Worker. Notification is the last step of a check that was going to run
anyway, and none arrives without a check having found something.

### Two channels, and one of them waits

Web Push is first because it needs nothing from anybody: keys generated once, delivery an outbound
`fetch` from an object already awake, the recipient a browser the reader already reads the app in,
and nothing metered. Email needs everything this app lacks — a stored address, a sender identity, a
verified domain, a deliverability reputation a bug in the batching rule could spend in an afternoon,
and a price per message. None of that is needed to learn whether the notification is any good, so it
is not paid to find out; specifying both here makes the second a transport and a column.

### A reader's answer is about feeds; devices are only where it lands

Wanting three feeds and silence from ninety is a judgement about publishers, and it does not change
when the reader picks up a different laptop. Asking again per device would make setup cost
proportional to hardware and leave two lists to disagree forever. So the per-feed answer is shared
by every device, and devices are a list the reader can see and revoke. What they choose per account
rather than per feed is _how_ they are reached, because the alternative is a grid of feeds by
channels that nobody fills in.

### Forty posts is one notification

A check that materializes forty posts across nine feeds has found one fact worth interrupting
somebody for, and it is "there is new stuff". Forty notifications is the version that gets the app
silenced, and on the metered channel it costs forty times as much to achieve that.

So the unit is the check rather than the post — and that unit has to survive three further
requirements: a minimum gap between interruptions, quiet hours that suppress without losing
anything, and a failed delivery that should be retried. Written separately they are three places to
get the arithmetic wrong. They collapse into one if a notification summarizes **everything that
arrived since the last notification** rather than what this check found: a suppression becomes a
deferral by construction, a failed send is retried by the next check with a larger summary, and the
state under all of it is one timestamp with one writer.

### The app does not know what time it is where the reader is

There is no time zone anywhere in `apps/reader`. The OIDC profile does not carry one, and the
`Viewer` projected from the ID token in `app/http/middleware/auth.ts` is a name, an email and
an avatar. Quiet hours without a zone are quiet hours in UTC, which is wrong for everybody
outside one band of longitude and wrong in a way that only shows up at 3am. The minimum that
works is one string, and the browser already knows it.

### Latency is three numbers, and the largest is not ours

A post becomes a notification only after the feed's object fetched it, the head propagated through
KV — eventually consistent, up to a minute — and the reader's check ran. Under ADR-002 the first is
a **daily** poll, and it dominates the other two by two orders of magnitude. A claim built on the
reader-side cadence alone would be a claim about the smallest of the three terms.

### Limits that shape the design

| Limit                           | Value                  | Consequence                                             |
| ------------------------------- | ---------------------- | ------------------------------------------------------- |
| Alarms per object               | 1                      | Notification rides the check; it gets no timer          |
| Push payload, most services     | ~4 KB encrypted        | A summary fits; a list of post titles argues            |
| Push endpoint lifetime          | Revoked without notice | `404`/`410` is a delete, never a retry                  |
| Workers email included monthly  | 3,000 messages         | A deployment-wide pool, not a per-reader allowance      |
| `emailSent`                     | 3.5e-2 cents           | The one channel whose cost is not a rounding error      |
| Outbound `fetch` from an object | Not separately metered | Web push costs the object's wall clock and nothing else |

## Decision

The scheduled check notifies the reader it belongs to — Web Push first, email second — from
the alarm that ran it, with no publish-time fan-out anywhere.

### Where it runs, and where it must not

Notification is the last step of a check: after synchronization has written its rows, after every
cursor has advanced, after the retention sweep. Last because it is the only step whose failure costs
nothing but itself, and putting it behind the writes makes "a delivery cannot strand a cursor"
structural rather than careful.

**Only the alarm notifies.** The synchronization a reader's own request starts through `waitUntil`
sends nothing, ever. Buzzing a phone about a page the reader is looking at is the fastest way to get
the feature turned off, and keeping delivery off the request path means no page waits on a push
service. `synchronize()` takes its trigger the way `FeedDO.refresh(reason)` does, so notification
follows from one reason rather than from a parameter every caller has to remember.

### Push subscriptions in the UserDO

One reader's devices are that reader's data, are deleted when the account is, and are enumerated
by nothing outside the object. They go in a fourth table:

**`push_subscriptions`** — `id` (a `push_…` `TypeID`), `endpoint`, `p256dh`, `auth`,
`user_agent`, `last_delivered_at`, `failure_count`, `created_at`, `updated_at`.

`UNIQUE (endpoint)` makes registration idempotent: a browser that re-subscribes hands back the
endpoint it already had, so a reader signing in twice on one device has one row rather than two
notifications. `p256dh` and `auth` are the client's public key and auth secret as the Push API hands
them over, and are what the payload is encrypted under. `user_agent` lets the settings page say
"Firefox on Linux, added in March" instead of showing a 200-character URL and asking which to
revoke. `failure_count` covers transient refusals only: any acceptance resets it, and ten
consecutive failures delete the row, because an endpoint refusing across ten checks is not coming
back.

### Opt-in on the subscription, off by default

`feeds` gains `notify`, `NOT NULL DEFAULT 0`. It sits beside `velocity` for the reason
`velocity` is there: it is this reader's answer about this publisher, and two readers of one
newspaper disagree about it. `settings` gains `notify_push` and `notify_email`, both off,
deciding how a notified feed reaches them.

**The default is off at every level and survives every change of state.** Following a feed does not
opt it in, importing two hundred from OPML opts none of them in, and changing plan opts nothing in —
which is the case worth being explicit about, because a reader who upgrades bought a faster check,
not an alarm clock, and an upgrade that starts a phone buzzing is the kind of surprise that gets
refunded. Nothing infers an opt-in either: ADR-002 measures a feed's publishing rate to _suggest_ a
velocity, and the same measurement is a bad reason to switch notification on, because a feed
publishing forty times a day is the one a reader least wants pushed.

### One notification, derived from one timestamp

`settings` gains `last_notified_at`, nullable, and it is the only notification state that exists.
Everything else is derived, in the spirit of ADR-002's staleness: computed state cannot drift,
cannot be set by one path and left unset by another, and cannot be lost. After a check has written
its rows, the object counts the posts it materialized since `last_notified_at` from feeds where
`notify = 1` and `unfollowed_at IS NULL`. Zero means nothing happens and nothing is written;
non-zero, with the gap and quiet hours allowing it, means one notification and
`last_notified_at = now`. The count is of rows this object wrote, never of what the heads implied: a
KV head can over-report, velocity drops items on the way in, and back-pressure can pause a feed
entirely, so a count from anywhere else would name posts the reader does not have.

**The threshold is one post.** A higher number reads as prudent and is wrong for the reader who
configured this most deliberately: somebody who picked three feeds out of ninety-three chose those
three, and a threshold of five would leave a weekly blog silent forever while a daily one crossed it
every time. A count threshold silences quiet feeds, which are exactly the feeds worth a notification.

What bounds interruptions is a **minimum gap** — fifteen minutes for push, four hours for email —
because a gap bounds notifications per day however the posts are distributed, and a count does not.
A check inside the gap does nothing; the next one outside it carries everything, because the summary
was never about that check.

### Quiet hours

`settings` gains `time_zone` (an IANA name, defaulting to `UTC`), `quiet_from` and `quiet_to` (local
hours, defaulting to 22 and 7, applied only when the reader turns them on). The zone is captured
from the only participant that knows it — `Intl.DateTimeFormat().resolvedOptions().timeZone`, posted
once when it differs from what is stored. A name rather than an offset, so daylight saving is the
platform's problem instead of arithmetic that is wrong twice a year.

Two assumptions come with it, named rather than solved: a traveller keeps their old zone until they
next open the app there, and a reader signed in from two zones gets whichever signed in last, on
every device. Both are acceptable only because a suppressed notification is **held, not dropped** —
a suppression does not advance `last_notified_at` — so the worst outcome of a wrong zone is a
notification at an odd hour, never one that does not arrive.

### What the payload carries

A count, up to three feed titles, and the URL to open. No post titles, no post URLs, no author,
no excerpt, no identifier beyond the endpoint the push service already has.

The encryption is real — RFC 8291 over the subscription's `p256dh` and `auth`, `aes128gcm` — so the
service moves a ciphertext it cannot read. That is not the whole argument, because the decrypted
payload sits on a lock screen and in the browser's notification store afterwards. A feed title makes
the notification worth tapping and reveals that this person follows that publication, which their
opt-in list already is and which is bounded by a set they chose. A post title reveals what they are
reading right now, on a screen anybody nearby can see, to save one tap on a page they were about to
open. The first is the minimum that makes the feature work; the second is reading history, declined.

The timing side channel is not claimed away: a push service learns that this endpoint received
something of about this size at this time, a coarse activity signal encryption does not hide, and
part of why the channel is opt-in.

### Delivery, and what a refusal means

One `POST` per device, with a VAPID `Authorization` header and the encrypted body, delivered
concurrently. The response decides what happens to the row:

| Response     | Meaning                           | Action                                 |
| ------------ | --------------------------------- | -------------------------------------- |
| `201`, `202` | Accepted                          | Stamp `last_delivered_at`, clear count |
| `404`, `410` | The browser revoked this endpoint | Delete the row, now                    |
| `429`, `5xx` | The service is busy or broken     | Increment `failure_count`, keep it     |
| `400`, `403` | Our signature or keys are wrong   | Log it loudly, keep the row            |

A `410` is the browser telling the truth, so it is acted on rather than counted; retrying it would
push at a device that cannot receive, forever. A `403` is the opposite — that is our bug, and
deleting a reader's device because we mis-signed a token would turn a deploy mistake into permanent
data loss.

**The alarm must never reject**, which ADR-001 established for refresh and ADR-002 restated for the
poll. The notification step resolves to counts inside a `try`, delivery failures are values, and the
re-arm is unaffected by anything here. `last_notified_at` advances when **at least one** device
accepted: requiring all would let one broken endpoint re-notify every working one on every check,
and requiring none would drop the notification whenever the first send failed.

### Email, and the address it needs

Email goes through `@sdxc/mail`
([ADR-018](../ADR-018-mail-package-with-pluggable-transports.md)) over its Cloudflare transport and
an `EMAIL` binding, with the body built from the package's `remix/ui` layout kit so the plain-text
alternative is not an afterthought. The package's middleware publishes a mailer as `context.email`
per request and an alarm has no request, so the object constructs one directly —
`new Mailer({ transport: new CloudflareTransport(this.env.EMAIL), from })` — and branches on the
`Result` that `send()` returns rather than catching a rejection.

The address is the problem. The app stores none: `settings` holds the subject, and the email is read
off the ID token per request. An alarm has no token either. So `settings` gains `email`, written by
`ensureUser` on every completed sign-in, which is idempotent already and therefore picks up a
changed address for free. It is the only personal datum this object stores beyond the subject it is
named for, and it is never a key — ADR-001's rule that an object is addressed by subject and never
by email stands, because an address can be reassigned.

One deployment prerequisite is real: the Workers email binding sends from a verified domain, and to
arbitrary recipients only on an account configured for it. Email does not ship until that is true,
which is part of why it is second.

### VAPID keys

Three values: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` — the last a `mailto:` a
push service contacts about a misbehaving sender. The private key is a secret, set with `wrangler
secret put` and never in `wrangler.jsonc`, and all three are listed in `.env.example` beside
`CLIENT_ID`, `CLIENT_SECRET` and `COOKIE_SESSION_SECRET`. The public key is public by definition —
the browser needs it as `applicationServerKey` to subscribe at all — and is carried in the same list
anyway, because one key pair managed by two mechanisms gets rotated by one of them.

Signing is an `ES256` token through `@sdxc/jwt`, which already does P-256 for the OIDC provider. The
encryption has no prior art here and is written in `app/push/web-push.ts`: a pure function taking
keys and a subscription and returning a `Request`, tested against RFC 8291's published vectors with
no network and exercised through MSW where a delivery is. Key material is read there, the way
`app/auth/` reads its credentials, which makes it the sixth module `AGENTS.md` lists as reaching for
the environment.

### What the product may claim

**"Within minutes of a check"** is true and is the whole of what may be said. "Instant", "real-time"
and "the moment it is published" are false, and the middle one is false even for a Premium reader on
a five-minute check, because five minutes after the check is not five minutes after the post. The
claim improves only if the shared poll cadence does, which is a `FeedDO` decision this ADR does not
make. What a faster check buys is the delay between the system knowing and the reader knowing, and
that is the part being sold.

### The digest is deferred

Every delivery decided here is _caused_ by posts a check has just written, which is why it needs no
schedule of its own. A digest is the opposite: it fires at a time of day whether or not anything
arrived, so an object whose one alarm is already shared between catch-up and the check would have
that alarm answer to three due times. That is a different decision with a different failure mode,
and it wants the thing this ADR declines to send — a list of post titles, safe in an inbox the
reader controls and not safe through a third party. Two features that disagree about their payload
are two features.

### Cost

Web push is an outbound `fetch` from an object that is already awake. The rate card has no line for
a subrequest, so its entire priced footprint is the wall clock it holds the object open for, at
`doDurationMs` 1.5625e-7 cents per millisecond. A Paid reader checking every thirty minutes, four
feeds opted in, three notifications a day across two devices — 90 a month, each adding about 200 ms
to a firing that was happening anyway — is `90 × 200 × 1.5625e-7` = **0.0028 cents a month**. A
Premium reader at five minutes with twelve a day is 360 a month, **0.011 cents**. Against 500 and
1,200 cents of monthly revenue both are noise: about two thousandths of one percent of a Paid seat.

Email is the channel with a price, at `emailSent` 3.5e-2 cents:

| Reader                     | Notifications / month | Cents / month | Share of price |
| -------------------------- | --------------------- | ------------- | -------------- |
| Paid, 3/day                | 90                    | 3.15          | 0.63% of $5    |
| Premium, 12/day            | 360                   | 12.6          | 1.05% of $12   |
| Premium, at the 4-hour gap | 180                   | 6.30          | 0.53% of $12   |
| Premium, per-post, 20/day  | 600                   | 21.0          | 1.75% of $12   |
| Premium, every 5-min check | 8,760                 | 306.6         | **26% of $12** |

The last row is what the batching rule exists to prevent, and it is not hypothetical: a reader who
opts in two hundred busy feeds on the fastest cadence sold spends a quarter of their subscription on
one channel. **The four-hour gap converts email cost from a function of how much the world publishes
into a function of how many hours are in a month** — six a day, 180 a month, 6.3 cents, per reader,
whatever any feed does. A cost that can be stated as a maximum can be priced into a plan; one
proportional to publishing volume cannot. Workers Paid includes 3,000 messages monthly, a
deployment-wide pool rather than a per-reader allowance, so the first ~33 email-notified readers
cost nothing and the 34th starts the meter — worth saying, because zero during a beta is not
evidence the channel is free.

### Observability

Structured events through `@sdxc/logger`
([ADR-033](../ADR-033-wide-events-as-the-logging-contract.md)), counts only — no feed titles, no
post titles, no addresses, no endpoints.

| Event                    | Fields                                                 |
| ------------------------ | ------------------------------------------------------ |
| `user.notify`            | `posts`, `feeds`, `channels`, `devices`, `durationMs`  |
| `user.notify.suppressed` | `reason` (`gap`, `quiet-hours`, `no-channel`), `posts` |
| `push.delivered`         | `status`, `durationMs`                                 |
| `push.expired`           | `status`, `failureCount`                               |
| `push.registered`        | `devices`                                              |
| `mail.notify`            | `ok`, `posts`, `feeds`                                 |

The suppression reason is carried because the three fail differently: a gap and quiet hours are
working as designed, and `no-channel` is a reader who thinks they configured notifications and did
not.

## Consequences

### Positive

- Notifications exist with no subscriber walk anywhere. The `FeedDO` is unmodified, still writes one
  KV key per publication, and still costs the same at one follower and at a hundred thousand.
- No timer, no queue, no consumer, no dead-letter path, no cron Worker and no message that can be
  delivered twice — the trigger is an alarm that was already firing.
- Cost scales with readers who asked to be notified rather than with subscriptions or with how much
  the world publishes.
- Batching, quiet hours, the gap and retry-after-failure are one rule over one timestamp, and a
  suppressed or failed notification is deferred rather than lost.
- The first channel ships without storing new personal data, and nothing is notified that the reader
  did not pick out of a list.
- No page waits on a push service, and a reader looking at the app is never notified about it.

### Negative

- Latency is dominated by the daily shared poll, which this ADR cannot change. The cadence a plan
  sells is the smallest of three terms, and honest copy has to say so while the pricing page sells
  the one it improves.
- Email at a fast cadence is the one cost here that is not trivial, and the gap bounding it is also
  a ceiling on how responsive the channel may be.
- Web Push needs a registered service worker, and this app has none — no service worker, no
  manifest, no client-side storage at all. That is real work whose only purpose is to receive
  notifications, and it adds a cached script whose update semantics the app has never faced.
- RFC 8291 encryption is written here rather than depended on: testable against published vectors,
  and still a cryptographic implementation in an app that had none.
- The object stores an email address where it stored only an opaque subject, and a push service
  learns the timing and rough size of every notification — a coarse activity signal encryption does
  not hide.
- Quiet hours rest on a zone captured from a browser, so a traveller and a reader signed in from two
  zones get the wrong window until they next open the app.
- Two tables grow columns and a fourth appears, in an object ADR-002 had just finished reshaping.
- A reader can end up with feeds opted in and no channel enabled, believing they configured
  something. The event finds them; the interface still has to prevent it.
- The `EMAIL` binding is a new platform dependency with an account-level prerequisite and a
  deliverability reputation a bug in the gap rule could spend quickly.

### Neutral

- One alarm now carries three jobs rather than two, and which one a firing is doing stays a
  question about state rather than a flag, as it already was between catch-up and the check.
- Cross-reader notification statistics have the same non-home as before: the catalog could hold
  them and nothing computes them.

## Alternatives Considered

**Notify from the `FeedDO` when a poll stores items.** The lowest latency available, and the one
thing this architecture cannot do: the subscriber walk ADR-002 removed, reintroduced for a feature
rather than for correctness, as an unbounded loop of RPC calls inside a single-threaded object
holding an alarm that must not reject. One slow push service delays a feed's next poll for everybody.

**A queue between the feed and the readers who want notifications.** Bounds the loop and makes the
walk retryable, and buys back every property a queue forces you to design around — duplicate
delivery, reordering, loss — for a notification a scheduled check derives with none of them. It also
writes per publication rather than per reader-who-asked, which is the wrong denominator. Keeping the
"notify me" flag in the shared KV namespace so a feed can check cheaply is the same mistake with
fewer moving parts: per-reader state in a shared store is the fan-out through a different door.

**One notification per post.** Simplest to write, the behaviour that makes people turn notifications
off, and on email the row that spends a quarter of a Premium seat.

**A count threshold instead of a minimum gap.** Reads as the obvious way to stop noise and silences
the wrong feeds: a weekly blog never reaches five in one check and a firehose reaches it every time,
so the threshold is loudest exactly where the reader least wanted it.

**Per-device opt-in, as a join of devices and feeds.** More expressive — this feed on my phone but
not my desktop — at the cost of setup proportional to hardware, two lists that drift, and an answer
to a question almost nobody asks.

**Post titles in the push payload.** A better preview, at the cost of putting reading history on a
lock screen and through a third party, to save one tap. The digest is where a list of titles
belongs, because an inbox is the reader's and a push service is not.

## Tests

Twenty-one behaviours, in the layout the app already uses: the pure rules in plain Vitest against a
SQLite `Database`, the object and delivery paths in `*.workers.test.ts` with
`@sdxc/cloudflare-mocks`, and every push service response through MSW.

| #   | Behaviour                                                                                          |
| --- | -------------------------------------------------------------------------------------------------- |
| 1   | A scheduled check that materializes posts from an opted-in feed sends one notification             |
| 2   | Forty posts across nine feeds send one notification, naming a count and at most three feeds        |
| 3   | A check finding posts only in feeds with `notify = 0` sends nothing and writes no timestamp        |
| 4   | Following a feed, importing OPML and re-following all leave `notify` off                           |
| 5   | A plan change switches nothing on                                                                  |
| 6   | The summary counts rows this object wrote, not what the KV heads implied                           |
| 7   | Posts dropped by velocity, and a paused feed's posts, are not counted                              |
| 8   | A single post from an opted-in feed notifies; no count threshold suppresses it                     |
| 9   | A second check inside the minimum gap sends nothing and advances no timestamp                      |
| 10  | The check after the gap notifies with everything since the last notification, not since that check |
| 11  | A notification inside quiet hours is suppressed, and the next check outside them carries it        |
| 12  | Quiet hours are computed in the stored zone and stay correct across a daylight-saving change       |
| 13  | An absent time zone falls back to UTC rather than disabling quiet hours                            |
| 14  | Synchronization triggered by a reader's own request notifies nothing                               |
| 15  | Notification runs after cursors advance, and a delivery that throws leaves every cursor written    |
| 16  | The alarm resolves and re-arms when every delivery fails                                           |
| 17  | A `410` deletes the row, a `429` increments its count, and a `403` keeps it and records            |
| 18  | Ten consecutive transient failures delete the row; one acceptance resets the count                 |
| 19  | Two devices, one accepting and one failing, advance `last_notified_at` once                        |
| 20  | Re-registering the same endpoint updates one row rather than creating a second                     |
| 21  | The payload carries a count and feed titles, and no post title, URL or author                      |

## Implementation

- [x] `push_subscriptions`, its `UNIQUE (endpoint)`, and the `UserDO` migration
- [x] `notify` on `feeds`; `notify_push`, `notify_email`, `time_zone`, `quiet_from`, `quiet_to`,
      `last_notified_at` and `email` on `settings`
- [x] `ensureUser(subject, email)`, writing the address on every completed sign-in
- [x] `app/push/web-push.ts`: VAPID `ES256` through `@sdxc/jwt`, RFC 8291 encryption, and the
      `Request` builder, tested against the published vectors
- [x] `database/notify.ts`: the derived summary, the gap, quiet hours, delivery, and the response
      table's row bookkeeping, reached only by the alarm's reason
- [x] A service worker and manifest, registered from the app layout, handling `push` and
      `notificationclick`
- [x] Device registration and revocation in `routes/web.ts`, and the device list on `/settings`
- [x] The per-feed toggle on `/reading/:feed`, and the zone posted when it differs from what is stored
- [x] `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in `.env.example`, the private one
      through `wrangler secret put`, and `app/push/vapid` added to the `AGENTS.md` environment list
- [x] Copy for every notification surface in `app/locales/en.ts` and `app/locales/es.ts`
- [x] The tests above, and the structured events
- [x] **Second:** the `EMAIL` binding in `wrangler.jsonc`, `bun run cf:typegen`, the `@sdxc/mail`
      body, and the alarm-constructed `Mailer`
- [x] **Second:** the email channel's four-hour gap, and the `Result` branch on a failed send

## References

- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — the pull design whose
  missing subscriber walk this shows is only a publish-time problem
- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the per-reader object, its single
  alarm, and the rule that an alarm never rejects
- [ADR-004](./ADR-004-background-freshness-checks.md) — the scheduled check this notifies from
- [ADR-018](../ADR-018-mail-package-with-pluggable-transports.md) — the mailer and the Cloudflare
  transport the email channel sends through
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the events
  follow
