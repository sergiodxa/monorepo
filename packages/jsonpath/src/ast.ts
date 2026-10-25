/**
 * The parsed form of an RFC 9535 query: segments of selectors, and the filter expressions
 * a filter selector evaluates. The parser only builds well-typed trees, so evaluation never
 * meets an argument of the wrong function type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A value that survives a `JSON.stringify`/`JSON.parse` round trip unchanged. */
export type JSONValue =
	| string
	| number
	| boolean
	| null
	| JSONValue[]
	| { [key: string]: JSONValue };

/** One selector inside a segment, section 2.3. */
export type Selector =
	| { type: "name"; name: string }
	| { type: "wildcard" }
	| { type: "index"; index: number }
	| { type: "slice"; start: number | null; end: number | null; step: number | null }
	| { type: "filter"; expression: LogicalExpression };

/** A child segment, or a descendant segment (`..`) that applies its selectors at every depth. */
export interface Segment {
	descendant: boolean;
	selectors: Selector[];
}

/** A query rooted at the document (`$`) or, inside a filter, at the current node (`@`). */
export interface Query {
	root: "$" | "@";
	segments: Segment[];
}

/** The three types of section 2.4.1 a function parameter or result declares. */
export type FunctionType = "value" | "logical" | "nodes";

/** A function extension call with its arguments already checked against the declared types. */
export interface FunctionCall {
	type: "call";
	name: "length" | "count" | "match" | "search" | "value";
	args: Argument[];
}

/** A literal, a query, a function result or a logical expression passed to a function. */
export type Argument =
	| { type: "literal"; value: JSONValue }
	| { type: "query"; query: Query }
	| FunctionCall
	| { type: "logical"; expression: LogicalExpression };

/** One side of a comparison: a literal, a singular query, or a function returning a value. */
export type Comparable =
	| { type: "literal"; value: JSONValue }
	| { type: "query"; query: Query }
	| FunctionCall;

/** The comparison operators of section 2.3.5.1. */
export type ComparisonOperator = "==" | "!=" | "<" | "<=" | ">" | ">=";

/** A filter expression, evaluated once per child of the node the filter selector visits. */
export type LogicalExpression =
	| { type: "or"; operands: LogicalExpression[] }
	| { type: "and"; operands: LogicalExpression[] }
	| { type: "not"; operand: LogicalExpression }
	| { type: "comparison"; operator: ComparisonOperator; left: Comparable; right: Comparable }
	| { type: "exists"; query: Query }
	| FunctionCall;
