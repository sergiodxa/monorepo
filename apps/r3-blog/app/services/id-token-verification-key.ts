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
