import type {
	AdapterCapabilityOverrides,
	DataManipulationOperation,
	DataManipulationRequest,
	DataManipulationResult,
	DatabaseAdapter,
	SqlStatement,
	TableRef,
	TransactionOptions,
	TransactionToken,
} from "remix/data-table";

import { getTableColumnDefinitions, getTableName, getTablePrimaryKey } from "remix/data-table";

interface SqlStorageAdapterOptions {
	capabilities?: AdapterCapabilityOverrides;
}

/**
 * Creates a `DatabaseAdapter` backed by a Cloudflare Durable Object `SqlStorage`.
 *
 * SQL generation follows SQLite semantics. Durable Object SQLite (`ctx.storage.sql`)
 * runs synchronously inside the object and accepts `BEGIN`/`COMMIT`/`ROLLBACK` and
 * `SAVEPOINT` statements, so transactions are executed for real: statements issued
 * within a `transaction()` scope are committed atomically on success and rolled back
 * as a unit on failure. Nested transactions are implemented with savepoints.
 * @param db `SqlStorage` handle used to execute SQL.
 * @param options Optional capability overrides for adapter feature flags.
 * @returns A `DatabaseAdapter` implementation for `SqlStorage`.
 */
export function createSQLStorageDatabaseAdapter(
	db: SqlStorage,
	options?: SqlStorageAdapterOptions,
): DatabaseAdapter {
	let transactions = new Set<string>();
	let transactionCounter = 0;

	function assertTransaction(token: TransactionToken): void {
		if (!transactions.has(token.id)) {
			throw new Error("Unknown transaction token: " + token.id);
		}
	}

	return {
		dialect: "sqlite",

		capabilities: {
			returning: options?.capabilities?.returning ?? true,
			savepoints: options?.capabilities?.savepoints ?? true,
			upsert: options?.capabilities?.upsert ?? true,
			transactionalDdl: options?.capabilities?.transactionalDdl ?? true,
			migrationLock: options?.capabilities?.migrationLock ?? false,
		},

		compileSql(operation: DataManipulationOperation): SqlStatement[] {
			let statement = compileSqliteStatement(operation);

			return [{ text: statement.text, values: statement.values }];
		},

		async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
			let operation = request.operation;

			if (operation.kind === "insertMany" && operation.values.length === 0) {
				return {
					affectedRows: 0,
					insertId: undefined,
					rows: operation.returning ? [] : undefined,
				};
			}

			// `c.json()` columns hold JS objects/arrays at the model layer, but SqlStorage's
			// binder accepts only strings/numbers/booleans/null — encode them to JSON
			// text before binding. `decodeColumns` undoes this, and the boolean-to-integer
			// narrowing SQLite forces, on every row read back.
			operation = encodeJsonColumns(operation);

			let statement = compileSqliteStatement(operation);
			let values = normalizeStatementValues(statement.values);
			let cursor = db.exec(statement.text, ...values);

			let shouldReadRows =
				operation.kind === "select" ||
				operation.kind === "count" ||
				operation.kind === "exists" ||
				hasReturningClause(operation) ||
				(operation.kind === "raw" && isReadOnlyRawSql(statement.text));

			if (shouldReadRows) {
				let rows = normalizeRows(cursor.toArray());
				rows = decodeColumns(operation, rows);

				if (operation.kind === "count" || operation.kind === "exists") {
					rows = normalizeCountRows(rows);
				}

				return {
					rows,
					affectedRows: normalizeAffectedRowsForReader(operation.kind, cursor),
					insertId: normalizeInsertIdForReader(operation.kind, operation, rows),
				};
			}

			return {
				affectedRows: cursor.rowsWritten,
				insertId: normalizeInsertIdForRun(operation.kind, operation, db),
			};
		},

		async executeScript(sql: string, transaction?: TransactionToken): Promise<void> {
			if (transaction) {
				assertTransaction(transaction);
			}

			// SqlStorage.exec runs a single statement, so split multi-statement
			// scripts and execute each non-empty statement in order.
			for (let statement of splitStatements(sql)) {
				db.exec(statement);
			}
		},

		async hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean> {
			if (transaction) {
				assertTransaction(transaction);
			}

			let schema = table.schema ? quoteIdentifier(table.schema) + "." : "";
			let cursor = db.exec(
				"select 1 as exists from " + schema + "sqlite_master where type = ? and name = ? limit 1",
				"table",
				table.name,
			);

			return cursor.toArray().length > 0;
		},

		async hasColumn(
			table: TableRef,
			column: string,
			transaction?: TransactionToken,
		): Promise<boolean> {
			if (transaction) {
				assertTransaction(transaction);
			}

			let schema = table.schema ? quoteIdentifier(table.schema) + "." : "";
			let cursor = db.exec("pragma " + schema + "table_info(" + quoteIdentifier(table.name) + ")");

			return cursor.toArray().some((row) => row.name === column);
		},

		/**
		 * Opens a real SQLite transaction with `BEGIN` so every statement issued
		 * within the scope commits or rolls back as a single atomic unit.
		 * @param options Transaction hints; `read uncommitted` toggles the matching
		 * pragma before the transaction begins.
		 * @returns A token identifying the open transaction.
		 */
		async beginTransaction(options?: TransactionOptions): Promise<TransactionToken> {
			if (options?.isolationLevel === "read uncommitted") {
				db.exec("PRAGMA read_uncommitted = true");
			}

			db.exec("BEGIN");

			transactionCounter += 1;
			let token = { id: "tx_" + String(transactionCounter) };
			transactions.add(token.id);

			return token;
		},

		/**
		 * Commits the open transaction with `COMMIT`, persisting every buffered
		 * statement atomically.
		 * @param token Token returned by {@link beginTransaction}.
		 */
		async commitTransaction(token: TransactionToken): Promise<void> {
			assertTransaction(token);
			db.exec("COMMIT");
			transactions.delete(token.id);
		},

		/**
		 * Rolls back the open transaction with `ROLLBACK`, discarding every statement
		 * issued within the scope so no partial state is persisted.
		 * @param token Token returned by {@link beginTransaction}.
		 */
		async rollbackTransaction(token: TransactionToken): Promise<void> {
			assertTransaction(token);
			db.exec("ROLLBACK");
			transactions.delete(token.id);
		},

		/**
		 * Creates a named savepoint inside the open transaction, enabling nested
		 * transactions to roll back independently.
		 * @param token Token returned by {@link beginTransaction}.
		 * @param name Savepoint name.
		 */
		async createSavepoint(token: TransactionToken, name: string): Promise<void> {
			assertTransaction(token);
			db.exec("SAVEPOINT " + quoteIdentifier(name));
		},

		/**
		 * Rolls back to a previously created savepoint, discarding statements issued
		 * after it while keeping the enclosing transaction open.
		 * @param token Token returned by {@link beginTransaction}.
		 * @param name Savepoint name to roll back to.
		 */
		async rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
			assertTransaction(token);
			db.exec("ROLLBACK TO SAVEPOINT " + quoteIdentifier(name));
		},

		/**
		 * Releases a previously created savepoint, merging its statements into the
		 * enclosing transaction.
		 * @param token Token returned by {@link beginTransaction}.
		 * @param name Savepoint name to release.
		 */
		async releaseSavepoint(token: TransactionToken, name: string): Promise<void> {
			assertTransaction(token);
			db.exec("RELEASE SAVEPOINT " + quoteIdentifier(name));
		},
	};
}

