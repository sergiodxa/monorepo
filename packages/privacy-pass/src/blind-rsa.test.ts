/**
 * Tests for Blind RSA token verification against RFC 9578 Appendix A.2: every published
 * token verifies under the published key, and a changed byte or another key refuses it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Hex, sha256 } from "@sdxc/crypto";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { importTokenKey, verifyToken } from "./blind-rsa.js";
import { BLIND_RSA_VECTORS, TOKEN_KEY } from "./fixtures/rfc-vectors.js";
import { createTestIssuer } from "./testing.js";
import { parseToken } from "./token.js";

let tokenKey = unwrap(Hex.decode(TOKEN_KEY));

describe("importTokenKey", () => {
	test("identifies the key by the SHA-256 of its encoding", async () => {
		let key = unwrap(await importTokenKey(tokenKey));

		expect(Hex.encode(key.tokenKeyId)).toBe(Hex.encode(unwrap(await sha256(tokenKey))));
		expect(key.notBefore).toBeNull();
	});

	test("refuses an rsaEncryption key and a truncated one", async () => {
		let pair = await crypto.subtle.generateKey(
			{
				name: "RSA-PSS",
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: "SHA-384",
			},
			true,
			["sign", "verify"],
		);
		let spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));

		for (let bytes of [spki, tokenKey.subarray(0, -1)]) {
			let result = await importTokenKey(bytes);
			expect(isFailure(result) && result.error.code).toBe("invalid-key");
		}
	});
});

describe("verifyToken", () => {
	test.each(BLIND_RSA_VECTORS.map((vector, index) => [index + 1, vector] as const))(
		"accepts RFC 9578 vector %i",
		async (_, vector) => {
			let key = unwrap(await importTokenKey(tokenKey));
			let token = unwrap(parseToken(unwrap(Hex.decode(vector.token))));

			expect(Hex.encode(token.challengeDigest)).toBe(
				Hex.encode(unwrap(await sha256(unwrap(Hex.decode(vector.challenge))))),
			);
			expect(unwrap(await verifyToken(token, key))).toBe(true);
		},
	);

	test("refuses a token whose nonce was changed", async () => {
		let key = unwrap(await importTokenKey(tokenKey));
		let token = unwrap(parseToken(unwrap(Hex.decode(BLIND_RSA_VECTORS[0]!.token))));
		token.nonce[0] = token.nonce[0]! ^ 1;

		let result = await verifyToken(token, key);

		expect(isFailure(result) && result.error.code).toBe("invalid-signature");
	});

	test("refuses a token checked against another key", async () => {
		let issuer = await createTestIssuer();
		let other = unwrap(await importTokenKey(issuer.tokenKey));
		let token = unwrap(parseToken(unwrap(Hex.decode(BLIND_RSA_VECTORS[0]!.token))));

		let result = await verifyToken(token, other);

		expect(isFailure(result) && result.error.code).toBe("unknown-key");
	});
});
