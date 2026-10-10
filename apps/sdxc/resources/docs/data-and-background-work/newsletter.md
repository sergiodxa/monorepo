---
title: Run a newsletter list
description: Subscribe readers to Buttondown or Kit through one contract, credit the campaign they came from, follow confirmations and unsubscribes from webhooks, and test against an in-memory list.
section:
    title: Data & background work
    order: 6
order: 11
lastUpdated: 2026-10-08
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
npm add @sdxc/newsletter @sdxc/email-address @sdxc/get-client-ip @sdxc/attribution \
	@sdxc/validate @sdxc/webhooks @sdxc/result @sdxc/http
```

## Pick a provider

A provider is one subscriber list on one platform. Build it once at module scope: construction
reaches no network, so a missing API key fails the call that needed it and the Worker still
boots.

```typescript {% title="app/lib/newsletter.ts" %}
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
default, creates each new reader unconfirmed, so Buttondown sends the confirmation email and the
reader starts `pending`; `"single"` starts them `active`. The provider pins the Buttondown API
version it reads, so a platform change to its default version leaves your app's answers as they
were. `newsletterId` narrows the webhook deliveries it accepts to one newsletter when the account
holds several.

On Kit, double opt-in belongs to the form a reader is added through, so the provider names that
form and repeats its setting:

```typescript {% title="app/lib/newsletter.ts" %}
import type { Newsletter } from "@sdxc/newsletter";

import { KitNewsletter } from "@sdxc/newsletter/kit";
import { env } from "cloudflare:workers";

export const kit: Newsletter = new KitNewsletter({
	apiKey: env.KIT_API_KEY,
	webhookSecret: env.KIT_WEBHOOK_SECRET,
	form: { id: "55", confirmation: "double" },
});
```

`form.confirmation` has to match the form's own setting in Kit, which is what decides whether
the confirmation email goes out. The form is also where Kit records attribution. Metadata keys
must already exist as Kit custom fields, and creating a reader costs up to four requests against
Kit's rate limit.

Every call on either provider answers a `Result<T, NewsletterError>`. The error's `code` is the
normalized reason, `providerCode` the platform's own, and only `rate_limited` is `retryable`,
with the delay the platform asked for in `retryAfter`. `unknown` means a timeout or a 5xx after
which the write may have landed; every write in the contract is safe to repeat.

## Publish it on the request

The middleware publishes the provider as `ctx.newsletter`. Taking the list as a parameter of
the router factory is what lets a test hand in the memory list:

```tsx {% title="bootstrap/app.tsx" %}
import type { Newsletter } from "@sdxc/newsletter";
import type { Middleware } from "remix/router";

import { attribution } from "@sdxc/attribution/middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { log } from "@sdxc/logger/middleware";
import newsletter from "@sdxc/newsletter/middleware";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";

import * as subscribe from "~/app/http/controllers/subscribe";
import { attributionCookie } from "~/app/lib/cookies";
import { buttondown } from "~/app/lib/newsletter";
import { createNewsletterWebhook } from "~/app/lib/newsletter-webhook";
import routes from "~/routes/web";

import { logger } from "./logger";

export default function application(list: Newsletter = buttondown) {
	let middleware: Middleware[] = [
		log(logger) as Middleware,
		getClientIP(),
		attribution({ store: attributionCookie() }),
		formData() as Middleware,
		newsletter({ provider: list }),
		// …then cop() and a renderer
	];

	let router = createRouter({ middleware });
	router.map(routes.subscribe, {
		actions: { index: subscribe.index, action: subscribe.action },
	});
	router.map(routes.webhooks.newsletter, createNewsletterWebhook(list));
	return router;
}
```

`getClientIP()` publishes `ctx.ip`, which platforms use to screen sign-ups, and `attribution()`
publishes `ctx.attribution`, set up in
[Know where visitors come from](/docs/data-and-background-work/attribution).
An app whose list varies by tenant passes `provider` a function of the request context instead,
and the middleware calls it once per request.

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
untouched, so the page answers it like a new reader and never tells a visitor who else is
subscribed. Tags, metadata and attribution apply only to a reader the call created.
`outcome.data.subscriber.status` is `pending` until the reader clicks the confirmation link.

`ip` takes the `IP` the middleware published, or the `Result` of `IP.parse` as it is; `null` or a
failed parse records no address. Bots find a public sign-up form quickly, so put the layers from
[Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) in front of this
action.

