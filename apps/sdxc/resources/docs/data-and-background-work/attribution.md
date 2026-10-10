---
title: Know where visitors come from
description: Record a visitor's first and last touch from UTM parameters, click IDs and referrers, then store it with the account, the checkout or the newsletter reader they become.
section:
    title: Data & background work
    order: 6
order: 12
lastUpdated: 2026-10-08
---

A visitor clicks a link in a newsletter, reads three pages, leaves, comes back a week later from
a search and signs up. This guide records both arrivals in a signed cookie as they happen, then
reads them on the request where the visitor becomes something you keep: an account, a paying
customer, a newsletter reader. The campaign is stored with that record, so a report on signups
by campaign is a query over your own table.

[`@sdxc/attribution`](/api/attribution) reads the touch off a request, keeps the first and last
touch per visitor and flattens them for the places they are stored.

```bash
npm add @sdxc/attribution
```

## What a touch holds

A touch is one arrival: when it happened, the page the visitor landed on and what the request
said about how they got there. `readTouch` reads one off a URL and the `Referer` header:

```typescript
import { readTouch } from "@sdxc/attribution";

let touch = readTouch(
	new URL(
		"https://example.com/pricing?utm_source=Newsletter&utm_campaign=Launch%20Week",
	),
	{ referrer: "https://mail.google.com/" },
);
// touch.landingPath === "/pricing"
// touch.utm => { source: "newsletter", campaign: "launch-week" }
// touch.referrer => { host: "mail.google.com", kind: "email" }
// touch.channel === "email"
```

Every stored value is a slug: trimmed, lowercased, whitespace turned into `-` and cut at 64
characters, so `Newsletter` and `newsletter ` group together in a report. A value holding `@` or
`://` is an address or URL a merge tag put there, and it is dropped. The referrer keeps only its
hostname, and a referrer on the page's own host is internal navigation. A click identifier such
as `gclid` or `fbclid` is kept as the network's name and whether the click was paid. Parameters
that identify an email subscriber, such as `mc_eid`, are never stored; they credit the touch to
`email`.

`channel` is the acquisition channel the touch adds up to: `paid-search`, `paid-social`,
`display`, `email`, `affiliate`, `organic-social`, `organic-search`, `referral`, `other` or
`direct`. The [API reference](/api/attribution) lists the rules in the order they are tried.

## Keep the first and last touch

The middleware reads the touch on every page view and keeps two: the first within a window, and
the latest one that was not `direct`. It stores them in a cookie. Sign the cookie, so a visitor
cannot credit themselves to a campaign, and give it the same lifetime as the window:

```typescript {% title="app/lib/cookies.ts" %}
import type { Cookie } from "remix/cookie";

import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";

const NINETY_DAYS = 60 * 60 * 24 * 90;

export function attributionCookie(): Cookie {
	return createCookie("attribution", {
		path: "/",
		maxAge: NINETY_DAYS,
		httpOnly: true,
		sameSite: "Lax",
		secure: true,
		secrets: [env.COOKIE_SECRET],
	});
}
```

`COOKIE_SECRET` is a secret declared in your Worker's configuration. Add the middleware to the
global chain, ahead of anything that ends a request early:

```tsx {% title="bootstrap/app.tsx" %}
import type { Middleware } from "remix/router";

import { attribution } from "@sdxc/attribution/middleware";
import { log } from "@sdxc/logger/middleware";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";

import { attributionCookie } from "~/app/lib/cookies";

import { logger } from "./logger";

export default function application() {
	let middleware: Middleware[] = [
		log(logger) as Middleware,
		attribution({ store: attributionCookie() }),
		formData() as Middleware,
		// …then cop() and a renderer
	];

	let router = createRouter({ middleware });
	// router.map(…) for each route
	return router;
}
```

Every request gets `ctx.attribution` with three fields: `current`, this request's own touch,
and the stored `first` and `last`. Writes happen only on a page navigation: a `GET` the browser
marks as loading a document. A form post, a `fetch`, a bot and a direct revisit write nothing, so
a form action reads the touches the visitor's page views recorded. The first touch is replaced
when the stored one is older than `window` (90 days by default), so a visitor returning a year
later from a new campaign is credited to it. A response that sets the cookie is marked
`Cache-Control: private`, and a cookie that fails to verify or validate reads as no record.

An app that already runs `remix/session`'s middleware passes `store: "session"` and installs
`attribution()` after it; the record then lives under the session's `attribution` key and the
session middleware commits it.

The remaining options:

- `consent` decides per request whether the visitor allows storage. It defaults to honoring
  Global Privacy Control (`Sec-GPC: 1`). When it answers `false`, `current` is still published,
  the stored record is removed and nothing is written.
- `redirect: true` answers a page view that carries tracking parameters with a `302` to the same
  URL without them, once the touch is stored.
- `clickIds: "keep"` stores the click identifier's value too, for an app that uploads offline
  conversions to an ad network.
- `aliases` and `referrers` add parameters read as a UTM field and `host → kind` entries to the
  referrer table; `ref` is already read as `utm_source`.

An app serving visitors under the ePrivacy Directive reads its own consent cookie:

```typescript
attribution({
	store: attributionCookie(),
	consent: (ctx) => {
		let cookie = ctx.request.headers.get("cookie") ?? "";
		return /(?:^|;\s*)consent=analytics/.test(cookie);
	},
});
```

## Store it with the account

The sign-up action is where a visitor becomes a record. Read the touches there and write the
fields your reports group by into the account's own columns:

