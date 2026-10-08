/**
 * The blog's one ActivityPub actor as a `Federation`: its document, keys and stores, the
 * job queue its steps run on, and what a reply, mention, like or boost of a post does,
 * stored as a Webmention so one moderation queue covers both protocols.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ActivityPub, ActorKeys, KeyProvider, Summary } from "@sdxc/activitypub";
import type { Cache } from "@sdxc/cache";
import type { JobEnqueuer } from "@sdxc/jobs";
import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { Federation } from "@sdxc/activitypub";
import { currentLog } from "@sdxc/logger";
import { isFailure, success, wrap } from "@sdxc/result";

import jobs from "~/app/jobs";
import { FollowerRepository } from "~/app/repositories/follower";
import { Post } from "~/app/repositories/post";
import { Webmention } from "~/app/repositories/webmention";
import { FederatedPosts } from "~/app/services/federated-posts";
import { SeenActivityCache } from "~/app/services/seen-activities";
import {
	ACTIVITYPUB_USER_AGENT,
	ACTOR_ID,
	FOLLOWERS_ID,
	FOLLOWING_ID,
	INBOX_ID,
	OUTBOX_ID,
} from "~/config/activitypub";
import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/** Posts per outbox page; each is a full `Create`, so a page stays a modest download. */
const OUTBOX_PAGE_SIZE = 20;

/** The profiles the actor lists as fields, each a verified `rel="me"` link on Mastodon. */
const PROFILE_FIELDS = [
	{ name: "GitHub", href: PROFILE.github.profile },
	{ name: "X", href: PROFILE.x.profile },
	{ name: "YouTube", href: PROFILE.youtube.profile },
] as const;

/**
 * The actor document: a `Person` whose `preferredUsername` matches `acct:hello@…`, which
 * Mastodon resolves back through WebFinger, approving every follow on arrival.
 * Its `publicKey` is filled from the keys wherever the federation serves it under its id.
 */
export function siteActor(): ActivityPub.Actor {
	let home = new URL("/", PROFILE.canonical.origin).href;
	let avatar = new URL(routes.wellKnown.avatar.href(), PROFILE.canonical.origin).href;
	let image: ActivityPub.Image = { type: "Image", url: avatar, mediaType: "image/png" };

	return {
		id: ACTOR_ID,
		type: "Person",
		preferredUsername: "hello",
		name: PROFILE.name,
		nameMap: {},
		summary: `<p>${escapeHtml(PROFILE.summary)}</p>`,
		summaryMap: {},
		content: null,
		contentMap: {},
		url: home,
		inbox: INBOX_ID,
		outbox: OUTBOX_ID,
		followers: FOLLOWERS_ID,
		following: FOLLOWING_ID,
		featured: null,
		endpoints: { sharedInbox: INBOX_ID },
		publicKey: null,
		assertionMethod: [],
		alsoKnownAs: [],
		movedTo: null,
		manuallyApprovesFollowers: false,
		discoverable: true,
		indexable: true,
		icon: image,
		image: null,
		attachment: PROFILE_FIELDS.map((field): ActivityPub.PropertyValue => ({
			type: "PropertyValue",
			name: field.name,
			value: profileLink(field.href),
		})),
		attributedTo: [],
		to: [],
		cc: [],
		bto: [],
		bcc: [],
		inReplyTo: null,
		quote: null,
		published: null,
		updated: null,
		sensitive: false,
		tag: [],
		proof: [],
	};
}

/** What {@link createFederation} builds the blog's federation over. */
export interface FederationServices {
	/** The invocation's database, which the stores, the block list and the handlers use. */
	db: Database;
	/** Remote documents, delivery schemes and failing origins; the `WorkerKVCache` over `CACHE`. */
	cache: Cache;
	keys: ActorKeys | KeyProvider;
	/** Where inbox, fan-out and delivery messages go, each run later by `activityPub.process`. */
	queue: Federation.Queue;
}

/**
 * The blog's federation for one request or job. A host the Webmention moderation policy
 * blocks can neither deliver, follow nor receive, and responses to a post land in the same
 * `webmentions` table its Webmentions do.
 *
 * @param services The invocation's database, the document cache, the keys and the queue.
 * @example createFederation({ db: ctx.db, cache, keys: BLOG_KEYS, queue: federationQueue(ctx.jobs) });
 */
