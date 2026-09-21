/**
 * Proves the organizations mechanism this pass builds: creating an organization also
 * writes its creator's `owner` membership, a duplicate slug is refused, inviting mints
 * a real token whose digest alone is stored, one open invitation stands per address per
 * organization while a different organization's invitation to the same address is
 * untouched, acceptance is bound to the signed-in subject's own verified address and
 * leaves a mismatched invitation open, removing a membership and deleting an
 * organization both clear `active_organization_id` off the sessions that name it,
 * adding a domain refuses a duplicate within the tenant, `applyDomainMembership`
 * auto-joins verified `auto_join` domains and only suggests `suggest` ones, and the
 * invitation sweep clears expired, unresolved rows while leaving accepted, revoked and
 * live ones alone.
 *
 * Drives everything through the `Tenant` object, the way `scim.test.ts` does, reaching
 * into the underlying storage directly only for what the RPC surface itself does not
 * answer (a stored token digest, a session's `active_organization_id`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import {
	organizationDomains,
	organizationInvitations,
	organizationMembers,
	organizations,
	sweepExpiredOrganizationInvitations,
} from "./organizations";
import { openSession, sessions } from "./sessions";
import Tenant from "./tenant-do";

let state: DurableObjectStateMock;
let tenant: Tenant;

beforeEach(() => {
	state = createDurableObjectState();
	tenant = new Tenant(state, {} as Cloudflare.Env);
});

let nextSuffix = 0;

/** Reads straight off storage for what the RPC surface itself does not answer. */
function testDb(): Database {
	return new Database(createSQLStorageDatabaseAdapter(state.storage.sql));
}

/** Creates a subject with one verified email, through the tenant's own RPC surface. */
async function createVerifiedSubject(email: string): Promise<string> {
	let created = await tenant.createSubject({ identifiers: [{ kind: "email", value: email }] });
	if (!created.ok) throw new Error("setup failed");

	let added = await tenant.addIdentifier({
		subjectId: created.subjectId,
		kind: "email",
		value: email,
		actor: { kind: "subject" },
	});
	if (!added.ok || added.kind !== "email") throw new Error("setup failed");

	await tenant.verifyIdentifier({ ticket: added.ticket });

	return created.subjectId;
}

/** Creates an organization, throwing if the call was refused, for tests that need one already made. */
async function createOrg(overrides: { slug?: string; creatorSubjectId?: string } = {}) {
	let creatorSubjectId = overrides.creatorSubjectId ?? (await createVerifiedSubject(nextEmail()));
	let slug = overrides.slug ?? `org-${nextSuffix++}`;

	let created = await tenant.createOrganization({
		name: "Acme",
		slug,
		creatorSubjectId,
		actor: { type: "subject", id: creatorSubjectId },
	});
	if (!created.ok) throw new Error("setup failed");

	return { organization: created.organization, creatorSubjectId };
}

/** A fresh email address, so unrelated tests never collide on identity. */
function nextEmail(): string {
	return `person-${nextSuffix++}@example.com`;
}

describe("createOrganization", () => {
	test("also writes the creator's owner membership", async () => {
		let subjectId = await createVerifiedSubject(nextEmail());

		let created = await tenant.createOrganization({
			name: "Acme",
			slug: "acme",
			creatorSubjectId: subjectId,
			actor: { type: "subject", id: subjectId },
		});
		if (!created.ok) throw new Error("unreachable");

		expect(created.organization.slug).toBe("acme");

		let membership = await testDb().find(organizationMembers, {
			organization_id: created.organization.id,
			subject_id: subjectId,
		});
		expect(membership).toMatchObject({ role: "owner", joined_via: "creator" });
	});

	test("refuses a duplicate slug within the tenant", async () => {
		let first = await createOrg({ slug: "acme" });

		let second = await tenant.createOrganization({
			name: "Acme Again",
			slug: "acme",
			creatorSubjectId: first.creatorSubjectId,
			actor: { type: "subject", id: first.creatorSubjectId },
		});

		expect(second).toMatchObject({ ok: false, reason: "slug-taken" });
	});
});

