/**
 * Compiles a filter AST into a predicate over wire-shaped resources, following RFC 7644
 * §3.4.2.2's evaluation rules: string comparisons fold case unless `caseExact`, date-times
 * compare as instants, and a multi-valued attribute matches when any of its values does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Discovery } from "../../discovery.js";
import type { Filter } from "../../filter.js";
import type { ResolvedPath } from "../attributes.js";

import {
	findAttribute,
	isPresent,
	isWireObject,
	readContainer,
	readKey,
	resolvePath,
} from "../attributes.js";
import { badRequest, ScimError } from "../error.js";

import { parsePath } from "./parse.js";
import { stringifyPath } from "./stringify.js";

/** A compiled test over a resource, or over one value inside a value path. */
type Test = (target: unknown) => boolean;

/** Where the paths of an expression resolve: against the resource, or one value of a multi-valued attribute. */
interface Scope {
	definitions: Discovery.Definitions;
	/** Allowed path keys, or `null` when every defined path is allowed. */
	allowed: Set<string> | null;
	/** The multi-valued attribute a value path filters, when compiling inside `[...]`. */
	element: ResolvedPath | null;
}

/** An operand path resolved to the definition its values are compared by, and how to read them. */
interface Operand {
	definition: Discovery.Attribute;
	values: (target: unknown) => unknown[];
}

/**
 * The key an allow list and a filter path agree on: the owning schema, attribute and
 * sub-attribute, lowercased, so `userName` and its fully qualified form are the same path.
 *
 * @param schema - The owning schema's URN, `null` for common attributes
 * @param attribute - The attribute name
 * @param subAttribute - The sub-attribute name, when any
 * @returns The key
 */
function pathKey(schema: string | null, attribute: string, subAttribute: string | null): string {
	return [schema ?? "", attribute, subAttribute ?? ""].join("|").toLowerCase();
}

/**
 * Whether the scope's allow list admits a path. Allowing a complex attribute allows each
 * of its sub-attributes.
 *
 * @param scope - The compile scope
 * @param resolved - The resolved attribute
 * @param subAttribute - The sub-attribute actually compared, when any
 * @returns Whether the path may be filtered on
 */
function isAllowed(scope: Scope, resolved: ResolvedPath, subAttribute: string | null): boolean {
	if (scope.allowed === null) return true;
	let schema = resolved.schema?.id ?? null;
	return (
		scope.allowed.has(pathKey(schema, resolved.attribute.name, subAttribute)) ||
		scope.allowed.has(pathKey(schema, resolved.attribute.name, null))
	);
}

/**
 * Spreads multi-valued values into one list and drops unassigned ones.
 *
 * @param value - A single value or an array of them
 * @returns The assigned values
 */
function spread(value: unknown): unknown[] {
	let values = Array.isArray(value) ? value : [value];
	return values.filter((item) => item !== undefined && item !== null);
}

/**
 * Resolves a comparison or presence path to its operand. On a complex attribute with a
 * `value` sub-attribute and no sub-attribute written, comparisons read `value`, which is how
 * RFC 7644's own `emails co "example.com"` example reads.
 *
 * @param path - The path as written
 * @param scope - Where it resolves
 * @param forPresence - Whether the operand is for `pr`, which may test a whole complex value
 * @returns The operand, or `invalidFilter`
 */
function resolveOperand(
	path: Filter.AttributePath,
	scope: Scope,
	forPresence: boolean,
): Operand | ScimError {
	let text = stringifyPath(path);

	if (scope.element !== null) {
		let parent = scope.element.attribute;
		if (path.schema !== null || path.subAttribute !== null) {
			return badRequest("invalidFilter", `"${text}" must name a sub-attribute of ${parent.name}.`);
		}
		let definition = findAttribute(parent.subAttributes, path.attribute);
		let isSelf = !parent.subAttributes && path.attribute.toLowerCase() === "value";
		if (!definition && !isSelf) {
			return badRequest("invalidFilter", `${parent.name} has no sub-attribute "${text}".`);
		}
		if (!isAllowed(scope, scope.element, definition?.name ?? "value")) {
			return badRequest("invalidFilter", `Filtering on ${parent.name}.${text} is not supported.`);
		}
		if (!definition) {
			return {
				definition: { ...parent, multiValued: false },
				values: (element) => spread(element),
			};
		}
		let name = definition.name;
		return {
			definition,
			values: (element) => (isWireObject(element) ? spread(readKey(element, name)) : []),
		};
	}

	let resolved = resolvePath(path, scope.definitions);
	if (!resolved) return badRequest("invalidFilter", `"${text}" is not a known attribute.`);

	let sub = resolved.subAttribute;
	if (!sub && resolved.attribute.type === "complex" && !forPresence) {
		sub = findAttribute(resolved.attribute.subAttributes, "value") ?? null;
		if (!sub) {
			return badRequest("invalidFilter", `"${text}" is complex; name one of its sub-attributes.`);
		}
	}
	if (!isAllowed(scope, resolved, sub?.name ?? null)) {
		return badRequest("invalidFilter", `Filtering on "${text}" is not supported.`);
	}

	let found = resolved;
	let attributeName = resolved.attribute.name;
	let subName = sub?.name ?? null;
	return {
		definition: sub ?? resolved.attribute,
		values: (resource) => {
			if (!isWireObject(resource)) return [];
			let container = readContainer(resource, found);
			if (!container) return [];
			let values = spread(readKey(container, attributeName));
			if (subName === null) return values;
			return values.flatMap((value) =>
				isWireObject(value) ? spread(readKey(value, subName)) : [],
			);
		},
	};
}

