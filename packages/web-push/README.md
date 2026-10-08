# @sdxc/web-push

Send Web Push notifications from Cloudflare Workers or any runtime with WebCrypto: RFC 8291 payload encryption, RFC 8292 VAPID signing, subscription checks, and a browser helper to subscribe.

No push provider account or SDK is involved: each browser picks its vendor's push service and hands you an endpoint on it, and your server is identified only by a VAPID key pair you generate.

Every send makes one `POST` with the global `fetch`, answers a `Result` and never throws. Failures carry a code that tells an app what to do with the stored subscription: delete it on `gone`, keep it on `unauthorized`, retry on `unavailable`. Where subscriptions live, and how many failures retire one, stay the app's decision.

## Installation

```bash
npm add @sdxc/web-push
```

Every operation answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), installed with this package.

## Usage

### Generating Keys

A sender is identified by one P-256 key pair. Generate it once, publish the public key to your pages, and keep the private key secret:

```bash
bun -e 'import { WebPush } from "@sdxc/web-push"; console.log(await WebPush.generateKeys())'
```

On Cloudflare Workers, store the private key as a secret:

```bash
cf workers secrets update VAPID_PRIVATE_KEY
```

### Sending A Message

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

Build one `WebPush` per batch of sends: it caches one VAPID token per push service origin, so fifty browsers on Chrome's push service cost one signature.

### Accepting A Subscription

