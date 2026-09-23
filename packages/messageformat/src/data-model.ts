/**
 * The MessageFormat 2 data model: the parsed, syntax-free shape of one message, as the
 * Unicode working group's JSON Schema defines it. The parser produces it and the formatter
 * consumes it, so a message is parsed once and formatted many times.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A parsed message: a single pattern, or variants chosen by selectors. */
export type MessageData = PatternMessage | SelectMessage;

/** A message with one pattern, preceded by any declarations. */
export interface PatternMessage {
	type: "message";
	declarations: Declaration[];
	pattern: Pattern;
}

/** A message whose pattern is picked from `variants` by matching `selectors` against keys. */
export interface SelectMessage {
	type: "select";
	declarations: Declaration[];
	selectors: VariableRef[];
	variants: Variant[];
}

/** An `.input` or `.local` declaration. */
export type Declaration = InputDeclaration | LocalDeclaration;

/** `.input {$name …}`: annotates an external value; `value.arg.name` equals `name`. */
export interface InputDeclaration {
	type: "input";
	name: string;
	value: VariableExpression;
}

/** `.local $name = {…}`: binds an expression's resolved value to a message-local name. */
export interface LocalDeclaration {
	type: "local";
	name: string;
	value: Expression;
}

/** One variant: a key per selector and the pattern used when they all match. */
export interface Variant {
	keys: Array<Literal | CatchallKey>;
	value: Pattern;
}

/** The `*` key, which matches any selector value. */
export interface CatchallKey {
	type: "*";
	value?: string;
}

/** Text (escapes already processed, never empty), expressions and markup, in order. */
export type Pattern = Array<string | Expression | Markup>;

/** A placeholder or declaration value that resolves to a value. */
export type Expression = LiteralExpression | VariableExpression | FunctionExpression;

/** `{literal …}` */
export interface LiteralExpression {
	type: "expression";
	arg: Literal;
	function?: FunctionRef;
	attributes?: Attributes;
}

/** `{$variable …}` */
export interface VariableExpression {
	type: "expression";
	arg: VariableRef;
	function?: FunctionRef;
	attributes?: Attributes;
}

/** `{:function …}` */
export interface FunctionExpression {
	type: "expression";
	arg?: never;
	function: FunctionRef;
	attributes?: Attributes;
}

/** A literal, quoted or not; `value` has escapes processed. */
export interface Literal {
	type: "literal";
	value: string;
}

/** A `$name` reference; `name` is NFC-normalized and has no `$`. */
export interface VariableRef {
	type: "variable";
	name: string;
}

/** `:name option=value …`; `name` has no `:` and may carry a `namespace:` prefix. */
export interface FunctionRef {
	type: "function";
	name: string;
	options?: Options;
}

/** Markup such as `{#b}`, `{/b}` or `{#img/}`; `name` has no sigils. */
export interface Markup {
	type: "markup";
	kind: "open" | "standalone" | "close";
	name: string;
	options?: Options;
	attributes?: Attributes;
}

/** Function or markup options by name. */
export type Options = Record<string, Literal | VariableRef>;

/** Attributes by name; one written without a value is `true`. Formatting ignores them. */
export type Attributes = Record<string, Literal | true>;
