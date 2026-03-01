import type { Database } from "remix/data-table";

import { JWK } from "@edgefirst-dev/jwt";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
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

export default action<"POST", "/oauth/token">(async ({ db, formData, request }) => {
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
		return await handleAuthorizationCode(db, body);
	}

	if (grantType === "refresh_token") {
		return await handleRefreshToken(db, body);
	}

	if (grantType === "client_credentials") {
		return await handleClientCredentials(db, body);
	}

	return reject("unsupported_grant_type", "The authorization grant type is not supported");
});

async function handleAuthorizationCode(db: Database, body: Record<string, unknown>) {
	let result = await validate(body, AuthorizationCodeSchema);
	if (isFailure(result)) {
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { code, redirect_uri, client_id, client_secret, code_verifier } = result.data;

	// Consume the authorization code (single-use per RFC 6749)
	let authzData;
	try {
		authzData = await AuthorizationCode.consume(db, code);
	} catch (error) {
		if (error instanceof AuthorizationCode.AlreadyConsumedError) {
			return reject("invalid_grant", "Authorization code has already been used or is invalid");
		}
		if (error instanceof AuthorizationCode.ExpiredCodeError) {
			return reject("invalid_grant", "Authorization code has expired");
		}
		throw error;
	}

	// Validate client
	let client = await Client.show(db, { id: authzData.clientId });
	if (!client) {
		return reject("invalid_client", "Client not found", 401);
	}

	// Confidential clients require authentication
	if (client.type === "confidential" || client.type === "m2m") {
		if (!client_id || !client_secret) {
			return reject("invalid_client", "Client authentication required", 401);
		}
		if (client_id !== client.id) {
			return reject("invalid_client", "Client ID mismatch", 401);
		}
		let secretValid = await Secret.verify(db, client.id, client_secret);
		if (!secretValid) {
			return reject("invalid_client", "Invalid client credentials", 401);
		}
	}

	// Validate redirect URI
	// TODO: Check against registered redirect URIs from client/redirect-uris table
	if (redirect_uri !== authzData.redirectUri) {
		return reject("invalid_grant", "Redirect URI mismatch");
	}

	// Validate PKCE if present
	if (authzData.pkce) {
		if (!code_verifier) {
			return reject("invalid_request", "Missing code_verifier");
		}

		let isValid = await validatePKCE(
			code_verifier,
			authzData.pkce.challenge,
			authzData.pkce.method,
		);
		if (!isValid) {
			return reject("invalid_grant", "PKCE validation failed");
		}
	}

	// Validate session
	let session = await Session.show(db, authzData.sessionId);
	if (!session || new Date(session.expiresAt) < new Date()) {
		return reject("invalid_grant", "Session has expired");
	}

	// Get subject
	let subject = await Subject.show(db, { id: authzData.subjectId });
	if (!subject) {
		return reject("invalid_grant", "Subject not found");
	}

	// Get issuer and signing keys
	let issuer = await TenantMeta.getIssuer(db);
	if (!issuer) {
		return reject("server_error", "Issuer not configured");
	}

	let signingKeys = await SigningKey.getAll(db);
	if (signingKeys.length === 0) {
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
			avatar: subject.avatarUrl ?? "",
			username: subject.username,
			displayName: subject.displayName ?? subject.username,
			emailVerified: subject.emailVerifiedAt !== null,
		},
		{ id: client.id },
		{ nonce: authzData.nonce, scope: authzData.scope, authTime: authzData.authTime },
	);
	let signedIdToken = await idToken.sign(JWK.Algoritm.ES256, signingKeys);

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

async function handleRefreshToken(db: Database, body: Record<string, unknown>) {
	let result = await validate(body, RefreshTokenSchema);
	if (isFailure(result)) {
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { refresh_token, client_id, client_secret } = result.data;

	// Find session by refresh token (session ID)
	let session = await Session.show(db, refresh_token);
	if (!session) {
		return reject("invalid_grant", "Invalid or expired refresh token");
	}

	if (new Date(session.expiresAt) < new Date()) {
		return reject("invalid_grant", "Refresh token has expired");
	}

	// Validate client
	let client = await Client.show(db, { id: session.clientId });
	if (!client) {
		return reject("invalid_client", "Client not found", 401);
	}

	// Confidential clients require authentication
	if (client.type === "confidential" || client.type === "m2m") {
		if (!client_id || !client_secret) {
			return reject("invalid_client", "Client authentication required", 401);
		}
		if (client_id !== client.id) {
			return reject("invalid_client", "Client ID mismatch", 401);
		}
		let secretValid = await Secret.verify(db, client.id, client_secret);
		if (!secretValid) {
			return reject("invalid_client", "Invalid client credentials", 401);
		}
	}

	// Touch session (update last access time)
	await Session.touch(db, session.id);

	// Get subject
	let subject = await Subject.show(db, { id: session.subjectId });
	if (!subject) {
		return reject("invalid_grant", "Subject not found");
	}

	// Get issuer and signing keys
	let issuer = await TenantMeta.getIssuer(db);
	if (!issuer) {
		return reject("server_error", "Issuer not configured");
	}

	let signingKeys = await SigningKey.getAll(db);
	if (signingKeys.length === 0) {
		return reject("server_error", "No signing keys available");
	}

	// Generate new tokens
	let accessToken = AccessToken.generate(`https://${issuer}`, client.id, subject.id);
	let signedAccessToken = await accessToken.sign(JWK.Algoritm.ES256, signingKeys);

	let authTime = Math.floor(new Date(session.createdAt).getTime() / 1000);
	let idToken = IdToken.generate(
		`https://${issuer}`,
		{
			id: subject.id,
			email: subject.email,
			avatar: subject.avatarUrl ?? "",
			username: subject.username,
			displayName: subject.displayName ?? subject.username,
			emailVerified: subject.emailVerifiedAt !== null,
		},
		{ id: client.id },
		{ authTime },
	);
	let signedIdToken = await idToken.sign(JWK.Algoritm.ES256, signingKeys);

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

async function handleClientCredentials(db: Database, body: Record<string, unknown>) {
	let result = await validate(body, ClientCredentialsSchema);
	if (isFailure(result)) {
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { client_id, client_secret, scope, resource } = result.data;

	// Validate client
	let client = await Client.show(db, { id: client_id });
	if (!client) {
		return reject("invalid_client", "Client not found", 401);
	}

	// Only m2m clients can use client credentials
	if (client.type !== "m2m") {
		return reject("unauthorized_client", "Client is not authorized for this grant type");
	}

	// Verify client secret
	let secretValid = await Secret.verify(db, client.id, client_secret);
	if (!secretValid) {
		return reject("invalid_client", "Invalid client credentials", 401);
	}

	// Get issuer and signing keys
	let issuer = await TenantMeta.getIssuer(db);
	if (!issuer) {
		return reject("server_error", "Issuer not configured");
	}

	let signingKeys = await SigningKey.getAll(db);
	if (signingKeys.length === 0) {
		return reject("server_error", "No signing keys available");
	}

	// Build audience
	let resources = Array.isArray(resource) ? resource : resource ? [resource] : [];
	let audience = [`https://${issuer}`, ...resources];

	// Generate access token
	let parsedScope = scope?.split(" ");
	let accessToken = AccessToken.generate(`https://${issuer}`, audience, client.id, parsedScope);
	let signedAccessToken = await accessToken.sign(JWK.Algoritm.ES256, signingKeys);

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

function parseBasicAuth(header: string | null): { clientId: string; clientSecret: string } | null {
	if (!header || !header.startsWith("Basic ")) return null;

	try {
		let encoded = header.slice(6);
		let decoded = atob(encoded);
		let [clientId, clientSecret] = decoded.split(":");
		if (!clientId || !clientSecret) return null;
		return {
			clientId: decodeURIComponent(clientId),
			clientSecret: decodeURIComponent(clientSecret),
		};
	} catch {
		return null;
	}
}

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