// SQL Compilation

type JoinClause = Extract<DataManipulationOperation, { kind: "select" }>["joins"][number];
type UpsertOperation = Extract<DataManipulationOperation, { kind: "upsert" }>;
type StatementTable = Extract<DataManipulationOperation, { kind: "select" }>["table"];
type Predicate = JoinClause["on"];

interface CompiledSql {
	text: string;
	values: unknown[];
}

interface CompileContext {
	values: unknown[];
}

function compileSqliteStatement(statement: DataManipulationOperation): CompiledSql {
	if (statement.kind === "raw") {
		return {
			text: statement.sql.text,
			values: [...statement.sql.values],
		};
	}

	let context: CompileContext = { values: [] };

	if (statement.kind === "select") {
		let selection = "*";

		if (statement.select !== "*") {
			selection = statement.select
				.map((field) => quotePath(field.column) + " as " + quoteIdentifier(field.alias))
				.join(", ");
		}

		return {
			text:
				"select " +
				(statement.distinct ? "distinct " : "") +
				selection +
				compileFromClause(statement.table, statement.joins, context) +
				compileWhereClause(statement.where, context) +
				compileGroupByClause(statement.groupBy) +
				compileHavingClause(statement.having, context) +
				compileOrderByClause(statement.orderBy) +
				compileLimitClause(statement.limit) +
				compileOffsetClause(statement.offset),
			values: context.values,
		};
	}

	if (statement.kind === "count" || statement.kind === "exists") {
		let inner =
			"select 1" +
			compileFromClause(statement.table, statement.joins, context) +
			compileWhereClause(statement.where, context) +
			compileGroupByClause(statement.groupBy) +
			compileHavingClause(statement.having, context);

		return {
			text:
				"select count(*) as " +
				quoteIdentifier("count") +
				" from (" +
				inner +
				") as " +
				quoteIdentifier("__dt_count"),
			values: context.values,
		};
	}

	if (statement.kind === "insert") {
		return compileInsertStatement(statement.table, statement.values, statement.returning, context);
	}

	if (statement.kind === "insertMany") {
		return compileInsertManyStatement(
			statement.table,
			statement.values,
			statement.returning,
			context,
		);
	}

	if (statement.kind === "update") {
		let columns = Object.keys(statement.changes);

		return {
			text:
				"update " +
				quotePath(getTableName(statement.table)) +
				" set " +
				columns
					.map(
						(column) => quotePath(column) + " = " + pushValue(context, statement.changes[column]),
					)
					.join(", ") +
				compileWhereClause(statement.where, context) +
				compileReturningClause(statement.returning),
			values: context.values,
		};
	}

	if (statement.kind === "delete") {
		return {
			text:
				"delete from " +
				quotePath(getTableName(statement.table)) +
				compileWhereClause(statement.where, context) +
				compileReturningClause(statement.returning),
			values: context.values,
		};
	}

	if (statement.kind === "upsert") {
		return compileUpsertStatement(statement, context);
	}

	throw new Error("Unsupported statement kind");
}

