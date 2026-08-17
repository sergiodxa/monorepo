/**
 * `D1Database` binding backed by an in-memory `bun:sqlite` database, so SQL genuinely
 * executes: a malformed statement, a constraint violation, or a bad binding fails the
 * way it would in production instead of returning canned rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { openDatabase } from "@pkg/cloudflare-mocks/sqlite";

import { splitSqlStatements } from "./sql-script";

/** Value shapes SQLite accepts as a positional binding. */
type SqliteBinding = string | number | null | Uint8Array;

/** Rows, column names, and D1 metadata produced by one executed statement. */
interface D1ExecuteResult {
	/** Rows the statement returned; empty for statements without a result set. */
	rows: Record<string, unknown>[];
	/** Result column names in declaration order, used by `raw({ columnNames: true })`. */
	columnNames: string[];
	/** D1-shaped metadata for the statement. */
	meta: D1Meta & Record<string, unknown>;
}

/** Everything a prepared statement needs to execute itself and to rebind. */
interface D1StatementContext {
	/** SQL text the statement was prepared with. */
	text: string;
	/** Values already bound to the statement. */
	values: unknown[];
	/** Runs SQL against the backing SQLite database. */
	execute: (text: string, values: unknown[]) => D1ExecuteResult;
	/** Produces a new registered statement, so `bind` stays non-mutating like D1's. */
	rebind: (text: string, values: unknown[]) => D1PreparedStatement;
}

/** A `D1Database` binding whose schema and rows a test can drop in place. */
export interface D1DatabaseMock extends D1Database {
	/**
	 * Drops every table, index, view, and trigger, as if the database were new.
	 *
	 * A binding installed once at module scope outlives the test that used it, so this is
	 * how a `beforeEach` gets an empty database without re-creating the `env` the code
	 * under test already captured.
	 */
	reset(): void;
}

/** Options for {@link createD1Database}. */
export interface D1DatabaseMockOptions {
	/**
	 * Path of the SQLite file to open. Defaults to `:memory:`, which is what makes each
	 * mock disposable; pass a path only when a test must inspect the database on disk.
	 */
	filename?: string;
}

/**
 * Creates a `D1Database` binding over a fresh in-memory SQLite database.
 *
 * Statements execute immediately and autocommit, exactly as D1 does: there is no
 * `BEGIN`/`COMMIT`, and the only atomic primitive is `batch()`. Bindings are validated
 * against D1's accepted types, so passing an object where the caller should have
 * JSON-encoded it throws instead of silently succeeding.
 * @param options Optional SQLite filename override.
 * @returns A `D1Database` binding whose SQL really runs.
 * @example let db = createD1Database(); await db.exec("CREATE TABLE t (id INTEGER)");
 */
