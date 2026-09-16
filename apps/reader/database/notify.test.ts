/**
 * The rules a notification is decided by, against a real SQLite: what a summary counts,
 * what the minimum gap bounds, when a quiet window is open, and what a push service's
 * answer means for the device it answered about.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSqlStorage } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { beforeEach, describe, expect, test } from "vitest";

import type { SelectSettings } from "~/database/schema";

import { runMigrations } from "~/database/migrations";
import {
	EMAIL_GAP_MS,
	gapFor,
	insideQuietHours,
	localHour,
	pushOutcome,
	PUSH_GAP_MS,
	summarize,
} from "~/database/notify";

let sql: ReturnType<typeof createSqlStorage>;
let db: Awaited<ReturnType<typeof migrate>>;

/** Applies the schema and hands back a database over it, the way the object opens one. */
async function migrate() {
	let { Database } = await import("remix/data-table");
	let adapter = createSQLStorageDatabaseAdapter(sql);
	await runMigrations(adapter);

	return new Database(adapter, { now: () => Date.now() });
}

beforeEach(async () => {
	sql = createSqlStorage();
	db = await migrate();
});

/** A subscription, opted in or not, written straight into storage. */
function seedFeed(id: string, title: string, notify: boolean, unfollowed: number | null = null) {
	sql.exec(
		`INSERT INTO feeds (id, feed_id, feed_url, title, notify, unfollowed_at, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
		id,
		`canonical-${id}`,
		`https://example.com/${id}`,
		title,
		notify ? 1 : 0,
		unfollowed,
	);
}

/** A post this object wrote at a given moment, which is what a summary counts. */
function seedItem(id: string, feedId: string, writtenAt: number) {
	sql.exec(
		`INSERT INTO feed_items (id, feed_id, guid, title, published_at, created_at, updated_at)
		 VALUES (?, ?, ?, 'post', 0, ?, ?)`,
		id,
		feedId,
		id,
		writtenAt,
		writtenAt,
	);
}

/** A settings row with only the notification columns a rule reads filled in. */
function settingsRow(overrides: Partial<SelectSettings> = {}): SelectSettings {
	return {
		id: 1,
		subject: "sub",
		last_refreshed_at: null,
		tier: "premium",
		tier_source: "billing",
		grace_until: null,
		tier_checked_at: 0,
		last_opened_at: null,
		next_check_at: null,
		next_sweep_at: null,
		next_catch_up_at: null,
		notify_push: true,
		notify_email: false,
		time_zone: "UTC",
		quiet_hours: false,
		quiet_from: 22,
		quiet_to: 7,
		last_notified_at: null,
		email: null,
		created_at: 0,
		updated_at: 0,
		...overrides,
	} as SelectSettings;
}

describe("the derived summary", () => {
	test("counts rows this object wrote since the last notification, from opted-in feeds", async () => {
		seedFeed("f1", "Alpha", true);
		seedFeed("f2", "Beta", false);

		seedItem("i1", "f1", 200);
		seedItem("i2", "f1", 300);
		seedItem("i3", "f2", 300);

		/** Written before the last notification, so it belongs to one already sent. */
		seedItem("i0", "f1", 50);

		let summary = await summarize(db, 100);

		expect(summary.posts).toBe(2);
		expect(summary.feeds).toBe(1);
		expect(summary.titles).toEqual(["Alpha"]);
	});

	test("counts nothing when every post came from a feed that is not opted in", async () => {
		seedFeed("f1", "Alpha", false);
		seedItem("i1", "f1", 200);

		expect((await summarize(db, 0)).posts).toBe(0);
	});

	/**
	 * A post that a velocity dropped on the way in, and a feed that back-pressure paused,
	 * leave no row. The count is of rows rather than of what a head implied, so neither can
	 * name a post the reader does not have.
	 */
	test("counts no post that never became a row", async () => {
		seedFeed("f1", "Alpha", true);

		expect((await summarize(db, 0)).posts).toBe(0);
	});

	test("leaves out a feed the reader stopped following", async () => {
		seedFeed("f1", "Alpha", true, 500);
		seedItem("i1", "f1", 200);

		expect((await summarize(db, 0)).posts).toBe(0);
	});

	test("names at most three feeds however many the posts came from", async () => {
		for (let index = 0; index < 9; index++) {
			seedFeed(`f${index}`, `Feed ${index}`, true);
			for (let post = 0; post < 5; post++) seedItem(`i${index}-${post}`, `f${index}`, 200);
		}

		let summary = await summarize(db, 0);

		expect(summary.posts).toBe(45);
		expect(summary.feeds).toBe(9);
		expect(summary.titles).toHaveLength(3);
	});

	/** A single post crosses it: a threshold silences exactly the feeds worth a notification. */
	test("reports a single post rather than waiting for a count to build", async () => {
		seedFeed("f1", "Alpha", true);
		seedItem("i1", "f1", 200);

		expect((await summarize(db, 0)).posts).toBe(1);
	});
});

