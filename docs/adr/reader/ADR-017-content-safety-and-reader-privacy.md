# ADR-017: Content Safety and Reader Privacy

## Status

**Proposed** - 2026-09-16

## Background

A feed is a document written by a stranger, retrieved by us, and rendered on
`reader.sergiodxa.com` — our own origin, holding the reader's session cookie. Every other
ADR in this app has treated a feed as data to store and page through.
[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) went as far as
bounding the retrieval itself, adding a response size cap and a redirect limit to
`@sdxc/feed` on the grounds that "feed URLs come from readers, so every fetch is untrusted
network input". That sentence is true one step further than it was applied: what comes back
is untrusted too, and it is rendered in front of somebody.

Two different people want something from that document. One of them wants to run code in
our origin, read the session cookie, or put a control over the top of the reader's own.
The other one is the publisher, who would simply like to know that this person read this
article at this time, from this address, on this device — and who has a well-understood
set of techniques for finding out, none of which involve an attack.

This ADR decides what the app does about both, and says which of the two it is solving at
each step, because the answers differ: the attacker is stopped by a parser and a header,
and the measurer is stopped by never letting the reader's browser talk to them at all.

## Context

### The exposure today is one plain-text line

`database/refresh.ts` stores a `summary` and nothing else of the body. `summaryOf` takes
the publisher's `summary` when there is one, and otherwise parses `contentHtml` through
`HTML.parse` and keeps `parsed.data.text` — the visible text, with every tag gone — then
cuts it to `MAX_SUMMARY_LENGTH`, which ADR-002 brought down to 280 characters. The
timeline renders that string as a text node.

So the app renders no publisher markup at all right now. No element, no attribute, no URL
of theirs reaches a browser except the post's own `url`, on the link. The honest reading of
that is that there is currently no XSS surface in this app, and a sanitizer written today
would have nothing to sanitize.

It is also the last moment that is true. It grows in three places, and each of them turns
the publisher's document into markup a browser parses:

- **[ADR-013](./ADR-013-full-text-extraction.md)**, which extracts an article body and
  renders it. That is the whole of the publisher's HTML, and it is the reason this ADR
  exists now rather than after it.
- **Media.** An `<img>` from a post body is a request from the reader's browser to the
  publisher's server, carrying the reader's IP, user agent and — absent a policy — the URL
  of the page they are on.
- **Any future original-site view**, whether that is a reader-mode pane, a saved snapshot,
  or an embed. Each of them re-asks the same question.

This ADR is written so that whatever ADR-013 renders is already safe when it renders it,
rather than being made safe afterwards by an edit to the sanitizer that the extraction code
has to remember to call.

### Attack and measurement are not the same problem

Sanitization answers the first. It is a parse-and-rebuild over a grammar we control, and its
failure mode is that somebody runs script in our origin.

Nothing about sanitization answers the second. A perfectly well-formed `<img src>` pointing
at a publisher's own CDN is valid HTML, carries no attack, survives any allowlist worth
having, and tells the publisher who read the article. The tool that answers it is a rule
about which hosts the reader's browser is permitted to contact, which is `img-src` and a
proxy, not a sanitizer.

Keeping those apart matters because the sanitizer would otherwise accumulate privacy
heuristics — a blocklist of tracker domains, a pixel-detector, a parameter list — each of
which is a guess that ages. The rule that does not age is that the browser talks to one
origin.

### A header is the backstop for every bug in everything else

The allowlist below will be wrong at some point. A parser differential, a serialization
bug, an element added to HTML after this was written — the class of mistake is not one that
careful work eliminates, only one that careful work makes rarer.

Content-Security-Policy is the only item on this list that covers the others' failures. A
`script-src` of `'self'` means a sanitizer bug that lets `<script>` through produces a
blocked-script console message rather than a stolen session. An `img-src` of `'self'` means
a sanitizer bug that lets a tracking pixel through produces a broken image rather than a
measured reader. That is why it is first in the implementation order and not last: it is the
cheapest item on the list and the only one whose value does not depend on the rest being
correct.

### What Remix v3 ships, and what it does not

The chain in `bootstrap/app.tsx` already ends with `cop()` from `remix/middleware/cop`.
Three security middlewares exist under `docs/vendor/@remix-run/`, and it is worth being
exact about what each one is, because one of them has a name that sounds like the answer
here and is not:

