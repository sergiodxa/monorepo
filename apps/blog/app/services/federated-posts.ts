/**
 * The blog's articles and tutorials as ActivityPub objects: each post is a public `Article`
 * under its canonical permalink, attributed to the blog's actor, plus the `Create`, `Update`
 * and `Delete` activities that federate its lifecycle and the lookup the inbox resolves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ActivityPub, LocalObjects } from "@sdxc/activitypub";
import type { Result } from "@sdxc/result";

import { PUBLIC, stringify, tombstone as tombstoneOf } from "@sdxc/activitypub";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { decodeCursor, encodeCursor, InvalidCursorError } from "@sdxc/pagination";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { BlogModels } from "~/app/models";
import type { PublicTypePath } from "~/app/models/post-values";
import type { PublicPost } from "~/app/services/posts";

import { isPublishedAt, timestampFromPublishedOrCreated } from "~/app/models/post-values";
import { findForMentions, findPublicPost } from "~/app/services/posts";
import { permalink } from "~/app/services/webmention";
import { ACTOR_ID, FOLLOWERS_ID } from "~/config/activitypub";
import { PROFILE } from "~/config/profile";

/**
 * Past this many bytes of JSON an Article carries its summary and a link instead of its
 * body, so the `Create` or `Update` wrapping it stays under the 128 KB a queue message holds.
 */
const ARTICLE_BYTES_LIMIT = 100_000;

/** A post permalink path, `/articles/:slug` or `/tutorials/:slug`, with no extension. */
const POST_PATH = /^\/(articles|tutorials)\/([^/.]+)$/;

/** The keyset the outbox pages by, matching the order `posts.findFederatable()` lists in. */
const OUTBOX_KEYS = ["timestamp", "id"] as const;

/** Every character a Mastodon hashtag cannot hold. */
const NON_HASHTAG = /[^\p{L}\p{N}_]/gu;

/** The post shapes the mappers read. */
export namespace FederatedPosts {
	/** A published post as the post page loads it. */
	export type Published = PublicPost;

	/** A deleted post, as `findForMentions()` still reads it. */
	export interface Deleted {
		postType: PublicTypePath;
		slug: string;
		deleted_at: string | null;
	}

	/** One page of the outbox: the posts' `Create`s, and the cursor of the next page. */
	export interface OutboxPage {
		items: Array<ActivityPub.Draft<ActivityPub.Activity>>;
		next: string | null;
	}
}

/**
 * The public `Article` a post is served and federated as. Its id is the canonical permalink,
 * whichever host served the request. A body past `ARTICLE_BYTES_LIMIT` becomes the summary
 * and a link, which is also all Mastodon shows of an Article.
 *
 * @param post The post as `findPublicPost()` reads it.
 * @param updated When its content last changed, which an `Update` carries.
 * @example return respond(article(post), { request: ctx.request, vary: true });
 */
export function article(
	post: FederatedPosts.Published,
	updated: Date | null = null,
): ActivityPub.Object {
	let id = permalink({ postType: post.postType, slug: post.post.meta.slug }).href;
	let summary = post.post.meta.excerpt?.trim() || null;
	let object: ActivityPub.Object = {
		id,
		type: "Article",
		attributedTo: [ACTOR_ID],
		to: [PUBLIC],
		cc: [FOLLOWERS_ID],
		bto: [],
		bcc: [],
		name: post.post.meta.title,
		nameMap: {},
		summary,
		summaryMap: {},
		content: htmlOf(post.post.meta.content) ?? linkTo(id, summary),
		contentMap: {},
		url: id,
		inReplyTo: null,
		quote: null,
		published: dateOf(timestampFromPublishedOrCreated(post.post)),
		updated,
		sensitive: false,
		tag: post.postType === "tutorials" ? hashtags(post.tags) : [],
		attachment: [],
		proof: [],
	};

	if (byteLength(stringify(object)) <= ARTICLE_BYTES_LIMIT) return object;
	return { ...object, content: linkTo(id, summary) };
}

/**
 * The `Tombstone` a deleted post is served as with `410`, and what its `Delete` carries.
 *
 * @param post The deleted post's permalink parts and deletion time.
 * @example return respond(tombstone(post), { request: ctx.request, vary: true });
 */