function compileInsertStatement(
	table: StatementTable,
	values: Record<string, unknown>,
	returning: "*" | string[] | undefined,
	context: CompileContext,
): CompiledSql {
	let columns = Object.keys(values);

	if (columns.length === 0) {
		return {
			text:
				"insert into " +
				quotePath(getTableName(table)) +
				" default values" +
				compileReturningClause(returning),
			values: context.values,
		};
	}

	return {
		text:
			"insert into " +
			quotePath(getTableName(table)) +
			" (" +
			columns.map((column) => quotePath(column)).join(", ") +
			") values (" +
			columns.map((column) => pushValue(context, values[column])).join(", ") +
			")" +
			compileReturningClause(returning),
		values: context.values,
	};
}

function compileInsertManyStatement(
	table: StatementTable,
	rows: Record<string, unknown>[],
	returning: "*" | string[] | undefined,
	context: CompileContext,
): CompiledSql {
	if (rows.length === 0) {
		return {
			text: "select 0 where 1 = 0",
			values: context.values,
		};
	}

	let columns = collectColumns(rows);

	if (columns.length === 0) {
		return {
			text:
				"insert into " +
				quotePath(getTableName(table)) +
				" default values" +
				compileReturningClause(returning),
			values: context.values,
		};
	}

	return {
		text:
			"insert into " +
			quotePath(getTableName(table)) +
			" (" +
			columns.map((column) => quotePath(column)).join(", ") +
			") values " +
			rows
				.map(
					(row) =>
						"(" +
						columns
							.map((column) => {
								let value = Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null;
								return pushValue(context, value);
							})
							.join(", ") +
						")",
				)
				.join(", ") +
			compileReturningClause(returning),
		values: context.values,
	};
}

