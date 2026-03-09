---
title: How to Build SQLite Database Adapters for Remix on Cloudflare
excerpt: Build SQLite adapters for SqlStorage and D1 from one shared compiler.
tech: remix@3.0.0 @cloudflare/workers-types@4.20250214.0
---

Let's say you're building a Remix app on Cloudflare and want the same query builder to work with both D1 and Durable Object `SqlStorage`. The missing piece is a database adapter that turns the data table AST into SQLite and normalizes the result shape Remix expects.

In this tutorial, you'll build a shared SQLite compiler, wrap it with a `SqlStorage` adapter, add a D1 adapter, and use the `SqlStorage` version inside a Durable Object. The result is one SQLite implementation that works across both Cloudflare storage APIs.

## Define the Adapter Contract

```ts {% path="app/lib/database/sql-storage-adapter.ts" %}
interface DatabaseAdapter {
	dialect: "sqlite" | "postgres" | "mysql";
	capabilities: {
		returning: boolean;
		savepoints: boolean;
		upsert: boolean;
	};
	execute(request: AdapterExecuteRequest): Promise<AdapterResult>;
	beginTransaction(options?: TransactionOptions): Promise<TransactionToken>;
	commitTransaction(token: TransactionToken): Promise<void>;
	rollbackTransaction(token: TransactionToken): Promise<void>;
	createSavepoint(token: TransactionToken, name: string): Promise<void>;
	rollbackToSavepoint(token: TransactionToken, name: string): Promise<void>;
	releaseSavepoint(token: TransactionToken, name: string): Promise<void>;
}
```

This is the surface your adapter needs to implement. `execute` handles statement execution, and the transaction methods keep the query builder API consistent across drivers.

## Build the Shared SQLite Compiler

```ts {% path="app/lib/database/sqlite-compiler.ts" %}
import type { AdapterStatement, Predicate, UpsertStatement } from "remix/data-table";

export interface CompiledSql {
	text: string;
	values: unknown[];
}

interface CompileContext {
	values: unknown[];
}

export function compileSqliteStatement(statement: AdapterStatement): CompiledSql {
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

	if (statement.kind === "upsert") {
		return compileUpsertStatement(statement, context);
	}

	// Handle insert, insertMany, update, delete, count, and exists here.
	return {
		text: "",
		values: context.values,
	};
}

export function compileWhereClause(predicates: Predicate[], context: CompileContext): string {
	if (predicates.length === 0) {
		return "";
	}

	return (
		" where " +
		predicates.map((predicate) => "(" + compilePredicate(predicate, context) + ")").join(" and ")
	);
}

function compilePredicate(predicate: Predicate, context: CompileContext): string {
	if (predicate.type === "comparison") {
		let column = quotePath(predicate.column);

		if (predicate.operator === "eq") {
			if (predicate.valueType === "value" && predicate.value === null) {
				return column + " is null";
			}

			return column + " = " + compileComparisonValue(predicate, context);
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

		// Handle gt, gte, lt, lte, like, and ilike here.
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

	// Handle null and between predicates here.
	return "1 = 1";
}

function compileUpsertStatement(statement: UpsertStatement, context: CompileContext): CompiledSql {
	let insertColumns = Object.keys(statement.values);
	let conflictTarget = statement.conflictTarget ?? [...getTablePrimaryKey(statement.table)];
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

export function quoteIdentifier(value: string): string {
	return '"' + value.replaceAll('"', '""') + '"';
}

export function quotePath(value: string): string {
	return value
		.split(".")
		.map((part) => quoteIdentifier(part))
		.join(".");
}
```

Start by compiling the AST into parameterized SQLite. This file is shared by both adapters, so the driver specific code only needs to execute SQL and normalize the result.

## Normalize SQLite Results

```ts {% path="app/lib/database/sqlite-results.ts" %}
import type { AdapterExecuteRequest } from "remix/data-table";

export function normalizeRows(rows: unknown[]): Record<string, unknown>[] {
	return rows.map((row) => {
		if (typeof row !== "object" || row === null) {
			return {};
		}

		return { ...(row as Record<string, unknown>) };
	});
}

export function normalizeCountRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
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

export function normalizeInsertId(
	statement: AdapterExecuteRequest["statement"],
	rows: Record<string, unknown>[],
): number | string | undefined {
	if (!("returning" in statement) || statement.returning === undefined) {
		return undefined;
	}

	let firstRow = rows[0];
	if (!firstRow) {
		return undefined;
	}

	let keys = Object.keys(firstRow);
	if (keys.length !== 1) {
		return undefined;
	}

	return firstRow[keys[0]] as number | string | undefined;
}
```

This keeps driver quirks out of your adapter methods. Count queries become numbers, and `RETURNING` results can provide an insert id when the statement shape allows it.

## Create the `SqlStorage` Adapter

