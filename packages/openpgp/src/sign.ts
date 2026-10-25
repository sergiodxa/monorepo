/**
 * Signing and verifying data (RFC 9580 §7, §10.4): cleartext signed messages with
 * dash-escaping, and detached signatures over binary or text data, so a document can
 * carry its signature inline or beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";

import type { HashName } from "./algorithms.js";
import type { KeyPacket, SecretKeyPacket } from "./key-packet.js";
import type { PrivateKey, PublicKey } from "./keys.js";
import type { Signer } from "./signature-engine.js";
import type { SignaturePacket } from "./signature-packet.js";

import {
	HASH_TEXT_NAMES,
	HASHES,
	hashById,
	KEY_FLAG,
	PACKET_TYPE,
	SIGNATURE_TYPE,
	SUBPACKET,
} from "./algorithms.js";
import { armor, dearmor } from "./armor.js";
import { OpenPgpError } from "./errors.js";
import { equalBytes, readUtf8, upperHex, utf8 } from "./lib/bytes.js";
import { readPackets, writePacket } from "./packets.js";
import { canonicalText, checkSignature, createSignature } from "./signature-engine.js";
import {
	createdAt,
	hashedSubpacket,
	issuerFingerprint,
	issuerKeyId,
	readSignaturePacket,
	secondsSubpacket,
} from "./signature-packet.js";
import { checkSigner } from "./validity.js";

/** How a signature is made. */
export interface SignOptions {
	/**
	 * The hash to sign with.
	 *
	 * @default "SHA-512"
	 */
	hash?: HashName;
	/** The signature's creation time. */
	date?: Date;
}

/** How a detached signature is made. */
export interface DetachedSignOptions extends SignOptions {
	/**
	 * Makes a text signature (type 0x01), which verifies whatever line endings the text
	 * later travels with; otherwise the octets are signed as they are (type 0x00).
	 *
	 * @default false
	 */
	text?: boolean;
}

/** A detached signature in both forms a verifier may want. */
export interface DetachedSignature {
	/** The Signature packet, framed. */
	binary: Bytes;
	/** The same packet as a `PGP SIGNATURE` block. */
	armored: string;
}

/** What a verified signature establishes. */
export interface VerifiedSignature {
	/** The fingerprint of the key that made it: the primary key or a signing subkey. */
	signingKey: string;
	/** The fingerprint of the certificate it belongs to. */
	primaryKey: string;
	/** When the signer says it was made. */
	created: Date;
	hash: HashName;
	/** Whether it is a text signature (type 0x01), which ignores line-ending differences. */
	text: boolean;
}

/** A verified cleartext signed message. */
export interface VerifiedCleartext {
	/** The signed text, unescaped, with the trailing whitespace the signature ignores removed. */
	text: string;
	signature: VerifiedSignature;
}

/** A cleartext signed message, split into its parts. */
export interface Cleartext {
	/** The signed text, dash-escaping removed, lines joined with LF. */
	text: string;
	/** The hash names its `Hash` armor headers list, which verification ignores. */
	hashes: string[];
	/** The binary Signature packets of its signature block. */
	signature: Bytes;
}

/** The cleartext framework's header line (RFC 9580 §7.1). */
const SIGNED_MESSAGE = "-----BEGIN PGP SIGNED MESSAGE-----";

/** The armor header line that ends the signed text. */
const SIGNATURE_BEGIN = "-----BEGIN PGP SIGNATURE-----";

/**
 * A line with the trailing spaces and tabs removed, which a cleartext signature ignores.
 *
 * @param line - One line of text.
 */
function trimLine(line: string): string {
	return line.replace(/[ \t]+$/, "");
}

/**
 * A line as written in a cleartext message: `- ` before one starting with a dash, which
 * RFC 9580 §7.2 requires, or with `From `, which it recommends.
 *
 * @param line - One line of the signed text.
 */
function dashEscape(line: string): string {
	return line.startsWith("-") || line.startsWith("From ") ? `- ${line}` : line;
}

/**
 * The first key flags octet the newest signature of the given types states, or
 * `undefined` when none does.
 *
 * @param signatures - The signatures to look through.
 * @param types - The signature types that state flags for the key.
 */
