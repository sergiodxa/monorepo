/**
 * SQLite DDL for a `remix/data-table` table: the `CREATE TABLE` a model's table needs, its unique
 * indexes, and the column clauses `ALTER TABLE` reuses. One renderer serves `make migration
 * --from-model` and every generator that writes a table, so a table is spelled one way everywhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, ColumnDefinition, ColumnTypeName } from "remix/data-table";

/**
 * A table as its data-table definition describes it, in a form that survives JSON: what a model
 * module loaded in the project's own runtime reports back. Column order is declaration order.
 */
export interface TableShape {
	name: string;
	/** The primary key's columns in order; data-table defaults it to `["id"]`. */
	primaryKey: readonly string[];
	columns: Readonly<Record<string, ColumnDefinition>>;
}

/** The description data-table gives the symbol it keeps a table's metadata under. */
const TABLE_METADATA = "data-table.tableMetadata";

/**
 * SQLite's storage class for each data-table type. Dates and times are ISO text, JSON is text,
 * booleans are 0 and 1, and a decimal keeps NUMERIC affinity so `1.50` reads back as a number.
 */
const SQLITE_TYPES: Record<ColumnTypeName, string> = {
	varchar: "TEXT",
	text: "TEXT",
	uuid: "TEXT",
	enum: "TEXT",
	json: "TEXT",
	date: "TEXT",
	time: "TEXT",
	timestamp: "TEXT",
	integer: "INTEGER",
	bigint: "INTEGER",
	boolean: "INTEGER",
	decimal: "NUMERIC",
	binary: "BLOB",
};

/**
 * The shape of a data-table table, or `null` for anything else. The metadata is found by its
 * symbol's description, so a table built by the project's own copy of `remix/data-table` reads
 * the same as one built by this package's copy.
 */
export function tableShape(value: unknown): TableShape | null {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return null;
	let symbol = Object.getOwnPropertySymbols(value).find(
		(candidate) => candidate.description === TABLE_METADATA,
	);
	if (symbol === undefined) return null;
	let metadata = (value as Record<symbol, unknown>)[symbol] as {
		name?: unknown;
		primaryKey?: unknown;
		columnDefinitions?: unknown;
	};
	if (typeof metadata?.name !== "string" || !Array.isArray(metadata.primaryKey)) return null;
	if (typeof metadata.columnDefinitions !== "object" || metadata.columnDefinitions === null) {
		return null;
	}
	return {
		name: metadata.name,
		primaryKey: metadata.primaryKey.map(String),
		columns: metadata.columnDefinitions as Record<string, ColumnDefinition>,
	};
}

/**
 * The SQL that creates `table` on an empty database: its `CREATE TABLE`, then a `CREATE UNIQUE
 * INDEX` per `.unique()` column, each statement ending in `;` and separated by a blank line.
 * Every column is `NOT NULL` unless declared `.nullable()`, as data-table types its rows.
 *
 * @example createTableStatement(postsTable)
 */
export function createTableStatement(table: AnyTable | TableShape): string {
	let shape = tableShape(table) ?? (table as TableShape);
	return [createTable(shape), ...uniqueIndexes(shape)].join("\n\n");
}

/** The `CREATE TABLE` statement alone, under `name` when the table is built beside its original. */
export function createTable(table: TableShape, name: string = table.name): string {
	let composite = table.primaryKey.length > 1;
	let lines = Object.entries(table.columns).map(
		([column, definition]) =>
			`  ${columnClause(table, column, definition, { inlineKey: !composite })}`,
	);
	if (composite) lines.push(`  PRIMARY KEY (${table.primaryKey.map(quote).join(", ")})`);
	for (let [column, definition] of Object.entries(table.columns)) {
		let { references } = definition;
		if (references === undefined) continue;
		lines.push(
			`  CONSTRAINT ${quote(references.name)} FOREIGN KEY (${quote(column)}) ${referencesClause(definition)}`,
		);
	}
	for (let check of checksOf(table)) {
		lines.push(`  CONSTRAINT ${quote(check.name)} CHECK (${check.expression})`);
	}
	return `CREATE TABLE ${quote(name)} (\n${lines.join(",\n")}\n);`;
}

/** One `CREATE UNIQUE INDEX` per `.unique()` column of `table`. */
export function uniqueIndexes(table: TableShape): string[] {
	return Object.entries(table.columns)
		.filter(([, definition]) => definition.unique !== undefined && definition.unique !== false)
		.map(([column]) => uniqueIndex(table, column));
}

/**
 * The unique index `.unique(name)` names, or `<table>_<column>_unique`. An index keeps the
 * column addable with `ALTER TABLE ADD COLUMN`, which refuses an inline `UNIQUE`.
 */
export function uniqueIndex(table: TableShape, column: string): string {
	let unique = table.columns[column]?.unique;
	let named = typeof unique === "object" ? unique.name : undefined;
	let name = named ?? `${table.name}_${column}_unique`;
	return `CREATE UNIQUE INDEX ${quote(name)} ON ${quote(table.name)} (${quote(column)});`;
}

