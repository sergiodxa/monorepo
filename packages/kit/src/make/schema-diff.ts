/**
 * The migration that brings a chain's schema in step with a model's tables: the chain is replayed
 * into an in-memory SQLite, each table is read back and compared with its data-table definition,
 * and the cheapest statements SQLite and D1 apply without losing rows are chosen and verified.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DatabaseSync } from "node:sqlite";

import type { Result } from "@sdxc/result";
import type { ColumnDefinition, ColumnTypeName } from "remix/data-table";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { TableShape } from "./schema.js";

import {
	checksOf,
	columnClause,
	createTable,
	createTableStatement,
	defaultClause,
	isKey,
	isNotNull,
	quote,
	uniqueIndex,
} from "./schema.js";

/** One migration file of a chain: its file name, which carries its number, and its SQL. */
export interface MigrationSource {
	name: string;
	sql: string;
}

/**
 * What the migration does: its statements in order, each ending in `;`, and what a reviewer must
 * know before applying them. No statements means the chain already matches the model.
 */
export interface SchemaChange {
	statements: string[];
	warnings: string[];
}

/** SQLite's type affinities, which decide how a stored value is read back. */
type Affinity = "INTEGER" | "TEXT" | "BLOB" | "REAL" | "NUMERIC";

/**
 * The affinities whose columns already hold each data-table type's values, so a column declared
 * `VARCHAR(36)`, `BOOLEAN`, `DATETIME` or `DECIMAL` matches its model without a rebuild.
 */
const ACCEPTED_AFFINITIES: Record<ColumnTypeName, readonly Affinity[]> = {
	varchar: ["TEXT"],
	text: ["TEXT"],
	uuid: ["TEXT"],
	enum: ["TEXT"],
	json: ["TEXT"],
	date: ["TEXT", "NUMERIC"],
	time: ["TEXT", "NUMERIC"],
	timestamp: ["TEXT", "NUMERIC"],
	integer: ["INTEGER"],
	bigint: ["INTEGER"],
	boolean: ["INTEGER", "NUMERIC"],
	decimal: ["NUMERIC", "REAL"],
	binary: ["BLOB"],
};

/** Drizzle's marker between the statements of one migration file. */
const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

/** An error {@link replayChain} stepped past because its caller accepted it. */
export interface AcceptedFailure {
	file: string;
	/** SQLite's message for the statement that failed. */
	message: string;
}

/** How {@link replayChain} treats a statement that errors. */
export interface ReplayOptions {
	/**
	 * Whether the replay steps past `message`, raised by a statement of `file`, and goes on with
	 * the next one. Without it, every error stops the replay.
	 */
	accepts?(file: string, message: string): boolean;
}

/** A replayed chain: the database it built, which the caller closes, and the errors it accepted. */
export interface ReplayedChain {
	db: DatabaseSync;
	accepted: AcceptedFailure[];
}

/** The prefix of the table a rebuild creates beside the one it replaces. */
const REBUILD_PREFIX = "__sdxc_new_";

/** A column as `PRAGMA table_xinfo` reports it. */
interface CurrentColumn {
	name: string;
	type: string;
	notNull: boolean;
	default: string | null;
	/** Position in the primary key, from 1, or 0 outside it. */
	key: number;
	/** 2 for a virtual generated column, 3 for a stored one. */
	hidden: number;
}

/** An index as `PRAGMA index_list` and `index_xinfo` report it. */
interface CurrentIndex {
	name: string;
	unique: boolean;
	/** `c` for `CREATE INDEX`, `u` for a `UNIQUE` constraint, `pk` for the primary key. */
	origin: string;
	partial: boolean;
	/** Each key column, `null` for an expression. */
	columns: (string | null)[];
	/** The statement that created it, `null` for one a constraint created. */
	sql: string | null;
}

