/**
 * Tests for authenticated encryption and the versioned envelope.
 *
 * The important cases are the negative ones: a tampered ciphertext, a swapped IV,
 * a wrong key, and an unknown version must all fail rather than return plausible
 * plaintext, and none of their messages may echo the value that failed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Base64Url } from "./encoding";
import { DecryptionError, InvalidEnvelopeError, InvalidKeyError } from "./errors";
import { randomBytes, randomToken } from "./random";
import { importKey, open, seal } from "./seal";

/** Plaintext used across the round-trip cases. */
const PLAINTEXT = "refresh-token-value";

/**
 * Imports a fresh random AES-256 key, the shape apps read from the environment.
 *
 * @returns A usable AES-GCM key.
 */
async function freshKey(): Promise<CryptoKey> {
	return unwrap(await importKey(randomToken({ bytes: 32 })));
}

/**
 * Alters one ciphertext byte while leaving the envelope well-formed.
 *
 * Changing the first base64url character guarantees a different decoded byte,
 * since the last character may carry only padding bits that decode identically.
 *
 * @param sealed Envelope produced by `seal`.
 * @returns The same envelope with a different ciphertext.
 */
function tamper(sealed: string): string {
	let [version, iv, ciphertext = ""] = sealed.split(".");
	let replacement = ciphertext.startsWith("A") ? "B" : "A";
	return [version, iv, `${replacement}${ciphertext.slice(1)}`].join(".");
}

describe("importKey", () => {
	test("accepts 16, 24, and 32 byte keys", async () => {
		for (let size of [16, 24, 32]) {
			let result = await importKey(Base64Url.encode(randomBytes(size)));
			expect(isFailure(result)).toBe(false);
		}
	});

	test("accepts a token produced by randomToken", async () => {
		expect(isFailure(await importKey(randomToken({ bytes: 32 })))).toBe(false);
	});

	test("rejects a key of the wrong size", async () => {
		let result = await importKey(Base64Url.encode(randomBytes(20)));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidKeyError);
	});

	test("rejects material that is not base64url", async () => {
		expect(isFailure(await importKey("not base64url!"))).toBe(true);
	});

	test("keeps the key material out of the error message", async () => {
		let raw = Base64Url.encode(randomBytes(20));
		let result = await importKey(raw);

		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.message).not.toContain(raw);
	});
});

describe("seal and open", () => {
	test("round-trips a value", async () => {
		let key = await freshKey();
		let sealed = unwrap(await seal(key, PLAINTEXT));

		expect(unwrap(await open(key, sealed))).toBe(PLAINTEXT);
	});

	test("round-trips an empty string and multi-byte text", async () => {
		let key = await freshKey();

		expect(unwrap(await open(key, unwrap(await seal(key, ""))))).toBe("");
		expect(unwrap(await open(key, unwrap(await seal(key, "héllo → 🌍"))))).toBe("héllo → 🌍");
	});

	test("writes the versioned three-field envelope", async () => {
		let key = await freshKey();
		let sealed = unwrap(await seal(key, PLAINTEXT));

		expect(sealed.split(".")).toHaveLength(3);
		expect(sealed.startsWith("v1.")).toBe(true);
	});

	test("never embeds the plaintext in the envelope", async () => {
		let key = await freshKey();
		let sealed = unwrap(await seal(key, PLAINTEXT));

		expect(sealed).not.toContain(PLAINTEXT);
	});

	test("produces a different envelope every time", async () => {
		let key = await freshKey();
		let first = unwrap(await seal(key, PLAINTEXT));
		let second = unwrap(await seal(key, PLAINTEXT));

		expect(first).not.toBe(second);
	});

	test("fails on a tampered ciphertext", async () => {
		let key = await freshKey();
		let sealed = unwrap(await seal(key, PLAINTEXT));
		let result = await open(key, tamper(sealed));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(DecryptionError);
	});

	test("fails on a tampered initialization vector", async () => {
		let key = await freshKey();
		let sealed = unwrap(await seal(key, PLAINTEXT));
		let [version, , ciphertext] = sealed.split(".");
		let other = Base64Url.encode(randomBytes(12));

		expect(isFailure(await open(key, [version, other, ciphertext].join(".")))).toBe(true);
	});

	test("fails when opened with a different key", async () => {
		let sealed = unwrap(await seal(await freshKey(), PLAINTEXT));
		let result = await open(await freshKey(), sealed);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(DecryptionError);
	});

	test("reports the same message for a wrong key and a tampered value", async () => {
		let key = await freshKey();
		let sealed = unwrap(await seal(key, PLAINTEXT));

		let tampered = await open(key, tamper(sealed));
		let wrongKey = await open(await freshKey(), sealed);

		if (!isFailure(tampered) || !isFailure(wrongKey)) throw new Error("expected two failures");
		expect(tampered.error.message).toBe(wrongKey.error.message);
		expect(tampered.error.message).not.toContain(sealed.split(".")[2] ?? "");
	});

	test("fails on an unsupported envelope version", async () => {
		let key = await freshKey();
		let sealed = unwrap(await seal(key, PLAINTEXT));
		let result = await open(key, sealed.replace("v1.", "v2."));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidEnvelopeError);
	});

	test("fails on an envelope with the wrong field count", async () => {
		let key = await freshKey();

		expect(isFailure(await open(key, ""))).toBe(true);
		expect(isFailure(await open(key, "v1.only-two-fields"))).toBe(true);
		expect(isFailure(await open(key, "v1.a.b.c"))).toBe(true);
	});

	test("fails on an initialization vector of the wrong length", async () => {
		let key = await freshKey();
		let sealed = unwrap(await seal(key, PLAINTEXT));
		let [version, , ciphertext] = sealed.split(".");
		let short = Base64Url.encode(randomBytes(8));

		let result = await open(key, [version, short, ciphertext].join("."));

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidEnvelopeError);
	});

	test("fails on an empty or undecodable ciphertext field", async () => {
		let key = await freshKey();
		let iv = Base64Url.encode(randomBytes(12));

		expect(isFailure(await open(key, `v1.${iv}.`))).toBe(true);
		expect(isFailure(await open(key, `v1.${iv}.not base64url!`))).toBe(true);
	});
});