`SUBSCRIPTION_SCHEMA` is a [`remix/data-schema`](https://www.npmjs.com/package/remix) schema that applies the checks a send applies: the endpoint is a public `https:` host, `p256dh` is a P-256 point on the curve, and `auth` is 16 bytes.

```typescript
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { SUBSCRIPTION_SCHEMA } from "@sdxc/web-push";
import * as s from "remix/data-schema";

let body = await validate(request, s.object({ subscription: SUBSCRIPTION_SCHEMA }));
if (isFailure(body)) return Response.json({ errors: body.error.issues }, { status: 400 });

await saveSubscription(body.data.subscription);
```

### Subscribing In The Browser

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

Call `subscribe` from a click or another user activation: Safari and Firefox refuse a permission prompt requested without one. On iOS and iPadOS, push is offered only to a web app added to the Home Screen.

## API

### `new WebPush(options: WebPushOptions)`

A sender for one VAPID identity. Constructing it does no I/O; the keys are imported and checked on the first send.

- `options.vapid`: `{ publicKey, privateKey, subject }`. `subject` is a `mailto:` or `https:` URI; Apple's push service refuses one it cannot use, so name a real address on your domain.
- `options.previous`: identities rotated out, kept until the subscriptions made under them re-subscribe. See [Rotating The VAPID Key](#pattern-rotating-the-vapid-key).
- `options.allowedHosts`: hosts an endpoint must be on, where `*.` matches any subdomain. Omitted, any public `https:` host is accepted.

### `push.send(subscription, payload?, options?): Promise<Result<Pushed, WebPushError>>`

Encrypts, signs and sends one message, answering `{ status }` for any `2xx`. One attempt only; retrying belongs to the caller. `payload` is a string (UTF-8 encoded), a `Uint8Array`, or omitted for a push the service worker answers by fetching.

| Option    | Default        | Meaning                                                                                       |
| --------- | -------------- | --------------------------------------------------------------------------------------------- |
| `ttl`     | `"4 weeks"`    | How long the push service holds the message for an offline device; a duration or milliseconds |
| `urgency` | `"normal"`     | `"very-low"`, `"low"`, `"normal"` or `"high"`; a device on battery defers the lower levels    |
| `topic`   | None           | Replaces an undelivered message with the same topic; up to 32 base64url characters            |
| `padding` | `0`            | Bytes added inside the record, so the ciphertext length says less about the payload           |
| `timeout` | `"10 seconds"` | Deadline for the `POST`                                                                       |
| `signal`  | None           | Aborts the `POST`                                                                             |

### `push.request(subscription, payload?, options?): Promise<Result<Request, WebPushError>>`

The `Request` `send` would make, for a caller that sends through something other than the global `fetch`. It never follows a redirect.

### `WebPush.generateKeys(): Promise<VapidKeyPair>`

A new P-256 pair, both halves base64url: the 65-byte public point and the 32-byte private scalar.

### `SUBSCRIPTION_SCHEMA` and `subscriptionSchema(policy?)`

A schema whose output is a `Subscription`. `subscriptionSchema({ allowedHosts })` builds one with an allow list. Unknown keys, such as the browser's `expirationTime`, are dropped.

### `PUSH_SERVICE_HOSTS`

The hosts of the push services Chrome, Firefox, Safari and Edge subscribe through, for `allowedHosts`.

### `MAX_PAYLOAD_BYTES`

`3993`: the most payload plus padding one record carries inside the 4,096-byte body every push service accepts.

### `WebPushError`

Every failure: `code`, `retryable`, the endpoint's `host` (never the endpoint, which is a credential), `status` when the push service answered, and `retryAfter` in milliseconds from `Retry-After`.

| `code`                 | Retryable | When                                                                                     |
| ---------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `invalid-subscription` | No        | Endpoint not public `https:`, malformed keys, or a key this sender no longer holds       |
| `invalid-vapid`        | No        | Keys that do not import or do not form a pair; `subject` not `mailto:` or `https:`       |
| `invalid-options`      | No        | A topic over 32 characters or outside base64url, a negative `ttl`, or impossible padding |
| `payload-too-large`    | No        | Payload plus padding over `MAX_PAYLOAD_BYTES`                                            |
| `gone`                 | No        | `404` or `410`: the subscription no longer exists; stop sending to it                    |
| `unauthorized`         | No        | `401` or `403`: the VAPID credential was refused, which is the sender's fault            |
| `rejected`             | No        | Any other `4xx`, or a redirect                                                           |
| `rate-limited`         | Yes       | `429`                                                                                    |
| `unavailable`          | Yes       | `5xx`                                                                                    |
| `timeout`              | Yes       | The deadline passed                                                                      |
| `network`              | Yes       | `fetch` rejected                                                                         |

The `invalid-*` codes and `payload-too-large` are answered before any request.

### `@sdxc/web-push/browser`

#### `isSupported(): boolean`

Whether this browser has service workers, the Push API and notifications.

#### `subscribe(options: SubscribeOptions): Promise<Result<BrowserSubscription, WebPushBrowserError>>`

Asks for permission unless it is granted, registers `options.worker` (under `options.scope` when given), and reuses the existing subscription or replaces it when it was made under another key. Answers the subscription with the `applicationServerKey` it was made under. A `WebPushBrowserError` has the code `unsupported`, `denied` or `failed`.

### Types

#### `Subscription`

`{ endpoint, keys: { p256dh, auth }, applicationServerKey? }`: the shape of `PushSubscription.toJSON()`, plus the VAPID public key the browser subscribed under.

#### `VapidKeys` and `VapidKeyPair`

`{ publicKey, privateKey, subject }` and the same without `subject`, every key base64url.

## Patterns

### Pattern: Applying A Failure To The Stored Row

```typescript
import type { Subscription, WebPushError } from "@sdxc/web-push";

import { isFailure } from "@sdxc/result";
import { WebPush } from "@sdxc/web-push";

const FAILURE_LIMIT = 10;

async function deliver(push: WebPush, row: SubscriptionRow, payload: string) {
	let subscription: Subscription = {
		endpoint: row.endpoint,
		keys: { p256dh: row.p256dh, auth: row.auth },
		applicationServerKey: row.vapidKey ?? undefined,
	};

	let sent = await push.send(subscription, payload, { topic: "summary" });
	if (!isFailure(sent)) return await markDelivered(row.id);

	let error: WebPushError = sent.error;
	if (error.code === "gone") return await deleteSubscription(row.id);
	if (!error.retryable) return await logRejected(row.id, error.code);
	if (row.failures + 1 >= FAILURE_LIMIT) return await deleteSubscription(row.id);
	await countFailure(row.id);
}
```

### Pattern: Rotating The VAPID Key

A subscription is bound to the public key it was made with, and a push service refuses a message signed by any other. Store the key beside each subscription, then rotate in three steps:

1. Generate a new pair. Deploy it as `vapid`, and the old one in `previous`:

   ```typescript
   let push = new WebPush({ vapid: current, previous: [old] });
   await push.send({ ...subscription, applicationServerKey: row.vapidKey }, payload);
   ```

2. Pages now hand the new public key to `subscribe`, which replaces a subscription made under the old key the next time it runs, and the app stores the new subscription and key.
3. Once no stored subscription names the old key, drop it from `previous`.

A subscription without `applicationServerKey` signs with `vapid`.

### Pattern: A Service Worker For A JSON Payload

```javascript
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
