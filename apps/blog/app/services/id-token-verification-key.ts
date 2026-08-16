/**
 * ID-token verification key service for blog. Holds the resolver pointed at the auth
 * server's JWKS endpoint so upstream identity tokens can be verified, and registers it
 * as an application-container singleton.
 *
 * A singleton because the resolver is where the fetched key set is cached: one per
 * isolate fetches the document once and refetches it only when a token names a key it
 * has not seen, which is how a rotation upstream is picked up without a deploy here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Container, ServiceProvider } from "@pkg/service-container";

import { JWK } from "@pkg/jwt";

/** Caches the remote JWK resolver used to verify upstream identity tokens. */
export class IdTokenVerificationKeyService {
	/** Remote verifier promise reused across requests in the current isolate. */
	readonly value = JWK.importRemote(new URL("https://auth.sergiodxa.com/.well-known/jwks.json"));
}

/** Registers the identity-token verification key as an app singleton. */
export class IdTokenVerificationKeyProvider implements ServiceProvider {
	/** Stores the remote JWK resolver in the application container. */
	register(container: Container) {
		container.singleton(IdTokenVerificationKeyService, () => new IdTokenVerificationKeyService());
	}
}
