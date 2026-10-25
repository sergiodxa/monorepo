/**
 * Tests for keys and signatures made by this package: generation in both versions, armor
 * round trips, passphrase locking, cleartext dash-escaping and whitespace rules, detached
 * binary and text signatures, and the failures for tampering, wrong keys and revoked keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { SIGNATURE_TYPE } from "./algorithms.js";
import { webCryptoKey } from "./fixtures/keys.js";
import { createSignature, keyHashInput } from "./signature-engine.js";
import { readSignaturePacket } from "./signature-packet.js";

import {
	generateKey,
	PublicKey,
	readCleartext,
	readPrivateKey,
	readPublicKey,
	signCleartext,
	signDetached,
	verifyCleartext,
	verifyDetached,
	verifyKey,
} from "./index.js";

/** A security.txt body with a line starting with a dash, one with `From ` and trailing spaces. */
const TEXT =
	"Contact: mailto:security@example.com   \n-----BEGIN fake-----\nFrom here\nExpires: 2027-01-01T00:00:00Z\n";

describe("generateKey", () => {
	test("makes a version 6 Ed25519 key whose self-signatures verify", async () => {
		let key = unwrap(
			await generateKey({
				userId: "Security <security@example.com>",
				date: new Date("2026-01-01T00:00:00Z"),
			}),
		);
		expect(key.version).toBe(6);
		expect(key.fingerprint).toMatch(/^[0-9A-F]{64}$/);
		expect(key.parts.primary.algorithm).toBe(27);
		expect(key.userIds).toEqual(["Security <security@example.com>"]);

		let status = await verifyKey(key.publicKey);
		expect(status.primary).toMatchObject({ bound: true, canSign: true, revoked: false });
		expect(status.userIds).toEqual([
			{ userId: "Security <security@example.com>", certified: true },
		]);
	});

	test("makes a version 4 Ed25519Legacy key and refuses Ed25519Legacy at version 6", async () => {
		let key = unwrap(await generateKey({ userId: "Legacy <legacy@example.com>", version: 4 }));
		expect(key.parts.primary.algorithm).toBe(22);
		expect(key.fingerprint).toMatch(/^[0-9A-F]{40}$/);
		expect(key.armor()).toMatch(/^=[A-Za-z0-9+/]{4}$/m);
		expect((await verifyKey(key.publicKey)).userIds[0]?.certified).toBe(true);

		let refused = await generateKey({ algorithm: "ed25519-legacy" });
		expect(refused.status === "failure" && refused.error.code).toBe("unsupported");
	});

	test("round-trips through armor", async () => {
		let key = unwrap(await generateKey({ userId: "Round <round@example.com>" }));
		let read = unwrap(await readPrivateKey(key.armor()));
		expect(read.fingerprint).toBe(key.fingerprint);
		expect(read.armor()).toBe(key.armor());
		let certificate = unwrap(await readPublicKey(key.publicKey.armor()));
		expect(certificate.fingerprint).toBe(key.fingerprint);
		expect(certificate.armor()).not.toContain("PRIVATE");
		expect(unwrap(await readPublicKey(key.armor())).armor()).toBe(certificate.armor());
	});
});

describe("passphrase protection", () => {
	test("locks with AES-256-GCM and unlocks only with the passphrase", async () => {
		for (let version of [4, 6] as const) {
			let key = unwrap(await generateKey({ userId: "Locked <locked@example.com>", version }));
			let locked = unwrap(await key.lock("correct horse"));
			expect(locked.locked).toBe(true);
			expect(locked.parts.primary).toMatchObject({
				secret: null,
				protection: { usage: 253, cipher: 9, aead: 3 },
			});

			let armored = locked.armor();
			let reread = unwrap(await readPrivateKey(armored));
			expect(reread.locked).toBe(true);
			let signed = await signCleartext("text", reread);
			expect(signed.status === "failure" && signed.error.code).toBe("locked");

			let wrong = await readPrivateKey(armored, { passphrase: "wrong" });
			expect(wrong.status === "failure" && wrong.error.code).toBe("bad-passphrase");

			let unlocked = unwrap(await readPrivateKey(armored, { passphrase: "correct horse" }));
			expect(unlocked.locked).toBe(false);
			expect(unlocked.armor()).toBe(key.armor());
		}
	});
});

