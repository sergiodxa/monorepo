/**
 * Drives the memberships model against the control-plane test database: a tenant always
 * keeps one owner through `changeRole` and `revoke`, and `administeredTenants` pairs each
 * tenant a subject reaches with its role, leaving deleted tenants out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { NotFound } from "@sdxc/data-model";
import { isFailure, unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { Models } from "~/app/models";
import type { MembershipRole } from "~/app/models/memberships";
import type { TenantRow } from "~/app/models/tenants";

import { LastOwnerError } from "~/app/models/memberships";
import { createTestDatabase } from "~/app/test/db";
import { bindModels, seedTenant } from "~/app/test/models";

let models: Models;

beforeEach(async () => {
	models = bindModels(await createTestDatabase());
});

/** Grants `subjectId` access to `tenant` at `role`. */
async function grant(tenant: TenantRow, subjectId: string, role: MembershipRole) {
	return unwrap(
		await models.memberships.create({ tenant_id: tenant.id, subject_id: subjectId, role }),
	);
}

describe("memberships.create", () => {
	test("mints a mem_ id", async () => {
		let membership = await grant(await seedTenant(models, "Acme"), "sub_1", "owner");
		expect(membership.id).toMatch(/^mem_/);
	});

	test("refuses a second membership of the same subject in one tenant", async () => {
		let tenant = await seedTenant(models, "Acme");
		await grant(tenant, "sub_1", "owner");

		let duplicate = await models.memberships.create({
			tenant_id: tenant.id,
			subject_id: "sub_1",
			role: "admin",
		});
		expect(isFailure(duplicate)).toBe(true);
	});
});

describe("memberships.changeRole", () => {
	test("promotes a member", async () => {
		let tenant = await seedTenant(models, "Acme");
		let member = await grant(tenant, "sub_2", "member");

		let changed = await models.memberships.changeRole(member.id, "admin");
		expect(unwrap(changed).role).toBe("admin");
	});

	test("refuses to demote the tenant's last owner", async () => {
		let tenant = await seedTenant(models, "Acme");
		let owner = await grant(tenant, "sub_1", "owner");

		let changed = await models.memberships.changeRole(owner.id, "admin");
		expect(isFailure(changed) && changed.error).toBeInstanceOf(LastOwnerError);
		expect(await models.memberships.find(owner.id)).toMatchObject({ role: "owner" });
	});

	test("demotes an owner while another owner remains", async () => {
		let tenant = await seedTenant(models, "Acme");
		let first = await grant(tenant, "sub_1", "owner");
		await grant(tenant, "sub_2", "owner");

		let changed = await models.memberships.changeRole(first.id, "member");
		expect(unwrap(changed).role).toBe("member");
	});

	test("fails with NotFound for a membership that does not exist", async () => {
		let changed = await models.memberships.changeRole("mem_missing", "admin");
		expect(isFailure(changed) && changed.error).toBeInstanceOf(NotFound);
	});
});

describe("memberships.revoke", () => {
	test("removes a member", async () => {
		let tenant = await seedTenant(models, "Acme");
		let member = await grant(tenant, "sub_2", "member");

		expect(unwrap(await models.memberships.revoke(member.id))).toBe(true);
		expect(await models.memberships.find(member.id)).toBeNull();
	});

	test("refuses to remove the tenant's last owner", async () => {
		let tenant = await seedTenant(models, "Acme");
		let owner = await grant(tenant, "sub_1", "owner");

		let revoked = await models.memberships.revoke(owner.id);
		expect(isFailure(revoked) && revoked.error).toBeInstanceOf(LastOwnerError);
	});

	test("answers false for a membership that does not exist", async () => {
		expect(unwrap(await models.memberships.revoke("mem_missing"))).toBe(false);
	});
});

describe("memberships.administeredTenants", () => {
	test("pairs each tenant with its role, leaving deleted tenants out", async () => {
		let acme = await seedTenant(models, "Acme");
		let bristle = await seedTenant(models, "Bristle");
		let gone = await seedTenant(models, "Gone");
		await grant(acme, "sub_1", "owner");
		await grant(bristle, "sub_1", "member");
		await grant(gone, "sub_1", "owner");
		unwrap(await models.tenants.update(gone.id, { status: "deleted" }));

		let administered = await models.memberships.administeredTenants("sub_1");

		let pairs = administered.map(({ tenant, role }) => [tenant.id, role]);
		expect(pairs).toHaveLength(2);
		expect(pairs).toEqual(
			expect.arrayContaining([
				[acme.id, "owner"],
				[bristle.id, "member"],
			]),
		);
	});

	test("answers nothing for a subject with no memberships", async () => {
		expect(await models.memberships.administeredTenants("sub_none")).toEqual([]);
	});
});
