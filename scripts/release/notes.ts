/**
 * Release notes rendered from the commits a release ships, one section per package, so the
 * GitHub Release reads as a per-package list of titles that link to the commit holding each
 * full note.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Commit } from "./commits.js";
import type { Member } from "./plan.js";
import type { DependencyNode } from "./workspace.js";

import { releaseSummary } from "./commits.js";

/** The most characters GitHub accepts in a release body; a longer one fails with HTTP 422. */
export const RELEASE_BODY_LIMIT = 125_000;

export interface NotesInput {
	version: string;
	previousTag: string | null;
	members: Member[];
	commitsByPackage: Map<string, Commit[]>;
	packages: DependencyNode[];
	repoUrl: string;
	/** @default RELEASE_BODY_LIMIT */
	maxLength?: number;
}

/**
 * Markdown for the GitHub Release: packages alphabetical, breaking commits first and each group
 * oldest first, as `- Summary ([sha](…/commit/sha))` (`- **Breaking:** Summary ([sha](…))`), one
 * line explaining a package that ships without commits, and a compare link to the previous tag.
 * The commit body stays on the commit and in `changelog.jsonl` for `sdxc upgrade`. Fails when the
 * body would still exceed GitHub's limit, naming the size so the run stops before `gh` returns 422.
 */
export function renderNotes(input: NotesInput): Result<string, Error> {
	let memberNames = new Set(input.members.map((member) => member.name));
	let members = [...input.members].sort((a, b) => compareNames(a.name, b.name));
	let sections = members.map((member) =>
		renderSection(
			member,
			input.commitsByPackage.get(member.name) ?? [],
			memberNames,
			input.packages,
			input.repoUrl,
		),
	);
	let footer =
		input.previousTag === null
			? []
			: [`Compare: ${input.repoUrl}/compare/${input.previousTag}...v${input.version}`];
	let notes = `${[...sections, ...footer].join("\n\n")}\n`;
	let maxLength = input.maxLength ?? RELEASE_BODY_LIMIT;
	if (notes.length > maxLength) {
		return failure(
			new Error(
				`Release notes are ${notes.length} characters; GitHub accepts at most ${maxLength}.`,
			),
		);
	}
	return success(notes);
}

/**
 * A package's section: each commit as its summary linked to the commit on that repository, so
 * the release page stays a scan of what changed and the full note is one click away.
 */
function renderSection(
	member: Member,
	commits: Commit[],
	memberNames: Set<string>,
	packages: DependencyNode[],
	repoUrl: string,
): string {
	let lines = [`## ${member.name}`];
	if (commits.length > 0) {
		let ordered = [
			...commits.filter((commit) => commit.breaking),
			...commits.filter((commit) => !commit.breaking),
		];
		for (let commit of ordered) lines.push(renderLinkedTitle(commit, repoUrl));
	} else if (member.reason === "new") {
		lines.push("First release.");
	} else if (member.reason === "dependency") {
		lines.push(republishedBecause(member.name, memberNames, packages));
	} else if (member.reason === "history") {
		lines.push("Republished with this release's changelog and component registry.");
	} else {
		lines.push("Republished.");
	}
	return lines.join("\n");
}

/** The commit as one list item: its summary, then a link to the commit holding the full note. */
function renderLinkedTitle(commit: Commit, repoUrl: string): string {
	let marker = commit.breaking ? "**Breaking:** " : "";
	return `- ${marker}${releaseSummary(commit.title)} ([${commit.sha.slice(0, 7)}](${repoUrl}/commit/${commit.sha}))`;
}

/** Names the alphabetically first fellow member among the package's runtime dependencies. */
function republishedBecause(
	name: string,
	memberNames: Set<string>,
	packages: DependencyNode[],
): string {
	let dependency = (packages.find((node) => node.name === name)?.dependencies ?? [])
		.filter((candidate) => memberNames.has(candidate))
		.sort()[0];
	if (dependency === undefined) return "Republished because a dependency changed.";
	return `Republished because \`${dependency}\` changed.`;
}

function compareNames(a: string, b: string): number {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}
