/**
 * SCIM provisioning: the tenant-object side of an inbound directory sync — the
 * `scim_connections`, `scim_groups`, `scim_group_members`, `scim_group_mappings` and
 * `scim_links` tables, and the connection, token, user and group operations over them.
 * Building the `/scim/v2/*` HTTP surface, the entitlement gate and rate limiting is a
 * later pass's job; everything here is the RPC surface that pass calls into, each
 * method resolving its own presented bearer token to a connection in the same turn as
 * the operation it authorizes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";
import { and, column as c, eq, table } from "remix/data-table";

import type { AuditActor } from "./audit-events";
import type { IdentifierKind } from "./subject-identifiers";
import type { AttributeValue, SubjectProfile } from "./subjects";

import { writeAuditEvent } from "./audit-events";
import { revokeSubjectSessions } from "./sessions";
import { foldIdentifier } from "./subject-identifiers";
import {
	attributeDefinitions,
	createSubject,
	defineAttribute,
	deleteSubject,
	subjectAttributes,
	subjectIdentifiers,
	subjects,
	updateSubject,
} from "./subjects";

/** The audit actor for a call with no directory connection behind it — an administrator's own action. */
const PLATFORM_ACTOR = { type: "platform", id: "system" } as const;

/** How long a rotated token's outgoing digest keeps verifying, the window an administrator has to paste the new one in. */
const PREVIOUS_TOKEN_GRACE_MS = 72 * 60 * 60 * 1000;

/** How many representations one page answers when a caller does not choose. */
const DEFAULT_PAGE_SIZE = 100;

/** The largest page a caller may request, regardless of what it asks for. */
const MAX_PAGE_SIZE = 200;

/** Mints a `scimc` id for a new connection. */
const scimConnectionId = typeid("scimc");

/** Mints a `scimg` id for a new group. */
const scimGroupId = typeid("scimg");

