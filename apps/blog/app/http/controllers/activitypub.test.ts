/**
 * Tests the blog's federation end to end on a test database: the actor document Mastodon
 * reads, the outbox and collections, NodeInfo, signed inbox deliveries queued and processed
 * into followers and Webmentions, and a post published to a follower's inbox through MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ActorKeys } from "@sdxc/activitypub";
import type { MemoryQueue } from "@sdxc/jobs/memory";
import type { Database as DataTable } from "remix/data-table";

import { Federation, PUBLIC } from "@sdxc/activitypub";
import { sign } from "@sdxc/http-signatures";
import { createJobContext } from "@sdxc/jobs";
import * as memory from "@sdxc/jobs/memory";
import { jobEnqueuer } from "@sdxc/jobs/router";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import * as s from "remix/data-schema";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { AppContext } from "~/app/http/context";

import activityPub, { ActivityPub } from "~/app/http/middleware/activitypub";
import database, { Database } from "~/app/http/middleware/database";
import models from "~/app/http/middleware/models";
import jobs from "~/app/jobs";
import publish from "~/app/jobs/activitypub/publish";
import { FollowerRepository } from "~/app/repositories/follower";
import { federationQueue } from "~/app/services/activitypub";
import { findForMentions } from "~/app/services/posts";
import {
	ALICE,
	ALICE_SHARED_INBOX,
	aliceDocument,
	blogKeys,
	keysFor,
	publicDns,
	serveDocument,
	TestQueue,
	testFederation,
} from "~/app/test/activitypub";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";
import { bindModels, publishModels } from "~/app/test/models";
import { ACTOR_ID, FOLLOWERS_ID, FOLLOWING_ID, INBOX_ID, OUTBOX_ID } from "~/config/activitypub";
import routes from "~/routes/web";

import documents from "./activitypub";
import inbox from "./activitypub-inbox";
import nodeInfo from "./nodeinfo";
import post from "./post";

const server = setupServer();

/** What Mastodon sends when it fetches an object. */
const AS2 =
	'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

/** Alice's personal inbox, where an Accept of her Follow is delivered. */
const ALICE_INBOX = `${ALICE}/inbox`;

let db: DataTable;
let keys: ActorKeys;
let aliceKeys: ActorKeys;
let jobQueue: MemoryQueue;
let delivered: Array<{ inbox: string; activity: Record<string, unknown> }>;

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	keys = await blogKeys();
	aliceKeys = await keysFor(ALICE);
});

