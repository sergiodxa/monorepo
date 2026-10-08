# ADR-110: Attribution Package

## Status

**Accepted** - 2026-10-07

## Background

Three apps deal with campaign parameters, and each one handles a different part of the job.
`books` reads four `utm_*` values off the query string on every page that has an email form,
renders them into hidden inputs, and forwards them to Buttondown when the form posts. `uptime`
records the first page a visitor lands on in session, along with a source and campaign from an
allowlist, and copies that record onto the trial conversion row at sign-in so the funnel
report can say which campaign produced a paying account. `reader` removes `utm_*` and 21 click
identifiers from every outbound link it renders, and lets a reader keep them for one feed.

None of them share code, and none covers the whole job. `books` loses attribution as soon as a
visitor clicks to a second page, and its Polar checkouts carry no attribution. `uptime` keeps
two campaign fields and drops medium, the click identifier and the referrer. Every page `books`
renders from a campaign link advertises a canonical URL that includes the `utm_*` parameters. A
fourth app that sells or collects addresses would write the same code a fourth time.

## Context

### Current implementations

| Location                                                                 | What it does                                                                                                         | Storage                                 | Normalization                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `apps/books/app/lib/attribution.ts` `readAttribution`                    | Reads `utm_source`, `utm_campaign`, `utm_medium` and a non-standard `utm_referral` off the current URL               | None: hidden inputs in `SubscribeForm`  | None, values are forwarded verbatim                           |
| `apps/books/app/services/buttondown.ts` `subscribe`                      | Sends `utm_source`, `utm_campaign`, `utm_medium` to Buttondown with the address                                      | n/a                                     | n/a                                                           |
| `apps/books/app/http/validators/subscribe.ts` `SubscribeSchema`          | Accepts the four hidden fields as optional strings                                                                   | n/a                                     | None                                                          |
| `apps/uptime/app/http/middleware/attribution.ts`                         | First touch on `GET`: landing path, source from `utm_source`/`ref`/`source`, campaign from `utm_campaign`/`campaign` | Session (`trialAttribution`), KV-backed | Lowercased, `[a-z0-9_.-]` only, 64 characters                 |
| `apps/uptime/app/http/controllers/auth.tsx`                              | Copies the session record onto `trial_conversions` at sign-in                                                        | D1 row                                  | n/a                                                           |
| `apps/uptime/app/services/funnel-events.ts` `attributionProperties`      | Puts `source`, `campaign`, `landingPath` on every `funnel.*` event                                                   | Log                                     | `scrub` redacts anything URL- or address-shaped               |
| `apps/reader/app/lib/tracking-parameters.ts` `withoutTrackingParameters` | Removes `utm_*` and 21 click identifiers from a post's link as it renders                                            | n/a                                     | Parameter names case-folded                                   |
| `apps/reader/database/migrations/0016-keep-link-parameters.sql`          | Per-feed `keep_link_parameters`, off by default                                                                      | User DO                                 | n/a                                                           |
| `packages/seo/src/lib/urls.ts` `canonicalUrl`                            | Builds the canonical URL every page advertises                                                                       | n/a                                     | Keeps the query string verbatim, tracking parameters included |

### Packages already in this space

| Package                    | Relevant surface                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `@sdxc/session-storage-kv` | The KV storage behind `uptime`'s session. Every write to an anonymous session is a KV write                               |
| `@sdxc/billing`            | `checkouts.create({ metadata })` takes a `Record<string, string>` that the platform returns on the order and its webhooks |
| `@sdxc/seo`                | `seo.canonical(ctx.url)`, which `books` passes the raw request URL to                                                     |
| `@sdxc/user-agent`         | Parses browser, engine, OS and device. A crawler reads as all-`null`, and nothing answers "is this a bot"                 |
| `@sdxc/http`               | `redirect()` and the status helpers                                                                                       |
| `@sdxc/logger`             | `currentLog()`, where a captured touch is recorded as fields                                                              |

### Issues identified

