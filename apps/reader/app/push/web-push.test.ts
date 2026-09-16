/**
 * Checks the push encryption against RFC 8291's published vector, that a random
 * record decrypts back to what went in, and that the VAPID credential and the
 * request carry what a push service authenticates and routes on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { PushTarget, VapidKeys } from "~/app/push/web-push";

import { encryptPayload, pushRequest, vapidAuthorization } from "~/app/push/web-push";

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

/** Twelve hours in seconds, which is how far ahead a VAPID token's `exp` sits. */
const TWELVE_HOURS = 12 * 60 * 60;

/**
 * Reads base64url, the form every key, salt and token segment in this file travels in.
 *
 * @param value - Unpadded base64url.
 * @returns The bytes it spells.
 */
function decode(value: string): Uint8Array<ArrayBuffer> {
	let padded = value.replaceAll("-", "+").replaceAll("_", "/");
	let binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
	let bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

/**
 * Writes bytes as unpadded base64url, so a produced record compares to the vector.
 *
 * @param bytes - The bytes to spell.
 * @returns Unpadded base64url.
 */
function encode(bytes: Uint8Array): string {
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/**
 * Splits an uncompressed P-256 point into the JWK coordinates WebCrypto imports by.
 *
 * @param point - The 65-byte point, base64url.
 * @returns The `x` and `y` coordinates, base64url.
 */
function coordinates(point: string): { x: string; y: string } {
	let bytes = decode(point);
	return { x: encode(bytes.subarray(1, 33)), y: encode(bytes.subarray(33, 65)) };
}

/**
 * Rebuilds the vector's ephemeral sender pair, so the encryption is reproducible.
 *
 * @returns The pair, with the public half exportable as a raw point.
 */
async function vectorSenderKeys(): Promise<CryptoKeyPair> {
	let point = coordinates(VECTOR.senderPublic);

	let privateKey = await crypto.subtle.importKey(
		"jwk",
		{ kty: "EC", crv: "P-256", d: VECTOR.senderPrivate, ...point },
		{ name: "ECDH", namedCurve: "P-256" },
		false,
		["deriveBits"],
	);

	let publicKey = await crypto.subtle.importKey(
		"jwk",
		{ kty: "EC", crv: "P-256", ...point },
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		[],
	);

	return { privateKey, publicKey };
}

/**
 * A subscription whose private half the test keeps, so a record can be opened again.
 *
 * @returns The target as a caller sees it, plus the key that decrypts for it.
 */
async function subscription(): Promise<{ target: PushTarget; privateKey: CryptoKey }> {
	let pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
		"deriveBits",
	]);

	let p256dh = encode(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));

	return {
		privateKey: pair.privateKey,
		target: {
			endpoint: "https://push.example.com/send/abc123",
			p256dh,
			auth: encode(crypto.getRandomValues(new Uint8Array(16))),
		},
	};
}

/**
 * Runs RFC 8291's derivation from the receiving side and opens the record.
 *
 * @param body - The `aes128gcm` record as it would be sent.
 * @param target - The subscription the record was built for.
 * @param privateKey - The subscription's private half.
 * @returns The plaintext that was encrypted.
 */
async function decryptRecord(
	body: Uint8Array<ArrayBuffer>,
	target: PushTarget,
	privateKey: CryptoKey,
): Promise<string> {
	let salt = body.subarray(0, 16);
	let senderPublicBytes = body.subarray(21, 21 + body[20]!);
	let ciphertext = body.subarray(21 + body[20]!);

	let senderPublicKey = await crypto.subtle.importKey(
		"raw",
		senderPublicBytes,
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		[],
	);

	let shared = await crypto.subtle.deriveBits(
		{ name: "ECDH", public: senderPublicKey },
		privateKey,
		256,
	);

	let encoder = new TextEncoder();

	let keyInfo = new Uint8Array([
		...encoder.encode("WebPush: info"),
		0,
		...decode(target.p256dh),
		...senderPublicBytes,
	]);

	let ikm = await crypto.subtle.deriveBits(
		{ name: "HKDF", hash: "SHA-256", salt: decode(target.auth), info: keyInfo },
		await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveBits"]),
		256,
	);

	let derivationKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);

	let contentKey = await crypto.subtle.deriveBits(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt,
			info: new Uint8Array([...encoder.encode("Content-Encoding: aes128gcm"), 0]),
		},
		derivationKey,
		128,
	);

	let nonce = await crypto.subtle.deriveBits(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt,
			info: new Uint8Array([...encoder.encode("Content-Encoding: nonce"), 0]),
		},
		derivationKey,
		96,
	);

	let aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, [
		"decrypt",
	]);

	let plaintext = new Uint8Array(
		await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aesKey, ciphertext),
	);

	return new TextDecoder().decode(plaintext.subarray(0, plaintext.length - 1));
}

