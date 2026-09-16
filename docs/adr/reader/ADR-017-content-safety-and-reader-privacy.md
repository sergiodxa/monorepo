# ADR-017: Content Safety and Reader Privacy

## Status

**Accepted** - 2026-09-16

## Background

A feed is a document written by a stranger, retrieved by us, and rendered on
`reader.sergiodxa.com` — our own origin, holding the reader's session cookie.
[ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) bounded the
retrieval, adding a response size cap and a redirect limit to `@sdxc/feed` on the grounds
that "feed URLs come from readers, so every fetch is untrusted network input". That
sentence is true one step further than it was applied: what comes back is untrusted too,
and it is rendered in front of somebody.

Two different people want something from that document. One wants to run code in our
origin, read the session cookie, or put a control over the top of the reader's own. The
other is the publisher, who would simply like to know that this person read this article
at this time, from this address, on this device — and who has a well-understood set of
techniques for finding out, none of which involve an attack. This ADR decides what the app
does about both, and the answers differ: the attacker is stopped by a parser and a header,
the measurer by never letting the reader's browser talk to them at all.

## Context

### The exposure today is one plain-text line

`database/refresh.ts` stores a `summary` and nothing else of the body. `summaryOf` takes
the publisher's `summary` when there is one, and otherwise parses `contentHtml` through
`HTML.parse` and keeps `parsed.data.text` — the visible text, every tag gone — then cuts
it to the 280-character `MAX_SUMMARY_LENGTH`. The timeline renders that as a text node.

So the app renders no publisher markup at all. No element, no attribute, no URL of theirs
reaches a browser except the post's own `url`, on the link. There is no XSS surface in
this app today, and a sanitizer written now would have nothing to sanitize. It is also the
last moment that is true, and it grows in three places:

- **[ADR-013](./ADR-013-full-text-extraction.md)**, which extracts an article body and
  renders it. That is the whole of the publisher's HTML, and it is why this is written now
  rather than after it.
- **Media.** An `<img>` in a post body is a request from the reader's browser to the
  publisher's server, carrying their IP, user agent and — absent a policy — the page they
  are on.
- **Any future original-site view**: a reader-mode pane, a saved snapshot, an embed. Each
  re-asks the same question.

This is written so whatever ADR-013 renders is already safe when it renders it, rather
than made safe afterwards by an edit the extraction code has to remember to call.

### Attack and measurement are not the same problem

Sanitization answers the first, and none of the second. A well-formed `<img src>` pointing
at a publisher's CDN is valid HTML, carries no attack, survives any allowlist worth
having, and tells the publisher who read the article. What answers that is a rule about
which hosts the reader's browser may contact — `img-src` and a proxy. Keeping the two
apart matters because the sanitizer would otherwise accumulate privacy heuristics: a
tracker blocklist, a pixel detector, a parameter list, each a guess that ages. The rule
that does not age is that the browser talks to one origin.

### A header is the backstop for every bug in everything else

The allowlist below will be wrong at some point. A parser differential, a serialization
bug, an element added to HTML after this was written — that class of mistake is not one
careful work eliminates, only one it makes rarer.

Content-Security-Policy is the only item here that covers the others' failures.
`script-src 'self'` means a sanitizer bug letting `<script>` through costs a console
message rather than a session; `img-src 'self'` means one letting a pixel through costs a
broken image rather than a measured reader. That is why it is first in the order and not
last: the cheapest item on the list, and the only one whose value does not depend on the
rest being right.

### What Remix v3 ships, and what it does not

The chain in `bootstrap/app.tsx` already ends with `cop()`. Three security middlewares
exist under `docs/vendor/@remix-run/`, and one has a name that sounds like the answer
here:

| Middleware | What it does                                                                          |
| ---------- | ------------------------------------------------------------------------------------- |
| `cop()`    | Rejects unsafe cross-origin requests using `Sec-Fetch-Site`, falling back to `Origin` |
| `csrf()`   | Session-backed synchronizer tokens, plus `Origin`/`Referer` checks on unsafe methods  |
| `cors()`   | Answers preflights and sets `Access-Control-*` for an API called cross-origin         |

All three act on the **request**. None writes a response header, and there is no CSP or
security-headers middleware in the package set. `cop()` is the right vehicle for the job
it already does and the wrong one for this — a browser-provenance guard on `POST`, not a
policy on what a document may load — so it stays exactly where it is, and the policy needs
an app-owned middleware. That stays in `apps/reader` rather than becoming a package: one
consumer is not an abstraction, and the directives are written against this app's actual
document — three external stylesheets, one external module script, nothing third-party.

`style-src 'self'` has one concrete casualty, and it is the difference between a policy
that holds and one with `'unsafe-inline'` in it. `resources/views/timeline.tsx:353`
renders the pager with an inline `style` attribute; everything else styles through `mix`
and `@sdxc/u`, which compiles to classes in the linked stylesheets. That one attribute is
the entire reason the policy would need `'unsafe-inline'`, and that is not cosmetic: it
re-permits injected `style`, which is `position:fixed` over the app's own controls and
`background-image:url(…)` as an unproxied request. The line becomes mixins.

### A toggle protects the reader who needs it least

A setting is found by a reader who went looking, and somebody goes looking for a
tracking-pixel control because they already know what a tracking pixel is. The reader who
does not know is the one being measured, and the one the default decides for. A privacy
feature behind a switch is close to inverted: it protects the population that was least
exposed. The second cost is structural — a switch is a second code path, and the branch
nobody selects is the branch nobody tests.

So the bar is narrow: a setting exists only where two readers can correctly want different
answers. That is true of exactly one thing below, and false of everything else.

### What the media proxy costs

Rates are in `apps/uptime/app/lib/cost-rates.ts`, in cents per unit. One active reader
viewing **300 images a day**, 30 days, 20% cache miss. Two designs, and the gap between
them is the decision:

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

Steady state is 300 unique images a day at roughly 100 KB held 30 days, a little under a
gigabyte, and that one line is a hundred times everything else in the table. So the cost
of a media proxy is not the fetch, the bandwidth or the request — it is **keeping our own
copy of the internet's images**, and the design that does not do that is four tenths of a
cent per active reader per month against a free tier already measured in fractions of a
cent. At forty-six cents it would have had to be Paid, which would have meant selling the
reader their own IP address back.

## Decision

Sanitize on store, enforce a policy on every response, proxy every image, and let the
reader's browser make no request to any host but ours.

### Sanitization runs once, in the feed object

`HTML.sanitize(markup, options)` is a new export of `@sdxc/html`
([ADR-055](../ADR-055-html-package.md)), which already implements the tree-construction
algorithm this needs and is already how `refresh.ts` reads a body. It needs one thing that
package lacks — a serializer — and that is where the second class of bug lives:
re-emitting an attribute value without escaping `"` and `<` reopens everything the
allowlist just closed. The serializer escapes attribute values and text separately, with
tests of its own.

It runs in the `FeedDO`, where `displayableOf` already runs, so what is stored is what is
safe and there is one writer of the rule for every reader of the feed. **The original
markup is not kept.** Storing the raw document would double the feed-side million-item
budget and hold a live attack waiting for a rendering bug. The cost is accepted: a
sanitizer fix reaches new items at once and existing ones only at a full re-fetch, which
is what `refresh("admin")` is for, and in that window the CSP is what holds.

### What survives

An allowlist, per element, with no list of dangerous attributes anywhere — a denylist is a
bet that the platform stops adding attributes, and it has never stopped.