| Issue                                                                      | Impact                                                                                                                                    |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `books` keeps attribution only for the page the visitor landed on          | A visitor who reads a sample chapter before subscribing subscribes unattributed                                                           |
| `books` forwards raw query values to Buttondown                            | A link whose merge tag puts the recipient's address in `utm_campaign` stores that address in Buttondown                                   |
| `uptime`'s normalization keeps an address's characters after removing `@`  | `?ref=jane@example.com` is stored as `janeexample.com`, which still identifies someone                                                    |
| No app records medium, content, term, the click identifier or the referrer | A paid click and an organic share from the same source report as the same campaign                                                        |
| No app attaches attribution to a checkout                                  | A Polar order cannot be traced to the campaign that produced it except through `uptime`'s conversion row                                  |
| Anonymous session writes from link-preview bots                            | Every Slack, X or LinkedIn unfurl of an `uptime` campaign link creates a KV-backed session                                                |
| `seo.canonical` keeps `utm_*`                                              | A page reached from a campaign link names the campaign URL as canonical, which splits ranking signals across every campaign that links it |
| The click identifier list lives in `reader`                                | `seo`, a future link-cleaning feature and capture all need the same list, and a network minting a new identifier means editing it once    |

## Decision

Add `@sdxc/attribution`: one record type for where a visit came from (a **touch**), a parser
that builds it from a URL and a `Referer` header, a middleware that keeps the first and the last
touch in the session or in a cookie and publishes them as `ctx.attribution`, helpers that
flatten a touch into checkout metadata or UTM fields, and the tracking-parameter list with the
function that strips it.

The package has three subpath exports:

| Export                         | Contents                                                                                                                                  | Dependencies                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@sdxc/attribution`            | `readTouch`, `classifyReferrer`, `toMetadata`, `toUtmParams`, and the `Touch`, `Utm`, `Click`, `Referrer`, `Channel`, `Attribution` types | None beyond `./parameters`                                                                                             |
| `@sdxc/attribution/parameters` | `CAMPAIGN_PARAMETERS`, `CLICK_IDENTIFIERS`, `isTrackingParameter`, `withoutTracking`                                                      | None, so `@sdxc/seo` and a link renderer import it at no cost                                                          |
| `@sdxc/attribution/middleware` | `attribution(options)`, `CurrentAttribution`                                                                                              | `remix` (router, session, cookie, data-schema), `@sdxc/validate`, `@sdxc/duration`, `@sdxc/user-agent`, `@sdxc/logger` |

No function in the package fails. Input it cannot use, such as a malformed `Referer`, a value
that normalizes to nothing or a cookie that does not match the schema, reads as absent, so the
API has no `Result` types and nothing throws.

### The touch

```ts
/** One arrival: where a visitor landed and what the request said about how they got there. */
export interface Touch {
	/** When the visit happened, as epoch milliseconds. */
	at: number;
	/** The pathname of the page they landed on, without its query string, capped at 256 characters. */
	landingPath: string;
	utm: Utm | null;
	click: Click | null;
	referrer: Referrer | null;
	channel: Channel;
}

/** The campaign parameters a link carried, each normalized to a short slug. */
export interface Utm {
	source?: string;
	medium?: string;
	campaign?: string;
	term?: string;
	content?: string;
	id?: string;
	sourcePlatform?: string;
	creativeFormat?: string;
	marketingTactic?: string;
}

/**
 * The ad network a click identifier names. `value` is present only under
 * `clickIds: "keep"`, since the identifier joins this visit to a profile the network holds.
 */
export interface Click {
	param: string;
	network: string;
	paid: boolean;
	value?: string;
}

/** The site a visitor followed a link from, reduced to its hostname. */
export interface Referrer {
	host: string;
	kind: "search" | "social" | "email" | "other";
}

/** The acquisition channel a touch is credited to, derived from its utm, click and referrer. */
export type Channel =
	| "direct"
	| "organic-search"
	| "paid-search"
	| "organic-social"
	| "paid-social"
	| "email"
	| "display"
	| "affiliate"
	| "referral"
	| "other";
