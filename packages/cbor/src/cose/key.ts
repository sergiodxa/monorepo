/**
 * COSE keys (RFC 9052 Section 7): conversion to and from the JWK form WebCrypto imports,
 * import into a `CryptoKey` bound to one signature algorithm, and the RFC 9679 thumbprint
 * that names a key by its own material.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Base64Url } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import type { CBORValue } from "../values.js";

import { encode } from "../encode.js";

import { ED25519, EDDSA, ES256, ES384, ES512, PS256, PS384, PS512 } from "./algorithm.js";
import { COSEError, describeValue } from "./errors.js";

/** A decoded COSE key: a map from integer or text labels to values. */
export type Key = Map<CBORValue, CBORValue>;

/** COSE key common parameter labels. */
const KTY = 1;
const KID = 2;
const ALG = 3;

/** COSE key types, by the value the `kty` label carries. */
const OKP = 1;
const EC2 = 2;
const RSA = 3;

/** Type-specific labels: EC2 and OKP share `crv`, `x` and `d`; RSA reuses the same numbers. */
const CRV = -1;
const X = -2;
const Y = -3;
const D = -4;

/** RSA parameter labels, in the order RFC 9053 Section 7.1 numbers them. */
const RSA_LABELS = [
	["n", -1],
	["e", -2],
	["d", -3],
	["p", -4],
	["q", -5],
	["dp", -6],
	["dq", -7],
	["qi", -8],
] as const;

/** COSE elliptic curve identifiers and their JWK names. */
const CURVES = new Map<number, string>([
	[1, "P-256"],
	[2, "P-384"],
	[3, "P-521"],
	[6, "Ed25519"],
]);

/** How WebCrypto imports, signs and verifies under one COSE algorithm. */
export interface Profile {
	/** Key type the algorithm runs on. */
	kty: number;
	/** Curve the algorithm requires, for the elliptic-curve algorithms. */
	crv?: number;
	/** Parameters `crypto.subtle.importKey` takes. */
	importParams: AlgorithmIdentifier | EcKeyImportParams | RsaHashedImportParams;
	/** Parameters `crypto.subtle.sign` and `verify` take. */
	signParams: AlgorithmIdentifier | EcdsaParams | RsaPssParams;
}

/**
 * The WebCrypto profile of a COSE algorithm. Each ECDSA algorithm is bound to the curve RFC
 * 9053 pairs it with, so a P-256 key never verifies an ES384 signature.
 *
 * @returns The profile, or `undefined` for an algorithm this module does not run.
 */
export function profile(algorithm: unknown): Profile | undefined {
	switch (algorithm) {
		case ES256:
			return ecdsa(1, "P-256", "SHA-256");
		case ES384:
			return ecdsa(2, "P-384", "SHA-384");
		case ES512:
			return ecdsa(3, "P-521", "SHA-512");
		case EDDSA:
		case ED25519:
			return {
				kty: OKP,
				crv: 6,
				importParams: { name: "Ed25519" },
				signParams: { name: "Ed25519" },
			};
		case PS256:
			return pss("SHA-256", 32);
		case PS384:
			return pss("SHA-384", 48);
		case PS512:
			return pss("SHA-512", 64);
		default:
			return undefined;
	}
}

/** An ECDSA profile over one curve and hash. */
function ecdsa(crv: number, namedCurve: string, hash: string): Profile {
	return {
		kty: EC2,
		crv,
		importParams: { name: "ECDSA", namedCurve },
		signParams: { name: "ECDSA", hash },
	};
}

/** An RSASSA-PSS profile whose salt is as long as its hash output. */
function pss(hash: string, saltLength: number): Profile {
	return {
		kty: RSA,
		importParams: { name: "RSA-PSS", hash },
		signParams: { name: "RSA-PSS", saltLength },
	};
}

/**
 * Whether `key` was imported for `algorithm`'s profile: same WebCrypto algorithm, and the
 * same curve or hash, so a signature is only ever checked under the algorithm it names.
 */
