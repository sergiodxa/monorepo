/**
 * Tests the Webmention repository against a migrated in-memory database: blocking a
 * host rejects what it already sent and reports which posts render differently, and a
 * resend after deletion brings the mention back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import { ArticlePost } from "~/app/repositories/posts/article";
import { testDatabase } from "~/app/test/database";
import { seedAuthor } from "~/app/test/fixtures";

import { Webmention } from "./webmention";

const TARGET = new URL("https://blog.test/articles/post");

let db: Database;
let postId: string;

/** A plain mention as verification would summarize it. */
function mention(url: string) {
	return {
		kind: "mention" as const,
		url,
		author: null,
		content: null,
		name: null,
		published: null,
	};
}

beforeEach(async () => {
	db = await testDatabase();
	let post = await ArticlePost.create(db, {
		author_id: await seedAuthor(db),
		published_at: null,
		meta: { slug: "post", title: "Post", locale: "en", content: "Body" },
	});
	postId = post!.id;
});

describe("Webmention.rejectFromHost", () => {
	test("rejects the host's mentions and names the posts whose approved ones changed", async () => {
		let spam = await Webmention.upsert(db, {
			postId,
			pair: { source: new URL("https://spam.example/a"), target: TARGET },
			mention: mention("https://spam.example/a"),
			status: "approved",
		});
		let other = await Webmention.upsert(db, {
			postId,
			pair: { source: new URL("https://friend.example/a"), target: TARGET },
			mention: mention("https://friend.example/a"),
			status: "approved",
		});

		let affected = await Webmention.rejectFromHost(db, "spam.example");

		expect(affected).toEqual([postId]);
		expect((await Webmention.findById(db, spam.id))?.status).toBe("rejected");
		expect((await Webmention.findById(db, other.id))?.status).toBe("approved");
	});
});

describe("Webmention.upsert", () => {
	test("brings a deleted mention back with the arrival status", async () => {
		let pair = { source: new URL("https://friend.example/b"), target: TARGET };
		await Webmention.upsert(db, {
			postId,
			pair,
			mention: mention(pair.source.href),
			status: "approved",
		});
		await Webmention.markDeleted(db, pair);

		let again = await Webmention.upsert(db, {
			postId,
			pair,
			mention: mention(pair.source.href),
			status: "pending",
		});

		expect(again.status).toBe("pending");
	});
});
