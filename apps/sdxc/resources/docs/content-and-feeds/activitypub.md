---
title: Federate a site with ActivityPub
description: Publish an actor, answer WebFinger, verify an inbox that handles follows and undos, deliver signed posts to followers from jobs, and test it all in memory.
section:
    title: Content & feeds
    order: 7
order: 7
lastUpdated: 2026-10-08
---

ActivityPub is the protocol Mastodon, Misskey, GoToSocial, Pixelfed and the rest of the
fediverse speak. A site that federates has an actor, an account someone on any of those servers
can search for and follow. Every post the site publishes lands in their timeline, and every
reply, like and boost they send comes back to the site's inbox.

This guide makes a Remix v3 app one such actor. It serves the actor document and WebFinger,
verifies each activity at the inbox, processes follows and undos, delivers signed posts to every
follower from background jobs, and serves each post as HTML to a browser and as an
ActivityStreams `Article` to a server.

[`@sdxc/activitypub`](/api/activitypub) holds the protocol: one `Federation` per actor, the
vocabulary, and in-memory stores for tests. Its signatures come from
[`@sdxc/http-signatures`](/api/http-signatures), [`@sdxc/well-known`](/api/well-known) answers
WebFinger, [`@sdxc/jobs`](/api/jobs) runs every step off the request, and
[`@sdxc/cache`](/api/cache) holds the remote documents the federation fetches.

```bash
npm add remix @sdxc/activitypub @sdxc/jobs @sdxc/cache @sdxc/well-known @sdxc/http \
	@sdxc/result
```

The package keeps no state of its own. Followers, the activities already processed and the
posts you serve live in your database, behind four small interfaces it calls, so the examples
import a few modules from your own `~/app/repositories/*` and `~/app/models/*`.

## Generate the actor's keys

Every activity the site sends is signed with the actor's RSA key, and every server that receives
one fetches the actor document to read the public half. `ActorKeys.generate` makes the pair
Mastodon expects. Run it once, from a script, and store the private key as a secret:

```typescript {% title="scripts/actor-keys.ts" %}
import { ActorKeys } from "@sdxc/activitypub";
import { isFailure } from "@sdxc/result";

let pair = await ActorKeys.generate();
if (isFailure(pair)) process.exitCode = 1;
else process.stdout.write(pair.data.privateKeyPem);
```

```bash
bun scripts/actor-keys.ts | npx wrangler secret put ACTIVITYPUB_PRIVATE_KEY
```

The private key is the only secret: `ActorKeys.import` derives the public half from it. Keep the
key stable, because followers verify against the one they cached, and a new pair means
announcing it to every one of them.

Import it lazily through a `KeyProvider`, so the work happens inside the first request or job
that signs, and once per isolate after that:

```typescript {% title="app/services/actor-keys.ts" %}
import type { KeyProvider } from "@sdxc/activitypub";
import type { Result } from "@sdxc/result";

import { ActorKeys } from "@sdxc/activitypub";
import { isFailure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

import { ACTOR_ID } from "~/app/config/activitypub";

class SiteKeys implements KeyProvider {
	#keys: Promise<Result<ActorKeys, Error>> | null = null;

	async keysOf(actor: string): Promise<Result<ActorKeys | null, Error>> {
		if (actor !== ACTOR_ID) return success(null);

		let privateKeyPem = env.ACTIVITYPUB_PRIVATE_KEY;
		this.#keys ??= ActorKeys.import({ actor: ACTOR_ID, privateKeyPem });
		let keys = await this.#keys;
		if (isFailure(keys)) this.#keys = null;
		return keys;
	}
}

export const SITE_KEYS = new SiteKeys();
```

A failed import is forgotten, so the next call tries again. The key must be PKCS#8
(`BEGIN PRIVATE KEY`), which is what `generate` writes.

## Describe the actor

The actor's URLs are ordinary routes in your app. Name them once, so the routes and the actor
document cannot drift apart:

