# ADR-123: Web Push Package

## Status

**Accepted** - 2026-10-08

## Background

`reader` notifies readers through the Web Push protocol ([reader ADR-005](./reader/ADR-005-notifications.md)).
The protocol half of that feature lives in `apps/reader/app/push/web-push.ts`: RFC 8291 payload
encryption, an RFC 8292 VAPID credential, and the `Request` that delivers one message to one
device. It depends only on `@sdxc/crypto`, `@sdxc/jwt` and `@sdxc/result`, takes every key as an
argument, and is tested against RFC 8291's published vector. Nothing in it is about feeds or
readers.

Two more apps want the same channel: `uptime` alerting a team member's browser when a monitor goes
down, and `blog` telling visitors about a new post. [ADR-112](./ADR-112-messaging-package.md) kept
browser push out of `@sdxc/messaging` and named "its own protocol package" as where it belongs.
This ADR extracts that package, decides what of the browser side comes with it, and decides how
`@sdxc/messaging` reaches it.

## Context

### What `reader` has today

| Location                                         | What it does                                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/push/web-push.ts` (~290 lines)              | `encryptPayload`, `vapidAuthorization`, `pushRequest`; `VapidKeys`, `PushTarget`                                                               |
| `app/push/web-push.test.ts`                      | RFC 8291 §5 vector, a decrypt round trip, the VAPID token's claims, the request's headers                                                      |
| `app/push/vapid.ts`                              | Reads `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` from `cloudflare:workers` `env`; `null` when any is unset                       |
| `database/notify.ts`                             | `deliverTo` sends with `fetch(await pushRequest(…))`, maps the status through `pushOutcome`, and updates or deletes the device row             |
| `database/migrations/0012-notifications.sql`     | `push_subscriptions` in each reader's `UserDO`: `endpoint` (unique), `p256dh`, `auth`, `locale`, `failure_count`, `last_delivered_at`          |
| `app/http/controllers/notifications/devices.tsx` | `POST` registration; validates `endpoint`, `p256dh` and `auth` as `s.string()`                                                                 |
| `resources/components/push-registration.tsx`     | Client entry: reports the time zone, registers `/sw.js`, asks permission, subscribes, posts the subscription; hand-written base64url both ways |
| `public/sw.js`                                   | Draws the summary under one `tag`, opens the queue on click                                                                                    |

Delivery runs inside the reader's own Durable Object alarm, not a job: one `POST` per device,
concurrently, never rejecting. The status decides the row:

| Status                    | `reader`'s outcome | Row                                    |
| ------------------------- | ------------------ | -------------------------------------- |
| `200`, `201`, `202`       | `accepted`         | Stamp `last_delivered_at`, clear count |
| `404`, `410`              | `expired`          | Delete now                             |
| `400`, `403`              | `rejected`         | Keep; it is our signature or keys      |
| Anything else, or a throw | `transient`        | Count; delete at `PUSH_FAILURE_LIMIT`  |

That policy (the failure limit, deleting on `410`, keeping on `403`) is the app's, because it
decides what happens to stored rows. Classifying a push service's answer is the protocol's.

### The protocol

| Part               | Spec     | What it requires                                                                                                                                        |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delivery           | RFC 8030 | `POST` to the subscription's endpoint; `TTL` required; optional `Urgency` (`very-low`, `low`, `normal`, `high`) and `Topic` (≤ 32 base64url characters) |
| Payload encryption | RFC 8291 | ECDH on P-256 with the subscription's `p256dh`, HKDF with its `auth` secret, `aes128gcm` content coding (RFC 8188) in one record                        |
| Sender identity    | RFC 8292 | An ES256 JWT with `aud` = the endpoint's origin, `exp` ≤ 24 hours, `sub` a `mailto:` or `https:` URI; `Authorization: vapid t=…, k=…`                   |
| Size               | RFC 8030 | A push service accepts at least 4,096 bytes of body; the record header is 86 bytes and AES-GCM adds 17, so 3,993 bytes of plaintext always fit          |

A subscription is bound to the VAPID public key it was created with (`applicationServerKey`). A
push service refuses a message signed by any other key with `401` or `403`, so rotating the key
silently breaks every existing subscription unless the browser subscribes again.

### Issues identified

| Issue                                               | Impact                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| The protocol lives in one app                       | `uptime` and `blog` would copy 290 lines of cryptography, or not offer the channel                              |
| Registration accepts any string as `endpoint`       | A signed-in user can make the reader's object `POST` to any URL, including hosts the Worker can reach privately |
| Key material is not checked at registration         | A malformed `p256dh` throws inside `encryptPayload`, which `deliverTo` reports as a transient `503`             |
| No payload size check                               | An over-long payload is refused by the push service as a `413`, counted as transient until the row is deleted   |
| One VAPID JWT is signed per device per delivery     | An ECDSA signature for every device, though one token per push service origin would do for 12 hours             |
| The client entry asks for permission when it mounts | Safari and Firefox grant a notification prompt only from a user gesture, so the prompt can be refused unseen    |
| No path for rotating the VAPID key                  | A rotation breaks every device with no way back but each reader re-registering by hand                          |

### What the browser side involves

Subscribing is the same everywhere: register a service worker, wait for it to be ready, reuse
`pushManager.getSubscription()` or call `pushManager.subscribe({ userVisibleOnly: true,
applicationServerKey })`, and send `subscription.toJSON()` (which already carries both keys as
base64url) to the server. What differs per app is everything around it: when to ask, what else the
page reports (reader's time zone), where the subscription is posted, and the service worker's
`push` and `notificationclick` handlers, which draw the app's own payload.

## Decision

Add `@sdxc/web-push`, public:

- **`@sdxc/web-push`**: a `WebPush` class configured once with the VAPID identity, which encrypts,
  signs and sends; `WebPush.generateKeys()`; subscription parsing; `WebPushError`.
- **`@sdxc/web-push/browser`**: `subscribe()` and `isSupported()`, plain functions for a client
  entry or a click handler. No `./ui` entry.

It depends on `@sdxc/crypto`, `@sdxc/jwt`, `@sdxc/outbound`, `@sdxc/duration` and
`@sdxc/result`. Storage stays in the apps (see
[Storage and policy stay in apps](#storage-and-policy-stay-in-apps)): the package never sees a
table, a row id or a failure count.

### Sending

```typescript
import { WebPush } from "@sdxc/web-push";

