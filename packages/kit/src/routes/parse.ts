/**
 * Reads the expressions a route contract or a router initializer is written in out of
 * `@sdxc/codemod` tokens: literals, identifiers, member access, calls, objects, arrays, arrow
 * functions and `import()`. Anything else becomes an opaque node, so one unread line costs one entry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Token } from "@sdxc/codemod";

/** An expression read from source, with its source range. */
export type Node =
	| StringNode
	| IdentifierNode
	| MemberNode
	| CallNode
	| ImportNode
	| ObjectNode
	| ArrayNode
	| FunctionNode
	| OpaqueNode;

/** A source range as UTF-16 offsets, `end` exclusive. */
interface Located {
	start: number;
	end: number;
}

/** A string literal, or a template literal without substitutions, with escapes resolved. */
export interface StringNode extends Located {
	kind: "string";
	value: string;
}

/** A name, resolved against the module's imports and top-level declarations when evaluated. */
export interface IdentifierNode extends Located {
	kind: "identifier";
	name: string;
}

/** `object.property`, `object?.property` or `object["property"]`. */
export interface MemberNode extends Located {
	kind: "member";
	object: Node;
	property: string;
}

/** A call; type arguments are skipped and spread arguments are marked. */
export interface CallNode extends Located {
	kind: "call";
	callee: Node;
	args: Element[];
}

/** A dynamic `import()` of a literal specifier. */
export interface ImportNode extends Located {
	kind: "import";
	specifier: string;
}

/** An object literal; computed keys and methods are left out. */
export interface ObjectNode extends Located {
	kind: "object";
	entries: Array<{ key: string; value: Node } | { spread: Node }>;
}

/** An array literal; holes are skipped. */
export interface ArrayNode extends Located {
	kind: "array";
	elements: Element[];
}

/**
 * An arrow function or function expression. `body` is its expression body, or the expression the
 * first `return` at the top of a block body answers; `null` when there is none.
 */
export interface FunctionNode extends Located {
	kind: "function";
	body: Node | null;
}

/** An expression outside the subset the reader evaluates; its source text is still known. */
export interface OpaqueNode extends Located {
	kind: "opaque";
}

/** An argument or array element, marked when it is spread. */
export interface Element {
	spread: boolean;
	node: Node;
}

/** What a module declares at its top level, by local name. */
export interface Declarations {
	/** `const`, `let` and `var` initializers and function declarations. */
	locals: Map<string, Node>;
	/** Exported name to the local name it exports. */
	exports: Map<string, string>;
	/** The `export default` expression, or `null`. */
	defaultExport: Node | null;
}

/** Statement keywords that start a new top-level statement, which bounds the one before it. */
const STATEMENT_STARTS = new Set([
	"import",
	"export",
	"const",
	"let",
	"var",
	"function",
	"async",
	"class",
	"interface",
	"type",
	"declare",
	"enum",
]);

/** Tokens that end an expression inside a list, a block or a statement. */
const DELIMITERS = new Set([",", ")", "]", "}", ";"]);

/**
 * Reads expressions from one file's code tokens (comments and JSX markup removed). Every read is
 * bounded by a token index limit, so an expression it cannot read never swallows the next one.
 */
export class Reader {
	/** The code tokens. */
	readonly tokens: Token[];
	/** The file's source, which node ranges index into. */
	readonly source: string;
	/** For each bracket or template piece, the index of its partner; -1 for any other token. */
	readonly match: number[];
	/** For each token, how many brackets are open around it. */
	readonly depth: number[];

	/** Pairs the brackets of `tokens`, which are expected to be balanced, as the scanner guarantees. */
	constructor(tokens: Token[], source: string) {
		this.tokens = tokens.filter((token) => token.type !== "comment" && token.type !== "jsx");
		this.source = source;
		this.match = Array.from({ length: this.tokens.length }, () => -1);
		this.depth = Array.from({ length: this.tokens.length }, () => 0);
		let open: number[] = [];
		for (let [index, token] of this.tokens.entries()) {
			if (closes(token)) {
				let opener = open.pop() ?? -1;
				if (opener !== -1) {
					this.match[opener] = index;
					this.match[index] = opener;
				}
			}
			this.depth[index] = open.length;
			if (opens(token)) open.push(index);
		}
	}

	/** The source text of a node, whitespace collapsed to single spaces. */
	text(node: Located): string {
		return this.source.slice(node.start, node.end).replace(/\s+/g, " ").trim();
	}

	/** Whether the token at `index` is the punctuator `value`. */
	is(index: number, value: string): boolean {
		let token = this.tokens[index];
		return token?.type === "punctuator" && token.value === value;
	}

