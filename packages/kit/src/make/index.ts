/**
 * What one `sdxc make <kind>` run does: writes a file of the kind from its stub at the folder
 * the app layout gives it, with a test beside it, declares and maps it where the kind needs it
 * (a policy's abilities and grants included), lists any `@sdxc/*` package it imports in
 * `package.json`, and runs the project's `format`.
 * Every file is planned before any is written, and none is overwritten unless `--force` asks
 * to replace the file and its test, which keeps the declarations they already have.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { AnyCommandContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { Project } from "../middleware.js";
import type { Field } from "../scaffold/fields.js";

import { missingDependencies } from "../dependencies.js";
import { unifiedDiff } from "../diff.js";
import { formatFiles } from "../format.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import {
	columnSource,
	factorySource,
	parseFields,
	pluralize,
	resolveReferences,
} from "../scaffold/fields.js";
import { readManifest } from "../upgrade/project.js";

import type { Declared } from "./declare.js";
import type { MakeRequest, PlannedFile } from "./generate.js";
import type { ResourceAction } from "./guard.js";
import type { KindName, ModelCompanion } from "./kinds.js";

import { declare, declaresAbilities, findRow } from "./declare.js";
import { planEmail } from "./email.js";
import { fieldMigration } from "./from-fields.js";
import { modelMigration } from "./from-model.js";
import { exists, folderOf, plan, resourceScheme } from "./generate.js";
import { planGuard } from "./guard.js";
import { KINDS } from "./kinds.js";
import { chainFolder } from "./migrations.js";
import { mount } from "./mount.js";
import { parseName } from "./names.js";

/** One file to make, as the command line or the prompts gave it. */
export interface MakeInput {
	kind: KindName;
	name: string;
	/** Whether to write a test beside the file; `undefined` takes `make.tests`. */
	test: boolean | undefined;
	dryRun: boolean;
	/** `make job`: a scheduled job with this expression. */
	cron?: string | undefined;
	/** `make controller`: the route method, `form` declaring a GET page with a POST action. */
	method?: string | undefined;
	/** `make controller`: the route's pattern. */
	path?: string | undefined;
	/** `make controller`: the route contract in `routes/`; `undefined` takes `make.routes`. */
	routes?: string | undefined;
	/** `make controller`: the resource whose ability the method implies guards every handler. */
	guardedBy?: string | undefined;
	/** `make controller --actions`: the ability to check instead of the one the method implies. */
	ability?: ResourceAction | undefined;
	/** `make mcp`: a resource instead of a tool. */
	resource?: boolean | undefined;
	/** `make migration`: the chain in `make.migrations`. */
	chain?: string | undefined;
	/** `make migration`: the model whose tables the migration brings the chain in step with. */
	fromModel?: string | undefined;
	/** `make middleware`: the router initializer or chain module to call it last in. */
	mount?: string | undefined;
	/**
	 * `make model`: each field as `sdxc scaffold` takes it, written as a column, a factory value
	 * and a column of its migration. `make migration`: the columns its name adds or drops.
	 * `make email`: the props its schema declares and its template renders.
	 */
	fields?: readonly string[] | undefined;
	/** `make model`: the companions to leave out. */
	skip?: readonly ModelCompanion[] | undefined;
	/**
	 * Replace the file and its test when they exist. A file that existed keeps its declaration,
	 * mapping and mount, and an existing model keeps its migrations.
	 */
	force?: boolean | undefined;
}

/** What `make` writes through: the command's output, child processes and tasks. */
export type MakeContext = Pick<AnyCommandContext, "stdout" | "exec" | "task">;

/**
 * Plans, writes, declares and formats one file of `input.kind`, printing each path written and
 * edited and each package added with the install command; under `dryRun` it prints the files
 * and the diff of each edit, `package.json` included, instead.
 *
 * @param packageRoot - The `@sdxc/kit` package, whose `stubs/` holds the built-in stubs.
 */
export async function make(
	ctx: MakeContext,
	project: Project,
	packageRoot: string,
	input: MakeInput,
): Promise<Result<void, Error>> {
	let made = await makeUnformatted(ctx, project, packageRoot, input);
	if (isFailure(made)) return made;
	return finish(ctx, project, made.data);
}

/** What a run wrote and edited, and the notes it prints once the files are formatted. */
export interface Made {
	changed: string[];
	/**
	 * Each edit left for the user to make and each piece left out, printed after the formatter's
	 * own output, so a long run ends with what still needs the user.
	 */
	notes: string[];
}

/** Formats every changed path once, then prints the notes, which end the run's output. */
export async function finish(
	ctx: MakeContext,
	project: Project,
	made: Made,
): Promise<Result<void, Error>> {
	let formatted =
		made.changed.length === 0
			? success(undefined)
			: await formatFiles(ctx, project.config.format, made.changed, project.root);
	for (let note of made.notes) ctx.stdout(note);
	return formatted;
}