describe("inviteToOrganization", () => {
	test("mints a real token whose digest alone is stored", async () => {
		let { organization, creatorSubjectId } = await createOrg();

		let invited = await tenant.inviteToOrganization({
			organizationId: organization.id,
			email: "new.member@example.com",
			role: "member",
			invitedBy: creatorSubjectId,
		});
		if (!invited.ok) throw new Error("unreachable");

		expect(invited.token.startsWith("orginv_")).toBe(true);
		expect(invited.email).toBe("new.member@example.com");

		let row = await testDb().find(organizationInvitations, { id: invited.invitationId });
		expect(row).not.toBeNull();
		expect(row?.token_hash).not.toBe(invited.token);
		expect(row?.token_hash).toHaveLength(64);
	});

	test("refuses a second open invitation to the same address at the same organization", async () => {
		let { organization, creatorSubjectId } = await createOrg();

		let first = await tenant.inviteToOrganization({
			organizationId: organization.id,
			email: "shared@example.com",
			role: "member",
			invitedBy: creatorSubjectId,
		});
		expect(first.ok).toBe(true);

		let second = await tenant.inviteToOrganization({
			organizationId: organization.id,
			email: "shared@example.com",
			role: "member",
			invitedBy: creatorSubjectId,
		});
		expect(second).toMatchObject({ ok: false, reason: "already-invited" });
	});

	test("does not refuse a different organization's invitation to the same address", async () => {
		let first = await createOrg();
		let second = await createOrg();

		let firstInvite = await tenant.inviteToOrganization({
			organizationId: first.organization.id,
			email: "shared@example.com",
			role: "member",
			invitedBy: first.creatorSubjectId,
		});
		expect(firstInvite.ok).toBe(true);

		let secondInvite = await tenant.inviteToOrganization({
			organizationId: second.organization.id,
			email: "shared@example.com",
			role: "member",
			invitedBy: second.creatorSubjectId,
		});
		expect(secondInvite.ok).toBe(true);
	});

	test("refuses an inviter who does not belong to the organization", async () => {
		let { organization } = await createOrg();
		let outsider = await createVerifiedSubject(nextEmail());

		let invited = await tenant.inviteToOrganization({
			organizationId: organization.id,
			email: "new.member@example.com",
			role: "member",
			invitedBy: outsider,
		});

		expect(invited).toMatchObject({ ok: false, reason: "not-authorized" });
	});
});

