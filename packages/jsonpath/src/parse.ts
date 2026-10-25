/**
 * Reads RFC 9535 query text into its syntax tree, enforcing the ABNF of section 2, the
 * I-JSON integer range, and the well-typedness of function expressions from section 2.4.3,
 * so every query the tree describes has one defined result.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type {
	Argument,
	Comparable,
	ComparisonOperator,
	FunctionCall,
	FunctionType,
	JSONValue,
	LogicalExpression,
	Query,
	Segment,
	Selector,
} from "./ast.js";

import { JsonPathSyntaxError } from "./error.js";

/** The largest integer an index or slice bound may hold, the I-JSON exact-integer limit. */
const MAX_INTEGER = 2 ** 53 - 1;

/** Signatures of the five function extensions section 2.4 defines. */
const FUNCTIONS: Record<FunctionCall["name"], { params: FunctionType[]; result: FunctionType }> = {
	length: { params: ["value"], result: "value" },
	count: { params: ["nodes"], result: "value" },
	match: { params: ["value", "value"], result: "logical" },
	search: { params: ["value", "value"], result: "logical" },
	value: { params: ["nodes"], result: "value" },
};

/** Comparison operators, two-character ones first so `<=` is not read as `<`. */
const COMPARISON_OPERATORS: ComparisonOperator[] = ["==", "!=", "<=", ">=", "<", ">"];

/** A number literal of section 2.3.5.1, which unlike an index admits `-0`, a fraction and an exponent. */
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?/y;

/** A function name or the `true`, `false` and `null` keywords, which share its first characters. */
const IDENTIFIER = /[a-z][a-z0-9_]*/y;

/** The escapes a string literal may use besides `\uXXXX` and the escaped quote. */
const ESCAPES: Record<string, string> = {
	b: "\b",
	f: "\f",
	n: "\n",
	r: "\r",
	t: "\t",
	"/": "/",
	"\\": "\\",
};

/** Parse result shorthand. */
type Parsed<T> = Result<T, JsonPathSyntaxError>;

/**
 * Parses a complete query: `$`, its segments, and nothing after them, not even whitespace.
 *
 * @param text - The query text.
 * @returns The syntax tree, or where and why the text is not a valid query.
 */
export function parseQuery(text: string): Parsed<Query> {
	let parser = new Parser(text);
	if (parser.peek() !== "$") return parser.fail("A JSONPath query starts with '$'");
	let query = parser.query();
	if (isFailure(query)) return query;
	if (parser.pos !== text.length) return parser.fail("Unexpected character");
	return query;
}

/** Whether a query selects at most one node: only single-name or single-index child segments. */
export function isSingular(query: Query): boolean {
	return query.segments.every(
		(segment) =>
			!segment.descendant &&
			segment.selectors.length === 1 &&
			(segment.selectors[0]?.type === "name" || segment.selectors[0]?.type === "index"),
	);
}

/** A recursive-descent reader over the query text; `pos` is a UTF-16 offset. */
class Parser {
	pos = 0;

	constructor(readonly text: string) {}

	/** The UTF-16 unit `offset` ahead, or `""` past the end. */
	peek(offset = 0): string {
		return this.text[this.pos + offset] ?? "";
	}

	/** Skips the blank characters of section 2.1.1: space, tab, line feed and carriage return. */
	skipBlank(): void {
		while (" \t\n\r".includes(this.peek()) && this.peek() !== "") this.pos++;
	}

	/** The failure at the current position. */
	fail(message: string): Result<never, JsonPathSyntaxError> {
		return failure(new JsonPathSyntaxError(this.pos, message));
	}

	/** A root identifier (`$` or `@`) and every segment after it. */
	query(): Parsed<Query> {
		let root = this.peek();
		if (root !== "$" && root !== "@") return this.fail("Expected '$' or '@'");
		this.pos++;
		let segments: Segment[] = [];
		for (;;) {
			let start = this.pos;
			this.skipBlank();
			let segment = this.segment();
			if (segment === null) {
				this.pos = start;
				break;
			}
			if (isFailure(segment)) return segment;
			segments.push(segment.data);
		}
		return success({ root, segments });
	}

	/** A child or descendant segment, or `null` when none starts here. */
	segment(): Parsed<Segment> | null {
		if (this.peek() === "[") return this.bracketed(false);
		if (this.peek() !== ".") return null;
		let descendant = this.peek(1) === ".";
		this.pos += descendant ? 2 : 1;
		if (descendant && this.peek() === "[") return this.bracketed(true);
		if (this.peek() === "*") {
			this.pos++;
			return success({ descendant, selectors: [{ type: "wildcard" }] });
		}
		let name = this.memberName();
		if (isFailure(name)) return name;
		return success({ descendant, selectors: [{ type: "name", name: name.data }] });
	}

