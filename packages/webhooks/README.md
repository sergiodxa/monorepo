# @pkg/webhooks

[Standard Webhooks](https://www.standardwebhooks.com/) signing and verification, with `Result`-based failures.

## Overview

Inbound webhook verification is request authentication: if it is wrong, anyone can post an event. This package implements the Standard Webhooks specification directly on [`@pkg/crypto`](/packages/crypto) — `HMAC-SHA256` over `id.timestamp.body`, compared in constant time — so the authentication path is a few reviewed functions with no vendor SDK and no third-party crypto in it.

The same scheme covers both directions. `verify()` reads the `webhook-id`, `webhook-timestamp`, and `webhook-signature` headers of an inbound request; `sign()` produces those three headers for an outbound delivery, so receivers can verify it with any off-the-shelf Standard Webhooks library. Signatures are pinned against the specification's published test vector in both directions.

Nothing throws. Every failure is a typed value describing exactly what went wrong — a missing header, a stale timestamp, no matching signature, a duplicate delivery, a body that does not match the schema — so a caller can answer `401` for a request that is not authentic and `400` for one that is authentic but unmodelled. No error value ever carries a secret or a signature, because these values are what gets logged.

## Usage

The package exports plain functions and is meant to be imported as a namespace, so a call site says what is being signed or verified:

### Verifying An Inbound Request

```typescript
import * as Webhooks from "@pkg/webhooks";
import { isFailure } from "@pkg/result";

let result = await Webhooks.verify(request, { secret: env.WEBHOOK_SECRET });
if (isFailure(result)) return new Response(null, { status: 401 });

let { id, timestamp, body, payload } = result.data;
```

The body is read once, as text, and verified exactly as received. It comes back on the result, so a handler can store the raw delivery without re-serializing anything.

### Typing The Payload

```typescript
import * as Webhooks from "@pkg/webhooks";
import { isFailure } from "@pkg/result";
import * as s from "remix/data-schema";

let SubscriptionEvent = s.object({ type: s.string(), amount: s.number() });

let result = await Webhooks.verify(request, { secret, schema: SubscriptionEvent });
if (isFailure(result)) return new Response(null, { status: 401 });

result.data.payload.amount; // number
```

Any [Standard Schema](https://standardschema.dev) works, so a sender-provided schema from another library needs no adapter.

### Rotating Secrets

```typescript
import * as Webhooks from "@pkg/webhooks";

await Webhooks.verify(request, { secrets: [env.WEBHOOK_SECRET, env.WEBHOOK_SECRET_PREVIOUS] });
```

A delivery is accepted when any configured secret matches, which is what makes a rotation possible without a window of rejected deliveries.

### Signing An Outbound Delivery

```typescript
import * as Webhooks from "@pkg/webhooks";
import { unwrap } from "@pkg/result";

let signed = unwrap(await Webhooks.sign(event, { secret, id: deliveryId, timestamp: new Date() }));

signed.headers.set("Content-Type", "application/json");

await fetch(endpoint, { method: "POST", headers: signed.headers, body: signed.body });
```

Send `signed.body`: it is the exact text the signature covers.

### Rejecting Replays

```typescript
import * as Webhooks from "@pkg/webhooks";

let store = new Webhooks.KVReplayStore(env.WEBHOOKS);

await Webhooks.verify(request, { secret, store });
```

Timestamp tolerance bounds how long a captured request stays replayable; a store closes the window by rejecting a delivery id that was already accepted.

## API

### `verify(request, options)`

Verifies a Standard Webhooks request and returns the delivery it carried.

**Parameters:**

- `request`: Inbound request, with its body still unread
- `options.secret`: Signing secret, base64, with or without the `whsec_` prefix
- `options.secrets`: Secrets to try, for the receiver's own rotation; combined with `secret` when both are given
- `options.tolerance`: Accepted clock skew as a `DurationInput`, applied in both directions — defaults to `"5 minutes"`
- `options.schema`: Standard Schema the verified body is parsed with
- `options.store`: `ReplayStore` consulted to reject a delivery id that was already accepted
- `options.ttl`: How long an accepted id is remembered — defaults to twice the tolerance

**Returns:**

- `Result<VerifiedDelivery, WebhookError>` — the delivery, or the failure describing why it was rejected

**Example:**

```typescript
let result = await Webhooks.verify(request, { secret, tolerance: "2 minutes" });
```

Order of checks: secrets are resolved, headers are read, the timestamp is bounded, the signature is compared, the store is consulted, and only then is the payload parsed. Nothing but an authenticated delivery ever reaches the store, and an id is remembered only once the delivery is fully accepted, so a sender retrying a body this endpoint rejected is not answered with a duplicate-id failure.

### `sign(payload, options)`

Signs a payload and returns the headers and body to deliver.

**Parameters:**

- `payload`: Body to send; a string is signed as given, anything else is JSON encoded once
- `options.secret`: Signing secret, base64, with or without the `whsec_` prefix
- `options.id`: Unique delivery id; a retry of the same delivery reuses it, a new delivery must not
- `options.timestamp`: `Date`, or a number read as whole seconds since the epoch

**Returns:**

- `Result<SignedDelivery, WebhookError>` — the signed delivery, or the failure describing the unusable input

**Example:**

```typescript
let signed = unwrap(
	await Webhooks.sign({ type: "monitor.down" }, { secret, id, timestamp: new Date() }),
);
```

`signed.headers` is a `Headers` instance built fresh per call and owned by the caller: add a content type or a user agent by mutating it. Spreading a `Headers` instance into an object literal yields no entries, so copy it with `new Headers(signed.headers)` rather than spreading it.

### `KVReplayStore`

A `ReplayStore` backed by Workers KV, where each accepted delivery id is a key that expires on its own.

#### `new KVReplayStore(kv, options?)`

**Parameters:**

- `kv`: Workers KV binding to store delivery ids in
- `options.prefix`: Prefix put in front of every id — defaults to `"webhook-replay:"`; give each sender its own prefix when several share a namespace

#### `store.seen(id)`

Resolves `true` while the id is still remembered.

#### `store.remember(id, ttl)`

Records the id for the given `DurationInput`, raised to KV's one-minute minimum when shorter.

**Example:**

```typescript
let store = new Webhooks.KVReplayStore(env.WEBHOOKS, { prefix: "billing:" });
```

KV reads are eventually consistent, so a duplicate arriving within seconds of the original in another location can be missed: deduplication narrows the replay window, it does not replace an idempotent handler.

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

Pass the options inline: the payload type is read off the object literal, so annotating a variable with this interface widens `payload` back to `unknown`.

#### `VerifiedPayload<Options>`

The payload type a `verify()` call resolves to: the schema's output type when the call passed one, `unknown` otherwise.

#### `SecretOptions`

```typescript
interface SecretOptions {
	secret?: string;
	secrets?: readonly string[];
}
```

Both are optional in the type and at least one must resolve at runtime: an endpoint whose secret is unset fails closed instead of accepting whatever arrives.

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

Implement it over any storage with a TTL — a table an operator can inspect, for instance. `seen()` must not report an id that was never remembered, since a false positive rejects an authentic delivery.

#### `ReplayKVNamespace`

The two methods `KVReplayStore` calls, declared as a subset so a `KVNamespace` binding satisfies it with no cast.

### Errors

Every failure extends `WebhookError`, so one `instanceof` covers the package. Read `name` as the failure kind and `deliveryId` as the delivery it belongs to.

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

## Pattern: A Fail-Closed Endpoint

Distinguish "not authentic" from "authentic but unmodelled", so an unknown event type is not treated as an attack and the sender is not told to retry forever.

```typescript
import * as Webhooks from "@pkg/webhooks";
import { isFailure } from "@pkg/result";

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

Sign once per attempt, reusing the delivery id so the receiver can de-duplicate the retries of one event, and refreshing the timestamp so a slow retry does not arrive stale.

```typescript
import * as Webhooks from "@pkg/webhooks";
import { unwrap } from "@pkg/result";

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

Because the id and the timestamp are parameters rather than generated inside `sign()`, a delivery can be re-signed byte for byte.

```typescript
import * as Webhooks from "@pkg/webhooks";
import { unwrap } from "@pkg/result";

let signed = unwrap(await Webhooks.sign(body, { secret, id: "msg_1", timestamp: 1614265330 }));

let request = new Request(endpoint, {
	method: "POST",
	headers: signed.headers,
	body: signed.body,
});

let result = await Webhooks.verify(request, { secret, tolerance: "3650 days" });
```

## Pattern: Rotating A Receiver's Secret

Add the new secret to the front of the list, wait for the sender's queue to drain, then drop the old one.

```typescript
import * as Webhooks from "@pkg/webhooks";

let secrets = [env.WEBHOOK_SECRET, env.WEBHOOK_SECRET_PREVIOUS].filter(Boolean);

await Webhooks.verify(request, { secrets });
```

Every configured secret must decode: one unusable entry fails the call, because a silently skipped secret is how a rotation stops working without anyone noticing.

## Related Packages

- [`@pkg/crypto`](/packages/crypto) - HMAC, base64url, and the constant-time comparison this package is built on
- [`@pkg/duration`](/packages/duration) - the `DurationInput` used by `tolerance` and `ttl`
- [`@pkg/validate`](/packages/validate) - Standard Schema parsing behind the `schema` option
- [`@pkg/result`](/packages/result) - the `Result` every function here returns
- [`@pkg/rate-limit`](/packages/rate-limit) - webhook endpoints should be rate limited too; both apply to the same route

## Tips

1. **Verify before anything else reads the body** - a stream can be read once, and the signature covers the exact bytes; a body consumed upstream fails with `UnreadableBodyError`.
2. **Keep the secret in a binding** - verification fails closed when it is unset, so a missing secret rejects every delivery rather than accepting them all.
3. **Answer `401` only for an authentication failure** - a `PayloadValidationError` means the delivery was authentic, so retrying it will not help the sender.
4. **Stop the retries on a duplicate** - a `DuplicateDeliveryError` means the work already happened; a success response is the honest answer.
5. **Pass a `Date` for a timestamp** - a number is read as whole seconds, matching the header, so `Date.now()` must be wrapped in a `Date`.
6. **Reuse the delivery id across retries** - it is what a receiver de-duplicates on; a new id for a retry defeats the store.
7. **Set the content type yourself** - `sign()` only sets the three signature headers, and a receiver that requires JSON will reject a delivery without it.
8. **Log `name` and `deliveryId`, never the signature** - error values are built to be safe to log, and adding the raw header back defeats that.
9. **Keep the tolerance small** - it is the replay window when no store is configured; a store lets it stay tight without rejecting a slow retry.
10. **Make the handler idempotent anyway** - eventually consistent storage can miss a near-simultaneous duplicate, so deduplication narrows the window rather than guaranteeing exactly-once.
