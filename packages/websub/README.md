# @sdxc/websub

WebSub subscriber and publisher: subscribe, verify intent and signatures, notify hubs.

[WebSub](https://www.w3.org/TR/websub/) delivers updates the moment they are published: a
publisher advertises a hub, a subscriber asks the hub to call a callback for one topic, the hub
confirms the request with a challenge, and then POSTs every update to the callback signed with a
shared secret. This package is the wire format of both halves as plain functions over `Request`,
`Response` and `URL`; storage, callback tokens and scheduling stay with you.

## Installation

```sh
npm add @sdxc/websub
```

Fallible calls answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).
To find a feed's hub and topic, use `Feed.selectSubscription` from
[`@sdxc/feed`](https://www.npmjs.com/package/@sdxc/feed).

## Usage

### Subscribe to a topic

```typescript
import { randomToken } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { subscribe } from "@sdxc/websub/subscriber";

let token = randomToken();
let secret = randomToken();

let asked = await subscribe({
	hub: "https://hub.example.com/",
	topic: "https://blog.example.com/feed.xml",
	callback: `https://reader.example.com/websub/${token}`,
	secret,
	leaseSeconds: 864_000,
});

if (isFailure(asked)) throw asked.error; // asked.error.status is the hub's status, or null
```

Success means the hub answered `202 Accepted`. The subscription is live once the callback
confirms the hub's verification.

### Confirm the hub's verification

The hub sends a `GET` to the callback. Answer with the challenge to confirm, or `refuse()` when
it is not a subscription you asked for.

```typescript
import { isFailure } from "@sdxc/result";
import { acknowledge, parseVerification, refuse } from "@sdxc/websub/subscriber";

function onVerification(request: Request) {
	let verification = parseVerification(request);
	if (isFailure(verification)) return refuse();
	if (verification.data.mode === "denied") return refuse(); // the hub refused or ended it
	return acknowledge(verification.data);
}
```

### Verify a delivery

Every update arrives as a signed `POST`. Check the signature against the secret, then answer
`received()` whatever the outcome.

```typescript
import { isFailure } from "@sdxc/result";
import { received, verifyDelivery } from "@sdxc/websub/subscriber";

async function onDelivery(request: Request, secret: string) {
	let delivery = await verifyDelivery(request, secret);
	if (!isFailure(delivery)) {
		let text = new TextDecoder().decode(delivery.data.body);
		await handleUpdate(delivery.data.self, text);
	}
	return received();
}
```

### Advertise a hub and ping it

```typescript
import { links, publish } from "@sdxc/websub/publisher";

let hub = "https://hub.example.com/";
let feedUrl = "https://blog.example.com/feed.xml";

let response = new Response(xml, {
	headers: { "content-type": "application/rss+xml", link: links({ hubs: [hub], self: feedUrl }) },
});

