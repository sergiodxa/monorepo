/**
 * `sdxc create`: writes a new project from a built-in template or a GitHub repository into a
 * missing or empty directory. Nothing from the template runs: the command installs nothing and
 * prints the next steps, and initializes git only in a directory it made, after asking.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

import type { Result } from "@sdxc/result";

import { isFailure, success, wrap } from "@sdxc/result";

import type { CommandIO } from "../run.js";

import type { Git } from "./git.js";
import type { TemplateSource, TemplateTree } from "./templates.js";

import { SYSTEM_GIT } from "./git.js";
import { describe, downloadTemplate } from "./github.js";
import { commandsFor, inferPackageManager } from "./package-manager.js";
import { resolveTarget } from "./target.js";
import {
	completeBuiltin,
	DEFAULT_TEMPLATE,
	defaultPackageRoot,
	nameProject,
	parseTemplate,
	readBuiltinTemplate,
	writeTree,
} from "./templates.js";

/** What `sdxc create --help` and its usage errors print. */
export const CREATE_USAGE = [
	"Usage: sdxc create [directory] [options]",
	"",
	"Writes a new project into `directory` (the current one when omitted), which must be",
	"missing or empty apart from a .git folder.",
	"",
	"Options:",
	`  --template <template>  A built-in template (default: ${DEFAULT_TEMPLATE}) or a GitHub`,
	"                         repository as org/repo[/path][#ref]",
	"  --git, --no-git        Initialize a git repository without asking, or skip it",
	"  -h, --help             Show this message",
	"",
].join("\n");

/** Asks a yes-or-no question on the terminal; `null` when there is no terminal to ask on. */
export type Confirm = (question: string) => Promise<boolean | null>;

/** What a caller other than the binary supplies; the binary uses the defaults. */
export interface CreateOptions {
	/**
	 * The directory of the `sdxc` package, which holds the built-in templates.
	 * @default the package this module is installed in
	 */
	packageRoot?: string;
	/** @default the `git` on the `PATH` */
	git?: Git;
	/** @default a prompt on the process's terminal, or `null` when stdin is not one */
	confirm?: Confirm;
	/**
	 * The `npm_config_user_agent` the next steps take their package manager from.
	 * @default the process's own
	 */
	userAgent?: string;
}

/** A template fetched and completed for the project, with how to describe where it came from. */
interface Fetched {
	tree: TemplateTree;
	description: string;
}

/**
 * Runs `sdxc create` with the arguments after the command name and answers its exit code:
 * 0 created, 1 the target or template was refused, 2 a usage error.
 */
