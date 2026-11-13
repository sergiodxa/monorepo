/**
 * Splits highlighted runs into one list of runs per source line, so every component that
 * draws code a line at a time (a docs card, a code viewer, a diff, a log) numbers, marks
 * and anchors lines from the same split, multi-line tokens included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * One painted run of source. Structural, so the runs `@sdxc/highlight` returns pass
 * straight through.
 */
export interface CodeToken {
	type: string;
	value: string;
}

/**
 * Splits runs at newlines (`\n` or `\r\n`) so each line owns its runs. A run spanning
 * lines (a block comment, a template literal) becomes one run per line with the same type,
 * and an empty line is an empty list, so the result always has one entry per source line.
 *
 * @param runs Runs covering the source in order, as a highlighter returns them.
 * @returns One array of runs per line; empty pieces are dropped.
 * @example codeLines(tokenize(source, "ts")).map((line, index) => <Line number={index + 1} runs={line} />)
 */
export function codeLines(runs: readonly CodeToken[]): CodeToken[][] {
	let lines: CodeToken[][] = [[]];
	for (let run of runs) {
		for (let [index, piece] of run.value.split(/\r?\n/).entries()) {
			if (index > 0) lines.push([]);
			if (piece.length > 0) lines[lines.length - 1]?.push({ type: run.type, value: piece });
		}
	}
	return lines;
}
