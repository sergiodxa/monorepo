# ADR-009: Filter Rules Applied at Synchronization

## Status

**Accepted** - 2026-09-16

## Background

A reader follows feeds, not posts. Every feed anybody follows for one reason also carries
things they did not ask for: the sponsored slot, the weekly link roundup, the syndicated wire
copy a newspaper runs beside its own reporting, the release-notes bot on a project blog. None
of that is a reason to unfollow the feed, and all of it is a reason to stop opening it.

[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) gave the reader one
instrument for this, and it is blunt on purpose: velocity, which asks how long a post from a
feed stays worth looking at and answers in hours. It can say "headlines are stale by evening";
it cannot say "the sponsored ones were never worth reading". Age is the only property it knows
about a post, and age is not what is wrong with the sponsored ones.

This adds the other instrument: a **rule** a reader writes, which acts on a post because of
what it says rather than because of when it was published.

## Context

### Rules belong where velocity already is

ADR-002's synchronization loop already makes exactly this kind of decision:

> Drop anything already past this subscription's velocity, which is a decision about the
> item rather than a failure to handle it.

The item is in memory at that point, it has not been written, and the decision to refuse it is
one the reader made in advance. A rule is the same shape of decision at the same moment, and
taking it there rather than after the write is what makes the whole feature almost free: a
post the reader has ruled out never becomes a row, so it costs no storage, no index entry, no
sweep later, and no share of the budget it would otherwise sit inside.

### The cursor invariant, which this must not break

ADR-002 is explicit about what the synchronization cursor is allowed to pass, and the
sentence is load-bearing:

> "Accounted for" is doing exact work in step 5. An item stored and an item dropped by
> velocity are both decided, so the cursor may pass either; an item whose write failed, or
> that the run never reached, is neither, and the cursor must stop below it. The rule is not
> "everything written" — it is "nothing the reader has not ruled on".

**A rule-dropped item is decided, so the cursor may pass it.** That is not a concession; it is
the definition of the word the invariant is written in. The reader ruled on the item by
writing the rule, the run reached an answer, and there is no later work to come back for.
Holding the cursor below it would leave the subscription permanently stale against a head it
can never reach, reporting work every subsequent run would decline to do.

Getting it wrong the other way is the dangerous one, and it is why this quotes the invariant
rather than summarizing it. If an item whose write _failed_ were treated as ruled on — because
the same code path now has two reasons not to store something — the cursor would advance past
a post that was never stored, and no freshness check could notice, because the comparison that
would catch it is the one the cursor just satisfied. The reader loses the post silently and
forever. So the predicate stays one thing: an item is decided when the run reached a
conclusion about it, and a failed write is not a conclusion.

In the code this holds by construction and should stay that way. `#syncFeed` sets
`cursor = greatestRevision(answered.items)` over the whole page the feed answered with, after
the page's writes have resolved; rules change what `#materialize` keeps, and neither touches
the cursor.

### What a rule can see

A rule can match only what crosses the RPC boundary from the feed's object, which is
`FeedStore.Item`: `title`, `url`, `summary`, `author`, plus the identifiers and
`publishedAt`. Four of those are things a person would write a rule about.

The summary is the one with a surprise in it. It is capped at `MAX_SUMMARY_LENGTH`, which is
280 characters — ADR-002 brought it down to what the timeline actually renders — so a rule
matching on the summary matches the line under the title, not the article. A reader writing
"drop posts that mention the merger" catches the ones that mention it in the first sentence
and misses the ones that mention it in the sixth, with no way to tell them apart from the
timeline. The interface has to say so, because a filter that half works is worse than one
that visibly does not.

Categories and tags are the field readers ask for next and cannot have. Feeds carry them,
`FeedDO`'s `items` table does not store them, and adding a column there changes what every
feed stores for the subset of readers who write rules against it — the shared object paying
for a per-reader feature, which is what ADR-002's split exists to avoid.

