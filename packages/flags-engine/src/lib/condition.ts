/**
 * Whether one compiled condition holds for an evaluation context: the operator
 * table a targeting rule is written in, applied one operator at a time over the
 * dotted path each of them names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EvaluationContext } from "@sdxc/flags";

import { satisfies } from "@sdxc/semver";

import type { CompiledCondition } from "../snapshot.js";

import { read } from "./path.js";

/** The operators that ask about one field, as against the ones that compose. */
type FieldCondition = Extract<CompiledCondition, { field: string }>;

/**
 * Answers whether the subject this context describes is one the condition is
 * about. Composition is the whole of what `all`, `any`, `not` and `segment`
 * add, so every other operator sees one field and one value.
 *
 * @param condition The condition as the snapshot compiled it.
 * @param context The merged context an evaluation was given.
 * @example matchesCondition({ op: "eq", field: "country", value: "AR" }, { country: "AR" })
 */
export function matchesCondition(
	condition: CompiledCondition,
	context: EvaluationContext,
): boolean {
	switch (condition.op) {
		case "all":
			return condition.of.every((member) => matchesCondition(member, context));
		case "any":
			return condition.of.some((member) => matchesCondition(member, context));
		case "not":
			return !matchesCondition(condition.of, context);
		case "segment":
			return matchesCondition(condition.of, context);
		case "always":
			return true;
		default:
			return matchesField(condition, context);
	}
}

/**
 * Compares one field against the value a rule was written with. A path that
 * resolves to nothing holds for no comparison, which is what keeps a rule about
 * a field the caller did not send from matching everyone; `exists` asks about
 * the path itself, so it answers first.
 */
function matchesField(condition: FieldCondition, context: EvaluationContext): boolean {
	let value = read(context, condition.field);

	if (condition.op === "exists") return value !== undefined;
	if (value === undefined) return false;

	switch (condition.op) {
		case "eq":
			return value === condition.value;
		case "ne":
			return value !== condition.value;
		case "in":
			return condition.values.some((member) => member === value);
		case "notIn":
			return condition.values.every((member) => member !== value);
		case "lt":
			return typeof value === "number" && value < condition.value;
		case "lte":
			return typeof value === "number" && value <= condition.value;
		case "gt":
			return typeof value === "number" && value > condition.value;
		case "gte":
			return typeof value === "number" && value >= condition.value;
		case "startsWith":
			return typeof value === "string" && value.startsWith(condition.value);
		case "endsWith":
			return typeof value === "string" && value.endsWith(condition.value);
		case "contains":
			return typeof value === "string" && value.includes(condition.value);
		case "matches":
			return typeof value === "string" && condition.pattern.test(value);
		case "semver":
			return typeof value === "string" && satisfies(value, condition.compare, condition.value);
	}
}
