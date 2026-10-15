/**
 * Plans the files one `sdxc make` run writes: the file of the requested kind at the folder the
 * layout gives it and, when tests are on, its test beside it, each rendered from its stub.
 * Nothing is written while planning, and a file that already exists stops the plan.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

import type { Config } from "../config.js";

import type { KindName } from "./kinds.js";
import type { Name } from "./names.js";

import { COMMON_PLACEHOLDERS, KINDS, MCP_RESOURCES_FOLDER } from "./kinds.js";
import { chainFolder, nextMigrationNumber } from "./migrations.js";
import { camel } from "./names.js";
import { loadStub, renderStub, stubName } from "./stubs.js";

/** One `make` request, as the command line spelled it. */
export interface MakeRequest {
	kind: KindName;
	name: Name;
	/** The stub variant a flag selects: `form`, `cron` or `resource`. */
	variant: string | null;
	/** Whether to write a test beside the file. */
	tests: boolean;
	/** The migration chain, for `make migration`. */
	chain?: string;
	/** The route contract a controller is declared in, a module in `routes/`. */
	routes: string;
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
 * Plans `request` in the project at `root`. Every planned path must be free; an existing file
 * is a failure naming it, before any stub is read.
 *
 * @param packageRoot - The `sdxc` package, whose `stubs/` holds the built-in stubs.
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
	let folder = kind.folder;
	let file = name.segments.join("/");
	if (request.kind === "mcp" && request.variant === "resource") folder = MCP_RESOURCES_FOLDER;
	if (request.kind === "migration") {
		let chain = chainFolder(config.make.migrations, request.chain);
		if (isFailure(chain)) return chain;
		folder = chain.data;
		let number = await nextMigrationNumber(root, folder);
		if (isFailure(number)) return number;
		file = `${number.data}_${name.pascal}`;
	}
	let path = `${folder}/${file}${kind.extension}`;
	let testPath = `${folder}/${file}.test${kind.extension}`;
	let writesTest = kind.tests && request.tests;
	let paths = writesTest ? [path, testPath] : [path];
	for (let candidate of paths) {
		if (isSuccess(await wrap(() => stat(join(root, candidate))))) {
			return failure(new Error(`${candidate} already exists; sdxc make leaves it as it is`));
		}
	}

	let values = await placeholders(request, root, `${folder}/${file}`);
	Object.assign(values, overrides);
	let files: PlannedFile[] = [];
	let main = await renderFile(request, values, false, root, config, packageRoot);
	if (isFailure(main)) return main;
	files.push({ path, content: main.data });
	if (writesTest) {
		let test = await renderFile(request, values, true, root, config, packageRoot);
		if (isFailure(test)) return test;
		files.push({ path: testPath, content: test.data });
	}
	return success({ files, values });
}

/**
 * Renders the kind's stub, or its test stub, with `values`. A variant's own stub wins; a
 * variant without its own test stub uses the kind's.
 */
async function renderFile(
	request: MakeRequest,
	values: Record<string, string>,
	test: boolean,
	root: string,
	config: Config,
	packageRoot: string,
): Promise<Result<string, Error>> {
	let names = [stubName(request.kind, request.variant, test)];
	if (request.variant !== null && test) names.push(stubName(request.kind, null, true));
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
	};
	let declarationPath = name.segments.map(camel).join(".");
	let extra: Record<string, string> = {
		path: declarationPath,
		routes: `~/routes/${request.routes}`,
		tool: name.segments.map((segment) => segment.replaceAll("-", "_")).join("_"),
		uri: `${await scheme(root)}://${name.segments.join("/")}`,
		model: `~/app/models/${name.segments.join("/")}`,
	};
	let values: Record<string, string> = {};
	for (let key of [...COMMON_PLACEHOLDERS, ...KINDS[request.kind].placeholders]) {
		let value = common[key] ?? extra[key];
		if (value !== undefined) values[key] = value;
	}
	return values;
}

/**
 * The URI scheme an MCP resource is declared under: the project's package name without its
 * scope, reduced to the characters a scheme allows, or `app` when nothing usable is left.
 */
async function scheme(root: string): Promise<string> {
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
