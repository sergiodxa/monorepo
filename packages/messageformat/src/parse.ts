/**
 * A recursive-descent parser for the full Unicode MessageFormat 2 syntax, producing the
 * data model and then validating it, so a message that parses is ready to format and a
 * broken one is rejected with the specification's error name and the offset it starts at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure } from "@sdxc/result";

import type {
	Attributes,
	CatchallKey,
	Declaration,
	Expression,
	FunctionRef,
	Literal,
	Markup,
	MessageData,
	Options,
	Pattern,
	VariableExpression,
	VariableRef,
} from "./data-model.js";

import { MessageError } from "./errors.js";
import { validate } from "./validate.js";

/**
 * Parses MessageFormat 2 source into its data model. The failure is a {@link MessageError}
 * whose `type` is `syntax-error` (with `start` at the offending offset) or one of the data
 * model errors, such as `duplicate-declaration` or `missing-fallback-variant`.
 *
 * @example parse(".input {$n :number}\n.match $n\none {{One}}\n* {{{$n} items}}");
 */
export function parse(source: string): Result<MessageData, MessageError> {
	let parser = new Parser(source);
	let message: MessageData;
	try {
		message = parser.message();
	} catch (error) {
		if (error instanceof MessageError) return failure(error);
		throw error;
	}
	if (parser.deferred) return failure(parser.deferred);
	return validate(message);
}

/** True for the whitespace the grammar's `ws` rule accepts. */
function isWhitespace(code: number) {
	return code === 0x20 || code === 0x09 || code === 0x0d || code === 0x0a || code === 0x3000;
}

/** True for the ALM, LRM, RLM and isolate controls the grammar's `bidi` rule accepts. */
function isBidi(code: number) {
	return (
		code === 0x061c || code === 0x200e || code === 0x200f || (code >= 0x2066 && code <= 0x2069)
	);
}

/**
 * The grammar's `name-start`: letters, `+`, `_` and most of Unicode, minus whitespace,
 * bidi controls, surrogates and noncharacters.
 */
function isNameStart(code: number) {
	if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) return true;
	if (code === 0x2b || code === 0x5f) return true;
	if (code < 0xa1 || code > 0x10fffd) return false;
	if (code === 0x061c || code === 0x1680 || code === 0x205f || code === 0x3000) return false;
	if (code >= 0x2000 && code <= 0x200a) return false;
	if (code === 0x200e || code === 0x200f) return false;
	if (code >= 0x2028 && code <= 0x202f) return false;
	if (code >= 0x2066 && code <= 0x2069) return false;
	if (code >= 0xd800 && code <= 0xdfff) return false;
	if (code >= 0xfdd0 && code <= 0xfdef) return false;
	return (code & 0xfffe) !== 0xfffe;
}

/** The grammar's `name-char`: a `name-start`, a digit, `-` or `.`. */
function isNameChar(code: number) {
	return isNameStart(code) || (code >= 0x30 && code <= 0x39) || code === 0x2d || code === 0x2e;
}

/** True for a UTF-16 surrogate, which reaches the parser only when unpaired. */
function isSurrogate(code: number) {
	return code >= 0xd800 && code <= 0xdfff;
}

/**
 * Parser state over one source string. Failures are raised as {@link MessageError} and
 * caught by {@link parse}, the only caller; a duplicate option name is held in `deferred`
 * so a later syntax error in the same message takes priority over it.
 */
class Parser {
	readonly #source: string;
	#pos = 0;
	/** The first duplicate option name found, reported once the whole message parses. */
	deferred: MessageError | undefined;

	/** @param source The message source. */
	constructor(source: string) {
		this.#source = source;
	}

