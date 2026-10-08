# @sdxc/activitypub

ActivityPub protocol logic: vocabulary, actors, discovery, a verified inbox and signed delivery.

## Installation

```sh
npm add @sdxc/activitypub
```

Every fallible call answers an [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result)
value, and stores and caches are the app's own: the remote-document cache is an
[`@sdxc/cache`](https://www.npmjs.com/package/@sdxc/cache) `Cache`. Both install alongside
this package. `vitest` is an optional peer, needed only for the conformance suites in
`@sdxc/activitypub/testing`.

One `Federation` holds everything a local actor needs wired: its document and keys, the
app's stores, the cache, and the queue. `fetch` answers the actor's own URLs (the inbox is
verified there, inside the request), `process` runs every queued step, and `on` registers what
the app does with a reply, a like or a follow. The vocabulary (`parse*`, `stringify`) stays as
plain functions for anything an app reads or writes itself.

## Usage

### Set Up A Federation

```typescript
import { ActorKeys, Federation, PUBLIC } from "@sdxc/activitypub";
import { unwrap } from "@sdxc/result";

// Once, from a script: store privateKeyPem as a secret.
let { privateKeyPem } = unwrap(await ActorKeys.generate());

let keys = unwrap(await ActorKeys.import({ actor: ACTOR_ID, privateKeyPem: env.PRIVATE_KEY }));

let federation = new Federation({
	actor: ACTOR, // the local actor document; its ids name the URLs `fetch` answers
	keys,
	stores: { followers, seen, objects }, // FollowerStore, SeenActivities, LocalObjects
	cache, // an @sdxc/cache Cache, such as one over Workers KV
	userAgent: "example.com/1.0 (+https://example.com)",
	blocked: (host) => blockedHosts.has(host),
	queue: { enqueue: (message) => queue.send(message) },
});
```

### Answer The Actor's URLs

```typescript
let response = await federation.fetch(request);
if (response) return response; // the actor, its inbox, outbox, followers or following
return router.fetch(request);
```

An inbox `POST` is verified before it is queued and answers `202`, or the status of the check
it failed, so a sender learns from a `401` to retry with the other signature scheme.

### Process The Queue

Every message the federation enqueues (an inbox activity, a fan-out, a delivery) is one shape,
`Federation.MESSAGE`, so the app declares one job and hands each message back:

```typescript
import { Federation } from "@sdxc/activitypub";
import { isFailure } from "@sdxc/result";

let processed = await federation.process(message, { attempts });
if (isFailure(processed)) {
	if (processed.error.retryable) return retry({ delay: processed.error.delay });
	return acknowledge(processed.error.message);
}
```

### Handle Replies, Likes And Follows

```typescript
federation.on(["Create", "Update", "Like", "Announce"], async (ctx) => {
	let summary = ctx.summary(); // a reply, mention, like or repost of local content
	if (summary) await responses.save(summary);
});

federation.on("Follow", async (ctx) => (isWelcome(ctx.actor) ? "accept" : "pending"));
```

### Publish A Post

```typescript
await federation.publish({
	id: `${post.url}#create`,
	type: "Create",
	actor: ACTOR_ID,
	to: [PUBLIC],
	cc: [FOLLOWERS_ID],
	object: article,
});
```

### Serve A Page As HTML Or As ActivityStreams

```typescript
let activity = await federation.respond(request, article);
if (activity) return activity; // the client preferred ActivityStreams
return renderHtml(article);
```

## API

### `Federation`

The runtime of one local actor. It holds no state beyond its options and handlers, so an app
may build one per request or per job, wherever its stores are at hand.

#### `new Federation(options: Federation.Options)`

- `actor`: the local actor's `ActivityPub.Actor`. Its `id`, `inbox`,
  `endpoints.sharedInbox`, `outbox`, `followers` and `following` are the URLs `fetch`
  answers. `manuallyApprovesFollowers` makes a Follow `pending` by default.
- `keys`: the actor's `ActorKeys`, or a `KeyProvider` for an app hosting several actors. An
  actor the provider has keys for counts as local.
- `stores`: `{ followers, seen, objects }`, the app's `FollowerStore`, `SeenActivities` and
  `LocalObjects`.
- `cache`: an `@sdxc/cache` `Cache` for remote documents, the signature scheme each origin
  accepted, and origins that keep failing. A failing cache costs a fetch or a knock, never
  correctness.
- `userAgent`: sent on every outbound request.
- `queue`: `{ enqueue(message), enqueueMany?(messages) }`. Each may answer a `Result` or
  nothing; a failure or an exception fails the step that enqueued as retryable.
- `blocked`: `(host) => boolean | Promise<boolean>`, nothing blocked by default. A blocked
  server can neither deliver, follow, nor receive.
- `outbox`: `(cursor: string | null) => Promise<Result<OutboxPage, Error>>`, the pages of the
  outbox (`{ items, next, totalItems? }`). Without it the outbox is empty.
- `authorizedFetch`: `true` requires a signed GET for the collections and for `respond`
  (secure mode). The actor document always answers unsigned.
- `inbox`: `{ maxBytes?, maxAge? }`, `102400` bytes and `"1 hour"` of signature age by
  default.
- `resolver`: `{ signed?, ttl?, timeout?, maxBytes? }`. GETs are signed with the actor's keys
  unless `signed` is `false`; actors are cached a day and objects an hour.
- `delivery`: `{ timeout?, pageSize? }`, `"15 seconds"` per POST and 100 inboxes per store
  page and per `enqueueMany`.
- `collections`: `{ pageSize? }`, 50 followers per page.
- `backoff`: the retry schedule by attempt, `DELIVERY_BACKOFF` by default.
- `seenTtl`: how long a processed activity id is remembered, `"1 day"` by default.
- `now`: the clock, for tests.

#### `federation.on(type, handler): Federation`

Registers the handler for one activity type or a list of them, replacing an earlier one for
the same type. The types are `Follow`, `Undo`, `Create`, `Update`, `Delete`, `Like` (which
also receives Pleroma's `EmojiReact`), `Announce`, `Accept`, `Reject` and `Move`.

A handler answers nothing or a `Result`, sync or async. A failure or an exception fails the
message as retryable, so a handler tolerates seeing an activity twice. A `Follow` handler may
answer `"accept"`, `"reject"` or `"pending"`; nothing keeps the default.

```typescript
// Federation.Context
interface Context {
	activity: ActivityPub.Activity;
	actor: ActivityPub.Actor; // fetched from its own origin, never the copy an activity embeds
	origin: string;
	verification: "signature" | "proof" | "refetched";
	object: ActivityPub.Object | null; // the post, the local object, the undone activity, the Follow, the Move target
	target: string | null; // the local object or actor it concerns
	receivedAt: Date;
	summary(): Summary | null;
}
```

A `Delete` handler receives a `Federation.DeleteContext`, whose `actor` is `null` when a
deleted account's document is already gone, whose `deleted` is
`{ kind: "object" | "actor", id }`, and whose `summary()` is `null`.

`summary()` is the shape a Webmention is stored in, for a reply, mention, like or boost of
local content, and `null` for anything else:

```typescript
interface Summary {
	kind: "reply" | "like" | "repost" | "mention"; // a quote reads as mention
	id: string; // the remote post, or the Like/Announce
	url: string; // its HTML page, else its id
	target: string; // the local object or actor
	author: { id: string; handle: string; name: string | null; url: string; photo: string | null };
	content: { html: string; text: string } | null; // sanitized against the object's id
	published: Date | null;
}
```

Misskey's emoji reactions (a `Like` with `content`) and Pleroma's `EmojiReact` read as `like`,
with the emoji as content.

#### `federation.fetch(request: Request): Promise<Response | null>`

Answers the actor's URLs, matched by origin and path, and `null` for any other URL:

| URL                              | Method        | Answer                                                                  |
| -------------------------------- | ------------- | ----------------------------------------------------------------------- |
| `actor.id`                       | `GET`, `HEAD` | The actor, with `publicKey` from its keys                               |
| `inbox`, `endpoints.sharedInbox` | `POST`        | `202` once queued, the refusal's status, or `503` when the queue failed |
| `outbox`                         | `GET`, `HEAD` | `totalItems` and `first`; `?page=true[&cursor=…]` answers a page        |
| `followers`                      | `GET`, `HEAD` | `totalItems` from `count`; pages of follower ids from `list`            |
| `following`                      | `GET`, `HEAD` | An empty collection                                                     |
| Any of the above, another method |               | `405` with `Allow`                                                      |

Documents answer `application/activity+json; charset=utf-8` with an `ETag`, `304`
revalidation and a public 5-minute cache. A failing store answers `503`. The inbox runs these
checks in order and stops at the first failure, and fetches nothing before the blocked check:

| Step                                                                                   | `InboxError.code`                      | Status |
| -------------------------------------------------------------------------------------- | -------------------------------------- | ------ |
| `Content-Type` is `application/activity+json` or `application/ld+json`                 | `unsupported-media-type`               | 415    |
| The body fits `inbox.maxBytes`                                                         | `too-large`                            | 413    |
| The body is JSON that `parseActivity` accepts                                          | `invalid-activity`                     | 400    |
| Neither the `keyId` host nor the `actor` host is `blocked`                             | `blocked`                              | 403    |
| A signature is present: `Signature-Input` (RFC 9421) or `Signature` (cavage)           | `unsigned`                             | 401    |
| The signature covers `Content-Digest` or `Digest`, and the body matches it             | `digest-mismatch`                      | 401    |
| `created` or `Date` is within `inbox.maxAge`, with 5 minutes of clock skew             | `stale-signature`                      | 401    |
| The signature verifies with the key; a failure refetches the key once, for a rotation  | `invalid-signature`, `key-unavailable` | 401    |
| The key's owner is `activity.actor`, or the activity refetched from its origin matches | `actor-mismatch`                       | 401    |
| A `Delete` of an account whose key now answers `410`                                   | `ignored`                              | 202    |

A forwarded activity (Mastodon forwards replies to a thread's participants under the
forwarder's signature) is accepted when its `id` has the actor's origin and a fresh copy from
there is the same activity by the same actor; the queued message carries that copy. A verified
activity clears its signer's origin from the failing-delivery record.

#### `federation.respond(request, document, options?): Promise<Response | null>`

`null` when the request prefers HTML, so the app renders its page; otherwise the document as
ActivityStreams with `Vary: Accept`, an `ETag`, `304` revalidation and a public 5-minute cache.
A `Tombstone` answers `410`, which is how a refetching server learns the object was deleted.
`options` takes `cache` (an [`@sdxc/http`](https://www.npmjs.com/package/@sdxc/http)
`policy()` input), `headers` (applied last) and `status`. With `authorizedFetch`, an unsigned
or invalid request answers its refusal.

An HTML page with an ActivityStreams representation should link it with
`<link rel="alternate" type="application/activity+json" href="…">`, which Mastodon follows
when someone pastes the page's URL into its search.

#### `federation.verify(request: Request): Promise<Result<VerifiedFetch, InboxError>>`

Verifies the signature on a GET, for documents an app serves on its own under authorized
fetch: the key's blocked host, the signature's age, and the key, refetched once. The actor
document passes unsigned with `{ signer: null, keyId: null }`. A refusal answers itself
through `error.toResponse()`.

#### `federation.process(message, options?): Promise<Result<Federation.Outcome, FederationError>>`

Runs one queued message. `options.attempts` is the job's attempt, starting at 1: it picks the
backoff step, and past the first the redelivery check is skipped so a retry is processed again.

- `inbox`: claims the activity id in `seen` (a store failure is logged and processing goes
  on), fetches the actor, does the protocol's work for the type (below), then calls the
  handler. Answers `{ kind: "inbox", status: "processed" | "duplicate" | "ignored", type, reason }`.
- `fanOut`: queues one `deliver` message per distinct inbox the activity addresses, and answers
  `{ kind: "fanOut", inboxes, skipped }`.
- `deliver`: signs and POSTs the activity, and answers `{ kind: "deliver", status, scheme }`.
  An inbox answering `410` drops every follower reached through it.

A `FederationError` carries the underlying `code`, `retryable`, `kind`, and `delay` in
milliseconds: the backoff step for the attempt, or the inbox's `Retry-After` when that is
longer, and `0` when the failure is not retryable. Its `cause` is the original error, such as
a `DeliveryError`.

| Activity                         | The package does                                                                                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Follow` of the local actor      | Stores the follower (`pending` when `manuallyApprovesFollowers`) and queues an `Accept`, embedding the Follow, to the follower's inbox; again on a repeated Follow. A blocked server, or the handler's `"reject"`, gets a `Reject` |
| `Undo` of `Follow`               | Removes the follower when the stored `followId` matches or the embedded Follow is the sender's                                                                                                                                     |
| `Create`, `Update`               | Requires the object to be attributed to the actor and on its origin, and to reply to, quote, or mention something local                                                                                                            |
| `Update` of the actor            | Evicts and refetches the actor, and refreshes a stored follower's `inbox` and `sharedInbox`                                                                                                                                        |
| `Delete` of an object            | Requires a fresh refetch that answers `404`/`410`/`Tombstone`, or still names the sender as author                                                                                                                                 |
| `Delete` of the actor            | Removes its follow of the local actor and evicts it, even when its document is gone                                                                                                                                                |
| `Like`, `EmojiReact`, `Announce` | Ignores objects that are not in `LocalObjects`                                                                                                                                                                                     |
| `Undo` of anything else          | Requires the undone activity, embedded from the sender's origin or fetched, to be the sender's                                                                                                                                     |
| `Accept`, `Reject`               | Requires the Follow to be one a local actor sent: embedded on the local origin naming the sender, or a local IRI                                                                                                                   |
| `Move`                           | Fetches the target fresh; it must list the mover in `alsoKnownAs`, and the mover, fetched fresh, must name it in `movedTo`                                                                                                         |
| Anything else                    | Logged and acknowledged                                                                                                                                                                                                            |