/**
 * Builds the test one value must pass for a comparison, validating the operator and the
 * comparison value against the attribute's type as RFC 7644 Table 3 requires.
 *
 * @param definition - The compared attribute
 * @param operator - The operator
 * @param value - The comparison value, never `null` here
 * @param text - The filter text of the path, for error details
 * @returns The test, or `invalidFilter`
 */
function comparator(
	definition: Discovery.Attribute,
	operator: Filter.Operator,
	value: string | number | boolean,
	text: string,
): Test | ScimError {
	let ordering = operator === "gt" || operator === "ge" || operator === "lt" || operator === "le";
	let substring = operator === "co" || operator === "sw" || operator === "ew";
	let mismatch = (expected: string) =>
		badRequest("invalidFilter", `${text} is ${definition.type}; compare it with ${expected}.`);

	switch (definition.type) {
		case "complex":
			return badRequest("invalidFilter", `"${text}" is complex; name one of its sub-attributes.`);

		case "boolean":
			if (operator !== "eq" && operator !== "ne") {
				return badRequest("invalidFilter", `${operator} does not apply to the boolean ${text}.`);
			}
			if (typeof value !== "boolean") return mismatch("true or false");
			return (candidate) => (candidate === value) === (operator === "eq");

		case "integer":
		case "decimal":
			if (substring) {
				return badRequest("invalidFilter", `${operator} does not apply to the number ${text}.`);
			}
			if (typeof value !== "number") return mismatch("a number");
			return (candidate) => typeof candidate === "number" && order(operator, candidate, value);

		case "dateTime": {
			if (typeof value !== "string") return mismatch("a date-time string");
			if (substring) return stringTest(operator, value, true);
			let instant = Date.parse(value);
			if (Number.isNaN(instant)) return mismatch("a valid date-time");
			return (candidate) => {
				if (typeof candidate !== "string") return false;
				let other = Date.parse(candidate);
				return !Number.isNaN(other) && order(operator, other, instant);
			};
		}

		case "binary":
			if (ordering) {
				return badRequest("invalidFilter", `${operator} does not apply to the binary ${text}.`);
			}
			if (typeof value !== "string") return mismatch("a string");
			return stringTest(operator, value, true);

		case "string":
		case "reference":
			if (typeof value !== "string") return mismatch("a string");
			return stringTest(operator, value, definition.caseExact);
	}
}

/**
 * Compares two ordered values with an equality or ordering operator.
 *
 * @param operator - `eq`, `ne`, `gt`, `ge`, `lt` or `le`
 * @param candidate - The resource's value
 * @param value - The filter's value
 * @returns Whether the comparison holds; substring operators never hold
 */
function order<Value extends number | string>(
	operator: Filter.Operator,
	candidate: Value,
	value: Value,
): boolean {
	switch (operator) {
		case "eq":
			return candidate === value;
		case "ne":
			return candidate !== value;
		case "gt":
			return candidate > value;
		case "ge":
			return candidate >= value;
		case "lt":
			return candidate < value;
		case "le":
			return candidate <= value;
		default:
			return false;
	}
}

/**
 * A string test, lowercasing both sides when the attribute is not `caseExact`; ordering
 * operators compare lexicographically, as RFC 7644 Table 3 specifies for strings.
 *
 * @param operator - Any operator
 * @param value - The filter's string
 * @param caseExact - Whether case is significant
 * @returns The test
 */
function stringTest(operator: Filter.Operator, value: string, caseExact: boolean): Test {
	let fold = (text: string) => (caseExact ? text : text.toLowerCase());
	let expected = fold(value);
	return (candidate) => {
		if (typeof candidate !== "string") return false;
		let actual = fold(candidate);
		switch (operator) {
			case "co":
				return actual.includes(expected);
			case "sw":
				return actual.startsWith(expected);
			case "ew":
				return actual.endsWith(expected);
			default:
				return order(operator, actual, expected);
		}
	};
}

/**
 * Compiles one node of the tree in a scope.
 *
 * @param expression - The node
 * @param scope - Where its paths resolve
 * @returns The test, or `invalidFilter`
 */
