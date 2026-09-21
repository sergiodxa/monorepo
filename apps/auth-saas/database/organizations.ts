/**
 * Organizations: a tenant's own customers, the memberships their people hold, the
 * invitations that add one, and the email domains that earn membership automatically
 * once verified. Rows inside this tenant's own object — a tenant's customer, never a
 * customer of the platform's own, which is a different level entirely with its own
 * word, its own id prefix and its own store.
 *
 * `setActiveOrganization` writes the session row token minting reads the `org` claim
 * from. The Worker-side DNS lookup that proves a domain lives in
 * `app/services/organization-domains.ts`; {@link confirmOrganizationDomain} only marks
 * what that lookup already found, and {@link describeOrganizationDomain} is what it
 * reads the expected record from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetCursors } from "@sdxc/pagination";
import type { Database, TableRow } from "remix/data-table";

import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";
import { and, column as c, eq, inList, lt, notNull, table } from "remix/data-table";

import type { AuditActor } from "./audit-events";

import { writeAuditEvent } from "./audit-events";
import { checkAndSpendMailEnvelope } from "./mail-rate-limit";
import { clearActiveOrganization, sessions } from "./sessions";
import { encodeDomain, foldIdentifier } from "./subject-identifiers";
import { subjectIdentifiers } from "./subjects";

/** How long an invitation stands before it expires, when a caller does not choose. */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** How long past its expiry an unaccepted, unrevoked invitation is kept before the sweep removes it. */
const INVITATION_SWEEP_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** How many rows one sweep call removes before reporting back to its caller. */
const SWEEP_BATCH_SIZE = 500;

/** How many members one page answers when a caller does not choose. */
const DEFAULT_PAGE_SIZE = 20;

/** The role a domain-earned membership starts with, absent any role vocabulary to choose from yet. */
const DOMAIN_MEMBERSHIP_ROLE = "member";

/** The DNS host prefix a domain's verification TXT record is published under. */
const DOMAIN_VERIFICATION_TXT_PREFIX = "_sdxc-domain-verify";

/** A slug: lowercase letters, digits and single internal hyphens, no leading or trailing one. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Mints an `org_…` id for a new organization. */
const organizationId = typeid("org");

/** Mints an id for a new invitation row. */
const organizationInvitationId = typeid("orginv");

