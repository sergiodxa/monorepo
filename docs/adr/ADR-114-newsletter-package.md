# ADR-114: Newsletter Package

## Status

**Accepted** - 2026-10-07

## Background

`apps/books` reaches its newsletter through a hand-written Buttondown client in
`app/services/buttondown.ts`. It answers three questions the funnel asks — is this address on
the list, subscribe it with its UTM attribution and IP, merge metadata onto it — and it throws
on every failure, so each caller wraps it in `try`/`catch` and branches on a Buttondown error
code by name. The vendor's vocabulary reaches two controllers, a use case, a billing webhook
handler and a test fake that subclasses the real client so `vi.mock` can swap it in.

Every other app that grows an email form will need the same three calls, and the repo already
has a shape for "one contract, several vendors": `@sdxc/billing` for payment platforms and
`@sdxc/mail` for transports. A newsletter is the same problem with a smaller surface. Writing
the contract now, while it has one consumer, lets that consumer stop naming a vendor and lets a
second vendor arrive as a construction site rather than as a rewrite.

## Context

### Current implementation

| Location                                            | What it does                                                                                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/books/app/services/buttondown.ts`             | `Buttondown` class over the global `fetch`: `isSubscribed`, `subscribe`, `addMetadata`; pins `x-api-version`; throws `ButtondownError(detail, code)` |
| `apps/books/app/lib/buttondown.ts`                  | Builds a client per call, so a missing `BUTTONDOWN_API_KEY` fails the request that needed it rather than the isolate                                 |
| `apps/books/app/services/subscribe.ts`              | Checks `isSubscribed`, then subscribes; converts the exceptions into a `Result<"subscribed" \| "already-subscribed", Error>`                         |
| `apps/books/app/http/controllers/subscribe.tsx`     | Maps `subscriber_blocked` and `email_invalid` to visitor copy, and treats `email_already_exists` as success                                          |
| `apps/books/app/http/controllers/sample.tsx`        | The same mapping, repeated                                                                                                                           |
| `apps/books/app/http/controllers/webhooks/polar.ts` | On `order.paid`, reads the buyer's address and, when Buttondown knows it, merges `{ purchase: tier }` into the subscriber's metadata                 |
| `apps/books/app/lib/attribution.ts`                 | Reads `utm_source`, `utm_campaign`, `utm_medium`, `utm_referral` off the page URL so forms carry them as hidden fields                               |
| `apps/books/app/lib/test/buttondown.ts`             | `FakeButtondown extends Buttondown`, installed with `vi.mock("~/app/lib/buttondown")`                                                                |
| `apps/books/app/services/buttondown.test.ts`        | MSW tests for the real client: URL, method, `Authorization: Token …`, the pinned version header, the error envelope, the 403                         |

### Issues identified

| Issue                                                               | Impact                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| The client throws                                                   | Every caller re-wraps it in `try`/`catch`, against the repo's `@sdxc/result` rule                                                     |
| Buttondown's codes reach controllers                                | `"subscriber_blocked"` and `"email_invalid"` are string literals in two controllers; a second vendor means rewriting both             |
| "Already subscribed" is both a pre-check and an error code          | Two code paths (`isSubscribed` and `email_already_exists`) answer the same question, and the race between them is handled twice       |
| `isSubscribed` answers `true` for any known address                 | An address that unsubscribed reads as subscribed; the caller cannot tell a pending confirmation from an active reader                 |
| The test fake subclasses the client and is installed with `vi.mock` | Bypasses the request context (ADR-057), and the fake's behavior is whatever each test scripted, never checked against the real client |
| No inbound events                                                   | The app cannot learn that a reader confirmed or left without polling                                                                  |
| The client sits beside the app, not on `@sdxc/api-client`           | Its own URL joining and header handling, and no trace propagation                                                                     |

### Shapes the repo already has

`@sdxc/billing` (ADR-043) is the model to follow:

- One contract (`Billing`) grouped by resource, with `connection` and `native`.
- Every method answers `Result<T, BillingError>`; one error class with a normalized `code`, the
  platform's `providerCode`, `retryable` and `retryAfter`.
- Providers are classes that extend `APIClient` and implement the contract, built once at module
  scope with nothing reaching the network in the constructor.
- A memory provider that is a full implementation, plus a conformance suite every provider runs.
- Router middleware publishing `context.billing`, and a webhook endpoint class that verifies,
  deduplicates and dispatches to a handler map derived from the event union.

`@sdxc/mail` (ADR-018) contributes the flat subpath naming for providers (`@sdxc/mail/memory`,
`@sdxc/mail/cloudflare`), which suits a package whose providers have no sub-modules worth a
`providers/` folder in the import path.

### Choosing a second provider

A contract written against one vendor tends to be that vendor's API with the names changed.
The second provider is chosen to differ from Buttondown where it matters to the contract:

| Dimension                  | Buttondown                                                         | Kit (v4)                                                                                     | Resend Contacts              | Mailchimp Marketing                  | Beehiiv                        | Loops                  | EmailOctopus                 |
| -------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------ | ------------------------------ | ---------------------- | ---------------------------- |
| Existing address on create | `400 email_already_exists` (collision header opts into merge)      | Upsert: `200` for an existing address                                                        | Not documented               | `PUT` by MD5 hash upserts            | `reactivate_existing` flag     | `409`                  | `PUT` upserts                |
| Double opt-in              | Per call: `type: "unactivated"` (default) or `"regular"`           | A property of the form the subscriber is added through; subscriber stays `inactive`          | None                         | Per call: `status: "pending"`        | `double_opt_override` per call | None via API           | `pending` status             |
| Tags                       | Names inline on the subscriber                                     | Resources with ids; tagging is `POST /tags/{id}/subscribers`; tags read by a second endpoint | Segments and topics, no tags | Tags endpoint per member             | Tags                           | Mailing lists          | Tags inline                  |
| Custom data                | Free-form `metadata`                                               | Custom fields that must exist before a value is written                                      | `properties`                 | Merge fields defined on the audience | Pre-created custom fields      | Pre-created properties | List fields                  |
| Pagination                 | Page numbers                                                       | Opaque cursors (`after`, `end_cursor`)                                                       | —                            | Offset                               | —                              | —                      | —                            |
| Webhook signature          | `X-Buttondown-Signature: sha256=…`, HMAC of the body, no timestamp | `X-Kit-Signature: t=…,v1=…`, HMAC of `t.body`, several `v1` during rotation                  | Svix (Standard Webhooks)     | `X-Mailchimp-Signature: t=…,v1=…`    | —                              | —                      | Not documented               |
| Webhook payload            | One event; ids only (`newsletter`, `subscriber`)                   | A batch of 1–100 events, each carrying the full subscriber                                   | One event                    | One event                            | —                              | —                      | —                            |
| Rate limit                 | `429`                                                              | 120 requests per rolling 60 s per API key                                                    | —                            | —                                    | —                              | —                      | 10/s sustained, burst of 100 |

**Kit is the second provider.** It differs from Buttondown on almost every axis the contract has
to abstract — upsert versus conflict, double opt-in as configuration versus a per-call flag,
tags as id-addressed resources read by a separate call, custom fields that must pre-exist,
cursors versus page numbers, a timestamped signature with rotation, and batched deliveries that
carry the whole subscriber — while still being a newsletter platform someone running a book
funnel would plausibly move to. Mailchimp is the closest runner-up but adds an audience
dimension and MD5-hashed member ids that a single-list contract does not need. Resend and Loops
lack API double opt-in, so they would prove less; EmailOctopus is close enough to Buttondown
that it would prove little.

## Decision

Add `@sdxc/newsletter`: one vendor-neutral contract for a newsletter's subscriber list, a full
in-memory provider, a Buttondown provider and a Kit provider built on `@sdxc/api-client`, router
middleware publishing `context.newsletter`, a webhook endpoint that verifies and deduplicates
inbound events, and a conformance suite every provider runs.

### Entry points

| Entry                          | Contents                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `@sdxc/newsletter`             | Models, the `Newsletter` contract, `NewsletterError`, `NewsletterWebhook`, `DEFAULT_PAGE_SIZE` |
| `@sdxc/newsletter/middleware`  | Default export publishing `context.newsletter`                                                 |
| `@sdxc/newsletter/memory`      | `MemoryNewsletter`                                                                             |
| `@sdxc/newsletter/buttondown`  | `ButtondownNewsletter`                                                                         |
| `@sdxc/newsletter/kit`         | `KitNewsletter`                                                                                |
| `@sdxc/newsletter/conformance` | `conformance(options)`, registering Vitest tests against any provider                          |

Providers are never re-exported from the root, so a bundle resolves only the one it imports,
and the conformance suite's `vitest` import stays out of production bundles.

### The contract

```ts
import type { EmailAddress } from "@sdxc/email-address";
import type { IP } from "@sdxc/ip";
import type { Result } from "@sdxc/result";

