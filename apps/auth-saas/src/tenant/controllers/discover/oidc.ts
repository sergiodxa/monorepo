import { JWK } from "@edgefirst-dev/jwt";

import action from "~/lib/action";
import TenantMeta from "~/tenant/models/tenant-meta";

export default action<"GET", "/.well-known/openid-configuration">(
	async ({ db, request, logger }) => {
		let log = logger.loader("/.well-known/openid-configuration");

		let issuer = await TenantMeta.getIssuer(db);
		// Use request host as fallback
		if (!issuer) issuer = new URL(request.url).host;

		let baseUrl = `https://${issuer}`;

		let configuration = {
			// Required fields
			issuer: baseUrl,
			authorization_endpoint: `${baseUrl}/authorize`,
			token_endpoint: `${baseUrl}/oauth/token`,
			jwks_uri: `${baseUrl}/.well-known/jwks.json`,

			// Recommended fields
			userinfo_endpoint: `${baseUrl}/userinfo`,

			// Supported features
			response_types_supported: ["code"],
			response_modes_supported: ["query", "fragment", "form_post"],
			grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
			subject_types_supported: ["public"],
			id_token_signing_alg_values_supported: [JWK.Algoritm.ES256],
			token_endpoint_auth_methods_supported: [
				"client_secret_basic",
				"client_secret_post",
				"none", // For public clients
			],

			// PKCE support
			code_challenge_methods_supported: ["S256", "plain"],

			// Scopes
			scopes_supported: ["openid", "profile", "email", "offline_access"],
			claims_supported: [
				"sub",
				"iss",
				"aud",
				"exp",
				"iat",
				"auth_time",
				"nonce",
				"name",
				"preferred_username",
				"email",
				"email_verified",
				"picture",
			],

			// Session management
			end_session_endpoint: `${baseUrl}/oidc/logout`,

			// Additional endpoints
			revocation_endpoint: `${baseUrl}/oauth/revoke`,
			revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
			introspection_endpoint: `${baseUrl}/oauth/introspect`,
			introspection_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],

			// Request object not supported
			request_parameter_supported: false,
			request_uri_parameter_supported: false,

			// WebAuthn support info
			acr_values_supported: ["urn:passkey"],
		};

		log.info("OpenID configuration served", { issuer: baseUrl });

		return new Response(JSON.stringify(configuration), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=3600", // Cache for 1 hour
			},
		});
	},
);
