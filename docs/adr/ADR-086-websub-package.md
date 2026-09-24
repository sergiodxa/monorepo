# ADR-086: WebSub Package

## Status

**Proposed** - 2026-09-23

## Background

[WebSub](https://www.w3.org/TR/websub/) (W3C Recommendation, 2018; formerly PubSubHubbub) lets
a feed reader learn about a new post the moment it is published instead of polling for it. A
publisher advertises a hub; a subscriber asks that hub to call it back for one topic; the hub
confirms the subscriber meant it by calling the callback with a challenge; and from then on the
hub POSTs each update to the callback, signed with a secret only the two of them share.

`apps/reader` already implements the subscriber half, inside its per-feed Durable Object and one
controller, and it works in production. The protocol pieces in it (building the subscription
form, reading a verification request, answering it, checking an `X-Hub-Signature`, computing when
a lease is due for renewal) are tangled with the reader's storage and scheduling. The other half,
the publisher side, does not exist anywhere: `apps/blog` and `@sdxc/blog-engine` publish RSS feeds
that advertise no hub and ping nobody, so a WebSub reader (the repo's own included) polls them.

## Context

### Inventory of the existing subscriber

| File                                                             | Lines | Role                                                                       |
| ---------------------------------------------------------------- | ----- | -------------------------------------------------------------------------- |
| `apps/reader/app/http/controllers/websub.ts`                     | 174   | Callback route: verification `GET`, delivery `POST`, rate limit, HMAC      |
| `apps/reader/database/feed-do.ts` (WebSub methods)               | ~300  | Subscribe, renew, unsubscribe, verify, notify, demote, `#askHub`           |
| `apps/reader/database/feed-schema.ts` (WebSub constants)         | ~100  | `HUB_STATES`, lease and renewal constants, `hubRenewalAt`, `hubTopicFor`   |
| `apps/reader/database/refresh.ts` (`hubAdvertOf`)                | ~25   | Picks the advertised hub and topic out of each poll                        |
| `apps/reader/database/feed-migrations/0002-websub.sql`           | 42    | `hub_url`, `hub_topic`, `hub_state`, `hub_secret`, `hub_token`, lease, ... |
| `apps/reader/database/websub.test.ts`                            | 217   | Topic selection, renewal timing, coalescing                                |
| `apps/reader/database/feed-do-websub.workers.test.ts`            | 559   | The whole flow against a real Durable Object                               |
| `packages/feed/src/lib/links.ts` (`fromLinkHeader`, `selectHub`) | 171   | Discovery: `rel=hub`/`rel=self` from `Link` headers and all three formats  |

### What is protocol and what is the reader's policy

| Concern                                                                              | Where it lives today                       | Kind       |
| ------------------------------------------------------------------------------------ | ------------------------------------------ | ---------- |
| Discovering `rel=hub` and `rel=self` (header first, then body)                       | `@sdxc/feed` (`Feed.selectHub`, `links`)   | Protocol   |
| Refusing a hub that is not `https:` (the secret travels in it)                       | `@sdxc/feed`                               | Protocol   |
| Form-encoding `hub.mode`/`hub.topic`/`hub.callback`/`hub.secret`/`hub.lease_seconds` | `FeedStore.#askHub`, `#subscribeHub`       | Protocol   |
| Reading `hub.mode`/`hub.topic`/`hub.challenge`/`hub.lease_seconds`                   | `websub.ts` `index` action                 | Protocol   |
| Echoing the challenge as `200 text/plain`, refusing with `404`                       | `websub.ts`                                | Protocol   |
| Checking `X-Hub-Signature: sha256=<hex>` over the raw bytes                          | `websub.ts` `signed()` over `@sdxc/crypto` | Protocol   |
| Answering `2xx` to a delivery whose signature fails                                  | `websub.ts` (`ACKNOWLEDGED`)               | Protocol   |
| Renewal instant from a lease                                                         | `hubRenewalAt` in `feed-schema.ts`         | Protocol   |
| Callback URL shape `/websub/:feedId/:token`, per-feed token                          | `routes/web.ts`, `FeedStore.#callbackUrl`  | App        |
| `none`/`pending`/`active`/`failed` stages, stored in the DO row                      | `feed-schema.ts`, `0002-websub.sql`        | App        |
| Topic must share the fetched feed's origin                                           | `hubTopicFor`                              | App policy |
| Ignoring the pushed body and re-fetching from the origin                             | `FeedStore.notified`                       | App policy |
| Coalescing, daily notification cap, miss counting, cool-off                          | `FeedStore`, `HUB_*` constants             | App policy |
| Per-feed rate limit on the callback                                                  | `websub.ts` (`@sdxc/rate-limit`)           | App policy |

### What the spec asks of each side

| Rule                                                                                                                       | Consequence for the package                                                                   |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Subscription requests are `application/x-www-form-urlencoded` POSTs to the hub (§5.1)                                      | one builder writes the form; the field names never appear in app code                         |
| A hub answers `202 Accepted` and verifies asynchronously; any other status is a refusal (§5.1.2)                           | `subscribe` reports acceptance, and the subscription is not live until verification           |
| Verification is a `GET` with `hub.mode`, `hub.topic`, `hub.challenge`, and `hub.lease_seconds` on subscribe (§5.3)         | `parseVerification` returns a union by mode; `lease_seconds` is required for `subscribe`      |
| A hub may send `hub.mode=denied` with `hub.reason` (§5.2)                                                                  | the union includes a `denied` case, which the reader drops today                              |
| The subscriber confirms by echoing the challenge with `2xx`; anything else refuses (§5.3.1)                                | `acknowledge` and `refuse` build the two responses                                            |
| The lease the hub reports is binding, not the one requested (§5.3)                                                         | renewal is computed from the granted lease                                                    |
| With a secret, deliveries carry `X-Hub-Signature: method=hex` using sha1, sha256, sha384 or sha512, chosen by the hub (§8) | verification accepts all four by default; the subscriber has no way to request one            |
| A failed signature is ignored locally, yet still answered `2xx` (§8)                                                       | the verifier returns a failure for the caller to log, and the caller answers `202` either way |
| The callback may answer `410 Gone` to end a subscription it no longer wants (§7)                                           | a `gone` response, so a stale token ends the hub's retries instead of being answered `404`    |
| A secret must be under 200 bytes and should only be sent over HTTPS (§5.1.1)                                               | the builder refuses a longer secret or a non-`https:` hub                                     |
| Publishers advertise `rel=hub` and `rel=self` in `Link` headers or the document (§4)                                       | `links()` writes the header value; feed documents use their own packages' fields              |
| How a publisher notifies its hub is left unspecified (§6)                                                                  | `publish` sends the de facto `hub.mode=publish` + `hub.url` form public hubs accept           |

### What the reader gets wrong or leaves out, relative to the spec

| Gap                                                                                                                   | Effect                                                          |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Accepts only `sha256=`; its comment says it is the algorithm "this app asks for", but WebSub has no field to ask with | a hub signing with sha1 or sha512 is silently refused forever   |
| Answers `404` to a delivery on a rotated or cleared token                                                             | the hub keeps retrying; `410` would end it                      |
| Ignores `hub.mode=denied`                                                                                             | a refused subscription sits in `pending` until the next poll    |
| Unsubscribe verification is always refused (`mode !== "subscribe"` returns `null`)                                    | unsubscribes only take effect when the lease lapses             |
| Reads the delivery body with an unbounded `arrayBuffer()`                                                             | a hostile body is buffered whole before the signature check     |
| Takes `rel=self` from the document even when the hub came from the `Link` header                                      | a header-advertised hub may be subscribed under the wrong topic |

### The publisher side today

| Location                                                                     | Feeds                                                       | Hub advertised |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------- |
| `apps/blog/app/http/controllers/rss/{feed,articles,tutorials,bookmarks}.tsx` | `/rss`, `/articles.rss`, `/tutorials.rss`, `/bookmarks.rss` | none           |
| `packages/blog-engine/src/syndication/controllers/rss.ts`                    | `/rss.xml`, `/:typePath.rss` (used by `apps/blog-saas`)     | none           |

The format packages already carry what advertising needs: `@sdxc/rss` writes `atomLink`
entries with any `rel`, `@sdxc/atom` writes `link` elements, and `@sdxc/json-feed` writes the
`hubs` array. Only the ping and the `Link` header are missing.

## Decision

Add `@sdxc/websub`: the subscriber and publisher halves of WebSub as plain functions over
`Request`, `Response` and `URL`, with signatures through `@sdxc/crypto` and every fallible step
returning a `Result`. Discovery stays in `@sdxc/feed`. Storage, scheduling and every policy the
reader layers on top stay in the reader.

### Package name

| Name                      | Trade-off                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **`@sdxc/websub`**        | The W3C name of the protocol, the one hubs and IndieWeb documentation use today                                                      |
| `@sdxc/pubsubhubbub`      | The historical name; still in some hubs' URLs, but superseded by the Recommendation                                                  |
| Part of `@sdxc/feed`      | Keeps discovery and subscription together, but WebSub topics need not be feeds and the publisher side has nothing to do with parsing |
| `@sdxc/websub-subscriber` | Precise for today's code, and leaves the publisher half, the one the blog needs, homeless                                            |

`@sdxc/websub` wins: it is the name a reader of the spec searches for, and one package holds both
halves plus room for a hub later, each on its own subpath so a publisher never loads the verifier.

### Scope

The package includes:

- building and sending subscribe and unsubscribe requests
- reading and answering the hub's verification of intent, including `denied`
- verifying a content distribution's `X-Hub-Signature` over the raw body, all four algorithms
- computing the renewal instant of a granted lease
- writing the `Link` header a publisher advertises with, and pinging a hub on update

Out of scope, and where each lives instead:

- Discovering the hub and topic from a fetched feed lives in `@sdxc/feed`, which gains the
  `rel=self` half so hub and topic come from the same place (see Implementation Plan)
- Subscription state, callback tokens, coalescing, flood and miss detection live in
  `apps/reader`'s `FeedStore`
- Writing `rel=hub` into RSS, Atom and JSON Feed documents lives in `@sdxc/rss`, `@sdxc/atom` and
  `@sdxc/json-feed`
- Rate limiting the callback lives in `@sdxc/rate-limit`
- A hub (accepting subscriptions, verifying callbacks, fanning out signed deliveries) is out of
  scope for this ADR. When one is wanted, its protocol pieces go in a `./hub` subpath of this
  package, the mirror image of `./subscriber`, and its storage and fan-out queue in an app with a
  Durable Object per topic and `@sdxc/jobs` for retries

### Exports

#### `"."`

Shared types and errors only, so both subpaths agree on them.

```ts
/** The hash a hub signed a delivery with, as `X-Hub-Signature` names it. */
export type SignatureAlgorithm = "sha1" | "sha256" | "sha384" | "sha512";

/** A request to a hub failed: network, timeout, or a status other than the one expected. */
export class WebSubRequestError extends Error {
	override name = "WebSubRequestError";
	status: number | null; // null when no response arrived
}

/** A verification request is missing a field WebSub requires, or carries an unknown mode. */
export class WebSubVerificationError extends Error {
	override name = "WebSubVerificationError";
}

/** A delivery's signature is missing, malformed, of a refused algorithm, or wrong. */
export class WebSubSignatureError extends Error {
	override name = "WebSubSignatureError";
	reason: "missing" | "malformed" | "algorithm" | "mismatch" | "too-large";
}
```

#### `"./subscriber"`

```ts
import type { Result } from "@sdxc/result";

export namespace Subscriber {
	export interface SubscribeOptions {
		hub: string; // must be https:
		topic: string; // the publisher's rel=self, verbatim
		callback: string; // must be unguessable when it identifies the subscription
		secret: string; // fewer than 200 bytes; required, so every delivery can be verified
		leaseSeconds?: number; // a request; the hub decides
		timeoutMs?: number; // @default 10_000
	}

	export interface UnsubscribeOptions {
		hub: string;
		topic: string;
		callback: string;
		timeoutMs?: number;
	}

	export type Verification =
		| { mode: "subscribe"; topic: string; challenge: string; leaseSeconds: number }
		| { mode: "unsubscribe"; topic: string; challenge: string }
		| { mode: "denied"; topic: string; reason: string | null };

	export interface VerifyDeliveryOptions {
		/** @default ["sha1", "sha256", "sha384", "sha512"] */
		algorithms?: readonly SignatureAlgorithm[];
		/** @default 1_048_576 */
		maxBytes?: number;
	}

	export interface Delivery {
		body: Uint8Array; // the bytes exactly as they arrived
		contentType: string | null;
		algorithm: SignatureAlgorithm;
		/** rel=hub and rel=self from the delivery's Link header, which §7 requires the hub to send. */
		hub: string | null;
		self: string | null;
	}

	export interface RenewalOptions {
		verifiedAt: number; // epoch ms the verification was answered
		leaseSeconds: number; // as the hub reported it
		share?: number; // @default 0.8
		minimumLeadMs?: number; // @default 6 hours
	}
}

/** Builds the form POST without sending it, for a caller that queues or inspects it. */
export function subscriptionRequest(
	options: Subscriber.SubscribeOptions | (Subscriber.UnsubscribeOptions & { mode: "unsubscribe" }),
): Result<Request, WebSubRequestError>;

/** Sends a subscribe request; success means the hub answered 202 and will verify. */
export function subscribe(
	options: Subscriber.SubscribeOptions,
): Promise<Result<void, WebSubRequestError>>;

export function unsubscribe(
	options: Subscriber.UnsubscribeOptions,
): Promise<Result<void, WebSubRequestError>>;

/** Reads the hub.* query of a verification request. */
export function parseVerification(
	input: URL | Request,
): Result<Subscriber.Verification, WebSubVerificationError>;

/** 200 text/plain with the challenge as the body, the only confirming answer. */
export function acknowledge(
	verification: Extract<Subscriber.Verification, { challenge: string }>,
): Response;

/** 404 with an empty body: a verification this subscriber did not ask for. */
export function refuse(): Response;

/** 410 with an empty body: tells the hub to drop a subscription this callback ended. */
export function gone(): Response;

/** 202 with an empty body, sent whether or not the signature verified. */
export function received(): Response;

/** Reads the body within maxBytes and checks X-Hub-Signature over those exact bytes. */
export function verifyDelivery(
	request: Request,
	secret: string,
	options?: Subscriber.VerifyDeliveryOptions,
): Promise<Result<Subscriber.Delivery, WebSubSignatureError>>;

/** Epoch ms at which to resubscribe: share of the lease elapsed, but never later than minimumLeadMs before expiry. */
export function renewalAt(options: Subscriber.RenewalOptions): number;
```

Every subscription carries a secret, so `verifyDelivery` has no unsigned path: a missing header
is `reason: "missing"`, never a pass. Comparison goes through `hmac.verify`, which is
constant-time. The `received()` answer for both outcomes is part of the contract, because a
response that differed by outcome would be an oracle for guessing the secret.

#### `"./publisher"`

```ts
import type { Result } from "@sdxc/result";

export namespace Publisher {
	export interface LinksOptions {
		hubs: readonly string[];
		self: string; // the topic URL subscribers key by
	}

	export interface PublishOptions {
		timeoutMs?: number; // @default 10_000
	}
}

/** The Link header value advertising the hubs and the topic, e.g. `<https://hub>; rel="hub", <https://site/rss>; rel="self"`. */
export function links(options: Publisher.LinksOptions): string;

/** Builds the hub.mode=publish form without sending it. */
export function publishRequest(hub: string, topics: string | readonly string[]): Request;

/** Tells a hub that one or more topics changed; success is any 2xx. */
export function publish(
	hub: string,
	topics: string | readonly string[],
	options?: Publisher.PublishOptions,
): Promise<Result<void, WebSubRequestError>>;
```

`publish` sends `hub.mode=publish` with one `hub.url` field per topic, the form PubSubHubbub 0.4
defined and the public hubs still accept. WebSub itself leaves publisher-to-hub notification
unspecified, so this is the one place the package follows convention rather than the spec, and
the README says so.

### Usage

#### Reader: the callback controller

`apps/reader/app/http/controllers/websub.ts` keeps its route, its rate limit and its store calls,
and loses its protocol code:

```ts
import {
	acknowledge,
	gone,
	parseVerification,
	received,
	refuse,
	verifyDelivery,
} from "@sdxc/websub/subscriber";

export default createController(routes.websub, {
	middleware: [limit],
	actions: {
		/** GET — echoes the challenge only for a subscription or unsubscription this feed is waiting on. */
		async index(ctx) {
			let { feedId, token } = s.parse(Params, ctx.params);
			let verification = parseVerification(ctx.url);
			if (isFailure(verification)) return refuse();

			let confirmed = await feedStore(feedId).verifyHub(token, verification.data);
			return confirmed ? acknowledge(confirmed) : refuse();
		},

		/** POST — a verified delivery buys one re-fetch from the publisher's origin, nothing more. */
		async action(ctx) {
			let { feedId, token } = s.parse(Params, ctx.params);
			let credentials = await feedStore(feedId).hubSecretFor(token);
			if (credentials === null) return gone();

			let delivery = await verifyDelivery(ctx.request, credentials.secret);
			if (isFailure(delivery)) {
				ctx.log.warn("feed.hub.rejected", {
					feedUrl: credentials.feedUrl,
					reason: delivery.error.reason,
				});
				return received();
			}

			await feedStore(feedId).notified();
			return received();
		},
	},
});
```

`FeedStore.verifyHub` takes the parsed `Verification`, and handles `denied` (clear to `none`) and
`unsubscribe` (confirm when the token matches a subscription being left). `#askHub` becomes
`subscribe`/`unsubscribe`, and `hubRenewalAt` becomes `renewalAt` fed the granted lease, which
removes the "share of the lease this app asks for" approximation its comment documents.

#### Blog: advertising a hub and pinging it

The four controllers in `apps/blog/app/http/controllers/rss/` declare the hub in both places a
subscriber looks:

```ts
import { links } from "@sdxc/websub/publisher";
import { env } from "cloudflare:workers";

let self = new URL(routes.rss.articles.href(), ctx.url).toString();
let rss = new RSS({
	title: "Articles — Sergio Xalambrí",
	link: new URL(routes.articles.href(), ctx.url).toString(),
	description: "Articles by Sergio Xalambrí.",
	atomLink: [
		{ rel: "self", href: self, type: "application/rss+xml" },
		{ rel: "hub", href: env.WEBSUB_HUB },
	],
});

return xml(rss.toString(), { headers: { link: links({ hubs: [env.WEBSUB_HUB], self }) } });
```

The CMS write actions (`apps/blog/app/http/controllers/cms/{articles,tutorials,bookmarks}.tsx`)
ping after the edge copy is purged, because the hub fetches the feed the instant it is pinged and
would otherwise redistribute the stale one:

```ts
import { publish } from "@sdxc/websub/publisher";
import { waitUntil } from "cloudflare:workers";

waitUntil(
	(async () => {
		await ctx.cache.purge(TAGS.feeds());
		let pinged = await publish(env.WEBSUB_HUB, [feedUrl("/rss"), feedUrl("/articles.rss")]);
		if (isFailure(pinged)) ctx.log.warn("websub.publish.failed", { status: pinged.error.status });
	})(),
);
```

A post scheduled for the future (`published_at` ahead of now) is not pinged by its save; it
reaches subscribers through their fallback poll, which the reader keeps for exactly this reason.
Pinging at the scheduled instant needs a timer the blog does not have today, and is left for when
it adopts `@sdxc/jobs`.

`@sdxc/blog-engine` gets the same treatment in `syndication/controllers/rss.ts` and
`posts/controllers/cms.tsx`, with the hub URL a site setting rather than an env var, so each
`apps/blog-saas` tenant chooses its own hub or none.

## Consequences

### Positive

- **The blog's readers get pushes** - WebSub subscribers, the repo's reader included, learn
  about a post within seconds of the save instead of on their next poll
- **Spec gaps close in one place** - all four signature algorithms, `denied`, unsubscribe
  verification, `410 Gone` and a bounded body read land in the package with tests, and the
  reader picks them up by adopting it
- **The reader's controller shrinks to policy** - the file reads as what the reader decides,
  with the wire format behind named functions
- **A hub has a place to go** - `./hub` mirrors `./subscriber` when it is wanted

### Negative

- **The publisher depends on a third-party hub** - the blog's pushes are only as reliable as the
  hub it names, and a hub outage is invisible to the blog beyond a logged failed ping
- **Pings are fire-and-forget** - `waitUntil` means a failed ping is only logged; nothing retries
  it until the blog has a job queue
- **Widening the accepted algorithms loosens the reader's current stance** - accepting sha1 is
  what the spec requires for interoperability, and it is weaker than sha256 even as an HMAC
- **Another public package** - README, release entry and a trusted publisher to configure

### Neutral

- **Scheduled posts keep polling semantics** - unchanged from today, and documented
- **`@sdxc/feed` changes shape slightly** - `selectHub` gains a sibling that returns the topic
  alongside the hub, and `selectHub` keeps working

## Implementation Plan

### Phase 1: Specify and build the package

**Priority:** High
**Estimated Effort:** 5 hours

1. Write the tests first, from the spec's sections: form encoding and the 200-byte secret limit;
   verification for each mode, including `denied` with and without `hub.reason`, with `lease_seconds` missing on subscribe failing; signatures in
   each algorithm, uppercase hex, a missing header, an unknown method, and a body past `maxBytes`;
   `renewalAt` for a lease shorter than the minimum lead; `links()` quoting; `publish` with
   several topics (MSW for every hub)
2. Implement `./subscriber`, `./publisher` and the shared errors over `@sdxc/crypto`'s `hmac`
3. README per the package documentation guide, root README table row

### Phase 2: Pair hub and topic in `@sdxc/feed`

**Priority:** High
**Estimated Effort:** 1.5 hours

1. Add `Feed.selectSubscription(header, document)` returning `{ hub, topic, source }`, taking
   `rel=self` from the same place the hub came from and falling back to the document's
2. Keep `Feed.selectHub` as it is

### Phase 3: Migrate the reader

**Priority:** Medium
**Estimated Effort:** 3 hours

| Call site                                                     | Change                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `app/http/controllers/websub.ts` `index`                      | `parseVerification` + `acknowledge`/`refuse`                          |
| `app/http/controllers/websub.ts` `action`                     | `verifyDelivery` + `received`; unknown token answers `gone()`         |
| `app/http/controllers/websub.ts` `signed()`                   | deleted                                                               |
| `database/feed-do.ts` `verifyHub`                             | takes `Verification`; handles `denied` and `unsubscribe`              |
| `database/feed-do.ts` `#askHub`, `#subscribeHub`, `#leaveHub` | `subscribe` / `unsubscribe`                                           |
| `database/feed-schema.ts` `hubRenewalAt`                      | replaced by `renewalAt`; the stored lease stays `hub_lease_until`     |
| `database/refresh.ts` `hubAdvertOf`                           | `Feed.selectSubscription`, then the reader's own `hubTopicFor` policy |

The existing `feed-do-websub.workers.test.ts` suite stays and must pass unchanged except for the
new `410`, `denied` and unsubscribe cases, which each get a regression test.

### Phase 4: Publish from the blog and blog-engine

**Priority:** Medium
**Estimated Effort:** 3 hours

1. Choose a public hub and add `WEBSUB_HUB` to `apps/blog`'s `wrangler.jsonc`, `.env.example`
   and generated env types
2. Advertise it in the four RSS controllers (`atomLink` plus `Link` header)
3. Ping from the CMS create, update and destroy actions after the feed purge
4. Add the hub setting to `@sdxc/blog-engine`'s `Settings`, advertise and ping when it is set

### Phase 5: Publish the package

**Priority:** Low
**Estimated Effort:** 30 minutes

1. `description`, `LICENSE.md`, `bun run release:bootstrap @sdxc/websub`, trusted publisher

## Alternatives Considered

### 1. Put WebSub in `@sdxc/feed`

**Rejected because**: WebSub topics are any URL, the publisher side shares no code with feed
parsing, and `@sdxc/feed` would gain a crypto dependency every parser consumer pays for.
Discovery, which is about reading feeds, does stay there.

### 2. Extract only the subscriber

**Rejected because**: the publisher half is the one with a waiting adopter, and a second
package for it would split the shared errors and algorithm types.

### 3. A Remix middleware that owns the callback route

A middleware taking `lookup(token) => { secret, topic, pending }` could answer verifications and
verify deliveries without a controller.

**Rejected because**: every decision in the reader's callback (which token, which state counts as
pending, what a verified delivery triggers, what gets logged) is the app's. The middleware would
be a callback bag around the same five functions, and those functions are easier to test and to
read at the call site.

### 4. Keep sha256-only in the reader

**Rejected because**: the hub picks the algorithm and the subscriber cannot ask, so a single
accepted algorithm is a silent interoperability failure, not a security setting. A subscriber
that wants a narrower list still passes `algorithms`.

## References

- [WebSub, W3C Recommendation](https://www.w3.org/TR/websub/)
- [PubSubHubbub Core 0.4](https://pubsubhubbub.github.io/PubSubHubbub/pubsubhubbub-core-0.4.html) (the `hub.mode=publish` convention)
- [RFC 8288 - Web Linking](https://www.rfc-editor.org/rfc/rfc8288)
- [RFC 2104 - HMAC](https://www.rfc-editor.org/rfc/rfc2104)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-023: Web Crypto Primitives Package](./ADR-023-web-crypto-primitives-package.md)
- [ADR-077: Problem Details Package](./ADR-077-problem-details-package.md) (style reference)

## Current Progress

- [ ] Phase 1: Specify and build the package
- [ ] Phase 2: Pair hub and topic in `@sdxc/feed`
- [ ] Phase 3: Migrate the reader
- [ ] Phase 4: Publish from the blog and blog-engine
- [ ] Phase 5: Publish the package
