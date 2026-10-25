/**
 * Signature packets (RFC 9580 §5.2.3): reads and writes version 4 and 6 bodies with their
 * subpacket areas, and builds the trailer every signature hashes, so signing and
 * verifying share one definition of the signed octets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { concatBytes } from "@sdxc/crypto";
import { failure, success } from "@sdxc/result";

import { PUBLIC_KEY_ALGORITHM, SUBPACKET } from "./algorithms.js";
import { OpenPgpError } from "./errors.js";
import { mpi, Reader, u16, u32 } from "./lib/bytes.js";
import { encodeLength } from "./packets.js";

/** One signature subpacket: its type ID, critical bit and body. */
export interface Subpacket {
	type: number;
	critical: boolean;
	body: Bytes;
}

/** A version 4 or 6 Signature packet. */
export interface SignaturePacket {
	version: 4 | 6;
	/** The signature type ID (RFC 9580 §5.2.1). */
	type: number;
	algorithm: number;
	hash: number;
	hashed: Subpacket[];
	unhashed: Subpacket[];
	/** The packet body from the version octet through the hashed area: what the trailer covers. */
	hashedPrefix: Bytes;
	/** The left 16 bits of the signed hash. */
	left16: Bytes;
	/** The v6 salt; empty for v4. */
	salt: Bytes;
	/** The algorithm-specific fields: MPI magnitudes, or one native octet string. */
	values: Bytes[];
	/** The whole packet body. */
	body: Bytes;
}

/** Subpacket types RFC 9580 defines, which a critical bit never invalidates. */
const KNOWN_SUBPACKETS = new Set([
	2, 3, 4, 5, 6, 7, 9, 11, 12, 16, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 39,
]);

/**
 * Reads a subpacket area.
 *
 * @param area - The area's octets.
 */
function readSubpackets(area: Bytes): Subpacket[] | null {
	let reader = new Reader(area);
	let subpackets: Subpacket[] = [];
	while (reader.remaining > 0) {
		let first = reader.u8();
		let length = first;
		if (first >= 192 && first < 255) length = ((first - 192) << 8) + reader.u8() + 192;
		else if (first === 255) length = reader.u32();
		if (length === 0) return null;
		let typeOctet = reader.u8();
		let body = Uint8Array.from(reader.take(length - 1));
		if (reader.overrun) return null;
		subpackets.push({ type: typeOctet & 0x7f, critical: (typeOctet & 0x80) !== 0, body });
	}
	return subpackets;
}

/**
 * A subpacket area's octets.
 *
 * @param subpackets - The subpackets in order.
 */
export function writeSubpackets(subpackets: Subpacket[]): Bytes {
	return concatBytes(
		...subpackets.map((subpacket) =>
			concatBytes(
				encodeLength(subpacket.body.length + 1),
				Uint8Array.of(subpacket.type | (subpacket.critical ? 0x80 : 0)),
				subpacket.body,
			),
		),
	);
}

/**
 * Reads the algorithm-specific signature fields.
 *
 * @param reader - Positioned at the first field.
 * @param algorithm - The public-key algorithm ID.
 * @param strict - Whether MPIs must be minimally encoded.
 */
function readValues(reader: Reader, algorithm: number, strict: boolean): Bytes[] {
	if (algorithm === PUBLIC_KEY_ALGORITHM.ed25519) return [Uint8Array.from(reader.take(64))];
	if (algorithm === PUBLIC_KEY_ALGORITHM.ed448) return [Uint8Array.from(reader.take(114))];
	let rsa: number[] = [PUBLIC_KEY_ALGORITHM.rsa, PUBLIC_KEY_ALGORITHM.rsaSignOnly];
	if (rsa.includes(algorithm)) return [Uint8Array.from(reader.mpi(strict))];
	let pairs: number[] = [
		PUBLIC_KEY_ALGORITHM.dsa,
		PUBLIC_KEY_ALGORITHM.ecdsa,
		PUBLIC_KEY_ALGORITHM.eddsaLegacy,
	];
	if (pairs.includes(algorithm))
		return [Uint8Array.from(reader.mpi(strict)), Uint8Array.from(reader.mpi(strict))];
	return [Uint8Array.from(reader.rest())];
}

/**
 * Reads a Signature packet body. Version 3 and unknown versions answer `unsupported`, so
 * a caller can skip them and evaluate the stream's other signatures (§5.2.5).
 *
 * @param body - The packet body.
 */
export function readSignaturePacket(body: Bytes): Result<SignaturePacket, OpenPgpError> {
	let reader = new Reader(body);
	let version = reader.u8();
	if (version !== 4 && version !== 6) {
		return failure(
			new OpenPgpError("unsupported", `Version ${version} signatures are not supported.`),
		);
	}
	let type = reader.u8();
	let algorithm = reader.u8();
	let hash = reader.u8();
	let hashedArea = reader.take(version === 6 ? reader.u32() : reader.u16());
	let hashedPrefix = Uint8Array.from(body.subarray(0, reader.offset));
	let unhashedArea = reader.take(version === 6 ? reader.u32() : reader.u16());
	let left16 = Uint8Array.from(reader.take(2));
	let salt = version === 6 ? Uint8Array.from(reader.take(reader.u8())) : new Uint8Array(0);
	let values = readValues(reader, algorithm, version === 6);

	let hashed = readSubpackets(Uint8Array.from(hashedArea));
	let unhashed = readSubpackets(Uint8Array.from(unhashedArea));
	if (reader.overrun || reader.remaining !== 0 || hashed === null || unhashed === null) {
		return failure(new OpenPgpError("malformed", "The signature packet does not parse."));
	}
	return success({
		version,
		type,
		algorithm,
		hash,
		hashed,
		unhashed,
		hashedPrefix,
		left16,
		salt,
		values,
		body,
	});
}

