/**
 * Reads the authenticator data both WebAuthn ceremonies return.
 *
 * The structure is a fixed 37-byte prefix optionally followed by the new
 * credential and by extension outputs, none of them length-prefixed, so the
 * flags byte is what says which parts are present and where each one starts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Hex } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import { MalformedResponseError } from "../errors.js";

import { read } from "./cbor.js";

/** Bytes of the SHA-256 hash of the relying party id that opens the structure. */
const RP_ID_HASH_BYTES = 32;

/** Offset of the flags byte, just past the relying party id hash. */
const FLAGS_OFFSET = 32;

/** Offset of the big-endian signature counter. */
const COUNTER_OFFSET = 33;

/** Offset of the attested credential data, when the flags say it is present. */
const CREDENTIAL_OFFSET = 37;

/** Bytes an AAGUID occupies. */
const AAGUID_BYTES = 16;

/** Flag bits, in the order the specification lists them. */
const FLAG = {
	userPresent: 0x01,
	userVerified: 0x04,
	backupEligible: 0x08,
	backedUp: 0x10,
	attested: 0x40,
};

/** Offsets at which a UUID string takes a hyphen. */
const UUID_GROUPS = [8, 12, 16, 20];

/** The credential an authenticator minted during registration. */
export interface AttestedCredential {
	/** Model identifier of the authenticator, as a UUID. */
	aaguid: string;
	/** Credential id, which later assertions echo back. */
	id: Bytes;
	/** Public key as COSE bytes, which is the form to store. */
	publicKey: Bytes;
}

/** Authenticator data as both ceremonies return it. */
export interface AuthenticatorData {
	/** SHA-256 of the relying party id the credential is bound to. */
	rpIdHash: Bytes;
	/** Whether somebody interacted with the authenticator. */
	userPresent: boolean;
	/** Whether the authenticator checked a biometric or PIN. */
	userVerified: boolean;
	/** Whether the credential may be synced to the person's other devices. */
	backupEligible: boolean;
	/** Whether the credential is currently synced. */
	backedUp: boolean;
	/** Signature counter, which stays at zero on authenticators that keep none. */
	counter: number;
	/** The new credential, present only on a registration. */
	credential?: AttestedCredential;
}

/**
 * Formats AAGUID bytes as the UUID string authenticator metadata is keyed by.
 *
 * @param bytes The sixteen identifier bytes.
 * @returns The hyphenated lowercase UUID.
 */
function toUuid(bytes: Bytes): string {
	let hex = Hex.encode(bytes);
	let parts: string[] = [];
	let start = 0;
	for (let group of UUID_GROUPS) {
		parts.push(hex.slice(start * 2, group * 2));
		start = group;
	}
	parts.push(hex.slice(start * 2));
	return parts.join("-");
}

/**
 * Parses authenticator data, including the credential a registration carries.
 *
 * @param bytes Authenticator data exactly as the authenticator produced it.
 * @returns The parsed structure, or `MalformedResponseError` when it is truncated.
 * @example
 * let data = parse(authenticatorData);
 */
export function parse(bytes: Bytes): Result<AuthenticatorData, MalformedResponseError> {
	if (bytes.length < CREDENTIAL_OFFSET) {
		return failure(new MalformedResponseError("authenticator data is too short"));
	}

	let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let flags = bytes[FLAGS_OFFSET] as number;

	let data: AuthenticatorData = {
		rpIdHash: bytes.subarray(0, RP_ID_HASH_BYTES),
		userPresent: (flags & FLAG.userPresent) !== 0,
		userVerified: (flags & FLAG.userVerified) !== 0,
		backupEligible: (flags & FLAG.backupEligible) !== 0,
		backedUp: (flags & FLAG.backedUp) !== 0,
		counter: view.getUint32(COUNTER_OFFSET),
	};

	if ((flags & FLAG.attested) === 0) return success(data);

	let idLengthOffset = CREDENTIAL_OFFSET + AAGUID_BYTES;
	if (bytes.length < idLengthOffset + 2) {
		return failure(new MalformedResponseError("attested credential data is too short"));
	}

	let idLength = view.getUint16(idLengthOffset);
	let idOffset = idLengthOffset + 2;
	let keyOffset = idOffset + idLength;
	if (bytes.length < keyOffset) {
		return failure(new MalformedResponseError("credential id is truncated"));
	}

	let key = read(bytes.subarray(keyOffset));
	if (isFailure(key)) return key;

	data.credential = {
		aaguid: toUuid(bytes.subarray(CREDENTIAL_OFFSET, idLengthOffset)),
		id: bytes.subarray(idOffset, keyOffset),
		publicKey: bytes.subarray(keyOffset, keyOffset + key.data[1]),
	};

	return success(data);
}
