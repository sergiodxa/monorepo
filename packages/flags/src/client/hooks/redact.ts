/**
 * The hook that keeps named context fields away from the provider, for the case
 * where resolving a flag means shipping the context to somebody else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EvaluationContext } from "../../core/context.js";
import type { Hook } from "../../core/hook.js";

/**
 * Removes `fields` from the context in the `before` stage, so nothing a
 * resolver or a later hook sees carries them. Register it at the API level to
 * cover every evaluation an instance makes.
 *
 * @example createFlags({ provider, hooks: [redactHook(["email", "ip"])] });
 */
export function redactHook(fields: string[]): Hook {
	let redacted = new Set(fields);

	return {
		before(context) {
			let removals: EvaluationContext = {};

			for (let field of Object.keys(context.context)) {
				if (redacted.has(field)) removals[field] = undefined;
			}

			return removals;
		},
	};
}
