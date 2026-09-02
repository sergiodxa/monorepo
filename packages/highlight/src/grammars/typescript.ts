/**
 * The TypeScript grammar: the type-level syntax layered over the JavaScript
 * rules, so a `.ts` fence paints everything a `.js` one does and its types too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Rule } from "../lexer";

import { compose } from "../lexer";

import { expression, javascript } from "./javascript";

/**
 * The words TypeScript reserves on top of JavaScript's.
 *
 * A word after a `.` names a member and a word before a `:` names a key, so
 * `u.is(2)` calls a method and `{ type: "page" }` sets a field.
 */
const KEYWORDS =
	/(?<!\.)\b(?:abstract|asserts|declare|enum|implements|infer|interface|is|keyof|module|namespace|override|private|protected|public|readonly|satisfies|type)\b(?![?\s]*:)/y;

/**
 * The types the language provides itself, which is what tells `string` apart
 * from a `String` the runtime provides: the same guards apply, so an object with
 * a `number` key still reads as a key.
 */
const BUILTINS =
	/(?<!\.)\b(?:any|bigint|boolean|never|number|object|string|symbol|unknown|void)\b(?![?\s]*:)/y;

/**
 * The rules for the syntax TypeScript adds, which have to be tried ahead of the
 * JavaScript ones: `void` is a type here, and the `<` of a type argument list
 * would otherwise read as the comparison it looks like.
 */
const types: Rule[] = [
	/** A decorator is applied like a call, so it paints as the function it names. */
	{ type: "function", match: /@[A-Za-z_$][\w$]*/y },

	{ type: "keyword", match: KEYWORDS },
	{ type: "builtin", match: BUILTINS },

	/** A call whose type arguments push the `(` too far from the name for the JavaScript rule to see it. */
	{ type: "function", match: /(?<![\w$])[a-z_$][\w$]*(?=<[^<>\n]*>[^\S\n]*\()/y },

	/**
	 * A `<` opens a type argument list when it sits against the name it applies
	 * to and its `>` follows on the same line: requiring the close bounds the
	 * mode, and leaves a tight `a<b` as the comparison it is.
	 */
	{ type: "punctuation", match: /(?<=[\w$])<(?=[^<>\n]*>)/y, push: "generic" },
];

/**
 * The modes TypeScript contributes, which {@link typescript} merges over the
 * JavaScript ones.
 */
const declarations: Grammar = {
	main: types,
	interpolation: types,

	/**
	 * Inside `<…>`, where the `>` that closes the list returns to the code that
	 * opened it and everything between is an ordinary expression: a type is
	 * written with the same identifiers, literals and operators.
	 */
	generic: [{ type: "punctuation", match: />/y, pop: true }, ...types, ...expression],
};

/**
 * Highlights TypeScript: every JavaScript construct, plus the keywords, builtin
 * types, decorators and type arguments the types are written with.
 *
 * @example scan("let id: string = crypto.randomUUID()", typescript)
 */
export const typescript: Grammar = compose(declarations, javascript);
