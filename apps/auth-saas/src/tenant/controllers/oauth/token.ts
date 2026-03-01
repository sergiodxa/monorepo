import type { Logger } from "@pkg/logger/batched";
import type { Database } from "remix/data-table";

import { JWK } from "@edgefirst-dev/jwt";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import parseBasicAuth from "~/lib/parse-basic-auth";
import { reject } from "~/lib/reject";
import AuthorizationCode from "~/tenant/models/authorization-code";
import Client from "~/tenant/models/client";
import Secret from "~/tenant/models/client/secret";
import Session from "~/tenant/models/session";
import SigningKey from "~/tenant/models/signing-key";
import Subject from "~/tenant/models/subject";
import TenantMeta from "~/tenant/models/tenant-meta";
import AccessToken from "~/tenant/values/access-token";
import IdToken from "~/tenant/values/id-token";

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

export default action<"POST", "/oauth/token">(async ({ db, formData, request, logger }) => {
	let log = logger.action("/oauth/token");
	let grantType = formData.get("grant_type");

	// Parse Basic auth if present
	let basicAuth = parseBasicAuth(request.headers.get("authorization"));
	let body = Object.fromEntries(formData);

	// Merge Basic auth credentials into body
	if (basicAuth) {
		body.client_id = basicAuth.clientId;
		body.client_secret = basicAuth.clientSecret;
	}

	// Route to appropriate grant type handler
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
});