| Middleware | What it does                                                                              |
| ---------- | ----------------------------------------------------------------------------------------- |
| `cop()`    | Rejects unsafe cross-origin requests using `Sec-Fetch-Site`, falling back to `Origin`     |
| `csrf()`   | Session-backed synchronizer tokens, plus `Origin`/`Referer` checks on unsafe methods      |
| `cors()`   | Answers preflights and sets `Access-Control-*` for an API meant to be called cross-origin |

All three act on the **request**. None of them writes a response header, and there is no
CSP or security-headers middleware in the package set. So `cop()` is the right vehicle for
the job it already does and the wrong one for this: it is a browser-provenance guard on
`POST`, not a policy on what the document may load. It stays exactly where it is.

The policy therefore needs an app-owned middleware. It stays in `apps/reader` rather than
becoming a package: one consumer is not an abstraction, and the directives below are
written against this app's actual document — three external stylesheets, one external
module script, no third-party anything — rather than against a general case.

`style-src 'self'` has one concrete casualty, and it is worth naming because it is the
difference between a policy that holds and a policy with `'unsafe-inline'` in it.
`resources/views/timeline.tsx:353` renders the pager with
`style={"display: flex; justify-content: center; padding-block: …"}`. Everything else in
the app styles through `mix` and `@sdxc/u`, which compiles to classes in the linked
stylesheets. That one attribute is the entire reason the policy would need
`'unsafe-inline'` for styles, and `'unsafe-inline'` on `style-src` is not cosmetic: it
re-permits injected `style` attributes, which is `position:fixed` over the app's own
controls and `background-image:url(…)` as an unproxied request. The line becomes mixins.

### A toggle protects the reader who needs it least

Every item below could be a preference. Almost none of them should be.

A setting is found by a reader who went looking for it, and a reader goes looking for a
tracking-pixel control because they already know what a tracking pixel is. The reader who
does not know is the one being measured, and they are the one the default decides for. A
privacy feature behind a switch is therefore close to inverted: it protects the population
that was least exposed and leaves the rest where they were.

The second cost is structural. A switch is a second code path, and the branch nobody selects
is the branch nobody tests. "Proxy images unless the reader turned it off" is two rendering
paths for post media, and the one that regresses silently is the one with fewer readers on
it.

So the bar for a preference here is narrow: a setting exists only where two readers can
correctly want different answers. That is true of exactly one thing on this list — whether a
particular publisher's links survive having their query parameters removed — and it is
false of everything else.

### What the media proxy costs

Rates are in `apps/uptime/app/lib/cost-rates.ts`, in cents per unit. Model one active
reader viewing **300 images a day**, 30 days, at a 20% cache miss rate. Two designs, and
the gap between them is the decision:

| Design                        | Line                               | Arithmetic                          | Cents/month |
| ----------------------------- | ---------------------------------- | ----------------------------------- | ----------- |
| Edge cache (`caches.default`) | Worker requests                    | 9,000 × `workerRequest` 3.0e-5      | 0.27        |
|                               | Worker CPU, at the `fetch` band    | 9,000 × 8 ms × `workerCpuMs` 2.0e-6 | 0.14        |
|                               | Origin subrequests on 1,800 misses | not separately billed               | 0           |
|                               | Egress                             | Workers charge no bandwidth         | 0           |
|                               | **Total**                          |                                     | **0.41**    |
| KV-backed cache               | Reads                              | 9,000 × `kvRead` 5.0e-5             | 0.45        |
|                               | Writes on misses                   | 1,800 × `kvMutation` 5.0e-4         | 0.90        |
|                               | Storage, 0.9 GB steady state       | 0.9 × `kvStorageGbDay` 1.667 × 30   | 45.0        |
|                               | **Total**                          |                                     | **46.4**    |

The steady state is 300 unique images a day at roughly 100 KB held for 30 days, so a little
under a gigabyte. That one line is a hundred times everything else in the table and two
orders of magnitude above what the rest of a free reader costs per month.

So the cost of the media proxy is not the fetch, the bandwidth or the request — it is
**storing a copy of the internet's images ourselves**, and the design that does not do that
is four tenths of a cent per active reader per month. At that number the proxy is affordable
by default and there is nothing to charge for. At forty-six cents it would have had to be
Paid, which would have meant selling the reader their own IP address back.

## Decision

Sanitize on store, enforce a policy on every response, proxy every image, and let the
reader's browser make no request to any host but ours.

