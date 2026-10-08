/**
 * Scanners behind the public-package guard. A package that drops `private: true` has to ship
 * the metadata npm and its consumers expect, may only depend on other public packages, and
 * gets a row in the root README package table. Pure functions over facts read once, so a
 * failure names the exact package and the exact gap.
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

/** A row of the root README package table, captured by the package directory it links. */
const PACKAGE_ROW = /^\|\s*\[[^\]]+\]\(packages\/(?<dir>[^)]+)\)\s*\|/;

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

/** One line per public package with no row in the README package table, sorted. */
export function readmeRowProblems(readme: string, facts: PackageFacts[]): string[] {
	let listed = new Set<string>();
	for (let line of readme.split("\n")) {
		let dir = PACKAGE_ROW.exec(line)?.groups?.dir;
		if (dir !== undefined) listed.add(dir);
	}
	return facts
		.filter((fact) => !fact.isPrivate && !listed.has(fact.dir))
		.map((fact) => `${fact.name} is public but has no row in the README package table`)
		.sort();
}