let push = new WebPush({
	vapid: {
		publicKey: env.VAPID_PUBLIC_KEY,
		privateKey: env.VAPID_PRIVATE_KEY,
		subject: "mailto:ops@example.com",
	},
});

let sent = await push.send(subscription, JSON.stringify(payload), {
	ttl: "4 weeks",
	urgency: "normal",
	topic: "summary",
	timeout: "10 seconds",
});
// Result<{ status: number }, WebPushError>
```

| Option    | Default        | Meaning                                                                                                                                                             |
| --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ttl`     | `"4 weeks"`    | How long the push service holds the message for an offline device; a `@sdxc/duration` value (a bare number is milliseconds, as everywhere `DurationInput` is taken) |
| `urgency` | `"normal"`     | RFC 8030 urgency, which lets a device on battery defer low-urgency messages                                                                                         |
| `topic`   | None           | Replaces an undelivered message with the same topic, so an offline device receives only the latest                                                                  |
| `padding` | `0`            | Bytes of padding added inside the record, so ciphertext length says less about the payload                                                                          |
| `timeout` | `"10 seconds"` | Deadline for the `POST`                                                                                                                                             |
| `signal`  | None           | Aborts the `POST`                                                                                                                                                   |

- `payload` is a `string` (UTF-8 encoded) or a `Uint8Array`, or omitted for a push with no body
  (a "tickle" the service worker answers by fetching).
- **`push.request(subscription, payload, options)`** answers `Result<Request, WebPushError>` for a
  caller that sends through something other than the global `fetch`; `send` is `request` plus one
  `fetch` and the classification below.
- **VAPID tokens are cached per instance**, keyed by push service origin, and reused until an hour
  before their 12-hour expiry, so delivering to fifty devices on one push service signs once.
