/**
 * Clients and client secrets: the `clients` and `client_secrets` tables, and the
 * operations over them. A client is a relying party registered in a tenant; a
 * confidential one authenticates at the token endpoint with a secret from this
 * module, a public one carries none and relies on PKCE instead.
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
import { and, column as c, eq, gt, inList, isNull, lt, or, table } from "remix/data-table";

import { writeAuditEvent } from "./audit-events";

/** The audit actor for a call with no operator identity threaded through today. */
const PLATFORM_ACTOR = { type: "platform", id: "system" } as const;

/** How many expired rows one sweep call removes before reporting back to its caller. */
const SWEEP_BATCH_SIZE = 500;

/** Client summaries a dashboard's client list returns, most recently registered first. */
const DEFAULT_PAGE_SIZE = 20;

/** How long a rotation's overlap window lasts when a caller does not choose one. */
const DEFAULT_ROTATION_WINDOW_DAYS = 7;

/** The longest overlap window a rotation may open, regardless of what is requested. */
const MAX_ROTATION_WINDOW_DAYS = 30;

/** How many secrets may verify for one client at once, incumbent and successor together. */
const MAX_LIVE_SECRETS = 2;

/** Mints a `client_` id for a new client. */
const clientRowId = typeid("client");

/** Mints a `csec_` id for a new `client_secrets` row. */
const clientSecretRowId = typeid("csec");

/** A relying party registered in a tenant, and the protocol capabilities it carries. */
export const clients = table({
	name: "clients",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		name: c.text(),
		kind: c.enum(["confidential", "public"] as const),
		redirect_uris: c.json(),
		post_logout_redirect_uris: c.json(),
		grant_types: c.json(),
		response_types: c.json(),
		scopes: c.json(),
		token_endpoint_auth_method: c.enum([
			"client_secret_basic",
			"client_secret_post",
			"none",
		] as const),
		require_consent: c.boolean(),
		created_at: c.integer(),
		updated_at: c.integer(),
		disabled_at: c.integer().nullable(),
	},
});

/** One secret a confidential client may authenticate with, live until its window closes. */
export const clientSecrets = table({
	name: "client_secrets",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		client_id: c.text(),
		hash: c.text(),
		hint: c.text(),
		created_at: c.integer(),
		last_used_at: c.integer().nullable(),
		expires_at: c.integer().nullable(),
	},
});

export type ClientRow = TableRow<typeof clients>;
export type ClientSecretRow = TableRow<typeof clientSecrets>;

/** Whether a client holds a secret at all: a confidential one does, a public one never. */
export type ClientKind = "confidential" | "public";

/** How a client proves itself at the token endpoint. */
export type TokenEndpointAuthMethod = "client_secret_basic" | "client_secret_post" | "none";

/**
 * Every grant type a client may carry. Writing `client_credentials` here only records
 * the client's intent; whether the tenant may actually issue tokens under it is read
 * somewhere else, not enforced by this write.
 */
const GRANT_TYPES = ["authorization_code", "refresh_token", "client_credentials"] as const;

/** Every response type a client may carry. */
const RESPONSE_TYPES = ["code"] as const;

/** A registered URI's host, exactly as strict as the loopback exception both validation and matching share. */
function isLoopbackHost(hostname: string): boolean {
	return hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "localhost";
}

/** Parses a URI, answering `null` rather than throwing for one that is not absolute. */
function tryParseUrl(uri: string): URL | null {
	try {
		return new URL(uri);
	} catch {
		return null;
	}
}

/** Why a redirect or post-logout redirect URI was refused at write time. */
export type RedirectUriValidationFailureReason =
	| "not-absolute"
	| "has-fragment"
	| "insecure-scheme";

export type RedirectUriValidation =
	| { ok: true }
	| { ok: false; reason: RedirectUriValidationFailureReason };

/**
 * Validates a redirect URI the way a client's record is written, not the way an
 * incoming request is matched against it: absolute, no fragment, `https` unless the
 * host is a loopback address, in which case `http` is allowed too. Any other scheme is
 * a native app's own, and is accepted without further checks.
 *
 * @param uri - The URI as the caller wrote it.
 * @returns Success, or which rule refused the URI.
 */
export function validateRedirectUri(uri: string): RedirectUriValidation {
	let parsed = tryParseUrl(uri);
	if (!parsed) return { ok: false, reason: "not-absolute" };
	if (parsed.hash !== "") return { ok: false, reason: "has-fragment" };

	if (parsed.protocol === "https:") return { ok: true };

	if (parsed.protocol === "http:") {
		return isLoopbackHost(parsed.hostname)
			? { ok: true }
			: { ok: false, reason: "insecure-scheme" };
	}

	return { ok: true };
}

