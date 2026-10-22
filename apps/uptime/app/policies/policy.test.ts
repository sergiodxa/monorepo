/**
 * uptime's authorization as a table of cases: what a member, an admin and the owner may do, the
 * guards that keep the owner in the team and refuse billed checks for an inactive subscription,
 * and an API key capped by its scopes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { testAccess } from "@sdxc/authz/testing";
import { isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import abilities from "~/app/policies/abilities";
import policy, { rolesOf, scopeRole } from "~/app/policies/policy";

let active = { billing: { subscription: "active" as const } };

describe("uptime's policy", () => {
	test("compiles", () => {
		expect(isSuccess(policy.compile())).toBe(true);
	});

	test("names the owner by the team, and anyone else by their membership's role", () => {
		let team = { owner_id: "owner-1" };

		expect(rolesOf(team, { subject_id: "owner-1", role: "admin" })).toEqual(["owner"]);
		expect(rolesOf(team, { subject_id: "admin-1", role: "admin" })).toEqual(["admin"]);
		expect(rolesOf(team, { subject_id: "member-1", role: "member" })).toEqual(["member"]);
	});

	test("lets a member run monitoring but not manage the team", () => {
		let member = testAccess(policy, { roles: ["member"], facts: active });

		expect(member.can(abilities.monitors.write)).toBe(true);
		expect(member.can(abilities.dnsMonitors.write)).toBe(true);
		expect(member.can(abilities.checks.run)).toBe(true);
		expect(member.can(abilities.monitors.delete)).toBe(false);
		expect(member.can(abilities.team.update)).toBe(false);
		expect(member.can(abilities.members.manage)).toBe(false);
		expect(member.can(abilities.apiKeys.write)).toBe(false);
	});

	test.each([
		["an HTTP monitor", abilities.monitors.delete],
		["a DNS monitor", abilities.dnsMonitors.delete],
		["a TCP monitor", abilities.tcpMonitors.delete],
		["a flow monitor", abilities.flowMonitors.delete],
		["a cron job", abilities.cronJobs.delete],
	] as const)("lets an admin delete %s, and refuses a member", (_, ability) => {
		let member = testAccess(policy, { roles: ["member"], facts: active });
		let admin = testAccess(policy, { roles: ["admin"], facts: active });

		expect(member.can(ability)).toBe(false);
		expect(admin.can(ability)).toBe(true);
	});

	test.each([
		["monitors", abilities.monitors.delete],
		["dns-monitors", abilities.dnsMonitors.delete],
		["tcp-monitors", abilities.tcpMonitors.delete],
		["flow-monitors", abilities.flowMonitors.delete],
		["cron-jobs", abilities.cronJobs.delete],
	] as const)("lets an API key delete %s only with the :delete scope", (kind, ability) => {
		let writer = testAccess(policy, {
			roles: ["owner"],
			within: [scopeRole(`${kind}:write`)],
			facts: active,
		});
		let deleter = testAccess(policy, {
			roles: ["owner"],
			within: [scopeRole(`${kind}:delete`)],
			facts: active,
		});

		expect(writer.check(ability)).toMatchObject({ cause: "outOfScope" });
		expect(deleter.can(ability)).toBe(true);
	});

	test("lets an admin manage the team but not delete it or its billing", () => {
		let admin = testAccess(policy, { roles: ["admin"], facts: active });

		expect(admin.can(abilities.monitors.delete)).toBe(true);
		expect(admin.can(abilities.team.update)).toBe(true);
		expect(admin.can(abilities.members.manage)).toBe(true);
		expect(admin.can(abilities.invites.write)).toBe(true);
		expect(admin.can(abilities.team.delete)).toBe(false);
		expect(admin.can(abilities.billing.manage)).toBe(false);
	});

	test("lets the owner delete the team and manage billing", () => {
		let owner = testAccess(policy, { roles: ["owner"], facts: active });

		expect(owner.can(abilities.team.delete)).toBe(true);
		expect(owner.can(abilities.billing.manage)).toBe(true);
	});

	test("keeps the owner in the team whoever asks", () => {
		let owner = testAccess(policy, { roles: ["owner"], facts: active });
		let target = { member: { role: "admin" as const, isOwner: true } };

		expect(owner.can(abilities.members.remove, target)).toBe(false);
		expect(owner.can(abilities.members.changeRole, target)).toBe(false);
		expect(owner.check(abilities.team.leave, target)).toMatchObject({ reason: "owner" });
	});

	test("asks an admin to be demoted before leaving, and lets a member leave", () => {
		let admin = testAccess(policy, { roles: ["admin"], facts: active });
		let member = testAccess(policy, { roles: ["member"], facts: active });

		expect(
			admin.check(abilities.team.leave, { member: { role: "admin", isOwner: false } }),
		).toMatchObject({ reason: "admin" });
		expect(member.can(abilities.team.leave, { member: { role: "member", isOwner: false } })).toBe(
			true,
		);
	});

	test.each([
		["active", true],
		["unknown", true],
		["inactive", false],
	] as const)("lets a %s subscription run billed checks: %s", (subscription, allowed) => {
		let owner = testAccess(policy, { roles: ["owner"], facts: { billing: { subscription } } });

		expect(owner.can(abilities.checks.run)).toBe(allowed);
	});

	test("caps an API key at its scopes", () => {
		let key = testAccess(policy, {
			roles: ["owner"],
			within: [scopeRole("monitors:write")],
			facts: active,
		});

		expect(key.can(abilities.monitors.write)).toBe(true);
		expect(key.check(abilities.monitors.read)).toMatchObject({ cause: "outOfScope" });
		expect(key.can(abilities.team.delete)).toBe(false);
	});

	test("keeps the cross-team stats backfill to the operator", () => {
		let operator = testAccess(policy, { roles: ["operator"], facts: active });
		let owner = testAccess(policy, { roles: ["owner"], facts: active });
		let admin = testAccess(policy, { roles: ["admin"], facts: active });
		let key = testAccess(policy, {
			roles: ["owner"],
			within: [scopeRole("monitors:write")],
			facts: active,
		});

		expect(operator.can(abilities.stats.backfill)).toBe(true);
		expect(owner.can(abilities.stats.backfill)).toBe(false);
		expect(admin.can(abilities.stats.backfill)).toBe(false);
		expect(key.can(abilities.stats.backfill)).toBe(false);
	});

	test("closes the ad-hoc ping API while its switch is off for the team", () => {
		let binding = { roles: ["owner"], within: [scopeRole("ping:trigger")] };

		let on = testAccess(policy, {
			...binding,
			facts: { ...active, flags: { adhocPingApi: true } },
		});
		let off = testAccess(policy, {
			...binding,
			facts: { ...active, flags: { adhocPingApi: false } },
		});

		expect(on.can(abilities.ping.api)).toBe(true);
		expect(off.check(abilities.ping.api)).toMatchObject({ reason: "flag:adhocPingApi" });
	});
});