	/** Whether the token at `index` is the identifier `value`. */
	isWord(index: number, value: string): boolean {
		let token = this.tokens[index];
		return token?.type === "identifier" && token.value === value;
	}

	/**
	 * Reads the expression starting at `index`, stopping before `limit`. An expression with an
	 * operator the reader does not evaluate becomes one opaque node up to the next delimiter.
	 */
	expression(index: number, limit: number): { node: Node; next: number } {
		let read = this.postfix(index, limit);
		let next = this.skipTypeSuffix(read.next, limit);
		if (next >= limit || this.isDelimiter(next)) return { node: read.node, next };
		let end = this.skipToDelimiter(next, limit);
		return { node: this.opaque(index, end), next: end };
	}

	/** Every top-level declaration, export and the default export of the file. */
	declarations(): Declarations {
		let result: Declarations = { locals: new Map(), exports: new Map(), defaultExport: null };
		let starts = this.statementStarts();
		for (let [position, start] of starts.entries()) {
			let limit = starts[position + 1] ?? this.tokens.length;
			this.declaration(start, limit, result);
		}
		return result;
	}

	/** The index of every token at depth 0 that starts a statement. */
	private statementStarts(): number[] {
		let starts: number[] = [];
		for (let [index, token] of this.tokens.entries()) {
			if (this.depth[index] !== 0 || token.type !== "identifier") continue;
			if (!STATEMENT_STARTS.has(token.value)) continue;
			let previous = this.tokens[index - 1];
			let boundary =
				previous === undefined ||
				token.newlineBefore ||
				(previous.type === "punctuator" && (previous.value === ";" || previous.value === "}"));
			if (!boundary || this.isWord(index - 1, "export") || this.isWord(index - 1, "async")) {
				continue;
			}
			if (this.isWord(index - 1, "default")) continue;
			starts.push(index);
		}
		return starts;
	}

	/** Records the declaration in the statement `[start, limit)`, when it is one the reader reads. */
	private declaration(start: number, limit: number, result: Declarations): void {
		let index = start;
		let exported = false;
		if (this.isWord(index, "export")) {
			exported = true;
			index += 1;
			if (this.isWord(index, "default")) {
				let value = this.functionDeclaration(index + 1, limit);
				result.defaultExport = value?.node ?? this.expression(index + 1, limit).node;
				return;
			}
			if (this.is(index, "{")) {
				this.exportList(index, limit, result);
				return;
			}
		}
		let declared = this.functionDeclaration(index, limit);
		if (declared !== null) {
			if (declared.name !== null) {
				result.locals.set(declared.name, declared.node);
				if (exported) result.exports.set(declared.name, declared.name);
			}
			return;
		}
		if (!["const", "let", "var"].some((word) => this.isWord(index, word))) return;
		index += 1;
		while (index < limit) {
			let name = this.tokens[index];
			if (name?.type !== "identifier") return;
			index += 1;
			if (this.is(index, "!")) index += 1;
			if (this.is(index, ":")) index = this.skipType(index + 1, limit);
			if (!this.is(index, "=")) return;
			let read = this.expression(index + 1, limit);
			result.locals.set(name.value, read.node);
			if (exported) result.exports.set(name.value, name.value);
			if (!this.is(read.next, ",")) return;
			index = read.next + 1;
		}
	}

	/** Reads `export { a, b as c }` without a `from` clause. */
	private exportList(open: number, limit: number, result: Declarations): void {
		let close = this.match[open] ?? -1;
		if (close === -1 || close >= limit) return;
		if (this.isWord(close + 1, "from")) return;
		let index = open + 1;
		while (index < close) {
			if (this.isWord(index, "type")) index += 1;
			let local = this.tokens[index];
			if (local === undefined || local.type !== "identifier") return;
			let exported = local.value;
			index += 1;
			if (this.isWord(index, "as")) {
				exported = this.tokens[index + 1]?.value ?? exported;
				index += 2;
			}
			result.exports.set(exported, local.value);
			if (this.is(index, ",")) index += 1;
		}
	}

