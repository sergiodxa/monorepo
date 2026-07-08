/**
 * ID-token verification key service. Imports and caches the remote ES256 JWK set from
 * the auth server's JWKS endpoint so upstream identity tokens can be verified without
 * refetching it on every request. Exists so the auth callback can verify ID tokens
 * cheaply within a single Worker isolate's lifetime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK } from "@edgefirst-dev/jwt";

/** Caches the remote JWK resolver used to verify upstream identity tokens. */
export class IdTokenVerificationKeyService {
	/** Remote verifier promise reused across requests in the current isolate. */
	readonly value = JWK.importRemote(new URL("https://auth.sergiodxa.com/.well-known/jwks.json"), {
		alg: JWK.Algoritm.ES256,
	});
}