```

Field names are camelCase and the query parameter names stay inside the package: `utm.sourcePlatform`
is read from `utm_source_platform` and written back as `utm_source_platform` by `toUtmParams`.

#### Reading a touch

```ts
import { readTouch } from "@sdxc/attribution";

let url = new URL(
	"https://example.com/pricing?utm_source=Newsletter&utm_medium=email&utm_campaign=Launch%20Week",
);

readTouch(url, { referrer: null });
// {
//   at: 1791273600000,
//   landingPath: "/pricing",
//   utm: { source: "newsletter", medium: "email", campaign: "launch-week" },
//   click: null,
//   referrer: null,
//   channel: "email",
// }

readTouch(new URL("https://example.com/?gclid=Cj0KCQ"), { referrer: "https://www.google.com/" });
// { …, click: { param: "gclid", network: "google-ads", paid: true }, referrer: { host: "google.com", kind: "search" }, channel: "paid-search" }

readTouch(new URL("https://example.com/docs"), { referrer: "https://example.com/" });
// { …, utm: null, click: null, referrer: null, channel: "direct" }: a same-host referrer is internal navigation
```

`readTouch(url, options)` takes:

| Option      | Default               | Meaning                                                                                                                                                         |
| ----------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `referrer`  | required              | The `Referer` header, or `null`                                                                                                                                 |
| `now`       | `Date.now()`          | The `at` stamp                                                                                                                                                  |
| `aliases`   | `{ source: ["ref"] }` | Extra parameters read for a `Utm` field when its `utm_*` parameter is absent, in order. `uptime` passes `{ source: ["ref", "source"], campaign: ["campaign"] }` |
| `clickIds`  | `"network"`           | `"keep"` stores the identifier's value, capped at 256 characters, for an app that uploads offline conversions                                                   |
| `referrers` | none                  | Extra `host → kind` entries merged over the built-in table                                                                                                      |

Normalization keeps every stored value disposable:

- A value is trimmed, lowercased, has whitespace runs replaced by `-`, keeps only `[a-z0-9._+-]`,
  and is cut at 64 characters. That is `uptime`'s rule, with spaces kept as separators so
  `Launch Week` reads as `launch-week` rather than `launchweek`.
- A value containing `@` or `://` is dropped whole before normalization. An address or a URL in
  a campaign field is a merge tag that went wrong, and its slug would still identify someone.
- A value that normalizes to an empty string is absent.
- The referrer keeps only its hostname, with a leading `www.` removed. Browsers send only the
  origin cross-site under the default `strict-origin-when-cross-origin` policy, so this is the
  same information the header usually carries.
- Email-platform parameters that encode the subscriber (`mc_eid`, `_hsenc`, `_hsmi`,
  `vero_id`, `oly_enc_id` and the rest) are never read into a touch. They count as tracking
  parameters for stripping, and their presence sets the channel to `email` when nothing else
  does.

#### Channels

A touch's channel is the first rule below that matches:

| Rule                                                                                                 | Channel          |
| ---------------------------------------------------------------------------------------------------- | ---------------- |
| `utm.medium` in `cpc`, `ppc`, `paid-search`, `paidsearch`, or a paid click from a search network     | `paid-search`    |
| `utm.medium` in `paid-social`, `paidsocial`, `social-paid`, or a paid click from a social network    | `paid-social`    |
| `utm.medium` in `display`, `banner`, `cpm`, or a `dclid`                                             | `display`        |
| `utm.medium` in `email`, `e-mail`, `newsletter`, an email-platform parameter, or an `email` referrer | `email`          |
| `utm.medium` is `affiliate`                                                                          | `affiliate`      |
| `utm.medium` in `social`, `social-network`, `sm`, an unpaid social click, or a `social` referrer     | `organic-social` |
| `utm.medium` is `organic`, or a `search` referrer                                                    | `organic-search` |
| `utm.medium` is `referral`, or an `other` referrer                                                   | `referral`       |
| Any other `utm` value                                                                                | `other`          |
| Nothing                                                                                              | `direct`         |

`fbclid` and `igshid` are unpaid: Meta appends `fbclid` to every outbound click, paid or not,
so on its own it credits `organic-social`, and `utm_medium=paid-social` beside it credits
`paid-social`.

