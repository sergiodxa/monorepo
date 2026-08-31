/**
 * Binds the OIDC engine to this server's storage: relational lookups for clients,
 * sessions, subjects, credentials and grants, and KV for single-use authorization
 * codes. It is the one place that translates between the database's snake_case,
 * epoch-millisecond rows and the shapes the protocol engine works in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";

import type { SelectClient, SelectSession } from "~/database/schema";

import { OIDC } from "~/app/auth/oidc-provider";
import { AUTHZ_CODE_TTL, ISSUER } from "~/app/config";
import Client from "~/app/data/client";
import Credential from "~/app/data/credential";
import Grant from "~/app/data/grant";
import Session from "~/app/data/session";
import Subject from "~/app/data/subject";
import { getSigningKey } from "~/app/services/signing-keys";

/**
 * Key prefix authorization codes are stored under. Frozen: a code issued by one
 * deployment has to stay redeemable by another reading the same namespace.
 */
const AUTHZ_CODE_KEY_PREFIX = "authz-code:";

/**
 * Shape of a stored authorization code. It is written and read by more than one
 * deployment against a shared namespace, so the property names and their nesting
 * are part of the storage contract and stay fixed.
 */
const AUTHZ_CODE_SCHEMA = s.object({
	clientId: s.string(),
	subjectId: s.string(),
	sessionId: s.string(),
	pkce: s.nullable(
		s.object({ challenge: s.string(), method: s.enum_(["S256", "plain"] as const) }),
	),
	nonce: s.nullable(s.string()),
	scope: s.defaulted(s.array(s.string()), ["openid"]),
	authTime: s.optional(s.number()),
});

/**
 * Reshapes a client row into the engine's client: the columns the protocol reads to
 * authenticate it and validate a redirect.
 */
function toEngineClient(client: SelectClient) {
	return {
		id: client.id,
		name: client.name,
		secret: client.secret,
		logoutUri: client.logout_uri,
		redirectUri: client.redirect_uri,
	};
}

/**
 * Reshapes a session row for the engine. The timestamps become `Date`s here, since
 * the columns hold epoch milliseconds and the engine compares instants.
 */
function toEngineSession(session: SelectSession) {
	return {
		id: session.id,
		clientId: session.client_id,
		subjectId: session.subject_id,
		expiresAt: new Date(session.expires_at),
		createdAt: new Date(session.created_at),
	};
}

/**
 * Reshapes a subject row into the identity claims the engine puts into tokens.
 *
 * @param subject - A subject row, with `email_verified_at` as epoch milliseconds or `null`.
 */
function toEngineSubject(subject: {
	id: string;
	avatar: string;
	username: string;
	display_name: string;
	email_address: string;
	email_verified_at: number | null;
}): OIDC.Subject {
	return {
		id: subject.id,
		avatar: subject.avatar,
		username: subject.username,
		displayName: subject.display_name,
		emailAddress: subject.email_address,
		emailVerifiedAt:
			subject.email_verified_at === null ? null : new Date(subject.email_verified_at),
	};
}

/**
 * Lists a subject's sessions joined to the logout configuration of the client each
 * belongs to, keeping only clients that registered the requested logout channel and
 * dropping the client that started the logout.
 *
 * @param channel - Which logout URI a client must have registered to be included.
 * @param excludeClientId - The initiating client, which is notified by the response it already gets.
 */
async function findSessionsForLogout(
	db: Database,
	subjectId: string,
	channel: "backchannel" | "frontchannel",
	excludeClientId?: string,
): Promise<OIDC.SessionWithClient[]> {
	let sessions = await Session.findBySubjectId(db, subjectId);
	let result: OIDC.SessionWithClient[] = [];

	for (let session of sessions) {
		let client = session.client;
		if (!client) continue;
		if (excludeClientId && client.id === excludeClientId) continue;

		let uri =
			channel === "backchannel" ? client.backchannel_logout_uri : client.frontchannel_logout_uri;
		if (!uri) continue;

		result.push({
			sessionId: session.id,
			clientId: client.id,
			backchannelLogoutUri: client.backchannel_logout_uri,
			backchannelLogoutSessionRequired: client.backchannel_logout_session_required,
			frontchannelLogoutUri: client.frontchannel_logout_uri,
			frontchannelLogoutSessionRequired: client.frontchannel_logout_session_required,
		});
	}

	return result;
}

/**
 * Builds the storage the engine runs on, over a database handle and the KV namespace
 * bound to this worker.
 *
 * @param db - The database every relational lookup and write goes through.
 */
