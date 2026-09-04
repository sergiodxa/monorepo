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
 * whenever there is nothing to do. Every failure throws, and the caller turns it into exit 1.
 */
async function main(): Promise<void> {
	let { values } = parseArgs({
		options: {
			publish: { type: "boolean", default: false },
			force: { type: "boolean", default: false },
		},
	});
	let publishing = values.publish === true;
	let force = values.force === true;

	await fetchTags();
	let today = releaseVersion(new Date());
	let tag = `v${today}`;
	if (await tagExists(tag)) {
		say(`Released ${tag} already today; later commits ship tomorrow.`);
		return;
	}

	let packages = await readPackages(REPO_ROOT);
	let publicPackages = packages.filter((pkg) => !pkg.isPrivate);
	assertPublicTree(publicPackages, packages);

	let previousTag = await latestReleaseTag();
	let head = await headSha();
	let published = await viewPackages(publicPackages.map((pkg) => pkg.name));
	let anyNew = publicPackages.some((pkg) => isNew(published.get(pkg.name)?.version ?? null));
	if (previousTag !== null && !anyNew && !force && (await tagSha(previousTag)) === head) {
		say(`No commits since ${previousTag}; nothing to release.`);
		return;
	}

	let commits = previousTag === null ? [] : parseCommits(await commitLog(`${previousTag}..HEAD`));
	let commitsByPackage = attributeCommits(commits, packages);
	let plan = planRelease({
		packages,
		touched: new Set(commitsByPackage.keys()),
		published,
		force,
		version: today,
	});
	if (plan.members.length === 0) {
		say(
			`Nothing to release: no public package changed since ${previousTag ?? "the first commit"}.`,
		);
		return;
	}

	let skipped = await alreadyPublishedToday(plan, packages, published, today);
	assertBootstrapped(plan, published);
	say(
		`Release ${today} (${publishing ? "publishing" : "dry run"}); previous release: ${previousTag ?? "none"}\n`,
	);
	say(planTable(plan, packages, published, skipped));

	let stagingRoot = await createStagingRoot();
	let staged = new Map<string, string>();
	for (let name of plan.order) {
		if (skipped.has(name)) continue;
		let pkg = packageNamed(packages, name);
		let manifest = publishManifest(pkg, {
			version: today,
			pins: dependencyPins(pkg, plan.order, today, published),
			gitHead: head,
			repository: { url: REPOSITORY_URL, directory: `packages/${pkg.dir}` },
		});
		let stagingDir = join(stagingRoot, pkg.dir);
		say(`\nBuilding ${name}@${today} into ${stagingDir}`);
		await buildPackage(pkg, REPO_ROOT, stagingDir, manifest);
		staged.set(name, stagingDir);
	}
	for (let [name, stagingDir] of staged) {
		say(`\n${publishing ? "Publishing" : "Dry-run publishing"} ${name}@${today}`);
		await publish(stagingDir, { dryRun: !publishing });
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
		return;
	}
	let notesFile = join(stagingRoot, "release-notes.md");
	await writeFile(notesFile, notes);
	let release = await createRelease({ tag, target: head, title: today, notesFile });
	say(`\nCreated ${tag}: ${release}`);
}

/** Fails naming every private package a public one reaches, since npm could never install it. */
function assertPublicTree(publicPackages: Package[], packages: Package[]): void {
	let offences = publicPackages
		.flatMap((pkg) => privateDependencies(pkg, packages))
		.map((row) => formatPrivateDependency(row));
	if (offences.length > 0) {
		throw new Error(`Public packages depend on private ones:\n${offences.join("\n")}`);
	}
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
): Promise<Set<string>> {
	let skipped = new Set<string>();
	let conflicts: string[] = [];
	for (let member of plan.members) {
		let current = published.get(member.name);
		if (current === undefined || current === null || current.version !== today) continue;
		if (await unchangedSince(current.gitHead, member.name, packages)) {
			skipped.add(member.name);
		} else {
			conflicts.push(`${member.name} changed after being published as ${today}; rerun tomorrow`);
		}
	}
	if (conflicts.length > 0) throw new Error(conflicts.join("\n"));
	return skipped;
}

/** Whether nothing the package ships changed between the commit npm recorded and HEAD. */
async function unchangedSince(
	gitHead: string | null,
	name: string,
	packages: Package[],
): Promise<boolean> {
	if (gitHead === null || !(await hasCommit(gitHead))) return false;
	return !touchedPackages(await changedFiles(gitHead), packages).has(name);
}

/**
 * In CI a package npm has never seen fails before anything is built: its first version has
 * to come from a developer's own session so the trusted publisher can be configured after it.
 */
function assertBootstrapped(plan: ReleasePlan, published: Map<string, Published | null>): void {
	if (process.env.GITHUB_ACTIONS !== "true") return;
	let missing = plan.members
		.filter((member) => (published.get(member.name) ?? null) === null)
		.map(
			(member) =>
				`${member.name} has never been published; run \`bun run release:bootstrap ${member.name}\` locally, then configure its trusted publisher (${TRUSTED_PUBLISHER}).`,
		);
	if (missing.length > 0) throw new Error(missing.join("\n"));
}

/** The plan as the operator reads it: one row per member with its reason, version and pins. */
function planTable(
	plan: ReleasePlan,
	packages: Package[],
	published: Map<string, Published | null>,
	skipped: Set<string>,
): string {
	let rows = [["package", "reason", "version", "pins"]];
	for (let member of plan.members) {
		let pkg = packageNamed(packages, member.name);
		let pins = Object.entries(dependencyPins(pkg, plan.order, plan.version, published))
			.map(([dependency, version]) => `${dependency}@${version}`)
			.join(", ");
		let version = skipped.has(member.name) ? `${plan.version} (already published)` : plan.version;
		rows.push([member.name, member.reason, version, pins]);
	}
	return formatTable(rows);
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
function packageNamed(packages: Package[], name: string): Package {
	let pkg = packages.find((candidate) => candidate.name === name);
	if (pkg === undefined) throw new Error(`${name} is not a workspace package`);
	return pkg;
}

/** Operator output goes to stdout, leaving stderr to npm's progress and the failure message. */
function say(text: string): void {
	process.stdout.write(`${text}\n`);
}

try {
	await main();
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
}