An `ignored` outcome's `reason` is one of `blocked`, `actor-unavailable`, `not-addressed`,
`not-owner`, `unrelated`, `unverifiable` and `unhandled`; a processed Follow may carry
`rejected` or `pending`.

Fan-out reaches the followers when the actor's `followers` IRI is in `to`, `cc`, `bto` or
`bcc` of the activity or its embedded object, and resolves every other addressed IRI except
`PUBLIC` to its actor's `sharedInbox ?? inbox`; one that fails to resolve is skipped and
counted. Targets are deduplicated as URLs, so one server with 400 followers gets one POST.
Blocked hosts and origins failing for more than 7 days are skipped, and `bto`/`bcc` are
stripped from what is delivered.

Delivery double-knocks: the first POST to an origin is signed with RFC 9421
(`Content-Digest`), and a `400`, `401` or `403` is retried at once with draft-cavage
(`Digest`). The scheme that lands is remembered per origin for 30 days, and a `401` carrying
`Accept-Signature` is honored once. Each POST is signed when sent, so `Date` is fresh on every
retry, and goes out once with `redirect: "manual"` after the inbox passes
[`@sdxc/outbound`](https://www.npmjs.com/package/@sdxc/outbound)'s checks.

| Response                           | `code`                | `retryable`                            |
| ---------------------------------- | --------------------- | -------------------------------------- |
| 2xx                                | (success)             |                                        |
| `410`                              | `gone`                | No; the inbox's followers are removed  |
| `401`/`403` after every scheme     | `unauthorized`        | No                                     |
| `429`                              | `rate-limited`        | Yes, at least the `Retry-After`        |
| other 3xx and 4xx                  | `rejected`            | No                                     |
| 5xx                                | `server`              | Yes, at least a `Retry-After` it names |
| deadline passed / `fetch` rejected | `timeout` / `network` | Yes                                    |
| the URL or its resolution refused  | `refused-url`         | No                                     |
| no keys for the actor              | `missing-keys`        | No                                     |
| the `KeyProvider` failed           | `keys-unavailable`    | Yes                                    |

A `Retry-After` is clamped to 12 hours, the longest `DELIVERY_BACKOFF` step.

#### `federation.publish(activity): Promise<Result<void, ActivityPubError>>`

Queues the fan-out of an activity by the local actor, given as a document or as JSON text
already serialized. An activity over 120 KB (`MAX_ACTIVITY_BYTES`) fails `too-large`, since no
delivery message could carry it, and a failing queue fails a retryable `enqueue`. A retried
fan-out may queue some deliveries twice, which receivers absorb by activity id.

#### `federation.lookup(handle: string): Promise<Result<ActivityPub.Actor, ActivityPubFetchError>>`

Resolves `@user@host`, `user@host` or `acct:user@host` the way Mastodon does: WebFinger on the
handle's host, the `self` link typed as ActivityStreams, then the actor. A handle other than
the actor's canonical `preferredUsername@<actor host>` resolves only when WebFinger on the
actor's host confirms the canonical handle points at the same actor. Fails `refused-url`,
`not-found` or `id-mismatch`, or with any code a fetch answers.

#### `federation.resolver: RemoteResolver`

The resolver the federation fetches with, sharing its cache and signer.

#### `Federation.MESSAGE`

The Standard Schema (from `remix/data-schema`) of `Federation.Message`, the union of every
message the federation enqueues, each plain JSON under 128 KB:

```typescript
// Federation.Message
type Message =
	| {
			kind: "inbox";
			activity: Record<string, unknown>;
			actor: string;
			signer: string;
			keyId: string;
			origin: string;
			verification: "signature" | "proof" | "refetched";
			receivedAt: string;
	  }
	| { kind: "fanOut"; actor: string; activity: string }
	| { kind: "deliver"; actor: string; activity: string; inbox: string };
```

### `ActorKeys`

The RSA keys a local actor signs with: RSASSA-PKCS1-v1_5 2048-bit with SHA-256, which is what
Mastodon generates and verifies.

- `ActorKeys.generate(): Promise<Result<{ privateKeyPem, publicKeyPem }, CryptoError>>`
  makes a PKCS#8 and SPKI pair. Run it once and store `privateKeyPem` as a secret; a new pair
  is an actor `Update` delivered to every follower.
- `ActorKeys.import({ actor, privateKeyPem }): Promise<Result<ActorKeys, CryptoError>>`
  derives the public half from the private key, so one secret is all an app stores. A PKCS#1
  key (`BEGIN RSA PRIVATE KEY`) fails with an `InvalidKeyError`; convert it with
  `openssl pkcs8 -topk8 -nocrypt`.
- `keys.id` is the key id every signature names, `<actor>#main-key`, and `keys.actor` the
  actor's id.
- `keys.publicKey` is the actor document's `publicKey` member:
  `{ id: "<actor>#main-key", owner: actor, publicKeyPem }`.
- `keys.rsa` holds `{ id, privateKey, publicKeyPem }`, the private key unextractable;
  `keys.ed25519` is `null` until object integrity proofs ship.
- `new ActorKeys({ actor, rsa, ed25519? })` wraps keys already imported into Web Crypto.

### `RemoteResolver`

Fetches remote actors, keys and objects, and works on its own as well as inside a federation.

```typescript
import { RemoteResolver } from "@sdxc/activitypub";

let resolver = new RemoteResolver({
	cache,
	userAgent: "example.com/1.0 (+https://example.com)",
	signer: { actor: ACTOR_ID, keys }, // signs every GET; omit for unsigned fetches
	ttl: { actor: "1 day", object: "1 hour" },
});

let actor = await resolver.actor("https://mastodon.social/users/someone");
let key = await resolver.key("https://mastodon.social/users/someone#main-key"); // { owner, publicKey, actor }
let note = await resolver.object(iri, { fresh: true }); // skips the cached copy
```

- Options: `cache` (documents as JSON under `activitypub:doc:<iri>`; a failing store reads as
  a miss), `userAgent`, `signer` (`{ actor, keys }` with `ActorKeys` or a `KeyProvider`, which
  signs each GET with draft-cavage over `(request-target) host date`; a provider holding no
  keys for the actor leaves GETs unsigned), `ttl`, `timeout` (`"10 seconds"` for the redirect
  chain and the body) and `maxBytes` (1 MB).
- `actor(iri)`, `object(iri)` (an activity when the document has an `actor`), and
  `document(iri)` (the decoded JSON, for a shape no reader models), each with `{ fresh }`.
- `key(keyId)` resolves a signature's key to the actor that publishes it: the actor must list
  the key under exactly `keyId` (else `not-found`, which is also how a rotated key shows) and
  the key's `owner` must be that actor (else `id-mismatch`).
- `evict(iri)` forgets a cached document, as after an actor's `Update` or `Delete`.

Every request goes through `@sdxc/outbound`: each hop is checked and its host resolved over
DNS-over-HTTPS, so a document pointing inside a network is refused, never fetched. A document
is accepted only when its `id` has the origin the redirect chain ended at. When a signed
request is redirected and the final URL answers `401` or `403`, it is signed for that URL and
asked once more. `Resolver` is the interface it implements.

| Outcome                                              | `ActivityPubFetchError.code` |
| ---------------------------------------------------- | ---------------------------- |
| `410`, or a `Tombstone` (the cache entry is evicted) | `gone`                       |
| `404`                                                | `not-found`                  |
| `401`, `403`                                         | `unauthorized`               |
| Any other non-2xx (`5xx` and `429` are retryable)    | `http`                       |
| A URL, redirect or address `@sdxc/outbound` refuses  | `refused-url`                |
| Body past `maxBytes`                                 | `too-large`                  |
| Deadline passed, connection failed (retryable)       | `timeout`, `network`         |
| Not JSON, no `id`, or not the shape asked for        | `invalid-document`           |
| `id` on another origin, key owned by another actor   | `id-mismatch`                |

### Vocabulary

#### `parseActivity(json: unknown): Result<ActivityPub.Activity, ActivityPubParseError>`

Reads an activity. It needs an absolute `id`, a `type` and an `actor`. Any type name is
accepted, so a type the app does not handle can still be acknowledged. An embedded `object` is
kept; trust it only when its `id` has the actor's origin.

#### `parseActor(json: unknown): Result<ActivityPub.Actor, ActivityPubParseError>`

Reads an actor. It needs an actor type (`Person`, `Service`, `Application`, `Group`,
`Organization`), an absolute `id`, a `preferredUsername` and an `inbox`. A `publicKey` that is
present but incomplete fails, since no signature could verify against it.

#### `parseObject(json: unknown): Result<ActivityPub.Object, ActivityPubParseError>`

Reads any object and keeps its `type`. A deleted one reads with `type: "Tombstone"`.

#### `parseCollection(json: unknown): Result<ActivityPub.AnyCollection, ActivityPubParseError>`

Reads a `Collection`, `OrderedCollection`, `CollectionPage` or `OrderedCollectionPage`. Its
`first` page may be an IRI or embedded, and each embedded item reads as an activity, an actor
or an object.

#### `stringify(document: ActivityPub.Draft<ActivityPub.Document>): string`

Writes a document with the ActivityStreams and security contexts, the data-integrity and
Multikey contexts when the document uses them, and an embedded map of the `toot:`, `schema:`
and `as:` extension terms. It omits `null`, empty arrays and empty maps, never writes `bto` or
`bcc`, writes dates as ISO 8601, and writes `quote` also as `_misskey_quote` and `quoteUri`.

```typescript
import type { ActivityPub } from "@sdxc/activitypub";

import { PUBLIC, stringify } from "@sdxc/activitypub";

let article = {
	id: "https://example.com/articles/hello",
	type: "Article",
	attributedTo: ["https://example.com/actor"],
	to: [PUBLIC],
	cc: ["https://example.com/followers"],
	name: "Hello",
	content: "<p>Hello, fediverse.</p>",
	published: new Date("2026-10-01T12:00:00Z"),
} satisfies ActivityPub.Draft<ActivityPub.Object>;

stringify(article); // JSON text with @context, ready to serve or deliver
```

#### `tombstone(init: TombstoneInit): ActivityPub.Tombstone`

The document a deleted object is served as: `{ id, formerType?, deleted? }`.

#### `wantsActivity(request: Request): boolean`

`true` when `application/activity+json` or `application/ld+json` is preferred over
`text/html`. A wildcard and a missing `Accept` read as HTML, so browsers and crawlers get the
page. `federation.respond` asks it first.

#### Collections

`orderedCollection`, `orderedCollectionPage`, `collection` and `collectionPage` build the
documents a collection serves, such as an object's `replies`. Give a collection `totalItems`
alone to publish a count without its members.

```typescript
import { orderedCollection, orderedCollectionPage } from "@sdxc/activitypub";

orderedCollection({ id: REPLIES, totalItems: 42, first: `${REPLIES}?page=true` });
orderedCollectionPage({ id: pageUrl, partOf: REPLIES, orderedItems: replies, next: nextUrl });
```

#### `actorLink(actorId: string): JrdLink`

The WebFinger `self` link typed `application/activity+json`, which Mastodon follows to
resolve a handle. WebFinger for `preferredUsername@<actor host>` must answer this link,
because Mastodon checks the reverse direction.

```typescript
import { actorLink } from "@sdxc/activitypub";

let jrd = {
	subject: "acct:hello@example.com",
	aliases: [],
	properties: {},
	links: [actorLink(ACTOR_ID)],
};
```

#### Constants

| Constant                 | Value                                                  |
| ------------------------ | ------------------------------------------------------ |
| `PUBLIC`                 | `https://www.w3.org/ns/activitystreams#Public`         |
| `ACTIVITY_JSON`          | `application/activity+json`                            |
| `LD_JSON`                | `application/ld+json`                                  |
| `LD_JSON_ACTIVITY`       | `application/ld+json; profile="…activitystreams"`      |
| `ACTIVITY_CONTENT_TYPE`  | `application/activity+json; charset=utf-8`             |
| `ACTIVITY_ACCEPT`        | The `Accept` a client sends for the AS2 representation |
| `AS2_CONTEXT`            | `https://www.w3.org/ns/activitystreams`                |
| `SECURITY_CONTEXT`       | `https://w3id.org/security/v1`                         |
| `DATA_INTEGRITY_CONTEXT` | `https://w3id.org/security/data-integrity/v1`          |
| `MULTIKEY_CONTEXT`       | `https://w3id.org/security/multikey/v1`                |
| `EXTENSION_CONTEXT`      | The embedded term map `stringify` writes               |
| `ACTIVITY_TYPES`         | The ActivityStreams activity types, plus `EmojiReact`  |
| `ACTOR_TYPES`            | The ActivityStreams actor types                        |
| `MAX_ACTIVITY_BYTES`     | `122880`, the largest activity a delivery carries      |
| `DELIVERY_BACKOFF`       | The default retry schedule                             |

`DELIVERY_BACKOFF` is `createBackoff({ steps: ["5 minutes", "30 minutes", "2 hours",
"6 hours", "12 hours"], jitter: 0.2 })` from
[`@sdxc/backoff`](https://www.npmjs.com/package/@sdxc/backoff): about 21 hours over five
retries. An app whose queue retries more passes its own as `backoff`.

### Errors

Every error extends `ActivityPubError`, which carries a `code` and a `retryable` flag.

- `ActivityPubParseError`: `code: "invalid-document"`, never retryable. `kind` names the
  reader, and `issues` lists every problem as `{ at, message }`, where `at` is a JSON Pointer.
- `ActivityPubFetchError`: a remote document that could not be used, with its `url` and the
  response `status` (codes in the `RemoteResolver` table).
- `InboxError`: a refused request, with the `status` it is answered with. `toResponse()`
  answers that status with a fixed `text/plain` sentence per code, so a sender learns which
  rule failed and never what the verifier saw; `ignored` answers an empty `202`.
- `DeliveryError`: a delivery that did not land, with `inbox`, `status` and `retryAfter`.
- `FederationError`: how `process` fails, with `kind`, `delay` and the error underneath as
  `cause`.

### Storage

The package keeps no state of its own. It calls four interfaces, exported as types, and the
app implements them over its own database:

- `FollowerStore`: followers keyed by `(actor, id)`. `put` inserts or replaces, so a repeated
  Follow refreshes the inbox and `followId`. `list`, `count` and `inboxes` see accepted
  followers only; `inboxes` answers each `sharedInbox ?? inbox` once. `removeInbox` drops
  every follower whose inbox or shared inbox is the URL. Listings page through
  `StorePage<T>`, whose `next` is the store's own opaque cursor.
- `SeenActivities`: `claim(id, ttl)` answers `true` the first time an id is claimed within
  `ttl`, a `DurationInput` such as `"1 day"`.
- `LocalObjects`: `find(id)` answers the object the app serves under `id`, or `null`.
- `KeyProvider`: `keysOf(actor)` answers a hosted actor's `ActorKeys`, or `null`.

### `@sdxc/activitypub/testing`

In-memory implementations of every storage interface, and Vitest suites an app registers
against its own storage so it is held to the contracts the package relies on.

- `new MemoryFollowerStore(followers?)` lists in insertion order, and its cursors are offsets.
- `new MemorySeenActivities({ now? })` reads the time from `now`, so a test passes a TTL by
  moving its own clock.
- `new MemoryLocalObjects(objects?)` serves a fixed list of objects.
- `new MemoryKeyProvider(keys?)` hosts a fixed list of `ActorKeys`.

```typescript
import {
	followerStoreConformance,
	keyProviderConformance,
	localObjectsConformance,
	seenActivitiesConformance,
} from "@sdxc/activitypub/testing";

followerStoreConformance({ name: "D1FollowerStore", create: () => new D1FollowerStore(db) });
seenActivitiesConformance({ name: "KvSeenActivities", create: () => new KvSeenActivities(kv) });
localObjectsConformance({ name: "Posts", create: () => new Posts(db), served: [ARTICLE_ID] });
keyProviderConformance({ name: "Keys", create: () => new Keys(env), hosted: [ACTOR_ID] });
```

Each suite takes a `name` that labels it and a `create` that builds a fresh implementation
for every test. `seenActivitiesConformance` takes an optional `advance(ms)` that moves the
store's clock, `localObjectsConformance` takes `served` ids, and `keyProviderConformance`
takes `hosted` actors.

### Types

`ActivityPub` holds the vocabulary as types: `Object`, `Activity`, `Actor`, `PublicKey`,
`Multikey`, `Proof`, `Tag` (`Hashtag`, `Mention`, `Emoji`), `Attachment` (`Media`,
`PropertyValue`), `Image`, `Tombstone`, `Collection`, `CollectionPage`, `OrderedCollection`,
`OrderedCollectionPage`, and `Ref<T>` for a member that may be an IRI or the object it names.
Every member a reader returns is present, with `null`, `[]`, `{}` or `false` when the sender
left it out. `ActivityPub.Draft<T>` is the shape an app authors: `id` and `type` required,
every other member optional.

`Federation` carries its own types: `Options`, `Stores`, `Queue`, `OutboxPage`, `Message`,
`Context`, `DeleteContext`, `HandledType`, `Outcome`, `ProcessOptions` and `RespondOptions`.

## Pattern: One Job With `@sdxc/jobs`

The package has no dependency on a job runner. With
[`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs), one declared job carries every
message, and its handler builds the federation from the job's context:

```typescript
import { Federation } from "@sdxc/activitypub";
import { createJobHandler, job, jobs } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

export let definitions = jobs({ federation: job({ input: Federation.MESSAGE }) });

export function federationFor(stores: Federation.Stores): Federation {
	return new Federation({
		actor: ACTOR,
		keys,
		stores,
		cache,
		userAgent: USER_AGENT,
		queue: {
			enqueue: (message) => dispatcher.enqueue(definitions.federation, message),
			enqueueMany: (messages) => dispatcher.enqueueMany(definitions.federation, messages),
		},
	}).on(["Create", "Like", "Announce"], (ctx) => saveResponse(ctx.summary()));
}

export default createJobHandler(definitions.federation, async (ctx) => {
	let processed = await federationFor(storesOf(ctx)).process(ctx.input, { attempts: ctx.attempts });
	if (isFailure(processed)) {
		if (processed.error.retryable)
			ctx.retry({ delay: processed.error.delay, cause: processed.error });
		ctx.ack(processed.error.message);
	}
});
```

## Quirks the package absorbs

| Quirk                                                                               | Handled by                                           |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `as:Public`, `Public` and the full IRI all address the public                       | `parse*`                                             |
| One value or an array for `to`, `cc`, `tag`, `attachment` and `type`                | `parse*`                                             |
| An IRI or an embedded object for `actor`, `attributedTo`, `inReplyTo` and `object`  | `parse*`                                             |
| `contentMap`, `nameMap` or `summaryMap` without the plain value                     | `parse*`                                             |
| `url` as a string, a `Link`, or a list of `Link`s with the HTML page anywhere in it | `parse*`                                             |
| Quotes as `quote` (Mastodon 4.5), `_misskey_quote`, `quoteUrl` or `quoteUri`        | `parse*`, `stringify`                                |
| Misskey emoji reactions as a `Like` with `content` or only `_misskey_reaction`      | `parseActivity`                                      |
| Mastodon embeds the first page of `replies` without an `id`                         | `parseCollection`                                    |
| WebFinger `self` must be typed `application/activity+json`                          | `actorLink`                                          |
| A handle resolves back through `preferredUsername@<actor host>`                     | `federation.lookup`                                  |
| `publicKey.id` is `<actor>#main-key`, with `owner`                                  | `ActorKeys#publicKey`, `federation.fetch`            |
| Secure mode and GoToSocial refuse unsigned GETs                                     | `RemoteResolver` signs GETs                          |
| A deleted account's key answers `410`                                               | `RemoteResolver` → `gone`                            |
| A refetch of a deleted object must answer `410`                                     | `federation.respond`                                 |
| A sender falls back from RFC 9421 to cavage only on a synchronous `401`             | `federation.fetch` verifies in the request           |
| A rotated key fails against the cached one                                          | The inbox refetches the key once                     |
| Mastodon forwards replies to a thread's participants under its own signature        | The inbox refetches the activity from its origin     |
| A deleted account sends unverifiable `Delete`s to every server it knew              | The inbox answers `202` (`ignored`)                  |
| An embedded object from another origin can say anything                             | `process` fetches it from its own origin (FEP-c7d3)  |
| `Accept` should embed the Follow, since some servers match on it                    | `process`                                            |
| A repeated Follow means the sender never saw the Accept                             | `process` re-sends it                                |
| Misskey reactions are a `Like` with `content`; Pleroma sends `EmojiReact`           | `Like` handlers and `summary()` read both as a like  |
| Every inbox POST must be signed and cover the body digest                           | `process` (`deliver`)                                |
| Mastodon before 4.5 rejects RFC 9421 and newer servers may prefer it                | Double-knocking, scheme cached per origin            |
| `Date` must be an IMF-fixdate inside the receiver's window                          | Deliveries are signed at send time, never at enqueue |
| Some instances refuse requests without a `User-Agent`                               | `userAgent` is a required option                     |
| A server can ask for specific components through `Accept-Signature`                 | Delivery honors it once                              |
| An inbox answering `410` is gone for good                                           | `process` removes its followers                      |
| Servers down for days should stop costing a delivery per post                       | Fan-out skips origins failing for 7 days             |
| One server hosting many followers wants one POST                                    | Fan-out dedupes `sharedInbox ?? inbox`               |
| `bto` and `bcc` must not reach recipients                                           | Fan-out strips them before delivery                  |
| A queue message is at most 128 KB                                                   | `federation.publish` → `too-large` past 120 KB       |

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
		"@sdxc/activitypub": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
