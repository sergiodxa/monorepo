/**
 * Authenticated symmetric encryption for values that must be read back.
 *
 * AES-GCM with a fresh random IV per call, wrapped in a versioned envelope so a
 * future algorithm change never requires guessing the format of stored data. This
 * is the third option beside plaintext and irreversible hashes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { Base64Url } from "./encoding.js";
import { CryptoError, DecryptionError, InvalidEnvelopeError, InvalidKeyError } from "./errors.js";
import { toBytes, toText } from "./lib/bytes.js";
import { randomBytes } from "./random.js";

/** Cipher used by the `v1` envelope. */
const SEAL_ALGORITHM = "AES-GCM";

/** Version tag written by `seal` and required by `open`. */
const SEAL_VERSION = "v1";

/** IV length in bytes; 96 bits is the size AES-GCM is specified for. */
const SEAL_IV_BYTES = 12;

/** Separator between envelope fields, outside the base64url alphabet. */
const SEAL_SEPARATOR = ".";

/** Number of fields in the envelope: version, IV, ciphertext. */
const SEAL_FIELDS = 3;

/** AES key sizes WebCrypto accepts, in bytes. */
const SEAL_KEY_BYTES = [16, 24, 32];

/**
 * Imports raw base64url key material as an AES-GCM key.
 *
 * The key is imported as non-extractable, so a leaked reference cannot be turned
 * back into bytes. Generate material with `randomToken({ bytes: 32 })`.
 *
 * @param raw Base64url-encoded key of 16, 24, or 32 bytes.
 * @returns The key, or why the material was rejected.
 * @example
 * let key = await importKey(env.SEAL_KEY);
 */
export async function importKey(raw: string): Promise<Result<CryptoKey, CryptoError>> {
	let material = Base64Url.decode(raw);
	if (isFailure(material)) return material;

	if (!SEAL_KEY_BYTES.includes(material.data.length)) {
		return failure(new InvalidKeyError("expected 16, 24, or 32 bytes of AES key material"));
	}

	try {
		let key = await crypto.subtle.importKey("raw", material.data, SEAL_ALGORITHM, false, [
			"encrypt",
			"decrypt",
		]);
		return success(key);
	} catch {
		return failure(new InvalidKeyError("the runtime rejected the key material"));
	}
}

/**
 * Encrypts a string into a self-describing envelope.
 *
 * The IV is random per call, so sealing the same plaintext twice yields
 * different envelopes; hash a value with `sha256` before storing it for lookup.
 *
 * @param key AES-GCM key from `importKey`.
 * @param plaintext Value to encrypt.
 * @returns Envelope shaped `v1.<iv>.<ciphertext>`, or why encryption failed.
 * @example
 * let sealed = await seal(key, refreshToken);
 */
export async function seal(
	key: CryptoKey,
	plaintext: string,
): Promise<Result<string, CryptoError>> {
	let iv = randomBytes(SEAL_IV_BYTES);

	try {
		let ciphertext = await crypto.subtle.encrypt(
			{ name: SEAL_ALGORITHM, iv },
			key,
			toBytes(plaintext),
		);
		let fields = [SEAL_VERSION, Base64Url.encode(iv), Base64Url.encode(new Uint8Array(ciphertext))];
		return success(fields.join(SEAL_SEPARATOR));
	} catch {
		return failure(new CryptoError("Encryption failed"));
	}
}

/**
 * Decrypts an envelope produced by `seal`.
 *
 * A wrong key and a tampered ciphertext raise the same `DecryptionError`,
 * revealing only that decryption failed and nothing about which part changed.
 *
 * @param key AES-GCM key from `importKey`.
 * @param sealed Envelope shaped `v1.<iv>.<ciphertext>`.
 * @returns The original plaintext, or why it could not be recovered.
 * @example
 * let opened = await open(key, stored.sealedToken);
 */
export async function open(key: CryptoKey, sealed: string): Promise<Result<string, CryptoError>> {
	let fields = sealed.split(SEAL_SEPARATOR);
	if (fields.length !== SEAL_FIELDS) return failure(new InvalidEnvelopeError("unexpected format"));

	let [version = "", encodedIv = "", encodedCiphertext = ""] = fields;
	if (version !== SEAL_VERSION) return failure(new InvalidEnvelopeError("unsupported version"));

	let iv = Base64Url.decode(encodedIv);
	if (isFailure(iv) || iv.data.length !== SEAL_IV_BYTES) {
		return failure(new InvalidEnvelopeError("unreadable initialization vector"));
	}

	let ciphertext = Base64Url.decode(encodedCiphertext);
	if (isFailure(ciphertext) || ciphertext.data.length === 0) {
		return failure(new InvalidEnvelopeError("unreadable ciphertext"));
	}

	try {
		let plaintext = await crypto.subtle.decrypt(
			{ name: SEAL_ALGORITHM, iv: iv.data },
			key,
			ciphertext.data,
		);
		return success(toText(new Uint8Array(plaintext)));
	} catch {
		return failure(new DecryptionError());
	}
}