/**
 * Whether a requested redirect URI is the one a client registered. Exact string
 * equality, with one exception: a loopback URI matches another loopback URI that
 * differs only in port, since a native app takes whatever port the system gives it.
 *
 * @param registered - The URI as it was written on the client's record.
 * @param requested - The URI an incoming request presented.
 * @returns Whether the requested URI is the registered one.
 */
export function redirectUriMatches(registered: string, requested: string): boolean {
	if (registered === requested) return true;

	let registeredUrl = tryParseUrl(registered);
	let requestedUrl = tryParseUrl(requested);
	if (!registeredUrl || !requestedUrl) return false;

	if (!isLoopbackHost(registeredUrl.hostname) || !isLoopbackHost(requestedUrl.hostname))
		return false;

	return (
		registeredUrl.protocol === requestedUrl.protocol &&
		registeredUrl.hostname === requestedUrl.hostname &&
		registeredUrl.pathname === requestedUrl.pathname &&
		registeredUrl.search === requestedUrl.search
	);
}

/** Whether an auth method matches what a client of this kind may present. */
function isAuthMethodValidForKind(method: TokenEndpointAuthMethod, kind: ClientKind): boolean {
	if (kind === "public") return method === "none";
	return method === "client_secret_basic" || method === "client_secret_post";
}

/** The editable fields {@link registerClient} and {@link updateClient} both validate as one set. */
interface ClientRecordInput {
	kind: ClientKind;
	redirectUris: string[];
	postLogoutRedirectUris: string[];
	grantTypes: string[];
	responseTypes: string[];
	tokenEndpointAuthMethod: TokenEndpointAuthMethod;
}

/** The refusals {@link registerClient} and {@link updateClient} share, from validating the record. */
export type ClientRecordValidationFailure =
	| {
			ok: false;
			reason: "invalid-redirect-uri";
			uri: string;
			detail: RedirectUriValidationFailureReason;
	  }
	| {
			ok: false;
			reason: "invalid-post-logout-redirect-uri";
			uri: string;
			detail: RedirectUriValidationFailureReason;
	  }
	| { ok: false; reason: "invalid-grant-type"; value: string }
	| { ok: false; reason: "invalid-response-type"; value: string }
	| { ok: false; reason: "invalid-auth-method"; method: TokenEndpointAuthMethod; kind: ClientKind };

/** Validates every redirect URI, grant type, response type and auth method in one record. */
function validateClientRecord(
	input: ClientRecordInput,
): { ok: true } | ClientRecordValidationFailure {
	for (let uri of input.redirectUris) {
		let validated = validateRedirectUri(uri);
		if (!validated.ok)
			return { ok: false, reason: "invalid-redirect-uri", uri, detail: validated.reason };
	}

	for (let uri of input.postLogoutRedirectUris) {
		let validated = validateRedirectUri(uri);
		if (!validated.ok) {
			return {
				ok: false,
				reason: "invalid-post-logout-redirect-uri",
				uri,
				detail: validated.reason,
			};
		}
	}

	for (let value of input.grantTypes) {
		if (!(GRANT_TYPES as readonly string[]).includes(value)) {
			return { ok: false, reason: "invalid-grant-type", value };
		}
	}

	for (let value of input.responseTypes) {
		if (!(RESPONSE_TYPES as readonly string[]).includes(value)) {
			return { ok: false, reason: "invalid-response-type", value };
		}
	}

	if (!isAuthMethodValidForKind(input.tokenEndpointAuthMethod, input.kind)) {
		return {
			ok: false,
			reason: "invalid-auth-method",
			method: input.tokenEndpointAuthMethod,
			kind: input.kind,
		};
	}

	return { ok: true };
}

/** A client's whole record, in the API's own camelCase, as every RPC method hands it back. */
export interface ClientRecord {
	id: string;
	name: string;
	kind: ClientKind;
	redirectUris: string[];
	postLogoutRedirectUris: string[];
	grantTypes: string[];
	responseTypes: string[];
	scopes: string[];
	tokenEndpointAuthMethod: TokenEndpointAuthMethod;
	requireConsent: boolean;
	createdAt: number;
	updatedAt: number;
	disabledAt: number | null;
}

