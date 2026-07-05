import { JWK } from "@edgefirst-dev/jwt";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import TenantMeta from "../../management/models/tenant-meta";
import routes from "../../routes";

/**
 * OpenID Connect Discovery endpoint (OIDC Discovery 1.0).
 * Provides discovery information about the OpenID Provider.
 */
export default createAction(
	routes.discover.oidc,
	inject([Database] as const, async (db) => {
		let { request, logger } = getContext();
		let log = logger.loader("/.well-known/openid-configuration");

		let issuer = await TenantMeta.getIssuer(db);
		if (!issuer) issuer = new URL(request.url).host;

		let baseUrl = `https://${issuer}`;

		let configuration = {
			issuer: baseUrl,
			authorization_endpoint: `${baseUrl}/authorize`,
			token_endpoint: `${baseUrl}/oauth/token`,
			jwks_uri: `${baseUrl}/.well-known/jwks.json`,

			userinfo_endpoint: `${baseUrl}/userinfo`,

			response_types_supported: ["code"],
			response_modes_supported: ["query", "fragment", "form_post"],
			grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
			subject_types_supported: ["public"],
			id_token_signing_alg_values_supported: [JWK.Algoritm.ES256],
			token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],

			code_challenge_methods_supported: ["S256", "plain"],

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

			end_session_endpoint: `${baseUrl}/oidc/logout`,

			revocation_endpoint: `${baseUrl}/oauth/revoke`,
			revocation_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
			introspection_endpoint: `${baseUrl}/oauth/introspect`,
			introspection_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],

			request_parameter_supported: false,
			request_uri_parameter_supported: false,

			acr_values_supported: ["urn:passkey"],
		};

		log.info("OpenID configuration served", { issuer: baseUrl });

		return new Response(JSON.stringify(configuration), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=3600",
			},
		});
	}),
);
