/**
 * Durable Object `SqlStorage` binding backed by an in-memory `bun:sqlite` database. It
 * runs synchronously and refuses the transaction-control statements the platform refuses,
 * so code reaching for `BEGIN` or `SAVEPOINT` fails here instead of in production.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";

/** Value shapes SQLite accepts as a positional binding. */
type SqliteBinding = string | number | null | Uint8Array;

/**
 * Leading keywords of the statements Durable Object SQL rejects, covering `ROLLBACK TO`
 * and `RELEASE SAVEPOINT` through the keyword each of them opens with.
 */
let transactionKeywords = new Set(["BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE"]);

/** The message the Durable Objects runtime raises for a transaction-control statement. */
let transactionStatementMessage =
	"To execute a transaction, please use the state.storage.transaction() or " +
	"state.storage.transactionSync() APIs instead of the SQL BEGIN TRANSACTION or SAVEPOINT " +
	"statements. The JavaScript API is safer because it will automatically roll back on " +
	"exceptions, and because it interacts correctly with Durable Objects' automatic atomic " +
	"write coalescing.";

/** Options for {@link createSqlStorage}. */
export interface SqlStorageMockOptions {
	/**
	 * Path of the SQLite file to open. Defaults to `:memory:`; pass a path only when a
	 * test must inspect the database outside the process.
	 */
	filename?: string;
}

/**
 * Single-pass cursor over the rows one `exec` produced.
 *
 * Reading is destructive, matching the platform: rows already consumed by
 * `next()` or `toArray()` are gone, so a second read returns nothing.
 * @template T Row shape the cursor yields.
 */
export class MockSqlStorageCursor<
	T extends Record<string, SqlStorageValue>,