function compileNode(expression: Filter.Expression, scope: Scope): Test | ScimError {
	switch (expression.kind) {
		case "and":
		case "or": {
			let left = compileNode(expression.left, scope);
			if (left instanceof ScimError) return left;
			let right = compileNode(expression.right, scope);
			if (right instanceof ScimError) return right;
			if (expression.kind === "and") return (target) => left(target) && right(target);
			return (target) => left(target) || right(target);
		}

		case "not": {
			let inner = compileNode(expression.expression, scope);
			if (inner instanceof ScimError) return inner;
			return (target) => !inner(target);
		}

		case "present": {
			let operand = resolveOperand(expression.path, scope, true);
			if (operand instanceof ScimError) return operand;
			return (target) => operand.values(target).some(isPresent);
		}

		case "compare":
			return compileCompare(expression, scope);

		case "valuePath":
			return compileValuePath(expression, scope);
	}
}

/**
 * Compiles a comparison. `eq null` tests absence and `ne null` presence; against an
 * unassigned attribute, `ne` holds and every other operator fails.
 *
 * @param expression - The comparison
 * @param scope - Where its path resolves
 * @returns The test, or `invalidFilter`
 */
function compileCompare(expression: Filter.Compare, scope: Scope): Test | ScimError {
	let operand = resolveOperand(expression.path, scope, false);
	if (operand instanceof ScimError) return operand;
	let { operator, value } = expression;

	if (value === null) {
		if (operator !== "eq" && operator !== "ne") {
			return badRequest("invalidFilter", `${operator} cannot compare with null.`);
		}
		return (target) => operand.values(target).some(isPresent) === (operator === "ne");
	}

	let test = comparator(operand.definition, operator, value, stringifyPath(expression.path));
	if (test instanceof ScimError) return test;
	let matches = test;
	return (target) => {
		let values = operand.values(target);
		if (values.length === 0) return operator === "ne";
		return values.some(matches);
	};
}

/**
 * Compiles `attribute[filter]`: the inner filter runs against each value of the attribute,
 * and the resource matches when one value does.
 *
 * @param expression - The value path
 * @param scope - The resource scope
 * @returns The test, or `invalidFilter`
 */
function compileValuePath(expression: Filter.ValuePath, scope: Scope): Test | ScimError {
	let text = stringifyPath(expression.path);
	let resolved = resolvePath(expression.path, scope.definitions);
	if (!resolved) return badRequest("invalidFilter", `"${text}" is not a known attribute.`);
	if (!resolved.attribute.multiValued && resolved.attribute.type !== "complex") {
		return badRequest("invalidFilter", `"${text}" is neither multi-valued nor complex.`);
	}

	let inner = compileNode(expression.filter, { ...scope, element: resolved });
	if (inner instanceof ScimError) return inner;
	let found = resolved;
	return (resource) => {
		if (!isWireObject(resource)) return false;
		let container = readContainer(resource, found);
		if (!container) return false;
		return spread(readKey(container, found.attribute.name)).some(inner);
	};
}

/**
 * Compiles a parsed filter into a predicate over wire-shaped resources (URN-keyed
 * extensions, any attribute-name casing). Every path is checked against the definitions and
 * the allow list up front, so a filter either compiles completely or fails `invalidFilter`.
 *
 * @param expression - The parsed filter
 * @param options - The definitions and the optional allow list
 * @returns The predicate
 * @example compileFilter(expression, { definitions, allow: ["userName", "emails.value"] })
 */
export function compileFilter(
	expression: Filter.Expression,
	options: Filter.CompileOptions,
): Result<(resource: object) => boolean, ScimError> {
	let allowed: Set<string> | null = null;
	if (options.allow) {
		allowed = new Set();
		for (let entry of options.allow) {
			let path = parsePath(entry);
			if (isFailure(path)) continue;
			let resolved = resolvePath(path.data, options.definitions);
			if (!resolved) continue;
			allowed.add(
				pathKey(
					resolved.schema?.id ?? null,
					resolved.attribute.name,
					resolved.subAttribute?.name ?? null,
				),
			);
		}
	}

	let test = compileNode(expression, { definitions: options.definitions, allowed, element: null });
	if (test instanceof ScimError) return failure(test);
	let predicate = test;
	return success((resource: object) => predicate(resource));
}

/**
 * Compiles a filter over the values of one multi-valued attribute, as a PATCH value path
 * selects them. No allow list applies; every sub-attribute the definition declares may be named.
 *
 * @param expression - The value filter
 * @param attribute - The resolved multi-valued attribute
 * @param definitions - The served definitions
 * @returns A test over one value, or `invalidPath`-worthy `invalidFilter`
 */
export function compileValueFilter(
	expression: Filter.Expression,
	attribute: ResolvedPath,
	definitions: Discovery.Definitions,
): Test | ScimError {
	return compileNode(expression, { definitions, allowed: null, element: attribute });
}
