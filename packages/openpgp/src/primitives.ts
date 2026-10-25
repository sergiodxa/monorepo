/**
 * The Web Crypto side of OpenPGP signatures: imports key material into `CryptoKey`s and
 * converts between OpenPGP's signature fields and Web Crypto's raw signatures for
 * Ed25519, Ed25519Legacy, ECDSA on NIST curves and RSA PKCS#1 v1.5.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Base64Url, concatBytes } from "@sdxc/crypto";
import { failure, success } from "@sdxc/result";

import type { HashInfo } from "./algorithms.js";
import type { PublicMaterial } from "./key-packet.js";

import { OpenPgpError } from "./errors.js";
import { fromBigInt, padStart, Reader, toBigInt } from "./lib/bytes.js";

/** A signature's algorithm-specific fields and whether they are a native octet string. */
export interface SignatureValues {
	values: Bytes[];
	native: boolean;
}

/**
 * Base64url without padding, as JWK members are written.
 *
 * @param bytes - The octets to encode.
 */
function b64u(bytes: Uint8Array): string {
	return Base64Url.encode(bytes);
}

/**
 * `a mod m`, always non-negative.
 *
 * @param a - The dividend.
 * @param m - The modulus.
 */
function mod(a: bigint, m: bigint): bigint {
	return ((a % m) + m) % m;
}

/**
 * The modular inverse of `a` modulo `m`, by the extended Euclidean algorithm.
 *
 * @param a - The value to invert.
 * @param m - The modulus.
 */
function modInverse(a: bigint, m: bigint): bigint {
	let [oldR, r] = [mod(a, m), m];
	let [oldS, s] = [1n, 0n];
	while (r !== 0n) {
		let quotient = oldR / r;
		[oldR, r] = [r, oldR - quotient * r];
		[oldS, s] = [s, oldS - quotient * s];
	}
	return mod(oldS, m);
}

/**
 * Imports a public key for verifying with the given hash.
 *
 * @param material - The key's public material.
 * @param hash - The hash the signature uses, which RSA keys bind at import.
 */
async function importPublic(material: PublicMaterial, hash: HashInfo): Promise<CryptoKey | null> {
	if (material.kind === "ed25519" || material.kind === "ed25519-legacy") {
		return await crypto.subtle.importKey("raw", material.point, "Ed25519", false, ["verify"]);
	}
	if (material.kind === "ecdsa") {
		return await crypto.subtle.importKey(
			"raw",
			material.point,
			{ name: "ECDSA", namedCurve: material.curve },
			false,
			["verify"],
		);
	}
	if (material.kind === "rsa") {
		return await crypto.subtle.importKey(
			"jwk",
			{ kty: "RSA", n: b64u(material.n), e: b64u(material.e) },
			{ name: "RSASSA-PKCS1-v1_5", hash: hash.name },
			false,
			["verify"],
		);
	}
	return null;
}

/**
 * Whether the signature fields verify over the hashed data. EdDSA signs the digest
 * itself (RFC 9580 §12.7); ECDSA and RSA hand Web Crypto the hashed data to digest.
 *
 * @param material - The signer's public material.
 * @param hash - The signature's hash.
 * @param data - Everything hashed: salt, signed data and trailer.
 * @param digest - The hash of `data`.
 * @param values - The signature's algorithm-specific fields.
 */
export async function verifyValues(
	material: PublicMaterial,
	hash: HashInfo,
	data: Bytes,
	digest: Bytes,
	values: Bytes[],
): Promise<Result<boolean, OpenPgpError>> {
	let key = await importPublic(material, hash).catch(() => null);
	if (key === null)
		return failure(
			new OpenPgpError("unsupported", "The signing key's algorithm is not supported."),
		);

	let [first = new Uint8Array(0), second = new Uint8Array(0)] = values;
	let verified: Promise<boolean>;
	if (material.kind === "ed25519") verified = crypto.subtle.verify("Ed25519", key, first, digest);
	else if (material.kind === "ed25519-legacy") {
		verified = crypto.subtle.verify(
			"Ed25519",
			key,
			concatBytes(padStart(first, 32), padStart(second, 32)),
			digest,
		);
	} else if (material.kind === "ecdsa") {
		let signature = concatBytes(padStart(first, material.size), padStart(second, material.size));
		verified = crypto.subtle.verify({ name: "ECDSA", hash: hash.name }, key, signature, data);
	} else {
		let modulus = material.kind === "rsa" ? material.n.length : 0;
		verified = crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, padStart(first, modulus), data);
	}
	return success(await verified.catch(() => false));
}