interface Newsletter {
	/** The configured credential set, stored beside any subscriber id kept locally. */
	readonly connection: string;
	readonly subscribers: SubscriberApi;
	readonly webhooks: WebhookApi;
	/** The underlying client, for endpoints the contract omits. */
	readonly native: unknown;
}

interface SubscriberApi {
	subscribe(input: SubscribeInput): Promise<Result<SubscribeOutcome, NewsletterError>>;
	find(subscriber: SubscriberRef): Promise<Result<Subscriber, NewsletterError>>;
	list(query?: ListSubscribersQuery): Promise<Result<Page<Subscriber>, NewsletterError>>;
	tags(subscriber: SubscriberRef): Promise<Result<string[], NewsletterError>>;
	update(
		subscriber: SubscriberRef,
		input: UpdateSubscriberInput,
	): Promise<Result<Subscriber, NewsletterError>>;
	unsubscribe(subscriber: SubscriberRef): Promise<Result<Subscriber, NewsletterError>>;
}

interface WebhookApi {
	verify(request: Request, rawBody: string): Promise<boolean>;
	events(request: Request, rawBody: string): Result<NewsletterEvent[], NewsletterError>;
}

type SubscriberRef = { id: string } | { email: EmailAddress };
```

### Models

```ts
type SubscriberStatus = "pending" | "active" | "unsubscribed" | "suppressed";

interface Subscriber {
	id: string;
	/** The address as the platform stores it. */
	email: string;
	status: SubscriberStatus;
	/** The platform's own state, for logs and support tickets. */
	providerStatus: string;
	metadata: Readonly<Record<string, string>>;
	createdAt: Date;
}

interface SubscribeInput {
	email: EmailAddress;
	tags?: readonly string[];
	metadata?: Readonly<Record<string, string>>;
	attribution?: SubscriberAttribution;
	/** The visitor's address, for platforms that screen sign-ups by IP. */
	/** The result of `IP.parse` is accepted as it is; a failed parse records no address. */
	ip?: IP | Result<IP, IP.Error> | null;
}

interface SubscribeOutcome {
	subscriber: Subscriber;
	/** `false` when the address was already on the list, in any status. */
	created: boolean;
}

