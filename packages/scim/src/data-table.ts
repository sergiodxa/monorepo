/**
 * Translates a SCIM filter into a `remix/data-table` predicate, so a list backed by one
 * table filters in SQL. A filter with no faithful SQL form fails with
 * `UntranslatableFilterError`, and the caller evaluates it with `compileFilter` instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Predicate } from "remix/data-table";

import { failure, success } from "@sdxc/result";
import { and, eq, gt, gte, ilike, isNull, like, lt, lte, ne, notNull, or } from "remix/data-table";

import type { Filter } from "./filter.js";

import { badRequest, ScimError } from "./lib/error.js";
import { stringifyFilter, stringifyPath } from "./lib/filter/stringify.js";

/**
 * Columns by filter path (`displayName`, `emails.value`, or fully qualified), matched
 * case-insensitively. A bare column name compares case-sensitively; `caseExact: false`
 * makes `eq` and the substring operators fold case, as the attribute's definition does.
 */
export interface ColumnMap {
	[path: string]: string | { column: string; caseExact?: boolean };
}

/** The filter is valid but has no faithful `remix/data-table` form; evaluate it in memory instead. */
export class UntranslatableFilterError extends Error {
	override name = "UntranslatableFilterError";
}

/** A column a filter path maps to. */
interface Column {
	column: string;
	caseExact: boolean;
}

/** Characters with meaning inside a `LIKE` pattern, which no adapter lets a predicate escape. */
const LIKE_SPECIAL = /[%_\\]/;

/** The operator each comparison negates to. */
const INVERSE: Record<Filter.Operator, Filter.Operator> = {
	eq: "ne",
	ne: "eq",
	gt: "le",
	ge: "lt",
	lt: "ge",
	le: "gt",
	co: "co",
	sw: "sw",
	ew: "ew",
};

/**
 * Finds the column for a path: the fully qualified spelling first, then the unqualified one.
 *
 * @param columns - The normalized map
 * @param path - The filter path
 * @returns The column, or `undefined`
 */
function findColumn(columns: Map<string, Column>, path: Filter.AttributePath): Column | undefined {
	let qualified = stringifyPath(path).toLowerCase();
	let unqualified = stringifyPath({ ...path, schema: null }).toLowerCase();
	return columns.get(qualified) ?? columns.get(unqualified);
}

/**
 * The `LIKE` pattern for a substring operator, or `null` when the value holds a character
 * `LIKE` would read as a wildcard or escape.
 *
 * @param operator - `co`, `sw` or `ew`
 * @param value - The filter's string
 * @returns The pattern, or `null`
 */
function likePattern(operator: "co" | "sw" | "ew", value: string): string | null {
	if (LIKE_SPECIAL.test(value)) return null;
	if (operator === "co") return `%${value}%`;
	if (operator === "sw") return `${value}%`;
	return `%${value}`;
}

/**
 * Translates a comparison, negated when `negated` is set. `ne` and a negated comparison also
 * match `NULL`, since SCIM's `ne` holds for an unassigned attribute while SQL's `<>` does not.
 *
 * @param expression - The comparison
 * @param column - Its column
 * @param negated - Whether a `not` wraps it
 * @returns The predicate, or why it has no SQL form
 */
