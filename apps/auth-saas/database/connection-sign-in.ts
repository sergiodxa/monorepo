/**
 * The social identity provider sign-in flow: `beginConnectionSignIn` starts a login
 * against a connection's provider, `completeConnectionSignIn` spends its callback, maps
 * the claims it returned, resolves or mints the subject they belong to, and opens a
 * session; `resumeConnectionSignIn` spends the single-use ticket that hands the
 * completed sign-in back to the host the flow actually started on. Building on the
 * catalog and configuration `connections.ts` already owns, never redesigning it.
 *
 * `RelyingParty` from `@sdxc/auth` is built around a live `Request`/`Response` and a
 * session store with synchronous `get`/`set`/`unset` — a shape a tenant Durable
 * Object's RPC methods, which take and return plain serializable values, do not have
 * on hand. `TransactionStore` below is the adapter: an in-memory store satisfying
 * that interface for the one call it is used in, with `connection_transactions`
 * doing the actual carrying across the two separate invocations `authorize` and
 * `callback` run in. A synthetic `Request` stands in for the browser's real one,
 * built from the platform's own knowledge of where a call answers from, and
 * `authorize`'s `Response` is read for its `Location` header, never handed back
 * whole, since a `Response` does not itself cross the boundary either.
 *
 * Only a `kind: "oidc"` connection reaches a provider through here. `RelyingParty`'s
 * own `callback` requires a token response to carry an `id_token` — the one claim
 * a pure OAuth2 provider, publishing no discovery document and no ID token, never
 * sends — so a `kind: "oauth2"` connection is refused before it ever asks a
 * provider for anything.
 *
 * `callback` no longer assumes the access token it gets back is a JWT: `@sdxc/auth`
 * decodes it where it can and answers `null` where it cannot, which is the common
 * case for a real third-party provider's access token — OAuth2 leaves its shape
 * entirely to the issuer, and none of this catalog's real providers issue one that
 * decodes as a JWT. This module never reads the decoded form; it reads the token's
 * own lifetime from `grant.expiresAt` (derived from the token response's own
 * `expires_in`, not a JWT's `exp` claim) rather than from the access token itself.
 * Sealing and serving the access token for a later bearer-token read is
 * `getProviderToken`'s job, not built in this pass — `grant.accessTokenRaw` is
 * already the right value for it to seal once it exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AuthSession } from "@sdxc/auth/auth-session";
import type { Database, TableRow } from "remix/data-table";

import { AuthError } from "@sdxc/auth/auth-error";
import { Issuer } from "@sdxc/auth/issuer";
import { RelyingParty } from "@sdxc/auth/relying-party";
import { Hex, open, seal, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";
import { and, column as c, eq, inList, lt, table } from "remix/data-table";

import type { ConnectionMappingRow, ConnectionRow } from "./connections";
import type { OpenSessionMetering } from "./sessions";
import type { SubjectProfile } from "./subjects";

import { writeAuditEvent } from "./audit-events";
import {
	buildCallbackUrl,
	connectionMappings,
	connections,
	connectionTransactions,
	STANDARD_PROFILE_TARGETS,
} from "./connections";
import { openSession, sessions } from "./sessions";
import { createSubject, updateSubject } from "./subjects";

/** How long a login stays completable once `beginConnectionSignIn` starts it. */
const CONNECTION_TRANSACTION_TTL_MS = 10 * 60 * 1000;

/**
 * How long a handoff ticket names its row. Short on purpose: the browser is
 * redirected the moment the ticket is minted, so a real sign-in spends it in a
 * fraction of a second, and thirty seconds already covers a slow redirect.
 */
const HANDOFF_TICKET_TTL_MS = 30 * 1000;

/** How many expired rows one sweep call removes before reporting back to its caller. */
const SWEEP_BATCH_SIZE = 500;

/**
 * The session key `RelyingParty` itself writes its login transaction under,
 * read directly off `packages/auth/src/relying-party.ts` since the package keeps
 * it to itself. `beginConnectionSignIn` never needs to know it — it only reads
 * back whatever `TransactionStore` captured — but `completeConnectionSignIn` has
 * to seed a fresh store under this exact key before `callback` ever reads it,
 * since that call is a separate Durable Object invocation from the one that
 * wrote it.
 */
const RELYING_PARTY_TRANSACTION_KEY = "auth:transaction";

/**
 * The identity a subject signed in through once: which connection, which provider
 * subject, and the sealed provider tokens a later read opens. Reusing this row on a
 * returning sign-in is what keeps one provider account resolving to one platform
 * subject rather than minting a new one every time.
 */
