/**
 * What one `sdxc scaffold` run does: renders every file a resource needs from its stubs, runs
 * each declaration `make` would run in a staged copy of the project so they build on one another,
 * and only then writes. A refusal anywhere in the plan leaves the project as it was.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

import type { DeclarationRequest, FileEdit } from "../make/declare.js";
import type { PlannedFile } from "../make/generate.js";
import type { MakeContext } from "../make/index.js";
import type { Project } from "../middleware.js";

import { headerTags, resolveAuthor } from "../author.js";
import { missingDependencies } from "../dependencies.js";
import { unifiedDiff } from "../diff.js";
import { formatFiles } from "../format.js";
import { declare } from "../make/declare.js";
import { chainFolder, nextMigrationFile } from "../make/migrations.js";
import { parseName } from "../make/names.js";
import { loadStub, renderStub } from "../make/stubs.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import { readManifest } from "../upgrade/project.js";

import type { Resource } from "./render.js";

import { parseFields, pluralize } from "./fields.js";
import { flagProperties, jsonProperties, localeBlock, placeholders } from "./render.js";

/** One scaffold, as the command line gave it. */
export interface ScaffoldInput {
	name: string;
	/** Each `name`, `name:type` or `name?`, as `parseFields` reads them. */
	fields: readonly string[];
	/** The plural when the English rules get it wrong. */
	plural: string | undefined;
	mcp: boolean;
	command: boolean;
	/** Whether to write tests; `undefined` takes `make.tests`. */
	test: boolean | undefined;
	dryRun: boolean;
}

/** One file the scaffold renders: the stub it comes from and where it goes. */
interface Piece {
	stub: string;
	path: string;
	/** Written only when the project has no such file, as a shared test helper. */
	shared?: boolean;
}

/** What the project folders the declarations read are copied from, relative to the root. */
const STAGED = ["app", "routes", "tsconfig.json"];

/** The copy a scaffold adds to, one file per language. */
const LOCALES = "resources/locales";

/**
 * Plans and writes the scaffold `input` describes in `project`, printing each file written and
 * edited and each package added; under `dryRun` it prints every file and the diff of every edit
 * instead. A declaration that cannot be placed is printed for the user to make, as `make` does.
 *
 * @param packageRoot - The `@sdxc/kit` package, whose `stubs/` holds the built-in stubs.
 */
export async function scaffold(
	ctx: MakeContext,
	project: Project,
	packageRoot: string,
	input: ScaffoldInput,
): Promise<Result<void, Error>> {
	let { root, config } = project;
	let resource = parseResource(input);
	if (isFailure(resource)) return resource;
	let tests = input.test ?? config.make.tests;

	let pieces = piecesOf(resource.data, input, tests);
	let folder = chainFolder(config.make.migrations, undefined);
	if (isFailure(folder)) return folder;
	let migrationName = parseName(`create-${resource.data.plural.base}`);
	if (isFailure(migrationName)) return migrationName;
	let migration = await nextMigrationFile(root, folder.data, migrationName.data);
	if (isFailure(migration)) return migration;
	pieces.push({ stub: "scaffold.migration.stub", path: `${folder.data}/${migration.data}.sql` });

	let planned: PlannedFile[] = [];
	let header = headerTags(await resolveAuthor(root));
	let values = placeholders(resource.data, header);
	for (let piece of pieces) {
		let exists = isSuccess(await wrap(() => stat(join(root, piece.path))));
		if (exists && piece.shared === true) continue;
		if (exists) {
			return failure(new Error(`${piece.path} already exists; sdxc scaffold leaves it as it is`));
		}
		let stub = await loadStub([piece.stub], root, config.make.stubs, packageRoot);
		if (isFailure(stub)) return stub;
		let content = renderStub(stub.data, values);
		if (isFailure(content)) return content;
		planned.push({ path: piece.path, content: content.data });
	}

	let requests = declarationsOf(resource.data, input, config.make.routes);
	if (isFailure(requests)) return requests;
	let staged = await stageDeclarations(root, requests.data);
	if (isFailure(staged)) return staged;
	let edits = [...staged.data.edits];
	let locales = await localeEdits(root, resource.data);
	if (isFailure(locales)) return locales;
	edits.push(...locales.data);
	let dependencies = await missingDependencies(root, [
		...planned,
		...edits.map((edit) => ({ path: edit.path, content: edit.after })),
	]);
	if (isFailure(dependencies)) return dependencies;
	if (dependencies.data !== null) edits.push(dependencies.data);
	let notes = staged.data.manual.map(
		(manual) =>
			`Declare and map ${manual.path} by hand, since ${manual.reason}:\n${manual.instructions}\n`,
	);

	if (input.dryRun) {
		for (let file of planned) ctx.stdout(`Would write ${file.path}:\n\n${file.content}\n`);
		for (let edit of edits) ctx.stdout(unifiedDiff(edit.path, edit.before, edit.after));
		for (let note of notes) ctx.stdout(note);
		return success(undefined);
	}
	let written = await wrap(async () => {
		for (let file of planned) {
			let target = join(root, file.path);
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, file.content, { flag: "wx" });
		}
		for (let edit of edits) await writeFile(join(root, edit.path), edit.after);
	});
	if (isFailure(written)) return written;
	for (let file of planned) ctx.stdout(`Wrote ${file.path}\n`);
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
	for (let note of notes) ctx.stdout(note);
	let changed = [...planned.map((file) => file.path), ...edits.map((edit) => edit.path)];
	return formatFiles(ctx, config.format, changed, root);
}