	/** `[async] function name(…) { … }` at `index`, as a function node, or `null`. */
	private functionDeclaration(
		at: number,
		limit: number,
	): { name: string | null; node: FunctionNode } | null {
		let start = at;
		let index = at;
		if (this.isWord(index, "async")) index += 1;
		if (!this.isWord(index, "function")) return null;
		index += 1;
		if (this.is(index, "*")) index += 1;
		let name: string | null = null;
		if (this.tokens[index]?.type === "identifier") {
			name = this.tokens[index]?.value ?? null;
			index += 1;
		}
		if (this.is(index, "<")) index = this.skipAngles(index, limit);
		if (!this.is(index, "(")) return null;
		index = (this.match[index] ?? index) + 1;
		if (this.is(index, ":")) index = this.skipType(index + 1, limit, "{");
		if (!this.is(index, "{")) return null;
		let close = this.match[index] ?? index;
		return {
			name,
			node: {
				kind: "function",
				body: this.returned(index, close),
				...this.range(start, close + 1),
			},
		};
	}

	/** The expression a block's first top-level `return` answers, or `null`. */
	private returned(open: number, close: number): Node | null {
		let index = open + 1;
		while (index < close) {
			let token = this.tokens[index];
			if (token !== undefined && opens(token)) {
				index = (this.match[index] ?? index) + 1;
				continue;
			}
			if (this.isWord(index, "return")) {
				if (this.isDelimiter(index + 1)) return null;
				return this.expression(index + 1, close).node;
			}
			index += 1;
		}
		return null;
	}

	/** A primary expression followed by member accesses, calls and non-null assertions. */
	private postfix(index: number, limit: number): { node: Node; next: number } {
		let read = this.primary(index, limit);
		let node = read.node;
		let next = read.next;
		while (next < limit) {
			if (
				(this.is(next, ".") || this.is(next, "?.")) &&
				this.tokens[next + 1]?.type === "identifier"
			) {
				node = {
					kind: "member",
					object: node,
					property: this.tokens[next + 1]?.value ?? "",
					...this.range(index, next + 2),
				};
				next += 2;
				continue;
			}
			if (this.is(next, "?.") && (this.is(next + 1, "(") || this.is(next + 1, "["))) {
				next += 1;
				continue;
			}
			if (this.is(next, "[")) {
				let close = this.match[next] ?? next;
				let key = this.tokens[next + 1];
				if (close === next + 2 && key?.type === "string") {
					node = {
						kind: "member",
						object: node,
						property: cook(key.value),
						...this.range(index, close + 1),
					};
				} else {
					node = this.opaque(index, close + 1);
				}
				next = close + 1;
				continue;
			}
			if (this.is(next, "<") && node.kind !== "opaque") {
				let after = this.skipAngles(next, limit);
				if (!this.is(after, "(")) break;
				next = after;
			}
			if (this.is(next, "(")) {
				let close = this.match[next] ?? next;
				node = {
					kind: "call",
					callee: node,
					args: this.list(next, close),
					...this.range(index, close + 1),
				};
				next = close + 1;
				continue;
			}
			if (this.is(next, "!")) {
				next += 1;
				continue;
			}
			break;
		}
		return { node, next };
	}

	/** One literal, identifier, bracketed expression, object, array, function or `import()`. */
	private primary(index: number, limit: number): { node: Node; next: number } {
		let token = this.tokens[index];
		if (token === undefined) return { node: this.opaque(index, index), next: index };
		if (token.type === "string" || token.type === "template") {
			return {
				node: { kind: "string", value: cook(token.value), ...this.range(index, index + 1) },
				next: index + 1,
			};
		}
		if (token.type === "template-head") {
			let end = index;
			while (end < limit && this.tokens[end]?.type !== "template-tail") {
				let partner = this.match[end] ?? -1;
				if (partner <= end) break;
				end = partner;
			}
			return { node: this.opaque(index, end + 1), next: end + 1 };
		}
		if (token.type === "identifier") return this.word(index, limit);
		if (this.is(index, "(")) {
			let close = this.match[index] ?? index;
			let arrow = this.arrowAfterParameters(close, limit);
			if (arrow !== null) return this.arrowBody(index, arrow, limit);
			let inner = this.expression(index + 1, close).node;
			return { node: inner, next: close + 1 };
		}
		if (this.is(index, "{")) return this.object(index);
		if (this.is(index, "[")) {
			let close = this.match[index] ?? index;
			return {
				node: { kind: "array", elements: this.list(index, close), ...this.range(index, close + 1) },
				next: close + 1,
			};
		}
		return { node: this.opaque(index, index + 1), next: index + 1 };
	}

