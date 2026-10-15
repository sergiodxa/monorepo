/**
 * `sdxc make`: writes a file of a given kind from its stub at the folder the app layout gives
 * it, with a test beside it, and `sdxc make stubs` copies the built-in stubs into the project
 * to edit. Every file is planned before any is written, and none is ever overwritten.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import { isFailure, wrap } from "@sdxc/result";

import type { CommandIO } from "../run.js";

import { loadConfig } from "../config.js";
import { defaultPackageRoot } from "../create/templates.js";
import { unifiedDiff } from "../diff.js";
import { runFormat } from "../format.js";
import { findProjectRoot } from "../project.js";

import type { Declared } from "./declare.js";
import type { MakeRequest, PlannedFile } from "./generate.js";
import type { KindName } from "./kinds.js";

import { declare } from "./declare.js";
import { folderOf, plan, resourceScheme } from "./generate.js";
import { isKind, KINDS } from "./kinds.js";
import { parseName } from "./names.js";
import { copyStubs } from "./stubs.js";

/** What `sdxc make --help` and its usage errors print. */
export const MAKE_USAGE = [
	"Usage: sdxc make <kind> <name> [options]",
	"       sdxc make stubs [kind...]",
	"",
	"Writes a file of `kind` where the app layout puts it, from its stub; a slash in `name` is a",
	"folder inside the kind's folder (make job trials/expire).",
	"",
	`Kinds: ${Object.keys(KINDS).join(", ")}`,
	"",
	"Options:",
	"  --test, --no-test     Write a test beside the file, or skip it (default: make.tests)",
	"  --cron <expression>   make job: a scheduled job instead of one with input",
	"  --method <method>     make controller: get, post, put, patch, delete or form (default: get)",
	"  --path <path>         make controller: the route's pattern (default: /<name>)",
	"  --routes <contract>   make controller: the route contract in routes/ (default: make.routes)",
	"  --resource            make mcp: a resource instead of a tool",
	"  --chain <chain>       make migration: the chain in make.migrations (default: default)",
	"  --dry-run             Print what would be written and change nothing",
	"  -h, --help            Show this message",
	"",
].join("\n");

/** Route methods `--method` accepts; `form` declares a GET page with a POST action. */
const METHODS = ["get", "post", "put", "patch", "delete", "form"];

/** Flags that belong to one kind, so passing one to another kind is a usage error. */
const KIND_FLAGS: ReadonlyArray<[string, KindName]> = [
	["cron", "job"],
	["method", "controller"],
	["path", "controller"],
	["routes", "controller"],
	["resource", "mcp"],
	["chain", "migration"],
];

/** What a caller other than the binary supplies; the binary uses the defaults. */
export interface MakeOptions {
	/**
	 * The directory of the `sdxc` package, which holds the built-in stubs.
	 * @default the package this module is installed in
	 */
	packageRoot?: string;
}

/**
 * Runs `sdxc make` with the arguments after the command name and answers its exit code:
 * 0 written, 1 the plan or a write failed, 2 a usage error.
 */