export function createD1Database(options?: D1DatabaseMockOptions): D1DatabaseMock {
	let sqlite = openDatabase(options?.filename ?? ":memory:");
	let prepared = new WeakMap<D1PreparedStatement, { text: string; values: unknown[] }>();
	let bookmark = 0;

	/** Reads a single numeric scalar out of SQLite, used for statement metadata. */
	function readScalar(sql: string): number {
		let row = sqlite.query(sql).get() as { value: number } | null;
		return row ? Number(row.value) : 0;
	}

	/**
	 * Runs one statement and reports D1-shaped metadata.
	 *
	 * `changes` is measured as the delta of SQLite's `total_changes()` rather than
	 * `changes()`, because `changes()` reports the previous write's count when the
	 * statement read rows instead of writing them.
	 */
	function execute(text: string, values: unknown[]): D1ExecuteResult {
		if (splitSqlStatements(text).length > 1) {
			throw new Error("D1_ERROR: A prepared SQL statement must contain only one statement");
		}

		let bound = values.map(toBinding);
		let statement = sqlite.query(text);
		let started = performance.now();
		let changesBefore = readScalar("SELECT total_changes() AS value");
		let rows: Record<string, unknown>[] = [];

		if (statement.columnNames.length > 0) {
			rows = statement.all(...bound).map(toRow);
		} else {
			statement.run(...bound);
		}

		let changes = readScalar("SELECT total_changes() AS value") - changesBefore;

		return {
			rows,
			columnNames: [...statement.columnNames],
			meta: {
				duration: performance.now() - started,
				size_after: readScalar(
					"SELECT page_count * page_size AS value FROM pragma_page_count(), pragma_page_size()",
				),
				rows_read: rows.length,
				rows_written: changes,
				last_row_id: readScalar("SELECT last_insert_rowid() AS value"),
				changed_db: changes > 0,
				changes,
			},
		};
	}

	/**
	 * Registers a statement so `batch()` can recover its SQL and bindings, which D1
	 * itself keeps hidden inside the prepared statement.
	 */
	function register(text: string, values: unknown[]): D1PreparedStatement {
		let statement = createPreparedStatement({ text, values, execute, rebind: register });
		prepared.set(statement, { text, values });
		return statement;
	}

	/**
	 * Prepares a statement. Nothing is validated here, matching D1, where `prepare` is
	 * local and a bad statement only fails once it executes. The returned statement is
	 * immutable: `bind` yields a new statement rather than mutating this one.
	 * @param query SQL text with `?` placeholders.
	 * @returns A prepared statement ready to bind and execute.
	 */
	function prepare(query: string): D1PreparedStatement {
		return register(query, []);
	}

	/**
	 * Runs every statement inside one real SQLite transaction, so the batch is atomic
	 * the way D1's is: one failure rolls the whole batch back.
	 * @param statements Statements prepared by this same database.
	 * @returns One result per statement, in order.
	 */
	async function batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
		let plans = statements.map((statement) => {
			let plan = prepared.get(statement);
			if (!plan) {
				throw new Error("D1_ERROR: batch() received a statement from another database");
			}
			return plan;
		});

		sqlite.exec("BEGIN");

		try {
			let results = plans.map((plan) => toResult<T>(execute(plan.text, plan.values)));
			sqlite.exec("COMMIT");
			bookmark += 1;
			return results;
		} catch (error) {
			sqlite.exec("ROLLBACK");
			throw error;
		}
	}

	/**
	 * Runs a script of one or more `;`-separated statements without bindings.
	 * @param query SQL script.
	 * @returns The statement count and elapsed duration.
	 */
	async function exec(query: string): Promise<D1ExecResult> {
		let statements = splitSqlStatements(query);
		let started = performance.now();

		for (let statement of statements) sqlite.exec(statement);

		return { count: statements.length, duration: performance.now() - started };
	}

	/**
	 * Opens a session. Sessions exist for read replication, which an in-memory database
	 * has none of, so this is a pass-through that still advances a bookmark.
	 * @returns A session whose statements run against the same database.
	 */
	function withSession(): D1DatabaseSession {
		return {
			prepare,
			batch,
			/** Latest bookmark, or `null` until the session has run a query. */
			getBookmark(): D1SessionBookmark | null {
				return bookmark === 0 ? null : `mock-bookmark-${String(bookmark)}`;
			},
		};
	}

	/** Rejects the deprecated whole-database dump, which only ever worked on D1 alpha. */
	async function dump(): Promise<ArrayBuffer> {
		throw new Error("D1_ERROR: dump() is not supported by @pkg/cloudflare-mocks");
	}

	/**
	 * Drops every schema object so a module-scoped binding can start a test clean.
	 *
	 * Dropping a table takes its indexes and triggers with it, so each statement is
	 * guarded with `IF EXISTS` rather than ordered; foreign keys are suspended for the
	 * duration so a reference cycle cannot block the teardown.
	 */
	function reset(): void {
		sqlite.exec("PRAGMA foreign_keys = OFF");

		let schema = sqlite
			.query("SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
			.all() as { type: string; name: string }[];

		for (let object of schema) sqlite.exec(`DROP ${object.type} IF EXISTS "${object.name}"`);

		sqlite.exec("PRAGMA foreign_keys = ON");
		bookmark = 0;
	}

	return { prepare, batch, exec, withSession, dump, reset };
}

