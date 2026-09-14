/**
 * The parsers that turn stored, untrusted JSON into definitions. They are the
 * package's published contract for what a flag is, so an admin UI validates a
 * rule against the same schema before writing what the engine would refuse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FlagMetadata, FlagValue } from "@sdxc/flags";
import type { JSONPrimitive } from "@sdxc/types";
import type { Schema } from "remix/data-schema";

import * as s from "remix/data-schema";
import { lazy } from "remix/data-schema/lazy";

import type { Condition, FlagDefinition, SegmentSet, Split, TargetingRule } from "./definition.js";

/** Reads a value a condition compares against, rejecting anything JSON cannot carry. */
const JSON_PRIMITIVE_SCHEMA: Schema<unknown, JSONPrimitive> = s.union([
	s.string(),
	s.number(),
	s.boolean(),
	s.null_(),
]);

/**
 * Reads a variant's value. Arrays are tried before records so a stored list
 * keeps its shape, and the recursion is deferred because a structure variant
 * nests without a declared depth.
 */
const FLAG_VALUE_SCHEMA: Schema<unknown, FlagValue> = lazy(() =>
	s.union([
		s.string(),
		s.number(),
		s.boolean(),
		s.null_(),
		s.array(FLAG_VALUE_SCHEMA),
		s.record(s.string(), FLAG_VALUE_SCHEMA),
	]),
);

/** A dotted path into the evaluation context, which an empty string cannot name. */
const FIELD_SCHEMA = s.string().refine((field) => field.length > 0, "Expected a context field");

/**
 * Holds a discriminant at the literal type it was written as, so the parsed
 * condition narrows on `op` the way the union it belongs to promises.
 */
function operator<const Op extends Condition["op"]>(name: Op): Schema<unknown, Op> {
	return s.literal(name);
}

/** The eight comparisons `semver` closes over, so nothing parses a range mini-language. */
const SEMVER_COMPARISON_SCHEMA = s.enum_(["=", "!=", "<", "<=", ">", ">=", "~", "^"]);

/**
 * Reads one targeting condition. Annotated rather than inferred because
 * `s.variant` widens the discriminant it merges, which would cost every
 * consumer the narrowing the union exists for.
 */
export const CONDITION_SCHEMA: Schema<unknown, Condition> = lazy(() =>
	s.variant("op", {
		all: s.object({ op: operator("all"), of: s.array(CONDITION_SCHEMA) }),
		any: s.object({ op: operator("any"), of: s.array(CONDITION_SCHEMA) }),
		not: s.object({ op: operator("not"), of: CONDITION_SCHEMA }),
		eq: s.object({ op: operator("eq"), field: FIELD_SCHEMA, value: JSON_PRIMITIVE_SCHEMA }),
		ne: s.object({ op: operator("ne"), field: FIELD_SCHEMA, value: JSON_PRIMITIVE_SCHEMA }),
		in: s.object({
			op: operator("in"),
			field: FIELD_SCHEMA,
			values: s.array(JSON_PRIMITIVE_SCHEMA),
		}),
		notIn: s.object({
			op: operator("notIn"),
			field: FIELD_SCHEMA,
			values: s.array(JSON_PRIMITIVE_SCHEMA),
		}),
		lt: s.object({ op: operator("lt"), field: FIELD_SCHEMA, value: s.number() }),
		lte: s.object({ op: operator("lte"), field: FIELD_SCHEMA, value: s.number() }),
		gt: s.object({ op: operator("gt"), field: FIELD_SCHEMA, value: s.number() }),
		gte: s.object({ op: operator("gte"), field: FIELD_SCHEMA, value: s.number() }),
		startsWith: s.object({
			op: operator("startsWith"),
			field: FIELD_SCHEMA,
			value: s.string(),
		}),
		endsWith: s.object({ op: operator("endsWith"), field: FIELD_SCHEMA, value: s.string() }),
		contains: s.object({ op: operator("contains"), field: FIELD_SCHEMA, value: s.string() }),
		matches: s.object({ op: operator("matches"), field: FIELD_SCHEMA, pattern: s.string() }),
		semver: s.object({
			op: operator("semver"),
			field: FIELD_SCHEMA,
			compare: SEMVER_COMPARISON_SCHEMA,
			value: s.string(),
		}),
		exists: s.object({ op: operator("exists"), field: FIELD_SCHEMA }),
		segment: s.object({ op: operator("segment"), name: s.string() }),
		always: s.object({ op: operator("always") }),
	}),
);

/** A weight, kept whole so a bucket is a count of shares rather than a fraction. */
const WEIGHT_SCHEMA = s
	.number()
	.refine(
		(weight) => Number.isInteger(weight) && weight >= 0,
		"Expected a whole, non-negative weight",
	);

/** Sums the weights so a split that could never select an arm is refused at parse time. */
function hasPositiveTotal(weights: Record<string, number>): boolean {
	let total = 0;
	for (let weight of Object.values(weights)) total += weight;
	return total > 0;
}

/** Reads the weighted spread a rule serves instead of naming one variant. */
export const SPLIT_SCHEMA: Schema<unknown, Split> = s.object({
	weights: s
		.record(s.string(), WEIGHT_SCHEMA)
		.refine(hasPositiveTotal, "Expected weights summing above zero"),
	by: s.optional(FIELD_SCHEMA),
	seed: s.optional(s.string()),
});

/** Reads one targeting row, whose `serve` is either a variant name or a split. */
export const TARGETING_RULE_SCHEMA: Schema<unknown, TargetingRule> = s.object({
	when: CONDITION_SCHEMA,
	serve: s.union([s.string(), SPLIT_SCHEMA]),
});

/** Reads the properties a resolution of this flag carries to whatever reads the event. */
const FLAG_METADATA_SCHEMA: Schema<unknown, FlagMetadata> = s.record(
	s.string(),
	s.union([s.string(), s.number(), s.boolean()]),
);

/**
 * Reads one flag. A flag with no variants is refused here, so every later step
 * is choosing among values that exist.
 */
export const FLAG_DEFINITION_SCHEMA: Schema<unknown, FlagDefinition> = s.object({
	variants: s
		.record(s.string(), FLAG_VALUE_SCHEMA)
		.refine((variants) => Object.keys(variants).length > 0, "Expected at least one variant"),
	defaultVariant: s.optional(s.string()),
	state: s.optional(s.enum_(["enabled", "disabled"])),
	targeting: s.optional(s.array(TARGETING_RULE_SCHEMA)),
	metadata: s.optional(FLAG_METADATA_SCHEMA),
});

/**
 * Reads a whole segment map at once, for an editor validating what it is about
 * to write. The engine reads segments one at a time so a bad one costs only the
 * flags that reference it.
 */
export const SEGMENT_SET_SCHEMA: Schema<unknown, SegmentSet> = s.record(
	s.string(),
	CONDITION_SCHEMA,
);
