/**
 * The abstract syntax tree for `.spec` files, mirroring GRAMMAR.md one node
 * per production. The tree is deliberately flat and operator-free: statements
 * are linear, arguments are literals/references/words, and the only nesting
 * is blocks and object literals.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Span } from "./source.js";

/** A parsed `.spec` file: its `use` imports, definitions, and tests. */
export interface SpecFileNode {
	/** Path the file was loaded from, used in every diagnostic. */
	path: string;
	/** Namespaces imported unqualified into this file (file-scoped). */
	uses: UseNode[];
	/** Suite-global command and fixture definitions declared here. */
	definitions: DefinitionNode[];
	/** Executable tests declared here, in source order. */
	tests: TestNode[];
}

/** `use fs` — imports one namespace's tools as unqualified names. */
export interface UseNode {
	/** The imported namespace, e.g. `"fs"`. */
	namespace: string;
	/** Location of the whole statement. */
	span: Span;
}

/** A suite-global definition: a reusable command or fixture. */
export type DefinitionNode = CommandNode | FixtureNode;

/** `command login(user) { … }` — reusable behavior composed of statements. */
export interface CommandNode {
	kind: "command";
	/** The command's suite-global name. */
	name: string;
	/** Positional parameter names; empty for `command logout { … }`. */
	params: string[];
	/** The statements the command executes. */
	body: BlockNode;
	/** Location of the whole definition. */
	span: Span;
}

/** `fixture user { … }` — reusable setup that yields a value via `return`. */
export interface FixtureNode {
	kind: "fixture";
	/** The fixture's suite-global name. */
	name: string;
	/** The statements the fixture executes. */
	body: BlockNode;
	/** Location of the whole definition. */
	span: Span;
}

/** `test "title" { given {…} when {…} then {…} }` — one specification. */
export interface TestNode {
	/** The test's human-readable title. */
	title: string;
	/** Setup phase, when present. */
	given?: BlockNode;
	/** Action phase, when present. */
	when?: BlockNode;
	/** Verification phase, when present. */
	then?: BlockNode;
	/** Location of the whole test. */
	span: Span;
}

/** A `{ … }` sequence of statements. */
export interface BlockNode {
	/** The statements, in source order. */
	statements: StatementNode[];
	/** Location including the braces. */
	span: Span;
}

/** Every statement the language has, forming a closed, exhaustive set. */
export type StatementNode = LetNode | ReturnNode | ExpectNode | EventuallyNode | CallNode;

/** `let name = <rhs>` — binds a value in the enclosing test/body scope. */
export interface LetNode {
	kind: "let";
	/** The name being bound. */
	name: string;
	/** What to evaluate: an expression or a value-producing invocation. */
	value: RhsNode;
	span: Span;
}

/** `return <rhs>` — ends a fixture/command body, producing a value. */
export interface ReturnNode {
	kind: "return";
	/** What to evaluate and yield to the caller. */
	value: RhsNode;
	span: Span;
}

/**
 * The right-hand side of `let`/`return`: a plain expression, a fixture
 * invocation, or a call expression. Calls are only legal here — never nested
 * inside arguments — which keeps statements linear.
 */
export type RhsNode = ExpressionNode | FixtureCallNode | CallExprNode;

/** `fixture user` in expression position — runs the fixture for its value. */
export interface FixtureCallNode {
	kind: "fixture-call";
	name: string;
	span: Span;
}

/** A value-producing invocation: `run "node" "index.js"` on a `let`/`return`. */
export interface CallExprNode {
	kind: "call-expr";
	/** Dotted target as written: `"run"` or `"http.post"`. */
	target: string;
	/** The invocation's arguments, in order. */
	args: ArgumentNode[];
	span: Span;
}

/** `expect <argument>+` — value or observable assertion (see GRAMMAR.md). */
export interface ExpectNode {
	kind: "expect";
	/** The assertion's arguments; resolution decides the form at runtime. */
	args: ArgumentNode[];
	span: Span;
}

/** `eventually [within 10s] { … }` — retried assertions, `then`-only. */
export interface EventuallyNode {
	kind: "eventually";
	/** Deadline override in milliseconds, from `within <duration>`. */
	withinMs?: number;
	/** The assertions to retry as a unit. */
	block: BlockNode;
	span: Span;
}

/** A statement-position invocation: `login user`, `open post.url`. */
export interface CallNode {
	kind: "call";
	/** Dotted target as written: `"login"`, `"fs.write"`. */
	target: string;
	/** The invocation's arguments, in order. */
	args: ArgumentNode[];
	span: Span;
}

/** One argument: an expression, or a bare-identifier word. */
export type ArgumentNode = ExpressionNode | WordNode;

/** A bare identifier in argument position — a symbol for the tool. */
export interface WordNode {
	kind: "word";
	/** The identifier as written, e.g. `"exists"`, `"textbox"`, `"with"`. */
	word: string;
	span: Span;
}

/** Every expression form; references are dotted paths into bindings. */
export type ExpressionNode =
	| StringNode
	| NumberNode
	| BooleanNode
	| DurationNode
	| ObjectNode
	| ReferenceNode;

/** A single-line or multiline string literal, already decoded/dedented. */
export interface StringNode {
	kind: "string";
	/** The decoded content. */
	value: string;
	span: Span;
}

/** A numeric literal. */
export interface NumberNode {
	kind: "number";
	value: number;
	span: Span;
}

/** `true` or `false`. */
export interface BooleanNode {
	kind: "boolean";
	value: boolean;
	span: Span;
}

/** A duration literal like `10s`, normalized to milliseconds at lex time. */
export interface DurationNode {
	kind: "duration";
	milliseconds: number;
	span: Span;
}

/** `{ key: expr, … }` — an object literal. */
export interface ObjectNode {
	kind: "object";
	/** Entries in source order; later duplicate keys are a parse error. */
	entries: ObjectEntryNode[];
	span: Span;
}

/** One `key: value` entry of an object literal. */
export interface ObjectEntryNode {
	/** The key, from an identifier or string. */
	key: string;
	value: ExpressionNode;
	span: Span;
}

/** A dotted reference into bindings: `user`, `result.exit_code`. */
export interface ReferenceNode {
	kind: "reference";
	/** The path segments, e.g. `["result", "exit_code"]`. */
	path: string[];
	span: Span;
}
