/**
 * Reads the text form into the JSON form of the same language. `not` binds
 * over `and` over `or`, comparisons are infix, every other operator is a call,
 * and every path starts with `ctx.`, so `ctx.plan.tier == "pro"` reads as written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { StructuralName } from "./builtins.js";
import type { ExpressionError } from "./expression-error.js";
import type { Grammar, Node } from "./grammar.js";
import type { Token } from "./tokenize.js";

import { BUILTINS } from "./builtins.js";
import { syntaxError, tokenize } from "./tokenize.js";

/** The infix comparisons, by the built-in operator each one writes. */
export const COMPARISONS: Readonly<Record<string, string>> = {
	"==": "eq",
	"!=": "ne",
	"<": "lt",
	"<=": "lte",
	">": "gt",
	">=": "gte",
};

/** Words the text form reserves, which no operator or reference may be named. */
export const KEYWORDS: ReadonlySet<string> = new Set([
	"ctx",
	"and",
	"or",
	"not",
	"in",
	"true",
	"false",
	"null",
]);

/** Where each parsed node, and each of its literal fields, was written. */
interface Positions {
	nodes: WeakMap<object, number>;
	fields: WeakMap<object, Record<string, number>>;
}

/** A step of the parse: what it read, or why it stopped. */
type Step<T> = Result<T, ExpressionError>;

/**
 * Parses the text form of an expression, then validates what it built against
 * the language's schema, so a value of the wrong type fails at its column.
 *
 * @param grammar The language the text is written in.
 * @param text The text form.
 */
export function parse(grammar: Grammar, text: string): Result<Node, ExpressionError> {
	let tokens = tokenize(text);
	if (isFailure(tokens)) return tokens;

	let positions: Positions = { nodes: new WeakMap(), fields: new WeakMap() };
	let parser = new Parser(grammar, text, tokens.data, positions);
	let built = parser.run();
	if (isFailure(built)) return built;

	let result = s.parseSafe(grammar.schema, built.data);
	if (result.success) return success(result.value);

	let issue = result.issues[0];
	let path = (issue?.path ?? []).map((segment) =>
		typeof segment === "object" ? segment.key : segment,
	);
	let offset = locate(built.data, path, positions);
	return failure(syntaxError(issue?.message ?? "Expected an expression", text, offset));
}

/**
 * Finds where the value at `path` was written: the deepest node on the path,
 * or the literal field it ends in.
 */
function locate(root: Node, path: readonly PropertyKey[], positions: Positions): number {
	let current: unknown = root;
	let offset = positions.nodes.get(root) ?? 0;

	for (let segment of path) {
		if (typeof current !== "object" || current === null) break;
		let field = positions.fields.get(current)?.[String(segment)];
		if (field !== undefined) return field;
		current = (current as Record<PropertyKey, unknown>)[segment];
		if (typeof current === "object" && current !== null) {
			offset = positions.nodes.get(current) ?? offset;
		}
	}

	return offset;
}

/** A recursive-descent parser over one text's tokens. */
class Parser {
	#index = 0;

	constructor(
		readonly grammar: Grammar,
		readonly text: string,
		readonly tokens: readonly Token[],
		readonly positions: Positions,
	) {}

	/** Parses the whole text as one expression, refusing anything left after it. */
	run(): Step<Node> {
		let node = this.or();
		if (isFailure(node)) return node;
		let rest = this.peek();
		if (rest.kind !== "end") return this.fail(`Unexpected '${rest.text}'`, rest);
		return node;
	}

	/** `a or b or c`, flattened into one `any`; a parenthesized `or` stays its own node. */
	or(): Step<Node> {
		return this.chain("or", "any", () => this.and());
	}

	/** `a and b and c`, flattened into one `all`. */
	and(): Step<Node> {
		return this.chain("and", "all", () => this.not());
	}

	/** Collects the operands of one run of the same infix keyword. */
	chain(keyword: string, op: "all" | "any", operand: () => Step<Node>): Step<Node> {
		let start = this.peek();
		let first = operand();
		if (isFailure(first) || !this.isWord(this.peek(), keyword)) return first;

		let of = [first.data];
		while (this.isWord(this.peek(), keyword)) {
			let token = this.next();
			let allowed = this.require(op, token);
			if (isFailure(allowed)) return allowed;
			let next = operand();
			if (isFailure(next)) return next;
			of.push(next.data);
		}
		return this.at({ op, of }, start);
	}

	/** `not a`, binding tighter than `and`. */
	not(): Step<Node> {
		let token = this.peek();
		if (!this.isWord(token, "not")) return this.primary();

		this.next();
		let allowed = this.require("not", token);
		if (isFailure(allowed)) return allowed;
		let operand = this.not();
		if (isFailure(operand)) return operand;
		return this.at({ op: "not", of: operand.data }, token);
	}

