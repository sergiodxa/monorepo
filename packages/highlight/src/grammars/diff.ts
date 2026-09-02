/**
 * The diff grammar, which reads a patch a line at a time rather than a token at
 * a time: the first character of a line decides what the whole line is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar } from "../lexer";

/**
 * Highlights a unified diff, painting each line by the marker that opens it.
 *
 * @example scan("@@ -1 +1 @@\n-old\n+new\n", diff)
 */
export const diff: Grammar = {
	/**
	 * Every pattern pairs `m` with the sticky flag, so `^` asserts that the
	 * scanner sits at the start of a line and a line ends at the newline it
	 * leaves for the next match.
	 *
	 * The file headers come first, because `---` and `+++` also open the two
	 * markers that mean a change.
	 */
	main: [
		{ type: "keyword", match: /^@@[^\n]*/my },

		{ type: "comment", match: /^diff[^\n]*/my },
		{ type: "comment", match: /^index[^\n]*/my },
		{ type: "comment", match: /^---[^\n]*/my },
		{ type: "comment", match: /^\+\+\+[^\n]*/my },

		{ type: "inserted", match: /^\+[^\n]*/my },
		{ type: "deleted", match: /^-[^\n]*/my },
	],
};
