/**
 * Pushed Authorization Requests (RFC 9126): the `pushed_authorization_requests` table, the
 * one-time `request_uri` a pushed request is stored under, and redeeming it at
 * `/authorize`, which deletes the row so the same reference never authorizes twice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { and, column as c, eq, gt, inList, lt, table } from "remix/data-table";

import type { AuthScheme } from "~/app/models/tenant/tokens";

import { validateAuthorizationRequest } from "~/app/models/tenant/authorization";
import { clients } from "~/app/models/tenant/clients";
import { verifyRequestObject } from "~/app/models/tenant/request-objects";
import { authenticateClient } from "~/app/models/tenant/tokens";

/** The URN prefix RFC 9126 §2.2 registers for a reference the authorization server minted. */
export const REQUEST_URI_PREFIX = "urn:ietf:params:oauth:request_uri:";

/** How long a pushed request waits for its `/authorize` call, inside the 5–600 s range RFC 9126 §2.2 suggests. */
export const PUSHED_REQUEST_TTL_SECONDS = 60;

/** How many expired rows one sweep call removes before reporting back to its caller. */
const SWEEP_BATCH_SIZE = 500;

/** Form members that authenticate the client at the PAR endpoint and say nothing about the request itself (§2.1). */
const CLIENT_AUTHENTICATION_PARAMETERS = [
	"client_secret",
	"client_assertion",
	"client_assertion_type",
];

/** A pushed authorization request, waiting for the one `/authorize` call that redeems it. */
export const pushedAuthorizationRequests = table({
	name: "pushed_authorization_requests",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		client_id: c.text(),
		parameters: c.json(),
		created_at: c.integer(),
		expires_at: c.integer(),
	},
});

/** The row id a `request_uri` is stored under: its SHA-256, so the table holds no usable reference. */
async function rowIdFor(requestUri: string): Promise<string> {
	let hashed = await sha256(requestUri);
	if (isFailure(hashed)) throw new Error("request_uri hashing failed");
	return Hex.encode(hashed.data);
}

export interface PushAuthorizationRequestInput {
	clientId: string;
	clientSecret: string | null;
	authScheme: AuthScheme;
	/** Every form member the client posted, client authentication members included. */
	parameters: Record<string, string>;
	issuer: string;
	now: number;
}

/** The minted reference, or the token-endpoint-shaped error RFC 9126 §2.3 answers with. */
export type PushAuthorizationRequestResult =
	| { kind: "pushed"; requestUri: string; expiresIn: number }
	| { kind: "error"; status: 400 | 401; error: string; description: string };

let PushAuthorizationRequestSchema = s.object({
	clientId: s.string(),
	clientSecret: s.nullable(s.string()),
	authScheme: s.enum_(["basic", "post", "none"] as const),
	parameters: s.record(s.string(), s.string()),
	issuer: s.string(),
	now: s.number(),
});

/**
 * Authenticates the client as the token endpoint would, validates the request exactly
 * as `/authorize` would — from the signed request object alone when one is posted — and
 * stores the validated parameters under a fresh one-time `request_uri`.
 *
 * @param db - The tenant's database.
 * @param input - The client's credentials, every posted form member, the tenant's issuer, and the clock.
 * @returns The `request_uri` and its lifetime in seconds, or the error to answer the client with.
 */
export async function pushAuthorizationRequest(
	db: Database,
	input: PushAuthorizationRequestInput,
): Promise<PushAuthorizationRequestResult> {
	let parsed = s.parse(PushAuthorizationRequestSchema, input);

	let authenticated = await authenticateClient(db, parsed);
	if (!authenticated.ok) {
		return {
			kind: "error",
			status: authenticated.status,
			error: "invalid_client",
			description: authenticated.description,
		};
	}

	if (parsed.parameters.request_uri !== undefined) {
		return {
			kind: "error",
			status: 400,
			error: "invalid_request",
			description: "request_uri may not be pushed.",
		};
	}

	let parameters: Record<string, string>;
	let requestObject = parsed.parameters.request;
	if (requestObject !== undefined) {
		let verified = await verifyRequestObject(db, {
			token: requestObject,
			clientId: parsed.clientId,
			issuer: parsed.issuer,
			now: parsed.now,
		});
		if (!verified.ok) {
			return {
				kind: "error",
				status: 400,
				error: "invalid_request_object",
				description: verified.description,
			};
		}
		parameters = verified.parameters;
	} else {
		parameters = { ...parsed.parameters, client_id: parsed.clientId };
		for (let name of CLIENT_AUTHENTICATION_PARAMETERS) delete parameters[name];
	}

	let validated = await validateAuthorizationRequest(db, { parameters, now: parsed.now });
	if (!validated.ok) {
		return {
			kind: "error",
			status: 400,
			error: validated.failure.error,
			description: validated.failure.description,
		};
	}

	let requestUri = `${REQUEST_URI_PREFIX}${randomToken({ bytes: 32 })}`;

	await db.create(pushedAuthorizationRequests, {
		id: await rowIdFor(requestUri),
		client_id: parsed.clientId,
		parameters,
		created_at: parsed.now,
		expires_at: parsed.now + PUSHED_REQUEST_TTL_SECONDS * 1000,
	});

	return { kind: "pushed", requestUri, expiresIn: PUSHED_REQUEST_TTL_SECONDS };
}