/**
 * The trailer hashed after the signed data (§5.2.4): the hashed prefix, the version, `0xFF`
 * and the prefix length as a 4-octet scalar.
 *
 * @param version - The signature version.
 * @param hashedPrefix - The body from the version octet through the hashed area.
 */
export function signatureTrailer(version: 4 | 6, hashedPrefix: Bytes): Bytes {
	return concatBytes(hashedPrefix, Uint8Array.of(version, 0xff), u32(hashedPrefix.length));
}

/**
 * The hashed prefix of a new signature.
 *
 * @param version - 4 or 6.
 * @param type - The signature type ID.
 * @param algorithm - The public-key algorithm ID.
 * @param hash - The hash algorithm ID.
 * @param hashed - The hashed subpackets.
 */
export function hashedPrefixOf(
	version: 4 | 6,
	type: number,
	algorithm: number,
	hash: number,
	hashed: Subpacket[],
): Bytes {
	let area = writeSubpackets(hashed);
	let length = version === 6 ? u32(area.length) : u16(area.length);
	return concatBytes(Uint8Array.of(version, type, algorithm, hash), length, area);
}

/**
 * A Signature packet body from its hashed prefix and the computed parts.
 *
 * @param version - 4 or 6.
 * @param hashedPrefix - The body from the version octet through the hashed area.
 * @param unhashed - The unhashed subpackets.
 * @param left16 - The left 16 bits of the signed hash.
 * @param salt - The v6 salt.
 * @param values - The algorithm-specific fields: MPI magnitudes, or one native octet string.
 * @param native - Whether `values` is a native octet string rather than MPIs.
 */
export function writeSignatureBody(
	version: 4 | 6,
	hashedPrefix: Bytes,
	unhashed: Subpacket[],
	left16: Bytes,
	salt: Bytes,
	values: Bytes[],
	native: boolean,
): Bytes {
	let area = writeSubpackets(unhashed);
	let length = version === 6 ? u32(area.length) : u16(area.length);
	let saltField = version === 6 ? concatBytes(Uint8Array.of(salt.length), salt) : new Uint8Array(0);
	let fields = native ? concatBytes(...values) : concatBytes(...values.map((value) => mpi(value)));
	return concatBytes(hashedPrefix, length, area, left16, saltField, fields);
}

/**
 * The body of the last hashed subpacket of a type, which RFC 9580 §5.2.3.9 makes the one
 * that counts.
 *
 * @param signature - The signature.
 * @param type - The subpacket type ID.
 */
export function hashedSubpacket(signature: SignaturePacket, type: number): Bytes | undefined {
	return signature.hashed.filter((subpacket) => subpacket.type === type).at(-1)?.body;
}

/**
 * The signature's creation time, which RFC 9580 requires in the hashed area.
 *
 * @param signature - The signature.
 */
export function createdAt(signature: SignaturePacket): Date | undefined {
	let body = hashedSubpacket(signature, SUBPACKET.creationTime);
	if (body?.length !== 4) return undefined;
	return new Date(new Reader(body).u32() * 1000);
}

/**
 * A duration subpacket (signature or key expiration time) in seconds, or `undefined`
 * when absent or zero, which both mean "never".
 *
 * @param signature - The signature.
 * @param type - `SUBPACKET.expirationTime` or `SUBPACKET.keyExpirationTime`.
 */
export function secondsSubpacket(signature: SignaturePacket, type: number): number | undefined {
	let body = hashedSubpacket(signature, type);
	if (body?.length !== 4) return undefined;
	let seconds = new Reader(body).u32();
	return seconds === 0 ? undefined : seconds;
}

/**
 * The issuer fingerprint the signature names, hashed or not, without its version octet.
 *
 * @param signature - The signature.
 */
export function issuerFingerprint(signature: SignaturePacket): Bytes | undefined {
	let subpacket = [...signature.hashed, ...signature.unhashed].find(
		(candidate) => candidate.type === SUBPACKET.issuerFingerprint && candidate.body.length > 1,
	);
	return subpacket?.body.slice(1);
}

/**
 * The issuer Key ID the signature names, hashed or not.
 *
 * @param signature - The signature.
 */
export function issuerKeyId(signature: SignaturePacket): Bytes | undefined {
	let subpacket = [...signature.hashed, ...signature.unhashed].find(
		(candidate) => candidate.type === SUBPACKET.issuerKeyId && candidate.body.length === 8,
	);
	return subpacket?.body;
}

/**
 * Whether the hashed area carries a critical subpacket this package does not recognize,
 * which makes the signature one a verifier must not accept (§5.2.3.7).
 *
 * @param signature - The signature.
 */
export function hasUnknownCritical(signature: SignaturePacket): boolean {
	return signature.hashed.some(
		(subpacket) => subpacket.critical && !KNOWN_SUBPACKETS.has(subpacket.type),
	);
}
