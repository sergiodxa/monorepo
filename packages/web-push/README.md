# @sdxc/web-push

Web Push from Workers or any runtime with WebCrypto: RFC 8291 encryption, VAPID signing, subscription checks and a browser subscribe helper.

Each browser picks its vendor's push service and hands you an endpoint on it; your server is identified only by a VAPID key pair you generate, so no push provider account or SDK is involved. Every send makes one `POST` with the global `fetch` and answers a `Result` whose failure code tells you what to do with the stored subscription.

## Installation

```sh
npm add @sdxc/web-push
```

Every operation answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), installed with this package. Registration routes validate with [`@sdxc/validate`](https://www.npmjs.com/package/@sdxc/validate) and `remix/data-schema` from [`remix`](https://www.npmjs.com/package/remix).

## Usage

### Generate a key pair

Generate one P-256 pair per deployment. The public key goes to your pages; store the private key as a secret.

```typescript
import { WebPush } from "@sdxc/web-push";

let { publicKey, privateKey } = await WebPush.generateKeys();
```

### Subscribe in the browser

```typescript
import { isSuccess } from "@sdxc/result";
import { isSupported, subscribe } from "@sdxc/web-push/browser";

button.hidden = !isSupported();
button.addEventListener("click", async () => {
	let subscribed = await subscribe({ worker: "/sw.js", applicationServerKey: vapidPublicKey });
	if (!isSuccess(subscribed)) return;

	await fetch("/push/subscriptions", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ subscription: subscribed.data }),
	});
});
```

Call `subscribe` from a click or another user activation: Safari and Firefox refuse a permission prompt requested without one. On iOS and iPadOS, push works only in a web app added to the Home Screen.

### Accept the subscription

`SUBSCRIPTION_SCHEMA` applies the same checks a send applies, so a stored subscription is one `send` accepts.

```typescript
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { SUBSCRIPTION_SCHEMA } from "@sdxc/web-push";
import * as s from "remix/data-schema";

let body = await validate(request, s.object({ subscription: SUBSCRIPTION_SCHEMA }));
if (isFailure(body)) return Response.json({ errors: body.error.issues }, { status: 400 });

await saveSubscription(body.data.subscription);
```

### Send a message

```typescript
import { isFailure } from "@sdxc/result";
import { WebPush } from "@sdxc/web-push";

let push = new WebPush({
	vapid: {
		publicKey: env.VAPID_PUBLIC_KEY,
		privateKey: env.VAPID_PRIVATE_KEY,
		subject: "mailto:ops@example.com",
	},
});

let sent = await push.send(subscription, JSON.stringify({ title: "Deploy finished" }), {
	ttl: "1 day",
	urgency: "normal",
	topic: "deploys",
});

if (isFailure(sent) && sent.error.code === "gone") await deleteSubscription(subscription.endpoint);
```

## API

### `new WebPush(options: WebPushOptions)`

A sender for one VAPID identity. Construction does no I/O: the keys are imported and checked on the first send, and one VAPID token per push service origin is cached for the instance's lifetime.

- `options.vapid`: `{ publicKey, privateKey, subject }`. `subject` is a `mailto:` or `https:` URI; Apple's push service refuses one it cannot use, so name a real address.
- `options.previous`: identities rotated out, still used for subscriptions made under them.
- `options.allowedHosts`: hosts an endpoint must be on, where `*.` matches any subdomain. Omitted, any public `https:` host is accepted.

### `push.send(subscription, payload?, options?): Promise<Result<Pushed, WebPushError>>`

Encrypts, signs and sends one message in one attempt, answering `{ status }` for any `2xx`. `payload` is a string (UTF-8), a `Uint8Array`, or omitted for a push the service worker answers by fetching.

| Option    | Default        | Meaning                                                                                |
| --------- | -------------- | -------------------------------------------------------------------------------------- |
| `ttl`     | `"4 weeks"`    | How long the push service holds the message for an offline device; `0` for now-only    |
| `urgency` | `"normal"`     | `"very-low"`, `"low"`, `"normal"` or `"high"`; a device on battery defers lower levels |
| `topic`   | None           | Replaces an undelivered message with the same topic; 1–32 base64url characters         |
| `padding` | `0`            | Bytes added inside the record, so the ciphertext length says less about the payload    |
| `timeout` | `"10 seconds"` | Deadline for the `POST`                                                                |
| `signal`  | None           | Aborts the `POST`                                                                      |

`ttl` and `timeout` take a duration string or milliseconds.

### `push.request(subscription, payload?, options?): Promise<Result<Request, WebPushError>>`

The encrypted, signed `Request` that `send` would make, with `redirect: "manual"`, for sending through your own transport.

### `WebPush.generateKeys(): Promise<VapidKeyPair>`

A new P-256 pair, both halves base64url: the 65-byte public point and the 32-byte private scalar.

### `subscriptionSchema(policy?: SubscriptionPolicy)` and `SUBSCRIPTION_SCHEMA`

A `remix/data-schema` schema whose output is a `Subscription`: the endpoint is a public `https:` host (on `policy.allowedHosts` when given), `p256dh` and `applicationServerKey` are P-256 points, and `auth` is 16 bytes. Unknown keys, such as the browser's `expirationTime`, are dropped. `SUBSCRIPTION_SCHEMA` is the one without an allow list.

### `PUSH_SERVICE_HOSTS`

The hosts of the push services Chrome, Firefox, Safari and Edge subscribe through, for `allowedHosts`.

### `MAX_PAYLOAD_BYTES`

`3993`: the most payload plus padding one record carries inside the 4,096-byte body every push service accepts.

### `WebPushError`

Every failure, returned and never thrown: `code`, `retryable`, the endpoint's `host` (never the full endpoint, which is a credential), `status` when the push service answered, and `retryAfter` in milliseconds from `Retry-After`.

| `code`                 | Retryable | When                                                                                    |
| ---------------------- | --------- | --------------------------------------------------------------------------------------- |
| `invalid-subscription` | No        | Endpoint not an allowed public `https:` URL, malformed keys, or a key this sender lacks |
| `invalid-vapid`        | No        | Keys that do not import or do not form a pair; `subject` not `mailto:` or `https:`      |
| `invalid-options`      | No        | A bad `topic`, a negative `ttl`, or `padding` outside 0 to `MAX_PAYLOAD_BYTES` bytes    |
| `payload-too-large`    | No        | Payload plus padding over `MAX_PAYLOAD_BYTES`                                           |
| `gone`                 | No        | `404` or `410`: the subscription no longer exists; delete it                            |
| `unauthorized`         | No        | `401` or `403`: the push service refused the VAPID credential, the sender's fault       |
| `rejected`             | No        | Any other `4xx`, or a redirect                                                          |
| `rate-limited`         | Yes       | `429`                                                                                   |
| `unavailable`          | Yes       | `5xx`                                                                                   |
| `timeout`              | Yes       | The deadline passed                                                                     |
| `network`              | Yes       | `fetch` rejected                                                                        |

The `invalid-*` codes and `payload-too-large` are answered before any request. A push service has no idempotency key, so retrying a `timeout` whose request landed shows the notification twice.

### `isSupported(): boolean` from `./browser`

Whether this browser has service workers, the Push API and notifications.

### `subscribe(options: SubscribeOptions): Promise<Result<BrowserSubscription, WebPushBrowserError>>` from `./browser`

Asks for permission unless it is granted, registers `options.worker` (under `options.scope` when given), and reuses the existing subscription or replaces one made under another key. Answers the subscription with the `applicationServerKey` it was made under.

### `WebPushBrowserError` from `./browser`

The failure `subscribe` returns, with `code` `unsupported` (no Push API), `denied` (permission refused) or `failed` (anything the browser threw, or a key that is not base64url).

### Types

`Subscription` is `{ endpoint, keys: { p256dh, auth }, applicationServerKey? }`, the shape of `PushSubscription.toJSON()` plus the VAPID public key it was made under; `SubscriptionKeys` is its `keys`. `BrowserSubscription` is a `Subscription` whose `applicationServerKey` is always set. `VapidKeyPair` is `{ publicKey, privateKey }` and `VapidKeys` adds `subject`. `WebPushOptions`, `PushOptions`, `SubscriptionPolicy` and `SubscribeOptions` are the option objects above; `Payload`, `Urgency` and `Pushed` are `send`'s payload, urgency and success. `WebPushErrorCode`, `WebPushErrorOptions` and `WebPushBrowserErrorCode` name the error codes and constructor options.

## Pattern: Applying A Failure To The Stored Row

Map each code to what happens to the subscription: delete on `gone`, log the non-retryable ones, and retire a row after too many retryable failures.

```typescript
import type { Subscription } from "@sdxc/web-push";

import { isFailure } from "@sdxc/result";
import { WebPush } from "@sdxc/web-push";

let failureLimit = 10;

async function deliver(push: WebPush, row: SubscriptionRow, payload: string) {
	let subscription: Subscription = {
		endpoint: row.endpoint,
		keys: { p256dh: row.p256dh, auth: row.auth },
		applicationServerKey: row.vapidKey ?? undefined,
	};

	let sent = await push.send(subscription, payload, { topic: "summary" });
	if (!isFailure(sent)) return await markDelivered(row.id);

	let error = sent.error;
	if (error.code === "gone") return await deleteSubscription(row.id);
	if (!error.retryable) return await logRejected(row.id, error.code);
	if (row.failures + 1 >= failureLimit) return await deleteSubscription(row.id);
	await scheduleRetry(row.id, error.retryAfter ?? 60_000);
}
```

## Pattern: Fanning Out To Many Devices

One `WebPush` signs one token per push service origin, so a thousand browsers on the same service cost one signature. A `topic` keeps only the latest message for an offline device, and `padding` hides the payload's length.

```typescript
import { isFailure } from "@sdxc/result";
import { WebPush } from "@sdxc/web-push";

let push = new WebPush({ vapid });
let payload = JSON.stringify({ title: "Build #42 failed", url: "/builds/42" });

let results = await Promise.all(
	subscriptions.map((subscription) =>
		push.send(subscription, payload, { topic: "build-status", urgency: "high", padding: 64 }),
	),
);

let gone = subscriptions.filter((_, index) => {
	let result = results[index];
	return isFailure(result) && result.error.code === "gone";
});
await deleteSubscriptions(gone.map((subscription) => subscription.endpoint));
```

## Pattern: Accepting Only Known Push Services

Pass `PUSH_SERVICE_HOSTS` to both the registration schema and the sender, so neither stores nor posts to an endpoint on any other host.

```typescript
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { PUSH_SERVICE_HOSTS, subscriptionSchema, WebPush } from "@sdxc/web-push";
import * as s from "remix/data-schema";

let schema = s.object({ subscription: subscriptionSchema({ allowedHosts: PUSH_SERVICE_HOSTS }) });
let push = new WebPush({ vapid, allowedHosts: PUSH_SERVICE_HOSTS });

let body = await validate(request, schema);
if (isFailure(body)) return Response.json({ errors: body.error.issues }, { status: 400 });

await saveSubscription(body.data.subscription);
await push.send(body.data.subscription, JSON.stringify({ title: "Notifications on" }));
```

## Pattern: Rotating The VAPID Key

A subscription is bound to the public key it was made with, and a push service refuses a message signed by any other. Store `applicationServerKey` beside each subscription, then rotate in three steps:

1. Generate a new pair and deploy it as `vapid`, with the old one in `previous`. Each send signs with the identity whose public key the subscription names, or `vapid` when it names none.

   ```typescript
   import { WebPush } from "@sdxc/web-push";

   let push = new WebPush({ vapid: current, previous: [old] });
   await push.send({ ...subscription, applicationServerKey: row.vapidKey }, payload);
   ```

2. Pages hand the new public key to `subscribe`, which replaces a subscription made under the old key the next time it runs; store the new subscription and key.
3. Once no stored subscription names the old key, drop it from `previous`.

## Pattern: Sending Through Your Own Transport

`request` answers the encrypted, signed `Request` without sending it, so a queue, a proxy or a custom `fetch` can deliver it. Classifying the response is then yours.

```typescript
import { isFailure } from "@sdxc/result";
import { WebPush } from "@sdxc/web-push";

let push = new WebPush({ vapid });

let built = await push.request(subscription, JSON.stringify({ title: "Hello" }), { ttl: 0 });
if (isFailure(built)) return logRejected(built.error.code);

let response = await proxiedFetch(built.data);
if (response.status === 404 || response.status === 410)
	await deleteSubscription(subscription.endpoint);
```

## Pattern: A Service Worker For A JSON Payload

The service worker that `subscribe` registers shows the notification the server's JSON describes and opens its URL on click.

```typescript
declare let self: ServiceWorkerGlobalScope;

self.addEventListener("push", (event) => {
	let payload = event.data?.json();
	if (!payload?.title) return;

	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			tag: payload.tag,
			data: { url: payload.url },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? "/"));
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/web-push": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