/** The bearer-token-authenticated directory sync channel for one tenant. */
export const scimConnections = table({
	name: "scim_connections",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		name: c.text(),
		token_hash: c.text(),
		previous_token_hash: c.text().nullable(),
		previous_token_expires_at: c.integer().nullable(),
		on_delete: c.enum(["block", "delete"] as const).default("block"),
		group_sync: c.boolean().default(false),
		last_request_at: c.integer().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** One directory group synced through a connection. */
export const scimGroups = table({
	name: "scim_groups",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		connection_id: c.text(),
		display_name: c.text(),
		external_id: c.text().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** One subject's membership in one synced group. */
export const scimGroupMembers = table({
	name: "scim_group_members",
	primaryKey: ["group_id", "subject_id"],
	columns: {
		group_id: c.text(),
		subject_id: c.text(),
		created_at: c.integer(),
	},
});

/** What a synced group stands for, recorded as plain data with nothing here validating the target. */
export const scimGroupMappings = table({
	name: "scim_group_mappings",
	primaryKey: ["group_id", "target_kind", "target_id"],
	columns: {
		group_id: c.text(),
		connection_id: c.text(),
		target_kind: c.text(),
		target_id: c.text(),
		created_at: c.integer(),
	},
});

/** Ties one connection's own `externalId` to the platform subject it provisioned or adopted. */
export const scimLinks = table({
	name: "scim_links",
	primaryKey: ["connection_id", "external_id"],
	columns: {
		connection_id: c.text(),
		external_id: c.text(),
		subject_id: c.text(),
		last_digest: c.text().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

export type ScimConnectionRow = TableRow<typeof scimConnections>;
export type ScimGroupRow = TableRow<typeof scimGroups>;
export type ScimLinkRow = TableRow<typeof scimLinks>;

/** What happens to a subject when its directory entry is deleted outright. */
export type ScimOnDelete = "block" | "delete";

/** A connection's public record, as every RPC method hands it back — never the token digest. */
export interface ScimConnectionRecord {
	id: string;
	name: string;
	onDelete: ScimOnDelete;
	groupSync: boolean;
	lastRequestAt: number | null;
	createdAt: number;
	updatedAt: number;
}

function toScimConnectionRecord(row: ScimConnectionRow): ScimConnectionRecord {
	return {
		id: row.id,
		name: row.name,
		onDelete: row.on_delete as ScimOnDelete,
		groupSync: row.group_sync,
		lastRequestAt: row.last_request_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/** SHA-256 of a value, hex-encoded — the digest a SCIM bearer token is found by. */
async function digestToken(value: string): Promise<string> {
	let hashed = await sha256(value);
	if (isFailure(hashed)) throw new Error("scim token hashing failed");
	return Hex.encode(hashed.data);
}

export interface CreateScimConnectionInput {
	name: string;
	onDelete?: ScimOnDelete;
	groupSync?: boolean;
	actor: AuditActor;
	at?: number;
}

export interface CreateScimConnectionResult {
	ok: true;
	connection: ScimConnectionRecord;
	token: string;
}

let CreateScimConnectionSchema = s.object({
	name: s.string(),
	onDelete: s.optional(s.enum_(["block", "delete"] as const)),
	groupSync: s.optional(s.boolean()),
});

/**
 * Mints a bearer token, stores only its digest, and writes the connection's starting
 * record.
 *
 * @param db - The tenant's database.
 * @param input - The connection's name, its delete policy and whether it syncs groups,
 * and who is creating it.
 * @returns The connection's public record and the token to deliver once — nothing
 * after this call ever returns it again.
 */
export async function createScimConnection(
	db: Database,
	input: CreateScimConnectionInput,
): Promise<CreateScimConnectionResult> {
	let parsed = s.parse(CreateScimConnectionSchema, input);

	let token = randomToken({ bytes: 32, prefix: "scim" });
	let tokenHash = await digestToken(token);
	let now = input.at ?? Date.now();
	let id = scimConnectionId(generateUUID()).toString();

	await db.create(scimConnections, {
		id,
		name: parsed.name,
		token_hash: tokenHash,
		previous_token_hash: null,
		previous_token_expires_at: null,
		on_delete: parsed.onDelete ?? "block",
		group_sync: parsed.groupSync ?? false,
		last_request_at: null,
		created_at: now,
		updated_at: now,
	});

	let row = await db.find(scimConnections, { id });
	if (!row) throw new Error("scim connection row missing immediately after its own create");

	await writeAuditEvent(db, {
		action: "scim.connection.created",
		actor: input.actor,
		targetType: "scim_connection",
		targetId: id,
		outcome: "succeeded",
		detail: { name: parsed.name },
		at: now,
	});

	return { ok: true, connection: toScimConnectionRecord(row), token };
}

export interface RotateScimTokenInput {
	connectionId: string;
	/** The clock rotation runs against; exposed for tests, defaults to the current time. */
	now?: number;
}

export type RotateScimTokenResult =
	| { ok: true; token: string; previousTokenExpiresAt: number }
	| { ok: false; reason: "not-found" };

/**
 * Mints a successor token and opens the 72-hour grace window on the outgoing one in the
 * same call: the current digest moves into the incumbent slot with an expiry, and the
 * new token takes its place with none of its own.
 *
 * @param db - The tenant's database.
 * @param input - The connection to rotate.
 * @returns The new token and when the outgoing one now expires, or that no such
 * connection exists.
 */
export async function rotateScimToken(
	db: Database,
	input: RotateScimTokenInput,
): Promise<RotateScimTokenResult> {
	let connection = await db.find(scimConnections, { id: input.connectionId });
	if (!connection) return { ok: false, reason: "not-found" };

	let now = input.now ?? Date.now();
	let token = randomToken({ bytes: 32, prefix: "scim" });
	let tokenHash = await digestToken(token);
	let previousTokenExpiresAt = now + PREVIOUS_TOKEN_GRACE_MS;

	await db.update(
		scimConnections,
		{ id: connection.id },
		{
			token_hash: tokenHash,
			previous_token_hash: connection.token_hash,
			previous_token_expires_at: previousTokenExpiresAt,
			updated_at: now,
		},
	);

	await writeAuditEvent(db, {
		action: "scim.connection.rotated",
		actor: PLATFORM_ACTOR,
		targetType: "scim_connection",
		targetId: connection.id,
		outcome: "succeeded",
		at: now,
	});

	return { ok: true, token, previousTokenExpiresAt };
}

export type DeleteScimConnectionResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Removes a connection and everything scoped to it: its groups, their membership and
 * mappings, and its links to platform subjects. The subjects it provisioned are left
 * exactly as they are — a connection is the sync channel, not the identities it
 * delivered.
 *
 * @param db - The tenant's database.
 * @param input - The connection to remove.
 * @returns Success, or that no such connection exists.
 */
export async function deleteScimConnection(
	db: Database,
	input: { connectionId: string },
): Promise<DeleteScimConnectionResult> {
	let connection = await db.find(scimConnections, { id: input.connectionId });
	if (!connection) return { ok: false, reason: "not-found" };

	let groups = await db.findMany(scimGroups, { where: { connection_id: connection.id } });
	for (let group of groups) {
		await db.deleteMany(scimGroupMembers, { where: { group_id: group.id } });
		await db.deleteMany(scimGroupMappings, { where: { group_id: group.id } });
	}
	await db.deleteMany(scimGroups, { where: { connection_id: connection.id } });
	await db.deleteMany(scimLinks, { where: { connection_id: connection.id } });
	await db.delete(scimConnections, { id: connection.id });

	await writeAuditEvent(db, {
		action: "scim.connection.deleted",
		actor: PLATFORM_ACTOR,
		targetType: "scim_connection",
		targetId: connection.id,
		outcome: "succeeded",
	});

	return { ok: true };
}

/** Nothing to pass yet; kept as an input parameter for the same shape every other RPC method takes. */
export type DescribeScimConnectionsInput = Record<string, never>;

/**
 * Every connection's public record, never the token digest.
 *
 * @param db - The tenant's database.
 * @returns Every connection, oldest first.
 */
export async function describeScimConnections(
	db: Database,
	_input: DescribeScimConnectionsInput = {},
): Promise<{ connections: ScimConnectionRecord[] }> {
	let rows = await db.findMany(scimConnections, { orderBy: ["created_at", "asc"] });
	return { connections: rows.map(toScimConnectionRecord) };
}

export type ResolveScimTokenResult =
	| { ok: true; connection: ScimConnectionRow }
	| { ok: false; reason: "invalid-token" };

/**
 * Resolves a presented bearer token to the connection it authorizes: checked first
 * against the connection's current digest, then against its incumbent digest when that
 * has not passed its 72-hour expiry yet. Every provisioning operation calls this first,
 * in the same turn as the write it authorizes.
 *
 * @param db - The tenant's database.
 * @param token - The bearer token as presented.
 * @param now - The clock the incumbent's expiry is measured against.
 * @returns The connection the token authorizes, or that no live token matches it.
 */
export async function resolveScimToken(
	db: Database,
	token: string,
	now: number = Date.now(),
): Promise<ResolveScimTokenResult> {
	let hash = await digestToken(token);

	let connection = await db.findOne(scimConnections, { where: { token_hash: hash } });
	if (connection) return { ok: true, connection };

	let incumbent = await db.findOne(scimConnections, { where: { previous_token_hash: hash } });
	if (
		incumbent &&
		incumbent.previous_token_expires_at !== null &&
		incumbent.previous_token_expires_at > now
	) {
		return { ok: true, connection: incumbent };
	}

	return { ok: false, reason: "invalid-token" };
}

/** One address a SCIM user resource carries. */
export interface ScimEmail {
	value: string;
	primary?: boolean;
}

/** One photo a SCIM user resource carries. */
export interface ScimPhoto {
	value: string;
	type?: string;
}

/** The `name` complex attribute a SCIM user resource carries. */
export interface ScimName {
	givenName?: string | null;
	familyName?: string | null;
	formatted?: string | null;
}

/**
 * The SCIM user resource shape this pass's RPC methods accept, already parsed out of
 * whatever JSON envelope the HTTP layer reads it from — turning a raw
 * `application/scim+json` body (including the enterprise extension's own
 * schema-qualified key) into this shape is that layer's job, not this one's.
 */
export interface ScimUserResource {
	externalId?: string | null;
	userName?: string;
	active?: boolean;
	emails?: ScimEmail[];
	name?: ScimName;
	displayName?: string | null;
	preferredLanguage?: string | null;
	timezone?: string | null;
	photos?: ScimPhoto[];
	/** Accepted and stored nowhere: a phone number is not an identifier, a factor or a delivery channel in this series. */
	phoneNumbers?: unknown;
	/** Accepted and stored nowhere: the connection authenticates these subjects, and a credential sent over provisioning is a shared secret with an extra holder. */
	password?: string;
	/** The enterprise extension's own members, mapped onto declared subject attributes. */
	enterprise?: Record<string, AttributeValue>;
}

/** A user resource's attribute-table mapping, resolved before anything is written or compared. */
interface MappedUser {
	primaryEmail: string | null;
	username: string | null;
	profile: SubjectProfile;
	active: boolean;
	attributes: Record<string, AttributeValue>;
}

/** The primary email identifier: `emails[primary]`, falling back to `userName` when it parses as an address. */
function resolvePrimaryEmail(resource: ScimUserResource): string | null {
	let fromEmails =
		resource.emails?.find((email) => email.primary)?.value ?? resource.emails?.[0]?.value ?? null;
	if (fromEmails) return fromEmails;
	if (resource.userName && foldIdentifier("email", resource.userName).ok) return resource.userName;
	return null;
}

/** The username identifier: `userName`, only when it does not parse as an address — that case is the primary email instead. */
function resolveUsername(resource: ScimUserResource): string | null {
	if (!resource.userName) return null;
	if (foldIdentifier("email", resource.userName).ok) return null;
	return resource.userName;
}

/** Resolves a SCIM user resource down to the fields this module writes and compares. */
function mapUserResource(resource: ScimUserResource): MappedUser {
	return {
		primaryEmail: resolvePrimaryEmail(resource),
		username: resolveUsername(resource),
		profile: {
			givenName: resource.name?.givenName ?? null,
			familyName: resource.name?.familyName ?? null,
			name: resource.name?.formatted ?? null,
			nickname: resource.displayName ?? null,
			locale: resource.preferredLanguage ?? null,
			zoneinfo: resource.timezone ?? null,
			picture: resource.photos?.find((photo) => photo.type === "photo")?.value ?? null,
		},
		active: resource.active ?? true,
		attributes: resource.enterprise ?? {},
	};
}

/** Serializes a value with every object's keys sorted, so the same mapped state always digests to the same string regardless of key order. */
function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

	if (value !== null && typeof value === "object") {
		let entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
			a < b ? -1 : a > b ? 1 : 0,
		);
		return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
	}

	return JSON.stringify(value);
}

/** The digest {@link scimReplaceUser} compares against `scim_links.last_digest`: a replace that changes nothing writes nothing. */
async function digestMappedUser(mapped: MappedUser): Promise<string> {
	let hashed = await sha256(
		stableStringify({
			primaryEmail: mapped.primaryEmail,
			username: mapped.username,
			profile: mapped.profile,
			active: mapped.active,
			attributes: mapped.attributes,
		}),
	);
	if (isFailure(hashed)) throw new Error("scim digest hashing failed");
	return Hex.encode(hashed.data);
}

/** Declares any attribute key not already known, at `internal` visibility — the tenant's own later redeclaration is left standing rather than overwritten. */
async function ensureAttributeDefinitions(
	db: Database,
	attributes: Record<string, AttributeValue>,
): Promise<void> {
	for (let [key, value] of Object.entries(attributes)) {
		let existing = await db.find(attributeDefinitions, { key });
		if (!existing) {
			await defineAttribute(db, {
				key,
				type: value === null ? "string" : typeof value,
				visibility: "internal",
			});
		}
	}
}

/** The current mapped state {@link scimPatchUser} recomputes its digest from, read back off the subject's own rows rather than carried from the request. */
async function currentMappedStateFor(db: Database, subjectId: string): Promise<MappedUser> {
	let subject = await db.find(subjects, { id: subjectId });
	if (!subject) throw new Error("subject row missing while recomputing its SCIM digest");

	let identifierRows = await db.findMany(subjectIdentifiers, { where: { subject_id: subjectId } });
	let primaryEmail =
		identifierRows.find((row) => row.kind === "email" && row.is_primary)?.value ?? null;
	let username = identifierRows.find((row) => row.kind === "username")?.value ?? null;

	let attributeRows = await db.findMany(subjectAttributes, { where: { subject_id: subjectId } });
	let attributes: Record<string, AttributeValue> = {};
	for (let row of attributeRows) attributes[row.key] = row.value as AttributeValue;

	return {
		primaryEmail,
		username,
		profile: {
			givenName: subject.given_name,
			familyName: subject.family_name,
			name: subject.name,
			nickname: subject.nickname,
			locale: subject.locale,
			zoneinfo: subject.zoneinfo,
			picture: subject.picture,
		},
		active: subject.status === "active",
		attributes,
	};
}

/** A user as one provisioning call hands it back. */
export interface ScimUserRepresentation {
	id: string;
	externalId: string | null;
	userName: string | null;
	active: boolean;
	emails: { value: string; primary: boolean }[];
	name: { givenName: string | null; familyName: string | null; formatted: string | null };
	displayName: string | null;
	preferredLanguage: string | null;
	timezone: string | null;
	attributes: Record<string, AttributeValue>;
}

async function assembleUserRepresentation(
	db: Database,
	subjectId: string,
	externalId: string | null,
): Promise<ScimUserRepresentation> {
	let subject = await db.find(subjects, { id: subjectId });
	if (!subject) throw new Error("subject row missing while assembling its SCIM representation");

	let identifierRows = await db.findMany(subjectIdentifiers, { where: { subject_id: subjectId } });
	let primaryEmail = identifierRows.find((row) => row.kind === "email" && row.is_primary);
	let username = identifierRows.find((row) => row.kind === "username");

	let attributeRows = await db.findMany(subjectAttributes, { where: { subject_id: subjectId } });
	let attributes: Record<string, AttributeValue> = {};
	for (let row of attributeRows) attributes[row.key] = row.value as AttributeValue;

	return {
		id: subject.id,
		externalId,
		userName: username?.value ?? primaryEmail?.value ?? null,
		active: subject.status === "active",
		emails: primaryEmail ? [{ value: primaryEmail.value, primary: true }] : [],
		name: {
			givenName: subject.given_name,
			familyName: subject.family_name,
			formatted: subject.name,
		},
		displayName: subject.nickname,
		preferredLanguage: subject.locale,
		timezone: subject.zoneinfo,
		attributes,
	};
}

/** Blocks a subject and revokes its sessions in the same call, with the connection recorded as the actor — the PATCH `active: false` and DELETE-as-block effect every user-lifecycle operation here shares. */
async function deactivateSubjectInline(
	db: Database,
	connectionId: string,
	subjectId: string,
	now: number,
): Promise<void> {
	await db.update(subjects, { id: subjectId }, { status: "blocked", updated_at: now });

	await revokeSubjectSessions(db, {
		subjectId,
		reason: "deactivated by a SCIM directory connection",
		actor: { type: "client", id: connectionId },
	});

	await writeAuditEvent(db, {
		action: "scim.user.deactivated",
		actor: { type: "client", id: connectionId },
		targetType: "subject",
		targetId: subjectId,
		outcome: "succeeded",
		at: now,
	});
}

/** Restores a subject to active, leaving its sessions exactly as `active: false` left them. */
async function activateSubjectInline(
	db: Database,
	connectionId: string,
	subjectId: string,
	now: number,
): Promise<void> {
	await db.update(subjects, { id: subjectId }, { status: "active", updated_at: now });

	await writeAuditEvent(db, {
		action: "scim.user.activated",
		actor: { type: "client", id: connectionId },
		targetType: "subject",
		targetId: subjectId,
		outcome: "succeeded",
		at: now,
	});
}

/** Moves a subject's status to match `desiredActive`, doing nothing when it already matches. */
async function syncActiveStateInline(
	db: Database,
	connectionId: string,
	subjectId: string,
	desiredActive: boolean,
	now: number,
): Promise<void> {
	let subject = await db.find(subjects, { id: subjectId });
	if (!subject) return;

	let currentlyActive = subject.status === "active";
	if (currentlyActive && !desiredActive) {
		await deactivateSubjectInline(db, connectionId, subjectId, now);
	} else if (!currentlyActive && desiredActive) {
		await activateSubjectInline(db, connectionId, subjectId, now);
	}
}

export interface ScimProvisionUserInput {
	token: string;
	resource: ScimUserResource;
	at?: number;
}

export type ScimProvisionUserResult =
	| { ok: true; created: boolean; representation: ScimUserRepresentation }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "missing-external-id" }
	| { ok: false; reason: "missing-identifier" }
	| { ok: false; reason: "invalid-identifier" }
	| { ok: false; reason: "uniqueness-conflict" };

/**
 * Provisions a user: resolves the connection, folds the resource's primary email, and
 * either adopts a subject already carrying that folded address (writing the link
 * without creating a second subject) or mints a fresh one. A folded address already
 * linked to this connection under a different `externalId` refuses with a uniqueness
 * conflict rather than silently reassigning it.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, the SCIM user resource, and the clock to write with.
 * @returns The subject's representation and whether it was created, or which rule
 * refused the call.
 */
export async function scimProvisionUser(
	db: Database,
	input: ScimProvisionUserInput,
): Promise<ScimProvisionUserResult> {
	let now = input.at ?? Date.now();
	let resolved = await resolveScimToken(db, input.token, now);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };
	let connection = resolved.connection;

	let externalId = input.resource.externalId ?? null;
	if (!externalId) return { ok: false, reason: "missing-external-id" };

	let mapped = mapUserResource(input.resource);
	if (!mapped.primaryEmail && !mapped.username) return { ok: false, reason: "missing-identifier" };

	let foldedEmail: string | null = null;
	if (mapped.primaryEmail) {
		let folded = foldIdentifier("email", mapped.primaryEmail);
		if (!folded.ok) return { ok: false, reason: "invalid-identifier" };
		foldedEmail = folded.folded;
	}

	await ensureAttributeDefinitions(db, mapped.attributes);

	let digest = await digestMappedUser(mapped);

	let matchedIdentifier = foldedEmail
		? await db.findOne(subjectIdentifiers, {
				where: and(eq("kind", "email"), eq("folded", foldedEmail)),
			})
		: null;

	if (matchedIdentifier) {
		let subjectId = matchedIdentifier.subject_id;

		let existingLink = await db.findOne(scimLinks, {
			where: and(eq("connection_id", connection.id), eq("subject_id", subjectId)),
		});

		if (existingLink && existingLink.external_id !== externalId) {
			return { ok: false, reason: "uniqueness-conflict" };
		}

		if (!existingLink) {
			let externalIdTaken = await db.find(scimLinks, {
				connection_id: connection.id,
				external_id: externalId,
			});
			if (externalIdTaken) return { ok: false, reason: "uniqueness-conflict" };

			await db.create(scimLinks, {
				connection_id: connection.id,
				external_id: externalId,
				subject_id: subjectId,
				last_digest: digest,
				created_at: now,
				updated_at: now,
			});
		} else {
			await db.update(
				scimLinks,
				{ connection_id: connection.id, external_id: externalId },
				{ last_digest: digest, updated_at: now },
			);
		}

		if (matchedIdentifier.verified_at === null) {
			await db.update(
				subjectIdentifiers,
				{ id: matchedIdentifier.id },
				{ verified_at: now, is_primary: true },
			);
		}

		let updated = await updateSubject(db, {
			subjectId,
			profile: mapped.profile,
			attributes: mapped.attributes,
			actor: { kind: "admin" },
		});
		if (!updated.ok)
			throw new Error("scim provisioning could not apply attributes it already validated");

		await writeAuditEvent(db, {
			action: "scim.user.provisioned",
			actor: { type: "client", id: connection.id },
			targetType: "subject",
			targetId: subjectId,
			outcome: "succeeded",
			detail: { externalId, created: false },
			at: now,
		});

		await syncActiveStateInline(db, connection.id, subjectId, mapped.active, now);

		return {
			ok: true,
			created: false,
			representation: await assembleUserRepresentation(db, subjectId, externalId),
		};
	}

	let externalIdTaken = await db.find(scimLinks, {
		connection_id: connection.id,
		external_id: externalId,
	});
	if (externalIdTaken) return { ok: false, reason: "uniqueness-conflict" };

	let identifiers: { kind: IdentifierKind; value: string }[] = [];
	if (mapped.primaryEmail) identifiers.push({ kind: "email", value: mapped.primaryEmail });
	if (mapped.username) identifiers.push({ kind: "username", value: mapped.username });

	let created = await createSubject(db, {
		identifiers,
		profile: mapped.profile,
		attributes: mapped.attributes,
	});

	if (!created.ok) {
		if (created.reason === "invalid-identifier") return { ok: false, reason: "invalid-identifier" };
		return { ok: false, reason: "uniqueness-conflict" };
	}

	if (mapped.primaryEmail) {
		await db.updateMany(
			subjectIdentifiers,
			{ verified_at: now, is_primary: true },
			{ where: and(eq("subject_id", created.subjectId), eq("kind", "email")) },
		);
	}

	await db.create(scimLinks, {
		connection_id: connection.id,
		external_id: externalId,
		subject_id: created.subjectId,
		last_digest: digest,
		created_at: now,
		updated_at: now,
	});

	await writeAuditEvent(db, {
		action: "scim.user.provisioned",
		actor: { type: "client", id: connection.id },
		targetType: "subject",
		targetId: created.subjectId,
		outcome: "succeeded",
		detail: { externalId, created: true },
		at: now,
	});

	await syncActiveStateInline(db, connection.id, created.subjectId, mapped.active, now);

	return {
		ok: true,
		created: true,
		representation: await assembleUserRepresentation(db, created.subjectId, externalId),
	};
}

export interface ScimReplaceUserInput {
	token: string;
	id: string;
	resource: ScimUserResource;
	at?: number;
}

export type ScimReplaceUserResult =
	| { ok: true; unchanged: boolean; representation: ScimUserRepresentation }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "not-found" };

/**
 * Replaces a user's mapped attributes wholesale. When the resource's mapped digest
 * matches what `scim_links` already holds, answers the current representation flagged
 * unchanged without writing anything — the back-pressure point that keeps a periodic
 * full resync of an unchanged directory cheap.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, the subject id, the replacement resource, and the
 * clock to write with.
 * @returns The current representation and whether anything changed, or which rule
 * refused the call.
 */
export async function scimReplaceUser(
	db: Database,
	input: ScimReplaceUserInput,
): Promise<ScimReplaceUserResult> {
	let now = input.at ?? Date.now();
	let resolved = await resolveScimToken(db, input.token, now);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };
	let connection = resolved.connection;

	let link = await db.findOne(scimLinks, {
		where: and(eq("connection_id", connection.id), eq("subject_id", input.id)),
	});
	if (!link) return { ok: false, reason: "not-found" };

	let mapped = mapUserResource(input.resource);
	await ensureAttributeDefinitions(db, mapped.attributes);
	let digest = await digestMappedUser(mapped);

	if (link.last_digest === digest) {
		return {
			ok: true,
			unchanged: true,
			representation: await assembleUserRepresentation(db, input.id, link.external_id),
		};
	}

	let updated = await updateSubject(db, {
		subjectId: input.id,
		profile: mapped.profile,
		attributes: mapped.attributes,
		actor: { kind: "admin" },
	});
	if (!updated.ok) throw new Error("scim replace could not apply attributes it already validated");

	await syncActiveStateInline(db, connection.id, input.id, mapped.active, now);

	await db.update(
		scimLinks,
		{ connection_id: connection.id, external_id: link.external_id },
		{ last_digest: digest, updated_at: now },
	);

	await writeAuditEvent(db, {
		action: "scim.user.replaced",
		actor: { type: "client", id: connection.id },
		targetType: "subject",
		targetId: input.id,
		outcome: "succeeded",
		at: now,
	});

	return {
		ok: true,
		unchanged: false,
		representation: await assembleUserRepresentation(db, input.id, link.external_id),
	};
}

/** The standard fields a user PATCH operation may target directly; anything else is treated as a declared attribute key. */
const STANDARD_USER_PATCH_ATTRIBUTES = new Set([
	"active",
	"givenName",
	"familyName",
	"name",
	"displayName",
	"preferredLanguage",
	"timezone",
	"picture",
]);

/** One `replace`/`add` operation on a named user attribute — the only forms {@link scimPatchUser} supports. */
export interface ScimUserPatchOperation {
	op: "replace" | "add";
	attribute: string;
	value: AttributeValue;
}

export interface ScimPatchUserInput {
	token: string;
	id: string;
	operations: ScimUserPatchOperation[];
	at?: number;
}

export type ScimPatchUserResult =
	| { ok: true; representation: ScimUserRepresentation }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unsupported-operation"; index: number };

/**
 * Applies `replace`/`add` operations on named user attributes, refusing any other
 * operation shape before writing anything. `active: false` blocks the subject and
 * revokes every session in the same call; `active: true` restores it, leaving sessions
 * as they were.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, the subject id, the operations to apply, and the
 * clock to write with.
 * @returns The updated representation, or which rule refused the call.
 */
export async function scimPatchUser(
	db: Database,
	input: ScimPatchUserInput,
): Promise<ScimPatchUserResult> {
	let now = input.at ?? Date.now();
	let resolved = await resolveScimToken(db, input.token, now);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };
	let connection = resolved.connection;

	let link = await db.findOne(scimLinks, {
		where: and(eq("connection_id", connection.id), eq("subject_id", input.id)),
	});
	if (!link) return { ok: false, reason: "not-found" };

	for (let [index, operation] of input.operations.entries()) {
		let validOp = operation.op === "replace" || operation.op === "add";
		let validAttribute = typeof operation.attribute === "string" && operation.attribute.length > 0;
		if (!validOp || !validAttribute) return { ok: false, reason: "unsupported-operation", index };
	}

	let profileChanges: SubjectProfile = {};
	let attributeChanges: Record<string, AttributeValue> = {};
	let activeChange: boolean | undefined;

	for (let operation of input.operations) {
		if (!STANDARD_USER_PATCH_ATTRIBUTES.has(operation.attribute)) {
			attributeChanges[operation.attribute] = operation.value;
			continue;
		}

		switch (operation.attribute) {
			case "active":
				activeChange = Boolean(operation.value);
				break;
			case "givenName":
				profileChanges.givenName = operation.value as string | null;
				break;
			case "familyName":
				profileChanges.familyName = operation.value as string | null;
				break;
			case "name":
				profileChanges.name = operation.value as string | null;
				break;
			case "displayName":
				profileChanges.nickname = operation.value as string | null;
				break;
			case "preferredLanguage":
				profileChanges.locale = operation.value as string | null;
				break;
			case "timezone":
				profileChanges.zoneinfo = operation.value as string | null;
				break;
			case "picture":
				profileChanges.picture = operation.value as string | null;
				break;
		}
	}

	await ensureAttributeDefinitions(db, attributeChanges);

	if (Object.keys(profileChanges).length > 0 || Object.keys(attributeChanges).length > 0) {
		let updated = await updateSubject(db, {
			subjectId: input.id,
			profile: profileChanges,
			attributes: attributeChanges,
			actor: { kind: "admin" },
		});
		if (!updated.ok) throw new Error("scim patch could not apply attributes it already validated");
	}

	if (activeChange !== undefined) {
		await syncActiveStateInline(db, connection.id, input.id, activeChange, now);
	}

	let recomputed = await currentMappedStateFor(db, input.id);
	let digest = await digestMappedUser(recomputed);

	await db.update(
		scimLinks,
		{ connection_id: connection.id, external_id: link.external_id },
		{ last_digest: digest, updated_at: now },
	);

	await writeAuditEvent(db, {
		action: "scim.user.patched",
		actor: { type: "client", id: connection.id },
		targetType: "subject",
		targetId: input.id,
		outcome: "succeeded",
		at: now,
	});

	return {
		ok: true,
		representation: await assembleUserRepresentation(db, input.id, link.external_id),
	};
}

export interface ScimDeleteUserInput {
	token: string;
	id: string;
	at?: number;
}

export type ScimDeleteUserResult =
	| { ok: true; subjectId: string; action: "blocked" | "deleted" }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "not-found" };

/**
 * Deletes a user per the connection's own policy: `block` flips its status and revokes
 * its sessions, leaving the subject and its links in place; `delete` retires the
 * subject outright and removes this module's own rows naming it. A caller that also
 * knows about a subject's passwords, passkeys and second factor deletes those
 * alongside a `deleted` outcome, the same seam `deleteSubject` already leaves open to
 * its own caller.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, the subject id, and the clock to write with.
 * @returns Which effect ran and the subject it ran against, or which rule refused the
 * call.
 */
export async function scimDeleteUser(
	db: Database,
	input: ScimDeleteUserInput,
): Promise<ScimDeleteUserResult> {
	let now = input.at ?? Date.now();
	let resolved = await resolveScimToken(db, input.token, now);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };
	let connection = resolved.connection;

	let link = await db.findOne(scimLinks, {
		where: and(eq("connection_id", connection.id), eq("subject_id", input.id)),
	});
	if (!link) return { ok: false, reason: "not-found" };

	let policy = connection.on_delete as ScimOnDelete;

	if (policy === "block") {
		await syncActiveStateInline(db, connection.id, input.id, false, now);

		await writeAuditEvent(db, {
			action: "scim.user.deleted",
			actor: { type: "client", id: connection.id },
			targetType: "subject",
			targetId: input.id,
			outcome: "succeeded",
			detail: { policy },
			at: now,
		});

		return { ok: true, subjectId: input.id, action: "blocked" };
	}

	await db.deleteMany(scimGroupMembers, { where: { subject_id: input.id } });
	await db.deleteMany(scimLinks, {
		where: and(eq("connection_id", connection.id), eq("subject_id", input.id)),
	});

	await writeAuditEvent(db, {
		action: "scim.user.deleted",
		actor: { type: "client", id: connection.id },
		targetType: "subject",
		targetId: input.id,
		outcome: "succeeded",
		detail: { policy },
		at: now,
	});

	await deleteSubject(db, { subjectId: input.id });

	return { ok: true, subjectId: input.id, action: "deleted" };
}

