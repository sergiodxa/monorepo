/**
 * Subjects, their identifiers and their declared attributes: the tables a tenant's
 * every other feature hangs off, and the operations over them. Kept as a module the
 * tenant object delegates to rather than written inline, so the object's own file stays
 * about wiring a request to a method rather than about what a method does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { and, column as c, eq, isNull, lt, ne, notNull, or, table } from "remix/data-table";

import type { IdentifierKind } from "./subject-identifiers";

import { checkAndSpendMailEnvelope } from "./mail-rate-limit";
import { revokeSubjectSessions, sessions } from "./sessions";
import { foldIdentifier } from "./subject-identifiers";

export type { IdentifierKind } from "./subject-identifiers";

/** How long a newly minted verification ticket signs for an address before it expires. */
const TICKET_TTL_MS = 24 * 60 * 60 * 1000;

/** How long an unverified identifier holds its address before the sweep releases it. */
const RETENTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Mints a `sub_` id for a new subject: 128 bits of randomness, Base32-encoded. */
const subjectId = typeid("sub");

/** Mints an id for a `subject_identifiers` row, which needs one of its own. */
const identifierRowId = typeid("sid");

/** The principal every credential, session and audit row hangs off. */
export const subjects = table({
	name: "subjects",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		status: c.enum(["active", "blocked"] as const).default("active"),
		name: c.text().nullable(),
		given_name: c.text().nullable(),
		family_name: c.text().nullable(),
		nickname: c.text().nullable(),
		preferred_username: c.text().nullable(),
		picture: c.text().nullable(),
		locale: c.text().nullable(),
		zoneinfo: c.text().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** One address or handle a subject has claimed, verified or not. */
export const subjectIdentifiers = table({
	name: "subject_identifiers",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		subject_id: c.text(),
		kind: c.enum(["email", "username"] as const),
		value: c.text(),
		folded: c.text(),
		verified_at: c.integer().nullable(),
		is_primary: c.boolean().default(false),
		verification_ticket: c.text().nullable(),
		verification_ticket_expires_at: c.integer().nullable(),
		created_at: c.integer(),
	},
});

/** A subject's value for a tenant-declared attribute key. */
export const subjectAttributes = table({
	name: "subject_attributes",
	primaryKey: ["subject_id", "key"],
	columns: {
		subject_id: c.text(),
		key: c.text(),
		value: c.json(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** What a custom attribute key is allowed to hold and who may read or write it. */
export const attributeDefinitions = table({
	name: "attribute_definitions",
	primaryKey: ["key"],
	columns: {
		key: c.text(),
		type: c.text(),
		visibility: c.enum(["internal", "claim", "self"] as const),
		created_at: c.integer(),
	},
});

export type SubjectRow = TableRow<typeof subjects>;
export type SubjectIdentifierRow = TableRow<typeof subjectIdentifiers>;

/** Whether an attribute reaches only the tenant, the subject's own read, or a token. */
export type AttributeVisibility = "internal" | "claim" | "self";

/** A declared attribute's value, kept to a flat, wire-serializable shape. */
export type AttributeValue = string | number | boolean | null;

/**
 * Who is asking. `subject` is the account acting on itself through a self-service
 * screen; `admin` is a tenant-privileged actor such as the dashboard. Kept to these two
 * because nothing here needs a finer distinction yet — a later caller with one adds a
 * member to this union rather than replacing it.
 */
export type Actor = { kind: "subject" } | { kind: "admin" };

/** The standard OIDC profile claims a subject carries, in the API's own casing. */
export interface SubjectProfile {
	name?: string | null;
	givenName?: string | null;
	familyName?: string | null;
	nickname?: string | null;
	preferredUsername?: string | null;
	picture?: string | null;
	locale?: string | null;
	zoneinfo?: string | null;
}

/** One identifier as an account screen or a token would read it. */
export interface IdentifierState {
	kind: IdentifierKind;
	value: string;
	verified: boolean;
	verifiedAt: number | null;
	isPrimary: boolean;
}

export interface CreateSubjectInput {
	identifiers?: { kind: IdentifierKind; value: string }[];
	profile?: SubjectProfile;
	attributes?: Record<string, unknown>;
}

export type CreateSubjectResult =
	| { ok: true; subjectId: string; identifiers: IdentifierState[] }
	| { ok: false; reason: "invalid-identifier"; kind: IdentifierKind; value: string }
	| { ok: false; reason: "identifier-taken"; kind: IdentifierKind; value: string }
	| { ok: false; reason: "duplicate-username" }
	| { ok: false; reason: "unknown-attribute"; key: string };

/**
 * Validates and folds every identifier, claims their uniqueness, and creates the
 * subject with them attached unverified. Minting a verification ticket is
 * {@link addIdentifier}'s job, so an email claimed here waits for its own call before it
 * can sign anyone in.
 *
 * @param db - The tenant's database.
 * @param input - The identifiers to claim, the standard profile claims, and any declared
 * attributes to set.
 * @returns The new subject's id and each identifier's starting state, or which
 * identifier or attribute key the call was refused for.
 */
export async function createSubject(
	db: Database,
	input: CreateSubjectInput,
): Promise<CreateSubjectResult> {
	let identifiers = input.identifiers ?? [];

	if (identifiers.filter((identifier) => identifier.kind === "username").length > 1) {
		return { ok: false, reason: "duplicate-username" };
	}

	let folded: { kind: IdentifierKind; value: string; folded: string }[] = [];

	for (let identifier of identifiers) {
		let result = foldIdentifier(identifier.kind, identifier.value);

		if (!result.ok) {
			return {
				ok: false,
				reason: "invalid-identifier",
				kind: identifier.kind,
				value: identifier.value,
			};
		}

		folded.push({ kind: identifier.kind, value: identifier.value, folded: result.folded });
	}

	let claimed = new Set<string>();

	for (let entry of folded) {
		let key = `${entry.kind}:${entry.folded}`;
		if (claimed.has(key))
			return { ok: false, reason: "identifier-taken", kind: entry.kind, value: entry.value };
		claimed.add(key);

		let existing = await db.findOne(subjectIdentifiers, {
			where: and(eq("kind", entry.kind), eq("folded", entry.folded)),
		});

		if (existing)
			return { ok: false, reason: "identifier-taken", kind: entry.kind, value: entry.value };
	}

	let attributes = input.attributes ?? {};

	for (let key of Object.keys(attributes)) {
		let definition = await db.find(attributeDefinitions, { key });
		if (!definition) return { ok: false, reason: "unknown-attribute", key };
	}

	let now = Date.now();
	let id = subjectId(generateUUID()).toString();

	await db.create(subjects, {
		id,
		status: "active",
		...profileColumns(input.profile),
		created_at: now,
		updated_at: now,
	});

	let states: IdentifierState[] = [];

	for (let entry of folded) {
		await db.create(subjectIdentifiers, {
			id: identifierRowId(generateUUID()).toString(),
			subject_id: id,
			kind: entry.kind,
			value: entry.value,
			folded: entry.folded,
			verified_at: null,
			is_primary: false,
			verification_ticket: null,
			verification_ticket_expires_at: null,
			created_at: now,
		});

		states.push({
			kind: entry.kind,
			value: entry.value,
			verified: false,
			verifiedAt: null,
			isPrimary: false,
		});
	}

	for (let [key, value] of Object.entries(attributes)) {
		await db.create(subjectAttributes, {
			subject_id: id,
			key,
			value,
			created_at: now,
			updated_at: now,
		});
	}

	return { ok: true, subjectId: id, identifiers: states };
}

export interface UpdateSubjectInput {
	subjectId: string;
	profile?: SubjectProfile;
	attributes?: Record<string, unknown>;
	actor: Actor;
}

export type UpdateSubjectResult =
	| { ok: true }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unknown-attribute"; key: string }
	| { ok: false; reason: "attribute-not-writable"; key: string };

/**
 * Writes the given profile columns, and only the given attributes whose visibility this
 * actor may set, in one operation.
 *
 * @param db - The tenant's database.
 * @param input - The subject to update, the profile columns and attributes to change,
 * and who is asking.
 * @returns Success, or which attribute key the actor may not write, or that no such
 * subject exists.
 */
export async function updateSubject(
	db: Database,
	input: UpdateSubjectInput,
): Promise<UpdateSubjectResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	let attributes = input.attributes ?? {};

	for (let key of Object.keys(attributes)) {
		let definition = await db.find(attributeDefinitions, { key });
		if (!definition) return { ok: false, reason: "unknown-attribute", key };
		if (!canActorWrite(input.actor, definition.visibility)) {
			return { ok: false, reason: "attribute-not-writable", key };
		}
	}

	let now = Date.now();

	await db.update(
		subjects,
		{ id: input.subjectId },
		{ ...(input.profile ? profileChanges(input.profile) : {}), updated_at: now },
	);

	for (let [key, value] of Object.entries(attributes)) {
		let existing = await db.find(subjectAttributes, { subject_id: input.subjectId, key });

		if (existing) {
			await db.update(
				subjectAttributes,
				{ subject_id: input.subjectId, key },
				{ value, updated_at: now },
			);
		} else {
			await db.create(subjectAttributes, {
				subject_id: input.subjectId,
				key,
				value,
				created_at: now,
				updated_at: now,
			});
		}
	}

	return { ok: true };
}

/** `self` is the only visibility a subject may write to; an admin actor may write any. */
function canActorWrite(actor: Actor, visibility: AttributeVisibility): boolean {
	return actor.kind === "admin" || visibility === "self";
}

export interface AddIdentifierInput {
	subjectId: string;
	kind: IdentifierKind;
	value: string;
	actor: Actor;
}

export type AddIdentifierResult =
	| {
			ok: true;
			identifierId: string;
			kind: "email";
			value: string;
			ticket: string;
			ticketExpiresAt: number;
	  }
	| { ok: true; identifierId: string; kind: "username"; value: string }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "invalid-identifier" }
	| { ok: false; reason: "identifier-taken" }
	| { ok: false; reason: "username-already-set" }
	| { ok: false; reason: "rate-limited"; retryAfterSeconds: number };

/**
 * Folds and claims a new identifier for an existing subject. An email is written
 * unverified with a fresh single-use ticket for the caller to deliver; a username has no
 * proof to carry and is usable immediately. Calling again for the same subject's own
 * unverified row replaces its outstanding ticket, which is how a resend works.
 *
 * @param db - The tenant's database.
 * @param input - The subject to attach the identifier to, its kind and value, and who is
 * asking.
 * @returns The identifier's starting state — with a ticket to deliver for an email — or
 * which rule the call was refused for.
 */
export async function addIdentifier(
	db: Database,
	input: AddIdentifierInput,
): Promise<AddIdentifierResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	let folded = foldIdentifier(input.kind, input.value);
	if (!folded.ok) return { ok: false, reason: "invalid-identifier" };

	let existing = await db.findOne(subjectIdentifiers, {
		where: and(eq("kind", input.kind), eq("folded", folded.folded)),
	});

	if (existing) {
		if (existing.subject_id !== input.subjectId || existing.verified_at !== null) {
			return { ok: false, reason: "identifier-taken" };
		}

		return resendOrReturn(db, existing);
	}

	if (input.kind === "username") {
		let currentUsername = await db.findOne(subjectIdentifiers, {
			where: and(eq("subject_id", input.subjectId), eq("kind", "username")),
		});

		if (currentUsername) return { ok: false, reason: "username-already-set" };
	}

	let now = Date.now();
	let id = identifierRowId(generateUUID()).toString();

	if (input.kind === "email") {
		let envelope = await checkAndSpendMailEnvelope(db, { address: folded.folded });
		if (!envelope.ok) {
			return { ok: false, reason: "rate-limited", retryAfterSeconds: envelope.retryAfterSeconds };
		}

		let ticket = generateUUID();
		let ticketExpiresAt = now + TICKET_TTL_MS;

		await db.create(subjectIdentifiers, {
			id,
			subject_id: input.subjectId,
			kind: "email",
			value: input.value,
			folded: folded.folded,
			verified_at: null,
			is_primary: false,
			verification_ticket: ticket,
			verification_ticket_expires_at: ticketExpiresAt,
			created_at: now,
		});

		return {
			ok: true,
			identifierId: id,
			kind: "email",
			value: input.value,
			ticket,
			ticketExpiresAt,
		};
	}

	await db.create(subjectIdentifiers, {
		id,
		subject_id: input.subjectId,
		kind: "username",
		value: input.value,
		folded: folded.folded,
		verified_at: null,
		is_primary: false,
		verification_ticket: null,
		verification_ticket_expires_at: null,
		created_at: now,
	});

	return { ok: true, identifierId: id, kind: "username", value: input.value };
}

/** A second `addIdentifier` for the same unverified row: mint a fresh ticket, or none. */
async function resendOrReturn(
	db: Database,
	existing: SubjectIdentifierRow,
): Promise<AddIdentifierResult> {
	if (existing.kind === "username") {
		return { ok: true, identifierId: existing.id, kind: "username", value: existing.value };
	}

	let envelope = await checkAndSpendMailEnvelope(db, { address: existing.folded });
	if (!envelope.ok) {
		return { ok: false, reason: "rate-limited", retryAfterSeconds: envelope.retryAfterSeconds };
	}

	let ticket = generateUUID();
	let ticketExpiresAt = Date.now() + TICKET_TTL_MS;

	await db.update(
		subjectIdentifiers,
		{ id: existing.id },
		{ verification_ticket: ticket, verification_ticket_expires_at: ticketExpiresAt },
	);

	return {
		ok: true,
		identifierId: existing.id,
		kind: "email",
		value: existing.value,
		ticket,
		ticketExpiresAt,
	};
}

export type VerifyIdentifierResult =
	| { ok: true; subjectId: string; promotedPrimary: boolean }
	| { ok: false; reason: "invalid-ticket" }
	| { ok: false; reason: "expired-ticket" };

/**
 * Spends a verification ticket: stamps the row verified, clears the ticket, and
 * promotes the address to primary when the subject holds none of that kind yet.
 *
 * @param db - The tenant's database.
 * @param input - The ticket as it was delivered to the address.
 * @returns The subject the address belongs to and whether it became primary, or why the
 * ticket does not work.
 */
export async function verifyIdentifier(
	db: Database,
	input: { ticket: string },
): Promise<VerifyIdentifierResult> {
	let row = await db.findOne(subjectIdentifiers, { where: { verification_ticket: input.ticket } });
	if (!row) return { ok: false, reason: "invalid-ticket" };

	let now = Date.now();

	if (row.verification_ticket_expires_at === null || row.verification_ticket_expires_at <= now) {
		return { ok: false, reason: "expired-ticket" };
	}

	let existingPrimary = await db.findOne(subjectIdentifiers, {
		where: and(eq("subject_id", row.subject_id), eq("kind", row.kind), eq("is_primary", true)),
	});

	let promote = existingPrimary === null;

	await db.update(
		subjectIdentifiers,
		{ id: row.id },
		{
			verified_at: now,
			verification_ticket: null,
			verification_ticket_expires_at: null,
			is_primary: promote,
		},
	);

	return { ok: true, subjectId: row.subject_id, promotedPrimary: promote };
}

export interface SetPrimaryIdentifierInput {
	subjectId: string;
	value: string;
	actor: Actor;
}

export type SetPrimaryIdentifierResult =
	| { ok: true }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unverified" };

/**
 * Moves `is_primary` to the named identifier, refusing one that has not proven itself
 * yet — primary is what the `email` claim and every account notice read, so it can never
 * point at an address nobody has shown control of.
 *
 * @param db - The tenant's database.
 * @param input - The subject, the identifier's value as entered, and who is asking.
 * @returns Success, or that the identifier was not found or is not verified.
 */
export async function setPrimaryIdentifier(
	db: Database,
	input: SetPrimaryIdentifierInput,
): Promise<SetPrimaryIdentifierResult> {
	let row = await db.findOne(subjectIdentifiers, {
		where: { subject_id: input.subjectId, value: input.value },
	});

	if (!row) return { ok: false, reason: "not-found" };
	if (row.verified_at === null) return { ok: false, reason: "unverified" };

	await db.updateMany(
		subjectIdentifiers,
		{ is_primary: false },
		{ where: and(eq("subject_id", input.subjectId), eq("kind", row.kind), eq("is_primary", true)) },
	);

	await db.update(subjectIdentifiers, { id: row.id }, { is_primary: true });

	return { ok: true };
}

export interface RemoveIdentifierInput {
	subjectId: string;
	value: string;
	actor: Actor;
}

export type RemoveIdentifierResult =
	| { ok: true; promotedPrimary: string | null; notify: string[] }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "last-verified-identifier" };

/**
 * Removes an identifier, refusing to take a subject's last verified email address
 * when it is also their last remaining credential of any kind. Removing the primary
 * promotes the oldest remaining verified email in the same operation, and every
 * verified address left is reported so the caller can announce the change to each one.
 *
 * @param db - The tenant's database.
 * @param input - The subject, the identifier's value as entered, and who is asking.
 * @param hasOtherCredential - Whether the subject holds a credential besides this
 * identifier — a password, a passkey, or another verified identifier. Computed here
 * from identifiers alone when omitted, which is what this module can see on its own;
 * a caller that also knows about passwords and passkeys passes the fuller answer.
 * @returns The address promoted to primary (or none) and who to notify, or why the
 * removal was refused.
 */
export async function removeIdentifier(
	db: Database,
	input: RemoveIdentifierInput,
	hasOtherCredential?: boolean,
): Promise<RemoveIdentifierResult> {
	let row = await db.findOne(subjectIdentifiers, {
		where: { subject_id: input.subjectId, value: input.value },
	});

	if (!row) return { ok: false, reason: "not-found" };

	if (row.kind === "email" && row.verified_at !== null) {
		let remaining =
			hasOtherCredential ??
			(await hasRemainingVerifiedIdentifierAfter(db, input.subjectId, row.id));
		if (!remaining) return { ok: false, reason: "last-verified-identifier" };
	}

	await db.delete(subjectIdentifiers, { id: row.id });

	let promotedPrimary: string | null = null;

	if (row.is_primary && row.kind === "email") {
		let [next] = await db.findMany(subjectIdentifiers, {
			where: and(eq("subject_id", input.subjectId), eq("kind", "email"), notNull("verified_at")),
			orderBy: ["created_at", "asc"],
			limit: 1,
		});

		if (next) {
			await db.update(subjectIdentifiers, { id: next.id }, { is_primary: true });
			promotedPrimary = next.value;
		}
	}

	let verifiedEmails = await db.findMany(subjectIdentifiers, {
		where: and(eq("subject_id", input.subjectId), eq("kind", "email"), notNull("verified_at")),
	});

	return { ok: true, promotedPrimary, notify: verifiedEmails.map((email) => email.value) };
}

/**
 * Whether a subject keeps at least one other verified email address after one more is
 * taken away, counting identifiers alone. The fallback this module runs on its own
 * when a caller has not computed the fuller cross-credential answer.
 */
async function hasRemainingVerifiedIdentifierAfter(
	db: Database,
	subjectId: string,
	excludingId: string,
): Promise<boolean> {
	let count = await db.count(subjectIdentifiers, {
		where: and(
			eq("subject_id", subjectId),
			eq("kind", "email"),
			notNull("verified_at"),
			ne("id", excludingId),
		),
	});

	return count > 0;
}

export type BlockSubjectResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Flips a subject to `blocked` and revokes every session it holds, so a block takes
 * effect immediately rather than waiting for a session's own expiry.
 *
 * @param db - The tenant's database.
 * @param input - The subject to block and the reason recorded for the call.
 * @returns Success, or that no such subject exists.
 */
export async function blockSubject(
	db: Database,
	input: { subjectId: string; reason: string },
): Promise<BlockSubjectResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	await db.update(subjects, { id: input.subjectId }, { status: "blocked", updated_at: Date.now() });
	await revokeSubjectSessions(db, { subjectId: input.subjectId, reason: input.reason });

	return { ok: true };
}

