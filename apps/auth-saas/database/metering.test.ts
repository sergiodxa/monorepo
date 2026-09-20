/**
 * Exercises `metering.ts` directly against a `Database` over a real
 * SQLite-backed `SqlStorage`, the way `mail-rate-limit.test.ts` drives its own
 * leaf module: a cache hit never touches storage, a cache miss counts and can
 * trip a hard cap, and a subject already counted today is never refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
	closeMeteringDay,
	createDauCache,
	dauSeen,
	dayOf,
	readUsage,
	recordAuthentication,
} from "./metering";
import dauMigration from "./tenant-migrations/0013-dau.sql?raw";

const DAY_MS = 24 * 60 * 60 * 1000;
const START = 1_700_000_000_000;

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await driver.executeScript(dauMigration);
	db = new Database(driver);

	vi.useFakeTimers();
	vi.setSystemTime(START);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("recordAuthentication", () => {
	test("a cache miss on a fresh day counts a genuinely new subject", async () => {
		let cache = createDauCache();

		let result = await recordAuthentication(db, cache, {
			subjectId: "sub_1",
			cap: 100,
			hard: false,
		});

		expect(result).toEqual({ ok: true, day: dayOf(START), subjects: 1, cap: 100, notice: "none" });
	});

	test("a cache hit doesn't touch the day count", async () => {
		let cache = createDauCache();

		await recordAuthentication(db, cache, { subjectId: "sub_1", cap: 100, hard: false });
		let second = await recordAuthentication(db, cache, {
			subjectId: "sub_1",
			cap: 100,
			hard: false,
		});

		expect(second).toEqual({ ok: true, day: dayOf(START), subjects: 1, cap: 100, notice: "none" });

		let seen = await db.findMany(dauSeen);
		expect(seen).toHaveLength(1);
	});

	test("a cache miss on a fresh day increments and can trip hard refusal at the cap", async () => {
		let cache = createDauCache();

		let first = await recordAuthentication(db, cache, { subjectId: "sub_1", cap: 2, hard: true });
		expect(first).toMatchObject({ ok: true, subjects: 1 });

		let second = await recordAuthentication(db, cache, { subjectId: "sub_2", cap: 2, hard: true });
		expect(second).toMatchObject({ ok: true, subjects: 2, notice: "reached" });

		let third = await recordAuthentication(db, cache, { subjectId: "sub_3", cap: 2, hard: true });
		expect(third).toEqual({ ok: false, day: dayOf(START), subjects: 2, cap: 2 });
	});

	test("a refused subject is judged fresh again once the cap lifts", async () => {
		let cache = createDauCache();

		await recordAuthentication(db, cache, { subjectId: "sub_1", cap: 1, hard: true });
		let refused = await recordAuthentication(db, cache, { subjectId: "sub_2", cap: 1, hard: true });
		expect(refused.ok).toBe(false);

		let retried = await recordAuthentication(db, cache, { subjectId: "sub_2", cap: 2, hard: true });
		expect(retried).toMatchObject({ ok: true, subjects: 2 });
	});

	test("a subject already counted today is never refused even past the cap, from the cache", async () => {
		let cache = createDauCache();

		await recordAuthentication(db, cache, { subjectId: "sub_1", cap: 1, hard: true });

		let again = await recordAuthentication(db, cache, { subjectId: "sub_1", cap: 1, hard: true });
		expect(again).toMatchObject({ ok: true, subjects: 1 });
	});

	test("a subject already counted today is never refused even past the cap, after the cache is rebuilt", async () => {
		let firstCache = createDauCache();
		await recordAuthentication(db, firstCache, { subjectId: "sub_1", cap: 1, hard: true });

		// A fresh cache the way a rebuilt object starts with — the subject is
		// still in `dau_seen` from before, so it is not a genuinely new subject.
		let rebuiltCache = createDauCache();
		let again = await recordAuthentication(db, rebuiltCache, {
			subjectId: "sub_1",
			cap: 1,
			hard: true,
		});

		expect(again).toMatchObject({ ok: true, subjects: 1 });
	});

	test("day rollover resets the cache and prunes dau_seen outside the retained window", async () => {
		let cache = createDauCache();
		let day = dayOf(START);

		await recordAuthentication(db, cache, { subjectId: "sub_1", cap: 100, hard: false });
		expect(cache.subjects.has("sub_1")).toBe(true);

		vi.setSystemTime(START + 2 * DAY_MS);
		let result = await recordAuthentication(db, cache, {
			subjectId: "sub_2",
			cap: 100,
			hard: false,
		});

		expect(result).toMatchObject({ day: day + 2, subjects: 1 });
		expect(cache.day).toBe(day + 2);
		expect(cache.subjects.has("sub_1")).toBe(false);

		let seen = await db.findMany(dauSeen);
		expect(seen.map((row) => row.day)).not.toContain(day);
	});
});

describe("closeMeteringDay", () => {
	test("marks the day closed and answers the same figures on a second call", async () => {
		let cache = createDauCache();
		let day = dayOf(START);

		await recordAuthentication(db, cache, { subjectId: "sub_1", cap: 100, hard: false });
		await recordAuthentication(db, cache, { subjectId: "sub_2", cap: 100, hard: false });

		let first = await closeMeteringDay(db, { day });
		expect(first).toEqual({ day, subjects: 2, sessions: 0, tokens: 0 });

		let second = await closeMeteringDay(db, { day });
		expect(second).toEqual(first);
	});

	test("closes a day with no rows at all, at zero", async () => {
		let closed = await closeMeteringDay(db, { day: dayOf(START) + 30 });
		expect(closed).toEqual({ day: dayOf(START) + 30, subjects: 0, sessions: 0, tokens: 0 });
	});
});

describe("readUsage", () => {
	test("reads the day rows in an inclusive range, oldest first", async () => {
		let cache = createDauCache();
		let day = dayOf(START);

		await recordAuthentication(db, cache, { subjectId: "sub_1", cap: 100, hard: false });
		await closeMeteringDay(db, { day });

		vi.setSystemTime(START + DAY_MS);
		await recordAuthentication(db, cache, { subjectId: "sub_2", cap: 100, hard: false });
		await closeMeteringDay(db, { day: day + 1 });

		vi.setSystemTime(START + 10 * DAY_MS);
		await recordAuthentication(db, cache, { subjectId: "sub_3", cap: 100, hard: false });
		await closeMeteringDay(db, { day: day + 10 });

		let usage = await readUsage(db, { from: day, to: day + 1 });

		expect(usage).toEqual([
			{ day, subjects: 1, sessions: 0, tokens: 0 },
			{ day: day + 1, subjects: 1, sessions: 0, tokens: 0 },
		]);
	});
});
