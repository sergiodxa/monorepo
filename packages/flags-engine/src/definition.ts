/**
 * What a flag is written down as: the values it can take, the ordered rules
 * that choose between them, and the conditions those rules match on. Types
 * only, so an admin UI and the engine describe a definition the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FlagMetadata, FlagValue } from "@sdxc/flags";
import type { JSONPrimitive } from "@sdxc/types";

/**
 * How `semver` compares a version field against its value. `~` holds for a
 * matching major and minor, `^` for a matching major; the other six read as
 * they do in arithmetic.
 */
export type SemVerComparison = "=" | "!=" | "<" | "<=" | ">" | ">=" | "~" | "^";

/**
 * Whether a flag evaluates at all. A disabled flag serves the caller's own
 * default value, which is how a flag is switched off without the rules that
 * describe its rollout being deleted.
 */
export type FlagState = "enabled" | "disabled";

/**
 * One test against the evaluation context. `field` is a dotted path, so
 * `plan.tier` reads a nested structure; a path that resolves to nothing makes
 * every operator except `exists` false, and each operator compares within one
 * type rather than coercing across them.
 */
export type Condition =
	| { op: "all"; of: Condition[] }
	| { op: "any"; of: Condition[] }
	| { op: "not"; of: Condition }
	| { op: "eq" | "ne"; field: string; value: JSONPrimitive }
	| { op: "in" | "notIn"; field: string; values: JSONPrimitive[] }
	| { op: "lt" | "lte" | "gt" | "gte"; field: string; value: number }
	| { op: "startsWith" | "endsWith" | "contains"; field: string; value: string }
	| { op: "matches"; field: string; pattern: string }
	| { op: "semver"; field: string; compare: SemVerComparison; value: string }
	| { op: "exists"; field: string }
	| { op: "segment"; name: string }
	| { op: "always" };

/** How a rule spreads one condition's subjects across several variants. */
export interface Split {
	/**
	 * Whole, non-negative weights by variant name, taken against their own sum,
	 * so `{ on: 1, off: 1 }` is a half-and-half split and one arm widens without
	 * the others being rebalanced.
	 */
	weights: Record<string, number>;
	/** The context field the subject is read from. @default "targetingKey" */
	by?: string;
	/** Mixed into the hash instead of the flag key, so two flags share a bucketing. */
	seed?: string;
}

/** One row of a flag's targeting: who it is about, and what they are served. */
export interface TargetingRule {
	when: Condition;
	/** The variant this rule names, or the weights it buckets its subjects among. */
	serve: string | Split;
}

/** A flag as an author writes it, and as a store hands it back. */
export interface FlagDefinition {
	/** Every value this flag can take, by variant name. */
	variants: Record<string, FlagValue>;
	/** The variant served when no rule matches; absent means the caller's own default. */
	defaultVariant?: string;
	/** @default "enabled" */
	state?: FlagState;
	/** Tried in order; the first rule whose condition holds decides the variant. */
	targeting?: TargetingRule[];
	/** Travels onto every resolution of this flag, for whatever reads the wide event. */
	metadata?: FlagMetadata;
}

/**
 * Conditions declared once and referenced by name, so "is an internal user" is
 * written in one place and read by twenty flags. A segment may reference
 * another segment.
 */
export type SegmentSet = Record<string, Condition>;

/** A whole definition set: the flags to evaluate, and the segments they share. */
export interface FlagSet {
	flags: Record<string, FlagDefinition>;
	segments?: SegmentSet;
}
