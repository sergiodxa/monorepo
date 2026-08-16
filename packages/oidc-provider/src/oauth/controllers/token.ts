/**
 * OAuth 2.0 Token endpoint controller.
 *
 * Handles the `authorization_code`, `refresh_token`, and `client_credentials`
 * grants: authenticating the client, enforcing PKCE and scope/resource rules, and
 * minting signed access and ID tokens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Logger } from "@pkg/logger/batched";

import { JWK } from "@pkg/jwt";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Client from "../../clients/models/client";
import Secret from "../../clients/models/secret";
import TenantMeta from "../../management/models/tenant-meta";
import Resource from "../../resources/models/resource";
import routes from "../../routes";
import parseBasicAuth from "../../shared/lib/parse-basic-auth";
import { reject } from "../../shared/lib/reject";
import SigningKey from "../../signing-keys/models/signing-key";
import Subject from "../../subjects/models/subject";
import AuthorizationCode from "../models/authorization-code";
import Session from "../models/session";
import AccessToken from "../values/access-token";
import IdToken from "../values/id-token";
import ScopeSet from "../values/scope-set";

/** Validation schema for `authorization_code` grant request bodies. */
let AuthorizationCodeSchema = s.object({
	grant_type: s.literal("authorization_code"),
	code: s.string(),
	redirect_uri: s.string(),
	client_id: s.optional(s.string()),
	client_secret: s.optional(s.string()),
	code_verifier: s.optional(s.string()),
});

/** Validation schema for `refresh_token` grant request bodies. */
let RefreshTokenSchema = s.object({
	grant_type: s.literal("refresh_token"),
	refresh_token: s.string(),
	client_id: s.optional(s.string()),
	client_secret: s.optional(s.string()),
});

/** Validation schema for `client_credentials` grant request bodies. */
let ClientCredentialsSchema = s.object({
	grant_type: s.literal("client_credentials"),
	client_id: s.string(),
	client_secret: s.string(),
	scope: s.optional(s.string()),
	resource: s.optional(s.union([s.string(), s.array(s.string())])),
});

/**
 * OAuth 2.0 Token endpoint (RFC 6749 Section 3.2).
 * Supports authorization_code, refresh_token, and client_credentials grant types.
 * Reads `grant_type` from the form body (and Basic auth for client credentials)
 * and dispatches to the matching grant handler.
 * @returns A JSON token `Response`, or an OAuth error `Response`.
 */
export default createAction(
	routes.oauth.token,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { formData, request, logger } = ctx;
		let log = logger.action("/oauth/token");
		let grantType = formData.get("grant_type");

		let basicAuth = parseBasicAuth(request.headers.get("authorization"));
		let body = Object.fromEntries(formData);

		if (basicAuth) {
			body.client_id = basicAuth.clientId;
			body.client_secret = basicAuth.clientSecret;
		}

		if (grantType === "authorization_code") {
			return await handleAuthorizationCode(db, body, log);
		}

		if (grantType === "refresh_token") {
			return await handleRefreshToken(db, body, log);
		}

		if (grantType === "client_credentials") {
			return await handleClientCredentials(db, body, log);
		}

		log.info("Unsupported grant type requested", { grantType: String(grantType) });
		return reject("unsupported_grant_type", "The authorization grant type is not supported");
	}),
);

/**
 * Handles the authorization_code grant type (RFC 6749 Section 4.1.3).
 * Authorization codes are single-use per RFC 6749.
 * @param db - Tenant database instance.
 * @param body - Parsed token request parameters (form body plus Basic-auth creds).
 * @param log - Request-scoped action logger.
 * @returns A JSON `Response` with access/ID (and optional refresh) tokens, or an OAuth error `Response`.
 * @throws Rethrows unexpected errors from consuming the authorization code.
 */
