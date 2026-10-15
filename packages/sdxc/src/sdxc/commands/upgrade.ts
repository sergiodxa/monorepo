/**
 * The `sdxc upgrade` handler: moves the project to another `sdxc` release, with `remix`
 * following the peer the release pins, installs it, and hands off to the newly installed
 * `sdxc` for the prompt, so the prompt comes from the target release's own code and changelog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { HandlerContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, success, usage } from "@sdxc/cli";
import { failure, isFailure, isSuccess, wrap } from "@sdxc/result";
import { compare } from "@sdxc/semver";

import type { ChangelogEntry } from "../upgrade/changelog.js";
import type { Release } from "../upgrade/registry.js";

import { SDXC_COMMANDS } from "../contract.js";
import { packageRoot, project } from "../middleware.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import { entriesBetween } from "../upgrade/changelog.js";
import {
	bumpManifest,
	installedVersion,
	listedScopedPackages,
	lists,
	projectImports,
	readManifest,
} from "../upgrade/project.js";
import { buildPrompt, packageOf } from "../upgrade/prompt.js";
import { fetchChangelog, fetchRelease } from "../upgrade/registry.js";

/** The context `upgrade`'s handler receives. */
type UpgradeContext = HandlerContext<
	typeof SDXC_COMMANDS.upgrade,
	readonly [ReturnType<typeof project>, ReturnType<typeof packageRoot>]
>;

/** The release a run moves to, and the changelog it ships when the CDN served it. */
interface Target {
	release: Release;
	changelog: ChangelogEntry[] | null;
}

/**
 * Exits 0 when done or already up to date, 1 when the upgrade failed or the target is older.
 * Progress goes to stderr; stdout carries only the prompt.
 */
export default createCommand(SDXC_COMMANDS.upgrade, {
	middleware: [project(), packageRoot()],
	/** Prints the prompt with `--prompt`, and otherwise bumps, installs and hands off. */
	async handler(ctx) {
		let output = ctx.flags.output === undefined ? null : resolve(ctx.cwd, ctx.flags.output);
		if (ctx.flags.prompt) {
			if (ctx.flags.from === undefined || ctx.arguments.version !== undefined) {
				return usage("sdxc upgrade --prompt takes --from <version> and no version");
			}
			return printPrompt(ctx, ctx.flags.from, output);
		}
		let root = ctx.project.root;
		let read = await readManifest(root);
		if (isFailure(read)) return read;
		let { manifest, text } = read.data;
		if (!lists(manifest, "sdxc")) return failure(new Error("package.json does not list sdxc"));
		let current = await installedVersion(root);
		if (isFailure(current)) return current;
		let found = await lookUp(ctx, ctx.arguments.version ?? null, current.data);
		if (isFailure(found)) return found;
		let { release, changelog } = found.data;
		let order = compare(release.version, current.data);
		if (order < 0) {
			return failure(
				new Error(
					`sdxc ${release.version} is older than the installed ${current.data}; upgrade only moves forward`,
				),
			);
		}
		if (order === 0) {
			ctx.stderr(`sdxc is up to date at ${current.data}\n`);
			return success();
		}
		let imports = await projectImports(root);
		if (changelog !== null) {
			let proceed = await confirmBreaking(ctx, changelog, current.data, release.version, imports);
			if (isFailure(proceed)) return proceed;
			if (!proceed.data) {
				ctx.stderr(`Kept sdxc at ${current.data}; package.json is unchanged\n`);
				return success();
			}
		}

		let versions: Record<string, string> = { sdxc: release.version };
		if (release.remix !== null && lists(manifest, "remix")) versions.remix = release.remix;
		let bumped = bumpManifest(text, versions);
		let written = await wrap(() => writeFile(resolve(root, "package.json"), bumped.text));
		if (isFailure(written)) return written;
		for (let bump of bumped.bumps) {
			ctx.stderr(`package.json: ${bump.name} ${bump.from} -> ${bump.to}\n`);
		}
		for (let name of listedScopedPackages(manifest)) {
			let files = [...imports]
				.filter(([specifier]) => specifier === name || specifier.startsWith(`${name}/`))
				.flatMap(([, importers]) => importers);
			let where = files.length > 0 ? `; imported by ${[...new Set(files)].sort().join(", ")}` : "";
			ctx.stderr(
				`${name} is listed beside sdxc, which does not support it: import ${name.replace("@sdxc/", "sdxc/")} instead and remove it${where}\n`,
			);
		}

		let manager = await packageManager({
			declared: manifest.packageManager,
			findLockFile: lockFileAtOrAbove(root),
		});
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
		if (!ctx.flags.install) {
			ctx.stderr(
				`Run \`${manager.install.join(" ")}\`, then \`${promptCommand.join(" ")}\` for the upgrade prompt.\n`,
			);
			return success();
		}
		let installed = await ctx.task(`Installing with ${manager.name}`, (task) =>
			ctx.exec(manager.install, { cwd: root, stdio: "stderr", signal: task.signal }),
		);
		if (isFailure(installed)) {
			return failure(
				new Error(
					`${installed.error.message}\nFix the install and run it again, then \`${promptCommand.join(" ")}\` for the upgrade prompt.`,
				),
			);
		}
		let prompted = await ctx.exec(promptCommand, { cwd: root, stdio: "inherit" });
		if (isFailure(prompted)) return prompted;
		return success();
	},
});

