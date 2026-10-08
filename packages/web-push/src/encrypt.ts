/**
 * RFC 8291 payload encryption: ECDH with the subscription's key, HKDF with its auth
 * secret, and one RFC 8188 `aes128gcm` record. The record carries its own salt and the
 * sender's ephemeral key, so the device derives the content key from what it holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { concatBytes } from "@sdxc/crypto";

/** Bytes of salt RFC 8188 writes at the head of every `aes128gcm` record. */
const SALT_LENGTH = 16;

/** Record size written into the header; one record carries the whole payload. */
const RECORD_SIZE = 4096;

/** The delimiter RFC 8188 writes after the data of the last record, before any padding. */
const LAST_RECORD_DELIMITER = 2;

/**
 * The most plaintext, padding included, one record carries inside the 4,096-byte body
 * every push service accepts: less the 86-byte header, the 16-byte tag and the delimiter.
 */
export const MAX_PAYLOAD_BYTES = 3993;

/** What one record is encrypted from and for. */
export interface EncryptInput {
	/** The subscription's uncompressed P-256 point. */
	p256dh: Uint8Array<ArrayBuffer>;
	/** The subscription's 16-byte auth secret. */
	auth: Uint8Array<ArrayBuffer>;
	payload: Uint8Array;
	/** Zero bytes written after the delimiter, so the ciphertext length says less. */
	padding: number;
	/** Fixes the salt, so a record can be compared to a published vector. */
	salt?: Uint8Array<ArrayBuffer>;
	/** Fixes the ephemeral pair, for the same reason. */
	localKeys?: CryptoKeyPair;
}

/**
 * The `info` string of an RFC 8188 key derivation: a label, terminated by a zero byte.
 *
 * @param label - The content-encoding label the derivation is bound to.
 */
function encodingInfo(label: string): Uint8Array<ArrayBuffer> {
	return concatBytes(label, Uint8Array.of(0));
}

/** Turns raw bytes into the HKDF key `crypto.subtle.deriveBits` expands from. */
function importHkdfKey(bytes: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
	return crypto.subtle.importKey("raw", bytes, "HKDF", false, ["deriveBits"]);
}

/**
 * Encrypts a payload into the `aes128gcm` body for one subscription. The caller has
 * checked the key material and the size; a point WebCrypto refuses rejects.
 *
 * @param input - The subscription's keys, the plaintext, padding, and any pinned inputs.
 * @returns The request body, header and ciphertext together.
 */
export async function encrypt(input: EncryptInput): Promise<Uint8Array<ArrayBuffer>> {
	let salt = input.salt ?? crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

	let localKeys =
		input.localKeys ??
		(await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]));

	let userPublicKey = await crypto.subtle.importKey(
		"raw",
		input.p256dh,
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

	let keyInfo = concatBytes(encodingInfo("WebPush: info"), input.p256dh, senderPublicBytes);

	let pseudoRandomKey = new Uint8Array(
		await crypto.subtle.deriveBits(
			{ name: "HKDF", hash: "SHA-256", salt: input.auth, info: keyInfo },
			await importHkdfKey(sharedSecret),
			256,
		),
	);

	let derivationKey = await importHkdfKey(pseudoRandomKey);

	let contentKey = await crypto.subtle.deriveBits(
		{ name: "HKDF", hash: "SHA-256", salt, info: encodingInfo("Content-Encoding: aes128gcm") },
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

	let plaintext = concatBytes(
		input.payload,
		Uint8Array.of(LAST_RECORD_DELIMITER),
		new Uint8Array(input.padding),
	);

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
