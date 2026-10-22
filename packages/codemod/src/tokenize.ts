/**
 * Splits JavaScript, TypeScript and JSX source into tokens with exact UTF-16 ranges, so every
 * edit reads strings, template literals, regular expressions, comments and JSX text as what
 * they are. Input that ends inside a construct, or whose brackets do not pair, fails closed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { CodemodError } from "./errors.js";

/**
 * What a token is. `template` is a template literal without substitutions; the other
 * `template-*` kinds are the pieces around each `${…}`. `jsx` covers every piece of JSX
 * markup (tags, attribute names and strings, text), while the code inside `{…}` in JSX
 * produces ordinary tokens.
 */
export type TokenType =
	| "identifier"
	| "punctuator"
	| "number"
	| "string"
	| "template"
	| "template-head"
	| "template-middle"
	| "template-tail"
	| "regex"
	| "comment"
	| "jsx";

/** One token and its source range; `value` is the exact source text of the range. */
export interface Token {
	type: TokenType;
	start: number;
	end: number;
	value: string;
	/** Whether a line break separates this token from the previous non-comment token. */
	newlineBefore: boolean;
}

/** How a file's extension decides what its source may contain. */
export interface Language {
	typescript: boolean;
	jsx: boolean;
}

/**
 * The extensions the scanner reads, and the syntax each admits. Every JavaScript extension
 * admits JSX: a `<` where an expression begins is a syntax error in plain JavaScript, so reading
 * it as an element leaves every valid program as it was and covers `.js` files that hold JSX.
 */
const LANGUAGES: Record<string, Language> = {
	".js": { typescript: false, jsx: true },
	".mjs": { typescript: false, jsx: true },
	".cjs": { typescript: false, jsx: true },
	".jsx": { typescript: false, jsx: true },
	".ts": { typescript: true, jsx: false },
	".mts": { typescript: true, jsx: false },
	".cts": { typescript: true, jsx: false },
	".tsx": { typescript: true, jsx: true },
};

/**
 * Keywords after which an expression begins, so a `/` that follows starts a regular
 * expression and, in JSX files, a `<` starts an element.
 */
const EXPRESSION_KEYWORDS = new Set([
	"return",
	"typeof",
	"instanceof",
	"in",
	"of",
	"new",
	"delete",
	"void",
	"throw",
	"case",
	"do",
	"else",
	"yield",
	"await",
]);

/** Identifiers after which a `{` opens an object literal or object type, not a block. */
const OBJECT_AFTER = new Set([
	"return",
	"typeof",
	"instanceof",
	"in",
	"of",
	"new",
	"delete",
	"void",
	"throw",
	"case",
	"yield",
	"await",
	"default",
	"extends",
	"as",
	"satisfies",
	"keyof",
]);

/** Keywords whose parenthesized head leaves the position after `)` expecting a statement. */
const CONTROL_HEADS = new Set(["if", "while", "for", "with"]);

/** Three-character punctuators, tried before the shorter ones. */
const PUNCTUATORS_3 = new Set(["...", "===", "!==", "**=", "<<=", "&&=", "||=", "??="]);

/**
 * Two-character punctuators. No punctuator begins with `>`: every `>` is its own token, so
 * the `>>` closing nested type arguments reads the same as a shift.
 */
const PUNCTUATORS_2 = new Set([
	"=>",
	"==",
	"!=",
	"<=",
	"&&",
	"||",
	"??",
	"?.",
	"++",
	"--",
	"+=",
	"-=",
	"*=",
	"%=",
	"&=",
	"|=",
	"^=",
	"**",
	"<<",
]);

/** Single-character punctuators, `/` excluded since it is read by position. */
const PUNCTUATORS_1 = new Set("{}()[];,<>+-*%&|^!~?:=.@".split(""));

/** What an open bracket, template substitution or JSX construct is, kept on the scanner stack. */
interface Frame {
	type: "brace" | "paren" | "bracket" | "template" | "jsx-expression" | "jsx-tag" | "jsx-children";
	/** For a brace, whether it opened a block, whose `}` ends a statement. */
	block: boolean;
	/** For a parenthesis, whether it is an `if`, `while`, `for` or `with` head. */
	control: boolean;
	/** For a JSX tag, whether it is a closing tag. */
	closing: boolean;
	/** Where the construct opened, for the failure that names an unterminated one. */
	start: number;
}

