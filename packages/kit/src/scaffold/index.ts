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
import type { ScaffoldPiece } from "../make/kinds.js";
import type { Project } from "../middleware.js";

import { headerTags, resolveAuthor } from "../author.js";
import { missingDependencies } from "../dependencies.js";
import { unifiedDiff } from "../diff.js";
import { formatFiles } from "../format.js";
import { declare, declaresAbilities } from "../make/declare.js";
import { ensureImport } from "../make/imports.js";
import { SCAFFOLD_PIECES } from "../make/kinds.js";
import { chainFolder, nextMigrationFile } from "../make/migrations.js";
import { parseName } from "../make/names.js";
import { loadStub, renderStub } from "../make/stubs.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import { readManifest } from "../upgrade/project.js";

import type { OperationLocals, Resource } from "./render.js";

import { parseFields, pluralize } from "./fields.js";
import {
	apiOperationNames,
	apiOperations,
	flagProperties,
	jsonProperties,
	localeBlock,
	placeholders,
} from "./render.js";

/** One scaffold, as the command line gave it. */
export interface ScaffoldInput {
	name: string;
	/** Each `name`, `name:type` or `name?`, as `parseFields` reads them. */
	fields: readonly string[];
	/** The plural when the English rules get it wrong. */
	plural: string | undefined;
	mcp: boolean;
	command: boolean;
	/** JSON endpoints in the `api` contract, with their OpenAPI operations, instead of pages. */
	api?: boolean;
	/** Whether to write tests; `undefined` takes `make.tests`. */
	test: boolean | undefined;
	/** Whether to write one feature `.spec`; `undefined` takes `make.specs`. */
	spec?: boolean | undefined;
	dryRun: boolean;
	/** The pieces to leave out, each one the project already has or does without. */
	skip?: readonly ScaffoldPiece[];
}

/** One file the scaffold renders: the stub it comes from and where it goes. */
interface Piece {
	stub: string;
	path: string;
	/** Written only when the project has no such file, as a shared test helper. */
	shared?: boolean;
}

/** The endpoints `--api` writes, in the order the contract declares them. */
const API_ACTIONS = ["index", "show", "create", "update", "destroy"];

/** The route contract `--api` declares its endpoints in, whose module holds their operations. */
const API_CONTRACT = "api";

