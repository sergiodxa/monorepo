/**
 * Tests the blog's posts as ActivityPub objects on a migrated in-memory database: the
 * `LocalObjects` suite over published posts, what `find` refuses, how a post maps to an
 * Article, the size fallback, and the ids its lifecycle activities carry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { PUBLIC, stringify } from "@sdxc/activitypub";
import { localObjectsConformance } from "@sdxc/activitypub/testing";
import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";
import { ACTOR_ID, FOLLOWERS_ID } from "~/config/activitypub";

import { article, create, FederatedPosts, remove, tombstone, update } from "./federated-posts";

const ARTICLE_ID = "https://sergiodxa.com/articles/hello";
const TUTORIAL_ID = "https://sergiodxa.com/tutorials/routing";

/** A migrated database holding one published article and one published tutorial. */
async function seeded(): Promise<{ db: Database; authorId: string }> {
	let db = await testDatabase();
	let authorId = await seedAuthor(db);
	await ArticlePost.create(db, {
		author_id: authorId,
		published_at: "2026-01-02T03:04:05.000Z",
		meta: {
			slug: "hello",
			title: "Hello",
			locale: "en",
			content: "Some **bold** text",
			excerpt: "A greeting",
		},
	});
	await TutorialPost.create(db, {
		author_id: authorId,
		published_at: null,
		meta: {
			slug: "routing",
			title: "Routing",
			excerpt: "",
			content: "Body",
			tags: ["react-router", "Remix"],
		},
	});
	return { db, authorId };
}

/** The post page's payload for a seeded post. */
async function found(db: Database, postType: Post.PublicTypePath, postSlug: string) {
	let post = await Post.findByTypeAndSlug(db, { postType, postSlug });
	if (!post) throw new Error(`${postType}/${postSlug} was not seeded`);
	return post;
}

localObjectsConformance({
	name: "FederatedPosts",
	create: async () => new FederatedPosts((await seeded()).db),
	served: [ARTICLE_ID, TUTORIAL_ID],
});

describe("FederatedPosts.find", () => {
	let db: Database;
	let authorId: string;

	beforeEach(async () => {
		({ db, authorId } = await seeded());
	});

	test("finds nothing for a post still in preview", async () => {
		await ArticlePost.create(db, {
			author_id: authorId,
			published_at: new Date(Date.now() + 86_400_000).toISOString(),
			meta: { slug: "soon", title: "Soon", locale: "en", content: "Later" },
		});

		expect(
			unwrap(await new FederatedPosts(db).find("https://sergiodxa.com/articles/soon")),
		).toBeNull();
	});

	test("finds nothing for a deleted post", async () => {
		let post = await found(db, "articles", "hello");
		await Post.destroy(db, post.post.id);

		expect(unwrap(await new FederatedPosts(db).find(ARTICLE_ID))).toBeNull();
	});

	test.each([
		["another origin", "https://evil.com/articles/hello"],
		["another collection", "https://sergiodxa.com/bookmarks/hello"],
		["an extension", "https://sergiodxa.com/articles/hello.md"],
		["a fragment", `${ARTICLE_ID}#create`],
		["a query", `${ARTICLE_ID}?ref=feed`],
		["an unknown slug", "https://sergiodxa.com/articles/missing"],
		["a non-URL", "hello"],
	])("finds nothing for %s", async (_, id) => {
		expect(unwrap(await new FederatedPosts(db).find(id))).toBeNull();
	});
});

describe("article", () => {
	test("maps an article to a public Article attributed to the actor", async () => {
		let { db } = await seeded();
		let object = article(await found(db, "articles", "hello"));

		expect(object).toMatchObject({
			id: ARTICLE_ID,
			type: "Article",
			attributedTo: [ACTOR_ID],
			to: [PUBLIC],
			cc: [FOLLOWERS_ID],
			name: "Hello",
			summary: "A greeting",
			url: ARTICLE_ID,
			published: new Date("2026-01-02T03:04:05.000Z"),
			updated: null,
			tag: [],
		});
		expect(object.content).toContain("<strong>bold</strong>");
	});

	test("tags a tutorial with a hashtag per tag, as Mastodon spells them", async () => {
		let { db } = await seeded();
		let object = article(await found(db, "tutorials", "routing"));

		expect(object.tag).toStrictEqual([
			{ type: "Hashtag", name: "#reactrouter", href: null },
			{ type: "Hashtag", name: "#Remix", href: null },
		]);
		expect(object.summary).toBeNull();
	});

	test("falls back to the summary and a link when the body would outgrow a queue message", async () => {
		let { db } = await seeded();
		let post = await found(db, "articles", "hello");
		let long = {
			...post,
			post: { ...post.post, meta: { ...post.post.meta, content: "word ".repeat(30_000) } },
		};

		let object = article(long);

		expect(object.content).toBe(
			`<p>A greeting</p><p><a href="${ARTICLE_ID}">${ARTICLE_ID}</a></p>`,
		);
		expect(new TextEncoder().encode(stringify(create(long))).byteLength).toBeLessThan(120_000);
	});
});

describe("activities", () => {
	test("creates under <permalink>#create, embedding the Article", async () => {
		let { db } = await seeded();
		let activity = create(await found(db, "articles", "hello"));

		expect(activity).toMatchObject({
			id: `${ARTICLE_ID}#create`,
			type: "Create",
			actor: ACTOR_ID,
			object: { id: ARTICLE_ID, type: "Article" },
			to: [PUBLIC],
			cc: [FOLLOWERS_ID],
		});
	});

	test("updates under <permalink>#update-<changedAt>, carrying it as the Article's updated", async () => {
		let { db } = await seeded();
		let changedAt = new Date("2026-03-04T05:06:07.000Z");
		let activity = update(await found(db, "articles", "hello"), changedAt);

		expect(activity).toMatchObject({
			id: `${ARTICLE_ID}#update-2026-03-04T05:06:07.000Z`,
			type: "Update",
			object: { id: ARTICLE_ID, updated: changedAt },
		});
	});

	test("deletes a Tombstone of the Article under <permalink>#delete", () => {
		let post = {
			postType: "articles" as const,
			slug: "hello",
			deleted_at: "2026-05-06T07:08:09.000Z",
		};

		expect(tombstone(post)).toStrictEqual({
			id: ARTICLE_ID,
			type: "Tombstone",
			formerType: "Article",
			deleted: new Date("2026-05-06T07:08:09.000Z"),
		});
		expect(remove(post)).toMatchObject({
			id: `${ARTICLE_ID}#delete`,
			type: "Delete",
			actor: ACTOR_ID,
			object: tombstone(post),
		});
	});
});
