/**
 * Outbound webhook deliveries: the `webhook_deliveries` table, the fan-out that
 * turns a succeeded audit event into one pending row per matching enabled
 * endpoint, and the operations a delivery's whole lifecycle runs through —
 * leasing an attempt, signing it under every currently live secret, recording
 * how it went, and replaying, paging or sweeping the rows that result.
 *
 * Nothing here makes a network request: `prepareDelivery` hands back a signed
 * request's own pieces and `settleDelivery` only ever records what a caller
 * already observed, so a later pass's Worker-side sender is the only thing
 * that still needs building before a delivery actually reaches a receiver.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetCursors } from "@sdxc/pagination";
import type { Database, TableRow } from "remix/data-table";

import { createBackoff } from "@sdxc/backoff";
import { open } from "@sdxc/crypto";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";
import { sign } from "@sdxc/webhooks";
import * as s from "remix/data-schema";
import { and, column as c, eq, inList, isNull, lt, lte, table } from "remix/data-table";

import type { AuditActor, AuditEventInput } from "./audit-events";

import { webhookEndpoints } from "./webhook-endpoints";

/** The `webhook-signature` header name; `@sdxc/webhooks` signs it but does not export its own header constants. */
const SIGNATURE_HEADER = "webhook-signature";

/** Milliseconds in one second, for turning a stored epoch-ms clock into the whole seconds a signature's timestamp header carries. */
const SECOND_MS = 1000;

/** One day, in milliseconds, for turning a tenant's own retention window into a cutoff. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** How many delivery attempts a row gets before it is marked exhausted rather than scheduled again. */
const MAX_ATTEMPTS = 8;

/** The largest fraction of a retry delay that jitter may add or take away. */
const MAX_JITTER_FRACTION = 0.2;

/** How many consecutive exhausted deliveries disable an endpoint. */
const DISABLE_AFTER_CONSECUTIVE_FAILURES = 20;

/** How much of a failed attempt's own response or error a delivery row keeps, so a chatty receiver cannot make one row's storage unbounded. */
const LAST_ERROR_SNIPPET_LENGTH = 512;

/** How many rows one sweep or claim call reads or removes at once, when a caller does not choose. */
const BATCH_SIZE = 500;

/** Delivery summaries a dashboard's own log returns, most recently created first. */
const DEFAULT_PAGE_SIZE = 20;

/** Mints a `whdl_…` id for a new webhook delivery. */
const webhookDeliveryRowId = typeid("whdl");

/** One attempt to reach a tenant's own registered endpoint with one event. */
export const webhookDeliveries = table({
	name: "webhook_deliveries",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		endpoint_id: c.text(),
		event_type: c.text(),
		sequence: c.integer(),
		payload: c.text(),
		status: c.enum(["pending", "delivered", "exhausted"] as const),
		attempts: c.integer().default(0),
		next_attempt_at: c.integer().nullable(),
		last_status: c.integer().nullable(),
		last_error: c.text().nullable(),
		last_attempt_at: c.integer().nullable(),
		delivered_at: c.integer().nullable(),
		created_at: c.integer(),
		replay_of: c.text().nullable(),
	},
});

export type WebhookDeliveryRow = TableRow<typeof webhookDeliveries>;

/**
 * Mints this tenant's next delivery sequence: the current highest one, read
 * back and incremented by one — the same running-max idiom the audit log's
 * own id mint uses, safe under the identical single-writer assumption a
 * Durable Object already gives every other table here. Monotonic across
 * every endpoint, so a receiver comparing two deliveries learns which
 * happened first no matter which endpoint received either one.
 */
async function mintDeliverySequence(db: Database): Promise<number> {
	let last = await db.findOne(webhookDeliveries, { where: {}, orderBy: ["sequence", "desc"] });
	return (last?.sequence ?? 0) + 1;
}

/** Truncates a failed attempt's own response or error text to what one row keeps. */
function truncateSnippet(snippet: string | null | undefined): string | null {
	if (snippet === null || snippet === undefined) return null;
	return snippet.length > LAST_ERROR_SNIPPET_LENGTH
		? snippet.slice(0, LAST_ERROR_SNIPPET_LENGTH)
		: snippet;
}

/** A delivery row projected for the dashboard's own log — never `payload`, which carries the exact signed body rather than anything meant for display. */
export interface WebhookDeliverySummary {
	id: string;
	endpointId: string;
	eventType: string;
	sequence: number;
	status: "pending" | "delivered" | "exhausted";
	attempts: number;
	nextAttemptAt: number | null;
	lastStatus: number | null;
	lastError: string | null;
	lastAttemptAt: number | null;
	deliveredAt: number | null;
	createdAt: number;
	replayOf: string | null;
}

