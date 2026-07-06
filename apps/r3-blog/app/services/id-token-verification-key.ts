/**
 * ID-token verification key service for r3-blog. Imports and caches the remote
 * ES256 JWK set from the auth server's JWKS endpoint so upstream identity tokens
 * can be verified, and registers the resolver as an application-container singleton.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Container, ServiceProvider } from "@pkg/service-container";

import { JWK } from "@edgefirst-dev/jwt";

/** Caches the remote JWK resolver used to verify upstream identity tokens. */
export class IdTokenVerificationKeyService {
	/** Remote verifier promise reused across requests in the current isolate. */
	readonly value = JWK.importRemote(new URL("https://auth.sergiodxa.com/.well-known/jwks.json"), {
		alg: JWK.Algoritm.ES256,
	});
}

/** Registers the identity-token verification key as an app singleton. */
export class IdTokenVerificationKeyProvider implements ServiceProvider {
	/** Stores the remote JWK resolver in the application container. */
	register(container: Container) {
		container.singleton(IdTokenVerificationKeyService, () => new IdTokenVerificationKeyService());
	}
}
