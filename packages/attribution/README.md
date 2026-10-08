# @sdxc/attribution

Campaign parameters, click identifiers and referrers, kept as a visitor's first and last touch.

## Installation

```sh
npm add @sdxc/attribution
```

The middleware runs on a `remix` router and reads its session from `remix/session`'s middleware or keeps its record in a `remix/cookie` cookie.

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
	let { first, last } = ctx.attribution;
	// …
});
```

With a session middleware already installed, pass `store: "session"` and install `attribution()` after it.

### Strip tracking parameters from a link

```typescript
import { withoutTracking } from "@sdxc/attribution/parameters";

withoutTracking(new URL("https://example.com/post?p=123&utm_source=x&fbclid=abc")).toString();
// "https://example.com/post?p=123"
```

## API

### `readTouch(url: URL, options: ReadTouchOptions): Touch`

The touch a request describes. Never throws: input it cannot use reads as absent.

- `options.referrer`: the `Referer` header, or `null`.
- `options.now`: the `at` stamp in epoch milliseconds. Defaults to `Date.now()`.
- `options.aliases`: extra parameters read for a `Utm` field when its `utm_*` parameter is absent, in order. Defaults to `{ source: ["ref"] }`.
- `options.clickIds`: `"keep"` stores the click identifier's value, up to 256 characters, for an app that uploads offline conversions. Defaults to `"network"`, which keeps only the network's name.
- `options.referrers`: extra `host → kind` entries merged over the built-in table.

Every stored value is a disposable slug. A campaign value is trimmed, lowercased, has runs of whitespace turned into `-`, keeps only `[a-z0-9._+-]` and is cut at 64 characters. A value that holds `@` or `://` is an address or URL a merge tag put there, so it is dropped whole. The referrer keeps only its hostname without `www.`, and a referrer on the page's own host counts as internal navigation. Email-platform parameters that identify the subscriber, such as `mc_eid` and `_hsenc`, are never read into a touch. When they are present, they credit the touch to `email`.

A touch's `channel` comes from the first rule that matches:

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

`fbclid` and `igshid` count as unpaid. Meta adds them to every outbound click, paid or not.

### `normalizeValue(raw: string): string | undefined`

The slug rule above, applied to one value.

### `classifyReferrer(header: string | null, options?: ClassifyReferrerOptions): Referrer | null`

Returns the external site a `Referer` names, with its kind: `search`, `social`, `email` or `other`. It returns `null` when the header is absent, malformed, not `http(s)`, or on `options.host`. `options.referrers` adds or overrides `host → kind` entries.

### `toMetadata(attribution): Record<string, string>`

The first and last touch as snake_case keys prefixed `first_` and `last_`. Only the fields that are present are included: `channel`, `landing`, `at` (ISO 8601), `referrer`, `click` and the UTM fields. Two full touches give at most 28 keys, each under 300 characters, which fits the metadata limits of Polar and Stripe. Billing providers send the metadata back on orders and webhooks.

### `toUtmParams(touch: Touch | null): Record<string, string>`

The touch's campaign fields under their `utm_*` names, for a provider that stores them. A `null` touch gives `{}`.

### `toCampaign(touch: Touch | null, url: URL | string): Campaign | undefined`

The touch as flat campaign fields: `source`, `medium`, `campaign`, `term` and `content` from its UTM values, `referrer` as the referring hostname, and `landingPage` as the landing path resolved against `url` into an absolute URL. Fields the touch lacks are left out, so the result spreads into another object, and a `null` touch gives `undefined`.

```typescript
import { toCampaign } from "@sdxc/attribution";

toCampaign(ctx.attribution.last ?? ctx.attribution.first, ctx.url);
// { source: "newsletter", medium: "email", campaign: "launch-week", landingPage: "https://example.com/pricing" }
```

### `attribution(options: AttributionOptions): Middleware`

