/**
 * Binds the reader's policy for one reader, from what their own object knows: the tier
 * their row leases, the subject the switches are evaluated for, and, for an agent, the
 * scope its token carries. Every answer here is plain data, so it crosses RPC intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AccessOf, AnyAbility, AuthzError, Claims, Decision, Refusal } from "@sdxc/authz";
import type { Result } from "@sdxc/result";

import { factLoader } from "@sdxc/authz";
import { fromFlags } from "@sdxc/authz/facts/flags";
import { isFailure } from "@sdxc/result";

import type { Tier } from "~/app/lib/entitlement";
import type { AgentScope } from "~/database/schema";

import abilities from "~/app/authz/abilities";
import policy, { agentRole, SWITCHED_OFF } from "~/app/authz/policy";
import { features, flagsFor } from "~/app/lib/flags";

/** An access bound under the reader's policy. */
export type ReaderAccess = AccessOf<typeof policy>;

/** One boolean per ability in the catalog, which is what a page hides or offers from. */
export type ReaderClaims = Claims<typeof abilities>;

/** Who an access is bound for. */
export interface ReaderBinding {
	/** The tier the reader's row leases right now, grace periods and grants included. */
	tier: Tier;
	/** The reader's subject, which the switches are evaluated for. */
	subject: string;
	/** The scope of the agent token acting, which caps the tier; absent for the reader. */
	scope?: AgentScope;
}

/**
 * Why a refusal crossed the object boundary, in the codes the pages already speak:
 * `not-entitled` for a plan that does not carry it, `switched-off` for a switch that is off.
 */
export type RefusalReason = "not-entitled" | typeof SWITCHED_OFF;

/**
 * What every claim answers when the policy cannot bind, so a broken policy refuses
 * everything rather than granting anything.
 */
const NO_CLAIMS: ReaderClaims = {
	posts: { keep: false },
	tags: { label: false },
	rules: { write: false, apply: false },
	articles: { extract: false },
	digests: { email: false },
	agent: { connect: false, write: false },
};

/**
 * The switches as a fact, evaluated through the reader's own flags client. The client is
 * reached only when a check reads a switch, so an agent's authorization evaluates no flag.
 *
 * @param subject - The reader the switches are evaluated for.
 */
function switchesFor(subject: string) {
	return factLoader(async (request) =>
		fromFlags(features, { client: await flagsFor(subject) }).load(request),
	);
}

/**
 * Binds the policy for one reader, or for one of their agent tokens.
 *
 * @param binding - The leased tier, the subject and the token's scope.
 * @example let bound = bindReader({ tier: leasedTier(row, Date.now()), subject });
 */
export function bindReader(binding: ReaderBinding): Result<ReaderAccess, AuthzError> {
	return policy.for({
		roles: [binding.tier],
		...(binding.scope === undefined ? {} : { within: [agentRole(binding.scope)] }),
		facts: { flags: switchesFor(binding.subject) },
	});
}

/**
 * Decides one claim for a reader, loading only the facts its grants read. A policy that
 * does not bind answers an undecidable refusal naming nothing, which refuses.
 *
 * @param binding - The leased tier, the subject and the token's scope.
 * @param ability - The claim being checked.
 */
export async function decideFor(binding: ReaderBinding, ability: AnyAbility): Promise<Decision> {
	let bound = bindReader(binding);
	if (isFailure(bound)) {
		return { ability: ability.name, allowed: false, cause: "error", as: "forbidden", errors: [] };
	}

	await bound.data.load(ability);
	return bound.data.check(ability);
}

/**
 * Every claim in the catalog for a reader, as the booleans a page reads.
 *
 * @param binding - The leased tier, the subject and the token's scope.
 */
export async function claimsFor(binding: ReaderBinding): Promise<ReaderClaims> {
	let bound = bindReader(binding);
	if (isFailure(bound)) return NO_CLAIMS;

	await bound.data.load(abilities);
	return bound.data.claims(abilities);
}

/**
 * What an agent token may do, its tier capped by its scope. Nothing an agent is checked
 * for reads a switch, so this evaluates no flag on the path every agent call takes.
 *
 * @param binding - The leased tier, the subject and the token's scope.
 */
export async function agentClaimsFor(binding: ReaderBinding): Promise<ReaderClaims["agent"]> {
	let bound = bindReader(binding);
	if (isFailure(bound)) return NO_CLAIMS.agent;

	await bound.data.load(abilities.agent);
	return bound.data.claims(abilities.agent);
}

/**
 * The code a refusal answers with. A switch that could not be read refuses as switched
 * off, since nothing about the reader's plan is in doubt.
 *
 * @param decision - The refusal a check answered.
 */
export function refusalReason(decision: Refusal): RefusalReason {
	return decision.cause === "denied" || decision.cause === "error" ? SWITCHED_OFF : "not-entitled";
}
