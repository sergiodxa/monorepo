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

import type { Log } from "@sdxc/logger";

import { JWK } from "@sdxc/jwt";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Client from "../../clients/models/client.js";
import Secret from "../../clients/models/secret.js";
import TenantMeta from "../../management/models/tenant-meta.js";
import Resource from "../../resources/models/resource.js";
import routes from "../../routes.js";
import parseBasicAuth from "../../shared/lib/parse-basic-auth.js";
import { reject } from "../../shared/lib/reject.js";
import SigningKey from "../../signing-keys/models/signing-key.js";
import Subject from "../../subjects/models/subject.js";
import AuthorizationCode from "../models/authorization-code.js";
import Session from "../models/session.js";
import AccessToken from "../values/access-token.js";
import IdToken from "../values/id-token.js";
import ScopeSet from "../values/scope-set.js";

let AuthorizationCodeSchema = s.object({
	grant_type: s.literal("authorization_code"),
	code: s.string(),
	redirect_uri: s.string(),
	client_id: s.optional(s.string()),
	client_secret: s.optional(s.string()),
	code_verifier: s.optional(s.string()),
});

let RefreshTokenSchema = s.object({
	grant_type: s.literal("refresh_token"),
	refresh_token: s.string(),
	client_id: s.optional(s.string()),
	client_secret: s.optional(s.string()),
});

let ClientCredentialsSchema = s.object({
	grant_type: s.literal("client_credentials"),
	client_id: s.string(),
	client_secret: s.string(),
	scope: s.optional(s.string()),
	resource: s.optional(s.union([s.string(), s.array(s.string())])),
});

/**
 * OAuth 2.0 Token endpoint (RFC 6749 Section 3.2).
 * Supports authorization_code, refresh_token, and client_credentials grants,
 * dispatching by `grant_type` (form body or Basic auth) to the matching handler.
 * @returns A JSON token `Response`, or an OAuth error `Response`.
 */
export default createAction(
	routes.oauth.token,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { formData, request, log } = ctx;
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

		log.warn("oidc.token.unsupported_grant", {
			grant_type: typeof grantType === "string" ? grantType : null,
		});
		return reject("unsupported_grant_type", "The authorization grant type is not supported");
	}),
);

/**
 * Handles the authorization_code grant type (RFC 6749 Section 4.1.3).
 * Authorization codes are single-use per RFC 6749.
 * Issues a refresh token only when `offline_access` was requested and granted.
 * @param db - Tenant database instance.
 * @param body - Parsed token request parameters (form body plus Basic-auth creds).
 * @param log - The request's log, which the grant enriches with client, subject, and scope fields.
 * @returns A JSON `Response` with access/ID (and optional refresh) tokens, or an OAuth error `Response`.
 * @throws Rethrows unexpected errors from consuming the authorization code.
 */