type WebhookDeliverySummarySource = Pick<
	WebhookDeliveryRow,
	| "id"
	| "endpoint_id"
	| "event_type"
	| "sequence"
	| "status"
	| "attempts"
	| "next_attempt_at"
	| "last_status"
	| "last_error"
	| "last_attempt_at"
	| "delivered_at"
	| "created_at"
	| "replay_of"
>;

function toDeliverySummary(row: WebhookDeliverySummarySource): WebhookDeliverySummary {
	return {
		id: row.id,
		endpointId: row.endpoint_id,
		eventType: row.event_type,
		sequence: row.sequence,
		status: row.status as WebhookDeliverySummary["status"],
		attempts: row.attempts,
		nextAttemptAt: row.next_attempt_at,
		lastStatus: row.last_status,
		lastError: row.last_error,
		lastAttemptAt: row.last_attempt_at,
		deliveredAt: row.delivered_at,
		createdAt: row.created_at,
		replayOf: row.replay_of,
	};
}

export interface EnqueueMatchingDeliveriesResult {
	created: number;
}

/**
 * Writes one pending `webhook_deliveries` row for every enabled endpoint
 * subscribed to `event.action`, from exactly what `writeAuditEvent` was
 * already given for its own audit row — no call site anywhere in this
 * codebase needs to change for its audit write to also produce matching
 * deliveries.
 *
 * Only a succeeded outcome ever reaches an endpoint: a refused sign-in or a
 * rejected write is not the kind of business event a tenant's own systems
 * should react to, so a failed or denied event still gets its audit row and
 * simply produces no delivery.
 *
 * @param db - The tenant's database.
 * @param event - The action, its outcome, the target it names, and whatever
 * detail the operation already gathered for its own audit row.
 * @returns How many delivery rows this call wrote.
 */
export async function enqueueMatchingDeliveries(
	db: Database,
	event: Pick<AuditEventInput, "action" | "outcome" | "targetType" | "targetId" | "detail" | "at">,
): Promise<EnqueueMatchingDeliveriesResult> {
	if (event.outcome !== "succeeded") return { created: 0 };

	let endpoints = await db.findMany(webhookEndpoints, { where: isNull("disabled_at") });
	let matching = endpoints.filter((endpoint) =>
		(endpoint.event_types as string[]).some((type) => type === "*" || type === event.action),
	);
	if (matching.length === 0) return { created: 0 };

	let now = event.at ?? Date.now();
	let sequence = await mintDeliverySequence(db);

	for (let endpoint of matching) {
		let payload = JSON.stringify({
			type: event.action,
			timestamp: now,
			sequence,
			data: { targetType: event.targetType, targetId: event.targetId, ...event.detail },
		});

		await db.create(webhookDeliveries, {
			id: webhookDeliveryRowId(generateUUID()).toString(),
			endpoint_id: endpoint.id,
			event_type: event.action,
			sequence,
			payload,
			status: "pending",
			attempts: 0,
			next_attempt_at: now,
			last_status: null,
			last_error: null,
			last_attempt_at: null,
			delivered_at: null,
			created_at: now,
			replay_of: null,
		});

		sequence++;
	}

	return { created: matching.length };
}

export interface PrepareDeliveryInput {
	deliveryId: string;
	now?: number;
}

export type PrepareDeliveryResult =
	| { ok: true; url: string; headers: Record<string, string>; body: string; attempt: number }
	| { ok: false; reason: "not-found" | "not-pending" };

let PrepareDeliverySchema = s.object({ deliveryId: s.string() });

/**
 * Leases a pending delivery for this attempt and signs its stored payload
 * under every currently live secret: the endpoint's current one, plus its
 * previous one while a rotation's overlap window has not yet closed. Two
 * live secrets sign the same delivery id and timestamp twice, so the two
 * signatures combine into one `webhook-signature` header value a receiver
 * verifying against either secret accepts.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The delivery to prepare, and the clock to measure its
 * secrets' rotation windows against.
 * @returns The request to send and which attempt this now is, or that the
 * delivery does not exist or is no longer pending.
 */