export function createFederation(services: FederationServices): Federation {
	let { db } = services;
	let posts = new FederatedPosts(db);

	return new Federation({
		actor: siteActor(),
		keys: services.keys,
		stores: {
			followers: new FollowerRepository(db),
			seen: new SeenActivityCache(services.cache),
			objects: posts,
		},
		cache: services.cache,
		userAgent: ACTIVITYPUB_USER_AGENT,
		queue: services.queue,
		async blocked(host) {
			return (await Webmention.policyFor(db, host)) === "block";
		},
		async outbox(cursor) {
			let [total, page] = await Promise.all([
				posts.count(),
				posts.outbox({ cursor, limit: OUTBOX_PAGE_SIZE }),
			]);
			if (isFailure(page)) return page;
			return success({ ...page.data, totalItems: isFailure(total) ? null : total.data });
		},
	})
		.on(["Create", "Update", "Like", "Announce"], (ctx) => storeResponse(db, ctx.summary()))
		.on("Undo", (ctx) => withdraw(db, ctx.object?.id ?? null))
		.on("Delete", (ctx) => withdraw(db, ctx.deleted.kind === "object" ? ctx.deleted.id : null));
}

/**
 * The federation's queue over the job map's `activityPub.process` job, written through
 * `ctx.jobs` in a request or the dispatcher in a job.
 *
 * @param enqueuer Whatever enqueues jobs for the invocation.
 */
export function federationQueue(enqueuer: JobEnqueuer): Federation.Queue {
	return {
		enqueue: (message) => enqueuer.enqueue(jobs.activityPub.process, message),
		enqueueMany: (messages) => enqueuer.enqueueMany(jobs.activityPub.process, messages),
	};
}

/**
 * Stores what a reply, mention, like or boost says about a published post, the remote post
 * or reaction as `source` and the post's permalink as `target`, the way a verified
 * Webmention is stored: a blocked host is dropped, an allowed one approved on arrival, and
 * any other waits as `pending`. A response to anything but a published post is dropped.
 *
 * @param db The invocation's database.
 * @param summary The response, `null` for an activity that is none.
 */
async function storeResponse(db: Database, summary: Summary | null): Promise<Result<void, Error>> {
	let source = summary === null ? null : URL.parse(summary.id);
	let target = summary === null ? null : URL.parse(summary.target);
	if (summary === null || source === null || target === null) return success(undefined);
	return await wrap(() => store(db, summary, { source, target }));
}

/**
 * Upserts one response under its pair, once the pair parsed.
 *
 * @param db The invocation's database.
 * @param summary The response.
 * @param pair The remote source and the local target.
 */
async function store(db: Database, summary: Summary, pair: { source: URL; target: URL }) {
	let { source, target } = pair;

	let post = await Post.findMentionable(db, target, PROFILE.canonical.origin);
	if (post === null) return;

	let policy = await Webmention.policyFor(db, source.hostname);
	if (policy === "block") return;

	let stored = await Webmention.upsert(db, {
		postId: post.id,
		pair: { source, target },
		mention: {
			kind: summary.kind,
			url: summary.url,
			author: {
				name: summary.author.name ?? summary.author.handle,
				url: summary.author.url,
				photo: summary.author.photo,
			},
			content: summary.content,
			name: null,
			published: summary.published,
		},
		status: policy === "allow" ? "approved" : "pending",
	});
	currentLog()?.set({ activitypub: { mention: stored.id, kind: stored.kind } });
}

/**
 * Withdraws every response a remote post or reaction made, which its `Undo` or `Delete`
 * means; a source that never responded, or a deleted account, changes nothing.
 *
 * @param db The invocation's database.
 * @param id The undone or deleted object's id.
 */
async function withdraw(db: Database, id: string | null): Promise<Result<void, Error>> {
	let source = id === null ? null : URL.parse(id);
	if (source === null) return success(undefined);
	return await wrap(() => Webmention.markSourceDeleted(db, source));
}

/** A profile field's value: the link Mastodon verifies when the page links back with `rel="me"`. */
function profileLink(href: string): string {
	let label = href.replace(/^https:\/\/(www\.)?/, "");
	return `<a href="${escapeHtml(href)}" rel="me nofollow noopener noreferrer" target="_blank">${escapeHtml(label)}</a>`;
}

/** Text safe inside HTML element content and double-quoted attributes. */
function escapeHtml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}