/** How a column is written inside `CREATE TABLE` or after `ADD COLUMN`. */
interface ColumnClauseOptions {
	/** Whether a single-column primary key is declared on the column itself. */
	inlineKey?: boolean;
	/** Whether foreign keys and checks ride on the column, as `ADD COLUMN` needs them to. */
	constraints?: boolean;
}

/**
 * The column's definition: name, type, key, nullability, default, collation and generation, plus
 * its foreign key and checks when `constraints` asks for them.
 */
export function columnClause(
	table: TableShape,
	column: string,
	definition: ColumnDefinition,
	options: ColumnClauseOptions = {},
): string {
	let parts = [quote(column), sqliteType(definition.type)];
	let key = isKey(table, column);
	if (key && options.inlineKey === true) {
		parts.push("PRIMARY KEY");
		if (autoIncrements(table, column)) parts.push("AUTOINCREMENT");
	}
	if (isNotNull(table, column)) parts.push("NOT NULL");
	let fallback = defaultClause(definition);
	if (fallback !== null && definition.computed === undefined) parts.push(`DEFAULT ${fallback}`);
	if (definition.collate !== undefined) parts.push(`COLLATE ${quote(definition.collate)}`);
	if (definition.computed !== undefined) {
		let storage = definition.computed.stored ? "STORED" : "VIRTUAL";
		parts.push(`GENERATED ALWAYS AS (${definition.computed.expression}) ${storage}`);
	}
	if (options.constraints === true) {
		if (definition.references !== undefined) {
			parts.push(`CONSTRAINT ${quote(definition.references.name)} ${referencesClause(definition)}`);
		}
		for (let check of definition.checks ?? []) {
			parts.push(`CONSTRAINT ${quote(check.name)} CHECK (${check.expression})`);
		}
	}
	return parts.join(" ");
}

/** The SQLite type a data-table column type is declared with. */
export function sqliteType(type: ColumnTypeName): string {
	return SQLITE_TYPES[type] ?? "TEXT";
}

/** Whether `column` is part of the table's primary key; names compare as SQLite does, ignoring case. */
export function isKey(table: TableShape, column: string): boolean {
	return table.primaryKey.some((key) => key.toLowerCase() === column.toLowerCase());
}

/** Whether the column refuses `NULL`: a key column always does, any other unless `.nullable()`. */
export function isNotNull(table: TableShape, column: string): boolean {
	return isKey(table, column) || table.columns[column]?.nullable !== true;
}

/**
 * The default's SQL, or `null` without one. A literal becomes a SQL literal (booleans as 0 and 1,
 * dates as ISO text, objects as JSON text), `defaultNow()` becomes `CURRENT_TIMESTAMP`, and a
 * `defaultSql()` expression is wrapped in parentheses, as SQLite requires of an expression.
 */
export function defaultClause(definition: ColumnDefinition): string | null {
	let fallback = definition.default;
	if (fallback === undefined) return null;
	if (fallback.kind === "now") return "CURRENT_TIMESTAMP";
	if (fallback.kind === "sql") return `(${fallback.expression})`;
	return literal(fallback.value);
}

/** `value` as a SQL literal. */
export function literal(value: unknown): string {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "boolean") return value ? "1" : "0";
	if (typeof value === "number" || typeof value === "bigint") return String(value);
	if (value instanceof Date) return text(value.toISOString());
	if (typeof value === "string") return text(value);
	return text(JSON.stringify(value));
}

/** `value` as a single-quoted SQL string. */
function text(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

/** `name` as a double-quoted SQL identifier, which SQLite reads as a name and never as text. */
export function quote(name: string): string {
	return `"${name.replaceAll('"', '""')}"`;
}

/** Every check declared on the table's columns, in column order. */
export function checksOf(table: TableShape): { name: string; expression: string }[] {
	return Object.values(table.columns).flatMap((definition) => definition.checks ?? []);
}

/** The `REFERENCES` clause of a column's foreign key, with its actions. */
function referencesClause(definition: ColumnDefinition): string {
	let references = definition.references;
	if (references === undefined) return "";
	let clause = `REFERENCES ${quote(references.table.name)} (${references.columns.map(quote).join(", ")})`;
	if (references.onDelete !== undefined)
		clause += ` ON DELETE ${references.onDelete.toUpperCase()}`;
	if (references.onUpdate !== undefined)
		clause += ` ON UPDATE ${references.onUpdate.toUpperCase()}`;
	return clause;
}

/**
 * Whether the column is written `INTEGER PRIMARY KEY AUTOINCREMENT`: SQLite allows it only on a
 * single-column integer key, so `.autoIncrement()` or `.identity()` anywhere else is left out.
 */
function autoIncrements(table: TableShape, column: string): boolean {
	let definition = table.columns[column];
	if (definition === undefined || table.primaryKey.length !== 1) return false;
	if (sqliteType(definition.type) !== "INTEGER") return false;
	return definition.autoIncrement === true || definition.identity !== undefined;
}