/** The extensions the scanner reads, keyed off the end of `filename`. */
export function languageOf(filename: string): Language | null {
	let dot = filename.lastIndexOf(".");
	if (dot === -1) return null;
	return LANGUAGES[filename.slice(dot).toLowerCase()] ?? null;
}

/**
 * Every token of `source`, comments and JSX markup included, in source order. The extension
 * of `filename` decides whether TypeScript and JSX are read; any other extension is an
 * `unsupported-file` failure.
 */
export function tokenize(filename: string, source: string): Result<Token[], CodemodError> {
	let language = languageOf(filename);
	if (language === null) {
		return failure(
			new CodemodError(
				"unsupported-file",
				filename,
				"only .js, .mjs, .cjs, .jsx, .ts, .mts, .cts and .tsx files can be scanned",
			),
		);
	}
	return new Scanner(filename, source, language).run();
}

/** Whether `code` may start an identifier: ASCII letters, `$`, `_`, `\` escapes, non-ASCII. */
function isIdentifierStart(code: number): boolean {
	return (
		(code >= 97 && code <= 122) ||
		(code >= 65 && code <= 90) ||
		code === 36 ||
		code === 95 ||
		code === 92 ||
		(code >= 0x80 && !isWhitespace(code) && !isLineBreak(code))
	);
}

/** Whether `code` may continue an identifier. */
function isIdentifierPart(code: number): boolean {
	return isIdentifierStart(code) || (code >= 48 && code <= 57);
}

/** Whether `code` is an ASCII digit. */
function isDigit(code: number): boolean {
	return code >= 48 && code <= 57;
}

/** Whether `code` ends a line in ECMAScript source. */
function isLineBreak(code: number): boolean {
	return code === 10 || code === 13 || code === 0x2028 || code === 0x2029;
}

/** Whether `code` is ECMAScript whitespace other than a line break. */
function isWhitespace(code: number): boolean {
	return (
		code === 32 ||
		code === 9 ||
		code === 11 ||
		code === 12 ||
		code === 0xa0 ||
		code === 0xfeff ||
		code === 0x1680 ||
		(code >= 0x2000 && code <= 0x200a) ||
		code === 0x202f ||
		code === 0x205f ||
		code === 0x3000
	);
}

/** Whether `code` may appear in a JSX tag or attribute name, which admits `-`, `:` and `.`. */
function isJsxNamePart(code: number): boolean {
	return isIdentifierPart(code) || code === 45 || code === 58 || code === 46;
}

/**
 * One pass over one source text. A stack of frames records what each open bracket belongs to,
 * which decides whether a `/` after `)` or `}` begins a regular expression and where a `}`
 * returns to a template literal or to JSX.
 */
class Scanner {
	filename: string;
	source: string;
	language: Language;
	pos = 0;
	tokens: Token[] = [];
	stack: Frame[] = [];
	newline = false;
	/** Whether the next token starts an expression: `/` is a regex, `<` may be JSX. */
	expression = true;
	/** Whether a `{` at this position opens a block rather than an object literal. */
	block = true;
	/** The last non-comment code token, for keyword and member checks. */
	last: Token | null = null;
	/** The code token before {@link last}. */
	beforeLast: Token | null = null;

	/**
	 * @param filename - Named in failures
	 * @param source - The text to scan
	 * @param language - Whether TypeScript and JSX are read
	 */
	constructor(filename: string, source: string, language: Language) {
		this.filename = filename;
		this.source = source;
		this.language = language;
	}

	/** Scans the whole input, failing on the first construct it cannot close. */
	run(): Result<Token[], CodemodError> {
		if (this.source.startsWith("#!")) {
			let end = this.lineEnd(0);
			this.push("comment", 0, end);
			this.pos = end;
		}
		while (true) {
			let top = this.stack[this.stack.length - 1];
			let error: CodemodError | null;
			if (top?.type === "jsx-tag") error = this.jsxTag(top);
			else if (top?.type === "jsx-children") error = this.jsxChildren();
			else {
				error = this.trivia();
				if (error !== null) return failure(error);
				if (this.pos >= this.source.length) break;
				error = this.code();
			}
			if (error !== null) return failure(error);
		}
		let open = this.stack[this.stack.length - 1];
		if (open !== undefined) {
			let what;
			if (open.type === "template") what = "template literal";
			else if (open.type.startsWith("jsx")) what = "JSX element";
			else what = `\`${this.source[open.start]}\``;
			return failure(this.fail("unterminated", `${what} is never closed`, open.start));
		}
		return success(this.tokens);
	}

