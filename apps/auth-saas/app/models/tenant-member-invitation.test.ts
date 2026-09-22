/**
 * Drives `tenant-member-invitation.ts` directly against the control-plane test
 * database: `create` mints a row, `findByToken` and `findPendingByTenantAndEmail`
 * look one up, and `deletePendingByTenantAndEmail` clears an address's own
 * outstanding invitation without touching another tenant's or another address's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type { TenantRow } from "~/app/models/tenant";

import Customer from "~/app/models/customer";
import TenantModel from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";

import TenantMemberInvitation from "./tenant-member-invitation";

let db: Database;

beforeEach(async () => {
	db = await createTestDatabase();
});

/** Creates a provisioned tenant row in the control plane, so a foreign key resolves. */
async function makeTenant(name: string): Promise<TenantRow> {
	let customer = await Customer.create(db, { name });
	return TenantModel.create(db, {
		customerId: customer.id,
		name,
		slug: name.toLowerCase(),
		issuer: `https://${name.toLowerCase()}.example.com`,
	});
}

describe("TenantMemberInvitation.create", () => {
	test("mints a pending invitation naming the tenant, address and role", async () => {
		let tenant = await makeTenant("Acme");

		let invitation = await TenantMemberInvitation.create(db, {
			tenantId: tenant.id,
			email: "jane@example.com",
			role: "admin",
			tokenHash: "hash-1",
			invitedBy: "sub_1",
			expiresAt: Date.now() + 60_000,
		});

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

describe("TenantMemberInvitation.findByToken", () => {
	test("finds nothing for a hash that was never minted", async () => {
		let found = await TenantMemberInvitation.findByToken(db, "does-not-exist");
		expect(found).toBeNull();
	});

	test("finds the row by its token hash once minted", async () => {
		let tenant = await makeTenant("Acme");
		let invitation = await TenantMemberInvitation.create(db, {
			tenantId: tenant.id,
			email: "jane@example.com",
			role: "member",
			tokenHash: "hash-2",
			invitedBy: "sub_1",
			expiresAt: Date.now() + 60_000,
		});

		let found = await TenantMemberInvitation.findByToken(db, "hash-2");
		expect(found).toMatchObject({ id: invitation.id });
	});
});

describe("TenantMemberInvitation.findPendingByTenantAndEmail", () => {
	test("finds an address's own open invitation", async () => {
		let tenant = await makeTenant("Acme");
		let invitation = await TenantMemberInvitation.create(db, {
			tenantId: tenant.id,
			email: "jane@example.com",
			role: "member",
			tokenHash: "hash-3",
			invitedBy: "sub_1",
			expiresAt: Date.now() + 60_000,
		});

		let found = await TenantMemberInvitation.findPendingByTenantAndEmail(
			db,
			tenant.id,
			"jane@example.com",
		);
		expect(found).toMatchObject({ id: invitation.id });
	});

	test("finds nothing once the invitation is accepted", async () => {
		let tenant = await makeTenant("Acme");
		let invitation = await TenantMemberInvitation.create(db, {
			tenantId: tenant.id,
			email: "jane@example.com",
			role: "member",
			tokenHash: "hash-4",
			invitedBy: "sub_1",
			expiresAt: Date.now() + 60_000,
		});
		await db.update(
			TenantMemberInvitation.table,
			{ id: invitation.id },
			{ accepted_at: Date.now() },
		);

		let found = await TenantMemberInvitation.findPendingByTenantAndEmail(
			db,
			tenant.id,
			"jane@example.com",
		);
		expect(found).toBeNull();
	});
});

describe("TenantMemberInvitation.deletePendingByTenantAndEmail", () => {
	test("clears an address's own outstanding invitation, leaving another tenant's untouched", async () => {
		let tenant = await makeTenant("Acme");
		let other = await makeTenant("Other");

		let superseded = await TenantMemberInvitation.create(db, {
			tenantId: tenant.id,
			email: "jane@example.com",
			role: "member",
			tokenHash: "hash-5",
			invitedBy: "sub_1",
			expiresAt: Date.now() + 60_000,
		});
		let otherTenantInvitation = await TenantMemberInvitation.create(db, {
			tenantId: other.id,
			email: "jane@example.com",
			role: "member",
			tokenHash: "hash-6",
			invitedBy: "sub_1",
			expiresAt: Date.now() + 60_000,
		});

		await TenantMemberInvitation.deletePendingByTenantAndEmail(db, tenant.id, "jane@example.com");

		expect(await TenantMemberInvitation.findByToken(db, "hash-5")).toBeNull();
		expect(await TenantMemberInvitation.findByToken(db, "hash-6")).toMatchObject({
			id: otherTenantInvitation.id,
		});
		expect(superseded).toBeDefined();
	});
});

describe("TenantMemberInvitation.accept", () => {
	test("accepts an open, unexpired invitation once and marks accepted_at", async () => {
		let tenant = await makeTenant("Acme");
		let invitation = await TenantMemberInvitation.create(db, {
			tenantId: tenant.id,
			email: "jane@example.com",
			role: "admin",
			tokenHash: "hash-7",
			invitedBy: "sub_1",
			expiresAt: Date.now() + 60_000,
		});

		let now = Date.now();
		let accepted = await TenantMemberInvitation.accept(db, { tokenHash: "hash-7", now });

		expect(accepted).toMatchObject({ id: invitation.id, accepted_at: now });
	});

	test("fails a second accept of the same token", async () => {
		let tenant = await makeTenant("Acme");
		await TenantMemberInvitation.create(db, {
			tenantId: tenant.id,
			email: "jane@example.com",
			role: "admin",
			tokenHash: "hash-8",
			invitedBy: "sub_1",
			expiresAt: Date.now() + 60_000,
		});

		let first = await TenantMemberInvitation.accept(db, { tokenHash: "hash-8", now: Date.now() });
		let second = await TenantMemberInvitation.accept(db, { tokenHash: "hash-8", now: Date.now() });

		expect(first).not.toBeNull();
		expect(second).toBeNull();
	});

	test("fails an expired invitation", async () => {
		let tenant = await makeTenant("Acme");
		await TenantMemberInvitation.create(db, {
			tenantId: tenant.id,
			email: "jane@example.com",
			role: "admin",
			tokenHash: "hash-9",
			invitedBy: "sub_1",
			expiresAt: Date.now() - 1,
		});

		let accepted = await TenantMemberInvitation.accept(db, {
			tokenHash: "hash-9",
			now: Date.now(),
		});

		expect(accepted).toBeNull();
	});

	test("fails a token that was never minted", async () => {
		let accepted = await TenantMemberInvitation.accept(db, {
			tokenHash: "does-not-exist",
			now: Date.now(),
		});

		expect(accepted).toBeNull();
	});
});
