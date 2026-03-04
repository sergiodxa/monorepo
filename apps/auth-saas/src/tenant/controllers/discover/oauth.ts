import { JWK } from "@edgefirst-dev/jwt";

import action from "~/lib/action";
import TenantMeta from "~/tenant/models/tenant-meta";

/**
 * OAuth 2.0 Authorization Server Metadata endpoint (RFC 8414).
 * Provides discovery information about the OAuth 2.0 authorization server.
 */
export default action<"GET", "/.well-known/oauth-authorization-server">(
	async ({ db, request, logger }) => {
		let log = logger.loader("/.well-known/oauth-authorization-server");

		let issuer = await TenantMeta.getIssuer(db);
		if (!issuer) issuer = new URL(request.url).host;

		let baseUrl = `https://${issuer}`;

		let metadata = {
			issuer: baseUrl,
			authorization_endpoint: `${baseUrl}/authorize`,
			token_endpoint: `${baseUrl}/oauth/token`,

			jwks_uri: `${baseUrl}/.well-known/jwks.json`,

			response_types_supported: ["code"],
			response_modes_supported: ["query", "fragment", "form_post"],
			grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
			token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],

			code_challenge_methods_supported: ["S256", "plain"],

			scopes_supported: ["openid", "profile", "email", "offline_access"],

			revocation_endpoint: `${baseUrl}/oauth/revoke`,
			revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],

			introspection_endpoint: `${baseUrl}/oauth/introspect`,
			introspection_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],

			token_endpoint_auth_signing_alg_values_supported: [JWK.Algoritm.ES256],

			service_documentation: `${baseUrl}/docs`,

			ui_locales_supported: ["en"],
		};

		log.info("OAuth authorization server metadata served", { issuer: baseUrl });

		return new Response(JSON.stringify(metadata), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=3600",
			},
		});
	},
);