interface UpdateSubscriberInput {
	tags?: { add?: readonly string[]; remove?: readonly string[] };
	/** Merged into the stored metadata; a `null` value removes that key. */
	metadata?: Readonly<Record<string, string | null>>;
}

interface ListSubscribersQuery {
	status?: SubscriberStatus;
	tag?: string;
	limit?: number;
	cursor?: string;
}

interface Page<T> {
	items: T[];
	cursor: string | null;
}
```

**`subscribe` ensures an address is on the list.** An address the platform already holds, in
any status, answers `success({ subscriber, created: false })` with the record unchanged: tags,
metadata and attribution apply only to a subscriber this call created. That is the
"already-subscribed is a success" rule `apps/books` implements by hand today, made the
contract, and it closes the race between a pre-check and a create. A reader who unsubscribed
comes back as `status: "unsubscribed"`; the contract offers no resubscribe, because both
platforms treat an unsubscribe as revoked consent.

**Confirmation is configuration, and `status` reports it.** Buttondown takes double opt-in per
call; Kit decides it by the form a subscriber is added through. The contract follows the
stricter of the two: each provider instance is configured with one confirmation policy, and a
new subscriber answers `pending` when a confirmation email went out and `active` when it did
not. An app that needs both policies, such as single opt-in for a buyer who consented at
checkout, configures two instances with two `connection` names.

**Status is normalized to four values,** with the platform's own value in `providerStatus`:

| `status`       | Buttondown `type`                                                                                                                              | Kit `state`             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `pending`      | `unactivated`                                                                                                                                  | `inactive`              |
| `active`       | `regular` and the paid and lifecycle types (`premium`, `gifted`, `trialed`, `churning`, `churned`, `past_due`, `paused`, `unpaid`, `upcoming`) | `active`                |
| `unsubscribed` | `unsubscribed`                                                                                                                                 | `cancelled`             |
| `suppressed`   | `blocked`, `complained`, `undeliverable`, `removed`                                                                                            | `bounced`, `complained` |

A platform value outside the table is a mapping gap, not a subscriber state: `find` answers
`invalid_response`, and `list` skips that row and logs `newsletter.skipped_row`, the same rule
`@sdxc/billing` uses for a product it cannot map.

**Tags are read separately.** `Subscriber` carries no tags because Kit answers them from a
second endpoint, and a `list` that read them per row would spend Kit's 120-requests-a-minute
budget on one page. `tags(ref)` reads them when a caller needs them, and `list({ tag })` filters
by one. `update` adds and removes tags by name; the Kit provider resolves a name to an id with
Kit's create-tag call, which is idempotent on the name, and remembers the id for the life of the
instance.

**Metadata is string to string,** the common ground between Buttondown's free-form metadata and
Kit's custom fields. On Kit a key must already exist as a custom field: `update` with an unknown
key answers `invalid_request`, and `subscribe` — where Kit creates the subscriber and reports
the unknown key as a warning — logs `newsletter.metadata_dropped` and answers the subscriber as
Kit stored it.

**Addresses arrive parsed.** `SubscribeInput.ip` is an `IP` from `@sdxc/ip`, the type
`ctx.ip` already carries, or the `Result` of `IP.parse` handed over as it is, which spares the
caller unwrapping a header; a failed parse records no address, and providers send the canonical
spelling. `SubscribeInput.email` and
the `{ email }` arm of `SubscriberRef` are an `EmailAddress` from `@sdxc/email-address`, so normalization happens once at the boundary
that received the input. Providers send `address` (the form RFC 5321 says to deliver to), and
`MemoryNewsletter` keys its records on `canonical`, so a lookup differing only in local-part
case finds the same reader. A caller holding a raw string, such as an order's customer email,
parses it with `parseEmailAddress` first.

**Lists page by an opaque cursor.** Buttondown's page number and Kit's `end_cursor` both become
`Page.cursor`, and only `cursor === null` ends a walk. `DEFAULT_PAGE_SIZE` is `100`, applied
when a caller names no `limit`. `@sdxc/pagination` pages a `remix/data-table` query, so it has
nothing to offer a remote cursor; the `Page` shape matches `@sdxc/billing`'s instead.

### Attribution

`SubscriberAttribution` is the hook for campaign data, declared here so this package depends on
no attribution package:

```ts
interface SubscriberAttribution {
	source?: string;
	medium?: string;
	campaign?: string;
	term?: string;
	content?: string;
	/** The page that sent the visitor: a URL, or a hostname when that is all that was kept. */
	referrer?: string;
	/** The absolute URL of the page the form was on. */
	landingPage?: string;
}
```

The five campaign fields are the names `Utm` uses in `@sdxc/attribution` (ADR-110), and every
field is an optional string, so a touch's `utm` passes as it is and its extra fields are
ignored. An app with its own reader (`apps/books/app/lib/attribution.ts`) passes an object
literal instead. Normalizing the values — slugging them, refusing one that holds an address —
is the attribution package's job; this package writes what it is handed.

```ts
let touch = ctx.attribution.first ?? ctx.attribution.current;

