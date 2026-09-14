/**
 * What a single evaluation may add to the ones already configured: hooks of its
 * own, hints for every hook that runs, and for a structure the schema it is
 * checked against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { Hook, HookHints } from "./hook.js";
import type { FlagValue } from "./value.js";

/** Per-invocation hooks, which run after the configured ones, and the hints they all receive. */
export interface EvaluationOptions {
	hooks?: Hook[];
	hints?: HookHints;
}

/**
 * What a structure evaluation takes on top of the usual options. The schema is
 * required rather than optional, because it is the only thing standing between
 * a value from a system the application does not control and an unchecked cast,
 * and an optional check is one nobody adds.
 */
export interface ObjectEvaluationOptions<T extends FlagValue> extends EvaluationOptions {
	schema: StandardSchemaV1<unknown, T>;
}
