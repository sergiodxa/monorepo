/**
 * Tests the grouping the rail is drawn from: which folder each feed lands under, what a
 * folder's heading counts, and the order both read in. The counts and the grouping both
 * come off one list, so what is asserted here is that a heading can never say a number the
 * rows beneath it disagree with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { CachedFeed } from "~/app/http/controllers/chrome";

import { groupByFolder } from "~/app/http/controllers/chrome";

/**
 * One feed as the rail's cache holds it.
 *
 * @param title - The feed's name, which orders it among the others.
 * @param unreadCount - How many of its posts are waiting.
 * @param folder - The folder it is filed in, or nothing for an unfiled feed.
 */
function feed(
	title: string,
	unreadCount: number,
	folder?: { id: string; title: string },
): CachedFeed {
	return {
		id: `feed-${title}`,
		title,
		unreadCount,
		imageUrl: null,
		folderId: folder?.id ?? null,
		folderTitle: folder?.title ?? null,
		pinnedAt: null,
		postsPerDay: null,
	};
}

const TECH = { id: "folder-tech", title: "Tech" };
const NEWS = { id: "folder-news", title: "News" };

describe(groupByFolder, () => {
	test("counts a folder as the sum of the feeds filed in it", () => {
		let { folders } = groupByFolder(
			[feed("Rust Blog", 4, TECH), feed("Daily", 3, NEWS), feed("Weekly", 7, TECH)],
			"en",
		);

		expect(folders.map((folder) => [folder.title, folder.unreadCount])).toEqual([
			["News", 3],
			["Tech", 11],
		]);

		// The number above the rows is the rows added up, so the two cannot disagree.
		let tech = folders[1];
		expect(tech?.feeds.map((row) => row.unreadCount)).toEqual([4, 7]);
		expect(tech?.unreadCount).toBe(
			(tech?.feeds ?? []).reduce((total, row) => total + row.unreadCount, 0),
		);
	});

	test("moves a feed's count to the folder it was filed into", () => {
		let before = groupByFolder([feed("Rust Blog", 4, TECH), feed("Daily", 3, NEWS)], "en");
		let after = groupByFolder([feed("Rust Blog", 4, NEWS), feed("Daily", 3, NEWS)], "en");

		expect(before.folders.map((folder) => folder.unreadCount)).toEqual([3, 4]);
		expect(after.folders.map((folder) => [folder.title, folder.unreadCount])).toEqual([
			["News", 7],
		]);
	});

	test("leaves the feeds filed nowhere below the folders, in the order their names read", () => {
		let { folders, unfiled } = groupByFolder(
			[feed("Zebra", 1), feed("Rust Blog", 4, TECH), feed("Ábaco", 2)],
			"es",
		);

		expect(folders.map((folder) => folder.title)).toEqual(["Tech"]);
		expect(unfiled.map((row) => row.title)).toEqual(["Ábaco", "Zebra"]);
	});

	test("draws no folder for a reader who has filed nothing", () => {
		let { folders, unfiled } = groupByFolder([feed("Zebra", 1)], "en");

		expect(folders).toEqual([]);
		expect(unfiled).toHaveLength(1);
	});
});
