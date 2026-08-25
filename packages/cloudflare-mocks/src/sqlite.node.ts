/**
 * {@link SqliteDatabase} over `node:sqlite`, the default export condition on
 * `@pkg/cloudflare-mocks/sqlite`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { DatabaseSync } from "node:sqlite";

import type { SqliteDatabase, SqliteStatement } from "./sqlite";

import { toPositional } from "./sqlite";

/**
 * Binds an integral number as a SQLite INTEGER: `node:sqlite` otherwise maps
 * every JS number to REAL, causing float division where `bun:sqlite` and
 * production truncate. Reads stay plain numbers since `setReadBigInts` is off.
 * @param value One binding as the caller passed it.
 */
function toBinding(value: unknown): unknown {
	return typeof value === "number" && Number.isInteger(value) ? BigInt(value) : value;
}

/**
 * Normalizes a whole binding list.
 * @param values Bindings as the caller passed them.
 */
function toBindings(values: unknown[]): unknown[] {
	return toPositional(values).map(toBinding);
}

export type { SqliteDatabase, SqliteStatement } from "./sqlite";

/**
 * Opens an in-memory SQLite database with double-quoted string literals
 * enabled, matching `bun:sqlite`'s handling of unresolved identifiers since
 * production SQL already depends on it.
 * @param filename SQLite file to open; `:memory:` for a private database.
 * @returns The database, narrowed to the surface the mocks use.
 */
export function openDatabase(filename: string): SqliteDatabase {
	let database = new DatabaseSync(filename, { enableDoubleQuotedStringLiterals: true });

	return {
		query(sql: string): SqliteStatement {
			let statement = database.prepare(sql);

			return {
				/**
				 * Catches `columns()`'s throw for a statement with no result columns,
				 * returning the empty list callers read as a signal to run for effect.
				 */
				get columnNames(): string[] {
					try {
						return statement.columns().map((column) => column.name);
					} catch {
						return [];
					}
				},

				all(...values: unknown[]): Record<string, unknown>[] {
					return statement.all(...(toBindings(values) as never[])) as Record<string, unknown>[];
				},

				/**
				 * Normalizes a miss to `null`: `node:sqlite` reports `undefined` where
				 * `bun:sqlite` reports `null`, and callers compare only against `null`.
				 */
				get(...values: unknown[]): Record<string, unknown> | null {
					return (statement.get(...(toBindings(values) as never[])) ?? null) as Record<
						string,
						unknown
					> | null;
				},

				run(...values: unknown[]): void {
					statement.run(...(toBindings(values) as never[]));
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

			database.prepare(sql).run(...(toBindings(values) as never[]));
		},

		close(): void {
			database.close();
		},
	};
}
