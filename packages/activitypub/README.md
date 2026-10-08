# @sdxc/activitypub

ActivityPub protocol logic: the ActivityStreams vocabulary read from untrusted JSON and written the way Mastodon expects, collections, content negotiation, and actor discovery.

## Installation

```sh
npm add @sdxc/activitypub
```

Readers return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values, which
install alongside this package.

ActivityPub servers exchange ActivityStreams 2.0 as compacted JSON-LD, and every server writes
it a little differently: one value or an array, an IRI or an embedded object, `content` or only
`contentMap`, `as:Public` or the full IRI. The `parse*` readers validate a decoded document and
fold every one of those variations into a single shape, without a JSON-LD processor, so no
remote context is ever fetched. `stringify` writes one fixed `@context` in the shape Mastodon
emits.

## Usage

### Read An Inbound Activity

```typescript
import { PUBLIC, parseActivity } from "@sdxc/activitypub";
import { isFailure } from "@sdxc/result";

let activity = parseActivity(await request.json());
if (isFailure(activity)) return new Response(activity.error.message, { status: 400 });

activity.data.actor; // always an IRI, even when the sender embedded the actor
activity.data.to.includes(PUBLIC); // true for "as:Public", "Public" and the full IRI
```

### Write An Article

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
	summary: "A first post.",
	content: "<p>Hello, fediverse.</p>",
	url: "https://example.com/articles/hello",
	published: new Date("2026-10-01T12:00:00Z"),
	tag: [{ type: "Hashtag", name: "#hello", href: "https://example.com/tags/hello" }],
} satisfies ActivityPub.Draft<ActivityPub.Object>;

stringify(article); // JSON text with @context, ready to serve or deliver
```

### Serve A Page As HTML Or As ActivityStreams

```typescript
import { respond, wantsActivity } from "@sdxc/activitypub/response";

if (wantsActivity(request)) return respond(article, { request, vary: true });
return renderHtml(article);
```

### Point WebFinger At The Actor

```typescript
import { actorLink } from "@sdxc/activitypub/discovery";

let jrd = {
	subject: "acct:hello@example.com",
	aliases: [],
	properties: {},
	links: [actorLink("https://example.com/actor")],
};
```

### Sign As An Actor

```typescript
import { generateActorKeys, importActorKeys, publicKeyOf } from "@sdxc/activitypub/keys";
import { unwrap } from "@sdxc/result";

// Once, from a script: store privateKeyPem as a secret.
let { privateKeyPem } = unwrap(await generateActorKeys());

let keys = unwrap(
	await importActorKeys({ actor: ACTOR_ID, privateKeyPem: env.ACTIVITYPUB_PRIVATE_KEY }),
);
let actor = { ...ACTOR, publicKey: publicKeyOf(keys) };
```

### Fetch Remote Actors, Keys And Objects

```typescript
import { createResolver } from "@sdxc/activitypub/remote";

let resolver = createResolver({
	cache, // an @sdxc/cache Cache, such as WorkerKVCache
	signer: { actor: ACTOR_ID, keys }, // signs every GET; omit for unsigned fetches
	userAgent: "example.com/1.0 (+https://example.com)",
	ttl: { actor: "1 day", object: "1 hour" },
});

let actor = await resolver.actor("https://mastodon.social/users/someone");
let key = await resolver.key("https://mastodon.social/users/someone#main-key"); // { owner, publicKey, actor }
let note = await resolver.object(iri, { fresh: true }); // skips the cached copy
```

### Resolve A Handle

```typescript
import { lookup } from "@sdxc/activitypub/discovery";

let actor = await lookup("@someone@mastodon.social", { resolver, userAgent: USER_AGENT });
```

### Receive Activities

The inbox route verifies inside the request, so a sender learns from a `401` to retry with
the other signature scheme, and processes in a job. `INBOX_INPUT` is the job's input schema.

```typescript
import {
	accepted,
	handle,
	INBOX_INPUT,
	receive,
	rejected,
	summarize,
} from "@sdxc/activitypub/inbox";
import { isFailure, success } from "@sdxc/result";

// jobs.ts: inbox: job({ input: INBOX_INPUT })

// The inbox route.
let received = await receive(ctx.request, {
	resolver,
	blocked: (host) => isBlocked(host),
	cache, // clears the sender's origin from the failing-delivery record
});
if (isFailure(received)) return rejected(received.error); // 4xx, or an empty 202 for `ignored`
await ctx.jobs.enqueue(jobs.activityPub.inbox, received.data);
return accepted(); // 202

