/**
 * Whether a key may vouch for a signature: its self-signatures verify, it is neither
 * revoked nor expired at the signature's time, and a subkey is bound to its primary
 * (with a back-signature when it signs), as RFC 9580 §5.2.3.10 and §10.1.5 require.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { concatBytes } from "@sdxc/crypto";
import { failure, isSuccess, success } from "@sdxc/result";

import type { KeyPacket } from "./key-packet.js";
import type { KeyParts } from "./keys.js";
import type { SignaturePacket } from "./signature-packet.js";

import { KEY_FLAG, SIGNATURE_TYPE, SUBPACKET } from "./algorithms.js";
import { OpenPgpError } from "./errors.js";
import { upperHex } from "./lib/bytes.js";
import { checkSignature, keyHashInput, userIdHashInput } from "./signature-engine.js";
import {
	createdAt,
	hashedSubpacket,
	readSignaturePacket,
	secondsSubpacket,
} from "./signature-packet.js";

/** What a valid self-signature says about the key it covers. */
interface SelfSignature {
	signature: SignaturePacket;
	/** The key flags' first octet, or `undefined` when the signature states none. */
	flags: number | undefined;
	/** When the key expires, or `undefined` for never. */
	expires: Date | undefined;
}

/** A key's validity, as a verifier judges it. */
export interface KeyStatus {
	/** The key's fingerprint as uppercase hex. */
	fingerprint: string;
	/** Whether a valid revocation signature covers it. */
	revoked: boolean;
	/** When it expires, or `undefined` for never. */
	expires: Date | undefined;
	/** Whether it may sign data: flags allow it and, for a subkey, a valid binding exists. */
	canSign: boolean;
	/** Whether a valid self-signature or binding covers it, as a v6 key or any subkey requires. */
	bound: boolean;
}

/**
 * The newest signature of the given types that verifies over the data with the signer,
 * or `undefined` when none does.
 *
 * @param signatures - Candidate signatures.
 * @param types - The signature type IDs to consider.
 * @param signer - The key that should have made them.
 * @param data - The signed data.
 */
async function newestValid(
	signatures: SignaturePacket[],
	types: number[],
	signer: KeyPacket,
	data: Bytes,
): Promise<SignaturePacket | undefined> {
	let candidates = signatures
		.filter((signature) => types.includes(signature.type))
		.sort((left, right) => (createdAt(right)?.getTime() ?? 0) - (createdAt(left)?.getTime() ?? 0));
	for (let signature of candidates) {
		if (isSuccess(await checkSignature(signature, signer, data))) return signature;
	}
	return undefined;
}

/**
 * What a self-signature says about the key it covers.
 *
 * @param signature - A valid self-signature or binding.
 * @param key - The key it covers, whose creation time the expiration counts from.
 */
function describe(signature: SignaturePacket, key: KeyPacket): SelfSignature {
	let flags = hashedSubpacket(signature, SUBPACKET.keyFlags)?.[0];
	let seconds = secondsSubpacket(signature, SUBPACKET.keyExpirationTime);
	let expires =
		seconds === undefined ? undefined : new Date(key.created.getTime() + seconds * 1000);
	return { signature, flags, expires };
}

/**
 * The primary key's governing self-signature: the newest valid Direct Key signature, or
 * for a v4 key without one, the newest valid certification of a User ID.
 *
 * @param parts - The certificate.
 */
async function primarySelfSignature(parts: KeyParts): Promise<SelfSignature | undefined> {
	let primary = parts.primary;
	let direct = await newestValid(
		parts.directSignatures,
		[SIGNATURE_TYPE.directKey],
		primary,
		keyHashInput(primary),
	);
	if (direct) return describe(direct, primary);
	if (primary.version === 6) return undefined;

	let certifications = [0x10, 0x11, 0x12, SIGNATURE_TYPE.positiveCertification];
	let time = (signature: SignaturePacket) => createdAt(signature)?.getTime() ?? 0;
	let best: SignaturePacket | undefined;
	for (let user of parts.users) {
		let data = concatBytes(keyHashInput(primary), userIdHashInput(user.body));
		let signature = await newestValid(user.signatures, certifications, primary, data);
		if (signature === undefined) continue;
		if (best === undefined || time(signature) > time(best)) best = signature;
	}
	return best ? describe(best, primary) : undefined;
}

/**
 * The primary key's status.
 *
 * @param parts - The certificate.
 */
export async function primaryStatus(parts: KeyParts): Promise<KeyStatus> {
	let primary = parts.primary;
	let revocation = await newestValid(
		parts.directSignatures,
		[SIGNATURE_TYPE.keyRevocation],
		primary,
		keyHashInput(primary),
	);
	let self = await primarySelfSignature(parts);
	let bound = self !== undefined || primary.version === 4;
	let flags = self?.flags;
	return {
		fingerprint: upperHex(primary.fingerprint),
		revoked: revocation !== undefined,
		expires: self?.expires,
		canSign: bound && (flags === undefined || (flags & KEY_FLAG.sign) !== 0),
		bound,
	};
}

