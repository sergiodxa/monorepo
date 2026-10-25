/**
 * Transferable public and secret keys (RFC 9580 §10.1, §10.2): reads them from armor or
 * binary, writes them back, generates Ed25519 signing keys and locks or unlocks their
 * secret material, so a key round-trips through a secret store unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { concatBytes } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import type { SigningAlgorithm } from "./algorithms.js";
import type { KeyPacket, SecretKeyPacket } from "./key-packet.js";
import type { SignaturePacket } from "./signature-packet.js";

import {
	HASHES,
	KEY_FLAG,
	PACKET_TYPE,
	PUBLIC_KEY_ALGORITHM,
	SIGNATURE_TYPE,
	SUBPACKET,
} from "./algorithms.js";
import { armor, dearmor } from "./armor.js";
import { OpenPgpError } from "./errors.js";
import {
	publicFields,
	publicKeyBody,
	readPublicKeyPacket,
	readSecretKeyPacket,
	writeSecretKeyBody,
} from "./key-packet.js";
import { mpi, readUtf8, upperHex, utf8 } from "./lib/bytes.js";
import { readPackets, writePacket } from "./packets.js";
import { generateEd25519 } from "./primitives.js";
import { lockSecret, unlockSecret } from "./protection.js";
import { createSignature, keyHashInput, subpacket, userIdHashInput } from "./signature-engine.js";
import { readSignaturePacket } from "./signature-packet.js";

/** A User ID and the signatures certifying it. */
export interface UserIdEntry {
	userId: string;
	/** The User ID packet body, the octets certifications hash. */
	body: Bytes;
	signatures: SignaturePacket[];
}

/** A User Attribute, kept so a key written back keeps every packet it was read with. */
export interface AttributeEntry {
	body: Bytes;
	signatures: SignaturePacket[];
}

/**
 * A subkey and the signatures binding or revoking it.
 *
 * @template Key - The key packet form: public, or secret in a private key.
 */
export interface SubkeyEntry<Key extends KeyPacket = KeyPacket> {
	key: Key;
	signatures: SignaturePacket[];
}

/**
 * The packets of one transferable key, grouped as RFC 9580 §10.1 orders them.
 *
 * @template Key - The key packet form.
 */
export interface KeyParts<Key extends KeyPacket = KeyPacket> {
	primary: Key;
	/** Direct-key and key-revocation signatures on the primary key. */
	directSignatures: SignaturePacket[];
	users: UserIdEntry[];
	attributes: AttributeEntry[];
	subkeys: Array<SubkeyEntry<Key>>;
}

/** How a key is generated. */
export interface GenerateKeyOptions {
	/** The User ID to certify, such as `Security Team <security@example.com>`; v4 tools need one. */
	userId?: string;
	/**
	 * The key version: 6 (RFC 9580) or 4, which GnuPG 2.2 and other RFC 4880 tools read.
	 *
	 * @default 6
	 */
	version?: 4 | 6;
	/**
	 * The signing algorithm. `ed25519-legacy` is the EdDSALegacy form only version 4 keys
	 * use, which GnuPG 2.2 reads; `ed25519` is the RFC 9580 algorithm.
	 *
	 * @default "ed25519" for version 6, "ed25519-legacy" for version 4
	 */
	algorithm?: Extract<SigningAlgorithm, "ed25519" | "ed25519-legacy">;
	/** The creation time of the key and its self-signatures. */
	date?: Date;
}

/** How a private key is read. */
export interface ReadPrivateKeyOptions {
	/** Unlocks passphrase-protected material on read. */
	passphrase?: string;
}

/**
 * The bytes an armored or binary key input holds, checking the armor type.
 *
 * @param input - Armored text or binary packets.
 * @param types - The armor types accepted.
 */
function keyBytes(input: string | Uint8Array, types: string[]): Result<Bytes, OpenPgpError> {
	if (typeof input !== "string") return success(Uint8Array.from(input));
	let block = dearmor(input);
	if (isFailure(block)) return block;
	if (!types.includes(block.data.type)) {
		return failure(
			new OpenPgpError("malformed", `Expected a key block, found "${block.data.type}" armor.`),
		);
	}
	return success(block.data.data);
}

