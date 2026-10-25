/**
 * Tests against RFC 9580 Appendix A: the sample keys' fingerprints and packets, the
 * hashed data streams of their self-signatures, the A.2 and A.6 signatures verifying, the
 * A.5 intermediate HKDF values, and the unprotected secret key signing for its certificate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { concatBytes, Hex } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	SAMPLE_CLEARTEXT,
	SAMPLE_V4_KEY,
	SAMPLE_V4_SIGNATURE,
	SAMPLE_V6_CERTIFICATE,
	SAMPLE_V6_LOCKED_KEY,
	SAMPLE_V6_SECRET_KEY,
} from "./fixtures/rfc9580.js";
import { utf8 } from "./lib/bytes.js";
import { aeadAdditionalData, deriveKek } from "./protection.js";
import { keyHashInput } from "./signature-engine.js";
import { readSignaturePacket, signatureTrailer } from "./signature-packet.js";

import {
	dearmor,
	readCleartext,
	readPackets,
	readPrivateKey,
	readPublicKey,
	signCleartext,
	signDetached,
	verifyCleartext,
	verifyDetached,
	verifyKey,
} from "./index.js";

/**
 * Hex from an RFC hex dump, its spaces and line breaks removed.
 *
 * @param dump - The dump's octets.
 */
function hex(dump: string): Uint8Array<ArrayBuffer> {
	return unwrap(Hex.decode(dump.replace(/\s+/g, "")));
}

describe("A.1 version 4 Ed25519Legacy key", () => {
	test("has the published fingerprint and packet", async () => {
		let key = unwrap(await readPublicKey(SAMPLE_V4_KEY));
		expect(key.fingerprint).toBe("C959BDBAFA32A2F89A153B678CFDE12197965A9A");
		expect(key.created.toISOString()).toBe("2014-08-19T14:28:27.000Z");
		let packet =
			hex(`98 33 04 53 f3 5f 0b 16 09 2b 06 01 04 01 da 47 0f 01 01 07 40 3f 09 89 94 bd d9 16 ed 40 53 19
			79 34 e4 a8 7c 80 73 3a 12 80 d6 2f 80 10 99 2e 43 ee 3b 24 06`);
		let [legacy] = unwrap(readPackets(packet));
		expect(legacy).toEqual({ type: 6, body: key.parts.primary.body });
		expect(key.toBytes()).toEqual(concatBytes(Uint8Array.of(0xc6, 0x33), packet.subarray(2)));
	});
});

describe("A.2 version 4 Ed25519Legacy signature", () => {
	test("hashes the published input and verifies over OpenPGP", async () => {
		let packet = unwrap(dearmor(SAMPLE_V4_SIGNATURE)).data;
		let signature = unwrap(readSignaturePacket(packet.subarray(2)));
		let input = concatBytes(utf8("OpenPGP"), signatureTrailer(4, signature.hashedPrefix));
		expect(Hex.encode(input)).toBe("4f70656e504750040016080006050255f95f9504ff0000000c");
		let digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
		expect(Hex.encode(digest)).toBe(
			"f6220a3f757814f4c2176ffbb68b00249cd4ccdc059c4b34ad871f30b1740280",
		);

		let key = unwrap(await readPublicKey(SAMPLE_V4_KEY));
		let verified = unwrap(await verifyDetached("OpenPGP", SAMPLE_V4_SIGNATURE, key));
		expect(verified).toMatchObject({
			signingKey: "C959BDBAFA32A2F89A153B678CFDE12197965A9A",
			created: new Date("2015-09-16T12:24:53Z"),
			hash: "SHA-256",
			text: false,
		});
	});

	test("rejects other data", async () => {
		let key = unwrap(await readPublicKey(SAMPLE_V4_KEY));
		let verified = await verifyDetached("OpenPGP!", SAMPLE_V4_SIGNATURE, key);
		expect(verified.status === "failure" && verified.error.code).toBe("invalid-signature");
	});
});