export function tombstone(post: FederatedPosts.Deleted): ActivityPub.Tombstone {
	return tombstoneOf({
		id: permalink(post).href,
		formerType: "Article",
		deleted: post.deleted_at === null ? null : dateOf(Date.parse(post.deleted_at)),
	});
}

/**
 * The `Create` that publishes a post to followers. Its id is `<permalink>#create`, so a
 * repeated delivery of one post's publication is the same activity.
 *
 * @param post The published post.
 */
export function create(post: FederatedPosts.Published): ActivityPub.Draft<ActivityPub.Activity> {
	let object = article(post);
	return {
		id: `${object.id}#create`,
		type: "Create",
		actor: ACTOR_ID,
		object,
		to: object.to,
		cc: object.cc,
		published: object.published,
	};
}

/**
 * The `Update` that federates an edit, `<permalink>#update-<changedAt ISO>`. `changedAt` is
 * when the content changed, passed in because `updated_at` also moves on bookkeeping
 * writes, and one edit delivered twice must keep one id.
 *
 * @param post The edited post.
 * @param changedAt When its content changed.
 */
export function update(
	post: FederatedPosts.Published,
	changedAt: Date,
): ActivityPub.Draft<ActivityPub.Activity> {
	let object = article(post, changedAt);
	return {
		id: `${object.id}#update-${changedAt.toISOString()}`,
		type: "Update",
		actor: ACTOR_ID,
		object,
		to: object.to,
		cc: object.cc,
		published: changedAt,
	};
}

/**
 * The `Delete` of a post's `Tombstone`, `<permalink>#delete`, which servers that hold a copy
 * of the Article answer by removing it.
 *
 * @param post The deleted post.
 */
export function remove(post: FederatedPosts.Deleted): ActivityPub.Draft<ActivityPub.Activity> {
	let object = tombstone(post);
	return {
		id: `${object.id}#delete`,
		type: "Delete",
		actor: ACTOR_ID,
		object,
		to: [PUBLIC],
		cc: [FOLLOWERS_ID],
		published: object.deleted,
	};
}

/**
 * The blog's posts as the inbox resolves them: a published article or tutorial under its
 * exact canonical permalink. Any other IRI, a preview, a deleted post, or a spelling of the
 * permalink other than the canonical one finds `null`.
 */
export class FederatedPosts implements LocalObjects {
	readonly #models: BlogModels;

	/** @param models The request's or job's models, as the context publishes them. */
	constructor(models: BlogModels) {
		this.#models = models;
	}