## Credit the campaign

`toCampaign` turns a touch into the flat fields `attribution` takes: the five UTM values, the
referring hostname and the absolute landing page. Buttondown stores source, medium and campaign
in its own columns and the referrer (or, without one, the landing page) as the reader's referrer;
`term` and `content` travel as `utm_term` and `utm_content` metadata. Kit records attribution
through the form the provider names.

To keep both touches rather than one, add them as metadata:

```typescript
import { toMetadata } from "@sdxc/attribution";

let outcome = await ctx.newsletter.subscribers.subscribe({
	email: email.data,
	attribution: toCampaign(ctx.attribution.last ?? ctx.attribution.first, ctx.url),
	metadata: toMetadata(ctx.attribution),
	ip: ctx.ip,
});
```

`toMetadata` writes keys such as `first_channel`, `first_source` and `last_campaign`, only for
the fields a touch carries. On Kit each of those keys must already exist as a custom field.

## Change a reader from your app

`update` adds and removes tags by name and merges metadata, where a `null` value removes the key.
Tag a reader who became a customer so the platform can segment them:

```typescript {% title="app/services/newsletter.ts" %}
import type { EmailAddress } from "@sdxc/email-address";
import type { Newsletter, NewsletterError } from "@sdxc/newsletter";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

export async function tagCustomer(
	newsletter: Newsletter,
	email: EmailAddress,
	plan: string,
): Promise<Result<null, NewsletterError>> {
	let updated = await newsletter.subscribers.update(
		{ email },
		{ tags: { add: ["customer"] }, metadata: { plan, trial: null } },
	);

	if (isFailure(updated) && updated.error.code !== "not_found") {
		return failure(updated.error);
	}
	return success(null);
}
```

A buyer who never subscribed answers `not_found`, which is a normal outcome here. A lookup by
`{ email }` compares the parsed address, so a different capitalization of the local part finds
the same reader on a platform that compares canonically.

`unsubscribe(ref)` marks a reader unsubscribed and keeps the record, and repeating it succeeds.
The contract leaves resubscribing to the reader, since an unsubscribe is revoked consent: the
next `subscribe` of that address answers `created: false` with the status left as it is.
`find`, `tags` and `list` read readers back; `list` pages by cursor, and only `cursor === null`
ends a walk.

A `rate_limited` failure carries `retryAfter`, and the provider makes one attempt per call. Run a
bulk change from a [background job](/docs/data-and-background-work/jobs-and-cron) that retries
after that delay.

## Follow confirmations and unsubscribes

The platform tells you when a pending reader confirms, leaves or bounces. `NewsletterWebhook`
verifies the delivery against the provider's secret, normalizes it into events and calls the
handler keyed by each event's type:

```typescript {% title="app/lib/newsletter-webhook.ts" %}
import type { Newsletter } from "@sdxc/newsletter";

import { NewsletterWebhook } from "@sdxc/newsletter";
import { KVReplayStore } from "@sdxc/webhooks";
import { env } from "cloudflare:workers";

import { setReaderStatus } from "~/app/data/readers";

export function createNewsletterWebhook(provider: Newsletter): NewsletterWebhook {
	return new NewsletterWebhook(
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

`setReaderStatus` is your own model function over the table where you mirror readers, with
`ctx.db` from [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases).
The endpoint is the value `router.map` takes, as the router above shows.

The endpoint answers `401` to a delivery the secret does not prove, and a provider with no secret
configured proves none, so the route fails closed. An authentic delivery it cannot parse is
acknowledged, since the same bytes would fail again. A handler that throws answers `503`, so the
platform redelivers; the replay store remembers each event id once its handler finishes, so the
redelivery skips the events already handled and resumes at the one that failed. Buttondown signs
deliveries without a timestamp, which makes the store what bounds a replay there.

Each event carries `subscriberId` and, when the platform sent it, `subscriber` with the record;
when it is `null`, `ctx.newsletter.subscribers.find({ id })` reads it. A platform event type with
no mapping arrives as `unrecognized` and is acknowledged. The webhook is a cross-origin `POST`,
so exempt its path from `cop()` as
[Receive and send webhooks](/docs/identity-and-security/webhooks) explains.

## Test against the memory list

`MemoryNewsletter` from `@sdxc/newsletter/memory` implements the whole contract in memory, so a
test drives the real router and asserts on the list's state. It adds `seed`, `confirm`, `fail`
and `heal` for setting a scene, and `attribution(email)` and `ip(email)` for reading back what a
subscribe recorded:

```typescript {% title="app/http/controllers/subscribe.test.ts" %}
import { MemoryNewsletter } from "@sdxc/newsletter/memory";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import application from "~/bootstrap/app";

