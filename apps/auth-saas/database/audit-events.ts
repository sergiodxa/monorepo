/**
 * The tenant's append-only audit log: `audit_events`, the closed catalog of actions it
 * may hold a row for, and the operations over it. Every other module that changes a
 * durable directory fact or makes a security decision calls {@link writeAuditEvent}
 * inline, in the same call that makes the change, so a row and the fact it describes
 * always land together. Leaf module — imports nothing else under `database/`, the way
 * `mail-rate-limit.ts` and `metering.ts` do — since every other module already
 * cross-imports and needs one place to reach for this without cycling back to itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetCursors } from "@sdxc/pagination";
import type { Database, TableRow } from "remix/data-table";

import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { and, between, column as c, eq, gt, inList, lt, table } from "remix/data-table";

/** How many rows a page or a sweep batch reads at once, when a caller does not choose. */
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_RETENTION_BATCH_SIZE = 500;
const DEFAULT_DRAIN_BATCH_SIZE = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many decimal digits {@link writeAuditEvent} pads a minted id to. Fifteen digits
 * holds a tenant to 999,999,999,999,999 rows before it would need to widen — far past
 * anything a per-tenant retention window bounded to 90 days lets a table reach — and
 * stays within `Number.MAX_SAFE_INTEGER` so the mint can do ordinary arithmetic on it.
 */
const ID_WIDTH = 15;

/**
 * The tenant's own append-only record of who did what, to what, and how it turned
 * out. `id` is minted by {@link writeAuditEvent} as a plain, zero-padded decimal
 * sequence — see that function for why a sequence was chosen over a random or
 * time-derived id. Because the sequence only ever grows, one row's `id` compares the
 * same way its insertion order does, so every read here orders and pages by `id`
 * alone; `at` still carries the wall-clock time a row names, but does not itself need
 * an index for ordering.
 */
export const auditEvents = table({
	name: "audit_events",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		at: c.integer(),
		action: c.text(),
		actor_type: c.enum(["subject", "member", "client", "platform"] as const),
		actor_id: c.text(),
		target_type: c.text(),
		target_id: c.text(),
		outcome: c.enum(["succeeded", "failed", "denied"] as const),
		context: c.json(),
		detail: c.json(),
	},
});

export type AuditEventRow = TableRow<typeof auditEvents>;

/**
 * The closed catalog this pass wires, grouped by the six categories a row's `action`
 * belongs to. Closed on purpose: a row write is the most expensive thing this platform
 * does, so the list a call site may write is fixed here rather than left open to
 * whatever a future call finds interesting.
 *
 * Left out of this pass, and why:
 * - **Tenant administration** (`member.invited`, `member.role_changed`,
 *   `settings.changed`, `domain.verified`) — tenant membership and roles are a
 *   control-plane record outside every tenant object entirely, and neither tenant
 *   settings nor domain verification has a write path on the tenant object today.
 *   There is no operation inside this object for any of these to attach to.
 * - **Plan** (`subscription.changed`, `addon.enabled`, `addon.disabled`) — the one
 *   candidate with an operation to attach to, `applyEntitlements`, is deliberately
 *   left unwired this pass: its own test harness isolates it to a single migration
 *   with no audit table in scope, and a tenant's very first `applyEntitlements` call
 *   has no prior plan to compare against, so "changed" has no honest answer on the
 *   call that matters most (initial provisioning). Both are solvable, but not for
 *   the price of "cheap and low-risk" this pass is held to.
 * - `recovery_code.consumed` — recovery codes do not exist yet.
 * - `identifier.primary_changed` — redesignating which already-verified identifier is
 *   primary reorders a subject's own claims rather than changing which claims exist,
 *   and did not make the minimum list this pass commits to.
 */