describe("acceptOrganizationInvitation", () => {
	async function invite(organizationId: string, invitedBy: string, email: string) {
		let invited = await tenant.inviteToOrganization({
			organizationId,
			email,
			role: "member",
			invitedBy,
		});
		if (!invited.ok) throw new Error("setup failed");
		return invited;
	}

	test("writes the membership when the signed-in subject's verified address matches", async () => {
		let { organization, creatorSubjectId } = await createOrg();
		let email = "invitee@example.com";
		let invited = await invite(organization.id, creatorSubjectId, email);
		let subjectId = await createVerifiedSubject(email);

		let accepted = await tenant.acceptOrganizationInvitation({
			token: invited.token,
			subjectId,
		});

		expect(accepted).toMatchObject({ ok: true, organizationId: organization.id, role: "member" });

		let membership = await testDb().find(organizationMembers, {
			organization_id: organization.id,
			subject_id: subjectId,
		});
		expect(membership).toMatchObject({ role: "member", joined_via: "invitation" });
	});

	test("refuses a different subject and leaves the invitation open", async () => {
		let { organization, creatorSubjectId } = await createOrg();
		let email = "invitee@example.com";
		let invited = await invite(organization.id, creatorSubjectId, email);
		let someoneElse = await createVerifiedSubject(nextEmail());

		let accepted = await tenant.acceptOrganizationInvitation({
			token: invited.token,
			subjectId: someoneElse,
		});

		expect(accepted).toMatchObject({ ok: false, reason: "address-mismatch" });

		let row = await testDb().find(organizationInvitations, { id: invited.invitationId });
		expect(row?.accepted_at).toBeNull();
		expect(row?.revoked_at).toBeNull();

		let membership = await testDb().find(organizationMembers, {
			organization_id: organization.id,
			subject_id: someoneElse,
		});
		expect(membership).toBeNull();
	});

	test("refuses an already-accepted ticket", async () => {
		let { organization, creatorSubjectId } = await createOrg();
		let email = "invitee@example.com";
		let invited = await invite(organization.id, creatorSubjectId, email);
		let subjectId = await createVerifiedSubject(email);

		let first = await tenant.acceptOrganizationInvitation({ token: invited.token, subjectId });
		expect(first.ok).toBe(true);

		let second = await tenant.acceptOrganizationInvitation({ token: invited.token, subjectId });
		expect(second).toMatchObject({ ok: false, reason: "invalid-token" });
	});

	test("refuses a revoked ticket", async () => {
		let { organization, creatorSubjectId } = await createOrg();
		let email = "invitee@example.com";
		let invited = await invite(organization.id, creatorSubjectId, email);
		let subjectId = await createVerifiedSubject(email);

		let revoked = await tenant.revokeOrganizationInvitation({
			invitationId: invited.invitationId,
			actor: { type: "subject", id: creatorSubjectId },
		});
		expect(revoked).toMatchObject({ ok: true });

		let accepted = await tenant.acceptOrganizationInvitation({ token: invited.token, subjectId });
		expect(accepted).toMatchObject({ ok: false, reason: "invalid-token" });
	});

	test("refuses an expired ticket", async () => {
		let { organization, creatorSubjectId } = await createOrg();
		let email = "invitee@example.com";
		let invited = await invite(organization.id, creatorSubjectId, email);
		let subjectId = await createVerifiedSubject(email);

		let eightDaysLater = Date.now() + 8 * 24 * 60 * 60 * 1000;
		let accepted = await tenant.acceptOrganizationInvitation({
			token: invited.token,
			subjectId,
			at: eightDaysLater,
		});
		expect(accepted).toMatchObject({ ok: false, reason: "invalid-token" });
	});
});

describe("removeMembership", () => {
	test("clears active_organization_id from that subject's sessions naming the organization", async () => {
		let { organization, creatorSubjectId } = await createOrg();

		let opened = await openSession(testDb(), {
			subjectId: creatorSubjectId,
			amr: ["pwd"],
			remembered: false,
		});
		await testDb().update(
			sessions,
			{ id: opened.sessionId },
			{ active_organization_id: organization.id },
		);

		let removed = await tenant.removeMembership({
			organizationId: organization.id,
			subjectId: creatorSubjectId,
			actor: { type: "platform", id: "system" },
		});
		expect(removed).toMatchObject({ ok: true });

		let session = await testDb().find(sessions, { id: opened.sessionId });
		expect(session?.active_organization_id).toBeNull();

		let membership = await testDb().find(organizationMembers, {
			organization_id: organization.id,
			subject_id: creatorSubjectId,
		});
		expect(membership).toBeNull();
	});

	test("refuses a membership that does not exist", async () => {
		let { organization } = await createOrg();
		let outsider = await createVerifiedSubject(nextEmail());

		let removed = await tenant.removeMembership({
			organizationId: organization.id,
			subjectId: outsider,
			actor: { type: "platform", id: "system" },
		});
		expect(removed).toMatchObject({ ok: false, reason: "not-found" });
	});
});