- **One attempt per `send`**, as in `@sdxc/messaging`: retrying belongs to the caller's alarm or
  job, which knows how long a message stays worth sending.
- **Redirects are failures**, never followed, since a push service does not redirect and the
  endpoint came from a browser.

### Errors

Every failure is a `WebPushError` with a `code`, `retryable`, the endpoint's `host` (never the full
endpoint, which is a bearer capability), `status` where there was a response, and `retryAfter` in
milliseconds from `Retry-After`. The codes reuse `@sdxc/messaging`'s vocabulary wherever the meaning
is the same, so the messaging provider below maps them one to one:

| `code`                 | Retryable | When                                                                                                |
| ---------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| `invalid-subscription` | No        | Endpoint not `https:` or not a public host; `p256dh` not a 65-byte P-256 point; `auth` not 16 bytes |
| `invalid-vapid`        | No        | Keys that do not import or do not form a pair; `subject` not `mailto:` or `https:`                  |
| `invalid-options`      | No        | A `topic` over 32 characters or outside base64url; a negative `ttl`; `padding` that cannot fit      |
| `payload-too-large`    | No        | Payload plus padding over 3,993 bytes                                                               |
| `gone`                 | No        | `404` or `410`: the subscription no longer exists; stop sending to it                               |
| `unauthorized`         | No        | `401` or `403`: the VAPID credential was refused, which is the sender's fault, never the device's   |
| `rejected`             | No        | Any other `4xx`, or a redirect                                                                      |
| `rate-limited`         | Yes       | `429`                                                                                               |
| `unavailable`          | Yes       | `5xx`                                                                                               |
| `timeout`              | Yes       | The deadline passed                                                                                 |
| `network`              | Yes       | `fetch` rejected                                                                                    |

The `invalid-*` and `payload-too-large` codes are answered before any request, so a bad row or a
bad deploy costs no network call. A success is any `2xx`; `status` is returned because push
services differ (`201` from most, `200` from some).

### Subscriptions

```typescript
export interface Subscription {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}
```

The shape is `PushSubscription.toJSON()` minus `expirationTime`, so the browser's own JSON is a
valid input. An app storing the keys as columns, as `reader` does, maps a row to it.

`SUBSCRIPTION_SCHEMA` is a `remix/data-schema` schema for a registration route, parsed through
`@sdxc/validate` as `@sdxc/messaging`'s `MESSAGE_SCHEMA` is. It applies the same checks `send`
does: `checkUrl` from `@sdxc/outbound` on the endpoint (`https:`, public host, no credentials),
and the decoded lengths and point prefix of both keys. A subscription that passes registration is
one `send` will not refuse as `invalid-subscription`, short of the point being off the curve, which
only the import detects.

Restricting endpoints to the known push services (`fcm.googleapis.com`,
`updates.push.services.mozilla.com`, `web.push.apple.com`, `*.notify.windows.com`) is an option,
`allowedHosts`, rather than the default: a browser vendor can add a push service, and a hard-coded
list would drop its users silently. Whether the default should flip is an open question.

### VAPID keys

```typescript
let keys = await WebPush.generateKeys();
// { publicKey: "BPx…" (65-byte point, base64url), privateKey: "…" (32-byte scalar, base64url) }
```

The README shows generating a pair with `bun -e` and setting the private key with
`cf workers secrets update`; the package ships no binary. Keys stay in the app's environment, read
at the app's boundary, as `reader`'s `vapid.ts` does today.

**Rotation** is supported by sending each subscription with the pair it was made under:

```typescript
let push = new WebPush({ vapid: current, previous: [old] });
await push.send({ ...subscription, applicationServerKey: row.vapid_key }, payload);
```

- `Subscription` takes an optional `applicationServerKey`, the public key the browser subscribed
  with. `send` signs with the matching pair from `vapid` or `previous`, and with `vapid` when the
  field is absent, which is every row stored before rotation existed.
- An app records the key at registration. `@sdxc/web-push/browser`'s `subscribe` re-subscribes when
  the existing subscription's `options.applicationServerKey` differs from the page's key, so a
  browser moves to the new pair on the next page view after a deploy.
- Once rows under the old key stop arriving or age out, the app drops it from `previous`.