await ctx.newsletter.subscribers.subscribe({
	email: payload.email,
	attribution: {
		...touch?.utm,
		referrer: touch?.referrer?.host,
		landingPage: touch ? new URL(touch.landingPath, ctx.url).href : undefined,
	},
	metadata: toMetadata(ctx.attribution), // first_* and last_* keys, for a richer record
	ip: ctx.ip,
});
```

Each provider writes what its platform has a place for:

| Field                          | Buttondown                                      | Kit                                                                                                                     | Memory   |
| ------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| `source`, `medium`, `campaign` | `utm_source`, `utm_medium`, `utm_campaign`      | Appended as `utm_*` to the `landingPage` sent as the form's `referrer`, which Kit parses into `referrer_utm_parameters` | Recorded |
| `term`, `content`              | Metadata keys `utm_term`, `utm_content`         | Same as above                                                                                                           | Recorded |
| `referrer`, `landingPage`      | `referrer_url` (`referrer`, else `landingPage`) | `landingPage` is the form's `referrer`; `referrer` has no field                                                         | Recorded |
| `ip`                           | `ip_address`                                    | No field; dropped                                                                                                       | Recorded |

Kit records attribution only through a form and a landing page; without either, the provider
logs `newsletter.attribution_dropped`. On Kit, `toMetadata`'s keys must exist as custom fields,
per the metadata rule above.

### Errors

```ts
type NewsletterErrorCode =
	| "not_found"
	| "invalid_address"
	| "suppressed"
	| "invalid_request"
	| "unauthenticated"
	| "forbidden"
	| "rate_limited"
	| "invalid_response"
	| "unsupported"
	| "unknown";

class NewsletterError extends Error {
	readonly code: NewsletterErrorCode;
	readonly connection: string;
	readonly providerCode: string | null;
	readonly retryable: boolean;
	readonly retryAfter: number | null;
}
```

`invalid_address` and `suppressed` exist because they are the two refusals a visitor can act on
— the copy `apps/books` shows for `email_invalid` and `subscriber_blocked`. Only `rate_limited`
is retryable, and `retryAfter` carries the platform's `Retry-After` seconds; the provider never
retries on its own, so a job decides with `ctx.retry` and `@sdxc/backoff` (ADR-106). `unknown`
is a timeout or a 5xx, after which the write may have landed; `subscribe` is safe to repeat
because an existing address is a success, `update`'s tag add and remove are idempotent, and an
unsubscribe of an unsubscribed reader succeeds, which is why the contract has no idempotency
key. An empty API key answers `unauthenticated` without reaching the network, so an isolate
missing the secret still boots.

### `@sdxc/newsletter/buttondown`

`ButtondownNewsletter` extends `APIClient` and implements `Newsletter`; `native` is the instance,
so its verb methods reach any endpoint the contract omits.

```ts
import type { Newsletter } from "@sdxc/newsletter";

import { ButtondownNewsletter } from "@sdxc/newsletter/buttondown";
import { env } from "cloudflare:workers";

export let newsletter: Newsletter = new ButtondownNewsletter({
	apiKey: env.BUTTONDOWN_API_KEY,
	webhookSecret: env.BUTTONDOWN_WEBHOOK_SECRET,
	confirmation: "double", // the default; "single" sends `type: "regular"`
});
```

```ts
const API_VERSION = "…"; // the version the response schemas are written against

export class ButtondownNewsletter extends APIClient implements Newsletter {
	readonly connection: string;
	readonly subscribers: SubscriberApi;
	readonly webhooks: WebhookApi;

	constructor(options: ButtondownOptions) {
		super(new URL("https://api.buttondown.com/v1/"));
		/* … */
	}

	protected override async before(request: Request): Promise<Request> {
		request.headers.set("Authorization", `Token ${this.apiKey}`);
		request.headers.set("X-API-Version", API_VERSION);
		request.headers.set("Content-Type", "application/json");
		return request;
	}

	get native(): this {
		return this;
	}
}
```

- **The API version is a package constant, not an option.** Buttondown transforms requests and
  responses to the version a request names, and the provider's `remix/data-schema` schemas are
  written for exactly one; a configurable version is a configurable way to fail parsing. The
  version is chosen in Phase 2 and the wire fields (`email_address` or `email`, `type`, `tags`,
  `metadata`, `utm_*`, `ip_address`, `referrer_url`) checked against it. `apps/books` stops
  pinning `BUTTONDOWN_API_VERSION` itself.
- **`subscribe`** is `POST subscribers`. A `400 email_already_exists` is followed by
  `GET subscribers/{email}` and answered `created: false`; `email_invalid` maps to
  `invalid_address`; `subscriber_blocked` and `subscriber_suppressed` map to `suppressed`. The
  collision header is never sent, since `add` would resubscribe someone who left.
- **`unsubscribe`** is `PATCH subscribers/{id_or_email}` with `type: "unsubscribed"`.
  `DELETE` erases the subscriber on current API versions, which the contract does not offer.
- **`update`** reads the subscriber, merges tags and metadata, and writes them back in one
  `PATCH`, so the contract's add/remove and merge semantics hold whether Buttondown replaces or
  merges those fields.
- **Statuses:** `401` is `unauthenticated`, `403` (a revoked or misscoped key, today's
  `"Forbidden"` throw) is `forbidden`, `404` is `not_found`, `429` is `rate_limited`, other 4xx
  are `invalid_request`, 5xx and network failures are `unknown`, and a 2xx failing its schema is
  `invalid_response`.
- **Webhooks:** `verify` computes HMAC-SHA256 of the raw body with `webhookSecret` through
  `@sdxc/crypto` and compares it in constant time with `X-Buttondown-Signature`'s `sha256=`
  value. An unset or empty secret fails closed: every delivery is unproven.

### `@sdxc/newsletter/kit`

`KitNewsletter` extends `APIClient` against `https://api.kit.com/v4/`, authenticating with
`X-Kit-Api-Key`.

```ts
import { KitNewsletter } from "@sdxc/newsletter/kit";

let kit: Newsletter = new KitNewsletter({
	apiKey: env.KIT_API_KEY,
	webhookSecret: env.KIT_WEBHOOK_SECRET,
	form: { id: "55", confirmation: "double" },
});
```

