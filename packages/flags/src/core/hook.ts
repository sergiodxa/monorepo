/**
 * Where telemetry, validation and context enrichment attach to an evaluation:
 * four stages, and the context every one of them reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import type { EvaluationContext } from "./context.js";
import type { EvaluationDetails } from "./details.js";
import type { ClientMetadata, ProviderMetadata } from "./metadata.js";
import type { FlagValue, FlagValueType, MaybePromise } from "./value.js";

/** The four points an evaluation passes through, named as the stages are declared. */
export type HookStage = "before" | "after" | "error" | "finally";

/**
 * Data an invocation passes to the hooks it runs, without any hook changing it.
 * Where the evaluation context describes the subject, hints describe the call.
 * A hint holds a boolean, a string, a number, a `Date` or a structure.
 */
export interface HookHints {
	readonly [field: string]: Date | JSONValue | undefined;
}

/** A hook's own scratch space, fresh per evaluation and shared between that hook's stages. */
export type HookData = Map<string, unknown>;

/**
 * What every stage is told about the evaluation in flight. `context` is the
 * merged evaluation context, and `hookData` belongs to this hook alone, so a
 * `before` stage can leave a timestamp its `finally` stage reads.
 */
export interface HookContext {
	readonly flagKey: string;
	readonly flagValueType: FlagValueType;
	readonly defaultValue: FlagValue;
	readonly context: EvaluationContext;
	readonly clientMetadata: ClientMetadata;
	readonly providerMetadata: ProviderMetadata;
	readonly hookData: HookData;
}

/**
 * Arbitrary behavior around an evaluation. Every stage is optional, so a hook
 * declares only the ones it needs, and an evaluation context returned from
 * `before` is merged in at the highest precedence there is.
 *
 * `before` runs API, then client, then invocation, then provider hooks; the
 * other three run in the exact reverse.
 */
export interface Hook {
	before?(context: HookContext, hints: HookHints): MaybePromise<EvaluationContext | void>;
	after?(
		context: HookContext,
		details: EvaluationDetails<FlagValue>,
		hints: HookHints,
	): MaybePromise<void>;
	error?(context: HookContext, error: unknown, hints: HookHints): MaybePromise<void>;
	finally?(
		context: HookContext,
		details: EvaluationDetails<FlagValue>,
		hints: HookHints,
	): MaybePromise<void>;
}
