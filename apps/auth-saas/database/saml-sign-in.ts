/**
 * The sign-in flow against a SAML connection: the request that starts it, and
 * the one operation that turns a posted response into a session. Everything
 * runs inside the tenant object, where the certificates, the private key, the
 * replay table and the subject already are.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { toMs } from "@sdxc/duration";
import { isFailure } from "@sdxc/result";
import * as SAML from "@sdxc/saml";
import { generateUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";
import { column as c, inList, lt, table } from "remix/data-table";

import type { OpenSessionMetering } from "./sessions";

import { writeAuditEvent } from "./audit-events";
import {
	applyMappings,
	connectionIdentities,
	mappingsToApply,
	mintHandoffTicket,
	upsertConnectionIdentity,
} from "./connection-sign-in";
import { connectionMappings, connections } from "./connections";
import {
	activeCertificates,
	openServiceProviderKeys,
	samlAssertionIds,
	samlConfiguration,
	samlServiceProviderUrls,
} from "./saml-connections";
import { openSession } from "./sessions";
import { createSubject, updateSubject } from "./subjects";

/** How long a started sign-in may take before its transaction stops being answerable. */
const TRANSACTION_TTL_MS = 10 * 60 * 1000;

/** How far a provider's clock may drift from this one and still be believed. */
const CLOCK_SKEW = "60 seconds";

/**
 * The longest a provider-started assertion is honored, whatever window the
 * assertion itself claimed. Nothing binds such an assertion to the browser
 * presenting it, so the window is the only thing narrowing what a captured
 * document is worth.
 */
const IDP_INITIATED_WINDOW_MS = 5 * 60 * 1000;

/** How many rows one sweep takes, so an alarm never runs long. */
const SWEEP_BATCH_SIZE = 500;

/**
 * The sign-in in flight against a SAML connection. The row's own id travels as
 * `RelayState` and comes back with the response, which is what matches an
 * assertion to a request without reading anything out of a document that has
 * not been verified.
 */
export const samlTransactions = table({
	name: "saml_transactions",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		connection_id: c.text(),
		request_id: c.text(),
		hostname: c.text(),
		authorization_request_id: c.text().nullable(),
		expires_at: c.integer(),
	},
});

export type SamlTransactionRow = TableRow<typeof samlTransactions>;

let BeginSamlSignInSchema = s.object({
	slug: s.string(),
	hostname: s.string(),
	authorizationRequestId: s.optional(s.nullable(s.string())),
	forceAuthn: s.optional(s.boolean()),
	callbackOrigin: s.string(),
});

/** What starting a sign-in against an enterprise connection takes. */
export interface BeginSamlSignInInput {
	slug: string;
	/** The host the sign-in actually started on, which the handoff comes back to. */
	hostname: string;
	authorizationRequestId?: string | null;
	forceAuthn?: boolean;
	callbackOrigin: string;
}

export type BeginSamlSignInResult =
	| { ok: true; redirectUrl: string; requestId: string }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unsupported-connection-kind" }
	| { ok: false; reason: "connection-disabled" }
	| { ok: false; reason: "missing-endpoint" }
	| { ok: false; reason: "request-failed"; detail: string };

/**
 * Starts a sign-in: mints the transaction the response comes back against and
 * builds the signed authentication request that carries its id.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - Which connection, and where the sign-in started.
 * @returns Where to send the browser, or which rule refused the start.
 */
export async function beginSamlSignIn(
	db: Database,
	sealKey: CryptoKey,
	input: BeginSamlSignInInput,
): Promise<BeginSamlSignInResult> {
	let parsed = s.parse(BeginSamlSignInSchema, input);

	let connection = await db.findOne(connections, { where: { slug: parsed.slug } });
	if (!connection) return { ok: false, reason: "not-found" };
	if (connection.kind !== "saml") return { ok: false, reason: "unsupported-connection-kind" };
	if (!connection.enabled) return { ok: false, reason: "connection-disabled" };

	let configuration = await samlConfiguration(db, connection);
	if (!configuration) return { ok: false, reason: "not-found" };

	let destination = configuration.sso_redirect_url ?? configuration.sso_post_url;
	if (!destination) return { ok: false, reason: "missing-endpoint" };

	let urls = samlServiceProviderUrls(parsed.callbackOrigin, parsed.slug);
	let keys = await openServiceProviderKeys(sealKey, configuration);
	let relayState = generateUUID();

	let request = await SAML.createAuthnRequest({
		binding: "redirect",
		destination,
		issuer: urls.entityId,
		assertionConsumerService: urls.acsUrl,
		nameIdFormat: null,
		forceAuthn: parsed.forceAuthn ?? false,
		relayState,
		signingKey: keys.signing,
		now: new Date(),
	});
	if (isFailure(request)) {
		return { ok: false, reason: "request-failed", detail: request.error.message };
	}

	let redirectUrl = request.data.url;
	if (!redirectUrl) return { ok: false, reason: "missing-endpoint" };

	await db.create(samlTransactions, {
		id: relayState,
		connection_id: connection.id,
		request_id: request.data.id,
		hostname: parsed.hostname,
		authorization_request_id: parsed.authorizationRequestId ?? null,
		expires_at: Date.now() + TRANSACTION_TTL_MS,
	});

	return { ok: true, redirectUrl, requestId: request.data.id };
}

