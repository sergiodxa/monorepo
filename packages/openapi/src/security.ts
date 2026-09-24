/**
 * Security scheme builders for the schemes an API authenticates with: HTTP bearer, API
 * key, OAuth 2.0 and OpenID Connect, each returning the OpenAPI object for
 * `securitySchemes`, so a document names them without spelling the wire shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { OpenAPI } from "./types.js";

/**
 * An HTTP bearer scheme, the shape of an API key or access token sent in `Authorization`.
 *
 * @param options - A description and a hint at the token's format, such as `JWT`.
 * @example bearer({ description: "An API key from Settings, sent as a bearer token" });
 */
export function bearer(
	options: { description?: string; bearerFormat?: string } = {},
): OpenAPI.HttpScheme {
	return { type: "http", scheme: "bearer", ...options };
}

/**
 * A key sent in a header, query parameter or cookie.
 *
 * @param options - Where the key travels and under which name.
 * @example apiKey({ in: "header", name: "X-API-Key" });
 */
export function apiKey(options: {
	in: "header" | "query" | "cookie";
	name: string;
	description?: string;
}): OpenAPI.ApiKeyScheme {
	return { type: "apiKey", ...options };
}

/**
 * An OAuth 2.0 scheme with its flows. OpenAPI 3.1 has no field for the authorization
 * server's metadata, so link the resource's `/.well-known/oauth-protected-resource`
 * document from `description`.
 *
 * @param options - The flows, each with its URLs and the scopes it can grant.
 * @example oauth2({ flows: { clientCredentials: { tokenUrl: "https://api.example.com/oauth/token", scopes: { "users:read": "Read users" } } } });
 */
export function oauth2(options: {
	description?: string;
	flows: {
		clientCredentials?: { tokenUrl: string; scopes: Record<string, string> };
		authorizationCode?: {
			authorizationUrl: string;
			tokenUrl: string;
			scopes: Record<string, string>;
		};
	};
}): OpenAPI.OAuth2Scheme {
	return { type: "oauth2", ...options };
}

/**
 * An OpenID Connect scheme, discovered through the provider's configuration document.
 *
 * @param options - The discovery URL.
 * @example openIdConnect({ openIdConnectUrl: "https://auth.example.com/.well-known/openid-configuration" });
 */
export function openIdConnect(options: {
	openIdConnectUrl: string;
	description?: string;
}): OpenAPI.OpenIdConnectScheme {
	return { type: "openIdConnect", ...options };
}
