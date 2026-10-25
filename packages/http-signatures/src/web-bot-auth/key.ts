/**
 * Web Bot Auth keys: a private JWK imported once into the signing key, its public half
 * and the RFC 7638 thumbprint both the signature and the directory name it by, and a
 * directory entry imported into the key a signature verifies against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { DirectoryKey } from "@sdxc/well-known/http-message-signatures-directory";

import { JWK } from "@sdxc/jwt";
import { failure, isFailure, success } from "@sdxc/result";

import type { Algorithm } from "../types.js";

import { HttpSignatureError } from "../errors.js";
import { isAlgorithm } from "../lib/algorithms.js";

/** A signing key ready for `signWebBotAuth` and `signDirectoryResponse`. */
export interface WebBotAuthKey {
	/** The key's RFC 7638 thumbprint, written as `keyid` and published as `kid`. */
	keyid: string;
	/** Imported non-extractable, so the private half never leaves the runtime. */
	privateKey: CryptoKey;
	/** The public half with `kid` set and no JOSE `alg`, ready for the directory's `build`. */
	publicKey: DirectoryKey;
	algorithm: Algorithm;
}

/** Members that carry private key material, left out of the public half. */
const PRIVATE_MEMBERS = ["d", "p", "q", "dp", "dq", "qi", "oth", "k"] as const;

/** JOSE `alg` names an RSA key may carry, read as the HTTP signature algorithm they mean. */
const RSA_JOSE_ALGORITHMS: Record<string, Algorithm> = {
	RS256: "rsa-v1_5-sha256",
	PS512: "rsa-pss-sha512",
};

/**
 * The HTTP signature algorithm a JWK signs with: its key type and curve decide, and an RSA
 * key reads its `alg`, defaulting to `rsa-pss-sha512`.
 *
 * @param jwk - The key.
 * @param declared - An `alg` the signature declared, which wins for an RSA key.
 */
export function algorithmOfJwk(jwk: DirectoryKey, declared?: string): Algorithm | null {
	if (jwk.kty === "OKP" && jwk.crv === "Ed25519") return "ed25519";
	if (jwk.kty === "EC" && jwk.crv === "P-256") return "ecdsa-p256-sha256";
	if (jwk.kty !== "RSA") return null;

	for (let name of [declared, jwk.alg]) {
		if (name === undefined) continue;
		if (isAlgorithm(name)) return name.startsWith("rsa-") ? name : null;
		if (name in RSA_JOSE_ALGORITHMS) return RSA_JOSE_ALGORITHMS[name] ?? null;
	}
	return "rsa-pss-sha512";
}

/** The Web Crypto import parameters for each algorithm. */
const IMPORT_PARAMS: Record<
	Algorithm,
	AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams
> = {
	"rsa-v1_5-sha256": { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
	"rsa-pss-sha512": { name: "RSA-PSS", hash: "SHA-512" },
	"ecdsa-p256-sha256": { name: "ECDSA", namedCurve: "P-256" },
	ed25519: { name: "Ed25519" },
};

/**
 * Imports a JWK through Web Crypto for one algorithm. JOSE-only members (`alg`, `use`,
 * `key_ops`, `kid` and the directory's `nbf`/`exp`) are dropped first, since Web Crypto
 * checks `alg` against its own names and would refuse an HTTP signature algorithm name.
 *
 * @param jwk - The key.
 * @param algorithm - What it signs or verifies with.
 * @param usage - `sign` for a private key, `verify` for a public one.
 */
async function importJwk(
	jwk: DirectoryKey,
	algorithm: Algorithm,
	usage: "sign" | "verify",
): Promise<Result<CryptoKey, HttpSignatureError>> {
	let { alg: _alg, use: _use, key_ops: _ops, kid: _kid, nbf: _nbf, exp: _exp, ...material } = jwk;
	try {
		let key = await crypto.subtle.importKey(
			"jwk",
			material as JsonWebKey,
			IMPORT_PARAMS[algorithm],
			false,
			[usage],
		);
		return success(key);
	} catch (error) {
		return failure(
			new HttpSignatureError("unsupported-algorithm", `Cannot import the key for ${algorithm}`, {
				cause: error,
			}),
		);
	}
}

/**
 * Imports a private JWK, such as a Worker secret, as a Web Bot Auth signing key: the
 * private half for signing, and its public half labelled with the thumbprint.
 *
 * @param jwk - An Ed25519, ECDSA P-256 or RSA private JWK.
 * @returns The key, or `unsupported-algorithm` for a public, symmetric or unusable key.
 * @example let key = unwrap(await importWebBotAuthKey(JSON.parse(env.WEB_BOT_AUTH_KEY)));
 */
export async function importWebBotAuthKey(
	jwk: DirectoryKey,
): Promise<Result<WebBotAuthKey, HttpSignatureError>> {
	let algorithm = algorithmOfJwk(jwk);
	if (algorithm === null || jwk.d === undefined) {
		return failure(
			new HttpSignatureError("unsupported-algorithm", "The key is not a supported private key"),
		);
	}

	let privateKey = await importJwk(jwk, algorithm, "sign");
	if (isFailure(privateKey)) return privateKey;

	let publicKey: DirectoryKey = { ...jwk };
	for (let member of PRIVATE_MEMBERS) delete publicKey[member];
	delete publicKey.key_ops;
	delete publicKey.ext;
	delete publicKey.alg;
	delete publicKey.kid;

	let keyid = await JWK.thumbprint(publicKey);
	if (isFailure(keyid)) {
		return failure(
			new HttpSignatureError("unsupported-algorithm", keyid.error.message, { cause: keyid.error }),
		);
	}

	return success({
		keyid: keyid.data,
		privateKey: privateKey.data,
		publicKey: { ...publicKey, kid: keyid.data },
		algorithm,
	});
}

/**
 * Imports a directory entry as the public key a signature verifies against.
 *
 * @param jwk - The entry.
 * @param declared - The `alg` the signature declared, if any.
 * @returns The key, or `unsupported-algorithm`.
 */
export async function importVerificationKey(
	jwk: DirectoryKey,
	declared: string | undefined,
): Promise<Result<CryptoKey, HttpSignatureError>> {
	let algorithm = algorithmOfJwk(jwk, declared);
	if (algorithm === null) {
		return failure(new HttpSignatureError("unsupported-algorithm", "The key fits no algorithm"));
	}
	return await importJwk(jwk, algorithm, "verify");
}
