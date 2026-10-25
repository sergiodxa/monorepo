/**
 * Evaluates a parsed query against a JSON value per section 2: each segment maps the node
 * list it receives to a new one, in document order, and filters evaluate their expression
 * once per child with `@` bound to that child.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type {
	Argument,
	Comparable,
	ComparisonOperator,
	FunctionCall,
	JSONValue,
	LogicalExpression,
	Query,
	Segment,
	Selector,
} from "./ast.js";

import { compileIRegexp } from "./i-regexp.js";

/** The absence of a value, section 2.4.1's `Nothing`, distinct from JSON `null`. */
const NOTHING = Symbol("nothing");

/** A function's value result, or `Nothing`. */
type Value = JSONValue | typeof NOTHING;

/** A selected value and where it sits, as member names and array indexes from the root. */
export interface Located {
	value: JSONValue;
	location: (string | number)[];
}

/**
 * The nodes `query` selects. `root` is the document `$` names; `current` is the node `@`
 * names inside a filter, and the document itself at the top level.
 */
export function evaluate(query: Query, root: JSONValue, current: JSONValue): Located[] {
	let nodes: Located[] = [{ value: query.root === "$" ? root : current, location: [] }];
	for (let segment of query.segments) nodes = applySegment(segment, nodes, root);
	return nodes;
}

/** A child segment applies its selectors to each node; a descendant segment to each node and all below it. */
function applySegment(segment: Segment, nodes: Located[], root: JSONValue): Located[] {
	let out: Located[] = [];
	for (let node of nodes) {
		let targets = segment.descendant ? descendants(node) : [node];
		for (let target of targets) {
			for (let selector of segment.selectors) applySelector(selector, target, root, out);
		}
	}
	return out;
}

/** A node followed by every node below it, each before its own descendants. */
function descendants(node: Located): Located[] {
	let out: Located[] = [];
	let stack: Located[] = [node];
	while (stack.length > 0) {
		let next = stack.pop() as Located;
		out.push(next);
		let children = childrenOf(next);
		for (let index = children.length - 1; index >= 0; index--)
			stack.push(children[index] as Located);
	}
	return out;
}

/** The elements of an array or the member values of an object, in order. */
function childrenOf(node: Located): Located[] {
	let { value, location } = node;
	if (Array.isArray(value)) {
		return value.map((item, index) => ({ value: item, location: [...location, index] }));
	}
	if (isObject(value)) {
		return Object.keys(value).map((key) => ({
			value: value[key] as JSONValue,
			location: [...location, key],
		}));
	}
	return [];
}

/** Appends the children of `node` that `selector` picks to `out`. */
function applySelector(selector: Selector, node: Located, root: JSONValue, out: Located[]): void {
	let { value, location } = node;
	switch (selector.type) {
		case "name":
			if (isObject(value) && Object.hasOwn(value, selector.name)) {
				out.push({
					value: value[selector.name] as JSONValue,
					location: [...location, selector.name],
				});
			}
			return;
		case "wildcard":
			out.push(...childrenOf(node));
			return;
		case "index": {
			if (!Array.isArray(value)) return;
			let index = selector.index < 0 ? value.length + selector.index : selector.index;
			if (index >= 0 && index < value.length) {
				out.push({ value: value[index] as JSONValue, location: [...location, index] });
			}
			return;
		}
		case "slice":
			if (!Array.isArray(value)) return;
			for (let index of sliceIndexes(selector, value.length)) {
				out.push({ value: value[index] as JSONValue, location: [...location, index] });
			}
			return;
		case "filter":
			for (let child of childrenOf(node)) {
				if (test(selector.expression, root, child.value)) out.push(child);
			}
	}
}

/** Section 2.3.4.2.2: the indexes a slice selects, in selection order. */
function sliceIndexes(slice: Extract<Selector, { type: "slice" }>, length: number): number[] {
	let step = slice.step ?? 1;
	if (step === 0) return [];
	let normalize = (index: number) => (index >= 0 ? index : length + index);
	let indexes: number[] = [];
	if (step > 0) {
		let lower = Math.min(Math.max(normalize(slice.start ?? 0), 0), length);
		let upper = Math.min(Math.max(normalize(slice.end ?? length), 0), length);
		for (let index = lower; index < upper; index += step) indexes.push(index);
	} else {
		let upper = Math.min(Math.max(normalize(slice.start ?? length - 1), -1), length - 1);
		let lower = Math.min(Math.max(normalize(slice.end ?? -length - 1), -1), length - 1);
		for (let index = upper; lower < index; index += step) indexes.push(index);
	}
	return indexes;
}

