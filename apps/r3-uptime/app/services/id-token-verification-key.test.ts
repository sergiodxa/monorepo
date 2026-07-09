/**
 * Unit tests for the ID-token verification key service. Mocks the global `fetch`
 * that backs the remote JWKS lookup so a matching key resolves to a usable
 * `CryptoKey` and a JWKS with no matching key rejects, without any real network
 * call to the auth server.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, describe, expect, test } from "bun:test";

import { IdTokenVerificationKeyService } from "~/app/services/id-token-verification-key";

let originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

/** Generates a real ES256 (P-256) public JWK usable as a JWKS entry. */
async function generateEs256PublicJwk() {
	let keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
		"sign",
		"verify",
	]);
	return crypto.subtle.exportKey("jwk", keyPair.publicKey);
}

describe("IdTokenVerificationKeyService", () => {
	test("resolves the remote ES256 public key when the JWKS has a matching key", async () => {
		let jwk = await generateEs256PublicJwk();
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ keys: [jwk] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})) as unknown as typeof fetch;

		let service = new IdTokenVerificationKeyService();
		let keys = await service.value;

		expect(keys).toHaveLength(1);
		expect(keys[0]?.public).toBeInstanceOf(CryptoKey);
	});

	test("rejects when the JWKS has no key matching the ES256 algorithm", async () => {
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ keys: [] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})) as unknown as typeof fetch;

		let service = new IdTokenVerificationKeyService();

		await expect(service.value).rejects.toThrow();
	});

	test("rejects when the JWKS endpoint responds with a non-200 status", async () => {
		globalThis.fetch = (async () =>
			new Response("not found", { status: 404 })) as unknown as typeof fetch;

		let service = new IdTokenVerificationKeyService();

		await expect(service.value).rejects.toThrow();
	});

	test("each instance gets its own independent verifier promise", async () => {
		let jwk = await generateEs256PublicJwk();
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ keys: [jwk] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})) as unknown as typeof fetch;

		let first = new IdTokenVerificationKeyService();
		let second = new IdTokenVerificationKeyService();

		expect(first.value).not.toBe(second.value);
		await expect(first.value).resolves.toHaveLength(1);
		await expect(second.value).resolves.toHaveLength(1);
	});
});
