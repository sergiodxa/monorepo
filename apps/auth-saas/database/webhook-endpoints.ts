/**
 * Outbound webhook endpoints: the `webhook_endpoints` table and the operations that
 * register, update, rotate and remove a tenant's own registered receivers. An
 * endpoint names a URL, the event types it subscribes to — drawn from the same
 * closed catalog the audit log writes against, so the two vocabularies can never
 * drift apart — and the signing secret a delivery is authenticated with.
 *
 * A secret only ever exists in the clear for the one call that mints it: sealed the
 * moment it is generated, handed back once in that call's own result, and opened
 * again only by whatever later pass signs a delivery with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetCursors } from "@sdxc/pagination";
import type { Database, TableRow } from "remix/data-table";

import { randomToken, seal } from "@sdxc/crypto";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";
import * as s from "remix/data-schema";
import { column as c, table } from "remix/data-table";

import type { AuditActor } from "./audit-events";

import { AUDIT_ACTIONS, writeAuditEvent } from "./audit-events";

/** The feature slug this whole mechanism is sold under. */
export const OUTBOUND_WEBHOOKS_FEATURE = "outbound_webhooks";

/** Endpoint summaries a dashboard's own list returns, most recently registered first. */
const DEFAULT_PAGE_SIZE = 20;

/** How long a rotation's overlap window lasts: the incumbent secret keeps verifying for a week while a receiver updates its own configuration. */
const ROTATION_OVERLAP_MS = 7 * 24 * 60 * 60 * 1000;

/** Mints a `whep_…` id for a new webhook endpoint. */
const webhookEndpointRowId = typeid("whep");

/** A tenant's own registered receiver for its directory's events. */
export const webhookEndpoints = table({
	name: "webhook_endpoints",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		url: c.text(),
		description: c.text(),
		event_types: c.json(),
		sealed_secret: c.text(),
		sealed_previous: c.text().nullable(),
		previous_expires_at: c.integer().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
		disabled_at: c.integer().nullable(),
		disabled_reason: c.text().nullable(),
		consecutive_failures: c.integer().default(0),
	},
});

export type WebhookEndpointRow = TableRow<typeof webhookEndpoints>;

/** Parses a URL, answering `null` rather than throwing for one that is not absolute. */
function tryParseUrl(url: string): URL | null {
	try {
		return new URL(url);
	} catch {
		return null;
	}
}

/**
 * Whether `hostname`, exactly as `URL` reports it, names an address rather than a
 * DNS name: a bracketed IPv6 literal, or a host that — once its dots are stripped —
 * is nothing but digits, which catches both dotted-decimal IPv4 and the
 * undotted-decimal form some resolvers still accept as one. `localhost` is folded
 * in too, since it resolves to a loopback address by convention rather than by
 * being spelled as one.
 */
function isLiteralAddressHost(hostname: string): boolean {
	if (hostname.startsWith("[") && hostname.endsWith("]")) return true;
	if (hostname === "localhost") return true;

	let withoutDots = hostname.replaceAll(".", "");
	return withoutDots.length > 0 && /^\d+$/.test(withoutDots);
}

/** Why a webhook endpoint's URL was refused at write time. */
export type WebhookUrlValidationFailureReason =
	| "not-absolute"
	| "insecure-scheme"
	| "literal-address-host"
	| "has-userinfo"
	| "non-default-port";

export type WebhookUrlValidation =
	| { ok: true }
	| { ok: false; reason: WebhookUrlValidationFailureReason };

/**
 * Validates a webhook endpoint's URL the way its record is written, not the way a
 * redirect URI is matched: `https`, a public hostname rather than a literal
 * address, no userinfo, and the scheme's own default port. There is no loopback
 * exception here — an endpoint a delivery reaches over the open internet never
 * gets the allowance a native app's own redirect does.
 *
 * @param url - The URL as the caller wrote it.
 * @returns Success, or which rule refused the URL.
 */
