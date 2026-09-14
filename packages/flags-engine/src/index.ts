/**
 * What a flag is written down as, the schema a definition is validated against,
 * and the two ways to resolve one: the pure functions over a snapshot, and the
 * engine that goes and gets the snapshot for them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	Condition,
	FlagDefinition,
	FlagSet,
	FlagState,
	SegmentSet,
	SemVerComparison,
	Split,
	TargetingRule,
} from "./definition.js";
export type { Engine, EngineOptions } from "./engine.js";
export type {
	CompiledCondition,
	CompiledFlag,
	CompiledRule,
	CompiledSegments,
	FlagParseFailure,
	FlagSnapshot,
} from "./snapshot.js";

export { createEngine } from "./engine.js";
export { evaluate, evaluateAll } from "./evaluate.js";
export { parseFlagSet } from "./parse.js";
export {
	CONDITION_SCHEMA,
	FLAG_DEFINITION_SCHEMA,
	SEGMENT_SET_SCHEMA,
	SPLIT_SCHEMA,
	TARGETING_RULE_SCHEMA,
} from "./schema.js";
