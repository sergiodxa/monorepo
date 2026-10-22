/**
 * `sdxc models [name]`: each model's table as the app runs it, loaded in the project's own
 * runtime, and whether the migration chain creates exactly that table, so a model and its
 * migrations that drifted apart show before a deploy does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { AnyCommandContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { TableShape } from "./make/schema.js";
import type { Project } from "./middleware.js";

import { isAppSource, listFiles } from "./doctor/files.js";
import { loadTables, readChain } from "./make/from-model.js";
import { chainFolder } from "./make/migrations.js";
import { parseName } from "./make/names.js";
import { planMigration } from "./make/schema-diff.js";

/** The folder the layout gives models, and the registry beside them. */
const MODELS_FOLDER = "app/models";

/** A module that defines a model or a table, rather than a helper beside them. */
const DEFINES_TABLE = /\b(?:createModel|table)\s*\(/;

/** One column, as the table declares it. */
export interface ModelColumn {
	name: string;
	type: string;
	nullable: boolean;
	/** The default as data-table describes it, `null` without one. */
	default: unknown;
	/** `primary`, `unique`, or the table and column a foreign key points at. */
	key: string | null;
}

/** One model's table and how the migration chain compares with it. */
export interface ModelSummary {
	/** The model's name as `sdxc make model` takes it: its file under `app/models/`. */
	name: string;
	file: string;
	table: string;
	columns: ModelColumn[];
	/** The statements the chain lacks to match the table; none when it matches. */
	pending: string[];
	/** The factory `sdxc make model` writes beside it, or `null` when the project has none. */
	factory: string | null;
}

/** Every model module under `app/models/`, the registry left out, by the name `make` takes. */
async function modelFiles(root: string): Promise<Array<{ name: string; file: string }>> {
	let models: Array<{ name: string; file: string }> = [];
	for (let file of (await listFiles(root, MODELS_FOLDER)).filter(isAppSource)) {
		if (file === `${MODELS_FOLDER}/index.ts`) continue;
		let source = await wrap(() => readFile(join(root, file), "utf8"));
		if (isFailure(source) || !DEFINES_TABLE.test(source.data)) continue;
		let name = file.slice(MODELS_FOLDER.length + 1).replace(/\.[cm]?[jt]sx?$/, "");
		models.push({ name, file });
	}
	return models;
}

/** The columns of `table`, in declaration order. */
function columnsOf(table: TableShape): ModelColumn[] {
	return Object.entries(table.columns).map(([name, definition]) => {
		let reference = definition.references;
		let key: string | null = null;
		if (table.primaryKey.includes(name)) key = "primary";
		else if (reference !== undefined)
			key = `${reference.table.name}.${reference.columns.join(", ")}`;
		else if (definition.unique !== undefined && definition.unique !== false) key = "unique";
		return {
			name,
			type: definition.type,
			nullable: definition.nullable === true,
			default: definition.default ?? null,
			key,
		};
	});
}

/**
 * Loads each model `names` asks for, every one without names, and compares its table with the
 * default migration chain. A model that fails to load fails the run with the runtime's error.
 */
export async function summarizeModels(
	ctx: Pick<AnyCommandContext, "exec">,
	project: Project,
	names: readonly string[],
): Promise<Result<ModelSummary[], Error>> {
	let { root } = project;
	let files = await modelFiles(root);
	let wanted = files;
	if (names.length > 0) {
		wanted = [];
		for (let requested of names) {
			let name = parseName(requested);
			if (isFailure(name)) return name;
			let found = files.find((model) => model.name === name.data.segments.join("/"));
			if (found === undefined) {
				let known = files.map((model) => model.name).join(", ") || "none";
				return failure(new Error(`No model ${requested} in ${MODELS_FOLDER}/; models: ${known}`));
			}
			wanted.push(found);
		}
	}
	let folder = chainFolder(project.config.make.migrations, undefined);
	if (isFailure(folder)) return folder;
	let chain = await readChain(root, folder.data);
	let summaries: ModelSummary[] = [];
	for (let model of wanted) {
		let tables = await loadTables(ctx, root, model.file);
		if (isFailure(tables)) return tables;
		let planned = isFailure(chain) ? null : planMigration(chain.data, tables.data);
		let pending = planned === null || isFailure(planned) ? [] : planned.data.statements;
		let factory = `database/factories/${model.name}.ts`;
		let hasFactory = (await listFiles(root, "database/factories")).includes(factory);
		for (let table of tables.data) {
			summaries.push({
				name: model.name,
				file: model.file,
				table: table.name,
				columns: columnsOf(table),
				pending,
				factory: hasFactory ? factory : null,
			});
		}
	}
	return success(summaries);
}

/** The migration status line of `model`: in step, or the command that catches the chain up. */
function migrationStatus(model: ModelSummary): string {
	if (model.pending.length === 0) return "the migrations create this table";
	return `the migrations create a different table; sdxc make migration sync-${model.table.replaceAll("_", "-")} --from-model ${model.name} writes the SQL that catches them up`;
}

/** One row per model: its name, file, table, column count and migration status. */
export function formatModelList(models: readonly ModelSummary[]): string {
	if (models.length === 0) return `No models in ${MODELS_FOLDER}/.\n`;
	let rows = models.map((model) => [
		model.name,
		model.file,
		model.table,
		String(model.columns.length),
		model.pending.length === 0 ? "in step" : "behind",
	]);
	return table(["Model", "File", "Table", "Columns", "Migrations"], rows);
}

/** One model in full: its columns, its migration status and its factory. */
export function formatModel(model: ModelSummary): string {
	let rows = model.columns.map((column) => [
		column.name,
		column.type,
		column.nullable ? "yes" : "no",
		column.default === null ? "" : JSON.stringify(column.default),
		column.key ?? "",
	]);
	return [
		`${model.name}: the ${model.table} table, in ${model.file}`,
		"",
		table(["Column", "Type", "Null", "Default", "Key"], rows).trimEnd(),
		"",
		`Migrations: ${migrationStatus(model)}`,
		`Factory: ${model.factory ?? `none; sdxc make factory ${model.name} writes one`}`,
		"",
	].join("\n");
}

/** `rows` under `header`, each column as wide as its widest cell. */
function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
	let widths = header.map((title, column) =>
		Math.max(title.length, ...rows.map((row) => row[column]?.length ?? 0)),
	);
	let line = (row: readonly string[]) =>
		row
			.map((cell, column) => cell.padEnd(widths[column] ?? 0))
			.join("  ")
			.trimEnd();
	return `${[line(header), ...rows.map(line)].join("\n")}\n`;
}