export function validateWebhookUrl(url: string): WebhookUrlValidation {
	let parsed = tryParseUrl(url);
	if (!parsed) return { ok: false, reason: "not-absolute" };
	if (parsed.protocol !== "https:") return { ok: false, reason: "insecure-scheme" };
	if (isLiteralAddressHost(parsed.hostname)) return { ok: false, reason: "literal-address-host" };
	if (parsed.username !== "" || parsed.password !== "")
		return { ok: false, reason: "has-userinfo" };
	if (parsed.port !== "") return { ok: false, reason: "non-default-port" };

	return { ok: true };
}

/** The editable fields {@link registerWebhookEndpoint} and {@link updateWebhookEndpoint} both validate as one set. */
interface WebhookEndpointRecordInput {
	url: string;
	eventTypes: string[];
}

/** The refusals {@link registerWebhookEndpoint} and {@link updateWebhookEndpoint} share, from validating the record. */
export type WebhookEndpointValidationFailure =
	| { ok: false; reason: "invalid-url"; detail: WebhookUrlValidationFailureReason }
	| { ok: false; reason: "unknown-event-type"; value: string };

/** Validates a URL and every subscribed event type in one record: each entry is either the wildcard or a real audit action key. */
function validateWebhookEndpointRecord(
	input: WebhookEndpointRecordInput,
): { ok: true } | WebhookEndpointValidationFailure {
	let validatedUrl = validateWebhookUrl(input.url);
	if (!validatedUrl.ok) return { ok: false, reason: "invalid-url", detail: validatedUrl.reason };

	for (let value of input.eventTypes) {
		if (value === "*") continue;
		if (!(AUDIT_ACTIONS as readonly string[]).includes(value)) {
			return { ok: false, reason: "unknown-event-type", value };
		}
	}

	return { ok: true };
}

/** A webhook endpoint's public record — never `sealed_secret` or `sealed_previous`, only the timestamp their own window still carries. */
export interface WebhookEndpointRecord {
	id: string;
	url: string;
	description: string;
	eventTypes: string[];
	createdAt: number;
	updatedAt: number;
	previousSecretExpiresAt: number | null;
	disabledAt: number | null;
	disabledReason: string | null;
	consecutiveFailures: number;
}

/** The columns {@link toWebhookEndpointRecord} reads — every one but the two sealed secret columns, so a projection that never selected them still satisfies it. */
type WebhookEndpointRecordSource = Pick<
	WebhookEndpointRow,
	| "id"
	| "url"
	| "description"
	| "event_types"
	| "previous_expires_at"
	| "created_at"
	| "updated_at"
	| "disabled_at"
	| "disabled_reason"
	| "consecutive_failures"
>;

function toWebhookEndpointRecord(row: WebhookEndpointRecordSource): WebhookEndpointRecord {
	return {
		id: row.id,
		url: row.url,
		description: row.description,
		eventTypes: row.event_types as string[],
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		previousSecretExpiresAt: row.previous_expires_at,
		disabledAt: row.disabled_at,
		disabledReason: row.disabled_reason,
		consecutiveFailures: row.consecutive_failures,
	};
}

export interface RegisterWebhookEndpointInput {
	url: string;
	description: string;
	eventTypes: string[];
	actor: AuditActor;
	at?: number;
}

export type RegisterWebhookEndpointResult =
	| { ok: true; endpoint: WebhookEndpointRecord; secret: string }
	| WebhookEndpointValidationFailure
	| { ok: false; reason: "entitlement-required" };

let RegisterWebhookEndpointSchema = s.object({
	url: s.string(),
	description: s.string(),
	eventTypes: s.array(s.string()),
});

/**
 * Validates and writes a new webhook endpoint record, minting its signing secret
 * and returning it once.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The endpoint's URL, description and subscribed event types, and
 * who is registering it.
 * @returns The new record and the one-time plaintext secret, or which rule
 * refused it.
 */