await publish(hub, feedUrl); // after the feed changed
```

## API

### `@sdxc/websub`

Shared types and errors.

#### `SignatureAlgorithm`

`"sha1" | "sha256" | "sha384" | "sha512"`, the hashes `X-Hub-Signature` may name. The hub picks
one, so `verifyDelivery` accepts all four unless told otherwise.

#### `WebSubRequestError`

A hub request was refused before sending (invalid hub, callback, topic, secret or lease), refused
by the hub, or never answered. `status` is the hub's status, or `null` when no response arrived.

#### `WebSubVerificationError`

A verification request lacks a field WebSub requires or carries an unknown `hub.mode`.

#### `WebSubSignatureError`

A delivery was refused. `reason` is `WebSubSignatureError.Reason`: `"missing"`, `"malformed"`,
`"algorithm"`, `"mismatch"` or `"too-large"`, for logging.

### `@sdxc/websub/subscriber`

#### `subscribe(options: Subscriber.SubscribeOptions): Promise<Result<void, WebSubRequestError>>`

Sends a subscribe request; succeeds only on `202 Accepted`.

- `hub`: the hub URL, `https:` only, since the request carries the secret
- `topic`: sent verbatim; the hub keys the subscription by this exact string
- `callback`: an absolute URL, unguessable when it identifies the subscription
- `secret`: 1 to 199 bytes of UTF-8, used to sign every delivery
- `leaseSeconds`: optional positive whole number; the hub decides the lease it grants
- `timeoutMs`: how long the hub has to answer, default `10_000`

#### `unsubscribe(options: Subscriber.UnsubscribeOptions): Promise<Result<void, WebSubRequestError>>`

Sends an unsubscribe request with `hub`, `topic`, `callback` and optional `timeoutMs`; succeeds
on `202`. The hub then verifies it at the callback like a subscription.

#### `subscriptionRequest(options: Subscriber.SubscribeOptions | Subscriber.UnsubscriptionRequestOptions): Result<Request, WebSubRequestError>`

Builds the form `POST` that `subscribe` sends, without sending it. Pass the unsubscribe options
plus `mode: "unsubscribe"` to build an unsubscription instead.

#### `parseVerification(input: URL | Request): Result<Subscriber.Verification, WebSubVerificationError>`

Reads the `hub.*` query of the hub's `GET` into one of three modes. A subscribe verification
carries the `leaseSeconds` the hub granted, which is the lease to store.

```typescript
type Verification =
	| { mode: "subscribe"; topic: string; challenge: string; leaseSeconds: number }
	| { mode: "unsubscribe"; topic: string; challenge: string }
	| { mode: "denied"; topic: string; reason: string | null };
```

#### `acknowledge(verification: Subscriber.SubscribeVerification | Subscriber.UnsubscribeVerification): Response`

`200 text/plain` with the challenge as the whole body, the answer that confirms a verification.

#### `refuse(): Response`

`404` for a verification you did not ask for.

#### `gone(): Response`

`410 Gone` for a callback you no longer want; the hub drops the subscription and stops retrying.

#### `received(): Response`

`202` for every delivery, verified or not, so the response never tells a prober whether a guessed
secret was right.

#### `verifyDelivery(request: Request, secret: string, options?: Subscriber.VerifyDeliveryOptions): Promise<Result<Subscriber.Delivery, WebSubSignatureError>>`

Checks `X-Hub-Signature` against the body exactly as it arrived, in constant time. An unsigned
delivery fails as `missing`. `options.algorithms` narrows the accepted hashes and
`options.maxBytes` caps the body read (default `1_048_576`). On success the `Delivery` carries
`body` (`Uint8Array`), `contentType`, `algorithm`, and the `hub` and `self` targets of its `Link`
header.

#### `renewalAt(options: Subscriber.RenewalOptions): number`

The epoch milliseconds to resubscribe at, from `verifiedAt` and the granted `leaseSeconds`: after
`share` of the lease (default `0.8`), but at least `minimumLeadMs` (default six hours) before it
expires. A lease shorter than twice that lead renews at its midpoint.

### `@sdxc/websub/publisher`

#### `links(options: Publisher.LinksOptions): string`

The `Link` header value advertising `hubs` and the `self` topic, such as
`<https://hub.example.com/>; rel="hub", <https://blog.example.com/feed.xml>; rel="self"`.

#### `publish(hub: string, topics: string | readonly string[], options?: Publisher.PublishOptions): Promise<Result<void, WebSubRequestError>>`

Tells a hub the topics changed, in the `hub.mode=publish` form public hubs accept; succeeds on any
`2xx`. `options.timeoutMs` defaults to `10_000`.

#### `publishRequest(hub: string, topics: string | readonly string[]): Result<Request, WebSubRequestError>`

Builds the ping that `publish` sends, one `hub.url` field per topic, without sending it.

### Types

#### `Subscriber`

`SubscribeOptions`, `UnsubscribeOptions`, `UnsubscriptionRequestOptions`,
`SubscribeVerification`, `UnsubscribeVerification`, `Denial`, `Verification`,
`VerifyDeliveryOptions`, `Delivery` and `RenewalOptions`.

#### `Publisher`

`LinksOptions` (`hubs`, `self`) and `PublishOptions` (`timeoutMs`).

## Pattern: A Callback Route