	/** A failure at `offset`. */
	fail(code: CodemodError["code"], reason: string, offset: number): CodemodError {
		return new CodemodError(code, this.filename, reason, this.source, offset);
	}

	/** Records a token; non-comment code tokens also become {@link last}. */
	push(type: TokenType, start: number, end: number): Token {
		let token: Token = {
			type,
			start,
			end,
			value: this.source.slice(start, end),
			newlineBefore: this.newline,
		};
		this.tokens.push(token);
		if (type !== "comment") {
			this.newline = false;
			if (type !== "jsx") {
				this.beforeLast = this.last;
				this.last = token;
			}
		}
		return token;
	}

	/** The offset of the line break that ends the line holding `from`, or the input length. */
	lineEnd(from: number): number {
		let at = from;
		while (at < this.source.length && !isLineBreak(this.source.charCodeAt(at))) at += 1;
		return at;
	}

	/** Skips whitespace and records comments, noting whether a line break was crossed. */
	trivia(): CodemodError | null {
		let source = this.source;
		while (this.pos < source.length) {
			let code = source.charCodeAt(this.pos);
			if (isLineBreak(code)) {
				this.newline = true;
				this.pos += 1;
			} else if (isWhitespace(code)) {
				this.pos += 1;
			} else if (code === 47 && source.charCodeAt(this.pos + 1) === 47) {
				let end = this.lineEnd(this.pos);
				this.push("comment", this.pos, end);
				this.pos = end;
			} else if (code === 47 && source.charCodeAt(this.pos + 1) === 42) {
				let close = source.indexOf("*/", this.pos + 2);
				if (close === -1) return this.fail("unterminated", "comment is never closed", this.pos);
				let body = source.slice(this.pos, close);
				if (/[\n\r\u2028\u2029]/.test(body)) this.newline = true;
				this.push("comment", this.pos, close + 2);
				this.pos = close + 2;
			} else {
				return null;
			}
		}
		return null;
	}

	/** Reads one code token at {@link pos}, which is past any trivia. */
	code(): CodemodError | null {
		let source = this.source;
		let start = this.pos;
		let code = source.charCodeAt(start);

		if (code === 35 && isIdentifierStart(source.charCodeAt(start + 1))) {
			this.pos = this.identifierEnd(start + 1);
			this.push("identifier", start, this.pos);
			this.expression = false;
			this.block = false;
			return null;
		}
		if (isIdentifierStart(code)) {
			this.pos = this.identifierEnd(start);
			if (this.pos === start) {
				return this.fail("unexpected-character", "unexpected character `\\`", start);
			}
			this.afterIdentifier(this.push("identifier", start, this.pos));
			return null;
		}
		if (isDigit(code) || (code === 46 && isDigit(source.charCodeAt(start + 1)))) {
			this.pos = this.numberEnd(start);
			this.push("number", start, this.pos);
			this.expression = false;
			this.block = false;
			return null;
		}
		if (code === 34 || code === 39) return this.string(start, code);
		if (code === 96) return this.template(start, true);
		if (code === 47) {
			if (this.expression) return this.regex(start);
			let length = source.charCodeAt(start + 1) === 61 ? 2 : 1;
			this.pos = start + length;
			this.push("punctuator", start, this.pos);
			this.expression = true;
			this.block = false;
			return null;
		}
		if (code === 60 && this.language.jsx && this.expression && !this.genericArrowHead(start)) {
			this.pos = start + 1;
			this.push("jsx", start, this.pos);
			this.stack.push(this.frame("jsx-tag", start));
			return null;
		}
		return this.punctuator(start);
	}

	/** A frame of `type` opened at `start`. */
	frame(type: Frame["type"], start: number): Frame {
		return { type, block: false, control: false, closing: false, start };
	}

