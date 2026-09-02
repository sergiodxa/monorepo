/**
 * The HTTP grammar, for the request and response exchanges the API docs quote,
 * and for the `rest` fences that spell a request out the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar } from "../lexer";

/**
 * Highlights a request or response: its first line, its headers, and the body
 * after the blank line, which stays plain whatever its content type says.
 *
 * @example scan("HTTP/1.1 429 Too Many Requests\nRetry-After: 7\n", http)
 */
export const http: Grammar = {
	main: [
		/** The blank line that closes the headers, after which a name with a `:` is body content rather than a header. */
		{ type: "plain", match: /\r?\n\r?\n/y, push: "body" },

		{ type: "constant", match: /HTTP\/\d(?:\.\d)?/y },

		/**
		 * A status line's two halves, each anchored to what a status line has
		 * before it, so a three-digit number elsewhere is left alone.
		 */
		{ type: "number", match: /(?<=^HTTP\/\d(?:\.\d)? )\d{3}/my },
		{ type: "keyword", match: /(?<=^HTTP\/\d(?:\.\d)? \d{3} )[^\r\n]+/my },

		{ type: "keyword", match: /^(?:DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT)(?=[ \t])/my },
		{ type: "attr-value", match: /(?<=^(?:DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT) )\S+/my },

		{ type: "property", match: /^[A-Za-z][\w-]*(?=:)/my },
		{ type: "punctuation", match: /(?<=^[A-Za-z][\w-]*):/my },
		/** A header's value starts at its first non-space character, which leaves the space after the `:` unpainted. */
		{ type: "string", match: /(?<=^[A-Za-z][\w-]*:[ \t]*)\S[^\r\n]*/my },
	],

	/**
	 * After the headers. Painting the body as one plain run beats guessing a
	 * language from a `Content-Type` and highlighting it as the wrong one.
	 */
	body: [{ type: "plain", match: /[\s\S]+/y }],
};
