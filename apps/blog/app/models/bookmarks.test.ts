/**
 * Pins what makes two URLs one bookmark: the cleaning a URL gets before it is stored, the
 * address duplicates are judged by, and the migration that computes the same address in
 * SQL for the bookmarks saved before it, keeping the oldest of every duplicate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1Database } from "@sdxc/cloudflare-mocks";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { bookmarkAddress, cleanUrl, waybackSnapshotUrl } from "~/app/models/post-values";
import { openDatabase } from "~/app/services/database";
import { testDatabase } from "~/app/test/database";
import { applyMigrations, seedAuthor } from "~/app/test/fixtures";
import { bindModels } from "~/app/test/models";

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

describe("bookmarkAddress", () => {
	test("reduces every spelling of a URL to the address duplicates are judged by", () => {
		for (let [url, address] of ADDRESSES) expect(bookmarkAddress(url)).toBe(address);
	});

	test("gives a cleaned URL the address of the URL stored before it", () => {
		expect(bookmarkAddress(cleanUrl("nomeatproxy.com"))).toBe(
			bookmarkAddress("https://nomeatproxy.com"),
		);
		expect(bookmarkAddress(cleanUrl("https://EXAMPLE.com/a?utm_source=x"))).toBe(
			bookmarkAddress("https://example.com/a"),
		);
	});
});

describe("waybackSnapshotUrl", () => {
	test("names the moment with the archive's fourteen-digit timestamp", () => {
		expect(waybackSnapshotUrl("https://example.com/a", "2026-10-07T15:30:45.123Z")).toBe(
			"https://web.archive.org/web/20261007153045/https://example.com/a",
		);
		expect(waybackSnapshotUrl("https://example.com/a", "not a date")).toBeNull();
	});
});

describe("cleanUrl", () => {
	test("removes tracking parameters and keeps the rest of the query", () => {
		expect(cleanUrl("https://example.com/a?utm_source=feed&id=7&fbclid=x&UTM_Medium=y#top")).toBe(
			"https://example.com/a?id=7#top",
		);
		expect(cleanUrl("https://example.com/a?utm_source=feed")).toBe("https://example.com/a");
	});

	test("reads a bare host as https and leaves a site path alone", () => {
		expect(cleanUrl("  example.com/post ")).toBe("https://example.com/post");
		expect(cleanUrl("/articles/local")).toBe("/articles/local");
	});
});

describe("bookmarks.claim", () => {
	test("gives an address to one bookmark only", async () => {
		let db = await testDatabase();
		let author = await seedAuthor(db);
		let first = unwrap(
			await bindModels(db).likes.create({
				author_id: author,
				meta: { title: "One", url: "https://example.com/a" },
			}),
		);
		let second = unwrap(
			await bindModels(db).likes.create({
				author_id: author,
				meta: { title: "Two", url: "https://example.com/a" },
			}),
		);
		if (!first || !second) throw new Error("Seeding failed");

		expect(await bindModels(db).bookmarks.claim(first.id, "example.com/a", null)).toBe(true);
		expect(await bindModels(db).bookmarks.claim(second.id, "example.com/a", null)).toBe(false);
		expect((await bindModels(db).bookmarks.findByAddress("example.com/a"))?.post_id).toBe(first.id);
	});

	test("releases the address when the bookmark is deleted", async () => {
		let db = await testDatabase();
		let author = await seedAuthor(db);
		let bookmark = unwrap(
			await bindModels(db).likes.create({
				author_id: author,
				meta: { title: "One", url: "https://example.com/a" },
			}),
		);
		if (!bookmark) throw new Error("Seeding failed");
		await bindModels(db).bookmarks.claim(bookmark.id, "example.com/a", null);

		await bindModels(db).likes.destroy(bookmark.id);

		expect(await bindModels(db).bookmarks.findByAddress("example.com/a")).toBeNull();
	});
});

describe(BOOKMARKS_MIGRATION, () => {
	test("computes every address as bookmarkAddress does", async () => {
		let binding = createD1Database();
		await applyMigrations(binding, (file) => file < BOOKMARKS_MIGRATION);
		let db = openDatabase(binding);
		let author = await seedAuthor(db);

		let ids: string[] = [];
		for (let [url] of ADDRESSES) {
			let created = unwrap(
				await bindModels(db).likes.create({
					author_id: author,
					meta: { title: url, url },
				}),
			);
			ids.push(created?.id ?? "");
		}

		await applyMigrations(binding, (file) => file === BOOKMARKS_MIGRATION);

		for (let [index, [url]] of ADDRESSES.entries()) {
			let record = await bindModels(db).bookmarks.find(ids[index] ?? "");
			expect(record?.address, url).toBe(bookmarkAddress(url));
		}
	});

	test("keeps the oldest of two bookmarks of one page and tombstones the other", async () => {
		let binding = createD1Database();
		await applyMigrations(binding, (file) => file < BOOKMARKS_MIGRATION);
		let db = openDatabase(binding);
		let author = await seedAuthor(db);

		let older = unwrap(
			await bindModels(db).likes.create({
				author_id: author,
				created_at: "2020-08-23T05:18:46.000Z",
				meta: {
					title: "How to Section Your HTML",
					url: "https://css-tricks.com/how-to-section-your-html/",
				},
			}),
		);
		let newer = unwrap(
			await bindModels(db).likes.create({
				author_id: author,
				created_at: "2022-09-02T15:54:14.000Z",
				meta: {
					title: "How to Section Your HTML",
					url: "http://www.css-tricks.com/how-to-section-your-html",
				},
			}),
		);
		let unrelated = unwrap(
			await bindModels(db).likes.create({
				author_id: author,
				meta: { title: "Other", url: "https://example.com/other" },
			}),
		);

		await applyMigrations(binding, (file) => file === BOOKMARKS_MIGRATION);
		await applyMigrations(binding, (file) => file > BOOKMARKS_MIGRATION);

		let live = new Set((await bindModels(db).likes.findAll()).map((bookmark) => bookmark.id));
		expect(live).toEqual(new Set([older?.id, unrelated?.id]));
		expect(
			(await bindModels(db).bookmarks.findByAddress("css-tricks.com/how-to-section-your-html"))
				?.post_id,
		).toBe(older?.id);
		expect(await bindModels(db).bookmarks.find(newer?.id ?? "")).toBeNull();
	});
});
