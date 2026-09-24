# @sdxc/websub

WebSub subscriber and publisher: subscribe, verify intent and signatures, notify hubs.

## Overview

[WebSub](https://www.w3.org/TR/websub/) lets a subscriber learn about an update the moment it is
published instead of polling for it. A publisher advertises a hub; a subscriber asks the hub to
call it back for one topic; the hub verifies the subscriber meant it by calling the callback
with a challenge; and from then on the hub POSTs each update to the callback, signed with a
secret only the two of them share.

This package is the wire format of both halves as plain functions over `Request`, `Response` and
`URL`. Every fallible step returns a `Result` from `@sdxc/result`, signatures are checked in
constant time through `@sdxc/crypto`, and each half sits on its own subpath so a publisher never
loads the verifier. Storage, callback tokens, scheduling and every policy about which
subscriptions to hold stay with the caller. Discovering a feed's hub and topic lives in
`@sdxc/feed` (`Feed.selectSubscription`).

| Subpath                   | Exports                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sdxc/websub`            | `SignatureAlgorithm`, `WebSubRequestError`, `WebSubVerificationError`, `WebSubSignatureError`                                                                    |
| `@sdxc/websub/subscriber` | `subscriptionRequest`, `subscribe`, `unsubscribe`, `parseVerification`, `acknowledge`, `refuse`, `gone`, `received`, `verifyDelivery`, `renewalAt`, `Subscriber` |
| `@sdxc/websub/publisher`  | `links`, `publishRequest`, `publish`, `Publisher`                                                                                                                |

## Usage

### Subscribe to a topic

```typescript
import { randomToken } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { subscribe } from "@sdxc/websub/subscriber";

let secret = randomToken({ bytes: 32 });
let asked = await subscribe({
	hub: "https://hub.example.com/",
	topic: "https://blog.example.com/feed.xml",
	callback: `https://reader.example.com/websub/${token}`,
	secret,
	leaseSeconds: 864_000,
});

if (isFailure(asked)) log.warn("websub.subscribe.failed", { status: asked.error.status });
```

Success means the hub answered `202 Accepted`. The subscription is live once the callback
acknowledges the hub's verification.

### Answer the hub at the callback

```typescript
import { isFailure } from "@sdxc/result";
import {
	acknowledge,
	parseVerification,
	received,
	refuse,
	verifyDelivery,
} from "@sdxc/websub/subscriber";

async function verification(request: Request) {
	let verification = parseVerification(request);
	if (isFailure(verification)) return refuse();
	if (verification.data.mode === "denied") return refuse();
	return acknowledge(verification.data);
}

async function delivery(request: Request, secret: string) {
	let delivery = await verifyDelivery(request, secret);
	if (!isFailure(delivery)) await refetch(delivery.data.self);
	return received();
}
```

### Advertise a hub and ping it

```typescript
import { links, publish } from "@sdxc/websub/publisher";

let headers = { link: links({ hubs: ["https://hub.example.com/"], self: feedUrl }) };
await publish("https://hub.example.com/", [feedUrl]);
```

## API

### `@sdxc/websub`

#### `SignatureAlgorithm`

`"sha1" | "sha256" | "sha384" | "sha512"`, the hashes `X-Hub-Signature` may name. The hub
chooses one and WebSub gives the subscriber no field to ask for it.

#### `WebSubRequestError`

A request to a hub was refused before sending (an invalid hub or callback, a secret past the
limit) or by the hub, or never answered. `status` carries the hub's status, `null` when no
response arrived or no request was sent.

#### `WebSubVerificationError`

A verification request is missing a field WebSub requires or carries an unknown `hub.mode`.

#### `WebSubSignatureError`

A delivery was refused. `reason` is `"missing"`, `"malformed"`, `"algorithm"`, `"mismatch"` or
`"too-large"`, for the caller to log; the response is `received()` whatever the reason.

### `@sdxc/websub/subscriber`

#### `subscriptionRequest(options): Result<Request, WebSubRequestError>`

Builds the `application/x-www-form-urlencoded` POST without sending it. Pass
`Subscriber.SubscribeOptions`, or `Subscriber.UnsubscribeOptions` with `mode: "unsubscribe"`.

- `hub`: must be `https:`, since the request carries the secret
- `topic`: sent verbatim; the hub keys the subscription by this exact string
- `callback`: an absolute URL, unguessable when it identifies the subscription
- `secret`: 1 to 199 bytes of UTF-8 (§5.1.1); required, so every delivery can be verified
- `leaseSeconds`: optional positive whole number; the hub decides the lease it grants
- `timeoutMs`: used by `subscribe`/`unsubscribe`, default `10_000`

#### `subscribe(options): Promise<Result<void, WebSubRequestError>>`

Sends a subscribe request. Succeeds only on `202 Accepted`, the answer of a hub that will
verify asynchronously.

#### `unsubscribe(options): Promise<Result<void, WebSubRequestError>>`

Sends an unsubscribe request with `hub`, `topic` and `callback`; succeeds on `202`.

#### `parseVerification(input: URL | Request): Result<Subscriber.Verification, WebSubVerificationError>`

Reads the `hub.*` query of the hub's `GET`:

```typescript
type Verification =
	| { mode: "subscribe"; topic: string; challenge: string; leaseSeconds: number }
	| { mode: "unsubscribe"; topic: string; challenge: string }
	| { mode: "denied"; topic: string; reason: string | null };
```

A subscribe verification without a whole-number `hub.lease_seconds` fails. The lease it carries
is the one granted, which binds over the one requested.

#### `acknowledge(verification): Response`

`200 text/plain; charset=utf-8` with the challenge as the whole body, the only answer that
confirms a subscribe or unsubscribe verification.

#### `refuse(): Response`, `gone(): Response`, `received(): Response`

`404` for a verification the subscriber did not ask for, `410 Gone` to end a subscription the
callback no longer wants (the hub stops retrying), and `202` for every delivery whether or not
its signature verified.

#### `verifyDelivery(request, secret, options?): Promise<Result<Subscriber.Delivery, WebSubSignatureError>>`

Reads `X-Hub-Signature` (`method=hex`, hex in either case), then at most `maxBytes` of body
(default `1_048_576`), then compares the HMAC over those exact bytes in constant time.
`algorithms` narrows the accepted list, which defaults to all four. A delivery with no
signature is refused as `missing`. On success:

```typescript
interface Delivery {
	body: Uint8Array;
	contentType: string | null;
	algorithm: SignatureAlgorithm;
	hub: string | null; // rel=hub from the delivery's Link header
	self: string | null; // rel=self from the delivery's Link header
}
```

#### `renewalAt(options: Subscriber.RenewalOptions): number`

The epoch milliseconds to resubscribe at, from `verifiedAt` and the granted `leaseSeconds`: once
`share` (default `0.8`) of the lease has elapsed, but no later than `minimumLeadMs` (default six
hours) before it runs out. A lease shorter than twice the lead renews at its midpoint, so a
short grant never becomes a renewal loop.

### `@sdxc/websub/publisher`

#### `links(options: Publisher.LinksOptions): string`

The `Link` header value advertising `hubs` and the `self` topic, with quoted relations:
`<https://hub.example.com/>; rel="hub", <https://blog.example.com/rss>; rel="self"`.

#### `publishRequest(hub, topics): Result<Request, WebSubRequestError>`

Builds the ping without sending it: `hub.mode=publish` with one `hub.url` field per topic.

#### `publish(hub, topics, options?): Promise<Result<void, WebSubRequestError>>`

Sends the ping; success is any `2xx`. WebSub leaves publisher-to-hub notification unspecified,
so this follows the PubSubHubbub 0.4 form that public hubs accept.

## Pattern: A Callback Route

The route owns token lookup and what a delivery triggers; the package owns the wire format.

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
		await store.clear(token);
		return refuse();
	}

	if (verification.data.mode === "subscribe") {
		let due = renewalAt({ verifiedAt: Date.now(), leaseSeconds: verification.data.leaseSeconds });
		await store.activate(token, due);
	}

	return acknowledge(verification.data);
}