let SignInWithSamlResponseSchema = s.object({
	slug: s.string(),
	samlResponse: s.string(),
	relayState: s.optional(s.nullable(s.string())),
	hostname: s.string(),
	agent: s.optional(s.nullable(s.string())),
	callbackOrigin: s.string(),
});

/** What completing a sign-in against an enterprise connection takes. */
export interface SignInWithSamlResponseInput {
	slug: string;
	/** The decoded `SAMLResponse` the browser posted, already base64-decoded. */
	samlResponse: string;
	/** The `RelayState` that came back, naming the transaction this answers. */
	relayState?: string | null;
	/** Where the assertion arrived, which a provider-started sign-in hands back to. */
	hostname: string;
	agent?: string | null;
	callbackOrigin: string;
}

export type SignInWithSamlResponseResult =
	| { ok: true; subjectId: string; hostname: string; handoffTicket: string }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unsupported-connection-kind" }
	| { ok: false; reason: "connection-disabled" }
	| { ok: false; reason: "invalid-transaction" }
	| { ok: false; reason: "idp-initiated-refused" }
	| { ok: false; reason: "no-trusted-certificate" }
	| { ok: false; reason: "assertion-rejected"; kind: string }
	| { ok: false; reason: "unknown-subject" }
	| { ok: false; reason: "mapping-invalid" }
	| { ok: false; reason: "dau_cap_reached"; day: number; subjects: number; cap: number };

/**
 * Verifies a posted response and opens a session from it. The whole check runs
 * here — certificates, replay, conditions — and only an assertion that came
 * back verified reaches the mapping, the subject and the session.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The posted response and where it arrived.
 * @param metering - The daily-active-subject enforcement a session open reports through.
 * @returns The subject signed in and the ticket that hands the session back, or why not.
 */
export async function signInWithSamlResponse(
	db: Database,
	sealKey: CryptoKey,
	input: SignInWithSamlResponseInput,
	metering?: OpenSessionMetering,
): Promise<SignInWithSamlResponseResult> {
	let parsed = s.parse(SignInWithSamlResponseSchema, input);
	let now = Date.now();

	let connection = await db.findOne(connections, { where: { slug: parsed.slug } });
	if (!connection) return { ok: false, reason: "not-found" };
	if (connection.kind !== "saml") return { ok: false, reason: "unsupported-connection-kind" };
	if (!connection.enabled) return { ok: false, reason: "connection-disabled" };

	let configuration = await samlConfiguration(db, connection);
	if (!configuration) return { ok: false, reason: "not-found" };

	let transaction = parsed.relayState
		? await db.find(samlTransactions, { id: parsed.relayState })
		: null;

	if (transaction) {
		await db.delete(samlTransactions, { id: transaction.id });
		if (transaction.connection_id !== connection.id || transaction.expires_at <= now) {
			return { ok: false, reason: "invalid-transaction" };
		}
	} else if (parsed.relayState) {
		return { ok: false, reason: "invalid-transaction" };
	} else if (!configuration.allow_idp_initiated) {
		return { ok: false, reason: "idp-initiated-refused" };
	}

	let certificates = await activeCertificates(db, connection.id, "signing", now);
	if (certificates.length === 0) return { ok: false, reason: "no-trusted-certificate" };

	let urls = samlServiceProviderUrls(parsed.callbackOrigin, parsed.slug);
	let keys = configuration.want_assertions_encrypted
		? await openServiceProviderKeys(sealKey, configuration)
		: null;

	let verified = await SAML.verifyResponse(parsed.samlResponse, {
		certificates,
		audience: urls.entityId,
		destination: urls.acsUrl,
		recipient: urls.acsUrl,
		inResponseTo: transaction?.request_id ?? null,
		decryptionKey: keys?.decryption ?? null,
		replay: assertionReplayStore(db, connection.id),
		clock: { now: new Date(now), skew: CLOCK_SKEW },
	});

	if (isFailure(verified)) {
		await writeAuditEvent(db, {
			action: "authentication.denied",
			actor: { type: "platform", id: "system" },
			targetType: "connection",
			targetId: connection.id,
			outcome: "denied",
			detail: { method: "saml", connectionSlug: connection.slug, kind: verified.error.name },
		});

		return { ok: false, reason: "assertion-rejected", kind: verified.error.name };
	}

	let assertion = verified.data;

	if (!transaction && assertion.notOnOrAfter.getTime() > now + IDP_INITIATED_WINDOW_MS) {
		return { ok: false, reason: "assertion-rejected", kind: "IdPInitiatedWindowError" };
	}

	let providerSubject = assertion.nameId?.value;
	if (!providerSubject) return { ok: false, reason: "assertion-rejected", kind: "MissingNameID" };

	let resolved = await resolveSubject(db, connection, assertion, providerSubject);
	if (!resolved.ok) return resolved;

	await upsertConnectionIdentity(db, sealKey, {
		connectionId: connection.id,
		providerSubject,
		subjectId: resolved.subjectId,
		refreshToken: null,
		tokenExpiresAt: null,
	});

	let session = await openSession(
		db,
		{
			subjectId: resolved.subjectId,
			amr: ["saml"],
			remembered: true,
			userAgent: parsed.agent ?? null,
		},
		metering,
	);
	if (!session.ok) return session;

	await writeAuditEvent(db, {
		action: "authentication.succeeded",
		actor: { type: "subject", id: resolved.subjectId },
		targetType: "subject",
		targetId: resolved.subjectId,
		outcome: "succeeded",
		context: { userAgent: parsed.agent ?? null },
		detail: { method: "saml", connectionSlug: connection.slug },
	});

	let hostname = transaction?.hostname ?? parsed.hostname;

	let handoffTicket = await mintHandoffTicket(db, {
		subjectId: resolved.subjectId,
		sessionId: session.sessionId,
		sessionToken: session.token,
		hostname,
		authorizationRequestId: transaction?.authorization_request_id ?? null,
	});

	return { ok: true, subjectId: resolved.subjectId, hostname, handoffTicket };
}

