/**
 * Tests for COSE keys and COSE_Sign1, against the RFC 9052 Appendix C examples and the RFC
 * 9679 thumbprint example, plus round trips through every supported algorithm.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Hex } from "@sdxc/crypto";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import * as COSE from "./cose.js";

import type { CBORValue } from "./index.js";

import { decode, encode, Tagged } from "./index.js";

/** Bytes from a hex string a spec prints. */
function hex(text: string): Uint8Array<ArrayBuffer> {
	return unwrap(Hex.decode(text.replaceAll(/\s/g, "")));
}

/** The RFC 9052 Appendix C.7 P-256 key with kid "11", public half. */
const KEY_11 = new Map<CBORValue, CBORValue>([
	[1, 2],
	[2, new TextEncoder().encode("11")],
	[-1, 1],
	[-2, hex("bac5b11cad8f99f9c72b05cf4b9e26d244dc189f745228255a219a86d6a09eff")],
	[-3, hex("20138bf82dc1b6d562be0fa54ab7804a3a64b6d72ccfed6b6fb6ed28bbfc117e")],
]);

/** The RFC 9052 Appendix C.2.1 single ECDSA signature, as the CBOR its EDN describes. */
const C_2_1 = unwrap(
	encode(
		new Tagged(18, [
			hex("a10126"),
			new Map([[4, new TextEncoder().encode("11")]]),
			new TextEncoder().encode("This is the content."),
			hex(`8eb33e4ca31d1c465ab05aac34cc6b23d58fef5c083106c4d25a91aef0b0117e2af9a291aa32e14ab834dc56ed2a2234
				44547e01f11d3b0916e5a4c345cacb36`),
		]),
	),
);

/** A fresh key pair for one algorithm's WebCrypto parameters. */
async function generate(params: EcKeyGenParams | RsaHashedKeyGenParams | AlgorithmIdentifier) {
	return (await crypto.subtle.generateKey(params, true, ["sign", "verify"])) as CryptoKeyPair;
}

describe("verifySign1", () => {
	test("verifies the RFC 9052 Appendix C.2.1 example under its published key", async () => {
		expect(C_2_1).toHaveLength(98);
		let key = unwrap(await COSE.importKey(KEY_11));
		let message = unwrap(await COSE.verifySign1(C_2_1, key));
		expect(new TextDecoder().decode(message.payload ?? undefined)).toBe("This is the content.");
		expect(message.protected.get(COSE.HeaderParameter.ALG)).toBe(COSE.Algorithm.ES256);
	});

	test("refuses the example once its payload changes", async () => {
		let key = unwrap(await COSE.importKey(KEY_11));
		let message = unwrap(COSE.decodeSign1(C_2_1));
		let tampered = { ...message, payload: new TextEncoder().encode("This is the content!") };
		let result = await COSE.verifySign1(tampered, key);
		expect(isFailure(result) && result.error.code).toBe("invalid-signature");
	});

	test("refuses a key imported for another algorithm than the header names", async () => {
		let pair = await generate({ name: "ECDSA", namedCurve: "P-384" });
		let result = await COSE.verifySign1(C_2_1, pair.publicKey);
		expect(isFailure(result) && result.error.code).toBe("unsupported-key");
	});

	test("refuses an algorithm outside the accepted list", async () => {
		let key = unwrap(await COSE.importKey(KEY_11));
		let result = await COSE.verifySign1(C_2_1, key, { algorithms: [COSE.Algorithm.ED25519] });
		expect(isFailure(result) && result.error.code).toBe("unsupported-algorithm");
	});
});

