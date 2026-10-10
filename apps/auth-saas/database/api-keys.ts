/**
 * API keys: the `api_keys` table and the tiny `api_key_settings` row that holds a
 * tenant's own key prefix, and the operations over them. An API key is a long-lived
 * opaque credential an administrative operation mints for one of a tenant's own end
 * users, so that person can script against the tenant's API without driving a browser
 * flow, and it is verified by a row lookup and a constant-time digest compare on every
 * call rather than a signature check.
 *
 * A presented key carries the id of its own row, so `authenticateApiKey` finds the row
 * rather than searching for it, and the secret half is 256 bits no search can walk, so
 * storage keeps a SHA-256 digest compared in constant time. The verification facts a
 * warm caller already resolved live in a cache this module reads and writes but never
 * owns the lifetime of — that belongs to whichever object instance hands one in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetCursors } from "@sdxc/pagination";
import type { Database, TableRow } from "remix/data-table";

import { Hex, randomToken, sha256, timingSafeEqual } from "@sdxc/crypto";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";
import * as s from "remix/data-schema";
import { column as c, eq, inList, lt, table } from "remix/data-table";

import type { AuditActor } from "./audit-events";
import type { DauCache } from "./metering";

import { writeAuditEvent } from "./audit-events";
import { recordAuthentication } from "./metering";
import { describeSubjectAccess, TENANT_SCOPE } from "./roles";
import { subjects } from "./subjects";

/** The feature slug this whole mechanism is sold under. */
export const MACHINE_ACCESS_FEATURE = "machine_access";

/** One UTC day, in milliseconds. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a key lives when its caller does not choose an expiry. */
const DEFAULT_KEY_LIFETIME_DAYS = 90;

/** The longest a key may live, regardless of what is requested. */
const MAX_KEY_LIFETIME_DAYS = 365;

/** How long a rotation's overlap window lasts when its caller does not choose one, and the shortest it may ever be. */
const MIN_ROTATION_OVERLAP_DAYS = 7;

/** The longest overlap window a rotation may open, regardless of what is requested. */
const MAX_ROTATION_OVERLAP_DAYS = 30;

/** How often `authenticateApiKey` writes `last_used_at`, so a busy key stamps one row a minute rather than one a call. */
const LAST_USED_THROTTLE_MS = 60 * 1000;

/** How many expired rows one sweep call removes before reporting back to its caller. */
const SWEEP_BATCH_SIZE = 500;

/** Key summaries a subject's own list returns, most recently minted first. */
const DEFAULT_PAGE_SIZE = 20;

/** The one row `api_key_settings` ever holds: this tenant's own current prefix. */
const SETTINGS_ROW_ID = "current";

/** A tenant's own key prefix: two to twelve lowercase ASCII letters, fixed once chosen. */
const PREFIX_SHAPE = /^[a-z]{2,12}$/;

/**
 * A presented key's whole shape: a prefix, a TypeID suffix locating the row, and a
 * secret — in that order, joined by `_`. The suffix's length is fixed at 26
 * characters, over the same Crockford Base32 alphabet a TypeID always encodes to,
 * which is what lets this pattern find the boundary between the id and the secret
 * even though the secret's own base64url alphabet can itself contain `_`.
 */
const PRESENTED_KEY_SHAPE = /^([a-z]{2,12})_([0-9abcdefghjkmnpqrstvwxyz]{26})_(.+)$/;

/** Mints an `akey_…` id for a new API key. */
const apiKeyRowId = typeid("akey");

/** A long-lived opaque credential minted for one of a tenant's own end users. */
export const apiKeys = table({
	name: "api_keys",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		subject_id: c.text(),
		name: c.text(),
		secret_hash: c.text(),
		hint: c.text(),
		scopes: c.json(),
		created_at: c.integer(),
		expires_at: c.integer(),
		last_used_at: c.integer().nullable(),
		revoked_at: c.integer().nullable(),
		revoked_reason: c.text().nullable(),
	},
});

/** This tenant's own key prefix, kept apart from `settings` since this module's own calls carry no tenant id to key a shared row by. */
export const apiKeySettings = table({
	name: "api_key_settings",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		prefix: c.text(),
		created_at: c.integer(),
	},
});

export type ApiKeyRow = TableRow<typeof apiKeys>;
export type ApiKeySettingsRow = TableRow<typeof apiKeySettings>;

