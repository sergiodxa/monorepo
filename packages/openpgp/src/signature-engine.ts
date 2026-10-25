/**
 * Creating and checking one signature (RFC 9580 §5.2.4): the salt, the signed data and the
 * trailer hashed in one context, then handed to Web Crypto. Every signature this package
 * makes or verifies, over data or over keys, passes through these two functions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { concatBytes, randomBytes } from "@sdxc/crypto";
import { failure, success } from "@sdxc/result";

import type { HashInfo } from "./algorithms.js";
import type { KeyPacket } from "./key-packet.js";
import type { SignaturePacket, Subpacket } from "./signature-packet.js";

import { hashById, PUBLIC_KEY_ALGORITHM, SUBPACKET } from "./algorithms.js";
import { OpenPgpError } from "./errors.js";
import { equalBytes, timeField, u16, u32, utf8 } from "./lib/bytes.js";
import { signValues, verifyValues } from "./primitives.js";
import {
	createdAt,
	hashedPrefixOf,
	hasUnknownCritical,
	signatureTrailer,
	writeSignatureBody,
} from "./signature-packet.js";

/** A key packet with the plaintext secret that signs for it. */
export interface Signer {
	key: KeyPacket;
	secret: Bytes;
}

/** What a new signature says beyond its signer, type and data. */
export interface SignatureOptions {
	hash: HashInfo;
	created: Date;
	/** Subpackets hashed between the creation time and the issuer fingerprint. */
	subpackets?: Subpacket[];
}

/**
 * The octets a signature over a key hashes for that key (§5.2.4): `0x99` and a 2-octet
 * length for v4, `0x9B` and a 4-octet length for v6, then the Public Key body.
 *
 * @param key - The key being signed over.
 */
export function keyHashInput(key: KeyPacket): Bytes {
	return key.version === 6
		? concatBytes(Uint8Array.of(0x9b), u32(key.body.length), key.body)
		: concatBytes(Uint8Array.of(0x99), u16(key.body.length), key.body);
}

/**
 * The octets a certification hashes for a User ID: `0xB4`, a 4-octet length, the text.
 *
 * @param userId - The User ID packet body.
 */
export function userIdHashInput(userId: Bytes): Bytes {
	return concatBytes(Uint8Array.of(0xb4), u32(userId.length), userId);
}

/**
 * Text canonicalized for a text signature (type 0x01): every line ending becomes CR LF.
 *
 * @param text - The text to sign or verify.
 */
export function canonicalText(text: string): Bytes {
	return utf8(text.replace(/\r?\n/g, "\r\n"));
}

/**
 * A subpacket from its type and body.
 *
 * @param type - The subpacket type ID.
 * @param body - The subpacket body.
 * @param critical - Whether a verifier that does not know it must reject the signature.
 */
export function subpacket(type: number, body: Bytes, critical = false): Subpacket {
	return { type, critical, body };
}

/**
 * The digest of the hashed data under the signature's hash.
 *
 * @param hash - The hash.
 * @param data - The octets.
 */
async function digestOf(hash: HashInfo, data: Bytes): Promise<Bytes> {
	return new Uint8Array(await crypto.subtle.digest(hash.name, data));
}

/**
 * Makes a Signature packet body. The hashed area holds the creation time (critical), the
 * caller's subpackets and the issuer fingerprint; a v4 signature also names the issuer
 * Key ID, unhashed, for tools that look keys up by it.
 *
 * @param signer - The signing key and its secret.
 * @param type - The signature type ID.
 * @param data - The signed data, before salt and trailer.
 * @param options - The hash, the creation time and extra hashed subpackets.
 */
export async function createSignature(
	signer: Signer,
	type: number,
	data: Bytes,
	options: SignatureOptions,
): Promise<Result<Bytes, OpenPgpError>> {
	let { key, secret } = signer;
	let { hash } = options;
	let hashed = [
		subpacket(SUBPACKET.creationTime, timeField(options.created), true),
		...(options.subpackets ?? []),
		subpacket(
			SUBPACKET.issuerFingerprint,
			concatBytes(Uint8Array.of(key.version), key.fingerprint),
		),
	];
	let unhashed = key.version === 4 ? [subpacket(SUBPACKET.issuerKeyId, key.keyId)] : [];

	let salt = key.version === 6 ? randomBytes(hash.saltSize) : new Uint8Array(0);
	let prefix = hashedPrefixOf(key.version, type, key.algorithm, hash.id, hashed);
	let input = concatBytes(salt, data, signatureTrailer(key.version, prefix));
	let digest = await digestOf(hash, input);

	let signature = await signValues(key.material, secret, hash, input, digest);
	if (signature.status === "failure") return signature;
	let { values, native } = signature.data;
	return success(
		writeSignatureBody(key.version, prefix, unhashed, digest.slice(0, 2), salt, values, native),
	);
}

/**
 * Checks that a signature verifies over the data with the key, after the structural
 * checks RFC 9580 requires: matching versions and algorithm, an accepted hash, a v6 salt
 * of the hash's size, a creation time, no unknown critical subpacket and matching left 16 bits.
 *
 * @param signature - The signature.
 * @param key - The key that supposedly made it.
 * @param data - The signed data, before salt and trailer.
 */
export async function checkSignature(
	signature: SignaturePacket,
	key: KeyPacket,
	data: Bytes,
): Promise<Result<true, OpenPgpError>> {
	let invalid = (message: string) => failure(new OpenPgpError("invalid-signature", message));
	let hash = hashById(signature.hash);
	if (hash === undefined) {
		return failure(
			new OpenPgpError(
				"unsupported",
				`Hash algorithm ${signature.hash} is not accepted for signatures.`,
			),
		);
	}
	if (signature.version !== key.version)
		return invalid("The signature version does not match its key's.");
	if (signature.algorithm !== key.algorithm)
		return invalid("The signature algorithm does not match its key's.");
	if (signature.version === 6 && signature.salt.length !== hash.saltSize)
		return invalid("The salt size does not match the hash.");
	if (createdAt(signature) === undefined)
		return invalid("The signature has no hashed creation time.");
	if (hasUnknownCritical(signature))
		return invalid("The signature has an unknown critical subpacket.");
	if (signature.algorithm === PUBLIC_KEY_ALGORITHM.ed25519 && hash.size < 32)
		return invalid("Ed25519 needs a 256-bit hash.");

	let input = concatBytes(
		signature.salt,
		data,
		signatureTrailer(signature.version, signature.hashedPrefix),
	);
	let digest = await digestOf(hash, input);
	if (!equalBytes(digest.slice(0, 2), signature.left16))
		return invalid("The signed hash does not match.");

	let verified = await verifyValues(key.material, hash, input, digest, signature.values);
	if (verified.status === "failure") return verified;
	return verified.data ? success(true) : invalid("The signature does not verify with the key.");
}