### A reader's regex runs inside their own object

The obvious matching language is a regular expression, and it is the one this ADR refuses.

A `UserDO` is single-threaded. A reader's pattern would be evaluated inside it, once per
synchronized item, on the path that also serves that reader's timeline. A pattern with nested
quantification over a 280-character summary — `(a+)+$` and its many friendlier-looking
relatives — backtracks exponentially, and JavaScript's regex engine has no interruption point:
no timeout, no step budget, no signal, no way to abandon a match that has started. The isolate
runs until it finishes or the platform kills the object. One rule, and the reader's own reader
stops answering. Three mitigations exist — a ReDoS analyzer at save time, a killable second
isolate, a backtracking-free engine compiled to WebAssembly — and each costs more than the
feature is worth, as Alternatives Considered sets out.

The framing that the harm is self-inflicted does not survive contact with how filters actually
spread. Readers copy patterns from each other and from blog posts; "paste this to mute the
election" is a normal thing for one person to hand another, and the person pasting it cannot
read it. A language where a pasted string can wedge the pasting reader's account hands out a
footgun with a friendly label on it.

### A limit on rules is about the interface, not about bytes

Fifty rules is fifty rows of five short columns, which is smaller than a single stored post,
and evaluating all fifty against one item is fifty `String.prototype.includes` calls over at
most 280 characters — microseconds, against rules read once per synchronization run rather
than once per item. So nothing about storage or CPU argues for any particular number. What
argues for one is that a flat list a reader can read in a screenful and reason about is a few
dozen long; past that they need to search their own rules, group them, and work out which of
four similar ones is eating a post, which is a second product built on the first.

## Decision

A reader may write **rules**. A rule names one field, one piece of text to look for in it, and
one thing to do with a post that has it. Rules are evaluated inside the `UserDO` at
synchronization, on items as they arrive and before they are written.

### One term, one action, one sentence

A rule reads as a sentence: _when the `<field>` of a post contains `<value>`, `<action>` it_.

**Matching is a case-insensitive substring test, and nothing else.** No regex, no glob, no
anchors, no word boundaries, no alternation. The needle and the field are both normalized to
NFKC and case-folded once, then compared with `includes`. That is linear in the length of the
field, has no backtracking case at all, and needs no analysis, no sandbox and no engine.

Fields are `title`, `url`, `summary`, `author`, spelled as a named list with a `CHECK`
repeating it, the way `VELOCITIES` is. `url` is the useful one nobody asks for: it is how a
reader mutes a link-roundup feed's outbound domain. The needle is capped at 100 characters,
because a filter longer than that is a sentence and a sentence will not match anything.

**A rule carries exactly one term.** Conjunction — "title contains _Live_ and author is
_Sports desk_" — is the first thing this language cannot say, and it is left unsaid
deliberately: adding it means either a second table joined on the arrival path or a JSON
payload SQL cannot see into, and the rule stops being one sentence and starts being an
expression with precedence to explain. A reader who needs it writes the narrower of the two
terms and accepts that it catches more than they meant, which is a disappointment rather than
a data loss.

Negation is absent for a sharper reason. "Drop everything whose title does _not_ contain Rust"
is one keystroke away from muting every feed the reader follows, and it is the one rule shape
whose blast radius is the whole product. The reader who wants "only things about X" is asking
for a search feed, which is a different feature with a different storage story.

### Global and per-feed, in one nullable column

A rule's `feed_id` is nullable. Null means the rule applies to every feed the reader follows,
including ones they follow later; a value names one subscription and the rule applies there.

Both exist because they are genuinely different questions and neither expresses the other.
"I do not want to read about this anywhere" is a statement about the reader, and writing it
once per subscription means writing it again every time they follow something — a rule that
silently stops covering new feeds is a rule that fails exactly when the reader is not looking.
"Drop this newspaper's daily briefing" is a statement about one publication, and applied
globally it would eat a post from somewhere else that happens to share a word. The nullable
column is the entire implementation cost of supporting both, which is why there is no
argument for picking one.

