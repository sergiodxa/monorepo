/**
 * Web push delivery as pure functions: RFC 8291 payload encryption over a
 * subscription's key material, an RFC 8292 VAPID credential, and the `POST` a
 * caller sends. Key material arrives as arguments, so nothing here reaches out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK, JWT } from "@sdxc/jwt";

/** Bytes of salt RFC 8188 writes at the head of every `aes128gcm` record. */
const SALT_LENGTH = 16;

/** Bytes of an uncompressed P-256 point, which is how both parties exchange keys. */
const PUBLIC_KEY_LENGTH = 65;

/** Record size written into the header; one record carries the whole payload. */
const RECORD_SIZE = 4096;

/** Four weeks, the longest a push service is asked to hold an undelivered message. */
const DEFAULT_TTL = 2_419_200;

/** How long a VAPID token stays valid, inside the 24 hours RFC 8292 allows. */
const VAPID_LIFETIME_SECONDS = 12 * 60 * 60;

/** Milliseconds in a second, for the epoch-seconds `exp` is written in. */
const MS_PER_SECOND = 1000;

/** Identifier written as the token's `kid`, naming the pair the sender signs with. */
const VAPID_KEY_ID = "vapid";

/** The VAPID identity a push service authenticates the sender by. */
export interface VapidKeys {
	/** The application server's P-256 public key, base64url, uncompressed point form. */
	publicKey: string;
	/** The application server's P-256 private key, base64url raw scalar. */
	privateKey: string;
	/** A `mailto:` a push service contacts about a misbehaving sender. */
	subject: string;
}

/** One device's endpoint and the key material its payload is encrypted under. */
export interface PushTarget {
	endpoint: string;
	/** The client's public key as the Push API hands it over, base64url. */
	p256dh: string;
	/** The client's auth secret as the Push API hands it over, base64url. */
	auth: string;
}

/** Deterministic inputs a test pins so an encryption can be compared to a vector. */
export interface EncryptOptions {
	/** 16 bytes of salt; randomly generated when the caller names none. */
	salt?: Uint8Array;
	/** The ephemeral P-256 pair the exchange runs over; generated when omitted. */
	localKeys?: CryptoKeyPair;
}

/** What `pushRequest` accepts on top of the encryption inputs. */
export interface PushRequestOptions extends EncryptOptions {
	/**
	 * Seconds a push service may hold the message for a device that is offline.
	 *
	 * @default 2419200
	 */
	ttl?: number;
}

/**
 * Reads base64url text, which is the only form key material and salts travel in.
 *
 * @param value - Unpadded base64url.
 * @returns The bytes it spells.
 */
function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
	let padded = value.replaceAll("-", "+").replaceAll("_", "/");
	let binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
	let bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

/**
 * Writes bytes as the unpadded base64url a header value and a JWK carry.
 *
 * @param bytes - The bytes to spell.
 * @returns Unpadded base64url.
 */
function encodeBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/**
 * Joins byte runs into the single buffer a header, an info string or a record is.
 *
 * @param parts - The runs, in the order they appear.
 * @returns One buffer holding them end to end.
 */
function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
	let total = parts.reduce((sum, part) => sum + part.length, 0);
	let joined = new Uint8Array(total);
	let offset = 0;
	for (let part of parts) {
		joined.set(part, offset);
		offset += part.length;
	}
	return joined;
}

/**
 * The `info` string of an RFC 8188 key derivation: a label, terminated by a zero byte.
 *
 * @param label - The content-encoding label the derivation is bound to.
 * @returns The label's bytes followed by `0x00`.
 */
function encodingInfo(label: string): Uint8Array<ArrayBuffer> {
	return concatBytes(new TextEncoder().encode(label), Uint8Array.of(0));
}

/**
 * Turns raw bytes into the HKDF key `crypto.subtle.deriveBits` expands from.
 *
 * @param bytes - The input keying material.
 * @returns A key usable for one derivation.
 */
function importHkdfKey(bytes: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
	return crypto.subtle.importKey("raw", bytes, "HKDF", false, ["deriveBits"]);
}

/**
 * Encrypts a payload into an RFC 8188 `aes128gcm` body for one subscription.
 *
 * The body carries its own salt and the sender's ephemeral public key, so the
 * device can derive the same content key from the subscription it already holds.
 * A caller pinning `salt` and `localKeys` gets a byte-for-byte reproducible record.
 *
 * @param target - The device whose `p256dh` and `auth` the payload is bound to.
 * @param payload - The plaintext, which is UTF-8 encoded before encryption.
 * @param options - Deterministic salt and ephemeral pair.
 * @returns The request body, header and ciphertext together.
 */
