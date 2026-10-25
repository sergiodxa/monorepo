/**
 * Key material packets (RFC 9580 §5.5): reads and writes version 4 and 6 Public Key and
 * Secret Key bodies, and computes their fingerprints and Key IDs, so a key's identity
 * always comes from the exact octets a signature hashes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { concatBytes, Hex } from "@sdxc/crypto";
import { failure, success } from "@sdxc/result";

import type { S2K } from "./s2k.js";

import { ED25519_LEGACY_OID, NIST_CURVES, PUBLIC_KEY_ALGORITHM } from "./algorithms.js";
import { OpenPgpError } from "./errors.js";
import { equalBytes, mpi, Reader, timeField, u16, u32 } from "./lib/bytes.js";
import { readS2K, writeS2K } from "./s2k.js";

/** The public half of a key, parsed for the algorithms this package signs or verifies with. */
export type PublicMaterial =
	| { kind: "rsa"; n: Bytes; e: Bytes }
	| { kind: "ecdsa"; curve: "P-256" | "P-384" | "P-521"; size: number; point: Bytes }
	| { kind: "ed25519-legacy"; point: Bytes }
	| { kind: "ed25519"; point: Bytes }
	| { kind: "other" };

/** A Public Key or Public Subkey packet, with the identity derived from its body. */
export interface KeyPacket {
	version: 4 | 6;
	created: Date;
	algorithm: number;
	material: PublicMaterial;
	/** The Public Key packet body, version octet first: what fingerprints and signatures hash. */
	body: Bytes;
	fingerprint: Bytes;
	keyId: Bytes;
}

/** How a secret key's material is locked (RFC 9580 Table 2). */
export interface Protection {
	/** 253 (AEAD), 254 (CFB with SHA-1 check) or 255 (CFB with checksum, version 4 only). */
	usage: 253 | 254 | 255;
	cipher: number;
	/** The AEAD mode, for usage 253. */
	aead: number;
	s2k: S2K;
	/** The AEAD nonce or the CFB IV. */
	iv: Bytes;
	/** The encrypted material, tag or check value included. */
	data: Bytes;
}

/** A Secret Key or Secret Subkey packet: the public packet plus its secret material. */
export interface SecretKeyPacket extends KeyPacket {
	/** The plaintext algorithm-specific secret octets, or `null` while locked. */
	secret: Bytes | null;
	/** How the material is locked, or `null` when stored in the clear. */
	protection: Protection | null;
}

/** The fixed octet lengths of the native-key algorithms (RFC 9580 Table 18). */
const NATIVE_SIZES: Record<number, { publicSize: number; secretSize: number }> = {
	[PUBLIC_KEY_ALGORITHM.x25519]: { publicSize: 32, secretSize: 32 },
	[PUBLIC_KEY_ALGORITHM.x448]: { publicSize: 56, secretSize: 56 },
	[PUBLIC_KEY_ALGORITHM.ed25519]: { publicSize: 32, secretSize: 32 },
	[PUBLIC_KEY_ALGORITHM.ed448]: { publicSize: 57, secretSize: 57 },
};

/** The nonce length of each AEAD mode (RFC 9580 Table 25): EAX, OCB, GCM. */
const AEAD_NONCE_SIZES: Record<number, number> = { 1: 16, 2: 15, 3: 12 };

/** How many MPIs each MPI-based algorithm's public and secret parts hold. */
const MPI_COUNTS: Record<number, { publicCount: number; secretCount: number }> = {
	[PUBLIC_KEY_ALGORITHM.rsa]: { publicCount: 2, secretCount: 4 },
	[PUBLIC_KEY_ALGORITHM.rsaEncryptOnly]: { publicCount: 2, secretCount: 4 },
	[PUBLIC_KEY_ALGORITHM.rsaSignOnly]: { publicCount: 2, secretCount: 4 },
	[PUBLIC_KEY_ALGORITHM.elgamal]: { publicCount: 3, secretCount: 1 },
	[PUBLIC_KEY_ALGORITHM.dsa]: { publicCount: 4, secretCount: 1 },
};

/**
 * Reads the length-prefixed curve OID an ECC key starts with.
 *
 * @param reader - Positioned at the OID's size octet.
 */
function readOid(reader: Reader): Bytes {
	let size = reader.u8();
	if (size === 0 || size === 0xff) reader.overrun = true;
	return Uint8Array.from(reader.take(size));
}