### Three actions, and the one that is refused

| Action      | What it does                                                                  |
| ----------- | ----------------------------------------------------------------------------- |
| `drop`      | The item is not written. It never becomes a row in this reader's object.      |
| `mark_read` | The item is written with `read_at` set to its arrival, so it skips the queue. |
| `flag`      | The item is written with `flagged_at` set, so the timeline marks it.          |

`drop` and `mark_read` are the two halves of "I do not want this": one for noise not worth
storing, one for what the reader wants in the record but not in front of them. They are not
equivalent in cost — a `mark_read` post is a stored row, and a stored row is charged against
the budget.

`flag` is the positive half, spelled as a mark on the timeline rather than a separate list:
`flagged_at` on `feed_items`, nullable, exactly the shape `saved_at` already has, with the
partial index `(published_at, id) WHERE flagged_at IS NOT NULL` that every other filtered list
here already pages by. A flagged post ages out under its feed's velocity and is reclaimed by
the budget like anything else.

**No action may save a post.** A save is exempt from every retention rule in the design —
velocity, the read-age reclamation and the budget — and the save list is capped at a thousand,
where the thousand-and-first is _refused_ rather than evicting an older one. A rule that saves
would mint permanent, unreclaimable rows automatically and spend that budget on machine picks
until the reader's own next save is refused. The cap is a thousand because a thousand is what
a person can meaningfully choose to keep, and handing the choosing to a rule makes the number
meaningless and the refusal infuriating. Flagging is what a rule may do instead, and the
difference is exactly that a flag carries no exemption.

### Rules are a set, not a list

**Every matching rule applies, and `drop` dominates.** There is no ordering, no first-match,
no `position` column and no short-circuit. If one rule says flag and another says drop, the
post is dropped; if two say mark read, it is marked read once.

This is a smaller decision than an ordered list and a better one. Three actions, of which one
strictly dominates and the other two commute, cannot produce an interaction that an order
would resolve differently — so ordering would buy nothing and cost a reader who can change
what their rules do by dragging them, and a support question that starts by reconstructing
that order.

### Rules never touch a post the reader already holds

A rule runs on items this reader does not have. An item the feed re-offers because the
publisher edited it — ADR-002's second counter putting it back in front of every subscriber
exactly once — is applied as an ordinary edit, with `read_at`, `published_at` and `id` frozen
on conflict, and no rule evaluated. Both directions of the alternative are bad: a `drop` rule
allowed to reach a held row lets a publisher fixing a typo delete a post out of the reader's
timeline, without any reader action at all, and a `mark_read` rule allowed to re-apply would
re-mark a post the reader deliberately marked unread every time the publisher touched it.

Enforcing it costs one indexed lookup, and only on pages where it could matter: a page on
which no rule matched needs none, because nothing would be excluded. When a rule does match,
the run reads back the ids it is about to act on — chunked to the 100-parameter bind limit,
the shape the feed side's digest prefetch already has — and lets any id it already holds
through as a plain edit. **The one query rules add to the synchronization path is paid only
when a rule fires.**

### Velocity first, then rules

Both drop at arrival, and the order between them is settled: **velocity is applied first.**

The stored set is the same either way — both are pure predicates over an item in memory, and
neither has a side effect the other can observe — so this is a cost argument and an honesty
argument rather than a correctness one.

The cost half: velocity is one integer comparison against `publishedAt` and drops the bulk of
a catch-up run, so a reader returning after a month to a feed they follow for headlines has a
month of items refused for the price of a comparison each and the rules never see them.
Running the string work first would do it on items that were never going to be stored.

The honesty half is the counters. A rule evaluated after velocity under-counts its matches
against what it would catch first, and that is the number to show: a counter says what the
rule is doing to the reader's timeline, and an item velocity already refused was never in
that timeline to be done anything to.