```typescript {% title="app/config/activitypub.ts" %}
export const ACTOR_ID = "https://example.com/actor";
export const INBOX_ID = "https://example.com/actor/inbox";
export const OUTBOX_ID = "https://example.com/actor/outbox";
export const FOLLOWERS_ID = "https://example.com/actor/followers";
export const FOLLOWING_ID = "https://example.com/actor/following";
export const HANDLE = "acct:hello@example.com";
export const USER_AGENT = "example.com/1.0 (+https://example.com)";
```

```typescript {% title="routes/web.ts" %}
import { get, post, route } from "remix/routes";

export default route({
	posts: { show: get("/posts/:slug") },
	activityPub: {
		actor: get("/actor"),
		inbox: post("/actor/inbox"),
		outbox: get("/actor/outbox"),
		followers: get("/actor/followers"),
		following: get("/actor/following"),
	},
});
```

`parseActor` reads a document into the full `ActivityPub.Actor` shape, filling every member you
leave out with `null`, `[]` or `false`, so the actor is written as the handful of members that
matter:

```typescript {% title="app/services/site-actor.ts" %}
import type { ActivityPub, ActivityPubParseError } from "@sdxc/activitypub";
import type { Result } from "@sdxc/result";

import { parseActor } from "@sdxc/activitypub";

import {
	ACTOR_ID,
	FOLLOWERS_ID,
	FOLLOWING_ID,
	INBOX_ID,
	OUTBOX_ID,
} from "~/app/config/activitypub";

export function siteActor(): Result<ActivityPub.Actor, ActivityPubParseError> {
	return parseActor({
		id: ACTOR_ID,
		type: "Person",
		preferredUsername: "hello",
		name: "Example",
		summary: "<p>Notes and articles from example.com.</p>",
		url: "https://example.com/",
		inbox: INBOX_ID,
		outbox: OUTBOX_ID,
		followers: FOLLOWERS_ID,
		following: FOLLOWING_ID,
		endpoints: { sharedInbox: INBOX_ID },
	});
}
```

`preferredUsername` is the `hello` of `hello@example.com`, the handle people search for.
`publicKey` stays out: the federation fills it from the keys wherever it serves the actor.
`endpoints.sharedInbox` lets a server holding many of your followers deliver one copy for all of
them, and pointing it at the inbox keeps one URL to verify.

## Build the federation

One `Federation` wires the actor, its keys, your stores, the cache and the queue together. It
holds nothing between calls, so build it wherever a database and a job enqueuer are at hand: in
a request with `ctx.db` and `ctx.jobs`, in a job with its database and the dispatcher.

```typescript {% title="app/services/federation.ts" %}
import type { ActivityPubParseError } from "@sdxc/activitypub";
import type { JobEnqueuer } from "@sdxc/jobs";
import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { CacheSeenActivities, Federation } from "@sdxc/activitypub";
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { isFailure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

import { USER_AGENT } from "~/app/config/activitypub";
import jobs from "~/app/jobs";
import { saveResponse, withdrawResponse } from "~/app/models/responses";
import { Followers } from "~/app/repositories/followers";
import { SITE_KEYS } from "~/app/services/actor-keys";
import { FederatedPosts } from "~/app/services/federated-posts";
import { siteActor } from "~/app/services/site-actor";

interface FederationServices {
	db: Database;
	jobs: JobEnqueuer;
}

export function createFederation(
	services: FederationServices,
): Result<Federation, ActivityPubParseError> {
	let actor = siteActor();
	if (isFailure(actor)) return actor;

	let { db } = services;
	let cache = new WorkerKVCache(env.CACHE);
	let federation = new Federation({
		actor: actor.data,
		keys: SITE_KEYS,
		stores: {
			followers: new Followers(db),
			seen: new CacheSeenActivities(cache),
			objects: new FederatedPosts(db),
		},
		cache,
		userAgent: USER_AGENT,
		queue: {
			enqueue: (message) =>
				services.jobs.enqueue(jobs.federation.process, message),
			enqueueMany: (messages) =>
				services.jobs.enqueueMany(jobs.federation.process, messages),
		},
	});

	return success(
		federation
			.on(["Create", "Update", "Like", "Announce"], (inbound) =>
				saveResponse(db, inbound.summary()),
			)
			.on("Undo", (inbound) => withdrawResponse(db, inbound.object?.id ?? null))
			.on("Delete", (inbound) =>
				withdrawResponse(
					db,
					inbound.deleted.kind === "object" ? inbound.deleted.id : null,
				),
			),
	);
}
```

