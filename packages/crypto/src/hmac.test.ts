/**
 * Tests for HMAC signing and verification.
 *
 * The signature is checked against RFC 4231 test case 2 so interoperability with
 * other implementations is pinned, and verification is checked for both outcomes
 * plus the malformed-signature path that must fail closed rather than error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { isFailure, unwrap } from "@pkg/result";

import { Hex } from "./encoding";
import { UnsupportedAlgorithmError } from "./errors";
import { hmac } from "./hmac";

/** RFC 4231 test case 2 key. */
const RFC_KEY = "Jefe";

/** RFC 4231 test case 2 message. */
const RFC_DATA = "what do ya want for nothing?";

/** RFC 4231 test case 2 expected HMAC-SHA-256, hex encoded. */
const RFC_SHA256 = "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843";

/** RFC 4231 test case 2 expected HMAC-SHA-512, hex encoded. */
const RFC_SHA512 =
	"164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737";

describe("hmac.sign", () => {
	test("matches the RFC 4231 SHA-256 vector", async () => {
		let mac = unwrap(await hmac.sign(RFC_KEY, RFC_DATA));

		expect(Hex.encode(mac)).toBe(RFC_SHA256);
	});

	test("matches the RFC 4231 SHA-512 vector", async () => {
		let mac = unwrap(await hmac.sign(RFC_KEY, RFC_DATA, { hash: "SHA-512" }));

		expect(Hex.encode(mac)).toBe(RFC_SHA512);
	});

	test("defaults to SHA-256", async () => {
		let implicit = unwrap(await hmac.sign(RFC_KEY, RFC_DATA));
		let explicit = unwrap(await hmac.sign(RFC_KEY, RFC_DATA, { hash: "SHA-256" }));

		expect(Hex.encode(implicit)).toBe(Hex.encode(explicit));
	});

	test("fails on an unsupported hash", async () => {
		// @ts-expect-error - exercising the runtime guard an untyped caller can trip
		let result = await hmac.sign(RFC_KEY, RFC_DATA, { hash: "MD5" });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(UnsupportedAlgorithmError);
	});
});

describe("hmac.verify", () => {
	test("returns true for the matching signature bytes", async () => {
		let mac = unwrap(await hmac.sign(RFC_KEY, RFC_DATA));

		expect(unwrap(await hmac.verify(RFC_KEY, RFC_DATA, mac))).toBe(true);
	});

	test("returns true for the matching signature as a hex string", async () => {
		expect(unwrap(await hmac.verify(RFC_KEY, RFC_DATA, RFC_SHA256))).toBe(true);
	});

	test("returns false for a signature made with another key", async () => {
		let mac = unwrap(await hmac.sign("other-key", RFC_DATA));

		expect(unwrap(await hmac.verify(RFC_KEY, RFC_DATA, mac))).toBe(false);
	});

	test("returns false when the payload was altered", async () => {
		let mac = unwrap(await hmac.sign(RFC_KEY, RFC_DATA));

		expect(unwrap(await hmac.verify(RFC_KEY, `${RFC_DATA}!`, mac))).toBe(false);
	});

	test("returns false when the hash does not match the one used to sign", async () => {
		let mac = unwrap(await hmac.sign(RFC_KEY, RFC_DATA, { hash: "SHA-512" }));

		expect(unwrap(await hmac.verify(RFC_KEY, RFC_DATA, mac, { hash: "SHA-256" }))).toBe(false);
	});

	test("returns false for a truncated signature", async () => {
		expect(unwrap(await hmac.verify(RFC_KEY, RFC_DATA, RFC_SHA256.slice(0, 32)))).toBe(false);
	});

	test("fails closed on a signature string that is not hex", async () => {
		expect(unwrap(await hmac.verify(RFC_KEY, RFC_DATA, "not-a-signature"))).toBe(false);
	});

	test("fails closed on an empty signature", async () => {
		expect(unwrap(await hmac.verify(RFC_KEY, RFC_DATA, ""))).toBe(false);
	});
});