export function createOidcRepository(db: Database): OIDC.Repository {
	return {
		getSigningKey,

		/** Resolves a client id to the registration, or `null` when it is not registered. */
		async findClientById(clientId) {
			let client = await Client.findById(db, clientId);
			return client ? toEngineClient(client) : null;
		},

		/**
		 * Resolves an exactly matching registered logout URI to its client, which is how
		 * a post-logout address is verified when nothing else identified a client.
		 */
		async findClientByLogoutUri(logoutUri) {
			let client = await Client.findByLogoutUri(db, logoutUri);
			return client ? toEngineClient(client) : null;
		},

		/**
		 * Deleting the entry before returning its data is what makes a code single-use
		 * (RFC 6749). A code that is missing, expired, or unreadable yields `null`, so
		 * the token endpoint answers `invalid_grant`.
		 */
		async findAuthorizationCodeData(code) {
			let stored = await env.KV.get(`${AUTHZ_CODE_KEY_PREFIX}${code}`);
			if (!stored) return null;

			await env.KV.delete(`${AUTHZ_CODE_KEY_PREFIX}${code}`);

			let parsed = await validate(JSON.parse(stored) as Record<string, unknown>, AUTHZ_CODE_SCHEMA);
			if (isFailure(parsed)) return null;

			return parsed.data;
		},

		/** Resolves a refresh token — which is a session id — to its session. */
		async findSessionById(sessionId) {
			let session = await Session.findById(db, sessionId);
			return session ? toEngineSession(session) : null;
		},

		/** Resolves a subject id to the identity claims tokens are built from. */
		async findSubjectById(subjectId) {
			let subject = await Subject.findById(db, subjectId);
			return subject ? toEngineSubject(subject) : null;
		},

		/** Revokes one session, invalidating the refresh token it is named by. */
		async deleteSessionById(sessionId) {
			await Session.deleteById(db, sessionId);
		},

		/** Revokes every session a subject holds, which is what a logout does here. */
		async deleteSessionBySubjectId(subjectId) {
			await Session.deleteBySubjectId(db, subjectId);
		},

		/** Records that a session was just refreshed, so the device list shows real activity. */
		async touchSession(sessionId) {
			await Session.touch(db, sessionId);
		},

		/** Resolves an email address to a subject, or `null` when nobody registered it. */
		async findSubjectByEmail(email) {
			let subject = await Subject.findByEmail(db, email);
			return subject ? toEngineSubject(subject) : null;
		},

		/** Registers a subject. The address is unverified until something proves it. */
		async createSubject(data) {
			let subject = await Subject.create(db, {
				email_address: data.emailAddress,
				display_name: data.displayName,
				username: data.username,
				avatar: data.avatar,
			});

			return toEngineSubject(subject);
		},

		/** Reads a subject's password credential, or `null` when they sign in another way. */
		async findCredential(subjectId) {
			let credential = await Credential.find(db, subjectId);
			if (!credential) return null;

			return {
				subjectId: credential.subject_id,
				passwordHash: credential.password_hash,
				verifiedAt: credential.verified_at === null ? null : new Date(credential.verified_at),
			};
		},

		/**
		 * Stores a password credential. The hash arrives already computed, and the
		 * verification instant the engine decided on is written as epoch milliseconds.
		 */
		async createCredential(subjectId, passwordHash, verifiedAt) {
			await Credential.create(db, subjectId, passwordHash, verifiedAt?.getTime() ?? null);
		},

		/** Rewrites the password hash of a credential that already exists. */
		async updateCredentialPasswordHash(subjectId, passwordHash) {
			await Credential.updatePasswordHash(db, subjectId, passwordHash);
		},

		/** Opens a session, whose id is the refresh token the client will present. */
		async createSession(subjectId, clientId, ip, ua) {
			let session = await Session.create(db, subjectId, clientId, ip, ua);
			return { id: session.id };
		},

		/** Records consent for a client, or returns the consent already on file. */
		async findOrCreateGrant(subjectId, clientId) {
			let grant = await Grant.findOrCreate(db, subjectId, clientId);
			return { id: grant.id, subjectId: grant.subject_id, clientId: grant.client_id };
		},

		/**
		 * Stores an authorization code for {@link AUTHZ_CODE_TTL}, after which KV drops
		 * it and redeeming it fails as an expired grant. The TTL is milliseconds and KV
		 * counts in seconds.
		 */
		async storeAuthorizationCode(code, data) {
			await env.KV.put(`${AUTHZ_CODE_KEY_PREFIX}${code}`, JSON.stringify(data), {
				expirationTtl: AUTHZ_CODE_TTL / 1000,
			});
		},

		/** Sessions whose clients registered a back-channel logout URI. */
		async findSessionsForBackchannelLogout(subjectId, excludeClientId) {
			return await findSessionsForLogout(db, subjectId, "backchannel", excludeClientId);
		},

		/** Sessions whose clients registered a front-channel logout URI. */
		async findSessionsForFrontchannelLogout(subjectId, excludeClientId) {
			return await findSessionsForLogout(db, subjectId, "frontchannel", excludeClientId);
		},
	};
}

/**
 * Builds the OIDC engine bound to the given database and to the current request's logger,
 * so a failure the engine recovers from lands in that request's log entry; call it from
 * inside a request. The issuer is fixed to {@link ISSUER}, the value relying parties pin.
 *
 * @param db - The database the engine's storage reads and writes through.
 */
export function createOidcProvider(db: Database): OIDC {
	return new OIDC(ISSUER, createOidcRepository(db), getContext().logger);
}
