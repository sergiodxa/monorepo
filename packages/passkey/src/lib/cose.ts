/**
 * Turns the COSE key an authenticator stores into a WebCrypto key that can
 * check assertion signatures.
 *
 * A credential's public key travels as a CBOR map of COSE labels and stays in
 * that form in the database, so every verification starts by translating it
 * into the JWK shape WebCrypto imports.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Base64Url } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import { MalformedResponseError, UnsupportedAlgorithmError } from "../errors.js";

import type { CborValue } from "./cbor.js";

import { decode } from "./cbor.js";
import { toRawSignature } from "./der.js";

/** COSE algorithm identifier for ECDSA over P-256 with SHA-256. */
export const ES256 = -7;

/** COSE algorithm identifier for EdDSA, which for passkeys is always Ed25519. */
export const EDDSA = -8;

/** COSE algorithm identifier for RSASSA-PKCS1-v1_5 with SHA-256. */
export const RS256 = -257;

/** Algorithms a relying party advertises when the caller states no preference. */
export const DEFAULT_ALGORITHMS: number[] = [ES256, RS256, EDDSA];

/** Bytes each half of a P-256 signature occupies. */
const P256_COORDINATE_BYTES = 32;

/** COSE key map labels this module reads. */
const LABEL = { kty: 1, alg: 3, crv: -1, x: -2, y: -3, n: -1, e: -2 };

/** COSE key types, by the value the `kty` label carries. */
const KEY_TYPE = { okp: 1, ec2: 2, rsa: 3 };

/** COSE curve identifier for Ed25519, the only curve EdDSA credentials use. */
const ED25519_CURVE = 6;

/**
 * Reads a byte string out of a COSE key map.
 *
 * @param key Decoded COSE key map.
 * @param label Label whose value to read.
 * @returns The bytes, base64url encoded for a JWK field.
 */
function coordinate(key: Map<CborValue, CborValue>, label: number): string {
	let value = key.get(label);
	if (!(value instanceof Uint8Array)) throw new RangeError("missing COSE coordinate");
	return Base64Url.encode(value);
}

/**
 * Builds the JWK and import parameters for one COSE key.
 *
 * @param key Decoded COSE key map.
 * @param algorithm Algorithm the key's `alg` label names.
 * @returns The JWK and the algorithm WebCrypto imports it under.
 */
function toJsonWebKey(
	key: Map<CborValue, CborValue>,
	algorithm: number,
): [JsonWebKey, AlgorithmIdentifier | EcKeyImportParams | RsaHashedImportParams] {
	let type = key.get(LABEL.kty);

	if (algorithm === ES256 && type === KEY_TYPE.ec2) {
		return [
			{ kty: "EC", crv: "P-256", x: coordinate(key, LABEL.x), y: coordinate(key, LABEL.y) },
			{ name: "ECDSA", namedCurve: "P-256" },
		];
	}

	if (algorithm === RS256 && type === KEY_TYPE.rsa) {
		return [
			{ kty: "RSA", n: coordinate(key, LABEL.n), e: coordinate(key, LABEL.e) },
			{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		];
	}

	if (algorithm === EDDSA && type === KEY_TYPE.okp && key.get(LABEL.crv) === ED25519_CURVE) {
		return [{ kty: "OKP", crv: "Ed25519", x: coordinate(key, LABEL.x) }, { name: "Ed25519" }];
	}

	throw new RangeError("unsupported COSE key");
}

/**
 * A credential's public key, ready to check the signatures it produces.
 *
 * Instances are cheap to discard and expensive to build — importing runs
 * WebCrypto — so verification imports once per assertion rather than caching.
 */
export class CredentialKey {
	/**
	 * @param algorithm COSE algorithm identifier the credential signs with.
	 * @param key Imported verification key.
	 * @param parameters Algorithm parameters `crypto.subtle.verify` takes.
	 */
	private constructor(
		readonly algorithm: number,
		private key: CryptoKey,
		private parameters: AlgorithmIdentifier | EcdsaParams,
	) {}

	/**
	 * Imports the COSE key bytes an authenticator produced.
	 *
	 * @param bytes Credential public key, as CBOR.
	 * @returns The key, or a typed failure when the bytes or the algorithm are unusable.
	 * @example
	 * let key = await CredentialKey.import(passkey.publicKey);
	 */
	static async import(
		bytes: Bytes,
	): Promise<Result<CredentialKey, MalformedResponseError | UnsupportedAlgorithmError>> {
		let decoded = decode(bytes);
		if (isFailure(decoded)) return decoded;

		let key = decoded.data;
		if (!(key instanceof Map)) return failure(new MalformedResponseError("COSE key is not a map"));

		let algorithm = key.get(LABEL.alg);
		if (typeof algorithm !== "number") {
			return failure(new MalformedResponseError("COSE key names no algorithm"));
		}

		let jwk: JsonWebKey;
		let parameters: AlgorithmIdentifier | EcKeyImportParams | RsaHashedImportParams;
		try {
			[jwk, parameters] = toJsonWebKey(key, algorithm);
		} catch {
			return failure(new UnsupportedAlgorithmError(algorithm));
		}

		try {
			let imported = await crypto.subtle.importKey("jwk", jwk, parameters, false, ["verify"]);
			let verifyParameters =
				algorithm === ES256
					? { name: "ECDSA", hash: "SHA-256" }
					: (parameters as AlgorithmIdentifier);
			return success(new CredentialKey(algorithm, imported, verifyParameters));
		} catch {
			return failure(new MalformedResponseError("COSE key could not be imported"));
		}
	}

	/**
	 * Checks a signature the credential produced over `data`.
	 *
	 * An ECDSA signature arrives DER encoded and is rewritten to the raw halves
	 * first, so callers pass the signature exactly as the authenticator sent it.
	 *
	 * @param signature Signature bytes from the assertion.
	 * @param data Bytes the authenticator signed.
	 * @returns Whether the signature verifies under this key.
	 */
	async verify(signature: Bytes, data: Bytes): Promise<boolean> {
		let bytes: Bytes = signature;

		if (this.algorithm === ES256) {
			let raw = toRawSignature(signature, P256_COORDINATE_BYTES);
			if (isFailure(raw)) return false;
			bytes = raw.data;
		}

		try {
			return await crypto.subtle.verify(this.parameters, this.key, bytes, data);
		} catch {
			return false;
		}
	}
}