async function handleAuthorizationCode(db: Database, body: Record<string, unknown>, log: Logger) {
	log.info("Authorization code grant started");

	let result = await validate(body, AuthorizationCodeSchema);
	if (isFailure(result)) {
		log.info("Invalid request parameters", { grantType: "authorization_code" });
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { code, redirect_uri, client_id, client_secret, code_verifier } = result.data;

	// Consume the authorization code (single-use per RFC 6749)
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
		throw error;
	}

	// Validate client
	let client = await Client.show(db, { id: authzData.clientId });
	if (!client) {
		log.info("Client not found", { clientId: authzData.clientId, grantType: "authorization_code" });
		return reject("invalid_client", "Client not found", 401);
	}

	// Confidential clients require authentication
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

	// Validate redirect URI
	// TODO: Check against registered redirect URIs from client/redirect-uris table
	if (redirect_uri !== authzData.redirectUri) {
		log.info("Redirect URI mismatch", {
			clientId: client.id,
			grantType: "authorization_code",
		});
		return reject("invalid_grant", "Redirect URI mismatch");
	}

	// Validate PKCE if present
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

	// Validate session
	let session = await Session.show(db, authzData.sessionId);
	if (!session || new Date(session.expires_at) < new Date()) {
		log.info("Session expired", {
			clientId: client.id,
			sessionId: authzData.sessionId,
			grantType: "authorization_code",
		});
		return reject("invalid_grant", "Session has expired");
	}

	// Get subject
	let subject = await Subject.show(db, { id: authzData.subjectId });
	if (!subject) {
		log.info("Subject not found", {
			clientId: client.id,
			subjectId: authzData.subjectId,
			grantType: "authorization_code",
		});
		return reject("invalid_grant", "Subject not found");
	}

	// Get issuer and signing keys
	let issuer = await TenantMeta.getIssuer(db);
	if (!issuer) {
		log.info("Issuer not configured", {
			clientId: client.id,
			grantType: "authorization_code",
		});
		return reject("server_error", "Issuer not configured");
	}

	let signingKeys = await SigningKey.getAll(db);
	if (signingKeys.length === 0) {
		log.info("No signing keys available", {
			clientId: client.id,
			grantType: "authorization_code",
		});
		return reject("server_error", "No signing keys available");
	}

	// Generate tokens
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
		{ nonce: authzData.nonce, scope: authzData.scope, authTime: authzData.authTime },
	);
	let signedIdToken = await idToken.sign(JWK.Algoritm.ES256, signingKeys);

	log.info("Token issued successfully", {
		clientId: client.id,
		subjectId: subject.id,
		sessionId: session.id,
		grantType: "authorization_code",
		scope: authzData.scope,
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

async function handleRefreshToken(db: Database, body: Record<string, unknown>, log: Logger) {
	log.info("Refresh token grant started");

	let result = await validate(body, RefreshTokenSchema);
	if (isFailure(result)) {
		log.info("Invalid request parameters", { grantType: "refresh_token" });
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { refresh_token, client_id, client_secret } = result.data;

	// Find session by refresh token (session ID)
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

	// Validate client
	let client = await Client.show(db, { id: session.client_id });
	if (!client) {
		log.info("Client not found", { clientId: session.client_id, grantType: "refresh_token" });
		return reject("invalid_client", "Client not found", 401);
	}

	// Confidential clients require authentication
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

	// Touch session (update last access time)
	await Session.touch(db, session.id);

	// Get subject
	let subject = await Subject.show(db, { id: session.subject_id });
	if (!subject) {
		log.info("Subject not found", {
			clientId: client.id,
			subjectId: session.subject_id,
			grantType: "refresh_token",
		});
		return reject("invalid_grant", "Subject not found");
	}

	// Get issuer and signing keys
	let issuer = await TenantMeta.getIssuer(db);
	if (!issuer) {
		log.info("Issuer not configured", {
			clientId: client.id,
			grantType: "refresh_token",
		});
		return reject("server_error", "Issuer not configured");
	}

	let signingKeys = await SigningKey.getAll(db);
	if (signingKeys.length === 0) {
		log.info("No signing keys available", {
			clientId: client.id,
			grantType: "refresh_token",
		});
		return reject("server_error", "No signing keys available");
	}

	// Generate new tokens
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
		{ authTime },
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

async function handleClientCredentials(db: Database, body: Record<string, unknown>, log: Logger) {
	log.info("Client credentials grant started");

	let result = await validate(body, ClientCredentialsSchema);
	if (isFailure(result)) {
		log.info("Invalid request parameters", { grantType: "client_credentials" });
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { client_id, client_secret, scope, resource } = result.data;

	// Validate client
	let client = await Client.show(db, { id: client_id });
	if (!client) {
		log.info("Client not found", { clientId: client_id, grantType: "client_credentials" });
		return reject("invalid_client", "Client not found", 401);
	}

	// Only m2m clients can use client credentials
	if (client.type !== "m2m") {
		log.info("Unauthorized client type for grant", {
			clientId: client.id,
			clientType: client.type,
			grantType: "client_credentials",
		});
		return reject("unauthorized_client", "Client is not authorized for this grant type");
	}

	// Verify client secret
	let secretValid = await Secret.verify(db, client.id, client_secret);
	if (!secretValid) {
		log.info("Invalid client credentials", {
			clientId: client.id,
			grantType: "client_credentials",
		});
		return reject("invalid_client", "Invalid client credentials", 401);
	}

	// Get issuer and signing keys
	let issuer = await TenantMeta.getIssuer(db);
	if (!issuer) {
		log.info("Issuer not configured", {
			clientId: client.id,
			grantType: "client_credentials",
		});
		return reject("server_error", "Issuer not configured");
	}

	let signingKeys = await SigningKey.getAll(db);
	if (signingKeys.length === 0) {
		log.info("No signing keys available", {
			clientId: client.id,
			grantType: "client_credentials",
		});
		return reject("server_error", "No signing keys available");
	}

	// Build audience
	let resources = Array.isArray(resource) ? resource : resource ? [resource] : [];
	let audience = [`https://${issuer}`, ...resources];

	// Generate access token
	let parsedScope = scope?.split(" ");
	let accessToken = AccessToken.generate(`https://${issuer}`, audience, client.id, parsedScope);
	let signedAccessToken = await accessToken.sign(JWK.Algoritm.ES256, signingKeys);

	log.info("Token issued successfully", {
		clientId: client.id,
		grantType: "client_credentials",
		scope: parsedScope,
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

// Helper functions

async function validatePKCE(
	verifier: string,
	challenge: string,
	method: "S256" | "plain",
): Promise<boolean> {
	if (method === "plain") {
		return verifier === challenge;
	}

	// S256: challenge = BASE64URL(SHA256(verifier))
	let encoder = new TextEncoder();
	let data = encoder.encode(verifier);
	let hash = await crypto.subtle.digest("SHA-256", data);
	// Base64URL encode without padding
	let generatedChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
	return generatedChallenge === challenge;
}
