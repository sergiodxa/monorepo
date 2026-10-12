# @sdxc/activitypub

ActivityPub protocol logic: vocabulary, actors, discovery, a verified inbox and signed delivery.

One `Federation` federates one local actor: `fetch` answers the actor's URLs and verifies its
inbox, `process` runs every queued step (inbox, fan-out, delivery), and `on` registers what the
app does with a reply, a like or a follow. The vocabulary (`parse*`, `stringify`) is plain
functions for anything the app reads or writes itself.

## Installation

```sh
npm add @sdxc/activitypub
```

Fallible calls answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result),
and remote documents are cached in an [`@sdxc/cache`](https://www.npmjs.com/package/@sdxc/cache)
`Cache`; install both alongside. `vitest` is an optional peer, needed only by
`@sdxc/activitypub/testing`.

## Usage

### Set up a federation

Generate the actor's key pair once and store `privateKeyPem` as a secret; the federation imports
it on every run. The stores are the app's own, described under Storage.

```typescript
import { ActorKeys, CacheSeenActivities, Federation, parseActor } from "@sdxc/activitypub";
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { unwrap } from "@sdxc/result";

// Once, from a script:
let { privateKeyPem } = unwrap(await ActorKeys.generate());

let actor = unwrap(
	parseActor({
		id: "https://example.com/actor",
		type: "Person",
		preferredUsername: "hello",
		inbox: "https://example.com/actor/inbox",
		outbox: "https://example.com/actor/outbox",
		followers: "https://example.com/actor/followers",
		following: "https://example.com/actor/following",
		endpoints: { sharedInbox: "https://example.com/inbox" },
	}),
);

let keys = unwrap(await ActorKeys.import({ actor: actor.id, privateKeyPem: env.PRIVATE_KEY }));
let cache = new WorkerKVCache(env.CACHE);

let federation = new Federation({
	actor,
	keys,
	stores: { followers, seen: new CacheSeenActivities(cache), objects },
	cache,
	userAgent: "example.com/1.0 (+https://example.com)",
	queue: { enqueue: (message) => env.QUEUE.send(message) },
});
```

### Answer the actor's URLs

```typescript
let response = await federation.fetch(request);
if (response) return response; // the actor, its inbox, outbox, followers or following
return router.fetch(request);
```

An inbox `POST` is verified inside the request and answers `202` once queued, or the status of
the check it failed.

### Process the queue

Every message the federation enqueues has one shape, `Federation.Message`, so one consumer hands
each back:

```typescript
import { isFailure } from "@sdxc/result";

let processed = await federation.process(message, { attempts });
if (isFailure(processed)) {
	if (processed.error.retryable) return retry({ delay: processed.error.delay });
	return acknowledge(processed.error.message);
}
```

### Handle replies, likes and follows

The package does the protocol's work first (stores followers, sends the `Accept`, checks
ownership and that the activity concerns local content), then calls the handler.

```typescript
federation.on(["Create", "Update", "Like", "Announce"], async (ctx) => {
	let summary = ctx.summary(); // a reply, mention, like or repost of local content
	if (summary) await responses.save(summary);
});

federation.on("Follow", async (ctx) => (isWelcome(ctx.actor) ? "accept" : "reject"));
```

### Publish an activity

```typescript
import { PUBLIC } from "@sdxc/activitypub";

await federation.publish({
	id: "https://example.com/articles/hello#create",
	type: "Create",
	actor: actor.id,
	to: [PUBLIC],
	cc: ["https://example.com/actor/followers"],
	object: article,
});
```

`publish` queues a fan-out: one delivery per distinct inbox (`sharedInbox ?? inbox`) of the
followers and every other addressed actor, each signed when sent.

## API

### `Federation`

The runtime of one local actor. It holds no state beyond its options and handlers, so build one
per request or per job wherever the stores are at hand.

#### `new Federation(options: Federation.Options)`

- `actor`: the local `ActivityPub.Actor`. Its `id`, `inbox`, `endpoints.sharedInbox`, `outbox`,
  `followers` and `following` are the URLs `fetch` answers; `manuallyApprovesFollowers` makes a
  Follow `pending` by default.
- `keys`: the actor's `ActorKeys`, or a `KeyProvider` for an app hosting several actors.
- `stores`: `{ followers, seen, objects }`, a `FollowerStore`, `SeenActivities` and `LocalObjects`.
- `cache`: an `@sdxc/cache` `Cache` for remote documents and per-origin delivery state.
- `userAgent`: sent on every outbound request.
- `queue`: `{ enqueue(message), enqueueMany?(messages) }`, each answering a `Result` or nothing.
- `blocked`: `(host) => boolean | Promise<boolean>`; a blocked server can neither deliver,
  follow nor receive.
