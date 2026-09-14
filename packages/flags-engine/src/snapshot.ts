/**
 * The form the engine holds a definition set in once it has been parsed:
 * segments already resolved, patterns already compiled, variant names already
 * checked, so evaluating a flag walks a structure known to be well formed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FlagMetadata, FlagValue } from "@sdxc/flags";
import type { JSONPrimitive } from "@sdxc/types";

import type { FlagState, SemVerComparison, Split } from "./definition.js";

/**
 * A condition with the two parts evaluation cannot do cheaply already done: a
 * `matches` pattern is a compiled expression, and a `segment` carries the
 * condition it names, so no operator reaches back to the snapshot to resolve.
 */
export type CompiledCondition =
	| { op: "all"; of: CompiledCondition[] }
	| { op: "any"; of: CompiledCondition[] }
	| { op: "not"; of: CompiledCondition }
	| { op: "eq" | "ne"; field: string; value: JSONPrimitive }
	| { op: "in" | "notIn"; field: string; values: JSONPrimitive[] }
	| { op: "lt" | "lte" | "gt" | "gte"; field: string; value: number }
	| { op: "startsWith" | "endsWith" | "contains"; field: string; value: string }
	| { op: "matches"; field: string; pattern: RegExp }
	| { op: "semver"; field: string; compare: SemVerComparison; value: string }
	| { op: "exists"; field: string }
	| { op: "segment"; name: string; of: CompiledCondition }
	| { op: "always" };

/** One targeting row, whose `serve` is known to name variants the flag declares. */
export interface CompiledRule {
	when: CompiledCondition;
	serve: string | Split;
}

/** Every segment that resolved, by the name a condition references it under. */
export type CompiledSegments = ReadonlyMap<string, CompiledCondition>;

/**
 * A flag ready to evaluate. `defaultVariant`, every `serve` and every split
 * weight name a variant in `variants`, so selecting a variant is a lookup that
 * hits.
 */
export interface CompiledFlag {
	key: string;
	variants: ReadonlyMap<string, FlagValue>;
	/** Absent when the flag falls back to the value the caller passed. */
	defaultVariant?: string;
	state: FlagState;
	/** Empty when the flag serves its default unconditionally, which reads as `STATIC`. */
	targeting: readonly CompiledRule[];
	metadata?: FlagMetadata;
}

/**
 * A definition the set carried and the engine refused. It is what every
 * evaluation of that key answers with, as `PARSE_ERROR` and this message, and
 * what a caller logs once after a load.
 */
export interface FlagParseFailure {
	key: string;
	/** Why the definition was refused, phrased for a log line or an `errorMessage`. */
	message: string;
}

/**
 * A parsed definition set, and the whole of what evaluation reads. A key is in
 * `flags` or in `failures` and never both, so a broken definition answers for
 * itself while every other flag in the set resolves.
 */
export interface FlagSnapshot {
	flags: ReadonlyMap<string, CompiledFlag>;
	failures: ReadonlyMap<string, FlagParseFailure>;
	segments: CompiledSegments;
	/** What the store called this revision, for a caller that caches snapshots. */
	version?: string;
	/** Epoch milliseconds this snapshot was stamped at, so staleness needs no clock to evaluate. */
	createdAt: number;
}