export type UnblockSubjectResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Flips a subject back to `active`.
 *
 * @param db - The tenant's database.
 * @param input - The subject to unblock.
 * @returns Success, or that no such subject exists.
 */
export async function unblockSubject(
	db: Database,
	input: { subjectId: string },
): Promise<UnblockSubjectResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	await db.update(subjects, { id: input.subjectId }, { status: "active", updated_at: Date.now() });

	return { ok: true };
}

export type DeleteSubjectResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Removes a subject, its identifiers, its attributes and its sessions, and retires the
 * id for good — a relying party's foreign key never gets handed to someone else.
 *
 * Its passwords and passkeys leave with it too, deleted by the caller alongside this
 * call: they live in tables of their own that importing here would cycle back to this
 * one, since both already import from it.
 *
 * @param db - The tenant's database.
 * @param input - The subject to delete.
 * @returns Success, or that no such subject exists.
 */
export async function deleteSubject(
	db: Database,
	input: { subjectId: string },
): Promise<DeleteSubjectResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	await db.deleteMany(sessions, { where: { subject_id: input.subjectId } });
	await db.deleteMany(subjectAttributes, { where: { subject_id: input.subjectId } });
	await db.deleteMany(subjectIdentifiers, { where: { subject_id: input.subjectId } });
	await db.delete(subjects, { id: input.subjectId });

	return { ok: true };
}

