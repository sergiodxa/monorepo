/**
 * A tenant's own programmatic credential for the management API: the
 * `management_clients` table and the operations over it. Presented at the
 * management API's own token endpoint for a short-lived access token bound to the
 * tenant that registered it and ceilinged at its registered scopes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetCursors } from "@sdxc/pagination";
import type { Database, TableRow } from "remix/data-table";

import { password, randomToken } from "@sdxc/crypto";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure, isSuccess } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";
import { and, column as c, eq, isNull, table } from "remix/data-table";

import { isManagementScope } from "~/app/services/management-scopes";

/** How often a successful verify writes `last_used_at`, so a caller exchanging tokens every few seconds writes that row about as often as a person signs in. */
const LAST_USED_THROTTLE_MS = 60 * 1000;

/** Management clients a tenant's own list reads at once, when a caller does not choose. */
const DEFAULT_PAGE_SIZE = 20;

/** Mints a `mgmt_` TypeID for a new management client. */
const managementClientId = typeid("mgmt");

/** A tenant's own registered management credential. */
export const managementClients = table({
	name: "management_clients",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		tenant_id: c.text(),
		name: c.text(),
		hint: c.text(),
		secret_hash: c.text(),
		scopes: c.json(),
		created_at: c.integer(),
		last_used_at: c.integer().nullable(),
		revoked_at: c.integer().nullable(),
	},
});

export type ManagementClientRow = TableRow<typeof managementClients>;

/** A management client's public record — never the secret hash. */
export interface ManagementClientRecord {
	id: string;
	tenantId: string;
	name: string;
	hint: string;
	scopes: string[];
	createdAt: number;
	lastUsedAt: number | null;
	revokedAt: number | null;
}

function toManagementClientRecord(row: ManagementClientRow): ManagementClientRecord {
	return {
		id: row.id,
		tenantId: row.tenant_id,
		name: row.name,
		hint: row.hint,
		scopes: row.scopes as string[],
		createdAt: row.created_at,
		lastUsedAt: row.last_used_at,
		revokedAt: row.revoked_at,
	};
}

/** Mints a secret, stores only its hash and hint. */
async function mintSecret(): Promise<{ secret: string; hash: string; hint: string }> {
	let secret = randomToken({ bytes: 32, prefix: "mgmt" });
	let hashed = await password.hash(secret);
	if (isFailure(hashed)) throw new Error("management client secret hashing failed");

	return { secret, hash: hashed.data, hint: secret.slice(-4) };
}

export interface RegisterManagementClientInput {
	tenantId: string;
	name: string;
	scopes: string[];
}

export type RegisterManagementClientResult =
	| { ok: true; client: ManagementClientRecord; secret: string }
	| { ok: false; reason: "unknown-scope"; scope: string };

let RegisterManagementClientSchema = s.object({
	tenantId: s.string(),
	name: s.string(),
	scopes: s.array(s.string()),
});

/**
 * Registers a new management client for a tenant, minting its one secret. Refuses a
 * scope outside the management API's own vocabulary, so a client's registered
 * ceiling can never name something no route will ever check for.
 *
 * @param db - The control-plane database.
 * @param input - The owning tenant, the client's name, and the scopes it may be
 * granted within.
 * @returns The new record and its one-time plaintext secret, or which scope was
 * refused.
 */
export async function registerManagementClient(
	db: Database,
	input: RegisterManagementClientInput,
): Promise<RegisterManagementClientResult> {
	let parsed = s.parse(RegisterManagementClientSchema, input);

	for (let scope of parsed.scopes) {
		if (!isManagementScope(scope)) return { ok: false, reason: "unknown-scope", scope };
	}

	let now = Date.now();
	let id = managementClientId(generateUUID()).toString();
	let minted = await mintSecret();

	await db.create(managementClients, {
		id,
		tenant_id: parsed.tenantId,
		name: parsed.name,
		hint: minted.hint,
		secret_hash: minted.hash,
		scopes: parsed.scopes,
		created_at: now,
		last_used_at: null,
		revoked_at: null,
	});

	let row = await db.find(managementClients, { id });
	if (!row) throw new Error("management client row missing immediately after its own create");

	return { ok: true, client: toManagementClientRecord(row), secret: minted.secret };
}

export type RotateManagementClientSecretResult =
	| { ok: true; secret: string }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "revoked" };

