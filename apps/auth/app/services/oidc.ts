/**
 * Concrete OIDC provider instance for auth.sergiodxa.com, wiring the generic OIDC
 * engine to this app's persistence: Drizzle-backed lookups for clients, sessions,
 * subjects, credentials and grants, KV-backed single-use authorization codes, and
 * queries that enumerate sessions for back-channel and front-channel logout. Exists
 * as the single place that binds OIDC login and logout flows to the data layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { AUTHZ_CODE_TTL } from "~/config";
import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { getSigningKey } from "~/modules/jwks";
import { OIDC } from "~/modules/oauth2";

let AuthzCodeSchema = z.object({
	clientId: z.string(),
	subjectId: z.string(),
	sessionId: z.string(),
	pkce: z.object({ challenge: z.string(), method: z.enum(["S256", "plain"]) }).nullable(),
	nonce: z.string().nullable(),
	scope: z.string().array().default(["openid"]),
	authTime: z.number().optional(),
});

export default new OIDC("auth.sergiodxa.com", {
	getSigningKey,

	async findClientById(clientId) {
		let client = await db().query.clients.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, clientId);
			},
		});

		return client ?? null;
	},

	async findAuthorizationCodeData(code) {
		// Consume authorization code atomically (RFC 6749 single-use). Returning
		// null (rather than throwing) lets authorizationCodeGrant's own `if (!authz)`
		// check map this to a proper invalid_grant OAuth error instead of a 500.
		let result = await env.KV.get(`authz-code:${code}`);
		if (!result) return null;

		// Delete immediately to prevent reuse
		await env.KV.delete(`authz-code:${code}`);

		return AuthzCodeSchema.parse(JSON.parse(result));
	},

	async findSessionById(sessionId) {
		let session = await db().query.sessions.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, sessionId);
			},
		});

		return session ?? null;
	},

	async findSubjectById(subjectId) {
		let subject = await db().query.subjects.findFirst({
			where(fields, operators) {
				return operators.eq(fields.id, subjectId);
			},
		});

		return subject ?? null;
	},

	async deleteSessionById(sessionId) {
		await db().delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
	},

	async deleteSessionBySubjectId(subjectId) {
		await db().delete(schema.sessions).where(eq(schema.sessions.subjectId, subjectId));
	},

	async touchSession(sessionId) {
		await db()
			.update(schema.sessions)
			.set({ updatedAt: new Date() })
			.where(eq(schema.sessions.id, sessionId));
	},

	// =========================================================================
	// Login Flow Methods
	// =========================================================================

	async findSubjectByEmail(email) {
		let subject = await db().query.subjects.findFirst({
			where(fields, operators) {
				return operators.eq(fields.emailAddress, email);
			},
		});

		return subject ?? null;
	},

	async createSubject(data) {
		let [subject] = await db().insert(schema.subjects).values(data).returning();

		if (subject) return subject;
		throw new Error(`Failed to create subject for ${data.emailAddress}`);
	},

	async findCredential(subjectId) {
		let credential = await db().query.credentials.findFirst({
			where(fields, operators) {
				return operators.eq(fields.subjectId, subjectId);
			},
		});

		return credential ?? null;
	},

	async createCredential(subjectId, passwordHash) {
		await db().insert(schema.credentials).values({ subjectId, passwordHash });
	},

	async createSession(subjectId, clientId, ip, ua) {
		let [session] = await db()
			.insert(schema.sessions)
			.values({ subjectId, clientId, ip, ua })
			.returning();

		if (session) return { id: session.id };
		throw new Error(`Failed to create session for ${subjectId}`);
	},

	async findOrCreateGrant(subjectId, clientId) {
		let existing = await db().query.grants.findFirst({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.subjectId, subjectId),
					operators.eq(fields.clientId, clientId),
				);
			},
		});

		if (existing) return existing;

		let [grant] = await db().insert(schema.grants).values({ subjectId, clientId }).returning();

		if (grant) return grant;
		throw new Error(`Failed to create grant for ${subjectId} on ${clientId}`);
	},

	async storeAuthorizationCode(code, data) {
		await env.KV.put(`authz-code:${code}`, JSON.stringify(data), {
			expirationTtl: AUTHZ_CODE_TTL / 1000, // KV expects seconds
		});
	},

	// =========================================================================
	// Logout Flow Methods
	// =========================================================================

	async findSessionsForBackchannelLogout(subjectId, excludeClientId) {
		let sessionsWithClients = await db()
			.select({
				sessionId: schema.sessions.id,
				clientId: schema.clients.id,
				backchannelLogoutUri: schema.clients.backchannelLogoutUri,
				backchannelLogoutSessionRequired: schema.clients.backchannelLogoutSessionRequired,
				frontchannelLogoutUri: schema.clients.frontchannelLogoutUri,
				frontchannelLogoutSessionRequired: schema.clients.frontchannelLogoutSessionRequired,
			})
			.from(schema.sessions)
			.innerJoin(schema.clients, eq(schema.sessions.clientId, schema.clients.id))
			.where(
				and(
					eq(schema.sessions.subjectId, subjectId),
					// Only select clients with backchannel logout URIs
					ne(schema.clients.backchannelLogoutUri, ""),
					// Exclude the client that initiated the logout if specified
					excludeClientId ? ne(schema.clients.id, excludeClientId) : undefined,
				),
			);

		return sessionsWithClients;
	},

	async findSessionsForFrontchannelLogout(subjectId, excludeClientId) {
		let sessionsWithClients = await db()
			.select({
				sessionId: schema.sessions.id,
				clientId: schema.clients.id,
				backchannelLogoutUri: schema.clients.backchannelLogoutUri,
				backchannelLogoutSessionRequired: schema.clients.backchannelLogoutSessionRequired,
				frontchannelLogoutUri: schema.clients.frontchannelLogoutUri,
				frontchannelLogoutSessionRequired: schema.clients.frontchannelLogoutSessionRequired,
			})
			.from(schema.sessions)
			.innerJoin(schema.clients, eq(schema.sessions.clientId, schema.clients.id))
			.where(
				and(
					eq(schema.sessions.subjectId, subjectId),
					// Only select clients with frontchannel logout URIs
					ne(schema.clients.frontchannelLogoutUri, ""),
					// Exclude the client that initiated the logout if specified
					excludeClientId ? ne(schema.clients.id, excludeClientId) : undefined,
				),
			);

		return sessionsWithClients;
	},
});
