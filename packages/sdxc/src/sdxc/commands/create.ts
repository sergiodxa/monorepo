/**
 * The `sdxc create` handler: writes a new project from a built-in template or a GitHub
 * repository into a missing or empty directory. Nothing from the template runs: it installs
 * nothing and prints the next steps, and initializes git only in a directory it made.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { relative } from "node:path";

import type { ChainContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, success } from "@sdxc/cli";
import { failure, isFailure, wrap } from "@sdxc/result";

import type { GitHubTemplate } from "../create/github.js";
import type { TemplateSource, TemplateTree } from "../create/templates.js";

import { SDXC_COMMANDS } from "../contract.js";
import { describe, downloadTemplate, GitHubRefusal, githubToken } from "../create/github.js";
import { resolveTarget } from "../create/target.js";
import {
	completeBuiltin,
	nameProject,
	parseTemplate,
	readBuiltinTemplate,
	writeTree,
} from "../create/templates.js";
import { packageRoot } from "../middleware.js";
import { packageManager, scriptCommand } from "../package-manager.js";

/** The middleware `create` runs behind; it runs outside any project. */
const CREATE_MIDDLEWARE = [packageRoot()] as const;

/** What `create`'s helpers read off the context. */
type CreateContext = ChainContext<typeof CREATE_MIDDLEWARE>;

/** A template fetched and completed for the project, with how to describe where it came from. */
interface Fetched {
	tree: TemplateTree;
	description: string;
}

/** Creates the project, then initializes git when asked to, then prints the next steps. */
export default createCommand(SDXC_COMMANDS.create, {
	middleware: CREATE_MIDDLEWARE,
	/** Exits 1 when the target or the template is refused, writing nothing. */
	async handler(ctx) {
		let source = parseTemplate(ctx.flags.template);
		if (isFailure(source)) return source;
		let target = await resolveTarget(ctx.cwd, ctx.arguments.directory);
		if (isFailure(target)) return target;
		let fetched = await fetchTemplate(ctx, source.data, target.data.name);
		if (isFailure(fetched)) return fetched;
		let written = await writeTree(target.data.directory, fetched.data.tree);
		if (isFailure(written)) return written;
		let shown = relative(ctx.cwd, target.data.directory);
		ctx.stdout(`Created ${target.data.name} from ${fetched.data.description}\n`);

		if (!target.data.exists && ctx.flags.git !== false) {
			let initialized = await initializeGit(ctx, ctx.flags.git, target.data.directory, shown);
			if (isFailure(initialized)) return initialized;
		}

		let tree = fetched.data.tree;
		let manager = await packageManager({
			declared: treeManifest(tree)?.packageManager,
			findLockFile: (names) => names.find((name) => tree.files.has(name)) ?? null,
			userAgent: ctx.env.npm_config_user_agent,
		});
		let steps = [];
		if (shown !== "") steps.push(`cd ${shown.includes(" ") ? JSON.stringify(shown) : shown}`);
		steps.push(manager.install.join(" "));
		if (hasScript(tree, "dev")) steps.push(scriptCommand(manager, "dev"));
		ctx.stdout(`\nNext steps:\n${steps.map((step) => `  ${step}\n`).join("")}`);
		return success();
	},
});

/**
 * Runs `git init` in the new project when `--git` was passed, or when the user says yes on a
 * terminal, where Enter says yes; without a terminal and without `--git`, no repository is
 * made. A missing `git` is noted and skipped.
 *
 * @param wanted - `--git` or `--no-git`, or `undefined` to ask
 * @param shown - The project directory relative to where the command ran, for the question
 */
async function initializeGit(
	ctx: CreateContext,
	wanted: boolean | undefined,
	directory: string,
	shown: string,
): Promise<Result<void, Error>> {
	let available = await ctx.exec(["git", "--version"], { stdio: "ignore" });
	if (isFailure(available)) {
		ctx.stdout("git is not on the PATH, so no repository was initialized\n");
		return success(undefined);
	}
	if (wanted === undefined) {
		let answer = await ctx.prompt.confirm({
			message: `Initialize a git repository in ${shown}?`,
			default: false,
			initial: true,
			name: "git",
		});
		if (isFailure(answer)) return answer;
		wanted = answer.data;
	}
	if (!wanted) return success(undefined);
	let initialized = await ctx.exec(["git", "init", "--quiet"], {
		cwd: directory,
		stdio: "ignore",
	});
	if (isFailure(initialized)) {
		let code = "code" in initialized.error ? initialized.error.code : null;
		return failure(new Error(`git init exited with ${code ?? "an error"} in ${directory}`));
	}
	ctx.stdout("Initialized a git repository\n");
	return success(undefined);
}

/** Reads the template `source` names and completes it for the project `name`. */
async function fetchTemplate(
	ctx: CreateContext,
	source: TemplateSource,
	name: string,
): Promise<Result<Fetched, Error>> {
	if (source.kind === "github") {
		let extracted = await download(ctx, source);
		if (isFailure(extracted)) return extracted;
		let named = nameProject(extracted.data.tree, name);
		if (isFailure(named)) return named;
		let commit = extracted.data.commit === null ? "" : ` at ${extracted.data.commit}`;
		return success({ tree: extracted.data.tree, description: `${describe(source)}${commit}` });
	}
	let tree = await readBuiltinTemplate(ctx.packageRoot, source.name);
	if (isFailure(tree)) return tree;
	let completed = await completeBuiltin(tree.data, name, ctx.packageRoot);
	if (isFailure(completed)) return completed;
	return success({ tree: tree.data, description: `the ${source.name} template` });
}

/**
 * Downloads and extracts a GitHub template as a task. When GitHub answers 401 or 404 and no
 * token is set, a terminal is asked for one, used for this download alone; an empty answer, or
 * no terminal, keeps the refusal.
 */
async function download(ctx: CreateContext, source: GitHubTemplate) {
	let label = `Downloading ${describe(source)}`;
	let downloaded = await ctx.task(label, (task) => downloadTemplate(source, ctx.env, task.signal));
	let refused =
		isFailure(downloaded) &&
		downloaded.error instanceof GitHubRefusal &&
		(downloaded.error.status === 401 || downloaded.error.status === 404) &&
		githubToken(ctx.env) === undefined;
	if (!refused) return downloaded;
	let token = await ctx.prompt.password({
		message: `GitHub token for ${source.owner}/${source.repo}`,
		default: "",
		name: "token",
	});
	if (isFailure(token)) return token;
	if (token.data === "") return downloaded;
	return ctx.task(label, (task) =>
		downloadTemplate(source, { GITHUB_TOKEN: token.data }, task.signal),
	);
}

/** The fields of the tree's `package.json` the next steps read, or `null` without a readable one. */
function treeManifest(
	tree: TemplateTree,
): { packageManager?: string; scripts?: Record<string, unknown> } | null {
	let bytes = tree.files.get("package.json");
	if (bytes === undefined) return null;
	let manifest = wrap(() => JSON.parse(new TextDecoder().decode(bytes)) as unknown);
	if (isFailure(manifest) || typeof manifest.data !== "object" || manifest.data === null) {
		return null;
	}
	let { packageManager: declared, scripts } = manifest.data as Record<string, unknown>;
	return {
		...(typeof declared === "string" ? { packageManager: declared } : {}),
		...(typeof scripts === "object" && scripts !== null
			? { scripts: scripts as Record<string, unknown> }
			: {}),
	};
}

/** Whether the tree's `package.json` declares `script`. */
function hasScript(tree: TemplateTree, script: string): boolean {
	let scripts = treeManifest(tree)?.scripts;
	return scripts !== undefined && script in scripts;
}
