/**
 * Checks the RFC 7638 thumbprint against the published vectors: RFC 7638 §3.1 for RSA,
 * RFC 8037 Appendix A.3 for Ed25519, and the RFC 9421 test key that the Web Bot Auth draft
 * signs under, plus the members that must not change it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { JWK } from "./jwk.js";
import { thumbprint } from "./thumbprint.js";

/** RFC 7638 §3.1's RSA key, with the thumbprint the RFC computes for it. */
const RFC_7638_RSA = {
	kty: "RSA",
	n: "0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw",
	e: "AQAB",
	alg: "RS256",
	kid: "2011-04-29",
};

/** The thumbprint RFC 7638 §3.1 gives for its RSA key. */
const RFC_7638_THUMBPRINT = "NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs";

/** RFC 9421 B.1.4 `test-key-ed25519`, which the Web Bot Auth draft's vectors sign with. */
const RFC_9421_ED25519 = {
	kty: "OKP",
	crv: "Ed25519",
	x: "JrQLj5P_89iXES9-vFgrIy29clF9CC_oPPsw3c5D0bs",
	d: "n4Ni-HpISpVObnQMW0wOhCKROaIKqKtW_2ZYb2p9KcU",
};

describe("thumbprint", () => {
	test("matches RFC 7638 §3.1 for an RSA key, ignoring alg and kid", async () => {
		let result = await thumbprint(RFC_7638_RSA);

		expect(result).toEqual({ status: "success", data: RFC_7638_THUMBPRINT });
	});

	test("matches RFC 8037 Appendix A.3 for an Ed25519 key", async () => {
		let result = await thumbprint({
			kty: "OKP",
			crv: "Ed25519",
			x: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
		});

		expect(result).toEqual({
			status: "success",
			data: "kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k",
		});
	});

	test("gives a private JWK the keyid the Web Bot Auth draft signs its vectors under", async () => {
		let result = await thumbprint(RFC_9421_ED25519);

		expect(result).toEqual({
			status: "success",
			data: "poqkLGiymh_W0uP6PZFw-dvez3QJT5SolqXBCW38r0U",
		});
	});

	test("fails for a key missing a member its type requires", async () => {
		let result = await thumbprint({ kty: "OKP", crv: "Ed25519" });

		expect(isFailure(result)).toBe(true);
	});

	test("is reachable as JWK.thumbprint", async () => {
		let result = await JWK.thumbprint(RFC_7638_RSA);

		expect(isSuccess(result) && result.data).toBe(RFC_7638_THUMBPRINT);
	});
});