/** A foreign key as `PRAGMA foreign_key_list` reports it, grouped by constraint. */
interface CurrentForeignKey {
	/** The table holding the key. */
	owner: string;
	table: string;
	from: string[];
	to: string[];
	onDelete: string;
	onUpdate: string;
}

/** A table of the replayed database. */
interface CurrentTable {
	name: string;
	columns: CurrentColumn[];
	indexes: CurrentIndex[];
	foreignKeys: CurrentForeignKey[];
	/** The names of its `CONSTRAINT … CHECK` clauses, lowercased. */
	checks: string[];
	/** How many `CHECK` clauses it has without a name, which no model declares. */
	unnamedChecks: number;
	/** The statements that created its triggers. */
	triggers: string[];
}

/**
 * Plans the migration that makes the schema `migrations` build match `tables`, then applies it to
 * that schema and compares again, so a plan that errors or leaves a difference fails here rather
 * than in production.
 */
export function planMigration(
	migrations: readonly MigrationSource[],
	tables: readonly TableShape[],
): Result<SchemaChange, Error> {
	let replayed = replayChain(migrations);
	if (isFailure(replayed)) return replayed;
	let db = replayed.data.db;
	try {
		let change = diffTables(db, tables);
		if (isFailure(change) || change.data.statements.length === 0) return change;
		let applied = wrap(() => db.exec(change.data.statements.join("\n")));
		if (isFailure(applied)) {
			return failure(
				new Error(`The generated migration does not apply: ${applied.error.message}`, {
					cause: applied.error,
				}),
			);
		}
		let again = diffTables(db, tables);
		if (isFailure(again)) return again;
		if (again.data.statements.length > 0) {
			return failure(
				new Error(
					`The generated migration leaves the schema short of the model; still needed:\n${again.data.statements.join("\n")}`,
				),
			);
		}
		return change;
	} finally {
		db.close();
	}
}

/**
 * A fresh in-memory database with `migrations` applied in order of their leading number, with
 * double-quoted string literals disabled so a copy reading a missing column errors instead of
 * writing the column's name into every row. An error the caller accepts is stepped past.
 *
 * @returns The database, with every accepted error in replay order; the first other error stops
 * the replay with a failure naming its file.
 */
export function replayChain(
	migrations: readonly MigrationSource[],
	options: ReplayOptions = {},
): Result<ReplayedChain, Error> {
	let db = new DatabaseSync(":memory:", { enableDoubleQuotedStringLiterals: false });
	let accepted: AcceptedFailure[] = [];
	let ordered = [...migrations].sort((a, b) => leadingNumber(a.name) - leadingNumber(b.name));
	for (let migration of ordered) {
		for (let statement of statementsOf(migration.sql)) {
			let applied = wrap(() => db.exec(statement));
			if (!isFailure(applied)) continue;
			let message = applied.error.message;
			if (options.accepts?.(migration.name, message) === true) {
				accepted.push({ file: migration.name, message });
				continue;
			}
			db.close();
			return failure(
				new Error(`${migration.name} does not replay: ${message}`, { cause: applied.error }),
			);
		}
	}
	return success({ db, accepted });
}

/**
 * A file's steps: each piece between Drizzle's statement breakpoints, or the whole file as one
 * step. Stepping past an accepted error skips only the statement that raised it in a Drizzle
 * file, so the rest of that file still builds the schema later files read.
 */
function statementsOf(sql: string): string[] {
	return sql.split(STATEMENT_BREAKPOINT).filter((piece) => piece.trim() !== "");
}

/** A file's leading number, which orders a chain; a file without one sorts last. */
function leadingNumber(name: string): number {
	let match = /^(\d+)/.exec(name);
	return match === null ? Number.POSITIVE_INFINITY : Number(match[1]);
}