// The inbox job.
let outcome = await handle(ctx.input, {
	actor: ACTOR, // the local actor document
	keys, // KeyProvider
	followers, // FollowerStore
	seen, // SeenActivities
	objects, // LocalObjects
	resolver,
	blocked: (host) => isBlocked(host),
	async send(activity, inbox) {
		await ctx.jobs.enqueue(jobs.activityPub.deliver, { actor: ACTOR_ID, activity, inbox });
		return success(undefined);
	},
	attempts: ctx.attempts,
	on: {
		async create(inbound) {
			let summary = summarize(inbound); // reply or mention, sanitized
			if (summary) await responses.save(summary);
			return success(undefined);
		},
		async like(inbound) {
			let summary = summarize(inbound);
			if (summary) await responses.save(summary);
			return success(undefined);
		},
	},
});
if (isFailure(outcome)) {
	if (outcome.error.retryable) return ctx.retry({ cause: outcome.error });
	return ctx.ack(outcome.error.message);
}
```

### Deliver Activities

Delivery is two queued jobs the app declares from the package's input schemas, which are
Standard Schema. The package has no dependency on a job runner; this wiring uses
[`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs).

```typescript
import {
	DELIVERY_BACKOFF,
	DELIVERY_INPUT,
	FAN_OUT_INPUT,
	INBOX_INPUT,
	deliver,
	fanOut,
} from "@sdxc/activitypub/outbox";
import { isFailure } from "@sdxc/result";

export default jobs({
	activityPub: {
		inbox: job({ input: INBOX_INPUT }), // what `receive` verified
		fanOut: job({ input: FAN_OUT_INPUT }), // { actor, activity: string }
		deliver: job({ input: DELIVERY_INPUT }), // { actor, activity: string, inbox }
	},
});

// When a post is published, edited or deleted:
await dispatcher.enqueue(jobs.activityPub.fanOut, { actor: ACTOR_ID, activity: stringify(create) });

// The fanOut job: one delivery per distinct inbox.
let planned = await fanOut(ctx.input, {
	actor: ACTOR, // the local actor document; its `followers` IRI selects the followers
	followers, // FollowerStore
	resolver,
	blocked: (host) => isBlocked(host),
	cache,
	enqueue: (deliveries) => dispatcher.enqueueMany(jobs.activityPub.deliver, deliveries),
});
if (isFailure(planned)) {
	if (planned.error.retryable) return ctx.retry({ cause: planned.error });
	return ctx.ack(planned.error.message);
}

// The deliver job: sign and POST one activity to one inbox.
let sent = await deliver(ctx.input, { keys, cache, userAgent: USER_AGENT });
if (isFailure(sent)) {
	if (sent.error.code === "gone") await followers.removeInbox(ctx.input.inbox);
	if (sent.error.retryable) {
		let delay = Math.max(sent.error.retryAfter ?? 0, DELIVERY_BACKOFF.delay(ctx.attempts));
		return ctx.retry({ delay, cause: sent.error });
	}
	return ctx.ack(sent.error.message);
}
```

## API

### `@sdxc/activitypub`

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

#### `tombstone(init: TombstoneInit): ActivityPub.Tombstone`

The document a deleted object is served as: `{ id, formerType?, deleted? }`.

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

#### Errors

Every error extends `ActivityPubError`, which carries a `code` and a `retryable` flag a job
consumer reads to choose between retrying and acknowledging.

- `ActivityPubParseError`: `code: "invalid-document"`, never retryable. `kind` names the
  reader, and `issues` lists every problem as `{ at, message }`, where `at` is a JSON Pointer
  into the document.
- `ActivityPubFetchError`: a remote document that could not be used. `code` is one of `gone`,
  `not-found`, `unauthorized`, `refused-url`, `too-large`, `timeout`, `network`,
  `invalid-document`, `id-mismatch` or `http`, with the document's `url` and the response
  `status`. `timeout`, `network`, and `http` with a `5xx` or `429` are retryable.

### `@sdxc/activitypub/response`

#### `wantsActivity(request: Request): boolean`

`true` when `application/activity+json` or `application/ld+json` is preferred over
`text/html`. A wildcard and a missing `Accept` read as HTML, so browsers and crawlers get the
page.

#### `respond(document, options?): Promise<Response>`

Answers `application/activity+json; charset=utf-8` with an `ETag` and a public 5-minute
`Cache-Control`. A `Tombstone` answers `410`, which is how a refetching server learns the
object was deleted.