describe("sign1", () => {
	let cases: [string, number, EcKeyGenParams | RsaHashedKeyGenParams | AlgorithmIdentifier][] = [
		["ES256", COSE.Algorithm.ES256, { name: "ECDSA", namedCurve: "P-256" }],
		["ES384", COSE.Algorithm.ES384, { name: "ECDSA", namedCurve: "P-384" }],
		["ES512", COSE.Algorithm.ES512, { name: "ECDSA", namedCurve: "P-521" }],
		["Ed25519", COSE.Algorithm.ED25519, { name: "Ed25519" }],
		[
			"PS256",
			COSE.Algorithm.PS256,
			{
				name: "RSA-PSS",
				hash: "SHA-256",
				modulusLength: 2048,
				publicExponent: Uint8Array.of(1, 0, 1),
			},
		],
	];

	test.each(cases)("round-trips a %s signature", async (_, algorithm, params) => {
		let pair = await generate(params);
		let payload = new TextEncoder().encode("payload");
		let bytes = unwrap(
			await COSE.sign1({ protected: new Map([[1, algorithm]]), payload, key: pair.privateKey }),
		);
		let message = unwrap(await COSE.verifySign1(bytes, pair.publicKey));
		expect(message.payload).toEqual(payload);
	});

	test("signs a detached payload that verification takes separately", async () => {
		let pair = await generate({ name: "Ed25519" });
		let payload = new TextEncoder().encode("large artifact digest");
		let bytes = unwrap(
			await COSE.sign1({
				protected: new Map([[1, -19]]),
				payload,
				detached: true,
				key: pair.privateKey,
			}),
		);
		let message = unwrap(COSE.decodeSign1(bytes));
		expect(message.payload).toBeNull();

		let missing = await COSE.verifySign1(message, pair.publicKey);
		expect(isFailure(missing) && missing.error.code).toBe("malformed");
		expect(isFailure(await COSE.verifySign1(message, pair.publicKey, { payload }))).toBe(false);
		let other = await COSE.verifySign1(message, pair.publicKey, { payload: Uint8Array.of(1) });
		expect(isFailure(other) && other.error.code).toBe("invalid-signature");
	});

	test("binds external AAD to the signature", async () => {
		let pair = await generate({ name: "Ed25519" });
		let externalAad = Uint8Array.of(1, 2, 3);
		let bytes = unwrap(
			await COSE.sign1({
				protected: new Map([[1, -19]]),
				payload: Uint8Array.of(9),
				externalAad,
				key: pair.privateKey,
			}),
		);
		expect(isFailure(await COSE.verifySign1(bytes, pair.publicKey, { externalAad }))).toBe(false);
		expect(isFailure(await COSE.verifySign1(bytes, pair.publicKey))).toBe(true);
	});

	test("keeps the signature valid when the unprotected header changes", async () => {
		let pair = await generate({ name: "Ed25519" });
		let bytes = unwrap(
			await COSE.sign1({
				protected: new Map([[1, -19]]),
				payload: Uint8Array.of(9),
				key: pair.privateKey,
			}),
		);
		let message = unwrap(COSE.decodeSign1(bytes));
		let rewritten = unwrap(
			COSE.encodeSign1({ ...message, unprotected: new Map([[394, ["receipt"]]]) }),
		);
		expect(isFailure(await COSE.verifySign1(rewritten, pair.publicKey))).toBe(false);
	});

	test("refuses a protected header with no algorithm", async () => {
		let pair = await generate({ name: "Ed25519" });
		let result = await COSE.sign1({
			protected: new Map(),
			payload: Uint8Array.of(1),
			key: pair.privateKey,
		});
		expect(isFailure(result) && result.error.code).toBe("unsupported-algorithm");
	});

	test("accepts a crit label only when the verifier understands it", async () => {
		let pair = await generate({ name: "Ed25519" });
		let bytes = unwrap(
			await COSE.sign1({
				protected: new Map<CBORValue, CBORValue>([
					[1, -19],
					[2, [15]],
					[15, new Map([[1, "issuer"]])],
				]),
				payload: Uint8Array.of(1),
				key: pair.privateKey,
			}),
		);
		let unknown = await COSE.verifySign1(bytes, pair.publicKey);
		expect(isFailure(unknown) && unknown.error.code).toBe("unknown-critical");
		expect(isFailure(await COSE.verifySign1(bytes, pair.publicKey, { understood: [15] }))).toBe(
			false,
		);
	});
});

describe("decodeSign1", () => {
	test("reads an untagged message and an empty protected header", () => {
		let bytes = unwrap(encode([new Uint8Array(0), new Map(), null, Uint8Array.of(1)]));
		let message = unwrap(COSE.decodeSign1(bytes));
		expect(message.protected.size).toBe(0);
		expect(message.payload).toBeNull();
	});

	test("refuses another tag and a wrong shape", () => {
		let wrongTag = COSE.decodeSign1(unwrap(encode(new Tagged(98, []))));
		expect(isFailure(wrongTag) && wrongTag.error.code).toBe("malformed");
		let shape = COSE.decodeSign1(unwrap(encode([1, 2, 3])));
		expect(isFailure(shape) && shape.error.code).toBe("malformed");
	});
});

describe("keys", () => {
	test("computes the RFC 9679 Section 6 thumbprint", async () => {
		let key = unwrap(
			decode(
				hex(`A50102200121582065EDA5A12577C2BAE829437FE338701A10AAA375E1BB5B5DE108DE439C08551D2258201E52ED757011
				63F7F9E40DDF9F341B3DC9BA860AF7E0CA7CA7E9EECD0084D19C025820496BD8AFADF307E5B08C64B0421BF9DC01528A344A43
				BDA88FADD1669DA253EC`),
			),
		) as COSE.Key;
		let thumbprint = unwrap(await COSE.thumbprint(key));
		expect(Hex.encode(thumbprint)).toBe(
			"496bd8afadf307e5b08c64b0421bf9dc01528a344a43bda88fadd1669da253ec",
		);
	});

	test("converts a JWK to a COSE key and back", async () => {
		let pair = await generate({ name: "ECDSA", namedCurve: "P-256" });
		let jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
		let key = unwrap(COSE.fromJWK({ ...jwk, kid: "service-key" }));
		expect(key.get(2)).toEqual(new TextEncoder().encode("service-key"));
		expect(unwrap(COSE.toJWK(key))).toEqual({ kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y });
	});

	test("imports a private COSE key for signing", async () => {
		let pair = await generate({ name: "Ed25519" });
		let key = unwrap(COSE.fromJWK(await crypto.subtle.exportKey("jwk", pair.privateKey)));
		let signing = unwrap(await COSE.importKey(key));
		expect(signing.usages).toEqual(["sign"]);
	});

	test("refuses a key whose own alg disagrees with the requested one", async () => {
		let key = new Map(KEY_11).set(3, COSE.Algorithm.ES256);
		let result = await COSE.importKey(key, COSE.Algorithm.ES384);
		expect(isFailure(result) && result.error.code).toBe("unsupported-key");
	});

	test("needs an algorithm for an RSA key", async () => {
		let pair = await generate({
			name: "RSA-PSS",
			hash: "SHA-256",
			modulusLength: 2048,
			publicExponent: Uint8Array.of(1, 0, 1),
		});
		let key = unwrap(COSE.fromJWK(await crypto.subtle.exportKey("jwk", pair.publicKey)));
		let unnamed = await COSE.importKey(key);
		expect(isFailure(unnamed) && unnamed.error.code).toBe("unsupported-algorithm");
		expect(isFailure(await COSE.importKey(key, COSE.Algorithm.PS256))).toBe(false);
	});
});
