/**
 * The social identity provider sign-in flow: `beginConnectionSignIn` starts a login
 * against a connection's provider, `completeConnectionSignIn` spends its callback, maps
 * the claims it returned, resolves or mints the subject they belong to, and opens a
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AuthSession } from "@sdxc/auth/auth-session";
import type { Database, TableRow } from "remix/data-table";

import { AuthError } from "@sdxc/auth/auth-error";
import { Issuer } from "@sdxc/auth/issuer";
import { RelyingParty } from "@sdxc/auth/relying-party";
import { Hex, open, randomToken, seal, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";
import * as s from "remix/data-schema";
import { and, column as c, eq, inList, isNull, lt, table } from "remix/data-table";

import type { AuditActor } from "~/app/models/tenant/audit-events";
import type { ConnectionMappingRow, ConnectionRow } from "~/app/models/tenant/connections";
import type { OpenSessionMetering } from "~/app/models/tenant/sessions";
import type {
	Actor,
	LinkedIdentityState,
	SubjectIdentifierRow,
	SubjectProfile,
} from "~/app/models/tenant/subjects";
import type { EffectiveSessionPolicy } from "~/app/services/tenant/session-policy";

import {
	evaluateAutomaticLink,
	isConnectionAuthoritativeForEmail,
	mintLinkTicket,
	spendLinkTicket,
} from "~/app/models/tenant/account-linking";
import { writeAuditEvent } from "~/app/models/tenant/audit-events";
import {
	buildCallbackUrl,
	connectionMappings,
	connections,
	connectionTransactions,
	STANDARD_PROFILE_TARGETS,
} from "~/app/models/tenant/connections";
import { hasAnotherCredential } from "~/app/models/tenant/credentials";
import { openSession, sessions } from "~/app/models/tenant/sessions";
import {
	addIdentifier,
	createSubject,
	subjectIdentifiers,
	subjects,
	updateSubject,
	verifyIdentifier,
} from "~/app/models/tenant/subjects";
import { foldIdentifier } from "~/app/services/tenant/subject-identifiers";

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
 * The session key `RelyingParty` itself writes its login transaction under, read
 * directly off `packages/auth/src/relying-party.ts` since the package keeps it to
 * itself.
 */
const RELYING_PARTY_TRANSACTION_KEY = "auth:transaction";

/**
 * The identity a subject signed in through once: which connection, which provider
 * subject, and the sealed provider tokens a later read opens.
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
		provider_email: c.text().nullable(),
		provider_email_verified: c.boolean().nullable(),
		linked_by: c.enum(["automatic", "subject", "admin", "jit"] as const),
		linked_at: c.integer(),
		last_sign_in_at: c.integer().nullable(),
		granted_scopes: c.json().nullable(),
		claims_json: c.text().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/**
 * The single-use, thirty-second ticket that hands a completed sign-in back to the
 * host it actually started on.
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
 * since a Durable Object's RPC methods have no live request to carry one.
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
 * with every other login against the same provider, and a `subject` hook reading t
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
		subject(claims) {
			let claimed = claims[connection.subject_claim];
			if (typeof claimed === "string") return claimed;
			if (typeof claimed === "number") return String(claimed);
			return claims.sub ?? "";
		},
	});
}

/** Which mappings take effect for a subject the sign-in is creating versus one it already resolved. */
export function mappingsToApply(
	mappings: ConnectionMappingRow[],
	phase: "create" | "sign-in",
): ConnectionMappingRow[] {
	return phase === "create" ? mappings : mappings.filter((row) => row.apply === "on-every-sign-in");
}

/**
 * The response's own email and whether it asserted that address verified, read
 * directly off the ID token's claims rather than through the connection's
 * configurable mappings — those only ever populate profile and attribute columns,
 */
function responseEmailFromClaims(claims: RelyingParty.Grant["claims"]): {
	email: string | null;
	verified: boolean;
} {
	let email = claims.email;
	if (typeof email !== "string" || email.length === 0) return { email: null, verified: false };

	return { email, verified: claims.email_verified === true };
}