**Elements kept**, block: `p`, `br`, `hr`, `h1`–`h6`, `ul`, `ol`, `li`, `dl`, `dt`, `dd`,
`blockquote`, `pre`, `figure`, `figcaption`, `table`, `thead`, `tbody`, `tfoot`, `tr`,
`th`, `td`, `caption`. Inline: `a`, `em`, `strong`, `i`, `b`, `u`, `s`, `del`, `ins`,
`code`, `kbd`, `samp`, `var`, `sub`, `sup`, `small`, `mark`, `abbr`, `q`, `cite`, `time`,
`span`. Media: `img` alone.

**Elements dropped with their children**: `script`, `style`, `template`, `noscript`,
`iframe`, `object`, `embed`, `applet`, `form`, `input`, `button`, `select`, `textarea`,
`option`, `label`, `svg`, `math`, `base`, `link`, `meta`, `head`, `title`.

**Everything else is unwrapped**: the element goes, its children stay, so a publisher who
wraps a post in `<section>` keeps their post and the default failure is toward showing the
text. The children-dropped list exists because unwrapping is catastrophic for exactly
those elements: unwrapping `<script>` writes the JavaScript source into the document as
prose, which is the classic bug in every sanitizer that treats unwrapping as the universal
rule.

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
number rather than a layout bomb. `srcset` and `sizes` are dropped rather than handled:
each is a second URL surface with its own grammar needing the same scheme check and the
same proxying, and one URL surface per image is worth more than a retina asset. `rel` and
`target` on `a` are set by us rather than copied, because a publisher's `target="_self"`
navigates the reader's own app frame away.

`id`, `class`, `style`, every `on*`, every `data-*`, `ping`, `formaction`, `srcdoc` and
`xlink:href` are gone, and none is named in the code: they are gone because they are not
on the list. `id` is not cosmetic — an injected one collides with the app's own document,
re-targeting an `aria-labelledby` or a fragment link in our chrome.

### URLs and schemes

`a[href]` and `blockquote[cite]` keep `http:`, `https:` and `mailto:`. `img[src]` keeps
`http:` and `https:`. Everything else — `javascript:`, `data:`, `vbscript:`, `file:`,
`blob:`, anything unresolvable — has the attribute dropped while the element stays, so a
refused link renders as the text it wrapped.

Scheme matching reads `URL.protocol` after resolving against the post's own URL, never a
string prefix. `JaVaScRiPt:`, `java&#9;script:`, a leading newline and `%6aavascript:`
each defeat a prefix test and none defeats the parser, so the parser decides. `data:` is
refused **even for images**, which looks over-strict and is not: `data:image/svg+xml` is a
script document an `<img>` will happily name as an image.

### Response headers

One middleware, placed immediately before `renderWith` so it decorates the response the
renderer produced:

```text
Content-Security-Policy:
  default-src 'none';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self';
  font-src 'self';
  connect-src 'self';
  manifest-src 'self';
  media-src 'none';
  frame-src 'none';
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'none';
  object-src 'none'
```

Two directives differ from what a reading of the app suggested. `style-src` carries
`'unsafe-inline'` because this app's renderer mints a page's rules as it streams the page
and emits them as `<style>` elements inside the document it is building — `mix` and
`@sdxc/u` compile to classes, and the classes' declarations travel with the document
rather than in the linked stylesheets. A hash is not available to a streamed render and
the renderer takes no nonce, so `style-src 'self'` serves every page unstyled. What the
relaxation would otherwise re-permit is closed one layer up instead: the sanitizer's
attribute table names no `style` on any element, so an injected one is absent before a
policy has to refuse it. `manifest-src 'self'` is spelled out because `default-src 'none'`
covers the manifest the document links, and a browser that cannot read the manifest keeps
no push subscription for the page.

For the same reason the pager's inline `style` attribute in `resources/views/timeline.tsx`
stays as it is: it is the app's own constant string rather than a publisher's, it travels
to the browser inside a hydrated component's serialized props where only plain values
survive, and the directive it was going to buy is not one this renderer can be served
under.

