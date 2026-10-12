# @sdxc/attribution

Campaign parameters, click identifiers and referrers, kept as a visitor's first and last touch.

## Installation

```sh
npm add @sdxc/attribution
```

The middleware runs on a [`remix`](https://www.npmjs.com/package/remix) router and keeps its record in a `remix/cookie` cookie or in the session from `remix/middleware/session`.

## Usage

### Read a touch off a URL

```typescript
import { readTouch } from "@sdxc/attribution";

let touch = readTouch(
	new URL(
		"https://example.com/pricing?utm_source=Newsletter&utm_medium=email&utm_campaign=Launch%20Week",
	),
	{ referrer: null },
);
// {
//   at: 1791273600000,
//   landingPath: "/pricing",
//   utm: { source: "newsletter", medium: "email", campaign: "launch-week" },
//   click: null,
//   referrer: null,
//   channel: "email",
// }
```

Every campaign value becomes a short slug, and the `channel` is derived from the medium, the click identifier and the referrer.

### Keep the first and last touch for every visitor

```typescript
import { attribution } from "@sdxc/attribution/middleware";
import { createCookie } from "remix/cookie";
import { createRouter } from "remix/router";

let cookie = createCookie("attribution", {
	path: "/",
	maxAge: 60 * 60 * 24 * 90,
	httpOnly: true,
	sameSite: "Lax",
	secure: true,
	secrets: [secret],
});

let router = createRouter({ middleware: [attribution({ store: cookie })] });

router.post("/subscribe", (ctx) => {
	let { current, first, last } = ctx.attribution;
	// first: the earliest touch in the last 90 days; last: the latest one that was not direct
});
```

The middleware records a touch on page navigations only, so the form post above reads what the visitor's earlier page views stored. Sign the cookie so a visitor cannot forge a campaign.

### Strip tracking parameters from a link

```typescript
import { withoutTracking } from "@sdxc/attribution/parameters";

withoutTracking(new URL("https://example.com/post?p=123&utm_source=x&fbclid=abc")).toString();
// "https://example.com/post?p=123"
```

## API

### `readTouch(url: URL, options: ReadTouchOptions): Touch`

The touch a request describes. Input it cannot use reads as absent, so it always answers a touch.

- `options.referrer`: the `Referer` header, or `null`. A referrer on the URL's own host is internal navigation and reads as none.
- `options.now`: the `at` stamp in epoch milliseconds. Defaults to `Date.now()`.
- `options.aliases`: extra parameters read for a `Utm` field when its `utm_*` parameter is absent, in order. Defaults to `{ source: ["ref"] }`.
- `options.clickIds`: `"keep"` also stores the click identifier's value, up to 256 characters, for offline-conversion uploads. Defaults to `"network"`, which stores only the network's name.
- `options.referrers`: extra `host → kind` entries merged over the built-in table.

Email-platform parameters such as `mc_eid` and `_hsenc` identify the subscriber, so their values are never read; their presence credits the touch to `email`. The channel comes from the first rule that matches:

| Rule                                                                                                  | Channel          |
| ----------------------------------------------------------------------------------------------------- | ---------------- |
| `utm_medium` is `cpc`, `ppc`, `paid-search` or `paidsearch`, or a paid search click                   | `paid-search`    |
| `utm_medium` is `paid-social`, `paidsocial` or `social-paid`, or a paid social click                  | `paid-social`    |
| `utm_medium` is `display`, `banner` or `cpm`, or a `dclid`                                            | `display`        |
| `utm_medium` is `email`, `e-mail` or `newsletter`, an email-platform parameter, or a webmail referrer | `email`          |
| `utm_medium` is `affiliate`                                                                           | `affiliate`      |
| `utm_medium` is `social`, `social-network` or `sm`, an unpaid social click, or a social referrer      | `organic-social` |
| `utm_medium` is `organic`, or a search engine referrer                                                | `organic-search` |
| `utm_medium` is `referral`, or any other external referrer                                            | `referral`       |
| Any other campaign parameter                                                                          | `other`          |
| Nothing                                                                                               | `direct`         |

`fbclid` and `igshid` count as unpaid social clicks, since Meta adds them to every outbound link.

### `normalizeValue(raw: string): string | undefined`

The slug rule every campaign value goes through: trimmed, lowercased, whitespace runs joined by `-`, only `[a-z0-9._+-]` kept, cut at 64 characters. A value holding `@` or `://` (an address or URL a merge tag inserted) or one that normalizes to nothing answers `undefined`.

```typescript
normalizeValue("Launch Week"); // "launch-week"
normalizeValue("jane@example.com"); // undefined
```

### `classifyReferrer(header: string | null, options?: ClassifyReferrerOptions): Referrer | null`

The external site a `Referer` names, as its hostname without `www.` and its kind (`search`, `social`, `email` or `other`). Answers `null` for an absent, malformed or non-`http(s)` header, or one on `options.host`. `options.referrers` adds or overrides `host → kind` entries; a host matches its nearest listed parent domain, so `mail.google.com` is `email` and `google.com` is `search`.

### `toMetadata(attribution: Pick<Attribution, "first" | "last">): Record<string, string>`

The first and last touch as flat keys prefixed `first_` and `last_`: `channel`, `landing`, `at` (ISO 8601), and when present `referrer`, `click` and each UTM field (`first_source`, `last_campaign`, …). At most 28 keys of under 300 characters, which fits Stripe's and Polar's metadata limits. A kept click identifier is written `param=value`.

### `toUtmParams(touch: Touch | null): Record<string, string>`

The touch's campaign fields under their `utm_*` names; `{}` for a `null` touch or one without campaign fields.

### `toCampaign(touch: Touch | null, url: URL | string): Campaign | undefined`

The touch as flat fields: `source`, `medium`, `campaign`, `term` and `content`, `referrer` as the referring hostname, and `landingPage` as the landing path resolved against `url`. Missing fields are left out, so the result spreads into another object; a `null` touch answers `undefined`.

### `attribution(options: AttributionOptions): Middleware`

From `@sdxc/attribution/middleware`. Publishes `ctx.attribution` on every request and updates the stored record on a page navigation (a `GET` with `Sec-Fetch-Dest: document`, or an `Accept` naming `text/html`). The first touch is replaced when there is none or it is older than `window`; the last touch is replaced by every touch that is not `direct`. Bots ([`isBot`](https://www.npmjs.com/package/@sdxc/user-agent)) store nothing, and a stored record that fails validation counts as none.

- `options.store`: `"session"` keeps the record under the session's `attribution` key, so install it after `remix/middleware/session`. A `Cookie` keeps the record as its value (about 400 bytes); responses that set it get `Cache-Control: private`.
- `options.window`: how long a first touch stands, as a [`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) input. Defaults to `"90 days"`.
- `options.consent`: `(ctx) => boolean`. When it answers `false`, `current` is still published, any stored record is removed and nothing is written. Defaults to honoring [Global Privacy Control](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/globalPrivacyControl) (`Sec-GPC: 1`).
- `options.redirect`: answers a page navigation carrying tracking parameters with a `302` to the same URL without them, after the touch is stored. Defaults to `false`.
- `options.aliases`, `options.clickIds`, `options.referrers`: as for `readTouch`.

### `CurrentAttribution`

From `@sdxc/attribution/middleware`. The context key behind `ctx.attribution`, for code that reads `ctx.get(CurrentAttribution)`; its default holds three `null`s.

### `CAMPAIGN_PARAMETERS`, `CLICK_IDENTIFIERS`

From `@sdxc/attribution/parameters`. `CAMPAIGN_PARAMETERS` maps each `Utm` field to its `utm_*` name. `CLICK_IDENTIFIERS` maps each lowercase parameter name to a `ClickIdentifier`: ad networks (`gclid`, `gbraid`, `wbraid`, `dclid`, `msclkid`, `yclid`, `fbclid`, `igshid`, `ttclid`, `li_fat_id`, `twclid`, `rdt_cid`, `epik`, `sccid`) and email platforms (`mc_cid`, `mc_eid`, `_hsenc`, `_hsmi`, `vero_conv`, `vero_id`, `oly_anon_id`, `oly_enc_id`).

### `isTrackingParameter(name: string): boolean`

From `@sdxc/attribution/parameters`. Whether a query parameter is campaign metadata: any `utm_`-prefixed name or a listed identifier, compared case-insensitively.

### `withoutTracking(url: URL): URL`

From `@sdxc/attribution/parameters`. A copy of the URL without tracking parameters; every other parameter keeps the order and encoding it had.

### Types

- `Touch`: one arrival — `at` (epoch ms), `landingPath` (up to 256 characters, no query string), `utm`, `click`, `referrer` and `channel`.
- `Utm`: the nine campaign fields in camelCase — `source`, `medium`, `campaign`, `term`, `content`, `id`, `sourcePlatform`, `creativeFormat` and `marketingTactic`.
- `Click`: `param`, `network`, `paid`, and `value` under `clickIds: "keep"`.
- `Referrer`, `ReferrerKind`: the referring `host` and its `kind`.
- `Channel`: the ten channels in the table above.
- `Attribution`: `current` (this request's touch, `null` off a page navigation), `first` and `last`.
- `ReadTouchOptions`, `ClassifyReferrerOptions`: the options above.
- `AttributionOptions` from `./middleware`; `ClickIdentifier` (`network`, `paid`, `kind`) from `./parameters`.

## Pattern: Carry the campaign into a checkout

A form posting to the same origin sends the attribution cookie along, so the action reads `ctx.attribution` and the page needs no hidden fields. The billing provider returns the metadata on its orders and webhooks.

```typescript
import { toMetadata } from "@sdxc/attribution";
import { attribution } from "@sdxc/attribution/middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [attribution({ store: cookie })] });

router.post("/checkout", async (ctx) => {
	let checkout = await billing.checkouts.create({
		product,
		metadata: toMetadata(ctx.attribution),
		// { first_channel: "email", first_landing: "/pricing", first_at: "…", first_source: "newsletter", last_channel: … }
	});
	return Response.redirect(checkout.url, 303);
});
```

## Pattern: Hand campaign fields to a newsletter or CRM

Credit a sign-up to the latest campaign, falling back to the first. `toUtmParams` suits a provider that stores `utm_*` names; `toCampaign` suits one with plain fields and an absolute landing page.

```typescript
import { toCampaign, toUtmParams } from "@sdxc/attribution";

router.post("/subscribe", async (ctx) => {
	let form = await ctx.request.formData();
	let touch = ctx.attribution.last ?? ctx.attribution.first;

	await newsletter.subscribe(String(form.get("email")), { ...toUtmParams(touch) });
	// { utm_source: "newsletter", utm_medium: "email", utm_campaign: "launch-week" }

	await crm.createLead({ email: String(form.get("email")), ...toCampaign(touch, ctx.url) });
	// { source: "newsletter", medium: "email", campaign: "launch-week", landingPage: "https://example.com/pricing" }

	return new Response(null, { status: 204 });
});
```

## Pattern: Store the record in the session

An app that already runs a session keeps the record there; the session middleware commits it, so it goes first.

```typescript
import { attribution } from "@sdxc/attribution/middleware";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createCookieSessionStorage } from "remix/session-storage/cookie";

let sessionCookie = createCookie("__session", { secrets: [secret] });

let router = createRouter({
	middleware: [
		session(sessionCookie, createCookieSessionStorage()),
		attribution({ store: "session", window: "30 days" }),
	],
});
```

## Pattern: Ask for consent before storing

Global Privacy Control is honored by default. A site that collects consent itself passes a function reading its own consent cookie; without consent the request still sees its `current` touch, and any stored record is cleared.

```typescript
import { attribution } from "@sdxc/attribution/middleware";

attribution({
	store: cookie,
	consent: (ctx) =>
		ctx.request.headers.get("sec-gpc") !== "1" &&
		/(?:^|;\s*)consent=analytics/.test(ctx.request.headers.get("cookie") ?? ""),
});
```

## Pattern: Keep tracking parameters out of shared URLs

`redirect: true` stores the touch, then sends the visitor to the clean URL so the address they copy and share carries no campaign. Without the redirect, a canonical link built with `withoutTracking` keeps search engines on the clean URL.

```typescript
import { attribution } from "@sdxc/attribution/middleware";
import { withoutTracking } from "@sdxc/attribution/parameters";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [attribution({ store: cookie, redirect: true })] });

function canonicalHref(url: URL) {
	return withoutTracking(url).href; // for <link rel="canonical" href={canonicalHref(ctx.url)} />
}
```

The redirect costs one round trip on the landing page view, and client-side analytics reading `utm_*` from `location` see the clean URL.

## Pattern: Offline conversions and custom sources

Keep click identifiers to upload conversions to the ad network later, read a site's own `?via=` links as the source, and classify referrers the built-in table does not know.

```typescript
import { attribution } from "@sdxc/attribution/middleware";

attribution({
	store: cookie,
	clickIds: "keep",
	aliases: { source: ["via", "ref"], campaign: ["promo"] },
	referrers: { "news.example.org": "social", "mail.example.com": "email" },
});

// later, a touch from ?gclid=abc123 carries click: { param: "gclid", network: "google-ads", paid: true, value: "abc123" }
// and toMetadata writes it as first_click: "gclid=abc123"
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/attribution": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