- **`form`** is the form every subscription goes through, carrying attribution as Kit's
  `referrer`. Its `confirmation` must match the form's own double opt-in setting in Kit, since
  that setting decides whether the incentive email goes out. Without `form`, subscribers are
  created `active`.
- **`subscribe`** looks the address up (`GET subscribers?email_address=…&status=all`) and answers
  `created: false` when Kit holds it, because Kit's create is an upsert that would rewrite an
  existing reader's fields. Otherwise it creates the subscriber (`state: "inactive"` under a
  double opt-in form), adds it to the form, and applies tags. That is up to four requests for a
  new reader, against a budget of 120 a minute per key.
- **`unsubscribe`** is `POST subscribers/{id}/unsubscribe`; an `{ email }` ref is resolved to an
  id first.
- **Pagination** passes `after` and reads `pagination.end_cursor` and `has_next_page`.
- **Statuses:** `401` is `unauthenticated`, `404` is `not_found`, `422` is `invalid_request`
  (Kit has no code distinguishing an invalid address), `413` and `429` are `rate_limited`, 5xx is
  `unknown`.
- **Webhooks:** `verify` parses `X-Kit-Signature`, rejects a `t` outside five minutes, computes
  HMAC-SHA256 of `` `${t}.${rawBody}` `` hex-encoded, and accepts the delivery when any `v1` entry
  matches, so Kit's secret rotation needs no code change. `events` answers one normalized event
  per entry in the delivery's `events` array.

### Events

```ts
type NewsletterEventPayload =
	| { type: "subscriber.created" }
	| { type: "subscriber.confirmed" }
	| { type: "subscriber.unsubscribed" }
	| { type: "subscriber.suppressed" }
	| { type: "subscriber.updated" }
	| { type: "subscriber.deleted" }
	| { type: "unrecognized"; providerType: string };

type NewsletterEvent = NewsletterEventPayload & {
	/** The platform's event id: the deduplication key across redeliveries. */
	id: string;
	occurredAt: Date | null;
	subscriberId: string;
	/** The subscriber as the delivery described it, when the platform sent one. */
	subscriber: Subscriber | null;
	raw: unknown;
};
```

| Normalized                | Buttondown                                                                 | Kit                                                                                       |
| ------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `subscriber.created`      | `subscriber.created`                                                       | `subscriber.created`                                                                      |
| `subscriber.confirmed`    | `subscriber.confirmed`                                                     | `subscriber.activated`                                                                    |
| `subscriber.unsubscribed` | `subscriber.unsubscribed`                                                  | `subscriber.unsubscribed`                                                                 |
| `subscriber.suppressed`   | `subscriber.bounced`, `subscriber.complained`                              | `subscriber.bounced`, `subscriber.complained`                                             |
| `subscriber.updated`      | `subscriber.updated`, `subscriber.tags.changed`, `subscriber.type.changed` | `subscriber.tag_added`, `subscriber.tag_removed`, `subscriber.custom_field_value_updated` |
| `subscriber.deleted`      | `subscriber.deleted`                                                       | —                                                                                         |

A delivery entry that names no subscriber (Buttondown's `email.sent`, Kit's `tag.created`) is
left out of `events`, so `subscriberId` is always a reader's id and the delivery is still
acknowledged. `subscriber` is `null` on Buttondown, whose deliveries name only the subscriber's id; a handler
that needs the record calls `subscribers.find({ id: event.subscriberId })`. Parsing stays free
of network calls, so a forged or malformed delivery never costs an API request. An authentic
event outside the table arrives as `unrecognized`, so a type the platform adds is a no-op
rather than a failing endpoint the platform disables.

### `NewsletterWebhook`

```ts
import { NewsletterWebhook } from "@sdxc/newsletter";
import { KVReplayStore } from "@sdxc/webhooks";

export default new NewsletterWebhook(
	newsletter,
	{
		async "subscriber.confirmed"(event, context) {
			context.log.set({ subscriber: { id: event.subscriberId } });
		},
	},
	{ store: new KVReplayStore(env.WEBHOOKS, { prefix: "newsletter:" }) },
);
```

One request, in order: read the body once; ask the provider to verify it, answering `401` for
an unproven delivery; normalize it into events, logging and acknowledging an authentic body
that cannot be parsed; then, for each event, skip an id the `store` has seen, run the handler
keyed by its type, and remember the id once that handler finishes. A handler that throws
answers `503`, so the platform redelivers; Kit re-sends the whole batch, and the ids already
remembered are skipped. The store is `ReplayStore` from `@sdxc/webhooks` (ADR-026), so
`KVReplayStore` works unchanged, and `ttl` defaults to `"7 days"`. `401` is the only closed door,
the same rule `BillingWebhook` follows. The handler map is derived from the event union, so a
misspelled key is a type error.

Buttondown's signature carries no timestamp, so a captured delivery stays valid forever; the
store is what bounds a replay, and an endpoint for that provider should configure one.

### `@sdxc/newsletter/middleware`

```ts
import newsletter from "@sdxc/newsletter/middleware";

let router = createRouter({ middleware: [newsletter({ provider: buttondown })] });
```

It publishes the provider as `context.newsletter`, typed by an augmentation the module
declares, which is how a handler reaches it and how a test installs `MemoryNewsletter`
(ADR-057).

### `@sdxc/newsletter/memory`

`MemoryNewsletter` implements the whole contract and passes the conformance suite, so state a
call writes is state the next call reads.

