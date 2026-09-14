/**
 * The two ways a resolver answers, as functions rather than object literals, so
 * a provider states the outcome and the fields that go with it follow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ResolutionDetails } from "../core/details.js";
import type { ErrorCode } from "../core/error.js";
import type { FlagValue } from "../core/value.js";

/** What a successful resolution may say about itself beyond the value it found. */
export type ResolvedDetails<T extends FlagValue> = Omit<
	ResolutionDetails<T>,
	"value" | "errorCode" | "errorMessage"
>;

/**
 * Answers with a value the provider actually resolved. The error fields are not
 * accepted here at all, which is how normal execution stays free of them.
 *
 * @example return resolved(flag.value, { variant: flag.variant, reason: "STATIC" });
 */
export function resolved<T extends FlagValue>(
	value: T,
	details: ResolvedDetails<T> = {},
): ResolutionDetails<T> {
	return { ...details, value };
}

/**
 * Answers with the default value the resolver was handed, and says why it could
 * not do better. The reason is always `ERROR`, so a caller reading reasons and
 * a caller reading codes reach the same conclusion.
 *
 * @example return failed(defaultValue, "FLAG_NOT_FOUND", `No flag named ${key}`);
 */
export function failed<T extends FlagValue>(
	defaultValue: T,
	errorCode: ErrorCode,
	errorMessage?: string,
): ResolutionDetails<T> {
	let details: ResolutionDetails<T> = { value: defaultValue, reason: "ERROR", errorCode };
	if (errorMessage !== undefined) details.errorMessage = errorMessage;
	return details;
}
