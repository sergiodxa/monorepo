/**
 * Cloudflare D1 adapter for remix/data-table. It implements the DatabaseAdapter
 * interface by compiling data-manipulation and migration operations into SQLite SQL,
 * binding and executing them against a D1 binding, and normalizing rows, affected
 * counts, and insert ids. Because D1 lacks BEGIN/COMMIT and savepoints, it models
 * logical transaction tokens and rejects savepoint calls. It exists to let the app
 * run the data-table query layer on Cloudflare's edge SQLite database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	getTableName,
	getTablePrimaryKey,
	type AdapterCapabilityOverrides,
	type DataManipulationOperation,
	type DataManipulationRequest,
	type DataManipulationResult,
	type DataMigrationOperation,
	type DataMigrationRequest,
	type DataMigrationResult,
	type DatabaseAdapter,
	type SqlStatement,
	type TableRef,
	type TransactionOptions,
	type TransactionToken,
} from "remix/data-table";

/** Tracks positional values collected while compiling SQLite SQL text. */
type SqliteCompileContext = {
	values: Array<unknown>;
};

/** Represents SQL text plus bound values ready for execution. */
type CompiledSqlStatement = {
	text: string;
	values: Array<unknown>;
};

/** Minimal D1 metadata used to normalize adapter results. */
type D1Meta = {
	changes?: number;
	last_row_id?: number;
};

/** Shape returned by D1 `.all()` and `.run()` calls. */
type D1StatementResult = {
	results?: Array<Record<string, unknown>>;
	meta?: D1Meta;
};

/** Query interface used after preparing and binding a D1 statement. */
type D1PreparedQuery = {
	all<T = Record<string, unknown>>(): Promise<{
		results?: Array<T>;
		meta?: D1Meta;
	}>;
	run<T = Record<string, unknown>>(): Promise<{
		results?: Array<T>;
		meta?: D1Meta;
	}>;
};

/**
 * Bridges `remix/data-table` operations to Cloudflare D1 SQL execution.
 *
 * SQL generation follows SQLite semantics to match D1 behavior.
 */
export class D1DataTableAdapter implements DatabaseAdapter {
	/** SQL dialect reported to `remix/data-table`. */
	dialect = "sqlite";
	/** Feature flags that describe which adapter behaviors are supported. */
	capabilities: {
		returning: boolean;
		savepoints: boolean;
		upsert: boolean;
		transactionalDdl: boolean;
		migrationLock: boolean;
	};

	#database: D1Database;
	#transactions = new Set<string>();
	#transactionCounter = 0;

	/**
	 * Creates an adapter bound to a D1 database instance.
	 * @param database D1 binding used to prepare and execute SQL.
	 * @param options Optional capability overrides for adapter feature flags.
	 */
	constructor(
		database: D1Database,
		options?: {
			capabilities?: AdapterCapabilityOverrides;
		},
	) {
		this.#database = database;
		this.capabilities = {
			returning: options?.capabilities?.returning ?? true,
			savepoints: options?.capabilities?.savepoints ?? false,
			upsert: options?.capabilities?.upsert ?? true,
			transactionalDdl: options?.capabilities?.transactionalDdl ?? true,
			migrationLock: options?.capabilities?.migrationLock ?? false,
		};
	}

	/**
	 * Compiles a data-table operation into executable SQL statements.
	 * @param operation Operation to compile.
	 * @returns Compiled SQL statements with positional bind values.
	 */
	compileSql(operation: DataManipulationOperation | DataMigrationOperation): Array<SqlStatement> {
		if (isDataManipulationOperation(operation)) {
			let statement = compileSqliteStatement(operation);
			return [{ text: statement.text, values: statement.values }];
		}

		throw new Error("D1DataTableAdapter migration operation not supported: " + operation.kind);
	}

	/**
	 * Executes a data manipulation request against D1.
	 * @param request Operation request to execute.
	 * @returns Normalized rows, affected row count, and insert id metadata.
	 */
	async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
		if (request.operation.kind === "insertMany" && request.operation.values.length === 0) {
			return {
				affectedRows: 0,
				insertId: undefined,
				rows: request.operation.returning ? [] : undefined,
			};
		}

		const statement = compileSqliteStatement(request.operation);
		const prepared = this.#database
			.prepare(statement.text)
			.bind(...statement.values) as unknown as D1PreparedQuery;