/** A key's whole record, in the API's own camelCase — never the secret, only its `hint`. */
export interface ApiKeyRecord {
	id: string;
	subjectId: string;
	name: string;
	hint: string;
	scopes: string[];
	createdAt: number;
	expiresAt: number;
	lastUsedAt: number | null;
	revokedAt: number | null;
	revokedReason: string | null;
}

/** One key as a subject's own list renders it — the same shape as {@link ApiKeyRecord}, kept distinct so a projection change never has to touch the other. */
export type ApiKeySummary = ApiKeyRecord;

function toApiKeyRecord(row: ApiKeyRow): ApiKeyRecord {
	return {
		id: row.id,
		subjectId: row.subject_id,
		name: row.name,
		hint: row.hint,
		scopes: row.scopes as string[],
		createdAt: row.created_at,
		expiresAt: row.expires_at,
		lastUsedAt: row.last_used_at,
		revokedAt: row.revoked_at,
		revokedReason: row.revoked_reason,
	};
}

/**
 * What a warm object instance answers `authenticateApiKey` with, with no storage
 * read: the facts a presented key's secret and clocks are checked against, plus
 * `lastUsedAt`, so the once-a-minute stamp throttle reads the same warm state
 * rather than paying a read of its own.
 */
export interface ApiKeyVerificationFacts {
	subjectId: string;
	secretHash: string;
	scopes: string[];
	expiresAt: number;
	revokedAt: number | null;
	lastUsedAt: number | null;
}

/**
 * One object instance's own map from a key's id to the facts that verify it,
 * populated by `authenticateApiKey` on a miss and kept current by `revokeApiKey`
 * and `rotateApiKey` in the same call that changes what a row means.
 */
export type ApiKeyVerificationCache = Map<string, ApiKeyVerificationFacts>;

/** Mints a fresh key row and the one-time value a caller shows once. */
async function mintApiKey(
	db: Database,
	input: {
		subjectId: string;
		name: string;
		scopes: string[];
		expiresAt: number;
		now: number;
		prefix: string;
	},
): Promise<{ record: ApiKeyRecord; value: string }> {
	let typeId = apiKeyRowId(generateUUID());
	let id = typeId.toString();
	let secret = randomToken({ bytes: 32 });

	let hashed = await sha256(secret);
	if (isFailure(hashed)) throw new Error("API key secret hashing failed");

	let hint = secret.slice(-4);

	await db.create(apiKeys, {
		id,
		subject_id: input.subjectId,
		name: input.name,
		secret_hash: Hex.encode(hashed.data),
		hint,
		scopes: input.scopes,
		created_at: input.now,
		expires_at: input.expiresAt,
		last_used_at: null,
		revoked_at: null,
		revoked_reason: null,
	});

	let row = await db.find(apiKeys, { id });
	if (!row) throw new Error("API key row missing immediately after its own create");

	return { record: toApiKeyRecord(row), value: `${input.prefix}_${typeId.suffix}_${secret}` };
}

export interface SetApiKeyPrefixInput {
	prefix: string;
	actor: AuditActor;
	at?: number;
}

export type SetApiKeyPrefixResult =
	| { ok: true; prefix: string }
	| { ok: false; reason: "invalid-prefix" }
	| { ok: false; reason: "already-set"; prefix: string }
	| { ok: false; reason: "entitlement-required" };

let SetApiKeyPrefixSchema = s.object({ prefix: s.string() });

/**
 * Sets this tenant's own key prefix, once. A call naming the prefix already in
 * force is a no-op success, so a retried request never turns into a refusal; a
 * call naming a different one is refused outright, since every key already
 * minted carries the prefix chosen when it was.
 *
 * @param db - The tenant's database.
 * @param input - The prefix to set, and who is making the call.
 * @returns The prefix now in force, or which rule refused the call.
 */
export async function setApiKeyPrefix(
	db: Database,
	input: SetApiKeyPrefixInput,
): Promise<SetApiKeyPrefixResult> {
	let parsed = s.parse(SetApiKeyPrefixSchema, input);
	if (!PREFIX_SHAPE.test(parsed.prefix)) return { ok: false, reason: "invalid-prefix" };

	let existing = await db.find(apiKeySettings, { id: SETTINGS_ROW_ID });
	if (existing) {
		if (existing.prefix === parsed.prefix) return { ok: true, prefix: existing.prefix };
		return { ok: false, reason: "already-set", prefix: existing.prefix };
	}

	let now = input.at ?? Date.now();

	await db.create(apiKeySettings, { id: SETTINGS_ROW_ID, prefix: parsed.prefix, created_at: now });

	await writeAuditEvent(db, {
		action: "api_key.prefix_set",
		actor: input.actor,
		targetType: "settings",
		targetId: "api_key_prefix",
		outcome: "succeeded",
		detail: { prefix: parsed.prefix },
		at: now,
	});

	return { ok: true, prefix: parsed.prefix };
}

