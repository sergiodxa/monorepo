/**
 * Turns a stored definition set into the snapshot the engine evaluates
 * against. Each flag is parsed on its own, so a mistyped rule costs the flag
 * someone just edited and every sibling in the set still resolves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FlagValue } from "@sdxc/flags";
import type { Result } from "@sdxc/result";
import type { Schema } from "remix/data-schema";

import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { Condition, Split } from "./definition.js";
import type {
	CompiledCondition,
	CompiledFlag,
	CompiledRule,
	FlagParseFailure,
	FlagSnapshot,
} from "./snapshot.js";
import type { StoredFlagSet } from "./store/index.js";

import { CONDITION_SCHEMA, FLAG_DEFINITION_SCHEMA } from "./schema.js";

/** Names the position an issue was raised at, whichever form the segment takes. */
function segmentKey(segment: PropertyKey | { readonly key: PropertyKey }): string {
	return String(typeof segment === "object" ? segment.key : segment);
}

/**
 * Reads a value against a schema and reports the refusal as one message, so
 * every failure in this module is an `Error` a snapshot can record verbatim.
 */
function parseInto<T>(schema: Schema<unknown, T>, value: unknown): Result<T, Error> {
	let result = s.parseSafe(schema, value);
	if (result.success) return success(result.value);
	let message = result.issues
		.map((issue) => {
			let path = (issue.path ?? []).map(segmentKey).join(".");
			return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
		})
		.join("; ");
	return failure(new Error(message.length > 0 ? message : "Expected a flag definition"));
}

/** Reads the entries of whatever a store handed over, treating anything else as empty. */
function entriesOf(value: unknown): [string, unknown][] {
	if (typeof value !== "object" || value === null) return [];
	return Object.entries(value);
}

/**
 * Reads the segment map one entry at a time. A segment that does not parse is
 * absent from the result, which reaches the flags referencing it as an unknown
 * name and leaves the rest of the set untouched.
 */
function readSegments(segments: Record<string, unknown> | undefined): Map<string, Condition> {
	let declared = new Map<string, Condition>();
	for (let [name, value] of entriesOf(segments)) {
		let parsed = parseInto(CONDITION_SCHEMA, value);
		if (isSuccess(parsed)) declared.set(name, parsed.data);
	}
	return declared;
}

/**
 * Resolves one segment to the condition it stands for, memoizing it so twenty
 * flags naming it share one compiled tree. `visiting` holds the chain currently
 * being walked, which is what turns a cycle into a failure here rather than an
 * infinite walk on the first request that reaches it.
 */
function resolveSegment(
	name: string,
	declared: ReadonlyMap<string, Condition>,
	resolved: Map<string, CompiledCondition>,
	visiting: Set<string>,
): Result<CompiledCondition, Error> {
	let already = resolved.get(name);
	if (already !== undefined) return success(already);
	if (visiting.has(name)) {
		return failure(new Error(`Segment "${name}" takes part in a reference cycle`));
	}

	let condition = declared.get(name);
	if (condition === undefined) return failure(new Error(`Unknown segment "${name}"`));

	visiting.add(name);
	let compiled = compileCondition(condition, declared, resolved, visiting);
	visiting.delete(name);

	if (isFailure(compiled)) return compiled;
	resolved.set(name, compiled.data);
	return compiled;
}

/**
 * Compiles the work evaluation would otherwise repeat: a pattern becomes an
 * expression the `v` flag accepts, and a segment carries the condition it
 * names. Every other operator is already in its evaluable form.
 */