async function handleAuthorizationCode(db: Database, body: Record<string, unknown>, log: Log) {
	log.set({ oidc: { grant_type: "authorization_code" } });

	let result = await validate(body, AuthorizationCodeSchema);
	if (isFailure(result)) {
		log.warn("http.invalid_params");
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { code, redirect_uri, client_id, client_secret, code_verifier } = result.data;

	let authzData;
	try {
		authzData = await AuthorizationCode.consume(db, code);
	} catch (error) {
		if (error instanceof AuthorizationCode.AlreadyConsumedError) {
			log.warn("oidc.token.code_consumed");
			return reject("invalid_grant", "Authorization code has already been used or is invalid");
		}
		if (error instanceof AuthorizationCode.ExpiredCodeError) {
			log.warn("oidc.token.code_expired");
			return reject("invalid_grant", "Authorization code has expired");
		}
		log.fail(error);
		throw error;
	}

	let client = await Client.show(db, authzData.clientId);
	if (!client) {
		log.warn("client.not_found", { client_id: authzData.clientId });
		return reject("invalid_client", "Client not found", 401);
	}
	log.set({ client: { id: client.id, type: client.type } });

	if (authzData.scope.length > 0 && client.allowed_scopes) {
		let requestedScopes = new ScopeSet(authzData.scope);
		let allowedScopes = ScopeSet.fromJson(client.allowed_scopes);
		let invalidScopes = requestedScopes.getInvalidScopes(allowedScopes);
		if (invalidScopes.length > 0) {
			log.warn("oidc.token.invalid_scope", {
				invalid_scopes: invalidScopes.join(" "),
			});
			return reject("invalid_scope", `Scopes not allowed: ${invalidScopes.join(", ")}`);
		}
	}

	if (client.type === "confidential" || client.type === "m2m") {
		if (!client_id || !client_secret) {
			log.warn("client.auth_required", {
				client_type: client.type,
			});
			return reject("invalid_client", "Client authentication required", 401);
		}
		if (client_id !== client.id) {
			log.warn("client.id_mismatch", {
				expected_client_id: client.id,
				provided_client_id: client_id,
			});
			return reject("invalid_client", "Client ID mismatch", 401);
		}
		let secretValid = await Secret.verify(db, client.id, client_secret);
		if (!secretValid) {
			log.warn("client.invalid_credentials");
			return reject("invalid_client", "Invalid client credentials", 401);
		}
	}

	if (redirect_uri !== authzData.redirectUri) {
		log.warn("oidc.token.redirect_uri_mismatch");
		return reject("invalid_grant", "Redirect URI mismatch");
	}

	/**
	 * PKCE is required for public clients per OAuth 2.1 specification.
	 * This prevents authorization code interception attacks.
	 */
	if (client.type === "public" && !authzData.pkce) {
		log.warn("oidc.token.pkce_required");
		return reject("invalid_request", "PKCE is required for public clients");
	}

	if (authzData.pkce) {
		if (!code_verifier) {
			log.warn("oidc.token.code_verifier_missing");
			return reject("invalid_request", "Missing code_verifier");
		}

		let isValid = await validatePKCE(
			code_verifier,
			authzData.pkce.challenge,
			authzData.pkce.method,
		);
		if (!isValid) {
			log.warn("oidc.token.pkce_failed", {
				pkce_method: authzData.pkce.method,
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
		log.warn("oidc.token.session_expired", {
			session_id: authzData.sessionId,
		});
		return reject("invalid_grant", "Session has expired");
	}

	if (!subject) {
		log.warn("subject.not_found", {
			subject_id: authzData.subjectId,
		});
		return reject("invalid_grant", "Subject not found");
	}
	log.set({ subject: { id: subject.id } });

	if (!issuer) {
		log.fail(new Error("Issuer not configured"));
		return reject("server_error", "Issuer not configured");
	}

	if (signingKeys.length === 0) {
		log.fail(new Error("No signing keys available"));
		return reject("server_error", "No signing keys available");
	}

	let accessToken = AccessToken.generate({
		issuer: `https://${issuer}`,
		audience: client.id,
		subjectId: subject.id,
		clientId: client.id,
		scope: authzData.scope,
	});
	let signedAccessToken = await accessToken.sign(JWK.Algorithm.ES256, signingKeys);

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
	let signedIdToken = await idToken.sign(JWK.Algorithm.ES256, signingKeys);

	let issueRefreshToken = authzData.scope.includes("offline_access");

	log.set({ oidc: { scope: authzData.scope.join(" "), refresh_token: issueRefreshToken } });
	log.note("oidc.token.issued", { session_id: session.id });

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
 * @param log - The request's log, which the grant enriches with client, subject, and scope fields.
 * @returns A JSON `Response` with refreshed tokens, or an OAuth error `Response`.
 */
async function handleRefreshToken(db: Database, body: Record<string, unknown>, log: Log) {
	log.set({ oidc: { grant_type: "refresh_token" } });

	let result = await validate(body, RefreshTokenSchema);
	if (isFailure(result)) {
		log.warn("http.invalid_params");
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { refresh_token, client_id, client_secret } = result.data;

	let session = await Session.show(db, refresh_token);
	if (!session) {
		log.warn("oidc.token.refresh_token_invalid");
		return reject("invalid_grant", "Invalid or expired refresh token");
	}

	if (new Date(session.expires_at) < new Date()) {
		log.warn("oidc.token.refresh_token_expired", {
			session_id: session.id,
			client_id: session.client_id,
		});
		return reject("invalid_grant", "Refresh token has expired");
	}

	let client = await Client.show(db, session.client_id);
	if (!client) {
		log.warn("client.not_found", { client_id: session.client_id });
		return reject("invalid_client", "Client not found", 401);
	}
	log.set({ client: { id: client.id, type: client.type } });

	if (client.type === "confidential" || client.type === "m2m") {
		if (!client_id || !client_secret) {
			log.warn("client.auth_required", {
				client_type: client.type,
			});
			return reject("invalid_client", "Client authentication required", 401);
		}
		if (client_id !== client.id) {
			log.warn("client.id_mismatch", {
				expected_client_id: client.id,
				provided_client_id: client_id,
			});
			return reject("invalid_client", "Client ID mismatch", 401);
		}
		let secretValid = await Secret.verify(db, client.id, client_secret);
		if (!secretValid) {
			log.warn("client.invalid_credentials");
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
		log.warn("subject.not_found", {
			subject_id: session.subject_id,
		});
		return reject("invalid_grant", "Subject not found");
	}
	log.set({ subject: { id: subject.id } });

	if (!issuer) {
		log.fail(new Error("Issuer not configured"));
		return reject("server_error", "Issuer not configured");
	}

	if (signingKeys.length === 0) {
		log.fail(new Error("No signing keys available"));
		return reject("server_error", "No signing keys available");
	}

	let accessToken = AccessToken.generate({
		issuer: `https://${issuer}`,
		audience: client.id,
		subjectId: subject.id,
		clientId: client.id,
	});
	let signedAccessToken = await accessToken.sign(JWK.Algorithm.ES256, signingKeys);

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
	let signedIdToken = await idToken.sign(JWK.Algorithm.ES256, signingKeys);

	log.note("oidc.token.refreshed", {
		session_id: session.id,
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
 * Handles the client_credentials grant type (RFC 6749 Section 4.4), restricted
 * to machine-to-machine (m2m) clients. Each requested resource (RFC 8707) must
 * be registered and allow-listed, scoping minted tokens to authorized audiences.
 * @param db - Tenant database instance.
 * @param body - Parsed token request parameters (form body plus Basic-auth creds).
 * @param log - The request's log, which the grant enriches with client, subject, and scope fields.
 * @returns A JSON `Response` with an access token, or an OAuth error `Response`.
 */
async function handleClientCredentials(db: Database, body: Record<string, unknown>, log: Log) {
	log.set({ oidc: { grant_type: "client_credentials" } });

	let result = await validate(body, ClientCredentialsSchema);
	if (isFailure(result)) {
		log.warn("http.invalid_params");
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { client_id, client_secret, scope, resource } = result.data;

	let client = await Client.show(db, client_id);
	if (!client) {
		log.warn("client.not_found", { client_id });
		return reject("invalid_client", "Client not found", 401);
	}
	log.set({ client: { id: client.id, type: client.type } });

	if (client.type !== "m2m") {
		log.warn("oidc.token.unauthorized_client", {
			client_type: client.type,
		});
		return reject("unauthorized_client", "Client is not authorized for this grant type");
	}

	let secretValid = await Secret.verify(db, client.id, client_secret);
	if (!secretValid) {
		log.warn("client.invalid_credentials");
		return reject("invalid_client", "Invalid client credentials", 401);
	}

	let requestedScopes = ScopeSet.fromString(scope);
	if (!requestedScopes.isEmpty() && client.allowed_scopes) {
		let allowedScopes = ScopeSet.fromJson(client.allowed_scopes);
		let invalidScopes = requestedScopes.getInvalidScopes(allowedScopes);
		if (invalidScopes.length > 0) {
			log.warn("oidc.token.invalid_scope", {
				invalid_scopes: invalidScopes.join(" "),
			});
			return reject("invalid_scope", `Scopes not allowed: ${invalidScopes.join(", ")}`);
		}
	}

	let [issuer, signingKeys] = await Promise.all([TenantMeta.getIssuer(db), SigningKey.getAll(db)]);

	if (!issuer) {
		log.fail(new Error("Issuer not configured"));
		return reject("server_error", "Issuer not configured");
	}

	if (signingKeys.length === 0) {
		log.fail(new Error("No signing keys available"));
		return reject("server_error", "No signing keys available");
	}

	let resources = Array.isArray(resource) ? resource : resource ? [resource] : [];
	if (resources.length > 0) {
		let allowed = new Set(Client.parseAllowedResources(client));
		for (let target of resources) {
			if (!allowed.has(target)) {
				log.warn("oidc.token.resource_not_allowed", { resource: target });
				return reject("invalid_target", `Resource not allowed: ${target}`);
			}
			let registered = await Resource.findByIdentifier(db, target);
			if (!registered) {
				log.warn("oidc.token.resource_unknown", { resource: target });
				return reject("invalid_target", `Unknown resource: ${target}`);
			}
		}
	}
	let audience = [`https://${issuer}`, ...resources];
	let scopeArray = requestedScopes.isEmpty() ? undefined : requestedScopes.toArray();

	// No resource owner takes part in this grant, so RFC 9068 has `sub` name the client.
	let accessToken = AccessToken.generate({
		issuer: `https://${issuer}`,
		audience,
		subjectId: client.id,
		clientId: client.id,
		scope: scopeArray,
	});
	let signedAccessToken = await accessToken.sign(JWK.Algorithm.ES256, signingKeys);

	log.set({ oidc: { scope: scopeArray?.join(" "), resource_count: resources.length } });
	log.note("oidc.token.issued");

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