```ts {% path="app/lib/database/sql-storage-adapter.ts" %}
import type {
	AdapterCapabilityOverrides,
	AdapterExecuteRequest,
	AdapterResult,
	DatabaseAdapter,
	TransactionOptions,
	TransactionToken,
} from "remix/data-table";
import { compileSqliteStatement, quoteIdentifier } from "./sqlite-compiler";
import { normalizeCountRows, normalizeInsertId, normalizeRows } from "./sqlite-results";

interface SqlStorageAdapterOptions {
	capabilities?: AdapterCapabilityOverrides;
}

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
			let cursor = db.exec(statement.text, ...statement.values);

			let isReadStatement =
				request.statement.kind === "select" ||
				request.statement.kind === "count" ||
				request.statement.kind === "exists";

			if (isReadStatement) {
				let rows = normalizeRows(cursor.toArray());

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
				let rows = normalizeRows(cursor.toArray());

				return {
					rows,
					affectedRows: cursor.rowsWritten,
					insertId: normalizeInsertId(request.statement, rows),
				};
			}

			return {
				affectedRows: cursor.rowsWritten,
				insertId: undefined,
			};
		},
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
		async commitTransaction(token: TransactionToken): Promise<void> {
			assertTransaction(token);
			db.exec("COMMIT");
			transactions.delete(token.id);
		},
		async rollbackTransaction(token: TransactionToken): Promise<void> {
			assertTransaction(token);
			db.exec("ROLLBACK");
			transactions.delete(token.id);
		},
		async createSavepoint(token: TransactionToken, name: string): Promise<void> {
			assertTransaction(token);
			db.exec("SAVEPOINT " + quoteIdentifier(name));
		},
		async rollbackToSavepoint(token: TransactionToken, name: string): Promise<void> {
			assertTransaction(token);
			db.exec("ROLLBACK TO SAVEPOINT " + quoteIdentifier(name));
		},
		async releaseSavepoint(token: TransactionToken, name: string): Promise<void> {
			assertTransaction(token);
			db.exec("RELEASE SAVEPOINT " + quoteIdentifier(name));
		},
	};
}
```

`SqlStorage` is synchronous, so the adapter mostly wraps `db.exec()` and reshapes the cursor output. The transaction token tracking is local state that keeps savepoint and commit calls tied to a known transaction.

## Add the D1 Adapter

```ts {% path="app/lib/database/d1-adapter.ts" %}
import type {
	AdapterCapabilityOverrides,
	AdapterExecuteRequest,
	AdapterResult,
	DatabaseAdapter,
	TransactionToken,
} from "remix/data-table";
import { compileSqliteStatement } from "./sqlite-compiler";
import { normalizeCountRows, normalizeInsertId, normalizeRows } from "./sqlite-results";

interface D1AdapterOptions {
	capabilities?: AdapterCapabilityOverrides;
}

export function createD1DatabaseAdapter(
	db: D1Database,
	options?: D1AdapterOptions,
): DatabaseAdapter {
	let transactionCounter = 0;

	return {
		dialect: "sqlite",
		capabilities: {
			returning: options?.capabilities?.returning ?? true,
			savepoints: false,
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
			let prepared = db.prepare(statement.text).bind(...statement.values);
			let result = await prepared.all();

			let isReadStatement =
				request.statement.kind === "select" ||
				request.statement.kind === "count" ||
				request.statement.kind === "exists";

			if (isReadStatement) {
				let rows = normalizeRows(result.results ?? []);

				if (request.statement.kind === "count" || request.statement.kind === "exists") {
					rows = normalizeCountRows(rows);
				}

				return {
					rows,
					affectedRows: undefined,
					insertId: undefined,
				};
			}

			let rows = normalizeRows(result.results ?? []);

			return {
				rows: request.statement.returning ? rows : undefined,
				affectedRows: result.meta.changes,
				insertId:
					normalizeInsertId(request.statement, rows) ?? result.meta.last_row_id ?? undefined,
			};
		},
		async beginTransaction(): Promise<TransactionToken> {
			transactionCounter += 1;
			return { id: "tx_" + String(transactionCounter) };
		},
		async commitTransaction(): Promise<void> {},
		async rollbackTransaction(): Promise<void> {},
		async createSavepoint(): Promise<void> {},
		async rollbackToSavepoint(): Promise<void> {},
		async releaseSavepoint(): Promise<void> {},
	};
}
```

The D1 adapter stays close to the `SqlStorage` version because both use the same SQLite compiler. The main difference is capability reporting, since D1 does not expose savepoints through this adapter surface.

## Use the Adapter in a Durable Object

```ts {% path="app/do/tenant.ts" %}
import { DurableObject } from "cloudflare:workers";
import { createDatabase } from "remix/data-table";
import { createSQLStorageDatabaseAdapter } from "~/lib/database/sql-storage-adapter";
import { createRouter } from "~/lib/router";

export default class Tenant extends DurableObject {
	#db = createDatabase(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));

	constructor(state: DurableObjectState, env: Cloudflare.Env) {
		super(state, env);
		state.blockConcurrencyWhile(() => this.setup());
	}

	override async fetch(request: Request) {
		let router = createRouter(this.#db);
		return router.fetch(request);
	}

	private async setup() {
		await this.migrate();
	}

	private async migrate() {
		let migrations = await Promise.all([import("./migrations/0001-init.sql?raw")]);

		for (let migration of migrations) {
			this.ctx.storage.sql.exec(migration.default);
		}
	}
}
```

This is the practical outcome of the adapter. Each Durable Object gets an isolated SQLite database, and Remix can talk to it through the same data table interface you can also target at D1.

## Final Thoughts

You now have one SQLite compiler and two adapters that fit Cloudflare's two SQLite APIs. You can extend this further by filling in the remaining statement kinds, adding tests for each AST shape, or introducing another dialect specific compiler for PostgreSQL or MySQL.