		const shouldReadRows =
			request.operation.kind === "select" ||
			request.operation.kind === "count" ||
			request.operation.kind === "exists" ||
			hasReturningClause(request.operation);

		if (shouldReadRows) {
			const result = (await prepared.all()) as D1StatementResult;
			let rows = normalizeRows(result.results ?? []);
			if (request.operation.kind === "count" || request.operation.kind === "exists") {
				rows = normalizeCountRows(rows);
			}
			return {
				rows,
				affectedRows: normalizeAffectedRowsForReader(request.operation.kind, rows, result.meta),
				insertId: normalizeInsertIdForReader(
					request.operation.kind,
					request.operation,
					rows,
					result.meta,
				),
			};
		}

		const result = (await prepared.run()) as D1StatementResult;
		return {
			affectedRows: normalizeAffectedRowsForRun(request.operation.kind, result),
			insertId: normalizeInsertIdForRun(request.operation.kind, request.operation, result),
		};
	}

	/**
	 * Executes migration operations as compiled SQL statements.
	 * @param request Migration request to run.
	 * @returns Number of applied migration operations.
	 */
	async migrate(request: DataMigrationRequest): Promise<DataMigrationResult> {
		let statements = this.compileSql(request.operation);

		for (let statement of statements) {
			await this.#database
				.prepare(statement.text)
				.bind(...statement.values)
				.run();
		}

		return {
			affectedOperations: statements.length,
		};
	}

	/**
	 * Checks whether a table exists in the current SQLite schema.
	 * @param table Target table reference.
	 * @returns `true` when the table exists.
	 */
	async hasTable(table: TableRef, _transaction?: TransactionToken): Promise<boolean> {
		let schema = table.schema ? quoteIdentifier(table.schema) + "." : "";
		let sql =
			"select 1 as exists from " + schema + "sqlite_master where type = ? and name = ? limit 1";
		let result = await this.#database
			.prepare(sql)
			.bind("table", table.name)
			.all<{ exists?: number }>();

		return Boolean(result.results?.[0]);
	}

	/**
	 * Checks whether a table defines a given column.
	 * @param table Target table reference.
	 * @param column Column name to look up.
	 * @returns `true` when the column exists.
	 */
	async hasColumn(
		table: TableRef,
		column: string,
		_transaction?: TransactionToken,
	): Promise<boolean> {
		let schema = table.schema ? quoteIdentifier(table.schema) + "." : "";
		let sql = "pragma " + schema + "table_info(" + quoteIdentifier(table.name) + ")";
		let result = await this.#database.prepare(sql).all<{ name?: string }>();

		return (result.results ?? []).some((entry) => entry.name === column);
	}

	/**
	 * Opens a logical transaction token for scoped data-table operations.
	 * @param options Optional transaction settings.
	 * @returns Transaction token tracked by the adapter.
	 */
	async beginTransaction(options?: TransactionOptions): Promise<TransactionToken> {
		if (options?.isolationLevel === "read uncommitted") {
			await this.#database.exec("PRAGMA read_uncommitted = true");
		}

		// Cloudflare D1 does not allow SQL BEGIN/COMMIT/ROLLBACK statements.
		// DataTable still requires transaction tokens for scoped operations,
		// so we create logical tokens and rely on per-statement execution.
		this.#transactionCounter += 1;
		const token = { id: "tx_" + String(this.#transactionCounter) };
		this.#transactions.add(token.id);
		return token;
	}

	/**
	 * Marks a logical transaction token as committed.
	 * @param token Transaction token returned by `beginTransaction`.
	 */
	async commitTransaction(token: TransactionToken): Promise<void> {
		this.#assertTransaction(token);
		this.#transactions.delete(token.id);
	}

	/**
	 * Marks a logical transaction token as rolled back.
	 * @param token Transaction token returned by `beginTransaction`.
	 */
	async rollbackTransaction(token: TransactionToken): Promise<void> {
		this.#assertTransaction(token);
		this.#transactions.delete(token.id);
	}

	/**
	 * Throws because Cloudflare D1 does not support savepoints.
	 * @param _token Active transaction token.
	 * @param _name Savepoint name.
	 */
	async createSavepoint(_token: TransactionToken, _name: string): Promise<void> {
		throw new Error("D1DataTableAdapter savepoints are not supported");
	}

	/**
	 * Throws because Cloudflare D1 does not support savepoints.
	 * @param _token Active transaction token.
	 * @param _name Savepoint name.
	 */
	async rollbackToSavepoint(_token: TransactionToken, _name: string): Promise<void> {
		throw new Error("D1DataTableAdapter savepoints are not supported");
	}

	/**
	 * Throws because Cloudflare D1 does not support savepoints.
	 * @param _token Active transaction token.
	 * @param _name Savepoint name.
	 */
	async releaseSavepoint(_token: TransactionToken, _name: string): Promise<void> {
		throw new Error("D1DataTableAdapter savepoints are not supported");
	}

	#assertTransaction(token: TransactionToken) {
		if (!this.#transactions.has(token.id)) {
			throw new Error("Unknown transaction token: " + token.id);
		}
	}
}

