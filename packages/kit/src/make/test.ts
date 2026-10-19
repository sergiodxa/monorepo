/**
 * `sdxc make test <file>`: the test `sdxc make` writes beside a file of its kind, for a file
 * that has none, such as one made with `--no-test`. The kind comes from the folder the file
 * sits in, and a controller's route from the router that maps it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { Project } from "../middleware.js";

import { missingDependencies } from "../dependencies.js";
import { formatFiles } from "../format.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import { listRoutes } from "../routes/index.js";
import { readManifest } from "../upgrade/project.js";

import type { MakeRequest } from "./generate.js";
import type { KindName } from "./kinds.js";

import { exists, plan } from "./generate.js";
import { KINDS, MCP_RESOURCES_FOLDER } from "./kinds.js";
import { parseName } from "./names.js";

import type { MakeContext } from "./index.js";

/** What `make test` was asked for. */
export interface MakeTestInput {
	/** The file to test, relative to the project root or to the current directory. */
	file: string;
	/** The folder relative paths resolve against. */
	cwd: string;
	dryRun: boolean;
	/** Replace a test that exists already. */
	force: boolean;
}

/** The kind a file belongs to, read from the folder it sits in. */
interface Located {
	kind: KindName;
	/** The file's path inside the kind's folder, without its extension. */
	name: string;
	variant: string | null;
}

/**
 * The kind whose folder holds `path`, and the name inside it. Migrations, factories and
 * policies get no test from here: the first two never have one, and a policy's test is written
 * with its abilities by `sdxc make policy`.
 */
export function locate(path: string): Result<Located, Error> {
	let folders: [string, KindName, string | null][] = [
		[MCP_RESOURCES_FOLDER, "mcp", "resource"],
		...Object.entries(KINDS).map(
			([kind, spec]) => [spec.folder, kind as KindName, null] as [string, KindName, null],
		),
	];
	for (let [folder, kind, variant] of folders) {
		let spec = KINDS[kind];
		if (!path.startsWith(`${folder}/`) || !path.endsWith(spec.extension)) continue;
		if (path.endsWith(`.test${spec.extension}`)) {
			return failure(new Error(`${path} is a test; name the file it tests`));
		}
		if (!spec.tests || spec.testOnly === true) {
			let reason =
				kind === "policy"
					? "a policy's test is written with its abilities by sdxc make policy"
					: `a ${kind} has no test`;
			return failure(new Error(`${path} gets no test from sdxc make test: ${reason}`));
		}
		return success({ kind, name: path.slice(folder.length + 1, -spec.extension.length), variant });
	}
	let known = Object.values(KINDS)
		.filter((spec) => spec.tests && spec.testOnly !== true)
		.map((spec) => spec.folder);
	return failure(
		new Error(
			`${path} is in no folder sdxc make writes tests for; those are ${known.join(", ")} and ${MCP_RESOURCES_FOLDER}`,
		),
	);
}

/**
 * The route a controller answers, from the routers that map it: its contract and key path,
 * and whether it is a form (an `index` and an `action` under one key). A controller no router
 * maps takes the key path its name spells in the configured contract.
 */
async function controllerRoute(
	root: string,
	file: string,
): Promise<{ routes: string | null; path: string | null; form: boolean; pattern: string }> {
	let listing = await listRoutes(root);
	let entries = listing.routes.filter((entry) => entry.controller?.file === file);
	let first = entries[0];
	if (first === undefined) return { routes: null, path: null, form: false, pattern: "" };
	let form = entries.find((entry) => entry.name.endsWith(".action"));
	let path = form === undefined ? first.name : form.name.slice(0, -".action".length);
	return { routes: first.contract, path, form: form !== undefined, pattern: first.pattern };
}

/**
 * Writes the test for `input.file` from its kind's test stub, printing the path, or the whole
 * test under `dryRun`. An existing test stops the run unless `force` replaces it.
 *
 * @param packageRoot - The `@sdxc/kit` package, whose `stubs/` holds the built-in stubs.
 */
export async function makeTest(
	ctx: MakeContext,
	project: Project,
	packageRoot: string,
	input: MakeTestInput,
): Promise<Result<void, Error>> {
	let { root, config } = project;
	let file = relative(root, join(input.cwd, input.file)).split("\\").join("/");
	if (file.startsWith("..")) return failure(new Error(`${input.file} is outside the project`));
	if (!(await exists(root, file))) {
		return failure(new Error(`${file} does not exist; sdxc make test writes a test for a file`));
	}
	let located = locate(file);
	if (isFailure(located)) return located;
	let { kind, variant } = located.data;
	let name = parseName(located.data.name);
	if (isFailure(name)) return name;

	let routes = config.make.routes;
	let overrides: Record<string, string> = {};
	let chosen = variant;
	if (kind === "controller") {
		let route = await controllerRoute(root, file);
		if (route.routes !== null) routes = route.routes;
		if (route.path !== null) overrides.path = route.path;
		if (route.form) chosen = "form";
		let params = [...route.pattern.matchAll(/:(\w+)/g)].map((match) => match[1] as string);
		if (params.length > 0) {
			overrides.sampleParams = `{ ${params.map((param) => `${param}: "1"`).join(", ")} }`;
		}
	}
	let request: MakeRequest = {
		kind,
		name: name.data,
		variant: chosen,
		tests: true,
		routes,
		replace: input.force,
		testAlone: true,
	};
	let planned = await plan(request, root, config, packageRoot, overrides);
	if (isFailure(planned)) return planned;
	let dependencies = await missingDependencies(root, planned.data.files);
	if (isFailure(dependencies)) return dependencies;

	if (input.dryRun) {
		for (let test of planned.data.files)
			ctx.stdout(`Would write ${test.path}:\n\n${test.content}\n`);
		return success(undefined);
	}
	let paths: string[] = [];
	for (let test of planned.data.files) {
		let replaced = await exists(root, test.path);
		let target = join(root, test.path);
		let written = await wrap(async () => {
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, test.content, { flag: input.force ? "w" : "wx" });
		});
		if (isFailure(written)) return written;
		ctx.stdout(`${replaced ? "Replaced" : "Wrote"} ${test.path}\n`);
		paths.push(test.path);
	}
	if (dependencies.data !== null) {
		let edit = dependencies.data;
		let edited = await wrap(() => writeFile(join(root, edit.path), edit.after));
		if (isFailure(edited)) return edited;
		let read = await readManifest(root);
		let manager = await packageManager({
			declared: isFailure(read) ? undefined : read.data.manifest.packageManager,
			findLockFile: lockFileAtOrAbove(root),
		});
		let added = edit.added.map(({ name: dependency, version }) => `${dependency}@${version}`);
		ctx.stdout(`Added ${added.join(", ")} to package.json; run ${manager.install.join(" ")}\n`);
	}
	return formatFiles(ctx, config.format, paths, root);
}