`followers` and `objects` are yours, each a small class over your own tables, and `seen` comes
with the package:

- `Followers` implements `FollowerStore`: `put`, `get`, `remove` and `removeInbox` keyed by
  `(actor, id)`, and `list`, `count` and `inboxes` over accepted followers only.
- `CacheSeenActivities` implements `SeenActivities` over the same `Cache`: `claim(id, ttl)`
  answers `true` the first time an activity id is claimed, which spares a redelivered activity
  a second pass. Claims live under `activitypub:seen:<id>` and are held for at least a minute,
  the shortest expiration Workers KV accepts.
- `FederatedPosts` implements `LocalObjects`: `find(id)` answers the post you serve under `id`,
  which is how the inbox tells a reply to one of your posts from noise. It is built further down.

The cache holds remote actors and objects, the signature scheme each server accepted, and the
servers that keep failing. Any `@sdxc/cache` `Cache` works; a failing one costs a refetch, never
a wrong answer. `userAgent` goes out on every request, since some servers refuse requests
without one.

Pass `blocked: (host) => …` to refuse a server: a blocked host can neither deliver to the
inbox, follow the actor, nor receive its posts. `authorizedFetch: true` requires a signed `GET`
for the collections and for every document `respond` serves, which is the secure mode some
servers run; the actor document always answers unsigned, since that is where a server reads the
key it verifies with.

## Answer the actor's URLs

`federation.fetch` answers every URL the actor document names: the actor itself with
`publicKey` filled in, the inbox, the outbox, and the followers and following collections, each
with an `ETag`, `304` revalidation and a five-minute public cache. Every route maps to the same
action:

```typescript {% title="app/http/controllers/activitypub.ts" %}
import type { JobEnqueuer } from "@sdxc/jobs";
import type { Database } from "remix/data-table";

import { notFound, serviceUnavailable } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { createController } from "remix/router";

import { createFederation } from "~/app/services/federation";
import routes from "~/routes/web";

interface FederateContext {
	request: Request;
	db: Database;
	jobs: JobEnqueuer;
}

async function federate(ctx: FederateContext): Promise<Response> {
	let federation = createFederation(ctx);
	if (isFailure(federation)) return serviceUnavailable({ error: "not federating" });

	let response = await federation.data.fetch(ctx.request);
	return response ?? notFound({ error: "not found" });
}

export default createController(routes.activityPub, {
	actions: {
		actor: federate,
		inbox: federate,
		outbox: federate,
		followers: federate,
		following: federate,
	},
});
```

Map it with `router.map(routes.activityPub, activityPub)`. The followers collection reads
`count` and `list` from your store. The outbox is empty until you pass `outbox: (cursor) => …`,
which answers a page of your `Create` activities as `{ items, next, totalItems }`.

### What the inbox does inside the request

A `POST` to the inbox is verified before it is queued, and the response is the verdict: `202`
once the activity is on the queue, or the status of the check it failed. The checks run in
order and stop at the first failure, so a malformed or blocked delivery costs no fetch:

1. The content type is `application/activity+json` or `application/ld+json` (`415`), and the
   body fits 100 KB (`413`).
2. The body is an activity with an `id`, a `type` and an `actor` (`400`), from a host you have
   not blocked (`403`).
3. The request is signed, with RFC 9421 or draft-cavage, over a digest that matches the body,
   within an hour of now (`401`).