/** The module that builds the OpenAPI document from the contract's operations. */
const OPENAPI_INITIALIZER = "app/initializers/openapi.ts";

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
	let specs = input.spec ?? config.make.specs;
	let skip = new Set(input.skip ?? []);
	let missing = await skippedButNeeded(root, resource.data, input, skip, tests);
	if (isFailure(missing)) return missing;

	let pieces = piecesOf(resource.data, input, tests, specs, skip);
	let folder = chainFolder(config.make.migrations, undefined);
	if (isFailure(folder)) return folder;
	let migrationName = parseName(`create-${resource.data.plural.base}`);
	if (isFailure(migrationName)) return migrationName;
	let migration = await nextMigrationFile(root, folder.data, migrationName.data);
	if (isFailure(migration)) return migration;
	if (!skip.has("migration")) {
		pieces.push({ stub: "scaffold.migration.stub", path: `${folder.data}/${migration.data}.sql` });
	}

	let planned: PlannedFile[] = [];
	let header = headerTags(await resolveAuthor(root));
	let values = placeholders(resource.data, header, {
		pages: !skip.has("pages") && input.api !== true,
		api: !skip.has("pages") && input.api === true,
		mcp: input.mcp,
		command: input.command,
	});
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

	let requests = declarationsOf(resource.data, input, config.make.routes, skip);
	if (isFailure(requests)) return requests;
	let staged = await stageDeclarations(root, requests.data, planned);
	if (isFailure(staged)) return staged;
	let edits = [...staged.data.edits];
	let withPages = !skip.has("pages") && input.api !== true;
	let locales = withPages ? await localeEdits(root, resource.data) : success([]);
	if (isFailure(locales)) return locales;
	edits.push(...locales.data);
	let dependencies = await missingDependencies(root, [
		...planned,
		...edits.map((edit) => ({ path: edit.path, content: edit.after })),
	]);
	if (isFailure(dependencies)) return dependencies;
	if (dependencies.data !== null) edits.push(dependencies.data);
	if (input.api === true && !skip.has("pages")) {
		let documented = await operationEdits(root, resource.data, edits);
		if (isFailure(documented)) return documented;
		edits.splice(0, edits.length, ...documented.data.edits);
		staged.data.manual.push(...documented.data.manual);
	}
	let skippedNote =
		skip.size === 0
			? []
			: [
					`Wrote no ${SCAFFOLD_PIECES.filter((piece) => skip.has(piece)).join(", ")}, as --skip asked\n`,
				];
	let notes = staged.data.manual.map(
		(manual) =>
			`Declare and map ${manual.path} by hand, since ${manual.reason}:\n${manual.instructions}\n`,
	);

	if (input.dryRun) {
		for (let file of planned) ctx.stdout(`Would write ${file.path}:\n\n${file.content}\n`);
		for (let edit of edits) ctx.stdout(unifiedDiff(edit.path, edit.before, edit.after));
		for (let note of [...notes, ...skippedNote]) ctx.stdout(note);
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
	let changed = [...planned.map((file) => file.path), ...edits.map((edit) => edit.path)];
	let formatted = await formatFiles(ctx, config.format, changed, root);
	for (let note of [...notes, ...skippedNote]) ctx.stdout(note);
	return formatted;
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

/**
 * Refuses a skip that leaves the scaffold reading a file the project lacks: the model every other
 * piece reads, the validator the pages submit through, the factory the tests seed rows with, and
 * the abilities the pages and tools check.
 */
async function skippedButNeeded(
	root: string,
	resource: Resource,
	input: ScaffoldInput,
	skip: ReadonlySet<ScaffoldPiece>,
	tests: boolean,
): Promise<Result<void, Error>> {
	let name = resource.singular.base;
	let has = async (path: string) => isSuccess(await wrap(() => stat(join(root, path))));
	let endpoints = !skip.has("pages");
	let pages = endpoints && input.api !== true;
	let readers = endpoints || input.mcp || input.command;
	let needs: Array<[ScaffoldPiece, boolean, string, string]> = [
		["model", readers, `app/models/${name}.ts`, "the pages, tools and commands read"],
		["validator", pages, `app/http/validators/${name}.ts`, "the pages submit through"],
		["factory", tests && readers, `database/factories/${name}.ts`, "the tests seed rows with"],
	];
	for (let [piece, needed, path, reader] of needs) {
		if (!skip.has(piece) || !needed || (await has(path))) continue;
		return failure(
			new Error(`--skip ${piece} needs ${path}, which ${reader}; drop ${piece} from --skip`),
		);
	}
	if (skip.has("policy") && (endpoints || input.mcp)) {
		let key = resource.singular.key;
		if (!(await declaresAbilities(root, [key]))) {
			return failure(
				new Error(
					`--skip policy needs the ${key} abilities in app/policies/abilities.ts, which the pages and tools check; run sdxc make policy ${name} or drop policy from --skip`,
				),
			);
		}
	}
	return success(undefined);
}

/**
 * Every file the scaffold writes but its migration, each test right after the file it covers,
 * and one feature `.spec` when specs are on, leaving out the pieces in `skip`.
 */
function piecesOf(
	resource: Resource,
	input: ScaffoldInput,
	tests: boolean,
	specs: boolean,
	skip: ReadonlySet<ScaffoldPiece>,
): Piece[] {
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
	if (!skip.has("model")) add("model", `app/models/${name}.ts`, true);
	if (!skip.has("factory")) add("factory", `database/factories/${name}.ts`, false);
	if (!skip.has("validator") && input.api !== true) {
		add("validator", `app/http/validators/${name}.ts`, true);
	}
	if (tests && !skip.has("policy")) {
		pieces.push({ stub: "policy.test.stub", path: `app/policies/${name}.test.ts` });
	}
	if (!skip.has("pages") && input.api === true) {
		for (let action of API_ACTIONS) {
			add(`api.${action}`, `app/http/controllers/api/${plural.base}/${action}.tsx`, true);
		}
	} else if (!skip.has("pages")) {
		add("form", `resources/views/${plural.base}/form.tsx`, false);
		for (let action of ["index", "new", "show", "edit", "destroy"]) {
			add(`controller.${action}`, `app/http/controllers/${plural.base}/${action}.tsx`, true);
		}
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
	if (specs && (!skip.has("pages") || input.mcp || input.command)) {
		pieces.push({ stub: "scaffold.spec.stub", path: `spec/${plural.base}.spec` });
	}
	return pieces;
}

/**
 * Every declaration the scaffold makes, in order: the model in its registry, its abilities in the
 * catalog and their grants in the policy, the five pages in the route contract `routes`, then the
 * tools and the commands when asked for.
 */
function declarationsOf(
	resource: Resource,
	input: ScaffoldInput,
	routes: string,
	skip: ReadonlySet<ScaffoldPiece>,
): Result<DeclarationRequest[], Error> {
	let { singular, plural, fields } = resource;
	let words = singular.title.toLowerCase();
	let pluralWords = plural.title.toLowerCase();
	let base = { variant: null, method: "get", routes, tool: "", uri: "" };
	let requests: DeclarationRequest[] = [];
	if (!skip.has("model")) {
		requests.push({
			...base,
			kind: "model",
			name: singular,
			handler: `app/models/${singular.base}`,
			title: singular.title,
		});
	}
	if (!skip.has("policy")) {
		requests.push({
			...base,
			kind: "policy",
			name: singular,
			handler: `app/policies/${singular.base}`,
			title: singular.title,
		});
	}
	let pages: Array<[string, string, string, string | undefined]> = [
		["index", "get", `/${plural.base}`, undefined],
		["new", "form", `/${plural.base}/new`, "false"],
		["show", "get", `/${plural.base}/:id`, undefined],
		["edit", "form", `/${plural.base}/:id/edit`, "false"],
		["destroy", "post", `/${plural.base}/:id/destroy`, undefined],
	];
	let endpoints: Array<[string, string, string]> = [
		["index", "get", `/api/${plural.base}`],
		["show", "get", `/api/${plural.base}/:id`],
		["create", "post", `/api/${plural.base}`],
		["update", "patch", `/api/${plural.base}/:id`],
		["destroy", "delete", `/api/${plural.base}/:id`],
	];
	for (let [action, method, pattern] of skip.has("pages") || input.api !== true ? [] : endpoints) {
		let name = parseName(`api/${plural.base}/${action}`);
		if (isFailure(name)) return name;
		requests.push({
			...base,
			kind: "controller",
			name: name.data,
			method,
			pattern,
			routes: API_CONTRACT,
			handler: `app/http/controllers/api/${plural.base}/${action}`,
			title: `${plural.title} ${action}`,
		});
	}
	let pagesWritten = !skip.has("pages") && input.api !== true;
	for (let [action, method, pattern, sitemap] of pagesWritten ? pages : []) {
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
 * Runs `requests` in order against a temporary copy of the folders they read, with the files the
 * scaffold writes already in it, writing each one's edits into the copy so the next starts from
 * them, and answers each changed file's original text against its final one. The project itself
 * is only read.
 */
async function stageDeclarations(
	root: string,
	requests: readonly DeclarationRequest[],
	planned: readonly PlannedFile[],
): Promise<Result<Staged, Error>> {
	let stage = await wrap(() => mkdtemp(join(tmpdir(), "sdxc-scaffold-")));
	if (isFailure(stage)) return stage;
	let result = await wrap(async () => {
		for (let entry of STAGED) {
			let source = join(root, entry);
			if (isFailure(await wrap(() => stat(source)))) continue;
			await cp(source, join(stage.data, entry), { recursive: true });
		}
		for (let file of planned) {
			let target = join(stage.data, file.path);
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, file.content);
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
 * `edits` with the resource's OpenAPI operations appended to `routes/api.ts`, after the routes
 * the staged declarations added, and added to the document `app/initializers/openapi.ts` builds.
 * A contract missing `@sdxc/json-schema` gets the import; one laid out otherwise, with no
 * `defineOperation` or default export, gets the code printed for the user to place instead.
 */
async function operationEdits(
	root: string,
	resource: Resource,
	edits: readonly FileEdit[],
): Promise<Result<{ edits: FileEdit[]; manual: Staged["manual"] }, Error>> {
	let result = [...edits];
	let manual: Staged["manual"] = [];
	/** The file's text as the edits so far leave it, recording the edit that changes it next. */
	let current = async (path: string) => {
		let edit = result.find((entry) => entry.path === path);
		if (edit !== undefined) return edit.after;
		let read = await wrap(() => readFile(join(root, path), "utf8"));
		return isFailure(read) ? null : read.data;
	};
	let write = async (path: string, after: string) => {
		let index = result.findIndex((entry) => entry.path === path);
		if (index !== -1) {
			result[index] = { ...(result[index] as FileEdit), after };
			return;
		}
		let before = await wrap(() => readFile(join(root, path), "utf8"));
		if (isFailure(before)) return;
		result.push({ path, before: before.data, after });
	};
	let contract = `routes/${API_CONTRACT}.ts`;
	let names = apiOperationNames(resource);
	let source = await current(contract);
	let operations = source === null ? null : operationLocals(contract, source);
	let code = apiOperations(
		resource,
		operations?.locals ?? { s: "s", defineOperation: "defineOperation", routes: "ROUTES" },
	);
	if (operations === null) {
		manual.push({
			path: contract,
			reason: `${contract} does not import defineOperation and a default export the operations can use`,
			instructions: `At the end of ${contract}:
${code}`,
		});
	} else {
		await write(
			contract,
			`${operations.source.trimEnd()}

${code}
`,
		);
	}
	let initializer = await current(OPENAPI_INITIALIZER);
	let added = initializer === null ? null : addOperations(initializer, names);
	if (added === null) {
		manual.push({
			path: OPENAPI_INITIALIZER,
			reason: `${OPENAPI_INITIALIZER} has no createDocument(…).add(…) call importing from ~/routes/${API_CONTRACT}`,
			instructions: `Import ${names.join(", ")} from "~/routes/${API_CONTRACT}" and pass them to the document's .add(…)`,
		});
	} else {
		await write(OPENAPI_INITIALIZER, added);
	}
	return success({ edits: result, manual });
}

/**
 * The names `source` imports `@sdxc/json-schema`'s namespace, `defineOperation` and its own
 * default export under, with `source` importing the namespace as `s` when it lacked it, or
 * `null` when it lacks `defineOperation` or the default export.
 */
function operationLocals(
	filename: string,
	source: string,
): { source: string; locals: OperationLocals } | null {
	let imported = /import \{([^}]*)\} from "@sdxc\/openapi";/.exec(source)?.[1] ?? "";
	let defineOperation = /\bdefineOperation(?:\s+as\s+(\w+))?\b/.exec(imported);
	let routes = /export default (\w+);/.exec(source)?.[1];
	if (defineOperation === null || routes === undefined) return null;
	let schema = ensureImport(
		filename,
		source,
		{ kind: "namespace" },
		(specifier) => specifier === "@sdxc/json-schema",
		"@sdxc/json-schema",
		"s",
	);
	if (isFailure(schema)) return null;
	return {
		source: schema.data.source,
		locals: {
			s: schema.data.local,
			defineOperation: defineOperation[1] ?? "defineOperation",
			routes,
		},
	};
}

/**
 * `source` with `names` imported from the API contract and passed to its document's `.add(…)`,
 * or `null` when it has no named import from `~/routes/api` and no `.add(` call to extend.
 */
function addOperations(source: string, names: readonly string[]): string | null {
	let specifier = `~/routes/${API_CONTRACT}`;
	let importPattern = new RegExp(
		`import \\{([^}]*)\\} from "${specifier.replaceAll("/", "\\/")}";`,
	);
	let imported = importPattern.exec(source);
	let add = /\.add\(([^)]*)\)/.exec(source);
	if (imported === null || add === null) return null;
	let existing = (imported[1] ?? "")
		.split(",")
		.map((name) => name.trim())
		.filter((name) => name !== "");
	let importLine = `import { ${[...existing, ...names].join(", ")} } from "${specifier}";`;
	let args = (add[1] ?? "")
		.split(",")
		.map((arg) => arg.trim())
		.filter((arg) => arg !== "");
	let withImport = source.replace(imported[0], importLine);
	return withImport.replace(/\.add\(([^)]*)\)/, `.add(${[...args, ...names].join(", ")})`);
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