describe("A.3 version 6 certificate", () => {
	test("has the published fingerprints", async () => {
		let key = unwrap(await readPublicKey(SAMPLE_V6_CERTIFICATE));
		expect(key.version).toBe(6);
		expect(key.fingerprint).toBe(
			"CB186C4F0609A697E4D52DFA6C722B0C1F1E27C18A56708F6525EC27BAD9ACC9",
		);
		expect(key.keyId).toBe("CB186C4F0609A697");
		expect(
			key.parts.subkeys.map((subkey) => Hex.encode(subkey.key.fingerprint).toUpperCase()),
		).toEqual(["12C83F1E706F6308FE151A417743A1F033790E93E9978488D1DB378DA9930885"]);
	});

	test("hashes the A.3.1 data streams for its self-signatures", async () => {
		let key = unwrap(await readPublicKey(SAMPLE_V6_CERTIFICATE));
		let [direct] = key.parts.directSignatures;
		let [binding] = key.parts.subkeys[0]?.signatures ?? [];
		let subkey = key.parts.subkeys[0]?.key;
		if (!direct || !binding || !subkey) throw new Error("The certificate lost a packet.");

		let directStream = concatBytes(
			direct.salt,
			keyHashInput(key.parts.primary),
			signatureTrailer(6, direct.hashedPrefix),
		);
		expect(directStream).toEqual(
			hex(`10 3e 2d 7d 22 7e c0 e6 d7 ce 44 71 db 36 bf c9 70 83 25 36 90 27 14 98 a7 ef 05 76 c0 7f aa e1
			9b 00 00 00 2a 06 63 87 7f e3 1b 00 00 00 20 f9 4d a7 bb 48 d6 0a 61 e5 67 70 6a 65 87 d0 33 19
			99 bb 9d 89 1a 08 24 2e ad 84 54 3d f8 95 a3 06 1f 1b 0a 00 00 00 42 05 82 63 87 7f e3 03 0b 09
			07 05 15 0a 0e 08 0c 02 16 00 02 9b 03 02 1e 09 22 21 06 cb 18 6c 4f 06 09 a6 97 e4 d5 2d fa 6c
			72 2b 0c 1f 1e 27 c1 8a 56 70 8f 65 25 ec 27 ba d9 ac c9 05 27 09 02 07 02 06 ff 00 00 00 4a`),
		);

		let bindingStream = concatBytes(
			binding.salt,
			keyHashInput(key.parts.primary),
			keyHashInput(subkey),
			signatureTrailer(6, binding.hashedPrefix),
		);
		expect(bindingStream).toEqual(
			hex(`a6 e9 18 6d 9d 59 35 fc 8f e5 63 14 cd b5 27 48 6a 5a 51 20 f9 b7 62 a2 35 a7 29 f0 39 01 0a 56
			9b 00 00 00 2a 06 63 87 7f e3 1b 00 00 00 20 f9 4d a7 bb 48 d6 0a 61 e5 67 70 6a 65 87 d0 33 19
			99 bb 9d 89 1a 08 24 2e ad 84 54 3d f8 95 a3 9b 00 00 00 2a 06 63 87 7f e3 19 00 00 00 20 86 93
			24 83 67 f9 e5 01 5d b9 22 f8 f4 80 95 dd a7 84 98 7f 2d 59 85 b1 2f ba d1 6c af 5e 44 35 06 18
			1b 0a 00 00 00 2c 05 82 63 87 7f e3 02 9b 0c 22 21 06 cb 18 6c 4f 06 09 a6 97 e4 d5 2d fa 6c 72
			2b 0c 1f 1e 27 c1 8a 56 70 8f 65 25 ec 27 ba d9 ac c9 06 ff 00 00 00 34`),
		);
	});

	test("verifies its Direct Key signature and subkey binding", async () => {
		let key = unwrap(await readPublicKey(SAMPLE_V6_CERTIFICATE));
		let status = await verifyKey(key);
		expect(status.primary).toMatchObject({
			revoked: false,
			bound: true,
			canSign: true,
			expires: undefined,
		});
		expect(status.subkeys).toEqual([
			{
				fingerprint: "12C83F1E706F6308FE151A417743A1F033790E93E9978488D1DB378DA9930885",
				revoked: false,
				expires: undefined,
				canSign: false,
				bound: true,
			},
		]);
	});

	test("armors back without a CRC24 footer", async () => {
		let key = unwrap(await readPublicKey(SAMPLE_V6_CERTIFICATE));
		expect(key.armor()).toBe(SAMPLE_V6_CERTIFICATE);
	});
});

describe("A.4 version 6 secret key", () => {
	test("is the A.3 certificate with its secrets", async () => {
		let key = unwrap(await readPrivateKey(SAMPLE_V6_SECRET_KEY));
		expect(key.locked).toBe(false);
		expect(key.publicKey.armor()).toBe(SAMPLE_V6_CERTIFICATE);
		expect(key.armor()).toBe(SAMPLE_V6_SECRET_KEY);
	});

	test("signs what the A.3 certificate verifies", async () => {
		let key = unwrap(await readPrivateKey(SAMPLE_V6_SECRET_KEY));
		let certificate = unwrap(await readPublicKey(SAMPLE_V6_CERTIFICATE));
		let signed = unwrap(await signCleartext("Contact: mailto:security@example.com\n", key));
		let verified = unwrap(await verifyCleartext(signed, certificate));
		expect(verified.text).toBe("Contact: mailto:security@example.com\n");
		expect(verified.signature.signingKey).toBe(certificate.fingerprint);

		let detached = unwrap(await signDetached(Uint8Array.of(1, 2, 3), key));
		expect(detached.armored).not.toMatch(/^=/m);
		expect(
			unwrap(await verifyDetached(Uint8Array.of(1, 2, 3), detached.binary, certificate)).text,
		).toBe(false);
	});
});