/**
 * The resource `input` names: one name without folders, its plural from `--plural` or the
 * English rules, and at least one field a form must fill. A reference is refused, since every
 * generated test would need a row of the referenced table to point at.
 */
function parseResource(input: ScaffoldInput): Result<Resource, Error> {
	let singular = parseName(input.name);
	if (isFailure(singular)) return singular;
	if (singular.data.segments.length > 1) {
		return failure(new Error(`A scaffold name cannot hold folders: ${input.name}`));
	}
	let plural = parseName(input.plural ?? pluralize(singular.data.base));
	if (isFailure(plural)) return plural;
	if (plural.data.segments.length > 1) {
		return failure(new Error(`A plural cannot hold folders: ${input.plural ?? ""}`));
	}
	let fields = parseFields(input.fields);
	if (isFailure(fields)) return fields;
	if (fields.data.length === 0) {
		return failure(new Error("Give the scaffold at least one field, such as title"));
	}
	let reference = fields.data.find((field) => field.type === "references");
	if (reference !== undefined) {
		return failure(
			new Error(
				`${reference.column} is a reference, which sdxc scaffold writes no pages for yet; write ${reference.column}:string, or add it with sdxc make model`,
			),
		);
	}
	if (fields.data.every((field) => field.nullable)) {
		return failure(
			new Error("Give the scaffold at least one field without ?, which a form must fill"),
		);
	}
	return success({ singular: singular.data, plural: plural.data, fields: fields.data });
}

/** Every file the scaffold writes but its migration, each test right after the file it covers. */
function piecesOf(resource: Resource, input: ScaffoldInput, tests: boolean): Piece[] {
	let { singular, plural } = resource;
	let name = singular.base;
	let pieces: Piece[] = [];
	let add = (stub: string, path: string, tested: boolean) => {
		pieces.push({ stub: `scaffold.${stub}.stub`, path });
		if (tested && tests) {
			let test = path.replace(/(\.tsx?)$/, ".test$1");
			pieces.push({ stub: `scaffold.${stub}.test.stub`, path: test });
		}
	};
	add("model", `app/models/${name}.ts`, true);
	add("factory", `database/factories/${name}.ts`, false);
	add("validator", `app/http/validators/${name}.ts`, true);
	add("policy", `app/policies/${name}.ts`, true);
	add("form", `resources/views/${plural.base}/form.tsx`, false);
	for (let action of ["index", "new", "show", "edit", "destroy"]) {
		add(`controller.${action}`, `app/http/controllers/${plural.base}/${action}.tsx`, true);
	}
	if (input.mcp) {
		for (let action of ["list", "get", "create", "update", "delete"]) {
			add(`mcp.${action}`, `app/mcp/tools/${plural.base}/${action}.ts`, true);
		}
	}
	if (input.command) {
		for (let action of ["list", "show", "create", "delete"]) {
			add(`command.${action}`, `app/commands/${plural.base}/${action}.ts`, true);
		}
	}
	if (tests) {
		pieces.push({
			stub: "scaffold.test-database.stub",
			path: "app/test/database.ts",
			shared: true,
		});
		if (input.mcp) {
			pieces.push({ stub: "scaffold.test-mcp.stub", path: "app/test/mcp.ts", shared: true });
		}
	}
	return pieces;
}