export async function prepareDelivery(
	db: Database,
	sealKey: CryptoKey,
	input: PrepareDeliveryInput,
): Promise<PrepareDeliveryResult> {
	let parsed = s.parse(PrepareDeliverySchema, input);

	let delivery = await db.find(webhookDeliveries, { id: parsed.deliveryId });
	if (!delivery) return { ok: false, reason: "not-found" };
	if (delivery.status !== "pending") return { ok: false, reason: "not-pending" };

	let endpoint = await db.find(webhookEndpoints, { id: delivery.endpoint_id });
	if (!endpoint) return { ok: false, reason: "not-found" };

	let now = input.now ?? Date.now();
	let timestamp = Math.floor(now / SECOND_MS);

	let liveSealedSecrets = [endpoint.sealed_secret];
	if (
		endpoint.sealed_previous !== null &&
		endpoint.previous_expires_at !== null &&
		endpoint.previous_expires_at > now
	) {
		liveSealedSecrets.push(endpoint.sealed_previous);
	}

	let signatures: string[] = [];
	let body: string | null = null;
	let headers: Record<string, string> = {};

	for (let sealed of liveSealedSecrets) {
		let opened = await open(sealKey, sealed);
		if (isFailure(opened)) throw new Error("failed to open a webhook endpoint's signing secret");

		let signed = await sign(delivery.payload, {
			secret: opened.data,
			id: delivery.id,
			timestamp,
		});
		if (isFailure(signed)) throw new Error("failed to sign a webhook delivery");

		if (body === null) {
			body = signed.data.body;
			for (let [key, value] of signed.data.headers) headers[key] = value;
		}
		signatures.push(signed.data.signature);
	}

	if (body === null) throw new Error("a webhook endpoint has no live signing secret");

	headers[SIGNATURE_HEADER] = signatures.join(" ");

	return { ok: true, url: endpoint.url, headers, body, attempt: delivery.attempts + 1 };
}

export type SettleDeliveryOutcome =
	| { outcome: "delivered"; status: number }
	| { outcome: "http_error"; status: number; snippet?: string }
	| { outcome: "timeout"; snippet?: string }
	| { outcome: "tls_error"; snippet?: string };

export type SettleDeliveryInput = SettleDeliveryOutcome & {
	deliveryId: string;
	/** How long the attempt took, for a caller's own delivery telemetry; not a column this row keeps. */
	durationMs?: number;
	now?: number;
};

export type SettleDeliveryResult =
	| { ok: true; status: "delivered"; deliveredAt: number }
	| { ok: true; status: "pending"; nextAttemptAt: number }
	| { ok: true; status: "exhausted" }
	| { ok: false; reason: "not-found" };

let SettleDeliverySchema = s.object({
	deliveryId: s.string(),
	outcome: s.enum_(["delivered", "http_error", "timeout", "tls_error"] as const),
	status: s.optional(s.number()),
	snippet: s.optional(s.string()),
});

/**
 * The gap before each retry, one step per failed attempt, jittered within
 * {@link MAX_JITTER_FRACTION} so a batch due at once does not retry in lockstep
 * against a recovering receiver. Eight attempts at these gaps reach about a day.
 */
const deliveryBackoff = createBackoff({
	steps: ["15 seconds", "1 minute", "5 minutes", "30 minutes", "2 hours", "6 hours", "12 hours"],
	jitter: MAX_JITTER_FRACTION,
});

/**
 * Records one delivery attempt and decides what happens next: a `delivered`
 * outcome closes the row and resets its endpoint's own failure streak; any
 * other outcome schedules the next attempt with jitter, or — on the eighth —
 * exhausts the row and lengthens that streak, disabling the endpoint once it
 * reaches {@link DISABLE_AFTER_CONSECUTIVE_FAILURES}.
 *
 * @param db - The tenant's database.
 * @param input - The delivery this attempt belongs to, how it went, and the
 * clock to measure the next attempt against.
 * @returns The row's status after recording the attempt, or that no such
 * delivery exists.
 */