/**
 * A VAPID identity generated for the test, in the base64url form the app stores.
 *
 * @returns The three values `vapidAuthorization` takes.
 */
async function vapidKeys(): Promise<VapidKeys> {
	let pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
		"sign",
		"verify",
	]);

	let jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

	return {
		publicKey: encode(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
		privateKey: jwk.d!,
		subject: "mailto:push@example.com",
	};
}

describe("encrypting a payload for one device", () => {
	test("reproduces RFC 8291's published record byte for byte", async () => {
		let body = await encryptPayload(
			{
				endpoint: "https://push.example.com/send/rfc",
				p256dh: VECTOR.userPublic,
				auth: VECTOR.auth,
			},
			VECTOR.plaintext,
			{ salt: decode(VECTOR.salt), localKeys: await vectorSenderKeys() },
		);

		expect(encode(body)).toBe(VECTOR.body);
	});

	test("frames the record so a device can read the header it derives from", async () => {
		let { target } = await subscription();
		let salt = crypto.getRandomValues(new Uint8Array(16));

		let body = await encryptPayload(target, "hello", { salt });

		expect(body.subarray(0, 16)).toEqual(salt);
		expect(new DataView(body.buffer, body.byteOffset).getUint32(16, false)).toBe(4096);
		expect(body[20]).toBe(65);
	});

	test("round-trips a random encryption back to the plaintext", async () => {
		let { target, privateKey } = await subscription();

		let body = await encryptPayload(target, "Twelve unread across three feeds");

		await expect(decryptRecord(body, target, privateKey)).resolves.toBe(
			"Twelve unread across three feeds",
		);
	});

	test("draws a new salt for every record, so two sends never match", async () => {
		let { target } = await subscription();

		let first = await encryptPayload(target, "hello");
		let second = await encryptPayload(target, "hello");

		expect(encode(first)).not.toBe(encode(second));
	});
});

describe("the VAPID credential a push service authenticates by", () => {
	test("names the endpoint's origin, the sender, and a 12-hour expiry", async () => {
		let keys = await vapidKeys();
		let now = Date.UTC(2026, 8, 16, 12, 0, 0);

		let authorization = await vapidAuthorization(
			keys,
			"https://fcm.googleapis.com/fcm/send/abc123?query=1",
			now,
		);

		expect(authorization.startsWith("vapid t=")).toBe(true);
		expect(authorization.endsWith(`, k=${keys.publicKey}`)).toBe(true);

		let token = authorization.slice("vapid t=".length, authorization.indexOf(", k="));
		let payload = JSON.parse(new TextDecoder().decode(decode(token.split(".")[1]!))) as {
			aud: string;
			sub: string;
			exp: number;
		};

		expect(payload.aud).toBe("https://fcm.googleapis.com");
		expect(payload.sub).toBe(keys.subject);
		expect(payload.exp).toBe(Math.floor(now / 1000) + TWELVE_HOURS);
	});
});

describe("the request that delivers one notification", () => {
	test("carries the headers a push service routes on and the encrypted record", async () => {
		let keys = await vapidKeys();
		let { target } = await subscription();
		let salt = crypto.getRandomValues(new Uint8Array(16));

		let request = await pushRequest(keys, target, "Twelve unread", { salt });

		expect(request.method).toBe("POST");
		expect(request.url).toBe(target.endpoint);
		expect(request.headers.get("Authorization")?.startsWith("vapid t=")).toBe(true);
		expect(request.headers.get("Content-Encoding")).toBe("aes128gcm");
		expect(request.headers.get("Content-Type")).toBe("application/octet-stream");
		expect(request.headers.get("TTL")).toBe("2419200");
		expect(request.headers.get("Urgency")).toBe("normal");

		let body = new Uint8Array(await request.arrayBuffer());

		expect(body.subarray(0, 16)).toEqual(salt);
	});

	test("holds a message for as long as the caller asks", async () => {
		let keys = await vapidKeys();
		let { target } = await subscription();

		let request = await pushRequest(keys, target, "Twelve unread", { ttl: 60 });

		expect(request.headers.get("TTL")).toBe("60");
	});
});
