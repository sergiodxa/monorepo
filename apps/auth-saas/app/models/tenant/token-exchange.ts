/**
 * OAuth 2.0 Token Exchange (RFC 8693): a confidential client trades an access token this
 * tenant issued for a narrower one aimed at another audience, optionally naming itself or
 * another party as the actor. Each client may exchange only for the audiences it lists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { JWK } from "@sdxc/jwt";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";
import * as s from "remix/data-schema";

import type { TokenOutcome } from "~/app/models/tenant/tokens";

import { currentSigningKeyPair, publishKeySet } from "~/app/models/tenant/signing-keys";
import { subjects } from "~/app/models/tenant/subjects";
import { AccessToken, authenticateClient, tokenTypeFor } from "~/app/models/tenant/tokens";

/** The grant type RFC 8693 §2.1 registers. */
export const TOKEN_EXCHANGE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:token-exchange";

/** The token type RFC 8693 §3 registers for an access token, the one this grant reads and issues. */
export const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";

/** How long an exchanged token lives at most; it never outlives the token it came from. */
const EXCHANGED_TOKEN_TTL_SECONDS = 60 * 60;

/** Milliseconds in a second, the factor between the clock and a token's epoch claims. */
const MS_PER_SECOND = 1000;

/** Mints the `jti` an exchanged token carries. */
const accessTokenId = typeid("at");

export interface ExchangeTokenInput {
	subjectToken: string;
	subjectTokenType: string;
	actorToken: string | null;
	actorTokenType: string | null;
	requestedTokenType: string | null;
	/** The logical names the new token is for, from every `audience` parameter. */
	audiences: string[];
	/** The resource URIs the new token is for, from every `resource` parameter. */
	resources: string[];
	scope: string | null;
	clientId: string;
	clientSecret: string | null;
	authScheme: "basic" | "post";
	now: number;
	/** The tenant's own issuer, which both tokens are held to and the new one names. */
	issuer: string;
	/** The thumbprint of the verified DPoP proof sent with the request, binding the token. */
	jkt?: string | null;
}

let ExchangeTokenSchema = s.object({
	subjectToken: s.string(),
	subjectTokenType: s.string(),
	actorToken: s.nullable(s.string()),
	actorTokenType: s.nullable(s.string()),
	requestedTokenType: s.nullable(s.string()),
	audiences: s.array(s.string()),
	resources: s.array(s.string()),
	scope: s.nullable(s.string()),
	clientId: s.string(),
	clientSecret: s.nullable(s.string()),
	authScheme: s.enum_(["basic", "post"] as const),
	now: s.number(),
	issuer: s.string(),
	jkt: s.optional(s.nullable(s.string())),
});

/** A refused exchange, in the token endpoint's error shape. */
function refuse(error: string, description: string): TokenOutcome {
	return { kind: "error", status: 400, error, description };
}

/**
 * Verifies a token this tenant issued, against every key the tenant publishes, so a
 * token signed before a rotation still exchanges.
 *
 * @returns The token, or `null` when it does not verify or has expired.
 */
async function verifyIssued(
	db: Database,
	token: string,
	input: { issuer: string; now: number },
): Promise<AccessToken | null> {
	let keys = await JWK.importLocal(await publishKeySet(db, { now: input.now }));

	try {
		return await AccessToken.verify(token, keys, {
			issuer: input.issuer,
			algorithms: [JWK.Algorithm.ES256],
			currentDate: new Date(input.now),
		});
	} catch {
		return null;
	}
}

/**
 * The `act` claim the new token carries (RFC 8693 §4.1): the actor token's subject and
 * client, with any actor that token already named nested inside; without an actor token,
 * whatever chain the subject token already carried.
 */
function actClaim(subject: AccessToken, actor: AccessToken | null): unknown {
	if (actor === null) return subject.payload.act;

	return {
		sub: actor.payload.sub,
		...(actor.payload.client_id ? { client_id: actor.payload.client_id } : {}),
		...(actor.payload.act ? { act: actor.payload.act } : {}),
	};
}

/**
 * Exchanges an access token for one aimed at another audience. The calling client must
 * authenticate and list every requested audience in its policy; the new token keeps the
 * subject, carries the requested scopes or the subject token's, and expires no later than
 * the subject token.
 *
 * @param db - The tenant's database.
 * @param input - The tokens presented, the target and scope asked for, and the client.
 * @returns The new access token, or why the exchange was refused (RFC 8693 §2.2.2).
 */
