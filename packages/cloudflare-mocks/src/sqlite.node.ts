/**
 * {@link SqliteDatabase} over `node:sqlite`, the default export condition on
 * `@pkg/cloudflare-mocks/sqlite`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { DatabaseSync } from "node:sqlite";

import type { SqliteDatabase, SqliteStatement } from "./sqlite";

export type { SqliteDatabase, SqliteStatement } from "./sqlite";

/**
 * Opens an in-memory SQLite database.
 * @param filename SQLite file to open; `:memory:` for a private database.
 * @returns The database, narrowed to the surface the mocks use.
 */
export function openDatabase(filename: string): SqliteDatabase {
	let database = new DatabaseSync(filename);

	return {
		query(sql: string): SqliteStatement {
			let statement = database.prepare(sql);

			return {
				get columnNames(): string[] {
					// `columns()` throws for a statement that returns none, where the callers
					// expect the empty list that tells them to run for effect instead.
					try {
						return statement.columns().map((column) => column.name);
					} catch {
						return [];
					}
				},

				all(...values: unknown[]): Record<string, unknown>[] {
					return statement.all(...(values as never[])) as Record<string, unknown>[];
				},

				get(...values: unknown[]): Record<string, unknown> | null {
					// Normalized to `null`: `node:sqlite` reports a miss as `undefined` while
					// `bun:sqlite` reports it as `null`, and the callers compare against `null`.
					return (statement.get(...(values as never[])) ?? null) as Record<string, unknown> | null;
				},

				run(...values: unknown[]): void {
					statement.run(...(values as never[]));
				},
			};
		},

		exec(sql: string, ...values: unknown[]): void {
			// Only the no-binding form can carry a multi-statement script.
			if (values.length === 0) {
				database.exec(sql);
				return;
			}

			database.prepare(sql).run(...(values as never[]));
		},
	};
}