/**
 * Mints a fresh secret for a client and overwrites its stored hash in place. A
 * management client carries one live secret at a time — there is no overlap window
 * to rotate through, so the caller that holds the old secret loses it the instant
 * this returns.
 *
 * @param db - The control-plane database.
 * @param input - The client to rotate.
 * @returns The new one-time plaintext secret, or why rotation was refused.
 */
export async function rotateManagementClientSecret(
	db: Database,
	input: { clientId: string },
): Promise<RotateManagementClientSecretResult> {
	let client = await db.find(managementClients, { id: input.clientId });
	if (!client) return { ok: false, reason: "not-found" };
	if (client.revoked_at !== null) return { ok: false, reason: "revoked" };

	let minted = await mintSecret();

	await db.update(
		managementClients,
		{ id: input.clientId },
		{ secret_hash: minted.hash, hint: minted.hint },
	);

	return { ok: true, secret: minted.secret };
}

export type RevokeManagementClientResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Revokes a management client, refusing every token request it presents its
 * secret to from this point on. A token already minted before revocation keeps
 * verifying until it expires, at most fifteen minutes later.
 *
 * @param db - The control-plane database.
 * @param input - The client to revoke.
 * @returns Success, or that no such client exists.
 */
export async function revokeManagementClient(
	db: Database,
	input: { clientId: string },
): Promise<RevokeManagementClientResult> {
	let client = await db.find(managementClients, { id: input.clientId });
	if (!client) return { ok: false, reason: "not-found" };

	await db.update(managementClients, { id: input.clientId }, { revoked_at: Date.now() });

	return { ok: true };
}

/**
 * Reads a management client's public record.
 *
 * @param db - The control-plane database.
 * @param input - The client to read.
 * @returns The record, or `null` when no such client exists.
 */
export async function readManagementClient(
	db: Database,
	input: { clientId: string },
): Promise<ManagementClientRecord | null> {
	let row = await db.find(managementClients, { id: input.clientId });
	return row ? toManagementClientRecord(row) : null;
}

export interface ListManagementClientsInput {
	tenantId: string;
	cursor?: string | null;
	limit?: number;
}

export type ListManagementClientsResult =
	| { ok: true; clients: ManagementClientRecord[]; cursors: KeysetCursors }
	| { ok: false; reason: "bad-cursor" };

let ListManagementClientsSchema = s.object({
	tenantId: s.string(),
	cursor: s.optional(s.nullable(s.string())),
	limit: s.optional(s.number()),
});

/**
 * A page of one tenant's registered management clients, most recently registered
 * first.
 *
 * @param db - The control-plane database.
 * @param input - The tenant to list, and where to page from.
 * @returns A page of client records and the cursors around it, or that the given
 * cursor no longer matches this ordering.
 */
export async function listManagementClients(
	db: Database,
	input: ListManagementClientsInput,
): Promise<ListManagementClientsResult> {
	let parsed = s.parse(ListManagementClientsSchema, input);

	let query = db.query(managementClients).where(eq("tenant_id", parsed.tenantId));

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
		clients: page.data.items.map(toManagementClientRecord),
		cursors: page.data.cursors,
	};
}

export type VerifyManagementClientSecretResult =
	| { ok: true; client: ManagementClientRecord }
	| { ok: false };

/**
 * Checks a presented secret against a client's stored hash, stamping `last_used_at`
 * at most once a minute and rehashing past policy the same as a password verify
 * does for a password hash. A revoked client never verifies, whatever secret is
 * presented — the same answer as a client this tenant never registered, so a token
 * request cannot tell the two apart.
 *
 * @param db - The control-plane database.
 * @param input - The client presenting a secret, and the secret itself.
 * @returns The verified client's record, or that the secret did not match.
 */
export async function verifyManagementClientSecret(
	db: Database,
	input: { clientId: string; secret: string },
): Promise<VerifyManagementClientSecretResult> {
	let client = await db.findOne(managementClients, {
		where: and(eq("id", input.clientId), isNull("revoked_at")),
	});
	if (!client) return { ok: false };

	let verified = await password.verify(client.secret_hash, input.secret);
	if (isFailure(verified) || !verified.data) return { ok: false };

	let now = Date.now();

	if (client.last_used_at === null || now - client.last_used_at > LAST_USED_THROTTLE_MS) {
		await db.update(managementClients, { id: client.id }, { last_used_at: now });
	}

	if (password.needsRehash(client.secret_hash)) {
		let rehashed = await password.hash(input.secret);
		if (isSuccess(rehashed)) {
			await db.update(managementClients, { id: client.id }, { secret_hash: rehashed.data });
		}
	}

	return { ok: true, client: toManagementClientRecord(client) };
}