/**
 * The one `email`-kind identifier a folded address matches in this tenant, or
 * `null` for no match, more than one, or an address that fails to fold — a folded
 * address is unique to at most one subject by construction, so more than one match
 */
async function findSoleMatchingEmailIdentifier(
	db: Database,
	email: string,
): Promise<SubjectIdentifierRow | null> {
	let folded = foldIdentifier("email", email);
	if (!folded.ok) return null;

	let matches = await db.findMany(subjectIdentifiers, {
		where: and(eq("kind", "email"), eq("folded", folded.folded)),
	});

	return matches.length === 1 ? (matches[0] ?? null) : null;
}

/** Reads a mapping set's claims off the resolved claim set into a profile and an attribute map. */
export function applyMappings(
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
 * a later redemption would present: `RelyingParty`'s own `Grant` hands back the a
 */
export async function upsertConnectionIdentity(
	db: Database,
	sealKey: CryptoKey,
	input: {
		connectionId: string;
		providerSubject: string;
		subjectId: string;
		refreshToken: string | null;
		tokenExpiresAt: number | null;
		linkedBy?: "automatic" | "subject" | "admin" | "jit";
		providerEmail?: string | null;
		providerEmailVerified?: boolean | null;
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
				last_sign_in_at: now,
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
		provider_email: input.providerEmail ?? null,
		provider_email_verified: input.providerEmailVerified ?? null,
		linked_by: input.linkedBy ?? "jit",
		linked_at: now,
		last_sign_in_at: now,
		granted_scopes: null,
		claims_json: null,
		created_at: now,
		updated_at: now,
	});
}