describe("cleartext signatures", () => {
	test("dash-escapes, drops trailing whitespace and verifies", async () => {
		let key = unwrap(await generateKey({ userId: "Security <security@example.com>" }));
		let signed = unwrap(await signCleartext(TEXT, key));
		expect(signed).toMatch(
			/^-----BEGIN PGP SIGNED MESSAGE-----\n\nContact: mailto:security@example.com\n- -----BEGIN fake-----\n- From here\n/,
		);
		expect(signed).not.toContain("Hash:");
		expect(signed).not.toMatch(/^=/m);

		let verified = unwrap(await verifyCleartext(signed, key.publicKey));
		expect(verified.text).toBe(TEXT.replace("   \n", "\n"));
		expect(verified.signature).toMatchObject({
			signingKey: key.fingerprint,
			primaryKey: key.fingerprint,
			hash: "SHA-512",
			text: true,
		});
		expect(unwrap(readCleartext(signed)).text).toBe(verified.text);
	});

	test("verifies after a CRLF round trip and fails once a line changes", async () => {
		let key = unwrap(await generateKey());
		let signed = unwrap(await signCleartext(TEXT, key, { hash: "SHA-256" }));
		expect(
			unwrap(await verifyCleartext(signed.replace(/\n/g, "\r\n"), key.publicKey)).signature.hash,
		).toBe("SHA-256");
		let tampered = await verifyCleartext(signed.replace("security@", "attacker@"), key.publicKey);
		expect(tampered.status === "failure" && tampered.error.code).toBe("invalid-signature");
	});

	test("writes the Hash header and CRC24 footer for a version 4 key", async () => {
		let key = unwrap(await generateKey({ userId: "Legacy <legacy@example.com>", version: 4 }));
		let signed = unwrap(await signCleartext(TEXT, key));
		expect(signed).toMatch(/^-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA512\n\n/);
		expect(signed).toMatch(/^=[A-Za-z0-9+/]{4}$/m);
		expect(unwrap(await verifyCleartext(signed, key.publicKey)).signature.signingKey).toBe(
			key.fingerprint,
		);
	});

	test("names an unknown signer and accepts any of several keys", async () => {
		let signer = unwrap(await generateKey());
		let other = unwrap(await generateKey());
		let signed = unwrap(await signCleartext(TEXT, signer));
		let unknown = await verifyCleartext(signed, other.publicKey);
		expect(unknown.status === "failure" && unknown.error.code).toBe("unknown-signer");
		expect(
			unwrap(await verifyCleartext(signed, [other.publicKey, signer.publicKey])).signature
				.primaryKey,
		).toBe(signer.fingerprint);
	});

	test("answers no-signature for unsigned text", async () => {
		let key = unwrap(await generateKey());
		let verified = await verifyCleartext("Contact: mailto:a@example.com\n", key.publicKey);
		expect(verified.status === "failure" && verified.error.code).toBe("no-signature");
	});
});

describe("detached signatures", () => {
	test("signs binary data and text data", async () => {
		let key = unwrap(await generateKey());
		let bytes = Uint8Array.from({ length: 300 }, (_, index) => index & 0xff);
		let binary = unwrap(await signDetached(bytes, key));
		expect(unwrap(await verifyDetached(bytes, binary.armored, key.publicKey)).text).toBe(false);
		let changed = await verifyDetached(
			bytes.map((byte, index) => (index === 0 ? byte ^ 1 : byte)),
			binary.binary,
			key.publicKey,
		);
		expect(changed.status === "failure" && changed.error.code).toBe("invalid-signature");

		let text = unwrap(await signDetached("line one\nline two\n", key, { text: true }));
		expect(
			unwrap(await verifyDetached("line one\r\nline two\r\n", text.armored, key.publicKey)).text,
		).toBe(true);
	});

	test("signs and verifies with ECDSA P-256 and RSA keys", async () => {
		for (let kind of ["ecdsa-p256", "rsa"] as const) {
			let key = await webCryptoKey(kind);
			let certificate = unwrap(await readPublicKey(key.publicKey.armor()));
			let detached = unwrap(await signDetached("payload", key, { hash: "SHA-256" }));
			expect(unwrap(await verifyDetached("payload", detached.armored, certificate)).hash).toBe(
				"SHA-256",
			);
			let signed = unwrap(await signCleartext(TEXT, unwrap(await readPrivateKey(key.armor()))));
			expect(unwrap(await verifyCleartext(signed, certificate)).signature.signingKey).toBe(
				certificate.fingerprint,
			);
		}
	});

	test("refuses a signature from a revoked key", async () => {
		let key = unwrap(await generateKey());
		let detached = unwrap(await signDetached("payload", key));
		let primary = key.parts.primary;
		if (!("secret" in primary) || primary.secret === null)
			throw new Error("The key lost its secret.");
		let revocation = unwrap(
			await createSignature(
				{ key: primary, secret: primary.secret },
				SIGNATURE_TYPE.keyRevocation,
				keyHashInput(primary),
				{
					hash: { id: 10, name: "SHA-512", textName: "SHA512", size: 64, saltSize: 32 },
					created: new Date(),
				},
			),
		);
		let certificate = key.publicKey;
		let revoked = new PublicKey({
			...certificate.parts,
			directSignatures: [
				...certificate.parts.directSignatures,
				unwrap(readSignaturePacket(revocation)),
			],
		});
		expect((await verifyKey(revoked)).primary.revoked).toBe(true);
		let verified = await verifyDetached("payload", detached.binary, revoked);
		expect(verified.status === "failure" && verified.error.code).toBe("invalid-signature");
	});
});
