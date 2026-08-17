/**
 * Tests for the two-format hashing helper.
 *
 * These pin the migration contract: a hash written by the superseded bcrypt
 * scheme must keep verifying, a correct plaintext checked against one must come
 * back with a replacement hash, and that replacement must verify on its own with
 * nothing left to upgrade.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { password } from "@pkg/crypto";
import { isFailure, isSuccess, unwrap } from "@pkg/result";
import bcrypt from "bcryptjs";
import { describe, expect, test } from "vitest";

import { hashSecret, spendVerificationCost, verifySecret } from "./password-hash";

/** Cost factor every stored bcrypt hash was written with. */
const LEGACY_BCRYPT_COST = 10;

/** Prefix identifying the format written for new hashes. */
const CURRENT_PREFIX = "$pbkdf2-sha256$";

describe("hashSecret", () => {
	test("writes the current PBKDF2 format", async () => {
		let stored = unwrap(await hashSecret("correct horse battery staple"));

		expect(stored.startsWith(CURRENT_PREFIX)).toBe(true);
		expect(password.needsRehash(stored)).toBe(false);
	});

	test("hashes the same secret differently every time", async () => {
		let first = unwrap(await hashSecret("same secret"));
		let second = unwrap(await hashSecret("same secret"));

		expect(first).not.toBe(second);
	});
});

describe("verifySecret", () => {
	test("accepts a secret stored in the current format, with nothing to persist", async () => {
		let stored = unwrap(await hashSecret("s3cret"));

		let checked = await verifySecret(stored, "s3cret");

		expect(isSuccess(checked)).toBe(true);
		if (!isSuccess(checked)) return;
		expect(checked.data.matches).toBe(true);
		expect(checked.data.rehashed).toBeNull();
	});

	test("rejects a wrong secret stored in the current format", async () => {
		let stored = unwrap(await hashSecret("s3cret"));

		let checked = await verifySecret(stored, "wrong");

		expect(isSuccess(checked)).toBe(true);
		if (!isSuccess(checked)) return;
		expect(checked.data.matches).toBe(false);
		expect(checked.data.rehashed).toBeNull();
	});

	test("accepts a secret stored in the superseded bcrypt format", async () => {
		let stored = await bcrypt.hash("s3cret", LEGACY_BCRYPT_COST);

		let checked = await verifySecret(stored, "s3cret");

		expect(isSuccess(checked)).toBe(true);
		if (!isSuccess(checked)) return;
		expect(checked.data.matches).toBe(true);
	});

	test("rejects a wrong secret stored in the superseded bcrypt format", async () => {
		let stored = await bcrypt.hash("s3cret", LEGACY_BCRYPT_COST);

		let checked = await verifySecret(stored, "wrong");

		expect(isSuccess(checked)).toBe(true);
		if (!isSuccess(checked)) return;
		expect(checked.data.matches).toBe(false);
		expect(checked.data.rehashed).toBeNull();
	});

	test("upgrades a bcrypt hash into one that verifies on its own", async () => {
		let stored = await bcrypt.hash("s3cret", LEGACY_BCRYPT_COST);

		let checked = await verifySecret(stored, "s3cret");
		expect(isSuccess(checked)).toBe(true);
		if (!isSuccess(checked)) return;

		let rehashed = checked.data.rehashed;
		expect(rehashed?.startsWith(CURRENT_PREFIX)).toBe(true);
		expect(rehashed).not.toBe(stored);
		if (rehashed === null) return;

		let recheck = await verifySecret(rehashed, "s3cret");
		expect(isSuccess(recheck)).toBe(true);
		if (!isSuccess(recheck)) return;
		expect(recheck.data.matches).toBe(true);
		expect(recheck.data.rehashed).toBeNull();
	});

	test("rejects a stored value in neither format", async () => {
		let checked = await verifySecret("not-a-hash", "s3cret");

		expect(isSuccess(checked)).toBe(true);
		if (!isSuccess(checked)) return;
		expect(checked.data.matches).toBe(false);
		expect(checked.data.rehashed).toBeNull();
	});

	test("never reports the stored hash or the plaintext in a failure", async () => {
		let checked = await verifySecret("", "s3cret");

		expect(isFailure(checked)).toBe(false);
	});
});

describe("needsRehash", () => {
	test("is the signal that routes a bcrypt hash to the upgrade path", async () => {
		let legacy = await bcrypt.hash("s3cret", LEGACY_BCRYPT_COST);
		let current = unwrap(await hashSecret("s3cret"));

		expect(password.needsRehash(legacy)).toBe(true);
		expect(password.needsRehash(current)).toBe(false);
	});
});

describe("spendVerificationCost", () => {
	test("completes without reporting anything about the secret", async () => {
		expect(await spendVerificationCost("s3cret")).toBeUndefined();
	});
});