function compileUpsertStatement(statement: UpsertOperation, context: CompileContext): CompiledSql {
	let insertColumns = Object.keys(statement.values);
	let conflictTarget = statement.conflictTarget ?? [...getTablePrimaryKey(statement.table)];

	if (insertColumns.length === 0) {
		throw new Error("upsert requires at least one value");
	}

	let updateValues = statement.update ?? statement.values;
	let updateColumns = Object.keys(updateValues);

	let conflictClause = "";

	if (updateColumns.length === 0) {
		conflictClause =
			" on conflict (" +
			conflictTarget.map((column) => quotePath(column)).join(", ") +
			") do nothing";
	} else {
		conflictClause =
			" on conflict (" +
			conflictTarget.map((column) => quotePath(column)).join(", ") +
			") do update set " +
			updateColumns
				.map((column) => quotePath(column) + " = " + pushValue(context, updateValues[column]))
				.join(", ");
	}

	return {
		text:
			"insert into " +
			quotePath(getTableName(statement.table)) +
			" (" +
			insertColumns.map((column) => quotePath(column)).join(", ") +
			") values (" +
			insertColumns.map((column) => pushValue(context, statement.values[column])).join(", ") +
			")" +
			conflictClause +
			compileReturningClause(statement.returning),
		values: context.values,
	};
}

function compileFromClause(
	table: StatementTable,
	joins: JoinClause[],
	context: CompileContext,
): string {
	let output = " from " + quotePath(getTableName(table));

	for (let join of joins) {
		output +=
			" " +
			normalizeJoinType(join.type) +
			" join " +
			quotePath(getTableName(join.table)) +
			" on " +
			compilePredicate(join.on, context);
	}

	return output;
}

function compileWhereClause(predicates: Predicate[], context: CompileContext): string {
	if (predicates.length === 0) {
		return "";
	}

	return (
		" where " +
		predicates.map((predicate) => "(" + compilePredicate(predicate, context) + ")").join(" and ")
	);
}

function compileGroupByClause(columns: string[]): string {
	if (columns.length === 0) {
		return "";
	}

	return " group by " + columns.map((column) => quotePath(column)).join(", ");
}

function compileHavingClause(predicates: Predicate[], context: CompileContext): string {
	if (predicates.length === 0) {
		return "";
	}

	return (
		" having " +
		predicates.map((predicate) => "(" + compilePredicate(predicate, context) + ")").join(" and ")
	);
}

function compileOrderByClause(orderBy: { column: string; direction: "asc" | "desc" }[]): string {
	if (orderBy.length === 0) {
		return "";
	}

	return (
		" order by " +
		orderBy
			.map((clause) => quotePath(clause.column) + " " + clause.direction.toUpperCase())
			.join(", ")
	);
}

function compileLimitClause(limit: number | undefined): string {
	if (limit === undefined) {
		return "";
	}

	return " limit " + String(limit);
}

function compileOffsetClause(offset: number | undefined): string {
	if (offset === undefined) {
		return "";
	}

	return " offset " + String(offset);
}

function compileReturningClause(returning: "*" | string[] | undefined): string {
	if (!returning) {
		return "";
	}

	if (returning === "*") {
		return " returning *";
	}

	return " returning " + returning.map((column) => quotePath(column)).join(", ");
}