	/** `[` selectors separated by commas `]`, with blanks allowed around each selector. */
	bracketed(descendant: boolean): Parsed<Segment> {
		this.pos++;
		let selectors: Selector[] = [];
		for (;;) {
			this.skipBlank();
			let selector = this.selector();
			if (isFailure(selector)) return selector;
			selectors.push(selector.data);
			this.skipBlank();
			if (this.peek() === ",") {
				this.pos++;
				continue;
			}
			if (this.peek() === "]") {
				this.pos++;
				return success({ descendant, selectors });
			}
			return this.fail("Expected ',' or ']'");
		}
	}

	/** A name, wildcard, index, slice or filter selector. */
	selector(): Parsed<Selector> {
		let c = this.peek();
		if (c === "'" || c === '"') {
			let name = this.stringLiteral();
			if (isFailure(name)) return name;
			return success({ type: "name", name: name.data });
		}
		if (c === "*") {
			this.pos++;
			return success({ type: "wildcard" });
		}
		if (c === "?") {
			this.pos++;
			this.skipBlank();
			let expression = this.logicalOr();
			if (isFailure(expression)) return expression;
			return success({ type: "filter", expression: expression.data });
		}
		return this.indexOrSlice();
	}

	/** An index, or a slice `start:end:step` whose three parts are each optional. */
	indexOrSlice(): Parsed<Selector> {
		let start = this.integer();
		if (isFailure(start)) return start;
		let afterStart = this.pos;
		this.skipBlank();
		if (this.peek() !== ":") {
			if (start.data === null) return this.fail("Expected a selector");
			this.pos = afterStart;
			return success({ type: "index", index: start.data });
		}
		this.pos++;
		this.skipBlank();
		let end = this.integer();
		if (isFailure(end)) return end;
		let afterEnd = this.pos;
		this.skipBlank();
		let step: number | null = null;
		if (this.peek() === ":") {
			this.pos++;
			this.skipBlank();
			let read = this.integer();
			if (isFailure(read)) return read;
			step = read.data;
		} else {
			this.pos = afterEnd;
		}
		return success({ type: "slice", start: start.data, end: end.data, step });
	}

	/** An `int` of section 2.3.3: no leading zeros, no `-0`, within ±(2^53 − 1); `null` when absent. */
	integer(): Parsed<number | null> {
		let start = this.pos;
		if (this.peek() === "-") this.pos++;
		let digits = this.pos;
		while (this.peek() >= "0" && this.peek() <= "9" && this.peek() !== "") this.pos++;
		let text = this.text.slice(digits, this.pos);
		if (text === "") {
			if (this.pos === start) return success(null);
			return this.fail("Expected a digit after '-'");
		}
		if (text.length > 1 && text.startsWith("0"))
			return this.fail("An integer has no leading zeros");
		if (text === "0" && digits > start) return this.fail("'-0' is not an integer");
		let value = Number(this.text.slice(start, this.pos));
		if (Math.abs(value) > MAX_INTEGER) {
			this.pos = start;
			return this.fail("The integer is outside the I-JSON range");
		}
		return success(value);
	}

	/** A `member-name-shorthand`: a letter, `_` or non-ASCII character, then those or digits. */
	memberName(): Parsed<string> {
		let start = this.pos;
		for (;;) {
			let code = this.text.codePointAt(this.pos);
			if (code === undefined) break;
			let isDigit = code >= 0x30 && code <= 0x39;
			let isFirst =
				(code >= 0x41 && code <= 0x5a) ||
				(code >= 0x61 && code <= 0x7a) ||
				code === 0x5f ||
				(code >= 0x80 && (code < 0xd800 || code > 0xdfff));
			if (!isFirst && !(isDigit && this.pos > start)) break;
			this.pos += code > 0xffff ? 2 : 1;
		}
		if (this.pos === start) return this.fail("Expected a member name");
		return success(this.text.slice(start, this.pos));
	}

	/** A single- or double-quoted string literal of section 2.3.1.1, unescaped. */
	stringLiteral(): Parsed<string> {
		let quote = this.peek();
		this.pos++;
		let value = "";
		for (;;) {
			let code = this.text.codePointAt(this.pos);
			if (code === undefined) return this.fail("Unterminated string literal");
			let char = String.fromCodePoint(code);
			if (char === quote) {
				this.pos++;
				return success(value);
			}
			if (char === "\\") {
				let escaped = this.escape(quote);
				if (isFailure(escaped)) return escaped;
				value += escaped.data;
				continue;
			}
			if (code < 0x20) return this.fail("A control character must be escaped");
			if (code >= 0xd800 && code <= 0xdfff) return this.fail("A string holds a lone surrogate");
			value += char;
			this.pos += char.length;
		}
	}

