/**
 * Verification of token type `0x0002`, Blind RSA (2048-bit): RFC 9578 §6.4 checks the
 * authenticator as an RSASSA-PSS signature with SHA-384 and a 48-byte salt, which Web
 * Crypto verifies once the issuer's RSASSA-PSS key is rewritten as a JWK.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Base64Url, Hex, sha256 } from "@sdxc/crypto";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { Token } from "./token.js";

import { PrivacyPassError } from "./errors.js";
import { BLIND_RSA_TOKEN_TYPE, tokenAuthenticatorInput } from "./token.js";

/** The DER encoding of `id-RSASSA-PSS` (1.2.840.113549.1.1.10), the only algorithm a key may name. */
const RSASSA_PSS_OID = "06092a864886f70d01010a";

/** The salt length RFC 9578 §6.4 fixes: the SHA-384 output size. */
const SALT_LENGTH = 48;

/** The modulus size token type `0x0002` is defined for. */
const MODULUS_BITS = 2048;

/** The DER tag of the key, its algorithm and the RSAPublicKey inside it. */
const SEQUENCE = 0x30;

/** The DER tag wrapping the RSAPublicKey. */
const BIT_STRING = 0x03;

/** The DER tag of the modulus and the exponent. */
const INTEGER = 0x02;

/** An issuer public key ready to verify tokens. */
export interface IssuerKey {
	tokenType: typeof BLIND_RSA_TOKEN_TYPE;
	/** The key as the issuer encodes it: the `token-key` a challenge carries. */
	tokenKey: Bytes;
	/** `SHA-256(tokenKey)`, which a token names its signer by. */
	tokenKeyId: Bytes;
	/** When the issuer starts signing with the key, or `null` when it already does. */
	notBefore: Date | null;
	/** The key imported for RSA-PSS verification with SHA-384. */
	cryptoKey: CryptoKey;
}

/**
 * Imports a Blind RSA issuer key from its `token-key` encoding: a DER SubjectPublicKeyInfo
 * naming `id-RSASSA-PSS`, as an issuer directory and a challenge carry it.
 *
 * @param tokenKey - The encoded key
 * @param notBefore - When the issuer starts using it, from its directory entry
 * @returns The key, or `invalid-key` for another algorithm, size or a malformed encoding
 * @example await importTokenKey(Base64Url.decode(entry["token-key"]).data)
 */
export async function importTokenKey(
	tokenKey: Uint8Array,
	notBefore: Date | null = null,
): Promise<Result<IssuerKey, PrivacyPassError>> {
	let jwk = readRsaPublicKey(tokenKey);
	if (jwk === null) return invalidKey("The token key is not a 2048-bit RSASSA-PSS public key");

	let cryptoKey = await wrap(() =>
		crypto.subtle.importKey("jwk", jwk, { name: "RSA-PSS", hash: "SHA-384" }, false, ["verify"]),
	);
	if (isFailure(cryptoKey)) return invalidKey("The runtime refused the token key", cryptoKey.error);

	let tokenKeyId = await sha256(tokenKey);
	if (isFailure(tokenKeyId))
		return invalidKey("The token key could not be hashed", tokenKeyId.error);

	return success({
		tokenType: BLIND_RSA_TOKEN_TYPE,
		tokenKey: new Uint8Array(tokenKey),
		tokenKeyId: tokenKeyId.data,
		notBefore,
		cryptoKey: cryptoKey.data,
	});
}

/**
 * Checks a token's authenticator against the key it names. The caller still matches the
 * token's challenge digest and nonce; a valid signature proves only that the issuer signed it.
 *
 * @param token - A decoded token of type `0x0002`
 * @param key - The issuer key whose id the token carries
 * @returns `true`, or `unknown-key` when the token names another key and `invalid-signature`
 * when the issuer did not sign it
 */
