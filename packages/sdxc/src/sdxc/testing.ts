/**
 * Builds a project from a built-in template the way a consumer's install would see it, for the
 * tests that type check templates and generated code: dependencies are linked from this
 * workspace instead of installed, and the Worker's types are generated as `cf:typegen` does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { Result } from "@sdxc/result";

import { invoke } from "@sdxc/cli/test";
import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

import { createSDXC } from "./cli.js";
import { defaultPackageRoot } from "./create/templates.js";

/** What a spawned command printed and how it exited. */
export interface Spawned {
	code: number | null;
	output: string;
}

/**
 * Creates `template` as the project `name` inside a fresh temporary directory and links every
 * dependency its `package.json` lists: `sdxc` to this package, anything else to the copy this
 * workspace installed. Answers the project directory; the caller removes its parent.
 */
export async function materialize(template: string, name = "app"): Promise<Result<string, Error>> {
	let parent = await mkdtemp(join(tmpdir(), "sdxc-template-"));
	let packageRoot = defaultPackageRoot();
	let created = await invoke(createSDXC(), ["create", name, "--template", template, "--no-git"], {
		cwd: parent,
		interactive: false,
	});
	if (created.code !== 0) {
		return failure(new Error(`sdxc create exited with ${created.code}: ${created.stderr}`));
	}
	let project = join(parent, name);
	let manifest = JSON.parse(await readFile(join(project, "package.json"), "utf8")) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	};
	let names = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
	for (let dependency of names) {
		let source =
			dependency === "sdxc" ? success(packageRoot) : await installed(packageRoot, dependency);
		if (isFailure(source)) return source;
		let link = join(project, "node_modules", dependency);
		await mkdir(dirname(link), { recursive: true });
		await symlink(source.data, link, "dir");
	}
	return success(project);
}

/**
 * Generates the Worker's types with the project's own `cf`, then type checks the project with
 * the workspace's TypeScript, answering what the compiler printed.
 */
export async function typecheck(project: string): Promise<Spawned> {
	let types = await run([join(project, "node_modules/cf/bin/cf"), "workers", "types"], project);
	if (types.code !== 0) return types;
	return run(
		[join(project, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", project],
		project,
	);
}

/**
 * Runs the project's own command line, `bootstrap/cli.ts`, under Bun with `argv`, as
 * `bun run cli` and `sdxc run` start it, answering both output streams together.
 */
export function runCommandLine(project: string, argv: string[]): Promise<Spawned> {
	return run(["bootstrap/cli.ts", ...argv], project, "bun");
}

/** Runs the project's own tests with its own Vite+, as `vp test run` inside it does. */
export function testProject(project: string): Promise<Spawned> {
	return run([join(project, "node_modules/vite-plus/bin/vp"), "test", "run"], project);
}

/** The directory `dependency` is installed at for this package or, failing that, the workspace. */
async function installed(packageRoot: string, dependency: string): Promise<Result<string, Error>> {
	let candidates = [
		join(packageRoot, "node_modules", dependency),
		join(packageRoot, "../../node_modules", dependency),
	];
	for (let candidate of candidates) {
		if (isSuccess(await wrap(() => access(join(candidate, "package.json"))))) {
			return success(candidate);
		}
	}
	return failure(
		new Error(`${dependency} is not installed in this workspace; add it to sdxc's devDependencies`),
	);
}

/** Runs a script with `args` in `cwd` under `runtime`, Node by default, collecting both output streams. */
function run(args: string[], cwd: string, runtime = process.execPath): Promise<Spawned> {
	return new Promise((settle) => {
		let output = "";
		let child = spawn(runtime, args, { cwd, shell: false });
		child.stdout.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});
		child.once("error", (error) => settle({ code: null, output: error.message }));
		child.once("close", (code) => settle({ code, output }));
	});
}