```typescript {% title="app/data/acquisition.ts" %}
import type { Touch } from "@sdxc/attribution";

export interface Acquisition {
	channel: string;
	source: string | null;
	campaign: string | null;
	referrer: string | null;
	landing_path: string | null;
}

export function acquisitionOf(touch: Touch | null): Acquisition {
	return {
		channel: touch?.channel ?? "direct",
		source: touch?.utm?.source ?? null,
		campaign: touch?.utm?.campaign ?? null,
		referrer: touch?.referrer?.host ?? null,
		landing_path: touch?.landingPath ?? null,
	};
}
```

A `null` touch is a visitor who arrived with nothing to credit, or one who withheld consent, and
it reads as `direct`. The action passes the first touch, which answers "what found us":

```typescript {% title="app/http/controllers/sign-up.ts" %}
import { toMetadata } from "@sdxc/attribution";
import { createAction } from "remix/router";

import { acquisitionOf } from "~/app/data/acquisition";
import { createAccount } from "~/app/data/accounts";
import routes from "~/routes/web";

export default createAction(routes.signUp.action, async (ctx) => {
	// …validate the form into `email`
	let account = await createAccount(ctx.db, {
		email,
		...acquisitionOf(ctx.attribution.first),
		attribution: toMetadata(ctx.attribution),
	});
	// …start their session and redirect
});
```

`createAccount` is your own model function. The spread columns are the ones a report filters
on. `toMetadata` keeps both touches as one flat record, with keys such as `first_channel`,
`first_source`, `last_campaign` and `last_landing`, only for the fields a touch carries, which
fits a JSON column for the questions you have not asked yet.

## Pass it to the checkout

A sale usually happens on the billing platform's page, and the platform reports it to you later
in a webhook. Attach the touches to the checkout, and the platform hands them back on the order:

```typescript {% title="app/http/controllers/billing/checkout.ts" %}
import { toMetadata } from "@sdxc/attribution";

let checkout = await ctx.billing.checkouts.create({
	product: "pro",
	customer: { externalId: ctx.account.id },
	metadata: toMetadata(ctx.attribution),
});
```

Two full touches come to at most 28 keys of under 300 characters each, inside the metadata
limits of Polar and Stripe. [Charge for your app](/docs/data-and-background-work/billing) covers
the rest of the checkout and the webhook that receives the order.

## Credit a newsletter reader

A newsletter provider stores campaign fields beside a reader. `toCampaign` flattens one touch
into them, with the landing path resolved into an absolute URL against the request's:

```typescript
import { toCampaign } from "@sdxc/attribution";

let outcome = await ctx.newsletter.subscribers.subscribe({
	email: email.data,
	attribution: toCampaign(ctx.attribution.last ?? ctx.attribution.first, ctx.url),
});
```

The last touch answers "what brought them back to sign up", falling back to the first when every
later visit was direct. `toUtmParams(touch)` gives the same campaign under `utm_*` names, for a
provider that takes those. [Run a newsletter list](/docs/data-and-background-work/newsletter)
builds the whole form.

## Strip tracking parameters from links

`@sdxc/attribution/parameters` knows every parameter the touch reader does. `withoutTracking`
copies a URL without them, keeping every other parameter in the order and encoding its author
wrote, which suits a canonical link or a link a visitor copies to share:

```typescript
import { withoutTracking } from "@sdxc/attribution/parameters";

withoutTracking(new URL("https://example.com/post?p=123&utm_source=x&fbclid=abc"));
// https://example.com/post?p=123
```

`isTrackingParameter(name)` answers for one name, and `CAMPAIGN_PARAMETERS` and
`CLICK_IDENTIFIERS` list them with the network each identifier belongs to.

## Test it

The middleware needs no app around it, so a test builds a router with only it, lands on a page
the way a browser does, keeps the cookie the response set, and sends it with the request that
converts:

```typescript {% title="app/data/acquisition.test.ts" %}
import { attribution } from "@sdxc/attribution/middleware";
import { createCookie } from "remix/cookie";
import { createRouter } from "remix/router";
import { expect, test } from "vitest";

import { acquisitionOf } from "~/app/data/acquisition";

function createTestRouter() {
	let cookie = createCookie("attribution", { secrets: ["test-secret"] });
	let router = createRouter({ middleware: [attribution({ store: cookie })] });
	router.get("/pricing", () => new Response("Pricing"));
	router.post("/sign-up", (ctx) =>
		Response.json(acquisitionOf(ctx.attribution.first)),
	);
	return router;
}

test("credits a sign-up to the campaign it first landed from", async () => {
	let router = createTestRouter();
	let landing = await router.fetch(
		new Request(
			"https://example.com/pricing?utm_source=Mastodon&utm_campaign=Launch",
			{
				headers: { "sec-fetch-dest": "document" },
			},
		),
	);
	let cookie = landing.headers.get("set-cookie")?.split(";")[0] ?? "";

	let signUp = await router.fetch(
		new Request("https://example.com/sign-up", {
			method: "POST",
			headers: { cookie },
		}),
	);

	expect(await signUp.json()).toMatchObject({
		channel: "other",
		source: "mastodon",
		campaign: "launch",
		landing_path: "/pricing",
	});
});
```

Without `Sec-Fetch-Dest: document`, or an `Accept` naming `text/html`, the landing request is not
a navigation and writes no cookie, which is also how a test checks that a `fetch` leaves the
record alone. A link with a source and no medium credits the `other` channel, as the expectation
shows; add `utm_medium` to links you control so they land in the channel you mean.

## Where to go next

- [Run a newsletter list](/docs/data-and-background-work/newsletter) — subscribe a reader with
  the campaign that brought them.
- [Charge for your app](/docs/data-and-background-work/billing) — the checkout and the order
  webhook the metadata returns on.
- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases) — the `ctx.db` the
  account is written through.
