import { JWK, JWT } from "@pkg/jwt";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
/**
 * Unit tests for the ID-token verification key service. The JWKS endpoint is served
 * by a mock server, so the tests cover what the service is actually responsible for:
 * holding a resolver that fetches the key set lazily, reuses it across verifications,
 * and is not shared between instances.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { IdTokenVerificationKeyService } from "~/app/services/id-token-verification-key";

/** The endpoint the service is pointed at. */
const JWKS_URL = "https://auth.sergiodxa.com/.well-known/jwks.json";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Generates a key pair and serves its public half as the auth server's key set. */
async function publish(): Promise<JWK.KeyPair> {
	let keyPair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
	server.use(http.get(JWKS_URL, () => HttpResponse.json(JWK.toJSON([keyPair]))));
	return keyPair;
}

describe("IdTokenVerificationKeyService", () => {
	test("verifies a token against the key set the auth server publishes", async () => {
		let keyPair = await publish();
		let token = await new JWT({ sub: "user-1" }).sign(JWK.Algorithm.ES256, [keyPair]);

		let service = new IdTokenVerificationKeyService();
		let verified = await JWT.verify(token, await service.value, {
			algorithms: [JWK.Algorithm.ES256],
		});

		expect(verified.subject).toBe("user-1");
	});

	test("fetches the key set once and reuses it across verifications", async () => {
		let keyPair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let requests = 0;

		server.use(
			http.get(JWKS_URL, () => {
				requests += 1;
				return HttpResponse.json(JWK.toJSON([keyPair]));
			}),
		);

		let token = await new JWT({ sub: "user-1" }).sign(JWK.Algorithm.ES256, [keyPair]);
		let service = new IdTokenVerificationKeyService();
		let keys = await service.value;

		// Nothing has been fetched yet: the resolver goes to the network when a token
		// first needs a key, which is what keeps construction free of I/O.
		expect(requests).toBe(0);

		await JWT.verify(token, keys, { algorithms: [JWK.Algorithm.ES256] });
		await JWT.verify(token, keys, { algorithms: [JWK.Algorithm.ES256] });

		expect(requests).toBe(1);
	});

	test("rejects a token the published key set cannot account for", async () => {
		await publish();
		let unpublished = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let token = await new JWT({ sub: "user-1" }).sign(JWK.Algorithm.ES256, [unpublished]);

		let service = new IdTokenVerificationKeyService();

		await expect(
			JWT.verify(token, await service.value, { algorithms: [JWK.Algorithm.ES256] }),
		).rejects.toThrow();
	});

	test("rejects when the JWKS endpoint answers with an error", async () => {
		let keyPair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let token = await new JWT({ sub: "user-1" }).sign(JWK.Algorithm.ES256, [keyPair]);

		server.use(http.get(JWKS_URL, () => new HttpResponse(null, { status: 500 })));

		let service = new IdTokenVerificationKeyService();

		await expect(
			JWT.verify(token, await service.value, { algorithms: [JWK.Algorithm.ES256] }),
		).rejects.toThrow();
	});

	test("each instance gets its own resolver, and therefore its own cache", async () => {
		let first = new IdTokenVerificationKeyService();
		let second = new IdTokenVerificationKeyService();

		expect(first.value).not.toBe(second.value);
		await expect(first.value).resolves.toBeTypeOf("function");
		await expect(second.value).resolves.toBeTypeOf("function");
	});
});
