/**
 * The `/api/v1/*` surface's RFC 9728 protected resource metadata and the `WWW-Authenticate`
 * challenge every refusal carries, so a client holding only the API's URL learns how to
 * authenticate, which scopes exist and where the documentation lives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BearerChallenge } from "@sdxc/auth/bearer-challenge";
import type { ProtectedResourceMetadata } from "@sdxc/well-known/oauth-protected-resource";

import { stringify } from "@sdxc/auth/bearer-challenge";
import { define, metadataUrl } from "@sdxc/well-known/oauth-protected-resource";

import { apiKeyScopes } from "~/database/schema";

/** The path every API key is valid under, which is the resource identifier's path. */
const API_PATH = "/api/v1";

/**
 * The API's resource identifier on `origin`. It follows the serving origin, so a
 * preview deployment's challenge points at its own metadata and the §3.3 check holds.
 *
 * @param origin - The origin the request reached.
 */
export function apiResource(origin: string): URL {
	return new URL(API_PATH, origin);
}

/**
 * The metadata document for the API on `origin`. API keys come from the team settings
 * page, so it lists no authorization servers: it publishes the scopes a key can hold and
 * the reference that explains them.
 *
 * @param origin - The origin the request reached.
 */
export function apiMetadata(origin: string): ProtectedResourceMetadata {
	return define({
		resource: apiResource(origin),
		scopesSupported: [...apiKeyScopes],
		resourceName: { value: "Uptime API", translations: {} },
		resourceDocumentation: new URL("/docs/api/authentication", origin),
	});
}

/**
 * The `WWW-Authenticate` value for a refused API request, pointing at the metadata.
 * RFC 6750 §3.1 leaves `error` off when the request carried no credentials.
 *
 * @param origin - The origin the request reached.
 * @param challenge - The `error` and `scope` describing this refusal.
 * @example apiChallenge(ctx.url.origin, { error: "insufficient_scope", scope: ["monitors:read"] });
 */
export function apiChallenge(
	origin: string,
	challenge: Pick<Partial<BearerChallenge>, "error" | "scope"> = {},
): string {
	return stringify({ ...challenge, resourceMetadata: metadataUrl(apiResource(origin)) });
}
