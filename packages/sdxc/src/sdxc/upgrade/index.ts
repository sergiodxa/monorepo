/**
 * `sdxc upgrade`: moves the project to another `sdxc` release, with `remix` following the peer
 * the release pins, installs it, and hands off to the newly installed `sdxc` for the prompt, so
 * the prompt comes from the target release's own code and changelog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import { compare } from "@sdxc/semver";

import type { CommandIO } from "../run.js";

import { findProjectRoot } from "../project.js";

import {
	bumpManifest,
	detectPackageManager,
	installedVersion,
	listedScopedPackages,
	lists,
	projectImports,
	readManifest,
} from "./project.js";
import { buildPrompt } from "./prompt.js";
import { fetchRelease } from "./registry.js";

/** What `sdxc upgrade --help` and its usage errors print. */
export const UPGRADE_USAGE = [
	"Usage: sdxc upgrade [version] [options]",
	"",
	"Moves the project to the sdxc release `version` (the latest when omitted), with remix",
	"following it, installs it, and prints the prompt an AI agent follows to update the code.",
	"",
	"Options:",
	"  --no-install            Change package.json only; print the commands to run next",
	"  --output <file>         Write the prompt to a file instead of stdout",
	"  --prompt                Print the prompt for the installed sdxc only; needs --from",
	"  --from <version>        The sdxc release the project moved from, with --prompt",
	"  --remix-from <version>  The remix version the project moved from, with --prompt",
	"  -h, --help              Show this message",
	"",
].join("\n");

/**
 * Runs a command in the project. `stdout` says where the child's standard output goes: the
 * command's own stdout for the prompt, stderr for an install, so a piped prompt stays clean.
 */
export type Exec = (
	command: readonly string[],
	options: { cwd: string; stdout: "stdout" | "stderr" },
) => Promise<Result<void, Error>>;

/** What a caller other than the binary supplies; the binary uses the defaults. */
export interface UpgradeOptions {
	/**
	 * The directory of the `sdxc` package the command runs from, which holds the changelog and
	 * the component registry.
	 * @default the package this module is installed in
	 */
	packageRoot?: string;
	/**
	 * Runs the install and the target release's prompt.
	 * @default spawning the command with the terminal attached
	 */
	exec?: Exec;
}

/**
 * Runs `sdxc upgrade` with the arguments after the command name and answers its exit code:
 * 0 done or already up to date, 1 the upgrade failed or the target is older, 2 a usage error.
 * Progress goes to stderr; stdout carries only the prompt.
 */