export interface CreateApiKeyInput {
	subjectId: string;
	name: string;
	scopes: string[];
	/** An absolute expiry; defaults to 90 days out and refuses more than 365. */
	expiresAt?: number;
	actor: AuditActor;
	at?: number;
}

export type CreateApiKeyResult =
	| { ok: true; key: ApiKeyRecord; value: string }
	| { ok: false; reason: "prefix-not-set" }
	| { ok: false; reason: "scope-not-held"; scope: string }
	| { ok: false; reason: "expiry-too-far" }
	| { ok: false; reason: "entitlement-required" };

let CreateApiKeySchema = s.object({
	subjectId: s.string(),
	name: s.string(),
	scopes: s.array(s.string()),
	expiresAt: s.optional(s.number()),
});

/**
 * Mints an API key for one of this tenant's own end users, narrowing rather than
 * creating an authorization: every requested scope must already be one the
 * issuing subject holds at the tenant scope. Refuses outright until this
 * tenant's own key prefix has been set once.
 *
 * @param db - The tenant's database.
 * @param input - The subject the key acts as, its name, scopes and optional
 * expiry, and who is making the call.
 * @returns The new record and the one-time key value — never stored anywhere
 * else — or which rule refused the call.
 */
export async function createApiKey(
	db: Database,
	input: CreateApiKeyInput,
): Promise<CreateApiKeyResult> {
	let parsed = s.parse(CreateApiKeySchema, input);
	let now = input.at ?? Date.now();

	let settingsRow = await db.find(apiKeySettings, { id: SETTINGS_ROW_ID });
	if (!settingsRow) return { ok: false, reason: "prefix-not-set" };

	let access = await describeSubjectAccess(db, {
		subjectId: parsed.subjectId,
		scope: TENANT_SCOPE,
	});
	for (let scope of parsed.scopes) {
		if (!access.permissions.includes(scope)) return { ok: false, reason: "scope-not-held", scope };
	}

	let expiresAt = parsed.expiresAt ?? now + DEFAULT_KEY_LIFETIME_DAYS * DAY_MS;
	if (expiresAt - now > MAX_KEY_LIFETIME_DAYS * DAY_MS)
		return { ok: false, reason: "expiry-too-far" };

	let minted = await mintApiKey(db, {
		subjectId: parsed.subjectId,
		name: parsed.name,
		scopes: parsed.scopes,
		expiresAt,
		now,
		prefix: settingsRow.prefix,
	});

	await writeAuditEvent(db, {
		action: "api_key.created",
		actor: input.actor,
		targetType: "api_key",
		targetId: minted.record.id,
		outcome: "succeeded",
		detail: { subjectId: parsed.subjectId, scopes: parsed.scopes },
		at: now,
	});

	return { ok: true, key: minted.record, value: minted.value };
}

export interface AuthenticateApiKeyInput {
	presented: string;
	now?: number;
}

/** What a resolved key answers with: the subject it acts as, the scopes it narrows to, and when it expires. */
export interface AuthenticateApiKeySuccess {
	keyId: string;
	subjectId: string;
	scopes: string[];
	expiresAt: number;
}

/**
 * Cross-cutting metering a caller opts an authentication call into: the tenant
 * object's own instance-local cache of today's subjects, the cap currently
 * enforced, and whether that cap refuses a genuinely new subject rather than
 * only reporting it — the exact shape `openSession`'s own metering carries.
 * Omitted entirely, this call meters nothing.
 */
export interface AuthenticateApiKeyMetering {
	cache: DauCache;
	cap: number;
	hard: boolean;
}

/** What authenticating a key answers, before metering has a chance to refuse it. */
export type AuthenticateApiKeyCoreResult =
	| ({ ok: true } & AuthenticateApiKeySuccess)
	| { ok: false; reason: "malformed" }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "expired" }
	| { ok: false; reason: "revoked" }
	| { ok: false; reason: "subject-blocked" };

