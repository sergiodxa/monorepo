/**
 * Folds decisions into the invocation's wide event: repeated checks across a
 * list page count up instead of logging one by one, each refusal leaves a
 * note, and an undecidable one fails the invocation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currentLog } from "@sdxc/logger";

import type { Decision } from "./decision.js";

/**
 * Records one decision on the current log, when there is one.
 *
 * @param decision Any decision an access reached.
 */
export function recordDecision(decision: Decision): void {
	let log = currentLog();
	if (log === undefined) return;

	log.inc("authz.checks");
	if (decision.allowed) return;

	log.inc("authz.refused");
	log.note("authz.refused", {
		ability: decision.ability,
		cause: decision.cause,
		reason: decision.cause === "denied" ? decision.reason : undefined,
	});
	if (decision.cause === "error") {
		let [first] = decision.errors;
		log.fail(first?.error ?? new Error(`${decision.ability} undecidable`), {
			authz: { ability: decision.ability, grant: first?.grant },
		});
	}
}

/**
 * Sets the decision a guard acted on as the invocation's `authz` fields.
 *
 * @param decision The decision that admitted or refused the invocation.
 */
export function setDecision(decision: Decision): void {
	currentLog()?.set({
		authz: {
			ability: decision.ability,
			cause: decision.allowed ? "allowed" : decision.cause,
			grants:
				decision.allowed || decision.cause === "denied" ? decision.grants.join(",") : undefined,
		},
	});
}