export const AUDIT_ACTIONS = [
	// Authentication
	"authentication.succeeded",
	"authentication.failed",
	"authentication.denied",
	"session.created",
	"session.revoked",
	// Credentials
	"password.changed",
	"password.removed",
	"passkey.enrolled",
	"passkey.renamed",
	"passkey.revoked",
	// Subject lifecycle
	"subject.created",
	"subject.updated",
	"subject.blocked",
	"subject.unblocked",
	"subject.deleted",
	"identifier.added",
	"identifier.verified",
	"identifier.removed",
	// Client and protocol
	"client.created",
	"client.updated",
	"client.secret.rotated",
	"client.secret.revoked",
	"client.disabled",
	"client.deleted",
	"signing_key.rotated",
	"consent.granted",
	"consent.revoked",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Who acted: which kind of principal, and which one. `member` has no caller yet — see the catalog note above — but is kept in the type since the row schema already carries it. */
export type AuditActorType = "subject" | "member" | "client" | "platform";

/** How the operation an audit row describes turned out. */
export type AuditOutcome = "succeeded" | "failed" | "denied";

/** The principal a call site names as having acted, from what it already knows. */
export interface AuditActor {
	type: AuditActorType;
	id: string;
}

/**
 * Everything about the calling request an operation may know, all optional: nothing
 * here is invented when a call site does not have it.
 */
export interface AuditContext {
	requestId?: string;
	clientId?: string;
	ip?: string | null;
	userAgent?: string | null;
}

export interface AuditEventInput {
	action: AuditAction;
	actor: AuditActor;
	targetType: string;
	targetId: string;
	outcome: AuditOutcome;
	context?: AuditContext;
	detail?: Record<string, unknown>;
	/** When this happened; defaults to the current time. Exposed for tests, not for backdating. */
	at?: number;
}

/** One row as a page or a drain answers it, with `context`/`detail` decoded back to objects. */
export interface AuditEventSummary {
	id: string;
	at: number;
	action: string;
	actorType: AuditActorType;
	actorId: string;
	targetType: string;
	targetId: string;
	outcome: AuditOutcome;
	context: AuditContext;
	detail: Record<string, unknown>;
}

function toSummary(row: AuditEventRow): AuditEventSummary {
	return {
		id: row.id,
		at: row.at,
		action: row.action,
		actorType: row.actor_type as AuditActorType,
		actorId: row.actor_id,
		targetType: row.target_type,
		targetId: row.target_id,
		outcome: row.outcome as AuditOutcome,
		context: (row.context as AuditContext) ?? {},
		detail: (row.detail as Record<string, unknown>) ?? {},
	};
}

/**
 * Mints this tenant's next audit id: the current highest id, read back and
 * incremented by one, zero-padded so the text column still compares the same way the
 * number does.
 *
 * A plain, ever-growing sequence rather than a UUIDv7 or another random-suffixed
 * scheme, because the one property this id exists for is acting as the sort
 * tiebreaker alongside `at` — several audit rows routinely land in the same
 * millisecond, since one call (blocking a subject, say) writes its own row and
 * triggers another operation that writes its own right behind it. A random suffix
 * would tiebreak arbitrarily; a sequence tiebreaks in the order the rows were
 * actually written, which is what a customer reading their own history back expects.
 * It also means no dedicated `(at, id)` index is needed to satisfy that ordering:
 * `id` alone already sorts the same way `at` does, because it only ever grows,
 * leaving the write-side index budget for the two the catalog's target and action
 * filters need.
 *
 * The one extra cost is a read before the write, never a second write — reads are not
 * what this design is priced against. Safe under the same assumption the tenant
 * object's other single-writer state already relies on (see `metering.ts`'s own
 * insert-then-bump): nothing else can write into this table between this read and
 * {@link writeAuditEvent}'s own insert, because a Durable Object runs one call's
 * writes to completion before the next one starts.
 */
async function mintAuditId(db: Database): Promise<string> {
	let last = await db.findOne(auditEvents, { where: {}, orderBy: ["id", "desc"] });
	let next = last ? Number(last.id) + 1 : 1;
	return next.toString().padStart(ID_WIDTH, "0");
}

/**
 * Writes one row to this tenant's audit log. The one function every wired operation
 * calls, inline, in the same call that makes the change the row describes — there is
 * no method that only writes a log line, because "write a log line" is a fragment of
 * an operation, not one of its own.
 *
 * @param db - The tenant's database.
 * @param event - The action, who did it, what it was done to, and how it turned out.
 * @returns Once the row is written.
 */
export async function writeAuditEvent(db: Database, event: AuditEventInput): Promise<void> {
	let id = await mintAuditId(db);

	await db.create(auditEvents, {
		id,
		at: event.at ?? Date.now(),
		action: event.action,
		actor_type: event.actor.type,
		actor_id: event.actor.id,
		target_type: event.targetType,
		target_id: event.targetId,
		outcome: event.outcome,
		context: event.context ?? {},
		detail: event.detail ?? {},
	});
}

export interface ReadAuditPageInput {
	from: number;
	to: number;
	action?: string;
	actorId?: string;
	targetId?: string;
	cursor?: string | null;
	limit?: number;
}

export type ReadAuditPageResult =
	| { ok: true; events: AuditEventSummary[]; cursors: KeysetCursors }
	| { ok: false; reason: "bad-cursor" };

let ReadAuditPageSchema = s.object({
	from: s.number(),
	to: s.number(),
	action: s.optional(s.string()),
	actorId: s.optional(s.string()),
	targetId: s.optional(s.string()),
	cursor: s.optional(s.nullable(s.string())),
	limit: s.optional(s.number()),
});

/**
 * A page of this tenant's audit log over a time window, newest first, with optional
 * filters — the one read this catalog exposes, for the dashboard and the management
 * API to share as a single call per page. Both stay unbuilt for now; nothing calls
 * this yet.
 *
 * @param db - The tenant's database.
 * @param input - The inclusive time window to read, optional `action`/`actorId`/
 * `targetId` filters, and where to page from.
 * @returns A page of rows and the cursors around them, or that the given cursor no
 * longer matches this ordering.
 */
export async function readAuditPage(
	db: Database,
	input: ReadAuditPageInput,
): Promise<ReadAuditPageResult> {
	let parsed = s.parse(ReadAuditPageSchema, input);

	let extra = [
		parsed.action ? eq("action", parsed.action) : null,
		parsed.actorId ? eq("actor_id", parsed.actorId) : null,
		parsed.targetId ? eq("target_id", parsed.targetId) : null,
	].filter((predicate): predicate is NonNullable<typeof predicate> => predicate !== null);

	let query = db.query(auditEvents).where(and(between("at", parsed.from, parsed.to), ...extra));

	let page = await Pagination.byKeyset(query, {
		orderBy: [["id", "desc"]],
		unique: true,
		cursor: parsed.cursor ?? null,
		limit: parsed.limit ?? DEFAULT_PAGE_SIZE,
	});

	if (isFailure(page)) {
		if (page.error instanceof InvalidCursorError) return { ok: false, reason: "bad-cursor" };
		throw page.error;
	}

	return { ok: true, events: page.data.items.map(toSummary), cursors: page.data.cursors };
}

export interface EnforceAuditRetentionInput {
	/** The tenant's own currently enforced retention window, in days. */
	retentionDays: number;
	now?: number;
	limit?: number;
}

export interface EnforceAuditRetentionResult {
	deleted: number;
	/** The oldest `at` still on hand after this call, or `null` when the table is now empty. */
	oldestRemaining: number | null;
}

/**
 * Deletes rows older than the tenant's own retention window, at most `limit` per
 * call, the same batch-bounded shape every other sweep in this object already uses.
 * Safe to call repeatedly: once nothing is left past the cutoff, a call answers
 * `{ deleted: 0, ... }` rather than erroring.
 *
 * @param db - The tenant's database.
 * @param input - The retention window to enforce, the clock to measure it from, and
 * how many rows one call may remove.
 * @returns How many rows this call deleted, and the oldest `at` still on hand.
 */
export async function enforceAuditRetention(
	db: Database,
	input: EnforceAuditRetentionInput,
): Promise<EnforceAuditRetentionResult> {
	let now = input.now ?? Date.now();
	let cutoff = now - input.retentionDays * DAY_MS;
	let limit = input.limit ?? DEFAULT_RETENTION_BATCH_SIZE;

	let batch = await db.findMany(auditEvents, {
		where: lt("at", cutoff),
		orderBy: ["at", "asc"],
		limit,
	});

	let deleted = 0;
	if (batch.length > 0) {
		let result = await db.deleteMany(auditEvents, {
			where: inList(
				"id",
				batch.map((row) => row.id),
			),
		});
		deleted = result.affectedRows;
	}

	let oldest = await db.findOne(auditEvents, { where: {}, orderBy: ["at", "asc"] });

	return { deleted, oldestRemaining: oldest?.at ?? null };
}

export interface DrainAuditEventsInput {
	/** The last id already drained, or omitted/`null` to start from the beginning. */
	after?: string | null;
	limit?: number;
}

export interface DrainAuditEventsResult {
	events: AuditEventSummary[];
	/** The id to resume from next time; unchanged from `after` when nothing new landed. */
	next: string | null;
}

/**
 * Rows after a durable position, oldest first, for the streaming and export add-on
 * this contributes to — nothing consumes this yet. The position is the plain minted
 * `id` alone rather than an `(at, id)` pair: the same ordering argument that lets
 * every other read here page by `id` alone applies here too.
 *
 * @param db - The tenant's database.
 * @param input - The id already drained, and how many rows one call may return.
 * @returns Rows after that position, and the position to resume from next.
 */
export async function drainAuditEvents(
	db: Database,
	input: DrainAuditEventsInput,
): Promise<DrainAuditEventsResult> {
	let after = input.after ?? null;
	let limit = input.limit ?? DEFAULT_DRAIN_BATCH_SIZE;

	let rows =
		after === null
			? await db.findMany(auditEvents, { orderBy: ["id", "asc"], limit })
			: await db.findMany(auditEvents, {
					where: gt("id", after),
					orderBy: ["id", "asc"],
					limit,
				});

	let last = rows[rows.length - 1];

	return { events: rows.map(toSummary), next: last ? last.id : after };
}