export type AuthenticateApiKeyResult =
	| AuthenticateApiKeyCoreResult
	| { ok: false; reason: "dau_cap_reached"; day: number; subjects: number; cap: number };

let AuthenticateApiKeySchema = s.object({ presented: s.string(), now: s.optional(s.number()) });

/**
 * Verifies a presented API key value: parses its shape, resolves the row a warm
 * cache already holds or reads once and remembers, compares the secret's digest
 * in constant time, enforces its expiry and revocation and the subject's own
 * status, and stamps `last_used_at` at most once a minute.
 *
 * @param db - The tenant's database.
 * @param input - The presented value, and the clock to check its expiry against.
 * @param cache - The calling object instance's own verification cache; read on a
 * hit and populated on a miss, so a warm object answers with no storage read.
 * @param metering - The daily active user meter to record this authentication
 * against, when the caller has one; omitted, no meter is touched and no
 * authentication is ever refused for it — the overload below narrows such a call's
 * return type accordingly, exactly as `openSession`'s does.
 * @returns The resolved subject and scopes, or which check refused it.
 */
export function authenticateApiKey(
	db: Database,
	input: AuthenticateApiKeyInput,
	cache?: ApiKeyVerificationCache,
): Promise<AuthenticateApiKeyCoreResult>;
export function authenticateApiKey(
	db: Database,
	input: AuthenticateApiKeyInput,
	cache: ApiKeyVerificationCache | undefined,
	metering: AuthenticateApiKeyMetering | undefined,
): Promise<AuthenticateApiKeyResult>;
export async function authenticateApiKey(
	db: Database,
	input: AuthenticateApiKeyInput,
	cache?: ApiKeyVerificationCache,
	metering?: AuthenticateApiKeyMetering,
): Promise<AuthenticateApiKeyResult> {
	let parsed = s.parse(AuthenticateApiKeySchema, input);
	let now = parsed.now ?? Date.now();

	let shape = PRESENTED_KEY_SHAPE.exec(parsed.presented);
	if (!shape) return { ok: false, reason: "malformed" };

	let idSegment = shape[2];
	let secret = shape[3];
	if (idSegment === undefined || secret === undefined) return { ok: false, reason: "malformed" };

	let id = `akey_${idSegment}`;

	let facts = cache?.get(id) ?? null;

	if (!facts) {
		let row = await db.find(apiKeys, { id });
		if (!row) return { ok: false, reason: "not-found" };

		facts = {
			subjectId: row.subject_id,
			secretHash: row.secret_hash,
			scopes: row.scopes as string[],
			expiresAt: row.expires_at,
			revokedAt: row.revoked_at,
			lastUsedAt: row.last_used_at,
		};
		cache?.set(id, facts);
	}

	let hashed = await sha256(secret);
	if (isFailure(hashed)) return { ok: false, reason: "not-found" };
	if (!timingSafeEqual(Hex.encode(hashed.data), facts.secretHash)) {
		return { ok: false, reason: "not-found" };
	}

	if (facts.revokedAt !== null) return { ok: false, reason: "revoked" };
	if (facts.expiresAt <= now) return { ok: false, reason: "expired" };

	// A subject that no longer resolves leaves nothing for the key to act as, the
	// same as one explicitly blocked.
	let subject = await db.find(subjects, { id: facts.subjectId });
	if (!subject || subject.status === "blocked") return { ok: false, reason: "subject-blocked" };

	if (facts.lastUsedAt === null || now - facts.lastUsedAt > LAST_USED_THROTTLE_MS) {
		await db.update(apiKeys, { id }, { last_used_at: now });
		facts.lastUsedAt = now;
	}

	if (metering) {
		let recorded = await recordAuthentication(db, metering.cache, {
			subjectId: facts.subjectId,
			cap: metering.cap,
			hard: metering.hard,
			now,
		});

		if (!recorded.ok) {
			return {
				ok: false,
				reason: "dau_cap_reached",
				day: recorded.day,
				subjects: recorded.subjects,
				cap: recorded.cap,
			};
		}
	}

	return {
		ok: true,
		keyId: id,
		subjectId: facts.subjectId,
		scopes: facts.scopes,
		expiresAt: facts.expiresAt,
	};
}

