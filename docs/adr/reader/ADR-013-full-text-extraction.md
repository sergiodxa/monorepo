# ADR-013: Full-Text Extraction, Fetched on Open and Never Stored

## Status

**Proposed** - 2026-09-16

## Background

Most feeds ship a headline and a sentence. The publisher's reason is usually a good one — a
full-text feed is a feed somebody else can republish — but the effect on the person reading
is that half their timeline is a list of links and the app they chose is a launcher for a
browser tab. It is the most common complaint made about every feed reader ever written, and
the one thing this app cannot currently answer:
[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) stores a title, a
280-character summary, an author and a link, and the body was dropped from the schema by
`0002-drop-item-content` before the app had a single reader.

The page the link points at is public and the reader is one click from it. Fetching it on
their behalf and rendering it where they already are is a small feature with a large effect on
whether the product is worth opening — and the feature most likely to wreck the storage design
if it is built the obvious way, which is what most of this document is about.

## Context

### ADR-002's retention model rests on a row that cannot hold an article

`MAX_SUMMARY_LENGTH` is 280 characters, and it is not a display preference. ADR-002
re-derived its retention numbers against a row costing "something like 700 bytes of field,
call it a kilobyte and a half once SQLite's own overhead and three indexes are counted", and
set both the feed-side million items and the reader-side million-post budget against that
figure — two gigabytes, a fifth of a Durable Object's ten, left with room to be wrong by
five times. Capping the summary is what made a row's cost predictable enough for that
arithmetic to be worth writing down.

An extracted article is not that kind of value. A long post is 50 KB of sanitized markup
before anything else; charge it the same pessimism ADR-002 charges a row and call it 100 KB
stored.

| Row holds                | Cost    | Posts in the 2 GB budget | For a reader of 200 daily feeds |
| ------------------------ | ------- | ------------------------ | ------------------------------- |
| Metadata, as ADR-002 has | ~2 KB   | 1,000,000                | Fourteen years                  |
| Metadata and an article  | ~100 KB | 20,000                   | One hundred days                |

Two orders of magnitude, and it does not stop there: the million posts ADR-002 promised,
with bodies, need a hundred gigabytes in an object that has ten. The budget is not reduced
so much as made unreachable, so every mechanism resting on it — the share per feed, the
reclamation of read posts, the back-pressure that refuses rather than deletes — would run
permanently at its limit against text nobody asked for.

The constraint is therefore settled before the design starts. **An extraction is never
written into a `UserDO`, and `feed_items` gains no column.**

### Speculative extraction breaks the invariant ADR-002 exists to establish

The tempting place for this is the poll, where a `FeedDO` is already fetching, already
parsing, and has the document in hand. It is also the most expensive thing this design could
do. ADR-002's invariant is that external traffic scales with unique feeds rather than with
subscriptions — one poll a day per feed, whoever follows it. Extracting at poll time makes
traffic scale with _items_: a feed publishing five posts a day goes from one request a day to
six, and five of those six hit article pages an order of magnitude heavier than a feed
document. Across ten thousand indexed feeds that is fifty thousand extra requests a day sent
to publishers.

Nearly all of it is waste, because a timeline is not a reading list. A reader following fifty
feeds that publish five posts a day each has 250 posts land daily and opens twenty. Eight
extractions in ten would never be looked at, each carrying the most CPU-expensive operation
in the app, and the bill would arrive for readers who did not open the app at all — the
property ADR-002 was pleased to have bought, that "a reader who does not open the reader
generates no work at all". Priced in [Cost](#cost) it is roughly eighteen times the on-demand
figure.

Extraction therefore runs when a reader opens a post, on that post, and nothing else: no
prefetch of the next item, no warming a timeline's first page, nothing triggered by
synchronization.

### The cache is shared because articles are, and readers are not

Nothing about an extracted article is per-reader. Two people who open the same link want the
same bytes, so the cache is keyed by the article's URL, holds nothing about who asked, and
the second reader to open a circulating link pays a read rather than a fetch, a parse and a
write. It is the shape of the feed head in KV: a shared derived value anybody may consult,
holding no per-reader state, because per-reader state in a shared store is the fan-out
ADR-002 removed coming back through a different door.

### Fetching an arbitrary page is untrusted network input, twice over