`default-src 'none'` rather than `'self'`, so a fetch type nobody thought about fails
closed and permitting one is a deliberate edit. `img-src 'self'` is the load-bearing
directive on the whole list: with it in place a sanitizer bug that lets a publisher's
pixel through renders a broken image and makes no request at all. `frame-ancestors 'none'`
replaces `X-Frame-Options`, and `base-uri 'none'` backstops `<base>`, which the sanitizer
already drops — a `<base>` re-targets every relative URL in the document, form actions
included. `require-trusted-types-for 'script'` is absent because `lazy-frame` and the SPA
frame targets write markup into the live document, making it a change to that code rather
than a header.

| Header                         | Value                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `Referrer-Policy`              | `no-referrer`                                                                      |
| `X-Content-Type-Options`       | `nosniff`                                                                          |
| `Strict-Transport-Security`    | `max-age=63072000; includeSubDomains; preload`                                     |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                                                      |
| `Cross-Origin-Resource-Policy` | `same-origin`                                                                      |
| `Permissions-Policy`           | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` |

`no-referrer` rather than the browser's `strict-origin-when-cross-origin` default, with a
real cost: referrer data is how a small publisher learns readers are arriving from a feed
reader at all, and this removes that signal for every one of them. It goes anyway, because
the alternative is telling a publisher's server which of our pages a reader was on, and no
analytics of ours wanted it. `browsing-topics=()` refuses the browser's own
advertising-topics API, the one mechanism here needing no publisher cooperation.

The policy ships **enforcing from the first deploy**, with no `report-uri` and no
report-only phase. A report endpoint is an unauthenticated write surface whose traffic is
overwhelmingly extension noise, and this policy is knowable by reading the app rather than
by measuring it; ADR-002 notes there are no readers in production yet, so a report-only
phase would measure nobody. The cost is that a violation is found as a broken page rather
than as a report.

### Tracking pixels

An `<img>` declaring a `width` or `height` of 2 or less is dropped. That is free once the
sanitizer exists and catches the honest cases — a legitimate image two pixels across does
not exist, and the false positive is a spacer GIF, whose loss is an improvement.

It does not catch a pixel that declares no dimensions, which is most of them, and no
heuristic reliably will. **The proxy is the answer to tracking pixels; the dimension rule
is housekeeping.** A pixel that survives is fetched by our server from one address with no
cookie and no referrer, which is a hit count rather than a reader — and until the proxy
ships, `img-src 'self'` means it is not fetched at all. No blocklist of tracker hostnames
is shipped: it would decay daily, and the structural rule makes it redundant.

### The media proxy

`GET /media/:signature/:source` — one route, Free, default-on, no toggle, because with
`img-src 'self'` the alternative to a proxied image is no image, so there is nothing to
choose between.

`source` is the base64url of the absolute image URL. `signature` is the first 16 bytes of
`HMAC-SHA-256(source)` under `MEDIA_PROXY_SECRET`, base64url'd, compared in constant time.
Without it the endpoint is an open proxy: anybody could hand it any URL and spend our
address and our egress on whatever they liked, which is the single risk deciding whether
this route may exist at all. There is no expiry — an expiring URL breaks an image on a
page rendered a moment ago and buys nothing, since replaying a valid signature re-fetches
an image we chose to fetch. Rotating the secret is the revocation.

Before the fetch: the URL must be `http:` or `https:`, on port 80 or 443, and its host
must not be an IP literal in a loopback, private, link-local or unique-local range.
Redirects are followed manually with `redirect: "manual"`, at most 3, with the same check
re-run on every hop — the same two bounds ADR-002 added to `@sdxc/feed`, applied to the
second thing this app retrieves from strangers. DNS rebinding is not fully defeated by a
host check, because a Worker cannot pin the address a name resolved to. What does hold is
architectural: this Worker's D1, KV and two object namespaces are reached through bindings
rather than URLs, so an SSRF from here reaches the public internet and nothing of ours.

The request carries no cookies, no `Referer`, and a fixed `User-Agent` naming the product.
That substitution is the entire privacy benefit; everything else here is the cost of being
allowed to make it. The response must be `image/*`, is refused if `image/svg+xml`, is read
off a stream and refused past 5 MiB, and is re-served with a `Content-Type` from a fixed
set (`image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/avif`), `nosniff`,
`Cross-Origin-Resource-Policy: same-origin` and a long `Cache-Control`. Caching is
`caches.default` and nothing else — the table above is the argument, and what a KV cache
buys is a second copy of images the edge already holds.

The proxy ships **last**, with the first surface that renders a remote image, which is
ADR-013's extracted articles. Until then `img-src 'self'` means no surface can render one,
which is the CSP enforcing the proxy's own invariant before the proxy exists.

### Tracking parameters

Stripped from the post's outbound URL **at render**. `utm_*` by prefix; then `fbclid`,
`gclid`, `gbraid`, `wbraid`, `dclid`, `msclkid`, `twclid`, `ttclid`, `igshid`, `yclid`,
`rdt_cid`, `li_fat_id`, `epik`, `mc_cid`, `mc_eid`, `_hsenc`, `_hsmi`, `vero_id`,
`vero_conv`, `oly_anon_id`, `oly_enc_id`.

At render for three reasons. The stored URL is the publisher's own, and rewriting it makes
the database disagree with the feed with no way back. The list will grow — a network ships
a new click id next year — and a render-time rule reaches every post already stored where
a store-time rule reaches only what arrives after the deploy. And the original stays
available. The cost is a `URL` parse and a handful of `delete` calls per link, in a view
that already builds a `URL`, which against a page of fifty posts is noise.

The rule only ever removes named parameters, never an unknown one and never the query, so
a site routing on `?p=123` is untouched. Every parameter listed is, by its own
specification, campaign metadata or a click identifier minted by an ad network, so a
server that 404s without one is misconfigured — but misconfigured servers exist, which is
why the one preference in this ADR is **keep link parameters**, a per-feed flag on the
subscription, default off. Per-feed rather than global, so a reader who meets a broken
publisher fixes that publisher rather than the feature.

### Outbound link hygiene

`timeline.tsx` already renders `target="_blank" rel="noopener noreferrer"` on a post's
link, and that stays. `noopener` closes reverse tabnabbing through `window.opener` —
implied by modern browsers for `target="_blank"`, and one token to cover the ones that do
not — and `noreferrer` implies it while sending no `Referer`. Both stay alongside the
document-wide `Referrer-Policy`: the header is the promise the document makes, the
attribute the promise the link makes, and a link written later by somebody who forgets the
attribute is still covered.

Links inside a sanitized body get `target="_blank" rel="noopener noreferrer nofollow"`
applied by the sanitizer rather than copied. `nofollow` appears there and not on a post's
own link because a post's link is a reader following a feed they chose — and every reading
surface here is behind `requireUser`, crawled by nobody either way.

### Embeds become links

`<iframe>` is dropped and `frame-src` is `'none'`, so a YouTube embed does not render. It
is replaced rather than merely removed: an embed the sanitizer recognizes by its `src`
host becomes a link carrying the video's own thumbnail, served through the proxy, opening
the video at the publisher's site in a new tab.

**No host is ever added to `frame-src`, `youtube-nocookie.com` included.** That domain is
a weaker promise than its name: it defers cookie-setting until playback, and the browser
still reaches Google with the reader's address and user agent before anything plays. The
name describes a cookie; the tracking is the request. Allowing any host also puts a
third-party document inside our origin's frame tree, after which every future argument
about this policy starts from one with a hole in it. Alternative front ends are declined
for a different reason: an Invidious or Piped instance is a server with an uptime we do
not run and a lifetime measured in months, so supporting them means maintaining a list of
hosts, and the list is the surface. The cost is plain — in-place playback is gone, and a
reader who watches a lot of video will find this app worse than a browser at it.

### What this app stores and sees

The honest half. A `UserDO` holds the OIDC subject, every feed a person follows and when
they started, every post's title, URL, summary and author, `read_at`, `saved_at`, each
subscription's `velocity`, and its cursor. That is a complete reading history keyed to one
person, and it is not incidental: an unread queue cannot exist without the app knowing
what has been read.

What limits it is structure rather than policy. The catalog holds feed URLs and knows
nothing about any reader; a `FeedDO`'s `subscribers` table holds a user id and a date, and
nothing about what they did with the feed. Nothing leaves: no analytics vendor, no
third-party script, and the CSP forbids one being added by accident.

**The logging rule becomes a rule.** ADR-002's event table already carries only counts,
durations, statuses and `feedUrl` — a publisher's address, not a reader's. This states it
as the contract every future event is written against: an event MAY carry a count, a
duration, a status, a host and a feed identifier, and MUST NOT carry a post title, a post
URL, an item id, or a reader's subject or email. Two events are added under it:

| Event           | Fields                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| `media.proxy`   | `host`, `status`, `cacheHit`, `bytes`, `durationMs`                           |
| `html.sanitize` | `removedElements`, `removedAttributes`, `droppedUrls`, `pixels`, `durationMs` |

`media.proxy` carries the image's **host** and not its URL, because a URL identifies an
article and a host identifies a CDN. Telemetry retention is **30 days**, and the cost of
that number is that an incident older than a month is reconstructed from the objects
rather than the log. Account deletion is ADR-001's `deleteAll()` plus the subscriber row
in each `FeedDO` that reader was in, so a feed keeps no membership for somebody who no
longer exists. The log sink's copy ages out within the retention window rather than being
deleted on request, which is a real limitation and is stated rather than worked around.

### Defaults, preferences and order

Everything here is **Free**. A paid privacy tier prices safety, and the reader who cannot
pay is the one whose data is worth most to collect; the cost model above makes that easy
rather than principled. Default-on with no switch: sanitization, the CSP and the response
headers, the dimension rule, outbound `rel`, `Referrer-Policy`, embed-to-link, and the
media proxy. One preference: **keep link parameters**, per feed, default off.

Ranked by exposure reduced per unit of work, which is also the build order:

1. **The header middleware.** One file, and the only item covering every other item's
   bugs. It ships before there is anything to sanitize.
2. **Outbound `rel` and `Referrer-Policy`.** Half-done already; the header is one line of
   step 1.
3. **Sanitization**, with the serializer. The largest piece, and the gate: nothing that
   renders publisher markup ships before it.
4. **Tracking parameters.** A list and a `URL` parse. The item a reader can see working.
5. **The dimension rule.** Two conditions inside a sanitizer that already exists.
6. **Embeds to links.** A host list and a rewrite, in the same place.
7. **The media proxy.** A route, a signature, an SSRF guard, a cache, and the only running
   cost.

Sanitization and the CSP come before the proxy: the proxy protects a reader from being
counted, the other two protect them from losing their session. There is no reading of the
risk on which that order swaps.

## Consequences

### Positive

- A reader's browser talks to one origin while reading. A publisher learns that one server
  fetched an image, which is a hit count, and nothing about who asked for it.
- The CSP holds independently of the sanitizer being right, so the first bug in the
  allowlist costs a broken element rather than a session.
- Sanitizing on store is one parse per item for every reader of a feed rather than one per
  reader per view, and the database never holds an attack.
- The allowlist means a new HTML element or attribute is inert here the day it ships, with
  no update to anything.
- ADR-013 can render an article body the day it lands, because the rule it needs already
  exists where items are written.
- `img-src 'self'` enforces the proxy's invariant before the proxy is built, so no surface
  quietly starts loading third-party images in the meantime.

### Negative

- The original markup is gone. A sanitizer fix reaches existing items only through a full
  re-fetch, and what was dropped cannot be re-derived.
- Video plays elsewhere. `frame-src 'none'` costs in-place playback for every reader,
  including the ones who would have accepted the tracking, and no setting returns it.
- `no-referrer` removes a signal small publishers use to learn where their readers come
  from, for every one of them.
- The proxy is a fetch surface we operate. Signed or not, it retrieves URLs from the
  internet on request, and DNS rebinding is not fully defeated by a host check on a
  platform that cannot pin a resolved address.
- Images cost 0.41 cents per active reader per month where they cost nothing before, and a
  reader viewing far more than 300 a day costs proportionally more with no tier to move
  them to.
- `srcset` is dropped, so a proxied image serves at one density; enclosures are links
  rather than players, so a podcast is opened rather than heard here.
- No CSP reports and no telemetry past 30 days, so a violation is learned about as a
  broken page and an old incident is reconstructed from the objects.
- `@sdxc/html` gains a serializer, a new class of bug: an unescaped attribute value there
  reopens everything the allowlist closed.

### Neutral

- Today's exposure is one plain-text line, so most of this protects a surface that does
  not exist yet. That is the intent — deciding before ADR-013 renders is cheaper than
  retrofitting after.
- `cop()` keeps doing exactly what it did. Nothing here changes the request-side chain.
- The dimension rule and the parameter list are maintainable guesses layered over a
  structural rule, so neither being incomplete changes what a reader is exposed to.

## Alternatives Considered

**Sanitize on render rather than on store.** A fix reaches every stored item at once with
no re-fetch. It also pays the parse once per reader per view, keeps the raw document in
storage — doubling the feed-side budget and holding a live attack against the day
something renders it unsanitized — and puts the security-critical call on the hot path
where a future controller can forget it.

**A denylist of dangerous elements and attributes.** Smaller, and it preserves more of the
publisher's markup. It is also a standing bet that HTML stops growing, and the history of
sanitizers is the history of that bet being lost to an element nobody had heard of.

**`style-src 'unsafe-inline'`, keeping the pager's inline style.** It re-permits every
injected `style` attribute, which is `position:fixed` over the app's own controls and
`background-image:url(…)` as an unproxied request. It is what ships, because the renderer
emits the page's own rules inline and the alternative is an unstyled app; the two things
dropping `style` was for are taken by the sanitizer's attribute table instead, which names
`style` on no element.

**Allow `youtube-nocookie.com` in `frame-src`.** Embeds work, and the domain sounds like
the privacy-preserving option. The browser still reaches Google before playback carrying
the reader's address, so the cookie deferral is the smaller half; and `frame-src` stops
being `'none'`, which is the property the whole policy rests on.

**Cache proxied images in KV or R2.** Faster on a cold colo, and a cache we can reason
about. The table prices it at roughly 46 cents per reader per month against 0.41, for a
second copy of what the edge already holds.

**No proxy; drop remote images entirely.** Zero cost, zero SSRF surface, perfect privacy.
It also makes a photo-led feed unreadable, and rendering an article as its author wrote it
is the whole value of ADR-013. The proxy buys the images back.

**Strip tracking parameters on store.** One pass per item instead of one per render. It
makes the stored URL disagree with the publisher's with no way back, and a new click
identifier next year would reach only posts fetched after the deploy.

## Tests

Twenty behaviours: the sanitizer and the URL rules as plain Vitest over `@sdxc/html`, the
middleware and the proxy route in `*.workers.test.ts` against the router, with outbound
fetches through MSW.

| #   | Behaviour                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `<script>` is removed with its contents, and its source never appears as text                                                                      |
| 2   | `<style>`, `<iframe>`, `<object>`, `<embed>` and `<form>` are removed with their contents                                                          |
| 3   | An unknown element is unwrapped and its text survives                                                                                              |
| 4   | Every `on*` attribute is dropped, including on an otherwise allowed element                                                                        |
| 5   | `JaVaScRiPt:`, a tab-split scheme, a leading newline and a percent-encoded `j` are all refused                                                     |
| 6   | `data:image/svg+xml` is refused on `img[src]`, and a refused `href` leaves the anchor as text                                                      |
| 7   | `id`, `class` and `style` are dropped from every element                                                                                           |
| 8   | `colspan="99999"` is capped rather than carried through                                                                                            |
| 9   | A publisher's `target` and `rel` are replaced, never copied                                                                                        |
| 10  | An attribute value containing `"` and `<` round-trips through the serializer escaped                                                               |
| 11  | `<img width="1" height="1">` is removed; `<img width="600">` is kept                                                                               |
| 12  | A recognized video embed becomes a link with a proxied thumbnail, and no frame                                                                     |
| 13  | Every response carries the CSP, `Referrer-Policy: no-referrer` and the rest of the header set                                                      |
| 14  | The rendered document violates no directive of its own policy, with no inline style or script                                                      |
| 15  | An outbound post link renders `target="_blank" rel="noopener noreferrer"`                                                                          |
| 16  | `utm_*`, `fbclid` and `gclid` are removed from a rendered link, `?p=123` is not, and the stored URL is unchanged                                   |
| 17  | A subscription with "keep link parameters" renders the URL exactly as stored                                                                       |
| 18  | A `/media` request with a wrong, absent or truncated signature is refused                                                                          |
| 19  | The proxy refuses a `file:`, a loopback address, a private range, a non-standard port, a redirect to a private address and a chain past three hops |
| 20  | The proxy sends no cookie and no `Referer`, refuses a non-image response, and `media.proxy` records a host rather than a URL                       |

## Implementation

- [x] `HTML.sanitize` in `@sdxc/html`, with the element, attribute and scheme allowlists
- [x] A serializer in `@sdxc/html` that escapes attribute values and text separately
- [x] Call it where publisher markup enters. `feed_items` holds no markup — a post's row is
      a title, a URL, a plain-text summary and an author — so the only markup this app ever
      stores is an extracted article, and it is sanitized before the shared cache is written
- [x] The dimension rule and the embed-to-link rewrite, inside the sanitizer
- [x] `app/http/middleware/security-headers.ts`, placed before `renderWith` in
      `bootstrap/app.tsx`
- [ ] The pager's inline `style` in `resources/views/timeline.tsx` stays, for the reason
      given beside the policy above
- [x] The tracking-parameter list and the render-time strip, wherever a post URL is built
- [x] `keep_link_parameters` on the subscription, its control, and copy in `en.ts` and
      `es.ts`
- [x] `routes/web.ts`: `GET /media/:signature/:source`, and its controller
- [x] `MEDIA_PROXY_SECRET`, the HMAC mint and the constant-time verification
- [x] The scheme, port, address-range and redirect checks, re-run on every hop
- [x] The 5 MiB stream cap, the content-type allowlist, and the edge cache, reached as a
      named cache since the ambient typings this app compiles under expose `open` alone
- [x] `media.proxy` and `html.sanitize` events, and the field rule written into
      `AGENTS.md`
- [ ] 30-day telemetry retention waits on a sink that can be configured for it, and the
      subscriber-row cleanup waits on the account-deletion surface it hooks into; neither
      exists yet
- [x] The tests above

## References

- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the per-reader object
  whose stored history this describes
- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — the retrieval
  bounds and the logging contract this extends
- [ADR-013](./ADR-013-full-text-extraction.md) — the article bodies this makes safe to
  render
- [ADR-055](../ADR-055-html-package.md) — the HTML package the sanitizer and its
  serializer join
- [ADR-052](../ADR-052-feed-facade-package.md) — the façade holding the size cap and
  redirect limit
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the
  two new events follow