### Tracking parameters

```ts
import { isTrackingParameter, withoutTracking } from "@sdxc/attribution/parameters";

withoutTracking(new URL("https://example.com/post?p=123&utm_source=x&fbclid=abc"));
// URL { "https://example.com/post?p=123" }

isTrackingParameter("UTM_Campaign"); // true, names are case-folded
isTrackingParameter("p"); // false
```

- `CAMPAIGN_PARAMETERS` is the nine `utm_*` names the `Utm` fields are read from.
  `withoutTracking` removes every `utm_`-prefixed name, which also covers non-standard ones
  such as `utm_referral`.
- `CLICK_IDENTIFIERS` maps each identifier to its network and whether it marks a paid click:
  `gclid`, `gbraid`, `wbraid`, `dclid`, `msclkid`, `fbclid`, `igshid`, `ttclid`, `li_fat_id`,
  `twclid`, `rdt_cid`, `epik`, `sccid`, `yclid`, and the email-platform parameters `mc_cid`,
  `mc_eid`, `_hsenc`, `_hsmi`, `vero_conv`, `vero_id`, `oly_anon_id`, `oly_enc_id`. That is
  `reader`'s list plus `sccid`.
- `withoutTracking` removes only those names and returns a new `URL`, leaving every other
  parameter in the order and encoding the publisher wrote, which is `reader`'s current contract.
- Whether to strip is the caller's policy. `reader` keeps its per-feed `keep_link_parameters`
  switch and calls `withoutTracking` only when it is off.

### The middleware

```ts
import { attribution } from "@sdxc/attribution/middleware";

/** Session-backed: the app already runs a session for anonymous visitors. */
let router = createRouter({
	middleware: [session, attribution({ store: "session" })],
});
```

```ts
import { attribution } from "@sdxc/attribution/middleware";
import { createCookie } from "remix/cookie";

/** Cookie-backed, for an app with no session. Signed so a visitor cannot forge a campaign. */
export const ATTRIBUTION_COOKIE = createCookie("attribution", {
	path: "/",
	maxAge: 60 * 60 * 24 * 90,
	httpOnly: true,
	sameSite: "Lax",
	secure: true,
	secrets: [env.COOKIE_SECRET],
});

let router = createRouter({
	middleware: [attribution({ store: ATTRIBUTION_COOKIE })],
});
```

```ts
interface AttributionOptions extends ReadTouchOptions {
	/** `"session"` reads `Session` from `remix/session`'s context; a `Cookie` is read and written directly. */
	store: "session" | Cookie;
	/**
	 * How long a first touch stands. A visit after this window replaces it, so a visitor who
	 * returns a year later from a new campaign is credited to that campaign.
	 *
	 * @default "90 days"
	 */
	window?: DurationInput;
	/**
	 * Whether this visitor allows attribution to be stored. Without it, the request still
	 * reads its own touch as `current`, and nothing is read from or written to the store.
	 *
	 * @default (ctx) => ctx.request.headers.get("sec-gpc") !== "1"
	 */
	consent?: (ctx: RequestContext) => boolean;
	/**
	 * Answers a page request that carries tracking parameters with a `302` to the same URL
	 * without them, once the touch is stored.
	 *
	 * @default false
	 */
	redirect?: boolean;
}
```

The middleware publishes:

```ts
/** What the current request knows about how this visitor arrived. */
export interface Attribution {
	/** This request's own touch, `null` when the request is not a page navigation. */
	current: Touch | null;
	/** The earliest touch within the window. */
	first: Touch | null;
	/** The most recent touch that carried a campaign, a click identifier or an external referrer. */
	last: Touch | null;
}

declare module "remix/router" {
	interface RequestContext {
		attribution: Attribution;
	}
}

export const CurrentAttribution: { defaultValue: Attribution } = createContextKey<Attribution>({
	current: null,
	first: null,
	last: null,
});
```

On every request it:

1. Reads the stored record and validates it with a `remix/data-schema` schema through
   `@sdxc/validate`, since a cookie is untrusted input. A record that does not match reads as
   no record.