function compileCondition(
	condition: Condition,
	declared: ReadonlyMap<string, Condition>,
	resolved: Map<string, CompiledCondition>,
	visiting: Set<string>,
): Result<CompiledCondition, Error> {
	switch (condition.op) {
		case "all":
		case "any": {
			let of: CompiledCondition[] = [];
			for (let member of condition.of) {
				let compiled = compileCondition(member, declared, resolved, visiting);
				if (isFailure(compiled)) return compiled;
				of.push(compiled.data);
			}
			if (condition.op === "all") return success({ op: "all", of });
			return success({ op: "any", of });
		}

		case "not": {
			let compiled = compileCondition(condition.of, declared, resolved, visiting);
			if (isFailure(compiled)) return compiled;
			return success({ op: "not", of: compiled.data });
		}

		case "matches": {
			let pattern = wrap(() => new RegExp(condition.pattern, "v"));
			if (isFailure(pattern)) {
				return failure(
					new Error(`Pattern ${JSON.stringify(condition.pattern)} does not compile`, {
						cause: pattern.error,
					}),
				);
			}
			return success({ op: "matches", field: condition.field, pattern: pattern.data });
		}

		case "segment": {
			let segment = resolveSegment(condition.name, declared, resolved, visiting);
			if (isFailure(segment)) return segment;
			return success({ op: "segment", name: condition.name, of: segment.data });
		}

		default:
			return success(condition);
	}
}

/**
 * Checks that a rule can only select a value the flag holds, so evaluation
 * reaches a variant lookup that hits rather than a reason table entry for a
 * name nobody declared.
 */
function checkServe(
	serve: string | Split,
	variants: ReadonlyMap<string, FlagValue>,
): Result<string | Split, Error> {
	if (typeof serve === "string") {
		if (variants.has(serve)) return success(serve);
		return failure(new Error(`Rule serves "${serve}", which the flag does not declare`));
	}

	for (let name of Object.keys(serve.weights)) {
		if (variants.has(name)) continue;
		return failure(new Error(`Split weight "${name}" does not name a declared variant`));
	}

	return success(serve);
}

/**
 * Parses one flag and compiles its rules. Every refusal here is the whole flag,
 * because a definition half of whose rules were dropped would resolve subjects
 * to variants its author never chose.
 */
function compileFlag(
	key: string,
	value: unknown,
	declared: ReadonlyMap<string, Condition>,
	resolved: Map<string, CompiledCondition>,
): Result<CompiledFlag, Error> {
	let parsed = parseInto(FLAG_DEFINITION_SCHEMA, value);
	if (isFailure(parsed)) return parsed;

	let definition = parsed.data;
	let variants = new Map<string, FlagValue>(Object.entries(definition.variants));

	if (definition.defaultVariant !== undefined && !variants.has(definition.defaultVariant)) {
		let name = definition.defaultVariant;
		return failure(new Error(`defaultVariant "${name}" is not a declared variant`));
	}

	let targeting: CompiledRule[] = [];
	for (let rule of definition.targeting ?? []) {
		let when = compileCondition(rule.when, declared, resolved, new Set());
		if (isFailure(when)) return when;

		let serve = checkServe(rule.serve, variants);
		if (isFailure(serve)) return serve;

		targeting.push({ when: when.data, serve: serve.data });
	}

	return success({
		key,
		variants,
		defaultVariant: definition.defaultVariant,
		state: definition.state ?? "enabled",
		targeting,
		metadata: definition.metadata,
	});
}

/**
 * Reads a stored set into the snapshot evaluation runs against, answering for
 * any input at all: a flag that cannot be parsed lands in `failures` under its
 * own key with the reason, and every other flag lands in `flags` ready to
 * evaluate.
 *
 * @param stored The set as a `FlagStore` handed it over, validated by nobody yet.
 * @returns A snapshot stamped with the time it was built and the store's revision.
 *
 * @example
 * let snapshot = parseFlagSet({ flags: { beta: { variants: { on: true } } } });
 */
export function parseFlagSet(stored: StoredFlagSet): FlagSnapshot {
	let declared = readSegments(stored.segments);
	let resolved = new Map<string, CompiledCondition>();
	for (let name of declared.keys()) resolveSegment(name, declared, resolved, new Set());

	let flags = new Map<string, CompiledFlag>();
	let failures = new Map<string, FlagParseFailure>();

	for (let [key, value] of entriesOf(stored.flags)) {
		let compiled = compileFlag(key, value, declared, resolved);
		if (isFailure(compiled)) failures.set(key, { key, message: compiled.error.message });
		else flags.set(key, compiled.data);
	}

	return { flags, failures, segments: resolved, version: stored.version, createdAt: Date.now() };
}