	/** One escape sequence, the cursor on its backslash; only the literal's own quote is escapable. */
	escape(quote: string): Parsed<string> {
		let c = this.peek(1);
		this.pos += 2;
		if (c === quote) return success(c);
		if (c !== "u") {
			let mapped = ESCAPES[c];
			if (mapped === undefined) return this.fail("Invalid escape sequence");
			return success(mapped);
		}
		let unit = this.hex4();
		if (unit === null) return this.fail("Expected four hex digits");
		if (unit >= 0xdc00 && unit <= 0xdfff)
			return this.fail("A low surrogate needs a high one first");
		if (unit < 0xd800 || unit > 0xdbff) return success(String.fromCharCode(unit));
		if (this.peek() !== "\\" || this.peek(1) !== "u")
			return this.fail("A high surrogate needs a low one");
		this.pos += 2;
		let low = this.hex4();
		if (low === null || low < 0xdc00 || low > 0xdfff) return this.fail("Expected a low surrogate");
		return success(String.fromCharCode(unit, low));
	}

	/** Four hex digits in either case, or `null` when they are not there. */
	hex4(): number | null {
		let digits = this.text.slice(this.pos, this.pos + 4);
		if (!/^[0-9a-fA-F]{4}$/.test(digits)) return null;
		this.pos += 4;
		return Number.parseInt(digits, 16);
	}

	/** `logical-or-expr`: and-expressions joined by `||`. */
	logicalOr(): Parsed<LogicalExpression> {
		return this.joined("||", "or", () => this.logicalAnd());
	}

	/** `logical-and-expr`: basic expressions joined by `&&`. */
	logicalAnd(): Parsed<LogicalExpression> {
		return this.joined("&&", "and", () => this.basic());
	}

	/** Operands read by `next` and joined by `operator`, collapsed to the operand when alone. */
	joined(
		operator: string,
		type: "or" | "and",
		next: () => Parsed<LogicalExpression>,
	): Parsed<LogicalExpression> {
		let first = next();
		if (isFailure(first)) return first;
		let operands = [first.data];
		for (;;) {
			let start = this.pos;
			this.skipBlank();
			if (!this.text.startsWith(operator, this.pos)) {
				this.pos = start;
				break;
			}
			this.pos += operator.length;
			this.skipBlank();
			let operand = next();
			if (isFailure(operand)) return operand;
			operands.push(operand.data);
		}
		if (operands.length === 1) return success(first.data);
		return success({ type, operands });
	}

	/** A parenthesized or negated expression, a comparison, or a test expression. */
	basic(): Parsed<LogicalExpression> {
		if (this.peek() === "!") {
			this.pos++;
			this.skipBlank();
			let operand = this.peek() === "(" ? this.parenthesized() : this.test();
			if (isFailure(operand)) return operand;
			return success({ type: "not", operand: operand.data });
		}
		if (this.peek() === "(") return this.parenthesized();

		let start = this.pos;
		let left = this.operand();
		if (isFailure(left)) return left;
		this.skipBlank();
		let operator = COMPARISON_OPERATORS.find((op) => this.text.startsWith(op, this.pos));
		if (operator === undefined) {
			this.pos = start;
			return this.test();
		}
		this.pos += operator.length;
		this.skipBlank();
		let rightStart = this.pos;
		let right = this.operand();
		if (isFailure(right)) return right;
		let leftCheck = this.comparable(left.data, start);
		if (isFailure(leftCheck)) return leftCheck;
		let rightCheck = this.comparable(right.data, rightStart);
		if (isFailure(rightCheck)) return rightCheck;
		return success({ type: "comparison", operator, left: leftCheck.data, right: rightCheck.data });
	}

	/** `( logical-expr )`. */
	parenthesized(): Parsed<LogicalExpression> {
		this.pos++;
		this.skipBlank();
		let inner = this.logicalOr();
		if (isFailure(inner)) return inner;
		this.skipBlank();
		if (this.peek() !== ")") return this.fail("Expected ')'");
		this.pos++;
		return inner;
	}

	/** A test expression: a filter query, or a function whose result is logical or a node list. */
	test(): Parsed<LogicalExpression> {
		let start = this.pos;
		let operand = this.operand();
		if (isFailure(operand)) return operand;
		if (operand.data.type === "query")
			return success({ type: "exists", query: operand.data.query });
		if (operand.data.type === "call" && FUNCTIONS[operand.data.name].result !== "value") {
			return success(operand.data);
		}
		this.pos = start;
		return this.fail("Expected a comparison or a test of a query or logical function");
	}