/** Mints a single-use handoff ticket naming a completed sign-in's session, storing only its hash. */
export async function mintHandoffTicket(
	db: Database,
	input: {
		subjectId: string;
		sessionId: string;
		sessionToken: string;
		hostname: string;
		authorizationRequestId: string | null;
	},
): Promise<string> {
	let ticket = randomToken();

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
	 * was ever told about.
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
 * Starts a sign-in against a connection's provider: builds the relying party, asks
 * it for the authorization redirect, and records the transaction it wrote — the
 * `state`, the nonce and the PKCE verifier `RelyingParty` mints for itself — in
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The connection to sign in against, the pending authorization request and hostname the callback answers back to, and any additional scopes or `prompt` this login asks for beyond the connection's own configured scopes.
 * @returns The provider's authorization URL to redirect the browser to, or that no such enabled connection exists, or that its kind has no sign-in flow yet.
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
	| { ok: false; reason: "subject-blocked" }
	| { ok: false; reason: "mapping-invalid" }
	| { ok: false; reason: "authorization-failed"; code: string }
	| { ok: false; reason: "unsupported-access-token-format" }
	| { ok: false; reason: "dau_cap_reached"; day: number; subjects: number; cap: number }
	| { ok: false; reason: "link_required"; ticket: string };

let CompleteConnectionSignInSchema = s.object({
	slug: s.string(),
	callbackUrl: s.string(),
	agent: s.optional(s.nullable(s.string())),
});

/**
 * Spends a connection's callback: resolves the transaction its `state` names,
 * exchanges the code, verifies the ID token, maps the resulting claims through the
 * connection's saved mappings, resolves the platform subject they belong to — the
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The connection the callback answers, the callback URL exactly as the browser reached it, and the request's `User-Agent` for the session it opens.
 * @param metering - The daily active user meter to record this sign-in against, when the caller has one; omitted, no meter is touched and no sign-in is ever refused for it.
 * @param sessionPolicy - The tenant's own effective session policy the opened session is bound by; omitted, the platform defaults.
 * @returns The resolved subject, the hostname the flow started on, and the handoff ticket to redirect there with, or which check refused the callback.
 */
export async function completeConnectionSignIn(
	db: Database,
	sealKey: CryptoKey,
	input: CompleteConnectionSignInInput,
	metering?: OpenSessionMetering,
	sessionPolicy?: EffectiveSessionPolicy,
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
	let identityWrite: {
		linkedBy: "automatic";
		providerEmail: string | null;
		providerEmailVerified: boolean | null;
	} | null = null;

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
		let response = responseEmailFromClaims(grant.claims);

		let responseEmail: string | null = null;
		let matchedIdentifier: SubjectIdentifierRow | null = null;

		if (response.email !== null) {
			responseEmail = response.email;
			matchedIdentifier = await findSoleMatchingEmailIdentifier(db, responseEmail);
		}

		if (matchedIdentifier !== null && responseEmail !== null) {
			let matchedSubject = await db.find(subjects, { id: matchedIdentifier.subject_id });
			if (!matchedSubject) throw new Error("matched identifier names no subject");

			let connectionIsAuthoritative = await isConnectionAuthoritativeForEmail(
				db,
				connection,
				responseEmail,
			);

			let decision = evaluateAutomaticLink({
				responseEmail,
				responseEmailVerified: response.verified,
				connectionIsAuthoritative,
				connectionAutoLink: connection.auto_link,
				matchedSubject: {
					identifierVerified: matchedIdentifier.verified_at !== null,
					subjectStatus: matchedSubject.status,
				},
			});

			if (decision.outcome === "confirmed") {
				let ticket = await mintLinkTicket(db, sealKey, {
					connectionId: connection.id,
					providerSubject: grant.subject,
					subjectId: matchedSubject.id,
					providerEmail: responseEmail,
					providerEmailVerified: response.verified,
					grantedScopes: null,
					claims: grant.claims,
					refreshToken: grant.refreshToken,
					tokenExpiresAt: grant.expiresAt,
				});

				return { ok: false, reason: "link_required", ticket };
			}

			subjectId = matchedSubject.id;
			identityWrite = {
				linkedBy: "automatic",
				providerEmail: responseEmail,
				providerEmailVerified: response.verified,
			};

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

			await writeAuditEvent(db, {
				action: "identity.linked",
				actor: { type: "subject", id: subjectId },
				targetType: "subject",
				targetId: subjectId,
				outcome: "succeeded",
				detail: { connectionSlug: connection.slug, linkedBy: "automatic" },
			});
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
	}

	let subjectRow = await db.find(subjects, { id: subjectId });
	if (subjectRow?.status === "blocked") return { ok: false, reason: "subject-blocked" };

	await upsertConnectionIdentity(db, sealKey, {
		connectionId: connection.id,
		providerSubject: grant.subject,
		subjectId,
		refreshToken: grant.refreshToken,
		tokenExpiresAt: grant.expiresAt,
		...identityWrite,
	});

	let session = await openSession(
		db,
		{ subjectId, amr: ["social"], remembered: true, userAgent: parsed.agent ?? null },
		metering,
		sessionPolicy,
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
 *
 * @param db - The tenant's database.
 * @param input - The ticket as the redirect carried it, the hostname the resume request landed on, and the request's `User-Agent`.
 * @returns The subject, session and pending authorization request the ticket named, for the caller to write the session cookie and resume with, or that the ticket is unknown, already spent, expired, or named a different hostname.
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

/** The `amr` entry every session a connection of this kind opens carries, the only granularity `amr` names a connection's identities by today. */
function methodFamilyOf(connectionKind: string): "social" | "saml" {
	return connectionKind === "saml" ? "saml" : "social";
}

export interface UnlinkIdentityInput {
	subjectId: string;
	connectionSlug: string;
	actor: AuditActor;
}

export type UnlinkIdentityResult =
	| { ok: true }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "last-credential" };

/**
 * Removes a subject's identity at one connection, refusing to take its last
 * remaining way to sign in.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The subject, the connection's slug, and who is asking.
 * @returns Success, or that no such identity exists, or that it is the subject's last remaining credential.
 */
export async function unlinkIdentity(
	db: Database,
	sealKey: CryptoKey,
	input: UnlinkIdentityInput,
): Promise<UnlinkIdentityResult> {
	let connection = await db.findOne(connections, { where: { slug: input.connectionSlug } });
	if (!connection) return { ok: false, reason: "not-found" };

	let identity = await db.findOne(connectionIdentities, {
		where: { subject_id: input.subjectId, connection_id: connection.id },
	});
	if (!identity) return { ok: false, reason: "not-found" };

	let hasOtherCredential = await hasAnotherCredential(db, input.subjectId, {
		kind: "connection",
		connectionId: connection.id,
	});
	if (!hasOtherCredential) return { ok: false, reason: "last-credential" };

	let providerRevoked = false;

	if (connection.kind === "oidc" && identity.refresh_token_sealed !== null) {
		try {
			let opened = await open(sealKey, identity.refresh_token_sealed);
			if (isFailure(opened)) throw new Error("failed to open the identity's sealed refresh token");

			let clientSecret = await openClientSecret(sealKey, connection);
			let rp = buildRelyingParty(connection, clientSecret, "");

			await rp.revoke(opened.data, { tokenTypeHint: "refresh_token" });
			providerRevoked = true;
		} catch {
			providerRevoked = false;
		}
	}

	await db.delete(connectionIdentities, {
		connection_id: connection.id,
		provider_subject: identity.provider_subject,
	});

	let isSelfUnlink = input.actor.type === "subject" && input.actor.id === input.subjectId;

	if (!isSelfUnlink) {
		let methodFamily = methodFamilyOf(connection.kind);

		let liveSessions = await db.findMany(sessions, {
			where: and(eq("subject_id", input.subjectId), isNull("revoked_at")),
		});

		let matching = liveSessions.filter((session) =>
			(session.amr as string[]).includes(methodFamily),
		);

		if (matching.length > 0) {
			await db.updateMany(
				sessions,
				{ revoked_at: Date.now(), revoked_reason: "connection identity unlinked" },
				{
					where: inList(
						"id",
						matching.map((session) => session.id),
					),
				},
			);

			await writeAuditEvent(db, {
				action: "session.revoked",
				actor: input.actor,
				targetType: "subject",
				targetId: input.subjectId,
				outcome: "succeeded",
				detail: { reason: "connection identity unlinked", revokedCount: matching.length },
			});
		}
	}

	await writeAuditEvent(db, {
		action: "identity.unlinked",
		actor: input.actor,
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
		detail: { connectionSlug: connection.slug, linkOrigin: identity.linked_by, providerRevoked },
	});

	return { ok: true };
}

export interface LinkIdentityInput {
	subjectId: string;
	ticket: string;
	actor: AuditActor;
}

export type LinkIdentityResult =
	| { ok: true }
	| { ok: false; reason: "invalid-ticket" }
	| { ok: false; reason: "already-linked" };

/**
 * Spends a confirmed-path ticket once the named subject has presented a credential
 * for it, writing the identity it names.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The subject completing the link, the ticket they presented a credential for, and who is asking.
 * @returns Success, or that the ticket does not work, or that the provider identity it named was linked to somebody else in the meantime.
 */
export async function linkIdentity(
	db: Database,
	sealKey: CryptoKey,
	input: LinkIdentityInput,
): Promise<LinkIdentityResult> {
	let spent = await spendLinkTicket(db, sealKey, { ticket: input.ticket });
	if (!spent.ok) return spent;

	if (spent.subjectId !== input.subjectId) return { ok: false, reason: "invalid-ticket" };

	let existing = await db.find(connectionIdentities, {
		connection_id: spent.connectionId,
		provider_subject: spent.providerSubject,
	});
	if (existing) return { ok: false, reason: "already-linked" };

	await upsertConnectionIdentity(db, sealKey, {
		connectionId: spent.connectionId,
		providerSubject: spent.providerSubject,
		subjectId: input.subjectId,
		refreshToken: spent.refreshToken,
		tokenExpiresAt: spent.tokenExpiresAt,
		linkedBy: "subject",
		providerEmail: spent.providerEmail,
		providerEmailVerified: spent.providerEmailVerified,
	});

	let connection = await db.find(connections, { id: spent.connectionId });

	await writeAuditEvent(db, {
		action: "identity.linked",
		actor: input.actor,
		targetType: "subject",
		targetId: input.subjectId,
		outcome: "succeeded",
		detail: { connectionSlug: connection?.slug ?? spent.connectionId, linkedBy: "subject" },
	});

	return { ok: true };
}

export interface AdoptIdentityAddressInput {
	subjectId: string;
	connectionSlug: string;
	actor: Actor;
}

export type AdoptIdentityAddressResult =
	| { ok: true; kind: "email"; value: string; verified: true }
	| {
			ok: true;
			kind: "email";
			value: string;
			verified: false;
			ticket: string;
			ticketExpiresAt: number;
	  }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "no-address" }
	| { ok: false; reason: "invalid-identifier" }
	| { ok: false; reason: "identifier-taken" }
	| { ok: false; reason: "username-already-set" }
	| { ok: false; reason: "rate-limited"; retryAfterSeconds: number };

/**
 * Adds a linked identity's own provider address as the subject's own identifier,
 * subject to the same uniqueness every address claim answers to.
 *
 * @param db - The tenant's database.
 * @param input - The subject, the connection whose identity names the address to adopt, and who is asking.
 * @returns The address adopted and its verified state — with a ticket to deliver when the provider had not itself proved it — or which rule refused the adoption.
 */
export async function adoptIdentityAddress(
	db: Database,
	input: AdoptIdentityAddressInput,
): Promise<AdoptIdentityAddressResult> {
	let connection = await db.findOne(connections, { where: { slug: input.connectionSlug } });
	if (!connection) return { ok: false, reason: "not-found" };

	let identity = await db.findOne(connectionIdentities, {
		where: { subject_id: input.subjectId, connection_id: connection.id },
	});
	if (!identity) return { ok: false, reason: "not-found" };

	if (identity.provider_email === null) return { ok: false, reason: "no-address" };

	let added = await addIdentifier(db, {
		subjectId: input.subjectId,
		kind: "email",
		value: identity.provider_email,
		actor: input.actor,
	});
	if (!added.ok) return added;
	if (added.kind !== "email") {
		throw new Error("addIdentifier answered a username's shape for an email add");
	}

	if (identity.provider_email_verified === true) {
		let verified = await verifyIdentifier(db, { ticket: added.ticket });
		if (!verified.ok) {
			throw new Error("failed to verify a just-added, provider-proven identifier");
		}

		return { ok: true, kind: "email", value: added.value, verified: true };
	}

	return {
		ok: true,
		kind: "email",
		value: added.value,
		verified: false,
		ticket: added.ticket,
		ticketExpiresAt: added.ticketExpiresAt,
	};
}

/**
 * A subject's linked identities as an account screen renders them, each joined to
 * its own connection's slug so no further lookup is needed.
 *
 * @param db - The tenant's database.
 * @param subjectId - The subject to describe.
 * @returns The state to pass into `subjects.ts`'s `describeSubject`.
 */
export async function describeLinkedIdentities(
	db: Database,
	subjectId: string,
): Promise<LinkedIdentityState[]> {
	let rows = await db.findMany(connectionIdentities, { where: { subject_id: subjectId } });
	if (rows.length === 0) return [];

	let connectionRows = await db.findMany(connections, {
		where: inList(
			"id",
			rows.map((row) => row.connection_id),
		),
	});
	let slugById = new Map(connectionRows.map((row) => [row.id, row.slug]));

	return rows.map((row) => ({
		connectionSlug: slugById.get(row.connection_id) ?? row.connection_id,
		providerEmail: row.provider_email,
		linkedBy: row.linked_by,
		linkedAt: row.linked_at,
		lastSignInAt: row.last_sign_in_at,
	}));
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
 * @returns How many rows this call deleted, and whether the batch was full — a caller sees `more: true` and runs the sweep again.
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
 * never came back to spend, since a real sign-in redeems one in a fraction of that
 *
 * @param db - The tenant's database.
 * @param input - The clock to sweep against, and how many rows one call may remove.
 * @returns How many rows this call deleted, and whether the batch was full — a caller sees `more: true` and runs the sweep again.
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
