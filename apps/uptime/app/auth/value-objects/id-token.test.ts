/**
 * Tests `IdToken`'s claim getters and `verifyIdToken`'s signature/audience/issuer
 * validation: a token signed by a known key and verified with the matching public
 * key reads back every claim through its typed getter, while a wrong audience,
 * wrong issuer, or a signature from an unrelated key all reject.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { JWK, JWT } from "@pkg/jwt";

import IdToken, { verifyIdToken } from "./id-token";

const ISSUER = "auth.sergiodxa.com";
const CLIENT_ID = "client-123";

/** Generates a fresh ES256 signing key pair usable with `JWT.sign`/`JWT.verify`. */
async function generateSigningKey() {
	let generated = await JWK.generateKeyPair(JWK.Algorithm.ES256);
	return await JWK.importKeyPair(generated);
}

/** Resolves keys the way the app does in production: out of a published JWK set. */
async function publishedKeys(keyPair: Awaited<ReturnType<typeof generateSigningKey>>) {
	return await JWK.importLocal(JWK.toJSON([keyPair]));
}

/** Signs a raw payload into a JWT string using the given key pair. */
async function signToken(
	payload: Record<string, unknown>,
	keyPair: Awaited<ReturnType<typeof generateSigningKey>>,
) {
	return await JWT.sign(new JWT(payload), JWK.Algorithm.ES256, [
		{ private: keyPair.private, alg: JWK.Algorithm.ES256, id: keyPair.id },
	]);
}

describe("IdToken", () => {
	test("exposes every claim through its typed getters", async () => {
		let keyPair = await generateSigningKey();
		let token = await signToken(
			{
				sub: "user-1",
				aud: CLIENT_ID,
				iss: ISSUER,
				name: "Ada Lovelace",
				email: "ada@example.com",
				picture: "https://example.com/ada.png",
				preferred_username: "ada",
				email_verified: true,
			},
			keyPair,
		);

		let idToken = await verifyIdToken(token, await publishedKeys(keyPair), CLIENT_ID);

		expect(idToken).toBeInstanceOf(IdToken);
		expect(idToken.subject).toBe("user-1");
		expect(idToken.audience).toBe(CLIENT_ID);
		expect(idToken.name).toBe("Ada Lovelace");
		expect(idToken.email).toBe("ada@example.com");
		expect(idToken.picture).toBe("https://example.com/ada.png");
		expect(idToken.username).toBe("ada");
		expect(idToken.emailVerified).toBe(true);
	});

	test("rejects a token whose audience doesn't match the expected client id", async () => {
		let keyPair = await generateSigningKey();
		let token = await signToken({ sub: "user-1", aud: "someone-else", iss: ISSUER }, keyPair);

		expect(verifyIdToken(token, await publishedKeys(keyPair), CLIENT_ID)).rejects.toThrow();
	});

	test("rejects a token whose issuer doesn't match auth.sergiodxa.com", async () => {
		let keyPair = await generateSigningKey();
		let token = await signToken(
			{ sub: "user-1", aud: CLIENT_ID, iss: "some-other-issuer" },
			keyPair,
		);

		expect(verifyIdToken(token, await publishedKeys(keyPair), CLIENT_ID)).rejects.toThrow();
	});

	test("rejects a token signed with a key that doesn't match the verification key", async () => {
		let signingKeyPair = await generateSigningKey();
		let unrelatedKeyPair = await generateSigningKey();
		let token = await signToken({ sub: "user-1", aud: CLIENT_ID, iss: ISSUER }, signingKeyPair);

		expect(
			verifyIdToken(token, await publishedKeys(unrelatedKeyPair), CLIENT_ID),
		).rejects.toThrow();
	});
});