```ts
import { MemoryNewsletter } from "@sdxc/newsletter/memory";

let newsletter = new MemoryNewsletter({ confirmation: "double" });
newsletter.seed([{ email: "reader@example.com", status: "active" }]);
newsletter.fail("subscribers.subscribe", "suppressed");

let delivery = await unwrap(
	newsletter.webhooks.emit({ type: "subscriber.confirmed", subscriberId: "sub_1" }),
);
await endpoint.handler(new RequestContext(delivery.request));
```

Beyond the contract it adds `seed(records)`, `confirm(email)` (a reader clicking the
confirmation link), `fail(target, code?)` and `heal(target?)` with targets typed from the
contract's own method names, `attribution(email)` and `ip(email)` reading back what a
subscribe recorded, and `webhooks.emit(payload)`, which signs a delivery with Standard Webhooks
through `@sdxc/webhooks` so a test drives a real endpoint through a real signature check.

### `@sdxc/newsletter/conformance`

`conformance({ name, create, email? })` registers the suite: an address subscribes once and a
second subscribe answers `created: false` unchanged; `find` by id and by email agree; a missing
subscriber is `not_found`; a new subscriber's status matches the configured confirmation; tags
added and removed by name read back through `tags`; metadata merges and `null` removes a key;
`unsubscribe` is idempotent; a cursor walk reaches every subscriber; an unproven delivery fails
closed, including with no secret configured; and an authentic delivery normalizes to events.
The Buttondown and Kit providers run it against MSW handlers that model each platform's
documented behavior.

### Dependencies

| Dependency            | Used for                                                                  |
| --------------------- | ------------------------------------------------------------------------- |
| `@sdxc/api-client`    | Base class of both network providers; trace propagation                   |
| `@sdxc/crypto`        | `hmac`, `Hex`, `timingSafeEqual` for both signature schemes               |
| `@sdxc/email-address` | `EmailAddress` in the contract                                            |
| `@sdxc/ip`            | `IP` in the contract, for the visitor's address                           |
| `@sdxc/logger`        | `currentLog()` notes: `newsletter.subscribe`, `newsletter.skipped_row`, … |
| `@sdxc/result`        | Every answer                                                              |
| `@sdxc/validate`      | `remix/data-schema` parsing of every response and delivery body           |
| `@sdxc/webhooks`      | `ReplayStore`, and Standard Webhooks signing for the memory provider      |
| `remix`               | `remix/data-schema`, the middleware and the endpoint's `RequestContext`   |

The package starts `private: true` and is made public once `apps/books` runs on it and the
contract has stopped moving; every dependency above is already public.

### Testing

- **Providers** are tested with MSW (`setupServer` from `msw/node`) against
  `https://api.buttondown.com/v1/*` and `https://api.kit.com/v4/*`, asserting the request a
  provider sends (URL, method, `Authorization` or `X-Kit-Api-Key`, the version header, body) and
  its reading of each documented status and error envelope. `apps/books/app/services/buttondown.test.ts`
  moves into the package as the first of these.
- **Signatures** are tested with deliveries signed in the test by the platform's documented
  scheme: a valid one, a tampered body, a wrong secret, an empty secret, and for Kit a stale `t`
  and a rotation header with two `v1` entries.
- **Apps** install `MemoryNewsletter` on the context and assert on its state. No app test mocks
  outbound HTTP for the newsletter or replaces a module with `vi.mock`.

### `apps/books` after migration

```ts
let outcome = await ctx.newsletter.subscribers.subscribe({
	email: payload.email,
	attribution: { source: payload.source, campaign: payload.campaign, medium: payload.medium },
	ip: ctx.ip,
});

if (isFailure(outcome)) {
	if (outcome.error.code === "suppressed")
		return renderHome(ctx, { error: BLOCKED_MESSAGE, status: 400 });
	if (outcome.error.code === "invalid_address")
		return renderHome(ctx, { error: INVALID_MESSAGE, status: 400 });
	log.fail(outcome.error);
	return renderHome(ctx, { error: GENERIC_MESSAGE, status: 400 });
}

log.set({ subscribe: { result: outcome.data.created ? "subscribed" : "already-subscribed" } });
return redirect(routes.release.href(), { status: redirect.Status.SeeOther });
```

The paid-order handler:

```ts
let address = parseEmailAddress(email);
if (isFailure(address)) return log.note("order.untagged", { reason: "invalid_email" });

let tagged = await context.newsletter.subscribers.update(
	{ email: address.data },
	{ metadata: { purchase: tier } },
);

if (isFailure(tagged) && tagged.error.code !== "not_found") throw tagged.error;
log.set({ order: { tagged: isSuccess(tagged) } });
```

One `update` replaces the `isSubscribed` and `addMetadata` pair; `not_found` is the "buyer never
subscribed" branch, and any other failure is thrown so `BillingWebhook` answers `503` and Polar
redelivers.

## Consequences

### Positive

- **No vendor names past one module.** Controllers branch on `suppressed` and
  `invalid_address`; Buttondown appears in `app/lib/newsletter.ts` and the bindings.
- **Already-subscribed is one rule.** The pre-check, the `email_already_exists` branch and their
  race collapse into `created: false`.
- **Status is visible.** A caller can tell a pending confirmation, an active reader, someone who
  left and a suppressed address apart, which `isSubscribed` could not.
- **Results everywhere.** No `try`/`catch` around newsletter calls.
- **Tests exercise real behavior.** `MemoryNewsletter` passes the same suite as the network
  providers, so a controller test cannot pass against behavior the real platform lacks.