### Sanitization runs once, in the feed object

`HTML.sanitize(markup, options)` is a new export of `@sdxc/html`
([ADR-055](../ADR-055-html-package.md)), which already implements the tree-construction
algorithm this needs and is already how `refresh.ts` reads a body. It needs one thing that
package does not have today — a serializer — and that is where the second class of bug
lives: re-emitting an attribute value without escaping `"` and `<` reopens everything the
allowlist just closed. The serializer escapes attribute values and text separately and has
tests of its own.

It runs in the `FeedDO`, at the point `displayableOf` already runs, so what is stored is
what is safe and there is exactly one writer of the rule for every reader of the feed.
**The original markup is not kept.** Storing the raw document would double the feed-side
million-item budget and would mean the database holds a live attack waiting for a rendering
bug. The cost of that choice is precise and is accepted: a sanitizer fix reaches new items
at once and existing ones only at a full re-fetch, which is what `refresh("admin")` is for,
and in the window between the two the CSP is what holds.

### What survives

An allowlist, per element, with no list of dangerous attributes anywhere — because a
denylist is a bet that the platform stops adding attributes, and it has never stopped.

**Elements kept**, block: `p`, `br`, `hr`, `h1`–`h6`, `ul`, `ol`, `li`, `dl`, `dt`, `dd`,
`blockquote`, `pre`, `figure`, `figcaption`, `table`, `thead`, `tbody`, `tfoot`, `tr`, `th`,
`td`, `caption`. Inline: `a`, `em`, `strong`, `i`, `b`, `u`, `s`, `del`, `ins`, `code`,
`kbd`, `samp`, `var`, `sub`, `sup`, `small`, `mark`, `abbr`, `q`, `cite`, `time`, `span`.
Media: `img` alone.

**Elements dropped with their children**: `script`, `style`, `template`, `noscript`,
`iframe`, `object`, `embed`, `applet`, `form`, `input`, `button`, `select`, `textarea`,
`option`, `label`, `svg`, `math`, `base`, `link`, `meta`, `head`, `title`.

**Everything else is unwrapped**: the element goes, its children stay. A publisher who wraps
their post in `<section>` or `<div class="entry-content">` keeps their post, which is the
common case by a wide margin, so the default failure is toward showing the text. The
children-dropped list above exists because unwrapping is catastrophic for exactly those
elements: unwrapping `<script>` writes the JavaScript source into the document as prose,
which is the classic bug in every sanitizer that treats unwrapping as the universal rule.

**Attributes kept**, by element and nothing global:

| Element           | Kept                            |
| ----------------- | ------------------------------- |
| `a`               | `href`, `title`                 |
| `img`             | `src`, `alt`, `width`, `height` |
| `td`, `th`        | `colspan`, `rowspan`            |
| `ol`              | `start`, `reversed`, `type`     |
| `li`              | `value`                         |
| `blockquote`, `q` | `cite`                          |
| `time`            | `datetime`                      |
| `abbr`            | `title`                         |

`colspan` and `rowspan` are parsed as integers and capped at 64, so `colspan="99999"` is a
number rather than a layout bomb. `srcset` and `sizes` are dropped rather than handled: each
is a second URL surface with its own grammar needing the same scheme check and the same
proxying, and one URL surface per image is worth more than a retina asset. `rel` and `target`
on `a` are never copied from the publisher — they are set by us, below — because a
publisher's `target="_self"` navigates the reader's own app frame away.

`id`, `class`, `style`, every `on*`, every `data-*`, `ping`, `formaction`, `srcdoc` and
`xlink:href` are all gone, and none of them is named in the code: they are gone because they
are not on the list. `id` in particular is not cosmetic — an injected `id` collides with the
app's own document, re-targeting an `aria-labelledby` or a fragment link in our chrome.

### URLs and schemes

`a[href]` and `blockquote[cite]` keep `http:`, `https:` and `mailto:`. `img[src]` keeps
`http:` and `https:` only. Everything else — `javascript:`, `data:`, `vbscript:`, `file:`,
`blob:`, and anything unresolvable — has the attribute dropped while the element stays, so a
refused link renders as the text it wrapped.

Scheme matching reads `URL.protocol` after resolving against the post's own URL, never a
string prefix. `JaVaScRiPt:`, `java&#9;script:`, a leading newline and `%6aavascript:` each
defeat a prefix test and none of them defeats the parser, so the parser is what decides.