export interface ScimReadUserInput {
	token: string;
	id: string;
}

export type ScimReadUserResult =
	| { ok: true; representation: ScimUserRepresentation }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "not-found" };

/**
 * Reads one user this connection provisioned.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token and the subject id.
 * @returns The user's representation, or which rule refused the call.
 */
export async function scimReadUser(
	db: Database,
	input: ScimReadUserInput,
): Promise<ScimReadUserResult> {
	let resolved = await resolveScimToken(db, input.token);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };

	let link = await db.findOne(scimLinks, {
		where: and(eq("connection_id", resolved.connection.id), eq("subject_id", input.id)),
	});
	if (!link) return { ok: false, reason: "not-found" };

	return {
		ok: true,
		representation: await assembleUserRepresentation(db, input.id, link.external_id),
	};
}

/** The only attributes a user list `filter` may name with `eq`, per the ADR's own subset. */
const USER_FILTER_ATTRIBUTES = ["userName", "externalId", "emails.value"] as const;

/** Parses the one filter grammar this pass serves: `attribute eq "value"` over an allowed attribute. */
function parseEqFilter(
	filter: string,
	allowed: readonly string[],
): { ok: true; attribute: string; value: string } | { ok: false } {
	let match = /^(\S+)\s+eq\s+"([^"]*)"$/i.exec(filter.trim());
	if (!match) return { ok: false };

	let [, attribute, value] = match;
	if (!attribute || value === undefined || !allowed.includes(attribute)) return { ok: false };

	return { ok: true, attribute, value };
}

