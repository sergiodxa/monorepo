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

import type { Packument } from "../releases.js";
import type { ChangelogEntry } from "../upgrade/changelog.js";
import type { Manifest } from "../upgrade/project.js";
import type { Release } from "../upgrade/registry.js";

import { SDXC_COMMANDS } from "../contract.js";
import { packageRoot, project } from "../middleware.js";
import { lockFileAtOrAbove, packageManager } from "../package-manager.js";
import {
	datedPin,
	fetchPackuments,
	scopedPackageOf,
	versionAtRelease,
	versionsAt,
} from "../releases.js";
import { AGENTS_FILE, planAgentsFile, writeAgentsFile } from "../upgrade/agents.js";
import {
	bumpManifest,
	currentRelease,
	listedScopedPackages,
	lists,
	pinnedRelease,
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

/** The pins a run writes, and where each lagging package's changes start. */
interface Pins {
	/** Each listed `@sdxc/*` package's version at the target release, by name. */
	versions: Map<string, string>;
	/** The pinned release of each package behind its version at the project's release, by name. */
	since: Map<string, string>;
}

/**
 * Exits 0 when done or already up to date, 1 when the upgrade failed or the target is older.
 * A target equal to the project's release still re-pins what lags behind it, `remix` included,
 * so "up to date" means no pin moves. Progress goes to stderr; stdout carries only the prompt.
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
		let pins = await ctx.task(
			`Resolving ${scoped.length} @sdxc packages at ${release.version}`,
			async (task): Promise<Result<Pins, Error>> => {
				let packuments = await fetchPackuments(scoped, task.signal);
				if (isFailure(packuments)) return packuments;
				let versions = versionsAt(packuments.data, release.version);
				if (isFailure(versions)) return versions;
				return success({
					versions: versions.data,
					since: laggingSince(manifest, packuments.data, current),
				});
			},
		);
		if (isFailure(pins)) return pins;
		let { since } = pins.data;
		let versions: Record<string, string> = Object.fromEntries(pins.data.versions);
		if (release.remix !== null && lists(manifest, "remix")) versions.remix = release.remix;
		let bumped = bumpManifest(text, versions);
		if (bumped.bumps.length === 0) {
			ctx.stderr(`The @sdxc packages are up to date at ${release.version}\n`);
			return success();
		}
		if (changelog !== null) {
			let imports = await projectImports(root);
			let proceed = await confirmBreaking(ctx, changelog, {
				from: current,
				since,
				to: release.version,
				imports,
			});
			if (isFailure(proceed)) return proceed;
			if (!proceed.data) {
				ctx.stderr(`Kept the @sdxc packages at ${current}; package.json is unchanged\n`);
				return success();
			}
		}

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
			...[...since].flatMap(([name, pinned]) => ["--since", `${name}@${pinned}`]),
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
	let since = new Map<string, string>();
	for (let value of ctx.flags.since) {
		let at = value.lastIndexOf("@");
		let pinned = at > 0 ? datedPin(value.slice(at + 1)) : null;
		if (pinned === null) {
			return usage("--since takes <package>@<version>, such as @sdxc/jwt@2026.9.4");
		}
		since.set(value.slice(0, at), pinned);
	}
	let agents = await planAgentsFile(ctx.project.root, ctx.packageRoot);
	if (isFailure(agents)) return agents;
	let prompt = await buildPrompt({
		root: ctx.project.root,
		packageRoot: ctx.packageRoot,
		from,
		remixFrom: ctx.flags.remixFrom ?? null,
		since,
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
 * Finds the release `version` names on npm, and, unless it is older than `current`, the
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
			if (compare(release.data.version, current) < 0) {
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
 * The release each listed `@sdxc/*` package is pinned to when that pin is older than its version
 * at `current`, by name, so the prompt covers its changes from its own pin; a package at its
 * version, or pinned to no dated release, is left out and covered from `current`.
 */
function laggingSince(
	manifest: Manifest,
	packuments: readonly Packument[],
	current: string,
): Map<string, string> {
	let since = new Map<string, string>();
	for (let packument of packuments) {
		let pinned = pinnedRelease(manifest, packument.name);
		let expected = versionAtRelease(packument, current);
		if (pinned !== null && expected !== null && compare(pinned, expected) < 0) {
			since.set(packument.name, pinned);
		}
	}
	return since;
}

/**
 * Lists the breaking changes the move brings to packages the project imports, each package's
 * from its entry in `since` or else `from`, up to `to`, and asks whether to go on. Without a
 * terminal the upgrade goes on; with none to list nothing is asked.
 *
 * @returns Whether to bump `package.json`
 */
async function confirmBreaking(
	ctx: UpgradeContext,
	changelog: readonly ChangelogEntry[],
	range: {
		from: string;
		since: ReadonlyMap<string, string>;
		to: string;
		imports: ReadonlyMap<string, string[]>;
	},
): Promise<Result<boolean, Error>> {
	let imported = new Set<string>();
	for (let specifier of range.imports.keys()) {
		let name = scopedPackageOf(specifier);
		if (name !== null) imported.add(name);
	}
	let breaking = changelog.filter(
		(entry) =>
			entry.breaking &&
			imported.has(entry.package) &&
			compare(entry.release, range.since.get(entry.package) ?? range.from) > 0 &&
			compare(entry.release, range.to) <= 0,
	);
	if (breaking.length === 0) return success(true);
	let to = range.to;
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