export interface RotateApiKeyInput {
	keyId: string;
	/** Days the incumbent's window lasts once the successor is minted; defaults to 7, refuses more than 30. */
	overlap?: number;
	actor: AuditActor;
	at?: number;
}

export type RotateApiKeyResult =
	| { ok: true; key: ApiKeyRecord; value: string; incumbentExpiresAt: number }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "prefix-not-set" }
	| { ok: false; reason: "overlap-too-long" }
	| { ok: false; reason: "entitlement-required" };

let RotateApiKeySchema = s.object({ keyId: s.string(), overlap: s.optional(s.number()) });

/**
 * Mints a successor key — a new row, new id, new secret, carrying the
 * incumbent's own subject and scopes forward — and opens the incumbent's
 * overlap window in the same call, updating the instance's own verification
 * cache so the incumbent's new expiry is what a warm object checks next.
 *
 * @param db - The tenant's database.
 * @param input - The key to rotate, how many days the incumbent's window lasts,
 * and who is making the call.
 * @param cache - The calling object instance's own verification cache, updated
 * for the incumbent's new expiry in the same call.
 * @returns The new record and its one-time value, plus the incumbent's updated
 * expiry, or which rule refused the call.
 */
export async function rotateApiKey(
	db: Database,
	input: RotateApiKeyInput,
	cache?: ApiKeyVerificationCache,
): Promise<RotateApiKeyResult> {
	let parsed = s.parse(RotateApiKeySchema, input);

	if (parsed.overlap !== undefined && parsed.overlap > MAX_ROTATION_OVERLAP_DAYS) {
		return { ok: false, reason: "overlap-too-long" };
	}
	let overlapDays = Math.max(
		parsed.overlap ?? MIN_ROTATION_OVERLAP_DAYS,
		MIN_ROTATION_OVERLAP_DAYS,
	);

	let incumbent = await db.find(apiKeys, { id: parsed.keyId });
	if (!incumbent) return { ok: false, reason: "not-found" };

	let settingsRow = await db.find(apiKeySettings, { id: SETTINGS_ROW_ID });
	if (!settingsRow) return { ok: false, reason: "prefix-not-set" };

	let now = input.at ?? Date.now();
	let incumbentExpiresAt = now + overlapDays * DAY_MS;

	await db.update(apiKeys, { id: incumbent.id }, { expires_at: incumbentExpiresAt });

	cache?.set(incumbent.id, {
		subjectId: incumbent.subject_id,
		secretHash: incumbent.secret_hash,
		scopes: incumbent.scopes as string[],
		expiresAt: incumbentExpiresAt,
		revokedAt: incumbent.revoked_at,
		lastUsedAt: incumbent.last_used_at,
	});

	let minted = await mintApiKey(db, {
		subjectId: incumbent.subject_id,
		name: incumbent.name,
		scopes: incumbent.scopes as string[],
		expiresAt: now + DEFAULT_KEY_LIFETIME_DAYS * DAY_MS,
		now,
		prefix: settingsRow.prefix,
	});

	await writeAuditEvent(db, {
		action: "api_key.rotated",
		actor: input.actor,
		targetType: "api_key",
		targetId: incumbent.id,
		outcome: "succeeded",
		detail: { successorId: minted.record.id, incumbentExpiresAt },
		at: now,
	});

	return { ok: true, key: minted.record, value: minted.value, incumbentExpiresAt };
}

export interface RevokeApiKeyInput {
	keyId: string;
	reason: string;
	actor: AuditActor;
	at?: number;
}

export type RevokeApiKeyResult = { ok: true } | { ok: false; reason: "not-found" };

let RevokeApiKeySchema = s.object({ keyId: s.string(), reason: s.string() });

/**
 * Revokes an API key at once, evicting it from the instance's own verification
 * cache in the same call so a revocation lands immediately rather than waiting
 * on the cache to go cold.
 *
 * @param db - The tenant's database.
 * @param input - The key to revoke, why, and who is making the call.
 * @param cache - The calling object instance's own verification cache, evicted
 * of this key in the same call.
 * @returns Success, or that no such key exists.
 */