describe("deleteOrganization", () => {
	test("cascades every related row and clears every session naming it", async () => {
		let { organization, creatorSubjectId } = await createOrg();

		let invited = await tenant.inviteToOrganization({
			organizationId: organization.id,
			email: "invitee@example.com",
			role: "member",
			invitedBy: creatorSubjectId,
		});
		if (!invited.ok) throw new Error("setup failed");

		let domain = await tenant.addOrganizationDomain({
			organizationId: organization.id,
			domain: "example.com",
			mode: "auto_join",
			actor: { type: "subject", id: creatorSubjectId },
		});
		if (!domain.ok) throw new Error("setup failed");

		let opened = await openSession(testDb(), {
			subjectId: creatorSubjectId,
			amr: ["pwd"],
			remembered: false,
		});
		await testDb().update(
			sessions,
			{ id: opened.sessionId },
			{ active_organization_id: organization.id },
		);

		let deleted = await tenant.deleteOrganization({
			organizationId: organization.id,
			actor: { type: "subject", id: creatorSubjectId },
		});
		expect(deleted).toMatchObject({ ok: true });

		expect(await testDb().find(organizations, { id: organization.id })).toBeNull();
		expect(
			await testDb().find(organizationMembers, {
				organization_id: organization.id,
				subject_id: creatorSubjectId,
			}),
		).toBeNull();
		expect(await testDb().find(organizationInvitations, { id: invited.invitationId })).toBeNull();
		expect(await testDb().find(organizationDomains, { domain: domain.domain })).toBeNull();

		let session = await testDb().find(sessions, { id: opened.sessionId });
		expect(session?.active_organization_id).toBeNull();
	});
});

describe("addOrganizationDomain", () => {
	test("refuses a domain already claimed by another organization in the tenant", async () => {
		let first = await createOrg();
		let second = await createOrg();

		let claimed = await tenant.addOrganizationDomain({
			organizationId: first.organization.id,
			domain: "acme.com",
			mode: "auto_join",
			actor: { type: "subject", id: first.creatorSubjectId },
		});
		expect(claimed.ok).toBe(true);

		let refused = await tenant.addOrganizationDomain({
			organizationId: second.organization.id,
			domain: "acme.com",
			mode: "auto_join",
			actor: { type: "subject", id: second.creatorSubjectId },
		});
		expect(refused).toMatchObject({ ok: false, reason: "domain-taken" });
	});
});

describe("applyDomainMembership", () => {
	test("auto-joins for a verified auto_join domain", async () => {
		let { organization, creatorSubjectId } = await createOrg();
		let domain = await tenant.addOrganizationDomain({
			organizationId: organization.id,
			domain: "acme.com",
			mode: "auto_join",
			actor: { type: "subject", id: creatorSubjectId },
		});
		if (!domain.ok) throw new Error("setup failed");
		await tenant.confirmOrganizationDomain({ organizationId: organization.id, domain: "acme.com" });

		let subjectId = await createVerifiedSubject("person@acme.com");

		let applied = await tenant.applyDomainMembership({ subjectId });

		expect(applied.joined).toEqual([{ organizationId: organization.id, role: "member" }]);
		expect(applied.suggested).toEqual([]);

		let membership = await testDb().find(organizationMembers, {
			organization_id: organization.id,
			subject_id: subjectId,
		});
		expect(membership).toMatchObject({ joined_via: "domain" });
	});

	test("only suggests for a verified suggest domain", async () => {
		let { organization, creatorSubjectId } = await createOrg();
		await tenant.addOrganizationDomain({
			organizationId: organization.id,
			domain: "acme.com",
			mode: "suggest",
			actor: { type: "subject", id: creatorSubjectId },
		});
		await tenant.confirmOrganizationDomain({ organizationId: organization.id, domain: "acme.com" });

		let subjectId = await createVerifiedSubject("person@acme.com");

		let applied = await tenant.applyDomainMembership({ subjectId });

		expect(applied.joined).toEqual([]);
		expect(applied.suggested).toEqual([{ organizationId: organization.id }]);

		let membership = await testDb().find(organizationMembers, {
			organization_id: organization.id,
			subject_id: subjectId,
		});
		expect(membership).toBeNull();
	});

	test("does nothing for an unverified domain", async () => {
		let { organization, creatorSubjectId } = await createOrg();
		await tenant.addOrganizationDomain({
			organizationId: organization.id,
			domain: "acme.com",
			mode: "auto_join",
			actor: { type: "subject", id: creatorSubjectId },
		});
		// Never confirmed.

		let subjectId = await createVerifiedSubject("person@acme.com");

		let applied = await tenant.applyDomainMembership({ subjectId });

		expect(applied.joined).toEqual([]);
		expect(applied.suggested).toEqual([]);
	});

	test("does nothing for an unverified email", async () => {
		let { organization, creatorSubjectId } = await createOrg();
		await tenant.addOrganizationDomain({
			organizationId: organization.id,
			domain: "acme.com",
			mode: "auto_join",
			actor: { type: "subject", id: creatorSubjectId },
		});
		await tenant.confirmOrganizationDomain({ organizationId: organization.id, domain: "acme.com" });

		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "person@acme.com" }],
		});
		if (!created.ok) throw new Error("setup failed");

		let applied = await tenant.applyDomainMembership({ subjectId: created.subjectId });

		expect(applied.joined).toEqual([]);
		expect(applied.suggested).toEqual([]);
	});
});