/** Maps a stored row's snake_case columns to the API's camelCase record. */
function toClientRecord(row: ClientRow): ClientRecord {
	return {
		id: row.id,
		name: row.name,
		kind: row.kind as ClientKind,
		redirectUris: row.redirect_uris as string[],
		postLogoutRedirectUris: row.post_logout_redirect_uris as string[],
		grantTypes: row.grant_types as string[],
		responseTypes: row.response_types as string[],
		scopes: row.scopes as string[],
		tokenEndpointAuthMethod: row.token_endpoint_auth_method as TokenEndpointAuthMethod,
		requireConsent: row.require_consent,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		disabledAt: row.disabled_at,
	};
}

/** Mints a secret, stores only its hash and hint, and hands back the plaintext once. */
async function mintSecret(
	db: Database,
	clientId: string,
	now: number,
): Promise<{ id: string; secret: string }> {
	let secret = randomToken({ bytes: 32, prefix: "csec" });
	let hashed = await password.hash(secret);
	if (isFailure(hashed)) throw new Error("client secret hashing failed");

	let id = clientSecretRowId(generateUUID()).toString();

	await db.create(clientSecrets, {
		id,
		client_id: clientId,
		hash: hashed.data,
		hint: secret.slice(-4),
		created_at: now,
		last_used_at: null,
		expires_at: null,
	});

	return { id, secret };
}

/** Every secret still good to verify for a client: no `expires_at` yet, or one still ahead. */
async function liveSecretsFor(
	db: Database,
	clientId: string,
	now: number,
): Promise<ClientSecretRow[]> {
	return db.findMany(clientSecrets, {
		where: and(eq("client_id", clientId), or(isNull("expires_at"), gt("expires_at", now))),
	});
}

let ClientKindSchema = s.enum_(["confidential", "public"] as const);
let AuthMethodSchema = s.enum_(["client_secret_basic", "client_secret_post", "none"] as const);

export interface RegisterClientInput {
	name: string;
	kind: ClientKind;
	redirectUris: string[];
	postLogoutRedirectUris: string[];
	grantTypes: string[];
	responseTypes: string[];
	scopes: string[];
	tokenEndpointAuthMethod: TokenEndpointAuthMethod;
	requireConsent: boolean;
}

export type RegisterClientResult =
	| { ok: true; client: ClientRecord; secret: string | null }
	| ClientRecordValidationFailure;

let RegisterClientSchema = s.object({
	name: s.string(),
	kind: ClientKindSchema,
	redirectUris: s.array(s.string()),
	postLogoutRedirectUris: s.array(s.string()),
	grantTypes: s.array(s.string()),
	responseTypes: s.array(s.string()),
	scopes: s.array(s.string()),
	tokenEndpointAuthMethod: AuthMethodSchema,
	requireConsent: s.boolean(),
});

/**
 * Validates and writes a new client record, minting its first secret when it is
 * confidential. A public client mints none: it has nothing to keep, and PKCE stands
 * in for what a secret would otherwise prove.
 *
 * @param db - The tenant's database.
 * @param input - The whole record to register.
 * @returns The new record and the one-time plaintext secret (`null` for a public
 * client), or which rule refused the record.
 */
export async function registerClient(
	db: Database,
	input: RegisterClientInput,
): Promise<RegisterClientResult> {
	let parsed = s.parse(RegisterClientSchema, input);

	let validated = validateClientRecord(parsed);
	if (!validated.ok) return validated;

	let now = Date.now();
	let id = clientRowId(generateUUID()).toString();

	await db.create(clients, {
		id,
		name: parsed.name,
		kind: parsed.kind,
		redirect_uris: parsed.redirectUris,
		post_logout_redirect_uris: parsed.postLogoutRedirectUris,
		grant_types: parsed.grantTypes,
		response_types: parsed.responseTypes,
		scopes: parsed.scopes,
		token_endpoint_auth_method: parsed.tokenEndpointAuthMethod,
		require_consent: parsed.requireConsent,
		created_at: now,
		updated_at: now,
		disabled_at: null,
	});

	let secret: string | null = null;
	if (parsed.kind === "confidential") secret = (await mintSecret(db, id, now)).secret;

	let row = await db.find(clients, { id });
	if (!row) throw new Error("client row missing immediately after its own create");

	await writeAuditEvent(db, {
		action: "client.created",
		actor: PLATFORM_ACTOR,
		targetType: "client",
		targetId: id,
		outcome: "succeeded",
		detail: { name: parsed.name, kind: parsed.kind },
	});

	return { ok: true, client: toClientRecord(row), secret };
}

