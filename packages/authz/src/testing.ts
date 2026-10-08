/**
 * Helpers for testing a policy: `testAccess` binds synchronously from plain
 * values, so a table of cases is the whole test, and `diffPolicies` lists every
 * case two versions of a policy answer differently, for reviewing a change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Access, CheckArgs } from "./access.js";
import type { AnyAbility } from "./catalog.js";
import type { AuthzError, Decision } from "./decision.js";
import type { FactDefinitions, FactValue } from "./grants.js";
import type { AnyPolicy, FactsOf, Policy } from "./policy.js";

/** A binding made only of values, which binds synchronously. */
export interface TestBinding<F extends FactDefinitions> {
	roles: readonly string[];
	within?: readonly string[];
	facts?: { [K in keyof F]?: FactValue<F[K]> };
	onDecision?: (decision: Decision) => void;
}

/**
 * Binds a policy from plain values. A required root a test leaves unbound
 * fails the conditions reading it, so a case that forgot a fact refuses
 * visibly instead of passing.
 *
 * @param policy The policy under test.
 * @param binding Roles, ceiling and fact values.
 * @throws {AuthzError} When the policy does not compile, failing the test that bound it.
 * @example let access = testAccess(policy, { roles: ["member"], facts: { actor } });
 */
export function testAccess<P extends AnyPolicy>(
	policy: P,
	binding: TestBinding<FactsOf<P>>,
): Access<FactsOf<P>> {
	let bound = (policy as Policy<object, FactsOf<P>>).for(binding);
	if (isFailure(bound)) throw bound.error;
	return bound.data;
}

/** One case `diffPolicies` decides under both policies. */
export interface PolicyCase<
	A extends AnyAbility = AnyAbility,
> extends TestBinding<FactDefinitions> {
	/** Names the case in the report. */
	name?: string;
	ability: A;
	/** The arguments a check of the ability takes: its context and field. */
	args?: CheckArgs<A>;
}

/** A case two policies answer differently. */
export interface PolicyChange {
	case: PolicyCase;
	before: Decision;
	after: Decision;
}

/**
 * Decides every case under both policies and reports those whose answers
 * differ: allowed or not, cause, answer, reason, or the grants matched, by id.
 *
 * @param before The policy as it was.
 * @param after The policy as it is proposed.
 * @param cases The bindings and checks to compare.
 * @returns The changed cases, or the failure of whichever policy does not compile.
 * @example let changes = unwrap(diffPolicies(previous, policy, cases));
 */
export function diffPolicies(
	before: AnyPolicy,
	after: AnyPolicy,
	cases: readonly PolicyCase[],
): Result<PolicyChange[], AuthzError> {
	let changes: PolicyChange[] = [];
	for (let each of cases) {
		let decided: Decision[] = [];
		for (let policy of [before, after]) {
			let bound = (policy as Policy).for(each);
			if (isFailure(bound)) return failure(bound.error);
			decided.push(bound.data.check(each.ability, ...((each.args ?? []) as CheckArgs<AnyAbility>)));
		}
		let [old, current] = decided as [Decision, Decision];
		if (fingerprint(old) !== fingerprint(current)) {
			changes.push({ case: each, before: old, after: current });
		}
	}
	return success(changes);
}

/** What makes two decisions the same answer, ignoring error detail and grant order. */
function fingerprint(decision: Decision): string {
	if (decision.allowed) return JSON.stringify([true, [...decision.grants].sort()]);
	return JSON.stringify([
		false,
		decision.cause,
		decision.as,
		decision.cause === "denied" ? (decision.reason ?? null) : null,
		decision.cause === "denied" ? [...decision.grants].sort() : [],
	]);
}
