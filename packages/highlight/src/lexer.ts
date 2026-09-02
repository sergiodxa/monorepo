/**
 * The token model every grammar produces and the scanner that produces it: a
 * single left-to-right pass that tries the current mode's rules at the cursor
 * and takes the first one that matches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export namespace Token {
	/**
	 * Every kind of run a grammar can name. The set is closed so a palette that
	 * maps over it is exhaustive, and small enough that a stylesheet paints all of
	 * it: a grammar picks the nearest member rather than introducing its own.
	 *
	 * - `keyword` — reserved words, CSS at-rules, a shell's builtin verbs
	 * - `builtin` — names the language itself provides, like TypeScript's `string`
	 * - `class-name` — types, classes, and the names of both where they are declared
	 * - `function` — a name in the position of something called or defined
	 * - `property` — a key: an object literal's, a CSS declaration's, a mapping's
	 * - `tag` — a markup tag name, and a CSS selector
	 * - `attr-name`, `attr-value` — the halves of a markup attribute
	 * - `constant` — `SCREAMING_CASE` names, and a language's named constants
	 * - `variable` — a sigil-marked name, such as a shell's `$name`
	 * - `inserted`, `deleted` — the two sides of a diff
	 * - `plain` — everything no rule claimed
	 */
	export type Type =
		| "attr-name"
		| "attr-value"
		| "boolean"
		| "builtin"
		| "class-name"
		| "comment"
		| "constant"
		| "deleted"
		| "function"
		| "inserted"
		| "keyword"
		| "number"
		| "operator"
		| "plain"
		| "property"
		| "punctuation"
		| "regex"
		| "string"
		| "tag"
		| "variable";
}

/**
 * One run of source, and what to paint it as.
 */
export interface Token {
	type: Token.Type;
	value: string;
}

/**
 * One thing a grammar knows how to recognize at the cursor.
 *
 * `match` has to carry the sticky flag, so it can only ever match where the
 * scanner is rather than searching ahead, and it has to match at least one
 * character. `push` and `pop` move the mode stack, and a rule uses one or the
 * other.
 */
export interface Rule {
	type: Token.Type;
	match: RegExp;
	push?: string;
	pop?: true;
}

/**
 * A language, as its modes.
 */
export interface Grammar {
	/** Where scanning starts. */
	main: Rule[];
	/**
	 * A context a rule pushes onto the stack: a template literal's interpolation,
	 * a markup tag's attributes, the body of an embedded language.
	 */
	[mode: string]: Rule[];
}

/**
 * Merges grammars into one, mode by mode, so a language built on another states
 * that as an import: the earlier grammar's rules are tried first, which is how a
 * JSX tag wins over a TypeScript comparison on the same `<`.
 *
 * A part with no `main` of its own is merged the same way, which is how a set of
 * modes lifted off another grammar joins one.
 *
 * @param parts - The grammars and mode sets to merge, in priority order
 * @returns A grammar holding every mode any of them defines
 */
export function compose(...parts: Array<Record<string, Rule[]>>): Grammar {
	let merged: Record<string, Rule[]> = {};

	for (let part of parts) {
		for (let [mode, rules] of Object.entries(part)) {
			merged[mode] = [...(merged[mode] ?? []), ...rules];
		}
	}

	return { main: [], ...merged };
}

/**
 * Scans source into tokens with a grammar, appending each character no rule
 * claimed to a `plain` run.
 *
 * Adjacent runs of the same type arrive merged, so the output is the same
 * whether a grammar spells a construct as one rule or several.
 *
 * @param code - Source to scan
 * @param grammar - The language to scan it as
 * @returns The tokens, in source order, covering the input exactly once
 */
export function scan(code: string, grammar: Grammar): Token[] {
	let tokens: Token[] = [];
	let modes: string[] = ["main"];
	let plain = "";
	let position = 0;

	/** Ends the `plain` run being accumulated, if there is one. */
	function flush() {
		if (plain.length > 0) push({ type: "plain", value: plain });
		plain = "";
	}

	/** Adds a token, extending the previous one when they share a type. */
	function push(token: Token) {
		let previous = tokens.at(-1);
		if (previous?.type === token.type) previous.value += token.value;
		else tokens.push(token);
	}

	while (position < code.length) {
		let mode = modes.at(-1) ?? "main";
		let matched = matchRule(code, position, grammar[mode] ?? []);

		if (!matched) {
			plain += code[position];
			position += 1;
			continue;
		}

		flush();
		push({ type: matched.rule.type, value: matched.value });
		position += matched.value.length;

		if (matched.rule.push) modes.push(matched.rule.push);
		else if (matched.rule.pop && modes.length > 1) modes.pop();
	}

	flush();

	return tokens;
}

/**
 * Finds the first rule that matches at a position.
 */
function matchRule(code: string, position: number, rules: Rule[]) {
	for (let rule of rules) {
		rule.match.lastIndex = position;
		let match = rule.match.exec(code);
		if (match && match[0].length > 0) return { rule, value: match[0] };
	}

	return undefined;
}
