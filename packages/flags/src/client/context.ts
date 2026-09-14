/**
 * The one merge every evaluation goes through, so the levels a field can be set
 * at are resolved in exactly one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EvaluationContext } from "../core/context.js";

/**
 * Folds the levels left to right — API, transaction, client, invocation, then
 * whatever the `before` hooks returned — so a field set later wins, including
 * `targetingKey`. A level that sets a field to `undefined` removes it, which is
 * how a hook keeps a field from reaching the provider at all.
 */
export function merge(...levels: (EvaluationContext | undefined)[]): EvaluationContext {
	let merged: EvaluationContext = {};

	for (let level of levels) {
		if (!level) continue;

		for (let [field, value] of Object.entries(level)) {
			if (value === undefined) delete merged[field];
			else merged[field] = value;
		}
	}

	return merged;
}