export async function upgrade(
	argv: readonly string[],
	io: CommandIO,
	options: UpgradeOptions = {},
): Promise<number> {
	let args = wrap(() =>
		parseArgs({
			args: [...argv],
			allowPositionals: true,
			options: {
				"no-install": { type: "boolean", default: false },
				output: { type: "string" },
				prompt: { type: "boolean", default: false },
				from: { type: "string" },
				"remix-from": { type: "string" },
				help: { type: "boolean", short: "h", default: false },
			},
		}),
	);
	if (isFailure(args)) {
		io.stderr(`${args.error.message}\n\n${UPGRADE_USAGE}`);
		return 2;
	}
	let { values, positionals } = args.data;
	if (values.help === true) {
		io.stdout(UPGRADE_USAGE);
		return 0;
	}
	if (positionals.length > 1) {
		io.stderr(`sdxc upgrade takes at most one version\n\n${UPGRADE_USAGE}`);
		return 2;
	}
	let output = values.output === undefined ? null : resolve(io.cwd, values.output);
	let root = await findProjectRoot(io.cwd);
	if (isFailure(root)) return fail(io, root.error);
	let packageRoot = options.packageRoot ?? fileURLToPath(new URL("../../../", import.meta.url));

	if (values.prompt === true) {
		if (values.from === undefined || positionals.length > 0) {
			io.stderr(`sdxc upgrade --prompt takes --from <version> and no version\n\n${UPGRADE_USAGE}`);
			return 2;
		}
		let prompt = await buildPrompt({
			root: root.data,
			packageRoot,
			from: values.from,
			remixFrom: values["remix-from"] ?? null,
		});
		if (isFailure(prompt)) return fail(io, prompt.error);
		if (output === null) {
			io.stdout(prompt.data);
			return 0;
		}
		let text = prompt.data;
		let written = await wrap(() => writeFile(output, text));
		if (isFailure(written)) return fail(io, written.error);
		io.stderr(`Wrote the upgrade prompt to ${output}\n`);
		return 0;
	}

	let project = await readManifest(root.data);
	if (isFailure(project)) return fail(io, project.error);
	let { manifest, text } = project.data;
	if (!lists(manifest, "sdxc")) return fail(io, new Error("package.json does not list sdxc"));
	let current = await installedVersion(root.data);
	if (isFailure(current)) return fail(io, current.error);
	let release = await fetchRelease(positionals[0] ?? null);
	if (isFailure(release)) return fail(io, release.error);
	let target = release.data;
	let order = compare(target.version, current.data);
	if (order < 0) {
		return fail(
			io,
			new Error(
				`sdxc ${target.version} is older than the installed ${current.data}; upgrade only moves forward`,
			),
		);
	}
	if (order === 0) {
		io.stderr(`sdxc is up to date at ${current.data}\n`);
		return 0;
	}

	let versions: Record<string, string> = { sdxc: target.version };
	if (target.remix !== null && lists(manifest, "remix")) versions.remix = target.remix;
	let bumped = bumpManifest(text, versions);
	let written = await wrap(() => writeFile(resolve(root.data, "package.json"), bumped.text));
	if (isFailure(written)) return fail(io, written.error);
	for (let bump of bumped.bumps) {
		io.stderr(`package.json: ${bump.name} ${bump.from} -> ${bump.to}\n`);
	}
	let scoped = listedScopedPackages(manifest);
	if (scoped.length > 0) {
		let imports = await projectImports(root.data);
		for (let name of scoped) {
			let files = [...imports]
				.filter(([specifier]) => specifier === name || specifier.startsWith(`${name}/`))
				.flatMap(([, importers]) => importers);
			let where = files.length > 0 ? `; imported by ${[...new Set(files)].sort().join(", ")}` : "";
			io.stderr(
				`${name} is listed beside sdxc, which does not support it: import ${name.replace("@sdxc/", "sdxc/")} instead and remove it${where}\n`,
			);
		}
	}

	let manager = await detectPackageManager(root.data, manifest);
	let remixFrom = bumped.bumps.find((bump) => bump.name === "remix")?.from ?? null;
	let promptCommand = [
		...manager.exec,
		"upgrade",
		"--prompt",
		"--from",
		current.data,
		...(remixFrom === null ? [] : ["--remix-from", remixFrom]),
		...(output === null ? [] : ["--output", output]),
	];
	if (values["no-install"] === true) {
		io.stderr(
			`Run \`${manager.install.join(" ")}\`, then \`${promptCommand.join(" ")}\` for the upgrade prompt.\n`,
		);
		return 0;
	}
	let exec = options.exec ?? spawnCommand;
	let installed = await exec(manager.install, { cwd: root.data, stdout: "stderr" });
	if (isFailure(installed)) {
		return fail(
			io,
			new Error(
				`${installed.error.message}\nFix the install and run it again, then \`${promptCommand.join(" ")}\` for the upgrade prompt.`,
			),
		);
	}
	let prompted = await exec(promptCommand, { cwd: root.data, stdout: "stdout" });
	if (isFailure(prompted)) return fail(io, prompted.error);
	return 0;
}

/** Spawns the command without a shell, stdin and stderr attached to the terminal. */
function spawnCommand(
	command: readonly string[],
	options: { cwd: string; stdout: "stdout" | "stderr" },
): Promise<Result<void, Error>> {
	let [program, ...args] = command;
	if (program === undefined) return Promise.resolve(failure(new Error("Empty command")));
	let display = command.join(" ");
	return new Promise((settle) => {
		let child = spawn(program, args, {
			cwd: options.cwd,
			stdio: ["inherit", options.stdout === "stdout" ? "inherit" : 2, "inherit"],
			shell: false,
		});
		child.once("error", (error) => {
			settle(failure(new Error(`\`${display}\` could not start: ${error.message}`)));
		});
		child.once("close", (code, signal) => {
			if (code === 0) settle(success(undefined));
			else
				settle(
					failure(
						new Error(
							`\`${display}\` ${code === null ? `was stopped by ${signal ?? "a signal"}` : `exited with ${code}`}`,
						),
					),
				);
		});
	});
}

function fail(io: CommandIO, error: Error): number {
	io.stderr(`${error.message}\n`);
	return 1;
}