4. The signature verifies with the sender's key, fetched from its actor document and refetched
   once when it fails, so a rotated key still lands (`401`).
5. The key belongs to the activity's actor, or the activity, fetched fresh from its own origin,
   is the same activity by the same actor. That second path is how a reply Mastodon forwards to
   a thread's participants is accepted.

Verifying inside the request is what lets a sender learn from a `401` and retry at once with
the other signature scheme. A `Delete` from an account whose key now answers `410` gets an empty
`202`, since a deleted account's last messages can no longer be verified.

Verify before anything else reads the request: the body is a stream. A server delivering an
activity has no session and no `Origin` header, so if your app runs Remix's
[`cop()`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware), exempt the inbox
path from it: the signature is the stronger claim.

## Answer WebFinger

Someone on Mastodon types `@hello@example.com`. Their server asks
`https://example.com/.well-known/webfinger?resource=acct:hello@example.com` for a `self` link
typed `application/activity+json`, then fetches the actor it points at. `actorLink` writes that
link, and the `wellKnown` middleware from `@sdxc/well-known` answers the path:

```typescript {% title="app/http/middleware/webfinger.ts" %}
import { actorLink } from "@sdxc/activitypub";
import { isFailure } from "@sdxc/result";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { readQuery, select, webFinger } from "@sdxc/well-known/webfinger";

import { ACTOR_ID, HANDLE } from "~/app/config/activitypub";

export const webFingerMiddleware = wellKnown({
	webfinger: serve(webFinger, (ctx) => {
		let query = readQuery(ctx.url);
		if (isFailure(query) || query.data.resource !== HANDLE) return null;

		let jrd = {
			subject: HANDLE,
			aliases: [ACTOR_ID],
			properties: {},
			links: [actorLink(ACTOR_ID)],
		};
		return select(jrd, query.data.rels);
	}),
});
```

Add it to the router's `middleware`. A resource you do not host returns `null`, which falls
through to your router's `404`. Mastodon also checks the reverse direction:
`preferredUsername@<actor host>` must resolve back to the same actor, which holds here because
the handle and the actor share `example.com`.

The same lookup runs the other way through `federation.lookup("@someone@mastodon.social")`,
which resolves a remote handle to its actor, confirming it against the actor's own host, for a
form where someone types a handle to block or to mention.

## Process the queue

Every step the federation queues (an inbox activity, the fan-out of a post, one delivery) is
one message shape, `Federation.MESSAGE`, a schema from `remix/data-schema`. Declare one job for
it, beside the job that publishes a post:

```typescript {% title="app/jobs/index.ts" %}
import { CacheSeenActivities, Federation } from "@sdxc/activitypub";
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

export default jobs({
	federation: {
		process: job({ input: Federation.MESSAGE }),
		publish: job({ input: s.object({ postId: s.string() }) }),
	},
});
```

The handler hands each message back to the federation and maps its answer onto the job's
verbs:

```typescript {% title="app/jobs/federation/process.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/jobs/dispatcher";
import { createFederation } from "~/app/services/federation";

export default createJobHandler(jobs.federation.process, async (ctx) => {
	let federation = createFederation({ db: ctx.database, jobs: dispatcher });
	if (isFailure(federation)) return ctx.exit(federation.error.message);

	let processed = await federation.data.process(ctx.input, {
		attempts: ctx.attempts,
	});
	if (isFailure(processed)) {
		let { delay, retryable } = processed.error;
		if (retryable) return ctx.retry({ delay, cause: processed.error });
		return ctx.ack(processed.error.message);
	}

	ctx.log.set({ activitypub: { step: processed.data.kind } });
});
```

`ctx.attempts` picks the step of the retry schedule, and `delay` is in milliseconds, which
`ctx.retry` takes as it is. The job runs inside the dispatcher, so it enqueues through
`dispatcher` rather than `ctx.jobs`; [Background jobs and
cron](/docs/data-and-background-work/jobs-and-cron) builds both, and the `database()` job
middleware that publishes `ctx.database`.