describe("A.5 locked version 6 secret key", () => {
	test("reads locked and reports Argon2 as unsupported", async () => {
		let key = unwrap(await readPrivateKey(SAMPLE_V6_LOCKED_KEY));
		expect(key.locked).toBe(true);
		expect(key.publicKey.armor()).toBe(SAMPLE_V6_CERTIFICATE);
		let unlocked = await key.unlock("correct horse battery staple");
		expect(unlocked.status === "failure" && unlocked.error.code).toBe("unsupported");
		let signed = await signCleartext("text", key);
		expect(signed.status === "failure" && signed.error.code).toBe("locked");
	});

	test("derives the A.5.1 and A.5.2 key-encryption keys and additional data", async () => {
		let key = unwrap(await readPrivateKey(SAMPLE_V6_LOCKED_KEY));
		let primary = key.parts.primary;
		let subkey = key.parts.subkeys[0]?.key;
		if (!subkey) throw new Error("The key lost its subkey.");

		let primaryKek = await deriveKek(
			hex("832bd2662a5c2b251ee3fc82aec349a766ca539015880133002e5a21960b3bcf"),
			5,
			6,
			9,
			2,
		);
		expect(Hex.encode(primaryKek)).toBe(
			"9e37cb26787f37e18db172795c4c297550d39ac82511d9af4c8706db6a77fd51",
		);
		expect(Hex.encode(aeadAdditionalData(5, primary))).toBe(
			"c50663877fe31b00000020f94da7bb48d60a61e567706a6587d0331999bb9d891a08242ead84543df895a3",
		);

		let subkeyKek = await deriveKek(
			hex("f74a6ce873a089ef13a3da9ac059777bb22340d15eaa6c9dc0f8ef09035c67cd"),
			7,
			6,
			9,
			2,
		);
		expect(Hex.encode(subkeyKek)).toBe(
			"3c60cb63285f62f4c3de49835786f011cf6f4c069f61232cd7013ff5fd31e603",
		);
		expect(Hex.encode(aeadAdditionalData(7, subkey))).toBe(
			"c70663877fe319000000208693248367f9e5015db922f8f48095dda784987f2d5985b12fbad16caf5e4435",
		);
	});
});

describe("A.6 cleartext signed message", () => {
	test("reads the dash-escaped text", () => {
		let message = unwrap(readCleartext(SAMPLE_CLEARTEXT));
		expect(message.text).toBe(
			"What we need from the grocery store:\n\n- tofu\n- vegetables\n- noodles\n",
		);
		expect(message.hashes).toEqual([]);
	});

	test("verifies with the A.3 certificate", async () => {
		let certificate = unwrap(await readPublicKey(SAMPLE_V6_CERTIFICATE));
		let verified = unwrap(await verifyCleartext(SAMPLE_CLEARTEXT, certificate));
		expect(verified).toEqual({
			text: "What we need from the grocery store:\n\n- tofu\n- vegetables\n- noodles\n",
			signature: {
				signingKey: "CB186C4F0609A697E4D52DFA6C722B0C1F1E27C18A56708F6525EC27BAD9ACC9",
				primaryKey: "CB186C4F0609A697E4D52DFA6C722B0C1F1E27C18A56708F6525EC27BAD9ACC9",
				created: new Date("2022-12-13T16:08:03Z"),
				hash: "SHA-512",
				text: true,
			},
		});
	});

	test("fails once the text changes", async () => {
		let certificate = unwrap(await readPublicKey(SAMPLE_V6_CERTIFICATE));
		let verified = await verifyCleartext(SAMPLE_CLEARTEXT.replace("tofu", "tempeh"), certificate);
		expect(verified.status === "failure" && verified.error.code).toBe("invalid-signature");
	});

	test("refuses an armor header other than Hash", async () => {
		let certificate = unwrap(await readPublicKey(SAMPLE_V6_CERTIFICATE));
		let tampered = SAMPLE_CLEARTEXT.replace(
			"-----BEGIN PGP SIGNED MESSAGE-----\n",
			"-----BEGIN PGP SIGNED MESSAGE-----\nComment: trust me\n",
		);
		let verified = await verifyCleartext(tampered, certificate);
		expect(verified.status === "failure" && verified.error.code).toBe("malformed");
	});
});