/** The statements and warnings of every table, in the order the model declares them. */
function diffTables(db: DatabaseSync, tables: readonly TableShape[]): Result<SchemaChange, Error> {
	let change: SchemaChange = { statements: [], warnings: [] };
	for (let table of tables) {
		let current = readTable(db, table.name);
		if (current === null) {
			change.statements.push(...createTableStatement(table).split("\n\n"));
			continue;
		}
		let diffed = diffTable(db, table, current);
		if (isFailure(diffed)) return diffed;
		change.statements.push(...diffed.data.statements);
		change.warnings.push(...diffed.data.warnings);
	}
	return success(change);
}

/**
 * The change one existing table needs. Columns are added and dropped in place where SQLite
 * allows it; any other difference rebuilds the table. A unique index the model lacks is kept
 * with a warning, since dropping it would remove a guarantee the data may rely on.
 */
function diffTable(
	db: DatabaseSync,
	table: TableShape,
	current: CurrentTable,
): Result<SchemaChange, Error> {
	let warnings: string[] = [];
	let reasons: string[] = [];
	let currentColumns = new Map(
		current.columns.map((column) => [column.name.toLowerCase(), column]),
	);
	let modelColumns = Object.entries(table.columns);
	let modelNames = new Set(modelColumns.map(([name]) => name.toLowerCase()));
	let added = modelColumns.filter(([name]) => !currentColumns.has(name.toLowerCase()));
	let dropped = current.columns.filter((column) => !modelNames.has(column.name.toLowerCase()));

	for (let [name, definition] of modelColumns) {
		let existing = currentColumns.get(name.toLowerCase());
		if (existing === undefined) continue;
		let reason = columnDifference(table, name, definition, existing);
		if (reason !== null) reasons.push(`${table.name}.${name} ${reason}`);
	}
	let currentKey = current.columns
		.filter((column) => column.key > 0)
		.sort((a, b) => a.key - b.key)
		.map((column) => column.name.toLowerCase());
	let modelKey = table.primaryKey.map((name) => name.toLowerCase());
	if (currentKey.join(",") !== modelKey.join(",")) {
		reasons.push(`${table.name}'s primary key changes`);
	}
	reasons.push(...foreignKeyDifferences(db, table, current, added, dropped));
	reasons.push(...checkDifferences(table, current, added));
	for (let [name, definition] of added) {
		let blocker = addBlocker(table, name, definition);
		if (blocker !== null) reasons.push(`${table.name}.${name} ${blocker}`);
	}
	for (let column of dropped) {
		warnings.push(
			`${table.name}.${column.name} is not in the model: the migration drops it and deletes its data`,
		);
		let blocker = dropBlocker(current, column);
		if (blocker !== null) reasons.push(`${table.name}.${column.name} ${blocker}`);
	}
	if (added.length > 0 && dropped.length > 0) {
		let gone = dropped.map((column) => column.name).join(", ");
		let fresh = added.map(([name]) => name).join(", ");
		warnings.push(
			`${table.name} drops ${gone} and adds ${fresh}: if that is a rename, sdxc cannot tell, so the data in ${gone} is deleted; copy it in the migration before the drop`,
		);
	}
	let undeclared = undeclaredUniques(table, current);
	for (let column of undeclared) {
		warnings.push(
			`${table.name}.${column} is unique in the database but not in the model: sdxc keeps it; drop it by hand if that is intended`,
		);
	}

	if (reasons.length > 0) {
		let rebuilt = rebuild(db, table, current, reasons);
		if (isFailure(rebuilt)) return rebuilt;
		return success({
			statements: rebuilt.data.statements,
			warnings: [...warnings, ...rebuilt.data.warnings],
		});
	}
	let statements = added.map(
		([name, definition]) =>
			`ALTER TABLE ${quote(table.name)} ADD COLUMN ${columnClause(table, name, definition, { constraints: true })};`,
	);
	for (let [name, definition] of modelColumns) {
		if (!declaresUnique(definition) || hasUniqueIndex(current, name)) continue;
		statements.push(uniqueIndex(table, name));
	}
	for (let column of dropped) {
		statements.push(`ALTER TABLE ${quote(table.name)} DROP COLUMN ${quote(column.name)};`);
	}
	return success({ statements, warnings });
}