/**
 * Resolves the platform subject a verified assertion signs in, creating one
 * where the connection provisions from the directory and refusing where it does
 * not. Attributes map by the connection's own rules, on creation and again on
 * every sign-in for the mappings that ask for it.
 */
async function resolveSubject(
	db: Database,
	connection: { id: string; slug: string; on_unknown_subject: string },
	assertion: SAML.Assertion,
	providerSubject: string,
): Promise<
	| { ok: true; subjectId: string }
	| { ok: false; reason: "unknown-subject" }
	| { ok: false; reason: "mapping-invalid" }
> {
	let mappingRows = await db.findMany(connectionMappings, {
		where: { connection_id: connection.id },
	});

	let claims = assertion.claims();

	let identity = await db.find(connectionIdentities, {
		connection_id: connection.id,
		provider_subject: providerSubject,
	});

	if (identity) {
		let refresh = applyMappings(mappingsToApply(mappingRows, "sign-in"), claims);

		if (Object.keys(refresh.profile).length > 0 || Object.keys(refresh.attributes).length > 0) {
			let updated = await updateSubject(db, {
				subjectId: identity.subject_id,
				profile: refresh.profile,
				attributes: refresh.attributes,
				actor: { kind: "admin" },
			});
			if (!updated.ok) return { ok: false, reason: "mapping-invalid" };
		}

		return { ok: true, subjectId: identity.subject_id };
	}

	if (connection.on_unknown_subject === "refuse") {
		await writeAuditEvent(db, {
			action: "authentication.denied",
			actor: { type: "platform", id: "system" },
			targetType: "connection",
			targetId: connection.id,
			outcome: "denied",
			detail: { method: "saml", connectionSlug: connection.slug },
		});

		return { ok: false, reason: "unknown-subject" };
	}

	let minted = applyMappings(mappingsToApply(mappingRows, "create"), claims);
	let created = await createSubject(db, {
		profile: minted.profile,
		attributes: minted.attributes,
	});
	if (!created.ok) return { ok: false, reason: "mapping-invalid" };

	return { ok: true, subjectId: created.subjectId };
}

/**
 * The replay store one verification consults, scoped to the connection so two
 * providers cannot collide on an assertion id either of them chose. Presence is
 * the whole signal, and the row outlives the assertion's own window by exactly
 * as long as the verification asks for.
 */
function assertionReplayStore(db: Database, connectionId: string): SAML.ReplayStore {
	return {
		async seen(id) {
			let row = await db.find(samlAssertionIds, {
				connection_id: connectionId,
				assertion_id: id,
			});
			return row !== null;
		},

		async remember(id, ttl) {
			await db.create(samlAssertionIds, {
				connection_id: connectionId,
				assertion_id: id,
				expires_at: Date.now() + toMs(ttl),
			});
		},
	};
}

/**
 * Drops the transactions nobody answered, in bounded batches.
 *
 * @param db - The tenant's database.
 * @param input - The moment to sweep against, and how many rows to take.
 * @returns How many rows went, and whether more remain.
 */
export async function sweepExpiredSamlTransactions(
	db: Database,
	input: { now?: number; batchSize?: number } = {},
): Promise<{ deleted: number; more: boolean }> {
	let now = input.now ?? Date.now();
	let batchSize = input.batchSize ?? SWEEP_BATCH_SIZE;

	let batch = await db.findMany(samlTransactions, {
		where: lt("expires_at", now),
		orderBy: ["expires_at", "asc"],
		limit: batchSize,
	});
	if (batch.length === 0) return { deleted: 0, more: false };

	let result = await db.deleteMany(samlTransactions, {
		where: inList(
			"id",
			batch.map((row) => row.id),
		),
	});

	return { deleted: result.affectedRows, more: batch.length === batchSize };
}
