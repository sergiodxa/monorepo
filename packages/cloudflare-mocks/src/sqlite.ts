/**
 * The SQLite surface the D1 and SqlStorage mocks need, narrowed to what they actually call.
 *
 * Bun and Node ship different built-in SQLite modules and neither can resolve the other's:
 * `bun:sqlite` does not exist under Node, and Bun 1.3.14 cannot resolve `node:sqlite`. The
 * two implementations behind this interface are selected by the `bun` export condition on
 * `@pkg/cloudflare-mocks/sqlite`, so each runtime only ever loads the module it can resolve
 * and neither is reachable from a static import in the other's graph.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** A prepared statement, bound and executed positionally. */
export interface SqliteStatement {
	/**
	 * Columns the statement returns, empty for a statement that returns none.
	 *
	 * The mocks branch on this to decide between reading rows and running for effect, so a
	 * statement that yields no columns has to report an empty list rather than throw.
	 */
	readonly columnNames: string[];

	/**
	 * Runs the statement and collects every row.
	 * @param values Positional bindings.
	 */
	all(...values: unknown[]): Record<string, unknown>[];

	/**
	 * Runs the statement and reads its first row.
	 * @param values Positional bindings.
	 * @returns The row, or `null` when the statement matched nothing.
	 */
	get(...values: unknown[]): Record<string, unknown> | null;

	/**
	 * Runs the statement for its effect, discarding any rows.
	 * @param values Positional bindings.
	 */
	run(...values: unknown[]): void;
}

/** An open SQLite database. */
export interface SqliteDatabase {
	/**
	 * Prepares a statement.
	 * @param sql A single SQL statement.
	 */
	query(sql: string): SqliteStatement;

	/**
	 * Executes SQL for its effect, discarding any rows.
	 *
	 * With no bindings the argument may be a `;`-separated script; with bindings it has to
	 * be a single statement, because only a prepared statement can take them.
	 * @param sql SQL to run.
	 * @param values Positional bindings.
	 */
	exec(sql: string, ...values: unknown[]): void;

	/**
	 * Releases the database and everything prepared against it.
	 *
	 * Tests that open one database per case call this so an in-memory database is not kept
	 * alive by the statement cache for the rest of the run.
	 */
	close(): void;
}

/**
 * Normalizes bindings passed as a single array into a positional list.
 *
 * `bun:sqlite` treats `run([a, b])` as two positional bindings; `node:sqlite` reads the array
 * as a named-parameter object and fails with `Unknown named parameter '0'`. Callers in this
 * repo use both spellings, so both implementations flatten here and behave the same.
 * @param values Bindings as passed by the caller.
 * @returns The bindings as a positional list.
 */
export function toPositional(values: unknown[]): unknown[] {
	return values.length === 1 && Array.isArray(values[0]) ? (values[0] as unknown[]) : values;
}