2. Publishes the stored record and stops when the request is not a page navigation: a method
   other than `GET`, a `Sec-Fetch-Dest` other than `document`, or, without that header, an
   `Accept` that lacks `text/html`. This is the check `uptime` wraps its middleware in
   `htmlOnly` for today. A `HEAD` request renders nothing a visitor sees and is almost always
   a monitor's probe, so it records nothing.
3. Publishes the stored record and skips to step 7 when `isBot` from `@sdxc/user-agent` matches
   the `User-Agent`.
4. Reads `current` with `readTouch`.
5. When `consent` answers `false`, publishes `{ current, first: null, last: null }`, removes
   any stored record (expires the cookie or unsets the session key), and skips to step 7.
6. Sets `first` when there is none or it is older than `window`, and sets `last` when `current`
   is anything but `direct`. A first visit sets both. A direct revisit changes neither, so a
   bookmark or a typed URL never takes the credit from the campaign that brought the visitor.
   Writes the record when it changed, and records `attribution: { channel, source, campaign }`
   on `currentLog()`.
7. With `redirect: true` and tracking parameters on the URL, answers
   `302 Location: withoutTracking(url)` with `Cache-Control: no-store` instead of calling
   `next()`. Otherwise calls `next()`.

Storage details:

- **Session.** The record lives under one session key (`attribution`), with `remix/session`'s
  middleware committing it. An app on `@sdxc/session-storage-kv` pays one KV write per visitor
  who arrives with a new non-direct touch, and none for bots or for consecutive page views.
- **Cookie.** The record is the cookie's value, around 400 bytes for two full touches, well
  inside the 4 KB limit. A response that sets the cookie also gets `Cache-Control: private`
  so a shared cache never stores one visitor's `Set-Cookie` for the next. The cookie's
  `maxAge` is the app's to set; the README recommends matching `window`.

### Carrying attribution forward

A form posting to the same origin sends the cookie or the session with it, so its action reads
`ctx.attribution` directly; the page renders no hidden fields and stays identical for every
visitor. Two helpers flatten a touch for the places it leaves the app:

```ts
import { toMetadata, toUtmParams } from "@sdxc/attribution";

let checkout = await ctx.billing.checkouts.create({
	product,
	email: customerEmail,
	metadata: toMetadata(ctx.attribution),
});
// metadata: {
//   first_channel: "email", first_source: "newsletter", first_medium: "email",
//   first_campaign: "launch-week", first_landing: "/pricing", first_at: "2026-10-01T09:12:44.000Z",
//   last_channel: "paid-search", last_click: "google-ads", last_landing: "/", last_at: "2026-10-05T18:02:10.000Z",
// }

await buttondown.subscribe(email, toUtmParams(ctx.attribution.last ?? ctx.attribution.first), ip);
// { utm_source: "newsletter", utm_medium: "email", utm_campaign: "launch-week" }
```

- `toMetadata(attribution)` emits snake_case keys prefixed `first_` and `last_`, only for fields
  that are present: `channel`, `landing`, `at`, `referrer`, `click` and the nine UTM fields.
  Two full touches produce at most 28 keys, inside the 50 keys Polar and
  Stripe accept, and every value is under 300 characters, inside their 500-character limit.
  `click` names the network, or, under `clickIds: "keep"`, is written `param=value`, which is
  what an offline-conversion upload needs. The keys come back on the order and subscription webhooks, which is
  how a billing webhook joins a payment to its campaign without a database row.
- `toUtmParams(touch)` emits the `utm_*` wire names for a provider that stores them, such as
  Buttondown. A `null` touch answers `{}`.

### Clean URLs, canonical URLs and SEO

A campaign URL can be cleaned in two places, and the package uses both for different purposes:

- **`rel="canonical"` is the SEO answer.** `@sdxc/seo`'s `canonicalUrl` removes tracking
  parameters through `@sdxc/attribution/parameters` before it builds the canonical URL, so
  every page reached from a campaign link names its clean URL as canonical. Search engines
  consolidate on it, the campaign link keeps working, and no extra round trip is made. This
  applies to every app that renders `<Seo>`, with no app change.
