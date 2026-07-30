# ADR-026: Standard Webhooks Parsing Package

## Status

**Accepted** - 2026-07-29

## Background

Inbound webhook verification currently happens inside the Polar package, by delegating to the vendor SDK's `validateEvent`. That works, but it makes a billing SDK the security boundary for request authentication, and it only covers one sender.

Outbound webhooks have the mirror-image problem: the uptime product delivers alert webhooks signed with an ad-hoc HMAC scheme built inline in the alerts service, which no receiver library knows how to verify.

Several services, including the one already integrated, sign with the Standard Webhooks specification. Implementing that specification once covers both directions.

## Context

### Current State

| Location                                | What it does                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/polar/src/index.ts`           | Copies request headers into a record and calls the SDK's `validateEvent`             |
| Same file                               | Re-exports `WebhookVerificationError`; unknown event types are accepted after verify |
| `apps/r3-uptime/app/services/alerts.ts` | Local `hmacSha256Hex()` signs outbound alert payloads with a bespoke header          |
| No app                                  | Replay protection or delivery-id deduplication                                       |

### Issues Identified

| Issue                                                    | Impact                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| The vendor SDK is the authentication boundary            | Verification semantics depend on a billing library's release cycle              |
| Only one sender is supported                             | A second Standard-Webhooks sender means a second SDK or a second implementation |
| Outbound signatures follow no specification              | Receivers cannot verify alerts with an off-the-shelf library                    |
| No timestamp tolerance or delivery-id tracking           | A captured request can be replayed indefinitely                                 |
| Payload typing happens after verification, per call site | Unmodelled event types fall through with untyped bodies                         |

## Decision

Create `@pkg/webhooks`: a Standard Webhooks implementation for verifying inbound requests and signing outbound deliveries, built on `@pkg/crypto` (ADR-023) and validating payloads with `@pkg/validate`.

### 1. Named Exports, Namespace Import

The package exports plain functions and documents the namespace import as the way to use them, following `@pkg/u` (ADR-015), so a call site says what is being signed or verified:

```ts
import * as Webhooks from "@pkg/webhooks";

await Webhooks.verify(request, { secret });
await Webhooks.sign(payload, { secret, id, timestamp });
```

Named exports keep the package tree-shakeable, so a module that only verifies pulls in only the verification path. Every example in the package README and in this ADR uses the namespaced form, so the recommended shape is the one people copy.

### 2. Inbound Verification

```ts
let result = await Webhooks.verify(request, { secret: env.WEBHOOK_SECRET });
if (isFailure(result)) return unauthorized();

let { id, timestamp, payload } = result.value;
```

`verify()` reads the `webhook-id`, `webhook-timestamp`, and `webhook-signature` headers, recomputes `HMAC-SHA256` over `id.timestamp.body` with the decoded secret, and compares in constant time. It accepts multiple space-separated signature values so a sender mid-rotation still verifies, and it accepts an array of secrets for the receiver's own rotation:

```ts
await Webhooks.verify(request, { secrets: [current, previous] });
```

Timestamp tolerance defaults to five minutes in both directions and is configurable. Failures are typed so a caller can distinguish them: missing headers, malformed signature, stale timestamp, no matching signature.

The request body is read once as text and returned alongside the parsed payload, because verification must run against the exact bytes received, never a re-serialized object.

### 3. Typed Payloads

```ts
let result = await Webhooks.verify(request, { secret, schema: SubscriptionEventSchema });
```

The `schema` option accepts any Standard Schema, because `@pkg/validate` is written against `StandardSchemaV1` rather than a specific library. `remix/data-schema` is what this repository uses, and a sender-provided schema from another library validates through the same option with no adapter.

When a schema is supplied, the verified body is parsed and the payload is typed. Verification and parsing stay separate failure modes: a valid signature with an unexpected body shape is a parsing failure, not an authentication failure, and the caller decides whether to accept it. That preserves the existing behavior where an unmodelled event type is not treated as an attack.

### 4. Outbound Signing

```ts
let signed = await Webhooks.sign(payload, { secret, id, timestamp });

signed.headers.set("Content-Type", "application/json");

