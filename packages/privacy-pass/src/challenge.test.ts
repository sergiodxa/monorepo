/**
 * Tests for the TokenChallenge structure and the `WWW-Authenticate` challenge, checked
 * against the authenticator inputs of RFC 9577 Appendix A.1 and the header of Appendix A.2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Hex, concatBytes, sha256 } from "@sdxc/crypto";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { encodeTokenChallenge, formatChallenge, parseTokenChallenge } from "./challenge.js";
import { BLIND_RSA_VECTORS, STRUCTURE_VECTORS, TOKEN_KEY } from "./fixtures/rfc-vectors.js";

describe("encodeTokenChallenge", () => {
	test.each(STRUCTURE_VECTORS.map((vector, index) => [index + 1, vector] as const))(
		"yields RFC 9577 vector %i's authenticator input",
		async (_, vector) => {
			let encoded = unwrap(
				encodeTokenChallenge({
					tokenType: 2,
					issuerName: new TextDecoder().decode(unwrap(Hex.decode(vector.issuerName))),
					redemptionContext: unwrap(Hex.decode(vector.redemptionContext)),
					originInfo: splitOrigins(vector.originInfo),
				}),
			);
			let digest = unwrap(await sha256(encoded));
			let input = concatBytes(
				new Uint8Array([0, 2]),
				unwrap(Hex.decode(vector.nonce)),
				digest,
				unwrap(Hex.decode(vector.tokenKeyId)),
			);

			expect(Hex.encode(input)).toBe(vector.authenticatorInput);
		},
	);

	test("refuses a redemption context of another length", () => {
		let result = encodeTokenChallenge({
			tokenType: 2,
			issuerName: "issuer.example.com",
			redemptionContext: new Uint8Array(16),
			originInfo: [],
		});

		expect(isFailure(result) && result.error.code).toBe("invalid-challenge");
	});

	test("refuses a name with userinfo or a comma", () => {
		for (let name of ["user@issuer.example.com", "a.example.com,b.example.com"]) {
			let result = encodeTokenChallenge({
				tokenType: 2,
				issuerName: name,
				redemptionContext: new Uint8Array(),
				originInfo: [],
			});
			expect(isFailure(result)).toBe(true);
		}
	});
});

describe("parseTokenChallenge", () => {
	test("reads back every RFC 9578 challenge", () => {
		let parsed = BLIND_RSA_VECTORS.map(({ challenge }) =>
			unwrap(parseTokenChallenge(unwrap(Hex.decode(challenge)))),
		);

		expect(parsed.map(({ originInfo }) => originInfo)).toEqual([
			["origin.example"],
			["origin.example"],
			["foo.example", "bar.example"],
			[],
			[],
		]);
		expect(parsed.map(({ redemptionContext }) => redemptionContext.length)).toEqual([
			32, 0, 0, 0, 32,
		]);
		expect(parsed.every(({ issuerName }) => issuerName === "issuer.example")).toBe(true);
	});

	test("refuses a truncated or padded challenge", () => {
		let bytes = unwrap(Hex.decode(BLIND_RSA_VECTORS[3]!.challenge));

		expect(isFailure(parseTokenChallenge(bytes.subarray(0, -1)))).toBe(true);
		expect(isFailure(parseTokenChallenge(concatBytes(bytes, new Uint8Array([0]))))).toBe(true);
	});
});

describe("formatChallenge", () => {
	test("writes RFC 9577 Appendix A.2's challenge and token-key values", () => {
		let challenge = unwrap(
			Hex.decode(
				"0002000e6973737565722e6578616d706c65208a3e83a33d98005d2f30bef419fa6bf4cd5c6005e36b1285bbb4ccd40fa4b383000e6f726967696e2e6578616d706c65",
			),
		);

		let header = formatChallenge({
			challenge,
			tokenKey: unwrap(Hex.decode(TOKEN_KEY)),
			maxAge: 10,
		});

		expect(header).toMatch(
			/^PrivateToken challenge="AAIADmlzc3Vlci5leGFtcGxlIIo-g6M9mABdLzC-9Bn6a_TNXGAF42sShbu0zNQPpLODAA5vcmlnaW4uZXhhbXBsZQ==", token-key="MIIBUjA9BgkqhkiG9w0BAQowMKANMAsGCWCGSAFlAwQCAqEaMBgGCSqG/,
		);
		expect(header).toMatch(/token-key="[^"]+IDAQAB", max-age=10$/);
	});

	test("leaves out max-age when none is given", () => {
		let header = formatChallenge({ challenge: new Uint8Array([0]), tokenKey: new Uint8Array([1]) });

		expect(header).toBe('PrivateToken challenge="AA==", token-key="AQ=="');
	});
});

/**
 * The origin list a vector carries as hex.
 *
 * @param hex - The `origin_info` field
 * @returns The names
 */
function splitOrigins(hex: string): string[] {
	let text = new TextDecoder().decode(unwrap(Hex.decode(hex)));
	return text === "" ? [] : text.split(",");
}