/**
 * {@link make} up to the project's `format` and its notes, which the caller runs and prints
 * once with {@link finish}, so a command making several files formats them together.
 *
 * @returns Every path written or edited and the notes to print; none of either under `dryRun`,
 * which prints its notes itself
 */
export async function makeUnformatted(
	ctx: MakeContext,
	project: Project,
	packageRoot: string,
	input: MakeInput,
): Promise<Result<Made, Error>> {
	let { root, config } = project;
	let { kind } = input;
	let name = parseName(input.name);
	if (isFailure(name)) return name;
	let method = input.method ?? "get";
	let pattern = input.path;
	let overrides: Record<string, string> = {};
	let notes: string[] = [];
	if (kind === "controller" && input.guardedBy !== undefined) {
		let resource = parseName(input.guardedBy);
		if (isFailure(resource)) return resource;
		let model = (await findRow(root, resource.data)) !== null;
		let guard = planGuard(name.data, resource.data, method, pattern, model, input.ability);
		if (isFailure(guard)) return guard;
		pattern = guard.data.pattern;
		overrides.ability = guard.data.ability;
		overrides.access = guard.data.access;
		overrides.pageAccess = guard.data.pageAccess;
		if (!(await declaresAbilities(root, guard.data.catalogPath))) {
			notes.push(
				`app/policies/abilities.ts declares no ${guard.data.catalogPath.join(".")} abilities yet; run sdxc make policy ${resource.data.segments.join("/")} so ${guard.data.ability} exists\n`,
			);
		}
	}
	if (kind === "controller") {
		let names = [...(pattern ?? "").matchAll(/:(\w+)/g)].map((match) => match[1] as string);
		if (names.length > 0) {
			overrides.params = "ctx.params";
			overrides.sampleParams = `{ ${names.map((param) => `${param}: "1"`).join(", ")} }`;
		}
	}
	let request: MakeRequest = {
		kind,
		name: name.data,
		variant: variantOf(kind, {
			cron: input.cron,
			method,
			resource: input.resource,
			guarded: input.guardedBy !== undefined,
		}),
		tests: input.test ?? config.make.tests,
		chain: input.chain,
		routes: input.routes ?? config.make.routes,
		replace: input.force === true,
	};
	let replacing = input.force === true && (await existsAlready(root, request));
	if (replacing) {
		notes.push(
			`Kept the declaration, mapping and mount ${request.name.segments.join("/")} already has; --force replaces files only\n`,
		);
	}
	let email = kind === "email" ? planEmail(input.fields ?? [], name.data) : null;
	if (email !== null && isFailure(email)) return email;
	if (email !== null) Object.assign(overrides, email.data.placeholders);
	let declared: Declared | null = null;
	if (
		!replacing &&
		(kind === "job" ||
			kind === "controller" ||
			kind === "mcp" ||
			kind === "command" ||
			kind === "model" ||
			kind === "policy" ||
			kind === "email")
	) {
		let segments = request.name.segments;
		declared = await declare(
			{
				kind,
				name: request.name,
				variant: request.variant,
				cron: input.cron,
				method,
				pattern,
				routes: request.routes,
				handler: `${folderOf(kind, request.variant)}/${segments.join("/")}`,
				tool: segments.map((segment) => segment.replaceAll("-", "_")).join("_"),
				uri: `${await resourceScheme(root)}://${segments.join("/")}`,
				title: request.name.title,
				options:
					email === null
						? undefined
						: { imports: ["s"], lines: ({ s = "s" }) => email.data.declaration(s) },
			},
			root,
		);
	}
	if (declared !== null) overrides.path = declared.path;
	let columns: string | null = null;
	let fields: Field[] = [];
	let table = pluralize(name.data.snake);
	if (kind === "model") {
		let parsed = parseFields(input.fields ?? []);
		if (isFailure(parsed)) return parsed;
		fields = await resolveReferences(root, parsed.data);
		columns = modelColumns(fields, table);
		overrides.columns = columns;
		overrides.table = table;
	}
	if (kind === "middleware" && input.mount !== undefined && !replacing) {
		let handler = `${folderOf(kind, null)}/${request.name.segments.join("/")}`;
		let mounted = await mount({ name: request.name, target: input.mount, handler }, root);
		if (isFailure(mounted)) return mounted;
		declared = mounted.data;
	}
	let migrationSql: string | null = null;
	let specs = input.fields ?? [];
	if (kind === "migration" && input.fromModel !== undefined && specs.length > 0) {
		return failure(
			new Error(
				"--from-model writes the columns the model declares; give the fields or --from-model, not both",
			),
		);
	}
	if (kind === "migration" && input.fromModel !== undefined) {
		let sql = await modelMigration(ctx, project, input.fromModel, input.chain, request.name);
		if (isFailure(sql)) return sql;
		if (sql.data === null) return success({ changed: [], notes: [] });
		migrationSql = sql.data;
	}
	if (kind === "migration" && specs.length > 0) {
		let folder = chainFolder(config.make.migrations, input.chain);
		if (isFailure(folder)) return folder;
		let sql = await fieldMigration(root, folder.data, request.name, specs);
		if (isFailure(sql)) return sql;
		migrationSql = sql.data;
	}
	let planned = await plan(request, root, config, packageRoot, overrides);
	if (isFailure(planned)) return planned;
	let model = planned.data.files[0];
	if (columns !== null && (input.fields ?? []).length > 0 && !model?.content.includes(columns)) {
		return failure(
			new Error(
				`The model stub has no {{columns}} placeholder, so its fields have nowhere to go; add it inside the table's columns`,
			),
		);
	}
	if (migrationSql !== null) {
		let content = migrationSql;
		planned.data.files = planned.data.files.map((file) => ({ ...file, content }));
	}
	if (kind === "model") {
		let companions = await modelCompanions(project, packageRoot, {
			request,
			fields,
			specs,
			table: tableOf(model?.content) ?? table,
			chain: input.chain,
			skip: replacing ? [...(input.skip ?? []), "migration"] : (input.skip ?? []),
		});
		if (isFailure(companions)) return companions;
		planned.data.files.push(...companions.data.files);
		notes.push(...companions.data.notes);
		let skipped = (input.skip ?? []).filter((companion) => companion !== "migration" || !replacing);
		if (skipped.length > 0) {
			notes.push(`Wrote no ${skipped.join(" or ")}, as --skip asked\n`);
		}
		if (replacing && !(input.skip ?? []).includes("migration")) {
			notes.push(
				`Wrote no migration, since the model existed; add its new columns with sdxc make migration add-<columns>-to-${tableOf(model?.content) ?? table}\n`,
			);
		}
	}
	let edits = declared?.kind === "edits" ? [...declared.edits] : [];
	let dependencies = await missingDependencies(root, [
		...planned.data.files,
		...edits.map((edit) => ({ path: edit.path, content: edit.after })),
	]);
	if (isFailure(dependencies)) return dependencies;
	if (dependencies.data !== null) edits.push(dependencies.data);

	if (input.dryRun) {
		for (let file of planned.data.files) {
			ctx.stdout(`Would write ${file.path}:\n\n${file.content}\n`);
		}
		for (let edit of edits) ctx.stdout(unifiedDiff(edit.path, edit.before, edit.after));
		if (declared?.kind === "manual") ctx.stdout(manualNote(kind, declared));
		for (let note of notes) ctx.stdout(note);
		return success({ changed: [], notes: [] });
	}
	let replaced = new Set<string>();
	for (let file of planned.data.files) {
		if (await exists(root, file.path)) replaced.add(file.path);
	}
	let written = await writeFiles(root, planned.data.files, input.force === true);
	if (isFailure(written)) return written;
	let paths = planned.data.files.map((file) => file.path);
	for (let path of paths) ctx.stdout(`${replaced.has(path) ? "Replaced" : "Wrote"} ${path}\n`);
	let edited = await wrap(async () => {
		for (let edit of edits) await writeFile(join(root, edit.path), edit.after);
	});
	if (isFailure(edited)) return edited;
	for (let edit of edits) {
		if (edit !== dependencies.data) ctx.stdout(`Edited ${edit.path}\n`);
	}
	if (dependencies.data !== null) {
		let read = await readManifest(root);
		let manager = await packageManager({
			declared: isFailure(read) ? undefined : read.data.manifest.packageManager,
			findLockFile: lockFileAtOrAbove(root),
		});
		let added = dependencies.data.added.map(({ name, version }) => `${name}@${version}`);
		ctx.stdout(`Added ${added.join(", ")} to package.json; run ${manager.install.join(" ")}\n`);
	}
	let printed = declared?.kind === "manual" ? [manualNote(kind, declared), ...notes] : notes;
	let changed = [...paths, ...edits.map((edit) => edit.path)];
	return success({ changed, notes: printed });
}

