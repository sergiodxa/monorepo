# @sdxc/newsletter

Vendor-neutral newsletter subscriber lists, with Buttondown and Kit providers, a memory provider for tests and a verified webhook endpoint.

## Installation

```sh
npm add @sdxc/newsletter
```

Addresses arrive parsed by [`@sdxc/email-address`](https://www.npmjs.com/package/@sdxc/email-address), and every answer is a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).

## Usage

Build one provider at module scope; construction reaches no network, so an empty API key fails the call that needed it, not the boot.

```typescript
import type { Newsletter } from "@sdxc/newsletter";

import { ButtondownNewsletter } from "@sdxc/newsletter/buttondown";

export let newsletter: Newsletter = new ButtondownNewsletter({
	apiKey: process.env.BUTTONDOWN_API_KEY ?? "",
	confirmation: "double",
});
```

Subscribe an address. One already on the list, in any status, is a success with `created: false`:

```typescript
import { parseEmailAddress } from "@sdxc/email-address";
import { isFailure } from "@sdxc/result";

let email = parseEmailAddress(form.get("email"));
if (isFailure(email)) return invalid();

let outcome = await newsletter.subscribers.subscribe({
	email: email.data,
	attribution: { source: "twitter", campaign: "launch" },
	ipAddress: request.headers.get("cf-connecting-ip"),
});

if (isFailure(outcome)) {
	if (outcome.error.code === "invalid_address") return invalid();
	if (outcome.error.code === "suppressed") return blocked();
	return unavailable();
}

outcome.data.subscriber.status; // "pending" until the reader confirms
```

Change a known reader. Tags are added and removed by name; a `null` metadata value removes the key:

```typescript
let updated = await newsletter.subscribers.update(
	{ email: email.data },
	{ tags: { add: ["buyer"] }, metadata: { purchase: "pro", trial: null } },
);

if (isFailure(updated) && updated.error.code === "not_found") {
	// the buyer never subscribed
}
```

Kit decides double opt-in by the form a reader is added through, so its provider names that form:

```typescript
import { KitNewsletter } from "@sdxc/newsletter/kit";

let kit = new KitNewsletter({
	apiKey: process.env.KIT_API_KEY ?? "",
	webhookSecret: process.env.KIT_WEBHOOK_SECRET,
	form: { id: "55", confirmation: "double" },
});
```

## API

### `Newsletter`

The contract every provider implements: `connection` (the configured credential set's name), `subscribers`, `webhooks`, and `native`, the underlying client for endpoints the contract leaves out.

### `subscribers.subscribe(input)`

Ensures an address is on the list. A new reader answers `created: true` and `status: "pending"` when a confirmation email went out, `"active"` otherwise; an address the platform already holds answers `created: false` with its record untouched, so tags, metadata and attribution apply only to a reader the call created. Repeating it after a timeout is safe.

### `subscribers.find(ref)`, `subscribers.tags(ref)`

Read one reader, or its tag names, by `{ id }` or `{ email }`. A reader the list does not hold is `not_found`. Tags are a separate read because some platforms serve them from a second endpoint.

### `subscribers.list(query?)`

One page of readers, filtered by `status` or `tag`, `DEFAULT_PAGE_SIZE` (100) at a time. Pass the page's `cursor` back for the next page; only `cursor === null` ends a walk.

### `subscribers.update(ref, input)`, `subscribers.unsubscribe(ref)`

Change a known reader, answering the stored result. Unsubscribing keeps the record and is idempotent; the contract offers no resubscribe, since an unsubscribe is revoked consent.

### `webhooks.verify(request, rawBody)`, `webhooks.events(request, rawBody)`

Whether the configured secret proves a delivery, and the events an authentic delivery carries. An unset secret proves nothing, and neither call reaches the network.

### `NewsletterError`

The error in every failed `Result`: a normalized `code`, the platform's `providerCode`, `connection`, `retryable` (only `rate_limited`) and `retryAfter` in seconds. `invalid_address` and `suppressed` are the refusals a visitor can act on; `unknown` is a timeout or 5xx after which the write may have landed.

### `NewsletterWebhook`

`new NewsletterWebhook(provider, handlers, { store?, ttl? })`, whose `handler` mounts as a route action. It answers `401` to an unproven delivery, acknowledges an authentic one it cannot parse, skips an event id the `ReplayStore` from [`@sdxc/webhooks`](https://www.npmjs.com/package/@sdxc/webhooks) has seen, and answers `503` when a handler throws so the platform redelivers. Handlers are keyed by event type, so a misspelled key is a type error.

### `@sdxc/newsletter/middleware`

`newsletter({ provider })` publishes the provider, or a per-request factory's answer, as `context.newsletter` on a Remix router.

### `@sdxc/newsletter/buttondown`

`ButtondownNewsletter({ apiKey, webhookSecret?, confirmation?, connection?, newsletterId? })`. The API version is fixed by the package. Buttondown signs deliveries without a timestamp, so an endpoint for it should configure a replay store.

### `@sdxc/newsletter/kit`

`KitNewsletter({ apiKey, webhookSecret?, form?, connection? })`. `form.confirmation` must match the form's own double opt-in setting. Metadata keys must already exist as Kit custom fields, and a new reader costs up to four requests against Kit's rate limit.

### `@sdxc/newsletter/memory`

`MemoryNewsletter({ confirmation?, connection?, webhookSecret?, faults? })` implements the whole contract in memory and adds `seed(records)`, `confirm(email)`, `fail(target, code?)`, `heal(target?)`, `attribution(email)`, `ipAddress(email)` and `webhooks.emit(event)`, which signs a Standard Webhooks delivery.

### `@sdxc/newsletter/conformance`

`conformance(options)` registers Vitest tests holding a provider to the contract's rules: one subscribe per address, lookups by id and email, tags, metadata merging, idempotent unsubscribe, a full cursor walk and fail-closed webhooks.

## Pattern: Testing a form against the memory provider

```typescript
import { parseEmailAddress } from "@sdxc/email-address";
import newsletter from "@sdxc/newsletter/middleware";
import { MemoryNewsletter } from "@sdxc/newsletter/memory";
import { unwrap } from "@sdxc/result";
import { createRouter } from "remix/router";
import { expect, test } from "vitest";

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

## Pattern: Reacting to confirmations

```typescript
import { NewsletterWebhook } from "@sdxc/newsletter";
import { unwrap } from "@sdxc/result";
import { KVReplayStore } from "@sdxc/webhooks";

export default new NewsletterWebhook(
	newsletter,
	{
		async "subscriber.confirmed"(event) {
			/** A throw answers 503, so the platform redelivers once the read succeeds. */
			let reader =
				event.subscriber ?? unwrap(await newsletter.subscribers.find({ id: event.subscriberId }));
			await sendWelcome(reader);
		},
	},
	{ store: new KVReplayStore(env.WEBHOOKS, { prefix: "newsletter:" }) },
);
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