> implements SqlStorageCursor<T> {
	/** Result column names in declaration order. */
	columnNames: string[];

	#rows: T[];
	#index = 0;
	#rowsWritten: number;

	/**
	 * @param rows Rows the statement produced.
	 * @param columnNames Result column names.
	 * @param rowsWritten Rows the statement wrote, as reported by SQLite.
	 */
	constructor(rows: T[] = [], columnNames: string[] = [], rowsWritten = 0) {
		this.#rows = rows;
		this.columnNames = columnNames;
		this.#rowsWritten = rowsWritten;
	}

	/** Rows consumed from this cursor so far. */
	get rowsRead(): number {
		return this.#index;
	}

	/** Rows the statement wrote; `0` for a read-only statement. */
	get rowsWritten(): number {
		return this.#rowsWritten;
	}

	/**
	 * Advances the cursor by one row.
	 * @returns The next row, or `{ done: true }` once the cursor is exhausted.
	 */
	next(): { done?: false; value: T } | { done: true; value?: never } {
		if (this.#index >= this.#rows.length) return { done: true };

		let value = this.#rows[this.#index] as T;
		this.#index += 1;

		return { value };
	}

	/**
	 * Drains the cursor.
	 * @returns Every row not yet consumed.
	 */
	toArray(): T[] {
		let rows = this.#rows.slice(this.#index);
		this.#index = this.#rows.length;
		return rows;
	}

	/**
	 * Reads the one row the statement was expected to produce.
	 * @returns The single row.
	 * @throws When the statement produced no rows or more than one.
	 */
	one(): T {
		let rows = this.toArray();

		if (rows.length !== 1) {
			throw new Error(`Expected exactly one result, got ${String(rows.length)}`);
		}

		return rows[0] as T;
	}

	/**
	 * Iterates remaining rows as positional value arrays instead of objects.
	 * @template U Tuple shape of a row's values.
	 */
	raw<U extends SqlStorageValue[]>(): IterableIterator<U> {
		let columnNames = this.columnNames;

		return this.toArray()
			.map((row) => columnNames.map((column) => row[column]) as U)
			[Symbol.iterator]();
	}

	/** Iterates remaining rows, so a cursor can be spread or used in `for…of`. */
	[Symbol.iterator](): IterableIterator<T> {
		return this.toArray()[Symbol.iterator]();
	}
}

/** Stands in for the `Statement` constructor a real binding exposes, satisfying type checks only. */
export class MockSqlStorageStatement {}

/** A `SqlStorage` binding paired with the transaction framing its `exec` refuses. */
export interface SqlStorageBinding {
	/** The binding itself, ready to hand to code that expects `ctx.storage.sql`. */
	sql: SqlStorage;

	/**
	 * Runs `closure` inside a real SQLite transaction, committing when it returns and
	 * rolling back when it throws. This is the atomicity `DurableObjectState.transactionSync`
	 * offers in place of the statements `exec` refuses.
	 * @param closure Synchronous work to run atomically.
	 * @returns Whatever the closure returned.
	 */
	transactionSync<T>(closure: () => T): T;
}

/**
 * Creates a Durable Object `SqlStorage` binding over a fresh in-memory SQLite database.
 *
 * `exec` runs a single statement synchronously and returns a cursor. A transaction-control
 * statement throws the runtime's own error, so a scope that would fail inside a Durable
 * Object fails here first.
 * @param options Optional SQLite filename override.
 * @returns A `SqlStorage` binding whose SQL really runs.
 * @example let sql = createSqlStorage(); sql.exec("CREATE TABLE t (id INTEGER)");
 */
export function createSqlStorage(options?: SqlStorageMockOptions): SqlStorage {
	return createSqlStorageBinding(options).sql;
}

/**
 * Creates a `SqlStorage` binding together with the transaction framing `exec` refuses,
 * which is what a `DurableObjectState` mock needs to implement `transactionSync`.
 * @param options Optional SQLite filename override.
 * @returns The binding and its transaction runner.
 */
export function createSqlStorageBinding(options?: SqlStorageMockOptions): SqlStorageBinding {
	let sqlite = openDatabase(options?.filename ?? ":memory:");

	/** Reads a single numeric scalar out of SQLite, used for size and change counts. */
	function readScalar(sql: string): number {
		let row = sqlite.query(sql).get() as { value: number } | null;
		return row ? Number(row.value) : 0;
	}

	/**
	 * Runs one statement and returns a cursor over its rows. `rowsWritten` is the
	 * delta of `total_changes()`, so a read-only statement reports `0`, and a
	 * columnless statement with no bindings runs as a full `;`-separated script.
	 * @param query One SQL statement, or a `;`-separated script when there are no bindings.
	 * @param bindings Positional values for the statement's `?` placeholders.
	 * @returns A single-pass cursor over the result rows.
	 */
	function exec<T extends Record<string, SqlStorageValue>>(
		query: string,
		...bindings: unknown[]
	): SqlStorageCursor<T> {
		assertNoTransactionStatement(query);

		let bound = bindings.map(toBinding);
		let statement = sqlite.query(query);
		let changesBefore = readScalar("SELECT total_changes() AS value");
		let rows: T[] = [];

		if (statement.columnNames.length > 0) {
			rows = statement.all(...bound).map((row) => toRow<T>(row));
		} else if (bound.length === 0) {
			sqlite.exec(query);
		} else {
			statement.run(...bound);
		}

		let written = readScalar("SELECT total_changes() AS value") - changesBefore;

		return new MockSqlStorageCursor<T>(rows, [...statement.columnNames], written);
	}

	let sql: SqlStorage = {
		exec,

		/** Current database size in bytes, derived from SQLite's page accounting. */
		get databaseSize(): number {
			return readScalar(
				"SELECT page_count * page_size AS value FROM pragma_page_count(), pragma_page_size()",
			);
		},

		/**
		 * Both constructors exist only so instances can be type-tested; the mock's
		 * own placeholder classes stand in for them.
		 */
		Cursor: MockSqlStorageCursor as unknown as typeof SqlStorageCursor,
		Statement: MockSqlStorageStatement as unknown as typeof SqlStorageStatement,
	};

	return {
		sql,

		transactionSync<T>(closure: () => T): T {
			sqlite.exec("BEGIN");

			try {
				let result = closure();
				sqlite.exec("COMMIT");
				return result;
			} catch (error) {
				sqlite.exec("ROLLBACK");
				throw error;
			}
		},
	};
}

/**
 * Converts a SQLite row into the `SqlStorageValue` shape a cursor yields, replacing the
 * byte views `bun:sqlite` returns for BLOB columns with `ArrayBuffer`.
 */
function toRow<T extends Record<string, SqlStorageValue>>(row: unknown): T {
	if (typeof row !== "object" || row === null) return {} as T;

	let converted: Record<string, SqlStorageValue> = {};

	for (let [column, value] of Object.entries(row as Record<string, unknown>)) {
		if (ArrayBuffer.isView(value)) {
			let bytes = new Uint8Array(value.byteLength);
			bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
			converted[column] = bytes.buffer;
			continue;
		}

		converted[column] = value as SqlStorageValue;
	}

	return converted as T;
}

/**
 * Validates and converts one bound value to what Durable Object SQL accepts:
 * `null`, numbers, strings, and byte buffers, folding booleans to `1`/`0`.
 * Anything else throws, so a value that needed JSON-encoding surfaces in a test.
 */
function toBinding(value: unknown): SqliteBinding {
	if (value === null || value === undefined) return null;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "number" || typeof value === "string") return value;
	if (value instanceof ArrayBuffer) return new Uint8Array(value);

	if (ArrayBuffer.isView(value)) {
		return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
	}

	throw new Error(`SqlStorage: type '${typeof value}' is not a supported binding value`);
}

