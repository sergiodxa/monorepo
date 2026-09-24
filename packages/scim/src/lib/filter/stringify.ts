/**
 * Writes a filter AST back to RFC 7644 filter text, adding parentheses only where
 * precedence needs them, so `parseFilter(stringifyFilter(e))` yields `e` again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Filter } from "../../filter.js";

/**
 * Writes attribute notation, URN prefix included when the path carries one.
 *
 * @param path - The path
 * @returns Its text, such as `name.familyName`
 */
export function stringifyPath(path: Filter.AttributePath): string {
	let name = path.subAttribute === null ? path.attribute : `${path.attribute}.${path.subAttribute}`;
	return path.schema === null ? name : `${path.schema}:${name}`;
}

/**
 * Writes one operand of `and`/`or`, parenthesized when it binds looser than its parent or
 * sits on the right of the same operator, which would otherwise reassociate to the left.
 *
 * @param expression - The operand
 * @param parent - The operator joining it
 * @param side - Which operand it is
 * @returns Its text
 */
function operand(
	expression: Filter.Expression,
	parent: "and" | "or",
	side: "left" | "right",
): string {
	let text = stringifyFilter(expression);
	let looser = parent === "and" && expression.kind === "or";
	let reassociates = side === "right" && expression.kind === parent;
	return looser || reassociates ? `(${text})` : text;
}

/**
 * Writes a filter as text. Strings are JSON-quoted, operators and keywords lowercase.
 *
 * @param expression - The filter
 * @returns Filter text that parses back to the same tree
 * @example stringifyFilter({ kind: "present", path: { schema: null, attribute: "title", subAttribute: null } }) // "title pr"
 */
export function stringifyFilter(expression: Filter.Expression): string {
	switch (expression.kind) {
		case "compare":
			return `${stringifyPath(expression.path)} ${expression.operator} ${JSON.stringify(expression.value)}`;
		case "present":
			return `${stringifyPath(expression.path)} pr`;
		case "and":
		case "or":
			return `${operand(expression.left, expression.kind, "left")} ${expression.kind} ${operand(expression.right, expression.kind, "right")}`;
		case "not":
			return `not (${stringifyFilter(expression.expression)})`;
		case "valuePath":
			return `${stringifyPath(expression.path)}[${stringifyFilter(expression.filter)}]`;
	}
}