/**
 * The parsed form of an ECC public key, given its OID and point.
 *
 * @param algorithm - ECDSA, EdDSALegacy or ECDH.
 * @param oid - The curve OID octets.
 * @param point - The point's MPI magnitude.
 */
function eccMaterial(algorithm: number, oid: Bytes, point: Bytes): PublicMaterial {
	let curve = NIST_CURVES[Hex.encode(oid)];
	if (algorithm === PUBLIC_KEY_ALGORITHM.ecdsa && curve) {
		return { kind: "ecdsa", curve: curve.name, size: curve.size, point };
	}
	let legacy =
		algorithm === PUBLIC_KEY_ALGORITHM.eddsaLegacy && equalBytes(oid, ED25519_LEGACY_OID);
	if (legacy && point.length === 33 && point[0] === 0x40) {
		return { kind: "ed25519-legacy", point: point.slice(1) };
	}
	return { kind: "other" };
}

/**
 * Reads the algorithm-specific public fields (§5.5.5). An algorithm this package cannot
 * size leaves the reader overrun, since its end is unknown.
 *
 * @param reader - Positioned at the first public field.
 * @param algorithm - The public-key algorithm ID.
 * @param strict - Whether MPIs must be minimally encoded, as version 6 requires.
 */
function readPublicMaterial(reader: Reader, algorithm: number, strict: boolean): PublicMaterial {
	let native = NATIVE_SIZES[algorithm];
	if (native) {
		let point = Uint8Array.from(reader.take(native.publicSize));
		return algorithm === PUBLIC_KEY_ALGORITHM.ed25519
			? { kind: "ed25519", point }
			: { kind: "other" };
	}
	let counts = MPI_COUNTS[algorithm];
	if (counts) {
		let values = Array.from({ length: counts.publicCount }, () =>
			Uint8Array.from(reader.mpi(strict)),
		);
		let [n, e] = values;
		if (algorithm === PUBLIC_KEY_ALGORITHM.dsa || algorithm === PUBLIC_KEY_ALGORITHM.elgamal) {
			return { kind: "other" };
		}
		return n && e ? { kind: "rsa", n, e } : { kind: "other" };
	}
	let ecc = [
		PUBLIC_KEY_ALGORITHM.ecdh,
		PUBLIC_KEY_ALGORITHM.ecdsa,
		PUBLIC_KEY_ALGORITHM.eddsaLegacy,
	];
	if ((ecc as number[]).includes(algorithm)) {
		let oid = readOid(reader);
		let point = Uint8Array.from(reader.mpi(strict));
		if (algorithm === PUBLIC_KEY_ALGORITHM.ecdh) reader.take(reader.u8());
		return eccMaterial(algorithm, oid, point);
	}
	reader.overrun = true;
	return { kind: "other" };
}

/**
 * The fingerprint (§5.5.4): SHA-1 over `0x99`, a 2-octet length and the body for a v4
 * key; SHA-256 over `0x9B`, a 4-octet length and the body for a v6 key.
 *
 * @param version - The key version.
 * @param body - The Public Key packet body.
 */
export async function fingerprintOf(version: 4 | 6, body: Bytes): Promise<Bytes> {
	let input =
		version === 6
			? concatBytes(Uint8Array.of(0x9b), u32(body.length), body)
			: concatBytes(Uint8Array.of(0x99), u16(body.length), body);
	return new Uint8Array(await crypto.subtle.digest(version === 6 ? "SHA-256" : "SHA-1", input));
}

/**
 * The Key ID a fingerprint implies: its low 64 bits for v4, its high 64 bits for v6.
 *
 * @param version - The key version.
 * @param fingerprint - The key's fingerprint.
 */
export function keyIdOf(version: 4 | 6, fingerprint: Bytes): Bytes {
	return version === 6 ? fingerprint.slice(0, 8) : fingerprint.slice(-8);
}

/**
 * Whether this package knows where an algorithm's public fields end, which a version 4
 * Secret Key packet needs before its secret material can be found.
 *
 * @param algorithm - The public-key algorithm ID.
 */
function isSizable(algorithm: number): boolean {
	let ecc: number[] = [
		PUBLIC_KEY_ALGORITHM.ecdh,
		PUBLIC_KEY_ALGORITHM.ecdsa,
		PUBLIC_KEY_ALGORITHM.eddsaLegacy,
	];
	return (
		NATIVE_SIZES[algorithm] !== undefined ||
		MPI_COUNTS[algorithm] !== undefined ||
		ecc.includes(algorithm)
	);
}

