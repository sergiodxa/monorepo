/**
 * Plans the files one `sdxc make` run writes: the file of the requested kind at the folder the
 * layout gives it, when tests are on its test beside it, and when specs are on a pairing `.spec`
 * under `spec/`, each rendered from its stub; a policy writes its test alone.
 * Nothing is written while planning, and a file that already exists stops the plan unless the
 * request replaces it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

import type { Config } from "../config.js";

import { headerTags, resolveAuthor } from "../author.js";
import { pluralize } from "../scaffold/fields.js";

import type { KindName } from "./kinds.js";
import type { Name } from "./names.js";
import type { StubRole } from "./stubs.js";

import { COMMON_PLACEHOLDERS, KINDS, MCP_RESOURCES_FOLDER } from "./kinds.js";
import { chainFolder, nextMigrationFile } from "./migrations.js";
import { camel } from "./names.js";
import { loadStub, renderStub, stubName } from "./stubs.js";

/** One `make` request, as the command line spelled it. */
export interface MakeRequest {
	kind: KindName;
	name: Name;
	/**
	 * The stub variant a flag selects: `form`, `cron`, `resource` (an MCP resource, or a
	 * controller guarded by a resource's abilities) or `resource.form`.
	 */
	variant: string | null;
	/** Whether to write a test beside the file. */
	tests: boolean;
	/** Whether to write a pairing `.spec` under `spec/` for kinds that support one. */
	specs: boolean;
	/** The migration chain, for `make migration`. */
	chain?: string;
	/** The route contract a controller is declared in, a module in `routes/`. */
	routes: string;
	/** The route pattern a controller answers, for the pairing `.spec`'s URL. */
	url?: string;
	/** Replace a file the plan would write that already exists, instead of stopping. */
	replace?: boolean;
	/** Plan the test alone, for a file that exists already. */
	testAlone?: boolean;
}

/** A file the run writes, by path relative to the project root. */
export interface PlannedFile {
	path: string;
	content: string;
}

/** What one run writes and the placeholder values its stubs were rendered with. */
export interface Plan {
	files: PlannedFile[];
	values: Record<string, string>;
}

/**
 * Plans `request` in the project at `root`. Every planned path must be free unless the request
 * replaces files; an existing file is otherwise a failure naming it, before any stub is read.
 *
 * @param packageRoot - The `@sdxc/kit` package, whose `stubs/` holds the built-in stubs.
 * @param overrides - Placeholder values a declaration decided, such as a job's reused group.
 */
export async function plan(
	request: MakeRequest,
	root: string,
	config: Config,
	packageRoot: string,
	overrides: Readonly<Record<string, string>> = {},
): Promise<Result<Plan, Error>> {
	let kind = KINDS[request.kind];
	let { name } = request;
	if (!kind.nested && name.segments.length > 1) {
		return failure(
			new Error(`A ${request.kind} name cannot hold folders: ${name.segments.join("/")}`),
		);
	}
	let folder = folderOf(request.kind, request.variant);
	let file = name.segments.join("/");
	if (request.kind === "migration") {
		let chain = chainFolder(config.make.migrations, request.chain);
		if (isFailure(chain)) return chain;
		folder = chain.data;
		let next = await nextMigrationFile(root, folder, name);
		if (isFailure(next)) return next;
		file = next.data;
	}
	let path = `${folder}/${file}${kind.extension}`;
	let testPath = `${folder}/${file}.test${kind.extension}`;
	let specPath = specPathOf(request);
	let writesTest = kind.tests && (request.tests || request.testAlone === true);
	let writesSpec =
		kind.specs === true &&
		request.specs &&
		request.testAlone !== true &&
		request.variant !== "resource";
	let writesMain = kind.testOnly !== true && request.testAlone !== true;
	let paths = [
		...(writesMain ? [path] : []),
		...(writesTest ? [testPath] : []),
		...(writesSpec ? [specPath] : []),
	];
	for (let candidate of paths) {
		if (request.replace !== true && (await exists(root, candidate))) {
			return failure(
				new Error(`${candidate} already exists; sdxc make leaves it as it is unless --force`),
			);
		}
	}

	let values = await placeholders(request, root, `${folder}/${file}`);
	Object.assign(values, overrides);
	let files: PlannedFile[] = [];
	if (writesMain) {
		let main = await renderFile(request, values, "main", root, config, packageRoot);
		if (isFailure(main)) return main;
		files.push({ path, content: main.data });
	}
	if (writesTest) {
		let test = await renderFile(request, values, "test", root, config, packageRoot);
		if (isFailure(test)) return test;
		files.push({ path: testPath, content: test.data });
	}
	if (writesSpec) {
		let spec = await renderFile(request, values, "spec", root, config, packageRoot);
		if (isFailure(spec)) return spec;
		files.push({ path: specPath, content: spec.data });
	}
	return success({ files, values });
}

/**
 * The pairing `.spec` path for `request`: controllers under `spec/`, commands under
 * `spec/commands/`, MCP tools under `spec/mcp/`.
 */
export function specPathOf(request: Pick<MakeRequest, "kind" | "name">): string {
	let file = request.name.segments.join("/");
	if (request.kind === "command") return `spec/commands/${file}.spec`;
	if (request.kind === "mcp") return `spec/mcp/${file}.spec`;
	return `spec/${file}.spec`;
}