### Storage

One table in the `UserDO`, migrated with the rest, and read whole.

**`rules`** — `id` (a `rule_…` `TypeID`), `feed_id` (nullable, this app's own subscription id
from `feeds.id`, never the catalog's), `field`, `value`, `action`, `matches`,
`last_matched_at`, `created_at`, `updated_at`.

`field` and `action` are enums with `CHECK` constraints repeating their named lists, so the
database refuses anything a form lets through. There is no index beyond the primary key: a
table capped at fifty rows is read whole on every run that needs it, and a planner handed an
index over fifty rows would decline it. A rule naming a feed goes when that subscription's row
goes, on the existing unfollow path, because a rule scoped to a feed the reader no longer
follows is one they cannot see, cannot reason about, and would be astonished to find working
again if they re-followed.

### Fifty rules, on the paid tier

Free readers get none. Paid readers get **fifty**.

Fifty is chosen against the interface argument above and against what the market has taught
readers to expect: Inoreader's Pro tier includes thirty rules and fifty filters, and its rules
carry several conditions each. A rule here carries one term, so fifty of these buy less than
fifty of those, and being generous on the count is how a deliberately weaker language stays a
credible feature rather than a token one. It is paid because it is configured once and
benefits the reader daily, which is what a subscription is for, and because the free tier's
honest pitch is the whole reading experience with the instruments that shape it — velocity,
saved posts, and this — behind the same line.

**The tier has nowhere to be read from today.** `apps/reader` has no plan column, no billing
binding and no entitlement check anywhere in it; the object's `settings` table holds a subject,
a refresh stamp and nothing else. The limits are spelled as `FREE_RULE_LIMIT = 0` and
`RULE_LIMIT = 50` beside `SAVED_LIMIT` and `READER_BUDGET`, read through one entitlement
function, and that function is the seam
[ADR-012](./ADR-012-tiers-entitlements-and-billing.md) fills. Until it is filled, shipping
this ships it to everybody, so the rule surface sits behind a flag from the app's own catalog
in the meantime.

### Rules are not retroactive, and a new rule sweeps nothing

A rule written today acts on tomorrow's arrivals. It does not reach back into rows already
stored.

That is deliberate, and both halves of the alternative are bad. A sweep on save is a scan of
up to a million rows against the new rule's term, inside the single-threaded object, on the
request that saved the rule — so the reader's reader stops answering while it runs, which is
the denial of service the regex decision was avoiding arriving through a different door. And
it deletes posts on the strength of a rule the reader has just typed and never seen work,
including ones they have already read.

**The preview is the retroactivity, and it is read-only.** Before saving, a candidate rule is
evaluated against the reader's newest two hundred posts — one indexed page over
`(published_at, id)`, the same seek the timeline is — and shown as the list it would have
caught. The reader who wants those gone acts on the previewed page itself, a bounded one-off
over at most those two hundred rows, which is an act taken on specific posts they looked at
rather than a rule granted the power to reach backwards.

### What a reader can see

A rule that silently eats posts is frightening, and the fear is proportionate: the reader
cannot tell a working rule from a broken one, or a quiet feed from a feed being eaten, by
looking at their timeline. Three things answer it, and one deliberately does not exist.

- **`matches` and `last_matched_at` on the rule.** How many items this rule has decided, and
  when it last did. A rule that has never matched is the most common real failure — a typo, the
  wrong field, a word in the body and not in the 280-character summary — and it is visible at a
  glance. The counters are written once per synchronization run with that run's total, not once
  per item, so fifty rules cost at most fifty small updates per run.
- **The preview above**, which is also the "why is this rule not working" tool, because it
  shows matches against posts the reader can still see.
- **`user.sync` gains a `ruled` field** beside its existing `skipped`, so a run says how many
  items rules decided, and `user.rule.preview` records `field`, `action`, `scanned` and
  `matched`. No rule values are logged: a reader's filter terms are their own words about their
  own interests, and the logging contract already keeps contents out of events.

**There is no log of what was dropped.** Storing the rows a rule exists in order not to store
would undo the argument for evaluating at arrival, and would grow with exactly the noise the
reader was ridding themselves of. The reader who wants to see what a rule is eating changes
its action to `mark_read` for a day: the same posts, stored, out of the queue, reclaimable
afterwards. That costs nothing to build and answers the question better than a log would.

### The budget, and the way out of back-pressure

Rules are one of the ways a reader stays under ADR-002's million-post budget, and the cheapest
one, because a dropped post was never counted.

The interaction worth naming is with back-pressure. That budget reclaims only _read_ posts, so
a reader who follows busy feeds and reads none of them eventually meets a feed that stops
materializing — correct, unpleasant, and every way out is work they have to do. A `mark_read`
rule is a fourth way out and the only passive one: the noise arrives already read, so it is
reclaimable the moment the object comes under pressure, and the budget has something to take
that the reader agreed in advance to lose. A `drop` rule is better still, since it never
arrives.

### Cost

Rules save money, and the amount is small. Being clear about which of those is the point
matters more than the arithmetic.

Durable Object SQLite storage is $0.20 per GB-month. At ADR-002's pessimistic two kilobytes a
row, a reader sitting at the million-post budget holds about two gigabytes and costs forty
cents a month; rules dropping 30% of arrivals take that to 1.4 GB and 28 cents. A typical
reader holding fifty thousand posts is a hundred megabytes and two cents a month, and 30% of
that is two-thirds of a cent. The saving is real, scales linearly with what the rules refuse,
and will never appear on an invoice anybody looks at. What it buys is headroom: reaching the
budget costs not a bill but a feed that stops taking posts and a reader who has to act, and
thirty per cent fewer arrivals is thirty per cent longer before that happens, or never.

The one cost rules add is CPU inside the `UserDO`, per synchronized item, and it is
immaterial. Fifty substring comparisons over at most 280 characters is tens of microseconds; a
reader synchronizing a thousand items a day spends around fifty milliseconds a day on it,
priced by `doDurationMs` at $0.0000000015625 per millisecond, which is three millionths of a
dollar a month. It earns the sentence only because the number would be entirely different with
a regex, where the worst case is not a number at all.

Two gaps in the rate card are worth recording. It carries no Durable Object storage rate —
`doRequest` and `doDurationMs` are its only DO entries — so the $0.20/GB-month above is
Cloudflare's published price rather than a figure from `apps/uptime/app/lib/cost-rates.ts`;
and it carries no DO row-read or row-written rate, so the counter updates are priced here by
the duration they add rather than by the rows they write.

## Consequences

### Positive

- A post the reader has ruled out never becomes a row: no storage, no index entry, no sweep,
  no share of the budget and no second look, because the decision is taken while the item is
  already in memory for another reason.
- The matching language has no worst case. A reader cannot write, be handed, or paste a rule
  that wedges their own object, because no input to `includes` takes more than linear time.
- The feature has one failure mode the reader can understand — "it did not match" — and one
  number that tells them so, on the rule itself.
- `mark_read` rules give the budget something to reclaim, which is the one way out of ADR-002's
  back-pressure state that does not require the reader to read, retune or unfollow anything.
- Rules and velocity are the same kind of thing evaluated at the same moment, so a reader's
  arrival-time decisions live in one place under one invariant, and ordering does not exist,
  so there is no interaction between two rules to explain, reproduce or support.

### Negative

- The language cannot express conjunction, negation, anchoring or word boundaries. "Drop posts
  whose title starts with `Re:`" is not sayable; the reader writes `Re:` and catches it in the
  middle of other titles too. Readers will ask for every one of these, and the answer to each
  is that this language was chosen for what it cannot do.
- Matching the summary matches 280 characters. A reader will write a rule about a topic, watch
  it catch some posts and miss others, and have no way from the timeline to see why.
- Rules are not retroactive, so a reader who writes one after a bad week still has the bad week
  in their timeline, and clearing it is an action over a previewed page rather than a
  consequence of the rule.
- There is no record of what was dropped. A reader who suspects a rule ate something specific
  can only re-run the preview, or switch the rule to `mark_read` and wait for the next arrival.
- A drop rule can silently eat a feed. A term that appears in every post of a publication — a
  section name, a byline, a template phrase — leaves the subscription synchronizing, its cursor
  advancing and its timeline empty, and the freshness check will never call it stale, because
  it is not. The counter makes this visible, and the reader has to go and look at it.
- A match is counted against every rule that matched it, so two overlapping rules each count
  the same post. The counters answer "is this rule doing anything" and do not sum to the number
  of posts affected.
- Rules add one indexed read-back to the synchronization path on pages where a rule fires, and
  turn `#materialize` from a filter into a classifier with a written path per outcome.
- `flagged_at` is a fourth nullable state column on `feed_items` and a fifth partial index.
- A paid feature is specified against a tier the app cannot currently read.

### Neutral

- Nothing in the feed's shared object changes. Rules are entirely a property of one reader's
  projection, which is where a per-reader preference belongs and why velocity lives there too.
- The rules table is small enough that its size never enters a decision: reading it whole,
  re-reading it per run, or copying it into a preview are all free.

## Alternatives Considered

**Regular expressions, guarded.** The language readers expect and every competitor offers,
with one of three guards. A ReDoS analyzer at save time is an arms race whose false negatives
are exactly the patterns that matter, and which teaches the reader nothing until their object
is wedged. A killable second isolate puts a subrequest, and a service to receive it, on the
synchronization path to make a string comparison safe. RE2 compiled to WebAssembly genuinely
works — linear time, familiar syntax — and costs a WASM module instantiated in every `UserDO`
isolate that synchronizes anything, which is all of them, for a minority of readers, with the
instantiation landing on the request this app most wants to keep to one indexed seek. Worth
revisiting the day the language's lack of expressiveness is the top complaint, and not before.

**Globs.** `Sponsored*` looks like a compromise and is not one: a glob with multiple wildcards
backtracks in a naive implementation, so it needs the same care as a regex with a fraction of
the power, and the careful implementations are regex engines wearing a smaller syntax.

**Filtering at render time instead of at arrival.** Rules become retroactive for free, a rule
can be turned off and its posts come back, and nothing is ever lost. It also stores every post
the reader is filtering out, forever, charges them to the budget, and puts a per-reader
predicate into the timeline query whose keyset cursor ADR-001 and ADR-002 both went to some
trouble to keep simple.

**A sweep when a rule is saved.** Makes a new rule clean up the mess that prompted it, which is
what the reader wants in the moment. It scans up to a million rows inside a single-threaded
object on the request that saved the rule, and deletes read history on the strength of a rule
nobody has watched work.

**Ordered rules with first-match-wins.** The familiar mail-filter model, costing a `position`
column, a reordering interface and a permanent class of support question about which rule won,
in exchange for resolving interactions three commuting-or-dominating actions cannot produce.

**One scope rather than both.** Per-feed only drops the nullable column and puts every rule on
the page of the feed it affects, at the price of making a reader rewrite a subject they never
want to read once per subscription, forever, silently. Global only gives one list to look at
and cannot say anything about one publication — the roundup, the briefing, the sponsored slot —
which is most of what readers actually want filtered.

**A `save` action.** The most requested action in every reader that has rules. It automates the
one thing exempt from every retention rule, against a cap of a thousand that refuses rather
than evicts, so a rule that saves eventually stops the reader saving. Flag exists so the
wanting half of this feature has somewhere to go that carries no exemption.

**An allow-list rule — keep only what matches.** Turns a feed into a search over itself, which
is a genuinely useful product. It is also a negation, so a term that matches nothing mutes the
feed with no signal, and it wants its own storage story: the posts a reader would widen the
rule to recover were never stored.

## Tests

Twenty behaviours, in the layout the app already uses: the arrival-time paths in plain Vitest
against a SQLite `Database`, the object paths in `*.workers.test.ts` with
`@sdxc/cloudflare-mocks`.

| #   | Behaviour                                                                                         |
| --- | ------------------------------------------------------------------------------------------------- |
| 1   | An item matching a `drop` rule is never written, and no row for it exists afterwards              |
| 2   | The cursor advances past a rule-dropped item, exactly as it does past a velocity-dropped one      |
| 3   | A run whose write fails leaves the cursor below the failed item, whether or not a rule matched it |
| 4   | An item matching a `mark_read` rule is stored with `read_at` set to its arrival                   |
| 5   | An item matching a `flag` rule is stored with `flagged_at` set and remains subject to velocity    |
| 6   | No action sets `saved_at`, and the save count is unchanged by any synchronization                 |
| 7   | Matching is case-insensitive and Unicode-normalized on both the needle and the field              |
| 8   | A rule matching `summary` sees only the stored 280 characters                                     |
| 9   | A global rule applies to a feed followed after the rule was written                               |
| 10  | A per-feed rule applies to its own feed and to no other                                           |
| 11  | When `drop` and `flag` both match, the item is dropped                                            |
| 12  | Two `mark_read` rules matching one item produce one row, marked read once                         |
| 13  | Reordering rules changes nothing, because there is no order to change                             |
| 14  | An edit to an item the reader already holds is applied, and no rule runs on it                    |
| 15  | A page on which no rule matched issues no held-id read-back                                       |
| 16  | Velocity refuses an item before any rule sees it, and no rule counter moves for it                |
| 17  | Each matching rule's `matches` is incremented once per run, not once per item                     |
| 18  | The preview matches against stored posts, writes nothing, and creates no rule                     |
| 19  | Saving a rule deletes no existing post                                                            |
| 20  | The fifty-first rule is refused, and a free reader's first rule is refused                        |

## Implementation

- [x] `rules` table, its migration, and the `FIELDS` / `ACTIONS` named lists with their `CHECK`s
- [x] `flagged_at` on `feed_items`, its partial index, and the timeline's mark
- [x] `RULE_LIMIT`, `FREE_RULE_LIMIT`, and the one entitlement function they are read through,
      with the rule surface behind a flag from the app's own catalog until the tier exists
- [x] Rule evaluation in `#materialize`, after velocity, classifying rather than filtering
- [x] The held-id read-back, chunked to the bind limit, taken only when a rule fires
- [x] Per-run counter updates for `matches` and `last_matched_at`
- [x] `createRule` / `updateRule` / `deleteRule` / `listRules` / `previewRule` on the RPC surface,
      each answering a discriminated union rather than throwing
- [x] `/rules` and its form, with the preview against the newest two hundred posts
- [x] The bounded one-off action over a previewed page
- [x] `ruled` on `user.sync`, and the `user.rule.preview` event, carrying no rule values
- [x] Copy for every string in `app/locales/en.ts` and `app/locales/es.ts`, including the
      280-character caveat on summary matching and the warning on a rule matching everything
- [x] The tests above

## References

- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — the arrival-time decision rules join, the cursor invariant they honour, and the budget they relieve
- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the per-reader object rules are evaluated inside, and the frozen columns an edit may not move
- [ADR-012](./ADR-012-tiers-entitlements-and-billing.md) — the entitlement seam the rule limit is read through
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the counters and events follow
- [ADR-029](../ADR-029-pagination-package.md) — the keyset the preview pages the newest posts with