## Handle follows, undos and replies

An inbox message is processed in two parts: the protocol's work, which the package does, then
your handler for the activity's type. By the time a handler runs, the sender's actor has been
fetched from its own server, and anything the activity embeds from another origin has been
fetched fresh rather than trusted.

One follow, from the remote server's first lookup to the `Accept` it gets back, runs like this:

```mermaid {% alt="An ActivityPub follow: the remote server looks up the WebFinger and actor documents, then posts a signed Follow to the inbox; the site verifies the signature against the sender's key, enqueues the Follow and answers 202; the job stores the follower and enqueues an Accept, which is delivered signed to the remote inbox" %}
sequenceDiagram
    participant Remote as Remote server
    participant Site as Your site
    participant Queue
    participant Job as federation.process
    Remote->>Site: GET /.well-known/webfinger
    Site-->>Remote: self link to /actor
    Remote->>Site: GET /actor
    Site-->>Remote: actor with publicKey
    Remote->>+Site: POST /actor/inbox, signed Follow
    Site->>Remote: fetch the sender's actor
    Remote-->>Site: sender's public key
    Site-)Queue: enqueue the verified Follow
    Site-->>-Remote: 202 Accepted
    Queue->>Job: process the Follow
    Job->>Job: store the follower, run the Follow handler
    Job-)Queue: enqueue the Accept
    Queue->>Job: process the delivery
    Job->>Remote: POST signed Accept to its inbox
```

**Follow.** The package stores the follower and delivers an `Accept` that embeds the `Follow`,
which is how the remote server learns the follow went through. A repeated `Follow` means the
sender never saw the first `Accept`, so it is sent again. Chain a `Follow` handler onto the
federation to decide instead:

```typescript {% title="app/services/federation.ts" %}
federation.on("Follow", (inbound) =>
	inbound.actor.type === "Service" ? "pending" : null,
);
```

`"accept"`, `"reject"` and `"pending"` decide; `null` keeps the default, which is `"accept"`
unless the actor sets `manuallyApprovesFollowers: true`. A pending follower is stored with
`state: "pending"` and left out of the collection and of deliveries until you decide.
`federation.approve` accepts it and queues the `Accept` of its stored `Follow`;
`federation.reject`, for a pending or an accepted follower, queues the `Reject` and forgets it:

```typescript {% title="app/controllers/followers.ts" %}
let federation = createFederation(ctx);
if (isFailure(federation)) return serviceUnavailable({ error: "not federating" });
let decided =
	decision === "approve"
		? await federation.data.approve(followerId)
		: await federation.data.reject(followerId);
if (isFailure(decided) && decided.error.code === "not-found") {
	return notFound({ error: "not a follower" });
}
```

Both are safe to retry, and `not-found` means the actor no longer follows you, for instance
because it sent an `Undo` first. A rejected follow, and any follow from a blocked server, gets a
`Reject`.

**Undo.** An `Undo` of a `Follow` removes the follower when the follow it names is the one
stored. Every `Undo` reaches your handler once the undone activity is shown to be the sender's,
with that activity as `inbound.object`: the `withdrawResponse` call above removes the like or
boost it undid, and finds nothing to remove for a follow.

**Create, Update, Like, Announce.** A post must be attributed to its sender, live on the
sender's server, and reply to, quote or mention something of yours; a like or boost must name a
post your `LocalObjects` serves. Anything else is acknowledged and dropped before your handler
runs. `inbound.summary()` then answers what the activity says about your content:

```typescript
interface Summary {
	kind: "reply" | "like" | "repost" | "mention";
	id: string;
	url: string;
	target: string;
	author: {
		id: string;
		handle: string;
		name: string | null;
		url: string;
		photo: string | null;
	};
	content: { html: string; text: string } | null;
	published: Date | null;
}
```

