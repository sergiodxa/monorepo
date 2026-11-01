/**
 * Imports a signing or verification key from the forms keys are stored in, PEM (PKCS#8 or
 * SPKI) and JWK, choosing the HTTP signature algorithm from the key itself, so a key read
 * from a file or a secret reaches `sign` and `verify` without hand-written Web Crypto calls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Pem } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import type { Algorithm } from "./types.js";

import { HttpSignatureError } from "./errors.js";
import { IMPORT_PARAMS, isAlgorithm } from "./lib/algorithms.js";

/** How `importSignatureKey` reads a key. */
export interface ImportKeyOptions {
	/** `sign` reads a private key (PKCS#8 PEM or a private JWK); `verify` a public one. */
	usage: "sign" | "verify";
	/**
	 * The algorithm to import for. Left out, the key's type decides, and an RSA key without a
	 * JWK `alg` imports for `rsa-v1_5-sha256`, the algorithm draft-cavage `rsa-sha256` and
	 * ActivityPub keys use.
	 */
	algorithm?: Algorithm;
}

/** JOSE `alg` names an RSA JWK may carry, read as the HTTP signature algorithm they mean. */
const RSA_JOSE_ALGORITHMS: Record<string, Algorithm> = {
	RS256: "rsa-v1_5-sha256",
	PS512: "rsa-pss-sha512",
};

/** The algorithms a PEM key is tried under when none is given, RSA last. */
const PEM_CANDIDATES: readonly Algorithm[] = ["ed25519", "ecdsa-p256-sha256", "rsa-v1_5-sha256"];

/** JWK members Web Crypto checks against its own names or refuses, dropped before import. */
const JOSE_MEMBERS = ["alg", "use", "key_ops", "kid", "ext", "nbf", "exp"] as const;

/** Members that carry private key material, dropped to verify with a private JWK's public half. */
const PRIVATE_MEMBERS = ["d", "p", "q", "dp", "dq", "qi", "oth"] as const;

/**
 * Imports a key for signing or verifying HTTP message signatures. The private key is
 * imported non-extractable.
 *
 * @param key - PEM text (`PRIVATE KEY` to sign, `PUBLIC KEY` to verify), JWK JSON text or a JWK.
 * @param options - The usage, and the algorithm when the key's type leaves it open.
 * @returns The key, `malformed` for text that is neither PEM nor a JWK, or
 *   `unsupported-algorithm` for a key that fits no algorithm (or not the one given).
 * @example let privateKey = unwrap(await importSignatureKey(pem, { usage: "sign" }));
 */
export async function importSignatureKey(
	key: string | JsonWebKey,
	options: ImportKeyOptions,
): Promise<Result<CryptoKey, HttpSignatureError>> {
	if (typeof key !== "string") return importJwk(key, options);
	let text = key.trim();
	if (!text.startsWith("{")) return importPem(text, options);
	try {
		return importJwk(JSON.parse(text) as JsonWebKey, options);
	} catch (error) {
		return failure(
			new HttpSignatureError("malformed", "The key is not valid JSON", { cause: error }),
		);
	}
}

/**
 * Imports PKCS#8 or SPKI PEM text, trying each candidate algorithm until one accepts it.
 *
 * @param text - The PEM text.
 * @param options - The usage and the algorithm, if given.
 */
async function importPem(
	text: string,
	options: ImportKeyOptions,
): Promise<Result<CryptoKey, HttpSignatureError>> {
	let label = options.usage === "sign" ? "PRIVATE KEY" : "PUBLIC KEY";
	let der = Pem.decode(text, label);
	if (isFailure(der)) {
		return failure(
			new HttpSignatureError("malformed", `The key is not a JWK or a PEM ${label}`, {
				cause: der.error,
			}),
		);
	}

	let format: "pkcs8" | "spki" = options.usage === "sign" ? "pkcs8" : "spki";
	for (let algorithm of options.algorithm ? [options.algorithm] : PEM_CANDIDATES) {
		try {
			return success(
				await crypto.subtle.importKey(format, der.data, IMPORT_PARAMS[algorithm], false, [
					options.usage,
				]),
			);
		} catch {
			continue;
		}
	}
	return failure(unsupported(options.algorithm));
}

/**
 * Imports a JWK for the algorithm its type, curve or `alg` names.
 *
 * @param jwk - The key.
 * @param options - The usage and the algorithm, if given.
 */
async function importJwk(
	jwk: JsonWebKey,
	options: ImportKeyOptions,
): Promise<Result<CryptoKey, HttpSignatureError>> {
	let algorithm = options.algorithm ?? algorithmOfJwk(jwk);
	if (algorithm === null) return failure(unsupported());
	if (options.usage === "sign" && jwk.d === undefined) {
		return failure(new HttpSignatureError("unsupported-algorithm", "The JWK has no private key"));
	}

	let material: Record<string, unknown> = { ...jwk };
	for (let member of JOSE_MEMBERS) delete material[member];
	if (options.usage === "verify") for (let member of PRIVATE_MEMBERS) delete material[member];

	try {
		return success(
			await crypto.subtle.importKey(
				"jwk",
				material as JsonWebKey,
				IMPORT_PARAMS[algorithm],
				false,
				[options.usage],
			),
		);
	} catch (error) {
		return failure(
			new HttpSignatureError("unsupported-algorithm", `Cannot import the key for ${algorithm}`, {
				cause: error,
			}),
		);
	}
}

/**
 * The algorithm a JWK's type and curve decide; an RSA key reads its `alg`.
 *
 * @param jwk - The key.
 * @returns The algorithm, or `null` for a key type none of them uses.
 */
function algorithmOfJwk(jwk: JsonWebKey): Algorithm | null {
	if (jwk.kty === "OKP" && jwk.crv === "Ed25519") return "ed25519";
	if (jwk.kty === "EC" && jwk.crv === "P-256") return "ecdsa-p256-sha256";
	if (jwk.kty !== "RSA") return null;
	if (jwk.alg === undefined) return "rsa-v1_5-sha256";
	if (isAlgorithm(jwk.alg)) return jwk.alg.startsWith("rsa-") ? jwk.alg : null;
	return RSA_JOSE_ALGORITHMS[jwk.alg] ?? null;
}

/**
 * The failure for a key no supported algorithm imports.
 *
 * @param algorithm - The algorithm asked for, if any.
 */
function unsupported(algorithm?: Algorithm): HttpSignatureError {
	let message = algorithm
		? `The key cannot be imported for ${algorithm}`
		: "The key fits no supported algorithm";
	return new HttpSignatureError("unsupported-algorithm", message);
}