- **The redirect is URL hygiene, and opt-in.** `redirect: true` makes the address bar, a
  bookmark and a shared copy of the URL clean. It is a `302` with `Cache-Control: no-store`,
  because a browser caches a `301` and would skip the server, and with it the capture, on the
  next click of the same link. It is off by default because it adds a round trip to the one
  page view a campaign paid for, and because a client-side analytics script that reads `utm_*`
  from `location` sees a clean URL. An app with no client-side analytics and a session or
  cookie store can turn it on.

### Privacy

- **No storage without consent.** `consent` defaults to honoring Global Privacy Control
  (`Sec-GPC: 1`). An app serving visitors under the ePrivacy Directive passes its own function
  that reads its consent cookie. `current` is always available, since reading the URL of the
  request being served stores nothing.
- **No personal data.** Values are short slugs, anything address- or URL-shaped is dropped,
  the referrer is a hostname, subscriber-identifying email parameters are stripped and never
  read, and click identifier values are kept only on request.
- **Bounded lifetime.** `window` bounds a first touch, and the cookie's `maxAge` bounds the
  whole record.
- **Bot filtering.** `@sdxc/user-agent` gains `isBot(header)`, matching crawler, preview and
  monitoring tokens (`bot`, `crawler`, `spider`, `facebookexternalhit`, `Slackbot`,
  `WhatsApp`, `Headless`, an empty header and the like). Link-preview fetchers are the main
  source of campaign-URL hits that are not visitors, and they keep no cookies, so skipping them
  saves storage writes and keeps them out of `ctx.attribution`.

## Usage Examples

### `uptime`

`app/http/middleware/attribution.ts` is deleted, and the bootstrap installs the package after
the session middleware:

```ts
attribution({ store: "session", aliases: { source: ["ref", "source"], campaign: ["campaign"] } }),
```

The `htmlOnly` wrapper goes, since the middleware checks for a page navigation itself. The
sign-in reads the first touch from the context instead of a session key:

```ts
await convertTrialWatches(ctx.db, {
	email: idToken.email ?? "",
	teamId: team.id,
	authorId: idToken.subject,
	attribution: signupAttribution(ctx.attribution.first),
});
```

```ts
/**
 * The three columns a conversion row stores, from the first touch. A missing touch stays
 * `undefined`, which the row records as unknown rather than as direct.
 */
function signupAttribution(touch: Touch | null): TrialSignupAttribution | undefined {
	if (!touch) return undefined;
	return {
		landingPath: touch.landingPath,
		source: touch.utm?.source ?? null,
		campaign: touch.utm?.campaign ?? null,
	};
}
```

`TRIAL_ATTRIBUTION` and `TrialAttribution` are removed, and `FunnelAttributionInput` is written
in terms of `Touch`. The conversion row keeps its three columns; adding `channel` is a separate
migration the funnel report can ask for later.

### `books`

The app has no session, so it uses a signed cookie:

```ts
attribution({ store: ATTRIBUTION_COOKIE }),
```

- `app/lib/attribution.ts` is deleted, and the four `attribution={readAttribution(…)}` props in
  `home`, `sample`, `upgrade` and `release` go with it.
- `SubscribeForm` drops its four hidden inputs, and `SubscribeSchema` drops `source`,
  `campaign`, `medium` and `referral`.
- The `subscribe` service takes the touch, and `Buttondown.subscribe` takes `toUtmParams(…)`
  in place of `SubscribeAttribution`.
- `checkout.ts` and `upgrade.tsx` pass `metadata: toMetadata(ctx.attribution)`.

### `reader`

`app/lib/tracking-parameters.ts` and its test are deleted; the test cases move into the
package. `timeline-entries.ts` keeps its per-feed rule:

```ts
import { withoutTracking } from "@sdxc/attribution/parameters";

return (keepParameters ? url : withoutTracking(url)).toString();
```

### `@sdxc/seo`