`target` is your post or actor, and `content.html` is already sanitized against the remote
post's own URL. It is the shape a verified Webmention carries, so one table and one moderation
queue can hold both; [Join the IndieWeb](/docs/content-and-feeds/indieweb) builds that side.
Store responses as pending and show them once you approve them.

**Delete.** A `Delete` of a post is believed once a fresh fetch answers `404`, `410` or a
`Tombstone`, or still names the sender as its author; a `Delete` of an account removes its
follow. Its handler gets `inbound.deleted`,
`{ kind: "object" | "actor", id }`, and `inbound.actor` is `null` when the account is already
gone.

A handler answers nothing or a `Result`. A failure, or an exception, retries the whole message,
so write every handler to tolerate seeing the same activity twice; the upserts in
`saveResponse` and the deletes in `withdrawResponse` already do.

## Publish posts as articles

A post goes out as an ActivityStreams object wrapped in an activity: a `Note` for a short post,
an `Article` for a long one with a title. The same object is what a server gets when it asks
for the post's URL, and what `LocalObjects.find` answers for it:

```typescript {% title="app/services/federated-posts.ts" %}
import type { ActivityPub, LocalObjects } from "@sdxc/activitypub";
import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { parseObject, PUBLIC, stringify, tombstone } from "@sdxc/activitypub";
import { isFailure, success, wrap } from "@sdxc/result";

import type { Post } from "~/app/models/posts";

import { ACTOR_ID, FOLLOWERS_ID } from "~/app/config/activitypub";
import { findPostByUrl } from "~/app/models/posts";

export function articleOf(post: Post): ActivityPub.Draft<ActivityPub.Object> {
	return {
		id: post.url,
		type: "Article",
		attributedTo: [ACTOR_ID],
		to: [PUBLIC],
		cc: [FOLLOWERS_ID],
		name: post.title,
		summary: post.excerpt,
		content: post.html,
		url: post.url,
		published: post.publishedAt,
		updated: post.updatedAt,
	};
}

export function activityOf(
	post: Post,
	now: Date,
): ActivityPub.Draft<ActivityPub.Activity> | null {
	let addressing = { actor: ACTOR_ID, to: [PUBLIC], cc: [FOLLOWERS_ID] };
	if (post.deletedAt !== null) {
		if (post.federatedAt === null) return null;
		let object = tombstone({ id: post.url, formerType: "Article", deleted: now });
		return { id: `${post.url}#delete`, type: "Delete", object, ...addressing };
	}

	let object = articleOf(post);
	if (post.federatedAt === null) {
		return { id: `${post.url}#create`, type: "Create", object, ...addressing };
	}
	let id = `${post.url}#update-${now.getTime()}`;
	return { id, type: "Update", object, ...addressing };
}

export class FederatedPosts implements LocalObjects {
	readonly #db: Database;

	constructor(db: Database) {
		this.#db = db;
	}