export interface ScimReadUserPageInput {
	token: string;
	filter?: string;
	startIndex?: number;
	count?: number;
}

export type ScimReadUserPageResult =
	| {
			ok: true;
			representations: ScimUserRepresentation[];
			totalResults: number;
			startIndex: number;
	  }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "unsupported-filter" };

/**
 * A page of this connection's users, ordered by creation, with `totalResults` exact —
 * a directory is bounded by its plan's subject cap, so counting it exactly costs
 * nothing a cursor would have saved.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, an optional `attribute eq "value"` filter, and
 * where to page from.
 * @returns The page and its exact total, or which rule refused the call.
 */
export async function scimReadUserPage(
	db: Database,
	input: ScimReadUserPageInput,
): Promise<ScimReadUserPageResult> {
	let resolved = await resolveScimToken(db, input.token);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };
	let connection = resolved.connection;

	let parsedFilter: { attribute: string; value: string } | null = null;
	if (input.filter !== undefined) {
		let parsed = parseEqFilter(input.filter, USER_FILTER_ATTRIBUTES);
		if (!parsed.ok) return { ok: false, reason: "unsupported-filter" };
		parsedFilter = parsed;
	}

	let links = await db.findMany(scimLinks, {
		where: eq("connection_id", connection.id),
		orderBy: ["created_at", "asc"],
	});

	let representations: ScimUserRepresentation[] = [];
	for (let link of links) {
		let representation = await assembleUserRepresentation(db, link.subject_id, link.external_id);

		if (parsedFilter) {
			let matches =
				(parsedFilter.attribute === "userName" && representation.userName === parsedFilter.value) ||
				(parsedFilter.attribute === "externalId" &&
					representation.externalId === parsedFilter.value) ||
				(parsedFilter.attribute === "emails.value" &&
					representation.emails.some((email) => email.value === parsedFilter?.value));
			if (!matches) continue;
		}

		representations.push(representation);
	}

	let totalResults = representations.length;
	let startIndex = Math.max(input.startIndex ?? 1, 1);
	let count = Math.min(input.count ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

	return {
		ok: true,
		representations: representations.slice(startIndex - 1, startIndex - 1 + count),
		totalResults,
		startIndex,
	};
}