/**
 * Groups key packets into the parts of the first transferable key in the stream. Trust,
 * marker and padding packets are dropped, and a signature of an unknown version is
 * skipped rather than failing the key (§5.2.5).
 *
 * @param bytes - Binary packets.
 * @param allowSecret - Whether secret packets are kept as secret; otherwise reduced to public.
 */
async function readParts(
	bytes: Bytes,
	allowSecret: boolean,
): Promise<Result<KeyParts<KeyPacket | SecretKeyPacket>, OpenPgpError>> {
	let packets = readPackets(bytes);
	if (isFailure(packets)) return packets;
	let [first, ...rest] = packets.data;
	if (first?.type !== PACKET_TYPE.publicKey && first?.type !== PACKET_TYPE.secretKey) {
		return failure(new OpenPgpError("malformed", "The data does not start with a key packet."));
	}

	let readKey = async (
		type: number,
		body: Bytes,
	): Promise<Result<KeyPacket | SecretKeyPacket, OpenPgpError>> => {
		if (type !== PACKET_TYPE.secretKey && type !== PACKET_TYPE.secretSubkey)
			return await readPublicKeyPacket(body);
		let key = await readSecretKeyPacket(body);
		if (allowSecret || isFailure(key)) return key;
		return success(toPublicPacket(key.data));
	};

	let primary = await readKey(first.type, first.body);
	if (isFailure(primary)) return primary;

	let parts: KeyParts<KeyPacket | SecretKeyPacket> = {
		primary: primary.data,
		directSignatures: [],
		users: [],
		attributes: [],
		subkeys: [],
	};
	let target: SignaturePacket[] = parts.directSignatures;

	for (let packet of rest) {
		if (packet.type === PACKET_TYPE.publicKey || packet.type === PACKET_TYPE.secretKey) break;
		if (packet.type === PACKET_TYPE.signature) {
			let signature = readSignaturePacket(packet.body);
			if (signature.status === "success") target.push(signature.data);
		} else if (packet.type === PACKET_TYPE.userId) {
			let entry: UserIdEntry = { userId: readUtf8(packet.body), body: packet.body, signatures: [] };
			parts.users.push(entry);
			target = entry.signatures;
		} else if (packet.type === PACKET_TYPE.userAttribute) {
			let entry: AttributeEntry = { body: packet.body, signatures: [] };
			parts.attributes.push(entry);
			target = entry.signatures;
		} else if (
			packet.type === PACKET_TYPE.publicSubkey ||
			packet.type === PACKET_TYPE.secretSubkey
		) {
			let key = await readKey(packet.type, packet.body);
			if (isFailure(key)) return key;
			if (key.data.version !== primary.data.version) {
				return failure(
					new OpenPgpError("malformed", "A subkey's version differs from its primary key's."),
				);
			}
			let entry: SubkeyEntry<KeyPacket | SecretKeyPacket> = { key: key.data, signatures: [] };
			parts.subkeys.push(entry);
			target = entry.signatures;
		}
	}
	return success(parts);
}

/**
 * Whether a key packet carries secret material.
 *
 * @param key - A public or secret key packet.
 */
function isSecret(key: KeyPacket): key is SecretKeyPacket {
	return "protection" in key;
}

/**
 * The public form of a key packet: the same identity without secret fields.
 *
 * @param key - A public or secret key packet.
 */
function toPublicPacket(key: KeyPacket): KeyPacket {
	let { version, created, algorithm, material, body, fingerprint, keyId } = key;
	return { version, created, algorithm, material, body, fingerprint, keyId };
}

/**
 * The packets of a key's parts, in RFC 9580 §10.1 order.
 *
 * @param parts - The key's parts.
 * @param writeKey - Frames a key packet; `primary` tells the primary from a subkey.
 */
function partsToBytes<Key extends KeyPacket>(
	parts: KeyParts<Key>,
	writeKey: (key: Key, primary: boolean) => Bytes,
): Bytes {
	let signatures = (list: SignaturePacket[]) =>
		list.map((signature) => writePacket(PACKET_TYPE.signature, signature.body));
	return concatBytes(
		writeKey(parts.primary, true),
		...signatures(parts.directSignatures),
		...parts.users.flatMap((user) => [
			writePacket(PACKET_TYPE.userId, user.body),
			...signatures(user.signatures),
		]),
		...parts.attributes.flatMap((entry) => [
			writePacket(PACKET_TYPE.userAttribute, entry.body),
			...signatures(entry.signatures),
		]),
		...parts.subkeys.flatMap((subkey) => [
			writeKey(subkey.key, false),
			...signatures(subkey.signatures),
		]),
	);
}