	/** The end of the identifier starting at `from`, `\u` escapes included. */
	identifierEnd(from: number): number {
		let source = this.source;
		let at = from;
		while (at < source.length) {
			let code = source.charCodeAt(at);
			if (code === 92 && source.charCodeAt(at + 1) === 117) {
				if (source.charCodeAt(at + 2) === 123) {
					let close = source.indexOf("}", at);
					at = close === -1 ? source.length : close + 1;
				} else {
					at += 6;
				}
			} else if (isIdentifierPart(code) && code !== 92) {
				at += 1;
			} else {
				break;
			}
		}
		return Math.min(at, source.length);
	}

	/** The end of the numeric literal starting at `from`, radix prefixes and BigInt `n` included. */
	numberEnd(from: number): number {
		let source = this.source;
		let at = from;
		let next = source.charCodeAt(from + 1) | 0x20;
		if (source.charCodeAt(from) === 48 && (next === 120 || next === 111 || next === 98)) {
			at += 2;
			while (at < source.length && (isIdentifierPart(source.charCodeAt(at)) || source[at] === "_"))
				at += 1;
			return at;
		}
		let digits = (): void => {
			while (at < source.length && (isDigit(source.charCodeAt(at)) || source[at] === "_")) at += 1;
		};
		digits();
		if (source[at] === ".") {
			at += 1;
			digits();
		}
		if (source[at] === "e" || source[at] === "E") {
			at += 1;
			if (source[at] === "+" || source[at] === "-") at += 1;
			digits();
		}
		if (source[at] === "n") at += 1;
		return at;
	}

	/** Updates the position flags after an identifier or keyword. */
	afterIdentifier(token: Token): void {
		let member = this.beforeLast !== null && isMemberAccess(this.beforeLast);
		if (member) {
			this.expression = false;
			this.block = false;
			return;
		}
		this.expression = EXPRESSION_KEYWORDS.has(token.value);
		this.block = !OBJECT_AFTER.has(token.value);
	}

	/** Reads a quoted string; a raw line break inside one is an unterminated string. */
	string(start: number, quote: number): CodemodError | null {
		let source = this.source;
		let at = start + 1;
		while (at < source.length) {
			let code = source.charCodeAt(at);
			if (code === quote) break;
			if (code === 92) {
				at += source.charCodeAt(at + 1) === 13 && source.charCodeAt(at + 2) === 10 ? 3 : 2;
				continue;
			}
			if (code === 10 || code === 13) break;
			at += 1;
		}
		if (source.charCodeAt(at) !== quote) {
			return this.fail("unterminated", "string is never closed", start);
		}
		this.pos = at + 1;
		this.push("string", start, this.pos);
		this.expression = false;
		this.block = true;
		return null;
	}

	/**
	 * Reads template text from a backtick (`opening`) or from the `}` that ends a substitution,
	 * up to the closing backtick or the next `${`, which pushes a template frame.
	 */
	template(start: number, opening: boolean): CodemodError | null {
		let source = this.source;
		let at = start + 1;
		while (at < source.length) {
			let code = source.charCodeAt(at);
			if (code === 92) {
				at += 2;
				continue;
			}
			if (code === 96) {
				this.pos = at + 1;
				if (!opening) this.stack.pop();
				this.push(opening ? "template" : "template-tail", start, this.pos);
				this.expression = false;
				this.block = false;
				return null;
			}
			if (code === 36 && source.charCodeAt(at + 1) === 123) {
				this.pos = at + 2;
				if (opening) this.stack.push(this.frame("template", start));
				this.push(opening ? "template-head" : "template-middle", start, this.pos);
				this.expression = true;
				this.block = false;
				return null;
			}
			at += 1;
		}
		let open = opening ? start : (this.stack[this.stack.length - 1]?.start ?? start);
		return this.fail("unterminated", "template literal is never closed", open);
	}

	/** Reads a regular expression literal and its flags. */
	regex(start: number): CodemodError | null {
		let source = this.source;
		let at = start + 1;
		let inClass = false;
		while (at < source.length) {
			let code = source.charCodeAt(at);
			if (isLineBreak(code)) break;
			if (code === 92) {
				if (isLineBreak(source.charCodeAt(at + 1))) break;
				at += 2;
				continue;
			}
			if (code === 91) inClass = true;
			else if (code === 93) inClass = false;
			else if (code === 47 && !inClass) {
				this.pos = this.identifierEnd(at + 1);
				this.push("regex", start, this.pos);
				this.expression = false;
				this.block = false;
				return null;
			}
			at += 1;
		}
		return this.fail("unterminated", "regular expression is never closed", start);
	}