describe("the minimum gap", () => {
	test("bounds push at fifteen minutes and email at four hours", () => {
		expect(gapFor(["push"])).toBe(PUSH_GAP_MS);
		expect(gapFor(["email"])).toBe(EMAIL_GAP_MS);
	});

	/**
	 * One timestamp gates one notification and a notification goes out on every channel at
	 * once, so the slower channel is what bounds the pair — which is what keeps email cost a
	 * function of how many hours are in a month.
	 */
	test("holds both channels to the slower of them", () => {
		expect(gapFor(["push", "email"])).toBe(EMAIL_GAP_MS);
	});
});

describe("quiet hours", () => {
	/** Midnight UTC, which every hour below is an offset from. */
	const MIDNIGHT = Date.UTC(2026, 0, 15, 0, 0, 0);

	/** That moment, moved on by whole hours. */
	function at(hour: number): number {
		return MIDNIGHT + hour * 60 * 60 * 1000;
	}

	test("reads the hour in the stored zone rather than in UTC", () => {
		expect(localHour(at(3), "UTC")).toBe(3);
		expect(localHour(at(3), "America/Argentina/Buenos_Aires")).toBe(0);
	});

	test("falls back to UTC for a zone the platform does not know", () => {
		expect(localHour(at(3), "Mars/Olympus")).toBe(3);
	});

	/**
	 * The window wraps midnight, which is the shape every default one has: a reader asking
	 * to be left alone from ten at night until seven is asking about two calendar days.
	 */
	test("applies a window that wraps midnight", () => {
		let row = settingsRow({ quiet_hours: true, quiet_from: 22, quiet_to: 7 });

		expect(insideQuietHours(at(23), row)).toBe(true);
		expect(insideQuietHours(at(3), row)).toBe(true);
		expect(insideQuietHours(at(9), row)).toBe(false);
	});

	test("applies a window inside one day", () => {
		let row = settingsRow({ quiet_hours: true, quiet_from: 9, quiet_to: 17 });

		expect(insideQuietHours(at(12), row)).toBe(true);
		expect(insideQuietHours(at(20), row)).toBe(false);
	});

	test("leaves every hour open until the reader turns the window on", () => {
		let row = settingsRow({ quiet_hours: false, quiet_from: 22, quiet_to: 7 });

		expect(insideQuietHours(at(23), row)).toBe(false);
	});

	/**
	 * A zone the platform does not recognize reads as UTC rather than taking the window
	 * away: a wrong zone should cost a notification at an odd hour, never one that never
	 * arrives.
	 */
	test("keeps the window in UTC rather than disabling it when the zone is unknown", () => {
		let row = settingsRow({ quiet_hours: true, time_zone: "", quiet_from: 22, quiet_to: 7 });

		expect(insideQuietHours(at(23), row)).toBe(true);
	});

	/**
	 * A stored zone is a name rather than an offset, so the platform moves the window with
	 * the clocks: eleven at night in Madrid is inside it in January and in July alike.
	 */
	test("stays correct across a daylight-saving change", () => {
		let row = settingsRow({ quiet_hours: true, time_zone: "Europe/Madrid", quiet_from: 22 });

		let winter = Date.UTC(2026, 0, 15, 22, 30, 0);
		let summer = Date.UTC(2026, 6, 15, 21, 30, 0);

		expect(localHour(winter, "Europe/Madrid")).toBe(23);
		expect(localHour(summer, "Europe/Madrid")).toBe(23);
		expect(insideQuietHours(winter, row)).toBe(true);
		expect(insideQuietHours(summer, row)).toBe(true);
	});
});

describe("what a push service's answer means", () => {
	test("takes an acceptance, a revocation, a refusal and a broken service apart", () => {
		expect(pushOutcome(201)).toBe("accepted");
		expect(pushOutcome(202)).toBe("accepted");
		expect(pushOutcome(410)).toBe("expired");
		expect(pushOutcome(404)).toBe("expired");
		expect(pushOutcome(429)).toBe("transient");
		expect(pushOutcome(503)).toBe("transient");

		/** Our own signature being wrong, which no reader's device should be deleted for. */
		expect(pushOutcome(403)).toBe("rejected");
		expect(pushOutcome(400)).toBe("rejected");
	});
});
