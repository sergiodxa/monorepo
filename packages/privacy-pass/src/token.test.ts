/**
 * Tests for the Token structure and the `PrivateToken` credentials that carry it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Hex } from "@sdxc/crypto";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { BLIND_RSA_VECTORS } from "./fixtures/rfc-vectors.js";
import { toPaddedBase64Url } from "./lib/wire.js";
import { encodeToken, parseAuthorization, parseToken } from "./token.js";

let bytes = unwrap(Hex.decode(BLIND_RSA_VECTORS[0]!.token));

describe("parseToken", () => {
	test("round-trips an RFC 9578 token", () => {
		let token = unwrap(parseToken(bytes));

		expect(token.tokenType).toBe(2);
		expect(token.authenticator).toHaveLength(256);
		expect(Hex.encode(encodeToken(token))).toBe(BLIND_RSA_VECTORS[0]!.token);
	});

	test("refuses a token of the wrong length", () => {
		let result = parseToken(bytes.subarray(0, -1));

		expect(isFailure(result) && result.error.code).toBe("malformed-token");
	});

	test("refuses a greased token type", () => {
		let greased = new Uint8Array(bytes);
		greased.set([0x0a, 0x0a], 0);

		let result = parseToken(greased);

		expect(isFailure(result) && result.error.code).toBe("unsupported-token-type");
	});
});

describe("parseAuthorization", () => {
	let encoded = toPaddedBase64Url(bytes);

	test("reads a quoted token among other parameters", () => {
		let token = unwrap(
			parseAuthorization(`privatetoken extra="a, b", token="${encoded}", other=x`),
		);

		expect(Hex.encode(token.nonce)).toBe(BLIND_RSA_VECTORS[0]!.token.slice(4, 68));
	});

	test("reads an unquoted, unpadded token", () => {
		let result = parseAuthorization(`PrivateToken token=${encoded.replace(/=+$/, "")}`);

		expect(isFailure(result)).toBe(false);
	});

	test.each([[null], ["Bearer abc"], ["PrivateToken other=1"], ["PrivateToken"]])(
		"answers missing-token for %s",
		(header) => {
			let result = parseAuthorization(header);

			expect(isFailure(result) && result.error.code).toBe("missing-token");
		},
	);

	test("answers malformed-token for text that is not base64url", () => {
		let result = parseAuthorization('PrivateToken token="not base64!"');

		expect(isFailure(result) && result.error.code).toBe("malformed-token");
	});
});