function translateCompare(
	expression: Filter.Compare,
	column: Column,
	negated: boolean,
): Predicate | ScimError | UntranslatableFilterError {
	let { operator, value } = expression;
	let name = column.column;
	let text = stringifyFilter(expression);
	let untranslatable = (reason: string) => new UntranslatableFilterError(`${text}: ${reason}`);

	if (value === null) {
		if (operator !== "eq" && operator !== "ne") {
			return badRequest("invalidFilter", `${operator} cannot compare with null.`);
		}
		return (operator === "eq") !== negated ? isNull(name) : notNull(name);
	}

	if (operator === "co" || operator === "sw" || operator === "ew") {
		if (typeof value !== "string") {
			return badRequest("invalidFilter", `${operator} compares strings only.`);
		}
		if (negated) return untranslatable("a negated substring match has no predicate.");
		let pattern = likePattern(operator, value);
		if (pattern === null) return untranslatable("the value holds a LIKE wildcard.");
		return column.caseExact ? like(name, pattern) : ilike(name, pattern);
	}

	if (typeof value === "boolean" && operator !== "eq" && operator !== "ne") {
		return badRequest("invalidFilter", `${operator} does not apply to booleans.`);
	}

	let effective = negated ? INVERSE[operator] : operator;

	if (typeof value === "string" && !column.caseExact) {
		if (effective !== "eq") return untranslatable("only eq folds case in SQL.");
		if (LIKE_SPECIAL.test(value)) return untranslatable("the value holds a LIKE wildcard.");
		return ilike(name, value);
	}

	switch (effective) {
		case "eq":
			return eq(name, value);
		case "ne":
			return or(ne(name, value), isNull(name));
		case "gt":
			return negated ? or(gt(name, value), isNull(name)) : gt(name, value);
		case "ge":
			return negated ? or(gte(name, value), isNull(name)) : gte(name, value);
		case "lt":
			return negated ? or(lt(name, value), isNull(name)) : lt(name, value);
		default:
			return negated ? or(lte(name, value), isNull(name)) : lte(name, value);
	}
}

/**
 * Translates one node, pushing a `not` down through `and`/`or` by De Morgan's laws, since
 * `remix/data-table` has no negation predicate.
 *
 * @param expression - The node
 * @param columns - The normalized map
 * @param negated - Whether an odd number of `not`s wraps it
 * @returns The predicate, or why it has no SQL form
 */
function translate(
	expression: Filter.Expression,
	columns: Map<string, Column>,
	negated: boolean,
): Predicate | ScimError | UntranslatableFilterError {
	switch (expression.kind) {
		case "not":
			return translate(expression.expression, columns, !negated);

		case "and":
		case "or": {
			let left = translate(expression.left, columns, negated);
			if (!isPredicate(left)) return left;
			let right = translate(expression.right, columns, negated);
			if (!isPredicate(right)) return right;
			return (expression.kind === "and") !== negated ? and(left, right) : or(left, right);
		}

		case "valuePath":
			return new UntranslatableFilterError(
				`${stringifyFilter(expression)}: value paths have no predicate.`,
			);

		case "present":
		case "compare": {
			let column = findColumn(columns, expression.path);
			if (!column) {
				return new UntranslatableFilterError(
					`${stringifyPath(expression.path)} maps to no column.`,
				);
			}
			if (expression.kind === "present")
				return negated ? isNull(column.column) : notNull(column.column);
			return translateCompare(expression, column, negated);
		}
	}
}

/**
 * Whether a translation step produced a predicate rather than an error.
 *
 * @param value - The step's result
 * @returns Whether it is a predicate
 */
function isPredicate(value: Predicate | Error): value is Predicate {
	return !(value instanceof Error);
}

/**
 * Translates a filter into a `remix/data-table` predicate that selects exactly the rows
 * `compileFilter` would. Value paths, unmapped paths, negated substring matches, case-folded
 * ordering and values holding `%`, `_` or `\` fail with `UntranslatableFilterError`.
 *
 * @param expression - The parsed filter
 * @param columns - The column each filterable path maps to
 * @returns The predicate
 * @example filterToWhere(filter, { displayName: { column: "display_name", caseExact: false } })
 */
export function filterToWhere(
	expression: Filter.Expression,
	columns: ColumnMap,
): Result<Predicate, ScimError | UntranslatableFilterError> {
	let normalized = new Map<string, Column>();
	for (let [path, entry] of Object.entries(columns)) {
		let column =
			typeof entry === "string"
				? { column: entry, caseExact: true }
				: { caseExact: true, ...entry };
		normalized.set(path.toLowerCase(), {
			column: column.column,
			caseExact: column.caseExact !== false,
		});
	}
	let result = translate(expression, normalized, false);
	return isPredicate(result) ? success(result) : failure(result);
}
