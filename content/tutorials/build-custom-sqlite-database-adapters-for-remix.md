---
title: How to Build Custom SQLite Database Adapters for Remix
excerpt: Create adapters that compile query AST to SQLite for D1 and SqlStorage.
tech: remix@3.0.0 @cloudflare/workers-types@4.20250214.0
---

Let's say you're building a multi-tenant application on Cloudflare where each tenant gets their own isolated database inside a Durable Object. Remix provides a data table abstraction with a unified query builder, but it needs adapters to translate those queries into actual SQL for your specific database.

When deploying to Cloudflare, you have two SQLite options: D1 for serverless SQL at the edge and SqlStorage for embedded databases inside Durable Objects. Both use SQLite, but their APIs differ. D1 is async and returns promises, while SqlStorage is synchronous and returns results immediately. An adapter bridges this gap, translating the query builder's abstract syntax tree (AST) into raw SQL that each database understands.

## Understand the Adapter Interface

Remix defines a `DatabaseAdapter` interface that your adapter must implement:

```ts {% path="lib/sql-storage-adapter.ts" %}
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

The `execute` method receives a structured statement object and returns rows, affected row counts, and insert IDs. The transaction methods let you wrap multiple operations atomically. Capabilities tell the query builder what SQL features your database supports.

## Create the SqlStorage Adapter

SqlStorage lives inside a Durable Object. It's synchronous, so you can call `db.exec()` directly and get results back without awaiting.

```ts {% path="lib/sql-storage-adapter.ts" %}
import type {
	AdapterCapabilityOverrides,
	AdapterExecuteRequest,
	AdapterResult,
	DatabaseAdapter,
	TransactionOptions,
	TransactionToken,
} from "remix/data-table";

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
			// We'll implement this next
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

The adapter tracks active transactions with a Set and a counter. Each transaction gets a unique ID that must be passed to commit, rollback, and savepoint methods. This prevents accidental commits of unrelated transactions.

## Implement the Execute Method

The `execute` method compiles the statement AST into SQL, runs it against the database, and normalizes the results.

```ts {% path="lib/sql-storage-adapter.ts" %}
async execute(request: AdapterExecuteRequest): Promise<AdapterResult> {
	// Handle empty insertMany early
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

	// For write statements with RETURNING clause
	if ("returning" in request.statement && request.statement.returning !== undefined) {
		let rows = normalizeRows(cursor.toArray());

		return {
			rows,
			affectedRows: cursor.rowsWritten,
			insertId: normalizeInsertId(request.statement, rows),
		};
	}

	// For write statements without RETURNING
	return {
		affectedRows: cursor.rowsWritten,
		insertId: undefined,
	};
}
```

The method handles three cases: read statements that return rows, write statements with a RETURNING clause, and plain writes. The `compileSqliteStatement` function does the heavy lifting of translating the AST to SQL.

## Compile Statements to SQL

The statement compiler switches on the statement kind and builds the appropriate SQL string.

```ts {% path="lib/sql-storage-adapter.ts" %}
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

	// Handle insert, update, delete, upsert...
}
```

The context object collects parameter values as the compiler encounters them. Each time a value is added, `pushValue` appends it to the array and returns a placeholder:

```ts {% path="lib/sql-storage-adapter.ts" %}
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
```

SQLite doesn't have a native boolean type, so the adapter converts `true` and `false` to 1 and 0.

## Compile WHERE Clauses

WHERE clauses can contain comparisons, logical operators, null checks, and BETWEEN expressions.

```ts {% path="lib/sql-storage-adapter.ts" %}
function compileWhereClause(predicates: Predicate[], context: CompileContext): string {
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

		// Handle gt, gte, lt, lte, like, ilike...
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

	// Handle null, between...
}
```

The `eq` operator handles null values specially, converting them to `IS NULL` syntax. Empty `IN` clauses become `1 = 0` (always false) and empty `NOT IN` becomes `1 = 1` (always true).

## Handle Upserts

SQLite supports upserts with the `ON CONFLICT` clause.

```ts {% path="lib/sql-storage-adapter.ts" %}
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
```

If no conflict target is specified, the adapter falls back to the table's primary key. If no update values are provided, it uses `DO NOTHING` to ignore conflicts.

## Use the Adapter in a Durable Object

With the adapter complete, you can use it inside a Durable Object to create a database instance.

```ts {% path="tenant/index.ts" %}
import { DurableObject } from "cloudflare:workers";
import { createDatabase } from "remix/data-table";
import { createSQLStorageDatabaseAdapter } from "~/lib/sql-storage-adapter";

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

The database instance is created once when the Durable Object initializes. Every request to the DO uses the same instance, and since SqlStorage is synchronous, there's no connection pooling to worry about.

## Build a D1 Adapter

D1 uses the same SQLite dialect but has an async API. The adapter structure is nearly identical, with one key difference: D1's transaction support is limited.

```ts {% path="lib/d1-adapter.ts" %}
export function createD1DatabaseAdapter(
	db: D1Database,
	options?: D1AdapterOptions,
): DatabaseAdapter {
	return {
		dialect: "sqlite",

		capabilities: {
			returning: true,
			savepoints: false, // D1 doesn't support savepoints
			upsert: true,
		},

		async execute(request: AdapterExecuteRequest): Promise<AdapterResult> {
			let statement = compileSqliteStatement(request.statement);
			let d1Statement = db.prepare(statement.text).bind(...statement.values);
			let result = await d1Statement.all();

			// Process results similar to SqlStorage...
			return {
				rows: normalizeRows(result.results),
				affectedRows: result.meta.changes,
				insertId: result.meta.last_row_id,
			};
		},

		async beginTransaction(): Promise<TransactionToken> {
			// D1 doesn't support explicit transactions in the traditional sense
			// Track them for API compatibility only
			return { id: "tx_" + String(++transactionCounter) };
		},

		// commitTransaction, rollbackTransaction are no-ops for D1
	};
}
```

D1 handles transactions differently than traditional databases. The adapter marks `savepoints` as unsupported and provides stub implementations for transaction methods to maintain API compatibility.

## Normalize Results

Both adapters need to normalize results from their respective databases. The main concern is converting count queries and extracting insert IDs.

```ts {% path="lib/sql-storage-adapter.ts" %}
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
				return { ...row, count: numeric };
			}
		}

		if (typeof count === "bigint") {
			return { ...row, count: Number(count) };
		}

		return row;
	});
}
```

SQLite can return counts as strings or bigints depending on the driver. The normalizer ensures they're always numbers for consistency.

## Final Thoughts

Custom database adapters give you full control over how queries are compiled and executed. The SqlStorage adapter runs synchronously inside Durable Objects, which is perfect for multi-tenant architectures where each tenant gets isolated storage. The D1 adapter works with Cloudflare's serverless SQL database for applications that need a shared database across Workers.

Both adapters share the same SQL compilation logic since they target SQLite. If you need to support PostgreSQL or MySQL, you'd create new adapters with dialect-specific compilation functions while keeping the same interface.