function compilePredicate(predicate: Predicate, context: CompileContext): string {
	if (predicate.type === "comparison") {
		let column = quotePath(predicate.column);

		if (predicate.operator === "eq") {
			if (
				predicate.valueType === "value" &&
				(predicate.value === null || predicate.value === undefined)
			) {
				return column + " is null";
			}

			return column + " = " + compileComparisonValue(predicate, context);
		}

		if (predicate.operator === "ne") {
			if (
				predicate.valueType === "value" &&
				(predicate.value === null || predicate.value === undefined)
			) {
				return column + " is not null";
			}

			return column + " <> " + compileComparisonValue(predicate, context);
		}

		if (predicate.operator === "gt") {
			return column + " > " + compileComparisonValue(predicate, context);
		}

		if (predicate.operator === "gte") {
			return column + " >= " + compileComparisonValue(predicate, context);
		}

		if (predicate.operator === "lt") {
			return column + " < " + compileComparisonValue(predicate, context);
		}

		if (predicate.operator === "lte") {
			return column + " <= " + compileComparisonValue(predicate, context);
		}

		if (predicate.operator === "in" || predicate.operator === "notIn") {
			let values = Array.isArray(predicate.value) ? predicate.value : [];

			if (values.length === 0) {
				return predicate.operator === "in" ? "1 = 0" : "1 = 1";
			}

			let keyword = predicate.operator === "in" ? "in" : "not in";

			return (
				column +
				" " +
				keyword +
				" (" +
				values.map((value) => pushValue(context, value)).join(", ") +
				")"
			);
		}

		if (predicate.operator === "like") {
			return column + " like " + compileComparisonValue(predicate, context);
		}

		if (predicate.operator === "ilike") {
			return "lower(" + column + ") like lower(" + compileComparisonValue(predicate, context) + ")";
		}
	}

	if (predicate.type === "between") {
		return (
			quotePath(predicate.column) +
			" between " +
			pushValue(context, predicate.lower) +
			" and " +
			pushValue(context, predicate.upper)
		);
	}

	if (predicate.type === "null") {
		return (
			quotePath(predicate.column) + (predicate.operator === "isNull" ? " is null" : " is not null")
		);
	}

	if (predicate.type === "logical") {
		if (predicate.predicates.length === 0) {
			return predicate.operator === "and" ? "1 = 1" : "1 = 0";
		}

		let joiner = predicate.operator === "and" ? " and " : " or ";

		return predicate.predicates
			.map((child) => "(" + compilePredicate(child, context) + ")")
			.join(joiner);
	}

	throw new Error("Unsupported predicate");
}

function compileComparisonValue(
	predicate: Extract<Predicate, { type: "comparison" }>,
	context: CompileContext,
): string {
	if (predicate.valueType === "column") {
		return quotePath(predicate.value);
	}

	return pushValue(context, predicate.value);
}

function normalizeJoinType(type: string): string {
	if (type === "left") {
		return "left";
	}

	if (type === "right") {
		return "right";
	}

	return "inner";
}

function quoteIdentifier(value: string): string {
	return '"' + value.replace(/"/g, '""') + '"';
}

function quotePath(path: string): string {
	if (path === "*") {
		return "*";
	}

	return path
		.split(".")
		.map((segment) => {
			if (segment === "*") {
				return "*";
			}

			return quoteIdentifier(segment);
		})
		.join(".");
}

function pushValue(context: CompileContext, value: unknown): string {
	context.values.push(normalizeBoundValue(value));
	return "?";
}

function normalizeBoundValue(value: unknown): unknown {
	if (typeof value === "boolean") {
		return value ? 1 : 0;
	}

	return value;
}

function collectColumns(rows: Record<string, unknown>[]): string[] {
	let columns: string[] = [];
	let seen = new Set<string>();

	for (let row of rows) {
		for (let key in row) {
			if (!Object.prototype.hasOwnProperty.call(row, key)) {
				continue;
			}

			if (seen.has(key)) {
				continue;
			}

			seen.add(key);
			columns.push(key);
		}
	}

	return columns;
}

/**
 * Splits a multi-statement SQL script into individual statements.
 *
 * `SqlStorage.exec` executes a single statement per call, so migration-style
 * scripts must be split before execution.
 */
function splitStatements(sql: string): string[] {
	return sql
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);
}

// Result normalization

function normalizeStatementValues(values: unknown[]): SqlStorageValue[] {
	return values.map((value) => (value === undefined ? null : value)) as SqlStorageValue[];
}

function normalizeRows(rows: unknown[]): Record<string, unknown>[] {
	return rows.map((row) => {
		if (typeof row !== "object" || row === null) {
			return {};
		}

		return { ...(row as Record<string, unknown>) };
	});
}

function normalizeCountRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
	return rows.map((row) => {
		let count = row.count;

		if (typeof count === "string") {
			let numeric = Number(count);

			if (!Number.isNaN(numeric)) {
				return {
					...row,
					count: numeric,
				};
			}
		}

		if (typeof count === "bigint") {
			return {
				...row,
				count: Number(count),
			};
		}

		return row;
	});
}