/**
 * Raises the runtime's error when any statement in `query` opens a transaction, commits
 * one, or touches a savepoint. `exec` accepts a whole script, so every statement in it is
 * checked, matching on the keyword each one opens with.
 */
function assertNoTransactionStatement(query: string): void {
	for (let statement of splitTopLevelStatements(query)) {
		if (transactionKeywords.has(readLeadingKeyword(statement))) {
			throw new Error(transactionStatementMessage);
		}
	}
}

/**
 * Splits a script on the `;` that separate its statements, skipping any `;` that sits
 * inside a string, a quoted identifier, or a comment, so a statement holding one stays
 * whole.
 */
function splitTopLevelStatements(script: string): string[] {
	let statements: string[] = [];
	let start = 0;
	let index = 0;

	while (index < script.length) {
		let char = script[index];

		if (char === "'" || char === '"' || char === "`" || char === "[") {
			index = skipQuoted(script, index);
			continue;
		}

		if (isCommentStart(script, index)) {
			index = skipComment(script, index);
			continue;
		}

		if (char === ";") {
			statements.push(script.slice(start, index));
			index += 1;
			start = index;
			continue;
		}

		index += 1;
	}

	statements.push(script.slice(start));

	return statements;
}

/**
 * Reads the keyword a statement opens with, upper-cased, after leading whitespace and
 * comments. A statement that opens with anything else reads as the empty string.
 */
function readLeadingKeyword(statement: string): string {
	let index = 0;

	while (index < statement.length) {
		if (/\s/.test(statement[index] as string)) {
			index += 1;
			continue;
		}

		if (isCommentStart(statement, index)) {
			index = skipComment(statement, index);
			continue;
		}

		break;
	}

	let keyword = /^[A-Za-z_]+/.exec(statement.slice(index));

	return keyword ? keyword[0].toUpperCase() : "";
}

/** Reports whether a `--` line comment or a `/*` block comment opens at `index`. */
function isCommentStart(sql: string, index: number): boolean {
	let char = sql[index];
	let next = sql[index + 1];

	return (char === "-" && next === "-") || (char === "/" && next === "*");
}

/**
 * Advances past the comment opening at `index`.
 * @returns The index just past the comment, or the end of the string for an unterminated one.
 */
function skipComment(sql: string, index: number): number {
	if (sql[index] === "-") {
		let end = sql.indexOf("\n", index);
		return end === -1 ? sql.length : end + 1;
	}

	let end = sql.indexOf("*/", index + 2);

	return end === -1 ? sql.length : end + 2;
}

/**
 * Advances past the quoted run opening at `index`, honouring SQLite's doubled-delimiter
 * escape so `'it''s'` reads as one literal.
 * @returns The index just past the closing delimiter, or the end of an unterminated run.
 */
function skipQuoted(sql: string, index: number): number {
	let open = sql[index];
	let close = open === "[" ? "]" : (open as string);
	let cursor = index + 1;

	while (cursor < sql.length) {
		if (sql[cursor] !== close) {
			cursor += 1;
			continue;
		}

		if (close !== "]" && sql[cursor + 1] === close) {
			cursor += 2;
			continue;
		}

		return cursor + 1;
	}

	return sql.length;
}
