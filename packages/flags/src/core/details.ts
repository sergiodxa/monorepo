/**
 * The two result structures: what a provider answers with, and what an
 * application reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ErrorCode } from "./error.js";
import type { FlagMetadata } from "./metadata.js";
import type { Reason } from "./reason.js";
import type { FlagValue } from "./value.js";

/**
 * What a resolver answers with. `value` is always present — the default value
 * the resolver was handed when it had nothing to resolve — and a failure is
 * `errorCode`, `errorMessage` and `reason: "ERROR"` beside it.
 */
export interface ResolutionDetails<T extends FlagValue> {
	value: T;
	variant?: string;
	reason?: Reason;
	errorCode?: ErrorCode;
	errorMessage?: string;
	flagMetadata?: FlagMetadata;
}

/**
 * What a detailed evaluation answers with: the resolution plus the key it was
 * asked for, and metadata that is always a record — empty when the provider set
 * none — so a reader never guards against its absence.
 */
export interface EvaluationDetails<T extends FlagValue> extends ResolutionDetails<T> {
	flagKey: string;
	flagMetadata: FlagMetadata;
}