/**
 * Creates a D1-backed `DatabaseAdapter` instance.
 * @param database D1 binding used by the adapter.
 * @param options Optional capability overrides.
 * @returns Configured `D1DataTableAdapter`.
 */
export function createD1DataTableAdapter(
	database: D1Database,
	options?: {
		capabilities?: AdapterCapabilityOverrides;
	},
) {
	return new D1DataTableAdapter(database, options);
}

/** Narrows supported operations to data-manipulation variants. */
function isDataManipulationOperation(
	operation: DataManipulationOperation | DataMigrationOperation,
): operation is DataManipulationOperation {
	return (
		operation.kind === "select" ||
		operation.kind === "count" ||
		operation.kind === "exists" ||
		operation.kind === "insert" ||
		operation.kind === "insertMany" ||
		operation.kind === "update" ||
		operation.kind === "delete" ||
		operation.kind === "upsert" ||
		operation.kind === "raw"
	);
}

/** Returns `true` when an operation asks for a `returning` clause. */
function hasReturningClause(statement: DataManipulationOperation) {
	return (
		(statement.kind === "insert" ||
			statement.kind === "insertMany" ||
			statement.kind === "update" ||
			statement.kind === "delete" ||
			statement.kind === "upsert") &&
		Boolean(statement.returning)
	);
}

/** Clones result rows and guarantees plain object outputs. */
function normalizeRows(rows: Array<Record<string, unknown>>) {
	return rows.map((row) => {
		if (typeof row !== "object" || row === null) {
			return {};
		}
		return { ...row };
	});
}