beforeEach(async () => {
	db = await testDatabase();
	jobQueue = memory.queue();
	delivered = [];
	server.use(
		publicDns(),
		serveDocument(ALICE, aliceDocument(aliceKeys)),
		http.post("https://mastodon.social/*", async ({ request }) => {
			let activity = record(await request.json());
			delivered.push({ inbox: request.url, activity });
			return new HttpResponse(null, { status: 202 });
		}),
	);
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A JSON object read back from a body, so a test can match its members. */
function record(value: unknown): Record<string, unknown> {
	expect(value).toBeTypeOf("object");
	return Object(value);
}

/** Sends one request through a router carrying the database, the job queue and the federation. */
async function fetchPath(path: string, init?: RequestInit): Promise<Response> {
	let router = createRouter<AppContext>({
		middleware: [
			log(createLogger({ service: "blog", sink: () => undefined })),
			database(() => db),
			models(),
			jobEnqueuer(jobQueue),
			activityPub((ctx) => testFederation(db, keys, federationQueue(ctx.jobs))),
		],
	});
	router.map(routes.activityPub.documents, documents);
	router.map(routes.activityPub.inbox, inbox);
	router.map(routes.nodeInfo, nodeInfo);
	router.map(routes.post, post);
	return await router.fetch(new Request(new URL(path, "https://sergiodxa.com"), init));
}

/** Creates `count` published articles, `post-0` the oldest. */
async function articles(count: number): Promise<string[]> {
	let author = await seedAuthor(db);
	let ids: string[] = [];
	for (let index = 0; index < count; index++) {
		let created = unwrap(
			await bindModels(db).articles.create({
				author_id: author,
				published_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
				meta: { slug: `post-${index}`, title: `Post ${index}`, locale: "en", content: "Body" },
			}),
		);
		if (created) ids.push(created.id);
	}
	return ids;
}

/** A POST of `activity` to the inbox, signed with draft-cavage as `signer`. */
async function deliver(activity: unknown, signer: ActorKeys | null = aliceKeys) {
	let body = new TextEncoder().encode(JSON.stringify(activity));
	let request = new Request(INBOX_ID, {
		method: "POST",
		headers: { "content-type": "application/activity+json" },
		body,
	});
	if (signer !== null) {
		request = unwrap(
			await sign(request, {
				scheme: "draft-cavage",
				key: { id: signer.rsa.id, privateKey: signer.rsa.privateKey },
				body,
			}),
		);
	}
	return await fetchPath("/activitypub/inbox", {
		method: "POST",
		headers: Object.fromEntries(request.headers),
		body,
	});
}

/** The `activityPub.process` messages the requests queued, read back through the job's schema. */
function queuedMessages(): Federation.Message[] {
	return jobQueue.messages.map((message) => {
		let envelope = record(message);
		expect(envelope.job).toBe(jobs.activityPub.process.name);
		return s.parse(Federation.MESSAGE, envelope.body);
	});
}

/**
 * Processes `messages` and every message they queue in turn, the way the queue consumer
 * would, until nothing is left.
 *
 * @returns The outcomes, in processing order.
 */
async function drain(messages: Federation.Message[]): Promise<Federation.Outcome[]> {
	let queue = new TestQueue();
	let federation = testFederation(db, keys, queue);
	let outcomes: Federation.Outcome[] = [];
	let pending = [...messages];
	while (pending.length > 0) {
		for (let message of pending) outcomes.push(unwrap(await federation.process(message)));
		pending = queue.take();
	}
	return outcomes;
}

/** A Follow of the blog's actor by Alice. */
const FOLLOW = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://mastodon.social/follows/1",
	type: "Follow",
	actor: ALICE,
	object: ACTOR_ID,
};

/** Alice's reply to `post-0`, served from her server as well as embedded. */
const REPLY = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://mastodon.social/users/alice/statuses/1",
	type: "Note",
	attributedTo: ALICE,
	inReplyTo: "https://sergiodxa.com/articles/post-0",
	content: "<p>Great post!</p>",
	url: "https://mastodon.social/@alice/1",
	published: "2026-02-01T00:00:00Z",
	to: [PUBLIC],
	cc: [`${ALICE}/followers`],
};

/** Alice's Like of `post-0`. */
const LIKE = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://mastodon.social/users/alice#likes/1",
	type: "Like",
	actor: ALICE,
	object: "https://sergiodxa.com/articles/post-0",
};

describe("GET /activitypub/actor", () => {
	test("serves the Person Mastodon resolves acct:hello@sergiodxa.com to", async () => {
		let response = await fetchPath("/activitypub/actor");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/activity+json; charset=utf-8");

		let actor = record(await response.json());
		expect(actor).toMatchObject({
			id: ACTOR_ID,
			type: "Person",
			preferredUsername: "hello",
			inbox: INBOX_ID,
			outbox: OUTBOX_ID,
			followers: FOLLOWERS_ID,
			following: FOLLOWING_ID,
			endpoints: { sharedInbox: INBOX_ID },
			manuallyApprovesFollowers: false,
			discoverable: true,
			indexable: true,
			publicKey: keys.publicKey,
		});
		expect(actor.attachment).toContainEqual(
			expect.objectContaining({
				type: "PropertyValue",
				name: "GitHub",
				value: expect.stringContaining('rel="me'),
			}),
		);
	});
});

describe("GET /activitypub/outbox", () => {
	test("counts the published posts and links the first page", async () => {
		await articles(3);

		let collection = record(await (await fetchPath("/activitypub/outbox")).json());

		expect(collection).toMatchObject({
			id: OUTBOX_ID,
			type: "OrderedCollection",
			totalItems: 3,
			first: `${OUTBOX_ID}?page=true`,
		});
	});

	test("pages through every post newest first, each as its Create", async () => {
		await articles(25);

		let page = s.object({
			type: s.string(),
			orderedItems: s.array(s.object({ id: s.string(), type: s.string() })),
			next: s.optional(s.string()),
		});
		let first = s.parse(page, await (await fetchPath("/activitypub/outbox?page=true")).json());
		expect(first.type).toBe("OrderedCollectionPage");
		expect(first.orderedItems).toHaveLength(20);
		expect(first.orderedItems[0]).toMatchObject({
			type: "Create",
			id: "https://sergiodxa.com/articles/post-24#create",
		});

		let next = new URL(first.next ?? "");
		let second = s.parse(page, await (await fetchPath(next.pathname + next.search)).json());
		expect(second.orderedItems.map((item) => item.id)).toEqual(
			[4, 3, 2, 1, 0].map((index) => `https://sergiodxa.com/articles/post-${index}#create`),
		);
		expect(second.next).toBeUndefined();
	});
});

