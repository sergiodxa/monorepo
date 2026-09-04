#!/usr/bin/env bun
/**
 * Daily release entry point: finds the public packages that changed since the latest release
 * tag, builds them and every public dependent into a staging directory, publishes them under
 * today's dated version and creates the matching GitHub Release. Without `--publish` the same
 * path runs as a dry run, so a local run shows exactly what CI is about to do.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import type { Result } from "@sdxc/result";

import { failure, isFailure, match, success, wrap } from "@sdxc/result";

import type { Published, ReleasePlan } from "./plan.js";
import type { Package } from "./workspace.js";

import { buildPackage, createStagingRoot } from "./build.js";
import { attributeCommits, parseCommits, touchedPackages } from "./commits.js";
import {
	changedFiles,
	commitLog,
	fetchTags,
	hasCommit,
	headSha,
	latestReleaseTag,
	tagExists,
	tagSha,
} from "./git.js";
import { createRelease } from "./github.js";
import { publishManifest } from "./manifest.js";
import { renderNotes } from "./notes.js";
import { publish, viewPackages } from "./npm.js";
import { dependencyPins, isNew, planRelease, releaseVersion } from "./plan.js";
import {
	REPOSITORY_PAGE,
	REPOSITORY_URL,
	REPO_ROOT,
	TRUSTED_PUBLISHER,
	formatPrivateDependency,
	privateDependencies,
	readPackages,
} from "./workspace.js";

/**
 * One release run from planning to the GitHub Release, returning early with a plain message
 * whenever there is nothing to do. Every failure comes back as the `Result`, and the entry
 * point turns it into exit 1 with the message on stderr.
 */
async function main(): Promise<Result<void, Error>> {
	let args = wrap(() =>
		parseArgs({
			options: {
				publish: { type: "boolean", default: false },
				force: { type: "boolean", default: false },
			},
		}),
	);
	if (isFailure(args)) return args;
	let publishing = args.data.values.publish === true;
	let force = args.data.values.force === true;

	await fetchTags();
	let today = releaseVersion(new Date());
	let tag = `v${today}`;
	if (await tagExists(tag)) {
		say(`Released ${tag} already today; later commits ship tomorrow.`);
		return success(undefined);
	}

	let workspace = await readPackages(REPO_ROOT);
	if (isFailure(workspace)) return workspace;
	let packages = workspace.data;
	let publicPackages = packages.filter((pkg) => !pkg.isPrivate);
	let publicTree = assertPublicTree(publicPackages, packages);
	if (isFailure(publicTree)) return publicTree;

	let previous = await latestReleaseTag();
	if (isFailure(previous)) return previous;
	let previousTag = previous.data;
	let sha = await headSha();
	if (isFailure(sha)) return sha;
	let head = sha.data;
	let registry = await viewPackages(publicPackages.map((pkg) => pkg.name));
	if (isFailure(registry)) return registry;
	let published = registry.data;
	let anyNew = publicPackages.some((pkg) => isNew(published.get(pkg.name)?.version ?? null));
	if (previousTag !== null && !anyNew && !force) {
		let previousSha = await tagSha(previousTag);
		if (isFailure(previousSha)) return previousSha;
		if (previousSha.data === head) {
			say(`No commits since ${previousTag}; nothing to release.`);
			return success(undefined);
		}
	}

	let log = previousTag === null ? success("") : await commitLog(`${previousTag}..HEAD`);
	if (isFailure(log)) return log;
	let commits = parseCommits(log.data);
	if (isFailure(commits)) return commits;
	let commitsByPackage = attributeCommits(commits.data, packages);
	let planned = planRelease({
		packages,
		touched: new Set(commitsByPackage.keys()),
		published,
		force,
		version: today,
	});
	if (isFailure(planned)) return planned;
	let plan = planned.data;
	if (plan.members.length === 0) {
		say(
			`Nothing to release: no public package changed since ${previousTag ?? "the first commit"}.`,
		);
		return success(undefined);
	}

	let skipped = await alreadyPublishedToday(plan, packages, published, today);
	if (isFailure(skipped)) return skipped;
	let bootstrapped = assertBootstrapped(plan, published);
	if (isFailure(bootstrapped)) return bootstrapped;
	say(
		`Release ${today} (${publishing ? "publishing" : "dry run"}); previous release: ${previousTag ?? "none"}\n`,
	);
	let table = planTable(plan, packages, published, skipped.data);
	if (isFailure(table)) return table;
	say(table.data);

	let stagingRoot = await createStagingRoot();
	if (isFailure(stagingRoot)) return stagingRoot;
	let staged = new Map<string, string>();
	for (let name of plan.order) {
		if (skipped.data.has(name)) continue;
		let found = packageNamed(packages, name);
		if (isFailure(found)) return found;
		let pkg = found.data;
		let pins = dependencyPins(pkg, plan.order, today, published);
		if (isFailure(pins)) return pins;
		let manifest = publishManifest(pkg, {
			version: today,
			pins: pins.data,
			gitHead: head,
			repository: { url: REPOSITORY_URL, directory: `packages/${pkg.dir}` },
		});
		if (isFailure(manifest)) return manifest;
		let stagingDir = join(stagingRoot.data, pkg.dir);
		say(`\nBuilding ${name}@${today} into ${stagingDir}`);
		let built = await buildPackage(pkg, REPO_ROOT, stagingDir, manifest.data);
		if (isFailure(built)) return built;
		staged.set(name, stagingDir);
	}
	for (let [name, stagingDir] of staged) {
		say(`\n${publishing ? "Publishing" : "Dry-run publishing"} ${name}@${today}`);
		let uploaded = await publish(stagingDir, { dryRun: !publishing });
		if (isFailure(uploaded)) return uploaded;
	}

	let notes = renderNotes({
		version: today,
		previousTag,
		members: plan.members,
		commitsByPackage,
		packages,
		repoUrl: REPOSITORY_PAGE,
	});
	if (!publishing) {
		say(`\nRelease notes for ${tag} (dry run, nothing was published):\n\n${notes}`);
		return success(undefined);
	}
	let notesFile = join(stagingRoot.data, "release-notes.md");
	let written = await wrap(() => writeFile(notesFile, notes));
	if (isFailure(written)) return written;
	let release = await createRelease({ tag, target: head, title: today, notesFile });
	if (isFailure(release)) return release;
	say(`\nCreated ${tag}: ${release.data}`);
	return success(undefined);
}