export async function encryptPayload(
	target: PushTarget,
	payload: string,
	options: EncryptOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
	let salt = options.salt
		? Uint8Array.from(options.salt)
		: crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

	let localKeys =
		options.localKeys ??
		(await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]));

	let userPublicBytes = decodeBase64Url(target.p256dh);
	let userPublicKey = await crypto.subtle.importKey(
		"raw",
		userPublicBytes,
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		[],
	);

	let senderPublicBytes = new Uint8Array(await crypto.subtle.exportKey("raw", localKeys.publicKey));

	let sharedSecret = new Uint8Array(
		await crypto.subtle.deriveBits(
			{ name: "ECDH", public: userPublicKey },
			localKeys.privateKey,
			256,
		),
	);

	let keyInfo = concatBytes(encodingInfo("WebPush: info"), userPublicBytes, senderPublicBytes);

	let pseudoRandomKey = new Uint8Array(
		await crypto.subtle.deriveBits(
			{ name: "HKDF", hash: "SHA-256", salt: decodeBase64Url(target.auth), info: keyInfo },
			await importHkdfKey(sharedSecret),
			256,
		),
	);

	let derivationKey = await importHkdfKey(pseudoRandomKey);

	let contentKey = await crypto.subtle.deriveBits(
		{
			name: "HKDF",
			hash: "SHA-256",
			salt,
			info: encodingInfo("Content-Encoding: aes128gcm"),
		},
		derivationKey,
		128,
	);

	let nonce = await crypto.subtle.deriveBits(
		{ name: "HKDF", hash: "SHA-256", salt, info: encodingInfo("Content-Encoding: nonce") },
		derivationKey,
		96,
	);

	let aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, [
		"encrypt",
	]);

	let plaintext = concatBytes(new TextEncoder().encode(payload), Uint8Array.of(2));

	let ciphertext = new Uint8Array(
		await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext),
	);

	let recordSize = new Uint8Array(4);
	new DataView(recordSize.buffer).setUint32(0, RECORD_SIZE, false);

	return concatBytes(
		salt,
		recordSize,
		Uint8Array.of(senderPublicBytes.length),
		senderPublicBytes,
		ciphertext,
	);
}

/**
 * Imports the sender's private scalar as the ECDSA key a VAPID token is signed with.
 *
 * WebCrypto takes a P-256 private key only as a JWK, so the public point is split
 * back into its coordinates to complete the key the raw scalar belongs to.
 *
 * @param keys - The sender's key pair, base64url as it is stored.
 * @returns A non-extractable signing key.
 */
function importVapidSigningKey(keys: VapidKeys): Promise<CryptoKey> {
	let publicKey = decodeBase64Url(keys.publicKey);

	return crypto.subtle.importKey(
		"jwk",
		{
			kty: "EC",
			crv: "P-256",
			d: keys.privateKey,
			x: encodeBase64Url(publicKey.subarray(1, 33)),
			y: encodeBase64Url(publicKey.subarray(33, PUBLIC_KEY_LENGTH)),
		},
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);
}

/**
 * The `vapid t=<jwt>, k=<publicKey>` credential for one push service origin.
 *
 * The token's audience is the endpoint's origin rather than the endpoint itself,
 * so one token covers every device a service holds and reveals no endpoint path.
 *
 * @param keys - The sender's identity.
 * @param endpoint - The device endpoint the credential is going to be sent to.
 * @param now - The instant the 12-hour lifetime is measured from.
 * @returns The value of the `Authorization` header.
 */
export async function vapidAuthorization(
	keys: VapidKeys,
	endpoint: string,
	now: number = Date.now(),
): Promise<string> {
	let token = new JWT({
		aud: new URL(endpoint).origin,
		exp: Math.floor(now / MS_PER_SECOND) + VAPID_LIFETIME_SECONDS,
		sub: keys.subject,
	});

	let signed = await token.sign(JWK.Algorithm.ES256, [
		{
			id: VAPID_KEY_ID,
			alg: JWK.Algorithm.ES256,
			private: await importVapidSigningKey(keys),
		},
	]);

	return `vapid t=${signed}, k=${keys.publicKey}`;
}

/**
 * The `POST` that delivers one notification to one device.
 *
 * The caller sends it and reads the status, which is what says whether the
 * endpoint is still live.
 *
 * @param keys - The sender's VAPID identity.
 * @param target - The device the notification belongs to.
 * @param payload - The plaintext the device decrypts.
 * @param options - Deterministic encryption inputs, and how long the service may hold it.
 * @returns A request ready for `fetch`.
 */
export async function pushRequest(
	keys: VapidKeys,
	target: PushTarget,
	payload: string,
	options: PushRequestOptions = {},
): Promise<Request> {
	let body = await encryptPayload(target, payload, options);

	return new Request(target.endpoint, {
		method: "POST",
		headers: {
			Authorization: await vapidAuthorization(keys, target.endpoint),
			"Content-Encoding": "aes128gcm",
			"Content-Type": "application/octet-stream",
			TTL: String(options.ttl ?? DEFAULT_TTL),
			Urgency: "normal",
		},
		body,
	});
}
