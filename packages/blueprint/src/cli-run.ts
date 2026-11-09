/**
 * The `sdxc-blueprint` handler. `--list` names the app's blueprints; `<blueprint> --help`, or a
 * run missing a value, prints what the blueprint needs, read from its stubs; anything else
 * renders every stub, plans the files and writes them, or with `--dry-run` only reports the plan.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HandlerContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { closest, createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { Blueprint, BlueprintEntry } from "./cli-blueprints.js";
import type { ProgramOptions } from "./cli-values.js";
import type { FileToWrite, Plan } from "./plan.js";
import type { Values } from "./render.js";
import type { Variable } from "./variables.js";

import { listBlueprints, loadBlueprint, BLUEPRINTS_DIR } from "./cli-blueprints.js";
import { BLUEPRINT_COMMANDS } from "./cli-contract.js";
import { flagName, readValues, RESERVED_FLAGS, splitArgv } from "./cli-values.js";
import { plan, write } from "./plan.js";
import { render } from "./render.js";
import { variables } from "./variables.js";

/** The context the handler runs with. */
type Context = HandlerContext<typeof BLUEPRINT_COMMANDS>;

/** Prints `value` as indented JSON on stdout. */
function printJSON(ctx: Context, value: unknown): void {
	ctx.stdout(`${JSON.stringify(value, null, "\t")}\n`);
}

/** The program's own help, with the blueprints the working directory has. */
function programHelp(entries: readonly BlueprintEntry[]): string {
	let lines = [
		"sdxc-blueprint — generate files from the blueprints in .config/blueprint",
		"",
		"Usage:",
		"  sdxc-blueprint <blueprint> [values] [--dry-run] [--force] [--json]",
		"  sdxc-blueprint <blueprint> --help   What a blueprint needs and writes",
		"  sdxc-blueprint --list [--json]      Every blueprint, with its description",
		"",
		"Options:",
		"  --dry-run  Report each file as create, replace or conflict, and write nothing",
		"  --force    Replace files that exist instead of stopping",
		"  --json     Print the report as JSON",
		"",
	];
	if (entries.length === 0) {
		lines.push(`No blueprints yet: add a .stub file or a folder of them to ${BLUEPRINTS_DIR}/`);
	} else {
		lines.push("Blueprints:", ...listLines(entries));
	}
	return `${lines.join("\n")}\n`;
}

/** One line per blueprint, names aligned. */
function listLines(entries: readonly BlueprintEntry[]): string[] {
	let width = Math.max(...entries.map((entry) => entry.name.length));
	return entries.map((entry) =>
		`  ${entry.name.padEnd(width)}  ${entry.description ?? ""}`.trimEnd(),
	);
}

/** The help of one blueprint: its values with where each is used, then the files it writes. */
function blueprintHelp(blueprint: Blueprint, found: readonly Variable[]): string {
	let usage = found.map((variable) => {
		let flag = `--${flagName(variable.name)}`;
		if (variable.kind === "flag") return `[${flag}]`;
		if (variable.kind === "list") return `[${flag} <text>…]`;
		return `${flag} <text>`;
	});
	let labels = found.map((variable) => {
		let flag = `--${flagName(variable.name)}`;
		return variable.kind === "flag" ? flag : `${flag} <text>`;
	});
	let width = Math.max(0, ...labels.map((label) => label.length));
	let kinds = { text: "required", flag: "flag", list: "repeatable" };
	let lines = [
		[blueprint.name, blueprint.description].filter(Boolean).join(" — "),
		"",
		`Usage: sdxc-blueprint ${[blueprint.name, ...usage].join(" ")}`,
	];
	if (found.length > 0) {
		lines.push("", "Values:");
		found.forEach((variable, index) => {
			let places = variable.uses.map((use) => `${use.source.split("/").at(-1)}:${use.line}`);
			let unique = [...new Set(places)];
			let shown = unique.slice(0, 3).join(", ");
			let more = unique.length > 3 ? `, and ${unique.length - 3} more` : "";
			lines.push(
				`  ${(labels[index] ?? "").padEnd(width)}  ${kinds[variable.kind]}; used in ${shown}${more}`,
			);
		});
	}
	lines.push("", "Writes:");
	for (let { stub } of blueprint.stubs) {
		lines.push(`  ${stub.frontmatter.to}  (${stub.source.split("/").at(-1)})`);
	}
	return `${lines.join("\n")}\n`;
}

/** The blueprint's help as data, for `--json`. */
function blueprintJSON(blueprint: Blueprint, found: readonly Variable[]) {
	return {
		name: blueprint.name,
		description: blueprint.description ?? null,
		path: blueprint.path,
		values: found.map((variable) => ({
			name: variable.name,
			flag: `--${flagName(variable.name)}`,
			kind: variable.kind,
			required: variable.kind === "text",
			uses: variable.uses,
		})),
		writes: blueprint.stubs.map(({ stub }) => ({ to: stub.frontmatter.to, stub: stub.source })),
	};
}