- `options.request`: enables a `304` when `If-None-Match` matches, and an empty body for `HEAD`.
- `options.vary`: adds `Vary: Accept`, which a URL that also serves HTML needs.
- `options.cache`: the policy, as [`@sdxc/http`](https://www.npmjs.com/package/@sdxc/http)'s
  `policy()` takes it.
- `options.headers`: extra headers, applied last.
- `options.status`: overrides the status.

### `@sdxc/activitypub/collections`

`orderedCollection`, `orderedCollectionPage`, `collection` and `collectionPage` build the
documents an outbox, a followers list or a `replies` collection serves. Give a collection
`totalItems` alone to publish a count without its members.

```typescript
import { orderedCollection, orderedCollectionPage } from "@sdxc/activitypub/collections";

orderedCollection({ id: FOLLOWERS, totalItems: 42, first: `${FOLLOWERS}?page=1` });
orderedCollectionPage({ id: pageUrl, partOf: OUTBOX, orderedItems: creates, next: nextUrl });
```

### `@sdxc/activitypub/discovery`

#### `actorLink(actorId: string): JrdLink`

The WebFinger `self` link typed `application/activity+json`, which Mastodon follows to
resolve a handle. WebFinger for `preferredUsername@<actor host>` must answer this link,
because Mastodon checks the reverse direction.

#### `lookup(handle: string, options: LookupOptions): Promise<Result<ActivityPub.Actor, ActivityPubFetchError>>`

Resolves `@user@host`, `user@host` or `acct:user@host` the way Mastodon does. It asks
`https://host/.well-known/webfinger?resource=acct:user@host` with
`Accept: application/jrd+json`, takes the `self` link typed `application/activity+json` (or
`application/ld+json` with the ActivityStreams profile), and fetches that actor through
`options.resolver`. The actor's canonical handle is `preferredUsername@<actor host>`. A
handle whose host is the actor's host and whose user is its `preferredUsername`, compared
without case, resolves directly; any other handle resolves only when WebFinger on the actor's
host answers the canonical handle with a `self` link to the same actor id. That is how a
handle on its own domain reaches an actor hosted elsewhere, and why a WebFinger answer on
one host cannot attach a handle to an actor on another.

- `options.resolver`: the `Resolver` the actor is fetched with, and cached by.
- `options.userAgent`: sent with the WebFinger request.
- `options.timeout`: the deadline of each WebFinger request, `"10 seconds"` by default.

Fails `refused-url` for a handle without a public host, `not-found` when WebFinger names no
ActivityStreams actor, `id-mismatch` when the actor's host does not confirm the handle, and
with any code the resolver or a WebFinger request answers.

### `@sdxc/activitypub/keys`

#### `generateActorKeys(): Promise<Result<GeneratedActorKeys, CryptoError>>`

Generates an RSASSA-PKCS1-v1_5 2048-bit SHA-256 pair, which is what Mastodon generates and
verifies, as `{ privateKeyPem, publicKeyPem }` in PKCS#8 and SPKI PEM. Run it once and store
`privateKeyPem` as a secret. A new pair is an actor `Update` delivered to every follower.

#### `importActorKeys(options): Promise<Result<ActorKeys, CryptoError>>`

Imports `{ actor, privateKeyPem }`. The public half is derived from the private key, so one
secret is all an app stores. A PKCS#1 key (`BEGIN RSA PRIVATE KEY`) fails with an
`InvalidKeyError`; convert it with `openssl pkcs8 -topk8 -nocrypt`.

```typescript
interface ActorKeys {
	actor: string;
	rsa: { id: string; privateKey: CryptoKey; publicKeyPem: string }; // id: `${actor}#main-key`
	ed25519: { id: string; privateKey: CryptoKey; publicKeyMultibase: string } | null;
}
```

`rsa.privateKey` is not extractable and signs with `@sdxc/http-signatures`. `ed25519` is
`null` until object integrity proofs ship.

#### `publicKeyOf(keys: ActorKeys): ActivityPub.PublicKey`

`{ id: "<actor>#main-key", owner: actor, publicKeyPem }`, the actor's `publicKey` member.

#### `importPublicKey(pem: string): Promise<Result<CryptoKey, CryptoError>>`

Imports a remote `publicKeyPem` (SPKI, RSA or Ed25519) as a verify-only key.

### `@sdxc/activitypub/remote`

#### `createResolver(options: ResolverOptions): Resolver`

- `cache`: an `@sdxc/cache` `Cache`. Documents are stored as JSON under
  `activitypub:doc:<iri>` and read again through the same parsers. A failing store reads as a
  miss and never fails a fetch.
- `signer`: `{ actor, keys }`. Every GET is then signed with draft-cavage over
  `(request-target) host date`, which secure-mode Mastodon and GoToSocial require (authorized
  fetch).
- `userAgent`: sent on every request, since some instances refuse requests without one.
- `ttl`: `{ actor, object }`, `"1 day"` and `"1 hour"` by default.
- `timeout`: one deadline for the redirect chain and the body, `"10 seconds"` by default.
- `maxBytes`: the body cap, 1 MB by default.

Every request goes through [`@sdxc/outbound`](https://www.npmjs.com/package/@sdxc/outbound):
each hop's URL is checked and its host resolved over DNS-over-HTTPS, so a document pointing at
`169.254.169.254` or at a name that resolves inside a network is refused, never fetched. A
document is accepted only when its `id` has the origin the redirect chain ended at. When a
signed request is redirected and the final URL answers `401` or `403`, it is signed for that
URL and asked once more.

```typescript
interface Resolver {
	actor(
		iri: string,
		options?: { fresh?: boolean },
	): Promise<Result<ActivityPub.Actor, ActivityPubFetchError>>;
	key(
		keyId: string,
		options?: { fresh?: boolean },
	): Promise<Result<ResolvedKey, ActivityPubFetchError>>;
	object(
		iri: string,
		options?: { fresh?: boolean },
	): Promise<Result<ActivityPub.Object | ActivityPub.Activity, ActivityPubFetchError>>;
	document(
		iri: string,
		options?: { fresh?: boolean },
	): Promise<Result<Record<string, unknown>, ActivityPubFetchError>>;
	evict(iri: string): Promise<void>;
}

