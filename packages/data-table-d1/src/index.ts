/**
 * `DatabaseDriver` implementation for `remix/data-table` backed by Cloudflare D1,
 * compiling operations to SQLite-dialect SQL and normalizing D1's response shapes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	DataManipulationOperation,
	DataManipulationRequest,
	DataManipulationResult,
	DatabaseCapabilities,
	DatabaseDriver,
	TableRef,
	TransactionOptions,
	TransactionToken,
} from "remix/data-table";

import { getTableColumnDefinitions, getTableName, getTablePrimaryKey } from "remix/data-table";

/**
 * What one executed statement cost, as reported by D1 itself. Surfacing it is free:
 * the adapter already reads `meta` to normalize `affectedRows`/`insertId`, and this
 * reuses that same read to give the per-query breakdown a cost regression needs.
 */
export interface D1StatementObservation {
	/** Operation kind the statement came from (`select`, `insert`, `raw`, …). */
	kind: DataManipulationOperation["kind"];
	/** Table the operation targets, or `undefined` for a `raw` statement. */
	table: string | undefined;
	/** `meta.rows_read`: rows D1 read from tables and indexes, 0 when unreported. */
	rowsRead: number;
	/** `meta.rows_written`: rows D1 wrote to tables and indexes, 0 when unreported. */
	rowsWritten: number;
	/** `meta.duration`: milliseconds D1 reports for the statement, 0 when unreported. */
	durationMs: number;
}

/**
 * Receives one {@link D1StatementObservation} per executed statement. This runs
 * on the hot path, once per statement, so an implementation must stay cheap and
 * may throw without consequence — the adapter swallows the error and moves on.
 */
export type D1StatementObserver = (observation: D1StatementObservation) => void;

interface D1AdapterOptions {
	capabilities?: Partial<DatabaseCapabilities>;
	/**
	 * Optional observer called after every statement the adapter executes, with the
	 * row counts D1 reported for it. Leaving it out keeps the adapter's behavior
	 * unchanged, so per-query cost attribution stays entirely up to the caller's own logging.
	 */
	onStatement?: D1StatementObserver;
}

/** Minimal D1 metadata used to normalize adapter results and report statement cost. */
interface D1Meta {
	changes?: number;
	last_row_id?: number;
	rows_read?: number;
	rows_written?: number;
	duration?: number;
}

/** Shape returned by D1 `.all()` and `.run()` calls. */
interface D1StatementResult {
	results?: Record<string, unknown>[];
	meta?: D1Meta;
}

/** Query interface used after preparing and binding a D1 statement. */
interface D1PreparedQuery {
	all<T = Record<string, unknown>>(): Promise<{ results?: T[]; meta?: D1Meta }>;
	run<T = Record<string, unknown>>(): Promise<{ results?: T[]; meta?: D1Meta }>;
}

/**
 * Creates a `DatabaseDriver` backed by a Cloudflare D1 database, compiling operations
 * to SQLite-dialect SQL. D1 commits each statement independently and immediately, so
 * atomic multi-row writes must be a single SQL statement, not a `transaction()` scope.
 * @param db D1 binding used to prepare and execute SQL.
 * @param options Optional capability overrides for adapter feature flags, plus an
 * optional {@link D1StatementObserver} for per-statement row counts.
 * @returns A `DatabaseDriver` implementation for D1.
 */