/** A SCIM group resource, already parsed out of whatever JSON envelope the HTTP layer reads it from. */
export interface ScimGroupResource {
	displayName: string;
	externalId?: string | null;
	members?: { value: string }[];
}

/** A group as one provisioning call hands it back. */
export interface ScimGroupRepresentation {
	id: string;
	externalId: string | null;
	displayName: string;
	members: string[];
}

async function assembleGroupRepresentation(
	db: Database,
	groupId: string,
): Promise<ScimGroupRepresentation> {
	let group = await db.find(scimGroups, { id: groupId });
	if (!group) throw new Error("group row missing while assembling its SCIM representation");

	let memberRows = await db.findMany(scimGroupMembers, { where: { group_id: groupId } });

	return {
		id: group.id,
		externalId: group.external_id,
		displayName: group.display_name,
		members: memberRows.map((row) => row.subject_id),
	};
}

export interface ScimProvisionGroupInput {
	token: string;
	resource: ScimGroupResource;
	at?: number;
}

export type ScimProvisionGroupResult =
	| { ok: true; representation: ScimGroupRepresentation }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "missing-external-id" }
	| { ok: false; reason: "uniqueness-conflict" }
	| { ok: false; reason: "unknown-member"; subjectId: string };

/**
 * Provisions a group: validates every member names an existing subject before writing
 * anything, then creates the group and its membership rows in one call.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, the SCIM group resource, and the clock to write
 * with.
 * @returns The group's representation, or which rule refused the call.
 */