	/** A group, `true`, a call or a comparison. */
	primary(): Step<Node> {
		let token = this.peek();

		if (this.isSymbol(token, "(")) {
			this.next();
			let node = this.or();
			if (isFailure(node)) return node;
			let closed = this.expect(")");
			return isFailure(closed) ? closed : node;
		}

		if (this.isWord(token, "true")) {
			this.next();
			let allowed = this.require("always", token);
			if (isFailure(allowed)) return allowed;
			return this.at({ op: "always" }, token);
		}

		if (token.kind === "path") {
			this.next();
			return this.comparison(token);
		}

		if (token.kind === "word" && !KEYWORDS.has(token.text)) {
			this.next();
			if (this.isSymbol(this.peek(), "(")) return this.call(token);
		}

		return this.fail(misplaced(token) ?? this.expectedCondition(), token);
	}

	/** `ctx.field == value`, `ctx.field in [...]` or `ctx.field not in [...]`; the value may be a path. */
	comparison(field: Token): Step<Node> {
		let token = this.next();
		let op: string | undefined;

		if (token.kind === "symbol") op = COMPARISONS[token.text];
		else if (this.isWord(token, "in")) op = "in";
		else if (this.isWord(token, "not") && this.isWord(this.peek(), "in")) {
			this.next();
			op = "notIn";
		}

		if (op === undefined) return this.fail(`Expected a comparison after '${field.text}'`, token);
		if (!this.grammar.fields.has(op)) {
			let written = op === "notIn" ? "not in" : token.text;
			return this.fail(`"${written}" is not an operator of this language`, token);
		}

		let key = op === "in" || op === "notIn" ? "values" : "value";
		let valueToken = this.peek();
		let value = this.operand(op, key);
		if (isFailure(value)) return value;

		let node: Node = { op, field: String(field.value), ...value.data };
		this.positions.fields.set(node, { field: field.offset, ...offsetsOf(value.data, valueToken) });
		return this.at(node, field);
	}

	/** `op(...)`, with arguments mapped to the fields the operator names in call order. */
	call(name: Token): Step<Node> {
		let op = name.text;
		let opened = this.expect("(");
		if (isFailure(opened)) return opened;

		if (op === "all" || op === "any") {
			let allowed = this.require(op, name);
			if (isFailure(allowed)) return allowed;
			let of = this.list(")", () => this.or());
			if (isFailure(of)) return of;
			return this.at({ op, of: of.data }, name);
		}

		if (op === "not" || op === "always") {
			let allowed = this.require(op, name);
			if (isFailure(allowed)) return allowed;
			let of = this.list(")", () => this.or());
			if (isFailure(of)) return of;
			let expected = op === "not" ? 1 : 0;
			if (of.data.length !== expected) {
				return this.fail(`"${op}" takes ${expected === 1 ? "one argument" : "no arguments"}`, name);
			}
			return this.at(op === "not" ? { op, of: of.data[0] } : { op }, name);
		}

		if (op === this.grammar.reference) {
			let token = this.peek();
			let reference = this.literal();
			if (isFailure(reference)) return reference;
			let closed = this.expect(")");
			if (isFailure(closed)) return closed;
			let node: Node = { op, name: reference.data };
			this.positions.fields.set(node, { name: token.offset });
			return this.at(node, name);
		}

		let operator = this.grammar.fields.get(op);
		if (operator === undefined) {
			return this.fail(`"${op}" is not an operator of this language`, name);
		}

		let field = this.next();
		if (field.kind !== "path") {
			let message = `Expected a path starting with 'ctx.' as the first argument of "${op}"`;
			return this.fail(misplaced(field) ?? message, field);
		}

		let node: Node = { op, field: String(field.value) };
		let offsets: Record<string, number> = { field: field.offset };
		for (let key of operator.args.slice(1)) {
			if (!this.isSymbol(this.peek(), ",")) break;
			this.next();
			let token = this.peek();
			let value = this.operand(op, key);
			if (isFailure(value)) return value;
			Object.assign(node, value.data);
			Object.assign(offsets, offsetsOf(value.data, token));
		}
		this.positions.fields.set(node, offsets);

		let closing = this.peek();
		if (this.isSymbol(closing, ",")) {
			return this.fail(`"${op}" takes at most ${operator.args.length} arguments`, closing);
		}
		let closed = this.expect(")");
		if (isFailure(closed)) return closed;
		return this.at(node, name);
	}

	/**
	 * The argument `key` of `op`: a literal, or a context path for the
	 * right-hand side of a built-in comparison, which then fills `path`.
	 */
	operand(op: string, key: string): Step<Record<string, unknown>> {
		let token = this.peek();
		if (token.kind !== "path") {
			let value = this.literal();
			return isFailure(value) ? value : success({ [key]: value.data });
		}

		let operator = this.grammar.fields.get(op);
		let builtin = operator === undefined ? undefined : BUILTINS.get(operator);
		if (builtin?.paths !== true || builtin.key !== key) {
			return this.fail(`"${op}" takes a literal as "${key}", where a path was written`, token);
		}
		this.next();
		return success({ path: token.value });
	}

