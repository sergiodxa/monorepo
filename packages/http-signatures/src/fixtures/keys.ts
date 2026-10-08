/**
 * The published test keys of RFC 9421 Appendix B.1 and draft-cavage-12 Appendix C, and
 * the request both documents sign, so the test suites check signatures other
 * implementations produced rather than only ones this package made.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Pem } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

/** RFC 9421 B.1.2 `test-key-rsa-pss`, public half. */
export const RSA_PSS_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr4tmm3r20Wd/PbqvP1s2
+QEtvpuRaV8Yq40gjUR8y2Rjxa6dpG2GXHbPfvMs8ct+Lh1GH45x28Rw3Ry53mm+
oAXjyQ86OnDkZ5N8lYbggD4O3w6M6pAvLkhk95AndTrifbIFPNU8PPMO7OyrFAHq
gDsznjPFmTOtCEcN2Z1FpWgchwuYLPL+Wokqltd11nqqzi+bJ9cvSKADYdUAAN5W
Utzdpiy6LbTgSxP7ociU4Tn0g5I6aDZJ7A8Lzo0KSyZYoA485mqcO0GVAdVw9lq4
aOT9v6d+nb4bnNkQVklLQ3fVAvJm+xdDOp9LCNCN48V2pnDOkFV6+U9nV5oyc6XI
2wIDAQAB
-----END PUBLIC KEY-----`;

/** RFC 9421 B.1.3 `test-key-ecc-p256`, public half. */
export const ECC_P256_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEqIVYZVLCrPZHGHjP17CTW0/+D9Lf
w0EkjqF7xB4FivAxzic30tMM4GF+hR6Dxh71Z50VGGdldkkDXZCnTNnoXQ==
-----END PUBLIC KEY-----`;

/** RFC 9421 B.1.4 `test-key-ed25519`, public half. */
export const ED25519_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAJrQLj5P/89iXES9+vFgrIy29clF9CC/oPPsw3c5D0bs=
-----END PUBLIC KEY-----`;

/** RFC 9421 B.1.4 `test-key-ed25519`, private half as PKCS#8. */
export const ED25519_PRIVATE_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIJ+DYvh6SEqVTm50DFtMDoQikTmiCqirVv9mWG9qfSnF
-----END PRIVATE KEY-----`;

/** The draft-cavage-12 Appendix C `Test` key, a 1024-bit RSA public key despite its prose. */
export const CAVAGE_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDCFENGw33yGihy92pDjZQhl0C3
6rPJj+CvfSC8+q28hxA161QFNUd13wuCTUcq0Qd2qsBe/2hFyc2DCJJg0h1L78+6
Z4UMR7EOcpfdUE9Hf3m/hs+FUR45uBJeDK1HSFHD8bHKD6kv8FPGfJTotc+2xjJw
oYi+1hqp1fIekaxsyQIDAQAB
-----END PUBLIC KEY-----`;

/** The body of the RFC 9421 `test-request` and of the draft-cavage-12 request. */
export const TEST_BODY = '{"hello": "world"}';

/**
 * The RFC 9421 Appendix B.2 `test-request`, without any signature.
 *
 * @param headers - Signature headers to add.
 */
export function rfc9421Request(headers: Record<string, string> = {}): Request {
	return new Request("https://example.com/foo?param=Value&Pet=dog", {
		method: "POST",
		headers: {
			host: "example.com",
			date: "Tue, 20 Apr 2021 02:07:55 GMT",
			"content-type": "application/json",
			"content-digest":
				"sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:",
			"content-length": "18",
			...headers,
		},
		body: TEST_BODY,
	});
}

/**
 * The draft-cavage-12 Appendix C request, without any signature.
 *
 * @param headers - Signature headers to add.
 */
export function cavageRequest(headers: Record<string, string> = {}): Request {
	return new Request("https://example.com/foo?param=value&pet=dog", {
		method: "POST",
		headers: {
			host: "example.com",
			date: "Sun, 05 Jan 2014 21:31:40 GMT",
			"content-type": "application/json",
			digest: "SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=",
			"content-length": "18",
			...headers,
		},
		body: TEST_BODY,
	});
}

/**
 * Imports a PEM public key for one algorithm's verification.
 *
 * @param pem - SPKI PEM text.
 * @param algorithm - The Web Crypto import parameters.
 */
export function importPublic(
	pem: string,
	algorithm: RsaHashedImportParams | EcKeyImportParams | AlgorithmIdentifier,
): Promise<CryptoKey> {
	return crypto.subtle.importKey("spki", unwrap(Pem.decode(pem, "PUBLIC KEY")), algorithm, true, [
		"verify",
	]);
}

/** The RFC 9421 B.1.4 Ed25519 private key, for signing. */
export function importEd25519Private(): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"pkcs8",
		unwrap(Pem.decode(ED25519_PRIVATE_PEM, "PRIVATE KEY")),
		{ name: "Ed25519" },
		false,
		["sign"],
	);
}