export async function registerWebhookEndpoint(
	db: Database,
	sealKey: CryptoKey,
	input: RegisterWebhookEndpointInput,
): Promise<RegisterWebhookEndpointResult> {
	let parsed = s.parse(RegisterWebhookEndpointSchema, input);

	let validated = validateWebhookEndpointRecord(parsed);
	if (!validated.ok) return validated;

	let secret = randomToken({ bytes: 32, prefix: "whsec" });
	let sealed = await seal(sealKey, secret);
	if (isFailure(sealed)) throw new Error("failed to seal the webhook signing secret");

	let now = input.at ?? Date.now();
	let id = webhookEndpointRowId(generateUUID()).toString();

	await db.create(webhookEndpoints, {
		id,
		url: parsed.url,
		description: parsed.description,
		event_types: parsed.eventTypes,
		sealed_secret: sealed.data,
		sealed_previous: null,
		previous_expires_at: null,
		created_at: now,
		updated_at: now,
		disabled_at: null,
		disabled_reason: null,
		consecutive_failures: 0,
	});

	await writeAuditEvent(db, {
		action: "webhook_endpoint.registered",
		actor: input.actor,
		targetType: "webhook_endpoint",
		targetId: id,
		outcome: "succeeded",
		detail: { url: parsed.url, eventTypes: parsed.eventTypes },
		at: now,
	});

	let row = await db.find(webhookEndpoints, { id });
	if (!row) throw new Error("webhook endpoint row missing immediately after its own create");

	return { ok: true, endpoint: toWebhookEndpointRecord(row), secret };
}

export interface UpdateWebhookEndpointInput {
	endpointId: string;
	url: string;
	description: string;
	eventTypes: string[];
	actor: AuditActor;
	at?: number;
}

export type UpdateWebhookEndpointResult =
	| { ok: true; endpoint: WebhookEndpointRecord }
	| { ok: false; reason: "not-found" }
	| WebhookEndpointValidationFailure
	| { ok: false; reason: "entitlement-required" };

let UpdateWebhookEndpointSchema = s.object({
	endpointId: s.string(),
	url: s.string(),
	description: s.string(),
	eventTypes: s.array(s.string()),
});

/**
 * Replaces an endpoint's editable fields as one set, so its URL and subscribed
 * event types are never half-written across two calls.
 *
 * @param db - The tenant's database.
 * @param input - The endpoint to update and its whole new editable record.
 * @returns The updated record, or which rule refused the update.
 */
export async function updateWebhookEndpoint(
	db: Database,
	input: UpdateWebhookEndpointInput,
): Promise<UpdateWebhookEndpointResult> {
	let parsed = s.parse(UpdateWebhookEndpointSchema, input);

	let existing = await db.find(webhookEndpoints, { id: parsed.endpointId });
	if (!existing) return { ok: false, reason: "not-found" };

	let validated = validateWebhookEndpointRecord(parsed);
	if (!validated.ok) return validated;

	let now = input.at ?? Date.now();

	await db.update(
		webhookEndpoints,
		{ id: parsed.endpointId },
		{
			url: parsed.url,
			description: parsed.description,
			event_types: parsed.eventTypes,
			updated_at: now,
		},
	);

	await writeAuditEvent(db, {
		action: "webhook_endpoint.updated",
		actor: input.actor,
		targetType: "webhook_endpoint",
		targetId: parsed.endpointId,
		outcome: "succeeded",
		at: now,
	});

	let row = await db.find(webhookEndpoints, { id: parsed.endpointId });
	if (!row) throw new Error("webhook endpoint row missing immediately after its own update");

	return { ok: true, endpoint: toWebhookEndpointRecord(row) };
}

export interface RotateEndpointSecretInput {
	endpointId: string;
	actor: AuditActor;
	at?: number;
}

export type RotateEndpointSecretResult =
	| { ok: true; endpoint: WebhookEndpointRecord; secret: string }
	| { ok: false; reason: "not-found" };

let RotateEndpointSecretSchema = s.object({ endpointId: s.string() });

/**
 * Mints a successor signing secret and keeps the incumbent live as
 * `sealed_previous` for a fixed week-long overlap, so a delivery signed under
 * either one still verifies while a receiver updates its own configuration.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The endpoint to rotate, and who is making the call.
 * @returns The updated record and the new one-time secret, or that no such
 * endpoint exists.
 */