export interface RedeemPushedAuthorizationRequestInput {
	requestUri: string;
	/** The `client_id` the `/authorize` call named; it must be the client that pushed the request. */
	clientId: string;
	now: number;
}

/** The pushed parameters, or that the reference is unknown, expired, already redeemed or another client's. */
export type RedeemPushedAuthorizationRequestResult =
	| { ok: true; parameters: Record<string, string> }
	| { ok: false };

let RedeemPushedAuthorizationRequestSchema = s.object({
	requestUri: s.string(),
	clientId: s.string(),
	now: s.number(),
});

/**
 * Redeems a `request_uri` with one conditional delete, so of two concurrent calls only
 * one finds the row. A call naming another client leaves the row for the client that
 * pushed it.
 *
 * @param db - The tenant's database.
 * @param input - The reference, the client presenting it, and the clock to check its expiry against.
 * @returns The parameters the client pushed, or that the reference no longer authorizes anything.
 */
export async function redeemPushedAuthorizationRequest(
	db: Database,
	input: RedeemPushedAuthorizationRequestInput,
): Promise<RedeemPushedAuthorizationRequestResult> {
	let parsed = s.parse(RedeemPushedAuthorizationRequestSchema, input);
	if (!parsed.requestUri.startsWith(REQUEST_URI_PREFIX)) return { ok: false };

	let id = await rowIdFor(parsed.requestUri);
	let row = await db.find(pushedAuthorizationRequests, { id });
	if (!row) return { ok: false };

	let deleted = await db.deleteMany(pushedAuthorizationRequests, {
		where: and(eq("id", id), eq("client_id", parsed.clientId), gt("expires_at", parsed.now)),
	});
	if (deleted.affectedRows !== 1) return { ok: false };

	return { ok: true, parameters: row.parameters as Record<string, string> };
}

/**
 * Whether a client must start every authorization request through the PAR endpoint:
 * its own `require_pushed_authorization_requests`, or the tenant's.
 *
 * @param db - The tenant's database.
 * @param input - The client named, and whether the tenant requires PAR of every client.
 * @returns Whether a request arriving at `/authorize` without a pushed `request_uri` is refused.
 */
export async function requiresPushedAuthorizationRequests(
	db: Database,
	input: { clientId: string; tenantRequires: boolean },
): Promise<boolean> {
	if (input.tenantRequires) return true;
	let client = await db.find(clients, { id: input.clientId });
	return client?.require_pushed_authorization_requests ?? false;
}

/** How much of the sweep's work this call did, and whether another call is still owed one. */
export interface SweepExpiredPushedAuthorizationRequestsResult {
	deleted: number;
	more: boolean;
}

/**
 * Deletes pushed requests whose minute ran out with no `/authorize` call redeeming
 * them, in one bounded batch, for the scheduled handler driving retention.
 *
 * @param db - The tenant's database.
 * @param input - The clock to sweep against, and how many rows one call may remove.
 * @returns How many rows this call deleted, and whether the batch was full — a caller sees `more: true` and runs the sweep again.
 */
export async function sweepExpiredPushedAuthorizationRequests(
	db: Database,
	input: { now?: number; batchSize?: number } = {},
): Promise<SweepExpiredPushedAuthorizationRequestsResult> {
	let now = input.now ?? Date.now();
	let batchSize = input.batchSize ?? SWEEP_BATCH_SIZE;

	let batch = await db.findMany(pushedAuthorizationRequests, {
		where: lt("expires_at", now),
		orderBy: ["expires_at", "asc"],
		limit: batchSize,
	});

	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(pushedAuthorizationRequests, {
		where: inList(
			"id",
			batch.map((row) => row.id),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === batchSize };
}