### `@sdxc/web-push/browser`

```typescript
import { isSupported, subscribe } from "@sdxc/web-push/browser";

button.addEventListener("click", async () => {
	if (!isSupported()) return;
	let subscribed = await subscribe({ worker: "/sw.js", applicationServerKey });
	if (isSuccess(subscribed))
		await fetch(devicesUrl, { method: "POST", body: JSON.stringify(subscribed.data) });
});
```

- `subscribe` registers the worker, asks for permission when it has not been granted, reuses or
  replaces the existing subscription by comparing keys, and answers
  `Result<Subscription & { applicationServerKey: string }, WebPushBrowserError>` with codes
  `unsupported`, `denied` and `failed`.
- Its README states the gesture rule: call it from a click or another user activation, since
  Safari and Firefox refuse a permission prompt requested without one, and iOS offers push only to
  a web app added to the Home Screen.
- **No `./ui` component.** `reader`'s `PushRegistration` decides when to ask, reports a time zone,
  and posts to its own route; each of those is the app's product, so a component would be either
  `reader`'s or a configuration surface larger than the thirty lines it replaces. Apps call these
  functions from their own client entries.
- **No service worker helper.** The `push` handler draws the app's own payload; the README shows the
  ten-line handler for the payload the messaging provider below writes.

### Storage and policy stay in apps

| Concern                                   | Owner   |
| ----------------------------------------- | ------- |
| Where subscriptions are stored and keyed  | App     |
| Deleting a row on `gone`                  | App     |
| Counting transient failures, giving up    | App     |
| Gaps, quiet hours, batching, fan-out      | App     |
| Payload shape and the service worker      | App     |
| Encryption, signing, headers, size limits | Package |
| Classifying a push service's answer       | Package |
| Validating a subscription                 | Package |

### `@sdxc/messaging` gains a browser push provider

`@sdxc/messaging/web-push` exports `BrowserPush`, a `Destination` over `@sdxc/web-push`:

```typescript
import { BrowserPush } from "@sdxc/messaging/web-push";

let destination = new BrowserPush({ push, subscription });
await destination.send({
	title: "api.example.com is down",
	severity: "critical",
	key: "monitor-42",
	links: [{ label: "Open", url }],
});
```

- `render(message)` answers the JSON payload: `title`, `body` (the text through `plainText`, fitted
  to the size limit), `url` (the first link), `tag` (the `key`, so a resolved message replaces the
  open one on the lock screen), `severity` and `timestamp`. `key` also becomes the `Topic`.
- `WebPushError` codes map to `MessagingError` codes by name; `payload-too-large` becomes
  `invalid-message` and `invalid-subscription` becomes `invalid-destination`.
- It passes `describeDestination` from `@sdxc/messaging/conformance`, with MSW standing in for the
  push service.
- The class is `BrowserPush` because `WebPush` is the protocol package's class, and an app importing
  both would otherwise alias one.

`reader` keeps calling `@sdxc/web-push` directly, since its payload is localized per device and its
row policy reads the raw error. `uptime`, which already turns a stored channel configuration into a
`Destination`, gains browser push as one more kind.

### Follow-up consumers

- **`uptime`**: a team member enables browser alerts per device; subscriptions live in D1 keyed by
  user; alert delivery is the existing job, which already retries messaging destinations.
- **`blog`**: anonymous visitors subscribe to new posts. That is publish-time fan-out to every
  subscriber, the shape reader ADR-005 designed away from, so it runs as `@sdxc/jobs` batches and
  gets its own app ADR covering consent, unsubscribe and cost.

## Consequences

### Positive

- **One implementation of the cryptography**, tested against the RFC vectors once, for every app.
- **Registration is safe:** an endpoint must be a public `https:` host and keys must decode to the
  right lengths before a row is written, which closes `reader`'s arbitrary-URL `POST`.
- **Failures are classified before they cost anything:** malformed rows and oversized payloads
  answer immediately, instead of counting as transient until a row is deleted.
- **Rotation is possible** without asking every user to re-register by hand.
- **Fewer signatures:** one VAPID token per push service origin per instance.
- **Browser push joins `@sdxc/messaging`** for apps that route alerts through destinations.

