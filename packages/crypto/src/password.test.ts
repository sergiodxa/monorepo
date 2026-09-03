/**
 * Tests for password hashing, verification, and rehash detection.
 *
 * Beyond the happy path these pin the two behaviors upgrade-on-login depends on:
 * a hash written with weaker parameters must still verify, and every stored value
 * this module would write differently today must be reported as needing a rehash.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { Base64Url } from "./encoding";
import { MalformedHashError, UnsupportedAlgorithmError } from "./errors";
import { password } from "./password";
import { randomBytes } from "./random";

/** Shape of the encoded format, used to assert hashes are self-describing. */
const ENCODED_PATTERN = /^\$pbkdf2-sha256\$i=\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/;

/** A real bcrypt hash, the legacy format the migration path must recognize. */
const BCRYPT_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMye.OmWJc0.vv.rMIFZQMWLQihlT4YLu8W";

/**
 * Builds an encoded hash with arbitrary parameters, standing in for a value
 * written by an older policy.
 *
 * @param secret Plaintext password to derive from.
 * @param iterations Iteration count to record and derive with.
 * @param keyBytes Derived key length in bytes.
 * @returns Encoded hash string in the module's format.
 */
async function legacyHash(secret: string, iterations: number, keyBytes = 32): Promise<string> {
	let salt = randomBytes(16);
	let key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	let bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations, hash: "SHA-256" },
		key,
		keyBytes * 8,
	);

	let encodedSalt = Base64Url.encode(salt);
	let encodedKey = Base64Url.encode(new Uint8Array(bits));
	return `$pbkdf2-sha256$i=${iterations}$${encodedSalt}$${encodedKey}`;
}

describe("password.hash", () => {
	test("returns a self-describing encoded hash", async () => {
		let stored = unwrap(await password.hash("correct horse"));

		expect(stored).toMatch(ENCODED_PATTERN);
	});

	test("records the current iteration count", async () => {
		let stored = unwrap(await password.hash("correct horse"));

		expect(stored.split("$")[2]).toBe("i=600000");
	});

	test("never contains the plaintext", async () => {
		let stored = unwrap(await password.hash("correct horse"));

		expect(stored).not.toContain("correct horse");
	});

	test("salts each hash, so the same password hashes differently", async () => {
		let first = unwrap(await password.hash("correct horse"));
		let second = unwrap(await password.hash("correct horse"));

		expect(first).not.toBe(second);
	});
});

describe("password.verify", () => {
	test("accepts the correct password", async () => {
		let stored = unwrap(await password.hash("correct horse"));

		expect(unwrap(await password.verify(stored, "correct horse"))).toBe(true);
	});

	test("rejects a wrong password without failing", async () => {
		let stored = unwrap(await password.hash("correct horse"));

		expect(unwrap(await password.verify(stored, "wrong horse"))).toBe(false);
	});

	test("rejects a password that is only a prefix of the correct one", async () => {
		let stored = unwrap(await password.hash("correct horse"));

		expect(unwrap(await password.verify(stored, "correct"))).toBe(false);
	});

	test("verifies with the parameters recorded in the stored hash", async () => {
		let stored = await legacyHash("correct horse", 1000);

		expect(unwrap(await password.verify(stored, "correct horse"))).toBe(true);
		expect(unwrap(await password.verify(stored, "wrong horse"))).toBe(false);
	});

	test("verifies a stored hash with a shorter derived key", async () => {
		let stored = await legacyHash("correct horse", 1000, 16);

		expect(unwrap(await password.verify(stored, "correct horse"))).toBe(true);
	});

	test("fails on a bcrypt hash instead of reporting a mismatch", async () => {
		let result = await password.verify(BCRYPT_HASH, "correct horse");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(MalformedHashError);
	});

	test("fails on an unknown algorithm tag", async () => {
		let result = await password.verify("$scrypt$i=600000$c2FsdA$aGFzaA", "correct horse");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(UnsupportedAlgorithmError);
	});

	test("fails on unreadable parameters", async () => {
		let stored = await legacyHash("correct horse", 1000);
		let broken = stored.replace("i=1000", "iterations=1000");

		expect(isFailure(await password.verify(broken, "correct horse"))).toBe(true);
	});

	test("fails on an out-of-range iteration count", async () => {
		let stored = await legacyHash("correct horse", 1000);

		expect(isFailure(await password.verify(stored.replace("i=1000", "i=0"), "x"))).toBe(true);
		expect(isFailure(await password.verify(stored.replace("i=1000", "i=99999999"), "x"))).toBe(
			true,
		);
	});

	test("fails on an unreadable salt or derived key", async () => {
		let stored = await legacyHash("correct horse", 1000);
		let fields = stored.split("$");

		expect(isFailure(await password.verify(`$pbkdf2-sha256$i=1000$$${fields[4]}`, "x"))).toBe(true);
		expect(isFailure(await password.verify(`$pbkdf2-sha256$i=1000$${fields[3]}$`, "x"))).toBe(true);
	});

	test("fails on an empty or truncated stored value", async () => {
		expect(isFailure(await password.verify("", "x"))).toBe(true);
		expect(isFailure(await password.verify("$pbkdf2-sha256$i=600000", "x"))).toBe(true);
		expect(isFailure(await password.verify("not-a-hash-at-all", "x"))).toBe(true);
	});

	test("keeps the stored value out of the error message", async () => {
		let result = await password.verify(BCRYPT_HASH, "correct horse");

		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.message).not.toContain(BCRYPT_HASH);
	});
});

describe("password.needsRehash", () => {
	test("is false for a hash written with the current policy", async () => {
		let stored = unwrap(await password.hash("correct horse"));

		expect(password.needsRehash(stored)).toBe(false);
	});

	test("is true when the stored iteration count is below policy", async () => {
		let stored = await legacyHash("correct horse", 1000);

		expect(password.needsRehash(stored)).toBe(true);
	});

	test("is true when the stored derived key is shorter than policy", async () => {
		let stored = await legacyHash("correct horse", 600_000, 16);

		expect(password.needsRehash(stored)).toBe(true);
	});

	test("is true for a bcrypt hash", () => {
		expect(password.needsRehash(BCRYPT_HASH)).toBe(true);
	});

	test("is true for an unparsable value", () => {
		expect(password.needsRehash("")).toBe(true);
		expect(password.needsRehash("not-a-hash-at-all")).toBe(true);
	});
});
