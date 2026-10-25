/**
 * OpenPGP (RFC 9580) signing and verification on Web Crypto: ASCII armor, version 4 and 6
 * keys, cleartext signed messages and detached signatures, with encryption, the web of
 * trust and keyservers left to other tools.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { HashName, SigningAlgorithm } from "./algorithms.js";
export type { ArmorOptions, Armored, ArmorType } from "./armor.js";
export type { OpenPgpErrorCode } from "./errors.js";
export type { KeyPacket, Protection, PublicMaterial, SecretKeyPacket } from "./key-packet.js";
export type {
	AttributeEntry,
	GenerateKeyOptions,
	KeyParts,
	ReadPrivateKeyOptions,
	SubkeyEntry,
	UserIdEntry,
} from "./keys.js";
export type { Packet } from "./packets.js";
export type { S2K } from "./s2k.js";
export type {
	Cleartext,
	DetachedSignature,
	DetachedSignOptions,
	SignOptions,
	VerifiedCleartext,
	VerifiedSignature,
} from "./sign.js";
export type { SignaturePacket, Subpacket } from "./signature-packet.js";
export type { KeyStatus, KeyVerification } from "./validity.js";

export { armor, crc24, dearmor } from "./armor.js";
export { OpenPgpError } from "./errors.js";
export { generateKey, PrivateKey, PublicKey, readPrivateKey, readPublicKey } from "./keys.js";
export { readPackets, writePacket } from "./packets.js";
export {
	readCleartext,
	signCleartext,
	signDetached,
	verifyCleartext,
	verifyDetached,
} from "./sign.js";
export { verifyKey } from "./validity.js";