export async function create(
	argv: readonly string[],
	io: CommandIO,
	options: CreateOptions = {},
): Promise<number> {
	let args = wrap(() =>
		parseArgs({
			args: [...argv],
			allowPositionals: true,
			options: {
				template: { type: "string", default: DEFAULT_TEMPLATE },
				git: { type: "boolean", default: false },
				"no-git": { type: "boolean", default: false },
				help: { type: "boolean", short: "h", default: false },
			},
		}),
	);
	if (isFailure(args)) {
		io.stderr(`${args.error.message}\n\n${CREATE_USAGE}`);
		return 2;
	}
	let { values, positionals } = args.data;
	if (values.help === true) {
		io.stdout(CREATE_USAGE);
		return 0;
	}
	if (positionals.length > 1) {
		io.stderr(`sdxc create takes one directory\n\n${CREATE_USAGE}`);
		return 2;
	}
	if (values.git === true && values["no-git"] === true) {
		io.stderr(`--git and --no-git answer the same question; pass one\n\n${CREATE_USAGE}`);
		return 2;
	}
	let source = parseTemplate(values.template ?? DEFAULT_TEMPLATE);
	if (isFailure(source)) {
		io.stderr(`${source.error.message}\n`);
		return 1;
	}
	let target = await resolveTarget(io.cwd, positionals[0]);
	if (isFailure(target)) {
		io.stderr(`${target.error.message}\n`);
		return 1;
	}
	let packageRoot = options.packageRoot ?? defaultPackageRoot();
	let fetched = await fetchTemplate(source.data, target.data.name, packageRoot);
	if (isFailure(fetched)) {
		io.stderr(`${fetched.error.message}\n`);
		return 1;
	}
	let written = await writeTree(target.data.directory, fetched.data.tree);
	if (isFailure(written)) {
		io.stderr(`${written.error.message}\n`);
		return 1;
	}
	let shown = relative(io.cwd, target.data.directory);
	io.stdout(`Created ${target.data.name} from ${fetched.data.description}\n`);

	let wantsGit = values.git === true ? true : values["no-git"] === true ? false : null;
	if (!target.data.exists && wantsGit !== false) {
		let git = options.git ?? SYSTEM_GIT;
		if (!(await git.available())) {
			io.stdout("git is not on the PATH, so no repository was initialized\n");
		} else {
			let confirm = options.confirm ?? terminalConfirm(io);
			let answer = wantsGit ?? (await confirm(`Initialize a git repository in ${shown}?`));
			if (answer === true) {
				let initialized = await git.init(target.data.directory);
				if (isFailure(initialized)) {
					io.stderr(`${initialized.error.message}\n`);
					return 1;
				}
				io.stdout("Initialized a git repository\n");
			}
		}
	}

	let manager = inferPackageManager(
		fetched.data.tree,
		options.userAgent ?? process.env.npm_config_user_agent,
	);
	let steps = [];
	if (shown !== "") steps.push(`cd ${shown.includes(" ") ? JSON.stringify(shown) : shown}`);
	let commands = commandsFor(manager, "dev");
	steps.push(commands.install);
	if (hasScript(fetched.data.tree, "dev")) steps.push(commands.run);
	io.stdout(`\nNext steps:\n${steps.map((step) => `  ${step}\n`).join("")}`);
	return 0;
}

/** Reads the template `source` names and completes it for the project `name`. */
async function fetchTemplate(
	source: TemplateSource,
	name: string,
	packageRoot: string,
): Promise<Result<Fetched, Error>> {
	if (source.kind === "github") {
		let extracted = await downloadTemplate(source);
		if (isFailure(extracted)) return extracted;
		let named = nameProject(extracted.data.tree, name);
		if (isFailure(named)) return named;
		let commit = extracted.data.commit === null ? "" : ` at ${extracted.data.commit}`;
		return success({ tree: extracted.data.tree, description: `${describe(source)}${commit}` });
	}
	let tree = await readBuiltinTemplate(packageRoot, source.name);
	if (isFailure(tree)) return tree;
	let completed = await completeBuiltin(tree.data, name, packageRoot);
	if (isFailure(completed)) return completed;
	return success({ tree: tree.data, description: `the ${source.name} template` });
}

/** Whether the tree's `package.json` declares `script`. */
function hasScript(tree: TemplateTree, script: string): boolean {
	let bytes = tree.files.get("package.json");
	if (bytes === undefined) return false;
	let manifest = wrap(() => JSON.parse(new TextDecoder().decode(bytes)) as unknown);
	if (isFailure(manifest)) return false;
	let scripts = (manifest.data as { scripts?: unknown } | null)?.scripts;
	return typeof scripts === "object" && scripts !== null && script in scripts;
}

/**
 * A prompt on the process's own terminal that answers yes to an empty line. Without a
 * terminal on stdin it answers `null`, which `create` reads as no.
 */
function terminalConfirm(io: CommandIO): Confirm {
	return async (question) => {
		if (process.stdin.isTTY !== true) return null;
		let readline = createInterface({ input: process.stdin, output: process.stdout });
		let answer = await readline.question(`${question} (Y/n) `);
		readline.close();
		let normalized = answer.trim().toLowerCase();
		if (normalized === "" || normalized === "y" || normalized === "yes") return true;
		io.stdout("Skipped git init\n");
		return false;
	};
}