### Negative

- **`@sdxc/outbound` becomes a dependency** of a package that otherwise only does cryptography.
- **A second error vocabulary** close to `@sdxc/messaging`'s, kept aligned by hand and by the
  provider's mapping test.
- **`@sdxc/messaging` depends on `@sdxc/web-push`** and through it on `@sdxc/jwt`, for every
  install, not only apps that send browser push.

### Neutral

- **`reader`'s behavior is unchanged** except for the stricter registration and the gesture rule;
  its outcome table becomes a mapping from error codes instead of statuses.
- **`vapid.ts` stays in `reader`**, since reading `env` is the app's boundary.

## Implementation Plan

### Phase 1: The package

**Priority:** High
**Estimated Effort:** 4 hours

1. Create `packages/web-push`, public, moving the encryption and VAPID code from
   `apps/reader/app/push/web-push.ts` behind `WebPush` (`send`, `request`, `generateKeys`),
   `Subscription`, `SUBSCRIPTION_SCHEMA` and `WebPushError`.
2. Tests under `src/`:
   - RFC 8291 §5: the published subscription, sender pair, salt and plaintext produce the published
     record byte for byte (moved from `reader`).
   - Round trip: a test-side decrypt with the recipient's private key, across payload sizes up to
     3,993 bytes and with padding; 3,994 bytes fails `payload-too-large`.
   - VAPID: the token verifies with `JWT.verify` against the public key, `aud` is the origin,
     `exp` is within 24 hours, `k` is the public key; a second send to the same origin reuses it.
   - Status classification through MSW (`setupServer`) for every row of the error table, against
     endpoints shaped like FCM, Mozilla, Apple and WNS, including `Retry-After` and a redirect.
   - Subscription validation: private and reserved hosts, `http:`, short keys, a point without the
     `0x04` prefix; and rotation choosing the pair by `applicationServerKey`.
3. README following the package documentation guide, with key generation, rotation and the
   gesture rule.

### Phase 2: The browser entry

**Priority:** Medium
**Estimated Effort:** 2 hours

1. `@sdxc/web-push/browser` with `subscribe` and `isSupported`, tested with a fake
   `ServiceWorkerContainer` and `PushManager` in a `happy-dom` environment: reuse, replacement on a
   key mismatch, `denied`, `unsupported`.

### Phase 3: Migrate `reader`

**Priority:** High
**Estimated Effort:** 3 hours

1. `database/notify.ts` builds one `WebPush` per delivery round from `vapidKeys()` and maps
   `WebPushError` codes to its `PushOutcome`: `gone` to `expired`; `unauthorized`, `rejected` and
   the `invalid-*` codes to `rejected`; the retryable codes to `transient`.
2. `notifications/devices.tsx` parses with `SUBSCRIPTION_SCHEMA`, and a new `UserDO` migration adds
   `vapid_key` to `push_subscriptions`, null for existing rows.
3. `push-registration.tsx` calls `subscribe` from `@sdxc/web-push/browser`; the hand-written base64url
   helpers go. Prompting moves behind a user gesture on the settings page.
4. Delete `app/push/web-push.ts` and its test; set `topic` on the summary so an offline device
   receives only the newest one.
5. Regression tests: registration refuses a private-host endpoint and a short key.

### Phase 4: `@sdxc/messaging` provider

**Priority:** Low
**Estimated Effort:** 2 hours

1. `@sdxc/messaging/web-push` with `BrowserPush`, its `render`, the error mapping and the
   conformance suite; a row in the providers table.
2. Built when `uptime` schedules browser alerts, so the first consumer shapes the payload.

## Alternatives Considered

### 1. Browser push as a `@sdxc/messaging` provider only

**Rejected because**: `reader` needs the raw protocol (its own payload per device, its own reading of
each status), and ADR-112 chose to keep the protocol in its own package. The provider is a thin
layer over this one.

### 2. The `web-push` npm package

**Rejected because**: it depends on Node's `crypto`, `https` and `http_ece`, which do not run on
Workers without compatibility shims, and it throws rather than answering a `Result`. The repo's own
implementation already runs on Workers and passes the RFC vector.

