/**
 * Opens the test schema in a fresh in-memory SQLite database, which has real transactions and
 * savepoints, with a clock that advances on every read so rows written in one test still order
 * by their timestamps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DatabaseSync } from "node:sqlite";

import type { Database } from "remix/data-table";

import { createSqliteDatabase } from "remix/data-table/sqlite";

import { createClock, SCHEMA_STATEMENTS } from "./schema.js";

/**
 * Opens a fresh database with the schema applied.
 *
 * @returns The data-table database and the raw SQLite handle, for asserting on what was written.
 */
export function openDatabase(): { db: Database; sqlite: DatabaseSync } {
	let sqlite = new DatabaseSync(":memory:");
	sqlite.exec("pragma foreign_keys = on");
	for (let statement of SCHEMA_STATEMENTS) sqlite.exec(statement);
	return { db: createSqliteDatabase(sqlite, { now: createClock() }), sqlite };
}