	async find(id: string): Promise<Result<ActivityPub.Object | null, Error>> {
		let post = await wrap(() => findPostByUrl(this.#db, id));
		if (isFailure(post)) return post;
		if (post.data === null || post.data.deletedAt !== null) return success(null);
		return parseObject(JSON.parse(stringify(articleOf(post.data))));
	}
}
```

`Post` and `findPostByUrl` are your own model. `ActivityPub.Draft` is the shape you author:
`id` and `type` are required and every other member may be left out. `stringify` writes the
JSON-LD document with its `@context`, dates as ISO 8601, and nothing for an absent member;
reading it back through `parseObject` gives the full shape `find` answers.

Address `PUBLIC` in `to` for a public post, and the followers collection in `cc` to reach your
followers. Each activity needs its own `id`, so each `Update` carries the time of the change.
`content` is the post's HTML; receiving servers sanitize it to the elements they render.

### Deliver from a job

Enqueue `jobs.federation.publish` with the post's id whenever a post is created, edited or
deleted. The job works out which activity that is and hands it to `publish`:

```typescript {% title="app/jobs/federation/publish.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/jobs/dispatcher";
import { findPost, markFederated } from "~/app/models/posts";
import { activityOf } from "~/app/services/federated-posts";
import { createFederation } from "~/app/services/federation";

export default createJobHandler(jobs.federation.publish, async (ctx) => {
	let post = await findPost(ctx.database, ctx.input.postId);
	if (post === null) return ctx.ack("The post no longer exists");

	let activity = activityOf(post, new Date());
	if (activity === null) return ctx.ack("The post never federated");

	let federation = createFederation({ db: ctx.database, jobs: dispatcher });
	if (isFailure(federation)) return ctx.exit(federation.error.message);

	let published = await federation.data.publish(activity);
	if (isFailure(published)) {
		if (published.error.retryable) return ctx.retry({ cause: published.error });
		return ctx.exit(published.error.message);
	}

	await markFederated(ctx.database, post.id);
});
```

`publish` serializes the activity and queues one `fanOut` message carrying it whole, so every
inbox receives the same bytes even if the post changes again before delivery ends. An activity
over 120 KB fails `too-large`, since no queue message could carry it; trim `content` to a
summary and a link for a post that long. Marking the post federated only after the fan-out is
queued means a failed publish retries as a `Create`.

The fan-out runs as its own message. It reads your followers' inboxes from the store a page at a
time and queues one `deliver` message per distinct inbox, preferring each server's shared inbox,
so a server with four hundred of your followers gets one request. Hosts you block are skipped,
and so are servers that have failed every delivery for seven days.

Each delivery is signed when it is sent, so `Date` is fresh on every retry. The first request
to a server is signed with RFC 9421; a `400`, `401` or `403` is retried at once with
draft-cavage, the scheme Mastodon before 4.5 requires, and the scheme that landed is remembered
for that server for thirty days. An inbox that answers `410` is gone, so every follower reached
through it is removed.

A server that is down or rate-limiting fails the delivery as retryable, with a `delay` from
`DELIVERY_BACKOFF`: five minutes, thirty minutes, two hours, six hours, then twelve, each with
±20% jitter, or longer when the inbox sent a `Retry-After`. That is about 21 hours over five
retries, so give the queue at least six attempts. A queue that retries more takes its own
schedule as `backoff: createBackoff(…)` from [`@sdxc/backoff`](/api/backoff);
[Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) covers the
options.

## Serve each post both ways

A server that sees your post's URL, because someone pasted it into Mastodon's search or a reply
links to it, asks that URL for `application/activity+json`. `federation.respond` answers it,
and answers `null` for a browser, so the page renders as usual. Call it first in the post
page's handler:

```typescript {% title="app/http/activity-response.ts" %}
import type { JobEnqueuer } from "@sdxc/jobs";
import type { Database } from "remix/data-table";

import { tombstone } from "@sdxc/activitypub";
import { isFailure } from "@sdxc/result";

import type { Post } from "~/app/models/posts";

import { articleOf } from "~/app/services/federated-posts";
import { createFederation } from "~/app/services/federation";

interface ActivityContext {
	request: Request;
	db: Database;
	jobs: JobEnqueuer;
}

export async function activityResponse(ctx: ActivityContext, post: Post) {
	let federation = createFederation(ctx);
	if (isFailure(federation)) return null;

	let document =
		post.deletedAt === null
			? articleOf(post)
			: tombstone({
					id: post.url,
					formerType: "Article",
					deleted: post.deletedAt,
				});
	return await federation.data.respond(ctx.request, document);
}
```

```typescript
let activity = await activityResponse(ctx, post);
if (activity) return activity;
```

The response carries `Vary: Accept`, an `ETag` and `304` revalidation. A `Tombstone` answers
`410`, which is how a server refetching a deleted post learns to remove it. Link the
representation from the page's `<head>` too, as
`<link rel="alternate" type="application/activity+json" href={post.url} />`, for a client that
reads the page first.

## Test it in memory

`@sdxc/activitypub/testing` has an in-memory implementation of every store, and conformance
suites that hold your own stores to the contracts the package relies on. Register a suite for
each store you wrote:

```typescript {% title="app/repositories/followers.test.ts" %}
import { followerStoreConformance } from "@sdxc/activitypub/testing";

import { Followers } from "~/app/repositories/followers";
import { openTestDatabase } from "~/test/database";

followerStoreConformance({
	name: "Followers",
	create: async () => new Followers(await openTestDatabase()),
});
```

`create` builds a fresh store for every test, so give it an empty database each time.
`seenActivitiesConformance` takes the same two options plus an `advance(ms)` that moves the
store's clock, so its expiry is tested without waiting. `localObjectsConformance` takes the
`served` ids your `create` serves, and `keyProviderConformance` the `hosted` actors.

The federation itself runs on the memory stores and a `MemoryCache`, with a queue that
collects what it is handed:

```typescript {% title="app/services/federation.test.ts" %}
import { ACTIVITY_JSON, ActorKeys, Federation, parseActor } from "@sdxc/activitypub";
import {
	MemoryFollowerStore,
	MemoryLocalObjects,
	MemorySeenActivities,
} from "@sdxc/activitypub/testing";
import { MemoryCache } from "@sdxc/cache/memory";
import { isSuccess, unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { ACTOR_ID, INBOX_ID } from "~/app/config/activitypub";
import { siteActor } from "~/app/services/site-actor";

async function testFederation(queued: Federation.Message[]) {
	let { privateKeyPem } = unwrap(await ActorKeys.generate());
	let keys = unwrap(await ActorKeys.import({ actor: ACTOR_ID, privateKeyPem }));

	return new Federation({
		actor: unwrap(siteActor()),
		keys,
		stores: {
			followers: new MemoryFollowerStore(),
			seen: new MemorySeenActivities(),
			objects: new MemoryLocalObjects(),
		},
		cache: new MemoryCache(),
		userAgent: "test",
		queue: { enqueue: async (message) => void queued.push(message) },
	});
}

test("the actor document carries the key followers verify with", async () => {
	let federation = await testFederation([]);

	let response = await federation.fetch(new Request(ACTOR_ID));
	let actor = parseActor(await response?.json());

	expect(isSuccess(actor) && actor.data.publicKey?.id).toBe(`${ACTOR_ID}#main-key`);
});

test("an unsigned activity is refused before it is queued", async () => {
	let queued: Federation.Message[] = [];
	let federation = await testFederation(queued);

	let response = await federation.fetch(
		new Request(INBOX_ID, {
			method: "POST",
			headers: { "content-type": ACTIVITY_JSON },
			body: JSON.stringify({
				id: "https://mastodon.social/users/alice#follows/1",
				type: "Follow",
				actor: "https://mastodon.social/users/alice",
				object: ACTOR_ID,
			}),
		}),
	);

	expect(response?.status).toBe(401);
	expect(queued).toEqual([]);
});
```

Neither test leaves the process: the actor is served from memory, and an unsigned request is
refused before anything is fetched. A test of a signed delivery serves the remote actor and
its inbox with [MSW](https://mswjs.io/) and signs the request with
[`@sdxc/http-signatures`](/api/http-signatures). Every outbound request also resolves its host
over DNS-over-HTTPS first, so answer `https://cloudflare-dns.com/dns-query` with a public address
as well; [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) shows
that handler. `MemorySeenActivities` takes a `now` clock, so a test moves time to check a
claim expires.

## Where to go next

- [Sign and verify HTTP requests](/docs/identity-and-security/http-message-signatures) — the
  signatures and digests every delivery carries, on their own.
- [Join the IndieWeb](/docs/content-and-feeds/indieweb) — Webmention and Micropub, the other
  way independent sites talk to each other.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher,
  the queue and the verbs every handler here uses.
- [`@sdxc/activitypub`](/api/activitypub) — every error code, the delivery table and the quirks
  of each fediverse server the package absorbs.