function statedFlags(signatures: SignaturePacket[], types: number[]): number | undefined {
	let stating = signatures
		.filter(
			(signature) =>
				types.includes(signature.type) && hashedSubpacket(signature, SUBPACKET.keyFlags),
		)
		.sort((left, right) => (createdAt(right)?.getTime() ?? 0) - (createdAt(left)?.getTime() ?? 0));
	return stating[0] ? hashedSubpacket(stating[0], SUBPACKET.keyFlags)?.[0] : undefined;
}

/**
 * The key a private key signs with: its newest signing subkey that is not revoked, else the
 * primary key when its flags allow signing. Self-signatures are trusted here, since they
 * come from the key's own holder.
 *
 * @param key - The private key.
 */
function selectSigner(key: PrivateKey): Result<Signer, OpenPgpError> {
	let { parts } = key;
	let subkeys = parts.subkeys
		.filter((subkey) => {
			let revoked = subkey.signatures.some(
				(signature) => signature.type === SIGNATURE_TYPE.subkeyRevocation,
			);
			let flags = statedFlags(subkey.signatures, [SIGNATURE_TYPE.subkeyBinding]);
			return !revoked && flags !== undefined && (flags & KEY_FLAG.sign) !== 0;
		})
		.sort((left, right) => right.key.created.getTime() - left.key.created.getTime())
		.map((subkey) => subkey.key);
	let certifications = [0x10, 0x11, 0x12, SIGNATURE_TYPE.positiveCertification];
	let primaryFlags =
		statedFlags(parts.directSignatures, [SIGNATURE_TYPE.directKey]) ??
		statedFlags(
			parts.users.flatMap((user) => user.signatures),
			certifications,
		);
	let primaryCanSign = primaryFlags === undefined || (primaryFlags & KEY_FLAG.sign) !== 0;
	let candidates = primaryCanSign ? [...subkeys, parts.primary] : subkeys;

	let locked = false;
	for (let candidate of candidates as Array<KeyPacket | SecretKeyPacket>) {
		if (!("protection" in candidate) || candidate.material.kind === "other") continue;
		if (candidate.secret !== null) return success({ key: candidate, secret: candidate.secret });
		if (candidate.protection?.s2k.type !== 101) locked = true;
	}
	if (locked)
		return failure(
			new OpenPgpError("locked", "The signing key is locked; unlock it with its passphrase."),
		);
	return failure(
		new OpenPgpError("unsupported", "The key has no secret signing key this package can use."),
	);
}

/**
 * Signs data with a private key and answers the Signature packet, framed.
 *
 * @param key - The private key.
 * @param type - The signature type.
 * @param data - The signed octets.
 * @param options - The hash and creation time.
 */
async function signData(
	key: PrivateKey,
	type: number,
	data: Bytes,
	options: SignOptions,
): Promise<Result<Bytes, OpenPgpError>> {
	let signer = selectSigner(key);
	if (isFailure(signer)) return signer;
	let created = new Date(Math.floor((options.date ?? new Date()).getTime() / 1000) * 1000);
	let body = await createSignature(signer.data, type, data, {
		hash: HASHES[options.hash ?? "SHA-512"],
		created,
	});
	if (isFailure(body)) return body;
	return success(writePacket(PACKET_TYPE.signature, body.data));
}

/**
 * Signs text as a cleartext signed message (RFC 9580 §7): the text stays readable,
 * trailing whitespace is removed from every line (the signature ignores it), lines
 * starting with `-` or `From ` are dash-escaped, and the armored signature follows.
 * A version 4 key also writes the `Hash` header older verifiers expect.
 *
 * @param text - The text to sign; LF or CRLF line endings.
 * @param key - An unlocked private key.
 * @param options - The hash and creation time.
 * @example
 * let signed = await signCleartext("Contact: mailto:security@example.com\n", key);
 */
export async function signCleartext(
	text: string,
	key: PrivateKey,
	options: SignOptions = {},
): Promise<Result<string, OpenPgpError>> {
	let lines = text.split(/\r?\n/).map(trimLine);
	let packet = await signData(key, SIGNATURE_TYPE.text, utf8(lines.join("\r\n")), options);
	if (isFailure(packet)) return packet;

	let version = key.version;
	let header = version === 4 ? `Hash: ${HASHES[options.hash ?? "SHA-512"].textName}\n` : "";
	let signature = armor("signature", packet.data, { checksum: version === 4 });
	return success(`${SIGNED_MESSAGE}\n${header}\n${lines.map(dashEscape).join("\n")}\n${signature}`);
}

