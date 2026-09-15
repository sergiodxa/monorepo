---
name: sdxc-webhooks
description: "@sdxc/webhooks signs and verifies Standard Webhooks deliveries — HMAC-SHA256 over `id.timestamp.body`, compared in constant time — reporting every failure as a typed value rather than throwing. Use when authenticating an inbound webhook request, signing an outbound delivery, rotating a receiver's signing secret, or rejecting replayed delivery ids through a KV-backed `ReplayStore`."
---

# @sdxc/webhooks

Inbound webhook verification is request authentication: if it is wrong, anyone can post an event. `verify()` reads the three Standard Webhooks headers, bounds the timestamp, compares the signature in constant time, optionally consults a replay store, and only then parses the payload; `sign()` produces the headers and the exact body text the signature covers. Nothing throws — every outcome is a `Result`, and each failure is a `WebhookError` subclass naming the kind, carrying no secret or signature so the value is safe to log. It is built on `@sdxc/crypto` with no vendor SDK, and runs on any fetch runtime; `KVReplayStore` additionally wants a Workers KV binding.

Full API, options and examples: [packages/webhooks/README.md](packages/webhooks/README.md)

## When to reach for it

- An endpoint receives deliveries from a provider that signs with Standard Webhooks and must fail closed on an unsigned, stale or mismatched request.
- Something has to deliver events outbound and sign each attempt reproducibly, reusing one delivery id across retries.
- A signing secret has to be rotated without a window where authentic deliveries are rejected.
- The same delivery can arrive twice and the handler is not idempotent enough to absorb it.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/webhooks": "workspace:*" } }
```

```ts
import { isFailure } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";

let result = await Webhooks.verify(request, { secret: env.WEBHOOK_SECRET });
if (isFailure(result)) return new Response(null, { status: 401 });

let { id, timestamp, body, payload } = result.data;
```

Signing an outbound delivery:

```ts
import { unwrap } from "@sdxc/result";
import * as Webhooks from "@sdxc/webhooks";

let signed = unwrap(await Webhooks.sign(event, { secret, id: deliveryId, timestamp: new Date() }));

signed.headers.set("Content-Type", "application/json");

await fetch(endpoint, { method: "POST", headers: signed.headers, body: signed.body });
```

## Suggestions

- Verify before anything else reads the request: a stream is readable once, and a body consumed upstream fails with `UnreadableBodyError`. The verified text comes back as `body`, so a raw delivery can be stored without re-serializing.
- Pass a `schema` inline in the options object to type `payload`; annotating a variable with `VerifyOptions` first widens it back to `unknown`.
- Map the failures by meaning rather than all to 401: `DuplicateDeliveryError` means the work already happened (answer 200 to stop the retries), `PayloadValidationError` means the delivery was authentic but unmodelled, and the headers/timestamp/signature failures are the authentication ones.
- Send `signed.body` verbatim — it is the exact text the signature covers — and add your own `Content-Type`, since `sign()` sets only the three signature headers. Copy the `Headers` with `new Headers(...)`; spreading it into an object literal yields no entries.
- `options.secrets` accepts several secrets for a receiver-side rotation, but every configured secret must decode or the call fails, so an unusable entry is never silently skipped.
- KV reads are eventually consistent, so `KVReplayStore` narrows the replay window rather than closing it; an idempotent handler is still what makes repeated work harmless.

## Related

- `@sdxc/result` — the `Result`, `isFailure` and `unwrap` every call returns and you branch on; skill `sdxc-result`
- `@sdxc/crypto` — the HMAC-SHA256 and constant-time comparison underneath; skill `sdxc-crypto`
- `@sdxc/duration` — the `DurationInput` the `tolerance` and `ttl` options take; skill `sdxc-duration`
