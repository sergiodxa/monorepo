/**
 * Sessions: the record a subject's proof of authentication survives in once a password
 * or a passkey has verified it, and the operations over it. Opening one is folded into
 * the credential-verifying call that needed it, so the only way a row comes to exist is
 * {@link openSession}; everything else here reads, slides or ends one.
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
import { and, column as c, eq, inList, isNull, lt, ne, table } from "remix/data-table";

import type { AuditActor } from "./audit-events";
import type { DauCache, DauNotice } from "./metering";

import { writeAuditEvent } from "./audit-events";
import { recordAuthentication } from "./metering";

/** How long a session stands before the subject must authenticate again. */
const ABSOLUTE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/** How long a session may sit unused before it stops standing. */
const IDLE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** How long a resolve must wait past the last write before it slides the idle window again. */
const LAST_SEEN_THROTTLE_MS = 60 * 1000;

/** How many expired rows one sweep call removes before reporting back to its caller. */
const SWEEP_BATCH_SIZE = 500;

/** Summaries a subject's session list returns, most recent first. */
const DEFAULT_PAGE_SIZE = 20;

/** Mints a `sess_` id for a new session, published as the `sid` claim. */
const sessionRowId = typeid("sess");

/** The surviving proof of one authentication: a bearer token's digest and what it grants. */
export const sessions = table({
	name: "sessions",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		token_hash: c.text(),
		subject_id: c.text(),
		created_at: c.integer(),
		auth_time: c.integer(),
		last_seen_at: c.integer(),
		expires_at: c.integer(),
		idle_expires_at: c.integer(),
		amr: c.json(),
		remembered: c.boolean(),
		/** The step-up class most recently verified for this session, `mfa` once a `completeStepUp` call moves `auth_time` to a freshly verified instant; `null` for a session that has never stepped up. */
		acr: c.text().nullable(),
		ip: c.text().nullable(),
		user_agent: c.text().nullable(),
		country: c.text().nullable(),
		region: c.text().nullable(),
		city: c.text().nullable(),
		revoked_at: c.integer().nullable(),
		revoked_reason: c.text().nullable(),
	},
});

export type SessionRow = TableRow<typeof sessions>;

/** Where a request came from, as Cloudflare reports it, kept on the row it opens or slides. */
let originShape = {
	ip: s.optional(s.nullable(s.string())),
	userAgent: s.optional(s.nullable(s.string())),
	country: s.optional(s.nullable(s.string())),
	region: s.optional(s.nullable(s.string())),
	city: s.optional(s.nullable(s.string())),
};

export interface OpenSessionInput {
	subjectId: string;
	amr: string[];
	remembered: boolean;
	ip?: string | null;
	userAgent?: string | null;
	country?: string | null;
	region?: string | null;
	city?: string | null;
}

/** The day's figure a session-opening call carries back once it opted into metering. */
export interface SessionMeteringReport {
	day: number;
	subjects: number;
	cap: number;
	notice: DauNotice;
}

/** What a caller mints a session with uses to both write the row and set the cookie. */
export interface OpenSessionSuccess {
	sessionId: string;
	token: string;
	authTime: number;
	expiresAt: number;
	idleExpiresAt: number;
	/** Present only when the call opted into metering. */
	metering?: SessionMeteringReport;
}

export type OpenSessionResult =
	| ({ ok: true } & OpenSessionSuccess)
	| { ok: false; reason: "dau_cap_reached"; day: number; subjects: number; cap: number };

/**
 * Cross-cutting metering a caller opts a session-opening call into: the tenant
 * object's own instance-local cache of today's subjects, the cap currently
 * enforced, and whether that cap refuses a genuinely new subject rather than
 * only reporting it. Omitted entirely, this call meters nothing — the shape
 * every existing caller keeps.
 */
export interface OpenSessionMetering {
	cache: DauCache;
	cap: number;
	hard: boolean;
}

let OpenSessionSchema = s.object({
	subjectId: s.string(),
	amr: s.array(s.string()),
	remembered: s.boolean(),
	...originShape,
});

/**
 * Opens a session for a subject that just proved itself: mints a bearer token, stores
 * its digest, and sets both clocks from the tenant's default lifetimes. Called by a
 * credential-verifying operation once it has decided a subject may sign in, never on
 * its own — a credential checked in one call and a session opened in another is one
 * operation split in half.
 *
 * @param db - The tenant's database.
 * @param input - The subject the session belongs to, the methods that proved it, whether
 * the browser should keep it past its own lifetime, and the request's origin.
 * @param metering - The daily active user meter to record this authentication against,
 * when the caller has one; omitted, no meter is touched and no session is ever refused —
 * the overload below narrows such a call's return type to always-succeeds, exactly as it
 * always has.
 * @returns The new session's id and the token to set as the cookie's value, with the
 * clocks the caller may need to shape a response around, or that a hard daily cap
 * refused this subject a session.
 */