export async function onDelivery(request: Request, token: string) {
	let subscription = await store.byToken(token);
	if (subscription === null) return gone();

	let delivery = await verifyDelivery(request, subscription.secret);
	if (isFailure(delivery)) {
		log.warn("websub.rejected", { reason: delivery.error.reason });
		return received();
	}

	await store.refresh(subscription.topic);
	return received();
}
```

## Pattern: Ping After Purging

A hub fetches the topic the instant it is pinged, so ping after any cached copy of the feed is
purged, and advertise the hub in both the header and the document.

```typescript
import { isFailure } from "@sdxc/result";
import { links, publish } from "@sdxc/websub/publisher";

export function feedResponse(xml: string, self: string) {
	return new Response(xml, {
		headers: { "content-type": "application/rss+xml", link: links({ hubs: [HUB], self }) },
	});
}

export async function afterSave(feeds: string[]) {
	await cache.purge("feeds");
	let pinged = await publish(HUB, feeds);
	if (isFailure(pinged)) log.warn("websub.publish.failed", { status: pinged.error.status });
}
```

## Related Packages

- [`@sdxc/feed`](/packages/feed) - Discovers a feed's hub and topic with `Feed.selectSubscription`
- [`@sdxc/crypto`](/packages/crypto) - `hmac.verify` and `randomToken` for secrets and callback tokens
- [`@sdxc/rss`](/packages/rss), [`@sdxc/atom`](/packages/atom), [`@sdxc/json-feed`](/packages/json-feed) - Write `rel=hub` into the feed document
- [`@sdxc/rate-limit`](/packages/rate-limit) - Bounds what a flood of deliveries to one callback costs

## Tips

1. **Answer `received()` to every delivery** - A response that differed by outcome would tell a prober whether a guess at the secret was right.
2. **Answer `gone()` for an unknown token** - `410` ends the hub's retries; `404` keeps them coming.
3. **Store the granted lease** - Compute renewal from `verification.leaseSeconds`, never from the lease you asked for.
4. **Re-fetch rather than trust the body** - A verified delivery proves the hub sent it, and fetching the topic from the publisher's origin keeps a compromised hub from writing content.
5. **Use a fresh secret and token per subscription** - A renewal that rotates both leaves nothing a leaked callback URL can reuse.
