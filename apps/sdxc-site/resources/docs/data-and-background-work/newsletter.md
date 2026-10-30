---
title: Run a newsletter list
description: Subscribe readers to Buttondown or Kit through one contract, credit the campaign they came from, follow confirmations and unsubscribes from webhooks, and test against an in-memory list.
section:
    title: Data & background work
    order: 7
order: 11
lastUpdated: 2026-10-25
outcomes:
    - "How to subscribe readers to Buttondown or Kit through one `@sdxc/newsletter` contract"
    - "How to credit the campaign and follow confirmations and unsubscribes from webhooks"
    - "How to test the sign-up form against the in-memory list"
---

This guide builds the sign-up box at the bottom of a blog: a visitor types an address, the list
sends them a confirmation email, and your app learns when they confirm or leave. The list lives
on a newsletter platform, and your code talks to one contract, so moving from Buttondown to Kit
changes one file.

[`@sdxc/newsletter`](/api/newsletter) provides the contract, the Buttondown and Kit providers, the
middleware, the webhook endpoint and an in-memory list for tests.
[`@sdxc/email-address`](/api/email-address) parses the address,
[`@sdxc/get-client-ip`](/api/get-client-ip) reads the visitor's IP, and
[`@sdxc/attribution`](/api/attribution) remembers the campaign that brought them.

```bash
npm add @sdxc/attribution @sdxc/database-middleware @sdxc/email-address \
	@sdxc/get-client-ip @sdxc/http @sdxc/lazy-route @sdxc/logger @sdxc/newsletter \
	@sdxc/result @sdxc/validate @sdxc/webhooks remix
```

## Pick a provider

A provider is one subscriber list on one platform. Build it once at module scope: construction
makes no request, so a missing API key fails the call that needed it and the Worker still
boots.

```typescript {% title="app/initializers/newsletter.ts" %}
import type { Newsletter } from "@sdxc/newsletter";

import { ButtondownNewsletter } from "@sdxc/newsletter/buttondown";
import { env } from "cloudflare:workers";

export const buttondown: Newsletter = new ButtondownNewsletter({
	apiKey: env.BUTTONDOWN_API_KEY,
	webhookSecret: env.BUTTONDOWN_WEBHOOK_SECRET,
	confirmation: "double",
});
```

Declare both values as secrets in your Worker's configuration. `confirmation: "double"`, the
default, creates each new reader `pending` and has Buttondown send the confirmation email. On Kit,
`KitNewsletter` from `@sdxc/newsletter/kit` takes the same shape plus the `form` readers are added
through, whose `confirmation` must match the form's own setting in Kit; see [`@sdxc/newsletter`](/api/newsletter) for its options.

Every call answers a `Result<T, NewsletterError>`. The error's `code` is the normalized reason,
and only `rate_limited` is `retryable`, with the platform's delay in `retryAfter`. Every write in
the contract is safe to repeat.

## Publish it on the request

The middleware publishes the provider as `ctx.newsletter`. Taking the list as a parameter of
`createWebRouter` is what lets a test hand in the memory list:

```tsx {% title="app/initializers/router.tsx" %}
import type { Newsletter } from "@sdxc/newsletter";

import { attribution } from "@sdxc/attribution/middleware";
import { database } from "@sdxc/database-middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import newsletter from "@sdxc/newsletter/middleware";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";

import { attributionCookie } from "~/app/initializers/cookies";
import { openDatabase } from "~/app/initializers/database";
import { logger } from "~/app/initializers/logger";
import { buttondown } from "~/app/initializers/newsletter";
import { createNewsletterWebhook } from "~/app/initializers/newsletter-webhook";
import routes from "~/routes/web";

export function createWebRouter(list: Newsletter = buttondown) {
	let router = createRouter({
		middleware: [
			log(logger),
			database(openDatabase()),
			getClientIP(),
			attribution({ store: attributionCookie() }),
			formData(),
			newsletter({ provider: list }),
		],
	});

	router.map(routes.subscribe, {
		actions: {
			index: lazy(() =>
				import("~/app/http/controllers/subscribe").then((it) => it.index),
			),
			action: lazy(() =>
				import("~/app/http/controllers/subscribe").then((it) => it.action),
			),
		},
	});
	router.map(routes.webhooks.newsletter, createNewsletterWebhook(list));
	return router;
}
```

`getClientIP()` publishes `ctx.ip`, which platforms use to screen sign-ups, and `attribution()`
publishes `ctx.attribution`, set up in
[Know where visitors come from](/docs/data-and-background-work/attribution).

## Subscribe from a form

The route is `subscribe: form("/subscribe")` in `routes/web.ts`, beside a `checkYourEmail` page
and a `webhooks.newsletter` route at `/webhooks/newsletter`. The form is one field:

```tsx {% title="app/http/controllers/subscribe.tsx" %}
import type { RequestContext } from "remix/router";

import { createAction } from "remix/router";

import { SubscribePage } from "~/resources/views/subscribe";
import routes from "~/routes/web";

export function renderSubscribe(ctx: RequestContext, error?: string) {
	return ctx.render(
		<SubscribePage error={error}>
			<form method="post" action={routes.subscribe.action.href()}>
				<input name="email" type="email" autocomplete="email" required />
				<button type="submit">Subscribe</button>
			</form>
		</SubscribePage>,
		{ status: error ? 400 : 200 },
	);
}

export const index = createAction(routes.subscribe.index, (ctx) =>
	renderSubscribe(ctx),
);
```

The action validates the post, parses the address and subscribes it. Two refusals are the
visitor's to fix, so they get their own copy; anything else is the app's to log:

