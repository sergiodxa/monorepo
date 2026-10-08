/**
 * Splits TeX math source into commands, numbers and single characters on
 * demand, skipping whitespace and `%` comments the way math mode does. It also
 * reads a braced group raw, for the arguments that are text rather than math.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MathError } from "./errors.js";

/**
 * One lexical unit. A command's `value` keeps its backslash, so `\,` and `,`
 * stay distinct, and `index` is where the token starts in the source.
 */
export interface Token {
	kind: "command" | "character" | "number" | "end";
	value: string;
	index: number;
}

/** A decimal number: digits with an optional fraction, or a fraction alone. */
const NUMBER = /\d+(?:\.\d+)?|\.\d+/y;

/** The letters a command name is made of; anything else after a backslash is a one-character command. */
const COMMAND_NAME = /[A-Za-z]+/y;

/** Whitespace and comments, which math mode ignores between tokens. */
const TRIVIA = /(?:\s+|%[^\n]*)*/y;

/**
 * A cursor over the source that hands out one token at a time. Tokens are read
 * lazily, so the parser can switch to reading a raw group at any point.
 */
export class Lexer {
	private position = 0;

	/** @param source - The TeX math source */
	constructor(private readonly source: string) {}

	/**
	 * @returns The next token, left in place for {@link Lexer.next} to take
	 */
	peek(): Token {
		let index = this.skipTrivia(this.position);
		if (index >= this.source.length) return { kind: "end", value: "", index };

		let character = String.fromCodePoint(this.source.codePointAt(index) as number);

		if (character === "\\") return this.command(index);

		NUMBER.lastIndex = index;
		let number = NUMBER.exec(this.source);
		if (number) return { kind: "number", value: number[0], index };

		return { kind: "character", value: character, index };
	}

	/**
	 * @returns The next token, consumed
	 */
	next(): Token {
		let token = this.peek();
		this.position = token.index + token.value.length;
		return token;
	}

	/**
	 * Takes a single digit off a number, which is all an unbraced argument holds
	 * in TeX: `x^23` raises only the 2.
	 *
	 * @returns A number token of one digit, or the whole number when it starts with a point
	 */
	nextDigit(): Token {
		let token = this.peek();
		if (token.kind !== "number" || token.value.startsWith(".")) return this.next();
		this.position = token.index + 1;
		return { ...token, value: token.value.slice(0, 1) };
	}

	/**
	 * Reads a braced group as raw text, for `\text`, `\operatorname` and an
	 * environment's name. A backslash escapes the character after it, so `\}`
	 * never closes the group.
	 *
	 * @returns The text between the braces, escapes kept as written, and where the group opened
	 */
	readGroup(): { value: string; index: number } {
		let start = this.skipTrivia(this.position);
		if (this.source[start] !== "{") throw new MathError("Expected {", this.source, start);

		let depth = 1;
		let cursor = start + 1;

		while (cursor < this.source.length) {
			let character = this.source[cursor];
			if (character === "\\") {
				cursor += 2;
				continue;
			}
			if (character === "{") depth += 1;
			if (character === "}") depth -= 1;
			if (depth === 0) {
				this.position = cursor + 1;
				return { value: this.source.slice(start + 1, cursor), index: start };
			}
			cursor += 1;
		}

		throw new MathError("Expected }", this.source, this.source.length);
	}

	/** A backslash followed by letters names a command; followed by anything else, it is that one character. */
	private command(index: number): Token {
		COMMAND_NAME.lastIndex = index + 1;
		let name = COMMAND_NAME.exec(this.source);
		if (name) return { kind: "command", value: `\\${name[0]}`, index };

		let following = this.source.codePointAt(index + 1);
		if (following === undefined) {
			throw new MathError("Expected a command after \\", this.source, index);
		}
		return { kind: "command", value: `\\${String.fromCodePoint(following)}`, index };
	}

	/** @returns The offset of the first character at or after `index` that is neither whitespace nor a comment */
	private skipTrivia(index: number): number {
		TRIVIA.lastIndex = index;
		TRIVIA.exec(this.source);
		return TRIVIA.lastIndex;
	}
}
