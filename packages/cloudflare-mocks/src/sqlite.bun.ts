/**
 * {@link SqliteDatabase} over `bun:sqlite`, selected by the `bun` export condition on
 * `@sdxc/cloudflare-mocks/sqlite`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Database } from "bun:sqlite";

import type { SqliteDatabase, SqliteStatement } from "./sqlite";

import { toPositional } from "./sqlite";

export type { SqliteDatabase, SqliteStatement } from "./sqlite";

/**
 * Opens an in-memory SQLite database.
 * @param filename SQLite file to open; `:memory:` for a private database.
 * @returns The database, narrowed to the surface the mocks use.
 */
export function openDatabase(filename: string): SqliteDatabase {
	let database = new Database(filename);

	return {
		query(sql: string): SqliteStatement {
			let statement = database.query(sql);

			return {
				get columnNames(): string[] {
					return [...statement.columnNames];
				},

				all(...values: unknown[]): Record<string, unknown>[] {
					return statement.all(...(toPositional(values) as never[])) as Record<string, unknown>[];
				},

				get(...values: unknown[]): Record<string, unknown> | null {
					return statement.get(...(toPositional(values) as never[])) as Record<
						string,
						unknown
					> | null;
				},

				run(...values: unknown[]): void {
					statement.run(...(toPositional(values) as never[]));
				},
			};
		},

		/**
		 * Executes SQL directly when no bindings are given, so a `;`-separated
		 * script runs in full; otherwise prepares and runs a single statement.
		 */
		exec(sql: string, ...values: unknown[]): void {
			if (values.length === 0) {
				database.exec(sql);
				return;
			}

			database.prepare(sql).run(...(toPositional(values) as never[]));
		},

		close(): void {
			database.close();
		},
	};
}
