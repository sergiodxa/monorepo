import type {
	AdapterCapabilityOverrides,
	AdapterExecuteRequest,
	AdapterResult,
	AdapterStatement,
	DatabaseAdapter,
	Predicate,
	TransactionOptions,
	TransactionToken,
} from "remix/data-table";

import { getTableName, getTablePrimaryKey } from "remix/data-table";

interface D1AdapterOptions {
	capabilities?: AdapterCapabilityOverrides;
}

interface PendingTransaction {
	statements: D1PreparedStatement[];
	savepoints: Map<string, number>;
}

export function createD1DatabaseAdapter(
	db: D1Database,
	options?: D1AdapterOptions,
): DatabaseAdapter {
	let transactions = new Set<string>();
	let pendingTransactions = new Map<string, PendingTransaction>();
	let transactionStack: string[] = [];
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
		},

		async execute(request: AdapterExecuteRequest): Promise<AdapterResult> {
			if (request.statement.kind === "insertMany" && request.statement.values.length === 0) {
				return {
					affectedRows: 0,
					insertId: undefined,
					rows: request.statement.returning ? [] : undefined,
				};
			}

			let transactionId =
				getRequestTransactionId(request) ?? getCurrentTransactionId(transactionStack);
			let pendingTransaction = transactionId ? pendingTransactions.get(transactionId) : undefined;

			if (pendingTransaction) {
				if (isReadStatement(request.statement)) {
					throw new Error("D1 batch transactions do not support reads inside transaction");
				}

				let statement = compileSqliteStatement(request.statement);
				pendingTransaction.statements.push(db.prepare(statement.text).bind(...statement.values));

				return buildDeferredWriteResult(request.statement);
			}

			let statement = compileSqliteStatement(request.statement);
			let d1Statement = db.prepare(statement.text).bind(...statement.values);
			let result = await d1Statement.all();

			if (isReadStatement(request.statement)) {
				let rows = normalizeRows(result.results);

				if (request.statement.kind === "count" || request.statement.kind === "exists") {
					rows = normalizeCountRows(rows);
				}

				return {
					rows,
					affectedRows: undefined,
					insertId: undefined,
				};
			}

			if ("returning" in request.statement && request.statement.returning !== undefined) {
				let rows = normalizeRows(result.results);

				return {
					rows,
					affectedRows: result.meta.changes,
					insertId: normalizeInsertId(request.statement, rows),
				};
			}

			return {
				affectedRows: result.meta.changes,
				insertId: result.meta.last_row_id,
			};
		},

		async beginTransaction(_options?: TransactionOptions): Promise<TransactionToken> {
			transactionCounter += 1;
			let token = { id: "tx_" + String(transactionCounter) };
			transactions.add(token.id);
			pendingTransactions.set(token.id, { statements: [], savepoints: new Map<string, number>() });
			transactionStack.push(token.id);
			return token;
		},

		async commitTransaction(token: TransactionToken): Promise<void> {
			assertTransaction(token);
			let pendingTransaction = pendingTransactions.get(token.id);

			if (!pendingTransaction) {
				throw new Error("Unknown transaction token: " + token.id);
			}

			try {
				if (pendingTransaction.statements.length > 0) {
					await db.batch(pendingTransaction.statements);
				}
			} finally {
				pendingTransactions.delete(token.id);
				transactions.delete(token.id);
				removeTransactionFromStack(transactionStack, token.id);
			}
		},

		async rollbackTransaction(token: TransactionToken): Promise<void> {
			assertTransaction(token);
			pendingTransactions.delete(token.id);
			transactions.delete(token.id);
			removeTransactionFromStack(transactionStack, token.id);
		},

		async createSavepoint(token: TransactionToken, name: string): Promise<void> {
			assertTransaction(token);
			let pendingTransaction = pendingTransactions.get(token.id);

			if (!pendingTransaction) {
				throw new Error("Unknown transaction token: " + token.id);
			}

			pendingTransaction.savepoints.set(name, pendingTransaction.statements.length);
		},

		async rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
			assertTransaction(token);
			let pendingTransaction = pendingTransactions.get(token.id);

			if (!pendingTransaction) {
				throw new Error("Unknown transaction token: " + token.id);
			}

			let index = pendingTransaction.savepoints.get(name);

			if (typeof index !== "number") {
				throw new Error("Unknown savepoint: " + name);
			}

			pendingTransaction.statements.length = index;
		},

		async releaseSavepoint(token: TransactionToken, name: string): Promise<void> {
			assertTransaction(token);
			let pendingTransaction = pendingTransactions.get(token.id);

			if (!pendingTransaction) {
				throw new Error("Unknown transaction token: " + token.id);
			}

			pendingTransaction.savepoints.delete(name);
		},
	};
}

type JoinClause = Extract<AdapterStatement, { kind: "select" }>["joins"][number];
type UpsertStatement = Extract<AdapterStatement, { kind: "upsert" }>;
type StatementTable = Extract<AdapterStatement, { kind: "select" }>["table"];

interface CompiledSql {
	text: string;
	values: unknown[];
}

interface CompileContext {
	values: unknown[];
}