/**
 * Why an existing column differs from its definition in a way only a rebuild changes, or `null`.
 * Key columns skip nullability: data-table never writes a null key, and SQLite reports an
 * `INTEGER PRIMARY KEY` as nullable.
 */
function columnDifference(
	table: TableShape,
	name: string,
	definition: ColumnDefinition,
	existing: CurrentColumn,
): string | null {
	let generated = definition.computed === undefined ? 0 : definition.computed.stored ? 3 : 2;
	let hidden = existing.hidden === 2 || existing.hidden === 3 ? existing.hidden : 0;
	if (generated !== hidden) return "changes how it is generated";
	let accepted = ACCEPTED_AFFINITIES[definition.type] ?? ["TEXT"];
	if (!accepted.includes(affinity(existing.type))) return "changes type";
	if (!isKey(table, name) && isNotNull(table, name) !== existing.notNull) {
		return existing.notNull ? "becomes nullable" : "becomes NOT NULL";
	}
	if (definition.computed === undefined) {
		let wanted = defaultClause(definition);
		if (normalizeDefault(wanted) !== normalizeDefault(existing.default)) {
			return `changes its default from ${existing.default ?? "none"} to ${wanted ?? "none"}`;
		}
	}
	return null;
}

/**
 * The affinity SQLite gives a declared type, by its rules: `INT` anywhere is INTEGER, then
 * `CHAR`/`CLOB`/`TEXT` is TEXT, `BLOB` or no type is BLOB, `REAL`/`FLOA`/`DOUB` is REAL, and
 * anything else is NUMERIC.
 */
function affinity(declared: string): Affinity {
	let type = declared.toUpperCase();
	if (type.includes("INT")) return "INTEGER";
	if (/CHAR|CLOB|TEXT/.test(type)) return "TEXT";
	if (type === "" || type.includes("BLOB")) return "BLOB";
	if (/REAL|FLOA|DOUB/.test(type)) return "REAL";
	return "NUMERIC";
}

/**
 * A default's SQL in a form two spellings of one default share: outer parentheses dropped,
 * `TRUE`/`FALSE` as `1`/`0`, numbers by value, and unquoted keywords lowercased. `NULL` and no
 * default are both `null`, which is what SQLite stores for either.
 */
function normalizeDefault(sql: string | null): string | null {
	if (sql === null) return null;
	let text = sql.trim();
	while (wrapped(text)) text = text.slice(1, -1).trim();
	if (/^null$/i.test(text)) return null;
	if (/^true$/i.test(text)) return "1";
	if (/^false$/i.test(text)) return "0";
	if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(text)) return String(Number(text));
	return text.includes("'") ? text : text.toLowerCase();
}

/** Whether one pair of parentheses encloses all of `text`, as in `(a + b)` but not `(a) + (b)`. */
function wrapped(text: string): boolean {
	if (!text.startsWith("(") || !text.endsWith(")")) return false;
	let depth = 0;
	for (let index = 0; index < text.length; index++) {
		let character = text[index];
		if (character === "(") depth++;
		if (character === ")") depth--;
		if (depth === 0 && index < text.length - 1) return false;
	}
	return true;
}

/**
 * Each foreign key the model and the table disagree on, among columns both have; a key on an
 * added column rides on its `ADD COLUMN`, and one on a dropped column goes with it.
 */
