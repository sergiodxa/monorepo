/**
 * `sdxc make migration <name> field ...`: the name says what the migration does, as Rails reads
 * it (`create-posts`, `add-slug-to-posts`, `remove-slug-from-posts`), and the fields say which
 * columns, typed by the conventions `sdxc make model` and `sdxc scaffold` use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { ColumnBuilder, ColumnDefinition } from "remix/data-table";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import { column, table } from "remix/data-table";

import type { Field } from "../scaffold/fields.js";

import {
	buildColumn,
	fieldIndexes,
	fieldsTable,
	parseFields,
	resolveReferences,
} from "../scaffold/fields.js";

import type { Name } from "./names.js";
import type { TableShape } from "./schema.js";

import { readChain } from "./from-model.js";
import { replayChain } from "./schema-diff.js";
import { columnClause, createTableStatement, quote, tableShape, uniqueIndex } from "./schema.js";

/** What a migration's name says it does, and to which table. */
export interface MigrationIntent {
	action: "create" | "add" | "remove";
	/** The table's snake_case name: the words after `create`, `to` or `from`. */
	table: string;
}

/** The columns every table has, which no migration adds or drops one by one. */
const RESERVED_COLUMNS = new Set(["id", "created_at", "updated_at"]);

/**
 * The intent `name` spells, or `null` when it spells none: `create-<table>`,
 * `add-<words>-to-<table>` or `remove-<words>-from-<table>`. The last `to` or `from` starts the
 * table's name, so `add-to-do-to-tasks` adds to `tasks`.
 */
export function migrationIntent(name: Name): MigrationIntent | null {
	let words = name.base.split("-");
	let [verb, ...rest] = words;
	if (verb === "create" && rest.length > 0) return { action: "create", table: rest.join("_") };
	if (verb !== "add" && verb !== "remove") return null;
	let at = words.lastIndexOf(verb === "add" ? "to" : "from");
	if (at < 1 || at === words.length - 1) return null;
	return { action: verb, table: words.slice(at + 1).join("_") };
}

/**
 * The content of the migration `name` that `specs` describe, applied to the replayed chain at
 * `folder` before it is returned, so a table that already exists, a missing table or a column
 * SQLite cannot drop fails here. A chain that does not replay is left unchecked.
 *
 * @param root - The project root, whose `app/models/` resolves each reference's table.
 */
export async function fieldMigration(
	root: string,
	folder: string,
	name: Name,
	specs: readonly string[],
): Promise<Result<string, Error>> {
	let intent = migrationIntent(name);
	if (intent === null) {
		return failure(
			new Error(
				`"${name.base}" names no table to change; with fields, name the migration create-<table>, add-<columns>-to-<table> or remove-<columns>-from-<table>`,
			),
		);
	}
	let planned = await statementsOf(root, intent, specs);
	if (isFailure(planned)) return planned;
	let { summary, statements } = planned.data;
	let applied = await applyToChain(root, folder, statements);
	if (isFailure(applied)) return applied;
	return success(`-- ${name.pascal}: ${summary}.\n\n${statements.join("\n\n")}\n`);
}

/** The statements `intent` needs for `specs`, and the line the file's header says it does. */
async function statementsOf(
	root: string,
	intent: MigrationIntent,
	specs: readonly string[],
): Promise<Result<{ summary: string; statements: string[] }, Error>> {
	let { table: name } = intent;
	if (intent.action === "remove") {
		let columns = droppedColumns(specs);
		if (isFailure(columns)) return columns;
		return success({
			summary: `drops ${columns.data.join(", ")} from ${name}`,
			statements: columns.data.map(
				(dropped) => `ALTER TABLE ${quote(name)} DROP COLUMN ${quote(dropped)};`,
			),
		});
	}
	let parsed = parseFields(specs);
	if (isFailure(parsed)) return parsed;
	let fields = await resolveReferences(root, parsed.data);
	if (intent.action === "create") {
		return success({
			summary: `creates the ${name} table`,
			statements: [
				...createTableStatement(fieldsTable(name, fields)).split("\n\n"),
				...fieldIndexes(name, fields),
			],
		});
	}
	let shape = addedColumns(name, fields);
	if (isFailure(shape)) return shape;
	return success({
		summary: `adds ${fields.map((field) => field.column).join(", ")} to ${name}`,
		statements: [
			...fields.map(
				(field) =>
					`ALTER TABLE ${quote(name)} ADD COLUMN ${columnClause(shape.data, field.column, shape.data.columns[field.column] as ColumnDefinition, { constraints: true })};`,
			),
			...fields
				.filter((field) => field.index === "unique")
				.map((field) => uniqueIndex(shape.data, field.column)),
			...fieldIndexes(name, fields),
		],
	});
}

/**
 * The columns `fields` add to `name`, as a table holding only them beside its key. SQLite fills an added column
 * of every existing row with its default, so a box defaults to unticked and any other field must
 * be nullable; a foreign key stays nullable too, as D1 enforces it on the rows already there.
 */
function addedColumns(name: string, fields: readonly Field[]): Result<TableShape, Error> {
	let columns: Record<string, ColumnBuilder> = { id: column.text().primaryKey() };
	for (let field of fields) {
		if (field.type === "boolean") {
			columns[field.column] = column.boolean().default(false);
			continue;
		}
		if (!field.nullable) {
			return failure(
				new Error(
					`${field.column} needs a value for the rows ${name} already holds; write ${field.column}? to add it nullable, or declare it in the model and run make migration --from-model, which rebuilds the table`,
				),
			);
		}
		columns[field.column] = buildColumn(field, name, column);
	}
	let shape = tableShape(table({ name, columns }));
	if (shape === null) return failure(new Error(`Could not describe the columns added to ${name}`));
	return success(shape);
}

/**
 * The snake_case columns `specs` name, each a field as `make model` takes it with its type and
 * `?` ignored; `author:references` names `author_id`. A reserved, repeated or invalid name fails.
 */
function droppedColumns(specs: readonly string[]): Result<string[], Error> {
	let columns: string[] = [];
	for (let spec of specs) {
		let [rawName = "", rawType = ""] = spec.split(":");
		let words = rawName
			.replace(/\?$/, "")
			.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
			.split(/[\s_-]+/)
			.filter((word) => word !== "")
			.map((word) => word.toLowerCase());
		if (rawType.replace(/\?$/, "") === "references" && words.at(-1) !== "id") words.push("id");
		let dropped = words.join("_");
		if (!/^[a-z][a-z0-9_]*$/.test(dropped)) {
			return failure(new Error(`"${spec}" is not a column name; start it with a letter`));
		}
		if (RESERVED_COLUMNS.has(dropped)) {
			return failure(new Error(`${dropped} is a column of every table; it stays`));
		}
		if (columns.includes(dropped)) return failure(new Error(`${dropped} is listed twice`));
		columns.push(dropped);
	}
	return success(columns);
}

/** Applies `statements` after the chain at `folder`, failing with SQLite's own reason. */
async function applyToChain(
	root: string,
	folder: string,
	statements: readonly string[],
): Promise<Result<void, Error>> {
	let migrations = await readChain(root, folder);
	if (isFailure(migrations)) return success(undefined);
	let replayed = replayChain(migrations.data);
	if (isFailure(replayed)) return success(undefined);
	let { db } = replayed.data;
	let applied = wrap(() => db.exec(statements.join("\n")));
	db.close();
	if (isFailure(applied)) {
		return failure(
			new Error(`The migration does not apply after ${folder}: ${applied.error.message}`, {
				cause: applied.error,
			}),
		);
	}
	return success(undefined);
}