- **Inbound events.** Confirmations and unsubscribes reach an app with verification, replay
  protection and typed handlers.
- **Shared plumbing.** Both providers inherit `APIClient`'s trace propagation and hooks.

### Negative

- **Kit's subscribe costs up to four requests** for a new reader, against 120 a minute per API
  key; a high-traffic form on Kit would want OAuth's 600.
- **Kit cannot report an invalid address distinctly,** so the funnel's "invalid address" copy
  degrades to the generic message on that provider.
- **Confirmation policy is per instance.** Mixing single and double opt-in means two instances.
- **`update` on Buttondown is read-then-write,** so two concurrent updates to one subscriber can
  lose a tag. Neither consumer updates a subscriber concurrently today.
- **Buttondown deliveries are replayable without a store,** since its signature has no
  timestamp.
- **Two network providers to maintain,** one of which has no consumer.

### Neutral

- **`apps/books` drops `BUTTONDOWN_API_VERSION`;** the version moves into the package.
- **No delete in the contract.** Erasing a subscriber goes through `native`.
- **Credentials are plain strings.** `env` is readable at module scope, and an empty key fails per
  call rather than at construction.
- **Attribution is structural.** The package names no attribution package; ADR-110's `Utm`
  passes as it is, and its first and last touches travel through `metadata`.

## Implementation Plan

### Phase 1: Contract, memory provider and endpoint

**Priority:** High
**Estimated Effort:** 5 hours

1. Create `packages/newsletter` (`private: true`) with the models, `Newsletter`,
   `NewsletterError`, `DEFAULT_PAGE_SIZE`, `NewsletterWebhook` and the middleware.
2. Write `MemoryNewsletter` and the conformance suite, and run the suite against it.
3. Test `NewsletterWebhook` through `MemoryNewsletter.webhooks.emit`: an unproven delivery,
   an unparseable authentic one, a redelivered id, a throwing handler, an `unrecognized` type.
4. Write the README following `docs/guides/package-documentation.md`.

### Phase 2: Buttondown provider

**Priority:** High
**Estimated Effort:** 4 hours

1. Choose and pin the API version; write the `remix/data-schema` schemas for the subscriber,
   list page, error envelope and webhook payload against it.
2. Implement `ButtondownNewsletter` on `APIClient`, including the `email_already_exists` read,
   the read-merge-write `update` and `X-Buttondown-Signature` verification.
3. Move `apps/books/app/services/buttondown.test.ts` into the package, then add MSW handlers
   modeling the documented API and run the conformance suite against them.

### Phase 3: Kit provider

**Priority:** Medium
**Estimated Effort:** 5 hours

1. Implement `KitNewsletter`: lookup-then-create, form add with the attribution referrer, tag
   name resolution, cursor pagination, `X-Kit-Signature` with rotation, batched events.
2. Run the conformance suite against MSW handlers; add tests for custom-field warnings, the
   unknown-key `update`, and a batch of several events.
3. Revise the contract if Kit forces a change, before any app depends on it.

### Phase 4: Migrate `apps/books`

**Priority:** High
**Estimated Effort:** 3 hours

1. Add `app/lib/newsletter.ts` exporting the module-scope `ButtondownNewsletter` typed as
   `Newsletter`, and mount `@sdxc/newsletter/middleware` in `bootstrap/app.tsx`.
2. Rewrite `app/services/subscribe.ts`, `controllers/subscribe.tsx` and `controllers/sample.tsx`
   on `ctx.newsletter`, branching on `suppressed` and `invalid_address`.
3. Rewrite the `order.paid` handler on `subscribers.update`.
4. Replace `FakeButtondown` and the `vi.mock` calls with `MemoryNewsletter` installed as
   `context.newsletter`; delete `app/services/buttondown.ts`, `app/lib/buttondown.ts` and
   `app/lib/test/buttondown.ts`.
5. Remove `BUTTONDOWN_API_VERSION` from `cloudflare.config.ts` and `.env.example`; update the
   app's README and AGENTS.md.
6. Build and deploy; there is no migration.

### Phase 5: Publish

**Priority:** Low
**Estimated Effort:** 1 hour

1. Remove `private: true`, add the description and `LICENSE.md`, mark the root README row, and
   bootstrap the package on npm per ADR-007.

## Alternatives Considered

### 1. Move the Buttondown client into a package as is

`@sdxc/buttondown`, a typed client with the same three methods.

**Rejected because**: it keeps Buttondown's vocabulary in every caller and leaves a second app on
another platform writing its own client and its own memory fake. The contract costs little more
than the client, and the memory provider is what makes app tests honest.

### 2. Fold newsletters into `@sdxc/mail`

`@sdxc/mail` already owns sending and one-click unsubscribe.

**Rejected because**: mail sends a message through a transport and holds no list; a newsletter
platform holds the list and does its own sending. They share no provider: Cloudflare Email
Routing has no audience, and Buttondown is not a transport.

### 3. Per-call double opt-in

`subscribe({ confirmation: "double" | "single" })`.

**Rejected because**: Kit decides confirmation by form, so the per-call flag would answer
`unsupported` on one of the two providers whenever it disagreed with configuration. Per-instance
configuration with `status` reporting the outcome holds on both.

### 4. Tags on the `Subscriber` model

**Rejected because**: Kit answers tags from a second endpoint, so either `list` costs a request
per row or `tags` is sometimes absent. A separate `tags(ref)` call costs one request where it is
needed.

### 5. Upsert semantics for `subscribe`

Let an existing subscriber's tags, metadata and attribution be updated by `subscribe`, matching
Kit's create.