async function handleAuthorizationCode(db: Database, body: Record<string, unknown>, log: Logger) {
	log.info("Authorization code grant started");

	let result = await validate(body, AuthorizationCodeSchema);
	if (isFailure(result)) {
		log.info("Invalid request parameters", { grantType: "authorization_code" });
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { code, redirect_uri, client_id, client_secret, code_verifier } = result.data;

	let authzData;
	try {
		authzData = await AuthorizationCode.consume(db, code);
	} catch (error) {
		if (error instanceof AuthorizationCode.AlreadyConsumedError) {
			log.info("Authorization code already consumed", { grantType: "authorization_code" });
			return reject("invalid_grant", "Authorization code has already been used or is invalid");
		}
		if (error instanceof AuthorizationCode.ExpiredCodeError) {
			log.info("Authorization code expired", { grantType: "authorization_code" });
			return reject("invalid_grant", "Authorization code has expired");
		}
		log.error("Unexpected error consuming authorization code", {
			grantType: "authorization_code",
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}

	let client = await Client.show(db, authzData.clientId);
	if (!client) {
		log.info("Client not found", { clientId: authzData.clientId, grantType: "authorization_code" });
		return reject("invalid_client", "Client not found", 401);
	}

	if (authzData.scope.length > 0 && client.allowed_scopes) {
		let requestedScopes = new ScopeSet(authzData.scope);
		let allowedScopes = ScopeSet.fromJson(client.allowed_scopes);
		let invalidScopes = requestedScopes.getInvalidScopes(allowedScopes);
		if (invalidScopes.length > 0) {
			log.info("Invalid scopes requested", {
				clientId: client.id,
				invalidScopes,
				grantType: "authorization_code",
			});
			return reject("invalid_scope", `Scopes not allowed: ${invalidScopes.join(", ")}`);
		}
	}

	if (client.type === "confidential" || client.type === "m2m") {
		if (!client_id || !client_secret) {
			log.info("Client authentication required", {
				clientId: client.id,
				clientType: client.type,
				grantType: "authorization_code",
			});
			return reject("invalid_client", "Client authentication required", 401);
		}
		if (client_id !== client.id) {
			log.info("Client ID mismatch", {
				expectedClientId: client.id,
				providedClientId: client_id,
				grantType: "authorization_code",
			});
			return reject("invalid_client", "Client ID mismatch", 401);
		}
		let secretValid = await Secret.verify(db, client.id, client_secret);
		if (!secretValid) {
			log.info("Invalid client credentials", {
				clientId: client.id,
				grantType: "authorization_code",
			});
			return reject("invalid_client", "Invalid client credentials", 401);
		}
	}

	if (redirect_uri !== authzData.redirectUri) {
		log.info("Redirect URI mismatch", {
			clientId: client.id,
			grantType: "authorization_code",
		});
		return reject("invalid_grant", "Redirect URI mismatch");
	}

	/**
	 * PKCE is required for public clients per OAuth 2.1 specification.
	 * This prevents authorization code interception attacks.
	 */
	if (client.type === "public" && !authzData.pkce) {
		log.info("PKCE required for public clients", {
			clientId: client.id,
			grantType: "authorization_code",
		});
		return reject("invalid_request", "PKCE is required for public clients");
	}

	if (authzData.pkce) {
		if (!code_verifier) {
			log.info("Missing code_verifier for PKCE", {
				clientId: client.id,
				grantType: "authorization_code",
			});
			return reject("invalid_request", "Missing code_verifier");
		}

		let isValid = await validatePKCE(
			code_verifier,
			authzData.pkce.challenge,
			authzData.pkce.method,
		);
		if (!isValid) {
			log.info("PKCE validation failed", {
				clientId: client.id,
				pkceMethod: authzData.pkce.method,
				grantType: "authorization_code",
			});
			return reject("invalid_grant", "PKCE validation failed");
		}
	}

	let [session, subject, issuer, signingKeys] = await Promise.all([
		Session.show(db, authzData.sessionId),
		Subject.show(db, authzData.subjectId),
		TenantMeta.getIssuer(db),
		SigningKey.getAll(db),
	]);

	if (!session || new Date(session.expires_at) < new Date()) {
		log.info("Session expired", {
			clientId: client.id,
			sessionId: authzData.sessionId,
			grantType: "authorization_code",
		});
		return reject("invalid_grant", "Session has expired");
	}

	if (!subject) {
		log.info("Subject not found", {
			clientId: client.id,
			subjectId: authzData.subjectId,
			grantType: "authorization_code",
		});
		return reject("invalid_grant", "Subject not found");
	}

	if (!issuer) {
		log.info("Issuer not configured", {
			clientId: client.id,
			grantType: "authorization_code",
		});
		return reject("server_error", "Issuer not configured");
	}

	if (signingKeys.length === 0) {
		log.info("No signing keys available", {
			clientId: client.id,
			grantType: "authorization_code",
		});
		return reject("server_error", "No signing keys available");
	}

	let accessToken = AccessToken.generate(
		`https://${issuer}`,
		client.id,
		subject.id,
		authzData.scope,
	);
	let signedAccessToken = await accessToken.sign(JWK.Algoritm.ES256, signingKeys);

	let idToken = IdToken.generate(
		`https://${issuer}`,
		{
			id: subject.id,
			email: subject.email,
			avatar: subject.avatar_url ?? "",
			username: subject.username,
			displayName: subject.display_name ?? subject.username,
			emailVerified: subject.email_verified_at !== null,
		},
		{ id: client.id },
		{
			nonce: authzData.nonce,
			scope: authzData.scope,
			authTime: authzData.authTime,
			sessionId: session.id,
		},
	);
	let signedIdToken = await idToken.sign(JWK.Algoritm.ES256, signingKeys);

	// Only hand out a refresh token when the client requested (and was granted, per the
	// scope check above) `offline_access`; otherwise the session id is not exposed as a
	// long-lived refresh credential.
	let issueRefreshToken = authzData.scope.includes("offline_access");

	log.info("Token issued successfully", {
		clientId: client.id,
		subjectId: subject.id,
		sessionId: session.id,
		grantType: "authorization_code",
		scope: authzData.scope,
		refreshToken: issueRefreshToken,
	});

	return new Response(
		JSON.stringify({
			access_token: signedAccessToken,
			token_type: "Bearer",
			expires_in: AccessToken.ttl,
			...(issueRefreshToken ? { refresh_token: session.id } : {}),
			id_token: signedIdToken,
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
		},
	);
}

/**
 * Handles the refresh_token grant type (RFC 6749 Section 6).
 * Issues new access and ID tokens using a valid refresh token (session ID).
 * @param db - Tenant database instance.
 * @param body - Parsed token request parameters (form body plus Basic-auth creds).
 * @param log - Request-scoped action logger.
 * @returns A JSON `Response` with refreshed tokens, or an OAuth error `Response`.
 */
async function handleRefreshToken(db: Database, body: Record<string, unknown>, log: Logger) {
	log.info("Refresh token grant started");

	let result = await validate(body, RefreshTokenSchema);
	if (isFailure(result)) {
		log.info("Invalid request parameters", { grantType: "refresh_token" });
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { refresh_token, client_id, client_secret } = result.data;

	let session = await Session.show(db, refresh_token);
	if (!session) {
		log.info("Invalid or expired refresh token", { grantType: "refresh_token" });
		return reject("invalid_grant", "Invalid or expired refresh token");
	}

	if (new Date(session.expires_at) < new Date()) {
		log.info("Refresh token expired", {
			sessionId: session.id,
			clientId: session.client_id,
			grantType: "refresh_token",
		});
		return reject("invalid_grant", "Refresh token has expired");
	}

	let client = await Client.show(db, session.client_id);
	if (!client) {
		log.info("Client not found", { clientId: session.client_id, grantType: "refresh_token" });
		return reject("invalid_client", "Client not found", 401);
	}

	if (client.type === "confidential" || client.type === "m2m") {
		if (!client_id || !client_secret) {
			log.info("Client authentication required", {
				clientId: client.id,
				clientType: client.type,
				grantType: "refresh_token",
			});
			return reject("invalid_client", "Client authentication required", 401);
		}
		if (client_id !== client.id) {
			log.info("Client ID mismatch", {
				expectedClientId: client.id,
				providedClientId: client_id,
				grantType: "refresh_token",
			});
			return reject("invalid_client", "Client ID mismatch", 401);
		}
		let secretValid = await Secret.verify(db, client.id, client_secret);
		if (!secretValid) {
			log.info("Invalid client credentials", {
				clientId: client.id,
				grantType: "refresh_token",
			});
			return reject("invalid_client", "Invalid client credentials", 401);
		}
	}

	let [, subject, issuer, signingKeys] = await Promise.all([
		Session.touch(db, session.id),
		Subject.show(db, session.subject_id),
		TenantMeta.getIssuer(db),
		SigningKey.getAll(db),
	]);

	if (!subject) {
		log.info("Subject not found", {
			clientId: client.id,
			subjectId: session.subject_id,
			grantType: "refresh_token",
		});
		return reject("invalid_grant", "Subject not found");
	}

	if (!issuer) {
		log.info("Issuer not configured", {
			clientId: client.id,
			grantType: "refresh_token",
		});
		return reject("server_error", "Issuer not configured");
	}

	if (signingKeys.length === 0) {
		log.info("No signing keys available", {
			clientId: client.id,
			grantType: "refresh_token",
		});
		return reject("server_error", "No signing keys available");
	}

	let accessToken = AccessToken.generate(`https://${issuer}`, client.id, subject.id);
	let signedAccessToken = await accessToken.sign(JWK.Algoritm.ES256, signingKeys);

	let authTime = Math.floor(new Date(session.created_at).getTime() / 1000);
	let idToken = IdToken.generate(
		`https://${issuer}`,
		{
			id: subject.id,
			email: subject.email,
			avatar: subject.avatar_url ?? "",
			username: subject.username,
			displayName: subject.display_name ?? subject.username,
			emailVerified: subject.email_verified_at !== null,
		},
		{ id: client.id },
		{ authTime, sessionId: session.id },
	);
	let signedIdToken = await idToken.sign(JWK.Algoritm.ES256, signingKeys);

	log.info("Token refreshed successfully", {
		clientId: client.id,
		subjectId: subject.id,
		sessionId: session.id,
		grantType: "refresh_token",
	});

	return new Response(
		JSON.stringify({
			access_token: signedAccessToken,
			token_type: "Bearer",
			expires_in: AccessToken.ttl,
			refresh_token: session.id,
			id_token: signedIdToken,
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
		},
	);
}

/**
 * Handles the client_credentials grant type (RFC 6749 Section 4.4).
 * Only available to machine-to-machine (m2m) clients.
 * @param db - Tenant database instance.
 * @param body - Parsed token request parameters (form body plus Basic-auth creds).
 * @param log - Request-scoped action logger.
 * @returns A JSON `Response` with an access token, or an OAuth error `Response`.
 */
async function handleClientCredentials(db: Database, body: Record<string, unknown>, log: Logger) {
	log.info("Client credentials grant started");

	let result = await validate(body, ClientCredentialsSchema);
	if (isFailure(result)) {
		log.info("Invalid request parameters", { grantType: "client_credentials" });
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { client_id, client_secret, scope, resource } = result.data;

	let client = await Client.show(db, client_id);
	if (!client) {
		log.info("Client not found", { clientId: client_id, grantType: "client_credentials" });
		return reject("invalid_client", "Client not found", 401);
	}

	if (client.type !== "m2m") {
		log.info("Unauthorized client type for grant", {
			clientId: client.id,
			clientType: client.type,
			grantType: "client_credentials",
		});
		return reject("unauthorized_client", "Client is not authorized for this grant type");
	}

	let secretValid = await Secret.verify(db, client.id, client_secret);
	if (!secretValid) {
		log.info("Invalid client credentials", {
			clientId: client.id,
			grantType: "client_credentials",
		});
		return reject("invalid_client", "Invalid client credentials", 401);
	}

	let requestedScopes = ScopeSet.fromString(scope);
	if (!requestedScopes.isEmpty() && client.allowed_scopes) {
		let allowedScopes = ScopeSet.fromJson(client.allowed_scopes);
		let invalidScopes = requestedScopes.getInvalidScopes(allowedScopes);
		if (invalidScopes.length > 0) {
			log.info("Invalid scopes requested", {
				clientId: client.id,
				invalidScopes,
				grantType: "client_credentials",
			});
			return reject("invalid_scope", `Scopes not allowed: ${invalidScopes.join(", ")}`);
		}
	}

	let [issuer, signingKeys] = await Promise.all([TenantMeta.getIssuer(db), SigningKey.getAll(db)]);

	if (!issuer) {
		log.info("Issuer not configured", {
			clientId: client.id,
			grantType: "client_credentials",
		});
		return reject("server_error", "Issuer not configured");
	}

	if (signingKeys.length === 0) {
		log.info("No signing keys available", {
			clientId: client.id,
			grantType: "client_credentials",
		});
		return reject("server_error", "No signing keys available");
	}

	let resources = Array.isArray(resource) ? resource : resource ? [resource] : [];
	// RFC 8707: every requested resource must be registered AND on the client's
	// allow-list, otherwise a client could mint access tokens for arbitrary audiences.
	if (resources.length > 0) {
		let allowed = new Set(Client.parseAllowedResources(client));
		for (let target of resources) {
			if (!allowed.has(target)) {
				log.info("Resource not permitted for client", { clientId: client.id, resource: target });
				return reject("invalid_target", `Resource not allowed: ${target}`);
			}
			let registered = await Resource.findByIdentifier(db, target);
			if (!registered) {
				log.info("Unknown resource requested", { clientId: client.id, resource: target });
				return reject("invalid_target", `Unknown resource: ${target}`);
			}
		}
	}
	let audience = [`https://${issuer}`, ...resources];
	let scopeArray = requestedScopes.isEmpty() ? undefined : requestedScopes.toArray();

	let accessToken = AccessToken.generate(`https://${issuer}`, audience, client.id, scopeArray);
	let signedAccessToken = await accessToken.sign(JWK.Algoritm.ES256, signingKeys);

	log.info("Token issued successfully", {
		clientId: client.id,
		grantType: "client_credentials",
		scope: scopeArray,
		resourceCount: resources.length,
	});

	return new Response(
		JSON.stringify({
			access_token: signedAccessToken,
			token_type: "Bearer",
			expires_in: AccessToken.ttl,
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
		},
	);
}

/**
 * Validates PKCE code_verifier against the stored challenge.
 * Supports both S256 (SHA-256 hash) and plain methods per RFC 7636.
 * @param verifier - The `code_verifier` sent by the client.
 * @param challenge - The stored `code_challenge` from the authorization request.
 * @param method - The PKCE method used to derive the challenge.
 * @returns True if the verifier matches the challenge.
 */
async function validatePKCE(
	verifier: string,
	challenge: string,
	method: "S256" | "plain",
): Promise<boolean> {
	if (method === "plain") {
		return verifier === challenge;
	}

	let encoder = new TextEncoder();
	let data = encoder.encode(verifier);
	let hash = await crypto.subtle.digest("SHA-256", data);
	let generatedChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
	return generatedChallenge === challenge;
}
