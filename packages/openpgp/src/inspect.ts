/**
 * Read-only reports on keys and signatures: what a key is (algorithm, creation, expiry,
 * User IDs, subkeys) and who a signature claims made it, so a person or a tool can tell
 * which key to fetch before anything verifies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { KeyPacket } from "./key-packet.js";
import type { KeyStatus } from "./validity.js";

import { PACKET_TYPE, PUBLIC_KEY_ALGORITHM, SIGNATURE_TYPE } from "./algorithms.js";
import { dearmor } from "./armor.js";
import { OpenPgpError } from "./errors.js";
import { keyIdOf } from "./key-packet.js";
import { PrivateKey, PublicKey } from "./keys.js";
import { bitLength, upperHex } from "./lib/bytes.js";
import { readPackets } from "./packets.js";
import { readCleartext } from "./sign.js";
import {
	createdAt,
	issuerFingerprint,
	issuerKeyId,
	readSignaturePacket,
} from "./signature-packet.js";
import { verifyKey } from "./validity.js";

/** One key of a certificate, primary or subkey, with what its self-signatures establish. */
export interface KeyDetails extends KeyStatus {
	/** The 64-bit Key ID as uppercase hex. */
	keyId: string;
	version: 4 | 6;
	created: Date;
	/** A readable name with its size or curve, such as `Ed25519`, `ECDSA P-256` or `RSA 3072`. */
	algorithm: string;
}

/** A whole key, as `inspectKey` reports it. */
export interface KeyInspection {
	primary: KeyDetails;
	/** Each User ID with whether a valid self-certification covers it. */
	userIds: Array<{ userId: string; certified: boolean }>;
	subkeys: KeyDetails[];
	/** Whether the input carried secret material. */
	secret: boolean;
	/** Whether some of that secret material is passphrase-protected. */
	locked: boolean;
}

/** What a signature says about itself, read without verifying it. */
export interface SignatureDetails {
	version: 4 | 6;
	/** `binary`, `text`, or the type ID for any other signature type. */
	type: "binary" | "text" | number;
	/** The public-key algorithm's name, such as `Ed25519` or `RSA`. */
	algorithm: string;
	/** The hash's name, including ones verification refuses (`SHA-1`, `MD5`). */
	hash: string;
	created: Date | undefined;
	/** The issuer's fingerprint as uppercase hex, when the signature names it. */
	issuerFingerprint: string | undefined;
	/** The issuer's Key ID as uppercase hex, named directly or implied by the fingerprint. */
	issuerKeyId: string | undefined;
}

/** Public-key algorithm names by ID, for keys and signatures whose material says no more. */
const ALGORITHM_NAMES: Record<number, string> = {
	[PUBLIC_KEY_ALGORITHM.rsa]: "RSA",
	[PUBLIC_KEY_ALGORITHM.rsaEncryptOnly]: "RSA",
	[PUBLIC_KEY_ALGORITHM.rsaSignOnly]: "RSA",
	[PUBLIC_KEY_ALGORITHM.elgamal]: "ElGamal",
	[PUBLIC_KEY_ALGORITHM.dsa]: "DSA",
	[PUBLIC_KEY_ALGORITHM.ecdh]: "ECDH",
	[PUBLIC_KEY_ALGORITHM.ecdsa]: "ECDSA",
	[PUBLIC_KEY_ALGORITHM.eddsaLegacy]: "Ed25519Legacy",
	[PUBLIC_KEY_ALGORITHM.x25519]: "X25519",
	[PUBLIC_KEY_ALGORITHM.x448]: "X448",
	[PUBLIC_KEY_ALGORITHM.ed25519]: "Ed25519",
	[PUBLIC_KEY_ALGORITHM.ed448]: "Ed448",
};

/** Hash names by ID (RFC 9580 §9.5), the deprecated ones included so a report can name them. */
const HASH_NAMES: Record<number, string> = {
	1: "MD5",
	2: "SHA-1",
	3: "RIPEMD-160",
	8: "SHA-256",
	9: "SHA-384",
	10: "SHA-512",
	11: "SHA-224",
	12: "SHA3-256",
	14: "SHA3-512",
};

/**
 * A public-key algorithm's name, or `algorithm <id>` for one RFC 9580 does not register.
 *
 * @param id - The algorithm ID.
 */
function algorithmName(id: number): string {
	return ALGORITHM_NAMES[id] ?? `algorithm ${id}`;
}

/**
 * A key's algorithm with the size or curve its material states.
 *
 * @param key - The key packet.
 */