/** Whether `path`, relative to `root`, exists. */
export async function exists(root: string, path: string): Promise<boolean> {
	return isSuccess(await wrap(() => stat(join(root, path))));
}

/** The folder a kind's files go in; a migration's comes from its chain instead. */
export function folderOf(kind: KindName, variant: string | null): string {
	return kind === "mcp" && variant === "resource" ? MCP_RESOURCES_FOLDER : KINDS[kind].folder;
}

/**
 * Renders the kind's stub, its test stub or its pairing `.spec` stub with `values`. A variant's
 * own stub wins; a variant without its own companion stub uses the kind's. A controller with no
 * variant takes its contract's stub when one exists (`controller.api.stub` /
 * `controller.api.spec.stub` for `routes/api`), else the kind's, and a guarded one its contract's
 * `resource` stub the same way.
 */
async function renderFile(
	request: MakeRequest,
	values: Record<string, string>,
	role: StubRole,
	root: string,
	config: Config,
	packageRoot: string,
): Promise<Result<string, Error>> {
	let companion = role !== "main";
	let names = [stubName(request.kind, request.variant, role)];
	let contractual = request.variant === null || request.variant === "resource";
	if (request.kind === "controller" && contractual) {
		let variant = [request.routes, request.variant].filter((part) => part !== null).join(".");
		names.unshift(stubName(request.kind, variant, role));
	}
	if (request.kind === "controller" && request.variant?.startsWith("resource") && companion) {
		names.push(stubName(request.kind, request.routes, role));
	}
	if (request.variant !== null && companion) names.push(stubName(request.kind, null, role));
	let stub = await loadStub(names, root, config.make.stubs, packageRoot);
	if (isFailure(stub)) return stub;
	return renderStub(stub.data, values);
}

/**
 * The placeholder values for `request`: the common set every kind gets, plus the ones its kind
 * defines. `file` is the generated file's path without its extension.
 */
async function placeholders(
	request: MakeRequest,
	root: string,
	file: string,
): Promise<Record<string, string>> {
	let { name } = request;
	let common: Record<string, string> = {
		name: name.base,
		key: name.key,
		Name: name.pascal,
		snake: name.snake,
		title: name.title,
		specifier: `~/${file}`,
		header: headerTags(await resolveAuthor(dirname(join(root, file)))),
	};
	let declarationPath = name.segments.map(camel).join(".");
	let extra: Record<string, string> = {
		path: declarationPath,
		routes: `~/routes/${request.routes}`,
		tool: name.segments.map((segment) => segment.replaceAll("-", "_")).join("_"),
		uri: `${await resourceScheme(root)}://${name.segments.join("/")}`,
		model: `~/app/models/${name.segments.join("/")}`,
		command: name.segments.join(" "),
		member: memberAccess(name.segments),
		words: name.segments.map((segment) => literal(segment)).join(", "),
		args: name.segments.map((segment) => literal(segment)).join(" "),
		url: request.url ?? `/${name.segments.join("/")}`,
		table: pluralize(name.snake),
		attributes: "",
		ability: "",
		access: "",
		pageAccess: "",
		params: "",
		sampleParams: "",
	};
	let values: Record<string, string> = {};
	for (let key of [...COMMON_PLACEHOLDERS, ...KINDS[request.kind].placeholders]) {
		let value = common[key] ?? extra[key];
		if (value !== undefined) values[key] = value;
	}
	return values;
}

/** Each character that ends a `<script>` element or a line inside an otherwise valid literal. */
const UNSAFE_LITERAL_CHARACTERS: Record<string, string> = {
	"<": "\\u003C",
	">": "\\u003E",
	"\u2028": "\\u2028",
	"\u2029": "\\u2029",
};

/**
 * `value` as a JavaScript string literal that is safe to splice into generated source: quotes,
 * backslashes and control characters are escaped, and so are `<`, `>` and the two Unicode line
 * separators, so a name or path can never close a script element or break the line it sits on.
 */
export function literal(value: string): string {
	return JSON.stringify(value).replace(
		/[<>\u2028\u2029]/g,
		(character) => UNSAFE_LITERAL_CHARACTERS[character] ?? character,
	);
}

/**
 * The property access that reaches a command's declaration from its contract: `.users.grant`,
 * with a segment that is no identifier read by its quoted key (`["send-digest"]`), since a
 * command's key is the word typed to run it.
 */
export function memberAccess(segments: readonly string[]): string {
	return segments
		.map((segment) =>
			/^[A-Za-z_$][\w$]*$/.test(segment) ? `.${segment}` : `[${literal(segment)}]`,
		)
		.join("");
}

/**
 * The URI scheme an MCP resource is declared under: the project's package name without its
 * scope, reduced to the characters a scheme allows, or `app` when nothing usable is left.
 */
export async function resourceScheme(root: string): Promise<string> {
	let text = await wrap(() => readFile(join(root, "package.json"), "utf8"));
	let parsed = isFailure(text) ? null : wrap(() => JSON.parse(text.data) as { name?: unknown });
	let name = parsed !== null && isSuccess(parsed) ? parsed.data.name : undefined;
	let cleaned = (typeof name === "string" ? name : "")
		.replace(/^@[^/]+\//, "")
		.toLowerCase()
		.replace(/[^a-z0-9+.-]+/g, "-")
		.replace(/^[^a-z]+/, "");
	return cleaned === "" ? "app" : cleaned;
}
