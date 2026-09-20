/**
 * The daily active user meter: `dau_seen` and `dau_day`, and the operations over
 * them. A distinct subject counts once a UTC day; the object instance's own
 * `DauCache` answers a repeat authentication without touching storage, and only
 * a genuinely new subject reaches `dau_seen`. Leaf module — imports nothing else
 * under `database/`, the way `mail-rate-limit.ts` does — since nothing here
 * needs to reach another tenant table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { between, column as c, lt, sql, table } from "remix/data-table";

/** One UTC day, in milliseconds. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Days a `dau_seen` row survives past the day it was written for, so a late close still finds it. */
const RETAINED_DAYS = 1;

/** The fraction of the cap at which a tenant is warned before it is reached. */
const APPROACHING_THRESHOLD = 0.8;

/** Which subjects have already authenticated on a given day, kept just long enough for a late close. */
export const dauSeen = table({
	name: "dau_seen",
	primaryKey: ["day", "subject"],
	columns: {
		day: c.integer(),
		subject: c.text(),
	},
});

/** One day's tally: how many distinct subjects, sessions and tokens it saw, and whether it is closed. */
export const dauDay = table({
	name: "dau_day",
	primaryKey: ["day"],
	columns: {
		day: c.integer(),
		subjects: c.integer().default(0),
		sessions: c.integer().default(0),
		tokens: c.integer().default(0),
		notices: c.integer().default(0),
		closed: c.boolean().default(false),
	},
});

export type DauSeenRow = TableRow<typeof dauSeen>;
export type DauDayRow = TableRow<typeof dauDay>;

/** The object instance's own record of which subjects today has already counted. */
export interface DauCache {
	day: number;
	subjects: Set<string>;
}

/** Builds an empty cache for a freshly constructed object, its first authentication filling it in. */
export function createDauCache(): DauCache {
	return { day: -1, subjects: new Set() };
}

/** The day a moment in time falls on, as the integer every meter table keys on. */
export function dayOf(epochMs: number): number {
	return Math.floor(epochMs / DAY_MS);
}

export type DauNotice = "none" | "approaching" | "reached";

export interface RecordAuthenticationInput {
	subjectId: string;
	/** The tenant's currently enforced cap. */
	cap: number;
	/** Whether the cap refuses a genuinely new subject once reached, rather than only reporting it. */
	hard: boolean;
	now?: number;
}

export type RecordAuthenticationResult =
	| { ok: true; day: number; subjects: number; cap: number; notice: DauNotice }
	| { ok: false; day: number; subjects: number; cap: number };

/** The notice a subject count against a cap has earned so far today. */
function noticeFor(subjects: number, cap: number): DauNotice {
	if (cap <= 0) return "none";
	if (subjects >= cap) return "reached";
	if (subjects >= cap * APPROACHING_THRESHOLD) return "approaching";
	return "none";
}

/** Deletes `dau_seen` rows for every day outside the window a late close might still need. */
async function pruneDauSeen(db: Database, day: number): Promise<void> {
	await db.deleteMany(dauSeen, { where: lt("day", day - RETAINED_DAYS) });
}

/** The day's row, created with every counter at zero the first time anything asks for it. */
async function ensureDauDayRow(db: Database, day: number): Promise<DauDayRow> {
	let row = await db.find(dauDay, { day });
	if (row) return row;

	return db.create(
		dauDay,
		{ day, subjects: 0, sessions: 0, tokens: 0, notices: 0, closed: false },
		{ returnRow: true },
	);
}

/** `{ ok: true, ... }` from a day row and the cap it is judged against. */
function report(row: DauDayRow, cap: number): RecordAuthenticationResult {
	return {
		ok: true,
		day: row.day,
		subjects: row.subjects,
		cap,
		notice: noticeFor(row.subjects, cap),
	};
}

