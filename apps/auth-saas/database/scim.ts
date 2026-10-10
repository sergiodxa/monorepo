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

import type { Scim } from "@sdxc/scim";
import type { Discovery } from "@sdxc/scim/discovery";
import type { Filter } from "@sdxc/scim/filter";
import type { Patch } from "@sdxc/scim/patch";
import type { Database, Predicate, TableRow } from "remix/data-table";

import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { isFailure, isSuccess } from "@sdxc/result";
import { GROUP_SCHEMA, parseUser, ScimError } from "@sdxc/scim";
import { filterToWhere } from "@sdxc/scim/data-table";
import { compileFilter } from "@sdxc/scim/filter";
import { applyPatch } from "@sdxc/scim/patch";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";
import * as s from "remix/data-schema";
import { and, column as c, eq, table } from "remix/data-table";

import type { AuditActor } from "./audit-events";
import type {
	ScimGroupRepresentation,
	ScimGroupResource,
	ScimUserRepresentation,
	ScimUserResource,
} from "./scim-resources";
import type { IdentifierKind } from "./subject-identifiers";
import type { AttributeValue, SubjectProfile } from "./subjects";

import { writeAuditEvent } from "./audit-events";
import {
	groupWire,
	SCIM_GROUP_DEFINITIONS,
	SCIM_GROUP_FILTER_PATHS,
	SCIM_USER_DEFINITIONS,
	SCIM_USER_EXTENSIONS,
	SCIM_USER_FILTER_PATHS,
	userWire,
} from "./scim-resources";
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
		attributes: resource.extensions.enterprise ?? {},
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

/**
 * Reads a subject back as the SCIM User it answers as. `userName` is the username
 * identifier when there is one and the primary email otherwise, mirroring how a resource
 * maps in, so a representation replaced unchanged digests the same.
 */
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
		...(externalId ? { externalId } : {}),
		userName: username?.value ?? primaryEmail?.value ?? "",
		active: subject.status === "active",
		emails: primaryEmail ? [{ value: primaryEmail.value, primary: true }] : [],
		name: withoutNull({
			givenName: subject.given_name,
			familyName: subject.family_name,
			formatted: subject.name,
		}),
		...withoutNull({
			displayName: subject.nickname,
			preferredLanguage: subject.locale,
			timezone: subject.zoneinfo,
		}),
		...(subject.picture ? { photos: [{ value: subject.picture, type: "photo" }] } : {}),
		extensions: Object.keys(attributes).length > 0 ? { enterprise: attributes } : {},
		createdAt: subject.created_at,
		updatedAt: subject.updated_at,
	};
}

/** A copy without its `null` members, so a column holding nothing reads as an unassigned attribute. */
function withoutNull<Value extends Record<string, string | null>>(
	value: Value,
): { [Key in keyof Value]?: string } {
	let entries = Object.entries(value).filter(([, item]) => item !== null);
	return Object.fromEntries(entries) as { [Key in keyof Value]?: string };
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

	let link = await db.findOne(scimLinks, {
		where: and(eq("connection_id", resolved.connection.id), eq("subject_id", input.id)),
	});
	if (!link) return { ok: false, reason: "not-found" };

	return {
		ok: true,
		...(await replaceLinkedUser(db, link, input.resource, "scim.user.replaced", now)),
	};
}

/**
 * Writes a whole resource onto a linked subject, skipping every write when its mapped
 * digest matches the link's, and records the change under `action`. A replace and a
 * patch both land here, so both share the digest no-op and the `active` side effects.
 */
