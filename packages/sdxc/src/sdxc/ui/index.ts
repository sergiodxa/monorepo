/**
 * `sdxc ui`: vendors `@sdxc/ui` components into the project from the installed release and
 * keeps the project's imports pointed at the copies. This module reads the arguments and
 * prints; what each subcommand changes is planned in `./commands.js`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseArgs } from "node:util";

import { isFailure, wrap } from "@sdxc/result";

import type { CommandIO } from "../run.js";

import { findProjectRoot } from "../project.js";

import type { ListRow, Plan, UIContext } from "./commands.js";

import {
	applyPlan,
	diffComponent,
	listComponents,
	loadContext,
	planAdd,
	planRemove,
	planUpdate,
	renderPlan,
} from "./commands.js";

/** What `sdxc ui --help` and its usage errors print. */
export const UI_USAGE = [
	"Usage: sdxc ui <command> [options]",
	"",
	"Commands:",
	"  list                   Every component, marking copies that are edited or behind",
	"  add <component...>     Copy components and point the project's imports at the copies",
	"  diff <component>       Show how a copy differs from the installed version",
	"  update <component...>  Replace untouched copied files with the installed version",
	"  remove <component...>  Delete copies and point imports back at sdxc/ui/<name>",
	"",
	"Options:",
	"  --with-deps  With add, also copy every component they reach through others",
	"  --force      With update, replace edited files too",
	"  --dry-run    With add, update and remove, print the diff and change nothing",
	"  -h, --help   Show this message",
	"",
].join("\n");

/** The flags each subcommand accepts besides `--help`. */
const FLAGS: Record<string, readonly string[]> = {
	list: [],
	add: ["with-deps", "dry-run"],
	diff: [],
	update: ["force", "dry-run"],
	remove: ["dry-run"],
};

/**
 * Runs `sdxc ui` with the arguments after `ui` and answers the exit code: 0 done, 1 the command
 * failed, 2 a usage error.
 *
 * @param options - `packageRoot` is the `sdxc` package whose registry is read; the running one
 *   by default.
 */
export async function ui(
	argv: readonly string[],
	io: CommandIO,
	options: { packageRoot?: string } = {},
): Promise<number> {
	let args = wrap(() =>
		parseArgs({
			args: [...argv],
			allowPositionals: true,
			options: {
				"with-deps": { type: "boolean", default: false },
				force: { type: "boolean", default: false },
				"dry-run": { type: "boolean", default: false },
				help: { type: "boolean", short: "h", default: false },
			},
		}),
	);
	if (isFailure(args)) return usage(io, args.error.message);
	if (args.data.values.help === true) {
		io.stdout(UI_USAGE);
		return 0;
	}
	let [command, ...names] = args.data.positionals;
	if (command === undefined) return usage(io, null);
	let accepted = FLAGS[command];
	if (accepted === undefined) return usage(io, `Unknown ui command: ${command}`);
	let flags = (["with-deps", "force", "dry-run"] as const).filter(
		(flag) => args.data.values[flag] === true,
	);
	let refused = flags.find((flag) => !accepted.includes(flag));
	if (refused !== undefined) return usage(io, `sdxc ui ${command} takes no --${refused}`);
	if (command === "list" && names.length > 0) return usage(io, "sdxc ui list takes no arguments");
	if (command === "diff" && names.length !== 1)
		return usage(io, "sdxc ui diff takes one component");
	if (command !== "list" && names.length === 0) {
		return usage(io, `sdxc ui ${command} needs at least one component`);
	}

	let root = await findProjectRoot(io.cwd);
	if (isFailure(root)) return fail(io, root.error);
	let context = await loadContext(root.data, options.packageRoot);
	if (isFailure(context)) return fail(io, context.error);

	if (command === "list") {
		io.stdout(formatList(await listComponents(context.data)));
		return 0;
	}
	if (command === "diff") {
		let [name = ""] = names;
		let diff = await diffComponent(context.data, name);
		if (isFailure(diff)) return fail(io, diff.error);
		io.stdout(
			diff.data === "" ? `${name} matches sdxc ${context.data.registry.release}\n` : diff.data,
		);
		return 0;
	}
	let plan =
		command === "add"
			? await planAdd(context.data, names, { withDeps: args.data.values["with-deps"] === true })
			: command === "update"
				? await planUpdate(context.data, names, { force: args.data.values.force === true })
				: await planRemove(context.data, names);
	if (isFailure(plan)) return fail(io, plan.error);
	return finish(io, context.data, plan.data, args.data.values["dry-run"] === true);
}

/** Prints the plan's diff under `--dry-run`, or applies it and prints its report. */
async function finish(
	io: CommandIO,
	context: UIContext,
	plan: Plan,
	dryRun: boolean,
): Promise<number> {
	if (dryRun) {
		let diff = await renderPlan(context, plan);
		if (isFailure(diff)) return fail(io, diff.error);
		io.stdout(diff.data);
		for (let line of plan.report) io.stderr(`${line}\n`);
		return 0;
	}
	let report = await applyPlan(context, plan);
	if (isFailure(report)) return fail(io, report.error);
	for (let line of report.data) io.stdout(`${line}\n`);
	return 0;
}

/**
 * The `list` output: one line per component, its name padded to a column, then whether it is
 * copied, from which release, and whether the copy is edited or behind.
 */
export function formatList(rows: readonly ListRow[]): string {
	let width = Math.max(0, ...rows.map((row) => row.name.length));
	return rows
		.map((row) => {
			if (row.copy === null) return `${row.name}\n`;
			let state = [`copied from ${row.copy.release}`];
			if (row.copy.edited) state.push("edited");
			if (row.changedIn === null) state.push("no longer shipped");
			else if (row.copy.behind) state.push(`behind, changed in ${row.changedIn}`);
			return `${row.name.padEnd(width)}  ${state.join(", ")}\n`;
		})
		.join("");
}

function usage(io: CommandIO, message: string | null): number {
	io.stderr(message === null ? UI_USAGE : `${message}\n\n${UI_USAGE}`);
	return 2;
}

function fail(io: CommandIO, error: Error): number {
	io.stderr(`${error.message}\n`);
	return 1;
}
