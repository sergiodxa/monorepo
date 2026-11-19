/**
 * Removes matched phrases from the text they were found in, so what is left reads as the rest of
 * the sentence: a quick-add line's title once its dates are taken out. Spaces left behind collapse,
 * and a dangling "on", "at", "from", colon or comma at either end goes with them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Match } from "./types.js";

/** Words that only introduce a removed phrase, left stranded at an edge once it is gone. */
const STRANDED =
	/^(?:\s*(?:on|at|from|for|by|,|:|-|–|—))+\s*(?=\w)|\s+(?:(?:on|at|from|for|by|,|:|-|–|—)\s*)+$/gi;

/**
 * The text without the given matches.
 *
 * @param text The text the matches were found in.
 * @param matches The matches to remove, such as every one `find` returned.
 * @returns The rest of the text, its whitespace collapsed and its edges trimmed.
 * @example strip("Lunch with Ana tomorrow 1pm", found.matches) // "Lunch with Ana"
 */
export function strip(text: string, matches: Array<Pick<Match, "index" | "end">>): string {
	let rest = "";
	let cursor = 0;
	for (let match of [...matches].sort((a, b) => a.index - b.index)) {
		if (match.index < cursor) continue;
		rest += `${text.slice(cursor, match.index)} `;
		cursor = match.end;
	}
	rest += text.slice(cursor);
	return rest
		.replace(/\s+/g, " ")
		.trim()
		.replace(STRANDED, "")
		.replace(/\s+([,.;:!?])/g, "$1")
		.trim();
}