export async function exchangeToken(
	db: Database,
	input: ExchangeTokenInput,
): Promise<TokenOutcome> {
	let parsed = s.parse(ExchangeTokenSchema, input);

	let authenticated = await authenticateClient(db, parsed);
	if (!authenticated.ok) {
		return {
			kind: "error",
			status: authenticated.status,
			error: "invalid_client",
			description: authenticated.description,
		};
	}
	let client = authenticated.client;

	let policy = (client.token_exchange_audiences as string[] | null) ?? [];
	if (policy.length === 0) {
		return refuse("unauthorized_client", "This application may not exchange tokens.");
	}

	if (parsed.subjectTokenType !== ACCESS_TOKEN_TYPE) {
		return refuse("invalid_request", "subject_token_type must name an access token.");
	}
	if (parsed.actorToken !== null && parsed.actorTokenType !== ACCESS_TOKEN_TYPE) {
		return refuse("invalid_request", "actor_token_type must name an access token.");
	}
	if (parsed.actorToken === null && parsed.actorTokenType !== null) {
		return refuse("invalid_request", "actor_token_type was sent without an actor_token.");
	}
	if (parsed.requestedTokenType !== null && parsed.requestedTokenType !== ACCESS_TOKEN_TYPE) {
		return refuse("invalid_request", "Only an access token can be requested.");
	}

	let subject = await verifyIssued(db, parsed.subjectToken, parsed);
	if (subject === null) return refuse("invalid_grant", "The subject_token is not valid.");

	let subjectRow = await db.find(subjects, { id: subject.subject });
	if (subjectRow?.status === "blocked") {
		return refuse("invalid_grant", "The subject_token is not valid.");
	}

	let actor: AccessToken | null = null;
	if (parsed.actorToken !== null) {
		actor = await verifyIssued(db, parsed.actorToken, parsed);
		if (actor === null) return refuse("invalid_grant", "The actor_token is not valid.");
	}

	let requested = [...new Set([...parsed.audiences, ...parsed.resources])];
	if (requested.length === 0) {
		if (policy.length > 1) {
			return refuse("invalid_target", "Name the audience or resource the token is for.");
		}
		requested = policy;
	}
	if (requested.some((target) => !policy.includes(target))) {
		return refuse("invalid_target", "This application may not exchange for that audience.");
	}

	let held = subject.scope.split(" ").filter(Boolean);
	let scopes = parsed.scope === null ? held : parsed.scope.split(/\s+/).filter(Boolean);
	if (scopes.some((scope) => !held.includes(scope))) {
		return refuse("invalid_scope", "The requested scope is not a subset of the subject_token's.");
	}

	let keyPair = await currentSigningKeyPair(db);
	if (!keyPair) {
		return {
			kind: "error",
			status: 500,
			error: "server_error",
			description: "No signing key is available for this tenant.",
		};
	}

	let issuedAt = Math.floor(parsed.now / MS_PER_SECOND);
	let ceiling = subject.expirationTime ?? issuedAt + EXCHANGED_TOKEN_TTL_SECONDS;
	let expiresAt = Math.min(issuedAt + EXCHANGED_TOKEN_TTL_SECONDS, ceiling);
	let act = actClaim(subject, actor);
	let jkt = parsed.jkt ?? null;

	let accessToken = await new AccessToken({
		iss: parsed.issuer,
		sub: subject.subject,
		aud: requested.length === 1 ? requested[0] : requested,
		client_id: client.id,
		scope: scopes.join(" "),
		iat: issuedAt,
		exp: expiresAt,
		jti: accessTokenId(generateUUID()).toString(),
		...(act === undefined || act === null ? {} : { act }),
		...(subject.payload.acr ? { acr: subject.payload.acr } : {}),
		...(subject.payload.auth_time ? { auth_time: subject.payload.auth_time } : {}),
		...(jkt ? { cnf: { jkt } } : {}),
	}).sign(JWK.Algorithm.ES256, [keyPair]);

	return {
		kind: "tokens",
		accessToken,
		idToken: null,
		refreshToken: null,
		tokenType: tokenTypeFor(jkt),
		expiresIn: expiresAt - issuedAt,
		scope: scopes.join(" "),
		issuedTokenType: ACCESS_TOKEN_TYPE,
	};
}