export async function rotateEndpointSecret(
	db: Database,
	sealKey: CryptoKey,
	input: RotateEndpointSecretInput,
): Promise<RotateEndpointSecretResult> {
	let parsed = s.parse(RotateEndpointSecretSchema, input);

	let existing = await db.find(webhookEndpoints, { id: parsed.endpointId });
	if (!existing) return { ok: false, reason: "not-found" };

	let secret = randomToken({ bytes: 32, prefix: "whsec" });
	let sealed = await seal(sealKey, secret);
	if (isFailure(sealed)) throw new Error("failed to seal the webhook signing secret");

	let now = input.at ?? Date.now();
	let previousExpiresAt = now + ROTATION_OVERLAP_MS;

	await db.update(
		webhookEndpoints,
		{ id: parsed.endpointId },
		{
			sealed_secret: sealed.data,
			sealed_previous: existing.sealed_secret,
			previous_expires_at: previousExpiresAt,
			updated_at: now,
		},
	);

	await writeAuditEvent(db, {
		action: "webhook_endpoint.secret_rotated",
		actor: input.actor,
		targetType: "webhook_endpoint",
		targetId: parsed.endpointId,
		outcome: "succeeded",
		detail: { previousExpiresAt },
		at: now,
	});

	let row = await db.find(webhookEndpoints, { id: parsed.endpointId });
	if (!row) throw new Error("webhook endpoint row missing immediately after its own update");

	return { ok: true, endpoint: toWebhookEndpointRecord(row), secret };
}

export interface DeleteWebhookEndpointInput {
	endpointId: string;
	actor: AuditActor;
	at?: number;
}

export type DeleteWebhookEndpointResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Deletes a webhook endpoint outright.
 *
 * @param db - The tenant's database.
 * @param input - The endpoint to delete, and who is making the call.
 * @returns Success, or that no such endpoint exists.
 */
export async function deleteWebhookEndpoint(
	db: Database,
	input: DeleteWebhookEndpointInput,
): Promise<DeleteWebhookEndpointResult> {
	let existing = await db.find(webhookEndpoints, { id: input.endpointId });
	if (!existing) return { ok: false, reason: "not-found" };

	await db.delete(webhookEndpoints, { id: input.endpointId });

	await writeAuditEvent(db, {
		action: "webhook_endpoint.deleted",
		actor: input.actor,
		targetType: "webhook_endpoint",
		targetId: input.endpointId,
		outcome: "succeeded",
		at: input.at ?? Date.now(),
	});

	return { ok: true };
}

export type ReadWebhookEndpointResult =
	| { ok: true; endpoint: WebhookEndpointRecord }
	| { ok: false; reason: "not-found" };

/**
 * Reads one webhook endpoint's record.
 *
 * @param db - The tenant's database.
 * @param input - The endpoint to read.
 * @returns The record, or that no such endpoint exists.
 */
export async function readWebhookEndpoint(
	db: Database,
	input: { endpointId: string },
): Promise<ReadWebhookEndpointResult> {
	let row = await db.find(webhookEndpoints, { id: input.endpointId });
	if (!row) return { ok: false, reason: "not-found" };

	return { ok: true, endpoint: toWebhookEndpointRecord(row) };
}

export interface ListWebhookEndpointsInput {
	cursor?: string | null;
	limit?: number;
}

export type ListWebhookEndpointsResult =
	| { ok: true; endpoints: WebhookEndpointRecord[]; cursors: KeysetCursors }
	| { ok: false; reason: "bad-cursor" };

let ListWebhookEndpointsSchema = s.object({
	cursor: s.optional(s.nullable(s.string())),
	limit: s.optional(s.number()),
});

/**
 * A page of the tenant's webhook endpoints, newest first, for the dashboard's own
 * endpoint list.
 *
 * @param db - The tenant's database.
 * @param input - Where to page from.
 * @returns A page of endpoint records and the cursors around it, or that the given
 * cursor no longer matches this ordering.
 */
export async function listWebhookEndpoints(
	db: Database,
	input: ListWebhookEndpointsInput = {},
): Promise<ListWebhookEndpointsResult> {
	let parsed = s.parse(ListWebhookEndpointsSchema, input);

	let query = db
		.query(webhookEndpoints)
		.select(
			"id",
			"url",
			"description",
			"event_types",
			"previous_expires_at",
			"created_at",
			"updated_at",
			"disabled_at",
			"disabled_reason",
			"consecutive_failures",
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
		endpoints: page.data.items.map(toWebhookEndpointRecord),
		cursors: page.data.cursors,
	};
}
