/**
 * Replays a set of SQL migrations against a fresh in-memory SQLite with double-quoted string
 * literals **disabled**, and reports the statements that error.
 *
 * That one setting is the whole point. SQLite's legacy DQS misfeature makes `"foo"` fall back
 * to the string `'foo'` when no column named `foo` is in scope, so a copy step that reads a
 * column the source table does not have succeeds and writes the column's own name into every
 * row. With DQS off the same statement is an error naming the column, which turns a silent
 * data-corruption bug into something a test can see.
 *
 * The production adapters run with DQS on, deliberately — see `@pkg/cloudflare-mocks/sqlite`.
 * This module exists to check the SQL itself, not to change how it executes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DatabaseSync } from "node:sqlite";

/** Drizzle's separator between statements in one migration file. */
const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

/** One migration file, in the order it would be applied. */
export interface MigrationFile {
	name: string;
	sql: string;
}

/** A statement that failed to apply, with the database's own message. */
export interface ReplayFailure {
	file: string;
	message: string;
}

/**
 * Apply `files` in the given order to a fresh database and collect every statement that
 * errors. A failing statement is skipped rather than aborting the replay, so one broken
 * migration does not hide the ones after it.
 */
export function replayMigrations(files: MigrationFile[]): ReplayFailure[] {
	let db = new DatabaseSync(":memory:");
	let failures: ReplayFailure[] = [];

	try {
		for (let file of files) {
			// Files without a breakpoint marker come back as a single chunk, which `exec`
			// handles as a multi-statement script.
			for (let statement of file.sql.split(STATEMENT_BREAKPOINT)) {
				let text = statement.trim();
				if (text === "") continue;
				try {
					db.exec(text);
				} catch (error) {
					failures.push({ file: file.name, message: (error as Error).message });
				}
			}
		}
	} finally {
		db.close();
	}

	return failures;
}