	/**
	 * Whether the `<` at `start` opens type parameters rather than a JSX element: a generic
	 * arrow head (`<T,>`, `<T extends …>`, `<const T,>`, `<T = …>`), or a generic function type
	 * (`<T>(x: T) => T`), whose parameter list is followed by `=>`.
	 */
	genericArrowHead(start: number): boolean {
		if (!this.language.typescript) return false;
		let head = this.source.slice(start, start + 200);
		if (/^<\s*(?:const\s+)?[A-Za-z_$][\w$]*\s*(?:,|=|extends\s)/.test(head)) return true;
		let single = /^<\s*[A-Za-z_$][\w$]*\s*>\s*\(/.exec(head);
		if (single === null) return false;
		let level = 0;
		for (let at = start + single[0].length - 1; at < this.source.length; at += 1) {
			let char = this.source[at];
			if (char === "(") level += 1;
			else if (char === ")") {
				level -= 1;
				if (level === 0) return /^\)\s*=>/.test(this.source.slice(at, at + 40));
			} else if (char === "<" || char === "\n") return false;
		}
		return false;
	}

	/** Reads a punctuator, pushing and popping bracket frames. */
	punctuator(start: number): CodemodError | null {
		let source = this.source;
		let three = source.slice(start, start + 3);
		let two = source.slice(start, start + 2);
		let value: string;
		if (PUNCTUATORS_3.has(three)) value = three;
		else if (PUNCTUATORS_2.has(two) && !(two === "?." && isDigit(source.charCodeAt(start + 2))))
			value = two;
		else if (PUNCTUATORS_1.has(source[start] ?? "")) value = source[start] ?? "";
		else
			return this.fail("unexpected-character", `unexpected character \`${source[start]}\``, start);

		let wasExpression = this.expression;
		let closedBlock = false;
		let closedControl = false;

		if (value === "}") {
			let top = this.stack[this.stack.length - 1];
			if (top?.type === "template") return this.template(start, false);
			if (top?.type === "jsx-expression") {
				this.stack.pop();
				this.pos = start + 1;
				this.push("punctuator", start, this.pos);
				return null;
			}
			if (top?.type !== "brace") return this.fail("unbalanced", "unexpected `}`", start);
			closedBlock = top.block;
			this.stack.pop();
		} else if (value === ")") {
			let top = this.stack[this.stack.length - 1];
			if (top?.type !== "paren") return this.fail("unbalanced", "unexpected `)`", start);
			closedControl = top.control;
			this.stack.pop();
		} else if (value === "]") {
			let top = this.stack[this.stack.length - 1];
			if (top?.type !== "bracket") return this.fail("unbalanced", "unexpected `]`", start);
			this.stack.pop();
		} else if (value === "(") {
			let frame = this.frame("paren", start);
			frame.control = this.controlHead();
			this.stack.push(frame);
		} else if (value === "[") {
			this.stack.push(this.frame("bracket", start));
		} else if (value === "{") {
			let frame = this.frame("brace", start);
			frame.block = this.block;
			this.stack.push(frame);
		}

		this.pos = start + value.length;
		this.push("punctuator", start, this.pos);

		if (value === ")") this.expression = closedControl;
		else if (value === "}") this.expression = closedBlock;
		else if (value === "]") this.expression = false;
		else if (value === "++" || value === "--") this.expression = wasExpression;
		else if (value === "!" && this.language.typescript) this.expression = wasExpression;
		else this.expression = true;

		if (value === ";" || value === ")" || value === "}" || value === "=>" || value === "{") {
			this.block = true;
		} else if (value === ":") {
			let top = this.stack[this.stack.length - 1];
			this.block = top === undefined || (top.type === "brace" && top.block);
		} else {
			this.block = false;
		}
		return null;
	}

	/** Whether the `(` being read opens an `if`, `while`, `for` or `with` head. */
	controlHead(): boolean {
		let last = this.last;
		if (last === null || last.type !== "identifier") return false;
		if (last.value === "await") {
			return this.beforeLast?.type === "identifier" && this.beforeLast.value === "for";
		}
		if (!CONTROL_HEADS.has(last.value)) return false;
		return this.beforeLast === null || !isMemberAccess(this.beforeLast);
	}