describe("the followers and following collections", () => {
	test("count the accepted followers", async () => {
		await new FollowerRepository(db).put({
			actor: ACTOR_ID,
			id: ALICE,
			inbox: ALICE_INBOX,
			sharedInbox: null,
			followId: FOLLOW.id,
			state: "accepted",
		});

		let followers = await (await fetchPath("/activitypub/followers")).json();

		expect(followers).toMatchObject({ id: FOLLOWERS_ID, totalItems: 1 });
	});

	test("list nobody as followed", async () => {
		let following = await (await fetchPath("/activitypub/following")).json();

		expect(following).toMatchObject({ type: "OrderedCollection", totalItems: 0 });
	});
});

describe("GET /nodeinfo/2.1", () => {
	test("describes a one-user ActivityPub server and counts its posts", async () => {
		await articles(2);

		let response = await fetchPath("/nodeinfo/2.1");

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			version: "2.1",
			software: { name: "sergiodxa" },
			protocols: ["activitypub"],
			openRegistrations: false,
			usage: { users: { total: 1 }, localPosts: 2 },
		});
	});
});

describe("a post asked for as ActivityStreams", () => {
	test("answers its Article privately, so the edge never stores it under the page URL", async () => {
		await articles(1);

		let response = await fetchPath("/articles/post-0", { headers: { accept: AS2 } });

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toContain("private");
		expect(response.headers.get("vary")).toMatch(/accept/i);
		expect(await response.json()).toMatchObject({
			id: "https://sergiodxa.com/articles/post-0",
			type: "Article",
			attributedTo: [ACTOR_ID],
		});
	});

	test("answers a deleted post's Tombstone with 410", async () => {
		let [id] = await articles(1);
		await bindModels(db).articles.tombstone(id ?? "");

		let response = await fetchPath("/articles/post-0", { headers: { accept: AS2 } });

		expect(response.status).toBe(410);
		expect(await response.json()).toMatchObject({ type: "Tombstone", formerType: "Article" });
	});
});

describe("POST /activitypub/inbox", () => {
	test("queues a signed Follow, which stores the follower and delivers an Accept", async () => {
		let response = await deliver(FOLLOW);

		expect(response.status).toBe(202);
		let messages = queuedMessages();
		expect(messages).toEqual([expect.objectContaining({ kind: "inbox", actor: ALICE })]);

		await drain(messages);

		let followers = unwrap(
			await new FollowerRepository(db).list(ACTOR_ID, { cursor: null, limit: 10 }),
		);
		expect(followers.items).toEqual([
			expect.objectContaining({ id: ALICE, followId: FOLLOW.id, state: "accepted" }),
		]);
		expect(delivered).toHaveLength(1);
		expect([ALICE_INBOX, ALICE_SHARED_INBOX]).toContain(delivered[0]?.inbox);
		expect(delivered[0]?.activity).toMatchObject({
			type: "Accept",
			actor: ACTOR_ID,
			object: expect.objectContaining({ id: FOLLOW.id }),
		});
	});

	test("stores a reply to a post as a pending Webmention the post page can list", async () => {
		let [postId] = await articles(1);
		server.use(serveDocument(REPLY.id, REPLY));

		let response = await deliver({
			"@context": "https://www.w3.org/ns/activitystreams",
			id: `${REPLY.id}/activity`,
			type: "Create",
			actor: ALICE,
			object: REPLY,
			to: REPLY.to,
			cc: REPLY.cc,
		});
		expect(response.status).toBe(202);
		await drain(queuedMessages());

		let stored = await bindModels(db).webmentions.findByPair({
			source: new URL(REPLY.id),
			target: new URL("https://sergiodxa.com/articles/post-0"),
		});
		expect(stored).toMatchObject({
			post_id: postId,
			kind: "reply",
			status: "pending",
			url: REPLY.url,
			author_url: expect.stringContaining("mastodon.social"),
		});
		expect(stored?.content_html).toContain("Great post!");
	});

	test("approves a like from an allowed host, and withdraws it on Undo", async () => {
		let [postId] = await articles(1);
		await bindModels(db).webmentionDomains.setPolicy("mastodon.social", "allow");

		expect((await deliver(LIKE)).status).toBe(202);
		await drain(queuedMessages());
		jobQueue.reset();

		let approved = await bindModels(db).webmentions.findApprovedForPost(postId ?? "");
		expect(approved).toEqual([expect.objectContaining({ kind: "like", source: LIKE.id })]);

		let undo = { ...LIKE, id: `${LIKE.id}/undo`, type: "Undo", object: LIKE };
		expect((await deliver(undo)).status).toBe(202);
		await drain(queuedMessages());

		expect(await bindModels(db).webmentions.findApprovedForPost(postId ?? "")).toEqual([]);
	});

	test("refuses an unsigned delivery with a 401", async () => {
		let response = await deliver(FOLLOW, null);

		expect(response.status).toBe(401);
		expect(jobQueue.messages).toHaveLength(0);
	});

	test("refuses a delivery signed by a key the sender does not publish", async () => {
		let response = await deliver(FOLLOW, await keysFor(ALICE));

		expect(response.status).toBe(401);
		expect(jobQueue.messages).toHaveLength(0);
	});

	test("refuses a server the moderation policy blocks", async () => {
		await bindModels(db).webmentionDomains.setPolicy("mastodon.social", "block");

		let response = await deliver(FOLLOW);

		expect(response.status).toBe(403);
		expect(jobQueue.messages).toHaveLength(0);
	});

	test("refuses a body that is not ActivityStreams", async () => {
		let response = await fetchPath("/activitypub/inbox", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(FOLLOW),
		});

		expect(response.status).toBe(415);
	});
});