describe("sweepExpiredOrganizationInvitations", () => {
	test("clears expired, open rows and leaves accepted, revoked and live rows alone", async () => {
		let { organization, creatorSubjectId } = await createOrg();
		let db = testDb();

		let expiredOpen = await tenant.inviteToOrganization({
			organizationId: organization.id,
			email: "expired-open@example.com",
			role: "member",
			invitedBy: creatorSubjectId,
		});
		if (!expiredOpen.ok) throw new Error("setup failed");

		let accepted = await tenant.inviteToOrganization({
			organizationId: organization.id,
			email: "accepted@example.com",
			role: "member",
			invitedBy: creatorSubjectId,
		});
		if (!accepted.ok) throw new Error("setup failed");
		let acceptedSubject = await createVerifiedSubject("accepted@example.com");
		await tenant.acceptOrganizationInvitation({
			token: accepted.token,
			subjectId: acceptedSubject,
		});

		let revoked = await tenant.inviteToOrganization({
			organizationId: organization.id,
			email: "revoked@example.com",
			role: "member",
			invitedBy: creatorSubjectId,
		});
		if (!revoked.ok) throw new Error("setup failed");
		await tenant.revokeOrganizationInvitation({
			invitationId: revoked.invitationId,
			actor: { type: "subject", id: creatorSubjectId },
		});

		let stillLive = await tenant.inviteToOrganization({
			organizationId: organization.id,
			email: "still-live@example.com",
			role: "member",
			invitedBy: creatorSubjectId,
		});
		if (!stillLive.ok) throw new Error("setup failed");

		// Pushes the expired-and-open invitation's expiry a week and a half into the past,
		// past the sweep's grace window, without touching the other three.
		await db.update(
			organizationInvitations,
			{ id: expiredOpen.invitationId },
			{ expires_at: Date.now() - 10 * 24 * 60 * 60 * 1000 },
		);

		let swept = await sweepExpiredOrganizationInvitations(db);
		expect(swept).toMatchObject({ deleted: 1, more: false });

		expect(await db.find(organizationInvitations, { id: expiredOpen.invitationId })).toBeNull();
		expect(await db.find(organizationInvitations, { id: accepted.invitationId })).not.toBeNull();
		expect(await db.find(organizationInvitations, { id: revoked.invitationId })).not.toBeNull();
		expect(await db.find(organizationInvitations, { id: stillLive.invitationId })).not.toBeNull();
	});
});