/** An OpenPGP certificate: a primary public key with its User IDs, subkeys and signatures. */
export class PublicKey {
	/** The packets the certificate was read from or built with. */
	readonly parts: KeyParts;

	/** @param parts - The certificate's packets, grouped. */
	constructor(parts: KeyParts) {
		this.parts = parts;
	}

	/** The primary key's version, which every signature it makes must share. */
	get version(): 4 | 6 {
		return this.parts.primary.version;
	}

	/** The primary key's fingerprint as uppercase hex: 40 characters for v4, 64 for v6. */
	get fingerprint(): string {
		return upperHex(this.parts.primary.fingerprint);
	}

	/** The primary key's 64-bit Key ID as uppercase hex. */
	get keyId(): string {
		return upperHex(this.parts.primary.keyId);
	}

	/** When the primary key was created, to the second. */
	get created(): Date {
		return this.parts.primary.created;
	}

	/** The User IDs in the order the certificate lists them, certified or not. */
	get userIds(): string[] {
		return this.parts.users.map((user) => user.userId);
	}

	/** The certificate as binary packets. */
	toBytes(): Bytes {
		return partsToBytes(this.parts, (key, primary) =>
			writePacket(primary ? PACKET_TYPE.publicKey : PACKET_TYPE.publicSubkey, key.body),
		);
	}

	/**
	 * The certificate as a `PGP PUBLIC KEY BLOCK`, with the CRC24 footer only for a
	 * version 4 key, whose older readers may expect it.
	 */
	armor(): string {
		return armor("public-key", this.toBytes(), { checksum: this.version === 4 });
	}
}

/** A transferable secret key: the certificate plus the secret material of its keys. */
export class PrivateKey {
	/** The packets the key was read from or built with; secret packets carry their material. */
	readonly parts: KeyParts<KeyPacket | SecretKeyPacket>;

	/** @param parts - The key's packets, grouped. */
	constructor(parts: KeyParts<KeyPacket | SecretKeyPacket>) {
		this.parts = parts;
	}

	/** The primary key's version. */
	get version(): 4 | 6 {
		return this.parts.primary.version;
	}

	/** The primary key's fingerprint as uppercase hex. */
	get fingerprint(): string {
		return upperHex(this.parts.primary.fingerprint);
	}

	/** The primary key's 64-bit Key ID as uppercase hex. */
	get keyId(): string {
		return upperHex(this.parts.primary.keyId);
	}

	/** The User IDs in the order the key lists them. */
	get userIds(): string[] {
		return this.parts.users.map((user) => user.userId);
	}

	/** Whether any secret material is still encrypted, so signing with it needs `unlock` first. */
	get locked(): boolean {
		return this.secretPackets().some(
			(key) => key.secret === null && key.protection?.s2k.type !== 101,
		);
	}

	/** The certificate to publish: the same packets with every secret removed. */
	get publicKey(): PublicKey {
		return new PublicKey({
			...this.parts,
			primary: toPublicPacket(this.parts.primary),
			subkeys: this.parts.subkeys.map((subkey) => ({ ...subkey, key: toPublicPacket(subkey.key) })),
		});
	}

	/** The key packets that hold secret material, primary first. */
	private secretPackets(): SecretKeyPacket[] {
		return [this.parts.primary, ...this.parts.subkeys.map((subkey) => subkey.key)].filter(isSecret);
	}

	/**
	 * A copy with every protected secret decrypted. A wrong passphrase fails the whole call.
	 *
	 * @param passphrase - The passphrase the key was locked with.
	 */
	async unlock(passphrase: string): Promise<Result<PrivateKey, OpenPgpError>> {
		let unlockOne = async (
			key: KeyPacket,
			type: number,
		): Promise<Result<KeyPacket, OpenPgpError>> => {
			if (
				!isSecret(key) ||
				key.secret !== null ||
				key.protection === null ||
				key.protection.s2k.type === 101
			) {
				return success(key);
			}
			let secret = await unlockSecret(key, type, key.protection, passphrase);
			if (isFailure(secret)) return secret;
			return success({ ...key, secret: secret.data, protection: null });
		};
		return await this.mapKeys(unlockOne);
	}