function compileSqliteStatement(statement: AdapterStatement): CompiledSql {
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

function compileUpsertStatement(statement: UpsertStatement, context: CompileContext): CompiledSql {
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
			conflictTarget.map((column: string) => quotePath(column)).join(", ") +
			") do nothing";
	} else {
		conflictClause =
			" on conflict (" +
			conflictTarget.map((column: string) => quotePath(column)).join(", ") +
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

			let comparisonValue = compileComparisonValue(predicate, context);
			return column + " = " + comparisonValue;
		}

		if (predicate.operator === "ne") {
			if (
				predicate.valueType === "value" &&
				(predicate.value === null || predicate.value === undefined)
			) {
				return column + " is not null";
			}

			let comparisonValue = compileComparisonValue(predicate, context);
			return column + " <> " + comparisonValue;
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
			let comparisonValue = compileComparisonValue(predicate, context);
			return "lower(" + column + ") like lower(" + comparisonValue + ")";
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

function normalizeInsertId(
	statement: AdapterExecuteRequest["statement"],
	rows: Record<string, unknown>[],
): unknown {
	if (!isInsertStatementKind(statement.kind) || !isInsertStatement(statement)) {
		return undefined;
	}

	let primaryKey = getTablePrimaryKey(statement.table);

	if (primaryKey.length !== 1) {
		return undefined;
	}

	let key = primaryKey[0] as string;
	let row = rows[rows.length - 1];

	return row ? row[key] : undefined;
}

function isInsertStatementKind(kind: AdapterExecuteRequest["statement"]["kind"]): boolean {
	return kind === "insert" || kind === "insertMany" || kind === "upsert";
}

function isInsertStatement(
	statement: AdapterExecuteRequest["statement"],
): statement is Extract<
	AdapterExecuteRequest["statement"],
	{ kind: "insert" | "insertMany" | "upsert" }
> {
	return (
		statement.kind === "insert" || statement.kind === "insertMany" || statement.kind === "upsert"
	);
}

function isReadStatement(statement: AdapterStatement): boolean {
	return statement.kind === "select" || statement.kind === "count" || statement.kind === "exists";
}

function buildDeferredWriteResult(statement: AdapterStatement): AdapterResult {
	if (statement.kind === "insert") {
		return buildDeferredInsertResult(statement.table, statement.values, statement.returning);
	}

	if (statement.kind === "insertMany") {
		return buildDeferredInsertManyResult(statement.table, statement.values, statement.returning);
	}

	if (statement.kind === "upsert") {
		return buildDeferredInsertResult(statement.table, statement.values, statement.returning);
	}

	if (
		(statement.kind === "update" || statement.kind === "delete") &&
		statement.returning !== undefined
	) {
		return { rows: [], affectedRows: undefined, insertId: undefined };
	}

	return { affectedRows: undefined, insertId: undefined };
}

function buildDeferredInsertResult(
	table: StatementTable,
	values: Record<string, unknown>,
	returning: "*" | string[] | undefined,
): AdapterResult {
	let rows = returning ? [buildReturningRow(values, returning)] : undefined;

	return {
		rows,
		affectedRows: undefined,
		insertId: inferInsertIdFromValues(table, values, rows),
	};
}

function buildDeferredInsertManyResult(
	table: StatementTable,
	values: Record<string, unknown>[],
	returning: "*" | string[] | undefined,
): AdapterResult {
	let rows = returning ? values.map((row) => buildReturningRow(row, returning)) : undefined;
	let last = values[values.length - 1];

	return {
		rows,
		affectedRows: undefined,
		insertId: inferInsertIdFromValues(table, last ?? {}, rows),
	};
}

function buildReturningRow(
	values: Record<string, unknown>,
	returning: "*" | string[],
): Record<string, unknown> {
	if (returning === "*") {
		return { ...values };
	}

	let row: Record<string, unknown> = {};

	for (let column of returning) {
		row[column] = values[column];
	}

	return row;
}

function inferInsertIdFromValues(
	table: StatementTable,
	values: Record<string, unknown>,
	rows: Record<string, unknown>[] | undefined,
): unknown {
	let primaryKey = getTablePrimaryKey(table);

	if (primaryKey.length !== 1) {
		return undefined;
	}

	let key = primaryKey[0] as string;
	let fromValues = values[key];

	if (fromValues !== undefined) {
		return fromValues;
	}

	if (!rows || rows.length === 0) {
		return undefined;
	}

	let row = rows[rows.length - 1];
	return row ? row[key] : undefined;
}

function getCurrentTransactionId(transactionStack: string[]): string | undefined {
	if (transactionStack.length === 0) {
		return undefined;
	}

	return transactionStack[transactionStack.length - 1];
}

function removeTransactionFromStack(transactionStack: string[], id: string): void {
	let index = transactionStack.lastIndexOf(id);

	if (index === -1) {
		return;
	}

	transactionStack.splice(index, 1);
}

function getRequestTransactionId(request: AdapterExecuteRequest): string | undefined {
	let transactionRequest = request as AdapterExecuteRequest & {
		transaction?: TransactionToken | string;
		transactionToken?: TransactionToken | string;
	};
	let token = transactionRequest.transactionToken ?? transactionRequest.transaction;

	if (!token) {
		return undefined;
	}

	if (typeof token === "string") {
		return token;
	}

	if (typeof token.id === "string") {
		return token.id;
	}

	return undefined;
}