export async function scimProvisionGroup(
	db: Database,
	input: ScimProvisionGroupInput,
): Promise<ScimProvisionGroupResult> {
	let now = input.at ?? Date.now();
	let resolved = await resolveScimToken(db, input.token, now);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };
	let connection = resolved.connection;

	let externalId = input.resource.externalId ?? null;
	if (!externalId) return { ok: false, reason: "missing-external-id" };

	let taken = await db.findOne(scimGroups, {
		where: and(eq("connection_id", connection.id), eq("external_id", externalId)),
	});
	if (taken) return { ok: false, reason: "uniqueness-conflict" };

	let members = input.resource.members ?? [];
	for (let member of members) {
		let subject = await db.find(subjects, { id: member.value });
		if (!subject) return { ok: false, reason: "unknown-member", subjectId: member.value };
	}

	let id = scimGroupId(generateUUID()).toString();

	await db.create(scimGroups, {
		id,
		connection_id: connection.id,
		display_name: input.resource.displayName,
		external_id: externalId,
		created_at: now,
		updated_at: now,
	});

	for (let member of members) {
		await db.create(scimGroupMembers, { group_id: id, subject_id: member.value, created_at: now });
	}

	await writeAuditEvent(db, {
		action: "scim.group.provisioned",
		actor: { type: "client", id: connection.id },
		targetType: "scim_group",
		targetId: id,
		outcome: "succeeded",
		detail: { externalId },
		at: now,
	});

	return { ok: true, representation: await assembleGroupRepresentation(db, id) };
}