/** One of a tenant's own customers. */
export const organizations = table({
	name: "organizations",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		slug: c.text(),
		name: c.text(),
		logo_url: c.text().nullable(),
		status: c.text().default("active"),
		metadata: c.json(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** One subject's membership in one organization. */
export const organizationMembers = table({
	name: "organization_members",
	primaryKey: ["organization_id", "subject_id"],
	columns: {
		organization_id: c.text(),
		subject_id: c.text(),
		role: c.text(),
		joined_via: c.enum(["creator", "invitation", "domain", "connection", "admin"] as const),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** A bearer ticket inviting one address to join one organization. */
export const organizationInvitations = table({
	name: "organization_invitations",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		organization_id: c.text(),
		folded_email: c.text(),
		role: c.text(),
		invited_by: c.text(),
		token_hash: c.text(),
		expires_at: c.integer(),
		accepted_at: c.integer().nullable(),
		revoked_at: c.integer().nullable(),
		created_at: c.integer(),
	},
});

/** A domain one organization has claimed, granting membership once verified. */
export const organizationDomains = table({
	name: "organization_domains",
	primaryKey: ["domain"],
	columns: {
		domain: c.text(),
		organization_id: c.text(),
		mode: c.enum(["auto_join", "suggest"] as const),
		verification_value: c.text(),
		verified_at: c.integer().nullable(),
		created_at: c.integer(),
	},
});

export type OrganizationRow = TableRow<typeof organizations>;
export type OrganizationMemberRow = TableRow<typeof organizationMembers>;
export type OrganizationInvitationRow = TableRow<typeof organizationInvitations>;
export type OrganizationDomainRow = TableRow<typeof organizationDomains>;

/** How a membership came to exist. */
export type OrganizationJoinedVia = "creator" | "invitation" | "domain" | "connection" | "admin";

/** What an email domain grants once verified: an automatic membership, or an offer a person chooses to accept. */
export type OrganizationDomainMode = "auto_join" | "suggest";

/** An organization's public record. */
export interface OrganizationRecord {
	id: string;
	slug: string;
	name: string;
	logoUrl: string | null;
	status: string;
	metadata: Record<string, unknown>;
	createdAt: number;
	updatedAt: number;
}

function toOrganizationRecord(row: OrganizationRow): OrganizationRecord {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		logoUrl: row.logo_url,
		status: row.status,
		metadata: row.metadata as Record<string, unknown>,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/** SHA-256 of a value, hex-encoded — the digest an invitation token is found by. */
async function digestToken(value: string): Promise<string> {
	let hashed = await sha256(value);
	if (isFailure(hashed)) throw new Error("organization invitation token hashing failed");
	return Hex.encode(hashed.data);
}

/**
 * The TXT record name a domain's verification is published under, the one formula
 * {@link addOrganizationDomain} mints from and the Worker-side DNS lookup queries
 * against, so the two never drift apart.
 *
 * @param domain - The already-encoded domain a claim names.
 */
export function organizationDomainVerificationName(domain: string): string {
	return `${DOMAIN_VERIFICATION_TXT_PREFIX}.${domain}`;
}

/**
 * Writes a membership if the subject does not already hold one, leaving an existing
 * membership's role and `joined_via` untouched — a subject who already belongs keeps
 * whatever brought them in the first time, and a second route earning nothing new is
 * not an error.
 *
 * @param db - The tenant's database.
 * @param input - The organization and subject, how they are joining, and the clock to
 * write with.
 * @returns Whether this call actually wrote the membership.
 */
async function writeMembershipIfAbsent(
	db: Database,
	input: {
		organizationId: string;
		subjectId: string;
		role: string;
		joinedVia: OrganizationJoinedVia;
		at: number;
	},
): Promise<{ written: boolean }> {
	let existing = await db.find(organizationMembers, {
		organization_id: input.organizationId,
		subject_id: input.subjectId,
	});
	if (existing) return { written: false };

	await db.create(organizationMembers, {
		organization_id: input.organizationId,
		subject_id: input.subjectId,
		role: input.role,
		joined_via: input.joinedVia,
		created_at: input.at,
		updated_at: input.at,
	});

	await writeAuditEvent(db, {
		action: "organization.member.joined",
		actor: { type: "subject", id: input.subjectId },
		targetType: "organization",
		targetId: input.organizationId,
		outcome: "succeeded",
		detail: { subjectId: input.subjectId, role: input.role, joinedVia: input.joinedVia },
		at: input.at,
	});

	return { written: true };
}

export interface CreateOrganizationInput {
	name: string;
	slug: string;
	creatorSubjectId: string;
	actor: AuditActor;
	at?: number;
}

export type CreateOrganizationResult =
	| { ok: true; organization: OrganizationRecord }
	| { ok: false; reason: "invalid-slug" }
	| { ok: false; reason: "slug-taken" };

let CreateOrganizationSchema = s.object({
	name: s.string(),
	slug: s.string(),
	creatorSubjectId: s.string(),
});

/**
 * Creates an organization and writes its creator's `owner` membership in the same
 * call, so an organization never exists without at least one person who can administer
 * it.
 *
 * @param db - The tenant's database.
 * @param input - The organization's name and slug, the subject creating it, and who is
 * making the call.
 * @returns The new organization's record, or which rule refused the call.
 */
export async function createOrganization(
	db: Database,
	input: CreateOrganizationInput,
): Promise<CreateOrganizationResult> {
	let parsed = s.parse(CreateOrganizationSchema, input);
	let now = input.at ?? Date.now();

	if (!SLUG_PATTERN.test(parsed.slug)) return { ok: false, reason: "invalid-slug" };

	let existing = await db.findOne(organizations, { where: { slug: parsed.slug } });
	if (existing) return { ok: false, reason: "slug-taken" };

	let id = organizationId(generateUUID()).toString();

	await db.create(organizations, {
		id,
		slug: parsed.slug,
		name: parsed.name,
		logo_url: null,
		status: "active",
		metadata: {},
		created_at: now,
		updated_at: now,
	});

	await db.create(organizationMembers, {
		organization_id: id,
		subject_id: parsed.creatorSubjectId,
		role: "owner",
		joined_via: "creator",
		created_at: now,
		updated_at: now,
	});

	await writeAuditEvent(db, {
		action: "organization.created",
		actor: input.actor,
		targetType: "organization",
		targetId: id,
		outcome: "succeeded",
		detail: { slug: parsed.slug, name: parsed.name },
		at: now,
	});

	await writeAuditEvent(db, {
		action: "organization.member.joined",
		actor: input.actor,
		targetType: "organization",
		targetId: id,
		outcome: "succeeded",
		detail: { subjectId: parsed.creatorSubjectId, role: "owner", joinedVia: "creator" },
		at: now,
	});

	let row = await db.find(organizations, { id });
	if (!row) throw new Error("organization row missing immediately after its own create");

	return { ok: true, organization: toOrganizationRecord(row) };
}

export interface UpdateOrganizationInput {
	organizationId: string;
	name?: string;
	logoUrl?: string | null;
	metadata?: Record<string, unknown>;
	actor: AuditActor;
	at?: number;
}

export type UpdateOrganizationResult =
	| { ok: true; organization: OrganizationRecord }
	| { ok: false; reason: "not-found" };

/**
 * Updates an organization's name, logo and metadata, leaving any field left out
 * exactly as it stood.
 *
 * @param db - The tenant's database.
 * @param input - The organization to update, the fields to change, and who is making
 * the call.
 * @returns The organization's record once updated, or that no such organization
 * exists.
 */
export async function updateOrganization(
	db: Database,
	input: UpdateOrganizationInput,
): Promise<UpdateOrganizationResult> {
	let existing = await db.find(organizations, { id: input.organizationId });
	if (!existing) return { ok: false, reason: "not-found" };

	let now = input.at ?? Date.now();

	await db.update(
		organizations,
		{ id: input.organizationId },
		{
			...(input.name !== undefined ? { name: input.name } : {}),
			...(input.logoUrl !== undefined ? { logo_url: input.logoUrl } : {}),
			...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
			updated_at: now,
		},
	);

	await writeAuditEvent(db, {
		action: "organization.updated",
		actor: input.actor,
		targetType: "organization",
		targetId: input.organizationId,
		outcome: "succeeded",
		at: now,
	});

	let row = await db.find(organizations, { id: input.organizationId });
	if (!row) throw new Error("organization row missing immediately after its own update");

	return { ok: true, organization: toOrganizationRecord(row) };
}

export interface DeleteOrganizationInput {
	organizationId: string;
	actor: AuditActor;
	at?: number;
}

export type DeleteOrganizationResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Removes an organization and everything scoped to it: its memberships, invitations
 * and claimed domains, and clears `active_organization_id` from every session naming
 * it, so no session is left pointing at an organization that no longer exists.
 *
 * @param db - The tenant's database.
 * @param input - The organization to remove, and who is making the call.
 * @returns Success, or that no such organization exists.
 */
export async function deleteOrganization(
	db: Database,
	input: DeleteOrganizationInput,
): Promise<DeleteOrganizationResult> {
	let existing = await db.find(organizations, { id: input.organizationId });
	if (!existing) return { ok: false, reason: "not-found" };

	await db.deleteMany(organizationMembers, { where: { organization_id: input.organizationId } });
	await db.deleteMany(organizationInvitations, {
		where: { organization_id: input.organizationId },
	});
	await db.deleteMany(organizationDomains, { where: { organization_id: input.organizationId } });
	await clearActiveOrganization(db, { organizationId: input.organizationId });
	await db.delete(organizations, { id: input.organizationId });

	await writeAuditEvent(db, {
		action: "organization.deleted",
		actor: input.actor,
		targetType: "organization",
		targetId: input.organizationId,
		outcome: "succeeded",
		at: input.at ?? Date.now(),
	});

	return { ok: true };
}

export interface InviteToOrganizationInput {
	organizationId: string;
	email: string;
	role: string;
	/** The existing member sending the invitation; also recorded as the audit actor. */
	invitedBy: string;
	/** The address's preferred language, carried through for whoever sends the invitation mail; not itself validated. */
	locale?: string | null;
	at?: number;
}

export type InviteToOrganizationResult =
	| {
			ok: true;
			invitationId: string;
			token: string;
			email: string;
			locale: string | null;
			expiresAt: number;
	  }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "not-authorized" }
	| { ok: false; reason: "invalid-email" }
	| { ok: false; reason: "invalid-role" }
	| { ok: false; reason: "already-invited" }
	| { ok: false; reason: "rate-limited"; retryAfterSeconds: number };

let InviteToOrganizationSchema = s.object({
	organizationId: s.string(),
	email: s.string(),
	role: s.string(),
	invitedBy: s.string(),
	locale: s.optional(s.nullable(s.string())),
});

/**
 * Invites an address to join an organization. Any existing member may invite — the
 * role vocabulary a finer check would need does not exist yet, so authorization here
 * stops at "already belongs to this organization" rather than reaching for a
 * permission this codebase has nowhere to declare. Folds the address, claims the
 * open-invitation uniqueness, and mints a bearer token stored only as its digest.
 *
 * @param db - The tenant's database.
 * @param input - The organization, the address and role being invited, and who is
 * sending it.
 * @returns The token to deliver once, with the address and locale to deliver it to, or
 * which rule refused the call.
 */
export async function inviteToOrganization(
	db: Database,
	input: InviteToOrganizationInput,
): Promise<InviteToOrganizationResult> {
	let parsed = s.parse(InviteToOrganizationSchema, input);
	let now = input.at ?? Date.now();

	let organization = await db.find(organizations, { id: parsed.organizationId });
	if (!organization) return { ok: false, reason: "not-found" };

	let inviter = await db.find(organizationMembers, {
		organization_id: parsed.organizationId,
		subject_id: parsed.invitedBy,
	});
	if (!inviter) return { ok: false, reason: "not-authorized" };

	let folded = foldIdentifier("email", parsed.email);
	if (!folded.ok) return { ok: false, reason: "invalid-email" };

	if (parsed.role.trim().length === 0) return { ok: false, reason: "invalid-role" };

	let open = await db.findOne(organizationInvitations, {
		where: {
			organization_id: parsed.organizationId,
			folded_email: folded.folded,
			accepted_at: null,
			revoked_at: null,
		},
	});
	if (open) return { ok: false, reason: "already-invited" };

	let envelope = await checkAndSpendMailEnvelope(db, { address: folded.folded });
	if (!envelope.ok) {
		return { ok: false, reason: "rate-limited", retryAfterSeconds: envelope.retryAfterSeconds };
	}

	let token = randomToken({ bytes: 32, prefix: "orginv" });
	let tokenHash = await digestToken(token);
	let id = organizationInvitationId(generateUUID()).toString();
	let expiresAt = now + INVITATION_TTL_MS;

	await db.create(organizationInvitations, {
		id,
		organization_id: parsed.organizationId,
		folded_email: folded.folded,
		role: parsed.role,
		invited_by: parsed.invitedBy,
		token_hash: tokenHash,
		expires_at: expiresAt,
		accepted_at: null,
		revoked_at: null,
		created_at: now,
	});

	await writeAuditEvent(db, {
		action: "organization.member.invited",
		actor: { type: "subject", id: parsed.invitedBy },
		targetType: "organization",
		targetId: parsed.organizationId,
		outcome: "succeeded",
		detail: { invitationId: id, role: parsed.role },
		at: now,
	});

	return {
		ok: true,
		invitationId: id,
		token,
		email: parsed.email,
		locale: parsed.locale ?? null,
		expiresAt,
	};
}

export interface RevokeOrganizationInvitationInput {
	invitationId: string;
	actor: AuditActor;
	at?: number;
}

export type RevokeOrganizationInvitationResult =
	| { ok: true }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "already-resolved" };

/**
 * Revokes an open invitation, closing it to acceptance without touching any
 * membership it never wrote.
 *
 * @param db - The tenant's database.
 * @param input - The invitation to revoke, and who is making the call.
 * @returns Success, or which rule refused the call.
 */
export async function revokeOrganizationInvitation(
	db: Database,
	input: RevokeOrganizationInvitationInput,
): Promise<RevokeOrganizationInvitationResult> {
	let invitation = await db.find(organizationInvitations, { id: input.invitationId });
	if (!invitation) return { ok: false, reason: "not-found" };
	if (invitation.accepted_at !== null || invitation.revoked_at !== null) {
		return { ok: false, reason: "already-resolved" };
	}

	let now = input.at ?? Date.now();

	await db.update(organizationInvitations, { id: input.invitationId }, { revoked_at: now });

	await writeAuditEvent(db, {
		action: "organization.invitation.revoked",
		actor: input.actor,
		targetType: "organization",
		targetId: invitation.organization_id,
		outcome: "succeeded",
		detail: { invitationId: input.invitationId },
		at: now,
	});

	return { ok: true };
}

export interface AcceptOrganizationInvitationInput {
	token: string;
	/**
	 * The already-signed-in subject accepting the invitation. Resolving or creating a
	 * subject for someone with no account yet is a hosted sign-up flow's job, run before
	 * this is called — this call only ever binds a ticket to a subject that already
	 * exists.
	 */
	subjectId: string;
	at?: number;
}

export type AcceptOrganizationInvitationResult =
	| { ok: true; organizationId: string; role: string }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "address-mismatch" };

/**
 * Accepts an invitation: the ticket is checked against the signed-in subject's own
 * verified email identifier matching the invited address, and only a match writes the
 * membership. A subject signed in as anyone else is refused without marking the
 * invitation resolved, so it stays open for the address it actually named — a
 * forwarded invitation still reaches the person it was sent to.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, the subject accepting it, and the clock to write
 * with.
 * @returns The organization joined and the role granted, or which rule refused the
 * call.
 */
export async function acceptOrganizationInvitation(
	db: Database,
	input: AcceptOrganizationInvitationInput,
): Promise<AcceptOrganizationInvitationResult> {
	let now = input.at ?? Date.now();
	let tokenHash = await digestToken(input.token);

	let invitation = await db.findOne(organizationInvitations, {
		where: { token_hash: tokenHash },
	});
	if (!invitation) return { ok: false, reason: "invalid-token" };
	if (invitation.accepted_at !== null || invitation.revoked_at !== null) {
		return { ok: false, reason: "invalid-token" };
	}
	if (invitation.expires_at <= now) return { ok: false, reason: "invalid-token" };

	let matched = await db.findOne(subjectIdentifiers, {
		where: and(
			eq("subject_id", input.subjectId),
			eq("kind", "email"),
			eq("folded", invitation.folded_email),
			notNull("verified_at"),
		),
	});
	if (!matched) return { ok: false, reason: "address-mismatch" };

	await db.update(organizationInvitations, { id: invitation.id }, { accepted_at: now });

	let alreadyMember = await db.find(organizationMembers, {
		organization_id: invitation.organization_id,
		subject_id: input.subjectId,
	});

	if (!alreadyMember) {
		await db.create(organizationMembers, {
			organization_id: invitation.organization_id,
			subject_id: input.subjectId,
			role: invitation.role,
			joined_via: "invitation",
			created_at: now,
			updated_at: now,
		});

		await writeAuditEvent(db, {
			action: "organization.member.joined",
			actor: { type: "subject", id: input.subjectId },
			targetType: "organization",
			targetId: invitation.organization_id,
			outcome: "succeeded",
			detail: {
				subjectId: input.subjectId,
				role: invitation.role,
				joinedVia: "invitation",
				invitationId: invitation.id,
			},
			at: now,
		});
	}

	return {
		ok: true,
		organizationId: invitation.organization_id,
		role: alreadyMember ? alreadyMember.role : invitation.role,
	};
}

export interface SetMembershipRoleInput {
	organizationId: string;
	subjectId: string;
	role: string;
	actor: AuditActor;
	at?: number;
}

export type SetMembershipRoleResult =
	| { ok: true; role: string }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "invalid-role" };

/**
 * Changes a membership's role to whatever string the caller gives, storing it as-is —
 * the role vocabulary belongs to a later addition, not this call.
 *
 * @param db - The tenant's database.
 * @param input - The membership to change, its new role, and who is making the call.
 * @returns The role now stored, or which rule refused the call.
 */
export async function setMembershipRole(
	db: Database,
	input: SetMembershipRoleInput,
): Promise<SetMembershipRoleResult> {
	let existing = await db.find(organizationMembers, {
		organization_id: input.organizationId,
		subject_id: input.subjectId,
	});
	if (!existing) return { ok: false, reason: "not-found" };
	if (input.role.trim().length === 0) return { ok: false, reason: "invalid-role" };

	let now = input.at ?? Date.now();

	await db.update(
		organizationMembers,
		{ organization_id: input.organizationId, subject_id: input.subjectId },
		{ role: input.role, updated_at: now },
	);

	await writeAuditEvent(db, {
		action: "organization.member.role_changed",
		actor: input.actor,
		targetType: "organization",
		targetId: input.organizationId,
		outcome: "succeeded",
		detail: { subjectId: input.subjectId, role: input.role, previousRole: existing.role },
		at: now,
	});

	return { ok: true, role: input.role };
}

export interface RemoveMembershipInput {
	organizationId: string;
	subjectId: string;
	actor: AuditActor;
	at?: number;
}

export type RemoveMembershipResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Removes a membership and clears `active_organization_id` off the subject's own
 * sessions naming this organization, so a token minted after removal never carries an
 * `org` claim the person no longer belongs to.
 *
 * A grant recorded under this organization would be revoked here too, matching what
 * removing a SCIM-provisioned subject already does for its own consent grants — but a
 * grant is one merged row per subject and client, unioning every scope a subject ever
 * agreed to for that client regardless of which organization was active when each
 * agreement happened. Tagging that row with an organization id would revoke consent an
 * unrelated authorization also relies on, or leave this removal unable to find what it
 * should revoke once a later authorization (with no organization active, or a
 * different one) overwrote the tag. Scoping revocation correctly needs consent tracked
 * per organization rather than merged away the moment it is granted, which is a
 * reshape of that mechanism, not a column added to this one. Left as a gap for
 * whoever takes on that reshape, rather than forced here.
 *
 * @param db - The tenant's database.
 * @param input - The membership to remove, and who is making the call.
 * @returns Success, or that no such membership exists.
 */
export async function removeMembership(
	db: Database,
	input: RemoveMembershipInput,
): Promise<RemoveMembershipResult> {
	let existing = await db.find(organizationMembers, {
		organization_id: input.organizationId,
		subject_id: input.subjectId,
	});
	if (!existing) return { ok: false, reason: "not-found" };

	await db.delete(organizationMembers, {
		organization_id: input.organizationId,
		subject_id: input.subjectId,
	});

	await clearActiveOrganization(db, {
		organizationId: input.organizationId,
		subjectId: input.subjectId,
	});

	await writeAuditEvent(db, {
		action: "organization.member.removed",
		actor: input.actor,
		targetType: "organization",
		targetId: input.organizationId,
		outcome: "succeeded",
		detail: { subjectId: input.subjectId },
		at: input.at ?? Date.now(),
	});

	return { ok: true };
}

export interface SetActiveOrganizationInput {
	sessionId: string;
	subjectId: string;
	organizationId: string;
	at?: number;
}

export type SetActiveOrganizationResult =
	| { ok: true; organizationId: string }
	| { ok: false; reason: "not-member" }
	| { ok: false; reason: "session-not-found" };

let SetActiveOrganizationSchema = s.object({
	sessionId: s.string(),
	subjectId: s.string(),
	organizationId: s.string(),
});

/**
 * Sets the organization a session is acting for: authorizes that the subject holds a
 * membership in it and that the session actually belongs to that subject, then writes
 * `active_organization_id` on the session row. The next ID token and access token
 * minted from this session name the organization in their `org` claim; nothing already
 * issued changes.
 *
 * @param db - The tenant's database.
 * @param input - The session to set it on, the subject it must belong to, and the
 * organization to activate.
 * @returns The organization now active, or which rule refused the call.
 */
export async function setActiveOrganization(
	db: Database,
	input: SetActiveOrganizationInput,
): Promise<SetActiveOrganizationResult> {
	let parsed = s.parse(SetActiveOrganizationSchema, input);
	let now = input.at ?? Date.now();

	let membership = await db.find(organizationMembers, {
		organization_id: parsed.organizationId,
		subject_id: parsed.subjectId,
	});
	if (!membership) return { ok: false, reason: "not-member" };

	let session = await db.findOne(sessions, {
		where: { id: parsed.sessionId, subject_id: parsed.subjectId },
	});
	if (!session) return { ok: false, reason: "session-not-found" };

	await db.update(sessions, { id: session.id }, { active_organization_id: parsed.organizationId });

	await writeAuditEvent(db, {
		action: "organization.active_organization_set",
		actor: { type: "subject", id: parsed.subjectId },
		targetType: "organization",
		targetId: parsed.organizationId,
		outcome: "succeeded",
		detail: { sessionId: parsed.sessionId },
		at: now,
	});

	return { ok: true, organizationId: parsed.organizationId };
}

export interface AddOrganizationDomainInput {
	organizationId: string;
	domain: string;
	mode: OrganizationDomainMode;
	actor: AuditActor;
	at?: number;
}

export type AddOrganizationDomainResult =
	| {
			ok: true;
			domain: string;
			mode: OrganizationDomainMode;
			verification: { name: string; value: string };
	  }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "invalid-domain" }
	| { ok: false; reason: "domain-taken" };

/**
 * Claims a domain for an organization: folds it with the same rule an email address's
 * own domain half already gets, mints a TXT record to publish, and answers it. The
 * domain does not grant membership until {@link confirmOrganizationDomain} marks it
 * verified.
 *
 * @param db - The tenant's database.
 * @param input - The organization claiming the domain, the domain itself, and whether
 * it auto-joins or only suggests.
 * @returns The TXT record name and value to publish, or which rule refused the call.
 */
export async function addOrganizationDomain(
	db: Database,
	input: AddOrganizationDomainInput,
): Promise<AddOrganizationDomainResult> {
	let organization = await db.find(organizations, { id: input.organizationId });
	if (!organization) return { ok: false, reason: "not-found" };

	let encoded = encodeDomain(input.domain);
	if (!encoded) return { ok: false, reason: "invalid-domain" };

	let existing = await db.find(organizationDomains, { domain: encoded });
	if (existing) return { ok: false, reason: "domain-taken" };

	let now = input.at ?? Date.now();
	let verificationValue = randomToken({ bytes: 20 });

	await db.create(organizationDomains, {
		domain: encoded,
		organization_id: input.organizationId,
		mode: input.mode,
		verification_value: verificationValue,
		verified_at: null,
		created_at: now,
	});

	await writeAuditEvent(db, {
		action: "organization.domain.added",
		actor: input.actor,
		targetType: "organization",
		targetId: input.organizationId,
		outcome: "succeeded",
		detail: { domain: encoded, mode: input.mode },
		at: now,
	});

	return {
		ok: true,
		domain: encoded,
		mode: input.mode,
		verification: {
			name: organizationDomainVerificationName(encoded),
			value: verificationValue,
		},
	};
}

export interface ConfirmOrganizationDomainInput {
	organizationId: string;
	domain: string;
	at?: number;
}

export type ConfirmOrganizationDomainResult =
	| { ok: true; verifiedAt: number }
	| { ok: false; reason: "not-found" };

/**
 * Marks a domain verified. Proving the DNS record actually resolves is network I/O
 * that belongs in the Worker calling this, not here — this call trusts that the lookup
 * already ran and simply records its outcome.
 *
 * @param db - The tenant's database.
 * @param input - The organization and domain now proven.
 * @returns When the domain was marked verified, or that no such claimed domain exists.
 */
export async function confirmOrganizationDomain(
	db: Database,
	input: ConfirmOrganizationDomainInput,
): Promise<ConfirmOrganizationDomainResult> {
	let encoded = encodeDomain(input.domain);
	let existing = encoded
		? await db.findOne(organizationDomains, {
				where: { domain: encoded, organization_id: input.organizationId },
			})
		: null;
	if (!existing) return { ok: false, reason: "not-found" };

	let now = input.at ?? Date.now();

	await db.update(organizationDomains, { domain: existing.domain }, { verified_at: now });

	await writeAuditEvent(db, {
		action: "organization.domain.verified",
		actor: { type: "platform", id: "system" },
		targetType: "organization",
		targetId: input.organizationId,
		outcome: "succeeded",
		detail: { domain: existing.domain },
		at: now,
	});

	return { ok: true, verifiedAt: now };
}

export interface DescribeOrganizationDomainInput {
	organizationId: string;
	domain: string;
}

export type DescribeOrganizationDomainResult =
	| {
			ok: true;
			domain: string;
			mode: OrganizationDomainMode;
			verification: { name: string; value: string };
			verifiedAt: number | null;
	  }
	| { ok: false; reason: "not-found" };

/**
 * Reads what a claimed domain expects to find published, for the Worker-side DNS
 * lookup to check a real answer against before it calls {@link confirmOrganizationDomain}.
 *
 * @param db - The tenant's database.
 * @param input - The organization and domain to describe.
 * @returns The TXT record name and value this domain expects, and whether it is
 * already verified, or that no such claimed domain exists.
 */
export async function describeOrganizationDomain(
	db: Database,
	input: DescribeOrganizationDomainInput,
): Promise<DescribeOrganizationDomainResult> {
	let encoded = encodeDomain(input.domain);
	let existing = encoded
		? await db.findOne(organizationDomains, {
				where: { domain: encoded, organization_id: input.organizationId },
			})
		: null;
	if (!existing) return { ok: false, reason: "not-found" };

	return {
		ok: true,
		domain: existing.domain,
		mode: existing.mode as OrganizationDomainMode,
		verification: {
			name: organizationDomainVerificationName(existing.domain),
			value: existing.verification_value,
		},
		verifiedAt: existing.verified_at,
	};
}

export interface ApplyDomainMembershipInput {
	subjectId: string;
	at?: number;
}

/** One membership {@link applyDomainMembership} wrote. */
export interface AppliedDomainMembership {
	organizationId: string;
	role: string;
}

/** One organization {@link applyDomainMembership} offers rather than joins outright. */
export interface SuggestedOrganization {
	organizationId: string;
}

export interface ApplyDomainMembershipResult {
	ok: true;
	joined: AppliedDomainMembership[];
	suggested: SuggestedOrganization[];
}

/**
 * Reads a subject's own verified email domains and matches them against this tenant's
 * verified organization domains: an `auto_join` match not already a membership writes
 * one, and a `suggest` match is offered back without writing anything. An unverified
 * address earns nothing, since it proves no domain to match against.
 *
 * @param db - The tenant's database.
 * @param input - The subject to resolve, and the clock to write with.
 * @returns Every membership this call wrote, and every organization it suggests
 * instead.
 */
export async function applyDomainMembership(
	db: Database,
	input: ApplyDomainMembershipInput,
): Promise<ApplyDomainMembershipResult> {
	let now = input.at ?? Date.now();

	let identifiers = await db.findMany(subjectIdentifiers, {
		where: and(eq("subject_id", input.subjectId), eq("kind", "email"), notNull("verified_at")),
	});

	let domains = new Set<string>();
	for (let identifier of identifiers) {
		let at = identifier.folded.indexOf("@");
		if (at === -1) continue;
		domains.add(identifier.folded.slice(at + 1));
	}

	let joined: AppliedDomainMembership[] = [];
	let suggested: SuggestedOrganization[] = [];
	let suggestedSeen = new Set<string>();

	for (let domain of domains) {
		let domainRow = await db.find(organizationDomains, { domain });
		if (!domainRow || domainRow.verified_at === null) continue;

		if (domainRow.mode === "suggest") {
			if (!suggestedSeen.has(domainRow.organization_id)) {
				suggestedSeen.add(domainRow.organization_id);
				suggested.push({ organizationId: domainRow.organization_id });
			}
			continue;
		}

		let wrote = await writeMembershipIfAbsent(db, {
			organizationId: domainRow.organization_id,
			subjectId: input.subjectId,
			role: DOMAIN_MEMBERSHIP_ROLE,
			joinedVia: "domain",
			at: now,
		});
		if (!wrote.written) continue;

		joined.push({ organizationId: domainRow.organization_id, role: DOMAIN_MEMBERSHIP_ROLE });
	}

	return { ok: true, joined, suggested };
}

export interface EnsureConnectionMembershipInput {
	organizationId: string;
	subjectId: string;
	at?: number;
}

/**
 * Writes the membership an assertion arriving through an organization-scoped
 * connection earns, with `joined_via: "connection"` — the directory that asserted the
 * person is that organization's own, so a sign-in through it is itself the proof a
 * domain-earned membership gets from a verified address. A subject already a member
 * keeps whatever `joined_via` first brought them in.
 *
 * @param db - The tenant's database.
 * @param input - The organization and subject signing in through its connection, and
 * the clock to write with.
 * @returns Whether this call actually wrote the membership.
 */
export async function ensureConnectionMembership(
	db: Database,
	input: EnsureConnectionMembershipInput,
): Promise<{ written: boolean }> {
	return writeMembershipIfAbsent(db, {
		organizationId: input.organizationId,
		subjectId: input.subjectId,
		role: DOMAIN_MEMBERSHIP_ROLE,
		joinedVia: "connection",
		at: input.at ?? Date.now(),
	});
}

export interface DescribeSubjectOrganizationsInput {
	subjectId: string;
}

/** One organization a subject belongs to, as a switcher renders it. */
export interface SubjectOrganizationSummary {
	organizationId: string;
	slug: string;
	name: string;
	role: string;
	joinedVia: OrganizationJoinedVia;
	joinedAt: number;
}

/**
 * Every organization a subject belongs to, for a switcher UI.
 *
 * @param db - The tenant's database.
 * @param input - The subject to resolve.
 * @returns Every membership the subject holds, most recently joined first.
 */
export async function describeSubjectOrganizations(
	db: Database,
	input: DescribeSubjectOrganizationsInput,
): Promise<{ organizations: SubjectOrganizationSummary[] }> {
	let memberships = await db.findMany(organizationMembers, {
		where: eq("subject_id", input.subjectId),
		orderBy: ["created_at", "desc"],
	});

	let summaries: SubjectOrganizationSummary[] = [];

	for (let membership of memberships) {
		let organization = await db.find(organizations, { id: membership.organization_id });
		if (!organization) continue;

		summaries.push({
			organizationId: organization.id,
			slug: organization.slug,
			name: organization.name,
			role: membership.role,
			joinedVia: membership.joined_via as OrganizationJoinedVia,
			joinedAt: membership.created_at,
		});
	}

	return { organizations: summaries };
}

export interface ReadOrganizationMemberPageInput {
	organizationId: string;
	cursor?: string | null;
	limit?: number;
}

/** One member as an organization's member list renders it. */
export interface OrganizationMemberSummary {
	subjectId: string;
	role: string;
	joinedVia: OrganizationJoinedVia;
	createdAt: number;
}

export type ReadOrganizationMemberPageResult =
	| { ok: true; members: OrganizationMemberSummary[]; cursors: KeysetCursors }
	| { ok: false; reason: "bad-cursor" };

let ReadOrganizationMemberPageSchema = s.object({
	organizationId: s.string(),
	cursor: s.optional(s.nullable(s.string())),
	limit: s.optional(s.number()),
});

/**
 * A page of an organization's members, most recently joined first, for the dashboard's
 * member list.
 *
 * @param db - The tenant's database.
 * @param input - The organization to list, and where to page from.
 * @returns A page of member summaries and the cursors around it, or that the given
 * cursor no longer matches this ordering.
 */
export async function readOrganizationMemberPage(
	db: Database,
	input: ReadOrganizationMemberPageInput,
): Promise<ReadOrganizationMemberPageResult> {
	let parsed = s.parse(ReadOrganizationMemberPageSchema, input);

	let query = db
		.query(organizationMembers)
		.where(eq("organization_id", parsed.organizationId))
		.select("subject_id", "role", "joined_via", "created_at");

	let page = await Pagination.byKeyset(query, {
		orderBy: [
			["created_at", "desc"],
			["subject_id", "desc"],
		],
		cursor: parsed.cursor ?? null,
		limit: parsed.limit ?? DEFAULT_PAGE_SIZE,
	});

	if (isFailure(page)) {
		if (page.error instanceof InvalidCursorError) return { ok: false, reason: "bad-cursor" };
		throw page.error;
	}

	return {
		ok: true,
		members: page.data.items.map((row) => ({
			subjectId: row.subject_id,
			role: row.role,
			joinedVia: row.joined_via as OrganizationJoinedVia,
			createdAt: row.created_at,
		})),
		cursors: page.data.cursors,
	};
}

export interface SweepExpiredOrganizationInvitationsInput {
	now?: number;
	batchSize?: number;
}

export interface SweepExpiredOrganizationInvitationsResult {
	deleted: number;
	more: boolean;
}

/**
 * Deletes invitations a week past their expiry that were never accepted or revoked, in
 * one bounded batch, for the tenant object's own daily sweep — the same shape every
 * other retention sweep there already follows. An accepted or revoked invitation is
 * left standing as history regardless of age.
 *
 * @param db - The tenant's database.
 * @param input - The clock to sweep against, and how many rows one call may remove.
 * @returns How many rows this call deleted, and whether the batch was full.
 */
export async function sweepExpiredOrganizationInvitations(
	db: Database,
	input: SweepExpiredOrganizationInvitationsInput = {},
): Promise<SweepExpiredOrganizationInvitationsResult> {
	let now = input.now ?? Date.now();
	let batchSize = input.batchSize ?? SWEEP_BATCH_SIZE;
	let cutoff = now - INVITATION_SWEEP_GRACE_MS;

	let batch = await db.findMany(organizationInvitations, {
		where: and(lt("expires_at", cutoff), { accepted_at: null, revoked_at: null }),
		orderBy: ["expires_at", "asc"],
		limit: batchSize,
	});

	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(organizationInvitations, {
		where: inList(
			"id",
			batch.map((row) => row.id),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === batchSize };
}
