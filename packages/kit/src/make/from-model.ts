/**
 * `sdxc make migration --from-model`: loads a model module in the project's own runtime, reads
 * the data-table tables it exports, replays the chain the migration goes into, and plans the
 * statements that bring that chain's schema in step with the model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { AnyCommandContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { Project } from "../middleware.js";

import { projectPackageManager } from "../package-manager.js";

import type { Name } from "./names.js";
import type { MigrationSource, SchemaChange } from "./schema-diff.js";
import type { TableShape } from "./schema.js";

import { KINDS } from "./kinds.js";
import { chainFolder } from "./migrations.js";
import { parseName } from "./names.js";
import { planMigration } from "./schema-diff.js";

/** The prefix of the line the loader prints its tables on, apart from anything the model logs. */
const MODEL_MARKER = "sdxc-model-tables:";

/**
 * The loader run in the project's runtime. It reports every exported table, and the table of
 * every exported model, once each, as JSON on one marked line; a `bigint` default becomes a number.
 */
const LOADER = `
const KEY = "data-table.tableMetadata";
const metadataOf = (value) => {
	if (value === null || (typeof value !== "object" && typeof value !== "function")) return undefined;
	const symbol = Object.getOwnPropertySymbols(value).find((s) => s.description === KEY);
	return symbol === undefined ? undefined : value[symbol];
};
const module = await import(process.env.SDXC_MODEL);
const seen = new Set();
const tables = [];
for (const value of Object.values(module)) {
	for (const candidate of [value, value?.table]) {
		const metadata = metadataOf(candidate);
		if (metadata === undefined || seen.has(metadata)) continue;
		seen.add(metadata);
		tables.push({ name: metadata.name, primaryKey: metadata.primaryKey, columns: metadata.columnDefinitions });
	}
}
const replacer = (key, value) => (typeof value === "bigint" ? Number(value) : value);
process.stdout.write("\\n${MODEL_MARKER}" + JSON.stringify(tables, replacer) + "\\n");
`;

/** A chain file: a leading number, a separator and a name, as `make migration` writes them. */
const MIGRATION_FILE = /^\d+[-_].+\.sql$/;

/** What `--from-model` found: the model's file and the change its tables need. */
export interface ModelMigration {
	/** The model module, relative to the project root. */
	path: string;
	change: SchemaChange;
}

/**
 * The content of the migration `name` that brings `chain` in step with `model`, with every
 * warning printed and kept in the file as a SQL comment, or `null`, after saying so, when the
 * chain already matches the model and nothing should be written.
 */
export async function modelMigration(
	ctx: Pick<AnyCommandContext, "stdout" | "exec">,
	project: Project,
	model: string,
	chain: string | undefined,
	name: Name,
): Promise<Result<string | null, Error>> {
	let folder = chainFolder(project.config.make.migrations, chain);
	if (isFailure(folder)) return folder;
	let planned = await migrationFromModel(ctx, project.root, folder.data, model);
	if (isFailure(planned)) return planned;
	let { path, change } = planned.data;
	for (let warning of change.warnings) ctx.stdout(`Warning: ${warning}\n`);
	if (change.statements.length === 0) {
		ctx.stdout(`${folder.data} already matches ${path}; nothing to write\n`);
		return success(null);
	}
	let header = [
		`-- ${name.pascal}: brings ${folder.data} in step with ${path}, as sdxc make migration --from-model wrote it.`,
		...change.warnings.map((warning) => `-- Warning: ${warning}`),
	];
	return success(`${header.join("\n")}\n\n${change.statements.join("\n\n")}\n`);
}

/**
 * Plans the migration of `folder`, a chain of the project at `root`, that the tables of the model
 * `model` (named as `make model` names it) need. Fails when the model is missing, exports no
 * table, cannot be loaded, or the chain cannot be replayed.
 */
export async function migrationFromModel(
	ctx: Pick<AnyCommandContext, "exec">,
	root: string,
	folder: string,
	model: string,
): Promise<Result<ModelMigration, Error>> {
	let name = parseName(model);
	if (isFailure(name)) return name;
	let path = `${KINDS.model.folder}/${name.data.segments.join("/")}${KINDS.model.extension}`;
	let found = await wrap(() => stat(join(root, path)));
	if (isFailure(found)) {
		return failure(
			new Error(`${path} not found; --from-model takes a model's name as sdxc make model names it`),
		);
	}
	let tables = await loadTables(ctx, root, path);
	if (isFailure(tables)) return tables;
	let migrations = await readChain(root, folder);
	if (isFailure(migrations)) return migrations;
	let change = planMigration(migrations.data, tables.data);
	if (isFailure(change)) return change;
	return success({ path, change: change.data });
}

/**
 * The tables the module at `path` exports, imported by the runtime `sdxc run` uses, from the
 * project root, so the model resolves its imports exactly as the app does.
 */
export async function loadTables(
	ctx: Pick<AnyCommandContext, "exec">,
	root: string,
	path: string,
): Promise<Result<TableShape[], Error>> {
	let runtime = await projectRuntime(root);
	let command =
		runtime === "bun" ? ["bun", "-e", LOADER] : ["node", "--input-type=module", "-e", LOADER];
	let ran = await ctx.exec(command, {
		cwd: root,
		stdio: "collect",
		env: { SDXC_MODEL: pathToFileURL(join(root, path)).href },
	});
	if (isFailure(ran)) {
		let printed = "stderr" in ran.error ? ran.error.stderr.trim() : "";
		let detail = printed === "" ? ran.error.message : printed;
		return failure(
			new Error(`Could not load ${path} with ${runtime}:\n${detail}`, { cause: ran.error }),
		);
	}
	let line = ran.data.stdout.split("\n").find((text) => text.startsWith(MODEL_MARKER));
	if (line === undefined) return failure(new Error(`${path} did not report its tables`));
	let parsed = wrap(() => JSON.parse(line.slice(MODEL_MARKER.length)) as unknown[]);
	if (isFailure(parsed)) return parsed;
	let tables = parsed.data
		.map((value) => (isTableShape(value) ? value : null))
		.filter((value): value is TableShape => value !== null);
	if (tables.length === 0) {
		return failure(new Error(`${path} exports no remix/data-table table or model`));
	}
	return success(tables);
}

/** Whether a reported value has a table's name, key and columns. */
function isTableShape(value: unknown): value is TableShape {
	if (value === null || typeof value !== "object") return false;
	let shape = value as Record<string, unknown>;
	return (
		typeof shape.name === "string" &&
		Array.isArray(shape.primaryKey) &&
		typeof shape.columns === "object" &&
		shape.columns !== null
	);
}

/** `bun` for a project on Bun and `node` otherwise, as `sdxc run` decides. */
async function projectRuntime(root: string): Promise<"bun" | "node"> {
	let manager = await projectPackageManager(root);
	return manager.name === "bun" ? "bun" : "node";
}

/** Every numbered SQL file of the chain at `folder`; a chain with no folder yet is empty. */
export async function readChain(
	root: string,
	folder: string,
): Promise<Result<MigrationSource[], Error>> {
	let entries = await wrap(() => readdir(join(root, folder)));
	if (isFailure(entries)) {
		let code = (entries.error as NodeJS.ErrnoException).code;
		return code === "ENOENT" ? success([]) : entries;
	}
	return wrap(() =>
		Promise.all(
			entries.data
				.filter((file) => MIGRATION_FILE.test(file))
				.map(async (file) => ({
					name: file,
					sql: await readFile(join(root, folder, file), "utf8"),
				})),
		),
	);
}