function foreignKeyDifferences(
	db: DatabaseSync,
	table: TableShape,
	current: CurrentTable,
	added: readonly [string, ColumnDefinition][],
	dropped: readonly CurrentColumn[],
): string[] {
	let fresh = new Set(added.map(([name]) => name.toLowerCase()));
	let gone = new Set(dropped.map((column) => column.name.toLowerCase()));
	let wanted = new Map<string, string>();
	for (let [name, definition] of Object.entries(table.columns)) {
		let references = definition.references;
		if (references === undefined || fresh.has(name.toLowerCase())) continue;
		wanted.set(
			foreignKeySignature({
				owner: table.name,
				table: references.table.name,
				from: [name],
				to: references.columns,
				onDelete: references.onDelete ?? "no action",
				onUpdate: references.onUpdate ?? "no action",
			}),
			name,
		);
	}
	let present = new Map<string, string>();
	for (let key of current.foreignKeys) {
		if (key.from.length > 1 || key.from.some((column) => gone.has(column.toLowerCase()))) continue;
		let resolved = key.to.length > 0 ? key : { ...key, to: primaryKeyOf(db, key.table) };
		present.set(foreignKeySignature(resolved), key.from.join(", "));
	}
	let reasons: string[] = [];
	for (let [signature, column] of wanted) {
		if (!present.has(signature)) reasons.push(`${table.name}.${column} changes its foreign key`);
	}
	for (let [signature, columns] of present) {
		if (!wanted.has(signature)) reasons.push(`${table.name} drops the foreign key on ${columns}`);
	}
	return reasons;
}

/** A foreign key as one comparable string, case and default actions normalized. */
function foreignKeySignature(key: CurrentForeignKey): string {
	return [
		key.from.join(","),
		key.table,
		key.to.join(","),
		key.onDelete.replace(/\s+/g, " "),
		key.onUpdate.replace(/\s+/g, " "),
	]
		.join("|")
		.toLowerCase();
}

/**
 * Each named check the model and the table disagree on, by name: SQLite keeps no parsed form of
 * a check, so a changed expression under an unchanged name reads as equal. A check on an added
 * column rides on its `ADD COLUMN`.
 */
function checkDifferences(
	table: TableShape,
	current: CurrentTable,
	added: readonly [string, ColumnDefinition][],
): string[] {
	let fresh = new Set(
		added.flatMap(([, definition]) =>
			(definition.checks ?? []).map((check) => check.name.toLowerCase()),
		),
	);
	let wanted = new Set(checksOf(table).map((check) => check.name.toLowerCase()));
	let present = new Set(current.checks);
	let reasons: string[] = [];
	for (let name of wanted) {
		if (!present.has(name) && !fresh.has(name))
			reasons.push(`${table.name} adds the check ${name}`);
	}
	for (let name of present) {
		if (!wanted.has(name)) reasons.push(`${table.name} drops the check ${name}`);
	}
	return reasons;
}

/**
 * Why SQLite cannot `ADD COLUMN` this column, or `null` when it can. D1 enforces foreign keys,
 * so a referencing column also needs a `NULL` default there.
 */
function addBlocker(table: TableShape, name: string, definition: ColumnDefinition): string | null {
	if (isKey(table, name)) return "joins the primary key";
	if (definition.computed?.stored === true) return "is a stored generated column";
	let fallback = definition.default;
	if (fallback !== undefined && fallback.kind !== "literal") {
		return "has a default SQLite cannot add in place";
	}
	let nullDefault = fallback === undefined || fallback.value === null;
	if (definition.computed === undefined && isNotNull(table, name) && nullDefault) {
		return "is NOT NULL with no default";
	}
	if (definition.references !== undefined && !nullDefault) {
		return "references another table and has a default";
	}
	return null;
}

/**
 * Why SQLite cannot `DROP COLUMN` this column, or `null` when it can. A table with checks,
 * generated columns or expression indexes rebuilds instead, since any of them may read it.
 */
function dropBlocker(current: CurrentTable, column: CurrentColumn): string | null {
	let name = column.name.toLowerCase();
	if (column.key > 0) return "leaves the primary key";
	if (column.hidden === 2 || column.hidden === 3) return "is a generated column";
	let indexed = current.indexes.some((index) =>
		index.columns.some((indexed) => indexed === null || indexed.toLowerCase() === name),
	);
	if (indexed || current.indexes.some((index) => index.partial)) return "is indexed";
	if (current.foreignKeys.some((key) => key.from.some((from) => from.toLowerCase() === name))) {
		return "holds a foreign key";
	}
	let checked = current.checks.length + current.unnamedChecks > 0;
	if (checked || current.columns.some((other) => other.hidden >= 2)) {
		return "may be read by a check or a generated column";
	}
	return null;
}