One callback URL per subscription, identified by an unguessable token. Verification stores the
granted lease; a delivery for an unknown token answers `gone()` so the hub stops sending it.
Re-fetch the topic from the publisher instead of trusting the body, so content always comes from
the publisher's origin.

```typescript
import { isFailure } from "@sdxc/result";
import {
	acknowledge,
	gone,
	parseVerification,
	received,
	refuse,
	renewalAt,
	verifyDelivery,
} from "@sdxc/websub/subscriber";

export async function onVerification(request: Request, token: string) {
	let verification = parseVerification(request);
	if (isFailure(verification)) return refuse();

	let subscription = await store.pending(token, verification.data.topic);
	if (subscription === null) return refuse();

	if (verification.data.mode === "denied") {
		await store.remove(token);
		return refuse();
	}

	if (verification.data.mode === "subscribe") {
		let renewAt = renewalAt({
			verifiedAt: Date.now(),
			leaseSeconds: verification.data.leaseSeconds,
		});
		await store.activate(token, renewAt);
	}

	return acknowledge(verification.data);
}

export async function onDelivery(request: Request, token: string) {
	let subscription = await store.byToken(token);
	if (subscription === null) return gone();

	let delivery = await verifyDelivery(request, subscription.secret, {
		algorithms: ["sha256", "sha384", "sha512"],
		maxBytes: 512 * 1024,
	});
	if (isFailure(delivery)) {
		await store.logRefusal(token, delivery.error.reason);
		return received();
	}

	await refreshFeed(subscription.topic);
	return received();
}
```

## Pattern: Renew Before The Lease Expires

Leases end, so a scheduled task resubscribes every subscription whose renewal time has passed,
and unsubscribes the ones nobody follows anymore. Each request goes through verification again,
which stores the next renewal time.

```typescript
import { isFailure } from "@sdxc/result";
import { subscribe, unsubscribe } from "@sdxc/websub/subscriber";

export async function renewDue(now: number) {
	for (let subscription of await store.dueBefore(now)) {
		let target = {
			hub: subscription.hub,
			topic: subscription.topic,
			callback: `https://reader.example.com/websub/${subscription.token}`,
		};

		if (subscription.followers === 0) {
			await unsubscribe(target);
			continue;
		}

		let asked = await subscribe({
			...target,
			secret: subscription.secret,
			leaseSeconds: 864_000,
		});
		if (isFailure(asked)) await store.retryLater(subscription.token, asked.error.status);
	}
}
```

## Pattern: Queue Hub Requests

`subscriptionRequest` and `publishRequest` validate the options and build the request without
sending it, so invalid input fails at the call site and the request can go through your own
queue, retry policy or test assertions.

```typescript
import { isFailure } from "@sdxc/result";
import { publishRequest } from "@sdxc/websub/publisher";
import { subscriptionRequest } from "@sdxc/websub/subscriber";

let unsubscription = subscriptionRequest({
	mode: "unsubscribe",
	hub: "https://hub.example.com/",
	topic: "https://blog.example.com/feed.xml",
	callback: "https://reader.example.com/websub/abc123",
});
if (isFailure(unsubscription)) throw unsubscription.error;

let ping = publishRequest("https://hub.example.com/", [
	"https://blog.example.com/feed.xml",
	"https://blog.example.com/tags/news.xml",
]);
if (isFailure(ping)) throw ping.error;

await queue.send({ url: ping.data.url, body: await ping.data.text() });
```

## Pattern: Ping After Publishing

A hub fetches the topics the moment it is pinged, so purge cached copies of the feeds first, and
ping once for every feed the change touched.

```typescript
import { isFailure } from "@sdxc/result";
import { links, publish } from "@sdxc/websub/publisher";

let HUB = "https://hub.example.com/";

export function feedResponse(xml: string, self: string) {
	return new Response(xml, {
		headers: { "content-type": "application/rss+xml", link: links({ hubs: [HUB], self }) },
	});
}

export async function afterPublish(feeds: string[]) {
	await cache.purge(feeds);

	let pinged = await publish(HUB, feeds, { timeoutMs: 5_000 });
	if (isFailure(pinged)) await retryPingLater(feeds, pinged.error.status);
}
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
		"@sdxc/websub": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