/**
 * Whether a signing subkey's binding carries a valid Primary Key Binding back-signature,
 * proving the subkey's holder agreed to the binding.
 *
 * @param binding - The subkey binding signature.
 * @param subkey - The subkey.
 * @param data - The primary-then-subkey hash input.
 */
async function hasBackSignature(
	binding: SignaturePacket,
	subkey: KeyPacket,
	data: Bytes,
): Promise<boolean> {
	let embedded = [...binding.hashed, ...binding.unhashed].filter(
		(subpacket) => subpacket.type === SUBPACKET.embeddedSignature,
	);
	for (let subpacket of embedded) {
		let signature = readSignaturePacket(subpacket.body);
		if (signature.status !== "success" || signature.data.type !== SIGNATURE_TYPE.primaryKeyBinding)
			continue;
		if (isSuccess(await checkSignature(signature.data, subkey, data))) return true;
	}
	return false;
}

/**
 * A subkey's status: bound by the newest valid Subkey Binding signature, signing only
 * when its flags allow it and a valid back-signature is embedded.
 *
 * @param parts - The certificate.
 * @param subkey - The subkey and its signatures.
 * @param subkey.key - The subkey packet.
 * @param subkey.signatures - The signatures following it.
 */
export async function subkeyStatus(
	parts: KeyParts,
	subkey: { key: KeyPacket; signatures: SignaturePacket[] },
): Promise<KeyStatus> {
	let data = concatBytes(keyHashInput(parts.primary), keyHashInput(subkey.key));
	let binding = await newestValid(
		subkey.signatures,
		[SIGNATURE_TYPE.subkeyBinding],
		parts.primary,
		data,
	);
	let revocation = await newestValid(
		subkey.signatures,
		[SIGNATURE_TYPE.subkeyRevocation],
		parts.primary,
		data,
	);
	let self = binding ? describe(binding, subkey.key) : undefined;
	let flagsAllow = self?.flags !== undefined && (self.flags & KEY_FLAG.sign) !== 0;
	let canSign =
		binding !== undefined && flagsAllow && (await hasBackSignature(binding, subkey.key, data));
	return {
		fingerprint: upperHex(subkey.key.fingerprint),
		revoked: revocation !== undefined,
		expires: self?.expires,
		canSign,
		bound: binding !== undefined,
	};
}

/**
 * Checks that a key may have made a data signature at `at`: the primary is not revoked
 * and, for v6, carries a valid Direct Key signature; the signing key allows signing and
 * had not expired when the signature was made.
 *
 * @param parts - The certificate.
 * @param signer - The key (primary or subkey) that made the signature.
 * @param at - When the signature was made.
 */
export async function checkSigner(
	parts: KeyParts,
	signer: KeyPacket,
	at: Date,
): Promise<Result<KeyStatus, OpenPgpError>> {
	let invalid = (message: string) => failure(new OpenPgpError("invalid-signature", message));
	let primary = await primaryStatus(parts);
	if (primary.revoked) return invalid("The signing key's primary key is revoked.");
	if (!primary.bound) return invalid("The primary key has no valid Direct Key signature.");
	if (primary.expires && at > primary.expires)
		return invalid("The signing key had expired when the signature was made.");

	let status = primary;
	let subkey = parts.subkeys.find((entry) => entry.key === signer);
	if (subkey) status = await subkeyStatus(parts, subkey);
	if (status.revoked) return invalid("The signing subkey is revoked.");
	if (!status.canSign) return invalid("The signing key is not allowed to sign data.");
	if (status.expires && at > status.expires)
		return invalid("The signing key had expired when the signature was made.");
	return success(status);
}

/** The result of checking every self-signature on a certificate. */
export interface KeyVerification {
	primary: KeyStatus;
	/** Each User ID with whether a valid self-certification covers it. */
	userIds: Array<{ userId: string; certified: boolean }>;
	subkeys: KeyStatus[];
}

/**
 * Checks every self-signature on a certificate: the primary key's Direct Key signature
 * and revocations, each User ID's self-certification, and each subkey's binding.
 *
 * @param key - The certificate.
 * @param key.parts - Its packets, grouped.
 * @example
 * let status = await verifyKey(certificate);
 * status.primary.revoked; // false
 */
export async function verifyKey(key: { parts: KeyParts }): Promise<KeyVerification> {
	let { parts } = key;
	let certifications = [0x10, 0x11, 0x12, SIGNATURE_TYPE.positiveCertification];
	let userIds = [];
	for (let user of parts.users) {
		let data = concatBytes(keyHashInput(parts.primary), userIdHashInput(user.body));
		let signature = await newestValid(user.signatures, certifications, parts.primary, data);
		userIds.push({ userId: user.userId, certified: signature !== undefined });
	}
	let subkeys = [];
	for (let subkey of parts.subkeys) subkeys.push(await subkeyStatus(parts, subkey));
	return { primary: await primaryStatus(parts), userIds, subkeys };
}