const ORIGIN = "https://example.com";

function post(list: MemoryNewsletter, email: string, cookie = "") {
	let request = new Request(`${ORIGIN}/subscribe`, {
		method: "POST",
		headers: { origin: ORIGIN, cookie },
		body: new URLSearchParams({ email }),
	});
	return application(list).fetch(request);
}

test("a new reader waits for confirmation", async () => {
	let list = new MemoryNewsletter();

	let response = await post(list, "reader@example.com");
	let page = await unwrap(list.subscribers.list());

	expect(response.status).toBe(303);
	expect(page.items.map((reader) => reader.status)).toEqual(["pending"]);
	expect(unwrap(list.confirm("reader@example.com")).status).toBe("active");
});

test("a suppressed address sees its own copy", async () => {
	let list = new MemoryNewsletter();
	list.fail("subscribers.subscribe", "suppressed");

	let response = await post(list, "reader@example.com");

	expect(await response.text()).toContain("cannot be subscribed");
});

test("credits the campaign the visitor landed from", async () => {
	let list = new MemoryNewsletter();
	let landing = await application(list).fetch(
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

`fail(target, code)` arms a failure on every subscriber call or on one method, until `heal`
disarms it; without a code it reports `unknown`, the timeout case. `seed` adds readers directly,
in any status, bypassing confirmation.

`webhooks.emit` signs a Standard Webhooks delivery for an event, addressed to
`/webhooks/newsletter`, so the same router receives it. A list built with an empty
`webhookSecret` proves nothing, which is how a test holds the endpoint to failing closed:

```typescript {% title="app/http/controllers/newsletter-webhook.test.ts" %}
import { MemoryNewsletter } from "@sdxc/newsletter/memory";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import application from "~/bootstrap/app";

test("refuses a delivery the configured secret does not prove", async () => {
	let sender = new MemoryNewsletter();
	let [reader] = sender.seed([{ email: "reader@example.com" }]);
	let delivery = unwrap(
		await sender.webhooks.emit({
			type: "subscriber.unsubscribed",
			subscriberId: reader?.id ?? "",
		}),
	);

	let unconfigured = new MemoryNewsletter({ webhookSecret: "" });
	let response = await application(unconfigured).fetch(delivery.request);

	expect(response.status).toBe(401);
});
```

Passing an `id` to `emit` and emitting it twice models a redelivery.

## Hold your own provider to the contract

A platform the package has no provider for is one class implementing `Newsletter`.
`@sdxc/newsletter/conformance` registers the contract's rules as Vitest tests against it: one
subscribe per address, lookups by id and email, tags, metadata merging, idempotent unsubscribe, a
full cursor walk and fail-closed webhooks. The memory, Buttondown and Kit providers pass the same
suite.

```typescript {% title="app/lib/mailing-list.test.ts" %}
import { conformance } from "@sdxc/newsletter/conformance";

import { MailingListNewsletter, signDelivery } from "~/app/lib/mailing-list";

const API_KEY = "test-key";
const SECRET = "test-webhook-secret";

conformance({
	name: "MailingListNewsletter",
	create: () =>
		new MailingListNewsletter({ apiKey: API_KEY, webhookSecret: SECRET }),
	createWithoutSecret: () => new MailingListNewsletter({ apiKey: API_KEY }),
	confirmation: "double",
	deliver: (_provider, subscriber) => signDelivery(SECRET, subscriber),
});
```

`create` runs for every test, so each one starts clean; point it at a sandbox list or at MSW
handlers that model the platform. `deliver` signs a delivery about the subscriber exactly as the
platform would. `metadataKeys` names two keys the platform accepts when its keys must exist
first, and `missingId` an id well-formed for the platform that names no reader.

## Where to go next

- [Know where visitors come from](/docs/data-and-background-work/attribution) — the touches
  `toCampaign` reads.
- [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) — the layers
  to put in front of a public sign-up form.
- [Send email](/docs/data-and-background-work/send-email) — the transactional mail your app sends
  itself.
- [Receive and send webhooks](/docs/identity-and-security/webhooks) — signatures, replay stores
  and the `cop()` exemption.
