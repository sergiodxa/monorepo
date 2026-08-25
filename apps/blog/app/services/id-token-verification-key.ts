/**
 * ID-token verification key service for blog. Registers the upstream identity
 * provider's JWKS resolver as an application-container singleton so the fetched
 * key set is cached per isolate: fetched once, then refetched when a token names
 * an unknown key id, so upstream key rotations apply without a deploy here.
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
	register(container: Container) {
		container.singleton(IdTokenVerificationKeyService, () => new IdTokenVerificationKeyService());
	}
}