await fetch(endpoint, { method: "POST", headers: signed.headers, body: signed.body });
```

`sign()` produces the same three headers on the sending side, so alert webhooks become verifiable by any Standard Webhooks receiver library instead of requiring custom code. `id` and `timestamp` are explicit parameters, which keeps signatures reproducible in tests.

`signed.headers` is a `Headers` instance, freshly constructed per call and owned by the caller, so a sender adds content type, a user agent, or a delivery id by mutating it directly. Callers that would rather not mutate copy it with `new Headers(signed.headers)`. Returning a plain object would have invited spreading it into a headers literal, which is also why `Headers` is the better return: the spread of a `Headers` instance yields no entries, so the mistake fails visibly at the first delivery attempt rather than silently sending an unsigned request.

### 5. Replay Protection

Timestamp tolerance narrows the replay window; deduplication closes it. The package defines a small store interface and leaves storage to the app:

```ts
export interface ReplayStore {
	seen(id: string): Promise<boolean>;
	remember(id: string, ttl: DurationInput): Promise<void>;
}
```

A Workers KV implementation ships with the package because the TTL semantics match exactly; a data-table implementation is left to apps that want deliveries to be inspectable. Passing a store to `Webhooks.verify()` makes duplicate delivery ids fail.

### 6. Polar Integration

`packages/polar` keeps its typed event models and its client, but its webhook verification moves onto this package, so the SDK is no longer the security boundary. The vendor's own signing scheme is the Standard Webhooks scheme, so this is a swap of implementation, not of behavior, and must be verified against captured real payloads before the SDK path is removed.

## Consequences

### Positive

- **One verification implementation** - every Standard Webhooks sender is supported by the same reviewed code.
- **The security boundary is owned** - authentication no longer depends on a billing SDK's release cycle.
- **Outbound webhooks become standard** - receivers can verify alerts with an existing library.
- **Replay protection exists** - tolerance plus optional delivery-id deduplication.
- **Exact-bytes verification is enforced by the API** - the raw body is what gets verified, and callers cannot accidentally verify a re-serialized object.

### Negative

- **Verification correctness is now the monorepo's responsibility** - a mistake here is an authentication bypass, so test vectors and cross-checks against the SDK are mandatory before switching.
- **Senders that do not follow the specification need their own adapters** - GitHub's `X-Hub-Signature-256` scheme, for example, is not covered by this package as designed.

### Neutral

- **The Polar SDK stays** - for API calls and event models; only verification moves.
- **Existing outbound receivers must be migrated** - anything currently verifying the ad-hoc alert signature needs the new headers, so the change is coordinated with whoever consumes those webhooks.

## Implementation Plan

### Phase 1: Core

**Priority:** High
**Estimated Effort:** 3 hours

1. Implement `sign()` and `verify()` with typed failures, multiple signatures, and multiple secrets.
2. Test against specification vectors and against captured real payloads from the integrated sender.

### Phase 2: Schema And Replay

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Optional `schema` parsing through `@pkg/validate`.
2. `ReplayStore` interface plus the Workers KV implementation.

### Phase 3: Adoption

**Priority:** Medium
**Estimated Effort:** 3 hours

1. Move the Polar package's verification onto `Webhooks.verify()`, keeping its event models.
2. Replace the inline HMAC signer in the alerts service with `Webhooks.sign()`, and document the header change for webhook consumers.
3. Write the package README and add it to the root README table (ADR-017).

## Alternatives Considered

### 1. Depend On The `standardwebhooks` Library

Use the specification's reference implementation directly.

**Rejected because**: the implementation is a small amount of HMAC and base64 work that `@pkg/crypto` already provides, and owning it removes a dependency from the request authentication path while allowing `Result`-based errors and multi-secret rotation.

### 2. Keep Using The Vendor SDK For Verification

Leave inbound verification with the SDK and only add outbound signing.

**Rejected because**: it leaves the security boundary in a billing library and does nothing for a second sender, while the outbound half already needs the same primitives.

### 3. A Class Of Static Methods

Expose the API as `Webhook.sign()` and `Webhook.verify()` on a class that is never instantiated.

**Rejected because**: it defeats tree-shaking, since importing the class to verify retains the signing path and everything it pulls in, and it introduces a type that exists only to hold a name. A namespace import gives the same call-site readability with none of that, and it is the shape `@pkg/u` already established in this repository.

### 4. A Generic Multi-Scheme Webhook Package

Support GitHub, Stripe, and Standard Webhooks schemes behind one interface from the start.

**Rejected because**: only the Standard Webhooks scheme is needed today, and a premature abstraction over three signing formats would obscure the one that matters. Additional schemes can be added as named verifiers when a sender requires one.

## References

- [Standard Webhooks specification](https://www.standardwebhooks.com/)
- [ADR-023: Web Crypto Primitives Package](./ADR-023-web-crypto-primitives-package.md)
- [ADR-019: Adapter-Based Rate Limiting Package](./ADR-019-adapter-based-rate-limiting-package.md)

## Current Progress

- [x] Phase 1: Core
- [x] Phase 2: Schema And Replay
- [ ] Phase 3: Adoption

## Notes

- Webhook endpoints should also be rate limited; the two packages are complementary and both apply to the same routes.
- Secrets are base64 with a `whsec_` prefix by convention; the package accepts the prefixed and unprefixed forms and decodes before use.
- Verification failures must be logged with the delivery id and failure kind, never with the signature or the secret.
- Cross-check the new implementation against the SDK on real payloads in a temporary dual-verification step before removing the SDK path, since a silent mismatch would reject legitimate billing events.