export async function settleDelivery(
	db: Database,
	input: SettleDeliveryInput,
): Promise<SettleDeliveryResult> {
	let parsed = s.parse(SettleDeliverySchema, input);

	let delivery = await db.find(webhookDeliveries, { id: parsed.deliveryId });
	if (!delivery) return { ok: false, reason: "not-found" };

	let now = input.now ?? Date.now();
	let attempts = delivery.attempts + 1;

	if (parsed.outcome === "delivered") {
		await db.update(
			webhookDeliveries,
			{ id: parsed.deliveryId },
			{
				attempts,
				last_status: parsed.status ?? null,
				last_error: null,
				last_attempt_at: now,
				delivered_at: now,
				status: "delivered",
				next_attempt_at: null,
			},
		);

		let endpoint = await db.find(webhookEndpoints, { id: delivery.endpoint_id });
		if (endpoint && endpoint.consecutive_failures !== 0) {
			await db.update(webhookEndpoints, { id: delivery.endpoint_id }, { consecutive_failures: 0 });
		}

		return { ok: true, status: "delivered", deliveredAt: now };
	}

	let lastError = truncateSnippet(parsed.snippet);

	if (attempts >= MAX_ATTEMPTS) {
		await db.update(
			webhookDeliveries,
			{ id: parsed.deliveryId },
			{
				attempts,
				last_status: parsed.status ?? null,
				last_error: lastError,
				last_attempt_at: now,
				status: "exhausted",
				next_attempt_at: null,
			},
		);

		let endpoint = await db.find(webhookEndpoints, { id: delivery.endpoint_id });
		if (endpoint) {
			let consecutiveFailures = endpoint.consecutive_failures + 1;
			let disables =
				consecutiveFailures >= DISABLE_AFTER_CONSECUTIVE_FAILURES && !endpoint.disabled_at;

			await db.update(
				webhookEndpoints,
				{ id: delivery.endpoint_id },
				{
					consecutive_failures: consecutiveFailures,
					...(disables
						? {
								disabled_at: now,
								disabled_reason: `${consecutiveFailures} consecutive deliveries were never accepted by this endpoint.`,
							}
						: {}),
				},
			);
		}

		return { ok: true, status: "exhausted" };
	}

	let nextAttemptAt = deliveryBackoff.at(attempts, now);

	await db.update(
		webhookDeliveries,
		{ id: parsed.deliveryId },
		{
			attempts,
			last_status: parsed.status ?? null,
			last_error: lastError,
			last_attempt_at: now,
			status: "pending",
			next_attempt_at: nextAttemptAt,
		},
	);

	return { ok: true, status: "pending", nextAttemptAt };
}

export interface ClaimDueDeliveriesInput {
	before?: number;
	limit?: number;
}

/** What a due delivery's own enqueue needs: which row, and which endpoint it is bound for. */
export interface ClaimedDelivery {
	deliveryId: string;
	endpointId: string;
}

export interface ClaimDueDeliveriesResult {
	deliveries: ClaimedDelivery[];
	more: boolean;
}

let ClaimDueDeliveriesSchema = s.object({
	before: s.optional(s.number()),
	limit: s.optional(s.number()),
});

/**
 * Reads, without mutating, the pending deliveries already past their own
 * `next_attempt_at`, oldest-due first — the table stays the source of truth
 * for what is owed, and this is the sweep's own view onto it.
 *
 * @param db - The tenant's database.
 * @param input - The clock to compare `next_attempt_at` against, and how
 * many rows one call may return.
 * @returns The due deliveries, and whether the batch was full.
 */
export async function claimDueDeliveries(
	db: Database,
	input: ClaimDueDeliveriesInput = {},
): Promise<ClaimDueDeliveriesResult> {
	let parsed = s.parse(ClaimDueDeliveriesSchema, input);
	let before = parsed.before ?? Date.now();
	let limit = parsed.limit ?? BATCH_SIZE;

	let batch = await db.findMany(webhookDeliveries, {
		where: and(eq("status", "pending"), lte("next_attempt_at", before)),
		orderBy: [
			["next_attempt_at", "asc"],
			["id", "asc"],
		],
		limit,
	});

	return {
		deliveries: batch.map((row) => ({ deliveryId: row.id, endpointId: row.endpoint_id })),
		more: batch.length === limit,
	};
}

export interface ReplayDeliveryInput {
	deliveryId: string;
	actor: AuditActor;
	at?: number;
}

export type ReplayDeliveryResult =
	| { ok: true; delivery: WebhookDeliverySummary }
	| { ok: false; reason: "not-found" };

let ReplayDeliverySchema = s.object({ deliveryId: s.string() });

/**
 * Writes a **new** delivery row carrying the original's payload, event type
 * and endpoint, with its own fresh id and sequence and `replayOf` naming the
 * original. A retry reuses its delivery id so a receiver de-duplicating on
 * `webhook-id` collapses one delivery's own attempts; a replay is a
 * deliberate second delivery, so it gets an id of its own instead.
 *
 * @param db - The tenant's database.
 * @param input - The delivery to replay, and who asked for it.
 * @returns The new pending row, or that the original delivery or its
 * endpoint no longer exists.
 */