/** Whether `.unique()` was called on the column. */
function declaresUnique(definition: ColumnDefinition | undefined): boolean {
	return definition?.unique !== undefined && definition.unique !== false;
}

/** Whether a full unique index, of any origin, covers exactly `column`. */
function hasUniqueIndex(current: CurrentTable, column: string): boolean {
	return current.indexes.some(
		(index) =>
			index.unique &&
			!index.partial &&
			index.columns.length === 1 &&
			index.columns[0]?.toLowerCase() === column.toLowerCase(),
	);
}

/** The model's columns a single-column unique index or constraint covers without `.unique()`. */
function undeclaredUniques(table: TableShape, current: CurrentTable): string[] {
	let columns = Object.keys(table.columns);
	return columns.filter(
		(name) =>
			!declaresUnique(table.columns[name]) &&
			!(table.primaryKey.length === 1 && isKey(table, name)) &&
			current.indexes.some(
				(index) =>
					index.unique &&
					!index.partial &&
					index.origin !== "pk" &&
					index.columns.length === 1 &&
					index.columns[0]?.toLowerCase() === name.toLowerCase(),
			),
	);
}

/**
 * The twelve-step rebuild D1 can run: create the new table beside the old one, copy every shared
 * column through its **old** name, drop the old table, rename the new one, then recreate the old
 * table's indexes, triggers and unique constraints. Refused when a reference would act on rows.
 */