From `@sdxc/attribution/middleware`. Publishes `ctx.attribution` on every request. Writes happen only on a page navigation: a `GET` with `Sec-Fetch-Dest: document`, or, from a browser that omits that header, an `Accept` that includes `text/html`. The first touch is set when there is none or the stored one is older than `window`. The last touch is set whenever the current one is not `direct`. A direct revisit, a bot (`isBot` from [@sdxc/user-agent](https://www.npmjs.com/package/@sdxc/user-agent)), a form submission and a `fetch` write nothing. A stored record that fails validation, such as a forged cookie, counts as no record.

- `options.store`: `"session"` keeps the record under the session's `attribution` key, and `remix/session`'s middleware commits it. A `Cookie` keeps it as the cookie's value, about 400 bytes for two full touches. Sign it so a visitor cannot forge a campaign, and give it a `maxAge` that matches `window`. A response that sets the cookie also gets `Cache-Control: private`.
- `options.window`: how long a first touch stands, as a [@sdxc/duration](https://www.npmjs.com/package/@sdxc/duration) input. Defaults to `"90 days"`.
- `options.consent`: whether this visitor allows storage. When it returns `false`, `current` is still published, any stored record is removed, and nothing is written. Defaults to honoring [Global Privacy Control](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/globalPrivacyControl) (`Sec-GPC: 1`). An app that serves visitors under the ePrivacy Directive passes a function that reads its own consent cookie.
- `options.redirect`: answers a page request that carries tracking parameters with a `302` to the same URL without them, after the touch is stored, with `Cache-Control: no-store`. Defaults to `false`: the redirect adds a round trip to the one page view the campaign paid for, and client-side analytics that read `utm_*` from `location` see a clean URL. A canonical link that omits the parameters handles SEO without a redirect.
- `options.aliases`, `options.clickIds`, `options.referrers`: as for `readTouch`.

### `CurrentAttribution`

The context key the middleware writes to, for code that reads `ctx.get(CurrentAttribution)`. Its default holds three `null`s.

### `CAMPAIGN_PARAMETERS`, `CLICK_IDENTIFIERS`

From `@sdxc/attribution/parameters`. `CAMPAIGN_PARAMETERS` maps each `Utm` field to its `utm_*` name. `CLICK_IDENTIFIERS` maps each click identifier (`gclid`, `gbraid`, `wbraid`, `dclid`, `msclkid`, `yclid`, `fbclid`, `igshid`, `ttclid`, `li_fat_id`, `twclid`, `rdt_cid`, `epik`, `sccid`) and email-platform parameter (`mc_cid`, `mc_eid`, `_hsenc`, `_hsmi`, `vero_conv`, `vero_id`, `oly_anon_id`, `oly_enc_id`) to its network, whether it marks a paid click, and its kind.

### `isTrackingParameter(name: string): boolean`

Whether a query parameter is campaign metadata: any `utm_`-prefixed name or a listed identifier, compared case-insensitively.

### `withoutTracking(url: URL): URL`

A copy of the URL without tracking parameters. Every other parameter keeps the order and encoding the publisher wrote.

### Types

#### `Touch`

One arrival: `at` (epoch ms), `landingPath` (up to 256 characters, no query string), `utm`, `click`, `referrer` and `channel`.

#### `Utm`

The nine campaign fields in camelCase: `source`, `medium`, `campaign`, `term`, `content`, `id`, `sourcePlatform`, `creativeFormat` and `marketingTactic`.

#### `Click`

`param`, `network`, `paid`, and `value` only under `clickIds: "keep"`.

#### `Referrer`, `ReferrerKind`

The referrer's `host` and its `kind`.

#### `Channel`

The ten channels in the table above.

#### `Campaign`

What `toCampaign` returns: optional `source`, `medium`, `campaign`, `term`, `content`, `referrer` and `landingPage` strings.

#### `Attribution`

`current` is this request's touch, or `null` when the request is not a page navigation. `first` is the earliest touch within the window. `last` is the latest non-direct touch.

## Pattern: Carry the campaign into a checkout and a newsletter

A form that posts to the same origin sends the cookie with it, so the action reads `ctx.attribution` and the page needs no hidden fields.

```typescript
import { toMetadata, toUtmParams } from "@sdxc/attribution";
import { attribution } from "@sdxc/attribution/middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [attribution({ store: cookie })] });

router.post("/checkout", async (ctx) => {
	let checkout = await billing.checkouts.create({
		product,
		metadata: toMetadata(ctx.attribution),
	});
	return Response.redirect(checkout.url, 303);
});

router.post("/subscribe", async (ctx) => {
	let form = await ctx.request.formData();
	await newsletter.subscribe(String(form.get("email")), {
		...toUtmParams(ctx.attribution.last ?? ctx.attribution.first),
	});
	return new Response(null, { status: 204 });
});
```

## Pattern: Ask for consent before storing

```typescript
import { attribution } from "@sdxc/attribution/middleware";

attribution({
	store: cookie,
	consent: (ctx) => /(?:^|;\s*)consent=analytics/.test(ctx.request.headers.get("cookie") ?? ""),
});
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
