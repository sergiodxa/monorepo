import { Database } from "bun:sqlite";

import type {
	AdapterCapabilityOverrides,
	AdapterExecuteRequest,
	AdapterResult,
	DatabaseAdapter,
	TransactionOptions,
	TransactionToken,
} from "remix/data-table";

import {
	type AdapterStatement,
	type Predicate,
	createDatabase,
	getTableName,
	getTablePrimaryKey,
} from "remix/data-table";

interface BunSqliteAdapterOptions {
	capabilities?: AdapterCapabilityOverrides;
}

/**
 * Creates a database adapter for Bun's SQLite that mirrors the SqlStorage adapter
 * used in production. This allows us to test models and controllers with an
 * in-memory SQLite database.
 */
export function createBunSqliteDatabaseAdapter(
	db: Database,
	options?: BunSqliteAdapterOptions,
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
		},

		async execute(request: AdapterExecuteRequest): Promise<AdapterResult> {
			if (request.statement.kind === "insertMany" && request.statement.values.length === 0) {
				return {
					affectedRows: 0,
					insertId: undefined,
					rows: request.statement.returning ? [] : undefined,
				};
			}

			let statement = compileSqliteStatement(request.statement);

			let isReadStatement =
				request.statement.kind === "select" ||
				request.statement.kind === "count" ||
				request.statement.kind === "exists";

			if (isReadStatement) {
				let stmt = db.prepare(statement.text);
				let rawRows = stmt.all(...statement.values) as Record<string, unknown>[];
				let rows = normalizeRows(rawRows);

				if (request.statement.kind === "count" || request.statement.kind === "exists") {
					rows = normalizeCountRows(rows);
				}

				return {
					rows,
					affectedRows: undefined,
					insertId: undefined,
				};
			}

			// For write statements
			let stmt = db.prepare(statement.text);
			stmt.run(...statement.values);

			let changes = db.query("SELECT changes() as changes").get() as { changes: number };
			let affectedRows = changes.changes;

			// For write statements with RETURNING clause
			if ("returning" in request.statement && request.statement.returning !== undefined) {
				// Re-run as query to get returned rows
				let returningStmt = db.prepare(statement.text);
				let rawRows = returningStmt.all(...statement.values) as Record<string, unknown>[];
				let rows = normalizeRows(rawRows);

				return {
					rows,
					affectedRows,
					insertId: normalizeInsertId(request.statement, rows),
				};
			}

			// For write statements without RETURNING
			let lastInsertRowId = db.query("SELECT last_insert_rowid() as id").get() as { id: number };

			return {
				affectedRows,
				insertId: lastInsertRowId.id,
			};
		},

		async beginTransaction(_options?: TransactionOptions): Promise<TransactionToken> {
			db.run("BEGIN");

			transactionCounter += 1;
			let token = { id: "tx_" + String(transactionCounter) };
			transactions.add(token.id);

			return token;
		},

		async commitTransaction(token: TransactionToken): Promise<void> {
			assertTransaction(token);
			db.run("COMMIT");
			transactions.delete(token.id);
		},

		async rollbackTransaction(token: TransactionToken): Promise<void> {
			assertTransaction(token);
			db.run("ROLLBACK");
			transactions.delete(token.id);
		},

		async createSavepoint(token: TransactionToken, name: string): Promise<void> {
			assertTransaction(token);
			db.run("SAVEPOINT " + quoteIdentifier(name));
		},

		async rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
			assertTransaction(token);
			db.run("ROLLBACK TO SAVEPOINT " + quoteIdentifier(name));
		},

		async releaseSavepoint(token: TransactionToken, name: string): Promise<void> {
			assertTransaction(token);
			db.run("RELEASE SAVEPOINT " + quoteIdentifier(name));
		},
	};
}

// SQL Compilation (copied from sql-storage-adapter.ts)

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
			let comparisonValue = compileComparisonValue(predicate, context);
			return column + " > " + comparisonValue;
		}

		if (predicate.operator === "gte") {
			let comparisonValue = compileComparisonValue(predicate, context);
			return column + " >= " + comparisonValue;
		}

		if (predicate.operator === "lt") {
			let comparisonValue = compileComparisonValue(predicate, context);
			return column + " < " + comparisonValue;
		}

		if (predicate.operator === "lte") {
			let comparisonValue = compileComparisonValue(predicate, context);
			return column + " <= " + comparisonValue;
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
			let comparisonValue = compileComparisonValue(predicate, context);
			return column + " like " + comparisonValue;
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

// Result normalization

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

/**
 * Creates an in-memory test database with migrations applied
 */
export async function createTestDatabase() {
	let sqliteDb = new Database(":memory:");

	// Load and apply migration
	let { default: migration } = await import("../tenant/migrations/0001-init.sql?raw");
	sqliteDb.run(migration);

	// Create the database adapter and remix/data-table database
	let adapter = createBunSqliteDatabaseAdapter(sqliteDb);
	let db = createDatabase(adapter);

	return { db, sqliteDb };
}