export function createD1DatabaseAdapter(
	db: D1Database,
	options?: D1AdapterOptions,
): DatabaseDriver {
	let transactions = new Set<string>();
	let transactionCounter = 0;
	/** Read once so the hot path is a closure variable check, not a property lookup. */
	let onStatement = options?.onStatement;

	function assertTransaction(token: TransactionToken): void {
		if (!transactions.has(token.id)) {
			throw new Error("Unknown transaction token: " + token.id);
		}
	}

	return {
		dialect: "sqlite",

		capabilities: {
			returning: options?.capabilities?.returning ?? true,
			savepoints: options?.capabilities?.savepoints ?? false,
			upsert: options?.capabilities?.upsert ?? true,
			transactionalDdl: options?.capabilities?.transactionalDdl ?? true,
			migrationLock: options?.capabilities?.migrationLock ?? false,
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

			operation = encodeJsonColumns(operation);

			let statement = compileSqliteStatement(operation);
			let prepared = db
				.prepare(statement.text)
				.bind(...statement.values) as unknown as D1PreparedQuery;

			let shouldReadRows =
				operation.kind === "select" ||
				operation.kind === "count" ||
				operation.kind === "exists" ||
				hasReturningClause(operation) ||
				(operation.kind === "raw" &&
					(isReadOnlyRawSql(statement.text) || hasRawReturningClause(statement.text)));

			if (shouldReadRows) {
				let result = (await prepared.all()) as D1StatementResult;
				if (onStatement) observeStatement(onStatement, operation, result.meta);
				let rows = normalizeRows(result.results ?? []);
				rows = decodeColumns(operation, rows);

				if (operation.kind === "count" || operation.kind === "exists") {
					rows = normalizeCountRows(rows);
				}

				return {
					rows,
					affectedRows: normalizeAffectedRowsForReader(operation.kind, rows, result.meta),
					insertId: normalizeInsertIdForReader(operation.kind, operation, rows, result.meta),
				};
			}

			let result = (await prepared.run()) as D1StatementResult;
			if (onStatement) observeStatement(onStatement, operation, result.meta);

			return {
				affectedRows: normalizeAffectedRowsForRun(operation.kind, result),
				insertId: normalizeInsertIdForRun(operation.kind, operation, result),
			};
		},

		async executeScript(sql: string): Promise<void> {
			await db.exec(sql);
		},

		async hasTable(table: TableRef, _transaction?: TransactionToken): Promise<boolean> {
			let schema = table.schema ? quoteIdentifier(table.schema) + "." : "";
			let sql =
				"select 1 as exists from " + schema + "sqlite_master where type = ? and name = ? limit 1";
			let result = await db.prepare(sql).bind("table", table.name).all<{ exists?: number }>();

			return Boolean(result.results?.[0]);
		},

		async hasColumn(
			table: TableRef,
			column: string,
			_transaction?: TransactionToken,
		): Promise<boolean> {
			let schema = table.schema ? quoteIdentifier(table.schema) + "." : "";
			let sql = "pragma " + schema + "table_info(" + quoteIdentifier(table.name) + ")";
			let result = await db.prepare(sql).all<{ name?: string }>();

			return (result.results ?? []).some((entry) => entry.name === column);
		},

		/**
		 * Starts a logical transaction scope: each statement within it commits
		 * independently and immediately, so the token exists to satisfy the
		 * `remix/data-table` scope contract. See {@link createD1DatabaseAdapter}.
		 * @param options Transaction hints; `read uncommitted` toggles the matching
		 * pragma.
		 * @returns A logical token identifying the scope.
		 */
		async beginTransaction(options?: TransactionOptions): Promise<TransactionToken> {
			if (options?.isolationLevel === "read uncommitted") {
				await db.exec("PRAGMA read_uncommitted = true");
			}

			transactionCounter += 1;
			let token = { id: "tx_" + String(transactionCounter) };
			transactions.add(token.id);

			return token;
		},

		/**
		 * Ends a logical transaction scope by discarding the token: each statement
		 * already committed independently the moment it ran.
		 * @param token Token returned by {@link beginTransaction}.
		 */
		async commitTransaction(token: TransactionToken): Promise<void> {
			assertTransaction(token);
			transactions.delete(token.id);
		},

		/**
		 * Ends a logical transaction scope after an error by discarding the token.
		 * Statements already committed independently as they ran, so writes made
		 * before the error remain in the database.
		 * @param token Token returned by {@link beginTransaction}.
		 */
		async rollbackTransaction(token: TransactionToken): Promise<void> {
			assertTransaction(token);
			transactions.delete(token.id);
		},

		async createSavepoint(_token: TransactionToken, _name: string): Promise<void> {
			throw new Error("D1 adapter savepoints are not supported");
		},

		async rollbackToSavepoint(_token: TransactionToken, _name: string): Promise<void> {
			throw new Error("D1 adapter savepoints are not supported");
		},

		async releaseSavepoint(_token: TransactionToken, _name: string): Promise<void> {
			throw new Error("D1 adapter savepoints are not supported");
		},

		/**
		 * Throws: Cloudflare alone provisions and owns the D1 database behind this
		 * binding, so a Worker can drop the tables it knows about through it. Callers
		 * wanting an empty schema should run migrations down or provision a fresh database.
		 */
		async wipe(): Promise<void> {
			throw new Error("D1 adapter wipe is not supported");
		},

		/**
		 * The binding is owned and released by the Worker runtime itself, independent
		 * of any adapter built on top of it.
		 */
		close(): void {},
	};
}

/**
 * Reports one executed statement's D1-reported cost to `onStatement`, without
 * allocating when no observer is configured. Anything the observer throws is
 * swallowed, since it exists to measure a statement rather than fail it.
 * @param onStatement Observer configured on the adapter.
 * @param operation Operation the statement was compiled from.
 * @param meta D1's metadata for the statement, if it reported any.
 */
