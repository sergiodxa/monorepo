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
	issuer: AUTH_ORIGIN,
	authorization_endpoint: `${AUTH_ORIGIN}/authorize`,
	token_endpoint: `${AUTH_ORIGIN}/oauth/token`,
	jwks_uri: `${AUTH_ORIGIN}/.well-known/jwks.json`,
	end_session_endpoint: `${AUTH_ORIGIN}/oidc/logout`,
};

/**
 * The provider, addressed by the origin its documents are served from and answering
 * with the identifier its tokens actually carry, which is what an ID token's `iss` is
 * held to.
 */
class AuthIssuer extends Issuer {
	/** The `iss` every token this provider signs carries. */
	override identifier(): Promise<string> {
		return Promise.resolve(AUTH_IDENTIFIER);
	}
}

/**
 * The provider for the current request, reading its key set through the KV cache so
 * one fetch per TTL serves every isolate.
 *
 * @returns The issuer the relying party is built on.
 * @example let keys = await issuer().keys();
 */
export function issuer(): Issuer {
	return new AuthIssuer(AUTH_ORIGIN, {
		metadata: AUTH_METADATA,
		cache: new Cache.KVStore(getEnv("CACHE"), getEnv("waitUntil")),
	});
}