interface ResolvedKey {
	owner: string;
	publicKey: CryptoKey;
	actor: ActivityPub.Actor;
}
```

- `actor` reads an actor document.
- `key` fetches the `keyId` without its fragment. An actor there is the owner; a key document
  names its owner in `owner`, and that actor is fetched. Either way the actor must list the key
  under exactly `keyId` (else `not-found`, which is also how a rotated key shows) and the key's
  `owner` must be the actor (else `id-mismatch`). `owner` is what an inbox compares with
  `activity.actor`. After a failed verification, ask again with `{ fresh: true }` to pick up a
  rotated key.
- `object` reads an activity when the document has an `actor`, and any object otherwise.
- `document` answers the decoded JSON after the same checks, for a shape no reader models.
- `evict` forgets a cached document, as after an actor's `Update` or `Delete`.
- `fresh: true` skips the cached copy and stores what arrives.

`Resolver` is an interface, so a test or an inbox can pass its own.

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

### `@sdxc/activitypub/inbox`

#### `receive(request: Request, options: ReceiveOptions): Promise<Result<Received, InboxError>>`

Verifies a POST to an inbox. The steps run in order and stop at the first failure, and no
remote document is fetched before the blocked check:

| Step                                                                                   | `InboxError.code`                      | Status |
| -------------------------------------------------------------------------------------- | -------------------------------------- | ------ |
| `Content-Type` is `application/activity+json` or `application/ld+json`                 | `unsupported-media-type`               | 415    |
| The body fits `maxBytes`                                                               | `too-large`                            | 413    |
| The body is JSON that `parseActivity` accepts                                          | `invalid-activity`                     | 400    |
| Neither the `keyId` host nor the `actor` host is `blocked`                             | `blocked`                              | 403    |
| A signature is present: `Signature-Input` (RFC 9421) or `Signature` (cavage)           | `unsigned`                             | 401    |
| The signature covers `Content-Digest` or `Digest`, and the body matches it             | `digest-mismatch`                      | 401    |
| `created` or `Date` is within `maxAge`, with 5 minutes of clock skew                   | `stale-signature`                      | 401    |
| The signature verifies with the key; a failure refetches the key once, for a rotation  | `invalid-signature`, `key-unavailable` | 401    |
| The key's owner is `activity.actor`, or the activity refetched from its origin matches | `actor-mismatch`                       | 401    |
| A `Delete` of an account whose key now answers `410`                                   | `ignored`                              | 202    |

A forwarded activity (Mastodon forwards replies to a thread's participants under the
forwarder's signature) is accepted when its `id` has the actor's origin and a fresh copy from
there is the same activity by the same actor; `Received` then carries that copy.

| Option     | Default      | Meaning                                                              |
| ---------- | ------------ | -------------------------------------------------------------------- |
| `resolver` | required     | Resolves the signature's key, and refetches forwarded activities     |
| `blocked`  | required     | `(host) => boolean \| Promise<boolean>`                              |
| `maxBytes` | `102400`     | Leaves room for the rest of `Received` in a 128 KB queue message     |
| `maxAge`   | `"1 hour"`   | How old a signature may be                                           |
| `cache`    | none         | A verified activity clears its signer's origin from fan-out's record |
| `now`      | `new Date()` | The clock signatures are checked against                             |

`Received` is plain JSON, ready to enqueue:

```typescript
interface Received {
	activity: Record<string, unknown>; // as received, or as refetched from the actor's origin
	actor: string; // activity.actor, which verification established
	signer: string; // whose key signed: the actor, or the server that forwarded it
	keyId: string;
	origin: string; // the actor's origin
	verification: "signature" | "proof" | "refetched"; // "proof" is reserved for FEP-8b32
	receivedAt: string; // ISO 8601
}
```

#### `accepted(): Response` and `rejected(error: InboxError): Response`

`accepted` answers `202` with no body. `rejected` answers the error's `status` with a fixed
`text/plain` sentence per code, so a sender learns which rule failed and never what the
verifier saw; `ignored` answers an empty `202`. `InboxError` extends `ActivityPubError` with
`status`, keeps the detail in `message` and `cause`, and is never retryable.

#### `INBOX_INPUT`

The Standard Schema of `Received`, for `job({ input: INBOX_INPUT })`.

#### `handle(input: Received, options: HandleOptions): Promise<Result<HandleOutcome, ActivityPubError>>`

Claims the activity id in `seen` (a store failure is logged and processing goes on), reads
the activity again, fetches the actor, does the protocol's work, then calls the app's handler:

| Activity                         | Package does                                                                                                                                                                                                                   | Handler            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `Follow` of the local actor      | Stores the follower (`pending` when `manuallyApprovesFollowers`) and sends `Accept`, embedding the Follow, to the follower's inbox; again on a repeated Follow. A blocked server, or the handler's `"reject"`, gets a `Reject` | `follow`           |
| `Undo` of `Follow`               | Removes the follower when the stored `followId` matches or the embedded Follow is the sender's                                                                                                                                 | `undo`             |
| `Create`, `Update`               | Requires the object to be attributed to the actor and on its origin, and to reply to, quote, or mention something local                                                                                                        | `create`, `update` |
| `Update` of the actor            | Evicts and refetches the actor, and refreshes a stored follower's `inbox` and `sharedInbox`                                                                                                                                    | `update`           |
| `Delete` of an object            | Requires a fresh refetch that answers `404`/`410`/`Tombstone`, or still names the sender as author                                                                                                                             | `delete`           |
| `Delete` of the actor            | Removes its follow of the local actor and evicts it, even when its document is gone                                                                                                                                            | `delete`           |
| `Like`, `EmojiReact`, `Announce` | Ignores objects that are not in `LocalObjects`                                                                                                                                                                                 | `like`, `announce` |
| `Undo` of anything else          | Requires the undone activity, embedded from the sender's origin or fetched, to be the sender's                                                                                                                                 | `undo`             |
| `Accept`, `Reject`               | Requires the Follow to be one a local actor sent: embedded on the local origin naming the sender, or a local IRI                                                                                                               | `accept`, `reject` |
| `Move`                           | Fetches the target fresh; it must list the mover in `alsoKnownAs`, and the mover, fetched fresh, must name it in `movedTo`                                                                                                     | `move`             |
| Anything else                    | Logged with `currentLog()` and acknowledged                                                                                                                                                                                    | none               |

An object embedded from an origin other than the actor's is fetched from its own origin
rather than trusted (FEP-c7d3). Every handler is optional and answers
`Promise<Result<…, Error>>`; `follow` answers `"accept" | "reject" | "pending"`, or `null` for
the default. A handler receives an `Inbound`:

```typescript
interface Inbound {
	activity: ActivityPub.Activity;
	actor: ActivityPub.Actor; // fetched, never the copy an activity embeds
	origin: string;
	verification: "signature" | "proof" | "refetched";
	object: ActivityPub.Object | null; // the post, the local object, the undone activity, the Follow, the Move target
	target: string | null; // the local object or actor it concerns
	receivedAt: Date;
}
```

`delete` receives a `DeleteInbound`, whose `actor` is `null` when a deleted account's document
is already gone and whose `deleted` is `{ kind: "object" | "actor", id }`.

| Option                         | Default   | Meaning                                                                                     |
| ------------------------------ | --------- | ------------------------------------------------------------------------------------------- |
| `actor`                        | required  | The local actor document; Follows name it and answers are sent as it                        |
| `keys`                         | required  | A `KeyProvider`; an actor it has keys for counts as local                                   |
| `followers`, `seen`, `objects` | required  | The app's stores                                                                            |
| `resolver`, `blocked`          | required  | As for `receive`                                                                            |
| `send`                         | required  | `(activity: string, inbox: string) => Promise<Result<void, Error>>`, usually a delivery job |
| `on`                           | none      | `Partial<Handlers>`                                                                         |
| `seenTtl`                      | `"1 day"` | How long a claimed id counts as seen                                                        |
| `attempts`                     | `1`       | The job's attempt; past the first the claim is skipped, so a retry is never a duplicate     |

`HandleOutcome` is `{ status: "processed" | "duplicate" | "ignored", type, reason }`, where
`reason` is `null` or one of `blocked`, `actor-unavailable`, `not-addressed`, `not-owner`,
`unrelated`, `unverifiable`, `unhandled`, `rejected` and `pending`. A failure is retryable when
a remote server, a store, a handler or `send` failed in a way the next attempt can change.

#### `summarize(inbound: Inbound): Summary | null`

The shape a Webmention is stored in, for a reply, mention, like or boost of local content:

```typescript
interface Summary {
	kind: "reply" | "like" | "repost" | "mention"; // a quote reads as mention
	id: string; // the remote post, or the Like/Announce
	url: string; // its HTML page, else its id
	target: string; // the local object or actor
	author: { id: string; handle: string; name: string | null; url: string; photo: string | null };
	content: { html: string; text: string } | null; // HTML.sanitize'd against the object's id
	published: Date | null;
}
```

`handle` is `@user@host`. Misskey's emoji reactions (a `Like` with `content`) and Pleroma's
`EmojiReact` read as `like`, with the emoji as content. Any other activity answers `null`.

#### `verifyFetch(request: Request, options: VerifyFetchOptions): Promise<Result<VerifiedFetch, InboxError>>`

The signature half of `receive`, for an app that serves secure-mode (authorized) GETs: the
blocked host of the key, the signature's age, and the key, refetched once. The documents of
`actors` pass unsigned, because a remote server reads that key to verify its own signed fetch,
and so do URLs `exempt(url)` accepts. It answers `{ signer, keyId }`, both `null` for an
exempt URL.

### `@sdxc/activitypub/outbox`

#### `FAN_OUT_INPUT` and `DELIVERY_INPUT`

The job input schemas, as Standard Schema from `remix/data-schema`, so `job({ input })`
validates every message. `FAN_OUT_INPUT` reads `{ actor, activity }` and `DELIVERY_INPUT`
reads `{ actor, activity, inbox }`, with `actor` and `inbox` URLs and `activity` the JSON
text. The activity travels whole, so every inbox receives the same bytes even after the post
it describes changes. The inputs are typed `FanOutInput` and `DeliveryInput`. `INBOX_INPUT` is
re-exported from `./inbox`, so one import declares every ActivityPub job.

#### `fanOut(input: FanOutInput, options: FanOutOptions): Promise<Result<FanOutResult, ActivityPubError<FanOutErrorCode>>>`

Enqueues one delivery per distinct inbox the activity is addressed to, and answers
`{ inboxes, skipped }`: deliveries enqueued, and targets left out.

- `actor`: the sending actor's document, or `{ id, followers }`. Its `id` must equal
  `input.actor`, and its `followers` IRI is how addressing reaches the followers.
- `followers`: the `FollowerStore`. When `actor.followers` is in `to`, `cc`, `bto` or `bcc`
  of the activity or its embedded object, `inboxes` is paged through.
- `resolver`: every other addressed IRI except `PUBLIC` and the actor itself is resolved to
  its actor's `sharedInbox ?? inbox`. One that fails to resolve, a collection for example, is
  skipped and counted, so an unreachable mention never holds back the followers.
- `blocked(host)`: called once per host. A blocked host receives nothing, and an actor
  addressed on it is never fetched.
- `cache`: where `deliver` keeps failing origins. An origin failing for more than 7 days is
  skipped until an activity from it verifies in the inbox or a delivery to it lands.
- `enqueue(deliveries)`: writes one batch of delivery jobs, whose messages may total more
  than one queue write carries; `enqueueMany` from `@sdxc/jobs` splits it as the queue needs.
  It may resolve to a `Result` or to nothing; a failure or a rejection fails the fan-out as a
  retryable `enqueue`.
- `pageSize`: store page size and largest batch, 100 by default.
- `now`: the clock failure windows are measured against.

Targets are deduplicated as URLs, so one server with 400 followers gets one POST. `bto` and
`bcc` are read for addressing and stripped from what is delivered (ActivityPub §6); an
activity without them is delivered byte for byte. A retried fan-out may enqueue some
deliveries twice, which receivers absorb by activity id.

| Failure                                                      | `code`             | `retryable` |
| ------------------------------------------------------------ | ------------------ | ----------- |
| `actor.id` is not `input.actor`                              | `invalid-input`    | No          |
| `activity` is not an activity                                | `invalid-document` | No          |
| The activity is over 120 KB (`MAX_ACTIVITY_BYTES`)           | `too-large`        | No          |
| `FollowerStore.inboxes` failed                               | `store`            | Yes         |
| `enqueue` failed or rejected (earlier batches stay enqueued) | `enqueue`          | Yes         |

#### `deliver(input: DeliveryInput, options: DeliverOptions): Promise<Result<Delivered, DeliveryError>>`

Signs and POSTs one activity to one inbox, and answers `{ status, scheme }`.

- `keys`: the `KeyProvider` holding `input.actor`'s keys.
- `cache`: keeps the scheme each origin accepted under `activitypub:scheme:<origin>` for 30
  days, and each origin's failure window. A failing cache costs at most an extra knock.
- `userAgent`: sent on every POST.
- `timeout`: the deadline of each POST, `"15 seconds"` by default.
- `now`: the signing time and the clock `Retry-After` dates are read against.

The inbox passes `checkUrl` and its host is resolved to public addresses before anything is
sent. Each POST carries `Content-Type: application/activity+json`, `Accept` and
`User-Agent`, is signed when it is sent so `Date` is fresh on every retry, and goes out once
with `redirect: "manual"`.

Double-knocking: the first POST to an origin is signed with RFC 9421 (`Content-Digest`,
covering `@method`, `@target-uri`, `content-digest`, `content-type` and `date`). A `400`,
`401` or `403` is retried at once with draft-cavage (`Digest`, covering `(request-target)`,
`host`, `date`, `digest` and `content-type`). The scheme that lands is remembered and tried
first next time, with the other one as the fallback. A `401` carrying `Accept-Signature` is
honored once, with the components, label, nonce and tag it asks for.

| Response                           | `DeliveryError.code`  | `retryable`                              |
| ---------------------------------- | --------------------- | ---------------------------------------- |
| 2xx                                | (success)             |                                          |
| `410`                              | `gone`                | No. The caller drops that inbox          |
| `401`/`403` after every scheme     | `unauthorized`        | No                                       |
| `429`                              | `rate-limited`        | Yes, `retryAfter` from `Retry-After`     |
| other 3xx and 4xx                  | `rejected`            | No                                       |
| 5xx                                | `server`              | Yes, with `retryAfter` when it names one |
| deadline passed / `fetch` rejected | `timeout` / `network` | Yes                                      |
| `checkUrl` or resolution refused   | `refused-url`         | No                                       |
| No keys for `input.actor`          | `missing-keys`        | No                                       |
| The `KeyProvider` failed           | `keys-unavailable`    | Yes                                      |
| The keys cannot sign               | `unsignable`          | No                                       |

Every retryable failure except `keys-unavailable` starts or extends the origin's failure
window, and a 2xx clears it. `DeliveryError` extends `ActivityPubError` with `inbox`,
`status` (the last answer, or `null`) and `retryAfter` (milliseconds, or `null`).
`parseRetryAfter(value, now)` reads a `Retry-After` value the same way: delay-seconds or an
HTTP date, clamped between `0` and 12 hours (the longest `DELIVERY_BACKOFF` step), so an
inbox cannot postpone its retries indefinitely.

#### `DELIVERY_BACKOFF`

`createBackoff({ steps: ["5 minutes", "30 minutes", "2 hours", "6 hours", "12 hours"],
jitter: 0.2 })` from [`@sdxc/backoff`](https://www.npmjs.com/package/@sdxc/backoff): about
21 hours over five retries. An app whose queue retries more passes its own schedule.

### Storage

The package keeps no state of its own. It calls four interfaces, exported as types from the
root, and the app implements them over its own database:

- `FollowerStore`: followers keyed by `(actor, id)`. `put` inserts or replaces, so a repeated
  Follow refreshes the inbox and `followId`. `list`, `count` and `inboxes` see accepted
  followers only; `inboxes` answers each `sharedInbox ?? inbox` once. `removeInbox` drops
  every follower whose inbox or shared inbox is the URL. Listings page through
  `StorePage<T>`, whose `next` is the store's own opaque cursor.
- `SeenActivities`: `claim(id, ttl)` answers `true` the first time an id is claimed within
  `ttl`, a `DurationInput` such as `"1 day"`.
- `LocalObjects`: `find(id)` answers the object the app serves under `id`, or `null`.
- `KeyProvider`: `keysOf(actor)` answers a hosted actor's `ActorKeys`, or `null`.

### `@sdxc/activitypub/memory`

In-memory implementations of every storage interface, for tests and local servers:

- `new MemoryFollowerStore(followers?)` lists in insertion order, and its cursors are offsets.
- `new MemorySeenActivities({ now? })` reads the time from `now`, so a test passes a TTL by
  moving its own clock.
- `new MemoryLocalObjects(objects?)` serves a fixed list of objects.
- `new MemoryKeyProvider(keys?)` hosts a fixed list of `ActorKeys`.

### `@sdxc/activitypub/conformance`

Vitest suites an app registers against its own storage, so it is held to the contracts the
package relies on. Each takes a `name` that labels the suite and a `create` that builds a fresh
implementation for every test. `vitest` is an optional peer dependency, needed only here.

```typescript
import {
	followerStoreConformance,
	keyProviderConformance,
	localObjectsConformance,
	seenActivitiesConformance,
} from "@sdxc/activitypub/conformance";

