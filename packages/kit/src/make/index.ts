/**
 * What one `sdxc make <kind>` run does: writes a file of the kind from its stub at the folder
 * the app layout gives it, with a test beside it, declares and maps it where the kind needs it,
 * and runs the project's `format`. Every file is planned before any is written, and none is
 * ever overwritten.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { AnyCommandContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { isFailure, success, wrap } from "@sdxc/result";

import type { Project } from "../middleware.js";

import { unifiedDiff } from "../diff.js";
import { formatFiles } from "../format.js";

import type { Declared } from "./declare.js";
import type { MakeRequest, PlannedFile } from "./generate.js";
import type { KindName } from "./kinds.js";

import { declare } from "./declare.js";
import { folderOf, plan, resourceScheme } from "./generate.js";
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
	/** `make mcp`: a resource instead of a tool. */
	resource?: boolean | undefined;
	/** `make migration`: the chain in `make.migrations`. */
	chain?: string | undefined;
}

/** What `make` writes through: the command's output, child processes and tasks. */
export type MakeContext = Pick<AnyCommandContext, "stdout" | "exec" | "task">;

/**
 * Plans, writes, declares and formats one file of `input.kind`, printing each path written and
 * edited; under `dryRun` it prints the files and the diff of each edit instead.
 *
 * @param packageRoot - The `@sdxc/kit` package, whose `stubs/` holds the built-in stubs.
 */
export async function make(
	ctx: MakeContext,
	project: Project,
	packageRoot: string,
	input: MakeInput,
): Promise<Result<void, Error>> {
	let { root, config } = project;
	let { kind } = input;
	let name = parseName(input.name);
	if (isFailure(name)) return name;
	let method = input.method ?? "get";
	let request: MakeRequest = {
		kind,
		name: name.data,
		variant: variantOf(kind, { cron: input.cron, method, resource: input.resource }),
		tests: input.test ?? config.make.tests,
		chain: input.chain,
		routes: input.routes ?? config.make.routes,
	};
	let declared: Declared | null = null;
	if (kind === "job" || kind === "controller" || kind === "mcp" || kind === "command") {
		let segments = request.name.segments;
		declared = await declare(
			{
				kind,
				name: request.name,
				variant: request.variant,
				cron: input.cron,
				method,
				pattern: input.path,
				routes: request.routes,
				handler: `${folderOf(kind, request.variant)}/${segments.join("/")}`,
				tool: segments.map((segment) => segment.replaceAll("-", "_")).join("_"),
				uri: `${await resourceScheme(root)}://${segments.join("/")}`,
				title: request.name.title,
			},
			root,
		);
	}
	let overrides: Record<string, string> = declared === null ? {} : { path: declared.path };
	let planned = await plan(request, root, config, packageRoot, overrides);
	if (isFailure(planned)) return planned;
	let edits = declared?.kind === "edits" ? declared.edits : [];

	if (input.dryRun) {
		for (let file of planned.data.files) {
			ctx.stdout(`Would write ${file.path}:\n\n${file.content}\n`);
		}
		for (let edit of edits) ctx.stdout(unifiedDiff(edit.path, edit.before, edit.after));
		if (declared?.kind === "manual") ctx.stdout(manualNote(declared));
		return success(undefined);
	}
	let written = await writeFiles(root, planned.data.files);
	if (isFailure(written)) return written;
	let paths = planned.data.files.map((file) => file.path);
	for (let path of paths) ctx.stdout(`Wrote ${path}\n`);
	let edited = await wrap(async () => {
		for (let edit of edits) await writeFile(join(root, edit.path), edit.after);
	});
	if (isFailure(edited)) return edited;
	for (let edit of edits) ctx.stdout(`Edited ${edit.path}\n`);
	if (declared?.kind === "manual") ctx.stdout(manualNote(declared));
	let changed = [...paths, ...edits.map((edit) => edit.path)];
	return formatFiles(ctx, config.format, changed, root);
}

/** What `make` prints when a declaration and its mapping are left for the user to make. */
function manualNote(declared: Extract<Declared, { kind: "manual" }>): string {
	return `Declare and map it by hand, since ${declared.reason}:\n${declared.instructions}\n`;
}

/** The stub variant a request's flags select, or `null` for the kind's own stub. */
function variantOf(
	kind: KindName,
	flags: { cron: string | undefined; method: string; resource: boolean | undefined },
): string | null {
	if (kind === "job" && flags.cron !== undefined) return "cron";
	if (kind === "controller" && flags.method === "form") return "form";
	if (kind === "mcp" && flags.resource === true) return "resource";
	return null;
}

/** Writes every planned file, creating its folders; an existing file fails the write. */
function writeFiles(root: string, files: readonly PlannedFile[]) {
	return wrap(async () => {
		for (let file of files) {
			let target = join(root, file.path);
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, file.content, { flag: "wx" });
		}
	});
}
