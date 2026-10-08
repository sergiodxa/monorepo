# ADR-111: ActivityPub Package

## Status

**Proposed** - 2026-10-06

## Background

`apps/blog` takes part in the IndieWeb today. It publishes a WebFinger document and RSS, Atom
and JSON feeds, and it sends and receives Webmentions. Fediverse readers only reach it through
a bridge. Someone on Mastodon cannot follow `@hello@sergiodxa.com`, so a reply from Mastodon
reaches a post only when Bridgy backfeeds it, and a new article reaches Misskey, Pixelfed or
Threads only when a person shares the link.

Federating takes more than one feature. It needs an actor document, a signed inbox, a
followers list, fan-out delivery with retries, two HTTP signature schemes and the digest
headers they cover, remote documents fetched safely, NodeInfo, content negotiation of existing
pages, and a long tail of behavior that Mastodon expects but no specification states. Most of
the building blocks are already in `packages/*`. This ADR decides how the rest is shaped so the
blog can federate, and so the next app that wants to can do it without writing the protocol
again.

## Context

### What exists today

| Piece                                                                         | What it gives ActivityPub                                                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `@sdxc/well-known/webfinger` (ADR-083)                                        | JRD `parse`/`stringify`, `readQuery`, `select` by `rel`, and CORS through `respond`                                            |
| `apps/blog/app/http/controllers/well-known.ts`                                | Answers `acct:hello@sergiodxa.com`. Its `self` link is `text/html`, and Mastodon expects `self` to point at the actor document |
| `@sdxc/outbound` (ADR-108)                                                    | `checkUrl`, `follow` (every hop checked, one deadline), and `readBytes`/`readText` with a byte cap for a `Request` too         |
| `@sdxc/structured-fields`                                                     | RFC 9651 parse/stringify, which is the grammar of `Signature-Input`, `Signature`, `Accept-Signature` and `Content-Digest`      |
| `@sdxc/crypto`                                                                | Hashes, HMAC, `timingSafeEqual`, `Base64`/`Base64Url`. It has no RSA, no Ed25519 and no PEM                                    |
| `@sdxc/jwt`                                                                   | Generates and serializes key pairs through `jose`, for JWS only                                                                |
| `@sdxc/http/negotiate`                                                        | `accepts(request).preferred(...)`, which drops media-type parameters, so `application/ld+json; profile=…` reads as its type    |
| `@sdxc/http/cache`                                                            | `policy`, `etag` and `conditional`                                                                                             |
| `@sdxc/pagination`                                                            | Keyset cursors and `Link` headers                                                                                              |
| `@sdxc/jobs`, `@sdxc/backoff` (ADR-106)                                       | Declared jobs on Cloudflare Queues, and retry schedules that plug into `ctx.retry({ delay })`                                  |
| `@sdxc/cache`                                                                 | A `Result`-returning cache with memory and Workers KV adapters                                                                 |
| `@sdxc/html`                                                                  | `HTML.sanitize(html, { baseUrl })`, which `@sdxc/webmention` already uses on remote content                                    |
| `@sdxc/spam`                                                                  | Scores a `Submission` (`content`, `format`, `author`)                                                                          |
| `@sdxc/webmention`                                                            | A `Mention` summary (`kind`, `url`, `author`, sanitized `content`, `published`). The blog stores it in `webmentions`           |
| `apps/blog` `webmentions` / `webmention_domains` tables, `webmentions.*` jobs | Moderated responses under each post, a policy per source host, and the job wiring that delivery reuses                         |
| `apps/blog/app/http/controllers/post.tsx`                                     | Already chooses HTML or Markdown from the extension and `Accept`, and answers with `Vary: Accept`                              |

### What federation requires

| Requirement                                                      | Source                                                  | Covered by an existing piece?                           |
| ---------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| AS2 vocabulary read from untrusted JSON, written with `@context` | ActivityStreams 2.0 Core and Vocabulary                 | No                                                      |
| Actor with `publicKey`, `inbox`, `endpoints.sharedInbox`         | ActivityPub §4.1, Mastodon                              | No                                                      |
| WebFinger `self` → actor, and the reverse check                  | Mastodon's account resolution                           | The document format, yes. The actor link and lookup, no |
| NodeInfo 2.x discovery and document                              | NodeInfo protocol                                       | No (ADR-083 left it out)                                |
| draft-cavage-12 signatures with `Digest` on every POST           | Mastodon, Misskey, Pleroma, GoToSocial                  | No                                                      |
| RFC 9421 signatures with `Content-Digest`                        | Mastodon verifies them from 4.5 and signs them from 4.7 | The structured-field grammar only                       |
| Signed GETs (authorized fetch)                                   | Mastodon secure mode, GoToSocial (always on)            | No                                                      |
| Fetch remote actors and objects without SSRF, and cache them     | Inbox verification, reply authors                       | `outbound` + `cache`                                    |
| Inbox: verify, authorize, deduplicate, dispatch                  | ActivityPub §7                                          | No                                                      |
| Followers kept, Accept sent, Undo and 410 honored                | ActivityPub §7.5, Mastodon                              | No                                                      |
| Fan-out to shared inboxes with retries                           | ActivityPub §7.1.3, Mastodon                            | `jobs` + `backoff` for the mechanics                    |
| `OrderedCollection` and `OrderedCollectionPage`                  | ActivityPub §5                                          | `pagination` for cursors                                |
| Object integrity proofs                                          | FEP-8b32 (optional)                                     | No                                                      |

### Constraints

| Constraint                                                                | Consequence for the design                                                                                         |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Cloudflare Workers: CPU-time limits, bundle size, no Node `crypto`        | Web Crypto for RSA and Ed25519. No full JSON-LD processor (see below)                                              |
| Each app owns its data (D1 for the blog, Durable Object SQLite elsewhere) | The package defines narrow interfaces and the app implements them. The package ships no schema, table or migration |
| `@sdxc/result` everywhere, untrusted input through `remix/data-schema`    | Every inbound document goes through a schema before the package reads it. Every fallible step answers a `Result`   |
| Format capabilities get their own package                                 | HTTP signatures and digest fields are their own packages, because neither is specific to ActivityPub               |
| Queue messages are at most 128 KB                                         | A delivery message carries one serialized activity plus its inbox, which bounds the size of an activity            |
| A sender relies on `401` to fall back from RFC 9421 to cavage             | Signatures are verified in the request, never in a job                                                             |

## Decision

Add `@sdxc/activitypub`. It holds **protocol logic only**: the vocabulary, actor and collection
documents, discovery, receiving and authorizing activities, dispatching them, planning and
performing deliveries, and fetching remote documents safely. Every piece of state the protocol
needs is declared as a narrow interface, which the app implements with whatever it already uses
(D1, Durable Object SQLite, KV). An in-memory implementation and a conformance suite ship for
tests.

Two format packages and two additions land next to it:

