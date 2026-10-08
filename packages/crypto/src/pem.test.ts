/**
 * Tests for PEM armor: the encoder's exact layout, a decode that Web Crypto can import,
 * and the label and body checks that keep a wrong or damaged block from decoding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Base64 } from "./encoding.js";
import { InvalidEncodingError } from "./errors.js";
import { Pem } from "./pem.js";

/** The Ed25519 public key of RFC 9421 Appendix B.1.4, as SPKI PEM. */
const ED25519_PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAJrQLj5P/89iXES9+vFgrIy29clF9CC/oPPsw3c5D0bs=
-----END PUBLIC KEY-----
`;

/** The Ed25519 private key of RFC 9421 Appendix B.1.4, as PKCS#8 PEM. */
const ED25519_PRIVATE_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIJ+DYvh6SEqVTm50DFtMDoQikTmiCqirVv9mWG9qfSnF
-----END PRIVATE KEY-----`;

describe("Pem.encode", () => {
	test("wraps the body at 64 columns and ends with a newline", () => {
		let der = new Uint8Array(100).map((_, index) => index);
		let pem = unwrap(Pem.encode(der, "PUBLIC KEY"));
		let lines = pem.split("\n");

		expect(lines[0]).toBe("-----BEGIN PUBLIC KEY-----");
		expect(lines[1]).toHaveLength(64);
		expect(lines[2]).toHaveLength(64);
		expect(lines[3]).toHaveLength(8);
		expect(lines.at(-2)).toBe("-----END PUBLIC KEY-----");
		expect(lines.at(-1)).toBe("");
		expect(lines.slice(1, -2).join("")).toBe(Base64.encode(der));
	});

	test("reproduces a published key byte for byte", () => {
		let der = unwrap(Pem.decode(ED25519_PUBLIC_PEM, "PUBLIC KEY"));
		expect(unwrap(Pem.encode(der, "PUBLIC KEY"))).toBe(ED25519_PUBLIC_PEM);
	});

	test("refuses a label RFC 7468 does not allow", () => {
		let result = Pem.encode(new Uint8Array([1]), "BAD-----LABEL");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidEncodingError);
	});
});

describe("Pem.decode", () => {
	test("decodes SPKI that Web Crypto imports", async () => {
		let der = unwrap(Pem.decode(ED25519_PUBLIC_PEM, "PUBLIC KEY"));
		let key = await crypto.subtle.importKey("spki", der, { name: "Ed25519" }, true, ["verify"]);
		expect(key.type).toBe("public");
	});

	test("decodes PKCS#8 that Web Crypto imports", async () => {
		let der = unwrap(Pem.decode(ED25519_PRIVATE_PEM, "PRIVATE KEY"));
		let key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, true, ["sign"]);
		expect(key.type).toBe("private");
	});

	test("round-trips a generated RSA key pair", async () => {
		let pair = await crypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		);
		let spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
		let pem = unwrap(Pem.encode(spki, "PUBLIC KEY"));

		expect(unwrap(Pem.decode(pem, "PUBLIC KEY"))).toEqual(spki);
	});

	test("tolerates CRLF, indentation and explanatory text", () => {
		let text = `Subject: test key\r\n   -----BEGIN PUBLIC KEY-----\r\n   MCowBQYDK2VwAyEAJrQLj5P/89iXES9+\r\n   vFgrIy29clF9CC/oPPsw3c5D0bs=\r\n   -----END PUBLIC KEY-----\r\n`;
		expect(unwrap(Pem.decode(text, "PUBLIC KEY"))).toEqual(
			unwrap(Pem.decode(ED25519_PUBLIC_PEM, "PUBLIC KEY")),
		);
	});

	test("reads a label that holds a hyphen", () => {
		let pem = unwrap(Pem.encode(new Uint8Array([1, 2, 3]), "X-TEST KEY"));
		expect(unwrap(Pem.decode(pem, "X-TEST KEY"))).toEqual(new Uint8Array([1, 2, 3]));
	});

	test("fails when the label differs from the expected one", () => {
		let result = Pem.decode(ED25519_PRIVATE_PEM, "PUBLIC KEY");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toBe("Invalid PEM PUBLIC KEY input");
	});

	test("fails when the end line names another label", () => {
		let text = ED25519_PUBLIC_PEM.replace("END PUBLIC KEY", "END PRIVATE KEY");
		expect(isFailure(Pem.decode(text, "PUBLIC KEY"))).toBe(true);
	});

	test("fails without a PEM block", () => {
		expect(isFailure(Pem.decode("MCowBQYDK2VwAyEA", "PUBLIC KEY"))).toBe(true);
	});

	test("fails on a body that is not base64", () => {
		let text = "-----BEGIN PUBLIC KEY-----\nnot*base64\n-----END PUBLIC KEY-----";
		expect(isFailure(Pem.decode(text, "PUBLIC KEY"))).toBe(true);
	});

	test("fails on an empty body", () => {
		let text = "-----BEGIN PUBLIC KEY-----\n-----END PUBLIC KEY-----";
		expect(isFailure(Pem.decode(text, "PUBLIC KEY"))).toBe(true);
	});
});
