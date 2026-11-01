/**
 * Tests for the read-only reports: a key's algorithm, User IDs and secret state, and the
 * issuer a cleartext or detached signature names before anything verifies it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { generateKey, inspectKey, readSignatures, signCleartext, signDetached } from "./index.js";

/** A fixed creation time, so reports compare exactly. */
const DATE = new Date("2026-01-01T00:00:00Z");

describe("inspectKey", () => {
	test("reports a version 6 key's identity, algorithm and certified User ID", async () => {
		let key = unwrap(await generateKey({ userId: "Security <security@example.com>", date: DATE }));
		let report = await inspectKey(key.publicKey);
		expect(report.primary).toMatchObject({
			fingerprint: key.fingerprint,
			keyId: key.keyId,
			version: 6,
			created: DATE,
			algorithm: "Ed25519",
			revoked: false,
			expires: undefined,
			canSign: true,
		});
		expect(report.userIds).toEqual([
			{ userId: "Security <security@example.com>", certified: true },
		]);
		expect(report).toMatchObject({ secret: false, locked: false, subkeys: [] });
	});

	test("names the legacy algorithm and reports a locked private key", async () => {
		let key = unwrap(await generateKey({ userId: "Old <old@example.com>", version: 4 }));
		let locked = unwrap(await key.lock("passphrase"));
		let report = await inspectKey(locked);
		expect(report.primary).toMatchObject({ version: 4, algorithm: "Ed25519Legacy" });
		expect(report).toMatchObject({ secret: true, locked: true });
	});
});

describe("readSignatures", () => {
	test("names the issuer of a cleartext signature", async () => {
		let key = unwrap(await generateKey({ date: DATE }));
		let signed = unwrap(await signCleartext("hello\n", key, { date: DATE }));
		let signatures = unwrap(readSignatures(signed));
		expect(signatures).toEqual([
			{
				version: 6,
				type: "text",
				algorithm: "Ed25519",
				hash: "SHA-512",
				created: DATE,
				issuerFingerprint: key.fingerprint,
				issuerKeyId: key.keyId,
			},
		]);
	});

	test("reads a detached version 4 signature in armor and in binary", async () => {
		let key = unwrap(await generateKey({ version: 4 }));
		let signature = unwrap(await signDetached("data", key, { hash: "SHA-256" }));
		let armored = unwrap(readSignatures(signature.armored));
		expect(armored[0]).toMatchObject({
			version: 4,
			type: "binary",
			algorithm: "Ed25519Legacy",
			hash: "SHA-256",
			issuerKeyId: key.keyId,
		});
		expect(unwrap(readSignatures(signature.binary))).toEqual(armored);
	});

	test("fails on armor that holds no signature", async () => {
		let key = unwrap(await generateKey());
		let result = readSignatures(key.publicKey.armor());
		expect(isFailure(result) && result.error.code).toBe("malformed");
	});
});