async function replaceLinkedUser(
	db: Database,
	link: ScimLinkRow,
	resource: ScimUserResource,
	action: "scim.user.replaced" | "scim.user.patched",
	now: number,
): Promise<{ unchanged: boolean; representation: ScimUserRepresentation }> {
	let mapped = mapUserResource(resource);
	await ensureAttributeDefinitions(db, mapped.attributes);
	let digest = await digestMappedUser(mapped);

	if (link.last_digest === digest) {
		return {
			unchanged: true,
			representation: await assembleUserRepresentation(db, link.subject_id, link.external_id),
		};
	}

	let updated = await updateSubject(db, {
		subjectId: link.subject_id,
		profile: mapped.profile,
		attributes: mapped.attributes,
		actor: { kind: "admin" },
	});
	if (!updated.ok) throw new Error("scim replace could not apply attributes it already validated");

	await syncActiveStateInline(db, link.connection_id, link.subject_id, mapped.active, now);

	await db.update(
		scimLinks,
		{ connection_id: link.connection_id, external_id: link.external_id },
		{ last_digest: digest, updated_at: now },
	);

	await writeAuditEvent(db, {
		action,
		actor: { type: "client", id: link.connection_id },
		targetType: "subject",
		targetId: link.subject_id,
		outcome: "succeeded",
		at: now,
	});

	return {
		unchanged: false,
		representation: await assembleUserRepresentation(db, link.subject_id, link.external_id),
	};
}

export interface ScimPatchUserInput {
	token: string;
	id: string;
	operations: Patch.Operation[];
	at?: number;
}

/** A PATCH the SCIM rules refuse, carrying the RFC 7644 error document's members. */
export interface ScimPatchRefusal {
	ok: false;
	reason: "invalid-patch";
	status: number;
	scimType: Scim.ErrorType | null;
	detail: string;
}

export type ScimPatchUserResult =
	| { ok: true; representation: ScimUserRepresentation }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "not-found" }
	| ScimPatchRefusal;

/**
 * Applies a PATCH as read, apply, replace: the operations run against the user's current
 * wire representation, and the result is written the way a PUT writes it. Every operation
 * applies or none does; `active: false` blocks the subject and revokes every session.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, the subject id, the parsed operations, and the clock
 * to write with.
 * @returns The updated representation, or which rule refused the call.
 */
export async function scimPatchUser(
	db: Database,
	input: ScimPatchUserInput,
): Promise<ScimPatchUserResult> {
	let now = input.at ?? Date.now();
	let resolved = await resolveScimToken(db, input.token, now);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };

	let link = await db.findOne(scimLinks, {
		where: and(eq("connection_id", resolved.connection.id), eq("subject_id", input.id)),
	});
	if (!link) return { ok: false, reason: "not-found" };

	let current = await assembleUserRepresentation(db, link.subject_id, link.external_id);
	let patched = applyPatch(userWire(current), input.operations, {
		definitions: SCIM_USER_DEFINITIONS,
	});
	if (isFailure(patched)) return patchRefusal(patched.error);

	let next = parseUser(patched.data, { extensions: SCIM_USER_EXTENSIONS });
	if (isFailure(next)) return patchRefusal(next.error);

	let replaced = await replaceLinkedUser(db, link, next.data, "scim.user.patched", now);
	return { ok: true, representation: replaced.representation };
}