/**
 * Returns `true` when a `db.exec()`/raw SQL statement's text looks like a `SELECT`
 * (including a `WITH` CTE or a `PRAGMA` read). A `"raw"` operation's kind carries no
 * structural read/write signal — unlike `select`/`insert`/etc., which the query
 * builder already knows — so this sniffs the leading keyword to decide whether the
 * statement's already-executed cursor should be read via `.toArray()`. Without this,
 * a raw `SELECT` silently gets no rows even though the cursor already holds them.
 */
function isReadOnlyRawSql(sql: string): boolean {
	return /^\s*(select|with|pragma)\b/i.test(sql);
}

/** Returns the names of a table's `c.json()`-typed columns. */
function getJsonColumnNames(table: StatementTable): Set<string> {
	let definitions = getTableColumnDefinitions(table);
	let names = new Set<string>();

	for (let [column, definition] of Object.entries(definitions)) {
		if (definition.type === "json") names.add(column);
	}

	return names;
}

/** JSON-encodes every `c.json()` column in a plain values/changes record. */
function encodeJsonValues(
	jsonColumns: Set<string>,
	values: Record<string, unknown>,
): Record<string, unknown> {
	if (jsonColumns.size === 0) return values;

	let encoded: Record<string, unknown> = { ...values };

	for (let column of jsonColumns) {
		if (column in encoded && encoded[column] !== null && encoded[column] !== undefined) {
			encoded[column] = JSON.stringify(encoded[column]);
		}
	}

	return encoded;
}

/**
 * Returns `operation` with every `c.json()` column's value JSON-encoded for binding.
 * SqlStorage's binder only accepts strings/numbers/booleans/null, but `c.json()`
 * columns hold JS objects/arrays at the model layer.
 */
function encodeJsonColumns(operation: DataManipulationOperation): DataManipulationOperation {
	if (operation.kind === "insert") {
		let jsonColumns = getJsonColumnNames(operation.table);
		return { ...operation, values: encodeJsonValues(jsonColumns, operation.values) };
	}

	if (operation.kind === "insertMany") {
		let jsonColumns = getJsonColumnNames(operation.table);
		if (jsonColumns.size === 0) return operation;
		return {
			...operation,
			values: operation.values.map((row) => encodeJsonValues(jsonColumns, row)),
		};
	}

	if (operation.kind === "update") {
		let jsonColumns = getJsonColumnNames(operation.table);
		return { ...operation, changes: encodeJsonValues(jsonColumns, operation.changes) };
	}

	if (operation.kind === "upsert") {
		let jsonColumns = getJsonColumnNames(operation.table);
		if (jsonColumns.size === 0) return operation;
		return {
			...operation,
			values: encodeJsonValues(jsonColumns, operation.values),
			update: operation.update ? encodeJsonValues(jsonColumns, operation.update) : operation.update,
		};
	}

	return operation;
}

/** A table's columns whose stored representation differs from their declared JS type. */
interface DecodableColumns {
	/** `c.json()` columns, stored as JSON text. */
	json: Set<string>;
	/** `c.boolean()` columns, stored as the integers 1 and 0. */
	boolean: Set<string>;
}

/**
 * Collects a table's `c.json()` and `c.boolean()` column names in a single pass.
 *
 * One pass rather than two because this runs per read statement: the read path needs
 * both sets together, while the write path only ever needs the JSON one.
 */
function getDecodableColumnNames(table: StatementTable): DecodableColumns {
	let definitions = getTableColumnDefinitions(table);
	let json = new Set<string>();
	let booleans = new Set<string>();

	for (let [column, definition] of Object.entries(definitions)) {
		if (definition.type === "json") json.add(column);
		else if (definition.type === "boolean") booleans.add(column);
	}

	return { json, boolean: booleans };
}