export function openSession(
	db: Database,
	input: OpenSessionInput,
): Promise<{ ok: true } & OpenSessionSuccess>;
export function openSession(
	db: Database,
	input: OpenSessionInput,
	metering: OpenSessionMetering | undefined,
): Promise<OpenSessionResult>;
export async function openSession(
	db: Database,
	input: OpenSessionInput,
	metering?: OpenSessionMetering,
): Promise<OpenSessionResult> {
	let parsed = s.parse(OpenSessionSchema, input);

	let meteringReport: SessionMeteringReport | undefined;

	if (metering) {
		let recorded = await recordAuthentication(db, metering.cache, {
			subjectId: parsed.subjectId,
			cap: metering.cap,
			hard: metering.hard,
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

		meteringReport = {
			day: recorded.day,
			subjects: recorded.subjects,
			cap: recorded.cap,
			notice: recorded.notice,
		};
	}

	let token = randomToken({ bytes: 32 });
	let hashed = await sha256(token);
	if (isFailure(hashed)) throw new Error("session token hashing failed");

	let now = Date.now();
	let expiresAt = now + ABSOLUTE_LIFETIME_MS;
	let idleExpiresAt = now + IDLE_LIFETIME_MS;
	let id = sessionRowId(generateUUID()).toString();

	await db.create(sessions, {
		id,
		token_hash: Hex.encode(hashed.data),
		subject_id: parsed.subjectId,
		created_at: now,
		auth_time: now,
		last_seen_at: now,
		expires_at: expiresAt,
		idle_expires_at: idleExpiresAt,
		amr: parsed.amr,
		remembered: parsed.remembered,
		acr: null,
		ip: parsed.ip ?? null,
		user_agent: parsed.userAgent ?? null,
		country: parsed.country ?? null,
		region: parsed.region ?? null,
		city: parsed.city ?? null,
		revoked_at: null,
		revoked_reason: null,
	});

	await writeAuditEvent(db, {
		action: "session.created",
		actor: { type: "subject", id: parsed.subjectId },
		targetType: "subject",
		targetId: parsed.subjectId,
		outcome: "succeeded",
		context: { ip: parsed.ip ?? null, userAgent: parsed.userAgent ?? null },
		detail: { sessionId: id, amr: parsed.amr, remembered: parsed.remembered },
	});

	return {
		ok: true,
		sessionId: id,
		token,
		authTime: now,
		expiresAt,
		idleExpiresAt,
		...(meteringReport ? { metering: meteringReport } : {}),
	};
}

export interface ExtendSessionFactorInput {
	sessionId: string;
	/** The `amr` entry this proof adds, `otp` or `webauthn`, kept once even if it was already present. */
	method: string;
	/** Set only by a step-up: the class it just verified, and the instant it verified it. Omitted, an ordinary second-factor demand leaves both alone. */
	acr?: string;
	authTime?: number;
}

export type ExtendSessionFactorResult =
	| { ok: true; amr: string[]; authTime: number }
	| { ok: false; reason: "not-found" };

/**
 * Adds one proof to a live session without opening a new one: `totp.ts`'s own
 * demand at sign-in extends `amr` alone, and its step-up additionally moves
 * `auth_time` to the instant just verified and records the `acr` that instant
 * now stands for — the same session a credential check opened, carrying one
 * more fact about it rather than a second row.
 *
 * @param db - The tenant's database.
 * @param input - The session to extend, the `amr` entry it earns, and the
 * `acr`/`auth_time` a step-up moves.
 * @returns The session's `amr` and `auth_time` once extended, or that no live
 * session matches.
 */
export async function extendSessionFactor(
	db: Database,
	input: ExtendSessionFactorInput,
): Promise<ExtendSessionFactorResult> {
	let row = await db.findOne(sessions, {
		where: and(eq("id", input.sessionId), isNull("revoked_at")),
	});
	if (!row) return { ok: false, reason: "not-found" };

	let amr = row.amr as string[];
	if (!amr.includes(input.method)) amr = [...amr, input.method];

	let authTime = input.authTime ?? row.auth_time;

	await db.update(
		sessions,
		{ id: row.id },
		{
			amr,
			auth_time: authTime,
			...(input.acr !== undefined ? { acr: input.acr } : {}),
		},
	);

	return { ok: true, amr, authTime };
}

export interface ResolveSessionInput {
	token: string;
	ip?: string | null;
	userAgent?: string | null;
	country?: string | null;
	region?: string | null;
	city?: string | null;
}

export type ResolveSessionResult =
	| {
			status: "active";
			sessionId: string;
			subjectId: string;
			authTime: number;
			amr: string[];
			expiresAt: number;
			idleExpiresAt: number;
	  }
	| { status: "expired" }
	| { status: "revoked" }
	| { status: "unknown" };

let ResolveSessionSchema = s.object({
	token: s.string(),
	...originShape,
});

/**
 * Resolves a bearer token to the session it authenticates: hashes it, looks up the row,
 * refuses a revoked or expired one, and otherwise slides the idle window. The slide is
 * throttled to once a minute, so a page and the form post it renders share one write; a
 * resolve inside that window reads the row without touching it.
 *
 * @param db - The tenant's database.
 * @param input - The token as the cookie carried it, and the resolving request's origin.
 * @returns The session's subject, methods and clocks when it is live, or which refusal
 * applies.
 */
export async function resolveSession(
	db: Database,
	input: ResolveSessionInput,
): Promise<ResolveSessionResult> {
	let parsed = s.parse(ResolveSessionSchema, input);

	let hashed = await sha256(parsed.token);
	if (isFailure(hashed)) return { status: "unknown" };

	let row = await db.findOne(sessions, { where: { token_hash: Hex.encode(hashed.data) } });
	if (!row) return { status: "unknown" };
	if (row.revoked_at !== null) return { status: "revoked" };

	let now = Date.now();
	if (row.expires_at <= now || row.idle_expires_at <= now) return { status: "expired" };

	let idleExpiresAt = row.idle_expires_at;

	if (now - row.last_seen_at > LAST_SEEN_THROTTLE_MS) {
		idleExpiresAt = now + IDLE_LIFETIME_MS;

		await db.update(
			sessions,
			{ id: row.id },
			{
				last_seen_at: now,
				idle_expires_at: idleExpiresAt,
				ip: parsed.ip ?? row.ip,
				user_agent: parsed.userAgent ?? row.user_agent,
				country: parsed.country ?? row.country,
				region: parsed.region ?? row.region,
				city: parsed.city ?? row.city,
			},
		);
	}

	return {
		status: "active",
		sessionId: row.id,
		subjectId: row.subject_id,
		authTime: row.auth_time,
		amr: row.amr as string[],
		expiresAt: row.expires_at,
		idleExpiresAt,
	};
}

export interface ListSubjectSessionsInput {
	subjectId: string;
	callerSessionId: string;
	cursor?: string | null;
	limit?: number;
}

/** One session as an account screen renders it: a place, a device, and how recently used. */
export interface SessionSummary {
	id: string;
	createdAt: number;
	lastSeenAt: number;
	amr: string[];
	ip: string | null;
	userAgent: string | null;
	country: string | null;
	region: string | null;
	city: string | null;
	isCurrent: boolean;
}

export type ListSubjectSessionsResult =
	| { ok: true; sessions: SessionSummary[]; cursors: KeysetCursors }
	| { ok: false; reason: "bad-cursor" };

let ListSubjectSessionsSchema = s.object({
	subjectId: s.string(),
	callerSessionId: s.string(),
	cursor: s.optional(s.nullable(s.string())),
	limit: s.optional(s.number()),
});

/**
 * A page of a subject's live sessions, newest first, for the account UI a "not me"
 * revocation runs from.
 *
 * @param db - The tenant's database.
 * @param input - The subject whose sessions to list, the caller's own session id (to
 * flag which row is `isCurrent`), and where to page from.
 * @returns A page of session summaries and the cursors around it, or that the given
 * cursor no longer matches this ordering.
 */
export async function listSubjectSessions(
	db: Database,
	input: ListSubjectSessionsInput,
): Promise<ListSubjectSessionsResult> {
	let parsed = s.parse(ListSubjectSessionsSchema, input);

	let query = db
		.query(sessions)
		.where(and(eq("subject_id", parsed.subjectId), isNull("revoked_at")))
		.select(
			"id",
			"created_at",
			"last_seen_at",
			"amr",
			"ip",
			"user_agent",
			"country",
			"region",
			"city",
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
		sessions: page.data.items.map((row) => ({
			id: row.id,
			createdAt: row.created_at,
			lastSeenAt: row.last_seen_at,
			amr: row.amr as string[],
			ip: row.ip,
			userAgent: row.user_agent,
			country: row.country,
			region: row.region,
			city: row.city,
			isCurrent: row.id === parsed.callerSessionId,
		})),
		cursors: page.data.cursors,
	};
}

export interface RevokeSessionInput {
	subjectId: string;
	sessionId: string;
	reason: string;
}

export type RevokeSessionResult = { ok: true } | { ok: false; reason: "not-found" };

let RevokeSessionSchema = s.object({
	subjectId: s.string(),
	sessionId: s.string(),
	reason: s.string(),
});

/**
 * Revokes one session, scoped to the subject it must belong to, so the authorization
 * lives where the data does.
 *
 * @param db - The tenant's database.
 * @param input - The subject, the session to revoke, and why.
 * @returns Success, or that no such session exists for this subject.
 */
export async function revokeSession(
	db: Database,
	input: RevokeSessionInput,
): Promise<RevokeSessionResult> {
	let parsed = s.parse(RevokeSessionSchema, input);

	let row = await db.findOne(sessions, {
		where: { id: parsed.sessionId, subject_id: parsed.subjectId },
	});
	if (!row) return { ok: false, reason: "not-found" };

	await db.update(
		sessions,
		{ id: row.id },
		{ revoked_at: Date.now(), revoked_reason: parsed.reason },
	);

	await writeAuditEvent(db, {
		action: "session.revoked",
		actor: { type: "subject", id: parsed.subjectId },
		targetType: "session",
		targetId: row.id,
		outcome: "succeeded",
		detail: { reason: parsed.reason },
	});

	return { ok: true };
}

export interface RevokeSubjectSessionsInput {
	subjectId: string;
	reason: string;
	exceptSessionId?: string;
	/** Who is ending these sessions; defaults to the subject itself when the caller acts on its own. */
	actor?: AuditActor;
}

/** How many of a subject's sessions a blanket revocation ended. */
export interface RevokeSubjectSessionsResult {
	revoked: number;
}

let RevokeSubjectSessionsSchema = s.object({
	subjectId: s.string(),
	reason: s.string(),
	exceptSessionId: s.optional(s.string()),
});

/**
 * Revokes every live session a subject holds, optionally sparing one — the operation a
 * password change or a block calls to end every other authentication of the subject at
 * once.
 *
 * @param db - The tenant's database.
 * @param input - The subject, why, and a session id to leave standing.
 * @returns How many sessions were revoked.
 */
export async function revokeSubjectSessions(
	db: Database,
	input: RevokeSubjectSessionsInput,
): Promise<RevokeSubjectSessionsResult> {
	let parsed = s.parse(RevokeSubjectSessionsSchema, input);

	let where = parsed.exceptSessionId
		? and(
				eq("subject_id", parsed.subjectId),
				isNull("revoked_at"),
				ne("id", parsed.exceptSessionId),
			)
		: and(eq("subject_id", parsed.subjectId), isNull("revoked_at"));

	let result = await db.updateMany(
		sessions,
		{ revoked_at: Date.now(), revoked_reason: parsed.reason },
		{ where },
	);

	// One row for the whole call rather than one per session: a bulk revoke can
	// end dozens of sessions at once, and the fact worth recording is the
	// subject's sessions being ended, not each row that happened to carry it.
	if (result.affectedRows > 0) {
		await writeAuditEvent(db, {
			action: "session.revoked",
			actor: input.actor ?? { type: "subject", id: parsed.subjectId },
			targetType: "subject",
			targetId: parsed.subjectId,
			outcome: "succeeded",
			detail: { reason: parsed.reason, revokedCount: result.affectedRows },
		});
	}

	return { revoked: result.affectedRows };
}

export interface SweepExpiredSessionsInput {
	now?: number;
	batchSize?: number;
}

/** How much of the sweep's work this call did, and whether another call is still owed one. */
export interface SweepExpiredSessionsResult {
	deleted: number;
	more: boolean;
}

let SweepExpiredSessionsSchema = s.object({
	now: s.optional(s.number()),
	batchSize: s.optional(s.number()),
});

/**
 * Deletes sessions past their absolute expiry, in one bounded batch, for the scheduled
 * handler driving retention.
 *
 * @param db - The tenant's database.
 * @param input - The clock to sweep against, and how many rows one call may remove.
 * @returns How many rows this call deleted, and whether the batch was full — a caller
 * sees `more: true` and runs the sweep again.
 */
export async function sweepExpiredSessions(
	db: Database,
	input: SweepExpiredSessionsInput = {},
): Promise<SweepExpiredSessionsResult> {
	let parsed = s.parse(SweepExpiredSessionsSchema, input);
	let now = parsed.now ?? Date.now();
	let batchSize = parsed.batchSize ?? SWEEP_BATCH_SIZE;

	/**
	 * `deleteMany` cannot take a `limit` on its own here: a Durable Object's SQL storage
	 * has no transaction statements, and the driver needs one to bound a delete by row
	 * count. Selecting the batch's ids first and deleting exactly those keeps the sweep
	 * bounded without one.
	 */
	let batch = await db.findMany(sessions, {
		where: lt("expires_at", now),
		orderBy: ["expires_at", "asc"],
		limit: batchSize,
	});

	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(sessions, {
		where: inList(
			"id",
			batch.map((row) => row.id),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === batchSize };
}