/**
 * Builds a `D1PreparedStatement` over an executor.
 *
 * `all` and `run` share one execution path so a statement behaves identically either
 * way, which matches D1 returning the same `D1Result` shape from both.
 */
function createPreparedStatement(context: D1StatementContext): D1PreparedStatement {
	/**
	 * Binds positional values, returning a new statement.
	 * @param values Values for the statement's `?` placeholders.
	 */
	function bind(...values: unknown[]): D1PreparedStatement {
		return context.rebind(context.text, values);
	}

	/**
	 * Runs the statement and returns its first row, or one column of it.
	 * @param colName Column to read out of the first row; omit for the whole row.
	 * @returns The row, the column value, or `null` when no row matched.
	 */
	function first<T = unknown>(colName: string): Promise<T | null>;
	function first<T = Record<string, unknown>>(): Promise<T | null>;
	async function first(colName?: string): Promise<unknown> {
		let result = context.execute(context.text, context.values);
		let row = result.rows[0];

		if (!row) return null;
		if (colName === undefined) return row;

		if (!Object.prototype.hasOwnProperty.call(row, colName)) {
			throw new Error(`D1_ERROR: no such column: ${colName}`);
		}

		return row[colName];
	}

	/**
	 * Runs the statement and returns rows plus metadata. Intended for writes, but like
	 * D1 it returns rows when the statement produces them (for example `RETURNING`).
	 */
	async function run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
		return toResult<T>(context.execute(context.text, context.values));
	}

	/** Runs the statement and returns every row plus metadata. */
	async function all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
		return toResult<T>(context.execute(context.text, context.values));
	}

	/**
	 * Runs the statement and returns rows as positional arrays instead of objects.
	 * @param options Set `columnNames: true` to prepend the column-name row.
	 */
	function raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
	function raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
	async function raw(options?: { columnNames?: boolean }): Promise<unknown> {
		let result = context.execute(context.text, context.values);
		let rows = result.rows.map((row) => result.columnNames.map((column) => row[column]));

		if (options?.columnNames) return [result.columnNames, ...rows];
		return rows;
	}

	return { bind, first, run, all, raw };
}

/** Wraps an execution into the `D1Result` envelope both `all` and `run` resolve to. */
function toResult<T>(result: D1ExecuteResult): D1Result<T> {
	return { success: true, meta: result.meta, results: result.rows as T[] };
}

/**
 * Converts a SQLite row into D1's row shape, replacing the byte views `bun:sqlite`
 * returns for BLOB columns with the `ArrayBuffer` D1 hands back.
 */
function toRow(row: unknown): Record<string, unknown> {
	if (typeof row !== "object" || row === null) return {};

	let converted: Record<string, unknown> = {};

	for (let [column, value] of Object.entries(row as Record<string, unknown>)) {
		if (ArrayBuffer.isView(value)) {
			let bytes = new Uint8Array(value.byteLength);
			bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
			converted[column] = bytes.buffer;
			continue;
		}

		converted[column] = value;
	}

	return converted;
}

/**
 * Validates and converts one bound value.
 *
 * D1 accepts only `null`, numbers, strings, booleans, and byte buffers. Rejecting
 * anything else here is the point: it is how a missing JSON encode surfaces as a test
 * failure instead of as a production error.
 */
function toBinding(value: unknown): SqliteBinding {
	if (value === null) return null;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "number" || typeof value === "string") return value;
	if (value instanceof ArrayBuffer) return new Uint8Array(value);
	if (ArrayBuffer.isView(value))
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

	throw new Error(
		`D1_TYPE_ERROR: Type '${typeof value}' not supported for value '${describeBinding(value)}'`,
	);
}

/**
 * Renders a rejected binding for the type error message. Objects are serialized instead of
 * stringified so the message names the value that was missing a JSON encode, rather than
 * reading `[object Object]` and leaving the caller to guess which argument was wrong.
 */
function describeBinding(value: unknown): string {
	switch (typeof value) {
		case "object":
		case "function":
			return JSON.stringify(value) ?? typeof value;
		case "symbol":
			return value.toString();
		default:
			return String(value);
	}
}