function rebuild(
	db: DatabaseSync,
	table: TableShape,
	current: CurrentTable,
	reasons: readonly string[],
): Result<SchemaChange, Error> {
	let references = referencesTo(db, table.name);
	for (let [name, definition] of Object.entries(table.columns)) {
		let target = definition.references;
		if (target === undefined || target.table.name.toLowerCase() !== table.name.toLowerCase())
			continue;
		references.push({
			owner: table.name,
			table: table.name,
			from: [name],
			to: target.columns,
			onDelete: (target.onDelete ?? "no action").toUpperCase(),
			onUpdate: (target.onUpdate ?? "no action").toUpperCase(),
		});
	}
	let acting = references.filter((key) => key.onDelete.toUpperCase() !== "NO ACTION");
	if (acting.length > 0) {
		let fired = acting
			.map((key) => `${key.owner}.${key.from.join(", ")} ON DELETE ${key.onDelete.toUpperCase()}`)
			.join(", ");
		return failure(
			new Error(
				`${table.name} needs a rebuild (${reasons.join("; ")}), and dropping it on D1 fires ${fired} on the rows that reference it; write this migration by hand`,
			),
		);
	}

	let warnings = [
		`${table.name} is rebuilt (create, copy, drop, rename) because ${reasons.join("; ")}`,
	];
	for (let key of current.foreignKeys.filter((candidate) => candidate.from.length > 1)) {
		warnings.push(
			`${table.name}'s foreign key on (${key.from.join(", ")}) spans columns a model cannot declare: the rebuild drops it; add it back by hand`,
		);
	}
	if (current.unnamedChecks > 0) {
		warnings.push(
			`${table.name} has ${current.unnamedChecks} unnamed CHECK constraint(s) a model cannot declare: the rebuild drops them; add them back by hand`,
		);
	}
	let temporary = `${REBUILD_PREFIX}${table.name}`;
	let statements = [createTable(table, temporary)];
	let currentColumns = new Map(
		current.columns.map((column) => [column.name.toLowerCase(), column]),
	);
	let targets: string[] = [];
	let sources: string[] = [];
	for (let [name, definition] of Object.entries(table.columns)) {
		if (definition.computed !== undefined) continue;
		let existing = currentColumns.get(name.toLowerCase());
		let notNull = isNotNull(table, name);
		let fallback = defaultClause(definition);
		if (existing === undefined || existing.hidden >= 2) {
			if (notNull && (fallback === null || normalizeDefault(fallback) === null)) {
				warnings.push(
					`${table.name}.${name} is NOT NULL with no default: the rebuild fails on a table with rows; give it a default or fill it in the INSERT`,
				);
			}
			continue;
		}
		targets.push(quote(name));
		let source = quote(existing.name);
		if (notNull && !existing.notNull && !isKey(table, name)) {
			if (fallback === null || normalizeDefault(fallback) === null) {
				warnings.push(
					`${table.name}.${name} becomes NOT NULL with no default: the rebuild fails if a row holds NULL in it`,
				);
			} else {
				source = `COALESCE(${source}, ${fallback})`;
			}
		}
		sources.push(source);
	}
	if (targets.length > 0) {
		statements.push(
			`INSERT INTO ${quote(temporary)} (${targets.join(", ")}) SELECT ${sources.join(", ")} FROM ${quote(table.name)};`,
		);
	} else {
		warnings.push(
			`${table.name} shares no column with the model: the rebuild keeps none of its rows`,
		);
	}
	statements.push(
		`DROP TABLE ${quote(table.name)};`,
		`ALTER TABLE ${quote(temporary)} RENAME TO ${quote(table.name)};`,
	);

	let kept = new Set(Object.keys(table.columns).map((name) => name.toLowerCase()));
	let unique = new Set<string>();
	for (let index of current.indexes) {
		if (index.origin === "pk") continue;
		let missing = index.columns.filter(
			(column): column is string => column !== null && !kept.has(column.toLowerCase()),
		);
		if (missing.length > 0) {
			warnings.push(
				`The index ${index.name} on ${table.name} reads ${missing.join(", ")}, which the model drops: the rebuild leaves it out`,
			);
			continue;
		}
		if (index.unique && !index.partial && index.columns.length === 1) {
			unique.add(index.columns[0]?.toLowerCase() ?? "");
		}
		if (index.sql !== null) {
			statements.push(`${index.sql};`);
			continue;
		}
		let columns = index.columns.filter((column): column is string => column !== null);
		let name = `${table.name}_${columns.join("_")}_unique`;
		statements.push(
			`CREATE UNIQUE INDEX ${quote(name)} ON ${quote(table.name)} (${columns.map(quote).join(", ")});`,
		);
	}
	for (let [name, definition] of Object.entries(table.columns)) {
		if (declaresUnique(definition) && !unique.has(name.toLowerCase())) {
			statements.push(uniqueIndex(table, name));
		}
	}
	statements.push(...current.triggers.map((trigger) => `${trigger};`));
	if (references.length > 0) {
		statements.unshift("PRAGMA defer_foreign_keys = on;");
		statements.push("PRAGMA defer_foreign_keys = off;");
	}
	return success({ statements, warnings });
}

/** Every foreign key in the database that points at `name`, the table's own included. */
function referencesTo(db: DatabaseSync, name: string): CurrentForeignKey[] {
	let tables = db
		.prepare(
			`SELECT "name" FROM "sqlite_master" WHERE "type" = 'table' AND "name" NOT LIKE 'sqlite\\_%' ESCAPE '\\'`,
		)
		.all() as { name: string }[];
	return tables
		.flatMap((owner) => foreignKeysOf(db, owner.name))
		.filter((key) => key.table.toLowerCase() === name.toLowerCase());
}

