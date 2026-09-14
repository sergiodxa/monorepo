/**
 * How the four stages run: forward for `before`, in the exact reverse for the
 * three that unwind, with each hook given scratch space of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EvaluationContext } from "../core/context.js";
import type { EvaluationDetails } from "../core/details.js";
import type { Hook, HookContext, HookData, HookHints } from "../core/hook.js";
import type { ClientMetadata, ProviderMetadata } from "../core/metadata.js";
import type { FlagValue, FlagValueType } from "../core/value.js";

import { merge } from "./context.js";

/** A hook paired with the scratch space its own stages share for this evaluation. */
export interface HookRun {
	hook: Hook;
	data: HookData;
}

/** Everything a hook is told that does not change as the evaluation proceeds. */
export interface Subject {
	flagKey: string;
	flagValueType: FlagValueType;
	defaultValue: FlagValue;
	clientMetadata: ClientMetadata;
	providerMetadata: ProviderMetadata;
}

/**
 * Pairs each hook with fresh data, in the order the stages will read it: API,
 * client, invocation, then provider, each in the order it was added.
 */
export function prepare(...levels: (Hook[] | undefined)[]): HookRun[] {
	return levels
		.flatMap((level) => level ?? [])
		.map((hook) => ({ hook, data: new Map<string, unknown>() }));
}

/**
 * Runs the `before` stages and folds what they return into the context, so each
 * hook sees what the ones before it added and the provider sees all of it.
 */
export async function runBefore(
	runs: HookRun[],
	subject: Subject,
	context: EvaluationContext,
	hints: HookHints,
): Promise<EvaluationContext> {
	let merged = context;

	for (let run of runs) {
		let addition = await run.hook.before?.(frame(subject, merged, run.data), hints);
		if (addition) merged = merge(merged, addition);
	}

	return merged;
}

/** Runs the `after` stages, unwinding, and lets a throw reach the `error` stage. */
export async function runAfter(
	runs: HookRun[],
	subject: Subject,
	context: EvaluationContext,
	details: EvaluationDetails<FlagValue>,
	hints: HookHints,
): Promise<void> {
	for (let run of [...runs].reverse()) {
		await run.hook.after?.(frame(subject, context, run.data), details, hints);
	}
}

/** Runs the `error` stages, unwinding, where one hook's failure costs the others nothing. */
export async function runError(
	runs: HookRun[],
	subject: Subject,
	context: EvaluationContext,
	error: unknown,
	hints: HookHints,
): Promise<void> {
	for (let run of [...runs].reverse()) {
		try {
			await run.hook.error?.(frame(subject, context, run.data), error, hints);
		} catch {
			continue;
		}
	}
}

/** Runs the `finally` stages, unwinding, whatever happened before them. */
export async function runFinally(
	runs: HookRun[],
	subject: Subject,
	context: EvaluationContext,
	details: EvaluationDetails<FlagValue>,
	hints: HookHints,
): Promise<void> {
	for (let run of [...runs].reverse()) {
		try {
			await run.hook.finally?.call(run.hook, frame(subject, context, run.data), details, hints);
		} catch {
			continue;
		}
	}
}

/** One stage's view: the subject, the context as it stands, and this hook's own data. */
function frame(subject: Subject, context: EvaluationContext, data: HookData): HookContext {
	return Object.freeze({ ...subject, context, hookData: data });
}