/**
 * Records one authentication against the day's distinctness meter: a cache hit
 * costs nothing beyond reading the day's own row back; a cache miss inserts into
 * `dau_seen` and, only for a genuinely new subject, bumps `dau_day.subjects` —
 * the insert and the bump run with no other write between them, so two
 * closely-timed requests for the same subject can never double-count it.
 *
 * A subject already counted today always proceeds, even past a hard cap. A
 * genuinely new subject that would take a hard-capped tenant past its cap is
 * refused and left out of `dau_seen`, so the very next attempt — once the cap
 * lifts or the day rolls over — is judged fresh rather than remembered as spent.
 *
 * `dau_day.notices` records the highest notice this day has earned, once, so a
 * future notifier reading it back knows whether it already sent the warning or
 * the cap email for today without sending either one here.
 *
 * @param db - The tenant's database.
 * @param cache - This object instance's own record of today's subjects; rolled
 * over to a fresh set, and `dau_seen` pruned, the first time a call's day differs
 * from what it already held.
 * @param input - The subject authenticating, the cap and whether it is hard, and
 * the clock to measure the day against.
 * @returns The day's figures once counted, or that a hard cap refused this
 * subject a place in today's count.
 */
export async function recordAuthentication(
	db: Database,
	cache: DauCache,
	input: RecordAuthenticationInput,
): Promise<RecordAuthenticationResult> {
	let now = input.now ?? Date.now();
	let day = dayOf(now);

	if (cache.day !== day) {
		cache.day = day;
		cache.subjects = new Set();
		await pruneDauSeen(db, day);
	}

	if (cache.subjects.has(input.subjectId)) {
		return report(await ensureDauDayRow(db, day), input.cap);
	}

	let inserted = await db.exec(sql`
		INSERT INTO dau_seen (day, subject) VALUES (${day}, ${input.subjectId})
		ON CONFLICT (day, subject) DO NOTHING
	`);

	cache.subjects.add(input.subjectId);

	if (inserted.affectedRows === 0) {
		// Already in `dau_seen` from before this cache existed — an evicted and
		// rebuilt object meeting a subject it (or a predecessor) already counted.
		return report(await ensureDauDayRow(db, day), input.cap);
	}

	let row = await ensureDauDayRow(db, day);

	if (input.hard && row.subjects >= input.cap) {
		await db.delete(dauSeen, { day, subject: input.subjectId });
		cache.subjects.delete(input.subjectId);
		return { ok: false, day, subjects: row.subjects, cap: input.cap };
	}

	let subjects = row.subjects + 1;
	let notice = noticeFor(subjects, input.cap);
	let notices = row.notices;
	if (notice === "approaching" && notices < 1) notices = 1;
	if (notice === "reached" && notices < 2) notices = 2;

	let updated = await db.update(dauDay, { day }, { subjects, notices });

	return { ok: true, day: updated.day, subjects: updated.subjects, cap: input.cap, notice };
}

export interface CloseMeteringDayInput {
	day: number;
}

/** The figures a closed day answers with — the same shape `readUsage` answers per day. */
export interface DailyUsage {
	day: number;
	subjects: number;
	sessions: number;
	tokens: number;
}

/**
 * Marks a day closed and prunes `dau_seen` outside the window a late close might
 * still need. Safe to call twice: a day already closed answers the figures
 * already stored rather than recomputing or erroring, and a day with no rows at
 * all — a tenant that authenticated nobody — closes at zero.
 *
 * @param db - The tenant's database.
 * @param input - The day to close.
 * @returns The closed day's subject, session and token counts.
 */
export async function closeMeteringDay(
	db: Database,
	input: CloseMeteringDayInput,
): Promise<DailyUsage> {
	let row = await db.find(dauDay, { day: input.day });

	if (!row) {
		row = await db.create(
			dauDay,
			{ day: input.day, subjects: 0, sessions: 0, tokens: 0, notices: 0, closed: true },
			{ returnRow: true },
		);
	} else if (!row.closed) {
		row = await db.update(dauDay, { day: input.day }, { closed: true });
	}

	await pruneDauSeen(db, input.day);

	return { day: row.day, subjects: row.subjects, sessions: row.sessions, tokens: row.tokens };
}

export interface ReadUsageInput {
	from: number;
	to: number;
}

/**
 * Reads the day rows a tenant's usage chart is built from, straight from
 * `dau_day` — no subject id ever leaves the object through this call.
 *
 * @param db - The tenant's database.
 * @param input - The inclusive day range to read.
 * @returns Each day in range that has a row, oldest first.
 */
export async function readUsage(db: Database, input: ReadUsageInput): Promise<DailyUsage[]> {
	let rows = await db.findMany(dauDay, {
		where: between("day", input.from, input.to),
		orderBy: ["day", "asc"],
	});

	return rows.map((row) => ({
		day: row.day,
		subjects: row.subjects,
		sessions: row.sessions,
		tokens: row.tokens,
	}));
}
