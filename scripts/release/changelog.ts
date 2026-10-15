/**
 * `changelog.jsonl`, the release history `sdxc upgrade` reads from the `@sdxc/kit` tarball:
 * one line per commit, per package, per release, from the same commit parsing as the GitHub
 * Release notes, with corrections folded into the notes they replace and a twelve-month window.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import * as JSONL from "@sdxc/jsonl";
import { isFailure, success, wrap } from "@sdxc/result";

import type { Commit } from "./commits.js";
import type { Package } from "./workspace.js";

import { run } from "./command.js";
import { attributeCommits, attributeCorrections, parseCommits } from "./commits.js";
import { commitFiles, commitLog } from "./git.js";
import { HISTORY_PACKAGE } from "./plan.js";
import { REPO_ROOT } from "./workspace.js";

/** The package whose tarball carries the changelog, beside the CLI that reads it. */
export const CHANGELOG_PACKAGE = HISTORY_PACKAGE;

/** The file name inside the staged package, at its root. */
export const CHANGELOG_FILE = "changelog.jsonl";

/** A release tag, `v` plus the dated version. */
const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

/** One line of `changelog.jsonl`; keys are written in this order. */
export interface ChangelogEntry {
	/** The dated version that shipped the commit, `2026.10.14`. */
	release: string;
	/** The npm name of a public package the commit touched. */
	package: string;
	type: string;
	breaking: boolean;
	title: string;
	/** The release note, already replaced by its latest `Release-Note-For` correction. */
	body: string;
}

/** The commits one release shipped, each already attributed to its public packages. */
export interface ReleaseCommits {
	version: string;
	commitsByPackage: Map<string, Commit[]>;
}

/**
 * The changelog for the release `built`: every entry from releases in the twelve months before
 * it, and only the breaking entries from older ones. A correction contributes no line of its
 * own when the commit it names is in `releases`; that commit's lines carry its body instead.
 */
export function buildChangelog(releases: ReleaseCommits[], built: string): ChangelogEntry[] {
	let shas = releases.flatMap((release) =>
		[...release.commitsByPackage.values()].flat().map((commit) => commit.sha),
	);
	let corrections = new Map<string, string>();
	for (let release of releases) {
		for (let commit of [...release.commitsByPackage.values()].flat()) {
			if (commit.corrects === null) continue;
			let target = shas.find((sha) => sha.startsWith(commit.corrects ?? ""));
			if (target !== undefined) corrections.set(target, commit.body);
		}
	}
	let cutoff = oneYearBefore(built);
	let entries: ChangelogEntry[] = [];
	for (let release of [...releases].sort((a, b) => compareReleases(a.version, b.version))) {
		let recent = releaseDate(release.version) >= cutoff;
		for (let name of [...release.commitsByPackage.keys()].sort()) {
			for (let commit of release.commitsByPackage.get(name) ?? []) {
				let target = commit.corrects;
				if (target !== null && shas.some((sha) => sha.startsWith(target))) continue;
				if (!recent && !commit.breaking) continue;
				entries.push({
					release: release.version,
					package: name,
					type: commit.type,
					breaking: commit.breaking,
					title: commit.title,
					body: corrections.get(commit.sha) ?? commit.body,
				});
			}
		}
	}
	return entries;
}

/**
 * Writes `changelog.jsonl` into the staged `@sdxc/kit` package for the release `version`: the
 * history of every earlier release tag, read from git, plus `current`, the commits this run
 * ships. The first release tag shipped no commits, as its GitHub Release did.
 */
export async function writeChangelog(
	stagingDir: string,
	options: { version: string; current: Commit[]; packages: Package[] },
): Promise<Result<void, Error>> {
	let history = await releaseHistory(options.packages);
	if (isFailure(history)) return history;
	let releases = [
		...history.data,
		{
			version: options.version,
			commitsByPackage: publicOnly(attributeCommits(options.current, options.packages), options),
		},
	];
	let text = JSONL.stringify(buildChangelog(releases, options.version));
	if (isFailure(text)) return text;
	let content = text.data;
	return wrap(() => writeFile(join(stagingDir, CHANGELOG_FILE), content));
}

/** Every tagged release after the first, with its commits attributed and corrections resolved. */
async function releaseHistory(packages: Package[]): Promise<Result<ReleaseCommits[], Error>> {
	let tags = await releaseTags();
	if (isFailure(tags)) return tags;
	let releases: ReleaseCommits[] = [];
	for (let index = 1; index < tags.data.length; index += 1) {
		let tag = tags.data[index] ?? "";
		let log = await commitLog(`${tags.data[index - 1]}..${tag}`);
		if (isFailure(log)) return log;
		let parsed = parseCommits(log.data);
		if (isFailure(parsed)) return parsed;
		let commits = await attributeCorrections(parsed.data, commitFiles);
		if (isFailure(commits)) return commits;
		releases.push({
			version: tag.slice(1),
			commitsByPackage: publicOnly(attributeCommits(commits.data, packages), { packages }),
		});
	}
	return success(releases);
}

/** The release tags in this clone, oldest first. */
async function releaseTags(): Promise<Result<string[], Error>> {
	let output = await run("git", ["tag", "--list", "v*"], { cwd: REPO_ROOT });
	if (isFailure(output)) return output;
	return success(
		output.data.stdout
			.split("\n")
			.map((line) => line.trim())
			.filter((tag) => RELEASE_TAG.test(tag))
			.sort((a, b) => compareReleases(a.slice(1), b.slice(1))),
	);
}

/** Commits by package without the private packages, which never reach a consumer. */
function publicOnly(
	byPackage: Map<string, Commit[]>,
	options: { packages: Package[] },
): Map<string, Commit[]> {
	let names = new Set(options.packages.filter((pkg) => !pkg.isPrivate).map((pkg) => pkg.name));
	return new Map([...byPackage].filter(([name]) => names.has(name)));
}

/** A dated version as the UTC midnight it names. */
function releaseDate(version: string): number {
	let [year = 0, month = 1, day = 1] = version.split(".").map(Number);
	return Date.UTC(year, month - 1, day);
}

/** The same calendar day a year before the release `version`. */
function oneYearBefore(version: string): number {
	let [year = 0, month = 1, day = 1] = version.split(".").map(Number);
	return Date.UTC(year - 1, month - 1, day);
}

function compareReleases(a: string, b: string): number {
	return releaseDate(a) - releaseDate(b);
}
