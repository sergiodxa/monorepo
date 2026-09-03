/**
 * Durable Object `SqlStorage` binding backed by an in-memory `bun:sqlite` database. It
 * runs synchronously and honours `BEGIN`/`COMMIT`/`ROLLBACK` and `SAVEPOINT`, so code
 * relying on real Durable Object transaction atomicity can be tested for real.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";

/** Value shapes SQLite accepts as a positional binding. */
type SqliteBinding = string | number | null | Uint8Array;

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

/**
 * Creates a Durable Object `SqlStorage` binding over a fresh in-memory SQLite database.
 *
 * `exec` runs a single statement synchronously and returns a cursor, so transactions
 * issued as SQL (`BEGIN`, `SAVEPOINT`) behave as they do inside a Durable Object.
 * @param options Optional SQLite filename override.
 * @returns A `SqlStorage` binding whose SQL really runs.
 * @example let sql = createSqlStorage(); sql.exec("CREATE TABLE t (id INTEGER)");
 */
export function createSqlStorage(options?: SqlStorageMockOptions): SqlStorage {
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

	return {
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
