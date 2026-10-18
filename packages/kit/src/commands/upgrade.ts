/**
 * The `sdxc upgrade` handler: moves every `@sdxc/*` package the project lists to another
 * release, `remix` following the peer it pins, installs, and hands off to that release's
 * `@sdxc/kit` for the prompt, so the prompt comes from the target's own changelog and registry.
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
import { resolveRelease, scopedPackageOf } from "../releases.js";
import { AGENTS_FILE, planAgentsFile, writeAgentsFile } from "../upgrade/agents.js";
import { entriesBetween } from "../upgrade/changelog.js";
import {
	bumpManifest,
	currentRelease,
	listedScopedPackages,
	lists,
	projectImports,
	readManifest,
} from "../upgrade/project.js";
import { buildPrompt } from "../upgrade/prompt.js";
import { fetchChangelog, fetchRelease, RELEASE_PACKAGE } from "../upgrade/registry.js";

/** The middleware `upgrade` runs behind. */
const UPGRADE_MIDDLEWARE = [project(), packageRoot()] as const;

/** The context `upgrade`'s handler receives. */
type UpgradeContext = HandlerContext<typeof SDXC_COMMANDS.upgrade, typeof UPGRADE_MIDDLEWARE>;

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
	middleware: UPGRADE_MIDDLEWARE,
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
		let scoped = listedScopedPackages(manifest);
		if (scoped.length === 0) {
			return failure(new Error("package.json lists no @sdxc/* package to upgrade"));
		}
		let current = currentRelease(manifest);
		if (current === null) {
			return failure(new Error("package.json pins no @sdxc/* package to an exact release"));
		}
		let found = await lookUp(ctx, ctx.arguments.version ?? null, current);
		if (isFailure(found)) return found;
		let { release, changelog } = found.data;
		let order = compare(release.version, current);
		if (order < 0) {
			return failure(
				new Error(
					`Release ${release.version} is older than the project's ${current}; upgrade only moves forward`,
				),
			);
		}
		if (order === 0) {
			ctx.stderr(`The @sdxc packages are up to date at ${current}\n`);
			return success();
		}
		let imports = await projectImports(root);
		if (changelog !== null) {
			let proceed = await confirmBreaking(ctx, changelog, current, release.version, imports);
			if (isFailure(proceed)) return proceed;
			if (!proceed.data) {
				ctx.stderr(`Kept the @sdxc packages at ${current}; package.json is unchanged\n`);
				return success();
			}
		}

		let pins = await ctx.task(
			`Resolving ${scoped.length} @sdxc packages at ${release.version}`,
			(task) => resolveRelease(scoped, release.version, task.signal),
		);
		if (isFailure(pins)) return pins;
		let versions: Record<string, string> = Object.fromEntries(pins.data);
		if (release.remix !== null && lists(manifest, "remix")) versions.remix = release.remix;
		let bumped = bumpManifest(text, versions);
		let written = await wrap(() => writeFile(resolve(root, "package.json"), bumped.text));
		if (isFailure(written)) return written;
		for (let bump of bumped.bumps) {
			ctx.stderr(`package.json: ${bump.name} ${bump.from} -> ${bump.to}\n`);
		}

		let manager = await packageManager({
			declared: manifest.packageManager,
			findLockFile: lockFileAtOrAbove(root),
		});
		let remixFrom = bumped.bumps.find((bump) => bump.name === "remix")?.from ?? null;
		let promptCommand = [
			...manager.dlx,
			`${RELEASE_PACKAGE}@${release.version}`,
			"upgrade",
			"--prompt",
			"--from",
			current,
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

/**
 * Rewrites the sdxc section of the project's `AGENTS.md` from this kit's release, then prints
 * the prompt for that release, or writes it to `output`.
 */
async function printPrompt(
	ctx: UpgradeContext,
	from: string,
	output: string | null,
): Promise<Result<undefined, Error>> {
	let agents = await planAgentsFile(ctx.project.root, ctx.packageRoot);
	if (isFailure(agents)) return agents;
	let prompt = await buildPrompt({
		root: ctx.project.root,
		packageRoot: ctx.packageRoot,
		from,
		remixFrom: ctx.flags.remixFrom ?? null,
		...(agents.data === null ? {} : { agents: agents.data.status }),
	});
	if (isFailure(prompt)) return prompt;
	if (agents.data !== null) {
		let refreshed = await writeAgentsFile(ctx.project.root, agents.data);
		if (isFailure(refreshed)) return refreshed;
		if (agents.data.status === "refreshed") {
			ctx.stderr(`${AGENTS_FILE}: refreshed the sdxc section\n`);
		}
	}
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
		`Looking up release ${version ?? "latest"}`,
		async (task): Promise<Result<Target, Error>> => {
			let release = await fetchRelease(version, task.signal);
			if (isFailure(release)) return release;
			task.update(`Found release ${release.data.version}`);
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
	let imported = new Set<string>();
	for (let specifier of imports.keys()) {
		let name = scopedPackageOf(specifier);
		if (name !== null) imported.add(name);
	}
	let breaking = entriesBetween(changelog, from, to).filter(
		(entry) => entry.breaking && imported.has(entry.package),
	);
	if (breaking.length === 0) return success(true);
	let count = breaking.length === 1 ? "1 breaking change" : `${breaking.length} breaking changes`;
	ctx.stderr(`Release ${to} brings ${count} to packages this project imports:\n`);
	for (let entry of breaking) {
		ctx.stderr(`  ${entry.release} ${entry.package}: ${entry.title}\n`);
	}
	return ctx.prompt.confirm({
		message: `Upgrade to release ${to}?`,
		default: true,
		name: "breaking",
	});
}