### 3. A `./ui` component for subscribing

**Rejected because**: when to ask and what else to report are each app's decisions. See
[`@sdxc/web-push/browser`](#sdxcweb-pushbrowser).

### 4. Subscription storage in the package

A store interface with D1 and Durable Object adapters, with the failure policy built in.

**Rejected because**: packages own logic, not storage. `reader` keeps subscriptions per reader in a
Durable Object and `uptime` would keep them in D1 per user; the policy differs with the product.

### 5. Endpoint allowlist by default

**Deferred**: see [Subscriptions](#subscriptions) and the open questions.

## References

- [RFC 8030, Generic Event Delivery Using HTTP Push](https://datatracker.ietf.org/doc/html/rfc8030)
- [RFC 8188, Encrypted Content-Encoding for HTTP](https://datatracker.ietf.org/doc/html/rfc8188)
- [RFC 8291, Message Encryption for Web Push](https://datatracker.ietf.org/doc/html/rfc8291)
- [RFC 8292, VAPID for Web Push](https://datatracker.ietf.org/doc/html/rfc8292)
- [W3C Push API](https://www.w3.org/TR/push-api/)
- [MDN, Notification.requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)
- [WebKit, Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-108: Outbound Package](./ADR-108-outbound-package.md)
- [ADR-112: Messaging Package](./ADR-112-messaging-package.md)
- [reader ADR-005: Notifications](./reader/ADR-005-notifications.md)

## Current Progress

- [x] Phase 1: The package
- [x] Phase 2: The browser entry
- [x] Phase 3: Migrate `reader`
- [x] Phase 4: `@sdxc/messaging` provider

### As built

- `@sdxc/messaging` takes `@sdxc/web-push` as a direct dependency (open question 2), keeping one
  install for every provider. `invalid-vapid` maps to `unauthorized` and `invalid-options` to
  `invalid-message`. A `key` that is not short base64url is sent as 32 characters of its SHA-256,
  so any key works as a `Topic`. `render` cuts the text, keeping fields, until the JSON fits one
  push, so a long message never fails `invalid-message`.

- Subscription checks also test that `p256dh` lies on the P-256 curve (the check `reader` already
  ran at registration), so `invalid-subscription` never waits for the ECDH import to find it.
- A subscription whose `applicationServerKey` matches neither `vapid` nor any of `previous` fails
  `invalid-subscription` before any request: signing it with another key would only earn a `403`.
- `subscribe` asks for permission before registering the worker, so the prompt runs inside the user
  activation that called it rather than after an `await` that may have spent it.
- `reader` already prompted from a button press; its island now calls `subscribe` from that press,
  posts `{ subscription, locale }`, and stores the subscription's key in `push_subscriptions.vapid_key`
  (`UserDO` migration `0018-push-vapid-key`).

## Notes

- The package is public from its first commit: a description, a `LICENSE.md`, a row in the root
  README table, and `bun run release:bootstrap @sdxc/web-push`.
- The package commit and the `reader` migration are separate commits, scoped `web-push` and
  `reader`; the messaging provider is a third, scoped `messaging`.
- Endpoints are capabilities: anyone holding one plus the keys can notify that device. Errors and
  logs carry the host only, as `@sdxc/messaging` does for webhook URLs.
- Apple's push service rejects a VAPID `sub` it cannot use as a contact, so the README recommends a
  real `mailto:` on the sender's domain.

### Open questions

1. **Allowlist by default?** Restricting endpoints to the known push services is the tighter SSRF
   boundary; the cost is silently dropping a new browser vendor's users until the list is updated.
2. **`@sdxc/messaging` dependency weight.** Should `BrowserPush` take `@sdxc/web-push` as an optional
   peer, so messaging installs without the JWT and crypto stack, or is a direct dependency simpler?
3. **A service worker helper.** If two apps end up with the same `push`/`notificationclick` handler
   for the messaging payload, does it become `@sdxc/web-push/service-worker`?
4. **`blog` fan-out.** Whether anonymous new-post notifications are worth the per-subscriber cost is
   a product decision for `blog`'s own ADR.