export function keyFits(key: CryptoKey, algorithm: number): boolean {
	let expected = profile(algorithm);
	if (!expected) return false;
	let actual = key.algorithm as KeyAlgorithm & { namedCurve?: string; hash?: { name: string } };
	let wanted = expected.importParams as { name: string; namedCurve?: string; hash?: string };
	if (actual.name !== wanted.name) return false;
	if (wanted.namedCurve !== undefined && actual.namedCurve !== wanted.namedCurve) return false;
	if (wanted.hash !== undefined && actual.hash?.name !== wanted.hash) return false;
	return true;
}

/**
 * A COSE key as a JWK, ready for `crypto.subtle.importKey`. The private component is carried
 * across when present; `kid`, `alg` and other common parameters are left to the caller.
 *
 * @returns The JWK, or `malformed` / `unsupported-key` for a map that is not an EC2 key on
 * P-256, P-384 or P-521, an Ed25519 OKP key, or an RSA key.
 * @example
 * let jwk = COSE.toJWK(key); // success({ kty: "EC", crv: "P-256", x: "…", y: "…" })
 */
export function toJWK(key: Key): Result<JsonWebKey, COSEError> {
	let kty = key.get(KTY);

	if (kty === EC2 || kty === OKP) {
		let crv = CURVES.get(key.get(CRV) as number);
		if (!crv || (kty === OKP) !== (crv === "Ed25519")) {
			return failure(new COSEError("unsupported-key", "unsupported COSE key curve"));
		}
		let jwk: JsonWebKey = { kty: kty === EC2 ? "EC" : "OKP", crv };
		let labels: [string, number][] =
			kty === EC2
				? [
						["x", X],
						["y", Y],
					]
				: [["x", X]];
		for (let [name, label] of labels) {
			let value = key.get(label);
			if (!(value instanceof Uint8Array)) {
				return failure(new COSEError("malformed", `COSE key has no ${name} coordinate`));
			}
			jwk[name as "x"] = Base64Url.encode(value);
		}
		let d = key.get(D);
		if (d instanceof Uint8Array) jwk.d = Base64Url.encode(d);
		return success(jwk);
	}

	if (kty === RSA) {
		let jwk: JsonWebKey = { kty: "RSA" };
		for (let [name, label] of RSA_LABELS) {
			let value = key.get(label);
			if (value instanceof Uint8Array) jwk[name] = Base64Url.encode(value);
		}
		if (!jwk.n || !jwk.e) return failure(new COSEError("malformed", "COSE RSA key has no n or e"));
		return success(jwk);
	}

	return failure(new COSEError("unsupported-key", "unsupported COSE key type"));
}

/**
 * A JWK as a COSE key, carrying the public and, when present, private members. A `kid`
 * becomes the UTF-8 bytes of the string, the byte string COSE requires.
 *
 * @returns The COSE key map, or `unsupported-key` for a key type or curve COSE cannot name.
 * @example
 * let key = COSE.fromJWK(await crypto.subtle.exportKey("jwk", publicKey));
 */
export function fromJWK(jwk: JsonWebKey & { kid?: string }): Result<Key, COSEError> {
	let key: Key = new Map();
	let bytes = (
		value: string | undefined,
		name: string,
	): Result<Uint8Array<ArrayBuffer>, COSEError> => {
		if (value === undefined) return failure(new COSEError("malformed", `JWK has no ${name}`));
		let decoded = Base64Url.decode(value);
		if (isFailure(decoded))
			return failure(new COSEError("malformed", `JWK ${name} is not base64url`));
		return decoded;
	};

	if (jwk.kty === "EC" || jwk.kty === "OKP") {
		let crv = [...CURVES].find(([, name]) => name === jwk.crv)?.[0];
		if (crv === undefined || (jwk.kty === "OKP") !== (jwk.crv === "Ed25519")) {
			return failure(new COSEError("unsupported-key", `unsupported JWK curve ${jwk.crv}`));
		}
		key.set(KTY, jwk.kty === "EC" ? EC2 : OKP);
		key.set(CRV, crv);
		let names: [keyof JsonWebKey, number][] =
			jwk.kty === "EC"
				? [
						["x", X],
						["y", Y],
					]
				: [["x", X]];
		if (jwk.d !== undefined) names.push(["d", D]);
		for (let [name, label] of names) {
			let value = bytes(jwk[name] as string | undefined, name);
			if (isFailure(value)) return value;
			key.set(label, value.data);
		}
	} else if (jwk.kty === "RSA") {
		key.set(KTY, RSA);
		for (let [name, label] of RSA_LABELS) {
			if (jwk[name] === undefined && name !== "n" && name !== "e") continue;
			let value = bytes(jwk[name], name);
			if (isFailure(value)) return value;
			key.set(label, value.data);
		}
	} else {
		return failure(new COSEError("unsupported-key", `unsupported JWK key type ${jwk.kty}`));
	}

	if (jwk.kid !== undefined) key.set(KID, new TextEncoder().encode(jwk.kid));
	return success(key);
}