```ts
export function canonicalUrl(baseUrl: string, url: string | URL): string {
	let { pathname, search } = withoutTracking(new URL(url, baseUrl));
	let canonical = new URL(`${pathname}${search}`, baseUrl).toString();
	if (canonical !== `${baseUrl}/` && canonical.endsWith("/")) return canonical.slice(0, -1);
	return canonical;
}
```

## Consequences

### Positive

- **Attribution survives navigation.** `books` credits a subscriber who browsed before
  subscribing, which hidden fields on the landing page could not.
- **Checkouts carry their campaign.** Every Polar order from `books` and `uptime` names its
  first and last touch, and the webhook reads it back from `metadata`.
- **One normalization.** Both apps store the same slugs, with addresses and URLs dropped
  rather than slugged into something that still identifies a person.
- **Clean canonicals everywhere.** Every app rendering `<Seo>` stops advertising campaign URLs
  as canonical.
- **Fewer anonymous session writes.** Bots and direct revisits write nothing.
- **One tracking-parameter list.** A new click identifier is added once and reaches stripping,
  capture and canonicals.

### Negative

- **In-flight `uptime` sessions lose their first touch.** Records under `trialAttribution`
  are not read after the deploy, so visitors mid-trial at that moment sign in unattributed,
  which the conversion row records as unknown.
- **GPC visitors are unattributed.** A visitor sending `Sec-GPC: 1` from a campaign link
  subscribes or buys without attribution, where `books` forwards the page's UTM today.
- **`books` sets a cookie.** Its pages were cookieless; a campaign landing now answers with a
  `Set-Cookie` and `Cache-Control: private`.
- **Lowercasing loses case.** `Launch` and `launch` become one campaign, which is the intent,
  and a report that relied on case can no longer tell them apart.
- **The referrer and channel tables need upkeep.** A new search engine or social network reads
  as `referral` until it is added.

### Neutral

- **Hidden fields remain possible.** An app whose form posts cross-origin renders
  `toUtmParams(ctx.attribution.last)` into its own inputs; the package ships no component for
  it.
- **The channel rules are a simplification of GA4's default channel group.** They agree on the
  common cases and are not meant to reproduce an analytics product's report.

## Implementation Plan

### Phase 1: Bot detection in `@sdxc/user-agent`

**Priority:** High
**Estimated Effort:** 1 hour

1. Add `isBot(header: string): boolean` to the root export, with tests for the major crawlers,
   link-preview fetchers, headless browsers and an empty header.
2. Document it in the package README.

### Phase 2: The package

**Priority:** High
**Estimated Effort:** 5 hours

1. Create `packages/attribution`, public, with the three subpath exports.
2. Move `reader`'s tracking-parameter tests and `uptime`'s normalization tests in, and add tests
   for address- and URL-shaped values, each channel rule, the internal-referrer case, the
   first-touch window, direct revisits leaving `last` alone, GPC clearing a stored record, a
   forged or malformed cookie, bot requests, non-navigation requests, `toMetadata`'s key count,
   and the redirect's status and headers.
3. Write the README, including the consent default and the reasons the redirect is opt-in.

Depends on Phase 1.

### Phase 3: `@sdxc/seo`

**Priority:** High
**Estimated Effort:** 30 minutes

1. `canonicalUrl` removes tracking parameters, with a test for a campaign URL.

### Phase 4: `reader`

**Priority:** Medium
**Estimated Effort:** 30 minutes

1. Replace `app/lib/tracking-parameters.ts` with `@sdxc/attribution/parameters`.

### Phase 5: `uptime`

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Replace the middleware, the session key and `TrialAttribution`; update `auth.tsx` and
   `funnel-events.ts`; move the middleware's Workers test cases that are not already covered
   by the package into a test of the sign-in.
2. Pass `toMetadata(ctx.attribution)` on the checkout `app/data/customer.ts` opens.
3. Build and deploy; no migration.

### Phase 6: `books`

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Add the cookie and the middleware, remove `readAttribution`, the hidden inputs and the
   schema fields, and switch the subscribe service and Buttondown client to touches.