/** The table named `name`, compared without case as SQLite does, or `null` when it is absent. */
function readTable(db: DatabaseSync, name: string): CurrentTable | null {
	let row = db
		.prepare(
			`SELECT "name", "sql" FROM "sqlite_master" WHERE "type" = 'table' AND "name" = ? COLLATE NOCASE`,
		)
		.get(name) as { name: string; sql: string } | undefined;
	if (row === undefined) return null;
	let columns = (
		db.prepare(`SELECT * FROM pragma_table_xinfo(?)`).all(row.name) as {
			name: string;
			type: string;
			notnull: number;
			dflt_value: string | null;
			pk: number;
			hidden: number;
		}[]
	).map((column) => ({
		name: column.name,
		type: column.type,
		notNull: column.notnull === 1,
		default: column.dflt_value,
		key: column.pk,
		hidden: column.hidden,
	}));
	let indexes = (
		db.prepare(`SELECT * FROM pragma_index_list(?)`).all(row.name) as {
			name: string;
			unique: number;
			origin: string;
			partial: number;
		}[]
	).map((index) => ({
		name: index.name,
		unique: index.unique === 1,
		origin: index.origin,
		partial: index.partial === 1,
		columns: (
			db
				.prepare(`SELECT * FROM pragma_index_xinfo(?) WHERE "key" = 1 ORDER BY "seqno"`)
				.all(index.name) as { name: string | null }[]
		).map((column) => column.name),
		sql:
			(
				db
					.prepare(`SELECT "sql" FROM "sqlite_master" WHERE "type" = 'index' AND "name" = ?`)
					.get(index.name) as { sql: string | null } | undefined
			)?.sql ?? null,
	}));
	let triggers = (
		db
			.prepare(
				`SELECT "sql" FROM "sqlite_master" WHERE "type" = 'trigger' AND "tbl_name" = ? COLLATE NOCASE`,
			)
			.all(row.name) as { sql: string }[]
	).map((trigger) => trigger.sql);
	return {
		name: row.name,
		columns,
		indexes,
		foreignKeys: foreignKeysOf(db, row.name),
		checks: checkNames(row.sql),
		unnamedChecks: Math.max(
			0,
			(row.sql.match(/\bCHECK\s*\(/gi)?.length ?? 0) - checkNames(row.sql).length,
		),
		triggers,
	};
}

/** The foreign keys `owner` holds, one per constraint, with their columns in order. */
function foreignKeysOf(db: DatabaseSync, owner: string): CurrentForeignKey[] {
	let rows = db
		.prepare(`SELECT * FROM pragma_foreign_key_list(?) ORDER BY "id", "seq"`)
		.all(owner) as {
		id: number;
		table: string;
		from: string;
		to: string | null;
		on_update: string;
		on_delete: string;
	}[];
	let keys = new Map<number, CurrentForeignKey>();
	for (let row of rows) {
		let key = keys.get(row.id);
		if (key === undefined) {
			key = {
				owner,
				table: row.table,
				from: [],
				to: [],
				onDelete: row.on_delete,
				onUpdate: row.on_update,
			};
			keys.set(row.id, key);
		}
		key.from.push(row.from);
		if (row.to !== null) key.to.push(row.to);
	}
	return [...keys.values()];
}

/** The primary key columns of `table`, which a `REFERENCES table` without columns points at. */
function primaryKeyOf(db: DatabaseSync, table: string): string[] {
	let rows = db
		.prepare(`SELECT "name" FROM pragma_table_info(?) WHERE "pk" > 0 ORDER BY "pk"`)
		.all(table) as {
		name: string;
	}[];
	return rows.map((row) => row.name);
}

/** The lowercased names of the `CONSTRAINT <name> CHECK` clauses in a `CREATE TABLE`. */
function checkNames(sql: string): string[] {
	let pattern = /CONSTRAINT\s+("(?:[^"]|"")+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*)\s+CHECK\b/gi;
	return [...sql.matchAll(pattern)].map((match) => unquote(match[1] ?? "").toLowerCase());
}

/** An identifier without the quotes SQLite accepts around it. */
function unquote(name: string): string {
	if (name.startsWith('"')) return name.slice(1, -1).replaceAll('""', '"');
	if (name.startsWith("`") || name.startsWith("[")) return name.slice(1, -1);
	return name;
}
