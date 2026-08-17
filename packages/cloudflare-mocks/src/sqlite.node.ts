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
 * Binds an integral number as a SQLite INTEGER rather than a REAL.
 *
 * `node:sqlite` maps every JS number to REAL, so `?/60000` performs float division where
 * `bun:sqlite` — and the D1/SQLite engines in production — perform integer division. Code
 * that relies on truncating division silently computes different results. BigInt is the only
 * JS type `node:sqlite` binds as INTEGER; reads come back as numbers either way, since
 * `setReadBigInts` stays off.
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
 * Opens an in-memory SQLite database.
 * @param filename SQLite file to open; `:memory:` for a private database.
 * @returns The database, narrowed to the surface the mocks use.
 */
export function openDatabase(filename: string): SqliteDatabase {
	// Double-quoted string literals are SQLite's legacy behaviour: an identifier that does
	// not resolve silently degrades to a string. `bun:sqlite` enables it and `node:sqlite`
	// does not, so without this the same SQL behaves differently per runtime — and the
	// repo's migration history already contains a statement that relies on it
	// (20250520185608 copies "subject_id" out of a table whose column is `user_id`).
	// Matching Bun keeps the two runners byte-identical; the cost is that a double-quoted
	// typo stays silent here rather than erroring.
	let database = new DatabaseSync(filename, { enableDoubleQuotedStringLiterals: true });

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
					return statement.all(...(toBindings(values) as never[])) as Record<string, unknown>[];
				},

				get(...values: unknown[]): Record<string, unknown> | null {
					// Normalized to `null`: `node:sqlite` reports a miss as `undefined` while
					// `bun:sqlite` reports it as `null`, and the callers compare against `null`.
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

		exec(sql: string, ...values: unknown[]): void {
			// Only the no-binding form can carry a multi-statement script.
			if (values.length === 0) {
				database.exec(sql);
				return;
			}

			database.prepare(sql).run(...(toBindings(values) as never[]));
		},
	};
}