/**
 * Imports a COSE key for one signature algorithm: the key's own `alg` (label 3) when it has
 * one, otherwise `algorithm`, otherwise the one its curve implies (ES256, ES384, ES512 or
 * Ed25519). A key holding `d` imports for signing, any other for verifying.
 *
 * @param key The COSE key.
 * @param algorithm Algorithm to import for when the key names none.
 * @returns The key, or `unsupported-algorithm`, `unsupported-key` or `malformed`.
 * @example
 * let key = await COSE.importKey(serviceKey, COSE.Algorithm.ES256);
 */
export async function importKey(
	key: Key,
	algorithm?: number,
): Promise<Result<CryptoKey, COSEError>> {
	let named = key.get(ALG);
	if (named !== undefined && algorithm !== undefined && named !== algorithm) {
		return failure(
			new COSEError("unsupported-key", `COSE key is for algorithm ${describeValue(named)}`),
		);
	}
	let alg = named ?? algorithm ?? impliedAlgorithm(key);
	let target = profile(alg);
	if (!target)
		return failure(
			new COSEError("unsupported-algorithm", `unsupported algorithm ${describeValue(alg)}`),
		);
	if (key.get(KTY) !== target.kty || (target.crv !== undefined && key.get(CRV) !== target.crv)) {
		return failure(
			new COSEError("unsupported-key", `COSE key cannot run algorithm ${describeValue(alg)}`),
		);
	}

	let jwk = toJWK(key);
	if (isFailure(jwk)) return jwk;
	let isPrivate = jwk.data.d !== undefined;
	try {
		let imported = await crypto.subtle.importKey(
			"jwk",
			jwk.data,
			target.importParams,
			!isPrivate,
			isPrivate ? ["sign"] : ["verify"],
		);
		return success(imported);
	} catch {
		return failure(new COSEError("malformed", "COSE key could not be imported"));
	}
}

/** The algorithm a curve leaves no choice about; RSA keys always need one named. */
function impliedAlgorithm(key: Key): number | undefined {
	if (key.get(KTY) === OKP && key.get(CRV) === 6) return ED25519;
	if (key.get(KTY) !== EC2) return undefined;
	return ({ 1: ES256, 2: ES384, 3: ES512 } as Record<number, number>)[key.get(CRV) as number];
}

/**
 * The RFC 9679 COSE Key Thumbprint: SHA-256 over the deterministic encoding of the key's
 * required public parameters, so a private key and its public half share one thumbprint.
 * SCRAPI recommends it as a Transparency Service's `kid`.
 *
 * @returns The 32-byte thumbprint, or `unsupported-key` / `malformed`.
 * @example
 * let kid = await COSE.thumbprint(key); // success(Uint8Array(32))
 */
export async function thumbprint(key: Key): Promise<Result<Uint8Array<ArrayBuffer>, COSEError>> {
	let kty = key.get(KTY);
	let labels = (
		{ [OKP]: [CRV, X], [EC2]: [CRV, X, Y], [RSA]: [-1, -2] } as Record<number, number[]>
	)[kty as number];
	if (!labels) return failure(new COSEError("unsupported-key", "unsupported COSE key type"));

	let required: Key = new Map([[KTY, kty as number]]);
	for (let label of labels) {
		let value = key.get(label);
		if (value === undefined)
			return failure(new COSEError("malformed", `COSE key has no label ${label}`));
		required.set(label, value);
	}
	let bytes = encode(required);
	if (isFailure(bytes)) return failure(new COSEError("malformed", bytes.error.message));
	return success(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.data)));
}