	/**
	 * A copy with every secret encrypted under the passphrase: Iterated-and-Salted SHA-256,
	 * HKDF and AES-256-GCM (S2K usage 253). The key must be unlocked first.
	 *
	 * @param passphrase - The passphrase to lock with.
	 */
	async lock(passphrase: string): Promise<Result<PrivateKey, OpenPgpError>> {
		if (this.locked)
			return failure(new OpenPgpError("locked", "Unlock the key before locking it again."));
		let lockOne = async (
			key: KeyPacket,
			type: number,
		): Promise<Result<KeyPacket, OpenPgpError>> => {
			if (!isSecret(key) || key.secret === null) return success(key);
			let protection = await lockSecret(key, type, key.secret, passphrase);
			if (isFailure(protection)) return protection;
			return success({ ...key, secret: null, protection: protection.data });
		};
		return await this.mapKeys(lockOne);
	}

	/**
	 * A copy with each key packet replaced, failing on the first replacement that fails.
	 *
	 * @param replace - Maps a key packet and its packet type to its replacement.
	 */
	private async mapKeys(
		replace: (key: KeyPacket, type: number) => Promise<Result<KeyPacket, OpenPgpError>>,
	): Promise<Result<PrivateKey, OpenPgpError>> {
		let primary = await replace(this.parts.primary, PACKET_TYPE.secretKey);
		if (isFailure(primary)) return primary;
		let subkeys: Array<SubkeyEntry<KeyPacket | SecretKeyPacket>> = [];
		for (let subkey of this.parts.subkeys) {
			let key = await replace(subkey.key, PACKET_TYPE.secretSubkey);
			if (isFailure(key)) return key;
			subkeys.push({ ...subkey, key: key.data });
		}
		return success(new PrivateKey({ ...this.parts, primary: primary.data, subkeys }));
	}

	/** The key as binary packets, locked material kept as it was read. */
	toBytes(): Bytes {
		return partsToBytes(this.parts, (key, primary) => {
			if (!isSecret(key))
				return writePacket(primary ? PACKET_TYPE.publicKey : PACKET_TYPE.publicSubkey, key.body);
			let body = writeSecretKeyBody(key, key.secret ?? new Uint8Array(0), key.protection);
			return writePacket(primary ? PACKET_TYPE.secretKey : PACKET_TYPE.secretSubkey, body);
		});
	}

	/** The key as a `PGP PRIVATE KEY BLOCK`, with the CRC24 footer only for a version 4 key. */
	armor(): string {
		return armor("private-key", this.toBytes(), { checksum: this.version === 4 });
	}
}

/**
 * Reads a certificate from armor (`PGP PUBLIC KEY BLOCK`, or a private key block, whose
 * secrets are dropped) or binary packets. Only the first key in a keyring is read, and
 * no self-signature is checked until a signature is verified with it.
 *
 * @param input - Armored text or binary packets.
 * @example
 * let key = await readPublicKey(armoredCertificate);
 * if (isSuccess(key)) key.data.fingerprint;
 */
export async function readPublicKey(
	input: string | Uint8Array,
): Promise<Result<PublicKey, OpenPgpError>> {
	let bytes = keyBytes(input, ["public-key", "private-key"]);
	if (isFailure(bytes)) return bytes;
	let parts = await readParts(bytes.data, false);
	if (isFailure(parts)) return parts;
	return success(new PublicKey(parts.data));
}

/**
 * Reads a transferable secret key from armor (`PGP PRIVATE KEY BLOCK`) or binary packets,
 * unlocking it when a passphrase is given. Without one a protected key reads but stays
 * `locked`, and signing with it fails until `unlock`.
 *
 * @param input - Armored text or binary packets.
 * @param options - The passphrase to unlock with.
 * @example
 * let key = await readPrivateKey(env.SIGNING_KEY);
 */