export interface ScimReplaceGroupInput {
	token: string;
	id: string;
	resource: ScimGroupResource;
	at?: number;
}

export type ScimReplaceGroupResult =
	| { ok: true; representation: ScimGroupRepresentation }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unknown-member"; subjectId: string };

/**
 * Replaces a group's display name and whole membership set.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, the group id, the replacement resource, and the
 * clock to write with.
 * @returns The updated representation, or which rule refused the call.
 */
export async function scimReplaceGroup(
	db: Database,
	input: ScimReplaceGroupInput,
): Promise<ScimReplaceGroupResult> {
	let now = input.at ?? Date.now();
	let resolved = await resolveScimToken(db, input.token, now);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };
	let connection = resolved.connection;

	let group = await db.findOne(scimGroups, {
		where: and(eq("id", input.id), eq("connection_id", connection.id)),
	});
	if (!group) return { ok: false, reason: "not-found" };

	let members = input.resource.members ?? [];
	for (let member of members) {
		let subject = await db.find(subjects, { id: member.value });
		if (!subject) return { ok: false, reason: "unknown-member", subjectId: member.value };
	}

	await db.update(
		scimGroups,
		{ id: group.id },
		{ display_name: input.resource.displayName, updated_at: now },
	);

	await db.deleteMany(scimGroupMembers, { where: { group_id: group.id } });
	for (let member of members) {
		await db.create(scimGroupMembers, {
			group_id: group.id,
			subject_id: member.value,
			created_at: now,
		});
	}

	await writeAuditEvent(db, {
		action: "scim.group.replaced",
		actor: { type: "client", id: connection.id },
		targetType: "scim_group",
		targetId: group.id,
		outcome: "succeeded",
		at: now,
	});

	return { ok: true, representation: await assembleGroupRepresentation(db, group.id) };
}

/**
 * A group PATCH operation: `replace`/`add` on `displayName`, `add` on `members` with a
 * value array, or `remove` on `members` naming one subject — the forms the ADR's own
 * table lists, nothing else.
 */
export type ScimGroupPatchOperation =
	| { op: "replace" | "add"; attribute: "displayName"; value: string }
	| { op: "add"; attribute: "members"; values: string[] }
	| { op: "remove"; attribute: "members"; value: string };

export interface ScimPatchGroupInput {
	token: string;
	id: string;
	operations: ScimGroupPatchOperation[];
	at?: number;
}

export type ScimPatchGroupResult =
	| { ok: true; representation: ScimGroupRepresentation }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unsupported-operation"; index: number }
	| { ok: false; reason: "unknown-member"; subjectId: string };

/**
 * Applies group PATCH operations: a plain `displayName` change, or a membership `add`
 * or `remove`. Every operation is validated before any is applied, so a request mixing
 * one unsupported form with otherwise-valid ones writes nothing.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, the group id, the operations to apply, and the
 * clock to write with.
 * @returns The updated representation, or which rule refused the call.
 */
export async function scimPatchGroup(
	db: Database,
	input: ScimPatchGroupInput,
): Promise<ScimPatchGroupResult> {
	let now = input.at ?? Date.now();
	let resolved = await resolveScimToken(db, input.token, now);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };
	let connection = resolved.connection;

	let group = await db.findOne(scimGroups, {
		where: and(eq("id", input.id), eq("connection_id", connection.id)),
	});
	if (!group) return { ok: false, reason: "not-found" };

	for (let [index, operation] of input.operations.entries()) {
		let validShape =
			(operation.attribute === "displayName" &&
				(operation.op === "replace" || operation.op === "add") &&
				typeof operation.value === "string") ||
			(operation.attribute === "members" &&
				operation.op === "add" &&
				Array.isArray(operation.values)) ||
			(operation.attribute === "members" &&
				operation.op === "remove" &&
				typeof operation.value === "string");
		if (!validShape) return { ok: false, reason: "unsupported-operation", index };
	}

	for (let operation of input.operations) {
		if (operation.attribute !== "members" || operation.op !== "add") continue;
		for (let subjectId of operation.values) {
			let subject = await db.find(subjects, { id: subjectId });
			if (!subject) return { ok: false, reason: "unknown-member", subjectId };
		}
	}

	for (let operation of input.operations) {
		if (operation.attribute === "displayName") {
			await db.update(
				scimGroups,
				{ id: group.id },
				{ display_name: operation.value, updated_at: now },
			);
			continue;
		}

		if (operation.op === "add") {
			for (let subjectId of operation.values) {
				let existing = await db.find(scimGroupMembers, {
					group_id: group.id,
					subject_id: subjectId,
				});
				if (!existing) {
					await db.create(scimGroupMembers, {
						group_id: group.id,
						subject_id: subjectId,
						created_at: now,
					});
				}
			}
		} else {
			await db.delete(scimGroupMembers, { group_id: group.id, subject_id: operation.value });
		}
	}

	await writeAuditEvent(db, {
		action: "scim.group.patched",
		actor: { type: "client", id: connection.id },
		targetType: "scim_group",
		targetId: group.id,
		outcome: "succeeded",
		at: now,
	});

	return { ok: true, representation: await assembleGroupRepresentation(db, group.id) };
}

