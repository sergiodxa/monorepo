/**
 * Tests for the D1 `DatabaseDriver` that a real binding cannot express.
 *
 * The adapter's behaviour is exercised against an actual D1 binding in
 * `index.workers.test.ts`. What is left here needs a `meta` the test controls, which a real
 * binding by definition does not offer: that the adapter reports the `duration` D1 sent rather
 * than timing statements itself, and that it reports zeros — instead of guessing — when a
 * statement comes back with no counters at all.
 *
 * Both run against a `D1Database`-shaped shim over an in-memory `node:sqlite` database, which
 * is also why they stay on the threads pool: workerd has no `node:sqlite`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DatabaseSync } from "node:sqlite";

import { column as c, Database, table } from "remix/data-table";
import { describe, expect, test } from "vitest";

import type { D1StatementObservation } from "./index";

import { createD1DatabaseAdapter } from "./index";

import type { SQLInputValue } from "node:sqlite";

/**
 * Minimal `D1Database`-shaped wrapper over a `node:sqlite` database.
 *
 * Each prepared statement executes immediately and autocommits, mirroring D1, which
 * exposes no `BEGIN`/`COMMIT`/`ROLLBACK`. Results are shaped like D1's `D1Result`
 * (`{ results, meta: { changes, last_row_id } }`).
 * @param db Open `node:sqlite` database.
 * @returns An object matching the `D1Database` surface consumed by the adapter.
 */
function createD1Shim(db: DatabaseSync): D1Database {
	function prepare(text: string) {
		let bound: SQLInputValue[] = [];

		let statement = {
			bind(...values: unknown[]) {
				bound = values as SQLInputValue[];
				return statement;
			},
			all() {
				let before = readTotalChanges(db);
				let results = db.prepare(text).all(...bound) as Record<string, unknown>[];
				let meta = readMeta(db, results.length, readTotalChanges(db) - before);
				return Promise.resolve({ results, meta });
			},
			run() {
				let before = readTotalChanges(db);
				db.prepare(text).run(...bound);
				let meta = readMeta(db, 0, readTotalChanges(db) - before);
				return Promise.resolve({ results: [], meta });
			},
		};

		return statement;
	}

	return {
		prepare,
		exec(sql: string) {
			db.exec(sql);
			return Promise.resolve({ count: 0, duration: 0 });
		},
	} as unknown as D1Database;
}

/**
 * Fixed `meta.duration` the shim reports, so a test can tell a duration that was
 * passed through from D1's own metadata apart from one measured locally.
 */
const SHIM_DURATION_MS = 1.5;

/**
 * Reads the change count and last insert id after a statement, shaped like D1 meta,
 * plus the `rows_read`/`rows_written`/`duration` fields D1 reports and the adapter's
 * `onStatement` observer surfaces. `rows_read` is the number of rows the statement
 * returned, which is as close as a SQLite shim can get to D1's "rows read from tables
 * and indexes" — the shim can pin the plumbing, not the planner.
 * @param db Open `node:sqlite` database.
 * @param rowsRead Rows the statement returned.
 * @param rowsWritten Rows the statement wrote, measured as a `total_changes()` delta
 * because SQLite's `changes()` reports the _previous_ write's count for a statement
 * that only read rows.
 * @returns D1-style statement metadata.
 */
function readMeta(
	db: DatabaseSync,
	rowsRead: number,
	rowsWritten: number,
): {
	changes: number;
	last_row_id: number;
	rows_read: number;
	rows_written: number;
	duration: number;
} {
	let changes = db.prepare("SELECT changes() as changes").get() as { changes: number };
	let lastId = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
	return {
		changes: changes.changes,
		last_row_id: lastId.id,
		rows_read: rowsRead,
		rows_written: rowsWritten,
		duration: SHIM_DURATION_MS,
	};
}

/**
 * Reads SQLite's cumulative change counter for the connection.
 * @param db Open `node:sqlite` database.
 * @returns Total rows changed since the connection opened.
 */
function readTotalChanges(db: DatabaseSync): number {
	let row = db.prepare("SELECT total_changes() as total").get() as { total: number };
	return row.total;
}

/**
 * A `D1Database` shim whose statements report no metadata at all, standing in for a
 * D1 build (or a future one) that omits the row counters.
 * @param db Open `node:sqlite` database.
 * @returns An object matching the `D1Database` surface, with empty statement meta.
 */
function createMetalessD1Shim(db: DatabaseSync): D1Database {
	function prepare(text: string) {
		let bound: SQLInputValue[] = [];

		let statement = {
			bind(...values: unknown[]) {
				bound = values as SQLInputValue[];
				return statement;
			},
			all() {
				let results = db.prepare(text).all(...bound) as Record<string, unknown>[];
				return Promise.resolve({ results, meta: {} });
			},
			run() {
				db.prepare(text).run(...bound);
				return Promise.resolve({ results: [], meta: {} });
			},
		};

		return statement;
	}

	return {
		prepare,
		exec(sql: string) {
			db.exec(sql);
			return Promise.resolve({ count: 0, duration: 0 });
		},
	} as unknown as D1Database;
}

let users = table({
	name: "users",
	columns: {
		id: c.integer().primaryKey(),
		email: c.varchar(255),
	},
});

describe("createD1DatabaseAdapter onStatement", () => {
	test("reports the duration D1 sent rather than timing the statement itself", async () => {
		let observations: D1StatementObservation[] = [];
		let sqlite = new DatabaseSync(":memory:");
		sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");
		let db = new Database(
			createD1DatabaseAdapter(createD1Shim(sqlite), {
				onStatement: (observation) => observations.push(observation),
			}),
		);

		await db.create(users, { id: 1, email: "one@example.com" });
		await db.create(users, { id: 2, email: "two@example.com" });
		observations.length = 0;

		await db.findMany(users);

		expect(observations).toHaveLength(1);
		// The shim reports a fixed duration no real statement would take, so an adapter that
		// timed the call itself could not produce this number.
		expect(observations[0]?.durationMs).toBe(SHIM_DURATION_MS);
		// The counters travel the same path, and the real binding's own values are asserted in
		// `index.workers.test.ts`.
		expect(observations[0]?.rowsRead).toBe(2);
		expect(observations[0]?.rowsWritten).toBe(0);
	});

	test("reports zeros when D1 omits the counters instead of guessing", async () => {
		let observations: D1StatementObservation[] = [];
		let sqlite = new DatabaseSync(":memory:");
		sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)");
		let db = new Database(
			createD1DatabaseAdapter(createMetalessD1Shim(sqlite), {
				onStatement: (observation) => observations.push(observation),
			}),
		);

		await db.create(users, { id: 1, email: "one@example.com" });

		expect(observations[0]?.rowsRead).toBe(0);
		expect(observations[0]?.rowsWritten).toBe(0);
		expect(observations[0]?.durationMs).toBe(0);
	});
});