/** Prints the prompt for the installed `sdxc`, or writes it to `output`. */
async function printPrompt(
	ctx: UpgradeContext,
	from: string,
	output: string | null,
): Promise<Result<undefined, Error>> {
	let prompt = await buildPrompt({
		root: ctx.project.root,
		packageRoot: ctx.packageRoot,
		from,
		remixFrom: ctx.flags.remixFrom ?? null,
	});
	if (isFailure(prompt)) return prompt;
	if (output === null) {
		ctx.stdout(prompt.data);
		return success();
	}
	let text = prompt.data;
	let written = await wrap(() => writeFile(output, text));
	if (isFailure(written)) return written;
	ctx.stderr(`Wrote the upgrade prompt to ${output}\n`);
	return success();
}

/**
 * Finds the release `version` names on npm, and, when it is newer than `current`, the
 * changelog it ships. A changelog the CDN cannot serve is `null`, which skips the question
 * about breaking changes rather than the upgrade.
 */
async function lookUp(ctx: UpgradeContext, version: string | null, current: string) {
	return ctx.task(
		`Looking up sdxc@${version ?? "latest"}`,
		async (task): Promise<Result<Target, Error>> => {
			let release = await fetchRelease(version, task.signal);
			if (isFailure(release)) return release;
			task.update(`Found sdxc ${release.data.version}`);
			if (compare(release.data.version, current) <= 0) {
				return success({ release: release.data, changelog: null });
			}
			let changelog = await fetchChangelog(release.data.version, task.signal);
			return success({
				release: release.data,
				changelog: isSuccess(changelog) ? changelog.data : null,
			});
		},
	);
}

/**
 * Lists the breaking changes between `from` and `to` in packages the project imports and asks
 * whether to go on. Without a terminal the upgrade goes on; with none to list nothing is asked.
 *
 * @returns Whether to bump `package.json`
 */
async function confirmBreaking(
	ctx: UpgradeContext,
	changelog: readonly ChangelogEntry[],
	from: string,
	to: string,
	imports: ReadonlyMap<string, string[]>,
): Promise<Result<boolean, Error>> {
	let imported = new Set(["sdxc"]);
	for (let specifier of imports.keys()) imported.add(packageOf(specifier));
	let breaking = entriesBetween(changelog, from, to).filter(
		(entry) => entry.breaking && imported.has(entry.package),
	);
	if (breaking.length === 0) return success(true);
	let count = breaking.length === 1 ? "1 breaking change" : `${breaking.length} breaking changes`;
	ctx.stderr(`sdxc ${to} brings ${count} to packages this project imports:\n`);
	for (let entry of breaking) {
		ctx.stderr(`  ${entry.release} ${entry.package}: ${entry.title}\n`);
	}
	return ctx.prompt.confirm({
		message: `Upgrade to sdxc ${to}?`,
		default: true,
		name: "breaking",
	});
}