/** Whether a filter expression holds for the child `current`. */
function test(expression: LogicalExpression, root: JSONValue, current: JSONValue): boolean {
	switch (expression.type) {
		case "or":
			return expression.operands.some((operand) => test(operand, root, current));
		case "and":
			return expression.operands.every((operand) => test(operand, root, current));
		case "not":
			return !test(expression.operand, root, current);
		case "exists":
			return evaluate(expression.query, root, current).length > 0;
		case "comparison":
			return compare(
				comparableValue(expression.left, root, current),
				expression.operator,
				comparableValue(expression.right, root, current),
			);
		case "call":
			return call(expression, root, current) === true;
	}
}

/** The value one side of a comparison stands for; an empty singular query is `Nothing`. */
function comparableValue(comparable: Comparable, root: JSONValue, current: JSONValue): Value {
	switch (comparable.type) {
		case "literal":
			return comparable.value;
		case "query":
			return singleValue(evaluate(comparable.query, root, current));
		case "call":
			return call(comparable, root, current);
	}
}

/** The only node's value, or `Nothing` when the list is empty or holds several nodes. */
function singleValue(nodes: Located[]): Value {
	return nodes.length === 1 ? (nodes[0] as Located).value : NOTHING;
}

/** Runs a function extension; `match` and `search` answer `true` or `false` as their logical result. */
function call(expression: FunctionCall, root: JSONValue, current: JSONValue): Value {
	let [first, second] = expression.args as [Argument, Argument | undefined];
	switch (expression.name) {
		case "length": {
			let value = argumentValue(first, root, current);
			if (typeof value === "string") return Array.from(value).length;
			if (Array.isArray(value)) return value.length;
			if (isObject(value)) return Object.keys(value).length;
			return NOTHING;
		}
		case "count":
			return argumentNodes(first, root, current).length;
		case "value":
			return singleValue(argumentNodes(first, root, current));
		case "match":
		case "search": {
			let text = argumentValue(first, root, current);
			let pattern = argumentValue(second as Argument, root, current);
			if (typeof text !== "string" || typeof pattern !== "string") return false;
			return compileIRegexp(pattern, expression.name)?.test(text) ?? false;
		}
	}
}

/** A value-typed argument: a literal, a singular query's value, or a function's value. */
function argumentValue(argument: Argument, root: JSONValue, current: JSONValue): Value {
	if (argument.type === "literal") return argument.value;
	if (argument.type === "query") return singleValue(evaluate(argument.query, root, current));
	if (argument.type === "call") return call(argument, root, current);
	return NOTHING;
}

/** A nodes-typed argument, which the parser only admits as a query. */
function argumentNodes(argument: Argument, root: JSONValue, current: JSONValue): Located[] {
	return argument.type === "query" ? evaluate(argument.query, root, current) : [];
}

/** Section 2.3.5.2.2's comparison semantics, where `Nothing` equals only itself. */
function compare(left: Value, operator: ComparisonOperator, right: Value): boolean {
	switch (operator) {
		case "==":
			return isEqual(left, right);
		case "!=":
			return !isEqual(left, right);
		case "<":
			return isLess(left, right);
		case "<=":
			return isLess(left, right) || isEqual(left, right);
		case ">":
			return isLess(right, left);
		case ">=":
			return isLess(right, left) || isEqual(left, right);
	}
}

/** Deep equality over JSON values, member order ignored, `Nothing` equal only to `Nothing`. */
function isEqual(left: Value, right: Value): boolean {
	if (left === right) return true;
	if (left === NOTHING || right === NOTHING) return false;
	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
		return left.every((item, index) => isEqual(item, right[index] as JSONValue));
	}
	if (!isObject(left) || !isObject(right)) return false;
	let keys = Object.keys(left);
	if (keys.length !== Object.keys(right).length) return false;
	return keys.every(
		(key) => Object.hasOwn(right, key) && isEqual(left[key] as JSONValue, right[key] as JSONValue),
	);
}

/** `<` between two numbers, or two strings by Unicode scalar value; every other pair is unordered. */
function isLess(left: Value, right: Value): boolean {
	if (typeof left === "number" && typeof right === "number") return left < right;
	if (typeof left !== "string" || typeof right !== "string") return false;
	let a = Array.from(left);
	let b = Array.from(right);
	for (let index = 0; index < Math.min(a.length, b.length); index++) {
		let difference = (a[index]?.codePointAt(0) ?? 0) - (b[index]?.codePointAt(0) ?? 0);
		if (difference !== 0) return difference < 0;
	}
	return a.length < b.length;
}

/** Whether a value is a JSON object. */
function isObject(value: Value): value is { [key: string]: JSONValue } {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