function observeStatement(
	onStatement: D1StatementObserver,
	operation: DataManipulationOperation,
	meta: D1Meta | undefined,
): void {
	try {
		onStatement({
			kind: operation.kind,
			table: operation.kind === "raw" ? undefined : getTableName(operation.table),
			rowsRead: typeof meta?.rows_read === "number" ? meta.rows_read : 0,
			rowsWritten: typeof meta?.rows_written === "number" ? meta.rows_written : 0,
			durationMs: typeof meta?.duration === "number" ? meta.duration : 0,
		});
	} catch {}
}

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
	if (type === "left") return "left";
	if (type === "right") return "right";
	return "inner";
}

function quoteIdentifier(value: string): string {
	return '"' + value.replace(/"/g, '""') + '"';
}

function quotePath(path: string): string {
	if (path === "*") return "*";

	return path
		.split(".")
		.map((segment) => (segment === "*" ? "*" : quoteIdentifier(segment)))
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
			if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
			if (seen.has(key)) continue;
			seen.add(key);
			columns.push(key);
		}
	}

	return columns;
}

function normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
	return rows.map((row) => {
		if (typeof row !== "object" || row === null) {
			return {};
		}
		return { ...row };
	});
}

function normalizeCountRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
	return rows.map((row) => {
		let count = row.count;

		if (typeof count === "string") {
			let numeric = Number(count);
			if (!Number.isNaN(numeric)) {
				return { ...row, count: numeric };
			}
		}

		if (typeof count === "bigint") {
			return { ...row, count: Number(count) };
		}

		return row;
	});
}

/**
 * Returns `true` when a raw SQL statement's text looks like a `SELECT`
 * (including a `WITH` CTE or a `PRAGMA` read), since a `"raw"` operation's kind
 * carries no read/write signal of its own for the adapter to dispatch on.
 */
function isReadOnlyRawSql(sql: string): boolean {
	return /^\s*(select|with|pragma)\b/i.test(sql);
}

/**
 * Reports whether a raw statement carries a `RETURNING` clause, so it
 * dispatches to `.all()` and returns the rows the write produced. The loose
 * word-boundary match favors catching every real `RETURNING` clause over precision.
 */
function hasRawReturningClause(sql: string): boolean {
	return /\breturning\b/i.test(sql);
}

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
 * D1's binder only accepts strings/numbers/booleans/null, but `c.json()` columns
 * hold JS objects/arrays at the model layer.
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
 * Restores, on every row read back, the JS types SQLite cannot store natively:
 * `c.json()` text becomes objects again and `c.boolean()` integers become real
 * booleans, leaving a nullable column's `null` alone as the third state distinct from `false`.
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
				} catch {}
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

/**
 * Computes `affectedRows` for a statement whose rows were already read. A raw
 * statement lands here read-only or as a write with `RETURNING`; reporting
 * `meta.changes` for it matches `run()`'s count for the same statement without the clause.
 * @param kind Operation kind driving the affected-rows rule.
 * @param rows Rows already read for this statement.
 * @param meta D1's metadata for the statement, if it reported any.
 * @returns Affected row count, or `undefined` when none applies.
 */
function normalizeAffectedRowsForReader(
	kind: DataManipulationOperation["kind"],
	rows: Record<string, unknown>[],
	meta?: D1Meta,
): number | undefined {
	if (isWriteOperationKind(kind)) {
		if (typeof meta?.changes === "number") {
			return meta.changes;
		}
		return rows.length;
	}
	if (kind === "raw") {
		return meta?.changes;
	}
	return undefined;
}

function normalizeInsertIdForReader(
	kind: DataManipulationOperation["kind"],
	operation: DataManipulationOperation,
	rows: Record<string, unknown>[],
	meta?: D1Meta,
): unknown {
	if (!isInsertOperationKind(kind) || !isInsertOperation(operation)) {
		return undefined;
	}

	let primaryKey = getTablePrimaryKey(operation.table);

	if (primaryKey.length !== 1) {
		return undefined;
	}

	let key = primaryKey[0];
	if (!key) {
		return meta?.last_row_id;
	}

	let row = rows[rows.length - 1];
	return row?.[key] ?? meta?.last_row_id;
}

function normalizeAffectedRowsForRun(
	kind: DataManipulationOperation["kind"],
	result: D1StatementResult,
): number | undefined {
	if (kind === "select" || kind === "count" || kind === "exists") {
		return undefined;
	}
	return result.meta?.changes;
}

function normalizeInsertIdForRun(
	kind: DataManipulationOperation["kind"],
	operation: DataManipulationOperation,
	result: D1StatementResult,
): unknown {
	if (!isInsertOperationKind(kind) || !isInsertOperation(operation)) {
		return undefined;
	}

	if (getTablePrimaryKey(operation.table).length !== 1) {
		return undefined;
	}

	return result.meta?.last_row_id;
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