/**
 * Reads the public part of a key packet and leaves the reader after it. With `whole`,
 * the public fields run to the end of the body, so an unknown algorithm still parses.
 *
 * @param reader - Positioned at the version octet.
 * @param whole - Whether the packet is a public one, holding nothing after its fields.
 */
async function readPublicPart(
	reader: Reader,
	whole: boolean,
): Promise<Result<KeyPacket, OpenPgpError>> {
	let start = reader.offset;
	let version = reader.u8();
	if (version !== 4 && version !== 6) {
		return failure(new OpenPgpError("unsupported", `Version ${version} keys are not supported.`));
	}
	let created = new Date(reader.u32() * 1000);
	let algorithm = reader.u8();
	if (version === 6 && algorithm === PUBLIC_KEY_ALGORITHM.eddsaLegacy) {
		return failure(new OpenPgpError("malformed", "A version 6 key cannot use EdDSALegacy."));
	}

	let fields = reader;
	if (version === 6) fields = new Reader(Uint8Array.from(reader.take(reader.u32())));
	else if (whole) fields = new Reader(Uint8Array.from(reader.rest()));

	let material: PublicMaterial = { kind: "other" };
	if (isSizable(algorithm)) material = readPublicMaterial(fields, algorithm, version === 6);
	else if (fields === reader) {
		return failure(
			new OpenPgpError("unsupported", `Public-key algorithm ${algorithm} is not supported.`),
		);
	} else fields.rest();

	if (reader.overrun || fields.overrun || (fields !== reader && fields.remaining !== 0)) {
		return failure(new OpenPgpError("malformed", "The key material does not match its length."));
	}

	let body = Uint8Array.from(reader.bytes.subarray(start, reader.offset));
	let fingerprint = await fingerprintOf(version, body);
	return success({
		version,
		created,
		algorithm,
		material,
		body,
		fingerprint,
		keyId: keyIdOf(version, fingerprint),
	});
}

/**
 * Reads a Public Key or Public Subkey packet body. Every octet belongs to the key, so an
 * algorithm this package cannot use still gets its fingerprint.
 *
 * @param body - The packet body.
 */
export async function readPublicKeyPacket(body: Bytes): Promise<Result<KeyPacket, OpenPgpError>> {
	let reader = new Reader(body);
	let key = await readPublicPart(reader, true);
	if (key.status === "success" && reader.remaining !== 0) {
		return failure(new OpenPgpError("malformed", "The key packet has trailing octets."));
	}
	return key;
}

/**
 * The length of an algorithm's plaintext secret fields at the start of `bytes`, or
 * `undefined` when they do not parse.
 *
 * @param bytes - Plaintext secret octets, possibly followed by a checksum.
 * @param algorithm - The public-key algorithm ID.
 */
export function secretLength(bytes: Bytes, algorithm: number): number | undefined {
	let native = NATIVE_SIZES[algorithm];
	if (native) return bytes.length >= native.secretSize ? native.secretSize : undefined;
	let reader = new Reader(bytes);
	let count = MPI_COUNTS[algorithm]?.secretCount ?? 1;
	for (let index = 0; index < count; index++) reader.mpi();
	return reader.overrun ? undefined : reader.offset;
}

/**
 * The 2-octet checksum (sum of octets mod 65536) a version 4 key stores beside its
 * unprotected or legacy-protected secret.
 *
 * @param bytes - The plaintext secret octets.
 */
export function checksum16(bytes: Uint8Array): Bytes {
	return u16(bytes.reduce((sum, byte) => (sum + byte) & 0xffff, 0));
}

/**
 * Reads the S2K parameter fields of a protected secret key.
 *
 * @param reader - Positioned after the usage octet (and the v6 parameter count).
 * @param usage - The S2K usage octet.
 * @param version - The key version.
 */
function readProtection(reader: Reader, usage: 253 | 254 | 255, version: 4 | 6): Protection {
	let cipher = reader.u8();
	let aead = usage === 253 ? reader.u8() : 0;
	if (version === 6) reader.u8();
	let s2k = readS2K(reader);
	if (s2k.type === 101)
		return { usage, cipher, aead, s2k, iv: new Uint8Array(0), data: new Uint8Array(0) };
	let ivSize = usage === 253 ? (AEAD_NONCE_SIZES[aead] ?? 16) : 16;
	let iv = Uint8Array.from(reader.take(ivSize));
	return { usage, cipher, aead, s2k, iv, data: Uint8Array.from(reader.rest()) };
}