- `outbox`: `(cursor) => Promise<Result<OutboxPage, Error>>`, pages of `{ items, next, totalItems? }`;
  without it the outbox is empty.
- `authorizedFetch`: `true` requires a signed GET for the collections and `respond`.
- `inbox`: `{ maxBytes?, maxAge? }`, default `102400` and `"1 hour"`.
- `resolver`: `{ signed?, ttl?, timeout?, maxBytes? }`; GETs are signed unless `signed: false`.
- `delivery`: `{ timeout?, pageSize? }`, default `"15 seconds"` and 100.
- `collections`: `{ pageSize? }`, default 50 followers per page.
- `backoff`: the retry schedule, default `DELIVERY_BACKOFF`.
- `seenTtl`: how long a processed activity id is remembered, default `"1 day"`.
- `now`: the clock, for tests.

#### `federation.on(type, handler): Federation`

Registers a handler for `Follow`, `Undo`, `Create`, `Update`, `Delete`, `Like` (also Pleroma's
`EmojiReact`), `Announce`, `Accept`, `Reject` or `Move`, or a list of them; a later registration
replaces an earlier one. A handler answers nothing or a `Result`, and a failure or exception
retries the message, so handlers must be idempotent. A `Follow` handler may answer `"accept"`,
`"reject"` or `"pending"`.

The handler receives a `Federation.Context`: `activity`, `actor` (fetched from its own origin),
`origin`, `verification`, `object`, `target` (the local object or actor it concerns),
`receivedAt` and `summary()`. A `Delete` handler receives a `Federation.DeleteContext`, whose
`actor` is `null` when the account is gone and whose `deleted` is `{ kind: "object" | "actor", id }`.

`summary()` answers a reply, mention, like or repost of local content as a `Summary`
(`kind`, `id`, `url`, `target`, `author`, sanitized `content`, `published`), the shape a
Webmention is stored in, and `null` for anything else.

#### `federation.fetch(request: Request): Promise<Response | null>`

Answers the actor document, an inbox or shared-inbox `POST`, the outbox, followers and
following collections (paged with `?page=true&cursor=…`), and `405` for other methods on them;
`null` for any other URL. A failing store or queue answers `503`. A refused inbox `POST` answers
its `InboxError` status: `415`, `413`, `400`, `403` for a blocked host, or `401` for a missing,
stale or invalid signature, so the sender retries with its other signature scheme.

#### `federation.respond(request, document, options?): Promise<Response | null>`