/**
 * Splits a cleartext signed message into its text, `Hash` headers and signature. Any
 * armor header other than a well-formed `Hash` fails the read, as §7.1 requires a
 * verifier to decline such a message.
 *
 * @param message - The cleartext signed message.
 * @example
 * let parts = readCleartext(signedText);
 * if (isSuccess(parts)) parts.data.text;
 */
export function readCleartext(message: string): Result<Cleartext, OpenPgpError> {
	let lines = message.split(/\r?\n/);
	let start = lines.findIndex((line) => trimLine(line) === SIGNED_MESSAGE);
	if (start === -1)
		return failure(new OpenPgpError("no-signature", "The text is not a cleartext signed message."));

	let hashes: string[] = [];
	let index = start + 1;
	for (; index < lines.length && (lines[index] ?? "").trim() !== ""; index++) {
		let header = /^Hash: (.+)$/.exec(lines[index] ?? "");
		let names = header?.[1]?.split(",").map((name) => name.trim()) ?? [];
		if (!header || names.some((name) => !HASH_TEXT_NAMES.has(name))) {
			return failure(
				new OpenPgpError(
					"malformed",
					`The cleartext header "${lines[index]}" is not a valid Hash header.`,
				),
			);
		}
		hashes.push(...names);
	}

	let end = lines.findIndex(
		(line, position) => position > index && trimLine(line) === SIGNATURE_BEGIN,
	);
	if (end === -1)
		return failure(new OpenPgpError("malformed", "The signed message has no signature block."));
	let text = lines
		.slice(index + 1, end)
		.map((line) => (line.startsWith("- ") ? line.slice(2) : line))
		.join("\n");

	let block = dearmor(lines.slice(end).join("\n"));
	if (isFailure(block)) return block;
	if (block.data.type !== "signature")
		return failure(new OpenPgpError("malformed", "The signature block is not a PGP SIGNATURE."));
	return success({ text, hashes, signature: block.data.data });
}

/**
 * The key packets in the certificates that could have made a signature: those its issuer
 * fingerprint or Key ID names, or, when it names none, every key of its algorithm.
 *
 * @param signature - The signature.
 * @param keys - The certificates to search.
 */
function candidatesFor(
	signature: SignaturePacket,
	keys: PublicKey[],
): Array<{ certificate: PublicKey; key: KeyPacket }> {
	let fingerprint = issuerFingerprint(signature);
	let keyId = issuerKeyId(signature);
	return keys.flatMap((certificate) =>
		[certificate.parts.primary, ...certificate.parts.subkeys.map((subkey) => subkey.key)]
			.filter((key) => {
				if (fingerprint) return equalBytes(fingerprint, key.fingerprint);
				if (keyId) return equalBytes(keyId, key.keyId);
				return key.algorithm === signature.algorithm;
			})
			.map((key) => ({ certificate, key })),
	);
}

/**
 * Verifies the first signature among the packets that one of the keys made over the data
 * and was entitled to make: unexpired, by an unrevoked key allowed to sign.
 *
 * @param signatureBytes - Binary Signature packets.
 * @param keys - The certificates to accept signatures from.
 * @param dataFor - The signed octets for a signature type, or `undefined` for a type that does not apply.
 */
async function verifyPackets(
	signatureBytes: Bytes,
	keys: PublicKey[],
	dataFor: (type: number) => Bytes | undefined,
): Promise<Result<VerifiedSignature, OpenPgpError>> {
	let packets = readPackets(signatureBytes);
	if (isFailure(packets)) return packets;
	let signatures = packets.data
		.filter((packet) => packet.type === PACKET_TYPE.signature)
		.map((packet) => readSignaturePacket(packet.body))
		.filter(isSuccess)
		.map((signature) => signature.data);
	if (signatures.length === 0)
		return failure(
			new OpenPgpError("no-signature", "No signature this package can read was found."),
		);

	let lastError = new OpenPgpError("unknown-signer", "None of the given keys made the signature.");
	for (let signature of signatures) {
		let data = dataFor(signature.type);
		let created = createdAt(signature);
		let hash = hashById(signature.hash);
		if (data === undefined || created === undefined || hash === undefined) continue;
		let lifetime = secondsSubpacket(signature, SUBPACKET.expirationTime);
		if (lifetime !== undefined && Date.now() > created.getTime() + lifetime * 1000) {
			lastError = new OpenPgpError("invalid-signature", "The signature has expired.");
			continue;
		}
		for (let { certificate, key } of candidatesFor(signature, keys)) {
			let checked = await checkSignature(signature, key, data);
			if (checked.status === "success") {
				let signer = await checkSigner(certificate.parts, key, created);
				if (signer.status === "success") {
					return success({
						signingKey: upperHex(key.fingerprint),
						primaryKey: certificate.fingerprint,
						created,
						hash: hash.name,
						text: signature.type === SIGNATURE_TYPE.text,
					});
				}
				lastError = signer.error;
			} else lastError = checked.error;
		}
	}
	return failure(lastError);
}