export interface UpdateClientInput {
	clientId: string;
	name: string;
	kind: ClientKind;
	redirectUris: string[];
	postLogoutRedirectUris: string[];
	grantTypes: string[];
	responseTypes: string[];
	scopes: string[];
	tokenEndpointAuthMethod: TokenEndpointAuthMethod;
	requireConsent: boolean;
}

export type UpdateClientResult =
	| { ok: true; client: ClientRecord }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "kind-immutable" }
	| ClientRecordValidationFailure;

let UpdateClientSchema = s.object({
	clientId: s.string(),
	name: s.string(),
	kind: ClientKindSchema,
	redirectUris: s.array(s.string()),
	postLogoutRedirectUris: s.array(s.string()),
	grantTypes: s.array(s.string()),
	responseTypes: s.array(s.string()),
	scopes: s.array(s.string()),
	tokenEndpointAuthMethod: AuthMethodSchema,
	requireConsent: s.boolean(),
});

/**
 * Replaces a client's editable fields as one set, so a redirect list is never
 * half-written across two calls. Refuses a change to `kind`, since that changes what
 * the token endpoint demands of code already deployed under the client's current one.
 *
 * @param db - The tenant's database.
 * @param input - The client to update and its whole new editable record.
 * @returns The updated record, or which rule refused the update.
 */
export async function updateClient(
	db: Database,
	input: UpdateClientInput,
): Promise<UpdateClientResult> {
	let parsed = s.parse(UpdateClientSchema, input);

	let existing = await db.find(clients, { id: parsed.clientId });
	if (!existing) return { ok: false, reason: "not-found" };
	if (existing.kind !== parsed.kind) return { ok: false, reason: "kind-immutable" };

	let validated = validateClientRecord(parsed);
	if (!validated.ok) return validated;

	await db.update(
		clients,
		{ id: parsed.clientId },
		{
			name: parsed.name,
			redirect_uris: parsed.redirectUris,
			post_logout_redirect_uris: parsed.postLogoutRedirectUris,
			grant_types: parsed.grantTypes,
			response_types: parsed.responseTypes,
			scopes: parsed.scopes,
			token_endpoint_auth_method: parsed.tokenEndpointAuthMethod,
			require_consent: parsed.requireConsent,
			updated_at: Date.now(),
		},
	);

	let row = await db.find(clients, { id: parsed.clientId });
	if (!row) throw new Error("client row missing immediately after its own update");

	await writeAuditEvent(db, {
		action: "client.updated",
		actor: PLATFORM_ACTOR,
		targetType: "client",
		targetId: parsed.clientId,
		outcome: "succeeded",
	});

	return { ok: true, client: toClientRecord(row) };
}

export interface RotateClientSecretInput {
	clientId: string;
	/** How many days the incumbent keeps verifying once the successor is minted; capped at 30. */
	windowDays?: number;
}

export type RotateClientSecretResult =
	| { ok: true; secretId: string; secret: string; incumbentExpiresAt: number | null }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "not-confidential" }
	| { ok: false; reason: "too-many-live-secrets" };

let RotateClientSecretSchema = s.object({
	clientId: s.string(),
	windowDays: s.optional(s.number()),
});

/**
 * Mints a successor secret and opens the overlap on the incumbent in one call: the
 * incumbent — the live secret with no `expires_at` yet — is stamped with one, and the
 * new secret takes its place with none of its own. Refuses a third secret while two
 * are already live, the ceiling both may verify under at once.
 *
 * @param db - The tenant's database.
 * @param input - The client to rotate, and how many days the incumbent's window lasts.
 * @returns The new secret and when the incumbent now expires, or why rotation was
 * refused.
 */
export async function rotateClientSecret(
	db: Database,
	input: RotateClientSecretInput,
): Promise<RotateClientSecretResult> {
	let parsed = s.parse(RotateClientSecretSchema, input);

	let client = await db.find(clients, { id: parsed.clientId });
	if (!client) return { ok: false, reason: "not-found" };
	if (client.kind !== "confidential") return { ok: false, reason: "not-confidential" };

	let now = Date.now();
	let live = await liveSecretsFor(db, parsed.clientId, now);
	if (live.length >= MAX_LIVE_SECRETS) return { ok: false, reason: "too-many-live-secrets" };

	let windowDays = Math.min(
		parsed.windowDays ?? DEFAULT_ROTATION_WINDOW_DAYS,
		MAX_ROTATION_WINDOW_DAYS,
	);
	let incumbent = live.find((row) => row.expires_at === null);

	let incumbentExpiresAt: number | null = null;
	if (incumbent) {
		incumbentExpiresAt = now + windowDays * 24 * 60 * 60 * 1000;
		await db.update(clientSecrets, { id: incumbent.id }, { expires_at: incumbentExpiresAt });
	}

	let minted = await mintSecret(db, parsed.clientId, now);

	await writeAuditEvent(db, {
		action: "client.secret.rotated",
		actor: PLATFORM_ACTOR,
		targetType: "client",
		targetId: parsed.clientId,
		outcome: "succeeded",
		detail: { secretId: minted.id },
	});

	return { ok: true, secretId: minted.id, secret: minted.secret, incumbentExpiresAt };
}

