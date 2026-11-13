/**
 * The scanner exactly as it stood before first-character dispatch: every rule
 * of the mode tried at every position, one character of plain text at a time.
 * The differential tests hold the current scanner to its output.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Rule, Token } from "../lexer.js";

/**
 * Scans source into tokens the way the original scanner did, so its output is
 * the reference a faster scanner has to reproduce token for token.
 *
 * @param code - Source to scan
 * @param grammar - The language to scan it as
 * @returns The tokens, in source order, covering the input exactly once
 */
export function referenceScan(code: string, grammar: Grammar): Token[] {
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