/** Coerces `count` values from D1 to numeric values when possible. */
function normalizeCountRows(rows: Array<Record<string, unknown>>) {
	return rows.map((row) => {
		const count = row.count;
		if (typeof count === "string") {
			const numeric = Number(count);
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

/** Infers affected row count for statements executed through `.all()`. */
function normalizeAffectedRowsForReader(
	kind: DataManipulationOperation["kind"],
	rows: Array<Record<string, unknown>>,
	meta?: D1Meta,
) {
	if (isWriteStatementKind(kind)) {
		if (typeof meta?.changes === "number") {
			return meta.changes;
		}
		return rows.length;
	}
	return undefined;
}

/** Resolves insert id for reader-style executions with `returning`. */
function normalizeInsertIdForReader(
	kind: DataManipulationOperation["kind"],
	statement: DataManipulationOperation,
	rows: Array<Record<string, unknown>>,
	meta?: D1Meta,
) {
	if (!isInsertStatementKind(kind) || !isInsertStatement(statement)) {
		return undefined;
	}
	const primaryKey = getTablePrimaryKey(statement.table);
	if (primaryKey.length !== 1) {
		return undefined;
	}
	const key = primaryKey[0];
	if (!key) {
		return meta?.last_row_id;
	}
	const row = rows[rows.length - 1];
	return row?.[key] ?? meta?.last_row_id;
}

/** Returns affected row count for statements executed through `.run()`. */
function normalizeAffectedRowsForRun(
	kind: DataManipulationOperation["kind"],
	result: D1StatementResult,
) {
	if (kind === "select" || kind === "count" || kind === "exists") {
		return undefined;
	}
	return result.meta?.changes;
}

/** Resolves insert id for write statements executed through `.run()`. */
function normalizeInsertIdForRun(
	kind: DataManipulationOperation["kind"],
	statement: DataManipulationOperation,
	result: D1StatementResult,
) {
	if (!isInsertStatementKind(kind) || !isInsertStatement(statement)) {
		return undefined;
	}
	if (getTablePrimaryKey(statement.table).length !== 1) {
		return undefined;
	}
	return result.meta?.last_row_id;
}

/** Indicates whether an operation kind performs writes. */
function isWriteStatementKind(kind: DataManipulationOperation["kind"]) {
	return (
		kind === "insert" ||
		kind === "insertMany" ||
		kind === "update" ||
		kind === "delete" ||
		kind === "upsert"
	);
}

/** Indicates whether an operation kind can produce an insert id. */
function isInsertStatementKind(kind: DataManipulationOperation["kind"]) {
	return kind === "insert" || kind === "insertMany" || kind === "upsert";
}

/** Narrows operations to insert-capable statement variants. */
function isInsertStatement(
	statement: DataManipulationOperation,
): statement is Extract<DataManipulationOperation, { kind: "insert" | "insertMany" | "upsert" }> {
	return (
		statement.kind === "insert" || statement.kind === "insertMany" || statement.kind === "upsert"
	);
}

/**
 * Compiles a data-manipulation operation into SQLite-compatible SQL.
 *
 * Logic is adapted from `@remix-run/data-table-sqlite` to keep this adapter self-contained.
 */
function compileSqliteStatement(statement: DataManipulationOperation): CompiledSqlStatement {
	if (statement.kind === "raw") {
		return {
			text: statement.sql.text,
			values: [...statement.sql.values],
		};
	}

	const context: SqliteCompileContext = { values: [] };

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
				compileFromClause(statement.table, statement.joins as Array<unknown>, context) +
				compileWhereClause(statement.where as Array<unknown>, context) +
				compileGroupByClause(statement.groupBy) +
				compileHavingClause(statement.having as Array<unknown>, context) +
				compileOrderByClause(statement.orderBy as Array<unknown>) +
				compileLimitClause(statement.limit) +
				compileOffsetClause(statement.offset),
			values: context.values,
		};
	}

	if (statement.kind === "count" || statement.kind === "exists") {
		const inner =
			"select 1" +
			compileFromClause(statement.table, statement.joins as Array<unknown>, context) +
			compileWhereClause(statement.where as Array<unknown>, context) +
			compileGroupByClause(statement.groupBy) +
			compileHavingClause(statement.having as Array<unknown>, context);
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
		return compileInsertStatement(
			statement.table,
			statement.values as Record<string, unknown>,
			statement.returning,
			context,
		);
	}

	if (statement.kind === "insertMany") {
		return compileInsertManyStatement(
			statement.table,
			statement.values as Array<Record<string, unknown>>,
			statement.returning,
			context,
		);
	}

	if (statement.kind === "update") {
		const columns = Object.keys(statement.changes);
		return {
			text:
				"update " +
				quotePath(getTableName(statement.table)) +
				" set " +
				columns
					.map(
						(column) =>
							quotePath(column) +
							" = " +
							pushValue(context, (statement.changes as Record<string, unknown>)[column]),
					)
					.join(", ") +
				compileWhereClause(statement.where as Array<unknown>, context) +
				compileReturningClause(statement.returning),
			values: context.values,
		};
	}

	if (statement.kind === "delete") {
		return {
			text:
				"delete from " +
				quotePath(getTableName(statement.table)) +
				compileWhereClause(statement.where as Array<unknown>, context) +
				compileReturningClause(statement.returning),
			values: context.values,
		};
	}

	if (statement.kind === "upsert") {
		return compileUpsertStatement(statement, context);
	}

	throw new Error("Unsupported statement kind");
}

/** Compiles a single-row insert statement. */
function compileInsertStatement(
	table: Extract<DataManipulationOperation, { kind: "insert" }>["table"],
	values: Record<string, unknown>,
	returning: Extract<DataManipulationOperation, { kind: "insert" }>["returning"],
	context: SqliteCompileContext,
): CompiledSqlStatement {
	const columns = Object.keys(values);
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

/** Compiles a multi-row insert statement with normalized columns. */
function compileInsertManyStatement(
	table: Extract<DataManipulationOperation, { kind: "insertMany" }>["table"],
	rows: Array<Record<string, unknown>>,
	returning: Extract<DataManipulationOperation, { kind: "insertMany" }>["returning"],
	context: SqliteCompileContext,
): CompiledSqlStatement {
	if (rows.length === 0) {
		return {
			text: "select 0 where 1 = 0",
			values: context.values,
		};
	}

	const columns = collectColumns(rows);
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
								const value = Object.prototype.hasOwnProperty.call(row, column)
									? row[column]
									: null;
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

/** Compiles an upsert statement with conflict handling. */
function compileUpsertStatement(
	statement: Extract<DataManipulationOperation, { kind: "upsert" }>,
	context: SqliteCompileContext,
): CompiledSqlStatement {
	const insertColumns = Object.keys(statement.values);
	const conflictTarget = statement.conflictTarget ?? [...getTablePrimaryKey(statement.table)];
	if (insertColumns.length === 0) {
		throw new Error("upsert requires at least one value");
	}

	const updateValues = statement.update ?? statement.values;
	const updateColumns = Object.keys(updateValues);
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
				.map(
					(column) =>
						quotePath(column) +
						" = " +
						pushValue(context, (updateValues as Record<string, unknown>)[column]),
				)
				.join(", ");
	}

	return {
		text:
			"insert into " +
			quotePath(getTableName(statement.table)) +
			" (" +
			insertColumns.map((column) => quotePath(column)).join(", ") +
			") values (" +
			insertColumns
				.map((column) => pushValue(context, (statement.values as Record<string, unknown>)[column]))
				.join(", ") +
			")" +
			conflictClause +
			compileReturningClause(statement.returning),
		values: context.values,
	};
}

/** Compiles the `from ... join ...` portion of a select-like query. */
function compileFromClause(
	table: DataManipulationOperation extends infer T
		? T extends { table: infer tableType }
			? tableType
			: never
		: never,
	joins: Array<unknown>,
	context: SqliteCompileContext,
) {
	let output = " from " + quotePath(getTableName(table));
	for (const join of joins) {
		const typedJoin = join as {
			type: "inner" | "left" | "right";
			table: Parameters<typeof getTableName>[0];
			on: unknown;
		};
		output +=
			" " +
			normalizeJoinType(typedJoin.type) +
			" join " +
			quotePath(getTableName(typedJoin.table)) +
			" on " +
			compilePredicate(typedJoin.on, context);
	}
	return output;
}

/** Compiles the `where` clause from predicate nodes. */
function compileWhereClause(predicates: Array<unknown>, context: SqliteCompileContext) {
	if (predicates.length === 0) {
		return "";
	}
	return (
		" where " +
		predicates.map((predicate) => "(" + compilePredicate(predicate, context) + ")").join(" and ")
	);
}

/** Compiles the `group by` clause for grouped queries. */
function compileGroupByClause(columns: Array<string>) {
	if (columns.length === 0) {
		return "";
	}
	return " group by " + columns.map((column) => quotePath(column)).join(", ");
}

/** Compiles the `having` clause from predicate nodes. */
function compileHavingClause(predicates: Array<unknown>, context: SqliteCompileContext) {
	if (predicates.length === 0) {
		return "";
	}
	return (
		" having " +
		predicates.map((predicate) => "(" + compilePredicate(predicate, context) + ")").join(" and ")
	);
}

/** Compiles the `order by` clause for sorted results. */
function compileOrderByClause(orderBy: Array<unknown>) {
	if (orderBy.length === 0) {
		return "";
	}
	return (
		" order by " +
		orderBy
			.map((clause) => {
				const typedClause = clause as {
					column: string;
					direction: "asc" | "desc";
				};
				return quotePath(typedClause.column) + " " + typedClause.direction.toUpperCase();
			})
			.join(", ")
	);
}

/** Compiles a `limit` clause when one is configured. */
function compileLimitClause(limit?: number) {
	if (limit === undefined) {
		return "";
	}
	return " limit " + String(limit);
}

/** Compiles an `offset` clause when one is configured. */
function compileOffsetClause(offset?: number) {
	if (offset === undefined) {
		return "";
	}
	return " offset " + String(offset);
}

/** Compiles a `returning` clause for write statements. */
function compileReturningClause(returning?: "*" | Array<string>) {
	if (!returning) {
		return "";
	}
	if (returning === "*") {
		return " returning *";
	}
	return " returning " + returning.map((column) => quotePath(column)).join(", ");
}

/** Compiles a predicate node into SQL with bound placeholders. */
function compilePredicate(predicate: unknown, context: SqliteCompileContext): string {
	const typedPredicate = predicate as {
		type: string;
		[column: string]: unknown;
	};

	if (typedPredicate.type === "comparison") {
		const column = quotePath(String(typedPredicate.column));

		if (typedPredicate.operator === "eq") {
			if (
				typedPredicate.valueType === "value" &&
				(typedPredicate.value === null || typedPredicate.value === undefined)
			) {
				return column + " is null";
			}
			const comparisonValue = compileComparisonValue(typedPredicate, context);
			return column + " = " + comparisonValue;
		}

		if (typedPredicate.operator === "ne") {
			if (
				typedPredicate.valueType === "value" &&
				(typedPredicate.value === null || typedPredicate.value === undefined)
			) {
				return column + " is not null";
			}
			const comparisonValue = compileComparisonValue(typedPredicate, context);
			return column + " <> " + comparisonValue;
		}

		if (typedPredicate.operator === "gt") {
			const comparisonValue = compileComparisonValue(typedPredicate, context);
			return column + " > " + comparisonValue;
		}

		if (typedPredicate.operator === "gte") {
			const comparisonValue = compileComparisonValue(typedPredicate, context);
			return column + " >= " + comparisonValue;
		}

		if (typedPredicate.operator === "lt") {
			const comparisonValue = compileComparisonValue(typedPredicate, context);
			return column + " < " + comparisonValue;
		}

		if (typedPredicate.operator === "lte") {
			const comparisonValue = compileComparisonValue(typedPredicate, context);
			return column + " <= " + comparisonValue;
		}

		if (typedPredicate.operator === "in" || typedPredicate.operator === "notIn") {
			const values = Array.isArray(typedPredicate.value) ? typedPredicate.value : [];
			if (values.length === 0) {
				return typedPredicate.operator === "in" ? "1 = 0" : "1 = 1";
			}

			const keyword = typedPredicate.operator === "in" ? "in" : "not in";
			return (
				column +
				" " +
				keyword +
				" (" +
				values.map((value) => pushValue(context, value)).join(", ") +
				")"
			);
		}

		if (typedPredicate.operator === "like") {
			const comparisonValue = compileComparisonValue(typedPredicate, context);
			return column + " like " + comparisonValue;
		}

		if (typedPredicate.operator === "ilike") {
			const comparisonValue = compileComparisonValue(typedPredicate, context);
			return "lower(" + column + ") like lower(" + comparisonValue + ")";
		}
	}

	if (typedPredicate.type === "between") {
		return (
			quotePath(String(typedPredicate.column)) +
			" between " +
			pushValue(context, typedPredicate.lower) +
			" and " +
			pushValue(context, typedPredicate.upper)
		);
	}

	if (typedPredicate.type === "null") {
		return (
			quotePath(String(typedPredicate.column)) +
			(typedPredicate.operator === "isNull" ? " is null" : " is not null")
		);
	}

	if (typedPredicate.type === "logical") {
		const predicates = Array.isArray(typedPredicate.predicates) ? typedPredicate.predicates : [];
		if (predicates.length === 0) {
			return typedPredicate.operator === "and" ? "1 = 1" : "1 = 0";
		}
		const joiner = typedPredicate.operator === "and" ? " and " : " or ";
		return predicates.map((child) => "(" + compilePredicate(child, context) + ")").join(joiner);
	}

	throw new Error("Unsupported predicate");
}

/** Compiles a predicate value as either a column reference or bound value. */
function compileComparisonValue(predicate: any, context: SqliteCompileContext) {
	if (predicate.valueType === "column") {
		return quotePath(String(predicate.value));
	}
	return pushValue(context, predicate.value);
}

/** Normalizes join type tokens to explicit SQLite keywords. */
function normalizeJoinType(type: "inner" | "left" | "right") {
	if (type === "left") {
		return "left";
	}
	if (type === "right") {
		return "right";
	}
	return "inner";
}

/** Quotes an SQL identifier and escapes embedded quotes. */
function quoteIdentifier(value: string) {
	return '"' + value.replace(/"/g, '""') + '"';
}

/** Quotes dot-separated identifiers while preserving `*` segments. */
function quotePath(path: string) {
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

/** Appends a bound value to context and returns a placeholder token. */
function pushValue(context: SqliteCompileContext, value: unknown) {
	context.values.push(normalizeBoundValue(value));
	return "?";
}

/** Normalizes JavaScript values to D1-compatible bound values. */
function normalizeBoundValue(value: unknown) {
	if (typeof value === "boolean") {
		return value ? 1 : 0;
	}
	return value;
}

/** Collects unique column names from a list of row objects. */
function collectColumns(rows: Array<Record<string, unknown>>) {
	const columns: Array<string> = [];
	const seen = new Set<string>();
	for (const row of rows) {
		for (const key in row) {
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