export const connectionIdentities = table({
	name: "connection_identities",
	primaryKey: ["connection_id", "provider_subject"],
	columns: {
		connection_id: c.text(),
		provider_subject: c.text(),
		subject_id: c.text(),
		access_token_sealed: c.text().nullable(),
		refresh_token_sealed: c.text().nullable(),
		token_expires_at: c.integer().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/**
 * The single-use, thirty-second ticket that hands a completed sign-in back to the
 * host it actually started on. It names the session already opened for the
 * subject rather than authorizing anything itself — spending it is
 * {@link resumeConnectionSignIn}'s whole job.
 */
export const connectionHandoffs = table({
	name: "connection_handoffs",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		ticket_hash: c.text(),
		subject_id: c.text(),
		session_id: c.text(),
		session_token: c.text(),
		hostname: c.text(),
		authorization_request_id: c.text().nullable(),
		expires_at: c.integer(),
	},
});

export type ConnectionIdentityRow = TableRow<typeof connectionIdentities>;
export type ConnectionHandoffRow = TableRow<typeof connectionHandoffs>;

/** Mints a `contx` id for a new `connection_transactions` row. */
const connectionTransactionRowId = typeid("contx");

/** Mints a `conho` id for a new `connection_handoffs` row. */
const connectionHandoffRowId = typeid("conho");

/**
 * A synthetic `AuthSession.Store` standing in for the browser's cookie session,
 * since a Durable Object's RPC methods have no live request to carry one. `get`,
 * `set` and `unset` run against a plain in-memory map, which is enough for the one
 * call this store is built for: `RelyingParty` reads and writes the transaction
 * key synchronously within that single call, and whatever it wrote is read back
 * — or, for a fresh call answering an earlier one, seeded in — by the caller
 * around it.
 */
class TransactionStore implements AuthSession.Store {
	#values: Map<string, unknown>;

	constructor(seed: Iterable<readonly [string, unknown]> = []) {
		this.#values = new Map(seed);
	}

	get(key: string): unknown {
		return this.#values.get(key);
	}

	set(key: string, value: unknown): void {
		this.#values.set(key, value);
	}

	unset(key: string): void {
		this.#values.delete(key);
	}
}

/** Opens a connection's sealed client secret, answering `null` for one that has never held one. */
async function openClientSecret(
	sealKey: CryptoKey,
	connection: ConnectionRow,
): Promise<string | null> {
	if (!connection.client_secret_sealed) return null;

	let opened = await open(sealKey, connection.client_secret_sealed);
	if (isFailure(opened)) throw new Error("failed to open the connection's sealed client secret");

	return opened.data;
}

/**
 * Builds the relying party for one connection's sign-in flow: an `Issuer` resolved
 * through discovery from the connection's own `issuer`, sharing the isolate's memos
 * with every other login against the same provider, and a `subject` hook reading
 * the connection's own configured claim rather than assuming `sub`.
 */
function buildRelyingParty(
	connection: ConnectionRow,
	clientSecret: string | null,
	redirectUri: string,
): RelyingParty {
	let issuer = Issuer.for(connection.issuer ?? "");

	return new RelyingParty(issuer, {
		clientId: connection.client_id,
		clientSecret: clientSecret ?? undefined,
		redirectUri,
		userInfo: "when-missing",
		subject: (claims) => String(claims[connection.subject_claim] ?? claims.sub ?? ""),
	});
}

/** Which mappings take effect for a subject the sign-in is creating versus one it already resolved. */
function mappingsToApply(
	mappings: ConnectionMappingRow[],
	phase: "create" | "sign-in",
): ConnectionMappingRow[] {
	return phase === "create" ? mappings : mappings.filter((row) => row.apply === "on-every-sign-in");
}

/** Reads a mapping set's claims off the resolved claim set into a profile and an attribute map. */
function applyMappings(
	mappings: ConnectionMappingRow[],
	claims: Record<string, unknown>,
): { profile: SubjectProfile; attributes: Record<string, unknown> } {
	let profile: Record<string, unknown> = {};
	let attributes: Record<string, unknown> = {};

	for (let mapping of mappings) {
		let value = claims[mapping.source];
		if (value === undefined) continue;

		if (STANDARD_PROFILE_TARGETS.has(mapping.target)) profile[mapping.target] = value;
		else attributes[mapping.target] = value;
	}

	return { profile: profile as SubjectProfile, attributes };
}

/**
 * Writes or refreshes the identity linking one connection's provider subject to a
 * platform subject. Only the refresh token crosses this boundary as the raw string
 * a later redemption would present: `RelyingParty`'s own `Grant` hands back the
 * access token already decoded into claims rather than the wire string a bearer
 * call needs, so this pass has nothing genuine to seal there yet and leaves that
 * column `null` until a later pass has one to write.
 */
async function upsertConnectionIdentity(
	db: Database,
	sealKey: CryptoKey,
	input: {
		connectionId: string;
		providerSubject: string;
		subjectId: string;
		refreshToken: string | null;
		tokenExpiresAt: number | null;
	},
): Promise<void> {
	let refreshTokenSealed: string | null = null;

	if (input.refreshToken !== null) {
		let sealed = await seal(sealKey, input.refreshToken);
		if (isFailure(sealed)) throw new Error("failed to seal the connection's refresh token");
		refreshTokenSealed = sealed.data;
	}

	let now = Date.now();

	let existing = await db.find(connectionIdentities, {
		connection_id: input.connectionId,
		provider_subject: input.providerSubject,
	});

	if (existing) {
		await db.update(
			connectionIdentities,
			{ connection_id: input.connectionId, provider_subject: input.providerSubject },
			{
				refresh_token_sealed: refreshTokenSealed,
				token_expires_at: input.tokenExpiresAt,
				updated_at: now,
			},
		);
		return;
	}

	await db.create(connectionIdentities, {
		connection_id: input.connectionId,
		provider_subject: input.providerSubject,
		subject_id: input.subjectId,
		access_token_sealed: null,
		refresh_token_sealed: refreshTokenSealed,
		token_expires_at: input.tokenExpiresAt,
		created_at: now,
		updated_at: now,
	});
}

/** Mints a single-use handoff ticket naming a completed sign-in's session, storing only its hash. */
async function mintHandoffTicket(
	db: Database,
	input: {
		subjectId: string;
		sessionId: string;
		sessionToken: string;
		hostname: string;
		authorizationRequestId: string | null;
	},
): Promise<string> {
	let ticket = generateUUID();

	let hashed = await sha256(ticket);
	if (isFailure(hashed)) throw new Error("failed to hash the connection handoff ticket");

	await db.create(connectionHandoffs, {
		id: connectionHandoffRowId(generateUUID()).toString(),
		ticket_hash: Hex.encode(hashed.data),
		subject_id: input.subjectId,
		session_id: input.sessionId,
		session_token: input.sessionToken,
		hostname: input.hostname,
		authorization_request_id: input.authorizationRequestId,
		expires_at: Date.now() + HANDOFF_TICKET_TTL_MS,
	});

	return ticket;
}

export interface BeginConnectionSignInInput {
	slug: string;
	authorizationRequestId?: string | null;
	hostname: string;
	scopes?: string[];
	prompt?: string;
	/**
	 * The tenant's own platform-subdomain origin, the one host a provider's console
	 * was ever told about. Named apart from `hostname`, which is wherever the
	 * sign-in page actually served from and where the flow hands back to —
	 * `saveConnection` takes the same `callbackOrigin` for the identical reason:
	 * this object's own recorded issuer can drift to a custom domain, so only the
	 * caller that already knows the platform subdomain can supply it.
	 */
	callbackOrigin: string;
}

export type BeginConnectionSignInResult =
	| { ok: true; redirectUrl: string }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unsupported-connection-kind" };

let BeginConnectionSignInSchema = s.object({
	slug: s.string(),
	authorizationRequestId: s.optional(s.nullable(s.string())),
	hostname: s.string(),
	scopes: s.optional(s.array(s.string())),
	prompt: s.optional(s.string()),
	callbackOrigin: s.string(),
});

/**
 * Starts a sign-in against a connection's provider: builds the relying party,
 * asks it for the authorization redirect, and records the transaction it wrote —
 * the `state`, the nonce and the PKCE verifier `RelyingParty` mints for itself —
 * in `connection_transactions`, alongside the hostname and pending authorization
 * request this login answers back to once its callback lands.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The connection to sign in against, the pending authorization
 * request and hostname the callback answers back to, and any additional scopes
 * or `prompt` this login asks for beyond the connection's own configured scopes.
 * @returns The provider's authorization URL to redirect the browser to, or that
 * no such enabled connection exists, or that its kind has no sign-in flow yet.
 */
export async function beginConnectionSignIn(
	db: Database,
	sealKey: CryptoKey,
	input: BeginConnectionSignInInput,
): Promise<BeginConnectionSignInResult> {
	let parsed = s.parse(BeginConnectionSignInSchema, input);

	let connection = await db.findOne(connections, { where: { slug: parsed.slug } });
	if (!connection || !connection.enabled) return { ok: false, reason: "not-found" };
	if (connection.kind !== "oidc") return { ok: false, reason: "unsupported-connection-kind" };

	let clientSecret = await openClientSecret(sealKey, connection);
	let redirectUri = buildCallbackUrl(parsed.callbackOrigin, connection.slug);
	let rp = buildRelyingParty(connection, clientSecret, redirectUri);

	let scopes = Array.from(new Set([...(connection.scopes as string[]), ...(parsed.scopes ?? [])]));

	let store = new TransactionStore();
	let request = new Request(`https://${parsed.hostname}/`);

	let response = await rp.authorize(
		{ request, session: store },
		{ scopes, prompt: parsed.prompt as RelyingParty.Prompt | undefined },
	);

	let transaction = store.get(RELYING_PARTY_TRANSACTION_KEY) as
		| RelyingParty.Transaction
		| undefined;
	if (!transaction) {
		throw new Error("RelyingParty.authorize wrote no transaction to the session store");
	}

	await db.create(connectionTransactions, {
		id: connectionTransactionRowId(generateUUID()).toString(),
		connection_id: connection.id,
		state: transaction.state,
		nonce: transaction.nonce,
		verifier: transaction.codeVerifier,
		hostname: parsed.hostname,
		authorization_request_id: parsed.authorizationRequestId ?? null,
		scopes,
		expires_at: Date.now() + CONNECTION_TRANSACTION_TTL_MS,
	});

	let location = response.headers.get("location");
	if (!location) throw new Error("RelyingParty.authorize answered no redirect location");

	return { ok: true, redirectUrl: location };
}

export interface CompleteConnectionSignInInput {
	slug: string;
	callbackUrl: string;
	agent?: string | null;
}

export type CompleteConnectionSignInResult =
	| { ok: true; subjectId: string; hostname: string; handoffTicket: string }
	| { ok: false; reason: "invalid-transaction" }
	| { ok: false; reason: "unsupported-connection-kind" }
	| { ok: false; reason: "unknown-subject" }
	| { ok: false; reason: "mapping-invalid" }
	| { ok: false; reason: "authorization-failed"; code: string }
	| { ok: false; reason: "unsupported-access-token-format" }
	| { ok: false; reason: "dau_cap_reached"; day: number; subjects: number; cap: number };

let CompleteConnectionSignInSchema = s.object({
	slug: s.string(),
	callbackUrl: s.string(),
	agent: s.optional(s.nullable(s.string())),
});

/**
 * Spends a connection's callback: resolves the transaction its `state` names,
 * exchanges the code, verifies the ID token, maps the resulting claims through the
 * connection's saved mappings, resolves the platform subject they belong to — the
 * same provider subject resolving to the same platform subject on a returning
 * sign-in — seals the provider's refresh token against it, opens a session, and
 * mints the handoff ticket that carries the browser back to wherever the flow
 * actually started.
 *
 * Account linking is not built here: a connection whose `on_unknown_subject` is
 * `"refuse"` answers `unknown-subject` for a provider identity this tenant has
 * never seen rather than attempting to join it to an existing one by address —
 * that join, and the identity record it would read, belongs to a later addition.
 * Every subject this call mints instead is bare: profile columns and declared
 * attributes from the connection's own mappings, and nothing else.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The connection the callback answers, the callback URL exactly as
 * the browser reached it, and the request's `User-Agent` for the session it opens.
 * @param metering - The daily active user meter to record this sign-in against,
 * when the caller has one; omitted, no meter is touched and no sign-in is ever
 * refused for it.
 * @returns The resolved subject, the hostname the flow started on, and the
 * handoff ticket to redirect there with, or which check refused the callback.
 */
export async function completeConnectionSignIn(
	db: Database,
	sealKey: CryptoKey,
	input: CompleteConnectionSignInInput,
	metering?: OpenSessionMetering,
): Promise<CompleteConnectionSignInResult> {
	let parsed = s.parse(CompleteConnectionSignInSchema, input);

	let connection = await db.findOne(connections, { where: { slug: parsed.slug } });
	if (!connection || !connection.enabled) return { ok: false, reason: "invalid-transaction" };
	if (connection.kind !== "oidc") return { ok: false, reason: "unsupported-connection-kind" };

	let callbackUrl = new URL(parsed.callbackUrl);
	let state = callbackUrl.searchParams.get("state");
	if (!state) return { ok: false, reason: "invalid-transaction" };

	let transactionRow = await db.findOne(connectionTransactions, {
		where: and(eq("state", state), eq("connection_id", connection.id)),
	});
	if (!transactionRow) return { ok: false, reason: "invalid-transaction" };

	// Consumed the moment it is found, before its expiry is even checked, so a
	// replayed callback always finds nothing to spend — the same rule a password
	// reset ticket answers a second attempt with.
	await db.delete(connectionTransactions, { id: transactionRow.id });
	if (transactionRow.expires_at <= Date.now()) return { ok: false, reason: "invalid-transaction" };

	let clientSecret = await openClientSecret(sealKey, connection);
	let redirectUri = `${callbackUrl.origin}${callbackUrl.pathname}`;
	let rp = buildRelyingParty(connection, clientSecret, redirectUri);

	let store = new TransactionStore([
		[
			RELYING_PARTY_TRANSACTION_KEY,
			{
				state: transactionRow.state,
				codeVerifier: transactionRow.verifier,
				nonce: transactionRow.nonce,
				returnTo: "/",
				acrValues: null,
				maxAge: null,
			},
		],
	]);

	let request = new Request(parsed.callbackUrl);

	let grant: RelyingParty.Grant;

	try {
		grant = await rp.callback({ request, session: store });
	} catch (error) {
		if (error instanceof AuthError) {
			return { ok: false, reason: "authorization-failed", code: error.code };
		}

		throw error;
	}

	let mappingRows = await db.findMany(connectionMappings, {
		where: { connection_id: connection.id },
	});

	let identity = await db.find(connectionIdentities, {
		connection_id: connection.id,
		provider_subject: grant.subject,
	});

	let subjectId: string;

	if (identity) {
		subjectId = identity.subject_id;

		let refresh = applyMappings(mappingsToApply(mappingRows, "sign-in"), grant.claims);

		if (Object.keys(refresh.profile).length > 0 || Object.keys(refresh.attributes).length > 0) {
			let updated = await updateSubject(db, {
				subjectId,
				profile: refresh.profile,
				attributes: refresh.attributes,
				actor: { kind: "admin" },
			});
			if (!updated.ok) return { ok: false, reason: "mapping-invalid" };
		}
	} else {
		if (connection.on_unknown_subject === "refuse") {
			await writeAuditEvent(db, {
				action: "authentication.denied",
				actor: { type: "platform", id: "system" },
				targetType: "connection",
				targetId: connection.id,
				outcome: "denied",
				detail: { method: "social", connectionSlug: connection.slug },
			});
			return { ok: false, reason: "unknown-subject" };
		}

		let minted = applyMappings(mappingsToApply(mappingRows, "create"), grant.claims);
		let created = await createSubject(db, {
			profile: minted.profile,
			attributes: minted.attributes,
		});
		if (!created.ok) return { ok: false, reason: "mapping-invalid" };
		subjectId = created.subjectId;
	}

	await upsertConnectionIdentity(db, sealKey, {
		connectionId: connection.id,
		providerSubject: grant.subject,
		subjectId,
		refreshToken: grant.refreshToken,
		tokenExpiresAt: grant.expiresAt,
	});

	let session = await openSession(
		db,
		{ subjectId, amr: ["social"], remembered: true, userAgent: parsed.agent ?? null },
		metering,
	);
	if (!session.ok) return session;

	await writeAuditEvent(db, {
		action: "authentication.succeeded",
		actor: { type: "subject", id: subjectId },
		targetType: "subject",
		targetId: subjectId,
		outcome: "succeeded",
		context: { userAgent: parsed.agent ?? null },
		detail: { method: "social", connectionSlug: connection.slug },
	});

	let handoffTicket = await mintHandoffTicket(db, {
		subjectId,
		sessionId: session.sessionId,
		sessionToken: session.token,
		hostname: transactionRow.hostname,
		authorizationRequestId: transactionRow.authorization_request_id,
	});

	return { ok: true, subjectId, hostname: transactionRow.hostname, handoffTicket };
}

export interface ResumeConnectionSignInInput {
	ticket: string;
	hostname: string;
	agent?: string | null;
}

export type ResumeConnectionSignInResult =
	| {
			ok: true;
			subjectId: string;
			sessionId: string;
			sessionToken: string;
			authorizationRequestId: string | null;
	  }
	| { ok: false; reason: "invalid-ticket" };

let ResumeConnectionSignInSchema = s.object({
	ticket: s.string(),
	hostname: s.string(),
	agent: s.optional(s.nullable(s.string())),
});

/**
 * Spends a completed sign-in's handoff ticket on the hostname it names, so the
 * session {@link completeConnectionSignIn} already opened is handed to whichever
 * host the flow actually started on, and continues the pending authorization
 * request that flow was answering.
 *
 * @param db - The tenant's database.
 * @param input - The ticket as the redirect carried it, the hostname the resume
 * request landed on, and the request's `User-Agent`.
 * @returns The subject, session and pending authorization request the ticket
 * named, for the caller to write the session cookie and resume with, or that the
 * ticket is unknown, already spent, expired, or named a different hostname.
 */
export async function resumeConnectionSignIn(
	db: Database,
	input: ResumeConnectionSignInInput,
): Promise<ResumeConnectionSignInResult> {
	let parsed = s.parse(ResumeConnectionSignInSchema, input);

	let hashed = await sha256(parsed.ticket);
	if (isFailure(hashed)) return { ok: false, reason: "invalid-ticket" };

	let row = await db.findOne(connectionHandoffs, {
		where: { ticket_hash: Hex.encode(hashed.data) },
	});
	if (!row) return { ok: false, reason: "invalid-ticket" };

	// Spent by the first attempt regardless of what it turns out to answer, the
	// same rule a password reset ticket applies to its own row: a replay always
	// finds nothing left to spend.
	await db.delete(connectionHandoffs, { id: row.id });

	if (row.expires_at <= Date.now()) return { ok: false, reason: "invalid-ticket" };
	if (row.hostname !== parsed.hostname) return { ok: false, reason: "invalid-ticket" };

	if (parsed.agent) {
		await db.update(sessions, { id: row.session_id }, { user_agent: parsed.agent });
	}

	return {
		ok: true,
		subjectId: row.subject_id,
		sessionId: row.session_id,
		sessionToken: row.session_token,
		authorizationRequestId: row.authorization_request_id,
	};
}

export interface SweepExpiredConnectionTransactionsInput {
	now?: number;
	batchSize?: number;
}

export interface SweepExpiredConnectionTransactionsResult {
	deleted: number;
	more: boolean;
}

/**
 * Deletes connection sign-in transactions past their ten-minute window, in one
 * bounded batch, for the scheduled handler driving retention.
 *
 * @param db - The tenant's database.
 * @param input - The clock to sweep against, and how many rows one call may remove.
 * @returns How many rows this call deleted, and whether the batch was full — a
 * caller sees `more: true` and runs the sweep again.
 */
export async function sweepExpiredConnectionTransactions(
	db: Database,
	input: SweepExpiredConnectionTransactionsInput = {},
): Promise<SweepExpiredConnectionTransactionsResult> {
	let now = input.now ?? Date.now();
	let batchSize = input.batchSize ?? SWEEP_BATCH_SIZE;

	let batch = await db.findMany(connectionTransactions, {
		where: lt("expires_at", now),
		orderBy: ["expires_at", "asc"],
		limit: batchSize,
	});

	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(connectionTransactions, {
		where: inList(
			"id",
			batch.map((row) => row.id),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === batchSize };
}

export interface SweepExpiredConnectionHandoffsInput {
	now?: number;
	batchSize?: number;
}

export interface SweepExpiredConnectionHandoffsResult {
	deleted: number;
	more: boolean;
}

/**
 * Deletes handoff tickets past their thirty-second window, in one bounded batch,
 * for the scheduled handler driving retention — almost always tickets a browser
 * never came back to spend, since a real sign-in redeems one in a fraction of
 * that time.
 *
 * @param db - The tenant's database.
 * @param input - The clock to sweep against, and how many rows one call may remove.
 * @returns How many rows this call deleted, and whether the batch was full — a
 * caller sees `more: true` and runs the sweep again.
 */
export async function sweepExpiredConnectionHandoffs(
	db: Database,
	input: SweepExpiredConnectionHandoffsInput = {},
): Promise<SweepExpiredConnectionHandoffsResult> {
	let now = input.now ?? Date.now();
	let batchSize = input.batchSize ?? SWEEP_BATCH_SIZE;

	let batch = await db.findMany(connectionHandoffs, {
		where: lt("expires_at", now),
		orderBy: ["expires_at", "asc"],
		limit: batchSize,
	});

	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(connectionHandoffs, {
		where: inList(
			"id",
			batch.map((row) => row.id),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === batchSize };
}
