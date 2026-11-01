/**
 * Tests for `importSignatureKey`: PEM and JWK keys from the RFC 9421 test vectors import for
 * the algorithm their type decides, sign and verify through the package, and keys of the
 * wrong kind or algorithm answer the failure that names why.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, success, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	CAVAGE_PUBLIC_PEM,
	ECC_P256_PUBLIC_PEM,
	ED25519_PRIVATE_PEM,
	ED25519_PUBLIC_PEM,
	RSA_PSS_PUBLIC_PEM,
} from "./fixtures/keys.js";
import { importSignatureKey } from "./key.js";
import { algorithmOfKey } from "./lib/algorithms.js";
import { sign } from "./sign.js";
import { verify } from "./verify.js";

describe("importSignatureKey", () => {
	test("reads the algorithm from a PEM key's type", async () => {
		let ed = unwrap(await importSignatureKey(ED25519_PUBLIC_PEM, { usage: "verify" }));
		let ec = unwrap(await importSignatureKey(ECC_P256_PUBLIC_PEM, { usage: "verify" }));
		let rsa = unwrap(await importSignatureKey(CAVAGE_PUBLIC_PEM, { usage: "verify" }));
		expect(algorithmOfKey(ed)).toBe("ed25519");
		expect(algorithmOfKey(ec)).toBe("ecdsa-p256-sha256");
		expect(algorithmOfKey(rsa)).toBe("rsa-v1_5-sha256");
	});

	test("imports an RSA PEM key for the algorithm given", async () => {
		let key = unwrap(
			await importSignatureKey(RSA_PSS_PUBLIC_PEM, {
				usage: "verify",
				algorithm: "rsa-pss-sha512",
			}),
		);
		expect(algorithmOfKey(key)).toBe("rsa-pss-sha512");
	});

	test("signs with a private PEM key and verifies with its public half", async () => {
		let privateKey = unwrap(await importSignatureKey(ED25519_PRIVATE_PEM, { usage: "sign" }));
		let publicKey = unwrap(await importSignatureKey(ED25519_PUBLIC_PEM, { usage: "verify" }));
		let signed = unwrap(
			await sign(new Request("https://sdxc.dev/inbox"), {
				scheme: "rfc9421",
				key: { id: "k", privateKey },
				components: ["@method", "@target-uri", "@authority", "date"],
			}),
		);
		let verified = await verify(signed, {
			key: async () => success(publicKey),
			maxAge: "1 minute",
		});
		expect(isFailure(verified)).toBe(false);
	});

	test("reads a JWK, given as JSON text or an object", async () => {
		let pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
			"sign",
			"verify",
		])) as CryptoKeyPair;
		let jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
		let signing = unwrap(await importSignatureKey(JSON.stringify(jwk), { usage: "sign" }));
		let member = { ...jwk, kid: "k" };
		let verifying = unwrap(await importSignatureKey(member, { usage: "verify" }));
		expect(algorithmOfKey(signing)).toBe("ecdsa-p256-sha256");
		expect(verifying.type).toBe("public");
	});

	test("reads an RSA JWK's JOSE alg", async () => {
		let pair = (await crypto.subtle.generateKey(
			{
				name: "RSA-PSS",
				hash: "SHA-512",
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
			},
			true,
			["sign", "verify"],
		)) as CryptoKeyPair;
		let jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
		let key = unwrap(await importSignatureKey(jwk, { usage: "verify" }));
		expect(algorithmOfKey(key)).toBe("rsa-pss-sha512");
	});

	test("refuses a public key for signing", async () => {
		let pem = await importSignatureKey(ED25519_PUBLIC_PEM, { usage: "sign" });
		expect(isFailure(pem) && pem.error.code).toBe("malformed");
		let jwk = await importSignatureKey({ kty: "OKP", crv: "Ed25519", x: "AA" }, { usage: "sign" });
		expect(isFailure(jwk) && jwk.error.code).toBe("unsupported-algorithm");
	});

	test("refuses a key that fits no algorithm", async () => {
		let symmetric = await importSignatureKey({ kty: "oct", k: "AA" }, { usage: "verify" });
		expect(isFailure(symmetric) && symmetric.error.code).toBe("unsupported-algorithm");
		let mismatched = await importSignatureKey(ED25519_PUBLIC_PEM, {
			usage: "verify",
			algorithm: "ecdsa-p256-sha256",
		});
		expect(isFailure(mismatched) && mismatched.error.message).toBe(
			"The key cannot be imported for ecdsa-p256-sha256",
		);
	});

	test("refuses text that is neither PEM nor JSON", async () => {
		let garbage = await importSignatureKey("not a key", { usage: "verify" });
		expect(isFailure(garbage) && garbage.error.code).toBe("malformed");
		let json = await importSignatureKey("{nope", { usage: "verify" });
		expect(isFailure(json) && json.error.message).toBe("The key is not valid JSON");
	});
});
