/**
 * The identity provider the CMS signs its editors in through. Holds the provider's
 * endpoints and the published key set every ID token is verified against, so the
 * login, the callback, and the logout all measure themselves against one issuer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Issuer } from "@pkg/auth/issuer";
import { Cache } from "@pkg/kv-cache";

import { getEnv } from "~/app/http/middleware/env";

/** Origin the provider serves every one of its endpoints on. */
const AUTH_ORIGIN = "https://auth.sergiodxa.com";

/**
 * The `iss` the provider writes into every token it signs. It carries no scheme, and
 * a verification compares it byte for byte, so it is stated apart from the origin the
 * endpoints live on.
 */
const AUTH_IDENTIFIER = "auth.sergiodxa.com";

/** The provider's endpoints, stated here so a login spends no round-trip on discovery. */
const AUTH_METADATA: Issuer.Metadata = {
	issuer: AUTH_IDENTIFIER,
	authorization_endpoint: `${AUTH_ORIGIN}/authorize`,
	token_endpoint: `${AUTH_ORIGIN}/oauth/token`,
	jwks_uri: `${AUTH_ORIGIN}/.well-known/jwks.json`,
	end_session_endpoint: `${AUTH_ORIGIN}/oidc/logout`,
};

/**
 * The shared provider, whose key set is read through the KV cache so one fetch per TTL
 * serves every isolate. The cache is stated as a factory because its bindings and its
 * `waitUntil` arrive with each request, so every read resolves the store belonging to
 * the request making it.
 *
 * @returns The issuer the relying party is built on.
 * @example let keys = await issuer().keys();
 */
export function issuer(): Issuer {
	return Issuer.for(AUTH_ORIGIN, {
		identifier: AUTH_IDENTIFIER,
		metadata: AUTH_METADATA,
		cache: () => new Cache.KVStore(getEnv("CACHE"), getEnv("waitUntil")),
	});
}