	/** Parses the whole source as a simple or complex message. */
	message(): MessageData {
		this.#skipOptional();
		if (this.#at(".") || this.#at("{{")) return this.#complexMessage();
		this.#pos = 0;
		let pattern = this.#pattern();
		if (this.#pos < this.#source.length) this.#fail("Unexpected `}` in text");
		return { type: "message", declarations: [], pattern };
	}

	/** Declarations followed by a quoted pattern or a matcher, then only whitespace. */
	#complexMessage(): MessageData {
		let declarations: Declaration[] = [];
		let message: MessageData | undefined;
		while (message === undefined) {
			this.#skipOptional();
			if (this.#at(".input")) {
				this.#pos += 6;
				this.#skipOptional();
				let value = this.#expression();
				if (value.arg?.type !== "variable") this.#fail("`.input` requires a variable expression");
				declarations.push({
					type: "input",
					name: value.arg.name,
					value: value as VariableExpression,
				});
			} else if (this.#at(".local")) {
				this.#pos += 6;
				this.#requireSpace();
				let variable = this.#variable();
				this.#skipOptional();
				this.#expect("=");
				this.#skipOptional();
				declarations.push({ type: "local", name: variable.name, value: this.#expression() });
			} else if (this.#at(".match")) {
				message = this.#matcher(declarations);
			} else if (this.#at("{{")) {
				message = { type: "message", declarations, pattern: this.#quotedPattern() };
			} else {
				this.#fail("Expected a declaration, `.match` or a quoted pattern");
			}
		}
		this.#skipOptional();
		if (this.#pos < this.#source.length) this.#fail("Unexpected content after the message body");
		return message;
	}

	/** `.match` with its selectors and variants. */
	#matcher(declarations: Declaration[]): MessageData {
		this.#pos += 6;
		let selectors: VariableRef[] = [];
		for (;;) {
			let start = this.#pos;
			if (this.#trySpace() && this.#at("$")) selectors.push(this.#variable());
			else {
				this.#pos = start;
				break;
			}
		}
		if (selectors.length === 0) this.#fail("`.match` requires at least one selector");
		this.#requireSpace();
		let variants = [this.#variant()];
		for (;;) {
			let start = this.#pos;
			this.#skipOptional();
			if (this.#isKeyStart()) variants.push(this.#variant());
			else {
				this.#pos = start;
				break;
			}
		}
		return { type: "select", declarations, selectors, variants };
	}

	/** One or more keys separated by whitespace, then a quoted pattern. */
	#variant() {
		let keys = [this.#key()];
		for (;;) {
			let start = this.#pos;
			if (this.#trySpace() && this.#isKeyStart()) keys.push(this.#key());
			else {
				this.#pos = start;
				break;
			}
		}
		this.#skipOptional();
		return { keys, value: this.#quotedPattern() };
	}

	/** True when the next character can start a variant key. */
	#isKeyStart() {
		let code = this.#peek();
		return code === 0x2a || code === 0x7c || (code !== undefined && isNameChar(code));
	}

	/** A literal key or the `*` catch-all. */
	#key(): Literal | CatchallKey {
		if (this.#at("*")) {
			this.#pos += 1;
			return { type: "*" };
		}
		return this.#literal();
	}

	/** `{{…}}` */
	#quotedPattern(): Pattern {
		this.#expect("{{");
		let pattern = this.#pattern();
		this.#expect("}}");
		return pattern;
	}

	/** Text, escapes and placeholders up to the end of input or the first unescaped `}`. */
	#pattern(): Pattern {
		let pattern: Pattern = [];
		let text = "";
		for (;;) {
			let code = this.#peek();
			if (code === undefined || code === 0x7d) break;
			if (code === 0x7b) {
				if (text) pattern.push(text);
				text = "";
				pattern.push(this.#placeholder());
			} else if (code === 0x5c) text += this.#escape();
			else text += this.#textChar();
		}
		if (text) pattern.push(text);
		return pattern;
	}

	/** One character of text or of a quoted literal, rejecting NULL and lone surrogates. */
	#textChar() {
		let code = this.#source.codePointAt(this.#pos) ?? 0;
		if (code === 0 || isSurrogate(code)) this.#fail("Invalid character");
		let char = String.fromCodePoint(code);
		this.#pos += char.length;
		return char;
	}

	/** `\\`, `\{`, `\|` or `\}`. */
	#escape() {
		let char = this.#source[this.#pos + 1];
		if (char !== "\\" && char !== "{" && char !== "|" && char !== "}") {
			this.#fail("Invalid escape sequence");
		}
		this.#pos += 2;
		return char;
	}

	/** An expression or markup in braces. */
	#placeholder(): Expression | Markup {
		let start = this.#pos;
		this.#expect("{");
		this.#skipOptional();
		if (this.#at("#") || this.#at("/")) return this.#markup();
		this.#pos = start;
		return this.#expression();
	}

	/** A literal, variable or function expression in braces, with its attributes. */
	#expression(): Expression {
		this.#expect("{");
		this.#skipOptional();
		let arg: Literal | VariableRef | undefined;
		let fn: FunctionRef | undefined;
		if (this.#at("$")) arg = this.#variable();
		else if (this.#at(":")) fn = this.#function();
		else if (this.#at("#") || this.#at("/")) this.#fail("Markup is not allowed here");
		else arg = this.#literal();
		let attributes: Attributes = {};
		let hasAttributes = false;
		for (;;) {
			let start = this.#pos;
			if (!this.#trySpace()) break;
			if (this.#at(":") && !fn && !hasAttributes) fn = this.#function();
			else if (this.#at("@")) {
				let [name, value] = this.#attribute();
				defineEntry(attributes, name, value);
				hasAttributes = true;
			} else {
				this.#pos = start;
				break;
			}
		}
		this.#skipOptional();
		this.#expect("}");
		let expression = { type: "expression", attributes } as Expression;
		if (arg) expression.arg = arg as never;
		if (fn) expression.function = fn;
		return expression;
	}

	/** `{#name …}`, `{#name …/}` or `{/name …}`, after the opening brace and whitespace. */
	#markup(): Markup {
		let close = this.#at("/");
		this.#pos += 1;
		let name = this.#identifier();
		let options = this.#options();
		let attributes: Attributes = {};
		for (;;) {
			let start = this.#pos;
			if (this.#trySpace() && this.#at("@")) {
				let [key, value] = this.#attribute();
				defineEntry(attributes, key, value);
			} else {
				this.#pos = start;
				break;
			}
		}
		this.#skipOptional();
		let kind: Markup["kind"] = close ? "close" : "open";
		if (!close && this.#at("/")) {
			this.#pos += 1;
			kind = "standalone";
		}
		this.#expect("}");
		return { type: "markup", kind, name, options, attributes };
	}

	/** `:identifier` followed by its options. */
	#function(): FunctionRef {
		this.#pos += 1;
		let name = this.#identifier();
		return { type: "function", name, options: this.#options() };
	}

	/** Whitespace-separated `name=value` options, recording the first duplicate name. */
	#options(): Options {
		let options: Options = {};
		for (;;) {
			let start = this.#pos;
			let code = this.#trySpace() ? this.#peek() : undefined;
			if (code === undefined || !isNameStart(code)) {
				this.#pos = start;
				return options;
			}
			let at = this.#pos;
			let name = this.#identifier();
			this.#skipOptional();
			this.#expect("=");
			this.#skipOptional();
			let value = this.#at("$") ? this.#variable() : this.#literal();
			if (Object.hasOwn(options, name)) {
				this.deferred ??= new MessageError(
					"duplicate-option-name",
					`Duplicate option name \`${name}\``,
					{ start: at },
				);
			}
			defineEntry(options, name, value);
		}
	}

	/** `@name` with an optional `= literal`. */
	#attribute(): [string, Literal | true] {
		this.#pos += 1;
		let name = this.#identifier();
		let start = this.#pos;
		this.#skipOptional();
		if (!this.#at("=")) {
			this.#pos = start;
			return [name, true];
		}
		this.#pos += 1;
		this.#skipOptional();
		return [name, this.#literal()];
	}

	/** `$name` */
	#variable(): VariableRef {
		this.#expect("$");
		return { type: "variable", name: this.#name() };
	}

	/** A quoted `|…|` or unquoted literal. */
	#literal(): Literal {
		if (!this.#at("|")) {
			let start = this.#pos;
			while (isNameChar(this.#peek() ?? -1)) this.#advance();
			if (start === this.#pos) this.#fail("Expected a literal");
			return { type: "literal", value: this.#source.slice(start, this.#pos) };
		}
		this.#pos += 1;
		let value = "";
		for (;;) {
			let code = this.#peek();
			if (code === undefined) this.#fail("Unterminated quoted literal");
			if (code === 0x7c) break;
			value += code === 0x5c ? this.#escape() : this.#textChar();
		}
		this.#pos += 1;
		return { type: "literal", value };
	}

	/** `namespace:name` or `name`. */
	#identifier() {
		let name = this.#name();
		if (!this.#at(":")) return name;
		this.#pos += 1;
		return `${name}:${this.#name()}`;
	}

	/** A name with its optional surrounding bidi marks dropped, normalized to NFC. */
	#name() {
		if (isBidi(this.#peek() ?? -1)) this.#pos += 1;
		let start = this.#pos;
		if (!isNameStart(this.#peek() ?? -1)) this.#fail("Expected a name");
		while (isNameChar(this.#peek() ?? -1)) this.#advance();
		let name = this.#source.slice(start, this.#pos).normalize("NFC");
		if (isBidi(this.#peek() ?? -1)) this.#pos += 1;
		return name;
	}

	/** The grammar's `s`: bidi marks, at least one whitespace, then `o`; restores on miss. */
	#trySpace() {
		let start = this.#pos;
		while (isBidi(this.#peek() ?? -1)) this.#pos += 1;
		if (!isWhitespace(this.#peek() ?? -1)) {
			this.#pos = start;
			return false;
		}
		this.#skipOptional();
		return true;
	}

	/** Like {@link Parser.#trySpace} but fails when the whitespace is missing. */
	#requireSpace() {
		if (!this.#trySpace()) this.#fail("Expected whitespace");
	}

	/** The grammar's `o`: any whitespace and bidi marks. */
	#skipOptional() {
		for (;;) {
			let code = this.#peek();
			if (code === undefined || !(isWhitespace(code) || isBidi(code))) return;
			this.#pos += 1;
		}
	}

	/** The code point at the cursor, or `undefined` at the end. */
	#peek() {
		return this.#source.codePointAt(this.#pos);
	}

	/** Moves past the code point at the cursor. */
	#advance() {
		this.#pos += (this.#peek() ?? 0) > 0xffff ? 2 : 1;
	}

	/** True when the source continues with `text` at the cursor. */
	#at(text: string) {
		return this.#source.startsWith(text, this.#pos);
	}

	/** Consumes `text` or fails. */
	#expect(text: string) {
		if (!this.#at(text)) this.#fail(`Expected \`${text}\``);
		this.#pos += text.length;
	}

	/** Raises a syntax error at the cursor. */
	#fail(message: string): never {
		throw new MessageError("syntax-error", `${message} at offset ${this.#pos}`, {
			start: this.#pos,
		});
	}
}

/**
 * Adds an own enumerable property, so a name such as `__proto__` becomes a plain entry
 * of the options or attributes record.
 */
function defineEntry<T>(record: Record<string, T>, name: string, value: T) {
	Object.defineProperty(record, name, {
		value,
		enumerable: true,
		writable: true,
		configurable: true,
	});
}