export async function verifyToken(
	token: Token,
	key: IssuerKey,
): Promise<Result<true, PrivacyPassError>> {
	if (token.tokenType !== BLIND_RSA_TOKEN_TYPE) {
		return failure(
			new PrivacyPassError(
				"unsupported-token-type",
				`Token type ${token.tokenType} is not verified with a public key`,
			),
		);
	}
	if (Hex.encode(token.tokenKeyId) !== Hex.encode(key.tokenKeyId)) {
		return failure(new PrivacyPassError("unknown-key", "The token names another issuer key"));
	}

	let valid = await wrap(() =>
		crypto.subtle.verify(
			{ name: "RSA-PSS", saltLength: SALT_LENGTH },
			key.cryptoKey,
			token.authenticator,
			tokenAuthenticatorInput(token),
		),
	);
	if (isFailure(valid) || !valid.data) {
		return failure(new PrivacyPassError("invalid-signature", "The issuer did not sign this token"));
	}
	return success(true);
}

/**
 * Reads the modulus and exponent out of an `id-RSASSA-PSS` SubjectPublicKeyInfo. Web Crypto
 * imports SPKI only under `rsaEncryption`, so the key travels to it as a JWK instead.
 *
 * @param spki - The DER key
 * @returns The JWK, or `null` for any other structure, algorithm or modulus size
 */
function readRsaPublicKey(spki: Uint8Array): JsonWebKey | null {
	let outer = readElement(spki, 0);
	if (outer === null || outer.tag !== SEQUENCE || outer.end !== spki.length) return null;

	let algorithm = readElement(spki, outer.start);
	if (algorithm === null || algorithm.tag !== SEQUENCE) return null;
	let oid = readElement(spki, algorithm.start);
	if (oid === null || Hex.encode(spki.subarray(algorithm.start, oid.end)) !== RSASSA_PSS_OID) {
		return null;
	}

	let bitString = readElement(spki, algorithm.end);
	if (bitString === null || bitString.tag !== BIT_STRING || bitString.end !== outer.end) {
		return null;
	}
	if (spki[bitString.start] !== 0) return null;

	let rsaKey = readElement(spki, bitString.start + 1);
	if (rsaKey === null || rsaKey.tag !== SEQUENCE || rsaKey.end !== bitString.end) return null;
	let modulus = readElement(spki, rsaKey.start);
	if (modulus === null || modulus.tag !== INTEGER) return null;
	let exponent = readElement(spki, modulus.end);
	if (exponent === null || exponent.tag !== INTEGER || exponent.end !== rsaKey.end) return null;

	let n = unsigned(spki.subarray(modulus.start, modulus.end));
	let e = unsigned(spki.subarray(exponent.start, exponent.end));
	if (n.length * 8 !== MODULUS_BITS || n[0]! < 0x80) return null;
	return { kty: "RSA", n: Base64Url.encode(n), e: Base64Url.encode(e), alg: "PS384", ext: true };
}

/**
 * Reads one DER element's header.
 *
 * @param bytes - The encoding
 * @param offset - Where the element starts
 * @returns The tag and where its contents start and end, or `null` when it overruns `bytes`
 */
function readElement(
	bytes: Uint8Array,
	offset: number,
): { tag: number; start: number; end: number } | null {
	let tag = bytes[offset];
	let first = bytes[offset + 1];
	if (tag === undefined || first === undefined) return null;

	let start = offset + 2;
	let length = first;
	if (first & 0x80) {
		let octets = first & 0x7f;
		if (octets === 0 || octets > 2) return null;
		length = 0;
		for (let index = 0; index < octets; index++) {
			let octet = bytes[start + index];
			if (octet === undefined) return null;
			length = (length << 8) | octet;
		}
		start += octets;
	}
	let end = start + length;
	return end > bytes.length ? null : { tag, start, end };
}

/**
 * Drops the sign byte DER prefixes to a positive integer whose top bit is set.
 *
 * @param integer - The INTEGER contents
 * @returns The big-endian magnitude
 */
function unsigned(integer: Uint8Array): Uint8Array {
	return integer[0] === 0 && integer.length > 1 ? integer.subarray(1) : integer;
}

/**
 * The failure for a key this package cannot verify with.
 *
 * @param message - What was wrong
 * @param cause - The underlying failure
 * @returns The failure
 */
function invalidKey(message: string, cause?: Error): Result<never, PrivacyPassError> {
	return failure(
		new PrivacyPassError("invalid-key", message, cause === undefined ? undefined : { cause }),
	);
}