/**
 * Reads a Secret Key or Secret Subkey packet body. Unprotected material is checked
 * (a v4 checksum must match); protected material is kept encrypted until unlocked.
 *
 * @param body - The packet body.
 */
export async function readSecretKeyPacket(
	body: Bytes,
): Promise<Result<SecretKeyPacket, OpenPgpError>> {
	let reader = new Reader(body);
	let key = await readPublicPart(reader, false);
	if (key.status === "failure") return key;
	let { version, algorithm } = key.data;

	let usage = reader.u8();
	if (usage === 0) {
		let rest = Uint8Array.from(reader.rest());
		let length = secretLength(rest, algorithm);
		let expected = version === 4 ? rest.length - 2 : rest.length;
		if (length === undefined || length !== expected) {
			return failure(new OpenPgpError("malformed", "The secret key material does not parse."));
		}
		let secret = rest.slice(0, length);
		if (version === 4 && !equalBytes(checksum16(secret), rest.slice(length))) {
			return failure(new OpenPgpError("malformed", "The secret key checksum does not match."));
		}
		return success({ ...key.data, secret, protection: null });
	}

	if (usage !== 253 && usage !== 254 && usage !== 255) {
		return failure(
			new OpenPgpError(
				"unsupported",
				"Secret keys protected without an S2K specifier are not supported.",
			),
		);
	}
	if (version === 6 && usage === 255) {
		return failure(new OpenPgpError("malformed", "A version 6 key cannot use MalleableCFB."));
	}
	if (version === 6) reader.u8();
	let protection = readProtection(reader, usage, version);
	if (reader.overrun)
		return failure(new OpenPgpError("malformed", "The secret key packet is truncated."));
	return success({ ...key.data, secret: null, protection });
}

/**
 * A Secret Key packet body: the public body, then the material in the clear or as
 * `protection` describes, with the v4 checksum or the v6 parameter count as required.
 *
 * @param key - The public packet.
 * @param secret - The plaintext secret octets, used when `protection` is `null`.
 * @param protection - How the material is locked.
 */
export function writeSecretKeyBody(
	key: KeyPacket,
	secret: Bytes,
	protection: Protection | null,
): Bytes {
	if (protection === null) {
		let tail = key.version === 4 ? concatBytes(secret, checksum16(secret)) : secret;
		return concatBytes(key.body, Uint8Array.of(0), tail);
	}
	let s2k = writeS2K(protection.s2k);
	let mode =
		protection.usage === 253
			? Uint8Array.of(protection.cipher, protection.aead)
			: Uint8Array.of(protection.cipher);
	let s2kLength = key.version === 6 ? Uint8Array.of(s2k.length) : new Uint8Array(0);
	let params = concatBytes(mode, s2kLength, s2k, protection.iv);
	let count = key.version === 6 ? Uint8Array.of(params.length) : new Uint8Array(0);
	return concatBytes(key.body, Uint8Array.of(protection.usage), count, params, protection.data);
}

/**
 * The Public Key packet body for a new key.
 *
 * @param version - 4 or 6.
 * @param created - The creation time, truncated to the second.
 * @param algorithm - The public-key algorithm ID.
 * @param fields - The algorithm-specific public fields, already encoded.
 */
export function publicKeyBody(
	version: 4 | 6,
	created: Date,
	algorithm: number,
	fields: Bytes,
): Bytes {
	let length = version === 6 ? u32(fields.length) : new Uint8Array(0);
	return concatBytes(
		Uint8Array.of(version),
		timeField(created),
		Uint8Array.of(algorithm),
		length,
		fields,
	);
}

/**
 * The encoded public fields for the algorithms this package generates.
 *
 * @param material - The public material.
 */
export function publicFields(material: PublicMaterial): Bytes {
	if (material.kind === "ed25519") return material.point;
	if (material.kind === "ed25519-legacy") {
		return concatBytes(
			Uint8Array.of(ED25519_LEGACY_OID.length),
			ED25519_LEGACY_OID,
			mpi(concatBytes(Uint8Array.of(0x40), material.point)),
		);
	}
	if (material.kind === "rsa") return concatBytes(mpi(material.n), mpi(material.e));
	if (material.kind === "ecdsa") {
		let oid =
			Object.entries(NIST_CURVES).find(([, curve]) => curve.name === material.curve)?.[0] ?? "";
		let oidBytes = Uint8Array.from(oid.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
		return concatBytes(Uint8Array.of(oidBytes.length), oidBytes, mpi(material.point));
	}
	return new Uint8Array(0);
}
