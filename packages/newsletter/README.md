# @sdxc/newsletter

Vendor-neutral newsletter subscriber lists, with Buttondown and Kit providers, a memory provider for tests and a verified webhook endpoint.

## Installation

```sh
npm add @sdxc/newsletter
```

Addresses come parsed by [`@sdxc/email-address`](https://www.npmjs.com/package/@sdxc/email-address), a visitor's IP is an `IP` from [`@sdxc/ip`](https://www.npmjs.com/package/@sdxc/ip), and every answer is a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). The middleware and webhook endpoint run on `remix/router` from [`remix`](https://www.npmjs.com/package/remix).

## Usage

### Create a provider

Build one provider at module scope. Construction reaches no network, so a missing API key fails the call that needed it, never the boot.

```typescript
import type { Newsletter } from "@sdxc/newsletter";

import { ButtondownNewsletter } from "@sdxc/newsletter/buttondown";

export let newsletter: Newsletter = new ButtondownNewsletter({
	apiKey: process.env.BUTTONDOWN_API_KEY ?? "",
	webhookSecret: process.env.BUTTONDOWN_WEBHOOK_SECRET,
	confirmation: "double",
});
```

Kit decides double opt-in by the form a reader joins through, so its provider names that form:

```typescript
import { KitNewsletter } from "@sdxc/newsletter/kit";

export let newsletter: Newsletter = new KitNewsletter({
	apiKey: process.env.KIT_API_KEY ?? "",
	webhookSecret: process.env.KIT_WEBHOOK_SECRET,
	form: { id: "55", confirmation: "double" },
});
```

### Subscribe an address

```typescript
import { parseEmailAddress } from "@sdxc/email-address";
import { IP } from "@sdxc/ip";
import { isFailure } from "@sdxc/result";

let email = parseEmailAddress("reader@example.com");
if (isFailure(email)) throw email.error;

let outcome = await newsletter.subscribers.subscribe({
	email: email.data,
	tags: ["launch"],
	ip: IP.parse(request.headers.get("cf-connecting-ip") ?? ""),
});

if (isFailure(outcome)) {
	outcome.error.code; // "invalid_address", "suppressed", "rate_limited", ...
} else {
	outcome.data.created; // false when the address was already on the list
	outcome.data.subscriber.status; // "pending" until the reader confirms
}
```

Subscribing an address the list already holds, in any status, succeeds with `created: false` and leaves the record untouched, so repeating the call is safe. `ip` takes the `Result` of `IP.parse` as it is; a failed parse records no IP.

### Read, change and unsubscribe a reader

A reader is addressed by `{ id }` or `{ email }`; one the list does not hold fails as `not_found`.

```typescript
let reader = await newsletter.subscribers.find({ email: email.data });
let tags = await newsletter.subscribers.tags({ email: email.data }); // ["launch"]

await newsletter.subscribers.update(
	{ email: email.data },
	{ tags: { add: ["buyer"], remove: ["launch"] }, metadata: { plan: "pro", trial: null } },
);

await newsletter.subscribers.unsubscribe({ email: email.data });
```

Metadata merges into what is stored, and a `null` value removes that key. Unsubscribing keeps the record and succeeds again on an unsubscribed reader.

## API

### `Newsletter`

The contract every provider implements: `connection` (the configured credential set's name), `subscribers`, `webhooks`, and `native`, the underlying client for endpoints the contract leaves out.

### `subscribers.subscribe(input: SubscribeInput): Promise<Result<SubscribeOutcome, NewsletterError>>`

Ensures an address is on the list. A new reader answers `created: true` with status `"pending"` when a confirmation email went out and `"active"` otherwise. `tags`, `metadata` and `attribution` apply only to a reader the call creates.

### `subscribers.find(ref: SubscriberRef): Promise<Result<Subscriber, NewsletterError>>`

Reads one reader.

### `subscribers.tags(ref: SubscriberRef): Promise<Result<string[], NewsletterError>>`

Reads one reader's tag names, which `Subscriber` leaves out.

### `subscribers.list(query?: ListSubscribersQuery): Promise<Result<Page<Subscriber>, NewsletterError>>`

Reads one page of readers, filtered by `status` or `tag`. Pass the page's `cursor` back for the next one; the walk ends only at `cursor === null`, since a page may come back short before the last.

### `subscribers.update(ref: SubscriberRef, input: UpdateSubscriberInput): Promise<Result<Subscriber, NewsletterError>>`

Adds and removes tags by name and merges metadata, answering the stored reader.

### `subscribers.unsubscribe(ref: SubscriberRef): Promise<Result<Subscriber, NewsletterError>>`

Marks a reader unsubscribed and keeps the record. The contract has no resubscribe: the reader opts back in themselves.

### `webhooks.verify(request: Request, rawBody: string): Promise<boolean>`

Whether the configured secret proves a delivery. An unset or empty secret answers `false`.

### `webhooks.events(request: Request, rawBody: string): Result<NewsletterEvent[], NewsletterError>`

Normalizes an authentic delivery into its events. A platform event type with no mapping arrives as `unrecognized`.

### `DEFAULT_PAGE_SIZE`

`100`, the page size `list` uses when the query names no `limit`.

### `NewsletterError`

The error in every failed `Result`: a normalized `code`, the platform's `providerCode`, `connection`, `retryable` (true only for `rate_limited`) and `retryAfter` in seconds or `null`. `invalid_address` and `suppressed` are the refusals a visitor can act on; `unknown` is a timeout or 5xx after which a write may have landed. Providers never retry on their own.

### `new NewsletterWebhook(provider: Newsletter, handlers: NewsletterWebhookHandlers, options?: NewsletterWebhookOptions)`

A webhook endpoint whose `handler` mounts as a route handler. It answers `401` to an unproven delivery, `200` to an authentic one (including one it cannot parse), and `503` when a handler throws, so the platform redelivers. With a `ReplayStore` from [`@sdxc/webhooks`](https://www.npmjs.com/package/@sdxc/webhooks) in `options.store`, it skips event ids already handled for `options.ttl` (default `"7 days"`); without one, handlers must be idempotent. Buttondown signs without a timestamp, so give its endpoint a store.

### `@sdxc/newsletter/middleware`

#### `newsletter(options: NewsletterMiddlewareOptions): Middleware`

The default export. Publishes `options.provider`, or a per-request factory's answer, as `context.newsletter` on a `remix/router` router, under the `CurrentNewsletter` context key it shares with `./middleware/cli`.

### `@sdxc/newsletter/middleware/cli`

#### `newsletter(options: NewsletterCommandOptions): CommandMiddleware`

The default export. Publishes `options.provider`, or `(ctx) => Newsletter` resolved once per run, as `ctx.newsletter` on an [`@sdxc/cli`](https://www.npmjs.com/package/@sdxc/cli) command, for subscribing or removing an address by hand.

```typescript
import { createCLI } from "@sdxc/cli";
import newsletter from "@sdxc/newsletter/middleware/cli";

let cli = createCLI({ name: "app", commands, middleware: [newsletter({ provider })] });
```

### `@sdxc/newsletter/buttondown`

#### `new ButtondownNewsletter(options: ButtondownNewsletterOptions)`

- `apiKey`: Buttondown API key; an empty key fails every call as `unauthenticated`.
- `webhookSecret`: the webhook's signing key.
- `confirmation`: `"double"` (default) or `"single"`.
- `connection`: name reported on errors; defaults to `"buttondown"`.
- `newsletterId`: the newsletter this instance serves; deliveries for another newsletter of the account carry no events.

#### `API_VERSION`

The Buttondown API version every request pins.

### `@sdxc/newsletter/kit`

#### `new KitNewsletter(options: KitNewsletterOptions)`

- `apiKey`: Kit v4 API key; an empty key fails every call as `unauthenticated`.
- `webhookSecret`: the webhook's signing secret.
- `form`: `{ id, confirmation }`, the form readers join through. `confirmation` must match the form's own double opt-in setting. Without a form, readers start `active` and attribution is dropped.
- `connection`: defaults to `"kit"`.

Metadata keys must already exist as Kit custom fields, and a subscribe can take several requests against Kit's rate limit.

### `@sdxc/newsletter/memory`

#### `new MemoryNewsletter(options?: MemoryNewsletterOptions)`

The whole contract in memory. Options: `confirmation` (default `"double"`), `connection` (default `"memory"`), `webhookSecret` (a built-in base64 secret by default; `""` makes every delivery unproven) and `faults`, failures armed from the first call. On top of the contract it adds:

- `seed(records)`: adds readers directly, `active` unless a `status` is given.
- `confirm(email)`: moves a `pending` reader to `active`.
- `fail(target, code?)` and `heal(target?)`: arm and disarm a failure on `"subscribers"` or one method such as `"subscribers.subscribe"` (default code `unknown`).
- `attribution(email)` and `ip(email)`: what the creating subscribe recorded, or `null`.
- `webhooks.emit(event)`: signs a Standard Webhooks delivery for one event and answers `{ request, body, events }`.

### `@sdxc/newsletter/conformance`

#### `conformance(options: ConformanceOptions): void`

Registers Vitest tests that hold a provider to the contract: one subscribe per address, lookups by id and email, tags, metadata merging, idempotent unsubscribe, a full cursor walk and fail-closed webhooks. Options: `name`, `create()`, `createWithoutSecret()`, `confirmation`, `deliver(provider, subscriber)`, and optional `metadataKeys`, `missingId` and `email()`.

### Types

#### `SubscriberApi`, `WebhookApi`

The `subscribers` and `webhooks` groups of `Newsletter`.

#### `Subscriber`

`id`, `email`, `status`, the platform's own `providerStatus`, `metadata` and `createdAt`.

#### `SubscriberStatus`

`"pending" | "active" | "unsubscribed" | "suppressed"`; `suppressed` is blocked, bounced or complained.

#### `SubscriberRef`

`{ id: string } | { email: EmailAddress }`.

#### `SubscribeInput`, `SubscribeOutcome`, `UpdateSubscriberInput`, `ListSubscribersQuery`, `Page<T>`

The inputs and answers of the subscriber methods above.

#### `SubscriberAttribution`

Optional `source`, `medium`, `campaign`, `term`, `content`, `referrer` and `landingPage` strings for a new reader.

#### `NewsletterEvent`, `NewsletterEventPayload`, `NewsletterEventType`, `NewsletterEventOf<Type>`

An inbound event: its `type`, the platform's event `id` (the deduplication key), `occurredAt`, `subscriberId`, `subscriber` (or `null` when the delivery carried only the id) and `raw`. `NewsletterEventOf` narrows the union to one type.

#### `NewsletterWebhookHandler<Type>`, `NewsletterWebhookHandlers`, `NewsletterWebhookOptions`

Handlers keyed by event type, so a misspelled key is a type error, and the endpoint's `store` and `ttl`.

#### `NewsletterErrorCode`, `NewsletterErrorOptions`

The normalized codes and what a provider passes to `new NewsletterError(message, options)`.

#### `NewsletterMiddlewareOptions`, `NewsletterCommandOptions`, `ButtondownNewsletterOptions`, `KitNewsletterOptions`, `KitForm`

Provider and middleware options listed above.

#### `MemoryNewsletterOptions`, `ConfirmationPolicy`, `MemorySubscriberSeed`, `MemoryFaultTarget`, `MemoryFaults`, `MemoryEmitEvent`, `MemoryDelivery`, `MemoryWebhookApi`

The memory provider's options, seeds, fault targets and emitted deliveries.

#### `ConformanceOptions`, `ConformanceDelivery`

What `conformance` needs to build and sign for a provider.

## Pattern: A subscribe form on a router

Publish the provider with the middleware, then branch on the two codes a visitor can act on.

```typescript
import { parseEmailAddress } from "@sdxc/email-address";
import { IP } from "@sdxc/ip";
import newsletter from "@sdxc/newsletter/middleware";
import { ButtondownNewsletter } from "@sdxc/newsletter/buttondown";
import { isFailure } from "@sdxc/result";
import { createRouter } from "remix/router";

let provider = new ButtondownNewsletter({ apiKey: process.env.BUTTONDOWN_API_KEY ?? "" });

let router = createRouter({ middleware: [newsletter({ provider })] });

router.post("/subscribe", async (context) => {
	let form = await context.request.formData();
	let email = parseEmailAddress(String(form.get("email") ?? ""));
	if (isFailure(email)) return new Response("Enter a valid email", { status: 422 });

	let outcome = await context.newsletter.subscribers.subscribe({
		email: email.data,
		ip: IP.parse(context.request.headers.get("cf-connecting-ip") ?? ""),
	});

	if (isFailure(outcome)) {
		if (outcome.error.code === "invalid_address") {
			return new Response("That address can't receive email", { status: 422 });
		}
		if (outcome.error.code === "suppressed") {
			return new Response("That address can't be subscribed", { status: 422 });
		}
		return new Response("Try again later", { status: 503 });
	}

	return new Response(
		outcome.data.subscriber.status === "pending" ? "Check your inbox" : "You're subscribed",
	);
});
```

For a list that varies per tenant, pass a factory instead: `newsletter({ provider: (context) => listFor(context) })`.

## Pattern: Testing against the memory provider

Install a `MemoryNewsletter` in place of the real provider, arm a failure, and assert on what it recorded.

```typescript
import newsletter from "@sdxc/newsletter/middleware";
import { MemoryNewsletter } from "@sdxc/newsletter/memory";
import { createRouter } from "remix/router";
import { expect, test } from "vitest";

import { subscribeHandler } from "./subscribe.js";

test("a blocked address sees the blocked copy", async () => {
	let provider = new MemoryNewsletter();
	provider.fail("subscribers.subscribe", "suppressed");

	let router = createRouter({ middleware: [newsletter({ provider })] });
	router.post("/subscribe", subscribeHandler);

	let response = await router.fetch(
		new Request("https://example.com/subscribe", {
			method: "POST",
			body: new URLSearchParams({ email: "reader@example.com" }),
		}),
	);

	expect(await response.text()).toContain("can't be subscribed");
	expect(provider.attribution("reader@example.com")).toBeNull();
});
```

## Pattern: Crediting the campaign a visitor arrived from

`attribution` records where a new reader came from. [`@sdxc/attribution`](https://www.npmjs.com/package/@sdxc/attribution) remembers a visitor's touches across pages: `toCampaign` flattens one touch into these fields and `toMetadata` keeps the first and last touches as metadata keys.

```typescript
import { toCampaign, toMetadata } from "@sdxc/attribution";
import { isFailure } from "@sdxc/result";

let outcome = await context.newsletter.subscribers.subscribe({
	email,
	attribution: toCampaign(touches.last ?? touches.first, context.url),
	metadata: toMetadata(touches),
	ip,
});

if (!isFailure(outcome) && outcome.data.created) {
	// attribution and metadata were recorded on the new reader
}
```

Without that package, pass the fields directly: `{ source: "newsletter", medium: "email", campaign: "launch", landingPage: context.url.href }`. On Kit, every metadata key must already exist as a custom field.

## Pattern: Reacting to webhook events

Mount a `NewsletterWebhook` and key handlers by event type. A throw answers `503`, and with a replay store the redelivery skips the events already handled.

```typescript
import { NewsletterWebhook } from "@sdxc/newsletter";
import { unwrap } from "@sdxc/result";
import { KVReplayStore } from "@sdxc/webhooks";
import { createRouter } from "remix/router";

let endpoint = new NewsletterWebhook(
	newsletter,
	{
		async "subscriber.confirmed"(event) {
			let reader =
				event.subscriber ?? unwrap(await newsletter.subscribers.find({ id: event.subscriberId }));
			await sendWelcome(reader.email);
		},
		async "subscriber.suppressed"(event) {
			await markUndeliverable(event.subscriberId);
		},
	},
	{ store: new KVReplayStore(kv, { prefix: "newsletter:" }), ttl: "14 days" },
);

let router = createRouter();
router.post("/webhooks/newsletter", endpoint.handler);
```

In a test, `MemoryNewsletter.webhooks.emit` signs a delivery to hand the endpoint:

```typescript
import { NewsletterWebhook } from "@sdxc/newsletter";
import { MemoryNewsletter } from "@sdxc/newsletter/memory";
import { unwrap } from "@sdxc/result";
import { RequestContext } from "remix/router";
import { expect, test } from "vitest";

test("a confirmation reaches its handler", async () => {
	let provider = new MemoryNewsletter();
	let [reader] = provider.seed([{ email: "reader@example.com", status: "pending" }]);
	let confirmed: string[] = [];

	let endpoint = new NewsletterWebhook(provider, {
		"subscriber.confirmed": (event) => {
			confirmed.push(event.subscriberId);
		},
	});

	let delivery = unwrap(
		await provider.webhooks.emit({ type: "subscriber.confirmed", subscriberId: reader.id }),
	);
	let response = await endpoint.handler(new RequestContext(delivery.request));

	expect(response.status).toBe(200);
	expect(confirmed).toEqual([reader.id]);
});
```

## Pattern: Walking the whole list from a job

Follow `cursor` until it is `null`, and wait out a `rate_limited` failure using the delay the platform named.

```typescript
import type { Newsletter, Subscriber } from "@sdxc/newsletter";

import { isFailure } from "@sdxc/result";

async function activeReaders(newsletter: Newsletter): Promise<Subscriber[]> {
	let readers: Subscriber[] = [];
	let cursor: string | undefined;

	while (true) {
		let page = await newsletter.subscribers.list({ status: "active", tag: "buyer", cursor });

		if (isFailure(page)) {
			if (!page.error.retryable) throw page.error;
			let delay = (page.error.retryAfter ?? 1) * 1000;
			await new Promise((resolve) => setTimeout(resolve, delay));
			continue;
		}

		readers.push(...page.data.items);
		if (page.data.cursor === null) return readers;
		cursor = page.data.cursor;
	}
}
```

## Pattern: Holding a custom provider to the contract

Implement `Newsletter` for another platform, reporting failures as `NewsletterError`, and run the same suite the bundled providers pass. `deliver` signs a delivery exactly as the platform would.

```typescript
import { conformance } from "@sdxc/newsletter/conformance";

import { AcmeNewsletter, signAcmeDelivery } from "./acme.js";

conformance({
	name: "AcmeNewsletter",
	create: () => new AcmeNewsletter({ apiKey: "test-key", webhookSecret: "test-secret" }),
	createWithoutSecret: () => new AcmeNewsletter({ apiKey: "test-key" }),
	confirmation: "double",
	deliver: async (provider, subscriber) => signAcmeDelivery("test-secret", subscriber),
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
		"@sdxc/newsletter": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
