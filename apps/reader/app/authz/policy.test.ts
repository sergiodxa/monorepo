/**
 * Decides every gated ability for every tier, with each switch on and off, and for an agent
 * token under each scope: the table of cases that is the reader's whole authorization, kept
 * beside the numeric limits it shares tier names with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyAbility, Decision } from "@sdxc/authz";

import { testAccess } from "@sdxc/authz/testing";
import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Switches } from "~/app/authz/policy";

import abilities from "~/app/authz/abilities";
import policy, { agentRole, SWITCHED_OFF } from "~/app/authz/policy";
import { TIER_LIMITS, TIERS } from "~/app/lib/entitlement";
import { AGENT_SCOPES } from "~/database/schema";

/** Every switch on, which is what every flag answers by default. */
const ALL_ON: Switches = {
	savedPosts: true,
	tags: true,
	filterRules: true,
	articleExtraction: true,
};

/**
 * Which tiers each gated ability is sold on, read as the product's price list. Keeping and
 * applying a preview are on every tier; the rest are what a paid plan buys.
 */
const SOLD_ON: [AnyAbility, readonly string[]][] = [
	[abilities.posts.keep, ["free", "paid", "premium"]],
	[abilities.rules.apply, ["free", "paid", "premium"]],
	[abilities.tags.label, ["paid", "premium"]],
	[abilities.rules.write, ["paid", "premium"]],
	[abilities.articles.extract, ["paid", "premium"]],
	[abilities.agent.connect, ["paid", "premium"]],
	[abilities.agent.write, ["paid", "premium"]],
	[abilities.digests.email, ["premium"]],
];

/** Each switch, and the abilities turning it off refuses for everybody. */
const SWITCHED: [keyof Switches, AnyAbility[]][] = [
	["savedPosts", [abilities.posts.keep]],
	["tags", [abilities.tags.label]],
	["filterRules", [abilities.rules.write, abilities.rules.apply]],
	["articleExtraction", [abilities.articles.extract]],
];

/** A claim's decision for a tier, with the switches given. */
function decide(tier: string, ability: AnyAbility, flags: Switches = ALL_ON): Decision {
	return testAccess(policy, { roles: [tier], facts: { flags } }).check(ability);
}

describe("the reader's policy", () => {
	test("compiles", () => {
		expect(isSuccess(policy.compile())).toBe(true);
	});

	test("names a role for every tier in TIER_LIMITS and no tier TIER_LIMITS lacks", () => {
		let roles = Object.keys(policy.definition.roles ?? {});
		let tierRoles = roles.filter((role) => !role.startsWith("agent:"));

		expect(tierRoles.sort()).toEqual(Object.keys(TIER_LIMITS).sort());
		expect(tierRoles).toEqual([...TIERS].sort());
	});

	test("names a ceiling role for every scope a token may carry", () => {
		let roles = Object.keys(policy.definition.roles ?? {});

		for (let scope of AGENT_SCOPES) expect(roles).toContain(agentRole(scope));
	});

	test.each(
		TIERS.flatMap((tier) =>
			SOLD_ON.map(([ability, sold]) => [tier, ability.name, ability, sold] as const),
		),
	)("on %s, %s is allowed exactly where it is sold", (tier, _name, ability, sold) => {
		let decision = decide(tier, ability);

		if (sold.includes(tier)) expect(decision).toMatchObject({ allowed: true });
		else expect(decision).toMatchObject({ allowed: false, cause: "ungranted" });
	});

	test.each(
		TIERS.flatMap((tier) => SWITCHED.map(([name, refused]) => [tier, name, refused] as const)),
	)("on %s, turning %s off refuses its abilities as switched off", (tier, name, refused) => {
		let flags = { ...ALL_ON, [name]: false };

		for (let ability of refused) {
			expect(decide(tier, ability, flags)).toMatchObject({
				allowed: false,
				cause: "denied",
				reason: SWITCHED_OFF,
			});
		}
	});

	test("a switch refuses only its own abilities", () => {
		let flags = { ...ALL_ON, tags: false };

		expect(decide("premium", abilities.tags.label, flags).allowed).toBe(false);
		expect(decide("premium", abilities.posts.keep, flags).allowed).toBe(true);
		expect(decide("premium", abilities.rules.write, flags).allowed).toBe(true);
		expect(decide("premium", abilities.articles.extract, flags).allowed).toBe(true);
	});

	/** A guard reading a switch nobody bound cannot be decided, and refuses rather than grants. */
	test("refuses a switched ability when the switches could not be read", () => {
		let access = testAccess(policy, { roles: ["premium"] });

		expect(access.check(abilities.tags.label)).toMatchObject({ allowed: false, cause: "error" });
		expect(access.can(abilities.digests.email)).toBe(true);
	});
});

describe("an agent token", () => {
	test.each(TIERS.flatMap((tier) => AGENT_SCOPES.map((scope) => [tier, scope] as const)))(
		"on %s with a %s scope never does more than its scope nor more than its holder",
		(tier, scope) => {
			let access = testAccess(policy, {
				roles: [tier],
				within: [agentRole(scope)],
				facts: { flags: ALL_ON },
			});
			let holder = testAccess(policy, { roles: [tier], facts: { flags: ALL_ON } });
			let paying = tier !== "free";

			expect(access.claims(abilities.agent)).toEqual({
				connect: paying,
				write: paying && scope === "write",
			});

			for (let ability of abilities.list()) {
				if (access.can(ability)) expect(holder.can(ability)).toBe(true);
			}
		},
	);

	test("a read token is refused writing as out of scope", () => {
		let access = testAccess(policy, { roles: ["premium"], within: [agentRole("read")] });

		expect(access.check(abilities.agent.write)).toMatchObject({
			allowed: false,
			cause: "outOfScope",
		});
	});

	test("no token reaches anything beyond the agent surface", () => {
		let access = testAccess(policy, {
			roles: ["premium"],
			within: [agentRole("write")],
			facts: { flags: ALL_ON },
		});

		expect(access.check(abilities.tags.label)).toMatchObject({ cause: "outOfScope" });
		expect(access.check(abilities.digests.email)).toMatchObject({ cause: "outOfScope" });
	});
});
