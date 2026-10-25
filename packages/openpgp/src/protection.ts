/**
 * Passphrase protection for secret key material (RFC 9580 §5.5.3): unlocks AEAD (GCM),
 * CFB and version 4 MalleableCFB material, and locks new material with Iterated-and-Salted
 * SHA-256, HKDF and AES-256-GCM, the strongest form Web Crypto can produce without Argon2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { concatBytes, randomBytes } from "@sdxc/crypto";
import { failure, success } from "@sdxc/result";

import type { KeyPacket, Protection } from "./key-packet.js";

import { AEAD_GCM, AES_256, AES_KEY_SIZES, GCM_NONCE_SIZE } from "./algorithms.js";
import { OpenPgpError } from "./errors.js";
import { checksum16, secretLength } from "./key-packet.js";
import { equalBytes } from "./lib/bytes.js";
import { DEFAULT_S2K_COUNT, deriveKey } from "./s2k.js";

/** AES's block size in octets, the CFB IV length. */
const BLOCK_SIZE = 16;

/**
 * The AEAD key-encryption key (§5.5.3): HKDF-SHA256 over the S2K output with no salt and
 * the info `packet type (OpenPGP format) || version || cipher || AEAD mode`.
 *
 * @param s2kKey - The S2K-derived key.
 * @param packetType - 5 for a Secret Key, 7 for a Secret Subkey.
 * @param version - The key version.
 * @param cipher - The symmetric algorithm ID.
 * @param aead - The AEAD mode ID.
 */
export async function deriveKek(
	s2kKey: Bytes,
	packetType: number,
	version: number,
	cipher: number,
	aead: number,
): Promise<Bytes> {
	let ikm = await crypto.subtle.importKey("raw", s2kKey, "HKDF", false, ["deriveBits"]);
	let info = Uint8Array.of(0xc0 | packetType, version, cipher, aead);
	let bits = await crypto.subtle.deriveBits(
		{ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info },
		ikm,
		s2kKey.length * 8,
	);
	return new Uint8Array(bits);
}

/**
 * The AEAD additional data: the packet type in OpenPGP format, then the public key body.
 *
 * @param packetType - 5 or 7.
 * @param key - The key whose material is locked.
 */
export function aeadAdditionalData(packetType: number, key: KeyPacket): Bytes {
	return concatBytes(Uint8Array.of(0xc0 | packetType), key.body);
}

/**
 * AES applied to one block, built from Web Crypto's CTR mode, whose first keystream
 * block is the cipher run over the counter.
 *
 * @param key - The AES key.
 * @param block - The 16-octet input.
 */
async function encryptBlock(key: CryptoKey, block: Bytes): Promise<Bytes> {
	let keystream = await crypto.subtle.encrypt(
		{ name: "AES-CTR", counter: block, length: 128 },
		key,
		new Uint8Array(BLOCK_SIZE),
	);
	return new Uint8Array(keystream);
}

/**
 * OpenPGP CFB decryption without resynchronization, as secret keys use it.
 *
 * @param keyBytes - The AES key.
 * @param iv - The 16-octet IV.
 * @param data - The ciphertext.
 */
async function decryptCfb(keyBytes: Bytes, iv: Bytes, data: Bytes): Promise<Bytes> {
	let key = await crypto.subtle.importKey("raw", keyBytes, "AES-CTR", false, ["encrypt"]);
	let plaintext = new Uint8Array(data.length);
	let previous = iv;
	for (let offset = 0; offset < data.length; offset += BLOCK_SIZE) {
		let keystream = await encryptBlock(key, previous);
		let block = data.slice(offset, offset + BLOCK_SIZE);
		for (let index = 0; index < block.length; index++) {
			plaintext[offset + index] = (block[index] ?? 0) ^ (keystream[index] ?? 0);
		}
		previous = block;
	}
	return plaintext;
}

/**
 * The plaintext secret behind a CFB-protected key, checked against its SHA-1 (usage
 * 254) or 2-octet checksum (usage 255), or `null` when the check fails.
 *
 * @param plaintext - The decrypted octets.
 * @param usage - 254 or 255.
 */
