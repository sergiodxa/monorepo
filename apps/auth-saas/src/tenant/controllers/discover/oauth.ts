import { JWK } from "@edgefirst-dev/jwt";

import action from "~/lib/action";
import TenantMeta from "~/tenant/models/tenant-meta";

// OAuth 2.0 Authorization Server Metadata (RFC 8414)
export default action<"GET", "/.well-known/oauth-authorization-server">(async ({ db, request }) => {
	let issuer = await TenantMeta.getIssuer(db);
	// Use request host as fallback
	if (!issuer) issuer = new URL(request.url).host;

	let baseUrl = `https://${issuer}`;

	let metadata = {
		// Required fields
		issuer: baseUrl,
		authorization_endpoint: `${baseUrl}/authorize`,
		token_endpoint: `${baseUrl}/oauth/token`,

		// Recommended fields
		jwks_uri: `${baseUrl}/.well-known/jwks.json`,

		// Supported features
		response_types_supported: ["code"],
		response_modes_supported: ["query", "fragment", "form_post"],
		grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
		token_endpoint_auth_methods_supported: [
			"client_secret_basic",
			"client_secret_post",
			"none", // For public clients
		],

		// PKCE support
		code_challenge_methods_supported: ["S256", "plain"],

		// Scopes
		scopes_supported: ["openid", "profile", "email", "offline_access"],

		// Token revocation
		revocation_endpoint: `${baseUrl}/oauth/revoke`,
		revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],

		// Token introspection
		introspection_endpoint: `${baseUrl}/oauth/introspect`,
		introspection_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],

		// Signing algorithms
		token_endpoint_auth_signing_alg_values_supported: [JWK.Algoritm.ES256],

		// Service documentation
		service_documentation: `${baseUrl}/docs`,

		// UI locales - could be fetched from Brand settings
		ui_locales_supported: ["en"],
	};

	return new Response(JSON.stringify(metadata), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600", // Cache for 1 hour
		},
	});
});