/**
 * What `make` prints when a declaration and its mapping, or a middleware's mount, are left for
 * the user to make.
 */
function manualNote(kind: KindName, declared: Extract<Declared, { kind: "manual" }>): string {
	let action = kind === "middleware" ? "Mount it" : "Declare and map it";
	return `${action} by hand, since ${declared.reason}:\n${declared.instructions}\n`;
}

/**
 * The stub variant a request's flags select, or `null` for the kind's own stub. A controller
 * guarded by a resource's abilities takes `resource`, or `resource.form` for a form.
 */
function variantOf(
	kind: KindName,
	flags: {
		cron: string | undefined;
		method: string;
		resource: boolean | undefined;
		guarded: boolean;
	},
): string | null {
	if (kind === "job" && flags.cron !== undefined) return "cron";
	if (kind === "controller" && flags.guarded) {
		return flags.method === "form" ? "resource.form" : "resource";
	}
	if (kind === "controller" && flags.method === "form") return "form";
	if (kind === "mcp" && flags.resource === true) return "resource";
	return null;
}

/**
 * The column lines `{{columns}}` renders in a model stub: one per field, inside a table named
 * `table`, or a reminder to add them when the command line named none.
 */
function modelColumns(fields: readonly Field[], table: string): string {
	if (fields.length === 0) return "\t\t// TODO: add the columns the migration creates";
	return fields.map((field) => `\t\t${field.column}: ${columnSource(field, table)},`).join("\n");
}