export interface DefineAttributeInput {
	key: string;
	type: string;
	visibility: AttributeVisibility;
}

/**
 * Declares or redeclares a custom attribute key: its type and who may read or write it.
 *
 * @param db - The tenant's database.
 * @param input - The key, its type, and its visibility.
 * @returns Success; defining an existing key updates its type and visibility in place.
 */
export async function defineAttribute(
	db: Database,
	input: DefineAttributeInput,
): Promise<{ ok: true }> {
	let existing = await db.find(attributeDefinitions, { key: input.key });

	if (existing) {
		await db.update(
			attributeDefinitions,
			{ key: input.key },
			{ type: input.type, visibility: input.visibility },
		);
	} else {
		await db.create(attributeDefinitions, {
			key: input.key,
			type: input.type,
			visibility: input.visibility,
			created_at: Date.now(),
		});
	}

	return { ok: true };
}

export type RemoveAttributeResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Removes an attribute's definition. A subject's stored values for the key are left in
 * place rather than deleted with it: the key was refused only where writing or reading
 * it requires a definition, so a tenant that redeclares the key later gets its
 * subjects' values back rather than a silently emptied column.
 *
 * @param db - The tenant's database.
 * @param input - The key to remove.
 * @returns Success, or that no such key was defined.
 */