	/**
	 * Reads inside a JSX opening or closing tag: names, `=`, attribute strings (which have no
	 * escapes), comments, and `{` into code. Returns after each step that changes the stack.
	 */
	jsxTag(frame: Frame): CodemodError | null {
		let source = this.source;
		while (true) {
			let error = this.trivia();
			if (error !== null) return error;
			let start = this.pos;
			if (start >= source.length) {
				return this.fail("unterminated", "JSX element is never closed", frame.start);
			}
			let code = source.charCodeAt(start);
			if (code === 62) {
				this.pos = start + 1;
				this.push("jsx", start, this.pos);
				this.stack.pop();
				if (frame.closing) {
					let children = this.stack.pop();
					if (children?.type !== "jsx-children") {
						return this.fail("unbalanced", "closing tag without an element", start);
					}
					this.elementEnded();
				} else {
					this.stack.push(this.frame("jsx-children", frame.start));
				}
				return null;
			}
			if (code === 47 && source.charCodeAt(start + 1) === 62 && !frame.closing) {
				this.pos = start + 2;
				this.push("jsx", start, this.pos);
				this.stack.pop();
				this.elementEnded();
				return null;
			}
			if (code === 123) {
				this.pos = start + 1;
				this.push("punctuator", start, this.pos);
				this.stack.push(this.frame("jsx-expression", start));
				this.expression = true;
				this.block = false;
				return null;
			}
			if (code === 60) {
				this.pos = start + 1;
				this.push("jsx", start, this.pos);
				this.stack.push(this.frame("jsx-tag", start));
				return null;
			}
			if (code === 34 || code === 39) {
				let close = source.indexOf(source[start] ?? "", start + 1);
				if (close === -1) return this.fail("unterminated", "JSX attribute is never closed", start);
				this.pos = close + 1;
				this.push("jsx", start, this.pos);
				continue;
			}
			if (code === 61) {
				this.pos = start + 1;
				this.push("jsx", start, this.pos);
				continue;
			}
			if (isJsxNamePart(code)) {
				let at = start + 1;
				while (at < source.length && isJsxNamePart(source.charCodeAt(at))) at += 1;
				this.pos = at;
				this.push("jsx", start, at);
				continue;
			}
			return this.fail(
				"unexpected-character",
				`unexpected character \`${source[start]}\` in a JSX tag`,
				start,
			);
		}
	}

	/** Reads JSX text up to the next `{` or `<`, then enters code or a tag. */
	jsxChildren(): CodemodError | null {
		let source = this.source;
		let start = this.pos;
		let at = start;
		while (at < source.length) {
			let code = source.charCodeAt(at);
			if (code === 123 || code === 60) break;
			at += 1;
		}
		if (at > start) {
			this.push("jsx", start, at);
			this.pos = at;
		}
		if (at >= source.length) {
			let open = this.stack[this.stack.length - 1];
			return this.fail("unterminated", "JSX element is never closed", open?.start ?? start);
		}
		if (source.charCodeAt(at) === 123) {
			this.pos = at + 1;
			this.push("punctuator", at, this.pos);
			this.stack.push(this.frame("jsx-expression", at));
			this.expression = true;
			this.block = false;
			return null;
		}
		let after = at + 1;
		while (after < source.length && /\s/.test(source[after] ?? "")) after += 1;
		let frame = this.frame("jsx-tag", at);
		if (source.charCodeAt(after) === 47) {
			frame.closing = true;
			this.pos = after + 1;
		} else {
			this.pos = at + 1;
		}
		this.push("jsx", at, this.pos);
		this.stack.push(frame);
		return null;
	}

	/** After an element closes: an element back in code position ends an expression. */
	elementEnded(): void {
		let top = this.stack[this.stack.length - 1];
		if (top?.type === "jsx-tag" || top?.type === "jsx-children") return;
		this.expression = false;
		this.block = false;
	}
}

/** Whether `token` is `.` or `?.`, so the identifier after it is a property name. */
function isMemberAccess(token: Token): boolean {
	return token.type === "punctuator" && (token.value === "." || token.value === "?.");
}
