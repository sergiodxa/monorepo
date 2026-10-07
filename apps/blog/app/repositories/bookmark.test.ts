/**
 * Pins what makes two URLs one bookmark: the cleaning a URL gets before it is stored, the
 * address duplicates are judged by, and the migration that computes the same address in
 * SQL for the bookmarks saved before it, keeping the oldest of every duplicate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1Database } from "@sdxc/cloudflare-mocks";
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { Database } from "remix/data-table";
import { describe, expect, test } from "vitest";

import { LikePost } from "~/app/repositories/posts/like";
import { testDatabase } from "~/app/test/database";
import { applyMigrations, seedAuthor } from "~/app/test/fixtures";

import { Bookmark } from "./bookmark";

/** The migration that creates the record and backfills it. */
const BOOKMARKS_MIGRATION = "0009_Bookmarks.sql";

/** URLs spelled the ways stored bookmarks spell them, each with the address it reduces to. */
const ADDRESSES: Array<[string, string]> = [
	["https://www.seangoedecke.com/good-api-design/", "seangoedecke.com/good-api-design"],
	["https://nomeatproxy.com", "nomeatproxy.com"],
	["http://www.sarahmei.com/blog/2013/11/11/x/", "sarahmei.com/blog/2013/11/11/x"],
	["https://Noti.st/sturobson/yc1gwN/design#saPZSRV", "noti.st/sturobson/yc1gwN/design#saPZSRV"],
	["https://www.youtube.com/watch?v=4KvbVq3Eg5w", "youtube.com/watch?v=4KvbVq3Eg5w"],
	["https://example.com?ref=a/b", "example.com?ref=a/b"],
	["HTTPS://WWW.EXAMPLE.COM/Path/", "example.com/Path"],
	["/articles/local", "/articles/local"],
];

describe("LikePost.address", () => {
	test("reduces every spelling of a URL to the address duplicates are judged by", () => {
		for (let [url, address] of ADDRESSES) expect(LikePost.address(url)).toBe(address);
	});

	test("gives a cleaned URL the address of the URL stored before it", () => {
		expect(LikePost.address(LikePost.clean("nomeatproxy.com"))).toBe(
			LikePost.address("https://nomeatproxy.com"),
		);
		expect(LikePost.address(LikePost.clean("https://EXAMPLE.com/a?utm_source=x"))).toBe(
			LikePost.address("https://example.com/a"),
		);
	});
});

describe("LikePost.waybackSnapshotUrl", () => {
	test("names the moment with the archive's fourteen-digit timestamp", () => {
		expect(LikePost.waybackSnapshotUrl("https://example.com/a", "2026-10-07T15:30:45.123Z")).toBe(
			"https://web.archive.org/web/20261007153045/https://example.com/a",
		);
		expect(LikePost.waybackSnapshotUrl("https://example.com/a", "not a date")).toBeNull();
	});
});

describe("LikePost.clean", () => {
	test("removes tracking parameters and keeps the rest of the query", () => {
		expect(
			LikePost.clean("https://example.com/a?utm_source=feed&id=7&fbclid=x&UTM_Medium=y#top"),
		).toBe("https://example.com/a?id=7#top");
		expect(LikePost.clean("https://example.com/a?utm_source=feed")).toBe("https://example.com/a");
	});

	test("reads a bare host as https and leaves a site path alone", () => {
		expect(LikePost.clean("  example.com/post ")).toBe("https://example.com/post");
		expect(LikePost.clean("/articles/local")).toBe("/articles/local");
	});
});

describe("Bookmark.claim", () => {
	test("gives an address to one bookmark only", async () => {
		let db = await testDatabase();
		let author = await seedAuthor(db);
		let first = await LikePost.create(db, {
			author_id: author,
			meta: { title: "One", url: "https://example.com/a" },
		});
		let second = await LikePost.create(db, {
			author_id: author,
			meta: { title: "Two", url: "https://example.com/a" },
		});
		if (!first || !second) throw new Error("Seeding failed");

		expect(await Bookmark.claim(db, first.id, "example.com/a", null)).toBe(true);
		expect(await Bookmark.claim(db, second.id, "example.com/a", null)).toBe(false);
		expect((await Bookmark.findByAddress(db, "example.com/a"))?.post_id).toBe(first.id);
	});

	test("releases the address when the bookmark is deleted", async () => {
		let db = await testDatabase();
		let author = await seedAuthor(db);
		let bookmark = await LikePost.create(db, {
			author_id: author,
			meta: { title: "One", url: "https://example.com/a" },
		});
		if (!bookmark) throw new Error("Seeding failed");
		await Bookmark.claim(db, bookmark.id, "example.com/a", null);

		await LikePost.destroy(db, bookmark.id);

		expect(await Bookmark.findByAddress(db, "example.com/a")).toBeNull();
	});
});

describe(BOOKMARKS_MIGRATION, () => {
	test("computes every address as LikePost.address does", async () => {
		let binding = createD1Database();
		await applyMigrations(binding, (file) => file < BOOKMARKS_MIGRATION);
		let db = new Database(createD1DatabaseAdapter(binding));
		let author = await seedAuthor(db);

		let ids: string[] = [];
		for (let [url] of ADDRESSES) {
			let created = await LikePost.create(db, {
				author_id: author,
				meta: { title: url, url },
			});
			ids.push(created?.id ?? "");
		}

		await applyMigrations(binding, (file) => file === BOOKMARKS_MIGRATION);

		for (let [index, [url]] of ADDRESSES.entries()) {
			let record = await Bookmark.findByPostId(db, ids[index] ?? "");
			expect(record?.address, url).toBe(LikePost.address(url));
		}
	});

	test("keeps the oldest of two bookmarks of one page and tombstones the other", async () => {
		let binding = createD1Database();
		await applyMigrations(binding, (file) => file < BOOKMARKS_MIGRATION);
		let db = new Database(createD1DatabaseAdapter(binding));
		let author = await seedAuthor(db);

		let older = await LikePost.create(db, {
			author_id: author,
			created_at: "2020-08-23T05:18:46.000Z",
			meta: {
				title: "How to Section Your HTML",
				url: "https://css-tricks.com/how-to-section-your-html/",
			},
		});
		let newer = await LikePost.create(db, {
			author_id: author,
			created_at: "2022-09-02T15:54:14.000Z",
			meta: {
				title: "How to Section Your HTML",
				url: "http://www.css-tricks.com/how-to-section-your-html",
			},
		});
		let unrelated = await LikePost.create(db, {
			author_id: author,
			meta: { title: "Other", url: "https://example.com/other" },
		});

		await applyMigrations(binding, (file) => file === BOOKMARKS_MIGRATION);

		let live = new Set((await LikePost.findAll(db)).map((bookmark) => bookmark.id));
		expect(live).toEqual(new Set([older?.id, unrelated?.id]));
		expect(
			(await Bookmark.findByAddress(db, "css-tricks.com/how-to-section-your-html"))?.post_id,
		).toBe(older?.id);
		expect(await Bookmark.findByPostId(db, newer?.id ?? "")).toBeNull();
	});
});