/**
 * Verifies a cleartext signed message against one or more certificates and answers the
 * signed text with who signed it. Only text signatures (type 0x01) count, as the
 * framework defines; the text is compared with trailing whitespace removed from each line.
 *
 * @param message - The cleartext signed message.
 * @param keys - The certificates whose signatures are accepted.
 * @example
 * let verified = await verifyCleartext(securityTxt, certificate);
 * if (isSuccess(verified)) verified.data.text;
 */
export async function verifyCleartext(
	message: string,
	keys: PublicKey | PublicKey[],
): Promise<Result<VerifiedCleartext, OpenPgpError>> {
	let cleartext = readCleartext(message);
	if (isFailure(cleartext)) return cleartext;
	let text = cleartext.data.text.split("\n").map(trimLine).join("\n");
	let data = utf8(text.replace(/\n/g, "\r\n"));
	let verified = await verifyPackets(cleartext.data.signature, [keys].flat(), (type) =>
		type === SIGNATURE_TYPE.text ? data : undefined,
	);
	if (isFailure(verified)) return verified;
	return success({ text, signature: verified.data });
}

/**
 * Makes a detached signature over data: binary (type 0x00) by default, or a text
 * signature (type 0x01) over the data's lines with CRLF endings.
 *
 * @param data - The octets or text to sign; text is signed as UTF-8.
 * @param key - An unlocked private key.
 * @param options - Text mode, the hash and creation time.
 * @example
 * let signature = await signDetached(await file.bytes(), key);
 * if (isSuccess(signature)) await save("file.asc", signature.data.armored);
 */
export async function signDetached(
	data: string | Uint8Array,
	key: PrivateKey,
	options: DetachedSignOptions = {},
): Promise<Result<DetachedSignature, OpenPgpError>> {
	let bytes = typeof data === "string" ? utf8(data) : Uint8Array.from(data);
	let signed = options.text ? canonicalText(readUtf8(bytes)) : bytes;
	let packet = await signData(
		key,
		options.text ? SIGNATURE_TYPE.text : SIGNATURE_TYPE.binary,
		signed,
		options,
	);
	if (isFailure(packet)) return packet;
	return success({
		binary: packet.data,
		armored: armor("signature", packet.data, { checksum: key.version === 4 }),
	});
}

/**
 * Verifies a detached signature over data against one or more certificates. Text
 * signatures are checked over the data with CRLF line endings; binary ones over the octets.
 *
 * @param data - The signed octets or text.
 * @param signature - A `PGP SIGNATURE` block or binary Signature packets.
 * @param keys - The certificates whose signatures are accepted.
 * @example
 * let verified = await verifyDetached(bytes, armoredSignature, certificate);
 */
export async function verifyDetached(
	data: string | Uint8Array,
	signature: string | Uint8Array,
	keys: PublicKey | PublicKey[],
): Promise<Result<VerifiedSignature, OpenPgpError>> {
	let signatureBytes: Bytes;
	if (typeof signature === "string") {
		let block = dearmor(signature);
		if (isFailure(block)) return block;
		signatureBytes = block.data.data;
	} else signatureBytes = Uint8Array.from(signature);

	let bytes = typeof data === "string" ? utf8(data) : Uint8Array.from(data);
	let text = canonicalText(readUtf8(bytes));
	return await verifyPackets(signatureBytes, [keys].flat(), (type) => {
		if (type === SIGNATURE_TYPE.binary) return bytes;
		return type === SIGNATURE_TYPE.text ? text : undefined;
	});
}
