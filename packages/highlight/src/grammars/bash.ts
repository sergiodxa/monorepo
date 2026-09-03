/**
 * The Bash grammar, covering both a whole script and the single command a
 * reader is meant to copy out of a fence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Rule } from "../lexer.js";

/**
 * The words that structure a script rather than name something to run. `elif`
 * and `else` join the list the shell's manual calls reserved, so an `if` block
 * paints as one construct.
 */
const KEYWORDS =
	/\b(?:case|do|done|elif|else|esac|export|fi|for|function|if|in|local|return|then|while)\b/y;

/**
 * The programs a fence in this repository actually invokes. A curated list
 * beats every name on a `$PATH`: a word that is only sometimes a command, like
 * `test` or `bash`, reads wrong every other time it appears.
 */
const COMMANDS =
	/\b(?:awk|bun|bunx|cat|cd|chmod|cp|curl|docker|echo|find|git|grep|ls|mkdir|mv|npm|npx|rm|sed|sudo|wrangler)\b/y;

/**
 * Every form an expansion takes, shared by the two places one appears: a
 * command line, and the body of a double-quoted string, where the shell keeps
 * expanding and so a reader expects `$name` to keep standing out.
 */
const expansion: Rule[] = [
	{ type: "variable", match: /\$\([^)]*\)?/y },
	{ type: "variable", match: /\$\{[^}]*\}?/y },
	{ type: "variable", match: /\$[A-Za-z_]\w*/y },
	{ type: "variable", match: /\$[\d!#$*?@]/y },
];

/**
 * Highlights shell commands and scripts, including the expansions inside a
 * double-quoted string.
 *
 * @example scan('curl -H "Bearer $TOKEN" "$URL"', bash)
 */
export const bash: Grammar = {
	main: [
		/** A `#` opens a comment only where a word can start, so a URL's fragment stays part of the URL. */
		{ type: "comment", match: /(?<!\S)#[^\n]*/y },

		{ type: "string", match: /'[^']*'?/y },
		{ type: "string", match: /"/y, push: "string" },

		...expansion,

		/** A number stands alone, so the digits inside `cron_abc123` or `127.0.0.1:5432/db` stay part of the word. */
		{ type: "number", match: /(?<![\w./-])\d+(?:\.\d+)?(?![\w./-])/y },

		{ type: "keyword", match: KEYWORDS },
		{ type: "function", match: COMMANDS },

		/** A flag opens a word rather than continuing one, so the `-` in `remix-test` stays a name's. */
		{ type: "attr-name", match: /(?<![\w=./-])--?[A-Za-z][\w-]*/y },

		/** The `\` that carries a command onto the next line, which every multi-line `curl` here uses. */
		{ type: "operator", match: /\\(?=\r?\n)/y },
		{ type: "operator", match: /&&|\|\||[&;|]/y },

		/** A redirection opens a word too, after a space or a file descriptor, which leaves `<name>` in a path alone. */
		{ type: "operator", match: /(?<![^\s\d])(?:>>|[<>])/y },
	],

	/**
	 * Inside a double-quoted string, where an expansion still reads as one and
	 * the closing quote is the only thing that ends the run.
	 */
	string: [
		{ type: "string", match: /"/y, pop: true },
		...expansion,
		{ type: "string", match: /(?:\\[\s\S]|[^"$\\])+/y },
		{ type: "string", match: /\$/y },
	],
};