export async function removeAttribute(
	db: Database,
	input: { key: string },
): Promise<RemoveAttributeResult> {
	let deleted = await db.delete(attributeDefinitions, { key: input.key });
	if (!deleted) return { ok: false, reason: "not-found" };

	return { ok: true };
}

export interface DescribeSubjectInput {
	subjectId: string;
	audience: Actor;
}

export type DescribeSubjectResult =
	| {
			ok: true;
			profile: SubjectProfile & { id: string; status: SubjectRow["status"] };
			identifiers: IdentifierState[];
			attributes: Record<string, AttributeValue>;
			credentials: never[];
	  }
	| { ok: false; reason: "not-found" };

/**
 * Assembles everything one account screen renders: profile, every identifier with its
 * state and which is primary, the attributes this audience may see, and which
 * credentials exist.
 *
 * The credential list is empty for every subject today; it starts listing passwords and
 * passkeys once those tables exist to describe.
 *
 * @param db - The tenant's database.
 * @param input - The subject to describe and who is looking.
 * @returns The assembled view, or that no such subject exists.
 */
export async function describeSubject(
	db: Database,
	input: DescribeSubjectInput,
): Promise<DescribeSubjectResult> {
	let subject = await db.find(subjects, { id: input.subjectId });
	if (!subject) return { ok: false, reason: "not-found" };

	let identifierRows = await db.findMany(subjectIdentifiers, {
		where: { subject_id: input.subjectId },
	});

	let attributeRows = await db.findMany(subjectAttributes, {
		where: { subject_id: input.subjectId },
	});

	let attributes: Record<string, AttributeValue> = {};

	for (let row of attributeRows) {
		let definition = await db.find(attributeDefinitions, { key: row.key });
		if (!definition) continue;
		if (definition.visibility === "internal" && input.audience.kind !== "admin") continue;
		attributes[row.key] = row.value as AttributeValue;
	}

	return {
		ok: true,
		profile: { id: subject.id, status: subject.status, ...profileOf(subject) },
		identifiers: identifierRows.map((row) => ({
			kind: row.kind,
			value: row.value,
			verified: row.verified_at !== null,
			verifiedAt: row.verified_at,
			isPrimary: row.is_primary,
		})),
		attributes,
		credentials: [],
	};
}