`data:` is refused **even for images**, which is the one that looks over-strict and is not:
`data:image/svg+xml` is a script document that an `<img>` will happily name as an image.

### Response headers

One middleware, placed immediately before `renderWith` so it decorates the response the
renderer produced, setting the same headers on every response the app makes:

```text
Content-Security-Policy:
  default-src 'none';
  script-src 'self';
  style-src 'self';
  img-src 'self';
  font-src 'self';
  connect-src 'self';
  media-src 'none';
  frame-src 'none';
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'none';
  object-src 'none'
```

`default-src 'none'` rather than `'self'`, so a fetch type nobody thought about fails closed
and permitting one is a deliberate edit. `img-src 'self'` is the load-bearing directive on
this whole list: it is what makes the proxy mandatory rather than a nicety, because with it
in place a sanitizer bug that lets a publisher's pixel through renders a broken image and
makes no request at all. `frame-ancestors 'none'` replaces `X-Frame-Options`, and
`base-uri 'none'` is the backstop for `<base>`, which the sanitizer already drops — a `<base>`
re-targets every relative URL in the document including form actions.

`require-trusted-types-for 'script'` is deliberately not here. `lazy-frame` and the SPA frame
targets write markup into the live document, and a Trusted Types policy is a change to that
code rather than a header; adding it later is a separate, welcome piece of work.

Alongside it:

| Header                         | Value                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `Referrer-Policy`              | `no-referrer`                                                                      |
| `X-Content-Type-Options`       | `nosniff`                                                                          |
| `Strict-Transport-Security`    | `max-age=63072000; includeSubDomains; preload`                                     |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                                                      |
| `Cross-Origin-Resource-Policy` | `same-origin`                                                                      |
| `Permissions-Policy`           | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` |

`no-referrer` rather than the browser's `strict-origin-when-cross-origin` default, and it has
a real cost worth stating: referrer data is how a small publisher learns that readers are
arriving from a feed reader at all, and this removes that signal for every reader of this
app. It is removed anyway, because the alternative is telling a publisher's server which of
our pages a reader was on, and there is no analytics of ours that wanted it.

`browsing-topics=()` refuses the browser's own advertising-topics API on this origin, which
is the one tracking mechanism on this list that needs no publisher cooperation at all.

The policy ships **enforcing from the first deploy**, with no `report-uri` and no
report-only phase. A report endpoint is an unauthenticated write surface whose traffic is
overwhelmingly browser-extension noise, and the policy here is knowable by reading the app —
one script, three stylesheets, nothing third-party — rather than by measuring it. ADR-002
notes there are no readers in production yet, so a report-only phase would measure nobody.
The cost is named: a violation will be found as a broken page rather than as a report.

### Tracking pixels

An `<img>` whose declared `width` or `height` is 2 or less, or 0, is dropped. So is an `<img>`
that declares both dimensions as 1. That is free once the sanitizer exists, and it catches the
honest cases — a legitimate image two pixels across does not exist, and the false positive is a
spacer GIF, whose loss is an improvement.

What it does not catch is a pixel that declares no dimensions, which is most of them, and no
heuristic reliably will. **The proxy is the answer to tracking pixels; the dimension rule is
housekeeping.** A pixel that survives the sanitizer is fetched by our server from one address
with no cookie and no referrer, which is a hit count and not a reader — and if the proxy has not
shipped yet, `img-src 'self'` means it is not fetched at all.

No blocklist of tracker hostnames is shipped. A list of domains is a maintenance treadmill with
a false-negative rate that grows every day nobody updates it, and the structural rule makes it
redundant.

### The media proxy

`GET /media/:signature/:source` — one route, `Free`, default-on, no toggle, because with
`img-src 'self'` the alternative to a proxied image is no image, so there is nothing to
choose between.

`source` is the base64url of the absolute image URL. `signature` is the first 16 bytes of
`HMAC-SHA-256(source)` under `MEDIA_PROXY_SECRET`, base64url'd, compared in constant time.
Without it the endpoint is an open proxy: anybody could hand it any URL and use our address
and our egress to fetch whatever they liked, which is the single risk that decides whether
this route may exist. There is no expiry in the signature — an expiring URL breaks an image
on a page rendered a moment ago, and buys nothing, since replaying a valid signature
re-fetches an image we chose to fetch. Rotating the secret is the revocation.

Before the fetch: the URL must be `http:` or `https:`, on port 80 or 443, and its host must
not be an IP literal in a loopback, private, link-local or unique-local range. Redirects are
followed manually with `redirect: "manual"`, at most 3, with the same check re-run on every
hop — the same two bounds ADR-002 added to `@sdxc/feed`, for the same reason, applied to the
second thing this app retrieves from strangers.

DNS rebinding is not fully defeated by a host check, because a Worker cannot pin the address
a name resolved to. The mitigation that does hold is architectural: this Worker shares no
private network with anything of ours. Its D1, its KV and its two Durable Object namespaces
are reached through bindings rather than through URLs, so an SSRF from here reaches the
public internet and nothing internal.

The request carries no cookies, no `Referer`, and a fixed `User-Agent` naming the product —
that substitution is the entire privacy benefit, and everything else here is the cost of
being allowed to make it.

The response must be `image/*`, is refused if it is `image/svg+xml`, is read off a stream and
refused past 5 MiB, and is re-served with a `Content-Type` from a fixed set (`image/png`,
`image/jpeg`, `image/gif`, `image/webp`, `image/avif`), `nosniff`,
`Cross-Origin-Resource-Policy: same-origin` and a long `Cache-Control`.

Caching is `caches.default` and nothing else. The table above is the argument: a cache of our
own in KV is 46 cents a reader a month against 0.41, and the thing we would be paying for is
a second copy of images that Cloudflare's edge already holds.

The proxy ships **last**, with the first surface that renders a remote image — ADR-013's
extracted articles. Until then `img-src 'self'` means no surface can render one, which is the
CSP enforcing the proxy's own invariant before the proxy exists.

### Tracking parameters

Stripped from the post's outbound URL **at render**, not on store. `utm_*` by prefix; then
`fbclid`, `gclid`, `gbraid`, `wbraid`, `dclid`, `msclkid`, `twclid`, `ttclid`, `igshid`,
`yclid`, `rdt_cid`, `li_fat_id`, `epik`, `mc_cid`, `mc_eid`, `_hsenc`, `_hsmi`, `vero_id`,
`vero_conv`, `oly_anon_id`, `oly_enc_id`.

At render for three reasons. The stored URL is the publisher's own and rewriting it makes the
database disagree with the feed with no way back. The list will grow — a network ships a new
click id next year — and a render-time rule reaches every post already stored where a
store-time rule reaches only what arrives after the deploy. And the original is still there
for anyone who needs it. The cost is a `URL` parse and a handful of `delete` calls per link,
in a view that already builds a `URL`, which against a page of fifty posts is noise.

The rule only ever removes named parameters. It never removes an unknown one and never
removes the query, so a site routing on `?p=123` is untouched. Every parameter on the list is,
by its own specification, campaign metadata or a click identifier minted by an ad network, so
a server that 404s without one is misconfigured — but misconfigured servers exist, which is
why the one preference in this ADR is **keep link parameters**, a per-feed flag on the
subscription, default off. Per-feed rather than global, because the reader who meets a broken
publisher should be fixing that publisher and not turning the feature off everywhere.

### Outbound links

`timeline.tsx` already renders `target="_blank" rel="noopener noreferrer"` on a post's link,
and that stays. `noopener` closes reverse tabnabbing through `window.opener`; modern browsers
imply it for `target="_blank"`, and stating it is one token and covers the ones that do not.
`noreferrer` implies `noopener` and sends no `Referer`.

`Referrer-Policy: no-referrer` makes the attribute redundant on these links and necessary on
everything else the document fetches, and both stay: the header is the promise the document
makes, the attribute is the promise the link makes, and a link written later by someone who
forgets the attribute is still covered.

Links inside a sanitized body get `target="_blank" rel="noopener noreferrer nofollow"` applied
by the sanitizer rather than copied. `nofollow` appears there and not on a post's own link
because a post's link is a reader following a feed they chose, and every reading surface in
this app is behind `requireUser` and crawled by nobody either way.

### Embeds become links

`<iframe>` is dropped and `frame-src` is `'none'`, so a YouTube embed does not render. It is
replaced, not merely removed: an embed the sanitizer recognizes by its `src` host becomes a
link with the video's own thumbnail, served through the proxy, and a play affordance that
opens the video at the publisher's site in a new tab.

**No host is ever added to `frame-src`, including `youtube-nocookie.com`.** That domain is a
weaker promise than its name: it defers cookie-setting until playback, and the reader's
browser still makes a request to Google carrying their address and user agent before anything
is played. The name describes a cookie; the tracking is the request. And allowing any host
puts a third-party document inside our origin's frame tree, after which every future argument
about this policy starts from one with a hole in it — `'none'` is a property you have or do
not.

Alternative front ends are declined for a separate reason: an Invidious or Piped instance is a
third-party server with an uptime we do not run and a lifetime measured in months, so
supporting them means shipping a list of hosts and maintaining it, and the list is the
surface. The cost of all of this is plain — in-place playback is gone, and a reader who
watches a lot of video will find this app worse than a browser at it.

### What this app stores and sees

The honest half. A `UserDO` holds the OIDC subject, every feed a person follows and when they
started, every post's title, URL, summary and author, `read_at`, `saved_at`, each
subscription's `velocity`, and its cursor. That is a complete reading history keyed to one
person, and it is not incidental: an unread queue cannot exist without the app knowing what
has been read.

What limits it is structure rather than policy. The catalog holds feed URLs and knows nothing
about any reader. A `FeedDO`'s `subscribers` table holds a user id and a date — who follows a
feed, and nothing about what they did with it. Nothing leaves: there is no analytics vendor, no
third-party script, and the CSP forbids one from being added by accident.

**The logging rule becomes a rule.** ADR-002's event table already carries only counts,
durations, statuses and `feedUrl` — a publisher's address, not a reader's. This ADR states it
as the contract every future event is written against: an event MAY carry a count, a duration,
a status, a host and a feed identifier, and MUST NOT carry a post title, a post URL, an item
id, or a reader's subject or email address. Two events are added under it:

| Event           | Fields                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| `media.proxy`   | `host`, `status`, `cacheHit`, `bytes`, `durationMs`                           |
| `html.sanitize` | `removedElements`, `removedAttributes`, `droppedUrls`, `pixels`, `durationMs` |

`media.proxy` carries the image's **host** and not its URL, because a URL identifies an
article and a host identifies a CDN.

Telemetry retention is **30 days**, and the cost of that number is that an incident older than
a month is reconstructed from the objects rather than from the log. Account deletion is
ADR-001's `deleteAll()` plus the subscriber row in each `FeedDO` that reader was in, so a feed
does not keep a membership for somebody who no longer exists. The log sink's copy ages out
within the retention window rather than being deleted on request, which is a real limitation
and is stated rather than worked around.

### Defaults, preferences and order

Everything here is **Free**. A paid privacy tier prices safety, and the reader who cannot pay
is the one whose data is worth the most to collect. The cost model above is what makes that
easy rather than principled: at 0.41 cents a reader a month there is nothing to charge for.

Default-on with no switch: sanitization, the CSP and the response headers, the dimension rule,
outbound `rel`, `Referrer-Policy`, embed-to-link, and the media proxy. One preference: **keep
link parameters**, per feed, default off.

Ranked by exposure reduced per unit of work, which is also the build order:

1. **The header middleware.** One file, and the only item that covers every other item's bugs.
   It ships before there is anything to sanitize.
2. **Outbound `rel` and `Referrer-Policy`.** Half-done already; the header is one line of step 1.
3. **Sanitization**, with the serializer. The largest piece, and the gate: nothing that renders
   publisher markup ships before it.
4. **Tracking parameters.** A list and a `URL` parse. The item a reader can see working.
5. **The dimension rule.** Two conditions inside a sanitizer that already exists.
6. **Embeds to links.** A host list and a rewrite, in the same place.
7. **The media proxy.** A route, a signature, an SSRF guard, a cache, and the only running cost.

Sanitization and the CSP come before the proxy, and the reason is the exposure table above: the
proxy protects a reader from being counted, and the other two protect them from losing their
session. There is no reading of the risk on which those orders swap.

## Consequences

### Positive

- A reader's browser makes requests to one origin while reading. A publisher learns that one
  server fetched an image, which is a hit count, and learns nothing about who asked for it.
- The CSP holds independently of the sanitizer being right, so the first bug in the allowlist
  costs a broken element rather than a session.
- Sanitizing on store means one parse per item for every reader of a feed, rather than one per
  reader per view, and the database never holds an attack.
- The allowlist means a new HTML element or attribute is inert here on the day it ships, with
  no update to anything.
- ADR-013 can render an article body the day it lands, because the rule it needs already exists
  and is already applied where items are written.
- `img-src 'self'` enforces the proxy's invariant before the proxy is built, so no surface can
  quietly start loading third-party images in the meantime.
- The one preference is per-feed, so a reader who meets a publisher that needs its parameters
  fixes that publisher rather than the app.

### Negative

- The original markup is gone. A sanitizer fix reaches existing items only through a full
  re-fetch, and there is no way to re-derive what was dropped.
- Video plays elsewhere. `frame-src 'none'` costs in-place playback for every reader, including
  the ones who would have accepted the tracking, and there is no setting that returns it.
- Enclosures are links rather than players, so a podcast is opened rather than heard here.
- `no-referrer` removes a signal small publishers use to learn where their readers come from,
  and this app removes it for every one of them.
- The proxy is a fetch surface we operate. Signed or not, it is a route that retrieves URLs from
  the internet on request, and DNS rebinding is not fully defeated by a host check on a platform
  that cannot pin a resolved address.
- Images cost 0.41 cents per active reader per month where they previously cost nothing, and a
  reader who views far more than 300 a day costs proportionally more with no tier to move them to.
- `srcset` is dropped, so a proxied image serves at one density.
- No CSP reports, so a violation is learned about as a broken page rather than as a signal.
- Telemetry beyond 30 days is gone, and an old incident is reconstructed from objects instead.
- `@sdxc/html` gains a serializer, which is a new class of bug — an unescaped attribute value
  there reopens everything the allowlist closed.

### Neutral

- Today's exposure is one plain-text line, so most of this protects a surface that does not exist
  yet. That is the intent: it is cheaper to decide before ADR-013 renders than to retrofit after.
- `cop()` keeps doing exactly what it did. Nothing in this ADR changes the request-side chain.
- The dimension rule and the parameter list are both maintainable guesses layered over a
  structural rule, so neither being incomplete changes what a reader is exposed to.

## Alternatives Considered

**Sanitize on render rather than on store.** A sanitizer fix reaches every stored item at once,
with no re-fetch. It also pays the parse once per reader per view instead of once per feed,
keeps the raw document in storage — doubling the feed-side budget and holding a live attack
against the day something renders it unsanitized — and puts the security-critical call on the
hot path where a future controller can forget to make it. Storing sanitized output means the
only way to render an item is to render the safe one.

**A denylist of dangerous elements and attributes.** Smaller, and it preserves more of the
publisher's markup. It is also a standing bet that HTML stops growing, and the history of
sanitizers is a history of that bet being lost to an element nobody had heard of.

**`style-src 'unsafe-inline'`, keeping the pager's inline style.** One line of the app stays as
it is. It also re-permits every injected `style` attribute, which is `position:fixed` over the
app's own controls and `background-image:url(…)` as an unproxied request — the two things
dropping `style` was for.

**Allow `youtube-nocookie.com` in `frame-src`.** Embeds work, and the domain sounds like the
privacy-preserving option. The reader's browser still contacts Google before playback, carrying
their address, so the cookie deferral is the smaller half of the problem; and `frame-src` stops
being `'none'`, which is the property the whole policy rests on.

**Proxy through an alternative front end.** Better privacy than an embed, and playback survives.
It also means depending on third-party servers with an uptime we do not run and a lifetime
measured in months, and shipping a list of instances that has to be maintained forever.

**Cache proxied images in KV or R2.** Faster on a cold colo, and a cache we can reason about.
The table above prices it at roughly 46 cents per reader per month against 0.41 — a hundred
times the edge-cache design, for a second copy of what the edge already holds.

**No proxy; drop remote images entirely.** Zero cost, zero SSRF surface, and perfect privacy.
It also makes a photo-led feed unreadable, and the whole value of ADR-013 is rendering an
article as its author wrote it. The proxy is what buys the images back.

**An unsigned proxy endpoint.** One less secret and one less thing to rotate. It is also an open
proxy on our domain, usable by anybody for anything, and there is no version of that which is
acceptable.

**Strip tracking parameters on store.** One pass per item instead of one per render. It makes
the stored URL disagree with the publisher's with no way back, and a new click identifier next
year would reach only posts fetched after the deploy.

**A blocklist of tracker hostnames.** Catches named trackers by name, including ones the
dimension rule misses. It is a list that decays daily, and the proxy makes it redundant: a
tracker reached by our server with no cookie and no referrer has learned a hit count either way.

## Tests

Twenty-four behaviours: the sanitizer and the URL rules as plain Vitest over
`@sdxc/html`, the middleware and the proxy route in `*.workers.test.ts` against the router,
with outbound fetches through MSW.

| #   | Behaviour                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------- |
| 1   | `<script>` is removed with its contents, and its source never appears as text                         |
| 2   | `<style>`, `<iframe>`, `<object>`, `<embed>` and `<form>` are removed with their contents             |
| 3   | An unknown element is unwrapped and its text survives                                                 |
| 4   | Every `on*` attribute is dropped, including on an otherwise allowed element                           |
| 5   | `href="javascript:alert(1)"` is dropped and the anchor renders as its text                            |
| 6   | `JaVaScRiPt:`, a tab-split scheme, a leading newline and a percent-encoded `j` are all refused        |
| 7   | `data:image/svg+xml` is refused on `img[src]`                                                         |
| 8   | `id`, `class` and `style` are dropped from every element                                              |
| 9   | `colspan="99999"` is capped rather than carried through                                               |
| 10  | A publisher's `target` and `rel` are replaced, never copied                                           |
| 11  | An attribute value containing `"` and `<` round-trips through the serializer escaped                  |
| 12  | `<img width="1" height="1">` is removed; `<img width="600">` is kept                                  |
| 13  | A recognized video embed becomes a link with a proxied thumbnail, and no frame                        |
| 14  | Every response carries the CSP, `Referrer-Policy: no-referrer` and the rest of the header set         |
| 15  | The rendered document violates no directive of its own policy, with no inline style or script         |
| 16  | An outbound post link renders `target="_blank" rel="noopener noreferrer"`                             |
| 17  | `utm_*`, `fbclid` and `gclid` are removed from a rendered link, and `?p=123` is not                   |
| 18  | The stored URL is unchanged by rendering                                                              |
| 19  | A subscription with "keep link parameters" renders the URL exactly as stored                          |
| 20  | A `/media` request with a wrong, absent or truncated signature is refused                             |
| 21  | The proxy refuses a `file:`, a loopback address, a private range and a non-standard port              |
| 22  | A redirect to a private address is refused, and a chain past three hops is refused                    |
| 23  | The proxy sends no cookie and no `Referer`, and refuses a non-image or an `image/svg+xml` response    |
| 24  | `media.proxy` records a host and never a URL, and no event carries a post title or a reader's subject |

## Implementation

- [ ] `HTML.sanitize` in `@sdxc/html`, with the element, attribute and scheme allowlists
- [ ] A serializer in `@sdxc/html` that escapes attribute values and text separately
- [ ] Call it in the `FeedDO` where `displayableOf` runs, storing only sanitized markup
- [ ] The dimension rule and the embed-to-link rewrite, inside the sanitizer
- [ ] `app/http/middleware/security-headers.ts`, placed before `renderWith` in `bootstrap/app.tsx`
- [ ] Replace the inline `style` in `resources/views/timeline.tsx:353` with `mix`
- [ ] The tracking-parameter list and the render-time strip, applied wherever a post URL is built
- [ ] `keep_link_parameters` on the `UserDO` subscription, its control, and copy in `en.ts` and `es.ts`
- [ ] `routes/web.ts`: `GET /media/:signature/:source`, and its controller
- [ ] `MEDIA_PROXY_SECRET`, the HMAC mint and the constant-time verification
- [ ] The scheme, port, address-range and redirect checks, re-run on every hop
- [ ] The 5 MiB stream cap, the content-type allowlist, and `caches.default`
- [ ] `media.proxy` and `html.sanitize` events, and the field rule written into `AGENTS.md`
- [ ] 30-day telemetry retention, and the subscriber-row cleanup on account deletion
- [ ] The tests above

## References

- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the per-reader object whose stored history this describes
- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — the retrieval bounds and the logging contract this extends
- [ADR-013](./ADR-013-full-text-extraction.md) — the article bodies this makes safe to render
- [ADR-055](../ADR-055-html-package.md) — the HTML package the sanitizer and its serializer join
- [ADR-052](../ADR-052-feed-facade-package.md) — the façade holding the size cap and redirect limit
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the two new events follow
