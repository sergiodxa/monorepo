/**
 * Reads the scenario headings out of a vendored Gherkin suite, so each
 * transcription asserts it still covers every scenario the release ships and a
 * specification bump that adds one fails here by name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

/** Matches a plain scenario and an outline alike, capturing the title as written. */
const HEADING = /^\s*Scenario(?: Outline)?:\s*(.+?)\s*$/;

/**
 * The title of every scenario in one of the vendored `.feature` files, in the
 * order the file declares them, so a transcription can be diffed against it.
 *
 * @example expect(scenarios("hooks.feature")).toHaveLength(3);
 */
export function scenarios(feature: string): string[] {
	let source = readFileSync(
		new URL(`../../../../docs/vendor/openfeature/assets/gherkin/${feature}`, import.meta.url),
		"utf8",
	);

	let titles: string[] = [];

	for (let line of source.split("\n")) {
		let heading = HEADING.exec(line);
		if (heading?.[1]) titles.push(heading[1]);
	}

	return titles;
}
