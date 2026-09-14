/**
 * The whole of what evaluation is: a snapshot and a context in, a resolution
 * out. Pure and synchronous, so the same function answers a provider, an HTTP
 * endpoint and an admin preview, and it reports every outcome rather than
 * throwing one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	ErrorCode,
	EvaluationContext,
	FlagMetadata,
	FlagValue,
	Reason,
	ResolutionDetails,
} from "@sdxc/flags";

import { isFailure } from "@sdxc/result";

import type { Split } from "./definition.js";
import type { CompiledFlag, FlagSnapshot } from "./snapshot.js";

import { matchesCondition } from "./lib/condition.js";
import { selectVariant } from "./lib/split.js";

/**
 * What a flag's own definition decided, before the type a caller asked for has
 * a say: the variant to serve and the value behind it, or the reason there is
 * none to serve.
 */
interface Selection {
	reason: Reason;
	variant?: string;
	value?: FlagValue;
	errorCode?: ErrorCode;
	errorMessage?: string;
	metadata?: FlagMetadata;
}

/**
 * Resolves one flag for one context, answering with the caller's own default
 * whenever the definition serves no value of the requested type — a flag that
 * is off, absent, broken or holding another type included.
 *
 * @param snapshot The parsed definition set to resolve against.
 * @param key The flag to resolve.
 * @param defaultValue What the caller uses when nothing resolves, and the type
 * every variant is checked against.
 * @param context The merged context targeting reads; an absent one targets on nothing.
 * @example evaluate(snapshot, "new-checkout", false, { targetingKey: "user-1" })
 */
export function evaluate<T extends FlagValue>(
	snapshot: FlagSnapshot,
	key: string,
	defaultValue: T,
	context: EvaluationContext = {},
): ResolutionDetails<T> {
	let selection = select(snapshot, key, context);

	if (selection.variant === undefined) return detailsOf(defaultValue, selection);

	if (!sameType(selection.value, defaultValue)) {
		let held = typeName(selection.value);

		return detailsOf(defaultValue, {
			reason: "ERROR",
			errorCode: "TYPE_MISMATCH",
			errorMessage: `The variant "${selection.variant}" of "${key}" holds a ${held}`,
			metadata: selection.metadata,
		});
	}

	return detailsOf(selection.value, selection);
}

/**
 * Resolves every flag the snapshot carries, the ones that failed to parse
 * included, for a caller with no per-flag default to fall back on. A flag that
 * produces no value of its own reports `null` beside the reason, which is the
 * one value in `FlagValue` that stands for "use the default you already have".
 *
 * @param snapshot The parsed definition set to resolve against.
 * @param context The merged context targeting reads; an absent one targets on nothing.
 * @example evaluateAll(snapshot, { targetingKey: "user-1" })["new-checkout"]
 */
export function evaluateAll(
	snapshot: FlagSnapshot,
	context: EvaluationContext = {},
): Record<string, ResolutionDetails<FlagValue>> {
	let all: Record<string, ResolutionDetails<FlagValue>> = {};

	for (let key of [...snapshot.flags.keys(), ...snapshot.failures.keys()]) {
		let selection = select(snapshot, key, context);
		all[key] = detailsOf(selection.value ?? null, selection);
	}

	return all;
}

/**
 * Finds the flag and runs its rules, reporting the two things that can be wrong
 * with a key before any rule runs: nothing is stored under it, or what is
 * stored under it was refused when the set was parsed.
 */
function select(snapshot: FlagSnapshot, key: string, context: EvaluationContext): Selection {
	let failure = snapshot.failures.get(key);

	if (failure !== undefined) {
		return { reason: "ERROR", errorCode: "PARSE_ERROR", errorMessage: failure.message };
	}

	let flag = snapshot.flags.get(key);

	if (flag === undefined) {
		return { reason: "ERROR", errorCode: "FLAG_NOT_FOUND", errorMessage: `No flag named "${key}"` };
	}

	return { ...served(flag, context), metadata: flag.metadata };
}

/**
 * Runs the flag's rules in the order they were written, so the first rule whose
 * condition holds decides. A flag with no rules at all serves its default
 * variant statically, which is the distinction `STATIC` carries over `DEFAULT`.
 */
function served(flag: CompiledFlag, context: EvaluationContext): Selection {
	if (flag.state === "disabled") return { reason: "DISABLED" };
	if (flag.targeting.length === 0) return fallback(flag, "STATIC");

	for (let rule of flag.targeting) {
		if (matchesCondition(rule.when, context)) return matched(flag, rule.serve, context);
	}

	return fallback(flag, "DEFAULT");
}

/**
 * Serves what the matching rule names: one variant, or the arm the subject
 * buckets into. A split whose subject is nowhere in the context reports that
 * rather than serving an arm, so a rollout that never happened reads as one.
 */
function matched(flag: CompiledFlag, serve: string | Split, context: EvaluationContext): Selection {
	if (typeof serve === "string") {
		return { reason: "TARGETING_MATCH", variant: serve, value: flag.variants.get(serve) };
	}

	let bucketed = selectVariant(serve, flag.key, context);

	if (isFailure(bucketed)) {
		return {
			reason: "ERROR",
			errorCode: "TARGETING_KEY_MISSING",
			errorMessage: bucketed.error.message,
		};
	}

	return { reason: "SPLIT", variant: bucketed.data, value: flag.variants.get(bucketed.data) };
}

/**
 * Serves the variant a flag falls back to under the reason that describes how
 * it got there. A flag declaring no `defaultVariant` exists to target a few
 * subjects, so everyone else is served the default their call site passed.
 */
function fallback(flag: CompiledFlag, reason: Reason): Selection {
	if (flag.defaultVariant === undefined) return { reason: "DEFAULT" };

	return {
		reason,
		variant: flag.defaultVariant,
		value: flag.variants.get(flag.defaultVariant),
	};
}

/**
 * Holds when the variant's value is one the caller could have passed as its own
 * default. A structure is checked no further than being one, because what its
 * fields hold is the caller's schema to decide.
 */
function sameType<T extends FlagValue>(value: FlagValue | undefined, expected: T): value is T {
	if (expected === null || typeof expected === "object") return typeof value === "object";

	return typeof value === typeof expected;
}

/** Names the type a variant turned out to hold, for the message a mismatch carries. */
function typeName(value: FlagValue | undefined): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";

	return typeof value;
}

/** Assembles the structure a caller reads, carrying only the fields this selection filled. */
function detailsOf<T extends FlagValue>(value: T, selection: Selection): ResolutionDetails<T> {
	let details: ResolutionDetails<T> = { value, reason: selection.reason };

	if (selection.variant !== undefined) details.variant = selection.variant;
	if (selection.errorCode !== undefined) details.errorCode = selection.errorCode;
	if (selection.errorMessage !== undefined) details.errorMessage = selection.errorMessage;
	if (selection.metadata !== undefined) details.flagMetadata = selection.metadata;

	return details;
}