export async function revokeApiKey(
	db: Database,
	input: RevokeApiKeyInput,
	cache?: ApiKeyVerificationCache,
): Promise<RevokeApiKeyResult> {
	let parsed = s.parse(RevokeApiKeySchema, input);

	let row = await db.find(apiKeys, { id: parsed.keyId });
	if (!row) return { ok: false, reason: "not-found" };

	let now = input.at ?? Date.now();

	await db.update(apiKeys, { id: row.id }, { revoked_at: now, revoked_reason: parsed.reason });
	cache?.delete(row.id);

	await writeAuditEvent(db, {
		action: "api_key.revoked",
		actor: input.actor,
		targetType: "api_key",
		targetId: row.id,
		outcome: "succeeded",
		detail: { reason: parsed.reason },
		at: now,
	});

	return { ok: true };
}

export type ReadApiKeyResult = { ok: true; key: ApiKeyRecord } | { ok: false; reason: "not-found" };

/**
 * Reads one API key's own record, the same projection {@link listApiKeys}
 * already hands back for each row — never the stored secret hash.
 *
 * @param db - The tenant's database.
 * @param input - The key to read.
 * @returns The key's record, or that no such key exists.
 */
export async function readApiKey(
	db: Database,
	input: { keyId: string },
): Promise<ReadApiKeyResult> {
	let row = await db.find(apiKeys, { id: input.keyId });
	if (!row) return { ok: false, reason: "not-found" };

	return { ok: true, key: toApiKeyRecord(row) };
}

export interface ListApiKeysInput {
	subjectId: string;
	cursor?: string | null;
	limit?: number;
}

export type ListApiKeysResult =
	| { ok: true; keys: ApiKeySummary[]; cursors: KeysetCursors }
	| { ok: false; reason: "bad-cursor" };

let ListApiKeysSchema = s.object({
	subjectId: s.string(),
	cursor: s.optional(s.nullable(s.string())),
	limit: s.optional(s.number()),
});

/**
 * A page of a subject's own API keys, most recently minted first, for the
 * account screen and the management API alike. Never projects `secret_hash`.
 *
 * @param db - The tenant's database.
 * @param input - The subject whose keys to list, and where to page from.
 * @returns A page of key summaries and the cursors around it, or that the given
 * cursor no longer matches this ordering.
 */
export async function listApiKeys(
	db: Database,
	input: ListApiKeysInput,
): Promise<ListApiKeysResult> {
	let parsed = s.parse(ListApiKeysSchema, input);

	let query = db
		.query(apiKeys)
		.where(eq("subject_id", parsed.subjectId))
		.select(
			"id",
			"subject_id",
			"name",
			"hint",
			"scopes",
			"created_at",
			"expires_at",
			"last_used_at",
			"revoked_at",
			"revoked_reason",
		);

	let page = await Pagination.byKeyset(query, {
		orderBy: [
			["created_at", "desc"],
			["id", "desc"],
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
		keys: page.data.items.map((row) => ({
			id: row.id,
			subjectId: row.subject_id,
			name: row.name,
			hint: row.hint,
			scopes: row.scopes as string[],
			createdAt: row.created_at,
			expiresAt: row.expires_at,
			lastUsedAt: row.last_used_at,
			revokedAt: row.revoked_at,
			revokedReason: row.revoked_reason,
		})),
		cursors: page.data.cursors,
	};
}

export interface SweepExpiredApiKeysInput {
	before?: number;
	limit?: number;
}

/** How much of the sweep's work this call did, and whether another call is still owed one. */
export interface SweepExpiredApiKeysResult {
	deleted: number;
	more: boolean;
}

let SweepExpiredApiKeysSchema = s.object({
	before: s.optional(s.number()),
	limit: s.optional(s.number()),
});

/**
 * Deletes API keys past their expiry, in one bounded batch, for the scheduled
 * handler driving retention.
 *
 * @param db - The tenant's database.
 * @param input - The clock to sweep against, and how many rows one call may
 * remove.
 * @returns How many rows this call deleted, and whether the batch was full — a
 * caller sees `more: true` and runs the sweep again.
 */
export async function sweepExpiredApiKeys(
	db: Database,
	input: SweepExpiredApiKeysInput = {},
): Promise<SweepExpiredApiKeysResult> {
	let parsed = s.parse(SweepExpiredApiKeysSchema, input);
	let before = parsed.before ?? Date.now();
	let limit = parsed.limit ?? SWEEP_BATCH_SIZE;

	let batch = await db.findMany(apiKeys, {
		where: lt("expires_at", before),
		orderBy: ["expires_at", "asc"],
		limit,
	});

	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(apiKeys, {
		where: inList(
			"id",
			batch.map((row) => row.id),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === limit };
}
