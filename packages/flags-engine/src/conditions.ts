/**
 * The dialect a targeting rule is written in: a fixed list of built-in
 * conditions, a `semver` comparison for app versions, and references spelled
 * `segment`, so a stored flag set reads exactly as it always has.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createLanguage, defineOperator } from "@sdxc/expression";
import { satisfies } from "@sdxc/semver";
import * as s from "remix/data-schema";

/** The eight comparisons `semver` closes over, so nothing parses a range mini-language. */
const SEMVER_COMPARISON_SCHEMA = s.enum_(["=", "!=", "<", "<=", ">", ">=", "~", "^"]);

/**
 * Compares a version field against a version, holding for nobody when the
 * field is no version at all.
 */
const SEMVER = defineOperator({
	op: "semver",
	args: ["field", "compare", "value"],
	schema: s.object({ compare: SEMVER_COMPARISON_SCHEMA, value: s.string() }),
	test: (value, node) => typeof value === "string" && satisfies(value, node.compare, node.value),
});

/**
 * The built-in operators a targeting rule may use, named one by one so the
 * published condition schema grows only when this list does.
 */
const BUILTINS = [
	"all",
	"any",
	"not",
	"eq",
	"ne",
	"in",
	"notIn",
	"lt",
	"lte",
	"gt",
	"gte",
	"startsWith",
	"endsWith",
	"contains",
	"matches",
	"exists",
	"always",
] as const;

/**
 * Validates, compiles and evaluates targeting conditions, and turns them to
 * and from text for an editor. A reference names a segment of the same set.
 *
 * @example flagConditions.compile(rule.when, { references: segments })
 */
export const flagConditions = createLanguage({
	builtins: BUILTINS,
	reference: "segment",
	operators: [SEMVER],
});