/** Fails naming every private package a public one reaches, since npm could never install it. */
function assertPublicTree(publicPackages: Package[], packages: Package[]): Result<void, Error> {
	let offences = publicPackages
		.flatMap((pkg) => privateDependencies(pkg, packages))
		.map((row) => formatPrivateDependency(row));
	if (offences.length > 0) {
		return failure(new Error(`Public packages depend on private ones:\n${offences.join("\n")}`));
	}
	return success(undefined);
}

/**
 * Members npm already has at today's version, after a partial run: skipped when their shipped
 * inputs are unchanged since that publish, a conflict otherwise, because the version is taken
 * and a day has only one. Any conflict fails the run before anything is built.
 */
async function alreadyPublishedToday(
	plan: ReleasePlan,
	packages: Package[],
	published: Map<string, Published | null>,
	today: string,
): Promise<Result<Set<string>, Error>> {
	let skipped = new Set<string>();
	let conflicts: string[] = [];
	for (let member of plan.members) {
		let current = published.get(member.name);
		if (current === undefined || current === null || current.version !== today) continue;
		let unchanged = await unchangedSince(current.gitHead, member.name, packages);
		if (isFailure(unchanged)) return unchanged;
		if (unchanged.data) {
			skipped.add(member.name);
		} else {
			conflicts.push(`${member.name} changed after being published as ${today}; rerun tomorrow`);
		}
	}
	if (conflicts.length > 0) return failure(new Error(conflicts.join("\n")));
	return success(skipped);
}

/** Whether nothing the package ships changed between the commit npm recorded and HEAD. */
async function unchangedSince(
	gitHead: string | null,
	name: string,
	packages: Package[],
): Promise<Result<boolean, Error>> {
	if (gitHead === null || !(await hasCommit(gitHead))) return success(false);
	let changed = await changedFiles(gitHead);
	if (isFailure(changed)) return changed;
	return success(!touchedPackages(changed.data, packages).has(name));
}

/**
 * In CI a package npm has never seen fails before anything is built: its first version has
 * to come from a developer's own session so the trusted publisher can be configured after it.
 */
function assertBootstrapped(
	plan: ReleasePlan,
	published: Map<string, Published | null>,
): Result<void, Error> {
	if (process.env.GITHUB_ACTIONS !== "true") return success(undefined);
	let missing = plan.members
		.filter((member) => (published.get(member.name) ?? null) === null)
		.map(
			(member) =>
				`${member.name} has never been published; run \`bun run release:bootstrap ${member.name}\` locally, then configure its trusted publisher (${TRUSTED_PUBLISHER}).`,
		);
	if (missing.length > 0) return failure(new Error(missing.join("\n")));
	return success(undefined);
}

/** The plan as the operator reads it: one row per member with its reason, version and pins. */
function planTable(
	plan: ReleasePlan,
	packages: Package[],
	published: Map<string, Published | null>,
	skipped: Set<string>,
): Result<string, Error> {
	let rows = [["package", "reason", "version", "pins"]];
	for (let member of plan.members) {
		let pkg = packageNamed(packages, member.name);
		if (isFailure(pkg)) return pkg;
		let pins = dependencyPins(pkg.data, plan.order, plan.version, published);
		if (isFailure(pins)) return pins;
		let pinList = Object.entries(pins.data)
			.map(([dependency, version]) => `${dependency}@${version}`)
			.join(", ");
		let version = skipped.has(member.name) ? `${plan.version} (already published)` : plan.version;
		rows.push([member.name, member.reason, version, pinList]);
	}
	return success(formatTable(rows));
}

/** Columns padded to their widest cell and separated by two spaces, with no trailing padding. */
function formatTable(rows: string[][]): string {
	let widths = (rows[0] ?? []).map((_, column) =>
		Math.max(...rows.map((row) => (row[column] ?? "").length)),
	);
	return rows
		.map((row) =>
			row
				.map((cell, column) => cell.padEnd(widths[column] ?? 0))
				.join("  ")
				.trimEnd(),
		)
		.join("\n");
}

/** The package behind a plan member; a miss means the plan named something outside the workspace. */
function packageNamed(packages: Package[], name: string): Result<Package, Error> {
	let pkg = packages.find((candidate) => candidate.name === name);
	if (pkg === undefined) return failure(new Error(`${name} is not a workspace package`));
	return success(pkg);
}

/** Operator output goes to stdout, leaving stderr to npm's progress and the failure message. */
function say(text: string): void {
	process.stdout.write(`${text}\n`);
}

match(await main(), {
	success: () => {},
	failure: (error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	},
});
