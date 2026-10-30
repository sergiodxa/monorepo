---
title: Federate a site with ActivityPub
description: Publish an actor, answer WebFinger, verify an inbox that handles follows and undos, deliver signed posts to followers from jobs, and test it all in memory.
section:
    title: Content & feeds
    order: 8
order: 7
lastUpdated: 2026-10-25
outcomes:
    - "How to publish an actor and answer WebFinger with `@sdxc/well-known`"
    - "How to verify each activity at the inbox and handle follows and undos"
    - "How to deliver signed posts to followers from jobs and test it all in memory"
---

ActivityPub is the protocol Mastodon and the rest of the fediverse speak. A site that
federates has an actor someone on any of those servers can follow: every post lands in their
timeline, and every reply, like and boost comes back to the site's inbox.

This guide makes a Remix v3 app one such actor. It serves the actor document and WebFinger,
verifies each activity at the inbox, delivers signed posts to every follower from background
jobs, and serves each post as HTML to a browser and as an `Article` to a server.
[`@sdxc/activitypub`](/api/activitypub) holds the protocol, [`@sdxc/well-known`](/api/well-known)
answers WebFinger, [`@sdxc/jobs`](/api/jobs) runs every step off the request, and
[`@sdxc/cache`](/api/cache) holds the remote documents the federation fetches.

```bash
npm add @sdxc/activitypub @sdxc/cache @sdxc/http @sdxc/jobs @sdxc/result \
	@sdxc/well-known remix
```

The package keeps no state of its own: followers and the posts you serve live in your
database, behind small interfaces it calls, so the examples import your own `~/app/models/*`.

## Generate the actor's keys

Every activity the site sends is signed with the actor's RSA key. Run `ActorKeys.generate` once,
from a script, and store the private key as a secret:

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

> [!WARNING]
> Keep the key stable. Followers verify against the one they cached, and a new pair means
> announcing it to every one of them.

Import it lazily through a `KeyProvider`, once per isolate, inside the first request or job
that signs:

```typescript {% title="app/services/actor-keys.ts" %}
import type { KeyProvider } from "@sdxc/activitypub";
import type { Result } from "@sdxc/result";

import { ActorKeys } from "@sdxc/activitypub";
import { isFailure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

import { ACTOR_ID } from "~/config/activitypub";

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

A failed import is forgotten, so the next call tries again.

## Describe the actor

The actor's URLs are ordinary routes in your app. Name them once, so the routes and the actor
document cannot drift apart:

```typescript {% title="config/activitypub.ts" %}
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

`parseActor` fills every member you leave out, so the actor is the handful that matter:

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
} from "~/config/activitypub";

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

`preferredUsername` is the `hello` of `hello@example.com`, the handle people search for. The
federation fills `publicKey` from the keys wherever it serves the actor.

## Build the federation

One `Federation` wires the actor, its keys, your stores, the cache and the queue together. It
holds nothing between calls, so build it wherever a database and a job enqueuer are at hand.

```typescript {% title="app/services/federation.ts" %}
import type { ActivityPubParseError } from "@sdxc/activitypub";
import type { JobEnqueuer } from "@sdxc/jobs";
import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { CacheSeenActivities, Federation } from "@sdxc/activitypub";
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { isFailure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

import { USER_AGENT } from "~/config/activitypub";
import jobs from "~/app/jobs";
import { saveResponse, withdrawResponse } from "~/app/models/responses";
import { Followers } from "~/app/models/followers";
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

`Followers` implements `FollowerStore` over your own table, and `FederatedPosts`, built further
down, implements `LocalObjects`, which is how the inbox tells a reply to one of your posts from
noise. `CacheSeenActivities` comes with the package and spares a redelivered activity a second
pass. `userAgent` goes out on every request, since some servers refuse requests without one.

## Answer the actor's URLs

`federation.fetch` answers every URL the actor document names, so every route maps to the same
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

Map it with `router.map(routes.activityPub, activityPub)`. A `POST` to the inbox is verified
inside the request (content type, size, signature, and that the key belongs to the activity's
actor) and answers `202` once the activity is queued, or the status of the check it failed.

> [!WARNING]
> Verify before anything else reads the request: the body is a stream. A server delivering an
> activity has no session and no `Origin` header, so if your app runs Remix's
> [`cop()`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware), exempt the inbox
> path from it: the signature is the stronger claim.

## Answer WebFinger

Someone on Mastodon types `@hello@example.com`. Their server asks
`https://example.com/.well-known/webfinger?resource=acct:hello@example.com` for a `self` link
typed `application/activity+json`, then fetches the actor it points at. `actorLink` writes that
link, and the `wellKnown` middleware answers the path:

```typescript {% title="app/http/middleware/webfinger.ts" %}
import { actorLink } from "@sdxc/activitypub";
import { isFailure } from "@sdxc/result";
import { serve, wellKnown } from "@sdxc/well-known/middleware";
import { readQuery, select, webFinger } from "@sdxc/well-known/webfinger";

import { ACTOR_ID, HANDLE } from "~/config/activitypub";

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
through to your router's `404`.

## Process the queue

Every step the federation queues (an inbox activity, the fan-out of a post, one delivery) is
one message shape, `Federation.MESSAGE`. Declare one job for it, beside the job that publishes a
post:

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
import { dispatcher } from "~/app/initializers/dispatcher";
import { createFederation } from "~/app/services/federation";

export default createJobHandler(jobs.federation.process, async (ctx) => {
	let federation = createFederation({ db: ctx.db, jobs: dispatcher });
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
`ctx.retry` takes as it is. [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron)
builds the dispatcher and the `database()` job middleware that publishes `ctx.db`.

## Handle follows, undos and replies

An inbox message is processed in two parts: the protocol's work, which the package does, then
your handler for the activity's type. By the time a handler runs, the sender's actor has been
fetched from its own server, and anything the activity embeds from another origin has been
fetched fresh rather than trusted.

**Follow.** The package stores the follower and delivers an `Accept`. Chain a `Follow` handler
onto the federation to decide instead, answering `"accept"`, `"reject"`, `"pending"`, or `null`
for the default:

```typescript {% title="app/services/federation.ts" %}
federation.on("Follow", (inbound) =>
	inbound.actor.type === "Service" ? "pending" : null,
);
```

A pending follower is left out of deliveries until you call `federation.approve(id)` or
`federation.reject(id)`.

**Undo.** An `Undo` of a `Follow` removes the follower. Every `Undo` reaches your handler with
the undone activity as `inbound.object`, which is what `withdrawResponse` above removes.

**Create, Update, Like, Announce.** Only activities that reply to, quote, mention, like or boost
something of yours reach your handler. `inbound.summary()` answers what the activity says about
your content (its `kind`, `author`, sanitized `content` and the `target` post), the same shape a
verified Webmention carries; [Join the IndieWeb](/docs/content-and-feeds/indieweb) builds that
side. Store responses as pending and show them once you approve them.

**Delete.** A `Delete` is believed only once a fresh fetch confirms it. Its handler gets
`inbound.deleted`, `{ kind: "object" | "actor", id }`.

> [!WARNING]
> A failure, or an exception, retries the whole message, so write every handler to tolerate
> seeing the same activity twice; the upserts in `saveResponse` and the deletes in
> `withdrawResponse` already do.

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

import { ACTOR_ID, FOLLOWERS_ID } from "~/config/activitypub";
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

`Post` and `findPostByUrl` are your own model. Address `PUBLIC` in `to` for a public post, and
the followers collection in `cc` to reach your followers. Each activity needs its own `id`, so
each `Update` carries the time of the change.

### Deliver from a job

Enqueue `jobs.federation.publish` with the post's id whenever a post is created, edited or
deleted. The job works out which activity that is and hands it to `publish`:

```typescript {% title="app/jobs/federation/publish.ts" %}
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/initializers/dispatcher";
import { findPost, markFederated } from "~/app/models/posts";
import { activityOf } from "~/app/services/federated-posts";
import { createFederation } from "~/app/services/federation";

export default createJobHandler(jobs.federation.publish, async (ctx) => {
	let post = await findPost(ctx.db, ctx.input.postId);
	if (post === null) return ctx.ack("The post no longer exists");

	let activity = activityOf(post, new Date());
	if (activity === null) return ctx.ack("The post never federated");

	let federation = createFederation({ db: ctx.db, jobs: dispatcher });
	if (isFailure(federation)) return ctx.exit(federation.error.message);

	let published = await federation.data.publish(activity);
	if (isFailure(published)) {
		if (published.error.retryable) return ctx.retry({ cause: published.error });
		return ctx.exit(published.error.message);
	}

	await markFederated(ctx.db, post.id);
});
```

`publish` queues one fan-out message carrying the activity whole, which queues one signed
delivery per distinct inbox. Marking the post federated only after that means a failed publish
retries as a `Create`.

> [!NOTE]
> An activity over 120 KB fails `too-large`, since no queue message could carry it, so trim
> `content` to a summary and a link for a long post. Failed deliveries retry over about 21 hours
> in five steps, so give the queue at least six attempts.

## Serve each post both ways

A server that sees your post's URL asks it for `application/activity+json`.
`federation.respond` answers it, and answers `null` for a browser, so the page renders as usual.
Call it first in the post page's handler:

```typescript {% title="app/services/activity-response.ts" %}
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

A `Tombstone` answers `410`, which is how a server refetching a deleted post learns to remove
it.

## Test it in memory

`@sdxc/activitypub/testing` has an in-memory implementation of every store, and conformance
suites that hold your own stores to the package's contracts. Register one for each store you
wrote:

```typescript {% title="app/models/followers.test.ts" %}
import { followerStoreConformance } from "@sdxc/activitypub/testing";

import { Followers } from "~/app/models/followers";
import { openTestDatabase } from "~/app/test/database";

followerStoreConformance({
	name: "Followers",
	create: async () => new Followers(await openTestDatabase()),
});
```

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

import { ACTOR_ID, INBOX_ID } from "~/config/activitypub";
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

Neither test leaves the process. A test of a signed delivery serves the remote actor and its
inbox with [MSW](https://mswjs.io/) and signs the request with
[`@sdxc/http-signatures`](/api/http-signatures).

## Where to go next

- [Sign and verify HTTP requests](/docs/identity-and-security/http-message-signatures) — the
  signatures and digests every delivery carries, on their own.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher,
  the queue and the verbs every handler here uses.
- [`@sdxc/activitypub`](/api/activitypub) — every error code, the delivery table and the quirks
  of each fediverse server the package absorbs.
