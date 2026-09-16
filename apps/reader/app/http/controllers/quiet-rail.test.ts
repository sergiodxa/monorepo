/**
 * The bands the rail draws its feeds in, which is a partition of the list the page has
 * already read rather than a question asked of the reader's object.
 *
 * What is asserted here is the half of the grouping this app decides: that the pinned band
 * and the quiet band both come off the same rows the rail was going to draw anyway, and
 * that a reader's own grouping wins over the derived one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { CachedFeed } from "~/app/http/controllers/chrome";

import { groupByFolder } from "~/app/http/controllers/chrome";
import { QUIET_POSTS_PER_DAY } from "~/database/schema";

/** A feed as the rail holds it, with everything but what the test is about left neutral. */
function feed(title: string, overrides: Partial<CachedFeed> = {}): CachedFeed {
	return {
		id: `feed-${title}`,
		title,
		unreadCount: 0,
		imageUrl: null,
		folderId: null,
		folderTitle: null,
		pinnedAt: null,
		postsPerDay: null,
		...overrides,
	};
}

/** A monthly newsletter, which is the rate the quiet group exists for. */
const MONTHLY = 1 / 30;

/** Twice a week, which is the rate just the other side of the line. */
const TWICE_WEEKLY = 2 / 7;

describe("the bands the rail draws", () => {
	/**
	 * The rail already reads every subscription, so a pin is a predicate over rows in
	 * memory. Nothing here asks a store anything, which is the property under test.
	 */
	test("partitions the rows the rail already read, asking nothing else", () => {
		let { pinned, unfiled, quiet, folders } = groupByFolder(
			[
				feed("Daily", { unreadCount: 4 }),
				feed("Kept", { pinnedAt: 1, unreadCount: 2 }),
				feed("Monthly", { postsPerDay: MONTHLY, unreadCount: 1 }),
			],
			"en",
		);

		expect(pinned.map((one) => one.title)).toEqual(["Kept"]);
		expect(unfiled.map((one) => one.title)).toEqual(["Daily"]);
		expect(quiet.map((one) => one.title)).toEqual(["Monthly"]);
		expect(folders).toEqual([]);
	});

	test("counts a feed under one heading and no other", () => {
		let rows = [
			feed("Kept", { pinnedAt: 1 }),
			feed("Filed", { folderId: "folder-1", folderTitle: "Work" }),
			feed("Monthly", { postsPerDay: MONTHLY }),
			feed("Daily", { postsPerDay: 3 }),
		];

		let { pinned, unfiled, quiet, folders } = groupByFolder(rows, "en");
		let drawn = [...pinned, ...unfiled, ...quiet, ...folders.flatMap((one) => one.feeds)];

		expect(drawn).toHaveLength(rows.length);
		expect(new Set(drawn.map((one) => one.id)).size).toBe(rows.length);
	});

	test("puts a feed under one post a week in the quiet band", () => {
		let { quiet, unfiled } = groupByFolder(
			[
				feed("Monthly", { postsPerDay: MONTHLY }),
				feed("Weekly", { postsPerDay: QUIET_POSTS_PER_DAY }),
				feed("Twice weekly", { postsPerDay: TWICE_WEEKLY }),
			],
			"en",
		);

		expect(quiet.map((one) => one.title)).toEqual(["Monthly"]);
		expect(unfiled.map((one) => one.title)).toEqual(["Twice weekly", "Weekly"]);
	});

	/**
	 * An explicit choice beats a derived one: a derived group that moved a feed out of the
	 * folder somebody put it in would be a feature arguing with its user.
	 */
	test("never moves a pinned or filed feed into the quiet band, however little it publishes", () => {
		let { quiet, pinned, folders } = groupByFolder(
			[
				feed("Pinned", { pinnedAt: 1, postsPerDay: MONTHLY }),
				feed("Filed", { folderId: "folder-1", folderTitle: "Work", postsPerDay: MONTHLY }),
			],
			"en",
		);

		expect(quiet).toEqual([]);
		expect(pinned.map((one) => one.title)).toEqual(["Pinned"]);
		expect(folders[0]?.feeds.map((one) => one.title)).toEqual(["Filed"]);
	});

	/** A feed nobody has measured is not known to be quiet, so it is drawn where it was. */
	test("leaves a feed with no measurement among the unfiled", () => {
		let { quiet, unfiled } = groupByFolder([feed("Unknown")], "en");

		expect(quiet).toEqual([]);
		expect(unfiled.map((one) => one.title)).toEqual(["Unknown"]);
	});
});