export interface ScimDeleteGroupInput {
	token: string;
	id: string;
	at?: number;
}

export type ScimDeleteGroupResult =
	| { ok: true }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "not-found" };

/**
 * Deletes a group, its membership and its mappings. Subjects that belonged to it are
 * left exactly as they are — a group's deletion retires the group, not the people it
 * once listed.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, the group id, and the clock to write with.
 * @returns Success, or which rule refused the call.
 */
export async function scimDeleteGroup(
	db: Database,
	input: ScimDeleteGroupInput,
): Promise<ScimDeleteGroupResult> {
	let now = input.at ?? Date.now();
	let resolved = await resolveScimToken(db, input.token, now);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };
	let connection = resolved.connection;

	let group = await db.findOne(scimGroups, {
		where: and(eq("id", input.id), eq("connection_id", connection.id)),
	});
	if (!group) return { ok: false, reason: "not-found" };

	await db.deleteMany(scimGroupMembers, { where: { group_id: group.id } });
	await db.deleteMany(scimGroupMappings, { where: { group_id: group.id } });
	await db.delete(scimGroups, { id: group.id });

	await writeAuditEvent(db, {
		action: "scim.group.deleted",
		actor: { type: "client", id: connection.id },
		targetType: "scim_group",
		targetId: group.id,
		outcome: "succeeded",
		at: now,
	});

	return { ok: true };
}

export interface ScimReadGroupInput {
	token: string;
	id: string;
}

export type ScimReadGroupResult =
	| { ok: true; representation: ScimGroupRepresentation }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "not-found" };

/**
 * Reads one group this connection provisioned.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token and the group id.
 * @returns The group's representation, or which rule refused the call.
 */
export async function scimReadGroup(
	db: Database,
	input: ScimReadGroupInput,
): Promise<ScimReadGroupResult> {
	let resolved = await resolveScimToken(db, input.token);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };

	let group = await db.findOne(scimGroups, {
		where: and(eq("id", input.id), eq("connection_id", resolved.connection.id)),
	});
	if (!group) return { ok: false, reason: "not-found" };

	return { ok: true, representation: await assembleGroupRepresentation(db, group.id) };
}

/** The only attributes a group list `filter` may name with `eq`, per the ADR's own subset. */
const GROUP_FILTER_ATTRIBUTES = ["displayName", "externalId"] as const;

export interface ScimReadGroupPageInput {
	token: string;
	filter?: string;
	startIndex?: number;
	count?: number;
}

export type ScimReadGroupPageResult =
	| {
			ok: true;
			representations: ScimGroupRepresentation[];
			totalResults: number;
			startIndex: number;
	  }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "unsupported-filter" };

/**
 * A page of this connection's groups, ordered by creation, with `totalResults` exact.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, an optional `attribute eq "value"` filter, and
 * where to page from.
 * @returns The page and its exact total, or which rule refused the call.
 */
export async function scimReadGroupPage(
	db: Database,
	input: ScimReadGroupPageInput,
): Promise<ScimReadGroupPageResult> {
	let resolved = await resolveScimToken(db, input.token);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };
	let connection = resolved.connection;

	let parsedFilter: { attribute: string; value: string } | null = null;
	if (input.filter !== undefined) {
		let parsed = parseEqFilter(input.filter, GROUP_FILTER_ATTRIBUTES);
		if (!parsed.ok) return { ok: false, reason: "unsupported-filter" };
		parsedFilter = parsed;
	}

	let groups = await db.findMany(scimGroups, {
		where: eq("connection_id", connection.id),
		orderBy: ["created_at", "asc"],
	});

	let filtered = groups.filter((group) => {
		if (!parsedFilter) return true;
		if (parsedFilter.attribute === "displayName") return group.display_name === parsedFilter.value;
		return group.external_id === parsedFilter.value;
	});

	let totalResults = filtered.length;
	let startIndex = Math.max(input.startIndex ?? 1, 1);
	let count = Math.min(input.count ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
	let page = filtered.slice(startIndex - 1, startIndex - 1 + count);

	let representations: ScimGroupRepresentation[] = [];
	for (let group of page) representations.push(await assembleGroupRepresentation(db, group.id));

	return { ok: true, representations, totalResults, startIndex };
}

export interface MapScimGroupInput {
	connectionId: string;
	groupId: string;
	targetKind: string;
	targetId: string;
	at?: number;
}

export type MapScimGroupResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Records what a synced group stands for — a role, or an organization when that
 * add-on is present — as plain data naming the target's kind and id. Neither target
 * table exists in this codebase yet, so this call validates nothing about the target
 * beyond storing what it was told.
 *
 * @param db - The tenant's database.
 * @param input - The connection and group being mapped, and the target it now stands
 * for.
 * @returns Success, or that no such group exists for this connection.
 */
export async function mapScimGroup(
	db: Database,
	input: MapScimGroupInput,
): Promise<MapScimGroupResult> {
	let group = await db.findOne(scimGroups, {
		where: and(eq("id", input.groupId), eq("connection_id", input.connectionId)),
	});
	if (!group) return { ok: false, reason: "not-found" };

	let now = input.at ?? Date.now();

	let existing = await db.find(scimGroupMappings, {
		group_id: input.groupId,
		target_kind: input.targetKind,
		target_id: input.targetId,
	});

	if (!existing) {
		await db.create(scimGroupMappings, {
			group_id: input.groupId,
			connection_id: input.connectionId,
			target_kind: input.targetKind,
			target_id: input.targetId,
			created_at: now,
		});
	}

	await writeAuditEvent(db, {
		action: "scim.group.mapped",
		actor: { type: "client", id: input.connectionId },
		targetType: "scim_group",
		targetId: input.groupId,
		outcome: "succeeded",
		detail: { targetKind: input.targetKind, targetId: input.targetId },
		at: now,
	});

	return { ok: true };
}