followerStoreConformance({ name: "D1FollowerStore", create: () => new D1FollowerStore(db) });
seenActivitiesConformance({ name: "KvSeenActivities", create: () => new KvSeenActivities(kv) });
localObjectsConformance({ name: "Posts", create: () => new Posts(db), served: [ARTICLE_ID] });
keyProviderConformance({ name: "Keys", create: () => new Keys(env), hosted: [ACTOR_ID] });
```

- `followerStoreConformance` starts every test from an empty store.
- `seenActivitiesConformance` takes an optional `advance(ms)` that moves the store's clock,
  which adds the assertion that an id is claimable again once its TTL passes.
- `localObjectsConformance` takes `served`, ids the store finds objects under.
- `keyProviderConformance` takes `hosted`, actors the provider has keys for.

### Types

`ActivityPub` holds the vocabulary as types: `Object`, `Activity`, `Actor`, `PublicKey`,
`Multikey`, `Proof`, `Tag` (`Hashtag`, `Mention`, `Emoji`), `Attachment` (`Media`,
`PropertyValue`), `Image`, `Tombstone`, `Collection`, `CollectionPage`, `OrderedCollection`,
`OrderedCollectionPage`, and `Ref<T>` for a member that may be an IRI or the object it names.
Every member a reader returns is present, with `null`, `[]`, `{}` or `false` when the sender
left it out. `ActivityPub.Draft<T>` is the shape an app authors: `id` and `type` required,
every other member optional.

## Quirks the package absorbs

| Quirk                                                                               | Handled by                                          |
| ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| `as:Public`, `Public` and the full IRI all address the public                       | `parse*`                                            |
| One value or an array for `to`, `cc`, `tag`, `attachment` and `type`                | `parse*`                                            |
| An IRI or an embedded object for `actor`, `attributedTo`, `inReplyTo` and `object`  | `parse*`                                            |
| `contentMap`, `nameMap` or `summaryMap` without the plain value                     | `parse*`                                            |
| `url` as a string, a `Link`, or a list of `Link`s with the HTML page anywhere in it | `parse*`                                            |
| Quotes as `quote` (Mastodon 4.5), `_misskey_quote`, `quoteUrl` or `quoteUri`        | `parse*`, `stringify`                               |
| Misskey emoji reactions as a `Like` with `content` or only `_misskey_reaction`      | `parseActivity`                                     |
| Mastodon embeds the first page of `replies` without an `id`                         | `parseCollection`                                   |
| WebFinger `self` must be typed `application/activity+json`                          | `actorLink`                                         |
| A handle resolves back through `preferredUsername@<actor host>`                     | `lookup`                                            |
| Secure mode and GoToSocial refuse unsigned GETs                                     | `createResolver`                                    |
| A deleted account's key answers `410`                                               | `createResolver`                                    |
| A refetch of a deleted object must answer `410`                                     | `respond`                                           |
| A sender falls back from RFC 9421 to cavage only on a synchronous `401`             | `receive` verifies in the request                   |
| A rotated key fails against the cached one                                          | `receive` refetches the key once                    |
| Mastodon forwards replies to a thread's participants under its own signature        | `receive` refetches the activity from its origin    |
| A deleted account sends unverifiable `Delete`s to every server it knew              | `receive` → `ignored`, answered `202`               |
| An embedded object from another origin can say anything                             | `handle` fetches it from its own origin (FEP-c7d3)  |
| `Accept` should embed the Follow, since some servers match on it                    | `handle`                                            |
| A repeated Follow means the sender never saw the Accept                             | `handle` re-sends it                                |
| Misskey reactions are a `Like` with `content`; Pleroma sends `EmojiReact`           | `handle` and `summarize` read both as a like        |
| Every inbox POST must be signed and cover the body digest                           | `deliver`                                           |
| Mastodon before 4.5 rejects RFC 9421 and newer servers may prefer it                | `deliver` double-knocking, scheme cached per origin |
| `Date` must be an IMF-fixdate inside the receiver's window                          | `deliver` signs at send time, never at enqueue      |
| Some instances refuse requests without a `User-Agent`                               | `deliver` (`userAgent` is required)                 |
| A server can ask for specific components through `Accept-Signature`                 | `deliver` honors it once                            |
| An inbox answering `410` is gone for good                                           | `deliver` → `gone`, the app calls `removeInbox`     |
| Servers down for days should stop costing a delivery per post                       | `fanOut` skips origins failing for 7 days           |
| One server hosting many followers wants one POST                                    | `fanOut` dedupes `sharedInbox ?? inbox`             |
| `bto` and `bcc` must not reach recipients                                           | `fanOut` strips them before delivery                |
| A queue message is at most 128 KB                                                   | `fanOut` → `too-large` past 120 KB                  |

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