/** What `make model` plans beside the model. */
interface CompanionRequest {
	/** The model's own request, whose name and routes the companions share. */
	request: MakeRequest;
	fields: readonly Field[];
	/** The fields as the command line gave them, which the migration parses again. */
	specs: readonly string[];
	/** The table the planned model declares. */
	table: string;
	chain: string | undefined;
	skip: readonly ModelCompanion[];
}

/**
 * The migration that creates the model's table, named `create-<table>`, and the factory with a
 * value per field, each unless skipped, planned so an existing file stops the run before any
 * write. A required reference has no value a factory can make up, which a note says.
 */
async function modelCompanions(
	project: Project,
	packageRoot: string,
	companion: CompanionRequest,
): Promise<Result<{ files: PlannedFile[]; notes: string[] }, Error>> {
	let { root, config } = project;
	let { request, fields, table } = companion;
	let files: PlannedFile[] = [];
	let notes: string[] = [];
	if (!companion.skip.includes("migration")) {
		let name = parseName(`create-${table}`);
		if (isFailure(name)) return name;
		let folder = chainFolder(config.make.migrations, companion.chain);
		if (isFailure(folder)) return folder;
		let sql = await fieldMigration(root, folder.data, name.data, companion.specs);
		if (isFailure(sql)) return sql;
		let migration = await plan(
			{
				...request,
				kind: "migration",
				name: name.data,
				variant: null,
				tests: false,
				chain: companion.chain,
			},
			root,
			config,
			packageRoot,
		);
		if (isFailure(migration)) return migration;
		files.push(...migration.data.files.map((file) => ({ ...file, content: sql.data })));
	}
	if (!companion.skip.includes("factory")) {
		let values = fields.flatMap((field) => {
			let source = factorySource(field);
			return source === null ? [] : [`\t${field.column}: ${source},`];
		});
		let attributes = values.length === 0 ? "" : `\n${values.join("\n")}\n`;
		let factory = await plan(
			{ ...request, kind: "factory", variant: null, tests: false },
			root,
			config,
			packageRoot,
			{ attributes },
		);
		if (isFailure(factory)) return factory;
		let [file] = factory.data.files;
		if (attributes !== "" && file !== undefined && !file.content.includes(attributes)) {
			return failure(
				new Error(
					"The factory stub has no {{attributes}} placeholder, so its fields have nowhere to go; add it as defineFactory's second argument, or pass --skip factory",
				),
			);
		}
		files.push(...factory.data.files);
		let omitted = fields.filter((field) => factorySource(field) === null);
		for (let field of omitted) {
			notes.push(
				`${file?.path ?? "The factory"} leaves ${field.column} out, since only a test knows which row it points at; pass it when creating one\n`,
			);
		}
	}
	return success({ files, notes });
}

/** The table name a model's source declares, or `null` when it declares none. */
function tableOf(source: string | undefined): string | null {
	return /\btable\(\s*\{\s*name:\s*["']([^"']+)["']/.exec(source ?? "")?.[1] ?? null;
}

/**
 * Writes every planned file, creating its folders; an existing file fails the write unless
 * `replace` lets it be overwritten.
 */
function writeFiles(root: string, files: readonly PlannedFile[], replace: boolean) {
	return wrap(async () => {
		for (let file of files) {
			let target = join(root, file.path);
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, file.content, { flag: replace ? "w" : "wx" });
		}
	});
}

/** Whether the file `request` names exists, so a `--force` run replaces it. */
async function existsAlready(root: string, request: MakeRequest): Promise<boolean> {
	let kind = KINDS[request.kind];
	if (request.kind === "migration" || kind.testOnly === true) return false;
	let file = `${folderOf(request.kind, request.variant)}/${request.name.segments.join("/")}`;
	return exists(root, `${file}${kind.extension}`);
}