	/** The operand of a comparison or test: a literal, a query, or a function call. */
	operand(): Parsed<Comparable> {
		let c = this.peek();
		if (c === "@" || c === "$") {
			let query = this.query();
			if (isFailure(query)) return query;
			return success({ type: "query", query: query.data });
		}
		if (c === "'" || c === '"') {
			let value = this.stringLiteral();
			if (isFailure(value)) return value;
			return success({ type: "literal", value: value.data });
		}
		if (c === "-" || (c >= "0" && c <= "9" && c !== "")) return this.number();
		IDENTIFIER.lastIndex = this.pos;
		let match = IDENTIFIER.exec(this.text);
		if (match === null) return this.fail("Expected a literal, a query or a function call");
		let name = match[0];
		if (this.text[this.pos + name.length] === "(") return this.call(name);
		let literal: Record<string, JSONValue> = { true: true, false: false, null: null };
		if (!Object.hasOwn(literal, name)) return this.fail(`Unknown name '${name}'`);
		this.pos += name.length;
		return success({ type: "literal", value: literal[name] as JSONValue });
	}

	/** A number literal. */
	number(): Parsed<Comparable> {
		NUMBER.lastIndex = this.pos;
		let match = NUMBER.exec(this.text);
		if (match === null) return this.fail("Expected a number");
		this.pos += match[0].length;
		return success({ type: "literal", value: Number(match[0]) });
	}

	/** `name(arguments)`, with each argument checked against the function's declared parameter type. */
	call(name: string): Parsed<FunctionCall> {
		let start = this.pos;
		if (!Object.hasOwn(FUNCTIONS, name)) return this.fail(`Unknown function '${name}'`);
		let signature = FUNCTIONS[name as FunctionCall["name"]];
		this.pos += name.length + 1;
		this.skipBlank();
		let args: Argument[] = [];
		if (this.peek() !== ")") {
			for (;;) {
				let argumentStart = this.pos;
				let argument = this.argument();
				if (isFailure(argument)) return argument;
				let type = signature.params[args.length];
				if (type === undefined || !accepts(type, argument.data)) {
					this.pos = argumentStart;
					return this.fail(`Argument ${args.length + 1} of ${name}() has the wrong type`);
				}
				args.push(argument.data);
				this.skipBlank();
				if (this.peek() !== ",") break;
				this.pos++;
				this.skipBlank();
			}
		}
		if (this.peek() !== ")") return this.fail("Expected ',' or ')'");
		if (args.length !== signature.params.length) {
			this.pos = start;
			return this.fail(`${name}() takes ${signature.params.length} argument(s)`);
		}
		this.pos++;
		return success({ type: "call", name: name as FunctionCall["name"], args });
	}

	/** A function argument: a bare literal, query or call when one ends the argument, else a logical expression. */
	argument(): Parsed<Argument> {
		let start = this.pos;
		if (this.peek() !== "!" && this.peek() !== "(") {
			let operand = this.operand();
			if (!isFailure(operand)) {
				let end = this.pos;
				this.skipBlank();
				if (this.peek() === "," || this.peek() === ")") {
					this.pos = end;
					return success(operand.data);
				}
			}
			this.pos = start;
		}
		let expression = this.logicalOr();
		if (isFailure(expression)) return expression;
		return success({ type: "logical", expression: expression.data });
	}

	/** Checks a comparison operand: a literal, a singular query, or a function returning a value. */
	comparable(operand: Comparable, at: number): Parsed<Comparable> {
		if (operand.type === "query" && !isSingular(operand.query)) {
			return failure(new JsonPathSyntaxError(at, "A compared query must be singular"));
		}
		if (operand.type === "call" && FUNCTIONS[operand.name].result !== "value") {
			return failure(new JsonPathSyntaxError(at, `${operand.name}() does not return a value`));
		}
		return success(operand);
	}
}

/** Section 2.4.3's rules for which arguments a parameter of each type accepts. */
function accepts(type: FunctionType, argument: Argument): boolean {
	switch (type) {
		case "value":
			if (argument.type === "literal") return true;
			if (argument.type === "query") return isSingular(argument.query);
			return argument.type === "call" && FUNCTIONS[argument.name].result === "value";
		case "logical":
			if (argument.type === "logical" || argument.type === "query") return true;
			return argument.type === "call" && FUNCTIONS[argument.name].result !== "value";
		case "nodes":
			if (argument.type === "query") return true;
			return argument.type === "call" && FUNCTIONS[argument.name].result === "nodes";
	}
}
