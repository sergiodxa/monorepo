/**
 * Drives the tenant member invitations model against the control-plane test database:
 * `create` mints a row, `findByToken` and `pendingFor` look one up, clearing an address's
 * open invitation leaves other tenants' alone, and `accept` spends a token exactly once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { Models } from "~/app/models";
import type { TenantMemberInvitationRole } from "~/app/models/tenant-member-invitations";
import type { TenantRow } from "~/app/models/tenants";

import { createTestDatabase } from "~/app/test/db";
import { bindModels, seedTenant } from "~/app/test/models";

let models: Models;

beforeEach(async () => {
	models = bindModels(await createTestDatabase());
});

/** Mints an invitation for jane@example.com to `tenant`, expiring `ttl` ms from now. */
async function invite(
	tenant: TenantRow,
	tokenHash: string,
	options: { role?: TenantMemberInvitationRole; ttl?: number } = {},
) {
	return unwrap(
		await models.tenantMemberInvitations.create({
			tenant_id: tenant.id,
			email: "jane@example.com",
			role: options.role ?? "member",
			token_hash: tokenHash,
			invited_by: "sub_1",
			expires_at: Date.now() + (options.ttl ?? 60_000),
		}),
	);
}

describe("tenantMemberInvitations.create", () => {
	test("mints a pending invitation naming the tenant, address and role", async () => {
		let tenant = await seedTenant(models, "Acme");

		let invitation = await invite(tenant, "hash-1", { role: "admin" });

		expect(invitation).toMatchObject({
			tenant_id: tenant.id,
			email: "jane@example.com",
			role: "admin",
			token_hash: "hash-1",
			invited_by: "sub_1",
			accepted_at: null,
		});
		expect(invitation.id).toMatch(/^meminv_/);
	});
});

describe("tenantMemberInvitations.findByToken", () => {
	test("finds nothing for a hash that was never minted", async () => {
		expect(await models.tenantMemberInvitations.findByToken("does-not-exist")).toBeNull();
	});

	test("finds the row by its token hash once minted", async () => {
		let invitation = await invite(await seedTenant(models, "Acme"), "hash-2");

		let found = await models.tenantMemberInvitations.findByToken("hash-2");
		expect(found).toMatchObject({ id: invitation.id });
	});
});

describe("tenantMemberInvitations.pendingFor", () => {
	test("finds an address's own open invitation", async () => {
		let tenant = await seedTenant(models, "Acme");
		let invitation = await invite(tenant, "hash-3");

		let found = await models.tenantMemberInvitations
			.pendingFor(tenant.id, "jane@example.com")
			.first();
		expect(found).toMatchObject({ id: invitation.id });
	});

	test("finds nothing once the invitation is accepted", async () => {
		let tenant = await seedTenant(models, "Acme");
		let invitation = await invite(tenant, "hash-4");
		unwrap(await models.tenantMemberInvitations.update(invitation.id, { accepted_at: Date.now() }));

		let found = await models.tenantMemberInvitations
			.pendingFor(tenant.id, "jane@example.com")
			.first();
		expect(found).toBeNull();
	});

	test("clears an address's own outstanding invitation, leaving another tenant's untouched", async () => {
		let tenant = await seedTenant(models, "Acme");
		let other = await seedTenant(models, "Other");
		await invite(tenant, "hash-5");
		let otherTenantInvitation = await invite(other, "hash-6");

		await models.tenantMemberInvitations.pendingFor(tenant.id, "jane@example.com").delete();

		expect(await models.tenantMemberInvitations.findByToken("hash-5")).toBeNull();
		expect(await models.tenantMemberInvitations.findByToken("hash-6")).toMatchObject({
			id: otherTenantInvitation.id,
		});
	});
});

describe("tenantMemberInvitations.accept", () => {
	test("accepts an open, unexpired invitation once and marks accepted_at", async () => {
		let invitation = await invite(await seedTenant(models, "Acme"), "hash-7", { role: "admin" });

		let now = Date.now();
		let accepted = await models.tenantMemberInvitations.accept({ tokenHash: "hash-7", now });

		expect(accepted).toMatchObject({ id: invitation.id, accepted_at: now });
	});

	test("fails a second accept of the same token", async () => {
		await invite(await seedTenant(models, "Acme"), "hash-8");

		let first = await models.tenantMemberInvitations.accept({
			tokenHash: "hash-8",
			now: Date.now(),
		});
		let second = await models.tenantMemberInvitations.accept({
			tokenHash: "hash-8",
			now: Date.now(),
		});

		expect(first).not.toBeNull();
		expect(second).toBeNull();
	});

	test("fails an expired invitation", async () => {
		await invite(await seedTenant(models, "Acme"), "hash-9", { ttl: -1 });

		let accepted = await models.tenantMemberInvitations.accept({
			tokenHash: "hash-9",
			now: Date.now(),
		});

		expect(accepted).toBeNull();
	});

	test("fails a token that was never minted", async () => {
		let accepted = await models.tenantMemberInvitations.accept({
			tokenHash: "does-not-exist",
			now: Date.now(),
		});

		expect(accepted).toBeNull();
	});
});
