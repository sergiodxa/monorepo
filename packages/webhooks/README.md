# @sdxc/webhooks

Sign and verify [Standard Webhooks](https://www.standardwebhooks.com/) deliveries, reporting
every failure as a typed value.

Inbound webhook verification is request authentication: if it is wrong, anyone can post an
event. This package implements the specification directly on
[`@sdxc/crypto`](https://www.npmjs.com/package/@sdxc/crypto) — `HMAC-SHA256` over
`id.timestamp.body`, compared in constant time — with no vendor SDK in the path.

Nothing throws. Every failure is a value naming what went wrong, and none of them carries a
secret or a signature, because these values are what gets logged.

## Installation

```bash
npm add @sdxc/webhooks
```

Every function reports its outcome as a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which is where `isFailure` and
`unwrap` come from. The `tolerance` and `ttl` options take a `DurationInput` from
[`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration). Both install alongside this
package.

## Usage

The package exports plain functions and reads well as a namespace import, so a call site says
what is being signed or verified.

### Verify An Inbound Request

```typescript
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";

let result = await Webhooks.verify(request, { secret: env.WEBHOOK_SECRET });
if (isFailure(result)) return new Response(null, { status: 401 });

let { id, timestamp, body, payload } = result.data;
```

The body is read once, as text, and verified exactly as received. It comes back on the
result, so a handler can store the raw delivery without re-serializing anything. Verify
before anything else reads the request: a stream is readable once, and a body consumed
upstream fails with `UnreadableBodyError`.

### Type The Payload

```typescript
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";
import * as s from "remix/data-schema";

let InvoiceEvent = s.object({ type: s.string(), amount: s.number() });

let result = await Webhooks.verify(request, { secret, schema: InvoiceEvent });
if (isFailure(result)) return new Response(null, { status: 401 });

result.data.payload.amount; // number
```

Any [Standard Schema](https://standardschema.dev) works, so a schema written with another
library needs no adapter. Without a `schema`, the body is still JSON decoded and `payload`
is typed `unknown`.

### Accept More Than One Secret

```typescript
import * as Webhooks from "@sdxc/webhooks";

await Webhooks.verify(request, { secrets: [env.WEBHOOK_SECRET, env.WEBHOOK_SECRET_PREVIOUS] });
```

A delivery is accepted when any configured secret matches, which is what makes a rotation
possible without a window of rejected deliveries.

### Sign An Outbound Delivery

```typescript
import { unwrap } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";

let signed = unwrap(await Webhooks.sign(event, { secret, id: deliveryId, timestamp: new Date() }));

signed.headers.set("Content-Type", "application/json");

await fetch(endpoint, { method: "POST", headers: signed.headers, body: signed.body });
```

Send `signed.body`: it is the exact text the signature covers. `sign()` sets only the three
signature headers, so a receiver that requires JSON needs the content type added here.

### Reject Replays

```typescript
import * as Webhooks from "@sdxc/webhooks";

let store = new Webhooks.KVReplayStore(env.WEBHOOKS);

await Webhooks.verify(request, { secret, store });
```

Timestamp tolerance bounds how long a captured request stays replayable; a store closes the
window by rejecting a delivery id that was already accepted.

## API

### `verify(request, options)`

Verifies a Standard Webhooks request and returns the delivery it carried, as a
`Result<VerifiedDelivery, WebhookError>`.

- `request`: Inbound request, with its body still unread
- `options.secret`: Signing secret, base64, with or without the `whsec_` prefix
- `options.secrets`: Secrets to try, for the receiver's own rotation; combined with `secret`
  when both are given
- `options.tolerance`: Accepted clock skew as a `DurationInput`, applied in both directions —
  defaults to `"5 minutes"`
- `options.schema`: Standard Schema the verified body is parsed with
- `options.store`: `ReplayStore` consulted to reject a delivery id that was already accepted
- `options.ttl`: How long an accepted id is remembered — defaults to twice the tolerance

```typescript
let result = await Webhooks.verify(request, { secret, tolerance: "2 minutes" });
```

Secrets are resolved, headers are read, the timestamp is bounded, the signature is compared,
the store is consulted, and only then is the payload parsed. Nothing but an authenticated
delivery ever reaches the store, and an id is remembered only once the delivery is fully
accepted, so a sender retrying a body this endpoint rejected is not answered with a
duplicate-id failure.

Every configured secret must decode: one unusable entry fails the call, because a silently
skipped secret is how a rotation stops working without anyone noticing. An endpoint whose
secret is unset fails closed, rejecting every delivery rather than accepting them all.

### `sign(payload, options)`

Signs a payload and returns the headers and body to deliver, as a
`Result<SignedDelivery, WebhookError>`.

- `payload`: Body to send; a string is signed as given, anything else is JSON encoded once
- `options.secret`: Signing secret, base64, with or without the `whsec_` prefix
- `options.id`: Unique delivery id; a retry of the same delivery reuses it, a new delivery
  must not
- `options.timestamp`: `Date`, or a number read as whole seconds since the epoch, so
  `Date.now()` is passed as a `Date`

```typescript
let signed = unwrap(
	await Webhooks.sign({ type: "invoice.paid" }, { secret, id, timestamp: new Date() }),
);
```

`signed.headers` is a `Headers` instance built fresh per call and owned by the caller: add a
content type or a user agent by mutating it. Copy it with `new Headers(signed.headers)`, since
spreading a [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) instance
into an object literal yields no entries.

### `KVReplayStore`

A `ReplayStore` backed by Workers KV, where each accepted delivery id is a key that expires on
its own.

#### `new KVReplayStore(kv: ReplayKVNamespace, options?: KVReplayStoreOptions)`

- `kv`: Workers KV binding to store delivery ids in
- `options.prefix`: Prefix put in front of every id — defaults to `"webhook-replay:"`; give
  each sender its own prefix when several share a namespace

```typescript
let store = new Webhooks.KVReplayStore(env.WEBHOOKS, { prefix: "billing:" });
```

#### `store.seen(id: string): Promise<boolean>`

Resolves `true` while the id is still remembered.

#### `store.remember(id: string, ttl: DurationInput): Promise<void>`

Records the id for the given duration, raised to KV's one-minute minimum when shorter.

KV reads are eventually consistent, so a duplicate arriving within seconds of the original in
another location can be missed: deduplication narrows the replay window, and an idempotent
handler is what makes repeated work harmless.

### Errors

Every failure extends `WebhookError`, so one `instanceof` covers the package. Read `name` as
the failure kind and `deliveryId` as the delivery it belongs to; both are safe to log.

| Error                       | Meaning                                                       | Authentic? |
| --------------------------- | ------------------------------------------------------------- | ---------- |
| `InvalidSecretError`        | No usable secret was configured (absent, empty, not base64)   | unknown    |
| `MissingHeaderError`        | One of the three headers is absent; `header` names it         | no         |
| `MalformedSignatureError`   | No readable `v1` value in the signature header                | no         |
| `MalformedTimestampError`   | The timestamp header is not a second count                    | no         |
| `StaleTimestampError`       | Outside `tolerance`, in either direction                      | no         |
| `SignatureMismatchError`    | No presented signature matched any configured secret          | no         |
| `DuplicateDeliveryError`    | The delivery id was already accepted                          | yes        |
| `PayloadValidationError`    | Verified, but not the expected shape; keeps `body` and issues | yes        |
| `ReplayStoreError`          | The store could not be read or written; `operation` names it  | unknown    |
| `UnreadableBodyError`       | The request body was already consumed upstream                | unknown    |
| `InvalidDeliveryError`      | `sign()` was given an unusable id, timestamp, or payload      | n/a        |
| `SignatureComputationError` | The runtime refused to compute the MAC                        | unknown    |

Answer `401` for the failures that say "no": those are authentication failures. A
`PayloadValidationError` means the delivery was authentic, so a retry of it changes nothing,
and a `DuplicateDeliveryError` means the work already happened, so a success response is the
honest answer that stops the retries.

### Types

#### `VerifiedDelivery<Payload>`

```typescript
interface VerifiedDelivery<Payload = unknown> {
	id: string; // from webhook-id
	timestamp: Date; // from webhook-timestamp
	body: string; // exact text the signature covers
	payload: Payload; // parsed body, typed by the schema
}
```

#### `VerifyOptions`

```typescript
interface VerifyOptions extends SecretOptions {
	tolerance?: DurationInput;
	schema?: StandardSchemaV1;
	store?: ReplayStore;
	ttl?: DurationInput;
}
```

Pass the options inline: the payload type is read off the object literal, so annotating a
variable with this interface widens `payload` back to `unknown`.

#### `VerifiedPayload<Options>`

The payload type a `verify()` call resolves to: the schema's output type when the call passed
one, `unknown` otherwise.

#### `SecretOptions`

```typescript
interface SecretOptions {
	secret?: string;
	secrets?: readonly string[];
}
```

Both are optional in the type, and at least one must resolve at runtime.

#### `SignOptions` and `SignedDelivery`

```typescript
interface SignOptions {
	secret: string;
	id: string;
	timestamp: Date | number;
}

interface SignedDelivery {
	headers: Headers; // webhook-id, webhook-timestamp, webhook-signature
	body: string; // exact text that was signed
	id: string;
	timestamp: number; // whole seconds, as sent
	signature: string; // the webhook-signature value
}
```

#### `ReplayStore`

```typescript
interface ReplayStore {
	seen(id: string): Promise<boolean>;
	remember(id: string, ttl: DurationInput): Promise<void>;
}
```

Implement it over any storage with a TTL — a table an operator can inspect, for instance.
`seen()` reports only ids that were remembered, since a false positive rejects an authentic
delivery.

#### `ReplayKVNamespace` and `KVReplayStoreOptions`

`ReplayKVNamespace` declares the two methods `KVReplayStore` calls — `get` and `put` — as a
subset, so a Workers `KVNamespace` binding satisfies it with no cast.
`KVReplayStoreOptions` carries the single `prefix` field.

## Pattern: A Fail-Closed Endpoint

Distinguish "not authentic" from "authentic but unmodelled", so an unknown event type is not
treated as an attack and the sender is not told to retry forever.

```typescript
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";

async function handleWebhook(request: Request): Promise<Response> {
	let result = await Webhooks.verify(request, {
		secret: env.WEBHOOK_SECRET,
		store: new Webhooks.KVReplayStore(env.WEBHOOKS),
	});

	if (isFailure(result)) {
		if (result.error instanceof Webhooks.DuplicateDeliveryError) {
			return new Response(null, { status: 200 }); // already processed, stop the retries
		}

		if (result.error instanceof Webhooks.PayloadValidationError) {
			return new Response(null, { status: 202 }); // authentic, nothing here models it
		}

		logger.warn("webhook rejected", {
			kind: result.error.name,
			delivery: result.error.deliveryId,
		});

		return new Response(null, { status: 401 });
	}

	await enqueue(result.data.payload);

	return new Response(null, { status: 202 });
}
```

## Pattern: Delivering And Retrying

Sign once per attempt, reusing the delivery id so the receiver can de-duplicate the retries of
one event, and refreshing the timestamp so a slow retry arrives inside the receiver's
tolerance.

```typescript
import { unwrap } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";

async function deliver(endpoint: string, event: unknown, deliveryId: string): Promise<Response> {
	let signed = unwrap(
		await Webhooks.sign(event, { secret, id: deliveryId, timestamp: new Date() }),
	);

	signed.headers.set("Content-Type", "application/json");
	signed.headers.set("User-Agent", "acme-webhooks/1");

	return await fetch(endpoint, { method: "POST", headers: signed.headers, body: signed.body });
}
```

## Pattern: Reproducible Signatures In Tests

Because the id and the timestamp are parameters rather than generated inside `sign()`, a
delivery can be re-signed byte for byte, which is what lets a test round-trip through
`verify()`.

```typescript
import { unwrap } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";

let signed = unwrap(await Webhooks.sign(body, { secret, id: "msg_1", timestamp: 1614265330 }));

let request = new Request(endpoint, {
	method: "POST",
	headers: signed.headers,
	body: signed.body,
});

let result = await Webhooks.verify(request, { secret, tolerance: "3650 days" });
```

## Pattern: Rotating A Receiver's Secret

Add the new secret to the front of the list, wait for the sender's queue to drain, then drop
the old one.

```typescript
import * as Webhooks from "@sdxc/webhooks";

let secrets = [env.WEBHOOK_SECRET, env.WEBHOOK_SECRET_PREVIOUS].filter(Boolean);

await Webhooks.verify(request, { secrets });
```

Keep `tolerance` small while a store is configured: it stays the narrow replay window, and the
store is what lets a slow retry still be recognized rather than rejected.

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
		"@sdxc/webhooks": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
