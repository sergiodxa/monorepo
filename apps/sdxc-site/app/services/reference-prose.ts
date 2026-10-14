/**
 * Splits a sentence taken from a source comment into the runs a page draws it with.
 *
 * A doc comment names code the way prose does, in backticks, and a page that prints the
 * sentence verbatim prints the backticks with it. Reading them here is what lets the page
 * set those runs in the mono face and leave the rest as prose.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One stretch of a sentence, and whether the comment marked it as code. */
export interface ProseRun {
	/** Whether the comment wrote this stretch in backticks. */
	code: boolean;
	/** The stretch itself, with the backticks around a code run removed. */
	text: string;
}

/** A backtick-delimited run, matched non-greedily so two runs in one sentence stay apart. */
const CODE_RUN = /`([^`]+)`/g;

/**
 * Reads a comment sentence as alternating prose and code runs.
 *
 * An unpaired backtick has nothing to close it, so it stays in the prose it sits in and
 * the sentence still reads — the page prints the stray mark rather than swallowing the
 * rest of the line into a code run that never ends.
 *
 * @param sentence - The sentence as the source comment wrote it.
 * @returns The runs to draw, in order, with no empty run between two adjacent ones.
 *
 * @example toRuns("Built on the native `<details>` element.")
 * @example [{ code: false, text: "Built on the native " }, { code: true, text: "<details>" }, { code: false, text: " element." }]
 */
export function toRuns(sentence: string): ProseRun[] {
	let runs: ProseRun[] = [];
	let read = 0;

	for (let match of sentence.matchAll(CODE_RUN)) {
		if (match.index > read) runs.push({ code: false, text: sentence.slice(read, match.index) });
		runs.push({ code: true, text: match[1] as string });
		read = match.index + match[0].length;
	}

	if (read < sentence.length) runs.push({ code: false, text: sentence.slice(read) });
	return runs;
}