	/** A JSON literal: a string, number, `true`, `false`, `null`, array or object. */
	literal(): Step<unknown> {
		let token = this.next();

		if (token.kind === "literal") return success(token.value);
		if (this.isWord(token, "true")) return success(true);
		if (this.isWord(token, "false")) return success(false);
		if (this.isWord(token, "null")) return success(null);
		if (this.isSymbol(token, "[")) return this.list("]", () => this.literal());
		if (this.isSymbol(token, "{")) {
			let entries = this.list("}", () => this.entry());
			if (isFailure(entries)) return entries;
			return success(Object.fromEntries(entries.data));
		}

		let message = misplaced(token) ?? `Expected a value after '${this.previous(token).text}'`;
		return this.fail(message, token);
	}

	/** One `"key": value` pair of an object literal. */
	entry(): Step<[string, unknown]> {
		let key = this.next();
		if (key.kind !== "literal" || typeof key.value !== "string") {
			return this.fail("Expected a quoted key", key);
		}
		let colon = this.expect(":");
		if (isFailure(colon)) return colon;
		let value = this.literal();
		if (isFailure(value)) return value;
		return success([key.value, value.data]);
	}

	/** Items separated by commas up to `close`, which may come first. */
	list<T>(close: string, item: () => Step<T>): Step<T[]> {
		let items: T[] = [];
		if (this.isSymbol(this.peek(), close)) {
			this.next();
			return success(items);
		}
		for (;;) {
			let read = item();
			if (isFailure(read)) return read;
			items.push(read.data);
			let token = this.next();
			if (this.isSymbol(token, close)) return success(items);
			if (!this.isSymbol(token, ",")) return this.fail(`Expected ',' or '${close}'`, token);
		}
	}

	/** Refuses a structural built-in this language leaves out, at the token that wrote it. */
	require(op: StructuralName | "always", token: Token): Step<true> {
		if (this.grammar.structural.has(op)) return success(true);
		return this.fail(`"${token.text}" is not an operator of this language`, token);
	}

	/** Consumes the symbol `text`, or fails naming what came instead. */
	expect(text: string): Step<true> {
		let token = this.next();
		if (this.isSymbol(token, text)) return success(true);
		let found = token.kind === "end" ? "the end" : `'${token.text}'`;
		return this.fail(`Expected '${text}' but found ${found}`, token);
	}

	/** The message for a missing condition, naming the token it should have followed. */
	expectedCondition(): string {
		let previous = this.tokens[this.#index - 1];
		if (previous === undefined) return "Expected a condition";
		return `Expected a condition after '${previous.text}'`;
	}

	/** Records where a node was written. */
	at(node: Node, token: Token): Step<Node> {
		this.positions.nodes.set(node, token.offset);
		return success(node);
	}

	/** The token at the cursor; the `end` token once the text is consumed. */
	peek(): Token {
		return this.tokens[Math.min(this.#index, this.tokens.length - 1)] as Token;
	}

	/** Consumes the token at the cursor, staying on `end`. */
	next(): Token {
		let token = this.peek();
		if (token.kind !== "end") this.#index += 1;
		return token;
	}

	/** The token before `token`, or `token` itself at the start. */
	previous(token: Token): Token {
		return this.tokens[this.tokens.indexOf(token) - 1] ?? token;
	}

	isWord(token: Token, text: string): boolean {
		return token.kind === "word" && token.text === text;
	}

	isSymbol(token: Token, text: string): boolean {
		return token.kind === "symbol" && token.text === text;
	}

	/** Stops the parse with an error at `token`. */
	fail<T>(message: string, token: Token): Step<T> {
		return failure(syntaxError(message, this.text, token.offset));
	}
}

/**
 * The message for a path written without its `ctx.` root, or for `ctx` alone,
 * which names the spelling that parses; `undefined` for any other token.
 */
function misplaced(token: Token): string | undefined {
	if (token.kind === "word" && token.text === "ctx") return "Expected '.' and a field after 'ctx'";
	let bare = token.kind === "word" && !KEYWORDS.has(token.text);
	if (bare || token.kind === "quoted") {
		return `Paths start with 'ctx.': write 'ctx.${token.text}'`;
	}
	return undefined;
}

/** Where each field an operand filled was written, for a later schema failure to point at. */
function offsetsOf(filled: Record<string, unknown>, token: Token): Record<string, number> {
	return Object.fromEntries(Object.keys(filled).map((key) => [key, token.offset]));
}