	/** The `Article` served under `id`, or `null` when the blog serves no post there. */
	async find(id: string): Promise<Result<ActivityPub.Object | null, Error>> {
		let location = postLocation(id);
		if (location === null) return success(null);

		let found = await wrap(() => findPublicPost(this.#models, location));
		if (isFailure(found)) return found;

		let post = found.data;
		if (post === null || !isPublishedAt(post.post.published_at)) return success(null);

		let object = article(post);
		return success(object.id === id ? object : null);
	}

	/** How many posts the outbox lists: every published, live article and tutorial. */
	async count(): Promise<Result<number, Error>> {
		let rows = await wrap(() => this.#models.posts.findFederatable());
		if (isFailure(rows)) return rows;
		return success(rows.data.length);
	}

	/**
	 * A page of the outbox, newest first, each post as the `Create` that published it. A
	 * cursor this method did not mint is an `InvalidCursorError`, which the route answers
	 * with `400`; a post deleted between the listing and the read is left out.
	 *
	 * @param options The cursor of the page, `null` for the first, and the page size.
	 */
	async outbox(options: {
		cursor: string | null;
		limit: number;
	}): Promise<Result<FederatedPosts.OutboxPage, Error>> {
		let after: { timestamp: number; id: string } | null = null;
		if (options.cursor !== null) {
			let decoded = outboxCursor(options.cursor);
			if (isFailure(decoded)) return decoded;
			after = decoded.data;
		}

		let rows = await wrap(() => this.#models.posts.findFederatable());
		if (isFailure(rows)) return rows;

		let remaining = rows.data.filter(
			(row) =>
				after === null ||
				row.timestamp < after.timestamp ||
				(row.timestamp === after.timestamp && row.id < after.id),
		);
		let limit = Math.max(1, Math.trunc(options.limit));
		let page = remaining.slice(0, limit);

		let items: Array<ActivityPub.Draft<ActivityPub.Activity>> = [];
		for (let row of page) {
			let post = await wrap(() => findPublished(this.#models, row.id));
			if (isFailure(post)) return post;
			if (post.data !== null) items.push(create(post.data));
		}

		let last = page.at(-1);
		if (remaining.length <= limit || last === undefined) return success({ items, next: null });

		let next = encodeCursor("after", OUTBOX_KEYS, [last.timestamp, last.id]);
		if (isFailure(next)) return next;
		return success({ items, next: next.data });
	}
}

/**
 * A post by id as the post page loads it, or `null` once it is deleted or no longer an
 * article or tutorial. Its publish state is the caller's to check.
 *
 * @param models The request's or job's models.
 * @param id The post's id.
 */
export async function findPublished(
	models: BlogModels,
	id: string,
): Promise<FederatedPosts.Published | null> {
	let source = await findForMentions(models, id);
	if (source === null || source.deleted_at !== null) return null;
	return findPublicPost(models, { postType: source.postType, postSlug: source.slug });
}

/** The boundary an outbox cursor carries, refusing one minted for any other listing. */
function outboxCursor(
	cursor: string,
): Result<{ timestamp: number; id: string }, InvalidCursorError> {
	let decoded = decodeCursor(cursor);
	if (isFailure(decoded)) return decoded;

	let { columns, direction, values } = decoded.data;
	let [timestamp, id] = values;
	let matches =
		columns.length === OUTBOX_KEYS.length && columns.every((key, at) => key === OUTBOX_KEYS[at]);
	if (
		!matches ||
		direction !== "after" ||
		typeof timestamp !== "number" ||
		typeof id !== "string"
	) {
		return failure(new InvalidCursorError("minted for another listing"));
	}
	return success({ timestamp, id });
}

/**
 * The collection and slug a canonical post IRI names, or `null` for another origin, another
 * path, a query, a fragment, or a slug that does not decode.
 */
function postLocation(id: string): { postType: PublicTypePath; postSlug: string } | null {
	let url: URL;
	try {
		url = new URL(id);
	} catch {
		return null;
	}
	if (url.origin !== PROFILE.canonical.origin || url.search !== "" || url.hash !== "") return null;

	let match = POST_PATH.exec(url.pathname);
	let postType = match?.[1];
	let slug = match?.[2];
	if ((postType !== "articles" && postType !== "tutorials") || slug === undefined) return null;

	try {
		return { postType, postSlug: decodeURIComponent(slug) };
	} catch {
		return null;
	}
}

/** The post's Markdown rendered as the post page renders it, or `null` when it does not parse. */
function htmlOf(markdown: string): string | null {
	let parsed = Markdown.parse(markdown);
	if (isFailure(parsed)) return null;
	return toHTML(parsed.data.document);
}

/** The summary and a link to the full post, which is what a reader of an Article sees. */
function linkTo(url: string, summary: string | null): string {
	let link = `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`;
	return summary === null ? link : `<p>${escapeHtml(summary)}</p>${link}`;
}

/** Tags as Mastodon hashtags, letters, digits and `_` only, each once; empty ones dropped. */
function hashtags(tags: ReadonlyArray<string>): ActivityPub.Hashtag[] {
	let names = new Set(tags.map((tag) => tag.replace(NON_HASHTAG, "")).filter(Boolean));
	return [...names].map((name): ActivityPub.Hashtag => ({
		type: "Hashtag",
		name: `#${name}`,
		href: null,
	}));
}

/** A `Date` for epoch milliseconds, or `null` for a timestamp that did not parse. */
function dateOf(ms: number): Date | null {
	return Number.isNaN(ms) ? null : new Date(ms);
}

/** UTF-8 size, which is what a queue message counts. */
function byteLength(text: string): number {
	return new TextEncoder().encode(text).byteLength;
}

/** Text safe inside HTML element content and double-quoted attributes. */
function escapeHtml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}