A feed's `url` field is written by whoever wrote the feed. ADR-002 already treats a feed URL
that way and lists the bounds it required of `@sdxc/feed`: HTTP(S) only, a redirect limit, a
response size cap read off a stream rather than through `response.text()`, and a per-fetch
timeout. Every one of those reasons applies here and applies harder, because an article page
is bigger than a feed document, is no format anybody validates, and is reached from a link
the app did not choose.

The second half is what happens afterward. A publisher's markup has never been rendered in
this app's origin — `summaryOf` parses `contentHtml` and takes `.text` — and the point of
this feature is to render somebody else's HTML on a page holding the reader's session cookie.
That is the textbook stored cross-site-scripting shape.

### The app already parses HTML, and this is not the same operation

`@sdxc/html` reads the page as served and answers questions about it: the title, a meta tag,
an element by role and accessible name, the visible text. `refresh.ts` leans on the last of
those already, so the parser this feature needs is in the app and exercised against real
markup.

Readability is not one of those questions. Deciding which subtree of a page is the article is
a scoring heuristic over candidate containers, carrying accumulated judgement about bylines,
comment threads, share rails and related-post blocks, and its output is a new document rather
than an answer read off the old one. [ADR-055](../ADR-055-html-package.md) drew `@sdxc/html`'s
line at "every answer it gives comes from the markup the server sent", and a scorer sits
outside it — on a different clock, too, since the parsing algorithm and AccName are
specifications and boilerplate heuristics are a running argument with the web.

## Decision

Extraction runs on demand when a reader opens a post, in the Worker, through a new
`@sdxc/readability` package, with the result held in a shared, URL-keyed, expiring cache and
written into no Durable Object ever.

### When it runs, and what the reader sees while it does

`GET /reading/:feedId/:itemId` renders the post from the `UserDO` row first — title, author,
date, the stored summary, and the link — and that markup is complete before any external
request is made. The extracted body is folded in underneath it.

The cache lookup happens inline, because a hit is one KV read and waiting on it beats
rendering a page that immediately replaces itself. A miss hands the reader the metadata page
with the article frame pending, resolved through the `lazy-frame` component the timeline
already pages with. One extraction per open, one at a time per reader.

### Where an extraction lives

`@sdxc/cache`'s `WorkerKVCache` ([ADR-053](../ADR-053-cache-package-with-adapters.md)) over
the `KV` namespace the app already binds, under a prefix of its own beside sessions, the OIDC
discovery cache and the feed heads. ADR-002 describes that namespace as derived state a cold
isolate can rebuild, and an extraction is the purest example in the app: every byte is
reconstructible by fetching the page again.

```text
article:<sha-256 of the canonical article URL>
```

A digest rather than the URL, for the reason ADR-002 built its head key from a feed id: a KV
key stops at 512 bytes and a URL does not. It carries no reader identifier by construction
rather than by convention, which is what lets one extraction serve everyone.

`cache.fetch(key, extract, { ttl })` is the whole call. One method does the lookup, runs the
extraction on a miss, writes the result, and — by ADR-053's rule that everything a store does
wrong is absorbed where a value can be computed instead — still answers with the article when
KV is unreachable. A reader gets their page when the cache is down; they pay a fetch for it.

