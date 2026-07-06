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

import { getTableName, getTablePrimaryKey } from "remix/data-table";

interface D1AdapterOptions {
	capabilities?: AdapterCapabilityOverrides;
}

/** Minimal D1 metadata used to normalize adapter results. */
interface D1Meta {
	changes?: number;
	last_row_id?: number;
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
 * Creates a `DatabaseAdapter` backed by a Cloudflare D1 database.
 *
 * SQL generation follows SQLite semantics to match D1 behavior.
 *
 * IMPORTANT — transactions are NOT atomic on D1. Cloudflare D1 has no interactive
 * transactions: it exposes no `BEGIN`/`COMMIT`/`ROLLBACK`, and its only atomic
 * primitive, `db.batch([...])`, requires every statement up front and defers all
 * results until the batch runs. The `remix/data-table` adapter contract instead
 * requires each statement to execute and return its result (rows, `RETURNING`
 * output, `insertId`) synchronously within the `transaction()` callback — for
 * example `Database.update()` reads the `RETURNING` row and throws if it is
 * missing. Those two models are incompatible, so this adapter cannot buffer a
 * scope into a single `batch()` without breaking result-returning callers or
 * fabricating results. It therefore tracks transaction tokens logically and runs
 * each statement immediately; every statement auto-commits on its own and a later
 * failure leaves the earlier statements committed. Callers that need atomic
 * multi-row writes on D1 must express them as a single SQL statement (for example
 * an `insertMany`, a single `UPDATE`, or an `INSERT ... ON CONFLICT`) rather than
 * relying on `transaction()`. The Durable Object adapter
 * (`@pkg/data-table-sqlstorage`) does provide real atomic transactions.
 * @param db D1 binding used to prepare and execute SQL.
 * @param options Optional capability overrides for adapter feature flags.
 * @returns A `DatabaseAdapter` implementation for D1.
 */
export function createD1DatabaseAdapter(
	db: D1Database,
	options?: D1AdapterOptions,
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
			savepoints: options?.capabilities?.savepoints ?? false,
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

			let statement = compileSqliteStatement(operation);
			let prepared = db
				.prepare(statement.text)
				.bind(...statement.values) as unknown as D1PreparedQuery;

			let shouldReadRows =
				operation.kind === "select" ||
				operation.kind === "count" ||
				operation.kind === "exists" ||
				hasReturningClause(operation);

			if (shouldReadRows) {
				let result = (await prepared.all()) as D1StatementResult;
				let rows = normalizeRows(result.results ?? []);

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
		 * Starts a logical transaction scope.
		 *
		 * WARNING — this does NOT provide atomicity. Cloudflare D1 has no interactive
		 * transactions, so no `BEGIN` is issued; statements executed within the scope
		 * each auto-commit independently and a later failure will not roll back the
		 * earlier ones. The token exists only to satisfy the `remix/data-table`
		 * adapter contract for scoped operations. See the note on
		 * {@link createD1DatabaseAdapter} for why real transactions are not possible
		 * here and what to use instead.
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
		 * Ends a logical transaction scope. No `COMMIT` is issued because statements
		 * were already committed as they ran; this only discards the logical token.
		 * @param token Token returned by {@link beginTransaction}.
		 */
		async commitTransaction(token: TransactionToken): Promise<void> {
			assertTransaction(token);
			transactions.delete(token.id);
		},

		/**
		 * Ends a logical transaction scope after an error. This CANNOT undo statements
		 * that already ran within the scope — D1 has no `ROLLBACK` — so partial writes
		 * may remain. It only discards the logical token.
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

// Result normalization

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
	rows: Record<string, unknown>[],
	meta?: D1Meta,
): number | undefined {
	if (isWriteOperationKind(kind)) {
		if (typeof meta?.changes === "number") {
			return meta.changes;
		}
		return rows.length;
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