describe("the activityPub.publish job", () => {
	/** Runs the publish job for a post with the test federation installed. */
	async function runPublish(postId: string, changedAt: string, queue: TestQueue) {
		let ctx = createJobContext(jobs.activityPub.publish, {
			id: "m",
			attempts: 1,
			input: { postId, changedAt },
		});
		ctx.set(Database, db, { property: "db" });
		publishModels(ctx, db);
		ctx.set(ActivityPub, testFederation(db, keys, queue), { property: "activityPub" });
		await publish(ctx);
	}

	test("sends a Create to followers, then an Update, then a Delete", async () => {
		let [postId = ""] = await articles(1);
		await new FollowerRepository(db).put({
			actor: ACTOR_ID,
			id: ALICE,
			inbox: ALICE_INBOX,
			sharedInbox: ALICE_SHARED_INBOX,
			followId: FOLLOW.id,
			state: "accepted",
		});
		let queue = new TestQueue();

		await runPublish(postId, "2026-03-01T00:00:00.000Z", queue);
		let outcomes = await drain(queue.take());

		expect(outcomes.map((outcome) => outcome.kind)).toEqual(["fanOut", "deliver"]);
		expect(delivered).toEqual([
			{
				inbox: ALICE_SHARED_INBOX,
				activity: expect.objectContaining({
					id: "https://sergiodxa.com/articles/post-0#create",
					type: "Create",
					object: expect.objectContaining({ type: "Article" }),
				}),
			},
		]);
		expect((await findForMentions(bindModels(db), postId))?.federated_at).not.toBeNull();

		await runPublish(postId, "2026-03-02T00:00:00.000Z", queue);
		await drain(queue.take());
		expect(delivered[1]?.activity).toMatchObject({
			type: "Update",
			id: "https://sergiodxa.com/articles/post-0#update-2026-03-02T00:00:00.000Z",
		});

		await bindModels(db).articles.tombstone(postId);
		await runPublish(postId, "2026-03-03T00:00:00.000Z", queue);
		await drain(queue.take());
		expect(delivered[2]?.activity).toMatchObject({
			type: "Delete",
			object: expect.objectContaining({ type: "Tombstone" }),
		});
	});

	test("takes a post off the scheduled job's list once its Create is queued", async () => {
		let [postId = ""] = await articles(1);
		expect(await bindModels(db).posts.findDueForFederation()).toEqual([postId]);

		await runPublish(postId, "2026-03-01T00:00:00.000Z", new TestQueue());

		expect(await bindModels(db).posts.findDueForFederation()).toEqual([]);
	});

	test("sends nothing for a post deleted before it federated", async () => {
		let [postId = ""] = await articles(1);
		await bindModels(db).articles.tombstone(postId);
		let queue = new TestQueue();

		let ended = await runPublish(postId, "2026-03-01T00:00:00.000Z", queue).then(
			() => "returned",
			() => "acknowledged",
		);

		expect(ended).toBe("acknowledged");
		expect(queue.messages).toEqual([]);
	});
});
