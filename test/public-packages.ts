/**
 * Scanners behind the public-package guard. A package that drops `private: true` has to ship
 * the metadata npm and its consumers expect, may only depend on other public packages, and
 * carries the ✅ that tells README readers it is published. Pure functions over facts read
 * once, so a failure names the exact package and the exact gap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatPrivateDependency, privateDependencies } from "../scripts/release/workspace.js";

/** What the guard knows about one `packages/<dir>`, gathered by the caller from disk. */
export interface PackageFacts {
	dir: string;
	name: string;
	isPrivate: boolean;
	hasDescription: boolean;
	hasReadme: boolean;
	hasLicense: boolean;
	dependencies: string[];
}

/** The mark a published package's README row carries in its last cell. */
const PUBLISHED_MARK = "✅";

/**
 * A row of the root README package table: the link cell, the description, and an optional
 * last cell holding the mark. The last group is optional so a table that has not gained the
 * column yet still parses, with every row reading as unmarked.
 */
const PACKAGE_ROW =
	/^\|\s*\[(?<label>[^\]]+)\]\(packages\/(?<dir>[^)]+)\)\s*\|(?<description>[^|]*)\|(?:(?<mark>[^|]*)\|)?\s*$/;

/**
 * One line per gap in a public package: a missing `description`, `README.md` or `LICENSE.md`,
 * and every private package it reaches through runtime dependencies with the chain that
 * reaches it. Sorted, so the failure message is stable.
 */
export function publicPackageProblems(facts: PackageFacts[]): string[] {
	let problems: string[] = [];
	for (let fact of facts) {
		if (fact.isPrivate) continue;
		if (!fact.hasDescription) problems.push(`${fact.name} is public but has no description`);
		if (!fact.hasReadme) problems.push(`${fact.name} is public but has no README.md`);
		if (!fact.hasLicense) problems.push(`${fact.name} is public but has no LICENSE.md`);
		for (let row of privateDependencies(fact, facts)) problems.push(formatPrivateDependency(row));
	}
	return problems.sort();
}

/**
 * One line per README row whose mark disagrees with the package's visibility, plus one per
 * public package with no row at all. Rows for directories outside `facts` are left alone.
 */
export function readmeMarkProblems(readme: string, facts: PackageFacts[]): string[] {
	let problems: string[] = [];
	let byDir = new Map(facts.map((fact) => [fact.dir, fact]));
	let seen = new Set<string>();
	for (let line of readme.split("\n")) {
		let groups = PACKAGE_ROW.exec(line)?.groups;
		let fact = groups?.dir === undefined ? undefined : byDir.get(groups.dir);
		if (fact === undefined) continue;
		seen.add(fact.dir);
		let marked = (groups?.mark ?? "").trim() === PUBLISHED_MARK;
		if (marked && fact.isPrivate) {
			problems.push(`${fact.name} is private but its README row has a ${PUBLISHED_MARK}`);
		}
		if (!marked && !fact.isPrivate) {
			problems.push(`${fact.name} is public but its README row has no ${PUBLISHED_MARK}`);
		}
	}
	for (let fact of facts) {
		if (fact.isPrivate || seen.has(fact.dir)) continue;
		problems.push(`${fact.name} is public but has no row in the README package table`);
	}
	return problems.sort();
}
