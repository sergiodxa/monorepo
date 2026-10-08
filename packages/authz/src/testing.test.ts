/**
 * Tests the testing helpers: a synchronous binding from values that refuses
 * a forgotten fact visibly, and a diff that reports only changed answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { abilities, ability, context } from "./catalog.js";
import { AuthzError } from "./decision.js";
import { allow, deny, fact } from "./grants.js";
import { definePolicy } from "./policy.js";
import { diffPolicies, testAccess } from "./testing.js";

interface Monitor {
	teamId: string;
}

const CATALOG = abilities({
	monitor: {
		read: ability({ context: context<{ monitor: Monitor }>("monitor"), deniedAs: "notFound" }),
		run: ability({ context: context<{ monitor: Monitor }>("monitor") }),
	},
});

const BEFORE = definePolicy(CATALOG, {
	facts: { billing: fact<{ state: string }>() },
	roles: { member: [allow("monitor")] },
	guards: [
		deny("monitor.run", {
			id: "subscription",
			when: { op: "eq", field: "billing.state", value: "inactive" },
			reason: "subscription-required",
		}),
	],
});

const AFTER = definePolicy(CATALOG, {
	...BEFORE.definition,
	guards: [
		deny("monitor", {
			id: "subscription",
			when: { op: "eq", field: "billing.state", value: "inactive" },
			reason: "subscription-required",
		}),
	],
});

const MONITOR: Monitor = { teamId: "t1" };

describe("testAccess", () => {
	test("binds synchronously from values", () => {
		let access = testAccess(BEFORE, { roles: ["member"], facts: { billing: { state: "active" } } });

		expect(access.can(CATALOG.monitor.run, { monitor: MONITOR })).toBe(true);
	});

	test("refuses a check whose required fact the test forgot", () => {
		let access = testAccess(BEFORE, { roles: ["member"] });

		expect(access.check(CATALOG.monitor.run, { monitor: MONITOR })).toMatchObject({
			cause: "error",
		});
	});

	test("throws when the policy does not compile", () => {
		let broken = definePolicy(CATALOG, { roles: { member: [allow("monitor.nope" as "monitor")] } });

		expect(() => testAccess(broken, { roles: [] })).toThrow(AuthzError);
	});
});

describe("diffPolicies", () => {
	test("reports only the cases whose answers changed", () => {
		let inactive = { billing: { state: "inactive" } };
		let changes = unwrap(
			diffPolicies(BEFORE, AFTER, [
				{
					name: "run, inactive",
					roles: ["member"],
					facts: inactive,
					ability: CATALOG.monitor.run,
					args: [{ monitor: MONITOR }],
				},
				{
					name: "read, inactive",
					roles: ["member"],
					facts: inactive,
					ability: CATALOG.monitor.read,
					args: [{ monitor: MONITOR }],
				},
				{
					name: "read, active",
					roles: ["member"],
					facts: { billing: { state: "active" } },
					ability: CATALOG.monitor.read,
					args: [{ monitor: MONITOR }],
				},
			]),
		);

		expect(changes.map((change) => change.case.name)).toEqual(["read, inactive"]);
		expect(changes[0]?.before).toMatchObject({ allowed: true });
		expect(changes[0]?.after).toMatchObject({ cause: "denied", reason: "subscription-required" });
	});
});