2. Add `metadata` to both checkouts.
3. Build and deploy; no migration.

## Alternatives Considered

### 1. Hidden form fields as the carrier

Generalize `books`' approach: a component that renders the current page's UTM into hidden
inputs, and a schema that reads them back.

**Rejected because**: the attribution is lost as soon as the visitor leaves the landing page,
it reaches only forms and never a `GET` checkout link, every page varies per visitor, and the
values arrive as form input that has to be normalized again. The session or cookie carries the
same data to every same-origin request.

### 2. Client-side capture

A script reads `location.search` and `document.referrer` into `localStorage` and adds them to
forms on submit.

**Rejected because**: the server cannot read `localStorage`, so checkouts and server-rendered
actions would still need hidden fields; it needs JavaScript on pages that work without it; and
it reads the referrer after the page's own navigation has replaced it on some flows.

### 3. A server-side visitor table

Store touches in D1 or KV keyed by an anonymous visitor id in a cookie.

**Rejected because**: it adds a write per visit, a retention job and a table of anonymous
browsing records, for data that is read at most twice (at sign-up and at checkout) and fits in
a cookie.

### 4. Redirect to the clean URL by default

**Rejected because**: it costs a round trip on the page view a campaign paid for, hides the
parameters from client-side analytics, and is not needed for SEO once the canonical URL is
clean. It stays available as `redirect: true`.

### 5. Put the tracking-parameter list in `@sdxc/outbound`

`outbound` already handles URLs the app fetches.

**Rejected because**: `outbound` is about fetching safely, while stripping applies to links an
app renders and URLs it advertises, and `@sdxc/seo` would depend on a fetch package. The list
belongs with the code that reads the same parameters.

### 6. Keep values verbatim

Store `utm_*` values as sent, as `books` does today.

**Rejected because**: campaign values are typed by whoever builds the link, merge tags put
addresses into them, and the stored record outlives the visit (on `uptime`'s conversion row,
on a Polar order and in Buttondown). Short slugs keep all of those safe to retain.

## References

- [Google Analytics: URL builders and campaign parameters](https://support.google.com/analytics/answer/10917952)
- [Google Analytics: default channel group](https://support.google.com/analytics/answer/9756891)
- [Global Privacy Control specification](https://privacycg.github.io/gpc-spec/)
- [MDN: Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy)
- [MDN: Sec-Fetch-Dest](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-Fetch-Dest)
- [Polar API reference](https://docs.polar.sh/api-reference)
- [ADR-025: SEO Metadata and Structured Data Package](./ADR-025-seo-metadata-and-structured-data-package.md)
- [ADR-027: Duration Package](./ADR-027-duration-package.md)
- [ADR-033: Wide Events as the Logging Contract](./ADR-033-wide-events-as-the-logging-contract.md)
- [ADR-043: Billing Package with Pluggable Providers](./ADR-043-billing-package-with-pluggable-providers.md)
- [ADR-057: Request Context Instead of a Service Container](./ADR-057-request-context-instead-of-a-service-container.md)
- [ADR-075: User Agent Parsing Package](./ADR-075-user-agent-parsing-package.md)
- [ADR-108: Outbound Package](./ADR-108-outbound-package.md)

## Current Progress

- [x] Phase 1: Bot detection in `@sdxc/user-agent`
- [x] Phase 2: The package
- [x] Phase 3: `@sdxc/seo`
- [x] Phase 4: `reader`
- [x] Phase 5: `uptime`
- [x] Phase 6: `books`

## Notes

- `@sdxc/seo` and `@sdxc/user-agent` are public, so `@sdxc/attribution` is public from its
  first commit.
- Safari's Link Tracking Protection removes some click identifiers in Private Browsing, Mail
  and Messages. `utm_*` parameters survive it, so a touch from those contexts still credits its
  campaign, without the `click`.
- Building campaign links for an app's own emails (adding `utm_*` to outbound URLs) is out of
  scope; `toUtmParams` produces the parameters if an app wants to append them.
- The redirect runs for bots too, since it concerns the URL rather than the visitor; only the
  capture skips them.