export interface RevokeClientSecretInput {
	clientId: string;
	secretId: string;
}

export type RevokeClientSecretResult =
	| { ok: true }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "last-live-secret" };

let RevokeClientSecretSchema = s.object({ clientId: s.string(), secretId: s.string() });

/**
 * Closes one secret's window immediately by stamping its `expires_at` at the current
 * time, the same state a rotation's incumbent reaches at the end of its overlap.
 * Refuses to take a confidential client's last live secret, which would leave it
 * unable to authenticate at all.
 *
 * @param db - The tenant's database.
 * @param input - The client the secret belongs to, and the secret to revoke.
 * @returns Success, or why the revocation was refused.
 */
export async function revokeClientSecret(
	db: Database,
	input: RevokeClientSecretInput,
): Promise<RevokeClientSecretResult> {
	let parsed = s.parse(RevokeClientSecretSchema, input);

	let secret = await db.findOne(clientSecrets, {
		where: { id: parsed.secretId, client_id: parsed.clientId },
	});
	if (!secret) return { ok: false, reason: "not-found" };

	let now = Date.now();
	let isLive = secret.expires_at === null || secret.expires_at > now;

	if (isLive) {
		let liveCount = await db.count(clientSecrets, {
			where: and(eq("client_id", parsed.clientId), or(isNull("expires_at"), gt("expires_at", now))),
		});
		if (liveCount <= 1) return { ok: false, reason: "last-live-secret" };
	}

	await db.update(clientSecrets, { id: secret.id }, { expires_at: now });

	await writeAuditEvent(db, {
		action: "client.secret.revoked",
		actor: PLATFORM_ACTOR,
		targetType: "client",
		targetId: parsed.clientId,
		outcome: "succeeded",
		detail: { secretId: parsed.secretId },
	});

	return { ok: true };
}

export interface SweepExpiredClientSecretsInput {
	now?: number;
	batchSize?: number;
}

/** How much of the sweep's work this call did, and whether another call is still owed one. */
export interface SweepExpiredClientSecretsResult {
	deleted: number;
	more: boolean;
}

let SweepExpiredClientSecretsSchema = s.object({
	now: s.optional(s.number()),
	batchSize: s.optional(s.number()),
});

/**
 * Deletes secrets past their window, in one bounded batch, for the scheduled handler
 * driving retention. A row with no `expires_at`, or one still ahead, is never a
 * candidate — the overlap has to close before the row that carried it goes.
 *
 * @param db - The tenant's database.
 * @param input - The clock to sweep against, and how many rows one call may remove.
 * @returns How many rows this call deleted, and whether the batch was full — a caller
 * sees `more: true` and runs the sweep again.
 */