/** The refusal an RPC answer carries for a `ScimError`, as plain data that crosses the boundary. */
function patchRefusal(error: ScimError): ScimPatchRefusal {
	return {
		ok: false,
		reason: "invalid-patch",
		status: error.status,
		scimType: error.scimType,
		detail: error.message,
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

export interface ScimReadUserPageInput {
	token: string;
	query: Scim.ListQuery;
}

/** A list filter this connection does not serve, with the reason for the error document. */
export interface ScimFilterRefusal {
	ok: false;
	reason: "unsupported-filter";
	detail: string;
}

export type ScimReadUserPageResult =
	| {
			ok: true;
			representations: ScimUserRepresentation[];
			totalResults: number;
			startIndex: number;
	  }
	| { ok: false; reason: "invalid-token" }
	| ScimFilterRefusal;

/**
 * A page of this connection's users, ordered by creation, with `totalResults` exact —
 * a directory is bounded by its plan's subject cap, so counting it exactly costs
 * nothing a cursor would have saved. A representation spans several tables, so the
 * filter runs over the assembled resources, restricted to `SCIM_USER_FILTER_PATHS`.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token and the parsed list query.
 * @returns The page and its exact total, or which rule refused the call.
 */
export async function scimReadUserPage(
	db: Database,
	input: ScimReadUserPageInput,
): Promise<ScimReadUserPageResult> {
	let resolved = await resolveScimToken(db, input.token);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };

	let matches = compileListFilter(
		input.query.filter,
		SCIM_USER_DEFINITIONS,
		SCIM_USER_FILTER_PATHS,
	);
	if (matches instanceof ScimError) return filterRefusal(matches);

	let links = await db.findMany(scimLinks, {
		where: eq("connection_id", resolved.connection.id),
		orderBy: ["created_at", "asc"],
	});

	let representations: ScimUserRepresentation[] = [];
	for (let link of links) {
		let representation = await assembleUserRepresentation(db, link.subject_id, link.external_id);
		if (matches && !matches(userWire(representation))) continue;
		representations.push(representation);
	}

	let offset = input.query.startIndex - 1;
	return {
		ok: true,
		representations: representations.slice(offset, offset + input.query.count),
		totalResults: representations.length,
		startIndex: input.query.startIndex,
	};
}

/**
 * Compiles a list filter against the served definitions, allowing only `paths`: the
 * grammar is complete, and the allowlist is what keeps a list to the attributes it serves.
 *
 * @returns The predicate, `null` for no filter, or why the filter is refused
 */
function compileListFilter(
	filter: Filter.Expression | null,
	definitions: Discovery.Definitions,
	paths: string[],
): ((resource: object) => boolean) | null | ScimError {
	if (!filter) return null;
	let compiled = compileFilter(filter, { definitions, allow: paths });
	return isFailure(compiled) ? compiled.error : compiled.data;
}

/** The refusal an RPC answer carries for a filter this connection does not serve. */
function filterRefusal(error: ScimError): ScimFilterRefusal {
	return { ok: false, reason: "unsupported-filter", detail: error.message };
}

/** Reads a synced group back as the SCIM Group it answers as, its whole membership included. */
async function assembleGroupRepresentation(
	db: Database,
	groupId: string,
): Promise<ScimGroupRepresentation> {
	let group = await db.find(scimGroups, { id: groupId });
	if (!group) throw new Error("group row missing while assembling its SCIM representation");

	let memberRows = await db.findMany(scimGroupMembers, { where: { group_id: groupId } });

	return toGroupRepresentation(
		group,
		memberRows.map((row) => row.subject_id),
	);
}

/** A group row and its member ids as the representation a provisioning call answers. */
function toGroupRepresentation(group: ScimGroupRow, memberIds: string[]): ScimGroupRepresentation {
	return {
		id: group.id,
		...(group.external_id ? { externalId: group.external_id } : {}),
		displayName: group.display_name,
		members: memberIds.map((value) => ({ value })),
		createdAt: group.created_at,
		updatedAt: group.updated_at,
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

/** One membership or name change a group PATCH operation stands for, in the order sent. */
type GroupChange =
	| { kind: "displayName"; value: string }
	| { kind: "addMembers"; subjectIds: string[] }
	| { kind: "replaceMembers"; subjectIds: string[] }
	| { kind: "removeMembers"; subjectIds: string[] }
	| { kind: "removeMatching"; matches: (resource: object) => boolean };

export interface ScimPatchGroupInput {
	token: string;
	id: string;
	operations: Patch.Operation[];
	at?: number;
}

export type ScimPatchGroupResult =
	| { ok: true; representation: ScimGroupRepresentation }
	| { ok: false; reason: "invalid-token" }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unsupported-operation"; index: number }
	| { ok: false; reason: "unknown-member"; subjectId: string };

/**
 * Reads `[{ value }, …]` as subject ids.
 *
 * @returns The ids, or `null` when any entry names no string `value`
 */
function readMemberIds(value: unknown): string[] | null {
	if (!Array.isArray(value)) return null;
	let ids: string[] = [];
	for (let entry of value) {
		if (typeof entry !== "object" || entry === null) return null;
		let id = (entry as { value?: unknown }).value;
		if (typeof id !== "string") return null;
		ids.push(id);
	}
	return ids;
}

/**
 * The changes a path-less `add` or `replace` stands for: its `displayName` and `members`
 * keys, matched in any case; any other key is unsupported.
 *
 * @returns The changes, or `null` when the value names anything else
 */
function translatePathlessGroupValue(op: "add" | "replace", value: unknown): GroupChange[] | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	let changes: GroupChange[] = [];
	for (let [key, item] of Object.entries(value)) {
		let name = key.toLowerCase();
		if (name === "displayname" && typeof item === "string") {
			changes.push({ kind: "displayName", value: item });
			continue;
		}
		let subjectIds = name === "members" ? readMemberIds(item) : null;
		if (!subjectIds) return null;
		changes.push({ kind: op === "add" ? "addMembers" : "replaceMembers", subjectIds });
	}
	return changes;
}

/**
 * Interprets one PATCH operation as group changes: `displayName` set, and `members`
 * added, replaced, removed by value list, removed wholesale, or removed through a value
 * filter (`members[value eq "…"]`). A group holds thousands of members, so each change
 * touches only the rows it names.
 *
 * @returns The changes, or `null` when the operation targets anything else
 */
function translateGroupOperation(operation: Patch.Operation): GroupChange[] | null {
	let { op, path, value } = operation;
	if (path === null) return op === "remove" ? null : translatePathlessGroupValue(op, value);

	let attribute = path.attribute.attribute.toLowerCase();
	let schema = path.attribute.schema;
	if (schema !== null && schema.toLowerCase() !== GROUP_SCHEMA.toLowerCase()) return null;
	if (path.attribute.subAttribute !== null || path.subAttribute !== null) return null;

	if (attribute === "displayname") {
		if (op === "remove" || path.filter || typeof value !== "string") return null;
		return [{ kind: "displayName", value }];
	}

	if (attribute !== "members") return null;

	if (path.filter) {
		if (op !== "remove") return null;
		let compiled = compileFilter(
			{ kind: "valuePath", path: path.attribute, filter: path.filter },
			{ definitions: SCIM_GROUP_DEFINITIONS },
		);
		return isFailure(compiled) ? null : [{ kind: "removeMatching", matches: compiled.data }];
	}

	if (op === "remove" && value === undefined) return [{ kind: "replaceMembers", subjectIds: [] }];

	let subjectIds = readMemberIds(value);
	if (!subjectIds) return null;
	if (op === "add") return [{ kind: "addMembers", subjectIds }];
	if (op === "replace") return [{ kind: "replaceMembers", subjectIds }];
	return [{ kind: "removeMembers", subjectIds }];
}

/**
 * Applies group PATCH operations one by one, each touching only the membership rows it
 * names. Every operation is interpreted, and every added member checked, before any is
 * applied, so a request mixing one unsupported form with valid ones writes nothing.
 *
 * @param db - The tenant's database.
 * @param input - The bearer token, the group id, the parsed operations, and the clock to
 * write with.
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

	let changes: GroupChange[] = [];
	for (let [index, operation] of input.operations.entries()) {
		let translated = translateGroupOperation(operation);
		if (!translated) return { ok: false, reason: "unsupported-operation", index };
		changes.push(...translated);
	}

	for (let change of changes) {
		if (change.kind !== "addMembers" && change.kind !== "replaceMembers") continue;
		for (let subjectId of change.subjectIds) {
			let subject = await db.find(subjects, { id: subjectId });
			if (!subject) return { ok: false, reason: "unknown-member", subjectId };
		}
	}

	let displayName = group.display_name;
	for (let change of changes) {
		switch (change.kind) {
			case "displayName":
				displayName = change.value;
				break;
			case "replaceMembers":
				await db.deleteMany(scimGroupMembers, { where: { group_id: group.id } });
				await addGroupMembers(db, group.id, change.subjectIds, now);
				break;
			case "addMembers":
				await addGroupMembers(db, group.id, change.subjectIds, now);
				break;
			case "removeMembers":
				for (let subjectId of change.subjectIds) {
					await db.delete(scimGroupMembers, { group_id: group.id, subject_id: subjectId });
				}
				break;
			case "removeMatching": {
				let rows = await db.findMany(scimGroupMembers, { where: { group_id: group.id } });
				for (let row of rows) {
					let member = { schemas: [GROUP_SCHEMA], members: [{ value: row.subject_id }] };
					if (!change.matches(member)) continue;
					await db.delete(scimGroupMembers, { group_id: group.id, subject_id: row.subject_id });
				}
				break;
			}
		}
	}

	await db.update(scimGroups, { id: group.id }, { display_name: displayName, updated_at: now });

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

/** Adds each subject to a group, leaving a membership that already exists as it is. */
async function addGroupMembers(
	db: Database,
	groupId: string,
	subjectIds: string[],
	now: number,
): Promise<void> {
	for (let subjectId of subjectIds) {
		let existing = await db.find(scimGroupMembers, { group_id: groupId, subject_id: subjectId });
		if (!existing) {
			await db.create(scimGroupMembers, {
				group_id: groupId,
				subject_id: subjectId,
				created_at: now,
			});
		}
	}
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

export interface ScimReadGroupPageInput {
	token: string;
	query: Scim.ListQuery;
}

export type ScimReadGroupPageResult =
	| {
			ok: true;
			representations: ScimGroupRepresentation[];
			totalResults: number;
			startIndex: number;
	  }
	| { ok: false; reason: "invalid-token" }
	| ScimFilterRefusal;

/**
 * A page of this connection's groups, ordered by creation, with `totalResults` exact.
 * Groups live in one table, so the filter runs in SQL where it translates, and over the
 * loaded rows where it does not (a value containing a `LIKE` wildcard, say).
 *
 * @param db - The tenant's database.
 * @param input - The bearer token and the parsed list query.
 * @returns The page and its exact total, or which rule refused the call.
 */
export async function scimReadGroupPage(
	db: Database,
	input: ScimReadGroupPageInput,
): Promise<ScimReadGroupPageResult> {
	let resolved = await resolveScimToken(db, input.token);
	if (!resolved.ok) return { ok: false, reason: "invalid-token" };
	let scope = eq("connection_id", resolved.connection.id);
	let { filter, startIndex, count } = input.query;

	let matches = compileListFilter(filter, SCIM_GROUP_DEFINITIONS, SCIM_GROUP_FILTER_PATHS);
	if (matches instanceof ScimError) return filterRefusal(matches);

	let where = filter
		? filterToWhere(filter, {
				displayName: { column: "display_name", caseExact: false },
				externalId: "external_id",
			})
		: null;

	if (matches && (!where || !isSuccess(where))) {
		let rows = await db.findMany(scimGroups, { where: scope, orderBy: ["created_at", "asc"] });
		let found = rows.filter((row) => matches(groupWire(toGroupRepresentation(row, []))));
		let page = found.slice(startIndex - 1, startIndex - 1 + count);
		return {
			ok: true,
			representations: await Promise.all(
				page.map((row) => assembleGroupRepresentation(db, row.id)),
			),
			totalResults: found.length,
			startIndex,
		};
	}

	let scoped =
		where && isSuccess(where)
			? and(scope, where.data as Predicate<"display_name" | "external_id">)
			: scope;
	let totalResults = await db.count(scimGroups, { where: scoped });
	let rows =
		count === 0
			? []
			: await db.findMany(scimGroups, {
					where: scoped,
					orderBy: ["created_at", "asc"],
					limit: count,
					offset: startIndex - 1,
				});

	let representations: ScimGroupRepresentation[] = [];
	for (let row of rows) representations.push(await assembleGroupRepresentation(db, row.id));

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