/** Renders every stub's path and body with `values`. */
function renderFiles(blueprint: Blueprint, values: Values): Result<FileToWrite[], Error> {
	let files: FileToWrite[] = [];
	for (let { stub, to } of blueprint.stubs) {
		let path = render(to, values);
		if (isFailure(path)) return path;
		let content = render(stub, values);
		if (isFailure(content)) return content;
		files.push({ path: path.data, content: content.data, source: stub.source });
	}
	return success(files);
}

/** Reports a plan, written or not, and answers the run's outcome. */
async function finish(ctx: Context, planned: Plan, options: ProgramOptions, name: string) {
	let files = planned.files.map(({ path, action }) => ({ path, action }));
	if (options.dryRun || planned.conflicts.length > 0) {
		let written = false;
		if (options.json)
			printJSON(ctx, { blueprint: name, written, files, conflicts: planned.conflicts });
		else for (let file of files) ctx.stdout(`${file.action.padEnd(8)}  ${file.path}\n`);
		if (planned.conflicts.length === 0) return success();
		let hint = options.dryRun ? "" : "Nothing was written. ";
		return exit(
			1,
			`${hint}These files exist already: ${planned.conflicts.join(", ")}. Remove them, or rerun with --force to replace them`,
		);
	}
	let written = await write(planned);
	if (isFailure(written)) return exit(1, written.error.message);
	if (options.json) {
		printJSON(ctx, { blueprint: name, written: true, files, conflicts: [] });
	} else {
		for (let file of files) {
			ctx.stdout(`${file.action === "create" ? "created " : "replaced"}  ${file.path}\n`);
		}
	}
	return success();
}

/** Runs one invocation of the program. */
export default createCommand(BLUEPRINT_COMMANDS, async (ctx) => {
	let split = splitArgv(ctx.arguments.args);
	let { options } = split;

	if (split.blueprint === undefined) {
		let entries = await listBlueprints(ctx.cwd);
		if (isFailure(entries)) return exit(2, entries.error.message);
		if (options.list && options.json) {
			printJSON(
				ctx,
				entries.data.map((entry) => ({ ...entry, description: entry.description ?? null })),
			);
			return success();
		}
		if (options.list) {
			ctx.stdout(
				entries.data.length === 0
					? `No blueprints in ${BLUEPRINTS_DIR}\n`
					: `${listLines(entries.data).join("\n")}\n`,
			);
			return success();
		}
		if (options.help) {
			ctx.stdout(programHelp(entries.data));
			return success();
		}
		ctx.stderr(programHelp(entries.data));
		return exit(2, split.issues[0] ?? "Name a blueprint to run");
	}

	let loaded = await loadBlueprint(ctx.cwd, split.blueprint);
	if (isFailure(loaded)) return exit(2, loaded.error.message);
	let blueprint = loaded.data;
	if (blueprint === undefined) {
		let entries = await listBlueprints(ctx.cwd);
		let names = isFailure(entries) ? [] : entries.data.map((entry) => entry.name);
		let suggestion = closest(split.blueprint, names);
		let hint =
			suggestion === undefined ? `; see sdxc-blueprint --list` : `; did you mean "${suggestion}"?`;
		return exit(2, `No blueprint "${split.blueprint}" in ${BLUEPRINTS_DIR}${hint}`);
	}

	let found = variables(blueprint.stubs.flatMap(({ stub, to }) => [to, stub]));
	if (isFailure(found)) return exit(2, found.error.message);
	let reserved = found.data.find((variable) => RESERVED_FLAGS.has(flagName(variable.name)));
	if (reserved !== undefined) {
		let use = reserved.uses[0];
		return exit(
			2,
			`${use?.source}:${use?.line}: {{${reserved.name}}} takes the name of sdxc-blueprint's own --${flagName(reserved.name)}; rename it`,
		);
	}

	if (options.help) {
		if (options.json) printJSON(ctx, blueprintJSON(blueprint, found.data));
		else ctx.stdout(blueprintHelp(blueprint, found.data));
		return success();
	}

	let read = readValues(split.values, found.data);
	let problems = [...split.issues, ...read.issues];
	if (read.missing.length > 0) {
		problems.push(`Missing ${read.missing.map((flag) => `--${flag}`).join(", ")}`);
	}
	if (problems.length > 0) {
		if (options.json) printJSON(ctx, { ...blueprintJSON(blueprint, found.data), problems });
		else ctx.stderr(`${blueprintHelp(blueprint, found.data)}\n`);
		return exit(2, problems.join("\n"));
	}

	let files = renderFiles(blueprint, read.values);
	if (isFailure(files)) return exit(2, files.error.message);
	let planned = await plan(files.data, { root: ctx.cwd, force: options.force });
	if (isFailure(planned)) return exit(2, planned.error.message);
	return finish(ctx, planned.data, options, blueprint.name);
});