/**
 * Sweeps unverified identifiers whose ticket is gone or expired and whose row has sat
 * unproven for the retention window, releasing the folded values they were holding
 * against everyone else.
 *
 * @param db - The tenant's database.
 * @param now - The clock reading the sweep runs against.
 * @returns How many rows were released.
 */
export async function sweepUnverifiedIdentifiers(
	db: Database,
	now: number = Date.now(),
): Promise<{ swept: number }> {
	let result = await db.deleteMany(subjectIdentifiers, {
		where: and(
			isNull("verified_at"),
			lt("created_at", now - RETENTION_WINDOW_MS),
			or(isNull("verification_ticket_expires_at"), lt("verification_ticket_expires_at", now)),
		),
	});

	return { swept: result.affectedRows };
}

/** Maps a profile's camelCase claims to the table's snake_case columns, for a create. */
function profileColumns(profile: SubjectProfile | undefined): Record<string, string | null> {
	return {
		name: profile?.name ?? null,
		given_name: profile?.givenName ?? null,
		family_name: profile?.familyName ?? null,
		nickname: profile?.nickname ?? null,
		preferred_username: profile?.preferredUsername ?? null,
		picture: profile?.picture ?? null,
		locale: profile?.locale ?? null,
		zoneinfo: profile?.zoneinfo ?? null,
	};
}

/** Maps only the profile claims a caller actually supplied, for a partial update. */
function profileChanges(profile: SubjectProfile): Record<string, string | null> {
	let changes: Record<string, string | null> = {};

	if ("name" in profile) changes.name = profile.name ?? null;
	if ("givenName" in profile) changes.given_name = profile.givenName ?? null;
	if ("familyName" in profile) changes.family_name = profile.familyName ?? null;
	if ("nickname" in profile) changes.nickname = profile.nickname ?? null;
	if ("preferredUsername" in profile)
		changes.preferred_username = profile.preferredUsername ?? null;
	if ("picture" in profile) changes.picture = profile.picture ?? null;
	if ("locale" in profile) changes.locale = profile.locale ?? null;
	if ("zoneinfo" in profile) changes.zoneinfo = profile.zoneinfo ?? null;

	return changes;
}

/** Maps a subject row's snake_case columns back to the API's camelCase claims. */
function profileOf(row: SubjectRow): SubjectProfile {
	return {
		name: row.name,
		givenName: row.given_name,
		familyName: row.family_name,
		nickname: row.nickname,
		preferredUsername: row.preferred_username,
		picture: row.picture,
		locale: row.locale,
		zoneinfo: row.zoneinfo,
	};
}
