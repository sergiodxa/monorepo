/**
 * Maps the RFC 9421 algorithm names onto Web Crypto, the one place that decides which key
 * may serve which algorithm, so signing and verifying under both schemes agree on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Algorithm } from "../types.js";

import { HttpSignatureError } from "../errors.js";

/** The Web Crypto parameters each algorithm signs and verifies with. */
const SIGN_PARAMS: Record<Algorithm, AlgorithmIdentifier | RsaPssParams | EcdsaParams> = {
	"rsa-v1_5-sha256": { name: "RSASSA-PKCS1-v1_5" },
	"rsa-pss-sha512": { name: "RSA-PSS", saltLength: 64 },
	"ecdsa-p256-sha256": { name: "ECDSA", hash: "SHA-256" },
	ed25519: { name: "Ed25519" },
};

/** The RFC 9421 algorithm names, for narrowing a declared `alg`. */
const ALGORITHMS = Object.keys(SIGN_PARAMS) as Algorithm[];

/**
 * Whether a declared name is one of the RFC 9421 algorithms this package handles.
 *
 * @param name - An `alg` parameter or option.
 */
export function isAlgorithm(name: string): name is Algorithm {
	return (ALGORITHMS as string[]).includes(name);
}

/**
 * The algorithm a key was imported for, which is how a signature without `alg` (and every
 * cavage `hs2019` signature) is verified.
 *
 * @param key - A key imported or generated through Web Crypto.
 * @returns The algorithm, or `null` for a key none of them uses.
 */
export function algorithmOfKey(key: CryptoKey): Algorithm | null {
	let { name } = key.algorithm;
	let hash = "hash" in key.algorithm ? (key.algorithm as RsaHashedKeyAlgorithm).hash.name : null;
	let curve = "namedCurve" in key.algorithm ? (key.algorithm as EcKeyAlgorithm).namedCurve : null;

	if (name === "RSASSA-PKCS1-v1_5" && hash === "SHA-256") return "rsa-v1_5-sha256";
	if (name === "RSA-PSS" && hash === "SHA-512") return "rsa-pss-sha512";
	if (name === "ECDSA" && curve === "P-256") return "ecdsa-p256-sha256";
	if (name === "Ed25519") return "ed25519";
	return null;
}

/**
 * Signs data, after checking the key was imported for the algorithm.
 *
 * @param algorithm - The algorithm to sign with.
 * @param key - A private key.
 * @param data - The signature base or signing string.
 * @returns The signature, `unsupported-algorithm` for a key of another algorithm, or `crypto`.
 */
export async function signWith(
	algorithm: Algorithm,
	key: CryptoKey,
	data: Bytes,
): Promise<Result<Bytes, HttpSignatureError>> {
	if (algorithmOfKey(key) !== algorithm) return failure(mismatchedKey(algorithm));
	try {
		return success(new Uint8Array(await crypto.subtle.sign(SIGN_PARAMS[algorithm], key, data)));
	} catch (error) {
		return failure(new HttpSignatureError("crypto", "Signing failed", { cause: error }));
	}
}

/**
 * Verifies a signature, after checking the key was imported for the algorithm. A runtime
 * refusal (a key without the `verify` usage, say) reads as an invalid signature.
 *
 * @param algorithm - The algorithm to verify with.
 * @param key - A public key.
 * @param signature - The decoded signature.
 * @param data - The signature base or signing string.
 * @returns Success when it verifies, else `unsupported-algorithm` or `invalid-signature`.
 */
export async function verifyWith(
	algorithm: Algorithm,
	key: CryptoKey,
	signature: Uint8Array,
	data: Bytes,
): Promise<Result<void, HttpSignatureError>> {
	if (algorithmOfKey(key) !== algorithm) return failure(mismatchedKey(algorithm));

	let valid = false;
	try {
		valid = await crypto.subtle.verify(SIGN_PARAMS[algorithm], key, toBuffer(signature), data);
	} catch {
		valid = false;
	}
	if (!valid) {
		return failure(new HttpSignatureError("invalid-signature", "The signature does not verify"));
	}
	return success(undefined);
}

/**
 * Copies bytes into a view over a plain `ArrayBuffer`, which Web Crypto requires.
 *
 * @param bytes - Bytes of any backing buffer.
 */
function toBuffer(bytes: Uint8Array): Bytes {
	return bytes.buffer instanceof ArrayBuffer ? (bytes as Bytes) : new Uint8Array(bytes);
}

/**
 * The failure for a key that was imported for another algorithm.
 *
 * @param algorithm - The algorithm the signature needs.
 */
function mismatchedKey(algorithm: Algorithm): HttpSignatureError {
	return new HttpSignatureError(
		"unsupported-algorithm",
		`The key was not imported for ${algorithm}`,
	);
}