**Rejected because**: Buttondown would need its collision header, which resubscribes a reader who
left, and first-touch attribution would be overwritten by every later form. `update` is the
explicit way to change a known reader.

### 6. `@sdxc/pagination` for lists

**Rejected because**: it pages a `remix/data-table` query by offset or keyset; a remote API's
cursor is opaque and owned by the platform.

### 7. A credential resolver option (`apiKey: () => Promise<string>`)

`@sdxc/billing` accepts this for secrets read with an `await`.

**Rejected because**: no consumer reads the newsletter key that way. If one appears, billing's
`Secret` reader is extracted into a shared package rather than copied here.

### 8. Mailchimp, Resend, Loops, Beehiiv or EmailOctopus as the second provider

**Rejected because**: see the comparison in Context. Mailchimp adds an audience dimension the
contract does not need; Resend and Loops have no API double opt-in; EmailOctopus is close enough
to Buttondown that it proves little; Beehiiv's subscription model is publication-scoped and its
webhook signing is undocumented.

## References

- [Buttondown: Creating a subscriber](https://docs.buttondown.com/api-subscribers-create)
- [Buttondown: Listing subscribers](https://docs.buttondown.com/api-subscribers-list)
- [Buttondown: Webhooks introduction](https://docs.buttondown.com/api-webhooks-introduction)
- [Buttondown: Event types](https://docs.buttondown.com/event-types)
- [Buttondown: How API versioning works](https://buttondown.com/blog/api-versioning)
- [Buttondown: DELETE on a subscriber now really deletes them](https://buttondown.com/blog/api-delete-subscriber)
- [Kit: Create a subscriber](https://developers.kit.com/api-reference/subscribers/create-a-subscriber)
- [Kit: Add subscriber to form by email address](https://developers.kit.com/api-reference/forms/add-subscriber-to-form-by-email-address)
- [Kit: Unsubscribe subscriber](https://developers.kit.com/api-reference/subscribers/unsubscribe-subscriber)
- [Kit: Create a tag](https://developers.kit.com/api-reference/tags/create-a-tag)
- [Kit: Pagination](https://developers.kit.com/api-reference/pagination)
- [Kit: Response codes and rate limits](https://developers.kit.com/api-reference/response-codes)
- [Kit: Webhook delivery format](https://developers.kit.com/webhooks/delivery-format)
- [Kit: Webhook event types](https://developers.kit.com/webhooks/event-types)
- [Kit: Verifying signatures](https://developers.kit.com/webhooks/verifying-signatures)
- [Resend: Create contact](https://resend.com/docs/api-reference/contacts/create-contact)
- [Resend: Webhook event types](https://resend.com/docs/dashboard/webhooks/event-types)
- [Mailchimp Marketing API reference](https://mailchimp.com/developer/marketing/api/)
- [Beehiiv: Create subscription](https://developers.beehiiv.com/api-reference/subscriptions/create)
- [Loops: Create contact](https://loops.so/docs/api-reference/create-contact)
- [EmailOctopus API v2](https://emailoctopus.com/api-documentation/v2)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-018: Mail Package With Pluggable Transports](./ADR-018-mail-package-with-pluggable-transports.md)
- [ADR-026: Standard Webhooks Parsing Package](./ADR-026-standard-webhooks-parsing-package.md)
- [ADR-043: Billing Package With Pluggable Providers](./ADR-043-billing-package-with-pluggable-providers.md)
- [ADR-057: Request Context Instead Of A Service Container](./ADR-057-request-context-instead-of-a-service-container.md)
- [ADR-106: Backoff Package](./ADR-106-backoff-package.md)
- [ADR-110: Attribution Package](./ADR-110-attribution-package.md)

## Current Progress

- [x] Phase 1: Contract, memory provider and endpoint
- [x] Phase 2: Buttondown provider (API version `2026-04-01`)
- [x] Phase 3: Kit provider
- [x] Phase 4: Migrate `apps/books` (code; build and deploy outstanding)
- [ ] Phase 5: Publish

## Notes

- Buttondown pins `2026-04-01`. Versions from `2024-08-01` name the address `email_address`
  (earlier ones `email`), and from `2026-01-01` subscriber ids are TypeIDs (`sub_…`).
- Buttondown documents no `page_size` or ordering on the subscriber list; the provider sends
  `page_size` and `ordering=creation_date`, and paging stays correct if either is ignored.
- Whether Buttondown's `PATCH` replaces or merges `metadata`, and how Kit clears a custom
  field (the provider sends `null`), are unconfirmed against a live account.
- Kit's docs disagree on an unknown custom-field key (an error in the prose, a `warnings`
  entry in the OpenAPI schema); the provider handles both. `PUT subscribers/{id}` requires
  `email_address`, so a Kit `update` reads the subscriber first, and Kit ids are integers.
- A Kit subscribe whose form-add or tagging step fails leaves the subscriber created, and a
  retry answers `created: false` without finishing that setup.

- Buttondown documents its signature header as `sha256=<signature>` without naming the
  encoding; Phase 2 confirms hex against a real delivery before the scheme is fixed.
- Buttondown's subscriber webhook payload names `newsletter` and `subscriber` ids; an account
  with several newsletters sends deliveries for all of them, so a provider configured for one
  newsletter acknowledges and skips events for the others.
- Kit's `subscriber.custom_field_value_updated` fires once per changed field, so one `update`
  touching three keys arrives as three `subscriber.updated` events with distinct ids.
- Kit's newer webhook endpoints are the signed ones; the legacy `POST /v4/webhooks` endpoint
  sends unsigned deliveries, which this provider rejects.
