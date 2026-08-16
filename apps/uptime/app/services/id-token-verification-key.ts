/**
 * ID-token verification key service. Holds the resolver pointed at the auth server's
 * JWKS endpoint so upstream identity tokens can be verified without refetching the key
 * set on every request. Exists so the auth callback can verify ID tokens cheaply within
 * a single Worker isolate's lifetime.
 *
 * The resolver is where the fetched key set is cached: it fetches the document on first
 * use and refetches it only when a token names a key it has not seen, which is how a
 * rotation upstream is picked up without a deploy here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK } from "@pkg/jwt";

/** Caches the remote JWK resolver used to verify upstream identity tokens. */
export class IdTokenVerificationKeyService {
	/** Remote verifier promise reused across requests in the current isolate. */
	readonly value = JWK.importRemote(new URL("https://auth.sergiodxa.com/.well-known/jwks.json"));
}