export async function replayDelivery(
	db: Database,
	input: ReplayDeliveryInput,
): Promise<ReplayDeliveryResult> {
	let parsed = s.parse(ReplayDeliverySchema, input);

	let original = await db.find(webhookDeliveries, { id: parsed.deliveryId });
	if (!original) return { ok: false, reason: "not-found" };

	let endpoint = await db.find(webhookEndpoints, { id: original.endpoint_id });
	if (!endpoint) return { ok: false, reason: "not-found" };

	let now = input.at ?? Date.now();
	let sequence = await mintDeliverySequence(db);

	let row = await db.create(
		webhookDeliveries,
		{
			id: webhookDeliveryRowId(generateUUID()).toString(),
			endpoint_id: original.endpoint_id,
			event_type: original.event_type,
			sequence,
			payload: original.payload,
			status: "pending",
			attempts: 0,
			next_attempt_at: now,
			last_status: null,
			last_error: null,
			last_attempt_at: null,
			delivered_at: null,
			created_at: now,
			replay_of: original.id,
		},
		{ returnRow: true },
	);

	return { ok: true, delivery: toDeliverySummary(row) };
}

export interface ReadDeliveryPageInput {
	endpointId: string;
	cursor?: string | null;
	limit?: number;
}

export type ReadDeliveryPageResult =
	| { ok: true; deliveries: WebhookDeliverySummary[]; cursors: KeysetCursors }
	| { ok: false; reason: "bad-cursor" };

let ReadDeliveryPageSchema = s.object({
	endpointId: s.string(),
	cursor: s.optional(s.nullable(s.string())),
	limit: s.optional(s.number()),
});

/**
 * A page of one endpoint's own delivery log, most recently created first, for
 * the dashboard and the management API to share as a single call per page.
 * Never projects `payload`.
 *
 * @param db - The tenant's database.
 * @param input - The endpoint whose deliveries to read, and where to page
 * from.
 * @returns A page of delivery summaries and the cursors around it, or that
 * the given cursor no longer matches this ordering.
 */
export async function readDeliveryPage(
	db: Database,
	input: ReadDeliveryPageInput,
): Promise<ReadDeliveryPageResult> {
	let parsed = s.parse(ReadDeliveryPageSchema, input);

	let query = db
		.query(webhookDeliveries)
		.where(eq("endpoint_id", parsed.endpointId))
		.select(
			"id",
			"endpoint_id",
			"event_type",
			"sequence",
			"status",
			"attempts",
			"next_attempt_at",
			"last_status",
			"last_error",
			"last_attempt_at",
			"delivered_at",
			"created_at",
			"replay_of",
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
		deliveries: page.data.items.map(toDeliverySummary),
		cursors: page.data.cursors,
	};
}

export interface SweepWebhookDeliveriesInput {
	/** The tenant's own currently enforced retention window, in days. */
	retentionDays: number;
	now?: number;
	limit?: number;
}

export interface SweepWebhookDeliveriesResult {
	deleted: number;
	more: boolean;
}

let SweepWebhookDeliveriesSchema = s.object({
	retentionDays: s.number(),
	now: s.optional(s.number()),
	limit: s.optional(s.number()),
});

/**
 * Deletes delivered or exhausted rows older than the tenant's own retention
 * window, at most `limit` per call, the same batch-bounded shape the audit
 * log's own retention sweep already uses — a `pending` row is never a
 * candidate, regardless of age, since it still has work to do.
 *
 * @param db - The tenant's database.
 * @param input - The retention window to enforce, the clock to measure it
 * from, and how many rows one call may remove.
 * @returns How many rows this call deleted, and whether the batch was full.
 */
export async function sweepWebhookDeliveries(
	db: Database,
	input: SweepWebhookDeliveriesInput,
): Promise<SweepWebhookDeliveriesResult> {
	let parsed = s.parse(SweepWebhookDeliveriesSchema, input);
	let now = parsed.now ?? Date.now();
	let cutoff = now - parsed.retentionDays * DAY_MS;
	let limit = parsed.limit ?? BATCH_SIZE;

	let batch = await db.findMany(webhookDeliveries, {
		where: and(inList("status", ["delivered", "exhausted"]), lt("created_at", cutoff)),
		orderBy: ["created_at", "asc"],
		limit,
	});

	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(webhookDeliveries, {
		where: inList(
			"id",
			batch.map((row) => row.id),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === limit };
}
