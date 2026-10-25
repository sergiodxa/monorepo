# @sdxc/webhooks

Sign and verify [Standard Webhooks](https://www.standardwebhooks.com/) deliveries and deliver
Security Event Tokens by push or poll, reporting every failure as a typed value.

Signatures are `HMAC-SHA256` over `id.timestamp.body`, computed with
[`@sdxc/crypto`](https://www.npmjs.com/package/@sdxc/crypto) and compared in constant time.
Every failure is an error value that names what went wrong and carries no secret or signature,
so it is safe to log.

## Installation

```sh
npm add @sdxc/webhooks
```

Results come from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) (`isFailure`,
`unwrap`), and durations such as `tolerance` and `ttl` take a `DurationInput` from
[`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration).

## Usage

### Verify an inbound request

```typescript
import { env } from "cloudflare:workers";
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";

let result = await Webhooks.verify(request, { secret: env.WEBHOOK_SECRET });
if (isFailure(result)) return new Response(null, { status: 401 });

let { id, timestamp, body, payload } = result.data;
```

`verify()` reads the body itself, so call it before anything else reads the request. `body` is
the exact text the signature covers, and `payload` is that body JSON decoded.

### Type the payload

```typescript
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";
import * as s from "remix/data-schema";

let InvoicePaid = s.object({ type: s.literal("invoice.paid"), amount: s.number() });

let result = await Webhooks.verify(request, { secret, schema: InvoicePaid });
if (isFailure(result)) return new Response(null, { status: 401 });

result.data.payload.amount; // number
```

Any [Standard Schema](https://standardschema.dev) works. Without one, `payload` is `unknown`.

### Sign an outbound delivery

```typescript
import { unwrap } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";

let signed = unwrap(
	await Webhooks.sign(
		{ type: "invoice.paid", amount: 42 },
		{ secret, id: "msg_1", timestamp: new Date() },
	),
);

signed.headers.set("Content-Type", "application/json");

await fetch(endpoint, { method: "POST", headers: signed.headers, body: signed.body });
```

Send `signed.body`, the exact text that was signed. `signed.headers` holds only the three
signature headers and is yours to add to.

### Reject replays

```typescript
import { env } from "cloudflare:workers";
import * as Webhooks from "@sdxc/webhooks";

let store = new Webhooks.KVReplayStore(env.WEBHOOKS);

let result = await Webhooks.verify(request, { secret, store });
```

The timestamp tolerance limits how long a captured request stays valid; a store also rejects a
delivery id it has already accepted, with `DuplicateDeliveryError`.

### Deliver Security Event Tokens

`@sdxc/webhooks/security-events` delivers RFC 8417 SETs, built with `SecurityEventToken` from
[`@sdxc/jwt`](https://www.npmjs.com/package/@sdxc/jwt), by push (RFC 8935) or poll (RFC 8936).

```typescript
import { isFailure } from "@sdxc/result";
import {
	SecurityEventError,
	setAccepted,
	setReceiver,
	transmitSet,
} from "@sdxc/webhooks/security-events";

/** Transmitter: 202 is delivered, a SecurityEventError is the recipient's refusal. */
let result = await transmitSet("https://rp.example.com/events", set);
if (isFailure(result) && !(result.error instanceof SecurityEventError)) await retryLater();

/** Recipient: a 400 {err, description} answers every SET that fails verification. */
router.post(routes.events, {
	middleware: [setReceiver({ issuers: { "https://idp.example.com/": jwks }, audience })],
	async handler(ctx) {
		await inbox.save(ctx.securityEvent);
		return setAccepted();
	},
});
```

For poll delivery, the transmitter queues SETs per recipient stream in a `SetStore`
(`MemorySetStore` in tests) and serves them with `answerPoll`. The recipient polls with
`pollSets`, checks the batch with `verifyPolledSets`, and acknowledges it on the next poll.

```typescript
import { answerPoll, pollSets, verifyPolledSets } from "@sdxc/webhooks/security-events";

await store.add(recipient.id, token.id, await token.sign(JWK.Algorithm.ES256, keys));
router.post(routes.poll, (ctx) => answerPoll(ctx.request, { store, stream: recipient.id }));

let batch = await pollSets(endpoint, { ack, setErrs, maxEvents: 50 });
if (isSuccess(batch)) ({ events, ack, setErrs } = await verifyPolledSets(batch.data.sets, options));
```

## API

### `verify(request: Request, options: VerifyOptions): Promise<Result<VerifiedDelivery, WebhookError>>`

Verifies a request's headers, timestamp and signature against its exact body, then consults the
store and parses the payload. An id reaches the store only once the delivery is fully accepted.

- `secret`: signing secret, base64, with or without the `whsec_` prefix
- `secrets`: more secrets to try, after `secret`; a delivery verifies when any one matches.
  Every entry must decode, and with none configured every delivery fails
- `tolerance`: accepted clock skew, in both directions; defaults to `"5 minutes"`
- `schema`: Standard Schema the decoded body is parsed with, which types `payload`
- `store`: `ReplayStore` that rejects already accepted delivery ids
- `ttl`: how long the store remembers an id; defaults to twice the tolerance

### `sign(payload: unknown, options: SignOptions): Promise<Result<SignedDelivery, WebhookError>>`

Signs a payload into the three Standard Webhooks headers. A string payload is signed as given;
anything else is JSON encoded once.

- `secret`: signing secret, base64, with or without the `whsec_` prefix
- `id`: delivery id; retries of one delivery reuse it
- `timestamp`: a `Date`, or whole seconds since the epoch

### `KVReplayStore`

A `ReplayStore` over Workers KV, each accepted id a key that expires on its own. KV is
eventually consistent, so a near-simultaneous duplicate from another location can still pass.

#### `new KVReplayStore(kv: ReplayKVNamespace, options?: KVReplayStoreOptions)`

`options.prefix` goes in front of every key, defaulting to `"webhook-replay:"`; give each sender
its own when several share a namespace.

#### `store.seen(id: string): Promise<boolean>`

Resolves `true` while the id is remembered.

#### `store.remember(id: string, ttl: DurationInput): Promise<void>`

Remembers the id for `ttl`, raised to KV's one-minute minimum.

### `@sdxc/webhooks/security-events`

- `transmitSet(endpoint, set, { headers?, signal? })`: POSTs one SET as
  `application/secevent+jwt`. It resolves to a `SecurityEventError` carrying the recipient's
  `code` and `description`, or to a `TransmissionError` when no verdict arrived
- `setReceiver(options)`: verifies an RFC 8935 push and publishes `ctx.securityEvent`. A SET
  that fails is answered `400` with `invalid_request`, `invalid_key`, `invalid_issuer` or
  `invalid_audience`, and unreadable issuer keys are answered `503`
- `verifySetRequest(request, options)` and `verifySet(token, options)`: the same verification
  as a `Result`. `options` is `{ issuers, audience, algorithms?, token? }`, where `issuers` maps
  each `iss` to its keys or is a lookup answering `null` for an unknown issuer
- `setAccepted()` and `setRejected(error)`: the `202` and `400` answers
- `answerPoll(request, { store, stream, timeout?, interval? })`: applies `ack` and `setErrs`,
  then returns up to `maxEvents` pending SETs. Without `returnImmediately` it long polls
- `pollSets(endpoint, request?, options?)` and `verifyPolledSets(sets, options)`: the recipient
  side. A SET whose issuer keys are unavailable stays out of both `ack` and `setErrs`, so the
  transmitter delivers it again
- `SetStore`: `add`, `pending`, `acknowledge` and `reject`, per stream; `MemorySetStore`
  implements it in memory and reads reported errors back with `errors(stream)`

### Errors

Every failure extends `WebhookError`, whose `name` is the failure kind and whose `deliveryId` is
the `webhook-id` the request presented, or `null` before that header is read.

| Error                       | Meaning                                                                   | Authentic? |
| --------------------------- | ------------------------------------------------------------------------- | ---------- |
| `InvalidSecretError`        | No usable secret: absent, empty, or not base64                            | unknown    |
| `MissingHeaderError`        | A signature header is absent; `header` names it                           | no         |
| `MalformedTimestampError`   | `webhook-timestamp` is not whole seconds                                  | no         |
| `StaleTimestampError`       | Outside `tolerance`; carries `timestamp` and `toleranceMs`                | no         |
| `MalformedSignatureError`   | No readable `v1` value in `webhook-signature`                             | no         |
| `SignatureMismatchError`    | No signature matched any configured secret                                | no         |
| `DuplicateDeliveryError`    | The store already accepted this delivery id                               | yes        |
| `PayloadValidationError`    | Not JSON or not the schema's shape; carries `body`, `timestamp`, `issues` | yes        |
| `ReplayStoreError`          | The store threw; `operation` is `"seen"` or `"remember"`                  | unknown    |
| `UnreadableBodyError`       | The request body was already read                                         | unknown    |
| `InvalidDeliveryError`      | `sign()` got an empty id, a bad timestamp, or a non-JSON payload          | n/a        |
| `SignatureComputationError` | The runtime refused to compute the HMAC                                   | unknown    |

### Types

#### `VerifyOptions` and `SecretOptions`

The options of `verify()`; `SecretOptions` holds `secret` and `secrets`. Pass them inline, since
`payload` is typed from the object literal.

#### `VerifiedDelivery<Payload = unknown>`

`{ id: string; timestamp: Date; body: string; payload: Payload }`.

#### `VerifiedPayload<Options>`

The payload type a `verify()` call resolves to: the schema's output, or `unknown`.

#### `SignOptions` and `SignedDelivery`

`SignOptions` is `{ secret; id; timestamp }`. `SignedDelivery` is `{ headers; body; id;
timestamp; signature }`, with `timestamp` in whole seconds and `signature` the
`webhook-signature` value.

#### `ReplayStore`

`{ seen(id): Promise<boolean>; remember(id, ttl): Promise<void> }`, implementable over any
storage with expiry.

#### `ReplayKVNamespace` and `KVReplayStoreOptions`

The `get`/`put` subset of a Workers `KVNamespace` the store calls, and `{ prefix?: string }`.

## Pattern: A Fail-Closed Endpoint

Answer each failure for what it means: an authentic duplicate already did its work, an authentic
but unmodelled event should not be retried, and everything else is rejected.

```typescript
import { env } from "cloudflare:workers";
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";
import * as s from "remix/data-schema";

let Event = s.object({ type: s.string(), data: s.object({ id: s.string() }) });

export async function handleWebhook(request: Request): Promise<Response> {
	let result = await Webhooks.verify(request, {
		secret: env.WEBHOOK_SECRET,
		schema: Event,
		store: new Webhooks.KVReplayStore(env.WEBHOOKS),
	});

	if (isFailure(result)) {
		if (result.error instanceof Webhooks.DuplicateDeliveryError) {
			return new Response(null, { status: 200 });
		}
		if (result.error instanceof Webhooks.PayloadValidationError) {
			return new Response(null, { status: 202 });
		}
		if (
			result.error instanceof Webhooks.ReplayStoreError ||
			result.error instanceof Webhooks.SignatureComputationError
		) {
			return new Response(null, { status: 503 });
		}
		return new Response(null, { status: 401 });
	}

	await processEvent(result.data.payload);
	return new Response(null, { status: 202 });
}
```

## Pattern: Delivering With Retries

Reuse the delivery id across attempts so the receiver can de-duplicate them, and sign each
attempt with a fresh timestamp so a late retry still lands inside the receiver's tolerance.

```typescript
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";

async function deliver(endpoint: string, event: unknown, id: string, secret: string) {
	let lastFailure: Webhooks.WebhookError | Response | null = null;

	for (let attempt = 1; attempt <= 3; attempt++) {
		let signed = await Webhooks.sign(event, { secret, id, timestamp: new Date() });
		if (isFailure(signed)) return signed.error;

		signed.data.headers.set("Content-Type", "application/json");

		let response = await fetch(endpoint, {
			method: "POST",
			headers: signed.data.headers,
			body: signed.data.body,
		});
		if (response.ok) return null;
		lastFailure = response;
	}

	return lastFailure;
}
```

## Pattern: Rotating a Secret

List the new secret first and keep the old one until every delivery signed with it has drained.

```typescript
import { env } from "cloudflare:workers";
import * as Webhooks from "@sdxc/webhooks";

let secrets = [env.WEBHOOK_SECRET, env.WEBHOOK_SECRET_PREVIOUS].filter(Boolean);

let result = await Webhooks.verify(request, { secrets });
```

## Pattern: A Replay Store Over a Table

Keep accepted ids in a table you can inspect by implementing `ReplayStore`. Report `seen` only
for ids that were remembered and have not expired.

```typescript
import { env } from "cloudflare:workers";
import { toMs } from "@sdxc/duration";
import * as Webhooks from "@sdxc/webhooks";

let store: Webhooks.ReplayStore = {
	async seen(id) {
		let row = await env.DB.prepare("SELECT 1 FROM deliveries WHERE id = ? AND expires_at > ?")
			.bind(id, Date.now())
			.first();
		return row !== null;
	},
	async remember(id, ttl) {
		await env.DB.prepare("INSERT OR REPLACE INTO deliveries (id, expires_at) VALUES (?, ?)")
			.bind(id, Date.now() + toMs(ttl))
			.run();
	},
};

let result = await Webhooks.verify(request, { secret: env.WEBHOOK_SECRET, store, ttl: "1 day" });
```

## Pattern: Round-Tripping in Tests

The id and timestamp are inputs to `sign()`, so a test builds a request a receiver accepts and
asserts on the result.

```typescript
import { isFailure, unwrap } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";
import { expect, test } from "vitest";

let secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

test("accepts a signed delivery", async () => {
	let signed = unwrap(
		await Webhooks.sign({ type: "ping" }, { secret, id: "msg_1", timestamp: new Date() }),
	);

	let request = new Request("https://example.com/webhooks", {
		method: "POST",
		headers: signed.headers,
		body: signed.body,
	});

	let delivery = unwrap(await Webhooks.verify(request, { secret }));
	expect(delivery.payload).toEqual({ type: "ping" });
});

test("rejects a tampered body", async () => {
	let signed = unwrap(
		await Webhooks.sign({ type: "ping" }, { secret, id: "msg_2", timestamp: new Date() }),
	);

	let request = new Request("https://example.com/webhooks", {
		method: "POST",
		headers: signed.headers,
		body: '{"type":"pong"}',
	});

	let result = await Webhooks.verify(request, { secret });
	expect(isFailure(result) && result.error).toBeInstanceOf(Webhooks.SignatureMismatchError);
});
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