export async function make(
	argv: readonly string[],
	io: CommandIO,
	options: MakeOptions = {},
): Promise<number> {
	let args = wrap(() =>
		parseArgs({
			args: [...argv],
			allowPositionals: true,
			options: {
				test: { type: "boolean" },
				"no-test": { type: "boolean" },
				cron: { type: "string" },
				method: { type: "string" },
				path: { type: "string" },
				routes: { type: "string" },
				resource: { type: "boolean" },
				chain: { type: "string" },
				"dry-run": { type: "boolean", default: false },
				help: { type: "boolean", short: "h", default: false },
			},
		}),
	);
	if (isFailure(args)) return usage(io, args.error.message);
	let { values, positionals } = args.data;
	if (values.help === true) {
		io.stdout(MAKE_USAGE);
		return 0;
	}
	let [kind, ...rest] = positionals;
	if (kind === undefined) return usage(io, null);
	let dryRun = values["dry-run"] === true;
	let packageRoot = options.packageRoot ?? defaultPackageRoot();

	let root = await findProjectRoot(io.cwd);
	if (isFailure(root)) return fail(io, root.error);
	let loaded = await loadConfig(root.data);
	if (isFailure(loaded)) return fail(io, loaded.error);
	let { config } = loaded.data;

	if (kind === "stubs") {
		let unknown = rest.find((name) => !isKind(name));
		if (unknown !== undefined) return usage(io, `Unknown kind: ${unknown}`);
		if (dryRun) return usage(io, "sdxc make stubs writes only new files; run it without --dry-run");
		let copied = await copyStubs(rest.filter(isKind), root.data, config.make.stubs, packageRoot);
		if (isFailure(copied)) return fail(io, copied.error);
		for (let path of copied.data.written) io.stdout(`Wrote ${path}\n`);
		for (let path of copied.data.kept) io.stdout(`Kept ${path}, which already exists\n`);
		return 0;
	}

	if (!isKind(kind)) return usage(io, `Unknown kind: ${kind}`);
	if (rest.length !== 1) return usage(io, `sdxc make ${kind} takes one name`);
	for (let [flag, owner] of KIND_FLAGS) {
		if (values[flag as keyof typeof values] !== undefined && owner !== kind) {
			return usage(io, `--${flag} applies to sdxc make ${owner}`);
		}
	}
	if (values.test === true && values["no-test"] === true) {
		return usage(io, "--test and --no-test answer the same question; pass one");
	}
	let method = values.method ?? "get";
	if (!METHODS.includes(method)) {
		return usage(io, `--method takes one of ${METHODS.join(", ")}, not ${method}`);
	}
	let name = parseName(rest[0] ?? "");
	if (isFailure(name)) return fail(io, name.error);

	let request: MakeRequest = {
		kind,
		name: name.data,
		variant: variantOf(kind, { cron: values.cron, method, resource: values.resource }),
		tests: values.test === true ? true : values["no-test"] === true ? false : config.make.tests,
		chain: values.chain,
		routes: values.routes ?? config.make.routes,
	};
	let declared: Declared | null = null;
	if (kind === "job" || kind === "controller" || kind === "mcp") {
		let segments = request.name.segments;
		declared = await declare(
			{
				kind,
				name: request.name,
				variant: request.variant,
				cron: values.cron,
				method,
				pattern: values.path,
				routes: request.routes,
				handler: `${folderOf(kind, request.variant)}/${segments.join("/")}`,
				tool: segments.map((segment) => segment.replaceAll("-", "_")).join("_"),
				uri: `${await resourceScheme(root.data)}://${segments.join("/")}`,
				title: request.name.title,
			},
			root.data,
		);
	}
	let overrides: Record<string, string> = declared === null ? {} : { path: declared.path };
	let planned = await plan(request, root.data, config, packageRoot, overrides);
	if (isFailure(planned)) return fail(io, planned.error);
	let edits = declared?.kind === "edits" ? declared.edits : [];

	if (dryRun) {
		for (let file of planned.data.files) {
			io.stdout(`Would write ${file.path}:\n\n${file.content}\n`);
		}
		for (let edit of edits) io.stdout(unifiedDiff(edit.path, edit.before, edit.after));
		if (declared?.kind === "manual") io.stdout(manualNote(declared));
		return 0;
	}
	let written = await writeFiles(root.data, planned.data.files);
	if (isFailure(written)) return fail(io, written.error);
	let paths = planned.data.files.map((file) => file.path);
	for (let path of paths) io.stdout(`Wrote ${path}\n`);
	let edited = await wrap(async () => {
		for (let edit of edits) await writeFile(join(root.data, edit.path), edit.after);
	});
	if (isFailure(edited)) return fail(io, edited.error);
	for (let edit of edits) io.stdout(`Edited ${edit.path}\n`);
	if (declared?.kind === "manual") io.stdout(manualNote(declared));
	let changed = [...paths, ...edits.map((edit) => edit.path)];
	let formatted = await runFormat(config.format, changed, root.data);
	if (isFailure(formatted)) return fail(io, formatted.error);
	return 0;
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

/** Prints a usage error, with `message` above the usage when there is one, and answers 2. */
function usage(io: CommandIO, message: string | null): number {
	io.stderr(message === null ? MAKE_USAGE : `${message}\n\n${MAKE_USAGE}`);
	return 2;
}

/** Prints a failure and answers 1. */
function fail(io: CommandIO, error: Error): number {
	io.stderr(`${error.message}\n`);
	return 1;
}
