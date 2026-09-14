/**
 * The hook that puts an evaluation on the invocation's wide event, under the
 * attribute names an OpenTelemetry feature-flag record is read with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currentLog } from "@sdxc/logger";

import type { Hook } from "../../core/hook.js";
import type { Reason } from "../../core/reason.js";

/** The reasons the record's enumeration knows; anything else is the provider's own word for it. */
const REASONS = new Set([
	"STATIC",
	"DEFAULT",
	"TARGETING_MATCH",
	"SPLIT",
	"CACHED",
	"DISABLED",
	"UNKNOWN",
	"STALE",
	"ERROR",
]);

/**
 * Attaches the key, reason, variant, provider and — when it failed — the error
 * to the wide event of the invocation the evaluation ran inside, so a flag that
 * behaved unexpectedly is answerable from the record already being written.
 *
 * Outside an invocation there is no log and the hook does nothing.
 *
 * @example createFlags({ provider, hooks: [wideEventHook()] });
 */
export function wideEventHook(): Hook {
	return {
		finally(context, details) {
			currentLog()?.set({
				"feature_flag.key": details.flagKey,
				"feature_flag.result.reason": snake(details.reason),
				"feature_flag.result.variant": details.variant,
				"feature_flag.provider.name": context.providerMetadata.name,
				"error.type": details.errorCode?.toLowerCase(),
				"error.message": details.errorMessage,
			});
		},
	};
}

/** The record's enumerations are lowercase; a reason it does not know passes through. */
function snake(reason: Reason | undefined): string | undefined {
	if (reason === undefined) return undefined;
	return REASONS.has(reason) ? reason.toLowerCase() : reason;
}