| Package                     | New or changed    | Holds                                                                                                      |
| --------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `@sdxc/activitypub`         | New               | Everything ActivityPub-specific                                                                            |
| `@sdxc/http-signatures`     | New               | draft-cavage-12 and RFC 9421 signing and verification of a `Request`, plus parse/stringify of their fields |
| `@sdxc/digest-fields`       | New               | RFC 9530 `Content-Digest`/`Repr-Digest` and the RFC 3230 `Digest` header that cavage signatures cover      |
| `@sdxc/well-known/nodeinfo` | New subpath       | The `/.well-known/nodeinfo` links document and the NodeInfo 2.0/2.1 document, read and written             |
| `@sdxc/crypto`              | Addition          | `Pem` (SPKI/PKCS#8 armor), next to `Base64`, and later `Base58` for Multikey                               |
| `@sdxc/jcs`                 | New, Phase 6 only | RFC 8785 JSON Canonicalization, which the `eddsa-jcs-2022` cryptosuite of FEP-8b32 signs                   |

### The runtime: one `Federation` per local actor

Everything that needs wiring goes through one class. The app constructs a `Federation` with
the local actor, its keys, its stores, the cache and a queue, routes requests through
`fetch`, hands every queued message to `process`, and registers what it does with a reply, a
like or a follow through `on`:

```typescript
import { ActorKeys, Federation } from "@sdxc/activitypub";

let federation = new Federation({
	actor: SITE_ACTOR, // its ids (id, inbox, outbox, followers, following) name the routes `fetch` answers
	keys: unwrap(await ActorKeys.import({ actor: ACTOR_ID, privateKeyPem })), // or a KeyProvider
	stores: { followers, seen, objects }, // FollowerStore, SeenActivities, LocalObjects
	cache,
	userAgent: USER_AGENT,
	blocked: (host) => Moderation.isBlocked(db, host),
	queue: { enqueue: (message) => …, enqueueMany: (messages) => … },
	outbox: (cursor) => …, // optional pages for the outbox collection
});

federation.on("Create", async (ctx) => saveResponse(ctx.summary()));
federation.on(["Like", "Announce"], async (ctx) => saveResponse(ctx.summary()));
federation.on("Follow", async (ctx) => "accept"); // or "reject" | "pending"

await federation.fetch(request); // Response | null: actor, inbox POST, outbox, followers, following
await federation.respond(request, article); // Response | null: null when HTML wins
await federation.process(message, { attempts }); // Result<Outcome, FederationError>
await federation.publish(activity); // queues the fan-out
await federation.lookup("@someone@mastodon.social");
federation.resolver; // a RemoteResolver
Federation.MESSAGE; // Standard Schema of every queued message
```

One runtime class keeps the protocol's wiring in one place. The options are given once and
every step reads the same actor, keys, stores and cache, so an inbox, a fan-out and a delivery
cannot disagree about who is federating. Every queued step is one message union under one
job, so an app declares a single job and a single retry policy, with the delay already worked
out for it. One `fetch` answers every URL the actor document names, so the routes follow the
document instead of being listed twice.

| Export                                                                                 | What it is                                                                                     |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Federation`                                                                           | The runtime: `fetch`, `respond`, `verify`, `on`, `process`, `publish`, `lookup`, `resolver`    |
| `ActorKeys`                                                                            | `ActorKeys.generate()`, `ActorKeys.import()`, `keys.id`, `keys.publicKey`                      |
| `RemoteResolver`                                                                       | Fetching actors, keys and objects, signed when asked, cached; usable on its own                |
| `parseActivity`/`parseActor`/`parseObject`/`parseCollection`, `stringify`, `tombstone` | The vocabulary, as plain functions                                                             |
| `orderedCollection`, `orderedCollectionPage`, `collection`, `collectionPage`           | Collection builders                                                                            |
| `actorLink`, `wantsActivity`, `PUBLIC` and the other constants, `DELIVERY_BACKOFF`     | Pure helpers                                                                                   |
| Errors                                                                                 | `ActivityPubError` and its subclasses, `InboxError`, `DeliveryError`, `FederationError`        |
| `@sdxc/activitypub/testing`                                                            | In-memory `FollowerStore`, `SeenActivities`, `LocalObjects`, `KeyProvider`, conformance suites |
| `@sdxc/activitypub/proofs`                                                             | FEP-8b32 `createProof`/`verifyProof` (Phase 6)                                                 |

Receiving, processing, fan-out, delivery, summaries and origin availability are internal
modules behind `Federation`.

### Storage: interfaces the app implements

The package never touches a database. It defines four interfaces and calls them, and it ships
no tables, migrations, `remix/data-table` adapters or `*_SCHEMA_SQL` constants. An app that
already keeps moderated responses, posts and secrets stores federation state next to them, in
its own shape and its own migrations.

```typescript
import type { Result } from "@sdxc/result";

/** Someone who follows a local actor, as the package needs to deliver to them and answer Undo. */
export interface Follower {
	/** The local actor being followed. */
	actor: string;
	/** The remote actor's id. */
	id: string;
	inbox: string;
	/** Preferred for delivery, so one POST reaches every follower on that server. */
	sharedInbox: string | null;
	/** The Follow's id: an Accept echoes it and an Undo must name it. */
	followId: string;
	/** `pending` while a local actor that approves followers by hand has not decided. */
	state: "accepted" | "pending";
}

/** A page of a store listing, with an opaque cursor the store chose. */
export interface StorePage<T> {
	items: T[];
	next: string | null;
}

/** The followers of local actors. Every write is idempotent, so redelivered activities are harmless. */
export interface FollowerStore {
	/** Inserts or replaces by `(actor, id)`, so a repeated Follow refreshes inbox and `followId`. */
	put(follower: Follower): Promise<Result<void, Error>>;
	get(actor: string, id: string): Promise<Result<Follower | null, Error>>;
	remove(actor: string, id: string): Promise<Result<void, Error>>;
	/** Drops every follower reached through this inbox or shared inbox, after it answered 410. */
	removeInbox(inbox: string): Promise<Result<void, Error>>;
	/** Accepted followers, for the collection; `origin` narrows to one server (FEP-8fcf). */
	list(
		actor: string,
		options: { cursor: string | null; limit: number; origin?: string },
	): Promise<Result<StorePage<Follower>, Error>>;
	count(actor: string): Promise<Result<number, Error>>;
	/** Distinct delivery targets of accepted followers, `sharedInbox ?? inbox`, one per URL. */
	inboxes(
		actor: string,
		options: { cursor: string | null; limit: number },
	): Promise<Result<StorePage<string>, Error>>;
}

/**
 * Activity ids already processed. Claiming is best effort, because every handler is
 * idempotent: this saves work on a redelivery and is never what makes processing correct.
 */
export interface SeenActivities {
	/** `true` the first time an id is claimed within `ttl`. */
	claim(id: string, ttl: number): Promise<Result<boolean, Error>>;
}

/** The app's own objects, so the inbox can tell a reply, Like or Announce of local content from noise. */
export interface LocalObjects {
	/** The public object this app serves under `id`, or `null` when it serves none. */
	find(id: string): Promise<Result<ActivityPub.Object | null, Error>>;
}

/** The signing keys of local actors. */
export interface KeyProvider {
	/** `null` for an actor this app does not host. */
	keysOf(actor: string): Promise<Result<ActorKeys | null, Error>>;
}
```

`StorePage.next` is the store's own cursor, so a D1 implementation can encode it with
`@sdxc/pagination`'s `encodeCursor`, and a KV implementation can pass through KV's own
cursor. `inboxes` is its own method because removing duplicate targets is a query
(`select distinct coalesce(shared_inbox, inbox)`), which a store can do in one statement and
fan-out cannot do over pages of `list`.

Remote documents, the signature scheme each server accepted, and which servers are failing
are kept in a `Cache` from `@sdxc/cache`, which the app already constructs over KV. Losing any
of them costs one extra fetch or one extra knock, never correctness.

### Vocabulary and JSON-LD

The package reads and writes ActivityStreams 2.0 as JSON whose terms are compacted against a
fixed set of known contexts. It does not use a JSON-LD processor.

- **Every implementation the blog must reach treats AS2 as JSON.** Mastodon, Misskey,
  Pixelfed, GoToSocial and Threads read and write compacted AS2 terms. AS2 Core lets a
  consumer process `application/activity+json` as plain JSON and assume the normative context
  applies. Even Fedify, which bundles a processor, serializes without one by default and keeps
  full compaction as an opt-in.
- **A processor would fetch remote contexts.** Expanding a document means dereferencing every
  `@context` IRI it names. That is an outbound request whose URL the sender picks, made during
  inbox verification. It has latency, an SSRF surface, and a cache to pre-seed.
- **The one feature that needs canonical RDF is not adopted.** Linked Data Signatures
  (`RsaSignature2017`) need URDNA2015 canonicalization. Mastodon's own documentation advises
  against implementing them, and FEP-8b32's `eddsa-jcs-2022` cryptosuite canonicalizes with
  JCS, which is plain JSON.
- **Workers cost.** `jsonld.js` and its context documents would add to every cold start of the
  inbox path, and to CPU time on each inbound activity.

What the package does instead, in `lib/compact.ts`:

| Variation seen on the wire                                                    | Read as                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `@context` as a string, an array, or with embedded term maps                  | Ignored for reading. Only known terms are read                      |
| `as:Public`, `Public`, `https://www.w3.org/ns/activitystreams#Public`         | `PUBLIC`                                                            |
| A single value or an array (`to`, `cc`, `tag`, `attachment`, `type`)          | Always an array in the API                                          |
| An IRI or an embedded object (`actor`, `attributedTo`, `object`, `inReplyTo`) | See `Ref` below                                                     |
| `content` and `contentMap`, `name`/`nameMap`, `summary`/`summaryMap`          | Both kept: the plain value and a language map                       |
| `url` as a string, a `Link`, or an array of `Link`s                           | `url`: the first `text/html` href, else the first href              |
| `toot:`/`schema:`/`misskey:` extension terms Mastodon and Misskey emit        | Named fields (`discoverable`, `featured`, `PropertyValue`, `quote`) |
| `quote`, `quoteUrl`, `_misskey_quote`                                         | `quote`: wire names stay inside the module                          |

`stringify` writes one fixed `@context`: the AS2 context, `https://w3id.org/security/v1`,
`https://w3id.org/security/data-integrity/v1` when a proof is present, and an embedded map for
the `toot`, `schema` and `as:` extension terms in the shape Mastodon emits. It omits `null`,
empty arrays and `bto`/`bcc` (ActivityPub §6 strips them before delivery), and writes dates as
ISO 8601.

```typescript
import type { ActivityPub } from "@sdxc/activitypub";

import { PUBLIC, parseActivity, stringify } from "@sdxc/activitypub";

let parsed = parseActivity(json); // Result<ActivityPub.Activity, ActivityPubParseError>

let note = {
	id: "https://sergiodxa.com/articles/remix-v3",
	type: "Article",
	attributedTo: [ACTOR_ID],
	to: [PUBLIC],
	cc: [FOLLOWERS_ID],
	name: "Remix v3",
	summary: "What changed and why.",
	content: html,
	url: "https://sergiodxa.com/articles/remix-v3",
	published: new Date("2026-10-01T12:00:00Z"),
	tag: [{ type: "Hashtag", name: "#remix", href: "https://sergiodxa.com/tags/remix" }],
} satisfies ActivityPub.Object;

stringify(note); // JSON text with @context, ready to serve or deliver
```

The `ActivityPub` namespace holds types only:

```typescript
export namespace ActivityPub {
	/** An IRI or the object it names; which one arrives is the sender's choice. */
	export type Ref<T> = string | T;

	export interface Object {
		id: string;
		type: string;
		attributedTo: string[];
		to: string[];
		cc: string[];
		name: string | null;
		summary: string | null;
		content: string | null;
		contentMap: Record<string, string>;
		url: string | null;
		inReplyTo: string | null;
		quote: string | null;
		published: Date | null;
		updated: Date | null;
		/** Mastodon reads `summary` on a sensitive Note as a content warning. */
		sensitive: boolean;
		tag: Tag[];
		attachment: Attachment[];
	}

	export interface Activity extends Object {
		type: ActivityType;
		/** Always an IRI. An embedded actor is never trusted over the actor's own document. */
		actor: string;
		object: Ref<Object | Activity> | null;
		target: string | null;
	}

	export interface Actor extends Object {
		type: "Person" | "Service" | "Application" | "Group" | "Organization";
		preferredUsername: string;
		inbox: string;
		outbox: string | null;
		followers: string | null;
		following: string | null;
		featured: string | null;
		endpoints: { sharedInbox: string | null };
		publicKey: PublicKey | null;
		/** FEP-521a Multikey entries; carries the Ed25519 key FEP-8b32 proofs name. */
		assertionMethod: Multikey[];
		alsoKnownAs: string[];
		movedTo: string | null;
		manuallyApprovesFollowers: boolean;
		discoverable: boolean;
		indexable: boolean;
		icon: Image | null;
		image: Image | null;
	}

	export interface PublicKey {
		id: string;
		owner: string;
		publicKeyPem: string;
	}

	// ActivityType, Tag, Attachment, Image, PropertyValue, Multikey, Tombstone,
	// OrderedCollection, OrderedCollectionPage, Collection, Proof
}
```

**References are reduced to IRIs unless the package needs the embedded object.**
`attributedTo` and `actor` are always IRIs. `Activity.object` keeps an embedded object,
because Create carries its Note, and Accept and Undo carry the Follow they answer. An embedded
object is trusted only when its `id` has the same origin as the activity's actor. Any other
embedded object is treated as its IRI and fetched from its own origin (the same-origin rule of
FEP-c7d3).

Each `parse*` validates through `remix/data-schema` and answers `ActivityPubParseError` with
JSON-pointer issues, the same shape `WellKnownParseError` uses. Unknown types parse as
`ActivityPub.Object` with their `type` kept, so an app can ignore them on purpose.

### Actor documents and keys

An actor is an `ActivityPub.Actor` literal that `federation.fetch` serves at its id, with the
`publicKey` member filled from its keys:

```typescript
import { ActorKeys } from "@sdxc/activitypub";

let generated = await ActorKeys.generate();
// Result<{ privateKeyPem: string; publicKeyPem: string }, CryptoError>, run once and stored as a secret

let keys = await ActorKeys.import({ actor: ACTOR_ID, privateKeyPem: env.ACTIVITYPUB_PRIVATE_KEY });
// Result<ActorKeys, CryptoError>; the public half is derived from the private key's JWK

keys.data.publicKey; // { id: `${ACTOR_ID}#main-key`, owner: ACTOR_ID, publicKeyPem }
keys.data.id; // `${ACTOR_ID}#main-key`, the keyId every signature names
```

```typescript
export class ActorKeys {
	readonly actor: string;
	readonly rsa: { id: string; privateKey: CryptoKey; publicKeyPem: string };
	/** Present once FEP-8b32 proofs are enabled. */
	readonly ed25519: { id: string; privateKey: CryptoKey; publicKeyMultibase: string } | null;
}
```

- RSA keys are RSASSA-PKCS1-v1_5 2048-bit with SHA-256 through Web Crypto, which is what
  Mastodon generates and verifies. PEM armor comes from the new `Pem` in `@sdxc/crypto`.
- The key id is `#main-key` on the actor, which is where Mastodon looks.
- Rotating a key is an `Update` of the actor delivered to every follower. Receivers that
  cached the old key refetch on the first failed verification.

### Discovery: WebFinger and NodeInfo

`@sdxc/well-known/webfinger` already writes the document, and the app adds one link from
`@sdxc/activitypub`:

```typescript
import { actorLink } from "@sdxc/activitypub";

actorLink(ACTOR_ID); // { rel: "self", type: "application/activity+json", href: ACTOR_ID, … }

await federation.lookup("acct:someone@mastodon.social");
// Result<ActivityPub.Actor, ActivityPubFetchError>: WebFinger over `outbound`, the `self` link, then the actor
```

Mastodon resolves a handle by WebFinger, fetches the actor, and then checks the reverse
direction: `preferredUsername@host` from the actor must resolve back to the same id. The blog's
actor therefore has `preferredUsername: "hello"` to match `acct:hello@sergiodxa.com`.

NodeInfo is a well-known document, so it goes into `@sdxc/well-known` as `./nodeinfo`, with the
`WellKnownFormat` shape and `respond` that the other documents use:

```typescript
import { nodeInfo, nodeInfoLinks } from "@sdxc/well-known/nodeinfo";
import { respond } from "@sdxc/well-known/response";

respond(nodeInfoLinks, { links: [{ rel: NODEINFO_2_1, href: `${ORIGIN}/nodeinfo/2.1` }] });
respond(nodeInfo, {
	version: "2.1",
	software: { name: "sergiodxa", version: BUILD, repository: null, homepage: ORIGIN },
	protocols: ["activitypub"],
	services: { inbound: [], outbound: ["atom1.0", "rss2.0"] },
	openRegistrations: false,
	usage: { users: { total: 1, activeMonth: 1, activeHalfyear: 1 }, localPosts },
	metadata: {},
});
```

It reads 2.0 and 2.1 and writes 2.1. NodeInfo is camelCase on the wire already.

### Serving documents and content negotiation

```typescript
let response = await federation.respond(ctx.request, article);
if (response) return response; // null when HTML wins
```

- `respond` asks `wantsActivity`, which asks `accepts(request).preferred("text/html", "application/activity+json",
"application/ld+json")` and answers `true` only when an AS2 type wins. `*/*` resolves to
  HTML, so browsers and crawlers are unaffected.
- `respond` writes `Content-Type: application/activity+json; charset=utf-8`, an `ETag`, a
  `Cache-Control` from `@sdxc/http/cache` (public, 5 minutes by default), `Vary: Accept`, and a
  `304` through `conditional`. The actor and its collections are served the same way by
  `fetch`. A `Tombstone` answers `410`, which is how a
  remote server learns a post was deleted when it refetches.
- HTML pages that have an AS2 representation add `<link rel="alternate"
type="application/activity+json" href="…">`. Mastodon follows that link when someone pastes
  the page URL into its search box.

### Fetching remote documents

```typescript
import { RemoteResolver } from "@sdxc/activitypub";

let resolver = new RemoteResolver({
	cache, // @sdxc/cache, a WorkerKVCache in production
	signer: { actor: ACTOR_ID, keys }, // ActorKeys or a KeyProvider; signs GETs, omit for unsigned fetches
	userAgent: USER_AGENT,
	ttl: { actor: "1 day", object: "1 hour" },
});

await resolver.actor("https://mastodon.social/users/someone"); // Result<ActivityPub.Actor, ActivityPubFetchError>
await resolver.key("https://mastodon.social/users/someone#main-key"); // Result<{ owner, publicKey: CryptoKey }, …>
await resolver.object(iri, { fresh: true }); // bypasses the cache
```

`federation.resolver` is one built from the federation's cache and keys, signing every GET
unless the federation's `resolver.signed` option is `false`.

- Requests go through `@sdxc/outbound`'s `follow` with a 10-second deadline, then `readText`
  with a 1 MB cap, and `Accept: application/activity+json, application/ld+json;
profile="https://www.w3.org/ns/activitystreams"`. Every hop passes `checkUrl`, so a remote
  actor whose inbox or key points at `169.254.169.254` is refused, not fetched.
- A document is accepted only when its `id` equals the URL it was fetched from, or has the
  same origin as the final URL after redirects. A `keyId` resolves to the actor that owns it,
  either the key document itself or the actor with the fragment, and the key's `owner` must
  name that actor.
- With a `signer`, every GET is signed. This is authorized fetch, which secure-mode Mastodon
  servers and every GoToSocial server require before they answer for an actor.
- A `410` or a `Tombstone` answers `ActivityPubFetchError { code: "gone" }` and evicts the
  cache entry.

### Receiving

The inbox verifies synchronously, inside `federation.fetch`, and processes in a job.

```typescript
let response = await federation.fetch(ctx.request);
// inbox POST: verified, then `queue.enqueue({ kind: "inbox", … })` and 202,
// or the refusal's status; 503 when the queue fails
```

An inbox POST runs these steps in order and stops at the first failure:

| Step                                                                                              | Failure (`InboxError.code`)            | Status |
| ------------------------------------------------------------------------------------------------- | -------------------------------------- | ------ |
| `Content-Type` is `application/activity+json` or `application/ld+json`                            | `unsupported-media-type`               | 415    |
| Body read with `readBytes` and `maxBytes`                                                         | `too-large`                            | 413    |
| JSON parses, and `parseActivity` accepts it                                                       | `invalid-activity`                     | 400    |
| The host of the `keyId` and of `actor` passes `blocked`, checked before any fetch                 | `blocked`                              | 403    |
| A signature is present: `Signature-Input` (RFC 9421) or `Signature` (cavage)                      | `unsigned`                             | 401    |
| The body matches `Content-Digest` or `Digest`, and the signature covers that header               | `digest-mismatch`                      | 401    |
| `created` or `Date` is within `maxAge`, with 5 minutes of allowed clock skew                      | `stale-signature`                      | 401    |
| Signature verifies with the resolved key. A failure refetches the key once, to allow for rotation | `invalid-signature`, `key-unavailable` | 401    |
| The key's owner is `activity.actor`                                                               | `actor-mismatch`                       | 401    |
| A `Delete` of an actor whose key now answers `410`                                                | `ignored`                              | 202    |

`actor-mismatch` has two ways out before it fails, because Mastodon forwards replies to a
thread's participants under the forwarder's signature (ActivityPub §7.1.2). First, a valid
FEP-8b32 proof by `activity.actor` is accepted (Phase 6). Second, when the activity's `id` has
the actor's origin, the activity is fetched from that origin and the fetched copy is used.
Either way, `Received.verification` records which path succeeded: `"signature"`, `"proof"` or
`"refetched"`.

The `ignored` row exists because a deleted Mastodon account sends `Delete` to every server it
ever talked to. Its key is already gone, so the delete cannot be verified. Answering `202`
stops the retries, and the job drops it.

`authorizedFetch: true` runs the signature half of the same checks on every GET that `fetch`
and `respond` answer, and `federation.verify(request)` runs it for documents the app serves
on its own. The actor document and its key answer unsigned, because a remote server must be
able to read the key that verifies its own signed fetch. The blog serves public content and
leaves this off.

### Processing

```typescript
federation.on(["Create", "Update", "Like", "Announce"], async (ctx) => saveResponse(ctx.summary()));
federation.on("Follow", async (ctx) => "accept");

let processed = await federation.process(ctx.input, { attempts: ctx.attempts });
if (isFailure(processed)) {
	if (processed.error.retryable)
		return ctx.retry({ delay: processed.error.delay, cause: processed.error });
	return ctx.ack(processed.error.message);
}
```

An inbox message claims the activity id in `SeenActivities`, is re-parsed through
`parseActivity`, and is dispatched. The work the protocol itself requires happens before the
app's handler is called:

| Activity                  | Package does                                                                                                                                                                                            | App handler                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `Follow` of a local actor | Rejects if blocked. Otherwise puts the follower (`pending` when `manuallyApprovesFollowers`) and sends `Accept` with the Follow embedded to the follower's own inbox. A repeated Follow re-sends Accept | `"Follow"`, which may answer `"accept" \| "reject" \| "pending"` |
| `Undo` of `Follow`        | Removes the follower when `followId` matches or the Follow's actor is the sender                                                                                                                        | `"Undo"`                                                         |
| `Create`, `Update`        | Requires `attributedTo` to include `actor` and the object's id to have the actor's origin. Ignores objects that neither reply to, quote, nor tag a `LocalObjects` entry or local actor                  | `"Create"`, `"Update"`                                           |
| `Update` of the actor     | Evicts the resolver's cache entry, and refreshes the follower's `inbox`/`sharedInbox` when one is stored                                                                                                | `"Update"`                                                       |
| `Delete` of an object     | Requires the actor to be the author, or a refetch that answers `404`/`410`/`Tombstone`                                                                                                                  | `"Delete"`                                                       |
| `Delete` of the actor     | Removes the follower records for every local actor and evicts the cache                                                                                                                                 | `"Delete"`                                                       |
| `Like`, `Announce`        | Ignores objects that are not in `LocalObjects`                                                                                                                                                          | `"Like"`, `"Announce"`                                           |
| `Undo` of anything else   | Requires the undone activity's actor to be the sender                                                                                                                                                   | `"Undo"`                                                         |
| `Accept`, `Reject`        | Requires the embedded or referenced Follow to have been sent by a local actor                                                                                                                           | `"Accept"`, `"Reject"`                                           |
| `Move`                    | Fetches the target fresh. It must list the mover in `alsoKnownAs`, and the mover must name it in `movedTo`                                                                                              | `"Move"`                                                         |
| Anything else             | Logged with `currentLog()` and acknowledged                                                                                                                                                             | none                                                             |

Each handler receives a `Federation.Context`: `{ activity, actor: ActivityPub.Actor, origin,
verification, object, target, receivedAt }` plus `summary()`, which turns a reply, Like or
Announce into the shape the blog already stores for a Webmention:

```typescript
ctx.summary();
// {
//   kind: "reply" | "like" | "repost" | "mention",
//   id, url, target,                     // the remote object, its HTML url, the local object it answers
//   author: { id, handle: "@someone@mastodon.social", name, url, photo },
//   content: { html, text } | null,      // HTML.sanitize'd against the object's id
//   published,
// }
```

A handler answers nothing or a `Result`; a failure or an exception fails the message as
retryable. Accept and Reject replies are queued as delivery messages by `process` itself.

Misskey sends emoji reactions as a `Like` with `content`, and Pleroma sends an `EmojiReact`.
Both read as `like`.

### Collections

`federation.fetch` serves the actor's collections: `followers` answers `totalItems` from
`FollowerStore.count` and pages of follower ids from `FollowerStore.list` under
`?page=true&cursor=…`, `following` answers an empty collection, and `outbox` answers the pages
the app's `outbox(cursor)` option returns. The builders stay exported for any other
collection, such as an object's `replies`:

```typescript
import { orderedCollection, orderedCollectionPage } from "@sdxc/activitypub";

orderedCollection({ id: REPLIES_ID, totalItems: count, first: `${REPLIES_ID}?page=true` });
orderedCollectionPage({ id: pageUrl, partOf: REPLIES_ID, orderedItems: replies, next });
```

Pages come from whatever the app pages with. The blog's outbox is a keyset page of posts from
`Pagination.byKeyset`, each rendered as its `Create`.

### Delivery

Inbox processing, fan-out and delivery are three kinds of one message, `Federation.MESSAGE`, a
Standard Schema of the union told apart by `kind`. The app declares one job with it in its own
job map. The package does not depend on `@sdxc/jobs`; the `queue` option is the whole
interface it needs.

```typescript
export default jobs({ federation: job({ input: Federation.MESSAGE }) });
// { kind: "inbox", activity, actor, signer, keyId, origin, verification, receivedAt }
// | { kind: "fanOut", actor, activity: string }
// | { kind: "deliver", actor, activity: string, inbox }
```

**Fan-out** works out the recipients and enqueues one delivery per distinct inbox:

```typescript
await federation.publish(create); // Result<void, ActivityPubError>: queues { kind: "fanOut", … }
await federation.process(message); // fanOut → Result<{ kind: "fanOut", inboxes, skipped }, FederationError>
```

- Addressing decides the recipients. The actor's `followers` collection in `to`/`cc`/`bto`/
  `bcc` pages through `FollowerStore.inboxes`. Every other IRI except `PUBLIC` is resolved to
  its actor's `sharedInbox ?? inbox`. The union is deduplicated as URLs, so one server with 400
  followers gets one POST.
- Inboxes on blocked hosts are skipped. So are origins that delivery marked unavailable: any
  origin whose failures have lasted longer than 7 days, as Mastodon does, until an inbound
  activity verifies from it.
- An activity whose serialization is over 120 KB fails `publish` with `too-large`, because it
  would not fit a queue message. The blog keeps a long Article under that size by sending its summary and
  link as `content` (see quirks).
- A retried fan-out may enqueue some deliveries twice. Receivers deduplicate by activity id,
  which Mastodon does too.

**Deliver** signs and POSTs one activity to one inbox:

```typescript
let sent = await federation.process(message, { attempts: ctx.attempts }); // a deliver message
if (isFailure(sent)) {
	// `gone` already removed every follower behind the inbox
	if (sent.error.retryable) return ctx.retry({ delay: sent.error.delay, cause: sent.error });
	return ctx.ack(sent.error.message);
}
```

- The inbox URL passes `checkUrl`. The POST is sent once with `redirect: "manual"`, as
  `outbound` requires for a request with a body.
- **Double-knocking.** The first attempt to an origin is signed with RFC 9421
  (`Content-Digest`, covering `@method`, `@target-uri`, `content-digest`, `content-type` and
  `date`). A `401`, `403` or `400` is retried immediately with draft-cavage (`Digest`, covering
  `(request-target)`, `host`, `date`, `digest` and `content-type`). The scheme that worked is
  kept in the cache for 30 days, so an origin pays for the second knock about once a month. A
  `401` carrying `Accept-Signature` (RFC 9421 §5) is honored once, with the components it asks
  for.
- Outcomes:

| Response                           | `DeliveryError.code`  | `retryable`                       |
| ---------------------------------- | --------------------- | --------------------------------- |
| 2xx                                | (success)             |                                   |
| `410`                              | `gone`                | No. `process` drops that inbox    |
| `401`/`403` after every scheme     | `unauthorized`        | No                                |
| `429`                              | `rate-limited`        | Yes, `delay` covers `Retry-After` |
| other 4xx                          | `rejected`            | No                                |
| 5xx                                | `server`              | Yes                               |
| deadline passed / `fetch` rejected | `timeout` / `network` | Yes                               |
| `checkUrl` refused                 | `refused-url`         | No                                |

- `DELIVERY_BACKOFF` is `createBackoff({ steps: ["5 minutes", "30 minutes", "2 hours", "6
hours", "12 hours"], jitter: 0.2 })`. That covers about 21 hours within the 5 retries of the
  blog's queue consumer. An app with more retries passes its own schedule.

### `@sdxc/http-signatures`

Both signature schemes are formats with their own fields and their own consumers outside
ActivityPub, such as signed webhooks and Web Bot Auth. So they live in their own package, named
for the format:

```typescript
import { sign, verify } from "@sdxc/http-signatures";

let signed = await sign(request, {
	scheme: "rfc9421", // or "draft-cavage"
	key: { id: keyId, privateKey, algorithm: "rsa-v1_5-sha256" },
	body, // Uint8Array; adds Content-Digest (rfc9421) or Digest (cavage) and covers it
});
// Result<Request, HttpSignatureError>

let verified = await verify(request, {
	body,
	key: (keyId, algorithm) => resolveKey(keyId), // Result<CryptoKey | null, Error>
	maxAge: "1 hour",
});
// Result<{ scheme, keyId, label: string | null, created: Date, components: string[] }, HttpSignatureError>
```

- `verify` enforces one minimum coverage for both schemes: method and target, host or
  authority, a time (`date` or `created`), and the body digest when there is a body. A
  signature that covers less fails with `insufficient-coverage`.
- RFC 9421 uses `rsa-v1_5-sha256`, `rsa-pss-sha512`, `ecdsa-p256-sha256` and `ed25519`. For
  cavage, `algorithm="hs2019"` is read from the key's type, and `rsa-sha256` is accepted.
- `parseSignatureInput`/`stringifySignatureInput`, `parseSignature`/`stringifySignature` and
  `parseAcceptSignature`/`stringifyAcceptSignature` are exported separately, through
  `@sdxc/structured-fields`. The cavage `Signature` header gets its own parser.
- Dependencies: `@sdxc/result`, `@sdxc/structured-fields`, `@sdxc/digest-fields`,
  `@sdxc/crypto`, `@sdxc/duration`.

### `@sdxc/digest-fields`

```typescript
import { digest, parse, stringify, verify } from "@sdxc/digest-fields";

stringify({ "sha-256": bytes }, "content-digest"); // success: "sha-256=:…:"
stringify({ "SHA-256": bytes }, "digest"); // success: "SHA-256=…" (RFC 3230)
await verify(request.headers, body, { field: "content-digest" }); // Result<void, DigestError>
```

It covers `Content-Digest`, `Repr-Digest`, `Want-Content-Digest`, `Want-Repr-Digest` and the
legacy `Digest`, with `sha-256` and `sha-512`.

### Object integrity proofs (optional)

`@sdxc/activitypub/proofs` signs and verifies FEP-8b32 `DataIntegrityProof`s with the
`eddsa-jcs-2022` cryptosuite. The key is the actor's Ed25519 key, published as a FEP-521a
`Multikey` in `assertionMethod`. Mastodon ignores proofs, so they are added to outgoing
activities alongside HTTP signatures. They are worth having because the inbox can then accept
a forwarded activity without a refetch. This needs `@sdxc/jcs` and a `Base58` in
`@sdxc/crypto`, so it is Phase 6.

### Moderation

- The `blocked(host)` option is one callback that the inbox, Follow processing (Follow →
  Reject) and fan-out all call, so a blocked server cannot deliver, follow, or receive.
- Spam scoring and holding content for review stay in the app's handler: `ctx.summary()`
  maps directly to `filter.check({ content: html, format: "html", author: { name, url } })`.
- Per-origin rate limiting on the inbox uses the app's own rate-limit binding.
- When an app blocks a domain, it removes that domain's followers from its own store, because it
  owns the store.

### Mastodon and implementation quirks the package absorbs

| Quirk                                                                                                    | Handled by                                                       |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Every inbox POST must be signed and cover `digest`. Mastodon before 4.5 rejects RFC 9421                 | Delivery double-knocking, with the scheme cached per origin      |
| `Date` must be IMF-fixdate and within Mastodon's window                                                  | `sign` writes `toUTCString()` at delivery time, never at enqueue |
| WebFinger `self` with `type: application/activity+json`, and a reverse check of `preferredUsername@host` | `actorLink`, and the actor document                              |
| `publicKey.id` is `<actor>#main-key`, with `owner`                                                       | `ActorKeys#publicKey`, served by `federation.fetch`              |
| `Accept` should embed the Follow, since some servers match on the embedded object                        | `process`                                                        |
| A repeated Follow means the sender never saw the Accept                                                  | `process` re-sends it                                            |
| A Note's `summary` is a content warning. An `Article` is shown as name, summary and link                 | The app's object mapping, documented in the README               |
| Visibility comes from `to`/`cc`: public is `to: [Public]`, `cc: [followers]`                             | `PUBLIC`, README                                                 |
| A pasted HTML URL is resolved through `<link rel="alternate" type="application/activity+json">`          | `federation.respond` docs and the blog layout                    |
| A deleted account sends unverifiable `Delete`s to everyone                                               | The inbox answers `202` (`ignored`)                              |
| Secure mode and GoToSocial reject unsigned GETs                                                          | `RemoteResolver`, which signs GETs                               |
| `as:Public`/`Public`/full IRI. Single values or arrays. `contentMap` without `content`                   | `lib/compact.ts`                                                 |
| Misskey quotes via `_misskey_quote`/`quoteUrl`, Mastodon 4.5 via `quote`                                 | `quote`                                                          |
| Misskey reactions as `Like` + `content`, Pleroma `EmojiReact`                                            | `ctx.summary()`                                                  |
| Requests without a `User-Agent` are refused by some instances                                            | `userAgent` is required on `Federation` and `RemoteResolver`     |
| Profile-link verification needs `rel="me"` back from the linked page to the actor's `url`                | README, and the blog's existing `rel="me"` links                 |

### Dependencies

`@sdxc/activitypub` depends on `@sdxc/result`, `@sdxc/validate`, `remix` (`data-schema`),
`@sdxc/outbound`, `@sdxc/http-signatures`, `@sdxc/digest-fields`, `@sdxc/well-known`,
`@sdxc/http`, `@sdxc/cache`, `@sdxc/crypto`, `@sdxc/html`, `@sdxc/backoff`, `@sdxc/duration`
and `@sdxc/logger`. It does not depend on `@sdxc/jobs`, `@sdxc/pagination`, `@sdxc/spam`,
`remix/data-table` or any Cloudflare binding. `vitest` is an optional peer for `./testing`.

## Usage Examples

### `apps/blog`: identity

Actor id `https://sergiodxa.com/activitypub/actor`, a `Person` with
`preferredUsername: "hello"`, `url` the home page, and `inbox` and `endpoints.sharedInbox` both
`/activitypub/inbox`, because there is one actor. `outbox`, `followers` and `following` are
under `/activitypub/` (`following` is always empty), and `manuallyApprovesFollowers` is false.
The private key is a secrets-store binding, `ACTIVITYPUB_PRIVATE_KEY`.

```typescript
link("self", ACTOR_ID, "application/activity+json"),
```

is added to the JRD in `well-known.ts`, and `/` negotiates to the actor document.

### `apps/blog`: posts as objects

A post's AS2 id is its canonical URL. `post.tsx` already negotiates on `Accept`, so it gains one
branch:

```typescript
let document = post.deleted_at ? tombstone(post) : FederatedPost.article(post);
let activity = await federation.respond(ctx.request, document);
if (activity) return activity;
```

The `Create` id is `<post url>#create`. An edit sends `Update` with `#update-<updated_at>`, and
a deletion sends `Delete` of a `Tombstone`. The `webmentions.send` job that already runs on
create, update and delete also calls `federation.publish`, and the scheduled job covers
posts whose publish date arrives.

### `apps/blog`: replies as comments

The blog's `Create`, `Like`, `Announce`, `Undo` and `Delete` handlers store
`ctx.summary()` in the existing `webmentions` table. `source` is the remote object id and
`kind` is `reply`, `like` or `repost`. The existing `webmention_domains` policy decides
`pending` or `approved`, and `@sdxc/spam` scores replies. One moderation queue and one list of
responses under each post cover both protocols. `Undo` and `Delete` mark the row `deleted`.

### `apps/blog`: storage

The blog adds `0006_ActivityPubFollowers.sql` with its own `activitypub_followers` table, and
`app/repositories/follower.ts` implements `FollowerStore` against it with single-statement
upserts and deletes (D1-safe). `SeenActivities` is a KV-backed class over `CACHE`. `LocalObjects`
reads posts. The repositories run the `@sdxc/activitypub/testing` conformance suites in their tests.

## Consequences

### Positive

- **The blog becomes followable** from Mastodon, Misskey, Pixelfed, GoToSocial and Threads,
  and replies arrive without a bridge.
- **The app keeps its data.** Followers sit in the blog's D1 next to its posts, migrated by its
  own chain, and a Durable Object app keeps them in its own SQLite. The package never needs a
  schema migration.
- **One moderation surface.** ActivityPub responses reuse the blog's Webmention table, host
  policy and spam filter.
- **Reusable formats.** `@sdxc/http-signatures` and `@sdxc/digest-fields` serve any signed-HTTP
  integration, and NodeInfo joins the other well-known documents.
- **SSRF-safe by construction.** Every remote fetch, including inbox URLs taken from remote
  actor documents, goes through `@sdxc/outbound`.
- **Testable.** The memory implementations, MSW for remote servers, and the conformance suite
  for the app's own stores.

### Negative

- **Large surface.** Three new packages and a new subpath, all of which have to stay correct
  against implementations that change without notice. The quirks table will grow.
- **No JSON-LD processing.** A document that defines its own context and aliases AS2 terms
  under other names is read only as far as known terms go. No production implementation does
  this today.
- **Each app writes four small adapters**, where a package-owned schema would have needed none.
- **Signatures verified in the request** put a remote key fetch on the inbox's latency path the
  first time a server is seen.
- **Queue-size bound.** An activity must serialize under 120 KB.
- **Content negotiation and the edge cache.** Post pages already vary on `Accept` for
  Markdown. AS2 adds a third variant that the blog's `@sdxc/workers-cache` must key separately.

### Neutral

- Linked Data Signatures (`RsaSignature2017`) are neither produced nor verified. Forwarded
  activities are verified by refetching them, or by FEP-8b32 proofs.
- Following remote accounts (an outbound Follow and a following store) is supported by the
  vocabulary and `accept`/`reject` handlers, but no interface for it ships until an app follows
  someone.

## Implementation Plan

### Phase 1: Format packages

**Priority:** High
**Estimated Effort:** 1.5 days

1. `@sdxc/digest-fields`: parse, stringify, digest and verify, with RFC 9530 test vectors.
2. `@sdxc/crypto`: `Pem`.
3. `@sdxc/http-signatures`: sign and verify both schemes, and the field parsers. Use the
   RFC 9421 Appendix B vectors, the draft-cavage-12 examples, and a request captured from
   Mastodon.

### Phase 2: Vocabulary, keys, discovery

**Priority:** High
**Estimated Effort:** 1.5 days

1. `@sdxc/activitypub`: types, `parse*` over fixtures captured from Mastodon, Misskey,
   Pixelfed, GoToSocial and Threads, `stringify`, and `lib/compact.ts`.
2. `./keys`, `./discovery`, `./response`, `./collections`.
3. `@sdxc/well-known/nodeinfo`.

### Phase 3: Remote documents and inbox

**Priority:** High
**Estimated Effort:** 2 days

1. `./remote` over `outbound` and `cache`, tested with MSW.
2. `./inbox` `receive`, `handle` and `summarize`, plus the store interfaces, `./memory` and
   `./conformance`.

### Phase 4: Delivery

**Priority:** High
**Estimated Effort:** 1 day

1. `./outbox` `fanOut`, `deliver`, double-knocking, unavailable origins, `DELIVERY_BACKOFF` and
   the job input schemas.
2. README with the quirks table, then the package docs per `docs/guides/package-documentation.md`.

### Phase 5: `apps/blog`

**Priority:** High
**Estimated Effort:** 2 days

1. Migration and `FollowerStore` repository, `SeenActivities` over KV, `LocalObjects` over
   posts, and the conformance suite in the blog's tests.
2. Routes: actor, inbox, outbox, followers, following, NodeInfo, and the WebFinger `self`
   link.
3. `post.tsx` negotiation with the `alternate` link, the jobs, and handlers into `webmentions`.
4. Generate the key, set the secret, then build, migrate and deploy. Follow from a Mastodon
   account and a Misskey account and verify replies, likes and boosts end to end.

### Phase 6: Object integrity proofs (optional)

**Priority:** Low
**Estimated Effort:** 1 day

1. `@sdxc/jcs` and `Base58` in `@sdxc/crypto`.
2. `./proofs`, the Ed25519 key in `ActorKeys` and `assertionMethod`, and proof verification
   in `receive`.

### Phase 7: Followers synchronization (optional)

**Priority:** Low
**Estimated Effort:** 0.5 day

1. Send the FEP-8fcf `Collection-Synchronization` header on deliveries, using
   `FollowerStore.list({ origin })`, so Mastodon reconciles stale follows.

## Alternatives Considered

### 1. Depend on Fedify

Fedify is a complete, well-tested ActivityPub framework. It does double-knocking, fan-out
queues, idempotent inbox processing, FEP-8b32, and has a Cloudflare Workers adapter.

**Rejected because**: it brings its own router, its own KV and message-queue abstractions, its
own logging, and a JSON-LD processor. Those sit parallel to `remix/fetch-router`,
`@sdxc/jobs`, `@sdxc/cache` and `@sdxc/logger`, and it throws where the repo answers
`Result`. Several of its designs are adopted here: double-knocking with a per-server memory,
fan-out as its own queued step, deduplication by activity id, and collections built from
app callbacks with an origin filter for FEP-8fcf.

### 2. Package-owned schema, tables and migrations

Ship `remix/data-table` tables, `*_SCHEMA_SQL` and `DataTableStore` adapters for followers, the
inbox, the outbox and keys, the way `@sdxc/idempotency` does.

**Rejected because**: federation state belongs with the app's own data. The blog already keeps
moderated responses, posts and secrets in its own shape. A package table would duplicate the
outbox it can derive from posts, and the responses it already stores as Webmentions. Every
schema change would have to land in every consuming app's migration chain at once. A Durable
Object app would need a second adapter. The package needs only four narrow interfaces, which
the app can implement in a few queries and check with the conformance suite.

### 3. A full JSON-LD processor

Expand every inbound document and compact every outbound one with `jsonld.js`.

**Rejected because**: it fetches sender-chosen context URLs during verification, it costs
bundle size and CPU on every inbox request, and no implementation the blog federates with needs
it. Its main reason to exist, Linked Data Signatures, is not adopted.

### 4. Everything in one package

Put HTTP signatures and digests inside `@sdxc/activitypub`.

**Rejected because**: both are general HTTP formats with other consumers, and a format reader
or writer that only one consumer can reach has nowhere to grow. The repo gives a format its own
package with both halves.

### 5. Verify signatures in the job

Enqueue the raw request and verify in the background, to keep the inbox fast.

**Rejected because**: a sender learns that it must fall back from RFC 9421 to cavage only from
a synchronous `401`, and a `202` for a forged activity misreports what happened. Keys are
cached, so the latency cost is paid once per remote server.

### 6. Delivery jobs that carry an id, not the activity

Enqueue `{ activityId, inbox }` and render the activity again at delivery time, with no size
bound.

**Rejected because**: an `Accept` or a `Delete` cannot always be rendered again once the
follower or the post is gone. A Create rendered after an edit would differ from what other
inboxes received, and the app would need a fifth interface. A size bound is a smaller cost, and
it matches how Mastodon displays Articles.

### 7. Keep federating through Bridgy Fed

**Rejected because**: followers belong to the bridge's actor and domain rather than the
blog's, replies come back as a second-hand Webmention, and the blog cannot sign, moderate, or
move its own identity.

## References

- [ActivityPub (W3C Recommendation)](https://www.w3.org/TR/activitypub/)
- [Activity Streams 2.0 Core](https://www.w3.org/TR/activitystreams-core/) and [Vocabulary](https://www.w3.org/TR/activitystreams-vocabulary/)
- [RFC 9421 - HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421)
- [draft-cavage-http-signatures-12](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures-12)
- [RFC 9530 - Digest Fields](https://www.rfc-editor.org/rfc/rfc9530) and [RFC 3230 - Instance Digests in HTTP](https://www.rfc-editor.org/rfc/rfc3230)
- [RFC 8785 - JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [RFC 7033 - WebFinger](https://www.rfc-editor.org/rfc/rfc7033)
- [NodeInfo protocol](https://nodeinfo.diaspora.software/protocol)
- [Mastodon: Security (HTTP signatures, secure mode)](https://docs.joinmastodon.org/spec/security/)
- [Mastodon: ActivityPub](https://docs.joinmastodon.org/spec/activitypub/) and [WebFinger](https://docs.joinmastodon.org/spec/webfinger/)
- [FEP-8b32: Object Integrity Proofs](https://codeberg.org/fediverse/fep/src/branch/main/fep/8b32/fep-8b32.md)
- [FEP-521a: Representing actor's public keys](https://codeberg.org/fediverse/fep/src/branch/main/fep/521a/fep-521a.md)
- [FEP-8fcf: Followers collection synchronization](https://codeberg.org/fediverse/fep/src/branch/main/fep/8fcf/fep-8fcf.md)
- [FEP-c7d3: Ownership](https://codeberg.org/fediverse/fep/src/branch/main/fep/c7d3/fep-c7d3.md)
- Fedify manual: [Sending activities](https://fedify.dev/manual/send), [Inbox listeners](https://fedify.dev/manual/inbox), [Collections](https://fedify.dev/manual/collections), [Vocabulary](https://fedify.dev/manual/vocab)
- [ADR-083: Well-Known Package](./ADR-083-well-known-package.md)
- [ADR-094: Webmention Package](./ADR-094-webmention-package.md)
- [ADR-098: Spam Package](./ADR-098-spam-package.md)
- [ADR-106: Backoff Package](./ADR-106-backoff-package.md)
- [ADR-108: Outbound Package](./ADR-108-outbound-package.md)

## Current Progress

- [x] Phase 1: Format packages
- [x] Phase 2: Vocabulary, keys, discovery
- [x] Phase 3: Remote documents and inbox
- [x] Phase 4: Delivery
- [ ] Phase 5: `apps/blog`
- [ ] Phase 6: Object integrity proofs (optional)
- [ ] Phase 7: Followers synchronization (optional)

## Notes

- All three new packages start `private: true` while the surface moves, and go public after
  the blog has federated for a while. `@sdxc/well-known` and `@sdxc/crypto` are already
  public, so their additions publish with them.
- Mastodon caches actor documents for about a day. Changing the blog's actor id after launch
  orphans every follower, so the id is fixed before the first deploy. A later domain change is
  a `Move`, with `movedTo` on the old actor and `alsoKnownAs` on the new one.
- The blog's queue consumer has `max_retries: 5`, which `DELIVERY_BACKOFF` is sized for. If
  the queue's retries are raised for the webmention jobs, the schedule can lengthen.
- Every test that touches a remote server uses MSW. The memory stores carry no logic the
  conformance suite does not also check against the app's own implementation.
- The public API was reshaped at the user's request into the class-based runtime above
  (`Federation`, `ActorKeys`, `RemoteResolver`), with one queue message union and two entry
  points (`.` and `./testing`). The protocol logic, its checks and its tests carried over
  unchanged behind it.