export async function sweepExpiredClientSecrets(
	db: Database,
	input: SweepExpiredClientSecretsInput = {},
): Promise<SweepExpiredClientSecretsResult> {
	let parsed = s.parse(SweepExpiredClientSecretsSchema, input);
	let now = parsed.now ?? Date.now();
	let batchSize = parsed.batchSize ?? SWEEP_BATCH_SIZE;

	let batch = await db.findMany(clientSecrets, {
		where: lt("expires_at", now),
		orderBy: ["expires_at", "asc"],
		limit: batchSize,
	});

	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(clientSecrets, {
		where: inList(
			"id",
			batch.map((row) => row.id),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === batchSize };
}

export type DisableClientResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Marks a client disabled, for the authorization endpoint to refuse it once that
 * endpoint exists to read this column.
 *
 * @param db - The tenant's database.
 * @param input - The client to disable.
 * @returns Success, or that no such client exists.
 */
export async function disableClient(
	db: Database,
	input: { clientId: string },
): Promise<DisableClientResult> {
	let client = await db.find(clients, { id: input.clientId });
	if (!client) return { ok: false, reason: "not-found" };

	await db.update(
		clients,
		{ id: input.clientId },
		{ disabled_at: Date.now(), updated_at: Date.now() },
	);

	await writeAuditEvent(db, {
		action: "client.disabled",
		actor: PLATFORM_ACTOR,
		targetType: "client",
		targetId: input.clientId,
		outcome: "succeeded",
	});

	return { ok: true };
}

export type DeleteClientResult = { ok: true } | { ok: false; reason: "not-found" };

/**
 * Deletes a client and its secrets — everything a client owns today. A caller that
 * also knows about a client's consents and issued tokens deletes those first, the way
 * `deleteSubject`'s own caller deletes a subject's passwords and passkeys before this
 * kind of call.
 *
 * @param db - The tenant's database.
 * @param input - The client to delete.
 * @returns Success, or that no such client exists.
 */
export async function deleteClient(
	db: Database,
	input: { clientId: string },
): Promise<DeleteClientResult> {
	let client = await db.find(clients, { id: input.clientId });
	if (!client) return { ok: false, reason: "not-found" };

	await db.deleteMany(clientSecrets, { where: { client_id: input.clientId } });
	await db.delete(clients, { id: input.clientId });

	await writeAuditEvent(db, {
		action: "client.deleted",
		actor: PLATFORM_ACTOR,
		targetType: "client",
		targetId: input.clientId,
		outcome: "succeeded",
	});

	return { ok: true };
}

export interface ListClientsInput {
	cursor?: string | null;
	limit?: number;
}

/** One client as a dashboard's list renders it. */
export interface ClientSummary {
	id: string;
	name: string;
	kind: ClientKind;
	tokenEndpointAuthMethod: TokenEndpointAuthMethod;
	createdAt: number;
	disabledAt: number | null;
}

export type ListClientsResult =
	| { ok: true; clients: ClientSummary[]; cursors: KeysetCursors }
	| { ok: false; reason: "bad-cursor" };

let ListClientsSchema = s.object({
	cursor: s.optional(s.nullable(s.string())),
	limit: s.optional(s.number()),
});

/**
 * A page of the tenant's clients, newest first, for the dashboard's client list.
 *
 * @param db - The tenant's database.
 * @param input - Where to page from.
 * @returns A page of client summaries and the cursors around it, or that the given
 * cursor no longer matches this ordering.
 */
export async function listClients(
	db: Database,
	input: ListClientsInput = {},
): Promise<ListClientsResult> {
	let parsed = s.parse(ListClientsSchema, input);

	let query = db
		.query(clients)
		.select("id", "name", "kind", "token_endpoint_auth_method", "created_at", "disabled_at");

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
		clients: page.data.items.map((row) => ({
			id: row.id,
			name: row.name,
			kind: row.kind as ClientKind,
			tokenEndpointAuthMethod: row.token_endpoint_auth_method as TokenEndpointAuthMethod,
			createdAt: row.created_at,
			disabledAt: row.disabled_at,
		})),
		cursors: page.data.cursors,
	};
}

export type VerifyClientSecretResult = { ok: true } | { ok: false };

/**
 * Checks a presented secret against every one of a client's live secrets, so a
 * rotation in progress is invisible to whichever one a caller still holds. Updates
 * `last_used_at` and rehashes past policy on the secret that matched, the same as a
 * password verify does for a password hash.
 *
 * Not an RPC method itself: `exchangeCode` and the refresh exchange call this inside
 * the operation that already resolves the client, rather than checking a secret in a
 * round trip of its own.
 *
 * @param db - The tenant's database.
 * @param input - The client presenting a secret, and the secret itself.
 * @returns Whether the secret matched one of the client's live secrets.
 */
export async function verifyClientSecret(
	db: Database,
	input: { clientId: string; secret: string },
): Promise<VerifyClientSecretResult> {
	let now = Date.now();
	let live = await liveSecretsFor(db, input.clientId, now);

	for (let row of live) {
		let verified = await password.verify(row.hash, input.secret);
		if (isFailure(verified) || !verified.data) continue;

		await db.update(clientSecrets, { id: row.id }, { last_used_at: now });

		if (password.needsRehash(row.hash)) {
			let rehashed = await password.hash(input.secret);
			if (isSuccess(rehashed))
				await db.update(clientSecrets, { id: row.id }, { hash: rehashed.data });
		}

		return { ok: true };
	}

	return { ok: false };
}