	/** An identifier, keyword-led expression (`import()`, `function`, `new`, `async`) or arrow. */
	private word(index: number, limit: number): { node: Node; next: number } {
		let value = this.tokens[index]?.value ?? "";
		if (value === "import" && this.is(index + 1, "(")) {
			let close = this.match[index + 1] ?? index + 1;
			let specifier = this.tokens[index + 2];
			let node: Node =
				specifier?.type === "string"
					? { kind: "import", specifier: cook(specifier.value), ...this.range(index, close + 1) }
					: this.opaque(index, close + 1);
			return { node, next: close + 1 };
		}
		if (value === "async" && !this.tokens[index + 1]?.newlineBefore) {
			if (this.isWord(index + 1, "function")) {
				let declared = this.functionDeclaration(index, limit);
				if (declared !== null) return { node: declared.node, next: this.after(declared.node) };
			}
			if (this.is(index + 1, "(")) {
				let close = this.match[index + 1] ?? index + 1;
				let arrow = this.arrowAfterParameters(close, limit);
				if (arrow !== null) return this.arrowBody(index, arrow, limit);
			}
			if (this.tokens[index + 1]?.type === "identifier" && this.is(index + 2, "=>")) {
				return this.arrowBody(index, index + 2, limit);
			}
		}
		if (value === "function") {
			let declared = this.functionDeclaration(index, limit);
			if (declared !== null) return { node: declared.node, next: this.after(declared.node) };
		}
		if (value === "new") {
			let read = this.postfix(index + 1, limit);
			return { node: this.opaque(index, read.next), next: read.next };
		}
		if (this.is(index + 1, "=>")) return this.arrowBody(index, index + 1, limit);
		return {
			node: { kind: "identifier", name: value, ...this.range(index, index + 1) },
			next: index + 1,
		};
	}

	/** The index of `=>` after a parameter list closing at `close`, past a return type; or `null`. */
	private arrowAfterParameters(close: number, limit: number): number | null {
		let index = close + 1;
		if (this.is(index, ":")) index = this.skipType(index + 1, limit, "=>");
		return this.is(index, "=>") ? index : null;
	}

	/** The arrow function starting at `start` whose `=>` is at `arrow`. */
	private arrowBody(start: number, arrow: number, limit: number): { node: Node; next: number } {
		if (this.is(arrow + 1, "{")) {
			let close = this.match[arrow + 1] ?? arrow + 1;
			return {
				node: {
					kind: "function",
					body: this.returned(arrow + 1, close),
					...this.range(start, close + 1),
				},
				next: close + 1,
			};
		}
		let body = this.expression(arrow + 1, limit);
		return {
			node: { kind: "function", body: body.node, ...this.range(start, body.next) },
			next: body.next,
		};
	}

	/** The object literal opening at `open`. */
	private object(open: number): { node: Node; next: number } {
		let close = this.match[open] ?? open;
		let entries: ObjectNode["entries"] = [];
		let index = open + 1;
		while (index < close) {
			if (this.is(index, "...")) {
				let read = this.expression(index + 1, close);
				entries.push({ spread: read.node });
				index = this.afterComma(read.next, close);
				continue;
			}
			let key = this.tokens[index];
			let modifier =
				key?.type === "identifier" &&
				["get", "set", "async"].includes(key.value) &&
				!this.is(index + 1, ":") &&
				!this.is(index + 1, ",") &&
				!this.is(index + 1, "(") &&
				index + 1 < close;
			if (modifier || this.is(index, "*") || this.is(index, "[")) {
				index = this.afterComma(this.skipToDelimiter(index + 1, close), close);
				continue;
			}
			let name: string | null = null;
			if (key?.type === "identifier" || key?.type === "number") name = key.value;
			else if (key?.type === "string") name = cook(key.value);
			if (name === null) {
				index = this.afterComma(this.skipToDelimiter(index, close), close);
				continue;
			}
			if (this.is(index + 1, "?")) index += 1;
			if (this.is(index + 1, ":")) {
				let read = this.expression(index + 2, close);
				entries.push({ key: name, value: read.node });
				index = this.afterComma(read.next, close);
				continue;
			}
			if (this.is(index + 1, ",") || index + 1 === close) {
				entries.push({
					key: name,
					value: { kind: "identifier", name, ...this.range(index, index + 1) },
				});
				index = this.afterComma(index + 1, close);
				continue;
			}
			index = this.afterComma(this.skipToDelimiter(index + 1, close), close);
		}
		return { node: { kind: "object", entries, ...this.range(open, close + 1) }, next: close + 1 };
	}

	/** The comma-separated elements between the bracket at `open` and `close`. */
	private list(open: number, close: number): Element[] {
		let elements: Element[] = [];
		let index = open + 1;
		while (index < close) {
			if (this.is(index, ",")) {
				index += 1;
				continue;
			}
			let spread = this.is(index, "...");
			let read = this.expression(spread ? index + 1 : index, close);
			elements.push({ spread, node: read.node });
			index = this.afterComma(read.next, close);
		}
		return elements;
	}