**TTL: seven days**, because a link circulates for about a week, which is the window in which
sharing an extraction is worth anything. It is short enough that this stays a cache rather
than a copy — the distinction the position in [Legal and etiquette](#legal-and-etiquette)
rests on — and it bounds storage to a week of a reader's opens rather than to their history.
**Size cap: 512 KB of sanitized HTML**, which is a cost decision and not a store limit, since
KV values run to 25 MB: an extraction past half a megabyte is one the extractor got wrong.

Not R2, which is where this would go if bodies were megabytes or had to be durable. They are
neither: KV holds values of this size natively, is already bound, and — the deciding property
— expires entries itself, where R2 needs a lifecycle rule and a second binding to do the one
thing this design depends on.

### An extraction never becomes durable, including for a saved post

The case for the exception is real and worth stating at its strongest. A reader who saves a
post has said more explicitly than anywhere else in the app that they want to keep it, and
ADR-002 made saving the one promise retention cannot override — "a headline from a Breaking
feed, saved, is still there next year". What actually disappears is not the row, it is the
site. A save that survives everything except the publisher going out of business fails in
exactly the case a reader was saving against.

The storage arithmetic does not settle it either, which has to be said rather than glossed.
Saves are capped at a thousand per reader, which ADR-002 prices at two megabytes against a
two gigabyte budget. At 100 KB a body that thousand is **100 MB** — one per cent of the
object, five per cent of the budget. Affordable. The general case is what the arithmetic
rules out; the saved case it does not.

It is refused anyway, on three grounds that are not about bytes.

It changes what the product is. A transient cache of a page a reader asked to read is a
reading convenience; a permanent copy of a publisher's article held indefinitely in a store
this app controls is an archive, with a different legal posture and a different promise.
ADR-002 said as much — "actual archiving is a different feature with a different storage
story, and this is not a down payment on it" — and neither is this.

It makes a save able to fail. Saving is one click that must always work, and tying it to a
successful extraction gives the one operation with no acceptable failure mode the failure mode
of the least reliable operation in the design.

And it can only be decided once. A body column reinstates exactly what
`0002-drop-item-content` removed, with the content-hash consequence that migration documented,
and taking it out later is a migration across every reader's object.

So **ADR-002's Saved posts section stands exactly as written**. A saved post keeps its title,
its excerpt, its author and its link; "forever" means the metadata and the link; when the site
goes, the link goes. The save control says so, rather than letting a reader discover it in two
years. What they gain is that re-opening a saved article inside the cache window is free and
outside it is a fresh attempt at the live page, which is what a browser bookmark does.

### The extraction itself

**`@sdxc/readability`**, new, per the convention in
[ADR-001](../ADR-001-new-package-extraction.md) that a general capability becomes its own
package rather than hiding in its first consumer. It fetches a URL or takes markup in hand,
parses with `@sdxc/html`'s parser, scores candidate containers, drops navigation, comment
threads, share rails and related-post blocks, and answers with the article's markup, title,
byline and canonical URL — or a failure naming why there is none. Sanitization runs inside
`extract`, so no consumer can forget it.

Sharing the parser matters more than it looks: a second HTML parser in the repo is a second
set of answers about `<p>one<p>two`, and ADR-055's argument is that tree construction is the
format. `@sdxc/html` therefore exposes its parsed document at a subpath —
`@sdxc/html/document`, over the existing `lib/parse-document.ts` and `lib/dom.ts` — so a
second package walks a tree the first one built. The query surface is untouched.

**`HTML.sanitize(source, policy)` stays in `@sdxc/html`**, because sanitizing is a transform
over markup a server sent, needs the same tree and the same conforming parser, and moves on
the same clock they do — where the scorer moves on the clock of whatever publishers are doing
to their templates this year. That also leaves it reachable by anything else rendering
third-party markup, without a dependency on a boilerplate heuristic.

### What survives sanitization

An allow-list, never a deny-list, because a deny-list is wrong by default about the element
invented next year.

**Elements kept**: `p`, `h1`–`h6`, `ul`, `ol`, `li`, `dl`, `dt`, `dd`, `blockquote`, `pre`,
`code`, `em`, `strong`, `b`, `i`, `sup`, `sub`, `del`, `ins`, `abbr`, `a`, `img`, `figure`,
`figcaption`, `time`, `hr`, `br`, `table`, `thead`, `tbody`, `tr`, `th`, `td`. **Removed with
their subtrees**: `script`, `style`, `noscript`, `template`, `iframe`, `object`, `embed`,
`form`, `input`, `button`, `select`, `textarea`, `link`, `meta`, `base`, `svg`, `math`.
**Attributes kept**: `href` on `a`; `src`, `alt`, `width`, `height` on `img`; `colspan` and
`rowspan` on cells; `datetime` on `time`; `lang` and `dir` anywhere. Everything else goes,
which removes every `on*` handler without enumerating them, along with `style`, `class` and
`id`. **URLs** may be `http:` or `https:`, plus `mailto:` on `href`; `javascript:`, `data:`,
`blob:` and `vbscript:` are refused, and an attribute left without an acceptable value is
dropped rather than emptied. Relative URLs resolve against the article's final URL — the one
the redirect chain ended at — so a relative `src` cannot resolve against the reader's origin.

**Remote content is the part sanitization alone does not fix.** An `<img src>` pointing at the
publisher makes the reader's browser announce to that publisher that this reader opened this
article, with their address and user agent. That is a tracking pixel whether or not it was
meant as one, and a reader reading in place did so partly to avoid being seen.

Images are kept, because stripping them takes the diagrams and the comics out of half the web,
and three rules bound what keeping them costs: `referrerpolicy="no-referrer"`, so the publisher
is not told which page the reader came from; `loading="lazy"`, so an image below the fold is
not requested by a reader who stops short of it; and an `<img>` declaring a `width` or `height`
of 1 is dropped, because a one-pixel image is never content. What none of that solves is that
the publisher still sees an address when an image loads. A first-party image proxy is the fix
and is deliberately not built here: it puts every image byte through the Worker, which is the
one change that would make this feature expensive.

**A Content-Security-Policy on the reading page** is the second line behind the sanitizer:
`default-src 'none'`, `img-src https:`, `style-src 'self'`, and no `script-src` for the frame
at all. A sanitizer bug on a page holding a session cookie is a stored XSS against every reader
who opens that article, and depth is what keeps a bug in one allow-list from being that.

### Fetching safely

`@sdxc/readability` applies the same four bounds ADR-002 required of `@sdxc/feed`, in the same
shape — the manual redirect walk of `packages/feed/src/lib/limits.ts` is the model, since
following a chain yourself is what gives it a length it can exceed.

- **HTTP(S) only**, checked before the request, and with it a refusal of any host that is a
  literal IP address, `localhost` or a `.local` name: a Worker at the edge is inside nobody's
  private network, but the class of request is worth removing rather than reasoning about.
- **Five redirects**, with `redirect: "manual"` — the feed path's limit and its argument.
- **2 MB**, read off the stream and abandoned mid-body, lower than `@sdxc/feed`'s ten because
  an article page is one document rather than a few hundred entries.
- **Eight seconds**, shorter than the feed path's ten because a reader is waiting on this one.

The request carries no cookies, no credentials and nothing identifying the reader. It sends a
`User-Agent` naming this app with a URL explaining what it is doing, because a publisher who
wants to refuse should be able to tell who is asking.

### When it fails

Sites block, paywall, and build their bodies with script. None of these is an error condition;
each is an outcome the reader is shown.

| Outcome                                                      | What the reader gets                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Refused: `401`, `403`, `429`, or a bot wall                  | "This site does not allow reading here", the excerpt, and the link |
| Timed out, over the size cap, or past the redirect limit     | "This page took too long to read", the excerpt, and the link       |
| Nothing extractable: a shell page, or a body built by script | "There is nothing to read here", the excerpt, and the link         |
| Extracted text no longer than the stored summary             | Treated as nothing extractable                                     |
| Extracted                                                    | The article, the publisher's name, and the link                    |

The fourth row is how a paywall is handled, and the reason nothing tries to detect one. A
teaser is a `200` carrying a paragraph, indistinguishable from a short post by anything but
judgement. The rule is comparative instead: an extraction no longer than the 280 characters
already stored has bought the reader nothing, so they keep what they had. One predicate, and
it catches teasers, consent interstitials and error pages together.

**A failure never touches the link, because it never touches anything.** Extraction writes into
no `UserDO`, so there is no state a failure can leave behind, and the post's own markup — title,
author, date, excerpt, link — is rendered before the fetch starts. The route answers `200` in
every row of that table; a frame saying the site refused is a rendered state, not an HTTP error.
The failure itself is cached for **one hour**, under the same key and distinguishable from a
success, so a blocked article does not hit the origin on every re-open and a site that was down
is retried within the hour rather than in a week: long enough to stop a retry loop, short enough
that a transient failure is not remembered as a permanent one.

### Legal and etiquette

The position is that extraction fetches a page the reader could open themselves, on their
explicit action, with no credential and no attempt at one, and renders that page's own content
with the publisher's name and a link to the original in front of it. Across all readers it
sends a publisher strictly less traffic than those readers clicking through would, because the
cache makes a circulating link one fetch instead of thousands. One part of that is weaker and
is taken deliberately: the second reader is served bytes this app fetched on the first
reader's behalf rather than bytes their own browser fetched. That is the price of not sending
one request per reader, bounded by the seven-day TTL and by the cache holding nothing that is
not reconstructible from the live page.

Publishers may object, and are given three ways to say so that this app honours.
**`robots.txt`** is honoured, per origin, cached in the same KV namespace for 24 hours. The
argument against is decent — it addresses crawlers, and a reader-initiated fetch of one page
they were about to open is arguably not crawling, which is why most reader apps skip it. It is
honoured anyway, because the alternative is arguing with a publisher about the definition of a
crawler, and because a `Disallow` is the only machine-readable "no" the web has; a reader
refused this way gets the first row of the failure table and still gets the link.
**`X-Robots-Tag: noarchive`** is honoured precisely: a response carrying it is extracted for the
reader who asked and not written to the cache, so that publisher's pages cost one fetch per open
rather than one per article. It is the signal that most exactly names what a cache is, and
answering it by not caching rather than by not reading is proportionate. And the **`User-Agent`**
names the app and links to a page explaining it, so a publisher who wants to block this
specifically can, without blocking browsers — a way to be refused is what makes the position
honest rather than merely asserted.

Nothing is inserted into an extracted article, nothing is monetized against it, no byline is
stripped, and the link to the original sits above the fold.

### Tier and the flag that gates it

Extraction is a **Paid** feature, on the $5 plan. It is not priced by its cost, which
[Cost](#cost) puts at about half a cent per reader per month — a tenth of a per cent of the
price, too small to be the reason for anything. It is gated because it is the feature readers
actually ask for and a paid tier has to be worth paying for, and because a free account that
fetches arbitrary URLs on request is an open proxy anybody can have by signing up: a card and a
name do not make abuse impossible, but they give every abusive request an identity and a cost.

Entitlement is [ADR-012](./ADR-012-tiers-entitlements-and-billing.md)'s to answer, and this
adds nothing to it: the route asks the entitlement projection whether this reader's tier
carries extraction, and a reader who is not on one gets the excerpt and the link. Beside it,
`article-extraction` in `app/lib/flags.ts` is the operational switch a tier is not — one edit
to turn the feature off for everybody, on a publisher complaint, a CPU line that moves the
wrong way, or a bug in the sanitizer.

### Observability

Structured events through `@sdxc/logger`
([ADR-033](../ADR-033-wide-events-as-the-logging-contract.md)), carrying counts and hosts rather
than contents. Never a URL in full, never the reader beyond the subject the object is already
named for, and never a byte of extracted text.

| Event                | Fields                                                     |
| -------------------- | ---------------------------------------------------------- |
| `article.extraction` | `host`, `outcome`, `bytes`, `chars`, `cpuMs`, `durationMs` |
| `article.cache`      | `host`, `outcome`, `age`                                   |
| `article.refused`    | `host`, `reason`                                           |

`cpuMs` is there because the parse is the line this design is least sure about, and a page class
costing ten times the model should be visible before it is expensive.

## Cost

Rates from `apps/uptime/app/lib/cost-rates.ts`, in **cents**. A reader opening **20 articles a
day**, 600 a month. One open is a KV read; a miss adds the fetch — free, since Workers prices a
subrequest as CPU rather than per request — the parse, and one KV write. The modelled parse,
scoring and sanitization of a real article page is **150 ms of CPU**, five times the app's
ordinary `fetch`-band model of 8 ms. Half of opens hit the shared cache.

| Line                  | Units                     | Rate (cents) | Cents    |
| --------------------- | ------------------------- | ------------ | -------- |
| Cache reads           | 600                       | 5.0e-5       | 0.030    |
| Cache writes (misses) | 300                       | 5.0e-4       | 0.150    |
| Parse CPU (misses)    | 300 × 150 ms              | 2.0e-6       | 0.090    |
| Render CPU (hits)     | 300 × 10 ms               | 2.0e-6       | 0.006    |
| KV storage            | 140 articles × 30 KB, 30d | 1.667/GB-day | 0.210    |
| **Total**             |                           |              | **0.49** |

**About half a cent a month against a 500-cent price** — a tenth of one per cent. Storage covers
only 140 articles because the seven-day TTL makes a reader's resident set a week of opens rather
than a month. Every open a miss at the 512 KB cap, with the parse rising with the document to
about 600 ms, is **4.6 cents**; a reader opening a hundred articles a day, all misses at the
modelled size, is **3.6 cents**. Both are under one per cent of the price.

**CPU is the line that scales worst**, and the table understates it: at the modelled page it is
a third of the cost of a miss and the second-largest line, and at the size cap two thirds and
the largest. It is the only line proportional to the document — KV prices an operation, not a
byte, so a page ten times the size costs the same read, the same write and ten times the parse.
The 2 MB fetch cap and the 512 KB store cap bound it, and `cpuMs` on the event is what tells us
whether 150 ms was right.

Speculative extraction at poll time, on the same rates: 250 items a day into a reader's timeline
is 7,500 extractions a month at 8.5e-4 each, plus around 2.6 cents of storage — **roughly 9
cents, some eighteen times the on-demand figure**, spent on articles eight times in ten nobody
opens, and charged for readers who never opened the app.

## Consequences

### Positive

- The most common complaint about every feed reader has an answer, and one a paid tier can be
  sold on.
- Nothing about the storage model changes. `feed_items` gains no column, retention keeps the row
  it was derived against, and ADR-002's budget arithmetic stays true.
- An article circulating among readers is extracted once, so the cost of a popular link stops
  responding to how many people open it — ADR-002's argument, one layer up.
- A reader who never opens an article pays nothing for the feature, and a reader who never opens
  the app pays nothing at all.
- Extraction writes nothing anywhere, so no failure of this feature can corrupt a timeline, a
  cursor or a saved post, and losing the KV namespace costs nothing owned: every extraction in
  it is a copy of a live page, and the worst case is a re-fetch.

### Negative

- A reader who saves a post still loses the article when the site goes. ADR-002 said so and this
  declines to change it, which means the strongest case for durable extraction is refused on
  grounds other than storage.
- The app now renders third-party HTML in its own origin on pages carrying a session. A
  sanitizer bug is a stored XSS against every reader who opens the affected article, and the CSP
  is a second line rather than a guarantee.
- The publisher still learns a reader's address when an image loads. Only an image proxy closes
  that, and it is the change that would make this feature expensive.
- Sites that build their body with script extract to nothing, and there is no fix inside a design
  that reads the page as served. That hole covers a real and growing slice of the web.
- The app sends traffic to origins it has no feed relationship with, on reader action. Publishers
  may object, and the three signals honoured here are a position, not a settlement.
- CPU is unbounded in the input in a way nothing else in this app is, and is held only by caps
  chosen from judgement. The 150 ms parse is the least-verified number here.
- A second parse-dependent package, and `@sdxc/html`'s document tree becomes public surface, so
  its shape is harder to change than while it was private.
- The reading page gains a pending state and a table of failure copy, in two locales, for a frame
  that on a miss resolves a second or two after the page does.

### Neutral

- A blocked site is asked once an hour rather than once per open: politer than retrying, less
  responsive than not caching. The hour has no measurement behind it yet.
- Nothing here needs R2, D1 or a second binding. Durable archiving would need all three, as a
  separate feature with its own storage story rather than a column added to this one.

## Alternatives Considered

**Store the extraction on `feed_items`.** One column, no cache, no TTL, no key, and a saved post
that keeps its article. It is the design this ADR exists to refuse: the row ADR-002's arithmetic
was derived against grows fifty times, the million-post budget becomes twenty thousand, and every
mechanism resting on that budget starts life at its limit.

**Store it only for saved posts.** The cap makes the arithmetic survivable — a thousand saves at
100 KB is 100 MB, one per cent of the object — so this is the alternative the numbers do not kill.
It is refused on what it makes the product: a permanent copy of a publisher's article is an
archive, with a different posture and a different promise, and it makes saving able to fail when a
site returns `403`.

**Extract at poll time, in the `FeedDO`.** The article would be there the instant a reader opened
it, shared by construction. It multiplies external traffic by the number of items per feed rather
than leaving it a function of feeds, throws away eight parses in ten, and charges readers who
never open the app — eighteen times the cost for a fifth of the use.

**Extract in the reader's browser.** No Worker CPU, no cache, no storage, and the fetch comes from
the reader's own address, which is the cleanest answer to the etiquette question. Cross-origin
reads need a CORS header essentially no publisher sends, so it does not work; and where it did,
nothing would be shared between readers.

**Use the Cache API through `@sdxc/workers-cache`.** Native, free of KV's write pricing, and built
for derived responses. It caches per colo, so "two readers extract once" would hold only for two
readers in one data centre, and the sharing is the entire reason the cache exists.

**Put the extraction in `@sdxc/html`.** One package, one parser, no subpath, no new workspace. It
puts a heuristic that argues with publishers' templates inside a package whose contract is that
every answer comes from the markup as served, and makes everything querying a page by role carry
a boilerplate scorer.

**A third-party extraction API.** No parser to maintain and no CPU line. It sends every article a
reader opens to a third party along with the fact that somebody opened it, adds a dependency on
the hot path of the marquee paid feature, and prices it per call rather than per millisecond.

## Tests

Twenty behaviours, in the layout the app already uses: the extractor and the sanitizer in plain
Vitest against fixture markup, the cache and route paths in `*.workers.test.ts` with
`@sdxc/cloudflare-mocks`, and every external fetch through MSW.

| #   | Behaviour                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------- |
| 1   | Opening a post extracts its article; rendering a timeline, polling and synchronizing extract nothing      |
| 2   | Two readers opening the same URL produce one outbound fetch and one cache write                           |
| 3   | The cache key is a digest of the URL and carries no reader identifier                                     |
| 4   | An extraction writes nothing into any `UserDO`, and `feed_items` gains no column                          |
| 5   | An entry past its TTL is re-extracted and the cache is written again                                      |
| 6   | An unreachable cache still answers the reader with an article, at the cost of a fetch                     |
| 7   | A saved post keeps its metadata and its link, and no article body, through every sweep                    |
| 8   | Scripts, event handlers, styles, iframes and forms do not survive sanitization                            |
| 9   | A `javascript:` href and a `data:` src are dropped, and their elements kept                               |
| 10  | Relative URLs resolve against the article's final URL, never against the app's origin                     |
| 11  | Every surviving image carries `no-referrer` and lazy loading, and a 1×1 image is dropped                  |
| 12  | A non-HTTP(S) URL, a literal IP host and `localhost` are refused before any request                       |
| 13  | A redirect chain past five hops is refused                                                                |
| 14  | A response past the size cap is abandoned mid-stream, without being buffered                              |
| 15  | A fetch past the timeout is abandoned and reported as an outcome                                          |
| 16  | The outbound request carries no cookies and no reader-identifying header                                  |
| 17  | Every failure renders the excerpt and the link, and answers `200`                                         |
| 18  | An extraction no longer than the stored summary is treated as nothing extractable                         |
| 19  | A failure is cached for an hour, and a success replaces it when the site recovers                         |
| 20  | A `Disallow` refuses extraction, a `noarchive` extracts without caching, and the flag off fetches nothing |

## Implementation

- [ ] `@sdxc/html/document` subpath exposing the parsed tree, with the query surface unchanged
- [ ] `HTML.sanitize(source, policy)`, allow-listing elements, attributes and URL schemes
- [ ] `@sdxc/readability`: candidate scoring, boilerplate removal, and sanitization inside `extract`
- [ ] The four fetch bounds, following `packages/feed/src/lib/limits.ts`
- [ ] `robots.txt` retrieval, its 24-hour cache, and the `X-Robots-Tag: noarchive` no-cache rule
- [ ] `app/lib/article-cache.ts` over `@sdxc/cache/worker-kv`, with the key, the TTL and the caps
- [ ] The negative entry and its one-hour TTL, distinguishable from a cached article
- [ ] The article frame on `/reading/:feedId/:itemId`, pending on a miss, through `lazy-frame`
- [ ] The Content-Security-Policy on the reading page
- [ ] Failure copy for every outcome, and the line on the save control saying what a save keeps, in
      `app/locales/en.ts` and `app/locales/es.ts`
- [ ] The entitlement check on the route, and `article-extraction` in `app/lib/flags.ts`
- [ ] The three structured events, with `cpuMs` on the extraction
- [ ] The tests above, and `@sdxc/readability` in the app's dependencies and the README

## References

- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — the retention arithmetic and the saved-post promise this keeps
- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the per-reader object an extraction is never written to
- [ADR-012](./ADR-012-tiers-entitlements-and-billing.md) — the tier this feature is carried by, and where entitlement is read
- [ADR-055](../ADR-055-html-package.md) — the HTML parser both packages share, and the line the scorer sits outside
- [ADR-053](../ADR-053-cache-package-with-adapters.md) — the cache contract and the KV adapter this uses
- [ADR-001](../ADR-001-new-package-extraction.md) — the convention that makes extraction its own package
- [ADR-052](../ADR-052-feed-facade-package.md) — the feed façade whose fetch bounds this copies
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the events follow
