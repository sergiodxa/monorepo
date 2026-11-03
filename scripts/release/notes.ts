/**
 * Release notes rendered from the commits a release ships, one section per package, so the
 * GitHub Release reads as a per-package changelog written in the commit messages themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
 * oldest first, as `- Summary` (`- **Breaking:** Summary`) with the body indented by a tab, one
 * line explaining a package that ships without commits, and a compare link to the previous tag.
 * Past `maxLength`, the largest sections shrink to commit titles linked to their commits.
 */
export function renderNotes(input: NotesInput): string {
	let memberNames = new Set(input.members.map((member) => member.name));
	let members = [...input.members].sort((a, b) => compareNames(a.name, b.name));
	let sections = members.map((member) =>
		renderSection(
			member,
			input.commitsByPackage.get(member.name) ?? [],
			memberNames,
			input.packages,
			null,
		),
	);
	let footer =
		input.previousTag === null
			? []
			: [`Compare: ${input.repoUrl}/compare/${input.previousTag}...v${input.version}`];
	let maxLength = input.maxLength ?? RELEASE_BODY_LIMIT;
	let shortened = new Set<number>();
	while (notesLength(sections, footer) > maxLength) {
		let largest = largestSection(sections, shortened, members, input.commitsByPackage);
		if (largest === null) break;
		shortened.add(largest);
		let member = members[largest] as Member;
		sections[largest] = renderSection(
			member,
			input.commitsByPackage.get(member.name) ?? [],
			memberNames,
			input.packages,
			input.repoUrl,
		);
	}
	return `${[...sections, ...footer].join("\n\n")}\n`;
}

function notesLength(sections: string[], footer: string[]): number {
	return `${[...sections, ...footer].join("\n\n")}\n`.length;
}

/** The index of the longest section that has commits and still carries their bodies. */
function largestSection(
	sections: string[],
	shortened: Set<number>,
	members: Member[],
	commitsByPackage: Map<string, Commit[]>,
): number | null {
	let largest: number | null = null;
	for (let [index, section] of sections.entries()) {
		if (shortened.has(index)) continue;
		if ((commitsByPackage.get((members[index] as Member).name) ?? []).length === 0) continue;
		if (largest === null || section.length > (sections[largest] as string).length) largest = index;
	}
	return largest;
}

/**
 * A package's section; with `linkTo` set, each commit renders as its summary linked to the
 * commit on that repository page, so a shortened section still leads to every full note.
 */
function renderSection(
	member: Member,
	commits: Commit[],
	memberNames: Set<string>,
	packages: DependencyNode[],
	linkTo: string | null,
): string {
	let lines = [`## ${member.name}`];
	if (commits.length > 0) {
		let ordered = [
			...commits.filter((commit) => commit.breaking),
			...commits.filter((commit) => !commit.breaking),
		];
		if (linkTo !== null) {
			lines.push("Shortened to fit the release page; each change links to its full note.");
		}
		for (let commit of ordered) {
			lines.push(...(linkTo === null ? renderCommit(commit) : [renderLinkedTitle(commit, linkTo)]));
		}
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

/**
 * The commit as a list item headed by its summary, the `type(scope):` prefix left to git: a
 * reader of one package's notes needs the change, and a breaking one says so in words.
 */
function renderCommit(commit: Commit): string[] {
	let marker = commit.breaking ? "**Breaking:** " : "";
	let lines = [`- ${marker}${releaseSummary(commit.title)}`];
	if (commit.body !== "") {
		for (let line of commit.body.split("\n")) lines.push(line.trim() === "" ? "" : `\t${line}`);
	}
	return lines;
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
