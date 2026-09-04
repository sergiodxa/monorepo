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

export interface NotesInput {
	version: string;
	previousTag: string | null;
	members: Member[];
	commitsByPackage: Map<string, Commit[]>;
	packages: DependencyNode[];
	repoUrl: string;
}

/**
 * Markdown for the GitHub Release: packages alphabetical, commits oldest first as
 * `- type: title` with the body indented by a tab, one line explaining a package that ships
 * without commits, and a compare link to the previous tag when there is one.
 */
export function renderNotes(input: NotesInput): string {
	let memberNames = new Set(input.members.map((member) => member.name));
	let sections = [...input.members]
		.sort((a, b) => compareNames(a.name, b.name))
		.map((member) =>
			renderSection(
				member,
				input.commitsByPackage.get(member.name) ?? [],
				memberNames,
				input.packages,
			),
		);
	let footer =
		input.previousTag === null
			? []
			: [`Compare: ${input.repoUrl}/compare/${input.previousTag}...v${input.version}`];
	return `${[...sections, ...footer].join("\n\n")}\n`;
}

function renderSection(
	member: Member,
	commits: Commit[],
	memberNames: Set<string>,
	packages: DependencyNode[],
): string {
	let lines = [`## ${member.name}`];
	if (commits.length > 0) {
		for (let commit of commits) lines.push(...renderCommit(commit));
	} else if (member.reason === "new") {
		lines.push("First release.");
	} else if (member.reason === "dependency") {
		lines.push(republishedBecause(member.name, memberNames, packages));
	} else {
		lines.push("Republished.");
	}
	return lines.join("\n");
}

/** The commit as a list item, its body lines tabbed in and its blank lines kept empty. */
function renderCommit(commit: Commit): string[] {
	let lines = [`- ${commit.type}${commit.breaking ? "!" : ""}: ${commit.title}`];
	if (commit.body !== "") {
		for (let line of commit.body.split("\n")) lines.push(line.trim() === "" ? "" : `\t${line}`);
	}
	return lines;
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