async function checkedCfbSecret(plaintext: Bytes, usage: 254 | 255): Promise<Bytes | null> {
	let checkSize = usage === 254 ? 20 : 2;
	let secret = plaintext.slice(0, plaintext.length - checkSize);
	let check = plaintext.slice(plaintext.length - checkSize);
	let expected =
		usage === 254
			? new Uint8Array(await crypto.subtle.digest("SHA-1", secret))
			: checksum16(secret);
	return equalBytes(check, expected) ? secret : null;
}

/**
 * Decrypts a key's protected material. GCM is the only AEAD mode Web Crypto runs, and
 * Argon2 cannot be computed, so keys using OCB, EAX or Argon2 answer `unsupported`.
 *
 * @param key - The key packet the material belongs to.
 * @param packetType - 5 for a Secret Key, 7 for a Secret Subkey.
 * @param protection - How the material is locked.
 * @param passphrase - The passphrase.
 */
export async function unlockSecret(
	key: KeyPacket,
	packetType: number,
	protection: Protection,
	passphrase: string,
): Promise<Result<Bytes, OpenPgpError>> {
	let size = AES_KEY_SIZES[protection.cipher];
	if (size === undefined) {
		return failure(
			new OpenPgpError("unsupported", `Cipher ${protection.cipher} is not supported; only AES is.`),
		);
	}
	if (protection.usage === 253 && protection.aead !== AEAD_GCM) {
		return failure(
			new OpenPgpError(
				"unsupported",
				`AEAD mode ${protection.aead} is not available in Web Crypto; only GCM is.`,
			),
		);
	}
	let s2kKey = await deriveKey(protection.s2k, passphrase, size);
	if (s2kKey.status === "failure") return s2kKey;

	let secret: Bytes | null = null;
	if (protection.usage === 253) {
		let kek = await deriveKek(
			s2kKey.data,
			packetType,
			key.version,
			protection.cipher,
			protection.aead,
		);
		let aes = await crypto.subtle.importKey("raw", kek, "AES-GCM", false, ["decrypt"]);
		secret = await crypto.subtle
			.decrypt(
				{ name: "AES-GCM", iv: protection.iv, additionalData: aeadAdditionalData(packetType, key) },
				aes,
				protection.data,
			)
			.then(
				(plaintext) => new Uint8Array(plaintext),
				() => null,
			);
	} else {
		let plaintext = await decryptCfb(s2kKey.data, protection.iv, protection.data);
		secret = await checkedCfbSecret(plaintext, protection.usage);
	}

	if (secret === null)
		return failure(new OpenPgpError("bad-passphrase", "The passphrase does not unlock the key."));
	if (secretLength(secret, key.algorithm) !== secret.length) {
		return failure(new OpenPgpError("malformed", "The unlocked secret material does not parse."));
	}
	return success(secret);
}

/**
 * Encrypts secret material under a passphrase: Iterated-and-Salted SHA-256 S2K over 16
 * MiB, HKDF-SHA256, then AES-256-GCM with the key packet as additional data (usage 253).
 *
 * @param key - The key packet the material belongs to.
 * @param packetType - 5 for a Secret Key, 7 for a Secret Subkey.
 * @param secret - The plaintext secret octets.
 * @param passphrase - The passphrase.
 */
export async function lockSecret(
	key: KeyPacket,
	packetType: number,
	secret: Bytes,
	passphrase: string,
): Promise<Result<Protection, OpenPgpError>> {
	let s2k = { type: 3 as const, hash: 8, salt: randomBytes(8), count: DEFAULT_S2K_COUNT };
	let s2kKey = await deriveKey(s2k, passphrase, 32);
	if (s2kKey.status === "failure") return s2kKey;

	let kek = await deriveKek(s2kKey.data, packetType, key.version, AES_256, AEAD_GCM);
	let aes = await crypto.subtle.importKey("raw", kek, "AES-GCM", false, ["encrypt"]);
	let iv = randomBytes(GCM_NONCE_SIZE);
	let data = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv, additionalData: aeadAdditionalData(packetType, key) },
		aes,
		secret,
	);
	return success({
		usage: 253,
		cipher: AES_256,
		aead: AEAD_GCM,
		s2k,
		iv,
		data: new Uint8Array(data),
	});
}