	/** The index after the comma that ends an entry at `index`, skipping anything unread. */
	private afterComma(index: number, close: number): number {
		let next = this.is(index, ",") ? index : this.skipToDelimiter(index, close);
		return next < close ? next + 1 : close;
	}

	/** Past `as T`, `satisfies T` and `!` after an expression. */
	private skipTypeSuffix(index: number, limit: number): number {
		let next = index;
		while (next < limit) {
			if (this.isWord(next, "as") || this.isWord(next, "satisfies")) {
				next = this.skipType(next + 1, limit);
				continue;
			}
			if (this.is(next, "!")) {
				next += 1;
				continue;
			}
			break;
		}
		return next;
	}

	/** Past a type annotation, stopping at a delimiter, `=`, or `stop`, outside its angle brackets. */
	private skipType(index: number, limit: number, stop = "="): number {
		let angles = 0;
		let next = index;
		while (next < limit) {
			let token = this.tokens[next];
			if (token === undefined) break;
			if (opens(token)) {
				next = (this.match[next] ?? next) + 1;
				continue;
			}
			if (angles === 0 && (this.isDelimiter(next) || this.is(next, "=") || this.is(next, stop))) {
				break;
			}
			if (this.is(next, "<")) angles += 1;
			if (this.is(next, ">") && angles > 0) angles -= 1;
			next += 1;
		}
		return next;
	}

	/** Past the type arguments opening at `index`, or `index` itself when they do not close. */
	private skipAngles(index: number, limit: number): number {
		let angles = 0;
		let next = index;
		while (next < limit) {
			let token = this.tokens[next];
			if (token === undefined) break;
			if (opens(token)) {
				next = (this.match[next] ?? next) + 1;
				continue;
			}
			if (this.isDelimiter(next) && !this.is(next, ",")) return index;
			if (this.is(next, "<")) angles += 1;
			if (this.is(next, ">")) {
				angles -= 1;
				if (angles === 0) return next + 1;
			}
			next += 1;
		}
		return index;
	}

	/** The index of the next delimiter at the depth of `index`, skipping bracketed code. */
	private skipToDelimiter(index: number, limit: number): number {
		let next = index;
		while (next < limit) {
			let token = this.tokens[next];
			if (token === undefined) break;
			if (opens(token) && (this.match[next] ?? -1) > next) {
				next = this.match[next] ?? next;
				if (this.tokens[next]?.type === "template-middle") continue;
				next += 1;
				continue;
			}
			if (this.isDelimiter(next)) break;
			next += 1;
		}
		return Math.min(next, limit);
	}

	/** Whether the token at `index` ends an expression. */
	private isDelimiter(index: number): boolean {
		let token = this.tokens[index];
		return token?.type === "punctuator" && DELIMITERS.has(token.value);
	}

	/** The token index right after a node's last token. */
	private after(node: Located): number {
		let index = this.tokens.findIndex((token) => token.start >= node.end);
		return index === -1 ? this.tokens.length : index;
	}

	/** An opaque node over the tokens `[start, end)`. */
	private opaque(start: number, end: number): OpaqueNode {
		return { kind: "opaque", ...this.range(start, end) };
	}

	/** The source range of the tokens `[start, end)`. */
	private range(start: number, end: number): Located {
		let first = this.tokens[start];
		let last = this.tokens[Math.max(start, end - 1)];
		let from = first?.start ?? this.source.length;
		return { start: from, end: end > start ? (last?.end ?? from) : from };
	}
}

/** Whether a token opens a bracket or a template substitution. */
function opens(token: Token): boolean {
	if (token.type === "template-head" || token.type === "template-middle") return true;
	return (
		token.type === "punctuator" &&
		(token.value === "(" || token.value === "[" || token.value === "{")
	);
}

/** Whether a token closes a bracket or a template substitution. */
function closes(token: Token): boolean {
	if (token.type === "template-tail" || token.type === "template-middle") return true;
	return (
		token.type === "punctuator" &&
		(token.value === ")" || token.value === "]" || token.value === "}")
	);
}

/** A string or template literal's value: quotes removed and the common escapes resolved. */
export function cook(raw: string): string {
	return raw
		.slice(1, -1)
		.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_, escape: string) => {
			if (escape.startsWith("u{"))
				return String.fromCodePoint(Number.parseInt(escape.slice(2, -1), 16));
			if (escape.startsWith("u") || escape.startsWith("x")) {
				return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
			}
			return { n: "\n", t: "\t", r: "\r", "0": "\0" }[escape] ?? escape;
		});
}