/**
 * Every declaration the scaffold makes, in order: the model in its registry, the five pages in
 * the route contract `routes`, then the tools and the commands when asked for.
 */
function declarationsOf(
	resource: Resource,
	input: ScaffoldInput,
	routes: string,
): Result<DeclarationRequest[], Error> {
	let { singular, plural, fields } = resource;
	let words = singular.title.toLowerCase();
	let pluralWords = plural.title.toLowerCase();
	let base = { variant: null, method: "get", routes, tool: "", uri: "" };
	let requests: DeclarationRequest[] = [
		{
			...base,
			kind: "model",
			name: singular,
			handler: `app/models/${singular.base}`,
			title: singular.title,
		},
	];
	let pages: Array<[string, string, string, string | undefined]> = [
		["index", "get", `/${plural.base}`, undefined],
		["new", "form", `/${plural.base}/new`, "false"],
		["show", "get", `/${plural.base}/:id`, undefined],
		["edit", "form", `/${plural.base}/:id/edit`, "false"],
		["destroy", "post", `/${plural.base}/:id/destroy`, undefined],
	];
	for (let [action, method, pattern, sitemap] of pages) {
		let name = parseName(`${plural.base}/${action}`);
		if (isFailure(name)) return name;
		requests.push({
			...base,
			kind: "controller",
			name: name.data,
			method,
			pattern,
			handler: `app/http/controllers/${plural.base}/${action}`,
			title: `${plural.title} ${action}`,
			...(sitemap === undefined ? {} : { sitemap }),
		});
	}
	if (input.mcp) {
		let readOnly = "annotations: { readOnlyHint: true },";
		let tools: Array<[string, string, string, (s: string) => string[]]> = [
			[
				"list",
				`list_${plural.snake}`,
				`List ${pluralWords}, newest first; get_${singular.snake} reads one in full.`,
				(s) => [`input: ${s}.object({ limit: ${s}.defaulted(${s}.integer(), 20) }),`, readOnly],
			],
			[
				"get",
				`get_${singular.snake}`,
				`Read one ${words} by its id, every field included.`,
				(s) => [`input: ${s}.object({ id: ${s}.string() }),`, readOnly],
			],
			[
				"create",
				`create_${singular.snake}`,
				`Create a ${words} from every field and answer it with its id.`,
				(s) => [`input: ${s}.object({`, ...jsonProperties(fields, s, false), "}),"],
			],
			[
				"update",
				`update_${singular.snake}`,
				`Change the fields named on the ${words} with the id; the others keep their values.`,
				(s) => [
					`input: ${s}.object({`,
					`\tid: ${s}.string(),`,
					...jsonProperties(fields, s, true),
					"}),",
				],
			],
			[
				"delete",
				`delete_${singular.snake}`,
				`Delete the ${words} with the id.`,
				(s) => [`input: ${s}.object({ id: ${s}.string() }),`],
			],
		];
		for (let [action, tool, description, input] of tools) {
			let name = parseName(`${plural.base}/${action}`);
			if (isFailure(name)) return name;
			requests.push({
				...base,
				kind: "mcp",
				name: name.data,
				handler: `app/mcp/tools/${plural.base}/${action}`,
				tool,
				title: description,
				options: {
					imports: ["s"],
					lines: (locals) => [
						`description: ${JSON.stringify(description)},`,
						...input(locals.s ?? "s"),
					],
				},
			});
		}
	}
	if (input.command) {
		let id = (locals: Readonly<Record<string, string>>) => [
			`arguments: { id: ${locals.argument ?? "argument"}(${locals.s ?? "s"}.string(), { description: ${JSON.stringify(`The ${words}'s id`)} }) },`,
		];
		let commands: Array<[string, string, DeclarationRequest["options"]]> = [
			["list", `List every ${words}, newest first`, undefined],
			["show", `Print one ${words} as JSON`, { imports: ["argument", "s"], lines: id }],
			[
				"create",
				`Create a ${words} and print its id`,
				{
					imports: ["flag"],
					lines: (locals) => ["flags: {", ...flagProperties(fields, locals.flag ?? "flag"), "},"],
				},
			],
			["delete", `Delete one ${words}`, { imports: ["argument", "s"], lines: id }],
		];
		for (let [action, description, options] of commands) {
			let name = parseName(`${plural.base}/${action}`);
			if (isFailure(name)) return name;
			requests.push({
				...base,
				kind: "command",
				name: name.data,
				handler: `app/commands/${plural.base}/${action}`,
				title: description,
				...(options === undefined ? {} : { options }),
			});
		}
	}
	return success(requests);
}