`null` when the request prefers HTML; otherwise the document as ActivityStreams with
`Vary: Accept`, an `ETag` and a public 5-minute cache. A `Tombstone` answers `410`. `options`
takes `cache` (an [`@sdxc/http`](https://www.npmjs.com/package/@sdxc/http) `policy()` input),
`headers` and `status`.

#### `federation.verify(request: Request): Promise<Result<VerifiedFetch, InboxError>>`

Verifies the signature on a GET, for documents the app serves itself under authorized fetch. A
refusal answers itself through `error.toResponse()`.

#### `federation.process(message, options?): Promise<Result<Federation.Outcome, FederationError>>`

Runs one queued message and answers what happened: `{ kind: "inbox", status, type, reason }`,
`{ kind: "fanOut", inboxes, skipped }` or `{ kind: "deliver", status, scheme }`. Pass the job's
`attempts` (from 1) so `FederationError.delay` follows the backoff; a non-retryable failure has
`delay` `0`. An inbox answering `410` drops every follower behind it.

#### `federation.publish(activity): Promise<Result<void, ActivityPubError>>`

Queues the fan-out of an activity by the local actor, given as a document or JSON text. Fails
`too-large` past `MAX_ACTIVITY_BYTES`, or with a retryable `enqueue` error.

#### `federation.approve(follower)` / `federation.reject(follower)`

Answer `Promise<Result<void, ActivityPubError>>`. `approve` stores a pending follower as
`accepted` and queues an `Accept`; `reject` queues a `Reject` and removes the follower. Both are
safe to retry and fail `not-found` for an actor that does not follow the local actor.

#### `federation.lookup(handle: string): Promise<Result<ActivityPub.Actor, ActivityPubFetchError>>`

Resolves `@user@host`, `user@host` or `acct:user@host` through WebFinger to its actor.

#### `federation.resolver`

The `RemoteResolver` the federation fetches with, sharing its cache and keys.

#### `Federation.MESSAGE`

The Standard Schema of `Federation.Message`, for declaring the one job that carries every
message.

### `ActorKeys`

The RSA keys (RSASSA-PKCS1-v1_5, 2048-bit, SHA-256) a local actor signs with.

- `ActorKeys.generate()`: a new `{ privateKeyPem, publicKeyPem }` pair, PKCS#8 and SPKI.
- `ActorKeys.import({ actor, privateKeyPem })`: the keys from a PKCS#8 private key alone. A
  PKCS#1 key (`BEGIN RSA PRIVATE KEY`) converts with `openssl pkcs8 -topk8 -nocrypt`.
- `new ActorKeys({ actor, rsa, ed25519? })`: keys already imported into Web Crypto.
- `keys.id` (`<actor>#main-key`), `keys.actor`, `keys.publicKey` (the actor document's
  `publicKey` member), `keys.rsa` and `keys.ed25519`.

### `RemoteResolver`

Fetches remote documents through [`@sdxc/outbound`](https://www.npmjs.com/package/@sdxc/outbound)
and the cache, accepting a document only when its `id` has the origin it was served from.

#### `new RemoteResolver(options: ResolverOptions)`

- `cache`, `userAgent`: as for `Federation`.
- `signer`: `{ actor, keys }` to sign every GET; omit for unsigned fetches.
- `ttl`: `{ actor?, object? }`, default `"1 day"` and `"1 hour"`.
- `timeout`, `maxBytes`: default `"10 seconds"` and 1 MB.

`actor(iri)`, `object(iri)`, `document(iri)` (the decoded JSON) and `key(keyId)` (the key and the
actor that publishes it) each take `{ fresh: true }` to skip the cache, and fail with an
`ActivityPubFetchError`. `evict(iri)` forgets a cached document. `Resolver` is the interface it
implements.

### `CacheSeenActivities`

A `SeenActivities` over any `@sdxc/cache` `Cache`, keyed `activitypub:seen:<id>`, with a TTL of at
least 60 seconds.

### Vocabulary

#### `parseActivity`, `parseActor`, `parseObject`, `parseCollection`

`(json: unknown) => Result<T, ActivityPubParseError>` for an activity, an actor, any object, or
any collection or collection page. Each normalizes the variants servers send (single values or
arrays, IRIs or embedded objects, language maps, quote properties), and every member of the
result is present, with `null`, `[]`, `{}` or `false` when the sender left it out.

#### `stringify(document: ActivityPub.Draft<ActivityPub.Document>): string`

The document as JSON with the `@context` it needs, omitting empty members and `bto`/`bcc`, and
dates as ISO 8601.

#### `tombstone({ id, formerType?, deleted? }): ActivityPub.Tombstone`

The document a deleted object is served as.

#### `wantsActivity(request: Request): boolean`

`true` when the request prefers ActivityStreams over HTML; a wildcard or missing `Accept` reads
as HTML.

#### `orderedCollection`, `orderedCollectionPage`, `collection`, `collectionPage`

Build collection documents. A collection with `totalItems` and no items publishes a count alone.

#### `actorLink(actorId: string): JrdLink`

The WebFinger `self` link typed `application/activity+json` that resolves a handle to the actor.

#### Constants

`PUBLIC`, `ACTIVITY_JSON`, `LD_JSON`, `LD_JSON_ACTIVITY`, `ACTIVITY_CONTENT_TYPE`,
`ACTIVITY_ACCEPT`, `AS2_CONTEXT`, `SECURITY_CONTEXT`, `DATA_INTEGRITY_CONTEXT`,
`MULTIKEY_CONTEXT`, `EXTENSION_CONTEXT`, `ACTIVITY_TYPES` and `ACTOR_TYPES`.
`MAX_ACTIVITY_BYTES` is `122880`. `DELIVERY_BACKOFF` is an
[`@sdxc/backoff`](https://www.npmjs.com/package/@sdxc/backoff) schedule of five retries over about
21 hours.

### Errors

Every error extends `ActivityPubError`, with a `code` and a `retryable` flag.

- `ActivityPubParseError`: `invalid-document`, with `kind` and `issues` as `{ at, message }`.
- `ActivityPubFetchError`: a remote document that could not be used, with `url` and `status`;
  codes `gone`, `not-found`, `unauthorized`, `http`, `refused-url`, `too-large`, `timeout`,
  `network`, `invalid-document` and `id-mismatch`.
- `InboxError`: a refused request, with `status` and `toResponse()`.
- `DeliveryError`: a delivery that did not land, with `inbox`, `status` and `retryAfter`.
- `FederationError`: how `process` fails, with `kind`, `delay` in milliseconds, and the error
  underneath as `cause`.

### Storage

The app implements these over its own database:

- `FollowerStore`: `put`, `get`, `remove`, `removeInbox`, and `list`, `count` and `inboxes`
  over accepted followers. `put` inserts or replaces by `(actor, id)`; listings page through
  `StorePage<T>` with the store's own cursor.
- `SeenActivities`: `claim(id, ttl)` answers `true` the first time an id is claimed within `ttl`.
- `LocalObjects`: `find(id)` answers the object the app serves under `id`, or `null`.
- `KeyProvider`: `keysOf(actor)` answers a hosted actor's `ActorKeys`, or `null`.

### `@sdxc/activitypub/testing`

- `MemoryFollowerStore`, `MemorySeenActivities` (`{ now? }`), `MemoryLocalObjects` and
  `MemoryKeyProvider`: in-memory stores.
- `followerStoreConformance`, `seenActivitiesConformance`, `localObjectsConformance` and
  `keyProviderConformance`: Vitest suites holding the app's own stores to the contracts the
  package relies on.

### Types

`ActivityPub` holds the vocabulary (`Object`, `Activity`, `Actor`, `Collection`, `Tombstone`,
`Ref<T>` and the rest); `ActivityPub.Draft<T>` is the shape an app authors, with only `id` and
`type` required. `Federation` carries `Options`, `Stores`, `Queue`, `OutboxPage`, `Message`,
`Context`, `DeleteContext`, `HandledType`, `Outcome`, `ProcessOptions` and `RespondOptions`.
Also exported: `Follower`, `StorePage`, `Summary`, `SummaryAuthor`, `FollowDecision`,
`HandleReason`, `BlockedCheck`, `Verification`, `VerifiedFetch`, `ResolverOptions`,
`ResolverSigner`, `ResolverTtl`, `ResolveOptions`, `ResolvedKey`, `CollectionInit`, `PageInit`,
`CollectionItem`, `TombstoneInit`, and the `ActivityPubFetchErrorCode`, `InboxErrorCode` and
`DeliveryErrorCode` unions.

## Pattern: One Job With `@sdxc/jobs`

With [`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs), one job declared with
`Federation.MESSAGE` carries every message, and its handler builds the federation from the job's
context.

```typescript
import { Federation } from "@sdxc/activitypub";
import { createJobHandler, job, jobs } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

export let definitions = jobs({ federation: job({ input: Federation.MESSAGE }) });

export function federationFor(stores: Federation.Stores): Federation {
	return new Federation({
		actor,
		keys,
		stores,
		cache,
		userAgent: "example.com/1.0 (+https://example.com)",
		queue: {
			enqueue: (message) => dispatcher.enqueue(definitions.federation, message),
			enqueueMany: (messages) => dispatcher.enqueueMany(definitions.federation, messages),
		},
	}).on(["Create", "Like", "Announce"], (ctx) => saveResponse(ctx.summary()));
}

export default createJobHandler(definitions.federation, async (ctx) => {
	let processed = await federationFor(storesOf(ctx)).process(ctx.input, { attempts: ctx.attempts });
	if (isFailure(processed)) {
		if (processed.error.retryable) return ctx.retry({ delay: processed.error.delay });
		return ctx.ack(processed.error.message);
	}
});
```

## Pattern: Serve A Post As HTML Or ActivityStreams

One URL serves both representations; a deleted post is served as a tombstone, which answers
`410` so remote servers drop their copy.

```typescript
import type { ActivityPub } from "@sdxc/activitypub";

import { PUBLIC, stringify, tombstone } from "@sdxc/activitypub";

let post = await posts.find(slug);
if (post.deletedAt) {
	let gone = await federation.respond(
		request,
		tombstone({ id: post.url, formerType: "Article", deleted: post.deletedAt }),
	);
	return gone ?? new Response("Gone", { status: 410 });
}

let article = {
	id: post.url,
	type: "Article",
	attributedTo: ["https://example.com/actor"],
	to: [PUBLIC],
	cc: ["https://example.com/actor/followers"],
	name: post.title,
	content: post.html,
	published: post.publishedAt,
} satisfies ActivityPub.Draft<ActivityPub.Object>;

let activity = await federation.respond(request, article);
if (activity) return activity; // the client asked for ActivityStreams
return renderPage(post); // the HTML, with <link rel="alternate" type="application/activity+json">
```

The `alternate` link lets a Mastodon user paste the page URL into search and find the post.
`stringify(article)` gives the same JSON for storage or a static file.

## Pattern: WebFinger And Handle Lookup

Mastodon resolves `@hello@example.com` through WebFinger, then checks the reverse direction, so
the app answers WebFinger with `actorLink`. `lookup` does the same resolution for remote handles.

```typescript
import { actorLink } from "@sdxc/activitypub";
import { isFailure } from "@sdxc/result";

if (url.pathname === "/.well-known/webfinger") {
	if (url.searchParams.get("resource") !== "acct:hello@example.com") {
		return new Response(null, { status: 404 });
	}
	return Response.json(
		{
			subject: "acct:hello@example.com",
			aliases: ["https://example.com/actor"],
			links: [actorLink("https://example.com/actor")],
		},
		{ headers: { "content-type": "application/jrd+json" } },
	);
}

let remote = await federation.lookup("@someone@mastodon.social");
if (isFailure(remote)) return Response.json({ error: remote.error.code }, { status: 404 });
return Response.json({ id: remote.data.id, name: remote.data.preferredUsername });
```

## Pattern: Approve Followers By Hand

With `manuallyApprovesFollowers` on the actor, every Follow is stored `pending` unless the
handler decides; a pending follower is outside the followers collection and every fan-out until
approved.

```typescript
federation.on("Follow", async (ctx) => {
	await notifications.add({ kind: "follow-request", from: ctx.actor.id });
	return ctx.actor.movedTo ? "reject" : null; // null keeps the default: pending
});

// Later, from the app's own UI:
let approved = await federation.approve("https://mastodon.social/users/alice");
let rejected = await federation.reject("https://spam.example.com/users/bot");
```

## Pattern: An Outbox And A Replies Collection

The `outbox` option pages the actor's outbox from the app's own posts; the collection builders
serve any other collection, such as a post's replies.

```typescript
import { orderedCollection, orderedCollectionPage } from "@sdxc/activitypub";
import { success } from "@sdxc/result";

let federation = new Federation({
	// ...actor, keys, stores, cache, userAgent, queue
	outbox: async (cursor) => {
		let page = await posts.page({ after: cursor, limit: 20 });
		return success({
			items: page.items.map((post) => `${post.url}#create`),
			next: page.next,
			totalItems: page.total,
		});
	},
});

let replies = `${post.url}/replies`;
let document = url.searchParams.has("page")
	? orderedCollectionPage({ id: url.href, partOf: replies, orderedItems: replyIds, next: null })
	: orderedCollection({ id: replies, totalItems: replyIds.length, first: `${replies}?page=true` });
return (await federation.respond(request, document)) ?? new Response(null, { status: 406 });
```

## Pattern: Read Remote Documents Without A Federation

`RemoteResolver` works alone, for an app that only reads the fediverse, and `parse*` reads
documents it got elsewhere.

```typescript
import { parseObject, RemoteResolver } from "@sdxc/activitypub";
import { MemoryCache } from "@sdxc/cache/memory";
import { isFailure } from "@sdxc/result";

let resolver = new RemoteResolver({
	cache: new MemoryCache(),
	userAgent: "example.com/1.0 (+https://example.com)",
});

let actor = await resolver.actor("https://mastodon.social/users/someone");
if (isFailure(actor) && actor.error.code === "gone") await profiles.remove(actor.error.url);

let note = await resolver.object("https://mastodon.social/@someone/1", { fresh: true }); // skips the cache

let parsed = parseObject(JSON.parse(stored));
if (isFailure(parsed)) return Response.json(parsed.error.issues, { status: 422 }); // [{ at, message }]
```

## Pattern: Test Against In-Memory Stores And Hold Real Ones To The Contract

```typescript
import { Federation } from "@sdxc/activitypub";
import {
	followerStoreConformance,
	MemoryFollowerStore,
	MemoryLocalObjects,
	MemorySeenActivities,
	seenActivitiesConformance,
} from "@sdxc/activitypub/testing";
import { MemoryCache } from "@sdxc/cache/memory";

let federation = new Federation({
	actor,
	keys,
	stores: {
		followers: new MemoryFollowerStore(),
		seen: new MemorySeenActivities(),
		objects: new MemoryLocalObjects([article]),
	},
	cache: new MemoryCache(),
	userAgent: "test",
	queue: { enqueue: async (message) => void queued.push(message) },
});

followerStoreConformance({ name: "SqlFollowerStore", create: () => new SqlFollowerStore(db) });
seenActivitiesConformance({ name: "KvSeenActivities", create: () => new KvSeenActivities(kv) });
```

`localObjectsConformance` also takes the `served` ids, `keyProviderConformance` the `hosted`
actors, and `seenActivitiesConformance` an optional `advance(ms)` that moves the store's clock.

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