/**
 * Restores, on every row read back, the JS types SQLite cannot store natively.
 *
 * `c.json()` columns go in as JSON text and must come back as the objects the model
 * layer works with. `c.boolean()` columns are the same problem with a quieter failure:
 * SQLite has no boolean storage class, so `normalizeBoundValue` writes `true`/`false`
 * as `1`/`0` and, without this decode, the column reads back as a number while the
 * generated row type still claims `boolean`. That lie corrupts data rather than
 * crashing — `<input checked={0}>` renders `checked="0"`, and an HTML boolean
 * attribute is on whenever it is merely present, so a stored `false` came back ticked
 * and re-saving the form flipped it to true; a JSON API serializing the same field
 * promised `boolean` and emitted `1`. Decoding here, where the table definition is in
 * hand, is what makes the row type honest for every caller at once, instead of asking
 * each call site to remember a `Boolean(...)` wrapper.
 *
 * `null` is left alone: a nullable boolean column's `null` is a third state, and the
 * `?? true` defaults callers write over it depend on telling it apart from `false`.
 */
function decodeColumns(
	operation: DataManipulationOperation,
	rows: Record<string, unknown>[],
): Record<string, unknown>[] {
	if (operation.kind === "raw" || operation.kind === "count" || operation.kind === "exists") {
		return rows;
	}

	let columns = getDecodableColumnNames(operation.table);
	if (columns.json.size === 0 && columns.boolean.size === 0) return rows;

	return rows.map((row) => {
		let decoded: Record<string, unknown> = { ...row };

		for (let column of columns.json) {
			let value = decoded[column];
			if (typeof value === "string") {
				try {
					decoded[column] = JSON.parse(value);
				} catch {
					// Leave the raw string in place if it somehow isn't valid JSON.
				}
			}
		}

		for (let column of columns.boolean) {
			let value = decoded[column];
			if (typeof value === "number") decoded[column] = value !== 0;
			else if (typeof value === "bigint") decoded[column] = value !== 0n;
		}

		return decoded;
	});
}

/** Returns `true` when an operation asks for a `returning` clause. */
function hasReturningClause(operation: DataManipulationOperation): boolean {
	return (
		(operation.kind === "insert" ||
			operation.kind === "insertMany" ||
			operation.kind === "update" ||
			operation.kind === "delete" ||
			operation.kind === "upsert") &&
		Boolean(operation.returning)
	);
}

function normalizeAffectedRowsForReader(
	kind: DataManipulationOperation["kind"],
	cursor: SqlStorageCursor<Record<string, SqlStorageValue>>,
): number | undefined {
	if (isWriteOperationKind(kind)) {
		return cursor.rowsWritten;
	}

	return undefined;
}

function normalizeInsertIdForReader(
	kind: DataManipulationOperation["kind"],
	operation: DataManipulationOperation,
	rows: Record<string, unknown>[],
): unknown {
	if (!isInsertOperationKind(kind) || !isInsertOperation(operation)) {
		return undefined;
	}

	let primaryKey = getTablePrimaryKey(operation.table);

	if (primaryKey.length !== 1) {
		return undefined;
	}

	let key = primaryKey[0] as string;
	let row = rows[rows.length - 1];

	return row ? row[key] : undefined;
}

function normalizeInsertIdForRun(
	kind: DataManipulationOperation["kind"],
	operation: DataManipulationOperation,
	db: SqlStorage,
): unknown {
	if (!isInsertOperationKind(kind) || !isInsertOperation(operation)) {
		return undefined;
	}

	if (getTablePrimaryKey(operation.table).length !== 1) {
		return undefined;
	}

	// SqlStorage does not expose lastInsertRowid on the cursor, so query it
	// directly. Callers that need the id should prefer a RETURNING clause.
	let row = db.exec("SELECT last_insert_rowid() as id").toArray()[0];

	return row ? row.id : undefined;
}

function isWriteOperationKind(kind: DataManipulationOperation["kind"]): boolean {
	return (
		kind === "insert" ||
		kind === "insertMany" ||
		kind === "update" ||
		kind === "delete" ||
		kind === "upsert"
	);
}

function isInsertOperationKind(kind: DataManipulationOperation["kind"]): boolean {
	return kind === "insert" || kind === "insertMany" || kind === "upsert";
}

function isInsertOperation(
	operation: DataManipulationOperation,
): operation is Extract<DataManipulationOperation, { kind: "insert" | "insertMany" | "upsert" }> {
	return (
		operation.kind === "insert" || operation.kind === "insertMany" || operation.kind === "upsert"
	);
}