/** What the staged declarations changed, and the ones left for the user to make. */
interface Staged {
	edits: FileEdit[];
	manual: Array<{ path: string; reason: string; instructions: string }>;
}

/**
 * Runs `requests` in order against a temporary copy of the folders they read, writing each
 * one's edits into the copy so the next starts from them, and answers each changed file's
 * original text against its final one. The project itself is only read.
 */
async function stageDeclarations(
	root: string,
	requests: readonly DeclarationRequest[],
): Promise<Result<Staged, Error>> {
	let stage = await wrap(() => mkdtemp(join(tmpdir(), "sdxc-scaffold-")));
	if (isFailure(stage)) return stage;
	let result = await wrap(async () => {
		for (let entry of STAGED) {
			let source = join(root, entry);
			if (isFailure(await wrap(() => stat(source)))) continue;
			await cp(source, join(stage.data, entry), { recursive: true });
		}
		let originals = new Map<string, string>();
		let manual: Staged["manual"] = [];
		for (let request of requests) {
			let declared = await declare(request, stage.data);
			if (declared.kind === "manual") {
				let { path, reason, instructions } = declared;
				manual.push({ path, reason, instructions });
				continue;
			}
			for (let edit of declared.edits) {
				if (!originals.has(edit.path)) originals.set(edit.path, edit.before);
				await writeFile(join(stage.data, edit.path), edit.after);
			}
		}
		let edits: FileEdit[] = [];
		for (let [path, before] of originals) {
			edits.push({ path, before, after: await readFile(join(stage.data, path), "utf8") });
		}
		return { edits, manual };
	});
	await rm(stage.data, { recursive: true, force: true });
	return result;
}

/**
 * The edit of every `resources/locales/*.json` that adds the resource's copy under its plural
 * key. A file that already has that key, or does not parse, stops the scaffold.
 */
async function localeEdits(root: string, resource: Resource): Promise<Result<FileEdit[], Error>> {
	let names = await wrap(() => readdir(join(root, LOCALES)));
	if (isFailure(names)) return success([]);
	let key = resource.plural.key;
	let edits: FileEdit[] = [];
	for (let name of names.data.filter((entry) => entry.endsWith(".json")).sort()) {
		let path = `${LOCALES}/${name}`;
		let before = await wrap(() => readFile(join(root, path), "utf8"));
		if (isFailure(before)) return before;
		let parsed = wrap(() => JSON.parse(before.data) as Record<string, unknown>);
		if (isFailure(parsed)) return failure(new Error(`${path}: ${parsed.error.message}`));
		if (Object.hasOwn(parsed.data, key)) {
			return failure(new Error(`${path} already has "${key}"; sdxc scaffold leaves it as it is`));
		}
		let after = { ...parsed.data, [key]: localeBlock(resource) };
		edits.push({ path, before: before.data, after: `${JSON.stringify(after, null, "\t")}\n` });
	}
	return success(edits);
}