export async function readPrivateKey(
	input: string | Uint8Array,
	options: ReadPrivateKeyOptions = {},
): Promise<Result<PrivateKey, OpenPgpError>> {
	let bytes = keyBytes(input, ["private-key"]);
	if (isFailure(bytes)) return bytes;
	let parts = await readParts(bytes.data, true);
	if (isFailure(parts)) return parts;
	if (!isSecret(parts.data.primary) && !parts.data.subkeys.some((subkey) => isSecret(subkey.key))) {
		return failure(new OpenPgpError("malformed", "The key holds no secret key packet."));
	}
	let key = new PrivateKey(parts.data);
	if (options.passphrase === undefined || !key.locked) return success(key);
	return await key.unlock(options.passphrase);
}

/**
 * Generates an Ed25519 signing key: a version 6 key with a Direct Key self-signature
 * (key flags certify and sign, SHA-512 then SHA-256 preferred), or a version 4 key whose
 * preferences ride on the User ID certification, plus a positive certification of the User ID.
 *
 * @param options - The User ID, version, algorithm and creation time.
 * @example
 * let key = await generateKey({ userId: "Security <security@example.com>" });
 * if (isSuccess(key)) await save(key.data.armor(), key.data.publicKey.armor());
 */
export async function generateKey(
	options: GenerateKeyOptions = {},
): Promise<Result<PrivateKey, OpenPgpError>> {
	let version = options.version ?? 6;
	let algorithm = options.algorithm ?? (version === 6 ? "ed25519" : "ed25519-legacy");
	if (version === 6 && algorithm === "ed25519-legacy") {
		return failure(new OpenPgpError("unsupported", "Ed25519Legacy keys are version 4 only."));
	}
	let created = new Date(Math.floor((options.date ?? new Date()).getTime() / 1000) * 1000);
	let { seed, point } = await generateEd25519();

	let legacy = algorithm === "ed25519-legacy";
	let material = legacy
		? { kind: "ed25519-legacy" as const, point }
		: { kind: "ed25519" as const, point };
	let algorithmId = legacy ? PUBLIC_KEY_ALGORITHM.eddsaLegacy : PUBLIC_KEY_ALGORITHM.ed25519;
	let body = publicKeyBody(version, created, algorithmId, publicFields(material));
	let identity = await readPublicKeyPacket(body);
	if (isFailure(identity)) return identity;

	let secret = legacy ? mpi(seed) : seed;
	let primary: SecretKeyPacket = { ...identity.data, secret, protection: null };
	let signer = { key: primary, secret };
	let hash = HASHES["SHA-512"];
	let preferences = [
		subpacket(SUBPACKET.keyFlags, Uint8Array.of(KEY_FLAG.certify | KEY_FLAG.sign), true),
		subpacket(SUBPACKET.preferredHash, Uint8Array.of(HASHES["SHA-512"].id, HASHES["SHA-256"].id)),
	];

	let parts: KeyParts<KeyPacket | SecretKeyPacket> = {
		primary,
		directSignatures: [],
		users: [],
		attributes: [],
		subkeys: [],
	};
	if (version === 6) {
		let direct = await createSignature(signer, SIGNATURE_TYPE.directKey, keyHashInput(primary), {
			hash,
			created,
			subpackets: preferences,
		});
		if (isFailure(direct)) return direct;
		let signature = readSignaturePacket(direct.data);
		if (isFailure(signature)) return signature;
		parts.directSignatures.push(signature.data);
	}
	if (options.userId !== undefined) {
		let userBody = utf8(options.userId);
		let subpackets = [
			subpacket(SUBPACKET.primaryUserId, Uint8Array.of(1)),
			...(version === 4 ? preferences : []),
		];
		let certification = await createSignature(
			signer,
			SIGNATURE_TYPE.positiveCertification,
			concatBytes(keyHashInput(primary), userIdHashInput(userBody)),
			{ hash, created, subpackets },
		);
		if (isFailure(certification)) return certification;
		let signature = readSignaturePacket(certification.data);
		if (isFailure(signature)) return signature;
		parts.users.push({ userId: options.userId, body: userBody, signatures: [signature.data] });
	}
	return success(new PrivateKey(parts));
}