/**
 * Imports a private key for signing.
 *
 * @param material - The key's public material.
 * @param secret - The plaintext secret octets (RFC 9580 §5.5.5).
 * @param hash - The hash to sign with, which RSA keys bind at import.
 */
async function importPrivate(
	material: PublicMaterial,
	secret: Bytes,
	hash: HashInfo,
): Promise<CryptoKey | null> {
	if (material.kind === "ed25519" || material.kind === "ed25519-legacy") {
		let seed = material.kind === "ed25519" ? secret : padStart(new Reader(secret).mpi(), 32);
		let jwk = { kty: "OKP", crv: "Ed25519", d: b64u(seed), x: b64u(material.point) };
		return await crypto.subtle.importKey("jwk", jwk, "Ed25519", false, ["sign"]);
	}
	if (material.kind === "ecdsa") {
		let d = padStart(new Reader(secret).mpi(), material.size);
		let x = material.point.slice(1, 1 + material.size);
		let y = material.point.slice(1 + material.size);
		let jwk = { kty: "EC", crv: material.curve, x: b64u(x), y: b64u(y), d: b64u(d) };
		return await crypto.subtle.importKey(
			"jwk",
			jwk,
			{ name: "ECDSA", namedCurve: material.curve },
			false,
			["sign"],
		);
	}
	if (material.kind === "rsa") {
		let reader = new Reader(secret);
		let [d, p, q, u] = [reader.mpi(), reader.mpi(), reader.mpi(), reader.mpi()].map(toBigInt);
		if (d === undefined || p === undefined || q === undefined || u === undefined) return null;
		let jwk = {
			kty: "RSA",
			n: b64u(material.n),
			e: b64u(material.e),
			d: b64u(fromBigInt(d)),
			p: b64u(fromBigInt(q)),
			q: b64u(fromBigInt(p)),
			dp: b64u(fromBigInt(d % (q - 1n))),
			dq: b64u(fromBigInt(d % (p - 1n))),
			qi: b64u(fromBigInt(u === 0n ? modInverse(p, q) : u)),
		};
		return await crypto.subtle.importKey(
			"jwk",
			jwk,
			{ name: "RSASSA-PKCS1-v1_5", hash: hash.name },
			false,
			["sign"],
		);
	}
	return null;
}

/**
 * Signs the hashed data and answers the signature's algorithm-specific fields.
 *
 * @param material - The signer's public material.
 * @param secret - The plaintext secret octets.
 * @param hash - The signature's hash.
 * @param data - Everything hashed: salt, signed data and trailer.
 * @param digest - The hash of `data`.
 */
export async function signValues(
	material: PublicMaterial,
	secret: Bytes,
	hash: HashInfo,
	data: Bytes,
	digest: Bytes,
): Promise<Result<SignatureValues, OpenPgpError>> {
	let key = await importPrivate(material, secret, hash).catch((error: unknown) => error);
	if (key === null)
		return failure(new OpenPgpError("unsupported", "The key's algorithm cannot sign here."));
	if (!(key instanceof CryptoKey)) {
		return failure(
			new OpenPgpError("crypto", "Web Crypto refused the private key.", { cause: key }),
		);
	}

	if (material.kind === "ed25519") {
		let signature = new Uint8Array(await crypto.subtle.sign("Ed25519", key, digest));
		return success({ values: [signature], native: true });
	}
	if (material.kind === "ed25519-legacy") {
		let signature = new Uint8Array(await crypto.subtle.sign("Ed25519", key, digest));
		return success({ values: [signature.slice(0, 32), signature.slice(32)], native: false });
	}
	if (material.kind === "ecdsa") {
		let signature = new Uint8Array(
			await crypto.subtle.sign({ name: "ECDSA", hash: hash.name }, key, data),
		);
		return success({
			values: [signature.slice(0, material.size), signature.slice(material.size)],
			native: false,
		});
	}
	let signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data));
	return success({ values: [signature], native: false });
}

/**
 * A fresh Ed25519 key pair as raw octets: the 32-octet seed and the 32-octet public key.
 */
export async function generateEd25519(): Promise<{ seed: Bytes; point: Bytes }> {
	let pair = (await crypto.subtle.generateKey("Ed25519", true, [
		"sign",
		"verify",
	])) as CryptoKeyPair;
	let point = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
	let jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
	let seed = Base64Url.decode(jwk.d ?? "");
	return { seed: seed.status === "success" ? seed.data : new Uint8Array(0), point };
}