function keyAlgorithm(key: KeyPacket): string {
	let material = key.material;
	if (material.kind === "rsa") return `RSA ${bitLength(material.n)}`;
	if (material.kind === "ecdsa") return `ECDSA ${material.curve}`;
	return algorithmName(key.algorithm);
}

/**
 * A key packet's identity joined with its status.
 *
 * @param key - The key packet.
 * @param status - What its self-signatures establish.
 */
function details(key: KeyPacket, status: KeyStatus): KeyDetails {
	return {
		...status,
		keyId: upperHex(key.keyId),
		version: key.version,
		created: key.created,
		algorithm: keyAlgorithm(key),
	};
}

/**
 * Reports everything a key holds: the primary key and each subkey with their algorithms,
 * creation, expiry, revocation and signing capability, and each User ID with whether it
 * is certified. Every self-signature is checked, as `verifyKey` does.
 *
 * @param key - A certificate or a private key, locked or not.
 * @example
 * let report = await inspectKey(certificate);
 * report.primary.algorithm; // "Ed25519"
 */
export async function inspectKey(key: PublicKey | PrivateKey): Promise<KeyInspection> {
	let certificate = key instanceof PrivateKey ? key.publicKey : key;
	let verification = await verifyKey(certificate);
	let { parts } = certificate;
	return {
		primary: details(parts.primary, verification.primary),
		userIds: verification.userIds,
		subkeys: parts.subkeys.map((subkey, index) =>
			details(subkey.key, verification.subkeys[index] as KeyStatus),
		),
		secret: key instanceof PrivateKey,
		locked: key instanceof PrivateKey && key.locked,
	};
}

/**
 * The binary Signature packets an input holds: a cleartext signed message's signature
 * block, a `PGP SIGNATURE` block, or the packets themselves.
 *
 * @param input - Armored text or binary packets.
 */
function signatureBytes(input: string | Uint8Array): Result<Bytes, OpenPgpError> {
	if (typeof input !== "string") return success(Uint8Array.from(input));
	if (input.includes("-----BEGIN PGP SIGNED MESSAGE-----")) {
		let cleartext = readCleartext(input);
		if (isFailure(cleartext)) return cleartext;
		return success(cleartext.data.signature);
	}
	let block = dearmor(input);
	if (isFailure(block)) return block;
	if (block.data.type !== "signature") {
		return failure(new OpenPgpError("malformed", "The armored block is not a PGP SIGNATURE."));
	}
	return success(block.data.data);
}

/**
 * The signature type as a report names it.
 *
 * @param type - The signature type ID.
 */
function typeName(type: number): SignatureDetails["type"] {
	if (type === SIGNATURE_TYPE.binary) return "binary";
	if (type === SIGNATURE_TYPE.text) return "text";
	return type;
}

/**
 * Reads what each signature in an input claims about itself — issuer, algorithm, hash,
 * creation time — without verifying any of them, so a failed verification can still name
 * the key that would have to verify it. Signatures this package cannot parse are skipped.
 *
 * @param input - A cleartext signed message, a `PGP SIGNATURE` block or binary packets.
 * @example
 * let signatures = readSignatures(armoredSignature);
 * if (isSuccess(signatures)) signatures.data[0]?.issuerFingerprint;
 */
export function readSignatures(
	input: string | Uint8Array,
): Result<SignatureDetails[], OpenPgpError> {
	let bytes = signatureBytes(input);
	if (isFailure(bytes)) return bytes;
	let packets = readPackets(bytes.data);
	if (isFailure(packets)) return packets;
	let found: SignatureDetails[] = [];
	for (let packet of packets.data) {
		if (packet.type !== PACKET_TYPE.signature) continue;
		let signature = readSignaturePacket(packet.body);
		if (isFailure(signature)) continue;
		let fingerprint = issuerFingerprint(signature.data);
		let keyId =
			issuerKeyId(signature.data) ??
			(fingerprint && keyIdOf(fingerprint.length === 32 ? 6 : 4, fingerprint));
		found.push({
			version: signature.data.version,
			type: typeName(signature.data.type),
			algorithm: algorithmName(signature.data.algorithm),
			hash: HASH_NAMES[signature.data.hash] ?? `hash ${signature.data.hash}`,
			created: createdAt(signature.data),
			issuerFingerprint: fingerprint && upperHex(fingerprint),
			issuerKeyId: keyId && upperHex(keyId),
		});
	}
	if (found.length === 0) {
		return failure(
			new OpenPgpError("no-signature", "No signature this package can read was found."),
		);
	}
	return success(found);
}
