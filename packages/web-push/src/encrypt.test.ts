/**
 * Checks the record encryption against RFC 8291's published vector, and that a random
 * record, padded or not, decrypts back from the receiving side to what went in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { encrypt, MAX_PAYLOAD_BYTES } from "./encrypt.js";

/** RFC 8291 §5's subscription, sender pair, salt and expected record. */
const VECTOR = {
	plaintext: "When I grow up, I want to be a watermelon",
	salt: "DGv6ra1nlYgDCS1FRnbzlw",
	senderPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
	senderPublic:
		"BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
	userPublic:
		"BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
	auth: "BTBZMqHH6r4Tts7J_aSIgg",
	body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
} as const;

/** Reads base64url, the form every key and salt in this file travels in. */
function decode(value: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(unwrap(Base64Url.decode(value)));
}

/** Rebuilds the vector's ephemeral sender pair, so the encryption is reproducible. */
async function vectorSenderKeys(): Promise<CryptoKeyPair> {
	let point = decode(VECTOR.senderPublic);
	let x = Base64Url.encode(point.subarray(1, 33));
	let y = Base64Url.encode(point.subarray(33));
	let algorithm = { name: "ECDH", namedCurve: "P-256" };

	let privateKey = await crypto.subtle.importKey(
		"jwk",
		{ kty: "EC", crv: "P-256", d: VECTOR.senderPrivate, x, y },
		algorithm,
		false,
		["deriveBits"],
	);
	let publicKey = await crypto.subtle.importKey("raw", point, algorithm, true, []);

	return { privateKey, publicKey };
}

/** A recipient whose private half the test keeps, so a record can be opened again. */
async function recipient() {
	let pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
		"deriveBits",
	]);
	return {
		privateKey: pair.privateKey,
		p256dh: new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)),
		auth: crypto.getRandomValues(new Uint8Array(16)),
	};
}

/** Derives one HKDF output from raw keying material. */
async function hkdf(
	ikm: BufferSource,
	salt: BufferSource,
	info: Uint8Array,
	bits: number,
): Promise<ArrayBuffer> {
	let key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
	return await crypto.subtle.deriveBits(
		{ name: "HKDF", hash: "SHA-256", salt, info: Uint8Array.from(info) },
		key,
		bits,
	);
}

/**
 * Runs RFC 8291's derivation from the receiving side, opens the record and strips the
 * padding after the delimiter.
 */
async function decrypt(
	body: Uint8Array<ArrayBuffer>,
	device: Awaited<ReturnType<typeof recipient>>,
): Promise<Uint8Array> {
	let encoder = new TextEncoder();
	let salt = body.subarray(0, 16);
	let keyLength = body[20] ?? 0;
	let senderPublic = body.subarray(21, 21 + keyLength);
	let ciphertext = body.subarray(21 + keyLength);

	let senderKey = await crypto.subtle.importKey(
		"raw",
		senderPublic,
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		[],
	);
	let shared = await crypto.subtle.deriveBits(
		{ name: "ECDH", public: senderKey },
		device.privateKey,
		256,
	);

	let ikm = await hkdf(
		shared,
		device.auth,
		new Uint8Array([...encoder.encode("WebPush: info"), 0, ...device.p256dh, ...senderPublic]),
		256,
	);
	let contentKey = await hkdf(
		ikm,
		salt,
		new Uint8Array([...encoder.encode("Content-Encoding: aes128gcm"), 0]),
		128,
	);
	let nonce = await hkdf(
		ikm,
		salt,
		new Uint8Array([...encoder.encode("Content-Encoding: nonce"), 0]),
		96,
	);

	let aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["decrypt"]);
	let plaintext = new Uint8Array(
		await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aesKey, ciphertext),
	);

	let end = plaintext.length - 1;
	while (end > 0 && plaintext[end] === 0) end--;
	expect(plaintext[end]).toBe(2);
	return plaintext.subarray(0, end);
}

describe("encrypting a payload for one device", () => {
	test("reproduces RFC 8291's published record byte for byte", async () => {
		let body = await encrypt({
			p256dh: decode(VECTOR.userPublic),
			auth: decode(VECTOR.auth),
			payload: new TextEncoder().encode(VECTOR.plaintext),
			padding: 0,
			salt: decode(VECTOR.salt),
			localKeys: await vectorSenderKeys(),
		});

		expect(Base64Url.encode(body)).toBe(VECTOR.body);
	});

	test("frames the record with its salt, a 4,096-byte record size and the sender's key", async () => {
		let device = await recipient();
		let salt = crypto.getRandomValues(new Uint8Array(16));

		let body = await encrypt({ ...device, payload: new Uint8Array(5), padding: 0, salt });

		expect(body.subarray(0, 16)).toEqual(salt);
		expect(new DataView(body.buffer, body.byteOffset).getUint32(16, false)).toBe(4096);
		expect(body[20]).toBe(65);
	});

	test.each([0, 1, 100, 1000, MAX_PAYLOAD_BYTES])(
		"round-trips %i bytes back to the plaintext",
		async (size) => {
			let device = await recipient();
			let payload = crypto.getRandomValues(new Uint8Array(size));

			let body = await encrypt({ ...device, payload, padding: 0 });

			expect(await decrypt(body, device)).toEqual(payload);
		},
	);

	test("round-trips a padded record, whose ciphertext grows by the padding", async () => {
		let device = await recipient();
		let payload = new TextEncoder().encode("Twelve unread across three feeds");

		let plain = await encrypt({ ...device, payload, padding: 0 });
		let padded = await encrypt({ ...device, payload, padding: 200 });

		expect(padded.length - plain.length).toBe(200);
		expect(new TextDecoder().decode(await decrypt(padded, device))).toBe(
			"Twelve unread across three feeds",
		);
	});

	/** The limit is exactly the plaintext that fills the 4,096-byte body every service accepts. */
	test("fills exactly 4,096 bytes at the limit", async () => {
		let device = await recipient();

		let body = await encrypt({
			...device,
			payload: new Uint8Array(MAX_PAYLOAD_BYTES - 10),
			padding: 10,
		});

		expect(body.length).toBe(4096);
	});

	test("draws a new salt and key for every record, so two sends never match", async () => {
		let device = await recipient();
		let payload = new TextEncoder().encode("hello");

		let first = await encrypt({ ...device, payload, padding: 0 });
		let second = await encrypt({ ...device, payload, padding: 0 });

		expect(Base64Url.encode(first)).not.toBe(Base64Url.encode(second));
	});
});