```tsx {% title="app/http/controllers/subscribe.tsx" %}
import { toCampaign } from "@sdxc/attribution";
import { parseEmailAddress } from "@sdxc/email-address";
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";

const SUBSCRIBE = s.object({ email: s.string() });

export const action = createAction(routes.subscribe.action, async (ctx) => {
	let form = await validate(ctx.formData, SUBSCRIBE);
	if (isFailure(form)) return renderSubscribe(ctx, "Enter your email address.");

	let email = parseEmailAddress(form.data.email);
	if (isFailure(email))
		return renderSubscribe(ctx, "That is not an email address.");

	let touch = ctx.attribution.last ?? ctx.attribution.first;
	let outcome = await ctx.newsletter.subscribers.subscribe({
		email: email.data,
		tags: ["blog"],
		attribution: toCampaign(touch, ctx.url),
		ip: ctx.ip,
	});

	if (isFailure(outcome)) {
		let code = outcome.error.code;
		if (code === "invalid_address") {
			return renderSubscribe(ctx, "That address cannot receive email.");
		}
		if (code === "suppressed") {
			return renderSubscribe(ctx, "That address cannot be subscribed.");
		}
		ctx.log.fail(outcome.error);
		return renderSubscribe(ctx, "Something went wrong. Please try again.");
	}

	ctx.log.set({ newsletter: { created: outcome.data.created } });
	return redirect(routes.checkYourEmail.href(), {
		status: redirect.Status.SeeOther,
	});
});
```

An address already on the list, in any status, is a success with `created: false` and its record
untouched, so the page never tells a visitor who else is subscribed. `toCampaign` turns the
visitor's touch into the UTM fields, referrer and landing page the platform records.

> [!WARNING]
> Bots find a public sign-up form quickly, so put the layers from
> [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) in front of this
> action.

## Follow confirmations and unsubscribes

The platform tells you when a pending reader confirms, leaves or bounces. `NewsletterWebhook`
verifies the delivery against the provider's secret, normalizes it into events and calls the
handler keyed by each event's type:

```typescript {% title="app/initializers/newsletter-webhook.ts" %}
import type { Newsletter } from "@sdxc/newsletter";

import { NewsletterWebhook } from "@sdxc/newsletter";
import { KVReplayStore } from "@sdxc/webhooks";
import { env } from "cloudflare:workers";

import type { AppContext } from "~/app/initializers/router";

import { setReaderStatus } from "~/app/models/readers";

export function createNewsletterWebhook(
	provider: Newsletter,
): NewsletterWebhook<AppContext> {
	return new NewsletterWebhook<AppContext>(
		provider,
		{
			async "subscriber.confirmed"(event, ctx) {
				await setReaderStatus(ctx.db, event.subscriberId, "active");
			},
			async "subscriber.unsubscribed"(event, ctx) {
				await setReaderStatus(ctx.db, event.subscriberId, "unsubscribed");
			},
			async "subscriber.suppressed"(event, ctx) {
				await setReaderStatus(ctx.db, event.subscriberId, "suppressed");
			},
		},
		{ store: new KVReplayStore(env.WEBHOOKS, { prefix: "newsletter:" }) },
	);
}
```

`setReaderStatus` is your own model function over the table where you mirror readers, and
`AppContext` is your router's context type, so each handler receives the request's `ctx.db`.

The endpoint answers `401` to a delivery the secret does not prove, and a provider with no secret
proves none, so the route fails closed. A handler that returns a failed `Result` answers `503`, so
the platform redelivers, and the replay store skips the events already handled.

> [!WARNING]
> The webhook is a cross-origin `POST`, so exempt its path from `cop()` as
> [Receive and send webhooks](/docs/identity-and-security/webhooks) explains.

## Test against the memory list

`MemoryNewsletter` from `@sdxc/newsletter/memory` implements the whole contract in memory, so a
test drives the real router and asserts on the list's state. It adds `seed`, `confirm`, `fail`
and `heal` for setting a scene, and `attribution(email)` for reading back what a subscribe
recorded:

```typescript {% title="app/http/controllers/subscribe.test.ts" %}
import { MemoryNewsletter } from "@sdxc/newsletter/memory";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

const ORIGIN = "https://example.com";

function post(list: MemoryNewsletter, email: string, cookie = "") {
	let request = new Request(`${ORIGIN}/subscribe`, {
		method: "POST",
		headers: { origin: ORIGIN, cookie },
		body: new URLSearchParams({ email }),
	});
	return createWebRouter(list).fetch(request);
}

test("a new reader waits for confirmation", async () => {
	let list = new MemoryNewsletter();

	let response = await post(list, "reader@example.com");
	let page = await unwrap(list.subscribers.list());

	expect(response.status).toBe(303);
	expect(page.items.map((reader) => reader.status)).toEqual(["pending"]);
	expect(unwrap(list.confirm("reader@example.com")).status).toBe("active");
});

test("credits the campaign the visitor landed from", async () => {
	let list = new MemoryNewsletter();
	let landing = await createWebRouter(list).fetch(
		new Request(`${ORIGIN}/subscribe?utm_source=Mastodon&utm_campaign=Launch`, {
			headers: { "sec-fetch-dest": "document" },
		}),
	);
	let cookie = landing.headers.get("set-cookie")?.split(";")[0] ?? "";

	await post(list, "reader@example.com", cookie);

	expect(list.attribution("reader@example.com")).toMatchObject({
		source: "mastodon",
		campaign: "launch",
	});
});
```

`fail(target, code)` makes subscriber calls fail with that code until `heal` disarms it, which is
how a test reaches the action's error copy.

## Where to go next

- [Know where visitors come from](/docs/data-and-background-work/attribution) — the touches
  `toCampaign` reads.
- [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) — the layers
  to put in front of a public sign-up form.
- [Receive and send webhooks](/docs/identity-and-security/webhooks) — signatures, replay stores
  and the `cop()` exemption.
